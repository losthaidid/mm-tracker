import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const headers = ['Material', 'Description', 'Plant', 'Storage', 'Extra'];
const options = { mode: 'dependent', primary: 2, mapped: [3] };
const original = [
  ['6.00007', 'Alpha', 'FF01, FF02, FF03', '(FF01) QA00, QA01, (FF02,FF03) QA00', '001'],
  ['6.00007', 'Another source row', 'FF01,FF02', 'QA00,QA01', '=literal()'],
  ['000001', 'Leading zero', 'FF03', '(FF03) QA02', ''],
];

async function fixture(t) {
  const dom = new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>', { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://example.test' });
  const w = dom.window, d = w.document;
  t.after(() => w.close());
  Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate });
  const timers = new Map(); let timer = 0, owner = 'owner', writes = 0;
  w.setTimeout = (fn, ms) => { const n = ++timer; if (ms === 50) queueMicrotask(fn); else timers.set(n, fn); return n; };
  w.clearTimeout = n => timers.delete(n); w.confirm = () => true;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const file of ['vendor/jszip.min.js', 'vendor/ssf.js', 'validator-engine.js', 'validator-transform.js', 'validator-files.js', 'validator-studio.js']) w.eval(read(file));
  const E = w.WorkHubValidatorEngine, T = w.WorkHubValidatorTransform, F = w.WorkHubValidatorFiles, schema = E.create('Materials');
  schema.columns = headers.slice(0,4).map((label, i) => ({ ...E.column(i), key: ['MATNR', 'DESCRIPTION', 'PLANT', 'STORAGE'][i], label }));
  let state = { projects: [], projectCompanies: [], workhub: { validator: { templates: [schema], runs: [] } } }, ui;
  const downloads = [], render = () => { if (!ui.patchRender()) d.getElementById('view').innerHTML = ui.render(); };
  ui = w.WorkHubValidatorStudio.install({ state: () => state, owner: () => owner, ready: () => true, render, tell: () => {},
    mutate(fn) { const next = E.copy(state); fn(next); E.prepare(next, state); E.validateState(next); state = next; writes++; render(); return true; },
    openModal(title, body) { d.getElementById('modalBody').innerHTML = body; d.getElementById('modal').showModal(); },
    closeModal() { d.getElementById('modal').close(); }, download(blob, name) { downloads.push({ blob, name }); },
  }); render();
  const file = (name, values) => { const text = E.csv([headers, ...values]).replaceAll("'=literal()", '=literal()'); return { name, size: text.length, text: async () => text }; };
  const upload = values => ui.loadFile(file('original.csv', values));
  const change = (el, value) => { el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const prepare = () => {
    ui.openPreparation('explode'); const form = d.getElementById('valPreparationForm');
    change(form.elements.explodeMode, 'dependent'); change(form.elements.primary, '2'); form.querySelector('[name="mapped"][value="3"]').checked = true;
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); ui.applyPreparation();
  };
  const edit = (index, field, value, immediate = true) => { const el = d.querySelector(`[data-cell="${index}"][data-field="${field}"]`); el.value = value; el.dispatchEvent(new w.Event(immediate ? 'change' : 'input', { bubbles: true })); };
  const mode = value => ui.handle({ dataset: { val: 'mode', mode: value } });
  const context = () => { const s = ui.snapshot(); return { ...s, headers, steps: s.preparations, headerRow: 1, fileName: 'original.csv', sheet: 'Data' }; };
  return { w, d, E, T, F, ui, schema, upload, prepare, edit, mode, change, context, file, timers, downloads, writes: () => writes,
    account(value) { owner = value; ui.sync(); render(); }, state: () => state };
}

