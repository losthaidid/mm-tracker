import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function formulaFile(x, cells, headers = ['Lookup','Zero','Blank','Boolean','Array','Shared','Error','Date']) {
  const zip = new x.w.JSZip();
  zip.file('xl/workbook.xml','<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" r:id="r1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels','<Relationships><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/sharedStrings.xml','<sst><si><t>0007</t></si></sst>');
  zip.file('xl/styles.xml','<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/></cellXfs></styleSheet>');
  zip.file('xl/worksheets/sheet1.xml','<worksheet><sheetData><row r="1">'+headers.map((v,i)=>'<c r="'+x.F.col(i)+'1" t="inlineStr"><is><t>'+v+'</t></is></c>').join('')+'</row><row r="2">'+cells+'</row></sheetData></worksheet>');
  const bytes = await zip.generateAsync({type:'uint8array'});
  return {name:'formulas.xlsx',size:bytes.length,arrayBuffer:async()=>bytes.buffer};
}

function fixture(t, { templates = false, writer } = {}) {
  const dom = new JSDOM('<div id="view"></div>', { url: 'https://example.test', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate });
  for (const file of ['vendor/jszip.min.js', 'validator-engine.js', 'validator-files.js', 'validator-compare-engine.js']) w.eval(read(file));
  const E = w.WorkHubValidatorEngine, F = w.WorkHubValidatorFiles, C = w.WorkHubValidatorCompareEngine;
  if (writer) w.WorkHubValidatorFiles = { ...F, workbook: writer };
  for (const file of ['validator-compare.js', 'validator-studio.js']) w.eval(read(file));
  let owner = 'owner', ready = true, writes = 0, ui, state = { projects: [], projectCompanies: [], workhub: { validator: { templates: templates ? [E.example()] : [], runs: [] } } };
  const downloads = [], render = () => { if (!ui.patchRender()) d.getElementById('view').innerHTML = ui.render(); };
  ui = w.WorkHubValidatorStudio.install({
    state: () => state, owner: () => owner, ready: () => ready, render, tell() {},
    mutate(fn) { const next = E.copy(state); fn(next); E.prepare(next, state); E.validateState(next); state = next; writes++; render(); return true; },
    download(blob, name) { downloads.push({ blob, name }); },
  });
  render();
  const compare = ui.fileComparison;
  const change = (selector, val) => {
    const el = typeof selector === 'string' ? d.querySelector(selector) : selector;
    assert.ok(el, selector);
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = val; else el.value = val;
    el.dispatchEvent(new w.Event('change', { bubbles: true }));
  };
  const open = () => ui.handle({ dataset: { val: 'mode', mode: 'file-compare' } });
  const upload = (side, rows, name = side + '.csv') => { const text = E.csv(rows).replaceAll("'=SUM", '=SUM'); return compare.loadFile(side, { name, size: text.length, text: async () => text }); };
  const source = (rows, settings = {}, extra = {}) => ({ ...C.selected(C.sheet({ sheets: [{ name: 'Data', rows }] }), settings), fileName: 'test.csv', ...extra });
  return { w, d, E, F, C, ui, compare, change, open, upload, source, downloads,
    writes: () => writes, state: () => state,
    account(next, active = true) { owner = next; ready = active; ui.sync(); render(); } };
}

test('left skip counts start at Column A, work independently, and ignore excluded values', async t => {
  const x = fixture(t), a = [['Ignore', 'Metadata', 'ID', 'Quantity'], ['any', 'old', '0001', '7']],
    b = [['Note', 'ID', 'Quantity'], ['different', '0001', '7']];
  const before = copy([a, b]);
  assert.deepEqual(copy(x.source(a).columns), [0,1,2,3]);
  const report = await x.C.compare(x.source(a, { count: 2 }), x.source(b, { count: 1 }));
  assert.equal(report.match, true); assert.equal(report.matchingCells, 2); assert.equal(report.matchingRows, 1);
  assert.deepEqual(copy(report.columns.map(c => [c.a, c.b])), [[2,1],[3,2]]);
  assert.deepEqual([a,b], before);
  for (const count of [-1, 0.5, 4, '', 'bad']) assert.throws(() => x.source(a, { count }), /whole skip count/);
});

