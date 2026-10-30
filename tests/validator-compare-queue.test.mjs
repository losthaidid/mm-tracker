import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

async function fixture(t, { compareHook, writer } = {}) {
  const dom = new JSDOM('<div id="view"></div>', { url: 'https://example.test', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate });
  for (const file of ['vendor/jszip.min.js','validator-engine.js','validator-files.js','validator-compare-engine.js']) w.eval(read(file));
  const E = w.WorkHubValidatorEngine, F = w.WorkHubValidatorFiles, C = w.WorkHubValidatorCompareEngine;
  if (compareHook) w.WorkHubValidatorCompareEngine = { ...C, compare: (...args) => compareHook(C.compare, ...args) };
  if (writer) w.WorkHubValidatorFiles = { ...F, workbook: sheets => writer(F.workbook,sheets) };
  for (const file of ['validator-compare.js','validator-studio.js']) w.eval(read(file));
  let owner = 'owner', ready = true, ui, writes = 0;
  const state = { projects: [], projectCompanies: [], workhub: { validator: { templates: [], runs: [] } } }, downloads = [];
  const render = () => { if (!ui.patchRender()) d.getElementById('view').innerHTML = ui.render(); };
  ui = w.WorkHubValidatorStudio.install({state:()=>state,owner:()=>owner,ready:()=>ready,render,tell(){},
    mutate(){writes++;return true;},download(blob,name){downloads.push({blob,name});}});
  render(); await ui.handle({dataset:{val:'mode',mode:'file-compare'}});
  const q = ui.fileComparison;
  const file = (name, rows, size) => { const text = E.csv(rows); return { name, size:size ?? text.length, text:async()=>text }; };
  const change = (selector, value) => { const el = d.querySelector(selector); assert.ok(el,selector); if(el.type==='checkbox'||el.type==='radio')el.checked=value;else el.value=value;el.dispatchEvent(new w.Event('change',{bubbles:true})); };
  const upload = (side,rows,name=side+'.csv')=>q.loadFile(side,file(name,rows));
  const simplePair = async (n, different = false) => { const id = await q.addPair(); await upload('A',[['Code'],['A'+n]],'A'+n+'.csv'); await upload('B',[['Different header'],[different?'B'+n:'A'+n]],'B'+n+'.csv'); q.confirmPair(); return id; };
  const workbook = async blob => F.read({name:'report.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()},{valuesOnly:true});
  return {w,d,E,F,C,q,ui,state,downloads,file,change,upload,simplePair,workbook,writes:()=>writes,
    account(next,active=true){owner=next;ready=active;ui.sync();render();}};
}

test('reports have only Summary and Field Comparison; summaries contain only data discrepancies and both values', async t => {
  const x = await fixture(t);
  await x.upload('A',[['ID','Quantity','Note'],['001','20','Same'],['002','10','Before']],'original.csv');
  await x.upload('B',[['Code','Amount','Description'],['001','25','Same'],['002','10','After']],'output.csv');
  await x.q.run(); await x.q.exportReport();
  const r = x.q.snapshot().result, book = await x.workbook(x.downloads[0].blob);
  assert.equal(r.differentCells,2); assert.equal(r.differentRows,2);
  assert.deepEqual(copy(book.sheets.map(s=>s.name)),['Summary','Field Comparison']);
  const summary = book.sheets[0].rows;
  assert.equal(summary.length,4); assert.equal(summary[1][0],'Not match');
  assert.deepEqual(copy(summary.slice(2).map(row=>[row[1],row[4],row[6],row[9],row[11],row[12]])),[
    ['1','2','20','2','25','Different values'],['2','3','Before','3','After','Different values']]);
  assert.equal(summary[2][2],'original.csv'); assert.equal(summary[2][7],'output.csv');
  assert.equal(book.sheets[1].rows.length,3);
  assert.doesNotMatch(x.d.body.textContent,/Header comparison|Headers that do not match/);
  assert.doesNotMatch(JSON.stringify(book),/Header result|header difference/i);
});

test('header labels never cause Not match, while absent columns including empty datasets remain discrepancies', async t => {
  const x = await fixture(t);
  await x.upload('A',[['Material'],['000001']]); await x.upload('B',[['CODE'],['000001']]);
  await x.q.run(); assert.equal(x.q.snapshot().result.match,true); await x.q.exportReport();
  let book = await x.workbook(x.downloads[0].blob);
  assert.equal(book.sheets[0].rows.length,2); assert.equal(book.sheets[0].rows[1][0],'Match');
  await x.upload('A',[['ID']]); await x.upload('B',[['Code','Extra']]); await x.q.run();
  assert.equal(x.q.snapshot().result.match,false); await x.q.exportReport();
  book = await x.workbook(x.downloads[1].blob);
  assert.equal(book.sheets[0].rows.length,3); assert.match(book.sheets[0].rows[2][12],/Missing column.*no data rows/);
});

test('queued pairs preserve independent settings, literal values and complete results through compression and reopening', async t => {
  const x = await fixture(t), first = await x.q.addPair();
  await x.upload('A',[['Skip','ID','Quantity'],['meta','001','10']],'first-A.csv');
  await x.upload('B',[['Code','Amount'],['001','10']],'first-B.csv');
  x.change('[name="vfcCountA"]','1'); x.q.confirmPair();
  const second = await x.q.addPair();
  assert.ok(x.q.snapshot().queue[0].packedBytes>0);
  await x.upload('A',[['ID','Skip','Quantity'],['002','ignore','20']],'second-A.csv');
  await x.upload('B',[['Code','Amount'],['002','25']],'second-B.csv');
  x.change('[name="vfcModeA"][value="checkboxes"]',true); x.change('[data-vfc-skip="1"][data-side="A"]',true); x.q.confirmPair();
  await x.q.startQueue();
  let s = x.q.snapshot(); assert.deepEqual(copy(s.queue.map(j=>[j.status,j.summary.match])),[['completed',true],['completed',false]]);
  assert.equal(s.queue.filter(j=>j.hasLiveData).length,1); assert.equal(x.writes(),0); assert.deepEqual(x.state.workhub.validator.runs,[]);
  await x.q.openPair(first); s=x.q.snapshot(); assert.equal(s.result.a.rows[0][1],'001'); assert.equal(s.result.b.rows[0][1],'10');
  assert.equal(x.d.querySelector('[name="vfcCountA"]').value,'1'); assert.equal(s.result.match,true);
  await x.q.openPair(second); s=x.q.snapshot(); assert.equal(s.result.match,false);
  assert.equal(x.d.querySelector('[data-vfc-skip="1"][data-side="A"]').checked,true);
  assert.deepEqual(copy(x.C.cell(s.result,0,1)),{a:'20',b:'25',hasA:true,hasB:true,match:false});
});

test('bulk uploads pair files in selection order and require review before the sequential queue starts', async t => {
  let active=0,max=0; const order=[];
  const x=await fixture(t,{compareHook:async(fn,a,b,opts)=>{active++;max=Math.max(max,active);order.push([a.fileName,b.fileName]);try{return await fn(a,b,opts);}finally{active--;}}});
  await x.q.addFiles('A',[1,2,3].map(i=>x.file('A'+i+'.csv',[['Skip','ID'],['meta','00'+i]])));
  x.change('[name="vfcCountA"]','1');
  await x.q.addFiles('B',[1,2,3].map(i=>x.file('B'+(4-i)+'.csv',[['Code'],['00'+i]])));
  assert.equal(x.d.querySelector('[name="vfcCountA"]').value,'1');
  await assert.rejects(x.q.startQueue(),/confirm its setup/);
  const ids=x.q.snapshot().queue.map(j=>j.id);
  for(const id of ids){await x.q.openPair(id);x.change('[name="vfcCountA"]','1');x.q.confirmPair();}
  await x.q.startQueue();
  assert.equal(max,1);assert.deepEqual(order,[['A1.csv','B3.csv'],['A2.csv','B2.csv'],['A3.csv','B1.csv']]);
  assert.ok(x.q.snapshot().queue.every(j=>j.summary.match));
});

test('runtime failure of one confirmed pair does not prevent later pairs from completing', async t => {
  const x=await fixture(t,{compareHook:(fn,a,b,opts)=>{if(a.fileName==='A1.csv')throw Error('Synthetic comparison failure');return fn(a,b,opts);}});
  await x.simplePair(1);await x.simplePair(2);await x.q.startQueue();
  const s=x.q.snapshot();assert.deepEqual(copy(s.queue.map(j=>j.status)),['failed','completed']);
  assert.match(s.queue[0].error,/Synthetic comparison failure/);assert.equal(s.queue[1].summary.match,true);
});

test('an unreadable pair remains failed while reviewed good pairs can run and export', async t => {
  const x=await fixture(t),bad={name:'bad.csv',size:12,text:async()=>{throw Error('Broken source file');}};
  await x.q.addFiles('A',[bad,x.file('good-A.csv',[['ID'],['GOOD']])]);
  await x.q.addFiles('B',[x.file('bad-B.csv',[['ID'],['x']]),x.file('good-B.csv',[['Code'],['GOOD']])]);
  const ids=x.q.snapshot().queue.map(j=>j.id);assert.equal(x.q.snapshot().queue[0].status,'failed');
  await x.q.openPair(ids[1]);x.q.confirmPair();await x.q.startQueue();await x.q.exportAll();
  const s=x.q.snapshot();assert.equal(s.queue[0].status,'failed');assert.equal(s.queue[1].summary.match,true);
  const zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await x.downloads[0].blob.arrayBuffer()),{checkCRC32:true});
  assert.equal(Object.keys(zip.files).filter(n=>n.endsWith('.xlsx')).length,1);
});