test('dependent mode detects grouped or positional values per row and copies exact same-parent identifiers and descriptions', async t => {
  const x = await fixture(t), before = plain(original), p = x.T.explode(headers, original, options);
  assert.deepEqual(plain(p.rows.map(r => r.slice(0,4))), [
    ['6.00007','Alpha','FF01','QA00'], ['6.00007','Alpha','FF01','QA01'], ['6.00007','Alpha','FF02','QA00'], ['6.00007','Alpha','FF03','QA00'],
    ['6.00007','Another source row','FF01','QA00'], ['6.00007','Another source row','FF02','QA01'], ['000001','Leading zero','FF03','QA02'],
  ]);
  assert.deepEqual(plain(p.parents.map(p => p.index)), [0,0,0,0,1,1,2]);
  assert.deepEqual(plain(p.formats), { Grouped: 2, 'Paired list': 1 });
  assert.equal(p.rows[5][4], '=literal()'); assert.deepEqual(original, before);
});

test('unknown, incomplete and ambiguous dependent rows block the whole preview without a guessed cross product', async t => {
  const { T } = await fixture(t);
  for (const [parent, child] of [
    ['FF01,FF02', '(FF01) QA00'], ['FF01', '(FF02) QA00'], ['FF01', 'text (FF01) QA00'],
    ['FF01', '(FF01)'], ['FF01', '(FF01)) QA00'], ['FF01', '(FF01) QA00,'],
    ['FF01', '[FF01] QA00'], ['FF01,FF01', 'QA00,QA01'], ['FF01', 'QA00,QA01'],
    ['FF01,FF02', 'QA00'], ['FF01,,FF03', '(FF01,FF03) QA00'],
  ]) {
    const p = T.explode(['Plant','Storage'], [[parent,child],['FF99','QA99']], { mode:'dependent', primary:0, mapped:[1] });
    assert.equal(p.blocked,true, parent + ' / ' + child); assert.equal(p.rows.length,0); assert.equal(p.warnings[0].index,0);
  }
  assert.deepEqual(plain(T.explode(['P','S'], [['A,B','X']], {mode:'dependent',primary:0,mapped:[1],repeatSingle:true}).rows), [['A','X'],['B','X']]);
  assert.throws(() => T.explode(['P','S','X'], [['A','B','C']], {mode:'dependent',primary:0,mapped:[1,2]}), /exactly one/);
});

test('dependent groups preserve repeated children and preflight large combinations before allocating the output', async t => {
  const { T } = await fixture(t), p = T.explode(['P','S'], [['A,B','(A) X, X, (A,B) Y']], {mode:'dependent',primary:0,mapped:[1]});
  assert.deepEqual(plain(p.rows), [['A','X'],['A','X'],['A','Y'],['B','Y']]);
  const parents = Array.from({length:100},(_,i)=>'P'+i).join(','), children = Array.from({length:300},(_,i)=>'S'+i).join(',');
  assert.throws(()=>T.explode(['P','S'], [[parents,'('+parents+') '+children]], {mode:'dependent',primary:0,mapped:[1]}), /Expansion exceeds/);
  const literal=T.explode(['P','S'],[['A;B','(A) X; Y; (B) Z']],{mode:'dependent',primary:0,mapped:[1],delimiter:';',trim:false});
  assert.deepEqual(plain(literal.rows),[['A',' X'],['A',' Y'],['B',' Z']]);
});

test('recombination groups by original source row, retains duplicates and compares full tuples rather than independent column lists', async t => {
  const { T } = await fixture(t), plan = T.explode(headers, original, options), origins = plan.parents.map(p=>({row:p.index+2,part:p.part})), steps = [{kind:'explode',options}];
  let report = T.recombine(headers, original, plan.rows, origins, steps);
  assert.equal(report.rows.length,3); assert.equal(report.matched,3);
  assert.equal(report.rows[0].values[1],'Alpha'); assert.equal(report.rows[1].values[1],'Another source row');
  assert.equal(report.rows[0].values[2],'FF01, FF02, FF03');
  assert.equal(report.rows[0].values[3],'(FF01) QA00, QA01, (FF02) QA00, (FF03) QA00');
  const corrected = plain(plan.rows); [corrected[4][3],corrected[5][3]] = [corrected[5][3],corrected[4][3]];
  report = T.recombine(headers, original, corrected, origins, steps);
  assert.equal(report.rows[1].status,'Not match'); assert.deepEqual(plain(report.rows[1].changed),[2,3]);
  assert.equal(report.rows[1].missing.length,2); assert.equal(report.rows[1].extra.length,2);
  const reordered = plan.rows.toReversed(), reverseOrigins = origins.toReversed();
  assert.equal(T.recombine(headers,original,reordered,reverseOrigins,steps).matched,3);
});

