import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const copy = v => JSON.parse(JSON.stringify(v));
async function workspace(t, data, customize = () => {}, setupState = () => {}) {
 const dom = new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>', {url:'https://example.com', runScripts:'outside-only', pretendToBeVisual:true});
 const w=dom.window,d=w.document;t.after(()=>w.close());w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.Blob=Blob;
 const timers=new Map();let timerId=0,owner='owner',ready=true,renders=0,writes=0;
 w.setTimeout=(fn,delay)=>{const id=++timerId;if(delay===50)queueMicrotask(fn);else timers.set(id,{fn,delay});return id;};w.clearTimeout=id=>timers.delete(id);w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
 for(const file of ['validator-engine.js','validator-files.js','validator-studio.js'])w.eval(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 const E=w.WorkHubValidatorEngine,template=E.example();customize(template,E);
 let state={projects:[],projectCompanies:[],workhub:{validator:{templates:[template],runs:[]}}},ui;setupState(state);
 const render=()=>{renders++;d.getElementById('view').innerHTML=ui.render();};
 ui=w.WorkHubValidatorStudio.install({state:()=>state,owner:()=>owner,ready:()=>ready,render,tell:()=>{},mutate(fn){const next=E.copy(state);fn(next);E.prepare(next,state);E.validateState(next);state=next;writes++;render();return true;},openModal(title,body){d.getElementById('modalBody').innerHTML=body;d.getElementById('modal').showModal();},closeModal(){d.getElementById('modal').close();}});
 render();await ui.loadFile({name:'data.csv',size:data.length,text:async()=>data});const company=d.querySelector('[name="validationCompany"]');if(company){company.value=state.projectCompanies.find(c=>c.active!==false).id;company.dispatchEvent(new w.Event('change',{bubbles:true}));}await ui.run();
 return {ui,w,d,E,counts:()=>({renders,writes}),state:()=>state,timers,signOut(){owner='other';ready=false;ui.sync();},edit(index,field,value,type='change'){const el=d.querySelector(`[data-cell="${index}"][data-field="${field}"]`);el.value=value;el.dispatchEvent(new w.Event(type,{bubbles:true}));return el;}};
}
const header='Request ID,Request type,Owner,Amount,Start date,End date\n';
const row=(id='PRIVATE-001',type='Standard',owner='Aisha',amount='25')=>[id,type,owner,amount,'2026-10-20','2026-10-21'].join(',');

test('live correction updates all dependent issues in place without a workspace render, cloud write or extra run',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001','Urgent','', '-5')), {ui,d}=x, before=x.counts();
 const cell=d.querySelector('[data-cell="0"][data-field="OWNER"]'),other=d.querySelector('[data-cell="0"][data-field="AMOUNT"]'),run=d.querySelector('[data-val="run"]');
 cell.focus();x.edit(0,'OWNER','Mira');
 assert.equal(ui.snapshot().result.errors,1);assert.equal(d.querySelector('[data-cell="0"][data-field="OWNER"]'),cell);assert.equal(d.querySelector('[data-cell="0"][data-field="AMOUNT"]'),other);assert.equal(d.activeElement,cell);assert.equal(d.querySelector('[data-val="run"]'),run);assert.deepEqual(x.counts(),before);assert.equal(x.state().workhub.validator.runs.length,1);
 x.edit(0,'AMOUNT','25');assert.equal(ui.snapshot().result.errors,0);assert.equal(d.querySelector('[data-val="report"]').disabled,false);assert.equal(JSON.stringify(x.state()).includes('PRIVATE-001'),false);
});

