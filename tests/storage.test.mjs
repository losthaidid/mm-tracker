import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
import JSZip from '../vendor/jszip.min.js';
await import('../storage-engine.js');
const E=globalThis.WorkHubStorageEngine, clone=E.copy;
const data=()=>({tasks:[{id:'task-001',task:'Material 001 · 6.00007',done:true,doneDate:'2025-01-01',subTasks:[{id:'sub-001',text:'Retain µ and 中文'}]}],tickets:[],specs:[],schedule:[],workhub:{validator:{runs:[{id:'run-1',at:'2025-01-02T00:00:00Z',fileName:'001.xlsx'}]},notebook:{notes:[],notebooks:[]}}});
const selection=['tasks','task-001'];const task=E.key(...selection),run=E.key('workhub.validator.runs','run-1');
test('Storage engine: byte accounting is UTF-8, partitions nested sections without overlap, and preserves identifiers',()=>{
 const d=data(),before=JSON.stringify(d),o=E.overview(d);assert.equal(E.bytes('µ中文'),Buffer.byteLength('µ中文'));assert.equal(o.parts.filter(x=>x.path==='workhub.validator').length,1);assert.ok(!o.parts.some(x=>x.path==='workhub'));assert.equal(o.bytes,Buffer.byteLength(before));assert.equal(JSON.stringify(d),before);
});
test('Storage engine: candidate dates include saved run timestamps and active/future records stay out',()=>{
 const d=data();d.tasks.push({id:'active',done:false});d.schedule.push({id:'future',date:'2030-01-01'});const r=E.candidates(d,{before:'2026-01-01',today:'2026-11-04'});assert.deepEqual(r.map(x=>x.key),[task,run]);
});
test('Storage engine: cleanup protects nested child references, ID-keyed maps and case-insensitive tracker labels',()=>{
 for(const refs of [{schedule:[{id:'slot',linkId:'sub-001'}]},{workhub:{myDay:{profiles:{'task-001':true}}}}]){const d={...data(),...refs};const p=E.cleanup(d,[task],'2026-11-04');assert.equal(p.removable.length,0);assert.equal(p.protected.length,1);}
 const d=data();d.tickets=[{id:'ticket-1',ticket:'ABC-001',status:'Closed'}];d.trackers=[{id:'progress',ticket:'abc-001'}];assert.equal(E.cleanup(d,[E.key('tickets','ticket-1')],'2026-11-04').removable.length,0);
});
test('Storage engine: protection propagates through selected references; independent cycles can archive together',()=>{
 const d=data();d.tasks[0].linked='run-1';d.workhub.settings={pinned:'task-001'};assert.equal(E.cleanup(d,[task,run],'2026-11-04').protected.length,2);
 delete d.workhub.settings;d.workhub.validator.runs[0].linked='task-001';const p=E.cleanup(d,[task,run],'2026-11-04');assert.equal(p.removable.length,2);assert.equal(p.next.tasks.length,0);assert.equal(p.next.workhub.validator.runs.length,0);assert.equal(d.tasks.length,1);assert.ok(p.savings>0);
});
test('Storage engine: archive round trip is lossless, compressed, checksummed and selected-record scoped',async()=>{
 const d=data();d.tasks[0].remarks='001 6.00007 µ 中文 '.repeat(1000);const p=await E.pack(d,[task,run],'owner',JSZip);assert.ok(p.buffer.byteLength<p.rawBytes);const r=await E.unpack(p.buffer,JSZip,()=>{});assert.deepEqual(r.data,d);assert.deepEqual(r.manifest.selected,[task,run]);assert.equal(r.hash,p.hash);
 const z=await JSZip.loadAsync(p.buffer);z.file('workspace.json',JSON.stringify({app:'mm-ticket-tracker',version:9,data:{...d,tasks:[]}}));await assert.rejects(E.unpack(await z.generateAsync({type:'uint8array'}),JSZip,()=>{}),/damaged/);
});
test('Storage engine: unsupported paths, missing selections and oversized/malformed archives are refused',async()=>{
 assert.throws(()=>E.cleanup(data(),[E.key('__proto__.x','bad')],'2026-11-04'),/Unsupported/);assert.throws(()=>E.cleanup(data(),[task,task],'2026-11-04'),/valid record/);assert.throws(()=>E.restore(data(),data(),[E.key('tasks','missing')]),/missing/);
 const z=new JSZip();z.file('workspace.json','{}');await assert.rejects(E.unpack(await z.generateAsync({type:'uint8array'}),JSZip,()=>{}),/Invalid/);
});
test('Storage engine: selective restore includes missing dependencies and never overwrites changed live rows',()=>{
 const saved=data();saved.workhub.notebook.notebooks=[{id:'book-1',name:'Work'}];saved.workhub.notebook.notes=[{id:'note-1',title:'001',trashed:true,notebookId:'book-1',taskId:'task-001'}];
 const live=data();live.tasks[0].task='Newer live description';live.workhub.validator.runs=[];
 const p=E.restore(live,saved,[E.key('workhub.notebook.notes','note-1'),task,run]);assert.equal(p.next.tasks[0].task,'Newer live description');assert.equal(p.conflicts.length,1);assert.equal(p.additions.length,3);assert.equal(p.additions.filter(r=>r.dependency).length,1);assert.equal(live.workhub.notebook.notes.length,0);
});
function setup(t){
 const dom=new JSDOM('<button id="storageManagerButton"></button>',{url:'https://preview.test',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());const w=dom.window;w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:webcrypto.subtle});w.JSZip=JSZip;w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 for(const f of ['storage-engine.js','storage-manager.js'])w.eval(readFileSync(new URL('../'+f,import.meta.url),'utf8'));
 let state=data(),permission=true,cache=true,apply=0,uncertain=0;const downloads=[],calls=[],c={ready:true,user:{id:'owner',email:'owner@example.test'},generation:1,revision:4};let authHook=null,rpcHook=null;
 const verify={auth:{async signInWithPassword(args){calls.push('auth');if(authHook)await authHook();return args.password==='correct'?{data:{user:{id:'owner'}}}:{error:{message:'bad'}};},async signOut(){}},async rpc(name,args){calls.push(name);if(name==='workhub_storage_usage')return{data:{revision:c.revision}};if(rpcHook)await rpcHook();return{data:[{revision:c.revision+1}]};}};
 c.client={rpc:async()=>({data:{recordBytes:234,revision:4,storedDocumentBytes:120,project:{databaseBytes:1000000}}})};
 const ui=w.WorkHubStorage.install({cloud:()=>c,state:()=>state,access:()=>({can:()=>permission,refresh:async()=>{}}),payload:d=>JSON.stringify({app:'mm-ticket-tracker',version:9,data:d}),validate:()=>{},prepare:()=>{},authorize:()=>{if(!permission)throw Error('Permission denied');},today:()=> '2026-11-04',timer:()=>false,closeSettings:()=>{},tell:()=>{},exportCheck:()=>{if(!permission)throw Error('Export denied');},download:(...args)=>downloads.push(args),checkCache:()=>{if(!cache)throw Error('Other tab');},createClient:()=>verify,apply:(doc,rev)=>{state=clone(doc.data);c.revision=rev;apply++;},uncertain:()=>uncertain++});
 async function review(){await ui.open();await ui.action('cleanup');const box=w.document.querySelector('[data-storage-pick]');box.checked=true;box.dispatchEvent(new w.Event('change',{bubbles:true}));await ui.action('review');await ui.action('download');const buffer=downloads.at(-1)[0];return{buffer,file:{size:buffer.byteLength,arrayBuffer:async()=>buffer}};}
 async function verified(){const x=await review();await ui.readFile(x.file,true);const f=w.document.querySelector('form');f.elements.confirmation.value='REMOVE';f.elements.password.value='correct';return f;}
 return{w,ui,c,downloads,calls,review,verified,state:()=>state,apply:()=>apply,uncertain:()=>uncertain,permission:v=>permission=v,cache:v=>cache=v,authHook:f=>authHook=f,rpcHook:f=>rpcHook=f};
}
test('Storage UI: opening/refresh/download/verification never writes; only the exact downloaded archive unlocks removal',async t=>{
 const h=setup(t),x=await h.review();assert.equal(h.calls.length,0);assert.equal(h.w.document.querySelector('form'),null);
 const other=await E.pack(h.state(),[run],'owner',JSZip);await assert.rejects(h.ui.readFile({size:other.buffer.byteLength,arrayBuffer:async()=>other.buffer},true),/not the archive/);assert.equal(h.w.document.querySelector('form'),null);
 await h.ui.readFile(x.file,true);assert.ok(h.w.document.querySelector('form'));assert.equal(h.calls.length,0);assert.equal(h.apply(),0);
});
test('Storage UI: verified, password-checked cleanup saves exactly the reviewed document with revision protection',async t=>{
 const h=setup(t),f=await h.verified();await h.ui.commit(f);assert.equal(h.apply(),1);assert.equal(h.state().tasks.length,0);assert.equal(h.state().workhub.validator.runs[0].fileName,'001.xlsx');assert.equal(h.c.revision,5);assert.equal(f.elements.password.value,'');assert.deepEqual(h.calls,['auth','workhub_storage_usage','save_mm_tracker']);
});
test('Storage UI: wrong password, permission revocation, local edits and cross-tab changes cannot remove data',async t=>{
 for(const type of ['password','permission','edited','tab']){const h=setup(t),f=await h.verified();if(type==='password')f.elements.password.value='wrong';if(type==='permission')h.permission(false);if(type==='edited')h.state().tasks[0].task='Edited';if(type==='tab')h.cache(false);await h.ui.commit(f);assert.equal(h.apply(),0);assert.equal(h.state().tasks.length,1);assert.ok(!h.calls.includes('save_mm_tracker'));}
});
test('Storage UI: account change during file verification or credential check discards stale results',async t=>{
 const h=setup(t),x=await h.review();h.c.user={id:'other'};await assert.rejects(h.ui.readFile(x.file,true),/changed/);assert.equal(h.apply(),0);
 const g=setup(t),f=await g.verified();g.authHook(async()=>{g.c.user={id:'other'};g.c.generation++;g.ui.sync();});await g.ui.commit(f);assert.equal(g.apply(),0);assert.ok(!g.calls.includes('save_mm_tracker'));assert.equal(g.w.document.getElementById('workhubStorage').open,false);
});
test('Storage UI: unconfirmed writes keep local state and require reload; repeated submissions send once',async t=>{
 const h=setup(t),f=await h.verified();h.rpcHook(async()=>{throw Error('Network lost');});await h.ui.commit(f);assert.equal(h.apply(),0);assert.equal(h.uncertain(),1);assert.equal(h.state().tasks.length,1);
 const g=setup(t),form=await g.verified();let release;g.authHook(()=>new Promise(r=>release=r));const job=g.ui.commit(form);await g.ui.commit(form);assert.equal(g.calls.filter(x=>x==='auth').length,1);release();await job;assert.equal(g.calls.filter(x=>x==='save_mm_tracker').length,1);
});
test('Storage UI: restore previews conflicts, restores missing dependencies and uses the same checked write path',async t=>{
 const h=setup(t),f=await h.verified();await h.ui.commit(f);await h.ui.action('local');const packed=h.downloads[0][0];await h.ui.readFile({size:packed.byteLength,arrayBuffer:async()=>packed},false);
 const box=h.w.document.querySelector('[data-storage-pick]');box.checked=true;box.dispatchEvent(new h.w.Event('change',{bubbles:true}));await h.ui.action('restore-review');const form=h.w.document.querySelector('form');form.elements.confirmation.value='RESTORE';form.elements.password.value='correct';await h.ui.commit(form);assert.equal(h.state().tasks[0].task,'Material 001 · 6.00007');assert.equal(h.apply(),2);
});

