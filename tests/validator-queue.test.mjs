import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const read = f => readFileSync(new URL('../'+f,import.meta.url),'utf8');
const plain = v => JSON.parse(JSON.stringify(v));
const file = (name,text) => ({name,size:new TextEncoder().encode(text).length,text:async()=>text});
async function fixture(t, runner) {
 const dom=new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>',{url:'https://example.test',runScripts:'outside-only',pretendToBeVisual:true});
 const w=dom.window,d=w.document;t.after(()=>w.close());Object.assign(w,{Blob,TextEncoder,TextDecoder,setImmediate,clearImmediate});w.confirm=()=>true;
 const nativeTimer=w.setTimeout.bind(w);w.setTimeout=(fn,ms)=>ms===50?(queueMicrotask(fn),0):nativeTimer(fn,ms);
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};
 for(const f of ['vendor/jszip.min.js','validator-engine.js','validator-transform.js','validator-files.js'])w.eval(read(f));
 if(runner)w.WorkHubValidatorRunner={create:()=>runner};w.eval(read('validator-studio.js'));
 const E=w.WorkHubValidatorEngine,F=w.WorkHubValidatorFiles,schema=E.create('Queue test');schema.projectId='project';schema.projectName='Rollout';
 schema.columns=['ID','Plant','Storage'].map((key,i)=>({...E.column(i),key,label:key,required:true}));
 schema.rules=['alpha','beta'].map((id,i)=>({...E.rule('Plant'),companyScope:'selected',companies:[{id,name:id}],assertion:{...E.condition('Plant'),operator:'in',value:i?'B1':'A1,A2'}}));
 let owner='owner',ready=true,state={projects:[{id:'project',name:'Rollout'}],projectCompanies:['alpha','beta'].map(id=>({id,name:id,projectId:'project',active:true})),workhub:{validator:{templates:[schema],runs:[]}}},ui;
 const downloads=[];const render=()=>{if(!ui.patchRender())d.getElementById('view').innerHTML=ui.render();};
 ui=w.WorkHubValidatorStudio.install({state:()=>state,ready:()=>ready,owner:()=>owner,render,tell:()=>{},mutate(fn){const next=E.copy(state);fn(next);E.prepare(next,state);E.validateState(next);state=next;render();return true;},download(blob,name){downloads.push({blob,name});},openModal(title,body){d.getElementById('modalBody').innerHTML=body;d.getElementById('modal').showModal();},closeModal(){d.getElementById('modal').close();}});render();
 const change=(el,value)=>{el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));};
 return {w,d,E,F,ui,downloads,state:()=>state,company:id=>change(d.querySelector('[name="validationCompany"]'),id),change,signOut(){owner='other';ready=false;ui.sync();}};
}
const one=file('one.csv','ID,Plant,Storage,Extra\n00001,"A1,A2","S1,S2",PRIVATE-ONE');
const two=file('two.csv','Extra,Storage,ID,Plant\nPRIVATE-TWO,T1,00001,B1');

test('queue isolates company, mapping, exploded parents, corrections and complete reports per file',async t=>{
 const x=await fixture(t),{ui,d,w}=x;await ui.addQueueFiles([one,two]);let jobs=ui.snapshot().queue;
 assert.equal(ui.snapshot().runCompanyId,'');assert.throws(()=>ui.confirmQueueJob(),/company/i);x.company('alpha');
 ui.openPreparation('explode');let form=d.getElementById('valPreparationForm');x.change(form.elements.primary,'1');form.querySelector('[name="mapped"][value="2"]').checked=true;
 form.dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));ui.applyPreparation();ui.confirmQueueJob();
 await ui.openQueueJob(jobs[1].id);assert.equal(ui.snapshot().runCompanyId,'');x.company('beta');ui.confirmQueueJob();await ui.startQueue();
 let snapshot=ui.snapshot();assert.deepEqual(plain(snapshot.queue.map(j=>j.status)),['completed','completed']);assert.equal(snapshot.result.context.companyId,'beta');assert.equal(snapshot.result.rows,1);assert.equal(snapshot.result.errors,0);
 await ui.openQueueJob(jobs[0].id);snapshot=ui.snapshot();assert.equal(snapshot.runCompanyId,'alpha');assert.equal(snapshot.result.rows,2);assert.deepEqual(plain(snapshot.sourceRows),[['00001','A1','S1','PRIVATE-ONE'],['00001','A2','S2','PRIVATE-ONE']]);assert.deepEqual(plain(snapshot.origins),[{row:2,part:'1'},{row:2,part:'2'}]);
 const cell=d.querySelector('[data-cell="0"][data-field="ID"]');cell.value='00002';cell.dispatchEvent(new w.Event('change',{bubbles:true}));
 await ui.openQueueJob(jobs[1].id);assert.equal(ui.snapshot().mapping.ID,2);assert.equal(ui.snapshot().rows[0].ID,'00001');await ui.openQueueJob(jobs[0].id);assert.equal(ui.snapshot().rows[0].ID,'00002');assert.equal(ui.snapshot().originalRows[0][0],'00001');
 await ui.handle({dataset:{val:'filter',filter:'errors'}});await ui.exportQueue();assert.equal(x.downloads.length,1);assert.match(x.downloads[0].name,/queue.zip$/);
 const archive=await w.JSZip.loadAsync(new w.Uint8Array(await x.downloads[0].blob.arrayBuffer()),{checkCRC32:true});const reports=Object.keys(archive.files).filter(n=>n.endsWith('.xlsx'));assert.equal(reports.length,3);
 for(const [i,label]of [[1,'ONE'],[2,'TWO']]){const name=reports.find(n=>n.startsWith('0'+i+'-'));const bytes=await archive.file(name).async('uint8array');const report=await w.JSZip.loadAsync(bytes,{checkCRC32:true});const text=(await Promise.all(Object.values(report.files).filter(f=>f.name.startsWith('xl/worksheets/')).map(f=>f.async('string')))).join('');assert.ok(text.includes('PRIVATE-'+label));assert.equal(text.includes('PRIVATE-'+(i===1?'TWO':'ONE')),false);}
 assert.equal(JSON.stringify(x.state()).includes('PRIVATE-'),false);x.signOut();assert.equal(ui.snapshot().queue.length,0);assert.equal(ui.snapshot().result,null);
});

