import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
const window={};for(const file of ['sap-tcodes-data.js','sap-tcodes-engine.js','rehearsal-engine.js'])runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{window});
const E=window.WorkHubRehearsalEngine,T=window.WorkHubSapTcodesEngine,copy=x=>JSON.parse(JSON.stringify(x)),stamp='2026-10-21T00:00:00.000Z';
function state(){const d={workhub:{}};E.upgrade(d);T.upgrade(d);return d;}
test('rehearsal: scenarios produce independent value snapshots and explicit exception routes',()=>{
 const p=E.seed('p',stamp),normal=E.plan(p,p.scenarios[0]),partial=E.plan(p,p.scenarios[1]);
 assert.equal(normal.ending,'complete');assert.equal(normal.values['Received quantity'],100);assert.equal(partial.values['Received quantity'],60);
 assert.equal(normal.entries.some(e=>e.id==='followup'),false);assert.equal(partial.entries.some(e=>e.id==='followup'),true);
 const receipt=normal.entries.find(e=>e.id==='gr');assert.equal(receipt.before['Received quantity'],0);assert.equal(receipt.values['Received quantity'],100);
 receipt.values['Received quantity']=123;assert.equal(normal.entries.find(e=>e.id==='invoice').values['Received quantity'],100);
 assert.equal(p.scenarios[0].initial['Received quantity'],0);
});
test('rehearsal: failures stop without a recovery edge and graph cycles are bounded',()=>{
 const p=E.seed('p',stamp),failed=E.plan(p,p.scenarios[0],{po:'failure'}),cycle=E.plan(p,p.scenarios[2]);
 assert.equal(failed.entries.length,1);assert.equal(failed.ending,'failed');assert.equal(failed.values['Order value'],undefined);
 assert.equal(cycle.ending,'loop-guard');assert.ok(cycle.entries.length<=160);assert.ok(cycle.entries.filter(e=>e.id==='approve').length<=4);
 const recovered=E.plan(p,p.scenarios[2],{approve:'success'});assert.equal(recovered.ending,'complete');
});
test('rehearsal: field operations use bounded data rather than executing user expressions',()=>{
 assert.deepEqual(copy(E.values('Received = 0\nDelivery = 60\nStatus = Waiting')),{Received:0,Delivery:60,Status:'Waiting'});
 const list=E.changes('Received += @Delivery\nStatus = Received'),r=E.apply({Received:0,Delivery:60},list);assert.equal(r.values.Received,60);assert.equal(r.values.Status,'Received');
 assert.throws(()=>E.values('__proto__ = attack'),/field/);assert.throws(()=>E.values('constructor = attack'),/field/);assert.throws(()=>E.apply({},[{field:'x',operator:'add',value:'@missing'}]),/Missing/);
 assert.throws(()=>E.apply({x:'text'},[{field:'x',operator:'add',value:2}]),/Numeric/);assert.throws(()=>E.apply({x:1e12},[{field:'x',operator:'add',value:1}]),/sample/);
 const harmless=E.values('Note = alert(1)');assert.equal(harmless.Note,'alert(1)');
});
test('rehearsal: validation rejects foreign edges, oversized screenshots and malformed imports',()=>{
 const d=state(),p=E.seed('p',stamp);d.workhub.rehearsal.processes=[p];E.validate(d);
 p.steps[0].next='other-process-step';assert.throws(()=>E.validate(d),/connections/);p.steps[0].next='approve';
 p.steps[0].image='data:image/svg+xml;base64,AAAA';assert.throws(()=>E.validate(d),/screenshot/);p.steps[0].image='';
 p.steps[0].link='javascript:alert(1)';assert.throws(()=>E.validate(d),/steps/);p.steps[0].link='';
 p.scenarios[0].choices.foreign='failure';assert.throws(()=>E.validate(d),/branch/);delete p.scenarios[0].choices.foreign;
 p.steps[0].x=NaN;assert.throws(()=>E.validate(d),/steps/);
});
test('rehearsal: layout and sampled token paths stay finite for a branching graph',()=>{
 const p=E.layout(E.seed('p',stamp));for(const s of p.steps){assert.ok(s.x>=0&&s.x<=4000);assert.ok(s.y>=0&&s.y<=4000);}
 const a=p.steps[0],b=p.steps[1];for(const t of [0,.25,.5,.75,1]){const q=E.point(a,b,t);assert.ok(Number.isFinite(q.x)&&Number.isFinite(q.y));}
 assert.match(E.path(a,b),/^M /);assert.equal(E.point(a,b,0).x,a.x+210);assert.equal(E.point(a,b,1).x,b.x);
});
test('T-codes: SAP starter data has unique codes, five groups and explicit vendor-version scope',()=>{
 const d=state();T.validate(d);const rows=d.workhub.tcodes.records;assert.equal(rows.length,79);assert.equal(new Set(rows.map(r=>r.code)).size,rows.length);
 assert.equal(new Set(rows.map(r=>r.category)).size,5);assert.ok(rows.every(r=>r.sourceUrl.startsWith('https://help.sap.com/')));
 assert.ok(T.query(d,{system:'ECC'}).some(r=>r.code==='XK01'));assert.ok(!T.query(d,{system:'S4'}).some(r=>r.code==='XK01'));assert.ok(T.query(d,{system:'S4'}).some(r=>r.code==='BP'));
 assert.equal(T.query(d,{query:'me21n'})[0].title,'Create purchase order');assert.ok(T.query(d,{category:'Reporting'}).every(r=>r.category==='Reporting'));
});
test('T-codes: archived and edited entries survive upgrades without reseeding',()=>{
 const d=state(),r=d.workhub.tcodes.records.find(r=>r.code==='ME21N');r.archived=true;r.favorite=true;r.notes='My purchasing variant';T.upgrade(d);T.validate(d);
 assert.equal(T.query(d,{query:'ME21N'}).length,0);assert.equal(T.query(d,{query:'ME21N',archived:true,favorite:true}).length,1);assert.equal(r.notes,'My purchasing variant');
 const bad=copy(d);bad.workhub.tcodes.records[0].sourceUrl='javascript:alert(1)';assert.throws(()=>T.validate(bad),/details/);
 bad.workhub.tcodes.records[0].sourceUrl='';bad.workhub.tcodes.records[0].systems=[];assert.throws(()=>T.validate(bad),/details/);
});

