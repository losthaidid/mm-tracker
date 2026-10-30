import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const read = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const headers = ['Material', 'Description', 'Plant', 'Storage', 'Extra', 'Child'];
const original = [
  ['1', 'Alpha\nname', 'P1,,P3', 'S1,S2,S3', '=1+1', 'x|y'],
  ['2', 'Beta <x>', 'P4', 'S4', '00000', 'z'],
];

async function fixture(t, values = original) {
  const dom = new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>', {
    url: 'https://example.test', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window, d = w.document;
  t.after(() => w.close());
  Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate });
  const timers = new Map(); let timerId = 0, owner = 'owner', ready = true, writes = 0;
  w.setTimeout = (fn, delay) => {
    const id = ++timerId;
    if (delay === 50) queueMicrotask(fn); else timers.set(id, fn);
    return id;
  };
  w.clearTimeout = id => timers.delete(id);
  w.confirm = () => true;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const file of ['vendor/jszip.min.js', 'validator-engine.js', 'validator-transform.js', 'validator-files.js', 'validator-studio.js']) w.eval(read(file));
  const E = w.WorkHubValidatorEngine, F = w.WorkHubValidatorFiles, T = w.WorkHubValidatorTransform;
  const schema = E.create('Comparison'), mapping = { MAT: 0, DESCRIPTION: 1, PLANT: 2, STORAGE: 3 };
  schema.mode = 'sap';
  schema.columns = ['MAT', 'DESCRIPTION', 'PLANT', 'STORAGE'].map((key, i) => ({
    ...E.column(i), key, label: headers[i], sapType: i ? 'CHAR' : 'NUMC', sapLength: i ? 80 : 6,
  }));
  let state = { projects: [], projectCompanies: [], workhub: { validator: { templates: [schema], runs: [] } } }, ui;
  const downloads = [], render = () => { if (!ui.patchRender()) d.getElementById('view').innerHTML = ui.render(); };
  ui = w.WorkHubValidatorStudio.install({
    state: () => state, owner: () => owner, ready: () => ready, render, tell: () => {},
    mutate(fn) { const next = E.copy(state); fn(next); E.prepare(next, state); E.validateState(next); state = next; writes++; render(); return true; },
    openModal(title, body) { d.getElementById('modalBody').innerHTML = body; d.getElementById('modal').showModal(); },
    closeModal() { d.getElementById('modal').close(); },
    download(blob, name) { downloads.push({ blob, name }); },
  });
  render();
  const upload = async rows => {
    const csv = E.csv([headers, ...rows]).replaceAll("'=1+1", '=1+1');
    await ui.loadFile({ name: 'original.csv', size: csv.length, text: async () => csv });
  };
  await upload(values);
  const change = (el, value) => { el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  const prepare = (kind, opts = {}) => {
    ui.openPreparation(kind);
    const form = d.getElementById('valPreparationForm');
    if (kind === 'explode') {
      change(form.elements.primary, String(opts.primary ?? 2));
      for (const index of opts.mapped ?? [3]) form.querySelector(`[name="mapped"][value="${index}"]`).checked = true;
      form.elements.delimiter.value = opts.delimiter || ',';
      form.elements.repeatSingle.checked = !!opts.repeatSingle;
    }
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    if (kind === 'explode') {
      const output = d.querySelectorAll('#valPreparationPreview tbody tr');
      if (output.length) {
        assert.equal(output[0].cells.length, headers.length + 2);
        assert.equal(output[0].cells[2].textContent, ui.snapshot().sourceRows[0][0]);
        assert.equal(output[0].cells[3].textContent, ui.snapshot().sourceRows[0][1]);
        assert.match(d.getElementById('valPreparationPreview').textContent, /Extra · copied/);
      }
    }
    ui.applyPreparation();
  };
  const edit = (index, field, value, event = 'change') => {
    const el = d.querySelector(`[data-cell="${index}"][data-field="${field}"]`);
    el.value = value; el.dispatchEvent(new w.Event(event, { bubbles: true }));
  };
  const context = () => { const s = ui.snapshot(); return { headers, mapping, originalRows: s.originalRows,
    preparedRows: s.preparedRows, sourceRows: s.sourceRows, origins: s.origins, headerRow: 1,
    sheet: 'original.csv', steps: s.preparations, fileName: 'original.csv' }; };
  return { w, d, E, F, T, ui, schema, mapping, change, prepare, edit, context, upload, timers, downloads,
    writes: () => writes, state: () => state,
    account(value) { owner = value; ui.sync(); render(); },
    signOut() { ready = false; owner = ''; ui.sync(); render(); },
  };
}