test('checkbox mode skips nonadjacent columns and never combines with the count method', async t => {
  const x = fixture(t), rows = [['ID', 'Skip', 'Quantity', 'Skip', 'Plant'], ['1','x','2','y','P1']];
  const left = x.source(rows, { mode: 'checkboxes', count: 4, skipped: [1,3] });
  assert.deepEqual(copy(left.columns), [0,2,4]);
  assert.deepEqual(copy(x.source(rows, { mode: 'count', count: 1, skipped: [1,3] }).columns), [1,2,3,4]);
  assert.equal((await x.C.compare(left, x.source([['ID','Quantity','Plant'], ['1','2','P1']]))).match, true);
  assert.throws(() => x.source(rows, { mode: 'checkboxes', skipped: [0,1,2,3,4] }), /at least one/);
  assert.throws(() => x.source(rows, { mode: 'checkboxes', skipped: [99] }), /current worksheet/);
});

test('exact comparison distinguishes spaces, case, leading zeros, header differences and absent blank cells', async t => {
  const x = fixture(t), a = x.source([['Code','Text','Blank'], ['001',' A ',''], ['2','x','']]),
    b = x.source([['code','Text','Blank'], ['1','a',''], ['2','x',''], ['3','','']]);
  const r = await x.C.compare(a,b);
  assert.equal(r.match, false); assert.equal(r.headerDifferences, 1);
  assert.equal(r.differentRows, 2); assert.equal(r.matchingRows, 1); assert.equal(r.differentCells, 5);
  assert.deepEqual(copy(x.C.cell(r, 2, 2)), { a: '', b: '', hasA: false, hasB: true, match: false });
  assert.equal(x.C.cell(r, 0, 2).match, true);
  const columns = await x.C.compare(x.source([['ID'], ['1']]), x.source([['ID','Extra'], ['1','']]));
  assert.equal(columns.headerDifferences, 1); assert.equal(columns.differentCells, 1);
  assert.equal(x.C.cell(columns, 0, 1).match, false);
  const headersOnly = await x.C.compare(x.source([['ID']]), x.source([['Other']]));
  assert.equal(headersOnly.match, false); assert.equal(headersOnly.rowCount, 0);
});

test('worksheet/header selection retains blank positions, duplicate headers and data under an unnamed column', t => {
  const x = fixture(t), book = { sheets: [{ name: 'Notes', rows: [['Notes']] }, { name: 'Actual', rows: [
    ['Title'], ['ID','ID',''], ['A','B','extra'], [], ['C','D',''], [],
  ] }] };
  const s = x.C.sheet(book, 1, 2);
  assert.equal(s.sheet, 'Actual'); assert.equal(s.headerRow, 2); assert.equal(s.rows.length, 3);
  assert.deepEqual(copy(s.headers), ['ID','ID','']); assert.deepEqual(copy(s.rows[1]), []);
  assert.throws(() => x.C.sheet(book,1,0), /header row/); assert.throws(() => x.C.sheet(book,1,4), /empty/);
  assert.throws(() => x.C.sheet(book,4,1), /worksheet/);
});

test('full-width comparison includes 12,001 records and differences beyond the issue listing limit', async t => {
  const x = fixture(t), header = Array.from({ length: 200 }, (_,i) => 'Field ' + i), common = header.map(() => 'value'),
    a = [header, ...Array.from({ length: 12001 }, () => common)], b = a.slice();
  b[12001] = common.slice(); b[12001][199] = 'changed';
  const r = await x.C.compare(x.source(a), x.source(b));
  assert.equal(r.rowCount, 12001); assert.equal(r.differentCells, 1); assert.equal(r.rowDifferences[12000], 1);
  assert.equal(x.C.cell(r,12000,199).b, 'changed'); assert.equal(r.matchingCells, 2400199);
});