test('live typing debounces checks, retains selection and scroll, and prevents stale exports until the latest edit is checked',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001','Standard','Aisha','wrong')), {d,ui}=x;
 const cell=d.querySelector('[data-field="AMOUNT"][data-cell]'),scroll=d.getElementById('valResultsScroll');scroll.scrollTop=83;scroll.scrollLeft=137;cell.focus();
 x.edit(0,'AMOUNT','2','input');x.edit(0,'AMOUNT','25','input');cell.setSelectionRange(1,1);
 assert.equal(ui.snapshot().livePending,true);assert.equal(d.querySelector('[data-val="report"]').disabled,true);await assert.rejects(ui.handle({dataset:{val:'report'}}),/Wait for validation/);
 assert.equal([...x.timers.values()].filter(t=>t.delay===250).length,1);[...x.timers.values()].find(t=>t.delay===250).fn();
 assert.equal(ui.snapshot().result.errors,0);assert.equal(ui.snapshot().livePending,false);assert.equal(d.activeElement,cell);assert.equal(cell.selectionStart,1);assert.equal(scroll.scrollLeft,137);assert.equal(scroll.scrollTop,83);
});

test('suggested corrections recheck immediately, keep filtered rows visible, and preserve other cell and button identities',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001','Wrong')+'\n'+row('PRIVATE-002','Wrong')), {ui,d}=x;
 await ui.handle({dataset:{val:'filter',filter:'errors'}});const other=d.querySelector('[data-cell="1"][data-field="TYPE"]'),suggest=d.querySelector('[data-val="suggest"][data-index="1"][data-field="TYPE"]'),before=x.counts();
 ui.openCorrections(0,'TYPE');const choice=[...d.querySelectorAll('[data-val="apply-correction"]')].find(b=>b.querySelector('strong').textContent==='Standard');ui.applyCorrection(Number(choice.dataset.choice));
 assert.equal(ui.snapshot().result.errors,1);assert.equal(d.querySelector('[data-cell="1"][data-field="TYPE"]'),other);assert.equal(d.querySelector('[data-val="suggest"][data-index="1"][data-field="TYPE"]'),suggest);assert.ok(d.querySelector('[data-cell="0"][data-field="TYPE"]'));assert.ok(d.querySelector('[data-val="filter"][data-filter="errors"]').classList.contains('is-active'));assert.deepEqual(x.counts(),before);
 await ui.handle(suggest);assert.equal(d.querySelector('dialog[open]').id,'modal');
});

test('live checks refresh duplicates on other rows and clear resolved attention values without replacing focused inputs',async t=>{
 const x=await workspace(t,header+row('DUPLICATE')+'\n'+row('DUPLICATE')), {ui,d}=x;assert.equal(ui.snapshot().result.errors,2);
 await ui.handle(d.querySelector('[data-val="issue"]'));const cell=d.activeElement;assert.ok(d.getElementById('valSelectedIssue'));
 x.edit(0,'REQUEST_ID','UNIQUE');assert.equal(ui.snapshot().result.errors,0);assert.equal(d.getElementById('valSelectedIssue'),null);assert.equal(d.querySelectorAll('.val-grid td.error').length,0);assert.equal(d.activeElement,cell);assert.equal(d.getElementById('valAttention'),null);
});

test('a queued live edit cannot restore results after account, upload or mapping changes',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001','Wrong'));
 x.edit(0,'TYPE','Standard','input');const stale=[...x.timers.values()].find(t=>t.delay===250).fn;x.signOut();stale();assert.equal(x.ui.snapshot().result,null);assert.deepEqual(copy(x.ui.snapshot().rows),[]);assert.equal(x.ui.snapshot().livePending,false);
 const y=await workspace(t,header+row('PRIVATE-001','Wrong'));y.edit(0,'TYPE','Standard','input');const pending=[...y.timers.values()].find(t=>t.delay===250).fn;const select=y.d.querySelector('[data-map="TYPE"]');select.value='-1';select.dispatchEvent(new y.w.Event('change',{bubbles:true}));pending();assert.equal(y.ui.snapshot().result,null);assert.equal(y.ui.snapshot().livePending,false);
});