test('explosion transfers each parent’s full information without crossing records, including blanks and repeated values', async t => {
  const x = await fixture(t), before = copy(original);
  const first = x.T.explode(headers, original, { primary: 2, mapped: [3] });
  assert.deepEqual(copy(first.rows), [
    ['1', 'Alpha\nname', 'P1', 'S1', '=1+1', 'x|y'],
    ['1', 'Alpha\nname', '', 'S2', '=1+1', 'x|y'],
    ['1', 'Alpha\nname', 'P3', 'S3', '=1+1', 'x|y'],
    ['2', 'Beta <x>', 'P4', 'S4', '00000', 'z'],
  ]);
  assert.deepEqual(copy(first.parents), [{ index: 0, part: '1' }, { index: 0, part: '2' }, { index: 0, part: '3' }, { index: 1, part: '' }]);
  const repeated = x.T.explode(['ID', 'Plant', 'Owner'], [['A', 'P1,,P3', 'Alice'], ['B', 'P4,P5', 'Bob']], { primary: 1, mapped: [2], repeatSingle: true });
  assert.deepEqual(copy(repeated.rows), [['A','P1','Alice'],['A','','Alice'],['A','P3','Alice'],['B','P4','Bob'],['B','P5','Bob']]);
  assert.deepEqual(original, before);
});

test('comparison separates preparation and corrections and traces successive explosions to the correct original row', async t => {
  const x = await fixture(t); x.prepare('explode'); x.prepare('sap');
  x.prepare('explode', { primary: 5, mapped: [], delimiter: '|' });
  await x.ui.run();
  let s = x.ui.snapshot();
  assert.deepEqual(copy(s.origins), [
    { row: 2, part: '1.1' }, { row: 2, part: '1.2' }, { row: 2, part: '2.1' },
    { row: 2, part: '2.2' }, { row: 2, part: '3.1' }, { row: 2, part: '3.2' }, { row: 3, part: '' },
  ]);
  assert.deepEqual(copy(s.originalRows), original);
  assert.equal(s.sourceRows[6][0], '000002'); assert.equal(s.sourceRows[6][1], 'Beta <x>');
  const writes = x.writes(); x.edit(1, 'STORAGE', 'CORRECTED');
  const report = x.F.comparison(s.draft, x.context(), x.ui.snapshot().result);
  const cell = x.F.comparisonCell(report, 1, 3);
  assert.equal(cell.original, 'S1,S2,S3'); assert.equal(cell.prepared, 'S1'); assert.equal(cell.current, 'CORRECTED');
  assert.equal(cell.label, 'Prepared + corrected'); assert.equal(report.correctedCells, 1);
  assert.equal(x.F.comparisonCell(report, 6, 1).original, 'Beta <x>');
  assert.equal(x.F.comparisonCell(report, 6, 1).label, 'Unchanged');
  assert.equal(x.F.comparisonCell(report, 6, 4).check, 'Not checked · column not mapped');
  assert.equal(x.writes(), writes); assert.doesNotMatch(JSON.stringify(x.state()), /Alpha|CORRECTED|Beta/);
  assert.equal(x.d.querySelector('[data-compare-row="1"][data-compare-field="3"] .val-comparison-label').textContent, 'Prepared + corrected');
});

