import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
function engine(t) {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://example.test/' });
  t.after(() => dom.window.close());
  dom.window.eval(source('validator-engine.js'));
  dom.window.eval(source('excel-report-engine.js'));
  return dom.window.WorkHubExcelReportEngine;
}
function fixture(t) {
  const dom = new JSDOM('<body><div id="view"></div></body>', { runScripts: 'outside-only', url: 'https://example.test/', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document, blobs = [];
  Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate });
  w.URL.createObjectURL = blob => { blobs.push(blob); return 'blob:local-' + blobs.length; };
  w.URL.revokeObjectURL = () => {};
  for (const file of ['vendor/jszip.min.js', 'vendor/ssf.js', 'validator-engine.js', 'validator-files.js', 'vendor/sheetjs/xlsx.full.min.js', 'excel-report-engine.js', 'excel-report.js']) w.eval(source(file));
  let ready = true, owner = 'one', writes = 0, run = true, exportable = true;
  w.WorkHubCurrentAccess = { can: (_, action) => action === 'run' ? run : action === 'export' ? exportable : true };
  let ui;
  const render = () => { d.getElementById('view').innerHTML = ui.render(); };
  ui = w.WorkHubExcelReport.install({ ready: () => ready, owner: () => owner, render, mutate() { writes++; } });
  render();
  function file(bytes, name = 'source.xlsx') {
    const data = new Uint8Array(bytes);
    return { name, size: data.byteLength, arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
  }
  function workbook() {
    const book = w.XLSX.utils.book_new();
    const sheet = w.XLSX.utils.aoa_to_sheet([
      ['Example report', '', ''],
      ['Code', 'Customer', 'Status'],
      [7, 'Alpha', 'Open'],
      [8, 'Beta', 'Closed'],
      [7, 'Gamma', 'Open'],
    ]);
    sheet.A3.z = sheet.A4.z = sheet.A5.z = '000000';
    w.XLSX.utils.book_append_sheet(book, sheet, 'First sheet');
    w.XLSX.utils.book_append_sheet(book, w.XLSX.utils.aoa_to_sheet([['Other'], ['value']]), 'Second sheet');
    return file(w.XLSX.write(book, { bookType: 'xlsx', type: 'array' }));
  }
  const input = (id, value, type = 'input') => { const el = d.getElementById(id); el.value = value; el.dispatchEvent(new w.Event(type, { bubbles: true })); };
  return { w, d, ui, render, file, workbook, input, blobs, writes: () => writes,
    setOwner(value) { owner = value; ui.sync(); render(); },
    setReady(value) { ready = value; ui.sync(); render(); },
    setRun(value) { run = value; },
    setExport(value) { exportable = value; },
  };
}

test('Excel Report preserves positions, blank and duplicate headers, and Excel row numbers', t => {
  const E = engine(t);
  const report = E.createReport({ name: 'Data', rows: [['Title'], ['Code', '', 'Code'], ['000001', 'x', 'A'], ['000002', 'y', 'B']] }, 2);
  assert.equal(report.headerRow, 2);
  assert.deepEqual(copy(report.columns.map(c => [c.letter, c.label, c.header])), [['A','Code','Code'],['B','(blank header)',''],['C','Code','Code']]);
  assert.deepEqual(copy(report.rows), [['000001','x','A'],['000002','y','B']]);
  assert.throws(() => E.createReport({ rows: [['x']] }, 2), /header row/);
});

test('Excel Report marks each pasted value against all source rows and intersects filters without changing values', t => {
  const E = engine(t);
  const report = E.createReport({ name: 'Data', rows: [['Code','State'], ['000001','Open'], ['000001','OPEN'], ['000002','Closed']] }, 1);
  const filters = [
    { column: 0, caseSensitive: false, values: E.parseList('000001\n000099\n000001') },
    { column: 1, caseSensitive: false, values: E.parseList('closed\topen') },
  ];
  const result = E.evaluate(report, filters);
  assert.deepEqual(copy(result.rows), [0,1]);
  assert.deepEqual(copy(result.filters[0].values), [{value:'000001',count:2},{value:'000099',count:0},{value:'000001',count:2}]);
  assert.deepEqual(copy(result.filters[1].values), [{value:'closed',count:1},{value:'open',count:2}]);
  assert.equal(result.filters[0].found, 2);
  assert.equal(result.filters[0].missing, 1);
  assert.deepEqual(copy(report.rows), [['000001','Open'], ['000001','OPEN'], ['000002','Closed']]);
  const exact = E.evaluate(report, [{ column: 1, caseSensitive: true, values: E.parseList('Open') }]);
  assert.deepEqual(copy(exact.rows), [0]);
  assert.throws(() => E.parseList('\n \t'), /at least one/);
  assert.throws(() => E.parseList('x\n'.repeat(25001)), /25,000/);
});

test('Excel Report reads formatted XLSX values, searches headers, filters multiple columns and exports full results', async t => {
  const x = fixture(t), { w, d, ui, input } = x;
  await ui.loadFile(x.workbook());
  assert.equal(ui.snapshot().filename, 'source.xlsx');
  input('erHeaderRow', '2', 'change');
  assert.equal(ui.snapshot().headerRow, 2);
  assert.match(d.getElementById('valExcelReport').textContent, /Code/);
  input('erColumnSearch', 'cust');
  assert.equal(d.querySelectorAll('[data-er-column]').length, 1);
  assert.match(d.querySelector('[data-er-column]').parentElement.textContent, /Customer/);
  await ui.handle({ dataset: { er: 'clear-shown' } });
  assert.deepEqual(copy(ui.snapshot().selected), [0,2]);
  input('erColumnSearch', '');
  input('erList', '000007\n000099');
  await ui.handle({ dataset: { er: 'apply-filter' } });
  assert.deepEqual(copy(ui.snapshot().rows), [0,2]);
  assert.deepEqual(copy(ui.snapshot().filters[0].values), [{value:'000007',count:2},{value:'000099',count:0}]);
  assert.match(d.querySelector('.er-results-card').textContent, /Not found/);
  input('erFilterColumn', '2', 'change');
  input('erList', 'open\nclosed');
  await ui.handle({ dataset: { er: 'apply-filter' } });
  assert.deepEqual(copy(ui.snapshot().rows), [0,2]);
  assert.deepEqual(copy(ui.snapshot().filters[1].values), [{value:'open',count:2},{value:'closed',count:1}]);
  await ui.prepareExport();
  assert.equal(x.blobs.length, 1);
  const saved = await w.WorkHubValidatorFiles.read(x.file(new Uint8Array(await x.blobs[0].arrayBuffer()), 'output.xlsx'), { displayValues: true });
  assert.deepEqual(copy(saved.sheets.map(s => s.name)), ['Report','List results']);
  assert.deepEqual(copy(saved.sheets[0].rows), [['Code','Status'],['000007','Open'],['000007','Open']]);
  assert.deepEqual(copy(saved.sheets[1].rows.slice(0,3)), [
    ['Column','Pasted value','Result','Matching source rows','Case sensitive'],
    ['A · Code','000007','Found','2','No'],
    ['A · Code','000099','Not found','0','No'],
  ]);
  assert.equal(x.writes(), 0);
});

test('Excel Report keeps a previous file after read failure and clears private state when the account changes', async t => {
  const x = fixture(t);
  await x.ui.loadFile(x.workbook());
  await assert.rejects(x.ui.loadFile(x.file([1,2,3], 'broken.xlsx')));
  assert.equal(x.ui.snapshot().filename, 'source.xlsx');
  x.setOwner('two');
  assert.equal(x.ui.snapshot().filename, '');
  assert.deepEqual(copy(x.ui.snapshot().filters), []);
  x.setRun(false);
  await assert.rejects(x.ui.loadFile(x.workbook()), /cannot run/);
  assert.equal(x.writes(), 0);
});

test('Excel Report supports live partial text and safe wildcard matching alongside pasted filters', async t => {
  const x = fixture(t), { w, d, ui, input } = x;
  await ui.loadFile(x.workbook()); input('erHeaderRow','2','change');
  input('erLiveColumn','1','change'); input('erLiveText','a*p?a');
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.deepEqual(copy(ui.snapshot().rows), [0]);
  input('erList', '000007\n000099'); await ui.handle({ dataset: { er:'apply-filter' } });
  assert.deepEqual(copy(ui.snapshot().rows), [0]);
  assert.equal(ui.snapshot().filters[0].found, 1);
  input('erLiveText','gamma');
  await ui.prepareExport(); // A download started immediately must include the newest keystroke.
  const saved = await w.WorkHubValidatorFiles.read(x.file(new Uint8Array(await x.blobs[0].arrayBuffer()), 'output.xlsx'), { displayValues:true });
  assert.deepEqual(copy(saved.sheets[0].rows), [['Code','Customer','Status'], ['000007','Gamma','Open']]);
  const E = w.WorkHubExcelReportEngine;
  assert.equal(E.wildcardContains('A.B C','a.b?c'), true);
  assert.equal(E.wildcardContains('invoice pending','in*pend?ng'), true);
  assert.equal(E.wildcardContains('invoice pending','in*closed'), false);
  assert.equal(E.wildcardContains('Alpha','alpha',true), false);
  assert.equal(E.wildcardContains('Gamma','***'), true);
});

test('Excel Report cancels an old account read without clearing a newer read', async t => {
  const dom = new JSDOM('<body><div id="view"></div></body>', {runScripts:'outside-only',url:'https://example.test/'});
  t.after(()=>dom.window.close());
  const w=dom.window,d=w.document;w.eval(source('excel-report-engine.js'));
  const pending=[];
  w.WorkHubValidatorFiles={CSV_LIMITS:{fileBytes:50000000},read:()=>new Promise(resolve=>pending.push(resolve))};
  w.eval(source('excel-report.js'));
  let owner='one',ui;
  const render=()=>{d.getElementById('view').innerHTML=ui.render();};
  ui=w.WorkHubExcelReport.install({ready:()=>true,owner:()=>owner,render});render();
  const first=ui.loadFile({name:'one.xlsx',size:1});
  owner='two';ui.sync();render();
  const second=ui.loadFile({name:'two.xlsx',size:1});
  pending[0]({sheets:[{name:'Private old',rows:[['Code'],['secret']],width:1}]});
  await first;
  assert.equal(ui.snapshot().busy,true);
  assert.equal(ui.snapshot().filename,'');
  pending[1]({sheets:[{name:'New',rows:[['Code'],['safe']],width:1}]});
  await second;
  assert.equal(ui.snapshot().filename,'two.xlsx');
  assert.equal(ui.snapshot().busy,false);
  assert.doesNotMatch(d.body.textContent,/secret|Private old/);
});

test('Excel Report checks and unchecks all columns regardless of search and page', async t => {
  const x = fixture(t), {w,d,ui,input} = x;
  const names=Array.from({length:130},(_,i)=>'Group '+(i%2?'B ':'A ')+String(i+1).padStart(3,'0'));
  const book=w.XLSX.utils.book_new();
  w.XLSX.utils.book_append_sheet(book,w.XLSX.utils.aoa_to_sheet([names,names.map((_,i)=>'value-'+i)]),'Wide');
  await ui.loadFile(x.file(w.XLSX.write(book,{bookType:'xlsx',type:'array'})));
  assert.equal(ui.snapshot().selected.length,130);
  assert.equal(d.querySelectorAll('[data-er-column]').length,60);
  assert.ok(d.querySelector('[data-er="select-all-columns"]').disabled);
  input('erColumnSearch','Group A');
  assert.equal(d.querySelectorAll('[data-er-column]').length,60);
  assert.match(d.querySelector('.er-column-search-actions').textContent,/65 matching columns, across pages/);
  d.querySelector('[data-er="uncheck-all-columns"]').click();
  assert.equal(ui.snapshot().selected.length,0);
  assert.equal(d.querySelectorAll('[data-er-column]:checked').length,0);
  assert.match(d.querySelector('.er-report-card').textContent,/Select at least one display column/);
  d.querySelector('[data-er="select-shown"]').click();
  assert.deepEqual(copy(ui.snapshot().selected).sort((a,b)=>a-b),Array.from({length:65},(_,i)=>i*2));
  d.querySelector('[data-er="select-all-columns"]').click();
  assert.equal(ui.snapshot().selected.length,130);
  d.querySelector('[data-er="clear-shown"]').click();
  assert.deepEqual(copy(ui.snapshot().selected).sort((a,b)=>a-b),Array.from({length:65},(_,i)=>i*2+1));
  input('erColumnSearch','');
  d.querySelector('[data-er="column-view"][data-view="selected"]').click();
  assert.equal(d.querySelector('[data-er="column-view"][data-view="selected"]').getAttribute('aria-pressed'),'true');
  assert.equal(d.querySelectorAll('[data-er-column]').length,60);
  const first=d.querySelector('[data-er-column]');first.focus();first.checked=false;first.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.equal(ui.snapshot().selected.length,64);
  assert.equal(d.activeElement.dataset.erColumn,'3');
  d.querySelector('[data-er="column-view"][data-view="unselected"]').click();
  assert.equal(d.querySelectorAll('[data-er-column]:checked').length,0);
  assert.match(d.querySelector('.er-column-view-bar').textContent,/66 in this view/);
  d.querySelector('[data-er="uncheck-all-columns"]').click();
  assert.equal(ui.snapshot().selected.length,0);
  assert.equal(d.querySelector('[data-er="column-view"][data-view="all"]').getAttribute('aria-pressed'),'true');
  d.querySelector('[data-er="select-all-columns"]').click();
  assert.equal(ui.snapshot().selected.length,130);
});

test('Excel Report exports only the manually selected columns after unchecking all', async t => {
  const x=fixture(t),{w,d,ui,input}=x;
  await ui.loadFile(x.workbook());input('erHeaderRow','2','change');
  d.querySelector('[data-er="uncheck-all-columns"]').click();
  await assert.rejects(ui.prepareExport(),/Select at least one/);
  const customer=d.getElementById('erColumn-1');customer.checked=true;customer.dispatchEvent(new w.Event('change',{bubbles:true}));
  assert.deepEqual(copy(ui.snapshot().selected),[1]);
  await ui.prepareExport();
  const result=await w.WorkHubValidatorFiles.read(x.file(new Uint8Array(await x.blobs[0].arrayBuffer()),'result.xlsx'),{displayValues:true});
  assert.deepEqual(copy(result.sheets[0].rows),[['Customer'],['Alpha'],['Beta'],['Gamma']]);
  assert.equal(x.writes(),0);
});

test('Excel Report keeps live search immediately above the report even when list results appear', async t => {
  const x=fixture(t),{d,ui,input}=x;
  await ui.loadFile(x.workbook());input('erHeaderRow','2','change');
  assert.ok(d.querySelector('.er-live-card').nextElementSibling.classList.contains('er-report-card'));
  input('erList','000007\n000099');await ui.handle({dataset:{er:'apply-filter'}});
  assert.ok(d.querySelector('.er-results-card').compareDocumentPosition(d.querySelector('.er-live-card')) & x.w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(d.querySelector('.er-live-card').nextElementSibling.classList.contains('er-report-card'));
});

test('Excel Report filter choices follow checked columns and cannot leave hidden active filters', async t => {
  const x=fixture(t),{d,w,ui,input}=x;
  await ui.loadFile(x.workbook());input('erHeaderRow','2','change');
  input('erLiveColumn','1','change');input('erLiveText','alpha');
  await new Promise(resolve=>setTimeout(resolve,130));
  input('erFilterColumn','2','change');input('erList','Open');await ui.handle({dataset:{er:'apply-filter'}});
  assert.deepEqual(copy(ui.snapshot().rows),[0]);
  function check(index,value){const el=d.getElementById('erColumn-'+index);el.checked=value;el.dispatchEvent(new w.Event('change',{bubbles:true}));}
  check(1,false);
  assert.equal(ui.snapshot().live.text,'');assert.equal(ui.snapshot().live.column,0);
  for(const id of ['erFilterColumn','erLiveColumn'])assert.deepEqual([...d.getElementById(id).options].map(o=>o.value),['0','2']);
  assert.deepEqual(copy(ui.snapshot().rows),[0,2]);
  check(2,false);
  assert.equal(ui.snapshot().filters.length,0);assert.deepEqual(copy(ui.snapshot().rows),[0,1,2]);
  input('erFilterSearch','Customer');assert.equal(d.getElementById('erFilterColumn').disabled,true);
  input('erFilterSearch','');
  await ui.handle({dataset:{er:'uncheck-all-columns'}});
  assert.equal(d.getElementById('erLiveColumn').disabled,true);assert.equal(d.getElementById('erFilterColumn').disabled,true);assert.equal(d.getElementById('erLiveText').disabled,true);
  check(1,true);
  for(const id of ['erFilterColumn','erLiveColumn'])assert.deepEqual([...d.getElementById(id).options].map(o=>o.value),['1']);
  input('erList','Alpha');await ui.handle({dataset:{er:'apply-filter'}});assert.deepEqual(copy(ui.snapshot().rows),[0]);
  await ui.handle({dataset:{er:'uncheck-all-columns'}});assert.equal(ui.snapshot().filters.length,0);
});

test('Excel Report extracts a single pasted column from tab, CSV, spaced and Markdown tables without losing the first data row', t => {
  const E=engine(t);
  const text='| XX01 | QA01 | 9.10000001 | Example product A | 12 | EA | V1 | FALSE |\n| ---- | ---- | ---------- | ---- | --- | --- | --- | --- |\n| XX01 | QA00 | 9.10000002 | Example product B | 4 | EA | V1 | FALSE |\n| XX01 | QA00 | 9.10000003 | Example product C | 1 | EA | V1 | FALSE |\n| XX01 | QA00 | 9.10000004 | Example product D | 36 | EA | V1 | FALSE |\n| XX01 | QA00 | 9.10000005 | Example product E | 40 | EA | V1 | FALSE |';
  const table=E.parsePaste(text);
  assert.equal(table.width,8);assert.equal(table.rows.length,5);
  assert.deepEqual(copy(E.extractPasteColumn(table,2).values),['9.10000001','9.10000002','9.10000003','9.10000004','9.10000005']);
  const tabs=E.parsePaste('Plant\tName\tCode\nA\t"Two\nlines"\t000001\nB\tAnother\t000001\nC\tLast\t');
  assert.equal(tabs.rows[1][1],'Two\nlines');
  assert.deepEqual(copy(E.extractPasteColumn(tabs,2,true)),{values:['000001','000001'],skipped:1});
  assert.throws(()=>E.extractPasteColumn(tabs,1,true),/multi-line/);
  const csv=E.parsePaste('Plant,Name,Code\nA,"Example, quoted",000007\nB,Other,000008');
  assert.deepEqual(copy(E.extractPasteColumn(csv,2,true).values),['000007','000008']);
  const pipe=E.parsePaste('| A | Name \\| variant | 001 |\n| B | Other | 002 |');
  assert.equal(pipe.width,3);assert.equal(pipe.rows[0][1],'Name | variant');
  const spaced=E.parsePaste('A  Product one  00001\nB  Product two  00002');
  assert.deepEqual(copy(E.extractPasteColumn(spaced,2).values),['00001','00002']);
  assert.deepEqual(copy(E.extractPasteColumn(E.parsePaste('ACME, Inc\nBETA, Ltd','lines'),0).values),['ACME, Inc','BETA, Ltd']);
  const large=E.parsePaste('A\tValue\n'+'B\t0001\n'.repeat(25000));
  assert.throws(()=>E.extractPasteColumn(large,1),/25,000/);
  assert.equal(E.extractPasteColumn(large,1,true).values.length,25000);
});

test('Excel Report reviews native table pastes, keeps only the chosen source column and exports its matches', async t => {
  const x=fixture(t),{w,d,ui,input}=x;
  await ui.loadFile(x.workbook());input('erHeaderRow','2','change');
  await ui.handle({dataset:{er:'uncheck-all-columns'}});
  const code=d.getElementById('erColumn-0');code.checked=true;code.dispatchEvent(new w.Event('change',{bubbles:true}));
  input('erList','keep old list');
  const event=new w.Event('paste',{bubbles:true,cancelable:true});
  Object.defineProperty(event,'clipboardData',{value:{getData:type=>type==='text/plain'?'XX01\tOpen\t000007\nXX02\tClosed\t000008\nXX03\tPending\t000099':''}});
  d.getElementById('erList').dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.ok(d.getElementById('erPasteColumn'));
  assert.equal(d.getElementById('erList').value,'keep old list');assert.equal(ui.snapshot().filters.length,0);
  input('erPasteColumn','2','change');
  assert.match(d.querySelector('.er-paste-summary').textContent,/3 values will replace/);
  await ui.handle({dataset:{er:'use-paste-column'}});
  assert.equal(d.getElementById('erList').value,'000007\n000008\n000099');
  assert.equal(d.getElementById('erPasteColumn'),null);
  await ui.handle({dataset:{er:'apply-filter'}});
  assert.deepEqual(copy(ui.snapshot().rows),[0,1,2]);
  assert.deepEqual(copy(ui.snapshot().filters[0].values),[{value:'000007',count:2},{value:'000008',count:1},{value:'000099',count:0}]);
  await ui.prepareExport();
  const saved=await w.WorkHubValidatorFiles.read(x.file(new Uint8Array(await x.blobs[0].arrayBuffer()),'out.xlsx'),{displayValues:true});
  assert.deepEqual(copy(saved.sheets[0].rows),[['Code'],['000007'],['000008'],['000007']]);
  assert.equal(saved.sheets[1].rows.length,4);assert.equal(x.writes(),0);
});

test('Excel Report handles copied web tables and an explicit header choice, and clears the preview on account changes', async t => {
  const x=fixture(t),{w,d,ui,input}=x;
  await ui.loadFile(x.workbook());input('erHeaderRow','2','change');
  const event=new w.Event('paste',{bubbles:true,cancelable:true});
  const html='<table><tr><th>Name</th><th>Code</th></tr><tr><td>Example</td><td>000007</td></tr></table><script>window.untrustedRan=true</script>';
  Object.defineProperty(event,'clipboardData',{value:{getData:type=>type==='text/html'?html:''}});
  d.getElementById('erList').dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);assert.equal(w.untrustedRan,undefined);
  input('erPasteColumn','1','change');
  const header=d.getElementById('erPasteHeader');header.checked=true;header.dispatchEvent(new w.Event('change',{bubbles:true}));
  await ui.handle({dataset:{er:'use-paste-column'}});assert.equal(d.getElementById('erList').value,'000007');
  input('erList','A\tB\nX\tY');await ui.handle({dataset:{er:'apply-filter'}});
  assert.equal(ui.snapshot().filters.length,0);assert.ok(d.querySelector('.er-paste-preview'));
  x.setOwner('other');assert.equal(d.querySelector('.er-paste-preview'),null);assert.equal(ui.snapshot().filename,'');
});