test('stop and resume retain completed pairs and confirmed setups without running completed pairs again', async t => {
  const started=deferred(),release=deferred(),calls=[];let hold=true;
  const x=await fixture(t,{compareHook:async(fn,a,b,opts)=>{calls.push(a.fileName);if(a.fileName==='A2.csv'&&hold){hold=false;started.resolve();await release.promise;}return fn(a,b,opts);}});
  await x.simplePair(1);await x.simplePair(2);
  const running=x.q.startQueue();await started.promise;x.q.stopQueue();release.resolve();await running;
  let s=x.q.snapshot();assert.deepEqual(copy(s.queue.map(j=>j.status)),['completed','ready']);assert.equal(s.queueBusy,false);
  await x.q.startQueue();s=x.q.snapshot();assert.ok(s.queue.every(j=>j.status==='completed'));
  assert.deepEqual(calls,['A1.csv','A2.csv','A2.csv']);
});

test('ZIP export has one two-sheet workbook per completed pair and restores the open pair and selections', async t => {
  const x=await fixture(t),first=await x.simplePair(1),second=await x.simplePair(2,true);
  await x.q.startQueue();await x.q.openPair(first);const before=x.q.snapshot();await x.q.exportAll();
  assert.equal(x.q.snapshot().activePairId,first);assert.equal(x.q.snapshot().result.a.fileName,before.result.a.fileName);
  assert.match(x.d.body.textContent,/2 completed comparison reports downloaded/);
  assert.equal(x.downloads[0].name,'comparison-queue.zip');
  const zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await x.downloads[0].blob.arrayBuffer()),{checkCRC32:true}),names=Object.keys(zip.files).filter(n=>!zip.files[n].dir);
  assert.deepEqual(names,['01-A1--B1.xlsx','02-A2--B2.xlsx']);
  for(let i=0;i<names.length;i++){
    const bytes=await zip.file(names[i]).async('uint8array');
    const book=await x.F.read({name:'pair.xlsx',size:bytes.length,arrayBuffer:async()=>bytes.buffer},{valuesOnly:true});
    assert.deepEqual(copy(book.sheets.map(s=>s.name)),['Summary','Field Comparison']);
    assert.equal(book.sheets[0].rows[1][0],i?'Not match':'Match');
    assert.equal(book.sheets[0].rows[1][2],'A'+(i+1)+'.csv');
    if(i)assert.deepEqual(copy(book.sheets[0].rows[2].slice(6,12)),['A2','B2.csv','Data','2','A · Different header','B2']);
  }
  await x.q.openPair(second);x.change('[name="vfcCountA"]','');
  const s=x.q.snapshot();assert.equal(s.queue[0].status,'completed');assert.equal(s.queue[1].status,'needs-setup');assert.equal(s.result,null);
});