test('comparison uses exact text, preserves returned-to-original changes, and rejects missing source lineage', async t => {
  const x = await fixture(t, [['000001',' A ','P1','S1','001','x']]);
  await x.ui.run(); x.edit(0, 'DESCRIPTION', 'a');
  let report = x.F.comparison(x.schema, x.context(), x.ui.snapshot().result);
  assert.equal(report.changedCells, 1); assert.equal(x.F.comparisonCell(report, 0, 1).original, ' A ');
  x.edit(0, 'DESCRIPTION', ' A ');
  report = x.F.comparison(x.schema, x.context(), x.ui.snapshot().result); assert.equal(report.changedCells, 0);
  const upload = x.context(); upload.preparedRows[0][0] = '000002';
  report = x.F.comparison(x.schema, upload, x.ui.snapshot().result);
  assert.equal(x.F.comparisonCell(report, 0, 0).label, 'Returned to original');
  upload.origins[0].row = 99; assert.throws(() => x.F.comparison(x.schema, upload, x.ui.snapshot().result), /no original source/);
});

test('comparison filters and pages retain exact row identity while exports include the entire dataset and styled fields', async t => {
  const x = await fixture(t, Array.from({length: 30}, (_,i) => [String(i+1), 'Record '+i, 'P1,P2', 'S1,S2', '=1+1', 'x']));
  x.prepare('explode'); x.prepare('sap'); await x.ui.run();
  assert.equal(x.d.querySelectorAll('[data-compare-row]').length, 50);
  await x.ui.handle({ dataset: { val: 'comparison-page', delta: '1' } });
  assert.equal(x.d.querySelector('[data-compare-row]').dataset.compareRow, '16');
  x.change(x.d.querySelector('[name="comparisonRow"]'), '60');
  x.change(x.d.querySelector('[name="comparisonField"]'), '0');
  assert.equal(x.d.querySelectorAll('[data-compare-row]').length, 1);
  assert.equal(x.d.querySelector('[data-compare-row]').dataset.compareRow, '59');
  const rowInput = x.d.getElementById('valComparisonRow');
  rowInput.focus(); rowInput.value = '2';
  rowInput.dispatchEvent(new x.w.Event('input', { bubbles: true }));
  assert.equal(x.d.querySelector('[data-compare-row]').dataset.compareRow, '1');
  assert.equal(x.d.activeElement, rowInput);
  await x.ui.handle({ dataset: { val: 'export-comparison' } });
  const { blob, name } = x.downloads[0]; assert.match(name, /-comparison\.xlsx$/);
  const book = await x.F.read({ name, size: blob.size, arrayBuffer: () => blob.arrayBuffer() });
  assert.equal(book.sheets[0].name, 'Comparison summary');
  assert.equal(book.sheets.find(s => s.name === 'Row comparison').rows.length, 61);
  assert.equal(book.sheets.find(s => s.name === 'Field comparison').rows.length, 361);
  assert.equal(book.sheets.find(s => s.name === 'Original upload').rows.length, 31);
  assert.equal(book.sheets.find(s => s.name === 'Original upload').rows[1][2], 'P1,P2');
  assert.equal(book.sheets.find(s => s.name === 'Validated upload').rows[60][0], '000030');
  assert.equal(book.sheets.find(s => s.name === 'Validated upload').rows[60][4], '=1+1');
  const zip = await x.w.JSZip.loadAsync(new x.w.Uint8Array(await blob.arrayBuffer()));
  const xml = await zip.file('xl/worksheets/sheet3.xml').async('string');
  assert.match(xml, /s="6"/); assert.match(xml, /s="3"/); assert.doesNotMatch(xml, /<f[ >]/);
  const styles = new x.w.DOMParser().parseFromString(await zip.file('xl/styles.xml').async('string'), 'application/xml');
  assert.equal(styles.querySelector('cellXfs').children.length, 7);
});

