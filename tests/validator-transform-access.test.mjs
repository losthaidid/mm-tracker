import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
test('Preparation buttons and preview forms require Run permission independently of template edits',async t=>{
 const dom=new JSDOM('<section data-access-feature="validator"><form id="valPreparationForm"><button type="button" data-val="prep-apply">Apply to working data</button></form></section>',{runScripts:'outside-only'}),w=dom.window,d=w.document;t.after(()=>w.close());
 for(const file of ['access-catalog.js','access-control.js'])w.eval(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
 const permissions=w.WorkHubAccessCatalog.preset('view');permissions.validator={mode:'use',run:true,edit:false,create:false,delete:false,export:true};let profile={userId:'test-user',role:'member',status:'active',version:1,permissions};
 const cloud={ready:true,user:{id:'test-user'},client:{rpc:async()=>({data:profile,error:null})}},messages=[];
 const access=w.WorkHubAccess.install({cloud:()=>cloud,feature:()=> 'validator',hidden:()=>[],tell:text=>messages.push(text)});await access.load(cloud.user);
 let clicks=0,submits=0;const button=d.querySelector('button'),form=d.querySelector('form');button.addEventListener('click',()=>clicks++);form.addEventListener('submit',event=>{event.preventDefault();submits++;});
 button.click();form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(clicks,1);assert.equal(submits,1);assert.equal(access.can('validator','edit'),false);
 profile={...profile,version:2,permissions:w.WorkHubAccessCatalog.preset('view')};await access.load(cloud.user);button.click();form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(clicks,1);assert.equal(submits,1);assert.equal(messages.length,2);
});