test('queue limits reject excessive file counts and bytes before changing the queue', async t => {
  const x=await fixture(t),ten=Array.from({length:10},(_,i)=>x.file('A'+i+'.csv',[['ID'],[String(i)]]));
  await x.q.addFiles('A',ten);const before=copy(x.q.snapshot().queue);
  await assert.rejects(x.q.addFiles('A',[x.file('extra.csv',[['ID'],['x']])]),/up to 10/);
  assert.deepEqual(copy(x.q.snapshot().queue),before);x.q.clearQueue();
  await x.q.addFiles('A',[1,2,3].map(i=>x.file('large'+i+'.csv',[['ID'],['x']],50000000)));
  await assert.rejects(x.q.addFiles('B',[x.file('over-total.csv',[['ID'],['x']],1)]),/150 MB/);
  assert.ok(x.q.snapshot().queue.every(j=>j.files.B===''));
  await assert.rejects(x.q.addFiles('B',[x.file('over-file.csv',[['ID'],['x']],50000001)]),/50 MB/);
});

test('account changes during bulk reads or pair compression discard pending data and clear all queue state', async t => {
  const x=await fixture(t),readGate=deferred();
  const adding=x.q.addFiles('A',[{name:'private.csv',size:10,text:()=>readGate.promise}]);
  x.account('other');readGate.resolve('ID\nPRIVATE');await assert.rejects(adding,{name:'AbortError'});
  assert.equal(x.q.snapshot().queue.length,0);assert.doesNotMatch(x.d.body.textContent,/private.csv|PRIVATE/);
  await x.upload('A',[['ID'],['PRIVATE']]);await x.upload('B',[['ID'],['PRIVATE']]);
  const packed=deferred(),compress=x.w.JSZip.prototype.generateAsync;
  x.w.JSZip.prototype.generateAsync=function(options){return this.file('pair.json')?packed.promise.then(()=>compress.call(this,options)):compress.call(this,options);};
  const switching=x.q.addPair();x.account('third');packed.resolve();await assert.rejects(switching,{name:'AbortError'});
  assert.equal(x.q.snapshot().queue.length,0);assert.equal(x.q.snapshot().result,null);assert.equal(x.q.snapshot().queueIO,false);
});