test('copied-field conflicts and missing/extra child counts are explicit; repeated material numbers never merge', async t => {
  const { T } = await fixture(t), plan = T.explode(headers, original, options), origins = plan.parents.map(p=>({row:p.index+2,part:p.part})), values = plain(plan.rows), steps=[{kind:'explode',options}];
  values[1][1] = 'Wrong description'; values.push(values[0].slice()); origins.push({...origins[0]});
  const report = T.recombine(headers,original,values,origins,steps);
  assert.equal(report.conflicts,1); assert.deepEqual(plain(report.rows[0].conflicts),[1]); assert.equal(report.rows[0].extra[0].count,1);
  assert.equal(report.rows[1].status,'Match'); assert.equal(report.rows[1].values[1],'Another source row');
  const missing = T.recombine(headers,original,values.slice(4,7),origins.slice(4,7),steps);
  assert.equal(missing.rows[0].status,'Missing records'); assert.equal(missing.rows[0].missing.reduce((n,x)=>n+x.count,0),4);
  assert.throws(()=>T.recombine(headers,original,values,[...origins.slice(0,-1),{row:99}],steps),/no original source/);
});

test('successive positional explosions retain one-line source identity and full combination relationships', async t => {
  const { T } = await fixture(t), h=['Material','Description','Plant','Storage','Sales'], values=[['001','Alpha','P1,P2','S1,S2','A|B']];
  const first={primary:2,mapped:[3]}, second={primary:4,mapped:[],delimiter:'|'}, p=T.explode(h,values,first), q=T.explode(h,p.rows,second);
  const origins=q.parents.map(x=>({row:p.parents[x.index].index+5,part:p.parents[x.index].part+'.'+x.part}));
  const r=T.recombine(h,values,q.rows,origins,[{kind:'explode',options:first},{kind:'explode',options:second}],4);
  assert.equal(r.matched,1); assert.equal(r.rows[0].tuples.length,4);
});

test('the UI previews mixed formats, validates seven rows, recombines three originals, highlights a conflicting description and exports all values', async t => {
  const x=await fixture(t); await x.upload(original); const writes=x.writes();
  x.prepare(); assert.equal(x.ui.snapshot().rows.length,7); assert.equal(x.writes(),writes); await x.ui.run();
  await x.mode('recombined'); assert.equal(x.d.querySelectorAll('[data-recombined-row]').length,3);
  assert.equal(x.d.querySelector('[data-recombined-row="0"] .val-recombined-status').textContent,'Match');
  await x.mode('check'); x.edit(1,'DESCRIPTION','A changed description'); await x.mode('recombined');
  assert.equal(x.d.querySelector('[data-recombined-row="0"] .val-recombined-status').textContent,'Conflict');
  assert.equal(x.d.querySelector('[data-recombined-row="1"] .val-recombined-status').textContent,'Match');
  assert.ok(x.d.querySelector('[data-recombined-row="0"] [data-recombined-field="1"]').classList.contains('error'));
  await x.ui.handle({dataset:{val:'recombined-detail',index:'0'}}); assert.match(x.d.querySelector('.val-recombined-detail').textContent,/A changed description/);
  await x.ui.handle({dataset:{val:'recombined-records',index:'0'}}); assert.equal(x.ui.snapshot().mode,'check');
  await x.mode('recombined'); await x.ui.handle({dataset:{val:'export-recombined'}});
  const {blob,name}=x.downloads[0]; assert.match(name,/-recombined-comparison.xlsx$/);
  const book=await x.F.read({name,size:blob.size,arrayBuffer:()=>blob.arrayBuffer(),},{valuesOnly:true});
  assert.deepEqual(plain(book.sheets.map(s=>s.name)),['Summary','Recombined data','Field comparison','Combination differences','Validated records']);
  assert.equal(book.sheets[1].rows.length,4); assert.match(book.sheets[1].rows[1][3],/A changed description/);
  const records=book.sheets[4].rows; assert.equal(records.length,8); assert.equal(records[2][2],'6.00007'); assert.equal(records[5][3],'Another source row'); assert.equal(records[5][6],'=literal()');
  const zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await blob.arrayBuffer()));
  assert.match(await zip.file('xl/worksheets/sheet2.xml').async('string'),/s="2"/);
  for(const f of Object.values(zip.files).filter(f=>/^xl\/worksheets\//.test(f.name))) assert.doesNotMatch(await f.async('string'),/<f[ >]/);
  assert.doesNotMatch(JSON.stringify(x.state()),/Alpha|Another source row|changed description/);
});

