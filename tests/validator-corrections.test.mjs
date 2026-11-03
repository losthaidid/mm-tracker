import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8'),copy=v=>JSON.parse(JSON.stringify(v));
const action=(ui,val,extra={})=>ui.handle({dataset:{val,...extra}});
function engine(t){
 const dom=new JSDOM('',{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;t.after(()=>w.close());
 Object.assign(w,{Blob,TextEncoder,TextDecoder,setImmediate,clearImmediate});for(const f of ['validator-engine.js','validator-transform.js','validator-corrections.js'])w.eval(read(f));
 return{w,E:w.WorkHubValidatorEngine,C:w.WorkHubValidatorCorrections};
}
function template(E){
 const s=E.create('Bulk material review');s.columns=[['MATNR','Material'],['DESCRIPTION','Description'],['PLANT','Plant'],['STORAGE','Storage Location'],['FLAG','Flag'],['CHOICE','Choice']].map(([key,label],i)=>({...E.column(i),key,label,required:key==='DESCRIPTION',unique:key==='MATNR',values:key==='FLAG'?'X':key==='CHOICE'?'A,B':''}));
 s.columns[4].required=true;s.lookups=[{id:'sloc',name:'Plant/storage reference',headers:['Plant','Sloc'],rows:[['P1','S1'],['P2','S2'],['P2','S3']]}];
 const rule=E.rule('STORAGE');rule.name='Storage belongs to Plant';rule.when={join:'all',conditions:[],groups:[]};rule.assertion={...E.condition('STORAGE'),operator:'lookupTuple',lookupId:'sloc',pairs:[{field:'PLANT',referenceColumn:'Plant'},{field:'STORAGE',referenceColumn:'Sloc'}]};s.rules=[rule];return s;
}
const row=(id='000001',plant='P1')=>({MATNR:id,DESCRIPTION:'Pump '+id,PLANT:plant,STORAGE:'BAD',FLAG:'',CHOICE:'BAD'});
const args=(s,rows,extra={})=>({schema:s,rows,mapping:Object.fromEntries(s.columns.map((c,i)=>[c.key,i])),...extra});
const entries=(p,s)=>Array.from(p.indices,(index,n)=>({index,field:s.columns[p.columns[n]].key,code:p.codes[n],value:p.texts[p.values[n]],count:p.counts[n]}));

test('whole-file plans distinguish unique contextual fixes, ambiguous references and unknown descriptions without mutating input',async t=>{
 const x=engine(t),s=template(x.E),rows=[{...row(),DESCRIPTION:''},row('6.00007','P2')],before=copy(rows),p=await x.C.scan(args(s,rows)),items=entries(p,s);
 assert.equal(p.total,7);assert.equal(p.clear,3);assert.equal(items.find(i=>i.index===0&&i.field==='STORAGE').value,'S1');assert.equal(items.find(i=>i.index===1&&i.field==='STORAGE').code,1);assert.equal(items.find(i=>i.field==='DESCRIPTION').code,2);assert.ok(items.filter(i=>i.field==='CHOICE').every(i=>i.code===1));assert.deepEqual(rows,before);assert.equal(p.clearIndices.length,3);
});

test('a scan reaches error fields after the normal issue-list cap and retains their final source index',async t=>{
 const x=engine(t),s=x.E.create('Beyond issue limit');s.columns=[{...x.E.column(),key:'FLAG',label:'Flag',required:true,values:'X'}];const rows=Array.from({length:16002},()=>({FLAG:''})),normal=x.E.validateRows(s,rows),p=await x.C.scan(args(s,rows));
 assert.equal(normal.issues.length,15000);assert.equal(normal.errors,16002);assert.equal(p.clear,16002);assert.equal(p.indices.at(-1),16001);assert.equal(p.texts[p.values.at(-1)],'X');assert.equal(rows.at(-1).FLAG,'');
});

test('configured SAP formatting is preferred without rounding identifiers or inventing numeric values',async t=>{
 const x=engine(t),s=x.E.create('SAP fixes');s.mode='sap';s.columns=[{...x.E.column(),key:'MATNR',label:'Material',sapType:'CHAR',sapLength:20},{...x.E.column(1),key:'AVAIL',label:'Availability',sapType:'NUMC',sapLength:2,values:'02,03'},{...x.E.column(2),key:'DATE',label:'Date',sapType:'DATS',sapLength:8}];
 const rows=[{MATNR:'6.00007',AVAIL:'2',DATE:'2026-11-03'},{MATNR:'000001',AVAIL:'2e2',DATE:'2026-02-30'}],p=await x.C.scan(args(s,rows)),items=entries(p,s);
 assert.equal(items.find(i=>i.index===0&&i.field==='AVAIL').value,'02');assert.equal(items.find(i=>i.index===0&&i.field==='DATE').value,'20261103');assert.ok(!items.some(i=>i.field==='MATNR'));assert.notEqual(items.find(i=>i.index===1&&i.field==='DATE').code,0);assert.equal(rows[0].MATNR,'6.00007');
});

test('explicit fixed conditions supply clear fixes while combined changes cannot introduce another row issue',async t=>{
 const x=engine(t),s=x.E.create('Condition fixes');s.columns=['FLAG','OWNER'].map((key,i)=>({...x.E.column(i),key,label:key}));
 const fixed=x.E.rule('FLAG');fixed.when={join:'all',conditions:[],groups:[]};fixed.assertion={...x.E.condition('FLAG'),operator:'eq',value:'X'};
 const required=x.E.rule('OWNER');required.when={join:'all',conditions:[{...x.E.condition('FLAG'),operator:'eq',value:'X'}],groups:[]};required.assertion={...x.E.condition('OWNER'),operator:'notEmpty'};s.rules=[fixed,required];
 let p=await x.C.scan(args(s,[{FLAG:'bad',OWNER:''}]));assert.equal(p.clear,0);assert.equal(p.codes[0],4);
 p=await x.C.scan(args(s,[{FLAG:'bad',OWNER:'Mira'}]));assert.equal(p.clear,1);assert.equal(p.texts[p.values[0]],'X');
});

test('duplicate identifiers and members of unique combinations remain for review, including SAP bigint keys',async t=>{
 const x=engine(t),s=x.E.create('Unique SAP values');s.mode='sap';s.columns=[{...x.E.column(),key:'ID',label:'ID',sapType:'INT8',sapLength:19,unique:true},{...x.E.column(1),key:'FLAG',label:'Flag',sapType:'CHAR',sapLength:1,values:'X',required:true}];
 const p=await x.C.scan(args(s,[{ID:'9223372036854775807',FLAG:''},{ID:'9223372036854775807',FLAG:''}]));assert.equal(p.errors,4);assert.equal(p.clear,2);assert.equal(p.codes[0],3);assert.equal(p.codes[2],3);
});

test('ignored errors are excluded by their complete issue identity, and cancelled scans produce no changes',async t=>{
 const x=engine(t),s=x.E.create('Ignored checks');s.columns=[{...x.E.column(),key:'FLAG',label:'Flag',values:'X',required:true}];const rows=Array.from({length:70},()=>({FLAG:''})),raw=x.E.validateRows(s,rows),ignored=[x.E.issueKey(raw.issues.at(-1))],p=await x.C.scan(args(s,rows,{ignored}));assert.equal(p.clear,69);assert.equal(p.indices.at(-1),68);
 let stopped=false;await assert.rejects(x.C.scan(args(s,rows),{pause:async()=>{stopped=true},cancelled:()=>stopped}),{name:'AbortError'});assert.ok(rows.every(r=>r.FLAG===''));
});

async function workspace(t,{count=2,configure=()=>{}}={}){
 const dom=new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test'}),w=dom.window,d=w.document;t.after(()=>w.close());Object.assign(w,{Blob,TextEncoder,TextDecoder,setImmediate,clearImmediate});w.confirm=()=>true;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 let held=false,pending=[];w.setTimeout=(fn,ms)=>{if(ms===50)queueMicrotask(fn);else if(held)pending.push(fn);else setImmediate(fn);return 0};w.clearTimeout=()=>{};
 for(const f of ['vendor/jszip.min.js','validator-engine.js','validator-transform.js','validator-files.js','validator-corrections.js','validator-studio.js'])w.eval(read(f));const E=w.WorkHubValidatorEngine,F=w.WorkHubValidatorFiles,s=template(E),values=Array.from({length:count},(_,i)=>row('000'+i,i%2?'P2':'P1')),headers=s.columns.map(c=>c.label);let state={projects:[],projectCompanies:[],workhub:{validator:{templates:[s],runs:[]}}},owner='owner',ui,writes=0;const downloads=[];
 configure(s,E);const render=()=>{if(!ui.patchRender())d.getElementById('view').innerHTML=ui.render()};ui=w.WorkHubValidatorStudio.install({state:()=>state,owner:()=>owner,ready:()=>true,render,tell:()=>{},mutate(fn){const next=E.copy(state);fn(next);E.prepare(next,state);E.validateState(next);state=next;writes++;render();return true},download(blob,name){downloads.push({blob,name})},openModal(title,body){d.getElementById('modalBody').innerHTML=body;d.getElementById('modal').showModal()},closeModal(){d.getElementById('modal').close()}});render();const upload=async(v=values)=>{const csv=E.csv([headers,...v.map(r=>s.columns.map(c=>r[c.key]))]);await ui.loadFile({name:'materials.csv',size:csv.length,text:async()=>csv})};await upload();await ui.run();
 return{w,d,E,F,ui,s,upload,downloads,values,state:()=>state,writes:()=>writes,hold(value){held=value;if(!value){for(const fn of pending)queueMicrotask(fn);pending=[]}},account(value){owner=value;ui.sync();render()},edit(index,field,value){const input=d.querySelector(`[data-cell="${index}"][data-field="${field}"]`);input.value=value;input.dispatchEvent(new w.Event('change',{bubbles:true}))}};
}

test('review/apply/undo revalidate all rows, preserve material descriptions and source data, and keep issue exports to two sheets',async t=>{
 const x=await workspace(t),before=x.ui.snapshot(),writes=x.writes();await action(x.ui,'prep-fixes-scan');assert.equal(x.ui.snapshot().bulkCorrections.plan.clear,3);assert.deepEqual(copy(x.ui.snapshot().sourceRows),copy(before.sourceRows));assert.match(x.d.getElementById('valBulkFixes').textContent,/Needs review/);
 await action(x.ui,'prep-fixes-apply');const applied=x.ui.snapshot();assert.equal(applied.sourceRows[0][3],'S1');assert.equal(applied.sourceRows[0][4],'X');assert.equal(applied.sourceRows[1][3],'BAD');assert.equal(applied.sourceRows[1][4],'X');assert.deepEqual(copy(applied.originalRows),copy(before.originalRows));assert.deepEqual(copy(applied.preparedRows),copy(before.preparedRows));assert.deepEqual(copy(applied.origins),copy(before.origins));assert.equal(applied.sourceRows[0][0],before.sourceRows[0][0]);assert.equal(applied.sourceRows[0][1],before.sourceRows[0][1]);assert.equal(applied.result.errors,before.result.errors-3);assert.equal(applied.bulkCorrections.canUndo,true);assert.equal(x.writes(),writes+1);assert.ok(!JSON.stringify(x.state()).includes('Pump 0000'));
 await action(x.ui,'report');const file=x.downloads[0],book=await x.F.read({name:file.name,size:file.blob.size,arrayBuffer:()=>file.blob.arrayBuffer()});assert.deepEqual(copy(book.sheets.map(s=>s.name)),['Validated data','Issues']);assert.equal(book.sheets[0].rows[1][4],'X');
 x.edit(0,'DESCRIPTION','Manually edited description');await action(x.ui,'prep-fixes-undo');const undone=x.ui.snapshot();assert.equal(undone.sourceRows[0][4],'');assert.equal(undone.sourceRows[0][1],'Manually edited description');assert.equal(undone.bulkCorrections.canUndo,false);
});

test('stale previews are discarded after new uploads or account changes and a run-only user can apply corrections',async t=>{
 const x=await workspace(t);await action(x.ui,'prep-fixes-scan');await x.upload([row('PRIVATE-NEW','P1')]);assert.equal(x.ui.snapshot().bulkCorrections.plan,null);await assert.rejects(action(x.ui,'prep-fixes-apply'),/Run validation/);await x.ui.run();await action(x.ui,'prep-fixes-scan');x.w.WorkHubCurrentAccess={can:(_,op)=>op==='run'||op==='view'};await action(x.ui,'prep-fixes-apply');assert.equal(x.ui.snapshot().sourceRows[0][4],'X');await action(x.ui,'prep-fixes-scan');x.account('other');assert.equal(x.ui.snapshot().bulkCorrections.plan,null);assert.equal(x.ui.snapshot().bulkCorrections.canUndo,false);
});

test('cancellation during atomic staging applies no partial correction and leaves export results intact',async t=>{
 const x=await workspace(t),before=x.ui.snapshot();await action(x.ui,'prep-fixes-scan');x.hold(true);const pending=action(x.ui,'prep-fixes-apply');assert.equal(x.ui.snapshot().bulkCorrections.running,true);await action(x.ui,'prep-fixes-cancel');x.hold(false);await pending;assert.deepEqual(copy(x.ui.snapshot().sourceRows),copy(before.sourceRows));assert.deepEqual(copy(x.ui.snapshot().result),copy(before.result));assert.equal(x.ui.snapshot().bulkCorrections.canUndo,false);
});

test('undo refuses to overwrite a later edit to a corrected cell',async t=>{
 const x=await workspace(t);await action(x.ui,'prep-fixes-scan');await action(x.ui,'prep-fixes-apply');x.edit(0,'FLAG','Later edit');await action(x.ui,'prep-fixes-undo');assert.equal(x.ui.snapshot().sourceRows[0][4],'Later edit');assert.match(x.d.body.textContent,/Undo would overwrite/);
});

test('scan and apply obey run permissions and review pagination retains complete plans',async t=>{
 const x=await workspace(t,{count:40});await action(x.ui,'prep-fixes-scan');const total=x.ui.snapshot().bulkCorrections.plan.total;assert.ok(total>25);assert.equal(x.d.querySelectorAll('.val-bulk-fixes-grid tbody tr').length,25);await action(x.ui,'prep-fixes-page',{delta:'1'});assert.equal(x.ui.snapshot().bulkCorrections.plan.total,total);
 const before=copy(x.ui.snapshot().sourceRows);x.w.WorkHubCurrentAccess={can:()=>false};await assert.rejects(action(x.ui,'prep-fixes-apply'),/disabled/);assert.deepEqual(copy(x.ui.snapshot().sourceRows),before);
});

test('correction worker uses the same deterministic engine and produces progress and terminal errors',async t=>{
 const x=engine(t),s=template(x.E),messages=[],sandbox={console,setTimeout,performance,postMessage:m=>messages.push(m)};sandbox.self=sandbox;const scope=vm.createContext(sandbox);sandbox.importScripts=(...urls)=>{for(const url of urls)vm.runInContext(read(url.split('?')[0].slice(2)),scope)};vm.runInContext(read('validator-corrections-worker.js'),scope);
 await sandbox.onmessage({data:{id:4,data:copy(args(s,[row()]))}});assert.ok(messages.some(m=>m.progress));assert.equal(messages.at(-1).plan.clear,2);assert.equal(messages.at(-1).id,4);
 await sandbox.onmessage({data:{id:5,data:{schema:{},rows:[]}}});assert.equal(typeof messages.at(-1).error,'string');
});

test('large scans use a cancellable worker, ignore stale progress and keep worker failures visible',async t=>{
 const x=engine(t),s=template(x.E),rows=Array.from({length:3500},(_,i)=>row(String(i))),workers=[];
 x.w.Worker=class{constructor(url){assert.equal(new URL(url).origin,'https://example.test');workers.push(this)}postMessage(packet){this.packet=packet}terminate(){this.stopped=true}};
 const runner=x.C.createRunner(),progress=[],pending=runner.run(args(s,rows),p=>progress.push(p));const worker=workers[0];worker.onmessage({data:{id:worker.packet.id+1,progress:{phase:'stale'}}});assert.equal(progress.length,0);runner.cancel();await assert.rejects(pending,{name:'AbortError'});assert.equal(worker.stopped,true);
 const failed=runner.run(args(s,rows)),next=workers.at(-1);next.onmessage({data:{id:next.packet.id,error:'Invalid selected template'}});await assert.rejects(failed,/Invalid selected template/);assert.equal(next.stopped,true);
 let blocked=0;x.w.Worker=class{constructor(){blocked++;throw Error('Blocked worker')}};const local=await x.C.createRunner().run(args(s,rows));assert.equal(blocked,1);assert.equal(local.clear,7000);
});

test('review suggestions support configured field equality and explicit empty values without changing ordinary suggestions',async t=>{
 const x=engine(t),s=x.E.create('Fixed fields');s.columns=['LEFT','RIGHT','EMPTY'].map((key,i)=>({...x.E.column(i),key,label:key}));
 const eq=x.E.rule('LEFT');eq.when={join:'all',conditions:[],groups:[]};eq.assertion={...x.E.condition('LEFT'),operator:'fieldEq',otherField:'RIGHT'};const empty=x.E.rule('EMPTY');empty.when={join:'all',conditions:[],groups:[]};empty.assertion={...x.E.condition('EMPTY'),operator:'empty'};s.rules=[eq,empty];
 const rows=[{LEFT:'wrong',RIGHT:'000001',EMPTY:'remove'}];assert.equal(x.E.suggestions(s,rows[0],'LEFT').total,0);const p=await x.C.scan(args(s,rows));assert.equal(p.clear,2);const items=entries(p,s);assert.equal(items.find(i=>i.field==='LEFT').value,'000001');assert.equal(items.find(i=>i.field==='EMPTY').value,'');
});

test('cancelling a worker-fallback scan settles its promise and permits another scan',async t=>{
 const x=engine(t),s=template(x.E),rows=Array.from({length:3500},(_,i)=>row(String(i)));x.w.Worker=class{constructor(){throw Error('Blocked worker')}};
 const runner=x.C.createRunner(),pending=runner.run(args(s,rows));runner.cancel();await assert.rejects(pending,{name:'AbortError'});const next=await runner.run(args(s,[row()]));assert.equal(next.clear,2);
});

test('manual edits discard stale previews while keeping the original upload and batch undo available',async t=>{
 const x=await workspace(t);await action(x.ui,'prep-fixes-scan');await action(x.ui,'prep-fixes-apply');const before=x.ui.snapshot();
 await action(x.ui,'prep-fixes-scan');x.edit(0,'DESCRIPTION','changed while preview open');assert.equal(x.ui.snapshot().bulkCorrections.plan,null);assert.deepEqual(copy(x.ui.snapshot().originalRows),copy(before.originalRows));assert.equal(x.ui.snapshot().bulkCorrections.canUndo,true);
});

test('dependent exploded rows keep their exact material, description and original lineage through contextual fixes and undo',async t=>{
 const x=await workspace(t,{configure:s=>{s.columns[0].unique=false}});
 await x.upload([{...row('6.00007'),DESCRIPTION:'Exact source description',PLANT:'P1,P2',STORAGE:'(P1) BAD (P2) BAD'}]);
 x.ui.openPreparation('explode');const form=x.d.getElementById('valPreparationForm');form.elements.explodeMode.value='dependent';form.elements.primary.value='2';form.elements.primary.dispatchEvent(new x.w.Event('change',{bubbles:true}));form.querySelector('[name="mapped"][value="3"]').checked=true;form.dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));x.ui.applyPreparation();await x.ui.run();
 const before=x.ui.snapshot();assert.equal(before.originalRows.length,1);assert.equal(before.sourceRows.length,2);assert.deepEqual(copy(before.sourceRows.map(r=>r.slice(0,3))),[['6.00007','Exact source description','P1'],['6.00007','Exact source description','P2']]);assert.equal(before.origins[0].row,before.origins[1].row);assert.notEqual(before.origins[0].part,before.origins[1].part);
 await action(x.ui,'prep-fixes-scan');assert.equal(x.ui.snapshot().bulkCorrections.plan.clear,3);await action(x.ui,'prep-fixes-apply');const after=x.ui.snapshot();assert.equal(after.sourceRows[0][3],'S1');assert.equal(after.sourceRows[1][3],'BAD');assert.ok(after.sourceRows.every(r=>r[4]==='X'));assert.deepEqual(copy(after.originalRows),copy(before.originalRows));assert.deepEqual(copy(after.preparedRows),copy(before.preparedRows));assert.deepEqual(copy(after.origins),copy(before.origins));assert.deepEqual(copy(after.sourceRows.map(r=>r.slice(0,3))),copy(before.sourceRows.map(r=>r.slice(0,3))));
 await action(x.ui,'prep-fixes-undo');assert.deepEqual(copy(x.ui.snapshot().sourceRows),copy(before.sourceRows));assert.deepEqual(copy(x.ui.snapshot().origins),copy(before.origins));
});
