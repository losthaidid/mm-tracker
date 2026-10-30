import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const copy=x=>JSON.parse(JSON.stringify(x));
const headers=['Material','Description','Plant','Storage','Private extra'];
const records=Array.from({length:6},(_,i)=>['PRIVATE-'+i,'Description '+i,[0,2,5].includes(i)?'BAD':'P1',i===1?'':'S1','Extra '+i]);
async function fixture(t, data=records, customize=()=>{}) {
 const dom=new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://example.test'}),w=dom.window,d=w.document;
 t.after(()=>w.close());Object.assign(w,{Blob,TextEncoder,TextDecoder,setImmediate,clearImmediate});
 let owner='owner',ready=true,writes=0,id=0;const timers=new Map(),downloads=[];
 w.setTimeout=(fn,delay)=>{const key=++id;if(delay===50)queueMicrotask(fn);else timers.set(key,fn);return key};w.clearTimeout=key=>timers.delete(key);w.confirm=()=>true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 for(const f of ['vendor/jszip.min.js','validator-engine.js','validator-transform.js','validator-files.js','validator-studio.js'])w.eval(read(f));
 const E=w.WorkHubValidatorEngine,F=w.WorkHubValidatorFiles,Studio=w.WorkHubValidatorStudio,schema=E.create('Grouped review');
 schema.columns=['MAT','DESCRIPTION','PLANT','STORAGE'].map((key,i)=>({...E.column(i),key,label:headers[i],required:i===3,values:i===2?'P1,P2':''}));customize(schema,E);
 let state={projects:[],projectCompanies:[],workhub:{validator:{templates:[schema],runs:[]}}},ui;
 const render=()=>{if(!ui.patchRender())d.getElementById('view').innerHTML=ui.render()};
 ui=Studio.install({state:()=>state,owner:()=>owner,ready:()=>ready,render,tell:()=>{},mutate(fn){const next=E.copy(state);fn(next);E.prepare(next,state);E.validateState(next);state=next;writes++;render();return true},openModal(title,body){d.getElementById('modalBody').innerHTML=body;d.getElementById('modal').showModal()},closeModal(){d.getElementById('modal').close()},download(blob,name){downloads.push({blob,name})}});
 render();const upload=async rows=>{const csv=E.csv([headers,...rows]);await ui.loadFile({name:'original.csv',size:csv.length,text:async()=>csv})};await upload(data);await ui.run();
 const groups=()=>Studio.groupIssues(ui.snapshot().result.issues);
 const open=async predicate=>{const group=groups().find(predicate);assert.ok(group);await ui.handle({dataset:{val:'attention-open',groupKey:group.key}});return group};
 const edit=(i,key,value,type='change')=>{const cell=d.querySelector(`#valResultsCard [data-cell="${i}"][data-field="${key}"]`);assert.ok(cell);cell.value=value;cell.dispatchEvent(new w.Event(type,{bubbles:true}));return cell};
 return {w,d,E,F,Studio,ui,schema,groups,open,edit,upload,timers,downloads,writes:()=>writes,state:()=>state,render,account(value){owner=value;ui.sync();render()},signOut(){owner='';ready=false;ui.sync();d.getElementById('view').replaceChildren()}};
}
const visibleRows=x=>[...x.d.querySelectorAll('#valResultsCard [data-row-index]')].map(n=>Number(n.dataset.rowIndex));

test('attention groups use check identity, field and severity, preserve custom messages, and count distinct records',async t=>{
 const x=await fixture(t),base={field:'PLANT',column:'Plant',ruleId:'r1',rule:'Reference',message:'Not maintained',severity:'error'};
 const issues=[{...base,index:0},{...base,index:0},{...base,index:2},{...base,index:3,severity:'warning'},{...base,index:4,field:'STORAGE',column:'Storage'},{...base,index:5,ruleId:'r2'},{...base,index:6,message:'Not maintained 2'},{...base,index:7,ignored:true}],before=copy(issues);
 const groups=x.Studio.groupIssues(issues);assert.equal(groups.length,5);const group=groups.find(g=>g.entries.length===3);assert.deepEqual(copy(group.indices),[0,2]);assert.equal(group.severity,'error');assert.equal(groups.at(-1).severity,'warning');assert.deepEqual(issues,before);
 const duplicates=x.Studio.groupIssues([1,7].map((n,i)=>({...base,index:n,ruleId:'unique',rule:'Duplicate check',message:'Duplicate value. Also appears on row '+(i?3:9)+'.'})));
 assert.equal(duplicates.length,1);assert.equal(duplicates[0].message,'Duplicate value.');
 const custom=x.Studio.groupIssues([0,1].map((n)=>({...base,index:n,message:'Custom problem. Also appears on row '+(n+2)+'.'})));assert.equal(custom.length,2);
});