test('file replacement clears stale live input values and compares the new material and its description', async t => {
  const x=await fixture(t); await x.upload([['A','Alpha','P1','S1','']]); await x.ui.run();
  // Autofill/IME can leave a live DOM value ahead of its input event. A different
  // upload must never inherit that value just because its original default agrees.
  const input=x.d.querySelector('[data-cell="0"][data-field="DESCRIPTION"]'); input.value='Previous file text';
  await x.upload([['B','Alpha','P2','S2','']]); await x.ui.run();
  assert.equal(x.d.querySelector('[data-cell="0"][data-field="MATNR"]').value,'B');
  assert.equal(x.d.querySelector('[data-cell="0"][data-field="DESCRIPTION"]').value,'Alpha');
  assert.equal(x.ui.snapshot().sourceRows[0][1],'Alpha');
  await x.mode('recombined'); assert.equal(x.d.querySelector('.val-recombined-status').textContent,'Match');
});

test('recombined views and exports wait for live validation and cannot survive an account change', async t => {
  const x=await fixture(t); await x.upload(original); x.prepare(); await x.ui.run();
  x.edit(0,'DESCRIPTION','pending',false); await x.mode('recombined');
  assert.match(x.d.getElementById('valRecombined').textContent,/Checking your edit/);
  await assert.rejects(x.ui.handle({dataset:{val:'export-recombined'}}),/wait for current edits/);
  for(const fn of [...x.timers.values()]) fn();
  assert.ok(x.d.querySelector('[data-recombined-row]'));
  x.w.WorkHubCurrentAccess={can:(_,action)=>action!=='export'};
  await assert.rejects(x.ui.handle({dataset:{val:'export-recombined'}}),/disabled/);
  x.w.WorkHubCurrentAccess={can:()=>true};
  await x.ui.handle({dataset:{val:'recombined-detail',index:'0'}});
  const pending=x.ui.handle({dataset:{val:'export-recombined'}}); x.account('another'); await pending;
  assert.equal(x.downloads.length,0); assert.doesNotMatch(x.d.getElementById('modalBody').textContent,/Alpha|pending/);
});