test('comparison opens without any saved template, reads both headers and reports selected values', async t => {
  const x = fixture(t); await x.open();
  assert.ok(x.d.getElementById('vfcFileA')); assert.ok(x.d.getElementById('vfcFileB'));
  await x.upload('A', [['Skip','ID','Value'], ['a','001','Alpha'], ['b','002','Beta']]);
  await x.upload('B', [['Skip1','Skip2','ID','Value'], ['x','y','001','Alpha'], ['x','y','002','Changed']]);
  x.change('[name="vfcCountA"]', '1'); x.change('[name="vfcCountB"]', '2');
  assert.match(x.d.getElementById('vfcAlignment').textContent, /B · ID/);
  await x.compare.run();
  assert.match(x.d.getElementById('vfcReportTitle').textContent, /do not match/);
  assert.equal(x.d.querySelectorAll('.vfc-row-grid tbody tr').length, 1);
  assert.match(x.d.getElementById('vfcFields').textContent, /Beta/); assert.match(x.d.getElementById('vfcFields').textContent, /Changed/);
  assert.equal(x.writes(), 0); assert.deepEqual(copy(x.state().workhub.validator), { templates: [], runs: [] });
});

test('switching skip methods, checkbox changes and invalid counts clear old reports and require a fresh comparison', async t => {
  const x = fixture(t); await x.open();
  const rows = [['Skip','ID','Ignore','Value'], ['x','001','different','A']];
  await x.upload('A', rows); await x.upload('B', rows); await x.compare.run();
  x.change('[name="vfcModeA"][value="checkboxes"]', true);
  assert.equal(x.d.getElementById('vfcReport'), null);
  x.change('[data-vfc-skip="0"][data-side="A"]', true); x.change('[data-vfc-skip="2"][data-side="A"]', true);
  x.change('[name="vfcModeB"][value="checkboxes"]', true);
  x.change('[data-vfc-skip="0"][data-side="B"]', true); x.change('[data-vfc-skip="2"][data-side="B"]', true);
  await x.compare.run(); assert.equal(x.compare.snapshot().result.match, true);
  x.change('[name="vfcModeA"][value="count"]', true); x.change('[name="vfcCountA"]', '4');
  assert.equal(x.d.querySelector('[data-vfc="run"]').disabled, true);
  assert.match(x.d.querySelector('[data-vfc-side="A"]').textContent, /whole skip count/);
});

test('typing a skip count updates alignment immediately and an unchanged blur keeps the new report', async t => {
  const x = fixture(t); await x.open();
  await x.upload('A',[['Skip','ID'],['A','1']]); await x.upload('B',[['ID'],['1']]);
  const input = x.d.querySelector('[name="vfcCountA"]'); input.value = '1';
  input.dispatchEvent(new x.w.Event('input',{bubbles:true}));
  assert.match(x.d.querySelector('[data-vfc-side="A"] .vfc-selection-summary').textContent,/1 skipped/);
  assert.match(x.d.getElementById('vfcAlignment').textContent,/1 in A \/ 1 in B/);
  await x.compare.run(); const report = x.compare.snapshot().result; assert.equal(report.match,true);
  input.dispatchEvent(new x.w.Event('change',{bubbles:true})); assert.equal(x.compare.snapshot().result,report);
});

test('report pagination, row inspection and exported XML cover every record regardless of screen filter', async t => {
  const x = fixture(t); await x.open();
  const a = [['ID','Text'], ...Array.from({length: 31}, (_,i) => ['00'+i, i === 0 ? '=SUM(1)' : '<b>Record '+i+'</b>'])], b = copy(a);
  b[31][1] = 'DIFFERENT';
  await x.upload('A',a); await x.upload('B',b); await x.compare.run();
  assert.equal(x.d.querySelectorAll('.vfc-row-grid tbody tr').length,1);
  x.change('[data-vfc-filter]','all'); await x.compare.handle({dataset:{vfc:'page',delta:'1'}});
  assert.equal(x.d.querySelectorAll('.vfc-row-grid tbody tr').length,6);
  await x.compare.handle({dataset:{vfc:'row',row:'30'}}); assert.match(x.d.getElementById('vfcFieldsTitle').textContent,/31/);
  x.change('[data-vfc-filter]','different'); await x.compare.exportReport();
  assert.equal(x.downloads.length,1);
  const zip = await x.w.JSZip.loadAsync(new x.w.Uint8Array(await x.downloads[0].blob.arrayBuffer()), {checkCRC32:true});
  const xml = await zip.file('xl/worksheets/sheet4.xml').async('string'), doc = new x.w.DOMParser().parseFromString(xml,'application/xml');
  assert.equal(doc.querySelectorAll('sheetData > row').length,32); assert.equal(doc.querySelectorAll('f').length,0);
  assert.match(doc.documentElement.textContent,/=SUM\(1\)/); assert.match(doc.documentElement.textContent,/<b>Record 29<\/b>/);
  assert.match(xml,/s="2"[^>]*><is><t xml:space="preserve">DIFFERENT/);
  assert.equal(x.d.querySelector('#vfcFields .vfc-value b'),null);
});

