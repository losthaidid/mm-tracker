import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../supabase/migrations/20261104043659_storage_usage_summary.sql',import.meta.url),'utf8');
test('Storage database: metrics are read-only, account-scoped and project totals are Owner-only',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema workhub_private;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,workhub_private to authenticated;grant execute on function auth.uid() to authenticated;
 create table public.workhub_members(user_id uuid primary key,role text,status text);
 create table public.mm_tracker_documents(user_id uuid primary key,document jsonb,revision bigint);
 alter table public.mm_tracker_documents enable row level security;
 insert into public.workhub_members values('11111111-1111-4111-8111-111111111111','owner','active'),('22222222-2222-4222-8222-222222222222','member','active');
 insert into public.mm_tracker_documents values('11111111-1111-4111-8111-111111111111','{"app":"mm-ticket-tracker","data":{"tasks":[{"id":"001","text":"PRIVATE OWNER RECORD"}]}}',3),('22222222-2222-4222-8222-222222222222','{"app":"mm-ticket-tracker","data":{}}',7);`);
 await db.exec(sql);
 const before=(await db.query('select * from public.mm_tracker_documents order by user_id')).rows;
 async function sign(id,role='authenticated'){await db.exec('reset role;set role '+role);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
 const usage=async()=>(await db.query('select public.workhub_storage_usage() as value')).rows[0].value;
 await sign('11111111-1111-4111-8111-111111111111');const owner=await usage();assert.equal(owner.revision,3);assert.ok(owner.recordBytes>2);assert.equal(typeof owner.project.databaseBytes,'number');assert.doesNotMatch(JSON.stringify(owner),/PRIVATE OWNER RECORD|tasks|11111111/);
 await sign('22222222-2222-4222-8222-222222222222');const member=await usage();assert.equal(member.revision,7);assert.equal(member.recordBytes,2);assert.equal(member.project,undefined);assert.ok(!JSON.stringify(member).includes('PRIVATE'));
 await sign('33333333-3333-4333-8333-333333333333');await assert.rejects(usage(),e=>e.code==='42501');
 await sign('','anon');await assert.rejects(usage(),e=>e.code==='42501');
 await db.exec("reset role;update public.workhub_members set status='suspended' where role='member';");await sign('22222222-2222-4222-8222-222222222222');await assert.rejects(usage(),e=>e.code==='42501');
 await db.exec('reset role');assert.deepEqual((await db.query('select * from public.mm_tracker_documents order by user_id')).rows,before);
 const funcs=(await db.query("select p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('storage_usage','workhub_storage_usage')")).rows;
 assert.equal(funcs.find(f=>f.proname==='workhub_storage_usage').prosecdef,false);assert.equal(funcs.find(f=>f.proname==='storage_usage').prosecdef,true);assert.ok(funcs.every(f=>f.proconfig.includes('search_path=""')));
});
