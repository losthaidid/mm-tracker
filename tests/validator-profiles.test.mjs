import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test,after} from 'node:test';
import {JSDOM} from 'jsdom';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const copy=v=>JSON.parse(JSON.stringify(v));
const host=new JSDOM('',{runScripts:'outside-only'});host.window.eval(read('validator-engine.js'));
const E=host.window.WorkHubValidatorEngine;
after(()=>host.window.close());
function template(engine=E){
 const t=engine.create('Material master');
 t.columns=[{...engine.column(),key:'MAT',label:'Material',required:true,unique:true},{...engine.column(1),key:'PLANT',label:'Plant'}];
 t.lookups=[{id:'ref-a',name:'Company A plants',headers:['Code','Name'],rows:[['FF01','A Plant']],codeColumn:'Code',nameColumn:'Name'},
 {id:'ref-b',name:'Company B plants',headers:['Plant','Name'],rows:[['FF02','B Plant']],codeColumn:'Plant',nameColumn:'Name'}];
 for(const [id,ref,col]of [['a','ref-a','Code'],['b','ref-b','Plant']]){
  const r=engine.rule('PLANT');r.id=id;r.name='Company '+id.toUpperCase()+' plant check';r.assertion={...engine.condition('PLANT'),operator:'lookup',lookupId:ref,lookupColumn:col};t.rules.push(r);
 }
 const paused=engine.rule('PLANT');paused.id='paused';paused.name='Paused check';paused.enabled=false;t.rules.push(paused);
 return t;
}
const selection=(ruleIds=[],referenceChecks=[])=>({ruleIds,referenceChecks});
test('run setups select the intended company reference without modifying definitions, base checks or published versions',()=>{
 const t=template(),before=copy(t),plan=E.runSetup(t,selection(['a']));
 assert.deepEqual(copy(t),before);assert.deepEqual(copy(plan.summary.conditions),[{id:'a',name:'Company A plant check'}]);assert.equal(plan.summary.references.length,1);assert.equal(plan.summary.references[0].lookupId,'ref-a');
 assert.equal(E.validateRows(plan.schema,[{MAT:'0001',PLANT:'FF01'}]).errors,0);
 assert.equal(E.validateRows(plan.schema,[{MAT:'0001',PLANT:'FF02'}]).errors,1);
 assert.equal(E.validateRows(E.runSetup(t,selection(['b'])).schema,[{MAT:'0001',PLANT:'FF02'}]).errors,0);
 assert.equal(plan.summary.skipped.find(r=>r.id==='b').reason,'Not selected for this run');
 assert.equal(E.validateRows(E.runSetup(t,selection()).schema,[{MAT:'',PLANT:'anything'}]).errors,1);
 assert.equal(E.validateRows(E.runSetup(t,selection()).schema,[{MAT:'same'},{MAT:'same'}]).errors,2);
});
test('paused and company-restricted conditions cannot be forced on by a saved selection',()=>{
 const t=template();t.projectId='p';for(const r of t.rules.filter(r=>r.id!=='paused')){r.companyScope='selected';r.companies=[{id:r.id,name:r.id}];}
 const ctx={projectId:'p',companyId:'a'},p=E.runSetup(t,selection(['a','b','paused']),ctx);
 assert.deepEqual(copy(p.schema.rules.map(r=>r.id)),['a']);assert.equal(p.summary.skipped.find(r=>r.id==='b').reason,'Different company');assert.equal(p.summary.skipped.find(r=>r.id==='paused').reason,'Paused in template');
 assert.throws(()=>E.validateRows(p.schema,[{MAT:'1',PLANT:'FF01'}]),/Choose a company/);
});
test('standalone reference bindings validate exact codes, appear in suggestions and reject stale or malformed selections',()=>{
 const t=template(),c={id:'binding',field:'PLANT',lookupId:'ref-b',lookupColumn:'Plant'},p=E.runSetup(t,selection([],[c]));
 assert.equal(p.summary.conditions.length,0);assert.equal(p.summary.references.length,1);assert.equal(p.summary.additionalChecks,1);
 assert.equal(E.validateRows(p.schema,[{MAT:'1',PLANT:'FF02'}]).errors,0);assert.equal(E.validateRows(p.schema,[{MAT:'1',PLANT:'FF01'}]).errors,1);
 assert.equal(E.suggestions(p.schema,{MAT:'1',PLANT:'wrong'},'PLANT').choices[0].value,'FF02');
 assert.throws(()=>E.runSetup(t,selection(['removed'])),/unavailable/);
 assert.throws(()=>E.runSetup(t,selection([],[{...c,lookupColumn:'missing'}])),/unavailable/);
 assert.throws(()=>E.runSetup(t,selection([],[c,{...c,id:'another'}])),/once/);
 assert.throws(()=>E.runSetup(t,selection(['a','a'])),/100 conditions/);
});
test('reference dependencies include nested WHEN checks and tuple mappings with no duplicate dependency entries',()=>{
 const t=template(),r=t.rules[0];r.when.groups=[E.group('PLANT')];r.when.groups[0].conditions=[copy(r.assertion)];
 r.assertion={...E.condition('MAT'),operator:'lookupTuple',lookupId:'ref-a',pairs:[{field:'MAT',referenceColumn:'Name'},{field:'PLANT',referenceColumn:'Code'}]};
 const p=E.runSetup(t,selection(['a']));assert.equal(p.summary.references.length,2);assert.match(p.summary.references[1].column,/MAT → Name/);
});
test('profiles are bounded, uniquely named per template and survive normal state preparation without freezing draft changes',()=>{
 const t=template(),p={id:'profile',templateId:t.id,name:'Company A',projectId:'',companyId:'',...selection(['a']),updatedAt:'2026-10-29'},state={workhub:{validator:{templates:[t],runs:[],profiles:[p]}}};
 assert.doesNotThrow(()=>E.validateState(state));assert.doesNotThrow(()=>E.prepare(copy(state),state));
 const next=copy(state);next.workhub.validator.profiles.push({...p,id:'another'});assert.throws(()=>E.validateState(next),/different profile name/);
 next.workhub.validator.profiles=[{...p,referenceChecks:Array.from({length:21},()=>({}))}];assert.throws(()=>E.validateState(next),/20 additional/);
 next.workhub.validator.profiles=[{...p,companyId:'a'}];assert.throws(()=>E.validateState(next),/company settings/);
});