test('live resume: graph edits preserve the active phase and completed sample values while including a new destination',()=>{
 const p=E.seed('p',stamp,true);p.steps.forEach(s=>s.duration=3);p.scenarios[0].initial={Count:0};p.steps[0].changes=[{field:'Count',operator:'add',value:1}];
 const before=E.plan(p,p.scenarios[0]),extra={...copy(p.steps[1]),id:'extra',title:'New destination',next:'',duration:6};p.steps.push(extra);E.connect(p,'finish','extra');p.steps[1].duration=6;
 const resumed=E.resumePlan(p,p.scenarios[0],before,1,1500);
 assert.equal(resumed.index,1);assert.equal(resumed.elapsed,3000);assert.deepEqual(copy(resumed.route.entries.map(s=>s.id)),['po','finish','extra']);assert.equal(resumed.route.values.Count,1);assert.equal(resumed.route.entries[1].before.Count,1);
});
test('live resume: deleting the current step follows a surviving successor and repeated edits retain global loop bounds',()=>{
 const p=E.seed('p',stamp,true);p.steps[1].next='po';let route=E.plan(p,p.scenarios[0]);
 for(let i=0;i<30;i++){const result=E.resumePlan(p,p.scenarios[0],route,Math.min(2,route.entries.length-1),700);route=result.route;assert.ok(route.entries.length<=160);assert.ok(['po','finish'].every(id=>route.entries.filter(e=>e.id===id).length<=4));}
 const previous=E.plan(p,p.scenarios[0]);E.removeStep(p,'po');const resumed=E.resumePlan(p,p.scenarios[0],previous,0,700);assert.equal(resumed.route.entries[resumed.index].id,'finish');assert.equal(resumed.elapsed,0);
});