test('live corrections keep the published schema instead of switching to draft rules',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001','Wrong'),(schema,E)=>{schema.releases=[{version:1,publishedAt:'2026-10-26',schema:E.schema(schema)}];schema.columns.find(c=>c.key==='TYPE').values='Other';}),{ui}=x;
 x.edit(0,'TYPE','Standard');assert.equal(ui.snapshot().result.errors,0);assert.equal(ui.snapshot().draft.columns.find(c=>c.key==='TYPE').values,'Other');
});

test('live corrections use the chosen company conditions and stop if that company becomes inactive',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001','Wrong'),(schema,E)=>{
  schema.projectId='project';schema.projectName='Rollout';schema.columns.find(c=>c.key==='TYPE').values='';
  for(const [id,value]of [['alpha','Standard'],['beta','Urgent']]){const rule=E.rule('TYPE');rule.companyScope='selected';rule.companies=[{id,name:id}];rule.assertion={...E.condition('TYPE'),operator:'in',value};schema.rules.push(rule);}
 },state=>{state.projects=[{id:'project',name:'Rollout'}];state.projectCompanies=['alpha','beta'].map(id=>({id,name:id,projectId:'project',active:true}));});
 x.edit(0,'TYPE','Standard');assert.equal(x.ui.snapshot().result.errors,0);assert.equal(x.ui.snapshot().result.context.companyId,'alpha');
 x.edit(0,'TYPE','Urgent');assert.equal(x.ui.snapshot().result.errors,1);
 x.state().projectCompanies[0].active=false;x.edit(0,'TYPE','Standard');assert.equal(x.ui.snapshot().result,null);assert.equal(x.d.querySelector('[data-val="report"]').disabled,true);
});