test('selecting a group shows full affected records, highlighted fields and read-only unmapped information without writes',async t=>{
 const x=await fixture(t),before=x.writes();assert.equal(x.d.querySelectorAll('[data-val="attention-open"]').length,2);
 const group=await x.open(g=>g.field==='PLANT');assert.equal(group.indices.length,3);assert.deepEqual(visibleRows(x),[0,2,5]);
 assert.equal(x.d.getElementById('valRecordsTitle').textContent,'Affected records');assert.equal(x.d.querySelectorAll('#valResultsCard input[data-cell]').length,12);assert.equal(x.d.querySelectorAll('.val-group-cell').length,3);
 assert.equal(x.d.querySelectorAll('.val-unmapped-record').length,3);assert.match(x.d.querySelector('[data-row-index="5"]').textContent,/Extra 5/);assert.match(x.d.querySelector('[data-row-index="5"]').textContent,/original row 7/);
 assert.equal(x.d.querySelector('[data-row-index="5"] [data-field="DESCRIPTION"]').value,'Description 5');assert.equal(x.writes(),before);
 await x.ui.handle({dataset:{val:'attention-back'}});assert.deepEqual(visibleRows(x),[0,1,2,3,4,5]);assert.equal(x.ui.snapshot().attentionGroup,'');assert.equal(x.writes(),before);
});

test('live group corrections update counts, keep the focused record and caret, and allow refreshing resolved records',async t=>{
 const x=await fixture(t);const group=await x.open(g=>g.field==='PLANT'),before=x.writes();
 const cell=x.d.querySelector('[data-cell="0"][data-field="PLANT"]'),scroll=x.d.getElementById('valResultsScroll');cell.focus();cell.setSelectionRange(1,2);scroll.scrollLeft=70;scroll.scrollTop=40;
 x.edit(0,'PLANT','P1','input');cell.setSelectionRange(1,2);assert.equal(x.ui.snapshot().livePending,true);
 await assert.rejects(x.ui.handle({dataset:{val:'attention-open',groupKey:group.key}}),/current edit/);
 for(const fn of [...x.timers.values()])fn();
 assert.equal(x.groups().find(g=>g.key===group.key).indices.length,2);assert.equal(x.d.activeElement,cell);assert.equal(cell.selectionStart,1);assert.equal(cell.selectionEnd,2);assert.equal(scroll.scrollLeft,70);assert.equal(scroll.scrollTop,40);assert.equal(x.d.querySelector('[data-cell="0"][data-field="PLANT"]'),cell);assert.deepEqual(visibleRows(x),[0,2,5]);assert.match(cell.closest('tr').textContent,/Resolved in this group/);
 x.edit(2,'PLANT','P1');x.edit(5,'PLANT','P1');assert.equal(x.groups().some(g=>g.key===group.key),false);assert.match(x.d.getElementById('valGroupContext').textContent,/No unresolved issues remain/);assert.ok(x.d.getElementById('valAttention'));
 await x.ui.handle({dataset:{val:'attention-refresh'}});assert.deepEqual(visibleRows(x),[]);assert.equal(x.writes(),before);
 await x.ui.handle({dataset:{val:'attention-back'}});assert.equal(visibleRows(x).length,6);assert.doesNotMatch(JSON.stringify(x.state()),/PRIVATE-|Description 5|Extra 5/);
});

test('duplicate groups combine row-specific pointers and open an exact issue on its scoped page',async t=>{
 const data=Array.from({length:70},(_,i)=>['PRIVATE-'+i,'Record '+i,'P1','S1','Extra '+i]);data[40][0]='DUP';data[65][0]='DUP';
 const x=await fixture(t,data,s=>{s.columns[0].unique=true});const group=await x.open(g=>g.ruleId==='unique');assert.equal(group.entries.length,2);assert.deepEqual(visibleRows(x),[40,65]);
 const entry=group.entries.find(e=>e.issue.index===65);await x.ui.handle({dataset:{val:'issue',issue:String(entry.index),issueKey:x.E.issueKey(entry.issue)}});
 assert.equal(x.d.activeElement.dataset.cell,'65');assert.equal(x.d.activeElement.dataset.field,'MAT');assert.deepEqual(visibleRows(x),[40,65]);
 x.edit(65,'MAT','FIXED');assert.equal(x.ui.snapshot().result.errors,0);assert.match(x.d.getElementById('valGroupContext').textContent,/No unresolved issues remain/);assert.deepEqual(visibleRows(x),[65]);
});