test('Excel numeric identifiers use their explicit display precision or equivalent encoding while literal text, leading zeros and long IDs stay exact', async t => {
  const x=await fixture(t), values=[['6.00007','Formatted','P1','S1',''],['000001','Leading','P2','S2',''],['12345678901234567890','Long','P3','S3',''],['6.000069999998','Literal text','P4','S4',''],['6.00007','Encoding','P5','S5','']];
  const base=await x.F.workbook([{name:'Materials',rows:[headers,...values]}]), zip=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await base.arrayBuffer()));
  zip.file('xl/styles.xml',(await zip.file('xl/styles.xml').async('string')).replace('formatCode="yyyy-mm-dd"','formatCode="0.00000"'));
  const path='xl/worksheets/sheet1.xml'; let xml=await zip.file(path).async('string');
  xml=xml.replace(/<c r="A2"[^>]*>.*?<\/c>/s,'<c r="A2" s="5"><v>6.000069999998</v></c>').replace(/<c r="A6"[^>]*>.*?<\/c>/s,'<c r="A6" s="4"><v>6.0000699999999996</v></c>');
  zip.file(path,xml); const bytes=await zip.generateAsync({type:'uint8array'}), file={name:'numeric-materials.xlsx',size:bytes.length,arrayBuffer:async()=>bytes};
  assert.equal((await x.F.read(file)).sheets[0].rows[1][0],'6.000069999998');
  await x.ui.loadFile(file); assert.deepEqual(plain(x.ui.snapshot().sourceRows.map(r=>r[0])), values.map(r=>r[0]));
  await x.ui.run(); await x.ui.handle({dataset:{val:'report'}});
  const blob=x.downloads[0].blob, report=await x.F.read({name:'report.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});
  assert.deepEqual(plain(report.sheets[0].rows.slice(1).map(r=>r[0])),values.map(r=>r[0]));
  const exported=await x.w.JSZip.loadAsync(new x.w.Uint8Array(await blob.arrayBuffer()));
  assert.match(await exported.file('xl/worksheets/sheet1.xml').async('string'),/<c r="A2"[^>]*t="inlineStr"/);
  await x.ui.handle({dataset:{val:'clear-file'}});
  await x.ui.addQueueFiles([file,x.file('other.csv',[['002','Other file','P1','S1','']])]);
  const jobs=x.ui.snapshot().queue; x.ui.confirmQueueJob(); await x.ui.run();
  await x.ui.openQueueJob(jobs[1].id); x.ui.confirmQueueJob(); await x.ui.run();
  await x.ui.openQueueJob(jobs[0].id);
  assert.deepEqual(plain(x.ui.snapshot().originalRows.map(r=>r[0])),values.map(r=>r[0]));
  assert.deepEqual(plain(x.ui.snapshot().sourceRows.map(r=>r[0])),values.map(r=>r[0]));
});

test('a numeric General Material column exports exact identifier text, while numeric measure columns keep their type', async t => {
  const {E,F,w}=await fixture(t), schema=E.create('Numeric template');
  schema.columns=[{...E.column(0),key:'MATNR',label:'Material',type:'decimal'},{...E.column(1),key:'AMOUNT',label:'Amount',type:'decimal'}];
  const rows=[{MATNR:'0006.00007',AMOUNT:'12.25'}], outcome=E.validateRows(schema,rows), blob=await F.issueReport(schema,rows,outcome), zip=await w.JSZip.loadAsync(new w.Uint8Array(await blob.arrayBuffer())), xml=await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(xml,/<c r="A2"[^>]*t="inlineStr"[^>]*>.*?0006\.00007/s); assert.match(xml,/<c r="B2"[^>]*><v>12\.25<\/v>/);
});