test('comparison preserves an existing validation upload, results and mapping without saving comparison data', async t => {
  const x = fixture(t,{templates:true});
  await x.ui.loadSample();
  await x.ui.run();
  const before = x.ui.snapshot(), writes = x.writes(); await x.open();
  await x.upload('A',[['ID'],['A']]); await x.upload('B',[['ID'],['B']]); await x.compare.run();
  await x.ui.handle({dataset:{val:'mode',mode:'check'}});
  const after = x.ui.snapshot();
  for(const key of ['rows','sourceRows','originalRows','preparedRows','origins','result','mapping','draft']) assert.deepEqual(after[key], before[key], key);
  assert.equal(x.writes(),writes); assert.doesNotMatch(JSON.stringify(x.state()),/A\.csv|B\.csv/);
  await x.open(); assert.equal(x.compare.snapshot().result.match,false);
});

test('racing uploads, clearing and account changes prevent stale files from entering another comparison', async t => {
  const x = fixture(t); await x.open();
  const old = deferred(), oldRead = x.compare.loadFile('A',{name:'old.csv',size:5,text:()=>old.promise});
  await x.upload('A',[['ID'],['NEW']]); old.resolve('ID\nOLD'); await oldRead;
  assert.equal(x.compare.snapshot().files.A.name,'A.csv');
  const pending = deferred(), loading = x.compare.loadFile('B',{name:'pending.csv',size:5,text:()=>pending.promise});
  await x.compare.handle({dataset:{vfc:'clear'}}); pending.resolve('ID\nOLD'); await loading;
  assert.equal(x.compare.snapshot().files.B.name,'');
  const owner = deferred(), ownerRead = x.compare.loadFile('A',{name:'private.csv',size:5,text:()=>owner.promise});
  x.account('another'); owner.resolve('ID\nPRIVATE'); await ownerRead;
  assert.equal(x.compare.snapshot().files.A.name,''); assert.doesNotMatch(x.d.body.textContent,/PRIVATE|private.csv/);
});

test('cancelled comparisons and stale exports cannot reappear after clearing or switching accounts', async t => {
  const output = deferred(), x = fixture(t,{writer:()=>output.promise}); await x.open();
  await x.upload('A',[['ID'],['1']]); await x.upload('B',[['ID'],['1']]);
  const pause = deferred(), original = x.w.setTimeout; x.w.setTimeout = fn => { pause.promise.then(fn); return 1; };
  const run = x.compare.run(); await x.compare.handle({dataset:{vfc:'cancel'}}); pause.resolve(); await run;
  assert.equal(x.compare.snapshot().result,null); assert.match(x.d.body.textContent,/Comparison cancelled/);
  x.w.setTimeout = original; await x.compare.run();
  const exporting = x.compare.exportReport(); x.account('another'); output.resolve(new Blob(['report'])); await exporting;
  assert.equal(x.downloads.length,0); assert.equal(x.compare.snapshot().result,null);
});

test('existing run and export permissions protect standalone comparison actions', async t => {
  const x = fixture(t); await x.open();
  await x.upload('A',[['ID'],['1']]); await x.upload('B',[['ID'],['1']]);
  let allowed = true; x.w.WorkHubCurrentAccess = {can:(feature,action)=> action === 'run' ? allowed : false};
  await x.compare.run(); await assert.rejects(x.compare.exportReport(),/permission.*export/);
  allowed = false; await assert.rejects(x.compare.run(),/permission.*compare/);
  x.account('',false); assert.equal(x.compare.snapshot().result,null);
});