test('Storage engine: record-owned context moves with its parent while immutable timeline history remains online',()=>{
 const d=data();d.workhub.batchA={records:[{id:'tasks:task-001',kind:'tasks',recordId:'task-001',outcomeNote:'Keep my exact 001'}]};d.workhub.myDay={taskProfiles:[{id:'task-001',minutes:25}]};d.workhub.workLibrary={events:[{id:'event-1',recordId:'task-001',title:'Completed task'}]};
 const p=E.cleanup(d,[task],'2026-11-04');assert.equal(p.removable.length,1);assert.equal(p.ownedCount,2);assert.equal(p.next.workhub.batchA.records.length,0);assert.equal(p.next.workhub.myDay.taskProfiles.length,0);assert.deepEqual(p.next.workhub.workLibrary,d.workhub.workLibrary);
 const r=E.restore(p.next,d,[task]);assert.equal(r.next.workhub.batchA.records[0].outcomeNote,'Keep my exact 001');assert.equal(r.next.workhub.myDay.taskProfiles[0].minutes,25);assert.equal(r.next.workhub.workLibrary.events.length,1);
 d.workhub.batchA.records.push({id:'tasks:active',kind:'tasks',recordId:'active',dependencies:[{recordId:'task-001'}]});assert.equal(E.cleanup(d,[task],'2026-11-04').removable.length,0);
});