test('queue setup changes require confirmation, respects permissions and prevents replacement uploads',async t=>{
 const x=await fixture(t),{ui,w}=x;await ui.addQueueFiles([one]);x.company('alpha');ui.confirmQueueJob();assert.equal(ui.snapshot().queue[0].status,'ready');x.company('beta');assert.equal(ui.snapshot().queue[0].status,'needs-review');await assert.rejects(ui.startQueue(),/confirm every file/i);
 await assert.rejects(ui.loadFile(two),/Use Add files/);w.WorkHubCurrentAccess={can:()=>false};await assert.rejects(ui.exportQueue(),/cannot export/);await assert.rejects(ui.addQueueFiles([two]),/cannot run/);
});

test('late file reads cannot restore queue data after an account change',async t=>{
 const x=await fixture(t);let release;const delayed={name:'slow.csv',size:80,text:()=>new Promise(resolve=>release=resolve)};const pending=x.ui.addQueueFiles([delayed]);
 while(!release)await new Promise(resolve=>setImmediate(resolve));x.signOut();release('ID,Plant,Storage\nSECRET,A1,S1');await assert.rejects(pending,{name:'AbortError'});assert.equal(x.ui.snapshot().queue.length,0);assert.deepEqual(plain(x.ui.snapshot().rows),[]);
});

test('stopping a queue cancels the running file and retains its confirmed setup',async t=>{
 let rejectRun,started=false;const runner={run:()=>{started=true;return new Promise((resolve,reject)=>rejectRun=reject);},cancel(){if(rejectRun){const error=Error('cancelled');error.name='AbortError';rejectRun(error);rejectRun=null;}}};
 const x=await fixture(t,runner);await x.ui.addQueueFiles([two]);x.company('beta');x.ui.confirmQueueJob();const pending=x.ui.startQueue();while(!started)await new Promise(resolve=>setImmediate(resolve));await assert.rejects(x.ui.handle({dataset:{val:'sample'}}),/queue operation/);x.ui.cancelQueue();await pending;assert.equal(x.ui.snapshot().queueBusy,false);assert.equal(x.ui.snapshot().queue[0].status,'ready');assert.equal(x.ui.snapshot().result,null);
});

test('large live edits stay pending until their worker finishes and cannot reopen stale results',async t=>{
 let x,mode='normal',pending=[];const runner={run(template,rows,context){const checked=x.E.validateRows(template,rows,context);if(mode==='normal')return Promise.resolve(checked);return new Promise(resolve=>pending.push(()=>resolve(checked)));},cancel(){}};
 x=await fixture(t,runner);const many=file('many.csv','ID,Plant,Storage\n'+Array.from({length:7000},(_,i)=>i+',B1,S1').join('\n'));await x.ui.addQueueFiles([many,two]);const jobs=x.ui.snapshot().queue;x.company('beta');x.ui.confirmQueueJob();await x.ui.openQueueJob(jobs[1].id);x.company('beta');x.ui.confirmQueueJob();await x.ui.startQueue();await x.ui.openQueueJob(jobs[0].id);
 mode='defer';const cell=x.d.querySelector('[data-cell="0"][data-field="Plant"]');cell.value='wrong';cell.dispatchEvent(new x.w.Event('change',{bubbles:true}));assert.equal(x.ui.snapshot().livePending,true);assert.equal(x.d.querySelector('[data-val="report"]').disabled,true);
 cell.value='B1';cell.dispatchEvent(new x.w.Event('change',{bubbles:true}));assert.equal(pending.length,2);pending[0]();await new Promise(resolve=>setImmediate(resolve));assert.equal(x.ui.snapshot().livePending,true);
 const opening=x.ui.openQueueJob(jobs[1].id);pending[1]();await opening;assert.equal(x.ui.snapshot().result.rows,1);assert.equal(x.ui.snapshot().result.errors,0);await x.ui.openQueueJob(jobs[0].id);assert.equal(x.ui.snapshot().result.rows,7000);assert.equal(x.ui.snapshot().result.errors,0);assert.equal(x.ui.snapshot().rows[0].Plant,'B1');
});

test('a validation failure leaves other files isolated and lets the remaining ready files finish',async t=>{
 let x;const runner={run(template,rows,context){if(context.companyId==='alpha')return Promise.reject(Error('Synthetic worker failure'));return Promise.resolve(x.E.validateRows(template,rows,context));},cancel(){}};
 x=await fixture(t,runner);await x.ui.addQueueFiles([one,two]);const jobs=x.ui.snapshot().queue;x.company('alpha');x.ui.confirmQueueJob();await x.ui.openQueueJob(jobs[1].id);x.company('beta');x.ui.confirmQueueJob();await x.ui.startQueue();assert.deepEqual(plain(x.ui.snapshot().queue.map(j=>j.status)),['failed','completed']);assert.equal(x.ui.snapshot().result.context.companyId,'beta');assert.equal(x.ui.snapshot().result.rows,1);
});
