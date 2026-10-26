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
