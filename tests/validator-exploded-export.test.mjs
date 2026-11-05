import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const file = (name, text) => ({ name, size: new TextEncoder().encode(text).length, text: async () => text });
const action = (ui, val, extra = {}) => ui.handle({ dataset: { val, ...extra } });
async function studio(t, { sap = false, missingRequired = false } = {}) {
  const dom = new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>', { url: 'https://example.test', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window, d = w.document; t.after(() => w.close());
  Object.assign(w, { Blob, TextEncoder, TextDecoder, CompressionStream, setImmediate, clearImmediate });
  w.confirm = () => true;w.WorkHubDialogs={confirm:async(...args)=>w.confirm(...args)};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  const timer = w.setTimeout.bind(w); w.setTimeout = (fn, ms) => ms === 50 ? (queueMicrotask(fn), 0) : timer(fn, ms);
  for (const name of ['vendor/jszip.min.js', 'vendor/ssf.js', 'validator-engine.js', 'validator-transform.js', 'validator-files.js']) w.eval(source(name)); w.WorkHubValidatorFiles = { ...w.WorkHubValidatorFiles }; w.eval(source('validator-studio.js'));
  const E = w.WorkHubValidatorEngine, F = w.WorkHubValidatorFiles, schema = E.create('Exploded materials');
  schema.mode = sap ? 'sap' : 'general';
  schema.columns = [['MATNR', 'Material'], ['DESCRIPTION', 'Description'], ['PLANT', 'Plant'], ['STORAGE', 'Storage'], ['AVAIL', 'Availability']].map(([key, label], i) => ({ ...E.column(i), key, label, required: key === 'DESCRIPTION', sapType: key === 'AVAIL' ? 'NUMC' : 'CHAR', sapLength: key === 'AVAIL' ? 2 : 80, values: key === 'STORAGE' ? 'QA00' : '' }));
  if (missingRequired) schema.columns.push({ ...E.column(5), key: 'MISSING', label: 'Unmapped required field', required: true });
  let owner = 'owner', ready = true, writes = 0, ui, state = { projects: [], projectCompanies: [], workhub: { validator: { templates: [schema], runs: [] } } };
  const downloads = [], messages = [], render = () => { if (!ui.patchRender()) d.getElementById('view').innerHTML = ui.render(); };
  ui = w.WorkHubValidatorStudio.install({ state: () => state, owner: () => owner, ready: () => ready, render, tell: text => messages.push(text), mutate(fn) { const next = E.copy(state); fn(next); E.prepare(next, state); E.validateState(next); state = next; writes++; render(); return true; }, download(blob, name, type) { downloads.push({ blob, name, type }); }, openModal(title, body) { d.getElementById('modalBody').innerHTML = body; d.getElementById('modal').showModal(); }, closeModal() { d.getElementById('modal').close(); } }); render();
  const change = (el, value) => { el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const upload = (data, headers = ['Material', 'Description', 'Plant', 'Storage', 'Availability', 'Extra']) => ui.loadFile(file('Materials.xlsx.csv', E.csv([headers, ...data])));
  const preview = () => d.getElementById('valPreparationForm').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
  const explode = (mode = 'dependent') => { ui.openPreparation('explode'); const form = d.getElementById('valPreparationForm'); change(form.elements.explodeMode, mode); change(form.elements.primary, '2'); form.querySelector('[name="mapped"][value="3"]').checked = true; preview(); };
  const unzip = async blob => w.JSZip.loadAsync(new w.Uint8Array(await blob.arrayBuffer()), { checkCRC32: true });
  const read = blob => F.read({ name: 'export.xlsx', size: blob.size, arrayBuffer: () => blob.arrayBuffer() }, { displayValues: true });
  return { w, d, E, F, ui, downloads, messages, change, upload, preview, explode, unzip, read, writes: () => writes, state: () => state, button: () => d.querySelector('[data-val="export-exploded"]'), account(value) { owner = value; ui.sync(); render(); }, setReady(value) { ready = value; ui.sync(); render(); } };
}
const example = ['001', 'Original pump description', 'FF01, FF02, FF03', '(FF01) QA00, QA01, (FF02,FF03) QA00', '2', 'unmapped'];

test('download works before validation or complete mapping and exports every grouped child and original column as exact text', async t => {
  const x = await studio(t, { missingRequired: true }), special = ' µL 界 😀 & < > "quoted"\n=literal() _x0041_ ', input = [[...example.slice(0, 5), special], ['6.00007', 'Other exact description', 'FF04,FF05', 'QA00,QA01', '0', '=XLOOKUP(A2,B:B,C:C)'], ['12345678901234567890', 'Long material', 'FF06', '(FF06) QA00', '000', '']];
  await x.upload(input); assert.equal(x.button().disabled, true); x.explode(); assert.equal(x.button().disabled, true); x.ui.applyPreparation(); const before = x.ui.snapshot(), writes = x.writes();
  assert.equal(before.result, null); assert.equal(before.sourceRows.length, 7); assert.equal(x.button().disabled, false); await action(x.ui, 'export-exploded');
  assert.equal(x.downloads.length, 1); assert.match(x.downloads[0].name, /-exploded\.xlsx$/); const book = await x.read(x.downloads[0].blob); assert.deepEqual(plain(book.sheets.map(s => s.name)), ['Exploded data']);
  assert.deepEqual(plain(book.sheets[0].rows), [['Material', 'Description', 'Plant', 'Storage', 'Availability', 'Extra'], ...plain(before.sourceRows)]);
  assert.deepEqual(plain(book.sheets[0].rows.slice(1, 5).map(r => r.slice(2, 4))), [['FF01', 'QA00'], ['FF01', 'QA01'], ['FF02', 'QA00'], ['FF03', 'QA00']]); assert.equal(book.sheets[0].rows[5][0], '6.00007'); assert.equal(book.sheets[0].rows[7][0], '12345678901234567890');
  const zip = await x.unzip(x.downloads[0].blob), xml = await zip.file('xl/worksheets/sheet1.xml').async('string'); assert.doesNotMatch(xml, /<f[ >]/); assert.match(xml, /<c r="A2" s="0" t="inlineStr"/); assert.match(xml, /_x005F_x0041_/); assert.match(xml, /<autoFilter ref="A1:F8"/);
  assert.deepEqual(plain(x.ui.snapshot()), plain(before)); assert.equal(x.writes(), writes); assert.doesNotMatch(JSON.stringify(x.state()), /Original pump|unmapped|Other exact/);
});

test('download includes current SAP formatting, later corrections and unresolved errors regardless of the result filter', async t => {
  const x = await studio(t, { sap: true }); await x.upload([example]); x.explode(); x.ui.applyPreparation(); x.ui.openPreparation('sap'); x.preview(); x.ui.applyPreparation(); await x.ui.run();
  assert.ok(x.ui.snapshot().result.errors > 0); x.change(x.d.querySelector('[data-cell="0"][data-field="DESCRIPTION"]'), 'Corrected first child only'); await action(x.ui, 'filter', { filter: 'errors' });
  const before = x.ui.snapshot(), writes = x.writes(); await action(x.ui, 'export-exploded'); const book = await x.read(x.downloads[0].blob);
  assert.deepEqual(plain(book.sheets[0].rows.slice(1)), plain(before.sourceRows)); assert.ok(book.sheets[0].rows.slice(1).every(r => r[4] === '02')); assert.equal(book.sheets[0].rows[1][1], 'Corrected first child only'); assert.equal(book.sheets[0].rows[2][1], 'Original pump description'); assert.equal(book.sheets[0].rows.length, 5); assert.equal(book.sheets[0].rows[2][3], 'QA01'); assert.equal(x.writes(), writes); assert.deepEqual(plain(x.ui.snapshot()), plain(before));
});

test('availability follows applied explosions through SAP-only preparation, undo, restore and replacement uploads', async t => {
  const x = await studio(t, { sap: true }); await x.upload([example]); await assert.rejects(action(x.ui, 'export-exploded'), /Apply Explode/);
  x.ui.openPreparation('sap'); x.preview(); x.ui.applyPreparation(); assert.equal(x.button().disabled, true); x.explode(); x.ui.applyPreparation(); assert.equal(x.button().disabled, false);
  await x.ui.undoPreparation(); assert.equal(x.button().disabled, true); x.explode(); x.ui.applyPreparation(); await x.ui.undoPreparation(true); assert.equal(x.button().disabled, true); x.explode(); x.ui.applyPreparation(); await x.upload([example]); assert.equal(x.button().disabled, true);
});

test('export uses Export permission independently of Run/Edit and rechecks permission before delivering the file', async t => {
  const x = await studio(t); await x.upload([example]); x.explode(); x.ui.applyPreparation(); x.w.WorkHubCurrentAccess = { can: (_, operation) => operation === 'export' || operation === 'view' }; await action(x.ui, 'export-exploded'); assert.equal(x.downloads.length, 1);
  x.w.WorkHubCurrentAccess = { can: () => false }; await assert.rejects(action(x.ui, 'export-exploded'), /disabled/); assert.equal(x.downloads.length, 1);
  x.w.WorkHubCurrentAccess = { can: () => true }; const writer = x.F.workbook; let release; x.F.workbook = sheets => new Promise(resolve => release = () => resolve(writer(sheets))); const pending = action(x.ui, 'export-exploded'); assert.equal(x.button().disabled, true); await assert.rejects(action(x.ui, 'export-exploded'), /current operation/); x.w.WorkHubCurrentAccess = { can: () => false }; release(); await pending; assert.equal(x.downloads.length, 1); assert.match(x.messages.at(-1), /disabled/); assert.doesNotMatch(x.d.body.textContent, /Preparing exploded Excel…/);
});

test('late exports are discarded after edits, replacement uploads, account changes and queue-file switches', async t => {
  for (const kind of ['edit', 'upload', 'account', 'queue']) {
    const x = await studio(t); if (kind === 'queue') await x.ui.addQueueFiles([file('one.csv', x.E.csv([['Material', 'Description', 'Plant', 'Storage', 'Availability', 'Extra'], example])), file('two.csv', 'Material,Description,Plant,Storage\n00002,Other,P2,S2')]); else await x.upload([example]);
    x.explode(); x.ui.applyPreparation(); if (kind === 'edit') await x.ui.run(); const writer = x.F.workbook; let release; x.F.workbook = sheets => new Promise(resolve => release = () => resolve(writer(sheets))); const pending = action(x.ui, 'export-exploded');
    if (kind === 'edit') x.change(x.d.querySelector('[data-cell="0"][data-field="DESCRIPTION"]'), 'Newer edit');
    if (kind === 'upload') await x.upload([['00002', 'New file', 'P2', 'S2', '2', 'new']]);
    if (kind === 'account') x.account('other');
    if (kind === 'queue') await x.ui.openQueueJob(x.ui.snapshot().queue[1].id);
    release(); await pending; assert.equal(x.downloads.length, 0, kind); assert.doesNotMatch(x.d.body.textContent, /Preparing exploded Excel…/, kind);
  }
});

test('writer failures and oversized cells leave data intact, stop progress and allow a retry without truncation', async t => {
  const x = await studio(t); await x.upload([example]); x.explode(); x.ui.applyPreparation(); const before = x.ui.snapshot(), writer = x.F.workbook; x.F.workbook = async () => { throw Error('Synthetic writer failure'); }; await action(x.ui, 'export-exploded'); assert.equal(x.downloads.length, 0); assert.equal(x.button().disabled, false); assert.match(x.messages.at(-1), /Synthetic writer failure/); assert.deepEqual(plain(x.ui.snapshot()), plain(before)); x.F.workbook = writer; await action(x.ui, 'export-exploded'); assert.equal(x.downloads.length, 1);
  await x.ui.run(); x.change(x.d.querySelector('[data-cell="0"][data-field="DESCRIPTION"]'), 'x'.repeat(32768)); await action(x.ui, 'export-exploded'); assert.equal(x.downloads.length, 1); assert.match(x.messages.at(-1), /32,767-character/); assert.equal(x.ui.snapshot().sourceRows[0][1].length, 32768); assert.doesNotMatch(x.d.body.textContent, /Preparing exploded Excel…/);
});

test('XLSX numeric identifiers and formula-like literal values are exported without precision loss or executable formulas', async t => {
  const x = await studio(t), values = [['Material', 'Description', 'Plant', 'Storage', 'Availability', 'Extra'], ['6.00007', 'Saved description', 'P1,P2', 'QA00,QA01', '001', '=XLOOKUP(A2,B:B,C:C)']];
  const zip = await x.unzip(await x.F.workbook([{ name: 'Data', rows: values }])); let xml = await zip.file('xl/worksheets/sheet1.xml').async('string'); xml = xml.replace(/<c r="A2"[^>]*>[\s\S]*?<\/c>/, '<c r="A2"><v>6.00007</v></c>'); zip.file('xl/worksheets/sheet1.xml', xml); const data = await zip.generateAsync({ type: 'uint8array' }); await x.ui.loadFile({ name: 'Formulas.xlsx', size: data.length, arrayBuffer: async () => data.buffer }); x.explode('position'); x.ui.applyPreparation(); await action(x.ui, 'export-exploded'); const book = await x.read(x.downloads[0].blob), output = await x.unzip(x.downloads[0].blob); assert.ok(book.sheets[0].rows.slice(1).every(r => r[0] === '6.00007' && r[4] === '001' && r[5] === '=XLOOKUP(A2,B:B,C:C)')); assert.doesNotMatch(await output.file('xl/worksheets/sheet1.xml').async('string'), /<f[ >]/);
});

test('wide exploded downloads stay on one sheet above one million cells and retain every row and distant field', { timeout: 30000 }, async t => {
  const x = await studio(t), headers = ['Material', 'Description', 'Plant', 'Storage', 'Availability', ...Array.from({ length: 195 }, (_, i) => 'Extra ' + i)], input = Array.from({ length: 2501 }, (_, n) => [String(n).padStart(8, '0'), 'Description ' + n, 'P1,P2', 'QA00,QA01', '001', ...Array.from({ length: 195 }, (_, i) => n + ':' + i)]);
  await x.upload(input, headers); x.explode('position'); x.ui.applyPreparation(); assert.equal(x.ui.snapshot().sourceRows.length, 5002); let ticks = 0; const heartbeat = setInterval(() => ticks++, 5); try { await action(x.ui, 'export-exploded'); } finally { clearInterval(heartbeat); }
  assert.equal(x.downloads.length, 1); const zip = await x.unzip(x.downloads[0].blob), book = new x.w.DOMParser().parseFromString(await zip.file('xl/workbook.xml').async('string'), 'application/xml'); assert.equal(book.getElementsByTagName('sheet').length, 1); const xml = await zip.file('xl/worksheets/sheet1.xml').async('string'); assert.equal((xml.match(/<row /g) || []).length, 5003); assert.equal((xml.match(/<c /g) || []).length, 5003 * 200); assert.match(xml, /r="GR5003"/); assert.match(xml, /2500:194/); assert.match(xml, /00002500/); assert.ok(ticks > 2, 'writer yields between bounded batches');
});
