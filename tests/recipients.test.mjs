import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {test} from 'node:test';
const window={};runInNewContext(readFileSync(new URL('../recipients-engine.js',import.meta.url),'utf8'),{window});
const E=window.WorkHubRecipientsEngine,copy=x=>JSON.parse(JSON.stringify(x));
const contact=(id,email,role='to',enabled=true)=>({id,name:'',email,role,enabled});
const company=()=>({id:'acme',name:'Acme',notes:'Project team',contacts:[]});
const state=c=>({workhub:{recipients:{version:1,companies:c||[company()]}}});

test('recipients: email validation accepts common company addresses and rejects malformed or injected values',()=>{
 for(const value of ['Name@example.com','first.last+project@example.co.uk',"o’connor@example.com".replace('’',"'"),'team_1@sub.example.com','a@xn--bcher-kva.de'])assert.equal(E.email(value),true,value);
 for(const value of ['',null,'missing-at.example.com','name@example','a..b@example.com','.a@example.com','a.@example.com','a@-example.com','a@example-.com','a@ex..com','a@example.123','a@example.com\r\nBcc: other@example.com','<a@example.com>',' a@example.com','a@'+('x'.repeat(64))+'.com','x'.repeat(65)+'@example.com'])assert.equal(E.email(value),false,String(value));
});

test('recipients: old documents gain an empty directory without losing records; malformed directories are rejected',()=>{
 const d={workhub:{notes:[{title:'Keep this'}]}};E.upgrade(d);assert.deepEqual(copy(d.workhub.recipients),{version:1,companies:[]});E.validate(d);E.upgrade(d);assert.equal(d.workhub.notes[0].title,'Keep this');
 for(const value of [null,[],{version:2,companies:[]},{version:1,companies:{}}])assert.throws(()=>E.validate({workhub:{recipients:value}}),/directory/);
});

test('recipients: company names and addresses must be unique within their scope',()=>{
 const a=company(),b={...company(),id:'b',name:'Another company'};a.contacts.push(contact('1','Team@example.com'));b.contacts.push(contact('2','team@example.com'));E.validate(state([a,b]));
 b.name='  ＡＣＭＥ  ';assert.throws(()=>E.validate(state([a,b])),/company name already/);b.name='Another company';b.id=a.id;assert.throws(()=>E.validate(state([a,b])),/IDs must/);
 a.contacts.push(contact('2','TEAM@EXAMPLE.COM','bcc',false));assert.throws(()=>E.validate(state([a])),/already exists/);
 a.contacts.pop();a.contacts.push(contact('1','different@example.com'));assert.throws(()=>E.validate(state([a])),/Check each/);
});

test('recipients: bulk entry handles names, quoted commas and mixed separators, with atomic validation',()=>{
 assert.deepEqual(copy(E.parseList('Alex <alex@example.com>; "Doe, Jo" <jo@example.com>\nteam@example.com, "A \\"Team\\"" <a@example.com>')), [{name:'Alex',email:'alex@example.com'},{name:'Doe, Jo',email:'jo@example.com'},{name:'',email:'team@example.com'},{name:'A "Team"',email:'a@example.com'}]);
 for(const value of ['good@example.com; invalid','Name <name@example.com','"Doe, Jo <jo@example.com>','Name <bad@@example.com>','a@example.com\nBad <b@example.com> trailing','Name <<b@example.com>>','Name <a@example.com> <b@example.com>','name@example.com>'])assert.throws(()=>E.parseList(value),/Check|Close/);
 assert.throws(()=>E.parseList(''),/between 1 and 500/);assert.throws(()=>E.parseList(Array.from({length:501},(_,i)=>i+'@example.com').join(';')),/between 1 and 500/);
});

test('recipients: bulk duplicates are skipped without changing saved groups, names or exclusion',()=>{
 const c=company();c.contacts.push({...contact('existing','team@example.com','bcc',false),name:'Keep me'});let id=0;
 const result=E.addition(c,'TEAM@example.com; Alex <alex@example.com>; alex@EXAMPLE.com','cc',()=>String(++id));assert.equal(result.skipped,2);assert.deepEqual(copy(result.contacts),[{id:'1',name:'Alex',email:'alex@example.com',role:'cc',enabled:true}]);assert.equal(c.contacts.length,1);assert.equal(c.contacts[0].enabled,false);assert.equal(c.contacts[0].role,'bcc');
 assert.throws(()=>E.addition(c,'new@example.com; not-an-email','to',()=>String(++id)),/entry 2/);assert.equal(c.contacts.length,1);
});

test('recipients: copies contain enabled addresses in To/Cc/Bcc order, with the chosen separator',()=>{
 const c=company();c.contacts=[contact('1','private@example.com','bcc'),contact('2','excluded@example.com','to',false),contact('3','owner@example.com'),contact('4','copy@example.com','cc')];
 assert.equal(E.copyText(c),'owner@example.com; copy@example.com; private@example.com');assert.equal(E.copyText(c,'all','comma'),'owner@example.com, copy@example.com, private@example.com');assert.equal(E.copyText(c,'all','lines'),'owner@example.com\ncopy@example.com\nprivate@example.com');assert.equal(E.copyText(c,'cc'),'copy@example.com');assert.equal(E.copyText({...c,contacts:[]}), '');
 assert.throws(()=>E.copyText(c,'other'),/group/);assert.throws(()=>E.copyText(c,'all','other'),/separator/);
});

test('recipients: limits and invalid record fields are checked before account saves or restore',()=>{
 for(const change of [c=>c.name='',c=>c.notes='x'.repeat(2001),c=>c.contacts=[{...contact('x','a@example.com'),role:'other'}],c=>c.contacts=[{...contact('x','a@example.com'),enabled:'yes'}],c=>c.contacts=[{...contact('x','a@example.com'),name:'A\nB'}]]){const c=company();change(c);assert.throws(()=>E.validate(state([c])));}
 const c=company();c.contacts=Array.from({length:500},(_,i)=>contact(String(i),i+'@example.com'));E.validate(state([c]));assert.throws(()=>E.addition(c,'one-more@example.com','to',()=> 'new'),/up to 500/);
 const all=Array.from({length:11},(_,i)=>({...copy(c),id:'c'+i,name:'Company '+i}));assert.throws(()=>E.validate(state(all)),/5,000/);
 assert.throws(()=>E.validate(state(Array.from({length:201},(_,i)=>({...company(),id:'c'+i,name:'Company '+i})))),/200 companies/);
});
