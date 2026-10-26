import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, test } from 'node:test';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('', { runScripts: 'outside-only' }), w = dom.window;
w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder; w.Blob=Blob; w.setImmediate=setImmediate;
w.eval(readFileSync(new URL('../vendor/jszip.min.js', import.meta.url), 'utf8'));
for (const file of ['validator-engine.js','validator-files.js']) w.eval(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const E=w.WorkHubValidatorEngine,F=w.WorkHubValidatorFiles,copy=x=>JSON.parse(JSON.stringify(x));
after(()=>w.close());
const context = id => ({ projectId:'project-a',projectName:'Rollout',companyId:id,companyName:id==='alpha'?'Alpha':'Beta' });
function template() {
 const t=E.create('Company material checks'); t.projectId='project-a';t.projectName='Rollout';
 t.columns=['SALES_ORG','CHANNEL','DESCRIPTION'].map((key,i)=>({...E.column(i),key,label:key}));
 t.columns[2].maxLength='40';
 const shared=E.rule('DESCRIPTION');shared.name='Shared description requirement';
 const a=E.rule('CHANNEL');a.name='Alpha FPSO channels';a.companyScope='selected';a.companies=[{id:'alpha',name:'Alpha'}];a.when.conditions=[{...E.condition('SALES_ORG'),value:'FPSO'}];a.assertion={...E.condition('CHANNEL'),operator:'in',value:'60,50'};
 const b=copy(a);b.id='beta-rule';b.name='Beta FPSO channels';b.companies=[{id:'beta',name:'Beta'}];b.assertion.value='10,20';
 t.rules=[shared,a,b];return t;
}
const row=(channel='60',description='Steel plate')=>({SALES_ORG:'FPSO',CHANNEL:channel,DESCRIPTION:description});
function state(t=template()) {return {projects:[{id:'project-a',name:'Rollout'},{id:'project-b',name:'Other project'}],projectCompanies:[{id:'alpha',name:'Alpha',projectId:'project-a',active:true},{id:'beta',name:'Beta',projectId:'project-a',active:true},{id:'retired',name:'Retired',projectId:'project-a',active:false},{id:'foreign',name:'Foreign',projectId:'project-b',active:true}],workhub:{validator:{templates:[t],runs:[]}}};}

test('company rules isolate different channel lists while shared rules and column checks still apply',()=>{
 const t=template(),rows=[row('60'),row('10'),row('60',''),row('60','x'.repeat(41))],before=copy(rows);
 const a=E.validateRows(t,rows,context('alpha')),b=E.validateRows(t,rows,context('beta'));
 assert.equal(a.errors,3);assert.equal(a.appliedRules,2);assert.equal(a.status[0].errors,0);assert.equal(a.status[1].errors,1);
 assert.equal(b.status[0].errors,1);assert.equal(b.status[1].errors,0);assert.equal(b.appliedRules,2);
 assert.equal(E.validateRows(t,[row('99')],context('third')).errors,0);
 t.rules[1].companies.push({id:'beta',name:'Beta'});t.rules[2].enabled=false;
 assert.equal(E.validateRows(t,[row('60')],context('beta')).errors,0);
 assert.deepEqual(copy(rows),before);assert.equal(a.context.companyName,'Alpha');
});

test('linked templates require a matching project and a selected company; maintained active membership is checked',()=>{
 const t=template(),d=state(t);
 assert.throws(()=>E.validateRows(t,[row()]),/Choose a company/);
 assert.throws(()=>E.validateRows(t,[row()],{...context('alpha'),projectId:'project-b'}),/Choose a company/);
 assert.throws(()=>E.suggestions(t,row(),'CHANNEL'),/Choose a company/);
 for (const id of ['', 'foreign', 'retired', 'missing']) assert.throws(()=>E.runContext(d,t,id),/active company/);
 assert.equal(E.runContext(d,t,'alpha').companyName,'Alpha');
 d.projects=[];assert.throws(()=>E.runContext(d,t,'alpha'),/unavailable/);
});

test('company scopes reject empty selections, duplicates, invalid metadata and cross-project links',()=>{
 for(const modify of [t=>{t.rules[1].companies=[]},t=>{t.rules[1].companies.push(copy(t.rules[1].companies[0]))},t=>{t.rules[1].companyScope='unknown'},t=>{t.projectId=''},t=>{t.rules[1].companies=[null]},t=>{t.rules[1].companies=[{id:'alpha',name:'x'.repeat(201)}]}]) {
  const t=template();modify(t);assert.throws(()=>E.checkSchema(t),/Company conditions/);
 }
 const d=state();d.workhub.validator.templates[0].rules[1].companies=[{id:'foreign',name:'Foreign'}];assert.throws(()=>E.validateState(d),/belong/);
 const next=state();next.workhub.validator.templates[0].rules[1].companies=[{id:'retired',name:'Retired'}];assert.throws(()=>E.prepare(next,{workhub:{validator:{templates:[]}}}),/active condition companies/);
});

test('saved inactive or deleted links and run names survive without blocking unrelated account saves',()=>{
 const before=state(),next=copy(before);next.projectCompanies[0].active=false;E.prepare(next,before);E.validateState(next);
 next.projectCompanies=next.projectCompanies.filter(c=>c.id!=='alpha');next.projects=[];E.prepare(next,before);E.validateState(next);
 const summary={id:'run',templateId:'t',templateName:'T',fileName:'f',at:'2026-10-26',version:0,rows:1,passed:1,errors:0,warnings:0,context:context('alpha')};
 next.workhub.validator.runs=[summary];E.validateState(next);assert.equal(summary.context.companyName,'Alpha');
});

test('published company rules stay frozen and older standalone versions keep applying all enabled rules',()=>{
 const t=template();t.releases=[{version:1,publishedAt:'2026-10-26',schema:E.schema(t)}];const before=state(t),next=copy(before);
 next.workhub.validator.templates[0].rules[1].assertion.value='70';E.prepare(next,before);
 next.workhub.validator.templates[0].releases[0].schema.rules[1].companies[0].id='beta';assert.throws(()=>E.prepare(next,before),/frozen/);
 const legacy=E.example();delete legacy.projectId;delete legacy.projectName;for(const r of legacy.rules){delete r.companyScope;delete r.companies;}
 E.checkSchema(legacy);assert.equal(E.validateRows(legacy,[]).appliedRules,3);
});

test('correction choices and reference descriptions only use the selected company rules',()=>{
 const t=template();assert.deepEqual(copy(E.suggestions(t,row('wrong'),'CHANNEL','',context('alpha')).choices.map(c=>c.value)),['50','60']);
 assert.deepEqual(copy(E.suggestions(t,row('wrong'),'CHANNEL','',context('beta')).choices.map(c=>c.value)),['10','20']);
 t.lookups=[{id:'ref-a',name:'Alpha channels',headers:['Code','Name'],rows:[['60','Alpha only']],nameColumn:'Name'}, {id:'ref-b',name:'Beta channels',headers:['Code','Name'],rows:[['60','Beta only']],nameColumn:'Name'}];
 for(const [i,id] of [[1,'ref-a'],[2,'ref-b']])t.rules[i].assertion={...E.condition('CHANNEL'),operator:'lookup',lookupId:id,lookupColumn:'Code'};
 assert.deepEqual(copy(E.referenceDetails(t,row('60'),new Map(),context('alpha')).map(m=>m.displayName)),['Alpha only']);
 assert.deepEqual(copy(E.referenceDetails(t,row('60'),new Map(),context('beta')).map(m=>m.displayName)),['Beta only']);
});

test('Excel template and run reports retain company scope and the run context without formula execution',async()=>{
 const t=template(),rows=[row('60')],r=E.validateRows(t,rows,context('alpha'));
 const load=async blob=>F.read({name:'report.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});
 const guide=await load(await F.template(t));assert.equal(guide.sheets.find(s=>s.name==='Conditions').rows[2][5],'Alpha');assert.equal(guide.sheets.find(s=>s.name==='Project scope').rows[1][1],'Rollout');
 for(const accepted of [false,true]) {
  const read=await load(await F.report(t,rows,r,accepted)),details=read.sheets.find(s=>s.name==='Run details').rows;
  assert.equal(details.find(row=>row[0]==='Company')[1],'Alpha');assert.equal(details.find(row=>row[0]==='Project')[1],'Rollout');
 }
});

test('copying a template creates independent rules, columns and references in the destination project',()=>{
 const source=template(),before=copy(source);source.releases=[{version:1,publishedAt:'2026-10-26',schema:E.schema(source)}];
 const next=E.copyTemplate(source,'Other rollout checks',{projectId:'project-b',projectName:'Other rollout',companyScope:'selected',companies:[{id:'foreign',name:'Foreign'}]});
 assert.notEqual(next.id,source.id);assert.equal(next.projectId,'project-b');assert.equal(next.releases.length,0);assert.notEqual(next.columns[0].id,source.columns[0].id);
 assert.ok(next.rules.every(r=>r.companyScope==='selected'&&r.companies[0].id==='foreign'));
 next.rules[1].assertion.value='70';next.columns[0].label='Changed';assert.equal(source.rules[1].assertion.value,before.rules[1].assertion.value);assert.equal(source.columns[0].label,before.columns[0].label);
 assert.equal(E.copyTemplate(source,'Standalone',{companyScope:'all'}).rules[1].companyScope,'all');
});

test('copying selected conditions brings independent reference lists and checks destination field names atomically',()=>{
 const source=template();source.lookups=[{id:'codes',name:'Codes',headers:['Code','Description'],rows:[['60','Allowed']],nameColumn:'Description'}];
 source.rules[1].assertion={...E.condition('CHANNEL'),operator:'lookup',lookupId:'codes',lookupColumn:'Code'};
 const target=E.create('Destination');target.columns=copy(source.columns);target.projectId='project-b';target.projectName='Other rollout';
 const before=copy(target),src=copy(source),destination={companyScope:'selected',companies:[{id:'foreign',name:'Foreign'}]},next=E.copyConditions(source,target,[source.rules[1].id],destination);
 assert.equal(next.rules.length,1);assert.notEqual(next.rules[0].id,source.rules[1].id);assert.notEqual(next.lookups[0].id,'codes');assert.equal(next.rules[0].assertion.lookupId,next.lookups[0].id);assert.equal(next.rules[0].companies[0].id,'foreign');
 next.lookups[0].rows[0][0]='70';assert.equal(source.lookups[0].rows[0][0],'60');assert.deepEqual(copy(target),before);assert.deepEqual(copy(source),src);
 target.columns=target.columns.filter(c=>c.key!=='CHANNEL');assert.throws(()=>E.copyConditions(source,target,[source.rules[1].id],destination),/technical field CHANNEL/);assert.equal(target.rules.length,0);assert.equal(target.lookups.length,0);
 assert.throws(()=>E.copyConditions(source,target,[],destination),/at least one/);
});