test('a stopped account session cannot complete a queued comparison or download a pending ZIP export', async t => {
  const started=deferred(),release=deferred();
  const x=await fixture(t,{compareHook:async(fn,...args)=>{started.resolve();await release.promise;return fn(...args);}});
  await x.simplePair(1);const running=x.q.startQueue();await started.promise;x.account('other');release.resolve();await running;
  assert.equal(x.q.snapshot().queue.length,0);assert.equal(x.q.snapshot().queueBusy,false);assert.equal(x.q.snapshot().result,null);
  const writing=deferred(),out=deferred(),y=await fixture(t,{writer:async(fn,sheets)=>{writing.resolve();await out.promise;return fn(sheets);}});
  await y.simplePair(1);await y.q.startQueue();const exporting=y.q.exportAll();await writing.promise;y.account('other');out.resolve();await exporting;
  assert.equal(y.downloads.length,0);assert.equal(y.q.snapshot().queue.length,0);assert.equal(y.q.snapshot().queueIO,false);
});

test('queue actions and exports obey existing run and export permissions', async t => {
  const x=await fixture(t);await x.simplePair(1);await x.q.startQueue();
  x.w.WorkHubCurrentAccess={can:(_feature,action)=>action==='export'};
  await assert.rejects(x.q.addPair(),/permission.*compare/);await x.q.exportAll();assert.equal(x.downloads.length,1);
  x.w.WorkHubCurrentAccess={can:()=>false};await assert.rejects(x.q.exportAll(),/permission.*export/);
  x.account('',false);assert.equal(x.q.snapshot().queue.length,0);
});

