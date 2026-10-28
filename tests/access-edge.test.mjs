import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {transform} from 'esbuild';
const source=readFileSync(new URL('../supabase/functions/workhub-admin/index.ts',import.meta.url),'utf8').replace(/^import .*?;\n/,'');
const {code}=await transform(source,{loader:'ts',format:'iife',target:'es2022'});
function fixture(){
 let handler;const calls=[];const createClient=(url,key,options)=>{
  const member=options.global?.headers?.Authorization==='Bearer member';
  return{auth:{getUser:async token=>({data:{user:token==='invalid'?null:{id:'owner-id',email:'owner@example.test',user_metadata:{role:'owner'}}},error:token==='invalid'?{message:'Invalid token'}:null}),signInWithPassword:async p=>({data:p.password==='correct-password'?{user:{id:'owner-id'},session:{access_token:'proof'}}:{},error:p.password==='correct-password'?null:{message:'Invalid'}}),admin:{signOut:async()=>{calls.push('proof-signout');return{error:null};},deleteUser:async()=>{calls.push('delete-auth');return{error:null};},updateUserById:async()=>({error:null}),inviteUserByEmail:async()=>{calls.push('invite');return{error:null};}}},rpc:async(name,p)=>{
   if(name==='workhub_my_access')return{data:{role:member?'member':'owner',status:'active'}};
   calls.push(p.p_action);return{data:{email:'member@example.test',id:'target',status:'approved'},error:null};
  }};
 };
 new Function('Deno','createClient','Request','Response','TextDecoder',code)({env:{get:k=>k==='SUPABASE_URL'?'https://example.test':'server-only-secret'},serve:fn=>handler=fn},createClient,Request,Response,TextDecoder);
 const request=(body,token='owner',origin='https://losthaidid.github.io')=>handler(new Request('https://example.test/admin',{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),Origin:origin},body:JSON.stringify(body)}));
 return{calls,request};
}
test('Owner gateway rejects missing and invalid authentication and ignores self-declared admin metadata',async()=>{
 const f=fixture();assert.equal((await f.request({action:'list'},'')).status,401);assert.equal((await f.request({action:'list'},'invalid')).status,401);assert.equal((await f.request({action:'list'},'member')).status,403);assert.equal(f.calls.length,0);
});
test('Owner gateway verifies the Owner password before blocking and deleting a fictional account',async()=>{
 const f=fixture();assert.equal((await f.request({action:'delete',target:'target',password:'wrong-password'})).status,403);assert.equal(f.calls.length,0);
 const result=await f.request({action:'delete',target:'target',password:'correct-password',payload:{email:'member@example.test',version:1,revision:2}});assert.equal(result.status,200);assert.deepEqual(f.calls,['proof-signout','begin-delete','delete-auth']);assert.doesNotMatch(await result.text(),/correct-password|server-only-secret/);
});
test('Owner gateway bounds payloads, rejects other origins and approves before sending invitations',async()=>{
 const f=fixture();assert.equal((await f.request({action:'list',padding:'x'.repeat(41000)})).status,413);assert.equal((await f.request({action:'list'},'owner','https://untrusted.test')).status,403);
 assert.equal((await f.request({action:'approve',target:'target',payload:{permissions:{}}})).status,200);assert.deepEqual(f.calls,['approve','invite']);
});
