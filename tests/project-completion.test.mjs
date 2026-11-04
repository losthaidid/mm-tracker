import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
import {randomUUID} from 'node:crypto';
const window={crypto:{randomUUID},WorkHubReminders:{validDate:v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v}};
runInNewContext(readFileSync(new URL('../workspace-upgrades.js',import.meta.url),'utf8'),{window});
const E=window.WorkHubProjectDates,copy=x=>JSON.parse(JSON.stringify(x)),today='2026-11-04';
function data(){const d={specs:[{id:'main',status:'In Progress',description:'Keep description',remarks:'Parent notes',feedback:'Parent feedback',subItems:['Not started','In Progress','Blocked','Completed'].map((status,i)=>({id:'child-'+i,title:'Child '+i,status,remarks:'Own notes '+i,feedback:'Own feedback '+i,owner:'Owner '+i,dueDate:'2026-12-01',createdAt:'2026-10-01T00:00:00.000Z',updatedAt:'2026-10-02T00:00:00.000Z'}))}]};E.upgrade(d);return d;}
test('Project completion: main completion cascades once, keeps child information and records normal dated history',()=>{
 const before=data(),d=copy(before);d.specs[0].status='Completed';d.specs[0].statusDate='2026-11-01';d.specs[0]._statusDateExplicit=true;E.prepare(d,before,today);const p=d.specs[0];assert.ok(p.subItems.every(s=>s.status==='Completed'));assert.equal(p.statusDate,'2026-11-01');assert.equal(p.statusHistory.length,1);
 for(let i=0;i<4;i++){const s=p.subItems[i],prior=before.specs[0].subItems[i];for(const k of ['id','title','remarks','feedback','owner','dueDate','createdAt'])assert.equal(s[k],prior[k]);if(prior.status==='Completed')assert.deepEqual(copy(s),copy(prior));else{assert.equal(s.statusDate,'2026-11-01');assert.equal(s.statusHistory.length,1);assert.equal(s._statusDateExplicit,undefined);}}
 const saved=copy(d);E.prepare(d,saved,today);assert.deepEqual(copy(d),saved);assert.equal(before.specs[0].subItems[0].status,'Not started');
});
test('Project completion: last completed child promotes only its own parent; partial and empty parents keep their status',()=>{
 const before=data(),d=copy(before);d.specs.push({id:'empty',status:'Testing',subItems:[]});E.upgrade(d);d.specs[0].subItems[0].status='Completed';E.prepare(d,before,today);assert.equal(d.specs[0].status,'In Progress');const prior=copy(d);for(const s of d.specs[0].subItems)s.status='Completed';E.prepare(d,prior,today);assert.equal(d.specs[0].status,'Completed');assert.equal(d.specs[0].statusHistory.length,1);assert.equal(d.specs[0].statusDate,today);assert.equal(d.specs[1].status,'Testing');
});
test('Project completion: reselecting Completed can finish legacy open children without duplicating parent history',()=>{
 const before=data();before.specs[0].status='Completed';before.specs[0].statusDate='2026-10-01';before.specs[0].statusHistory=[{id:'old',status:'Completed',date:'2026-10-01',changedAt:'2026-10-01T00:00:00.000Z'}];const d=copy(before);d.specs[0]._completeSubItems=true;E.prepare(d,before,today);assert.ok(d.specs[0].subItems.every(s=>s.status==='Completed'));assert.equal(d.specs[0].statusHistory.length,1);assert.equal(d.specs[0].statusDate,'2026-10-01');assert.equal(d.specs[0]._completeSubItems,undefined);
});
test('Project completion: restoring and unrelated edits do not retroactively rewrite saved statuses or histories',()=>{
 const before=data();before.specs[0].subItems.forEach(s=>s.status='Completed');const d=copy(before);d.specs[0].remarks='Edited notes';E.prepare(d,before,today);assert.equal(d.specs[0].status,'In Progress');assert.equal(d.specs[0].statusHistory.length,0);d.specs[0].status='Completed';d.specs[0].subItems[0].status='Blocked';d.specs[0]._completeSubItems=true;const restored=copy(d);delete restored.specs[0]._completeSubItems;E.prepare(d,before,today,true);assert.deepEqual(copy(d),restored);
});
test('Project completion: manual reopening is preserved and deleting the last unfinished child can complete the remaining set',()=>{
 const before=data();before.specs[0].status='Completed';before.specs[0].subItems.forEach(s=>s.status='Completed');let d=copy(before);d.specs[0].status='Testing';E.prepare(d,before,today);assert.equal(d.specs[0].status,'Testing');assert.ok(d.specs[0].subItems.every(s=>s.status==='Completed'));
 const old=data();old.specs[0].subItems=[old.specs[0].subItems[2],old.specs[0].subItems[3]];d=copy(old);d.specs[0].subItems.shift();E.prepare(d,old,today);assert.equal(d.specs[0].status,'Completed');d=copy(old);d.specs[0].subItems=[];E.prepare(d,old,today);assert.equal(d.specs[0].status,'In Progress');
});
test('Project completion: a shared child array never mutates the original document during a prepared cascade',()=>{
 const before=data(),snapshot=copy(before),d={specs:[{...before.specs[0],status:'Completed',subItems:before.specs[0].subItems,statusHistory:[]}]};E.prepare(d,before,today);assert.deepEqual(copy(before),snapshot);assert.ok(d.specs[0].subItems.every(s=>s.status==='Completed'));
});