test('issue review UI: selected issues can be ignored and restored without changing data or saving uploaded values',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001','Wrong')+'\n'+row('PRIVATE-002','Wrong')), {ui,d,w}=x;
 const choose=d.querySelector('[data-issue-choice="0"]');choose.checked=true;choose.dispatchEvent(new w.Event('change',{bubbles:true}));
 const reason=d.getElementById('valIgnoreReason');reason.value='Agreed for this run';reason.dispatchEvent(new w.Event('input',{bubbles:true}));
 await ui.handle({dataset:{val:'ignore-selected'}});let result=ui.snapshot().result;
 assert.equal(result.errors,1);assert.equal(result.ignored,1);assert.equal(result.passed,1);assert.ok(d.getElementById('valIgnoredIssues'));assert.match(d.getElementById('valIgnoredIssues').textContent,/Agreed for this run/);assert.equal(ui.snapshot().rows[0].TYPE,'Wrong');assert.equal(x.state().workhub.validator.runs[0].ignored,1);assert.equal(JSON.stringify(x.state()).includes('PRIVATE-001'),false);
 await ui.handle(d.querySelector('[data-val="restore-issue"]'));assert.equal(ui.snapshot().result.errors,2);assert.equal(ui.snapshot().result.ignored,0);assert.equal(d.getElementById('valIgnoredIssues'),null);
});
test('issue review UI: edits recheck ignored rows automatically and a new upload or account clears review decisions',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001','Wrong')), {ui,d}=x;
 await ui.handle({dataset:{val:'select-issues'}});await ui.handle({dataset:{val:'ignore-selected'}});assert.equal(ui.snapshot().result.ignored,1);
 const counts=x.counts();x.edit(0,'OWNER','Other owner');assert.equal(ui.snapshot().result.errors,1);assert.equal(ui.snapshot().result.ignored,0);assert.deepEqual(x.counts(),counts);
 await ui.handle({dataset:{val:'select-issues'}});await ui.handle({dataset:{val:'ignore-selected'}});await ui.loadFile({name:'other.csv',size:100,text:async()=>header+row('PRIVATE-002','Wrong')});await ui.run();assert.equal(ui.snapshot().result.ignored,0);assert.equal(ui.snapshot().result.errors,1);
 await ui.handle({dataset:{val:'select-issues'}});x.signOut();await assert.rejects(ui.handle({dataset:{val:'ignore-selected'}}),/Sign in/);assert.equal(ui.snapshot().result,null);
});
test('issue review UI: issue pages allow selecting every listed issue across more than one page',async t=>{
 const x=await workspace(t,header+Array.from({length:110},(_,i)=>row('PRIVATE-'+i,'Wrong')).join('\n')),{ui,d}=x;
 assert.equal(d.querySelectorAll('[data-issue-choice]').length,100);await ui.handle({dataset:{val:'select-issues'}});await ui.handle({dataset:{val:'issue-page',kind:'open',delta:'1'}});assert.equal(d.querySelectorAll('[data-issue-choice]').length,10);await ui.handle({dataset:{val:'select-issues'}});await ui.handle({dataset:{val:'ignore-selected'}});
 assert.equal(ui.snapshot().result.ignored,110);assert.equal(ui.snapshot().result.errors,0);assert.equal(ui.snapshot().result.passed,110);assert.equal(d.getElementById('valAttention'),null);await ui.handle({dataset:{val:'restore-issues'}});assert.equal(ui.snapshot().result.errors,110);
});
test('SAP group UI: create grouped columns, duplicate a value set and choose a saved set in Conditions',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001'),schema=>{schema.mode='sap';for(const c of schema.columns){c.sapType='CHAR';c.sapLength='80';}}), {ui,d,w}=x;
 await ui.handle({dataset:{val:'mode',mode:'column-groups'}});await ui.handle({dataset:{val:'column-group-add'}});
 let form=d.getElementById('valColumnGroupForm');for(const el of form.querySelectorAll('[name="groupField"]'))el.checked=['TYPE','OWNER'].includes(el.value);form.querySelector('[name="groupField"][value="TYPE"]').dispatchEvent(new w.Event('change',{bubbles:true}));
 form=d.getElementById('valColumnGroupForm');form.elements.groupName.value='Sales area';form.elements.setName.value='Original setup';form.querySelector('[data-group-value="TYPE"]').value='Standard';form.querySelector('[data-group-value="OWNER"]').value='Aisha';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 await ui.handle({dataset:{val:'value-set-duplicate'}});form=d.getElementById('valColumnGroupForm');form.elements.setName.value='Other setup';form.querySelector('[data-group-value="TYPE"]').value='Urgent';form.querySelector('[data-group-value="OWNER"]').value='Daniel';form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
 let snapshot=ui.snapshot(),group=snapshot.draft.columnGroups[0];assert.equal(group.sets.length,2);assert.equal(group.sets[0].values.TYPE,'Standard');assert.equal(group.sets[1].values.TYPE,'Urgent');
 await ui.handle({dataset:{val:'value-set-condition'}});form=d.getElementById('valRuleForm');assert.equal(form.querySelector('[data-clause="valueSource"]').value,'group');assert.equal(form.querySelector('[data-clause="valueSetId"]').value,group.sets[1].id);
 const sets=form.querySelector('[data-clause="valueSetId"]');sets.value=group.sets[0].id;sets.dispatchEvent(new w.Event('change',{bubbles:true}));snapshot=ui.snapshot();assert.equal(snapshot.draft.rules.at(-1).assertion.valueSetId,group.sets[0].id);assert.match(d.querySelector('.val-rule-summary').textContent,/Original setup.*Standard|Standard.*Original setup/);
 ui.saveDraft();assert.equal(x.state().workhub.validator.templates[0].columnGroups[0].sets.length,2);assert.equal(x.E.validateRows(ui.snapshot().draft,[{REQUEST_ID:'001',TYPE:'Standard',OWNER:'Aisha',AMOUNT:'25',START_DATE:'2026-10-20',END_DATE:'2026-10-21'}]).errors,0);
 await ui.handle({dataset:{val:'mode',mode:'column-groups'}});await assert.rejects(ui.handle({dataset:{val:'column-group-remove',id:group.id}}),/condition uses/);
});