test('compressed session and ZIP budgets refuse oversized work without losing the open pair', async t => {
  const x=await fixture(t);await x.upload('A',[['ID'],['ORIGINAL']]);await x.upload('B',[['Code'],['ORIGINAL']]);await x.q.run();
  const generate=x.w.JSZip.prototype.generateAsync;
  x.w.JSZip.prototype.generateAsync=function(options){return this.file('pair.json')?Promise.resolve({byteLength:100000001}):generate.call(this,options);};
  await assert.rejects(x.q.addPair(),/100 MB/);
  assert.equal(x.q.snapshot().queue.length,1);assert.equal(x.q.snapshot().result.a.rows[0][0],'ORIGINAL');
  assert.equal(x.q.snapshot().queueIO,false);x.w.JSZip.prototype.generateAsync=generate;
  const y=await fixture(t,{writer:async()=>({size:250000001,arrayBuffer:async()=>{throw Error('Must check size before reading bytes');}})});
  const id=await y.simplePair(1);await y.q.startQueue();await y.q.exportAll();
  assert.equal(y.downloads.length,0);assert.equal(y.q.snapshot().activePairId,id);assert.equal(y.q.snapshot().result.match,true);
  assert.match(y.d.body.textContent,/250 MB/);
});

test('a late decompression error cannot reveal a previous account’s queue or error text', async t => {
  const x=await fixture(t),first=await x.simplePair(1);await x.simplePair(2);await x.q.startQueue();
  const started=deferred(),release=deferred(),load=x.w.JSZip.loadAsync;let firstRead=true;
  x.w.JSZip.loadAsync=function(...args){if(firstRead){firstRead=false;started.resolve();return release.promise.then(()=>{throw Error('OLD-PRIVATE-SOURCE');});}return load.apply(this,args);};
  const opening=x.q.openPair(first);await started.promise;x.account('other');release.resolve();await assert.rejects(opening,{name:'AbortError'});
  assert.equal(x.q.snapshot().queue.length,0);assert.doesNotMatch(x.d.body.textContent,/OLD-PRIVATE-SOURCE|A1.csv/);
});

test('Summary distinguishes a missing row from a matching-looking blank value after skipping metadata', async t => {
  const x=await fixture(t);await x.upload('A',[['ID']]);await x.upload('B',[['Metadata','Other ID'],['retain record','']]);
  x.change('[name="vfcCountB"]','1');await x.q.run();await x.q.exportReport();
  const book=await x.workbook(x.downloads[0].blob),row=book.sheets[0].rows[2];
  assert.equal(row[0],'Not match');assert.equal(row[6],'(Missing row or column)');assert.equal(row[11],'');assert.equal(row[12],'Missing row in Template A');
});

test('complete Summary exports include over 15,000 discrepancies and their final source values', async t => {
  const x=await fixture(t),rows=Array.from({length:10001},(_,i)=>['A-'+i,'AA-'+i]),other=Array.from({length:10001},(_,i)=>['B-'+i,'BB-'+i]);
  await x.upload('A',[['Code','Value'],...rows]);await x.upload('B',[['Other code','Other value'],...other]);await x.q.run();await x.q.exportReport();
  assert.equal(x.q.snapshot().result.differentCells,20002);
  const zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await x.downloads[0].blob.arrayBuffer()),{checkCRC32:true});
  const summary=await zip.file('xl/worksheets/sheet1.xml').async('string'),fields=await zip.file('xl/worksheets/sheet2.xml').async('string');
  assert.equal((summary.match(/<row /g)||[]).length,20004);assert.match(summary,/AA-10000/);assert.match(summary,/BB-10000/);
  assert.equal((fields.match(/<row /g)||[]).length,10002);
});

test('an account change during post-export restoration cannot surface the old pair or its completion/error message', async t => {
  const x=await fixture(t),first=await x.simplePair(1);await x.simplePair(2);await x.q.startQueue();await x.q.openPair(first);
  const started=deferred(),release=deferred(),load=x.w.JSZip.loadAsync;let reads=0;
  x.w.JSZip.loadAsync=function(...args){if(++reads===2){started.resolve();return release.promise.then(()=>{throw Error('PRIVATE-OLD-RESTORATION');});}return load.apply(this,args);};
  const exporting=x.q.exportAll();await started.promise;x.account('other');release.resolve();await exporting;
  assert.equal(x.q.snapshot().queue.length,0);assert.equal(x.q.snapshot().result,null);assert.equal(x.q.snapshot().queueIO,false);
  assert.doesNotMatch(x.d.body.textContent,/PRIVATE-OLD-RESTORATION|A1.csv|reports downloaded/);
});