test('comparison waits for live checks and export permission, and excludes rejected original data from accepted exports', async t => {
  const x = await fixture(t); x.prepare('explode'); await x.ui.run();
  x.edit(0, 'MAT', '000001', 'input');
  assert.equal(x.d.querySelector('[data-val="export-comparison"]').disabled, true);
  await assert.rejects(x.ui.handle({ dataset: { val: 'export-comparison' } }), /Wait for validation/);
  for (const fn of [...x.timers.values()]) fn();
  x.w.WorkHubCurrentAccess = { can: (id, action) => action !== 'export' };
  await assert.rejects(x.ui.handle({ dataset: { val: 'export-comparison' } }), /disabled/);
  x.w.WorkHubCurrentAccess = { can: () => true };
  await x.ui.handle({ dataset: { val: 'accepted' } });
  const { blob, name } = x.downloads[0];
  const book = await x.F.read({ name, size: blob.size, arrayBuffer: () => blob.arrayBuffer() });
  assert.equal(book.sheets.some(s => s.name === 'Original upload'), false);
  assert.equal(book.sheets.some(s => s.name === 'Field comparison'), false);
  assert.equal(book.sheets.find(s => s.name === 'Prepared upload').rows.length, 2);
});

test('comparison snapshots follow undo, restore, new uploads and account cleanup; late exports are discarded', async t => {
  const x = await fixture(t); x.prepare('explode'); x.prepare('sap'); await x.ui.run();
  x.edit(0, 'DESCRIPTION', 'Correction'); x.ui.undoPreparation();
  assert.equal(x.ui.snapshot().preparedRows[0][0], '1');
  assert.equal(x.ui.snapshot().preparedRows[0][1], 'Alpha\nname');
  await x.ui.run(); x.ui.undoPreparation(true); await x.ui.run();
  assert.deepEqual(copy(x.ui.snapshot().preparedRows), original);
  await x.upload([['000003','New','P1','S1','keep','z']]); await x.ui.run();
  assert.equal(x.ui.snapshot().originalRows[0][1], 'New');
  const pending = x.ui.handle({ dataset: { val: 'export-comparison' } }); x.account('another'); await pending;
  assert.equal(x.downloads.length, 0); assert.equal(x.ui.snapshot().originalRows.length, 0);
  assert.equal(x.ui.snapshot().preparedRows.length, 0); assert.equal(x.d.getElementById('valComparison'), null);
});

test('comparison exports long original list values once in full and retains their cell locator in each discrepancy', async t => {
  const long = 'A'.repeat(1100) + ',B';
  const x = await fixture(t, [['000001','Long',long,'S1,S2','=1+1','z']]);
  x.prepare('explode'); await x.ui.run(); await x.ui.handle({ dataset: { val: 'export-comparison' } });
  const { blob, name } = x.downloads[0], book = await x.F.read({ name, size: blob.size, arrayBuffer: () => blob.arrayBuffer() });
  assert.equal(book.sheets.find(s => s.name === 'Original upload').rows[1][2], long);
  const diff = book.sheets.find(s => s.name === 'Field comparison').rows.find(row => row[6] === 'PLANT');
  assert.match(diff[8], /Full value: Original upload!C2/);
  assert.equal(diff[10], 'A'.repeat(1100));
});

test('comparison covers the full 200,000-cell limit without truncating rows or fields', async t => {
  const x = await fixture(t), names = Array.from({length:200},(_,i) => 'Field '+i);
  const values = Array.from({length:1000},(_,i) => names.map((_,j) => i+':'+j));
  const upload = { headers:names, originalRows:values, preparedRows:values, sourceRows:values,
    origins:values.map((_,i) => ({row:i+6,part:''})),mapping:{},headerRow:5,steps:[],sheet:'Data' };
  const result = { issues:[],status:values.map(() => ({errors:0,warnings:0,ignored:0})) };
  const report = x.F.comparison(x.schema, upload, result);
  assert.equal(report.rows.length,1000); assert.equal(report.fields.length,200); assert.equal(report.changedCells,0);
  assert.equal(x.F.comparisonCell(report,999,199).original,'999:199');
});
