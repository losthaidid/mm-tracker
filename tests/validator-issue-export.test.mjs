import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
function fixture(t, native = true) {
  const dom = new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>', { url: 'https://example.test', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document;
  t.after(() => w.close());
  Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate, ...(native ? { CompressionStream } : {}) });
  for (const name of ['vendor/jszip.min.js', 'validator-engine.js', 'validator-transform.js', 'validator-files.js']) w.eval(source(name));
  const E = w.WorkHubValidatorEngine, F = w.WorkHubValidatorFiles;
  const unzip = blob => blob.arrayBuffer().then(bytes => w.JSZip.loadAsync(new w.Uint8Array(bytes), { checkCRC32: true }));
  const names = async zip => {
    const doc = new w.DOMParser().parseFromString(await zip.file('xl/workbook.xml').async('string'), 'application/xml');
    return [...doc.getElementsByTagName('sheet')].map(s => s.getAttribute('name'));
  };
  const read = blob => F.read({ name: 'report.xlsx', size: blob.size, arrayBuffer: () => blob.arrayBuffer() });
  return { w, d, E, F, unzip, names, read };
}
function data(E) {
  const template = E.create('Issue export');
  template.columns = [
    { ...E.column(0), key: 'ID', label: 'ID' },
    { ...E.column(1), key: 'AMOUNT', label: 'Amount', type: 'decimal', min: '0' },
    { ...E.column(2), key: 'DATE', label: 'Date', type: 'date' },
    { ...E.column(3), key: 'FLAG', label: 'Flag', type: 'boolean' },
    { ...E.column(4), key: 'NOTE', label: 'Note' },
  ];
  const warning = E.rule('NOTE'); warning.severity = 'warning'; warning.assertion = { ...E.condition('NOTE'), operator: 'eq', value: 'expected' }; warning.message = 'Review the note'; template.rules = [warning];
  const rows = [
    { ID: '000001', AMOUNT: '0', DATE: '2026-10-31', FLAG: 'false', NOTE: 'expected' },
    { ID: '12345678901234567890', AMOUNT: '-1', DATE: '2026-10-30', FLAG: 'true', NOTE: ' µL 界 😀 & < > "quoted"\nsecond line ' },
    { ID: '=LITERAL()', AMOUNT: '-2', DATE: '2026-10-29', FLAG: '0', NOTE: 'expected' },
  ];
  const raw = E.validateRows(template, rows), ignored = raw.issues.find(i => i.index === 2), result = E.reviewIssues(raw, rows, new Map([[E.issueKey(ignored), { row: JSON.stringify(rows[2]), reason: '=APPROVED()' }]]));
  return { template, rows, result };
}

test('issue workbook has exactly two sheets and retains complete validated values, issue details, styles and ignore decisions', async t => {
  const x = fixture(t), { template, rows, result } = data(x.E), before = plain({ template, rows, result });
  const blob = await x.F.issueReport(template, rows, result), zip = await x.unzip(blob), book = await x.read(blob);
  assert.deepEqual(await x.names(zip), ['Validated data', 'Issues']);
  assert.equal(book.sheets[0].rows.length, 4); assert.deepEqual(plain(book.sheets[0].rows.slice(1).map(r => r.slice(0, 5))), rows.map(r => Object.values(r)));
  assert.equal(book.sheets[1].rows[0][0], 'Working Excel row');
  assert.equal(book.sheets[1].rows.length, result.issues.length + 1);
  const ignored = book.sheets[1].rows.find(r => r[7] === 'Ignored'); assert.equal(ignored[8], '=APPROVED()');
  const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.match(xml, /<c r="B3" s="2"/); assert.match(xml, /<c r="E3" s="3"/); assert.match(xml, /<c r="B4" s="4"/);
  assert.match(xml, /<pane ySplit="1"/); assert.match(xml, /<autoFilter ref="A1:I4"/); assert.match(xml, /12345678901234567890/);
  for (const file of Object.values(zip.files).filter(f => f.name.startsWith('xl/worksheets/'))) assert.doesNotMatch(await file.async('string'), /<f[ >]/);
  assert.deepEqual(plain({ template, rows, result }), before);
});

