import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const owner='11111111-1111-4111-8111-111111111111',member='22222222-2222-4222-8222-222222222222';
await import('../access-catalog.js');
const C=globalThis.WorkHubAccessCatalog;
async function setup(t){
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,encrypted_password text,created_at timestamptz default now(),last_sign_in_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 insert into auth.users(id,email,encrypted_password,email_confirmed_at) values('${owner}','owner@example.test','hashed',now());`);
 await db.exec(read('cloud-schema.sql'));
 await db.exec(read('supabase/user-management.sql'));
 await db.exec(read('supabase/access-catalog.sql'));
 await db.exec(read('supabase/bootstrap-owner.sql'));
 const sign=async(id=owner,role='authenticated')=>{await db.exec('reset role;set role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
 const command=async(action,target=null,payload={})=>(await db.query('select public.workhub_admin_command($1,$2,$3::jsonb) as value',[action,target,JSON.stringify(payload)])).rows[0].value;
 const add=async(perms=C.preset())=>{await sign('','anon');await db.query("select public.workhub_request_access('member@example.test','Sample member','Testing')");await sign();const request=(await command('list')).requests[0];await command('approve',request.id,{permissions:perms});await db.exec('reset role');await db.query('insert into auth.users(id,email,encrypted_password) values($1,$2,$3)',[member,'member@example.test','hashed']);await sign(member);};
 return{db,sign,command,add};
}
const doc=data=>({app:'mm-ticket-tracker',version:9,data:{tickets:[],trackers:[],tasks:[],specs:[],schedule:[],projects:[{id:'p1',name:'Private project',code:'ABC'}],activeProjectId:'p1',projectCompanies:[],lists:{codes:[]},calendarMonth:'2026-10',source:'',preferences:{hiddenTabs:[]},workhub:{},...data}});
const save=(db,d,rev,id=randomUUID())=>db.query('select * from public.save_mm_tracker($1::jsonb,$2,$3)',[JSON.stringify(d),rev,id]);
test('Access database: requests do not create accounts; only owner approval provisions immutable member permissions',async t=>{
 const {db,sign,command,add}=await setup(t);
 await db.exec('reset role');await assert.rejects(db.query('insert into auth.users(id,email) values($1,$2)',[member,'member@example.test']),/owner approval/i);
 await sign('','anon');await db.query("select public.workhub_request_access('member@example.test','Sample member','Testing')");
 await assert.rejects(db.query('select * from public.workhub_access_requests'),e=>e.code==='42501');
 await assert.rejects(command('list'),e=>e.code==='42501');
 await db.exec('reset role');assert.equal((await db.query('select count(*) from auth.users')).rows[0].count,1);
 await add();
 assert.equal((await db.query('select public.workhub_my_access() as value')).rows[0].value.role,'member');
 await assert.rejects(command('list'),e=>e.code==='42501');
 await assert.rejects(db.query("update public.workhub_members set role='owner' where user_id=$1",[member]),e=>e.code==='42501');
 await sign();assert.equal((await command('list')).requests[0].status,'invited');
});
test('Access database: checked saving, projected reads and CRUD permissions preserve blocked data and deny escalation',async t=>{
 const {db,sign,command,add}=await setup(t);await add();
 const before=doc({tasks:[{id:'t1',task:'Original'}],workhub:{notebook:{notes:[{id:'secret-note',title:'PRIVATE_NOTE_MARKER'}]},validator:{templates:[]}}});
 await save(db,before,0);
 await sign();const perms=C.preset();perms.notes={mode:'hidden'};perms.tasks={mode:'use',create:true,edit:false,delete:false};perms.validator={mode:'view'};
 await command('permissions',member,{version:1,permissions:perms});await sign(member);
 assert.equal((await db.query('select * from public.mm_tracker_documents')).rows.length,0);
 const view=(await db.query('select * from public.load_mm_tracker()')).rows[0];assert.doesNotMatch(JSON.stringify(view),/PRIVATE_NOTE_MARKER/);
 const edited=structuredClone(view.document);edited.data.tasks[0].task='Tampered';await assert.rejects(save(db,edited,1),e=>e.code==='42501');
 const extra=structuredClone(view.document);extra.data.tasks.push({id:'t2',task:'New'});extra.data.workhub.notebook={notes:[]};await save(db,extra,1);
 await db.exec('reset role');const full=(await db.query('select document from public.mm_tracker_documents where user_id=$1',[member])).rows[0].document;assert.match(JSON.stringify(full),/PRIVATE_NOTE_MARKER/);
 await sign(member);const deleted=structuredClone(extra);deleted.data.tasks=[];await assert.rejects(save(db,deleted,2),e=>e.code==='42501');
 await db.query("select public.save_mm_tracker($1::jsonb,2,$2)",[JSON.stringify(extra),randomUUID()]);
 await sign();assert.equal((await db.query('select * from public.load_mm_tracker()')).rows.length,0);
});
test('Access database: suspension takes effect for existing JWT claims, version checks and owner protections hold',async t=>{
 const {db,sign,command,add}=await setup(t);await add();await save(db,doc({}),0);await sign();
 await assert.rejects(command('suspend',owner,{version:1}),/Owner account is protected/);
 await assert.rejects(command('permissions',member,{version:99,permissions:C.preset()}),e=>e.code==='PT409');
 await command('suspend',member,{version:1});await sign(member);
 await assert.rejects(db.query('select * from public.load_mm_tracker()'),e=>e.code==='42501');await assert.rejects(save(db,doc({}),1),e=>e.code==='42501');
 await sign();await command('activate',member,{version:2});await sign(member);assert.equal((await db.query('select * from public.load_mm_tracker()')).rows.length,1);
});
test('Access database: deletion preview is guarded against workspace changes, cascades records and prevents re-registration',async t=>{
 const {db,sign,command,add}=await setup(t);await add();await save(db,doc({tasks:[{id:'t1',task:'Demo'}]}),0);await sign();
 const p=await command('preview-delete',member);assert.equal(p.counts.tasks,1);assert.equal(p.revision,1);
 await assert.rejects(command('begin-delete',member,{version:1,email:'wrong@example.test',revision:1}),/Type the account email/);
 await assert.rejects(command('begin-delete',member,{version:1,email:p.email,revision:0}),e=>e.code==='PT409');
 await command('begin-delete',member,{version:1,email:p.email,revision:1});await sign(member);await assert.rejects(db.query('select * from public.load_mm_tracker()'),e=>e.code==='42501');
 await db.exec('reset role');await db.query('delete from auth.users where id=$1',[member]);assert.equal((await db.query('select * from public.mm_tracker_documents')).rows.length,0);
 await assert.rejects(db.query('insert into auth.users(id,email) values($1,$2)',[member,'member@example.test']),/owner approval/i);
 await assert.rejects(db.query('delete from auth.users where id=$1',[owner]),/Owner account is protected/);
 await sign();assert.ok((await command('list')).history.some(h=>h.action==='account-deleted'));
});

test('Access database: validation runs are permitted independently of template editing and a new restricted workspace stays loadable',async t=>{
 const {db,sign,command,add}=await setup(t);await add();
 const full=doc({workhub:{validator:{templates:[{id:'schema-1',name:'Keep this'}],runs:[]}}});await save(db,full,0);
 await sign();const perms=C.preset('view');perms.workspace=C.preset().workspace;perms.validator={mode:'use',run:true,export:true,create:false,edit:false,delete:false};
 await command('permissions',member,{version:1,permissions:perms});await sign(member);
 const run=structuredClone(full);run.data.workhub.validator.runs.push({id:'run-1',rows:5,errors:0});await save(db,run,1);
 const changed=structuredClone(run);changed.data.workhub.validator.templates[0].name='Tampered';await assert.rejects(save(db,changed,2),e=>e.code==='42501');
 await db.exec('reset role');await db.query('delete from public.mm_tracker_documents where user_id=$1',[member]);await sign();
 const tasks=C.preset('hidden');tasks.tasks={mode:'use',create:true,edit:true,delete:true,run:true,export:true};tasks.workspace=C.preset().workspace;
 await command('permissions',member,{version:2,permissions:tasks});await sign(member);await save(db,doc({tasks:[{id:'new-task',task:'Hello'}]}),0);
 const loaded=(await db.query('select * from public.load_mm_tracker()')).rows[0];assert.equal(loaded.document.data.projects.length,1);assert.equal(loaded.document.data.projects[0].id,'project-default');assert.equal(loaded.document.data.tasks[0].task,'Hello');
});
test('Access database: saved validation profiles enforce create, edit and delete permissions, including a first profile',async t=>{
 const {db,sign,command,add}=await setup(t);await db.exec("update public.workhub_feature_catalog set paths=array_remove(paths,'workhub.validator.profiles') where id='validator'");for(let i=0;i<2;i++)await db.exec(read('supabase/migrations/20261029024102_validation_profiles_access_path.sql'));assert.equal((await db.query("select cardinality(array_positions(paths,'workhub.validator.profiles')) as copies from public.workhub_feature_catalog where id='validator'")).rows[0].copies,1);await add();const full=doc({workhub:{validator:{templates:[{id:'schema',name:'Keep'}],runs:[]}}});await save(db,full,0);
 const profile={id:'profile',templateId:'schema',name:'PRIVATE_PROFILE',ruleIds:['a'],referenceChecks:[]},first=structuredClone(full);first.data.workhub.validator.profiles=[profile];
 await sign();const perms=C.preset('view');perms.validator={mode:'use',run:true,export:true,create:true,edit:false,delete:false};await command('permissions',member,{version:1,permissions:perms});await sign(member);
 C.assertChange({role:'member',status:'active',permissions:perms},full.data,first.data);const restored=structuredClone(first.data);C.restoreDerived({role:'member',status:'active',permissions:perms},full.data,restored);assert.equal(restored.workhub.validator.profiles.length,1);
 await save(db,first,1);const edited=structuredClone(first);edited.data.workhub.validator.profiles[0].name='Changed';await assert.rejects(save(db,edited,2),e=>e.code==='42501');const deleted=structuredClone(first);deleted.data.workhub.validator.profiles=[];await assert.rejects(save(db,deleted,2),e=>e.code==='42501');
 await sign();perms.validator={mode:'use',run:true,create:false,edit:true,delete:false};await command('permissions',member,{version:2,permissions:perms});await sign(member);await save(db,edited,2);const extra=structuredClone(edited);extra.data.workhub.validator.profiles.push({...profile,id:'another'});await assert.rejects(save(db,extra,3),e=>e.code==='42501');
 await sign();perms.validator={mode:'hidden'};await command('permissions',member,{version:3,permissions:perms});await sign(member);const projected=(await db.query('select * from public.load_mm_tracker()')).rows[0].document;assert.doesNotMatch(JSON.stringify(projected),/PRIVATE_PROFILE|Changed|ruleIds/);
 await sign();perms.validator={mode:'use',run:true,create:false,edit:false,delete:true};await command('permissions',member,{version:4,permissions:perms});await sign(member);await save(db,deleted,3);
});

test('Access database: unrelated edits retain filtered history, reminders and record metadata with idempotent retries',async t=>{
 const {db,sign,command,add}=await setup(t);await add();
 const before=doc({tickets:[{id:'ticket-1',description:'Before'}],tasks:[{id:'task-1',task:'PRIVATE_TASK'}],workhub:{
  workLibrary:{events:[{id:'event-secret',kind:'tasks',title:'PRIVATE_HISTORY'},{id:'event-visible',kind:'tickets',title:'Ticket created'}],eventsDropped:0},
  reminders:[{id:'reminder-secret',kind:'tasks',title:'PRIVATE_REMINDER'},{id:'reminder-visible',kind:'tickets',title:'Ticket reminder'}],
  batchA:{records:[{id:'metadata-secret',kind:'tasks',title:'PRIVATE_METADATA'},{id:'metadata-visible',kind:'tickets',title:'Ticket metadata'}]}
 }});await save(db,before,0);await sign();const perms=C.preset();perms.tasks={mode:'hidden'};await command('permissions',member,{version:1,permissions:perms});await sign(member);
 const view=(await db.query('select * from public.load_mm_tracker()')).rows[0].document;assert.doesNotMatch(JSON.stringify(view),/PRIVATE_/);
 view.data.tickets[0].description='After';const mutation=randomUUID();await save(db,view,1,mutation);await save(db,view,1,mutation);
 await db.exec('reset role');const stored=(await db.query('select document,revision from public.mm_tracker_documents where user_id=$1',[member])).rows[0];assert.equal(stored.revision,2);assert.equal(stored.document.data.tickets[0].description,'After');for(const marker of ['PRIVATE_TASK','PRIVATE_HISTORY','PRIVATE_REMINDER','PRIVATE_METADATA'])assert.ok(JSON.stringify(stored.document).includes(marker));
});