test('XLOOKUP and other formula cells compare and export saved values, including blanks, zero, shared/array results and errors', async t => {
  const x = fixture(t), headers = ['Lookup','Zero','Blank','Boolean','Array','Shared','Error','Date'];
  const file = await formulaFile(x,
    '<c r="A2" t="str"><f>_xlfn.XLOOKUP(A1,Other!A:A,Other!B:B)</f><v>Found</v></c>'+
    '<c r="B2"><f>SUM(0,0)</f><v>0</v></c>'+
    '<c r="C2" t="str"><f>IF(1=1,&quot;&quot;,&quot;x&quot;)</f><v/></c>'+
    '<c r="D2" t="b"><f>FALSE()</f><v>0</v></c>'+
    '<c r="E2"><f t="array" ref="E2:E2">SEQUENCE(1)</f><v>1</v></c>'+
    '<c r="F2" t="s"><f t="shared" si="0"/><v>0</v></c>'+
    '<c r="G2" t="e"><f>NA()</f><v>#N/A</v></c>'+
    '<c r="H2" s="1"><f>DATE(2024,1,1)</f><v>45292</v></c>');
  await assert.rejects(x.F.read(file),/contains a formula/);
  const values = ['Found','0','','false','1','0007','#N/A','2024-01-01'];
  const book = await x.F.read(file,{valuesOnly:true}); assert.deepEqual(copy(book.sheets[0].rows[1]),values);
  assert.doesNotMatch(JSON.stringify(book),/_xlfn|SUM\(|SEQUENCE/);
  await x.open(); await x.compare.loadFile('A',file); await x.upload('B',[headers,values]); await x.compare.run();
  assert.equal(x.compare.snapshot().result.match,true); await x.compare.exportReport();
  const zip = await x.w.JSZip.loadAsync(new x.w.Uint8Array(await x.downloads[0].blob.arrayBuffer()),{checkCRC32:true});
  const xml = await zip.file('xl/worksheets/sheet4.xml').async('string');
  assert.match(xml,/Found/); assert.match(xml,/0007/); assert.match(xml,/#N\/A/); assert.doesNotMatch(xml,/<f[ >]|_xlfn|SUM\(/);
});

test('formulas without saved values fail with a cell address instead of silently comparing as blanks', async t => {
  const x = fixture(t);
  for (const cells of ['<c r="A2"><f>SUM(1,2)</f></c>', '<c r="A2"><f>SUM(1,2)</f><v/></c>']) {
    const file = await formulaFile(x,cells,['Result']);
    await assert.rejects(x.F.read(file,{valuesOnly:true}),/Data!A2.*without a saved result.*Recalculate/);
  }
  const file = await formulaFile(x,'<c r="A2" t="e"><v>#N/A</v></c>',['Result']);
  await assert.rejects(x.F.read(file),/contains an Excel error/);
  assert.equal((await x.F.read(file,{valuesOnly:true})).sheets[0].rows[1][0],'#N/A');
});

test('worksheet/header changes read real headers, reset exclusions and require a fresh report', async t => {
  const x = fixture(t); await x.open();
  const blob = await x.F.workbook([{name:'Notes',rows:[['Read me']]},{name:'Actual',rows:[['Title'],['Skip','ID'],['anything','001']]}]);
  await x.compare.loadFile('A',{name:'multi.xlsx',size:blob.size,arrayBuffer:()=>blob.arrayBuffer()});
  x.change('[name="vfcSheetA"]','1'); x.change('[name="vfcHeaderA"]','2');
  x.change('[name="vfcModeA"][value="checkboxes"]',true); x.change('[data-vfc-skip="0"][data-side="A"]',true);
  await x.upload('B',[['ID'],['001']]); await x.compare.run();
  assert.equal(x.compare.snapshot().result.match,true);
  assert.equal(x.compare.snapshot().result.a.headerRow,2); assert.equal(x.compare.snapshot().result.a.sheet,'Actual');
  x.change('[name="vfcHeaderA"]','1'); assert.equal(x.d.getElementById('vfcReport'),null);
  assert.equal(x.d.querySelector('[data-vfc-skip="0"][data-side="A"]').checked,false);
});
