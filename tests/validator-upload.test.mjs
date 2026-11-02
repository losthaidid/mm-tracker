import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const copy=v=>JSON.parse(JSON.stringify(v));
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function fixture(t){
 const dom=new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;t.after(()=>w.close());
 Object.assign(w,{Blob,TextEncoder,TextDecoder,setImmediate,clearImmediate});w.confirm=()=>true;w.setTimeout=(fn,ms)=>{if(ms===50)queueMicrotask(fn);return 0};w.clearTimeout=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 for(const f of ['vendor/jszip.min.js','validator-engine.js','validator-files.js','validator-studio.js'])w.eval(readFileSync(new URL('../'+f,import.meta.url),'utf8'));
 const E=w.WorkHubValidatorEngine,F=w.WorkHubValidatorFiles,s=E.create('Original file upload');s.columns=['Material','Description','Last'].map((label,i)=>({...E.column(i),key:['MAT','DESC','LAST'][i],label,type:'text'}));
 let state={projects:[],projectCompanies:[],workhub:{validator:{templates:[s],runs:[]}}},owner='owner',ui,writes=0;const messages=[];
 const render=()=>{if(!ui.patchRender())d.getElementById('view').innerHTML=ui.render()};ui=w.WorkHubValidatorStudio.install({state:()=>state,owner:()=>owner,ready:()=>true,render,tell:(text,error)=>messages.push({text,error}),mutate(fn){const next=E.copy(state);fn(next);E.prepare(next,state);E.validateState(next);state=next;writes++;render();return true}});render();
 const csv=(name,text)=>({name,size:text.length,text:async()=>text}),xlsx=async(rows,name='original.xlsx')=>{const blob=await F.workbook([{name:'Original',rows}]);return{name,size:blob.size,arrayBuffer:()=>blob.arrayBuffer()}};
 const change=(name,value)=>{const el=d.querySelector(`[name="${name}"]`);assert.ok(el);el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}))};
 return{w,d,E,F,ui,csv,xlsx,change,messages,writes:()=>writes,account(next){owner=next;ui.sync();render()}};
}

test('Excel introduction gaps do not crash upload and selecting row 4 preserves all 200 source positions and literal values',async t=>{
 const x=fixture(t),intro=[];intro[15]='Instructions';const headers=Array.from({length:200},(_,i)=>i===15?'Material':i===16?'Description':i===199?'Last':'Field '+i),data=headers.map((_,i)=>i===15?'000001':i===16?'Water Pump':i===199?'final literal':'value '+i);
 await x.ui.loadFile(await x.xlsx([intro,[],[],headers,data]));assert.equal(x.d.querySelector('.val-scanning'),null);
 const select=x.d.querySelector('[data-map="MAT"]');assert.equal(select.options[1].textContent,'A · (blank header)');assert.equal(select.options[16].textContent,'P · Instructions');
 x.change('headerRow','4');const snap=x.ui.snapshot();assert.deepEqual(copy(snap.mapping),{MAT:15,DESC:16,LAST:199});assert.deepEqual(copy(snap.sourceRows),[data]);assert.deepEqual(copy(snap.originalRows),[data]);assert.equal(snap.origins[0].row,5);assert.equal(x.writes(),0);assert.doesNotMatch(x.d.body.textContent,/undefined is not iterable/);
});

test('a failed read dismisses progress, shows the error, preserves the previous session and allows retry',async t=>{
 const x=fixture(t);await x.ui.loadFile(x.csv('good.csv','Material,Description,Last\n000001,Pump,unchanged'));await x.ui.run();const before=x.ui.snapshot(),wait=defer();
 const pending=x.ui.loadFile({name:'broken.csv',size:30,text:()=>wait.promise});assert.ok(x.d.querySelector('.val-scanning'));wait.reject(Error('The file could not be read.'));await assert.rejects(pending,/could not be read/);
 assert.equal(x.d.querySelector('.val-scanning'),null);assert.match(x.d.querySelector('.val-message').textContent,/Could not load broken.csv/);assert.doesNotMatch(x.d.querySelector('.val-message').textContent,/Reading/);assert.deepEqual(copy(x.ui.snapshot().sourceRows),copy(before.sourceRows));assert.deepEqual(copy(x.ui.snapshot().result),copy(before.result));
 await x.ui.loadFile(x.csv('broken.csv','Material,Description,Last\n000002,Retried,complete'));assert.equal(x.d.querySelector('.val-scanning'),null);assert.equal(x.ui.snapshot().sourceRows[0][0],'000002');assert.equal(x.ui.snapshot().result,null);
});

test('an empty initial header clears old results and leaves worksheet controls available for recovery',async t=>{
 const x=fixture(t);await x.ui.loadFile(x.csv('old.csv','Material,Description,Last\n000001,Old,old'));await x.ui.run();
 const file=await x.xlsx([[],[],[],['Material','Description','Last'],['000002','New','=literal()']]);await assert.rejects(x.ui.loadFile(file),/selected header row is empty/);
 assert.equal(x.d.querySelector('.val-scanning'),null);assert.equal(x.ui.snapshot().result,null);assert.deepEqual(copy(x.ui.snapshot().originalRows),[]);assert.ok(x.d.querySelector('[name="sheet"]'));x.change('headerRow','4');assert.deepEqual(copy(x.ui.snapshot().sourceRows),[['000002','New','=literal()']]);assert.equal(x.ui.snapshot().origins[0].row,5);
});

test('a stale upload failure cannot stop a newer read or replace its status and source records',async t=>{
 const x=fixture(t);await x.ui.loadFile(x.csv('initial.csv','Material,Description,Last\n000001,Initial,initial'));
 const first=defer(),second=defer(),p1=x.ui.loadFile({name:'old.csv',size:20,text:()=>first.promise}),p2=x.ui.loadFile({name:'current.csv',size:20,text:()=>second.promise});
 first.reject(Error('Old upload failed'));await p1;assert.ok(x.d.querySelector('.val-scanning'));assert.match(x.d.querySelector('.val-scanning').textContent,/Reading current.csv/);assert.ok(!x.messages.some(m=>m.text.includes('Old upload failed')));
 second.resolve('Material,Description,Last\n000002,Current,current');await p2;assert.equal(x.d.querySelector('.val-scanning'),null);assert.equal(x.ui.snapshot().sourceRows[0][0],'000002');
});

test('late upload failures are discarded after an account change',async t=>{
 const x=fixture(t),wait=defer(),pending=x.ui.loadFile({name:'private.csv',size:20,text:()=>wait.promise});x.account('other');const count=x.messages.length;wait.reject(Error('PRIVATE ERROR'));await pending;
 assert.equal(x.messages.length,count);assert.deepEqual(copy(x.ui.snapshot().sourceRows),[]);assert.equal(x.d.querySelector('.val-scanning'),null);assert.doesNotMatch(x.d.body.textContent,/PRIVATE ERROR/);
});
