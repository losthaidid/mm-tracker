import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const schema=readFileSync(new URL('../cloud-schema.sql',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261015010000_support_document_versions_5_to_7.sql',import.meta.url),'utf8');
const precisionMigration=readFileSync(new URL('../supabase/migrations/20261015033904_precise_schedules_and_subtask_notes.sql',import.meta.url),'utf8');
const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const document=version=>({app:'mm-ticket-tracker',version,data:{projects:[{id:'project-default',mmAreas:[{id:'custom-area',name:'Invoice Verification',visible:false,aliases:['Invoice Verification']}]}]}});

test('the migration repairs historical saves while preserving records, conflicts and private access',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec(`create role anon;create role authenticated;create schema auth;
  create table auth.users(id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  grant usage on schema auth to anon,authenticated;
  grant execute on function auth.uid() to anon,authenticated;
  insert into auth.users(id) values ('${owner}'),('${other}');`);
 await db.exec(schema.replace("('1','2','3','4','5','6','7','8')","('1','2','3','4')"));
 const signIn=async id=>{await db.exec('reset role;set role authenticated;');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);};
 const save=(value,revision,mutation=randomUUID())=>db.query('select * from public.save_mm_tracker($1::jsonb,$2::bigint,$3::uuid)',[JSON.stringify(value),revision,mutation]);
 await signIn(owner);await save(document(4),0);
 await assert.rejects(save(document(6),1),error=>error.code==='23514');
 await db.exec('reset role;');
 const before=(await db.query('select * from public.mm_tracker_documents')).rows;
 await db.exec(migration);
 assert.deepEqual((await db.query('select * from public.mm_tracker_documents')).rows,before);
 await db.exec(migration); // Reapplying this compatibility migration is harmless.
 await db.exec(precisionMigration);
 await signIn(owner);
 const mutation=randomUUID(),saved=await save(document(8),1,mutation);assert.equal(saved.rows[0].revision,2);
 const retried=await save(document(8),1,mutation);assert.equal(retried.rows[0].revision,2);
 await assert.rejects(save(document(8),1),error=>error.code==='PT409');
 await assert.rejects(save(document(9),2),error=>error.code==='23514');
 await assert.rejects(save({app:'wrong-app',version:7,data:{}},2),error=>error.code==='23514');
 await assert.rejects(save({app:'mm-ticket-tracker',version:7,data:null},2),error=>error.code==='23514');
 await signIn(other);
 assert.equal((await db.query('select * from public.mm_tracker_documents')).rows.length,0);
 assert.equal((await db.query('update public.mm_tracker_documents set revision=99 where user_id=$1 returning *',[owner])).rows.length,0);
 assert.equal((await save(document(8),0)).rows[0].revision,1);
 await signIn(owner);
 assert.equal((await db.query('select document from public.mm_tracker_documents')).rows[0].document.data.projects[0].mmAreas[0].visible,false);
 await db.exec('reset role;set role anon;');
 await assert.rejects(db.query('select * from public.mm_tracker_documents'),error=>error.code==='42501');
 await assert.rejects(save(document(8),0),error=>error.code==='42501');
});