async function workspace(t,{linked=false,worker=false,configure}={}){
 const dom=new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;t.after(()=>w.close());
 Object.assign(w,{TextEncoder,TextDecoder,Blob,setImmediate,clearImmediate});w.confirm=()=>true;let account='owner',ready=true,writes=0,captured,resolveWorker;
 w.setTimeout=(fn,ms)=>{if(ms===50)queueMicrotask(fn);return 0;};w.clearTimeout=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const f of ['vendor/jszip.min.js','validator-engine.js','validator-files.js'])w.eval(read(f));
 if(worker)w.WorkHubValidatorRunner={create:()=>({cancel(){},run(schema,rows,context){captured={schema,rows:copy(rows),context};return new Promise(r=>resolveWorker=r);}})};
 w.eval(read('validator-studio.js'));const engine=w.WorkHubValidatorEngine,s=template(engine);
 if(linked){s.projectId='project';s.projectName='Rollout';s.rules[0].companyScope='selected';s.rules[0].companies=[{id:'a',name:'Company A'}];s.rules[1].companyScope='selected';s.rules[1].companies=[{id:'b',name:'Company B'}];}
 configure?.(s,engine);
 let state={projects:linked?[{id:'project',name:'Rollout'}]:[],projectCompanies:linked?['a','b'].map(id=>({id,name:'Company '+id.toUpperCase(),projectId:'project',active:true})):[],workhub:{validator:{templates:[s],runs:[]}}},ui,downloads=[];
 const render=()=>{if(!ui.patchRender())d.getElementById('view').innerHTML=ui.render();};
 ui=w.WorkHubValidatorStudio.install({state:()=>state,ready:()=>ready,owner:()=>account,render,tell:()=>{},mutate(fn){const next=engine.copy(state);fn(next);engine.prepare(next,state);engine.validateState(next);state=next;writes++;render();return true;},openModal(title,body){d.getElementById('modalBody').innerHTML=body;d.getElementById('modal').showModal();},closeModal(){d.getElementById('modal').close();},download(blob,name){downloads.push({blob,name});}});
 render();ui.saveDraft(true);await ui.loadFile({name:'PRIVATE-materials.csv',size:50,text:async()=> 'Material,Plant\nPRIVATE-001,FF01'});
 const change=(el,value)=>{if(el.type==='checkbox')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 const toggle=(id,yes)=>change(d.querySelector(`[data-setup-rule="${id}"]`),yes);
 const company=id=>change(d.querySelector('[name="validationCompany"]'),id);
 const profile=id=>change(d.querySelector('[name="validationProfile"]'),id);
 const save=async(name,update=false)=>{await ui.handle({dataset:{val:update?'run-setup-update':'run-setup-save'}});const f=d.getElementById('valProfileForm');f.elements.profileName.value=name;f.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
 return {ui,w,d,E:engine,state:()=>state,writes:()=>writes,toggle,change,company,profile,save,downloads,render,account(value){account=value;ui.sync();},worker:()=>captured,finishWorker(){resolveWorker(engine.validateRows(captured.schema,captured.rows,captured.context));}};
}
test('profile UI saves reusable selections, switches without losing upload or corrections, and keeps temporary edits local',async t=>{
 const x=await workspace(t),{ui,d}=x;x.toggle('b',false);const before=x.writes();await x.save('Company A');
 const a=x.state().workhub.validator.profiles[0];assert.equal(x.writes(),before+1);assert.deepEqual(copy(a.ruleIds),['a']);assert.doesNotMatch(JSON.stringify(a),/PRIVATE/);
 x.toggle('a',false);x.toggle('b',true);await x.save('Company B');const b=x.state().workhub.validator.profiles[1];
 x.profile(a.id);await ui.run();assert.equal(ui.snapshot().result.errors,0);assert.equal(ui.snapshot().result.setup.name,'Company A');
 const cell=d.querySelector('[data-cell="0"][data-field="MAT"]');x.change(cell,'PRIVATE-edited');const mapping=copy(ui.snapshot().mapping),rows=copy(ui.snapshot().sourceRows);
 x.profile(b.id);assert.equal(ui.snapshot().result,null);assert.deepEqual(copy(ui.snapshot().sourceRows),rows);assert.deepEqual(copy(ui.snapshot().mapping),mapping);await ui.run();assert.equal(ui.snapshot().result.errors,1);
 const writes=x.writes();x.toggle('b',false);assert.equal(x.writes(),writes);assert.deepEqual(copy(x.state().workhub.validator.profiles[1].ruleIds),['b']);assert.match(d.getElementById('valRunSetup').textContent,/Temporary changes/);
 await x.save('Company B base only',true);assert.equal(x.state().workhub.validator.profiles[1].name,'Company B base only');assert.deepEqual(copy(x.state().workhub.validator.profiles[1].ruleIds),[]);
});
test('profile selection remembers an active company and never forces other-company or paused conditions',async t=>{
 const x=await workspace(t,{linked:true});x.company('a');await x.save('A setup');const a=x.state().workhub.validator.profiles[0];assert.equal(a.companyId,'a');x.company('b');x.profile(a.id);assert.equal(x.ui.snapshot().runCompanyId,'a');await x.ui.run();assert.equal(x.ui.snapshot().result.errors,0);
 x.company('b');await x.ui.run();assert.equal(x.ui.snapshot().result.setup.conditions.length,0);assert.ok(x.ui.snapshot().result.setup.skipped.some(r=>r.id==='a'&&r.reason==='Different company'));
 x.state().projectCompanies[0].active=false;x.profile(a.id);await new Promise(r=>setImmediate(r));assert.equal(x.ui.snapshot().runCompanyId,'b');assert.match(x.d.querySelector('.val-message').textContent,/active company/);
});
test('setup controls stay mounted, preserve expanded panels/focus, and do not save on each click or search',async t=>{
 const x=await workspace(t),{d,w}=x,root=d.getElementById('valRunSetup'),details=root.querySelector('details'),a=d.querySelector('[data-setup-rule="a"]'),map=d.querySelector('[data-map="PLANT"]'),writes=x.writes();details.open=true;root.querySelector('.val-setup-choices').scrollTop=50;a.focus();x.toggle('a',false);
 assert.equal(d.querySelector('[name="validationProfile"]').value,'__custom');assert.equal(d.getElementById('valRunSetup'),root);assert.equal(d.querySelector('[data-setup-rule="a"]'),a);assert.equal(d.activeElement,a);assert.equal(details.open,true);assert.equal(d.querySelector('[data-map="PLANT"]'),map);
 const search=d.getElementById('valSetupSearch');search.focus();search.value='Company B';search.dispatchEvent(new w.Event('input',{bubbles:true}));assert.equal(d.getElementById('valSetupSearch'),search);assert.equal(d.activeElement,search);assert.equal(d.querySelectorAll('[data-setup-rule]').length,1);assert.equal(x.writes(),writes);
});
const referenceChoice=(x,id,field='PLANT')=>[...x.d.querySelectorAll('[data-setup-reference]')].find(el=>{const c=JSON.parse(el.dataset.setupReference);return c[0]===field&&c[1]===id;});
test('reference checklist selects existing mappings and profiles without re-entering them or losing uploaded corrections',async t=>{
 const x=await workspace(t),{ui,d}=x;assert.equal(referenceChoice(x,'ref-a').disabled,false);assert.equal(referenceChoice(x,'ref-a').checked,true);
 await ui.handle({dataset:{val:'run-setup-none'}});const rows=copy(ui.snapshot().sourceRows),mapping=copy(ui.snapshot().mapping),definitions=copy(ui.snapshot().draft),writes=x.writes();
 const b=referenceChoice(x,'ref-b'),panel=b.closest('details'),list=b.closest('.val-setup-choices');panel.open=true;list.scrollTop=40;b.focus();x.change(b,true);
 assert.equal(referenceChoice(x,'ref-b'),b);assert.equal(d.activeElement,b);assert.equal(panel.open,true);assert.equal(list.scrollTop,40);assert.equal(x.writes(),writes);
 assert.deepEqual(copy(ui.snapshot().draft),definitions);assert.deepEqual(copy(ui.snapshot().sourceRows),rows);assert.deepEqual(copy(ui.snapshot().mapping),mapping);
 await x.save('B checklist');const saved=copy(x.state().workhub.validator.profiles[0]);assert.equal(saved.referenceChecks[0].lookupId,'ref-b');await ui.run();assert.equal(ui.snapshot().result.errors,1);
 x.change(referenceChoice(x,'ref-b'),false);assert.equal(ui.snapshot().result,null);await ui.run();assert.equal(ui.snapshot().result.errors,0);assert.deepEqual(copy(x.state().workhub.validator.profiles[0]),saved);
 x.profile(saved.id);assert.equal(referenceChoice(x,'ref-b').checked,true);await ui.run();assert.equal(ui.snapshot().result.errors,1);
});
test('reference search is independent and bulk deselection confirms dependent conditions',async t=>{
 const x=await workspace(t),{ui,d,w}=x;x.toggle('b',false);const writes=x.writes(),search=d.getElementById('valSetupReferenceSearch');search.focus();search.value='Company B';search.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(d.activeElement,search);assert.equal(d.getElementById('valSetupReferenceSearch'),search);assert.equal(d.querySelectorAll('[data-setup-reference]').length,1);assert.equal(d.querySelectorAll('[data-setup-rule]').length,3);
 await ui.handle({dataset:{val:'run-setup-references-all'}});assert.deepEqual(copy(ui.snapshot().runSelection.ruleIds),['a']);assert.equal(ui.snapshot().runSelection.referenceChecks.length,1);assert.equal(ui.snapshot().runSelection.referenceChecks[0].lookupId,'ref-b');
 await ui.handle({dataset:{val:'run-setup-references-none'}});assert.equal(ui.snapshot().runSelection.referenceChecks.length,0);search.value='';search.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(referenceChoice(x,'ref-a').checked,false);assert.equal(referenceChoice(x,'ref-a').disabled,false);assert.equal(referenceChoice(x,'ref-b').checked,false);assert.deepEqual(copy(ui.snapshot().runSelection.ruleIds),[]);assert.equal(x.writes(),writes);await ui.run();assert.equal(ui.snapshot().result.errors,0);
 x.toggle('a',false);assert.equal(referenceChoice(x,'ref-a').checked,false);assert.equal(referenceChoice(x,'ref-a').disabled,false);
});
test('required reference cancellation preserves results and confirmation deselects every active dependent condition only for this run',async t=>{
 const x=await workspace(t,{configure(s){const shared=copy(s.rules[0]);shared.id='shared';shared.name='Shared plant condition';s.rules.push(shared);s.rules.find(r=>r.id==='paused').assertion=copy(shared.assertion);}}),{ui,w}=x;x.toggle('b',false);await x.save('Original dependencies');await ui.run();
 const before=ui.snapshot(),saved=copy(x.state()),writes=x.writes(),messages=[];w.confirm=message=>{messages.push(message);return false;};const choice=referenceChoice(x,'ref-a');assert.equal(choice.disabled,false);x.change(choice,false);
 assert.equal(choice.checked,true);assert.deepEqual(copy(ui.snapshot().result),copy(before.result));assert.deepEqual(copy(ui.snapshot().runSelection),copy(before.runSelection));assert.equal(x.writes(),writes);assert.match(messages[0],/Company A plant check/);assert.match(messages[0],/Shared plant condition/);assert.doesNotMatch(messages[0],/Company B plant check|Paused check/);
 w.confirm=()=>true;x.change(choice,false);assert.equal(choice.checked,false);assert.deepEqual(copy(ui.snapshot().runSelection.ruleIds),[]);assert.equal(ui.snapshot().result,null);assert.deepEqual(copy(ui.snapshot().sourceRows),copy(before.sourceRows));assert.deepEqual(copy(ui.snapshot().mapping),copy(before.mapping));assert.deepEqual(copy(x.state()),saved);
 x.change(choice,true);assert.equal(ui.snapshot().runSelection.referenceChecks[0].lookupId,'ref-a');assert.deepEqual(copy(ui.snapshot().runSelection.ruleIds),[]);await ui.run();assert.equal(ui.snapshot().result.errors,0);
});
test('bulk reference cancellation and denied run permission leave the setup untouched',async t=>{
 const x=await workspace(t),{ui,w}=x;await ui.run();const before=ui.snapshot();let prompts=0;w.confirm=()=>{prompts++;return false;};await ui.handle({dataset:{val:'run-setup-references-none'}});assert.equal(prompts,1);assert.deepEqual(copy(ui.snapshot().result),copy(before.result));assert.deepEqual(copy(ui.snapshot().runSelection),copy(before.runSelection));assert.equal(referenceChoice(x,'ref-a').checked,true);
 w.WorkHubCurrentAccess={can:()=>false};x.render();assert.equal(referenceChoice(x,'ref-a').disabled,true);x.change(referenceChoice(x,'ref-a'),false);await new Promise(r=>setImmediate(r));assert.equal(prompts,1);assert.deepEqual(copy(ui.snapshot().runSelection),copy(before.runSelection));assert.equal(referenceChoice(x,'ref-a').checked,true);
});
test('newly mapped checks stay available after deselection and unavailable saved mappings can be removed individually',async t=>{
 const x=await workspace(t),{ui,d}=x;await ui.handle({dataset:{val:'run-setup-none'}});const form=d.getElementById('valRunReferenceForm');form.elements.setupField.value='MAT';x.change(form.elements.setupReference,'ref-a');form.dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));
 const choice=referenceChoice(x,'ref-a','MAT');assert.equal(choice.checked,true);x.change(choice,false);assert.equal(referenceChoice(x,'ref-a','MAT'),choice);assert.equal(choice.checked,false);x.change(choice,true);await x.save('Material reference');
 const p=x.state().workhub.validator.profiles[0];p.referenceChecks=[{...p.referenceChecks[0],lookupId:'removed',lookupColumn:'missing'}];x.profile(p.id);const stale=referenceChoice(x,'removed','MAT');assert.equal(stale.checked,true);assert.equal(stale.disabled,false);assert.match(stale.closest('label').textContent,/Unavailable/);await assert.rejects(ui.run(),/unavailable/);
 x.change(stale,false);await ui.run();assert.equal(ui.snapshot().result.errors,0);assert.equal(p.referenceChecks[0].lookupId,'removed');
});
test('combined reference dependencies retain tuple validation and never become unconditional single-field checks',async t=>{
 const x=await workspace(t,{configure(s,E){s.rules[0].assertion={...E.condition('PLANT'),operator:'lookupTuple',lookupId:'ref-a',pairs:[{field:'PLANT',referenceColumn:'Code'},{field:'MAT',referenceColumn:'Name'}]};}}),{ui,d}=x;x.toggle('b',false);
 const tuple=[...d.querySelectorAll('.val-setup-reference-choices label')].find(el=>el.textContent.includes('Combined field check'));assert.ok(tuple);assert.equal(tuple.querySelector('input').checked,true);assert.equal(tuple.querySelector('input').disabled,true);
 await ui.handle({dataset:{val:'run-setup-references-none'}});await ui.run();assert.equal(ui.snapshot().result.errors,1);assert.match(ui.snapshot().result.setup.references[0].column,/PLANT → Code; MAT → Name/);assert.equal(ui.snapshot().runSelection.referenceChecks.length,0);
});
test('additional reference bindings save once and drive validation, suggestions, live edits and literal Excel setup audit',async t=>{
 const x=await workspace(t),{ui,d}=x;await ui.handle({dataset:{val:'run-setup-none'}});const form=d.getElementById('valRunReferenceForm');form.elements.setupField.value='PLANT';x.change(form.elements.setupReference,'ref-b');assert.equal(form.elements.setupReferenceColumn.value,'Plant');form.dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));
 await x.save('B reference only');await ui.run();assert.equal(ui.snapshot().result.errors,1);assert.equal(ui.snapshot().result.setup.references.length,1);
 ui.openCorrections(0,'PLANT');assert.match(d.getElementById('valSuggestionChoices').textContent,/FF02/);assert.doesNotMatch(d.getElementById('valSuggestionChoices').textContent,/FF01/);ui.applyCorrection(0);assert.equal(ui.snapshot().result.errors,0);assert.equal(ui.snapshot().result.setup.references.length,1);
 await ui.handle({dataset:{val:'accepted'}});const blob=x.downloads[0].blob,book=await x.w.WorkHubValidatorFiles.read({name:'checked.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});const audit=book.sheets.find(s=>s.name==='Validation setup');assert.ok(audit);assert.ok(audit.rows.some(r=>r[1]==='Skipped'));assert.match(JSON.stringify(audit.rows),/B reference only/);assert.equal(x.state().workhub.validator.runs[0].setup.name,'B reference only');assert.doesNotMatch(JSON.stringify(x.state().workhub.validator.profiles),/PRIVATE/);
});
test('unavailable checks in a saved profile block running until reviewed and can be removed without changing the saved profile',async t=>{
 const x=await workspace(t),{ui,d}=x;x.toggle('b',false);await x.save('A setup');const p=x.state().workhub.validator.profiles[0];p.ruleIds=['gone'];x.profile(p.id);assert.match(d.getElementById('valRunSetup').textContent,/unavailable/i);await assert.rejects(ui.run(),/unavailable/);x.toggle('gone',false);await ui.run();assert.equal(ui.snapshot().result.errors,0);assert.deepEqual(p.ruleIds,['gone']);
});
test('run-only accounts can adjust/use saved setups but cannot create/update/delete profiles',async t=>{
 const x=await workspace(t),{ui,w}=x;x.toggle('b',false);await x.save('A setup');const p=x.state().workhub.validator.profiles[0];
 w.WorkHubCurrentAccess={can:(id,action)=>['view','run','export'].includes(action)};x.profile(p.id);x.toggle('a',false);await ui.run();assert.equal(ui.snapshot().result.errors,0);await assert.rejects(ui.handle({dataset:{val:'run-setup-save'}}),/cannot create/);await assert.rejects(ui.handle({dataset:{val:'run-setup-update'}}),/cannot edit/);await assert.rejects(ui.handle({dataset:{val:'profile-delete'}}),/cannot delete/);
 w.WorkHubCurrentAccess={can:()=>false};await assert.rejects(ui.handle({dataset:{val:'run-setup-none'}}),/cannot run/);
});
test('profile saving rejects stale dialogs and account changes wipe setup state and dialogs',async t=>{
 const x=await workspace(t),{ui,d}=x;await ui.handle({dataset:{val:'run-setup-save'}});const f=d.getElementById('valProfileForm');f.elements.profileName.value='PRIVATE profile';x.toggle('a',false);f.dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));assert.match(d.getElementById('valProfileError').textContent,/setup changed/);assert.equal(x.state().workhub.validator.profiles,undefined);
 x.account('another');assert.equal(ui.snapshot().runSelection,null);assert.equal(ui.snapshot().runProfileId,'');assert.doesNotMatch(d.getElementById('modalBody').textContent,/PRIVATE profile/);
});
test('a delayed worker cannot restore results after a profile or selection change',async t=>{
 const x=await workspace(t,{worker:true});x.toggle('b',false);const pending=x.ui.run();await new Promise(r=>setImmediate(r));assert.deepEqual(copy(x.worker().schema.rules.map(r=>r.id)),['a']);x.toggle('a',false);x.finishWorker();await pending;assert.equal(x.ui.snapshot().result,null);assert.deepEqual(copy(x.ui.snapshot().runSelection.ruleIds),[]);
});
test('profiles use the selected published schema and live corrections keep that schema frozen',async t=>{
 const x=await workspace(t),{ui,E}=x;x.toggle('b',false);await ui.handle({dataset:{val:'publish'}});const release=copy(x.state().workhub.validator.templates[0].releases[0]);
 // Change only the draft through the real reference form; the published reference keeps FF01.
 await ui.handle({dataset:{val:'mode',mode:'references'}});await ui.handle({dataset:{val:'reference-edit',id:'ref-a'}});const rf=x.d.getElementById('valReferenceForm');rf.elements.data.value='Code,Name\nFF99,New draft';rf.dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(ui.snapshot().draft.lookups[0].rows[0][0],'FF99');
 const before=copy(ui.snapshot().draft.releases);assert.deepEqual(before,[release]);
 await ui.handle({dataset:{val:'mode',mode:'check'}});x.toggle('b',false);await x.save('Published A');await ui.run();assert.equal(ui.snapshot().result.errors,0);assert.equal(x.state().workhub.validator.runs[0].version,1);
 x.change(x.d.querySelector('[data-cell="0"][data-field="PLANT"]'),'wrong');assert.equal(ui.snapshot().result.errors,1);ui.openCorrections(0,'PLANT');assert.match(x.d.getElementById('valSuggestionChoices').textContent,/FF01/);assert.doesNotMatch(x.d.getElementById('valSuggestionChoices').textContent,/FF02/);ui.applyCorrection(0);assert.equal(ui.snapshot().result.errors,0);assert.deepEqual(copy(ui.snapshot().draft.releases),before);assert.doesNotThrow(()=>E.validateState(x.state()));
});
test('profile names, update conflicts and removed mappings are rejected without saving uploaded records',async t=>{
 const x=await workspace(t),{ui,d}=x;x.toggle('b',false);await x.save('A');const p=x.state().workhub.validator.profiles[0],writes=x.writes();await x.save('A');assert.equal(x.writes(),writes);assert.match(d.getElementById('valProfileError').textContent,/different profile name/);d.querySelector('dialog').close();
 await ui.handle({dataset:{val:'run-setup-update'}});const f=d.getElementById('valProfileForm');p.updatedAt='changed-elsewhere';f.dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));assert.match(d.getElementById('valProfileError').textContent,/changed elsewhere/);assert.equal(x.writes(),writes);
 const s=template();assert.throws(()=>E.runSetup(s,selection([],[{id:'x',field:'removed',lookupId:'ref-a',lookupColumn:'Code'}])),/unavailable/);
});
test('changing a setup prevents a late Excel download from exporting a previous selection',async t=>{
 const x=await workspace(t);x.toggle('b',false);await x.ui.run();const pending=x.ui.handle({dataset:{val:'report'}});x.toggle('a',false);await pending;assert.equal(x.downloads.length,0);assert.equal(x.ui.snapshot().result,null);
});
test('access capture allows run setup controls and reference forms while protecting profile creation and updates',async t=>{
 const dom=new JSDOM('<section data-access-feature="validator"><button type="button" data-val="run-setup-none">Deselect all</button><input type="checkbox" data-setup-rule="a"><input type="checkbox" data-setup-reference="binding"><select name="validationProfile"><option>A</option></select><form id="valRunReferenceForm"></form><form id="valProfileForm"></form></section>',{runScripts:'outside-only'}),w=dom.window,d=w.document;t.after(()=>w.close());for(const f of ['access-catalog.js','access-control.js'])w.eval(read(f));
 const permissions=w.WorkHubAccessCatalog.preset('view');permissions.validator={mode:'use',run:true,create:false,edit:false,delete:false,export:true};let profile={userId:'member',role:'member',status:'active',version:1,permissions};const cloud={ready:true,user:{id:'member'},client:{rpc:async()=>({data:profile,error:null})}};
 const access=w.WorkHubAccess.install({cloud:()=>cloud,feature:()=> 'validator',hidden:()=>[],tell:()=>{}});await access.load(cloud.user);let actions=0,submits=0;d.querySelector('section').addEventListener('click',()=>actions++);d.addEventListener('submit',e=>{e.preventDefault();submits++;});
 d.querySelector('button').click();d.querySelector('input').click();d.querySelector('[data-setup-reference]').click();d.getElementById('valRunReferenceForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));d.getElementById('valProfileForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(actions,3);assert.equal(submits,1);
 profile={...profile,version:2,permissions:w.WorkHubAccessCatalog.preset('view')};await access.load(cloud.user);d.querySelector('button').click();d.querySelector('input').click();d.querySelector('[data-setup-reference]').click();d.getElementById('valRunReferenceForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(actions,3);assert.equal(submits,1);
});
