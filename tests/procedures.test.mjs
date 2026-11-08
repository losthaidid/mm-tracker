import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
const window={};for(const file of ['procedures-engine.js','rehearsal-engine.js'])runInNewContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{window,URL,TextEncoder});
const E=window.WorkHubProceduresEngine,R=window.WorkHubRehearsalEngine,copy=x=>JSON.parse(JSON.stringify(x)),stamp='2026-11-08T04:00:00.000Z';
let i=0;const uid=()=> 'step-'+ ++i;
function sample(){return E.example('procedure-1',uid,stamp);}
test('written procedures: the CR Form example is an independent editable procedure with bounded structured steps',()=>{
 const p=sample();E.validateRecord(p);assert.equal(p.kind,'procedure');assert.equal(p.steps.length,6);assert.match(p.description,/example/i);assert.ok(p.steps.every(s=>s.next.length===0&&s.checklist.length));const q=sample();p.steps[0].checklist[0]='Changed';assert.notEqual(q.steps[0].checklist[0],'Changed');assert.ok(new Set(p.steps.map(s=>s.id)).size===6);
});
test('written procedures: unsafe links, empty titles, excess checklists and malformed structures are rejected',()=>{
 for(const change of [p=>p.steps[0].reference='javascript:alert(1)',p=>p.steps[0].reference='https://name:secret@example.test/',p=>p.steps[0].title='',p=>p.steps[0].next=['x'],p=>p.steps[0].checklist=Array(31).fill('Check'),p=>p.procedure.version=2,p=>p.canvas={version:1},p=>p.createdAt='Yesterday']){const p=sample();change(p);assert.throws(()=>E.validateRecord(p));}
 const p=sample();p.steps[0].reference='https://example.test/cr-form';E.validateRecord(p);
});
test('written procedures: older animated processes remain in the animated library and written rows are excluded without migration',()=>{
 const old={id:'old',name:'Existing process',description:'Original',archived:false,steps:[{id:'one',title:'First',notes:'Do it',next:[]}]},p=sample(),state={workhub:{processes:[old,p]}};R.upgrade(state);const before=JSON.stringify(state);const library=R.library(state);assert.equal(library.length,1);assert.equal(library[0].hubId,'old');assert.equal(JSON.stringify(state),before);E.validate(state);assert.equal(E.rows(state).length,1);
});
test('written procedures: Markdown preserves ordered instructions, roles, checklists and explicit web references',()=>{
 const p=sample();p.steps[0].reference='https://example.test/form';const md=E.markdown(p);assert.match(md,/# How to handle a CR Form/);assert.match(md,/## 1\. Receive the request/);assert.match(md,/- \[ \] Request reference recorded/);assert.match(md,/## 6\. Close and retain/);assert.match(md,/Reference: https:\/\/example.test\/form/);assert.equal(p.steps.some(s=>Object.hasOwn(s,'reviewed')),false);
});