test('SAP group picker: checking columns keeps the expanded list, form, focus, scroll and typed values without a workspace render',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001'),(schema,E)=>{schema.mode='sap';while(schema.columns.length<200)schema.columns.push(E.column(schema.columns.length));for(const c of schema.columns){c.sapType='CHAR';c.sapLength='80';}}),{ui,d}=x;
 await ui.handle({dataset:{val:'mode',mode:'column-groups'}});await ui.handle({dataset:{val:'column-group-add'}});
 const form=d.getElementById('valColumnGroupForm'),picker=form.querySelector('.val-group-columns'),choices=picker.querySelector('.val-check-list'),type=form.querySelector('[name="groupField"][value="TYPE"]'),value=form.querySelector('[data-group-value="REQUEST_ID"]'),setPicker=form.elements.groupSet,counts=x.counts();
 picker.open=true;choices.scrollTop=132;form.elements.groupName.value='My draft group';form.elements.setName.value='Original draft';value.value='00012';type.focus();type.click();
 assert.equal(d.getElementById('valColumnGroupForm'),form);assert.equal(form.querySelector('.val-group-columns'),picker);assert.equal(picker.open,true);assert.equal(choices.scrollTop,132);assert.equal(d.activeElement,type);assert.equal(form.elements.groupSet,setPicker);assert.equal(form.querySelector('[data-group-value="REQUEST_ID"]'),value);assert.equal(value.value,'00012');assert.equal(form.elements.groupName.value,'My draft group');assert.deepEqual(x.counts(),counts);assert.equal(form.querySelectorAll('[name="groupField"]').length,200);assert.ok(form.querySelector('[data-group-value="TYPE"]'));assert.match(picker.querySelector('summary').textContent,/2/);assert.match(d.querySelector('[data-val="column-group-select"] small').textContent,/2 columns/);
 type.click();assert.equal(picker.open,true);assert.equal(d.activeElement,type);assert.equal(choices.scrollTop,132);assert.equal(form.querySelector('[data-group-value="TYPE"]'),null);assert.equal(form.querySelector('[data-group-value="REQUEST_ID"]'),value);assert.deepEqual(x.counts(),counts);
 ui.saveDraft();const group=x.state().workhub.validator.templates[0].columnGroups[0];assert.equal(group.name,'My draft group');assert.equal(group.sets[0].name,'Original draft');assert.equal(group.sets[0].values.REQUEST_ID,'00012');assert.deepEqual(copy(group.fields),['REQUEST_ID']);
});

test('SAP group picker: rejected removals preserve the open picker and original bindings without rebuilding controls',async t=>{
 const x=await workspace(t,header+row('PRIVATE-001'),(schema,E)=>{schema.mode='sap';for(const c of schema.columns){c.sapType='CHAR';c.sapLength='80';}schema.columnGroups=[{id:'g',name:'Required group',fields:['TYPE'],sets:[{id:'s',name:'Original',values:{TYPE:'Standard'}}]}];const r=E.rule('TYPE');r.assertion={...E.condition('TYPE'),operator:'in',valueSource:'group',groupId:'g',valueSetId:'s'};schema.rules=[r];}),{ui,d}=x;
 await ui.handle({dataset:{val:'mode',mode:'column-groups'}});const form=d.getElementById('valColumnGroupForm'),picker=form.querySelector('.val-group-columns'),type=form.querySelector('[name="groupField"][value="TYPE"]'),value=form.querySelector('[data-group-value="TYPE"]'),counts=x.counts();picker.open=true;type.focus();type.click();
 assert.equal(type.checked,true);assert.equal(d.getElementById('valColumnGroupForm'),form);assert.equal(picker.open,true);assert.equal(d.activeElement,type);assert.equal(form.querySelector('[data-group-value="TYPE"]'),value);assert.equal(value.value,'Standard');assert.deepEqual(copy(ui.snapshot().draft.columnGroups[0].fields),['TYPE']);assert.deepEqual(x.counts(),counts);
});