test('native streaming and compatibility fallback retain identical XML values, row order and highlights', async t => {
  const streamed = fixture(t), fallback = fixture(t, false), a = data(streamed.E), b = plain(a);
  const first = await streamed.unzip(await streamed.F.issueReport(a.template, a.rows, a.result)), second = await fallback.unzip(await fallback.F.issueReport(b.template, b.rows, b.result));
  assert.deepEqual(Object.keys(first.files).sort(), Object.keys(second.files).sort());
  for (const name of Object.keys(first.files)) assert.equal(await first.file(name).async('string'), await second.file(name).async('string'), name);
  fallback.w.CompressionStream = class { constructor() { throw Error('Unsupported format'); } };
  assert.deepEqual(await fallback.names(await fallback.unzip(await fallback.F.issueReport(b.template, b.rows, b.result))), ['Validated data', 'Issues']);
});

test('validated data and issue cells match the previous complete report while ancillary sheets are omitted', async t => {
  const x = fixture(t), { template, rows, result } = data(x.E), headers = template.columns.map(c => c.label), sourceRows = rows.map(r => template.columns.map(c => r[c.key]));
  const upload = { headers, originalRows: sourceRows, preparedRows: sourceRows, sourceRows, origins: rows.map((r, i) => ({ row: i + 2, part: '' })), mapping: x.E.autoMap(headers, template), headerRow: 1, sheet: 'Data', steps: [] };
  const full = await x.unzip(await x.F.report(template, rows, result, false, upload)), simple = await x.unzip(await x.F.issueReport(template, rows, result)), fullNames = await x.names(full);
  for (const [name, target] of [['Validated data', 1], ['Issues', 2]]) assert.equal(await simple.file(`xl/worksheets/sheet${target}.xml`).async('string'), await full.file(`xl/worksheets/sheet${fullNames.indexOf(name) + 1}.xml`).async('string'));
  assert.ok(fullNames.includes('Original upload')); assert.ok(fullNames.includes('Field comparison')); assert.deepEqual(await x.names(simple), ['Validated data', 'Issues']);
});

test('wide reports over one million cells stay on two sheets with every row and distant field retained', { timeout: 30000 }, async t => {
  const x = fixture(t), template = x.E.create('Wide issues'), count = 5101, width = 200;
  template.mode = 'sap'; template.columns = Array.from({ length: width }, (_, i) => ({ ...x.E.column(i), key: 'F' + i, label: 'Field ' + i, sapType: 'CHAR', sapLength: '40' }));
  const rows = Array.from({ length: count }, (_, i) => Object.fromEntries(template.columns.map((c, j) => [c.key, String(i).padStart(8, '0') + ':' + j]))), result = x.E.validateRows(template, rows);
  let ticks = 0; const heartbeat = setInterval(() => ticks++, 5);
  let blob; try { blob = await x.F.issueReport(template, rows, result); } finally { clearInterval(heartbeat); }
  const zip = await x.unzip(blob); assert.deepEqual(await x.names(zip), ['Validated data', 'Issues']);
  const xml = await zip.file('xl/worksheets/sheet1.xml').async('string');
  assert.equal((xml.match(/<row /g) || []).length, count + 1); assert.equal((xml.match(/<c /g) || []).length, (count + 1) * (width + 4)); assert.match(xml, /00005100:199/); assert.match(xml, /r="GR5102"/); assert.ok(ticks > 2, 'writer yields between bounded batches');
});

test('header-only Issues sheet remains present and truncated issue lists disclose their limit inside Issues', async t => {
  const x = fixture(t), template = x.E.create('Limit'); template.columns = [{ ...x.E.column(), key: 'ID', label: 'ID' }];
  const rows = [{ ID: '0001' }], clean = x.E.validateRows(template, rows), first = await x.read(await x.F.issueReport(template, rows, clean));
  assert.equal(first.sheets[1].rows.length, 1);
  const report = plain(clean); report.truncated = true; const book = await x.read(await x.F.issueReport(template, rows, report));
  assert.deepEqual(plain(book.sheets.map(s => s.name)), ['Validated data', 'Issues']); assert.match(book.sheets[1].rows.at(-1)[6], /issue list is limited/); assert.equal(book.sheets[0].rows[1][0], '0001');
});

test('streaming errors reject the export instead of returning an incomplete archive', async t => {
  const x = fixture(t);
  await assert.rejects(x.F.workbook([{ name: 'Incomplete', width: 1, rowCount: 3, keepTogether: true, rows: [['Header'], ['Only one row']] }]), /Report rows are incomplete/);
  x.w.CompressionStream = class { constructor() { return { writable: new WritableStream({ write() { throw Error('Synthetic compressor failure'); } }), readable: new ReadableStream({ start() {}, cancel() {} }) }; } };
  const { template, rows, result } = data(x.E); await assert.rejects(x.F.issueReport(template, rows, result), /Synthetic compressor failure/);
});