test('different duplicate combinations remain separate and all participating fields are highlighted',async t=>{
 const data=[['DUP','One','P1','S1','A'],['DUP','Two','P1','S2','B']];
 const x=await fixture(t,data,s=>{s.uniqueGroups=[['MAT','PLANT'],['MAT','STORAGE']]});const group=await x.open(g=>g.ruleId==='unique');assert.deepEqual(copy(group.fields),['MAT','PLANT']);assert.equal(x.d.querySelectorAll('#valResultsCard th.val-group-column').length,2);assert.equal(x.d.querySelectorAll('#valResultsCard td.val-group-cell').length,4);
 const raw=x.Studio.groupIssues([{index:0,field:'MAT',column:'Material',ruleId:'unique',rule:'Duplicate check',severity:'error',message:'Duplicate combination: MAT + PLANT. Also appears on row 3.'},{index:0,field:'MAT',column:'Material',ruleId:'unique',rule:'Duplicate check',severity:'error',message:'Duplicate combination: MAT + STORAGE. Also appears on row 3.'}]);assert.equal(raw.length,2);
});

test('individual selection and ignore apply only to the opened group, and restoring an issue refreshes its records',async t=>{
 const x=await fixture(t),source=copy(x.ui.snapshot().sourceRows);await x.open(g=>g.field==='PLANT');await x.ui.handle({dataset:{val:'select-issues'}});assert.match(x.d.querySelector('[data-val="ignore-selected"]').textContent,/\(3\)/);
 await x.ui.handle({dataset:{val:'ignore-selected'}});assert.equal(x.ui.snapshot().result.ignored,3);assert.equal(x.ui.snapshot().result.errors,1);assert.equal(x.d.querySelectorAll('[data-val="restore-issue"]').length,3);assert.equal(x.groups().length,1);
 await x.ui.handle(x.d.querySelector('[data-val="restore-issue"]'));assert.equal(x.ui.snapshot().result.ignored,2);assert.equal(x.groups().find(g=>g.field==='PLANT').indices.length,1);assert.equal(visibleRows(x).length,1);assert.deepEqual(copy(x.ui.snapshot().sourceRows),source);
 await x.open(g=>g.field==='STORAGE');assert.equal(x.d.querySelector('[data-val="ignore-selected"]').disabled,true);assert.equal(x.d.querySelectorAll('[data-issue-choice]').length,1);
});

test('search, severity filters and group paging are local and keep the current record editor mounted',async t=>{
 const x=await fixture(t,[['A','Description','P1','S1','Extra']],(s,E)=>{s.rules=Array.from({length:9},(_,i)=>{const r=E.rule('PLANT');r.name='Check '+i;r.message='Problem '+i;r.assertion={...E.condition('PLANT'),operator:'eq',value:'X'};r.severity=i===8?'warning':'error';return r})});
 const before=x.writes();assert.equal(x.d.querySelectorAll('[data-val="attention-open"]').length,6);await x.ui.handle({dataset:{val:'attention-page',delta:'1'}});assert.equal(x.d.querySelectorAll('[data-val="attention-open"]').length,3);
 const search=x.d.getElementById('valAttentionSearch');search.focus();search.value='Problem 7';search.dispatchEvent(new x.w.Event('input',{bubbles:true}));assert.equal(x.d.getElementById('valAttentionSearch'),search);assert.equal(x.d.activeElement,search);assert.equal(x.d.querySelectorAll('[data-val="attention-open"]').length,1);assert.match(x.d.querySelector('[data-val="attention-open"]').textContent,/Problem 7/);
 search.value='';search.dispatchEvent(new x.w.Event('input',{bubbles:true}));await x.ui.handle({dataset:{val:'attention-filter',filter:'warning'}});assert.equal(x.d.querySelectorAll('[data-val="attention-open"]').length,1);assert.match(x.d.querySelector('[data-val="attention-open"]').textContent,/Warning.*Problem 8/);assert.equal(x.writes(),before);
});

test('roomy review retains focused edits and a new upload or account clears group state and late checks',async t=>{
 const x=await fixture(t);await x.open(g=>g.field==='PLANT');const cell=x.d.querySelector('[data-cell="0"][data-field="PLANT"]');cell.focus();cell.setSelectionRange(1,2);
 await x.ui.handle({dataset:{val:'review-wide'}});assert.ok(x.d.querySelector('.validation-studio.val-review-wide'));assert.equal(x.d.querySelector('[data-cell="0"][data-field="PLANT"]'),cell);assert.equal(x.d.activeElement,cell);assert.equal(cell.selectionStart,1);
 const before=x.writes();x.edit(0,'PLANT','P1','input');const stale=[...x.timers.values()][0];await x.upload([['B','New','P2','S2','New extra']]);stale();assert.equal(x.ui.snapshot().attentionGroup,'');assert.equal(x.ui.snapshot().result,null);assert.equal(x.d.querySelector('.val-review-wide'),null);assert.equal(x.writes(),before);
 await x.ui.run();assert.equal(x.d.getElementById('valAttention'),null);await x.upload(records);await x.ui.run();await x.open(g=>g.field==='PLANT');x.account('other');assert.equal(x.ui.snapshot().rows.length,0);assert.equal(x.ui.snapshot().attentionGroup,'');assert.equal(x.d.querySelector('#valGroupContext'),null);
});