test('recombined filters page original rows and export remains complete', async t => {
  const x=await fixture(t), values=Array.from({length:25},(_,i)=>[String(i),'Description '+i,'P1,P2','S1,S2','']);
  await x.upload(values); x.prepare(); await x.ui.run(); await x.mode('recombined');
  assert.equal(x.d.querySelectorAll('[data-recombined-row]').length,20);
  await x.ui.handle({dataset:{val:'recombined-page',delta:'1'}}); assert.equal(x.d.querySelector('[data-recombined-row]').dataset.recombinedRow,'20');
  x.change(x.d.querySelector('[name="recombinedFilter"]'),'changes'); assert.equal(x.d.querySelectorAll('[data-recombined-row]').length,0);
  await x.ui.handle({dataset:{val:'export-recombined'}}); const blob=x.downloads[0].blob, book=await x.F.read({name:'all.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});
  assert.equal(book.sheets.find(s=>s.name==='Recombined data').rows.length,26); assert.equal(book.sheets.find(s=>s.name==='Validated records').rows.length,51);
});

test('queue restores mixed-format preparations, corrections and descriptions only for their owning file', async t => {
  const x=await fixture(t), first=x.file('first.csv',original), second=x.file('second.csv',[['6.00007','Second file description','FF01,FF02','QA00,QA01','002']]);
  await x.ui.addQueueFiles([first,second]); const jobs=x.ui.snapshot().queue;
  x.prepare(); x.ui.confirmQueueJob(); await x.ui.run(); x.edit(1,'DESCRIPTION','First file correction');
  await x.ui.openQueueJob(jobs[1].id); x.prepare(); x.ui.confirmQueueJob(); await x.ui.run();
  assert.equal(x.ui.snapshot().sourceRows[0][1],'Second file description');
  await x.ui.openQueueJob(jobs[0].id); assert.equal(x.ui.snapshot().sourceRows.length,7); assert.equal(x.ui.snapshot().sourceRows[1][1],'First file correction');
  assert.equal(x.d.querySelector('[data-cell="1"][data-field="DESCRIPTION"]').value,'First file correction');
  await x.mode('recombined'); assert.equal(x.d.querySelectorAll('[data-recombined-row]').length,3); assert.match(x.d.querySelector('[data-recombined-row="0"]').textContent,/First file correction/);
  assert.doesNotMatch(x.d.getElementById('valRecombined').textContent,/Second file description/);
  await x.ui.openQueueJob(jobs[1].id); await x.mode('recombined');
  assert.equal(x.d.querySelectorAll('[data-recombined-row]').length,1); assert.equal(x.d.querySelector('.val-recombined-status').textContent,'Match'); assert.match(x.d.getElementById('valRecombined').textContent,/Second file description/);
});

test('dependent expansion and recombination cover 12,000 originals and reject output beyond 25,000 records', async t => {
  const {T}=await fixture(t), values=Array.from({length:12000},(_,i)=>['000'+i,'Description '+i,'FF01,FF02','(FF01,FF02) QA00','extra '+i]);
  const p=T.explode(headers,values,options); assert.equal(p.rows.length,24000);
  const r=T.recombine(headers,values,p.rows,p.parents.map(p=>({row:p.index+2,part:p.part})),[{kind:'explode',options}]);
  assert.equal(r.matched,12000); assert.equal(r.rows.at(-1).values[1],'Description 11999');
  assert.throws(()=>T.explode(headers,Array.from({length:12501},()=>values[0]),options),/25,000 rows/);
});

test('oversized recombined conflict cells retain every exact child value in the report, including CR and OOXML-like text', async t => {
  const {T,F}=await fixture(t), values=[['001','Original','A,B','X,Y','Literal _x000D_\rvalue']], p=T.explode(headers,values,options), origins=p.parents.map(x=>({row:2,part:x.part}));
  p.rows[0][1]='a'.repeat(20000)+'\r'; p.rows[1][1]='b'.repeat(20000)+'\n';
  const report=T.recombine(headers,values,p.rows,origins,[{kind:'explode',options}]), blob=await F.recombinedReport(report,{fileName:'long.csv',sheet:'Data',sourceRows:p.rows,origins}), book=await F.read({name:'long.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()},{valuesOnly:true});
  assert.match(book.sheets.find(s=>s.name==='Recombined data').rows[1][3],/Full values: Validated records/);
  const children=book.sheets.find(s=>s.name==='Validated records').rows.slice(1);
  assert.equal(children[0][3],p.rows[0][1]); assert.equal(children[1][3],p.rows[1][1]); assert.equal(children[0][6],values[0][4]);
});
