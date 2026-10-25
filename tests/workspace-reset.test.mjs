import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const copy=x=>JSON.parse(JSON.stringify(x));
function setup(t,{unfinished=false}={}){
 const dom=new JSDOM('<button id="workspaceResetButton"></button><dialog id="modal"></dialog>',{runScripts:'outside-only',url:'https://preview.test'});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document;d.getElementById('modal').open=true;w.eval(readFileSync(new URL('../workspace-reset.js',import.meta.url),'utf8'));
 let state={tickets:[{id:'t',ticket:'A <script>',status:unfinished?'Pending':'Closed'}],projects:[{id:'p',name:'Project',phase:unfinished?'Build':'Completed'}],tasks:[],schedule:[],workhub:{notes:[{text:'Private note'}]}};
 const c={ready:true,user:{id:'one',email:'one@example.test'},generation:1,revision:4};
 const calls=[],downloads=[],messages=[];let applied=0,uncertain=0,activeTimer=false,authHook=null,rpcHook=null;
 const db={revision:4,password:'correct-password',rpcError:null,authOwner:'one'};
 const verifier={auth:{async signInWithPassword(args){calls.push({auth:{...args}});if(authHook)await authHook();return args.password===db.password?{data:{user:{id:db.authOwner}},error:null}:{data:null,error:{message:'Invalid credentials'}};},async signOut(args){calls.push({signout:args});}},
 from:table=>({select:columns=>({eq:(field,id)=>({maybeSingle:async()=>{calls.push({read:{table,columns,field,id}});return{data:{revision:db.revision},error:null};}})})}),
 async rpc(name,args){calls.push({rpc:{name,args:copy(args)}});if(rpcHook)await rpcHook();if(db.rpcError)return{error:db.rpcError};db.revision++;return{data:[{revision:db.revision}],error:null};}};
 const ui=w.WorkHubWorkspaceReset.install({cloud:()=>c,state:()=>state,timer:()=>activeTimer,payload:s=>JSON.stringify({app:'mm-ticket-tracker',version:9,data:s}),empty:()=>({tickets:[],projects:[{id:'starter',name:'Empty starter'}],tasks:[],schedule:[],workhub:{notes:[]}}),validate:s=>assert.ok(Array.isArray(s.tickets)),today:()=> '2026-10-26',download:(...args)=>downloads.push(args),openModal:(title,html)=>{d.getElementById('modal').innerHTML=html;},closeModal:()=>{},tell:(...args)=>messages.push(args),createClient:()=>verifier,apply:(doc,rev)=>{applied++;state=doc.data;c.revision=rev;},uncertain:()=>uncertain++});
 const form=()=>d.getElementById('workspaceResetForm');
 function ready(){ui.open();ui.backup();form().elements.backupSaved.checked=true;form().elements.confirmation.value='CLEAR';form().elements.password.value='correct-password';if(form().elements.unfinishedConfirmed)form().elements.unfinishedConfirmed.checked=true;return form();}
 return {ui,c,db,calls,downloads,messages,w,d,form,ready,state:()=>state,applied:()=>applied,uncertain:()=>uncertain,timer:v=>activeTimer=v,authHook:f=>authHook=f,rpcHook:f=>rpcHook=f};
}
test('Workspace reset requires a downloaded, acknowledged backup, exact confirmation and a password',async t=>{
 const h=setup(t);h.ui.open();let f=h.form();await h.ui.submit(f);assert.match(f.textContent,/backup first/i);assert.equal(h.calls.length,0);
 h.ui.backup();assert.equal(JSON.parse(h.downloads[0][0]).data.workhub.notes[0].text,'Private note');f.elements.backupSaved.checked=true;
 await h.ui.submit(f);assert.match(f.textContent,/Type CLEAR/);assert.equal(h.calls.length,0);
 f.elements.confirmation.value='CLEAR';await h.ui.submit(f);assert.match(f.textContent,/current account password/);assert.equal(h.calls.length,0);
});
test('Workspace reset lists unfinished work safely and requires an explicit override',async t=>{
 const h=setup(t,{unfinished:true}),f=h.ready();assert.equal(h.d.querySelector('script'),null);assert.match(f.textContent,/A <script>/);
 f.elements.unfinishedConfirmed.checked=false;await h.ui.submit(f);assert.match(f.textContent,/confirm clearing unfinished/);assert.equal(h.calls.length,0);assert.equal(h.state().tickets.length,1);
 f.elements.unfinishedConfirmed.checked=true;f.elements.password.value='correct-password';await h.ui.submit(f);assert.equal(h.applied(),1);
});
test('Workspace reset wrong passwords and different verified identities cannot clear records',async t=>{
 const h=setup(t),f=h.ready();f.elements.password.value='wrong-password';await h.ui.submit(f);assert.equal(f.elements.password.value,'');assert.equal(h.calls.filter(x=>x.rpc).length,0);assert.equal(h.applied(),0);assert.equal(h.c.resetting,null);
 h.db.authOwner='other';f.elements.password.value='correct-password';await h.ui.submit(f);assert.equal(h.calls.filter(x=>x.rpc).length,0);assert.match(f.textContent,/current account/);
});
test('Workspace reset saves a fresh document only after password, owner and remote revision checks',async t=>{
 const h=setup(t),f=h.ready();await h.ui.submit(f);const rpc=h.calls.find(x=>x.rpc).rpc;
 assert.equal(rpc.name,'save_mm_tracker');assert.equal(rpc.args.p_expected_revision,4);assert.equal(rpc.args.p_document.data.workhub.notes.length,0);assert.equal(rpc.args.p_document.data.tickets.length,0);
 assert.deepEqual(h.calls.find(x=>x.read).read,{table:'mm_tracker_documents',columns:'revision',field:'user_id',id:'one'});
 assert.equal(h.applied(),1);assert.equal(h.c.revision,5);assert.equal(h.state().projects[0].id,'starter');assert.equal(f.elements.password.value,'');assert.deepEqual(copy(h.calls.at(-1)),{signout:{scope:'local'}});
});
test('Workspace reset refuses changed local or remote records and needs a new backup',async t=>{
 const h=setup(t),f=h.ready();h.state().workhub.notes.push({text:'New note'});await h.ui.submit(f);assert.equal(h.calls.filter(x=>x.auth).length,0);assert.equal(h.applied(),0);
 const g=setup(t),form=g.ready();g.db.revision=5;await g.ui.submit(form);assert.equal(g.calls.filter(x=>x.rpc).length,0);assert.equal(g.applied(),0);assert.match(form.textContent,/Another device/);
});
test('Workspace reset failed writes keep the previous document, require a reload and never retry automatically',async t=>{
 for(const code of ['PT409','NETWORK']){const h=setup(t),before=copy(h.state()),f=h.ready();h.db.rpcError={code,message:'Failed'};await h.ui.submit(f);assert.deepEqual(h.state(),before);assert.equal(h.applied(),0);assert.equal(h.uncertain(),1);assert.equal(h.calls.filter(x=>x.rpc).length,1);assert.match(f.textContent,/Reload cloud records/);}
});
test('Workspace reset account changes during verification or save never apply old results to another account',async t=>{
 for(const phase of ['auth','rpc']){const h=setup(t),f=h.ready();h[phase==='auth'?'authHook':'rpcHook'](async()=>{h.c.user={id:'two'};h.c.generation++;});await h.ui.submit(f);assert.equal(h.applied(),0);assert.equal(f.elements.password.value,'');if(phase==='auth')assert.equal(h.calls.filter(x=>x.rpc).length,0);}
});
test('Workspace reset blocks duplicate submissions, active timers and unsynced records',async t=>{
 const h=setup(t),f=h.ready();let finish;h.authHook(()=>new Promise(r=>finish=r));const job=h.ui.submit(f);await h.ui.submit(f);assert.equal(h.calls.filter(x=>x.auth).length,1);finish();await job;assert.equal(h.calls.filter(x=>x.rpc).length,1);
 const g=setup(t);g.timer(true);assert.throws(()=>g.ui.open(),/Stop and save/);g.timer(false);g.c.pending={};assert.throws(()=>g.ui.open(),/Finish syncing/);
});
test('Workspace reset stops before any write if its review closes while password verification is pending',async t=>{
 const h=setup(t),f=h.ready();let finish;h.authHook(()=>new Promise(r=>finish=r));const job=h.ui.submit(f);h.d.getElementById('modal').open=false;finish();await job;assert.equal(h.calls.filter(x=>x.rpc).length,0);assert.equal(h.applied(),0);assert.equal(f.elements.password.value,'');
});
test('Workspace reset keeps its confirmation open and disables cancel while its authorised request is running',async t=>{
 const h=setup(t),f=h.ready();let finish;h.authHook(()=>new Promise(r=>finish=r));const job=h.ui.submit(f);assert.ok([...f.querySelectorAll('button')].every(b=>b.disabled));const cancel=new h.w.Event('cancel',{cancelable:true});h.d.getElementById('modal').dispatchEvent(cancel);assert.equal(cancel.defaultPrevented,true);finish();await job;assert.equal(h.applied(),1);assert.equal(h.c.resetting,null);
});