async function studio(t) {
  const x = fixture(t), { w, d, E } = x; w.confirm = () => true;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const timer = w.setTimeout.bind(w); w.setTimeout = (fn, ms) => ms === 50 ? (queueMicrotask(fn), 0) : timer(fn, ms);
  w.eval(source('validator-studio.js'));
  const schema = E.create('Material issues'); schema.mode = 'sap'; schema.columns = ['ID', 'Plant', 'Storage'].map((label, i) => ({ ...E.column(i), key: label.toUpperCase(), label, sapType: 'CHAR', sapLength: '20', values: i === 2 ? 'S1' : '' }));
  let state = { projects: [], projectCompanies: [], workhub: { validator: { templates: [schema], runs: [] } } }, owner = 'owner', ui;
  const downloads = [], messages = [], render = () => { if (!ui.patchRender()) d.getElementById('view').innerHTML = ui.render(); };
  ui = w.WorkHubValidatorStudio.install({ state: () => state, owner: () => owner, ready: () => true, render, tell: text => messages.push(text), mutate(fn) { const next = E.copy(state); fn(next); E.prepare(next, state); E.validateState(next); state = next; render(); return true; }, download(blob, name) { downloads.push({ blob, name }); }, openModal(title, body) { d.getElementById('modalBody').innerHTML = body; d.getElementById('modal').showModal(); }, closeModal() { d.getElementById('modal').close(); } });
  render(); const csv = 'ID,Plant,Storage,Extra\n0000000001,"P1,P2","S1,S2",PRIVATE-UNMAPPED'; await ui.loadFile({ name: 'material.csv', size: csv.length, text: async () => csv });
  ui.openPreparation('explode'); const form = d.getElementById('valPreparationForm'); form.elements.primary.value = '1'; form.elements.primary.dispatchEvent(new w.Event('change', { bubbles: true })); form.querySelector('[name="mapped"][value="2"]').checked = true; form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); ui.applyPreparation(); await ui.run();
  return { ...x, ui, downloads, messages, state: () => state, signOut() { owner = 'other'; ui.sync(); } };
}

test('actual issue action exports all exploded rows despite view filters and retains separate complete comparison and accepted exports', async t => {
  const x = await studio(t), before = x.ui.snapshot(); await x.ui.handle({ dataset: { val: 'filter', filter: 'errors' } }); await x.ui.handle({ dataset: { val: 'report' } });
  assert.match(x.downloads[0].name, /-issues.xlsx$/); const book = await x.read(x.downloads[0].blob);
  assert.deepEqual(plain(book.sheets.map(s => s.name)), ['Validated data', 'Issues']); assert.deepEqual(plain(book.sheets[0].rows.slice(1).map(r => r.slice(0, 3))), [['0000000001', 'P1', 'S1'], ['0000000001', 'P2', 'S2']]); assert.equal(book.sheets[1].rows[1][0], '3'); assert.equal(book.sheets[1].rows[1][5], 'S2');
  await x.ui.handle({ dataset: { val: 'export-comparison' } }); const complete = await x.names(await x.unzip(x.downloads[1].blob)); assert.ok(complete.includes('Field comparison')); assert.ok(complete.includes('Original upload')); assert.ok(complete.includes('Row origins'));
  await x.ui.handle({ dataset: { val: 'accepted' } }); const accepted = await x.read(x.downloads[2].blob); assert.equal(accepted.sheets[0].name, 'Accepted data'); assert.equal(accepted.sheets[0].rows.length, 2); assert.ok(accepted.sheets.some(s => s.name === 'Prepared upload'));
  assert.deepEqual(plain(x.ui.snapshot().sourceRows), plain(before.sourceRows)); assert.deepEqual(plain(x.ui.snapshot().origins), plain(before.origins)); assert.doesNotMatch(JSON.stringify(x.state()), /PRIVATE-UNMAPPED/);
});

test('issue download retains existing export permission and account-change guards', async t => {
  const x = await studio(t); x.w.WorkHubCurrentAccess = { can: (feature, action) => action !== 'export' };
  await assert.rejects(x.ui.handle({ dataset: { val: 'report' } }), /disabled/); assert.equal(x.downloads.length, 0);
  delete x.w.WorkHubCurrentAccess; const pending = x.ui.handle({ dataset: { val: 'report' } }); x.signOut(); await pending; assert.equal(x.downloads.length, 0);
});