test('grouped exploded records retain each parent and split part with unmapped columns copied correctly',async t=>{
 const x=await fixture(t,[['0001','Parent Alpha','P1,P9','S1,S2','ALPHA'],['0002','Parent Beta','P9','S3','BETA']]);
 x.ui.openPreparation('explode');const form=x.d.getElementById('valPreparationForm');form.elements.primary.value='2';form.elements.primary.dispatchEvent(new x.w.Event('change',{bubbles:true}));form.querySelector('[name="mapped"][value="3"]').checked=true;form.dispatchEvent(new x.w.Event('submit',{bubbles:true,cancelable:true}));x.ui.applyPreparation();await x.ui.run();await x.open(g=>g.field==='PLANT');
 assert.deepEqual(visibleRows(x),[1,2]);const a=x.d.querySelector('[data-row-index="1"]'),b=x.d.querySelector('[data-row-index="2"]');assert.match(a.textContent,/original row 2 · part 2/);assert.match(b.textContent,/original row 3 · unsplit/);assert.match(a.querySelector('.val-unmapped-record').textContent,/ALPHA/);assert.match(b.querySelector('.val-unmapped-record').textContent,/BETA/);assert.equal(a.querySelector('[data-field="DESCRIPTION"]').value,'Parent Alpha');assert.equal(b.querySelector('[data-field="DESCRIPTION"]').value,'Parent Beta');
 x.edit(1,'PLANT','P2');assert.deepEqual(copy(x.ui.snapshot().sourceRows),[['0001','Parent Alpha','P1','S1','ALPHA'],['0001','Parent Alpha','P2','S2','ALPHA'],['0002','Parent Beta','P9','S3','BETA']]);
});

test('group filters do not restrict comparison, issue or accepted exports',async t=>{
 const x=await fixture(t);await x.open(g=>g.field==='STORAGE');assert.deepEqual(visibleRows(x),[1]);await x.ui.handle({dataset:{val:'export-comparison'}});const file=x.downloads[0],book=await x.F.read({name:file.name,size:file.blob.size,arrayBuffer:()=>file.blob.arrayBuffer()});assert.equal(book.sheets.find(s=>s.name==='Row comparison').rows.length,7);assert.equal(book.sheets.find(s=>s.name==='Validated upload').rows.length,7);assert.equal(book.sheets.find(s=>s.name==='Issues').rows.length,5);
 await x.ui.handle({dataset:{val:'accepted'}});const accepted=x.downloads[1],acceptedBook=await x.F.read({name:accepted.name,size:accepted.blob.size,arrayBuffer:()=>accepted.blob.arrayBuffer()});assert.equal(acceptedBook.sheets[0].rows.length,3);assert.equal(acceptedBook.sheets[0].rows[1][0],'PRIVATE-3');assert.equal(acceptedBook.sheets[0].rows[2][0],'PRIVATE-4');
});

test('truncated groups identify their listed scope and never silently ignore unlisted errors',async t=>{
 const data=Array.from({length:160},(_,i)=>['A'+i,'Record '+i,'P1','S1','X']);
 const x=await fixture(t,data,(s,E)=>{s.rules=Array.from({length:100},(_,i)=>{const r=E.rule('PLANT');r.name='Rule '+i;r.message='Problem '+i;r.assertion={...E.condition('PLANT'),operator:'eq',value:'X'};return r})});
 assert.equal(x.ui.snapshot().result.errors,16000);assert.equal(x.ui.snapshot().result.truncated,true);assert.match(x.d.querySelector('.val-attention-cap').textContent,/Additional issues still count/);
 const group=await x.open(g=>g.rule===x.schema.rules[0].name);assert.equal(group.indices.length,150);await x.ui.handle({dataset:{val:'select-issues'}});await x.ui.handle({dataset:{val:'issue-page',kind:'open',delta:'1'}});await x.ui.handle({dataset:{val:'select-issues'}});await x.ui.handle({dataset:{val:'ignore-selected'}});
 assert.equal(x.ui.snapshot().result.ignored,150);assert.equal(x.ui.snapshot().result.errors,15850);assert.equal(x.ui.snapshot().result.passed,0);assert.match(x.d.getElementById('valGroupContext').textContent,/unlisted issues may still exist/);
});
