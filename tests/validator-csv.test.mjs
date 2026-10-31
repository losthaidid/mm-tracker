import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const xml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const cell = (ref, value, attrs = '') => `<c r="${ref}" ${attrs}><v>${xml(value)}</v></c>`;
const textCell = (ref, value, attrs = '') => `<c r="${ref}" t="inlineStr" ${attrs}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
const row = (n, values, attrs = '') => `<row r="${n}" ${attrs}>${values}</row>`;
const styles = (formats = [], ids = [0], extras = '') => `<styleSheet xmlns="${ns}"><numFmts>${formats.map(([id, format]) => `<numFmt numFmtId="${id}" formatCode="${xml(format)}"/>`).join('')}</numFmts><cellStyleXfs><xf numFmtId="0"/></cellStyleXfs><cellXfs>${ids.map(id => `<xf numFmtId="${id}" xfId="0"/>`).join('')}</cellXfs>${extras}</styleSheet>`;

function fixture(t) {
  const dom = new JSDOM('<div id="view"></div><dialog id="modal"><div id="modalBody"></div></dialog>', { url: 'https://example.test', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document;
  Object.assign(w, { Blob, TextEncoder, TextDecoder, setImmediate, clearImmediate });
  for (const file of ['vendor/jszip.min.js', 'vendor/ssf.js', 'validator-engine.js', 'validator-transform.js', 'validator-files.js', 'validator-csv.js']) w.eval(source(file));
  const F = w.WorkHubValidatorFiles, C = w.WorkHubValidatorCSV;
  async function workbook(sheets, options = {}) {
    const zip = new w.JSZip();
    zip.file('xl/workbook.xml', `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr date1904="${options.date1904 || '0'}"/><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name || 'Sheet ' + (i + 1))}" sheetId="${i + 1}" r:id="r${i}" state="${s.state || 'visible'}"/>`).join('')}</sheets></workbook>`);
    zip.file('xl/_rels/workbook.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="r${i}" Target="worksheets/s${i}.xml"/>`).join('')}</Relationships>`);
    if (options.styles) zip.file('xl/styles.xml', options.styles);
    if (options.shared) zip.file('xl/sharedStrings.xml', `<sst xmlns="${ns}">${options.shared}</sst>`);
    for (const [i, s] of sheets.entries()) zip.file(`xl/worksheets/s${i}.xml`, `<worksheet xmlns="${ns}">${s.before || ''}<sheetData>${s.data || ''}</sheetData>${s.after || ''}</worksheet>`);
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
    return { name: options.filename || 'source.xlsx', size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
  }
  const read = (sheets, options) => workbook(sheets, options).then(file => F.read(file, { displayValues: true }));
  const unzip = blob => blob.arrayBuffer().then(bytes => w.JSZip.loadAsync(new w.Uint8Array(bytes), { checkCRC32: true }));
  return { w, d, F, C, workbook, read, unzip };
}

async function pythonCSV(blob) {
  const result = spawnSync('python3', ['-c', 'import csv,sys,io,json; sys.stdout.write(json.dumps(list(csv.reader(io.StringIO(sys.stdin.buffer.read().decode("utf-8-sig"), newline=""))),ensure_ascii=False))'], { input: Buffer.from(await blob.arrayBuffer()), maxBuffer: 12000000, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('formatted conversion preserves numeric codes, dates, percentages, booleans and cached formula results', async t => {
  const x = fixture(t), data = row(1, textCell('A1', 'ID') + textCell('B1', 'Value')) + row(2,
    cell('A2', '7', 's="1"') + cell('B2', '.125', 's="2"') + cell('C2', '45292.5', 's="3"') +
    cell('D2', '0', 't="b"') + cell('E2', '1', 't="b"') + cell('F2', '0') +
    textCell('G2', '123456789012345678901234567890') +
    '<c r="H2" s="1"><f>XLOOKUP(A2,Other!A:A,Other!B:B)</f><v>12</v></c>' +
    '<c r="I2" t="str"><f>IF(A2=7,&quot;&quot;,&quot;x&quot;)</f><v></v></c>' +
    '<c r="J2"><f>1-1</f><v>0</v></c>' + cell('K2', '#N/A', 't="e"') +
    cell('L2', '1234.5', 's="4"') + cell('M2', '1.5', 's="5"'));
  const book = await x.read([{ data }], { styles: styles([[164, '000000'], [165, '0.00%'], [166, 'yyyy-mm-dd hh:mm:ss'], [167, '#,##0.00'], [168, '[h]:mm:ss']], [0, 164, 165, 166, 167, 168]) });
  const expected = ['000007', '12.50%', '2024-01-01 12:00:00', 'FALSE', 'TRUE', '0', '123456789012345678901234567890', '000012', '', '0', '#N/A', '1,234.50', '36:00:00'];
  assert.deepEqual(plain(book.sheets[0].rows[1]), expected);
  assert.equal(book.sheets[0].notes.formulas, 3); assert.equal(book.sheets[0].notes.errors, 1);
  const output = await x.C.prepare(book, [0], 'my.source.xlsx');
  assert.deepEqual((await pythonCSV(output.blob))[1], expected);
  assert.equal(output.verified, true); assert.equal(output.name, 'my-source-Sheet-1.csv');
});

test('worksheet positions, blank edges, duplicate headers, rich strings and OOXML escapes survive conversion', async t => {
  const x = fixture(t), data = row(2, textCell('B2', 'Header') + textCell('C2', 'Header')) + row(4,
    textCell('B4', '  spaces, "quotes" µL 界 😀  ') +
    '<c r="C4" t="s"><v>0</v></c>' +
    '<c r="D4" t="inlineStr"><is><r><t>Rich</t></r><rPh sb="0" eb="1"><t>phonetic</t></rPh><r><t> text</t></r></is></c>' +
    textCell('E4', '_x000D_\nnext _x005F_x0041_')) + row(5, '<c r="F5"/>');
  const book = await x.read([{ data, before: '<dimension ref="A1:XFD1048576"/>' }], { shared: '<si><r><t>shared</t></r><rPh sb="0" eb="1"><t>phonetic</t></rPh><r><t> value</t></r></si>' });
  const expected = [
    ['', '', '', '', '', ''], ['', 'Header', 'Header', '', '', ''], ['', '', '', '', '', ''],
    ['', '  spaces, "quotes" µL 界 😀  ', 'shared value', 'Rich text', '\r\nnext _x0041_', ''],
    ['', '', '', '', '', ''],
  ];
  assert.deepEqual(plain(book.sheets[0].rows), expected);
  assert.deepEqual(await pythonCSV((await x.C.prepare(book, [0], 'positions.xlsx')).blob), expected);
});

test('cell, row and column styles have correct precedence, and format tables are isolated between files', async t => {
  const x = fixture(t), formats = styles([[164, '0000'], [165, '0.00%']], [0, 164, 165]);
  const book = await x.read([{ before: '<cols><col min="1" max="3" style="1" hidden="1"/></cols>', data: row(1, cell('A1', '7') + cell('B1', '.25', 's="2"')) + row(2, cell('A2', '.5') + cell('B2', '7', 's="1"'), 's="2" customFormat="1" hidden="1"') }], { styles: formats });
  assert.deepEqual(plain(book.sheets[0].rows), [['0007', '25.00%'], ['50.00%', '0007']]);
  assert.equal(book.sheets[0].notes.hiddenRows, 1); assert.equal(book.sheets[0].notes.hiddenColumns, 3);
  const second = await x.read([{ data: row(1, cell('A1', '7', 's="1"')) }], { styles: styles([[164, '0.0']], [0, 164]) });
  assert.equal(second.sheets[0].rows[0][0], '7.0');
  const inherited = formats.replace('<cellStyleXfs><xf numFmtId="0"/></cellStyleXfs>', '<cellStyleXfs><xf numFmtId="164"/></cellStyleXfs>').replace('<xf numFmtId="165" xfId="0"/>', '<xf numFmtId="165" xfId="0" applyNumberFormat="0"/>');
  assert.equal((await x.read([{ data: row(1, cell('A1', '7', 's="2"')) }], { styles: inherited })).sheets[0].rows[0][0], '0007');
});

test('both Excel date systems and ISO dates use the workbook format, and locale dates are flagged', async t => {
  const x = fixture(t), formats = styles([[164, 'yyyy-mm-dd']], [0, 164, 14]);
  const first = await x.read([{ data: row(1, cell('A1', '0', 's="1"') + cell('B1', '1904-01-02T00:00:00Z', 't="d" s="1"')) }], { styles: formats, date1904: '1' });
  assert.deepEqual(plain(first.sheets[0].rows[0]), ['1904-01-01', '1904-01-02']);
  const second = await x.read([{ data: row(1, cell('A1', '45292', 's="2"')) }], { styles: formats });
  assert.equal(second.sheets[0].rows[0][0], '1/1/24'); assert.equal(second.sheets[0].notes.localeFormats, true);
  await assert.rejects(x.read([{ data: row(1, cell('A1', '1')) }], { date1904: 'invalid' }), /invalid date system/);
});

test('missing direct and shared/array formula caches stop conversion with the exact source cell', async t => {
  const x = fixture(t);
  for (const data of [row(1, '<c r="A1"><f>1+1</f></c>'), row(1, '<c r="A1"><f t="array" ref="A1:B1">SEQUENCE(1,2)</f><v>1</v></c>'), row(1, '<c r="A1"><f t="shared" si="0" ref="A1:A2">ROW()</f><v>1</v></c>') + row(2, '<c r="A2"><f t="shared" si="0"/></c>')]) {
    await assert.rejects(x.read([{ name: 'Formulas', data }]), /Formulas![AB][12].*(?:without a saved result|without a saved result)/);
  }
  const book = await x.read([{ data: row(1, '<c r="A1"><f t="array" ref="A1:B1">SEQUENCE(1,2)</f><v>1</v></c>' + cell('B1', '2')) }]);
  assert.deepEqual(plain(book.sheets[0].rows[0]), ['1', '2']);
});

test('unreproducible displays fail explicitly instead of dropping or changing values', async t => {
  const x = fixture(t);
  for (const [format, expected] of [[';;;', /nonblank value hidden/], ['[$-407]dddd, dd mmmm yyyy', /locale-dependent/], ['[DBNum1]0', /cannot be converted safely/]]) {
    await assert.rejects(x.read([{ data: row(1, cell('A1', '45292', 's="1"')) }], { styles: styles([[164, format]], [0, 164]) }), expected);
  }
  await assert.rejects(x.read([{ data: row(1, cell('A1', '1', 's="1"')) }], { styles: styles([], [0, 999]) }), /unsupported number format/);
  await assert.rejects(x.read([{ data: row(1, textCell('A1', '_x0000_')) }]), /null character/);
  await assert.rejects(x.read([{ data: row(1, cell('A1', '1', 's="3"')) }], { styles: styles() }), /invalid cell style/);
  await assert.rejects(x.read([{ data: row(1, cell('A1', '1', 's="1"')) }], { styles: styles([], [0, 'bogus']) }), /invalid number format/);
  await assert.rejects(x.read([{ data: row(1, cell('B2', '1')) }]), /outside its declared/);
  const conditional = '<dxfs><dxf><numFmt numFmtId="164" formatCode="0.0%"/></dxf></dxfs>';
  await assert.rejects(x.read([{ data: row(1, cell('A1', '1')), after: '<conditionalFormatting sqref="A1"><cfRule dxfId="0" type="cellIs" operator="greaterThan"><formula>0</formula></cfRule></conditionalFormatting>' }], { styles: styles([], [0], conditional) }), /conditional number formats/);
  const unused = await x.read([{ data: row(1, cell('A1', '7', 's="1"')) }], { styles: styles([[164, '0000']], [0, 164], conditional) });
  assert.equal(unused.sheets[0].rows[0][0], '0007', 'unused conditional formats cannot override base formats');
});

test('normal validation and standalone comparison readers retain their existing behavior', async t => {
  const x = fixture(t), file = await x.workbook([{ data: row(2, cell('A2', '.125', 's="1"') + cell('B2', '7', 's="2"')) }], { styles: styles([[164, '0.00%'], [165, '0000']], [0, 164, 165]) });
  for (const options of [{}, { valuesOnly: true }]) {
    const book = await x.F.read(file, options); assert.deepEqual(plain(book.sheets[0].rows), [[], ['.125', '0007']]); assert.equal(book.sheets[0].notes, undefined);
  }
  const formula = await x.workbook([{ data: row(1, '<c r="A1"><f>1+1</f><v>2</v></c>') }]);
  await assert.rejects(x.F.read(formula), /contains a formula/);
  assert.equal((await x.F.read(formula, { valuesOnly: true })).sheets[0].rows[0][0], '2');
});

test('CSV bytes round-trip through Python with BOM, quotes, embedded CR/LF, Unicode and formula-like text untouched', async t => {
  const x = fixture(t), rows = [
    ['Code', 'Value', 'Blank', 'Blank'], ['00001', 'A, "quoted"\r\nµL 😀', '', ''],
    ['12345678901234567890', '=XLOOKUP(A1,B:B,C:C)', '  spaces  ', '\r\n\r\n'],
    ['+123', '-123', '@LITERAL', '\uFEFFleading BOM in a cell'], ['', '', '', ''],
  ], sheet = { name: 'Data', rows }, before = plain(sheet), result = await x.C.csv(sheet);
  assert.deepEqual([...new Uint8Array(await result.blob.arrayBuffer()).slice(0, 3)], [239, 187, 191]);
  assert.deepEqual(await pythonCSV(result.blob), rows); assert.deepEqual(sheet, before);
  assert.equal(result.cells, 20); assert.equal(result.verified, true);
  const empty = await x.C.csv({ name: 'Empty', rows: [], width: 0 }); assert.deepEqual(await pythonCSV(empty.blob), []);
});

test('verification rejects altered UTF-8 data, missing cells and truncated records', async t => {
  const x = fixture(t), sheet = { name: 'Data', rows: [['0007', 'µL'], ['', '']] };
  for (const bad of ['\uFEFF"7","µL"\r\n"",""\r\n', '\uFEFF"0007","µL"\r\n', '\uFEFF"0007","µL"\r\n"",""', '\uFEFF"0007","µL","extra"\r\n"",""\r\n'])
    await assert.rejects(x.C.verify(new Blob([bad]), sheet), /CSV verification failed/);
  await assert.rejects(x.C.verify(new Blob([new Uint8Array([255])]), sheet), /encoded data/);
});

test('multiple selected sheets become distinct ordered CSVs in a verified ZIP including hidden and empty sheets', async t => {
  const x = fixture(t), book = { sheets: [{ name: 'A B', rows: [['001', 'left']] }, { name: 'a-b', state: 'hidden', rows: [['002', 'right']] }, { name: 'Blank', rows: [], width: 0 }] }, before = plain(book);
  const output = await x.C.prepare(book, [2, 1, 0], 'Queue.xlsx'), zip = await x.unzip(output.blob);
  assert.equal(output.name, 'Queue-csv.zip'); assert.equal(output.files.length, 3); assert.equal(output.cells, 4);
  assert.deepEqual(Object.keys(zip.files), ['Queue-A-B.csv', 'Queue-a-b-2.csv', 'Queue-Blank.csv']);
  for (const [i, entry] of Object.values(zip.files).entries()) assert.deepEqual(await pythonCSV(new Blob([await entry.async('uint8array')])), book.sheets[i].rows);
  assert.deepEqual(book, before); assert.ok(output.files.every(f => !Object.hasOwn(f, 'blob')));
  await assert.rejects(x.C.prepare(book, [], 'bad.xlsx'), /Select at least one/);
  await assert.rejects(x.C.prepare(book, [0, 0], 'bad.xlsx'), /Select at least one/);
});

test('wide data beyond the validator field limit is complete and cancellation prevents a prepared download', async t => {
  const x = fixture(t), rows = Array.from({ length: 201 }, (_, i) => Array.from({ length: 204 }, (_, j) => `${String(i).padStart(6, '0')}:${j}`));
  const book = await x.read([{ data: rows.map((r, i) => row(i + 1, r.map((v, j) => textCell(x.F.col(j) + (i + 1), v)).join(''))).join('') }]);
  assert.equal(book.sheets[0].width, 204); assert.deepEqual((await pythonCSV((await x.C.prepare(book, [0], 'wide.xlsx')).blob)).at(-1), rows.at(-1));
  let cancel = false;
  await assert.rejects(x.C.prepare(book, [0], 'cancel.xlsx', { guard() { if (cancel) throw Error('Cancelled'); }, progress() { cancel = true; } }), /Cancelled/);
  await assert.rejects(x.read([{ data: row(1, textCell('ALM1', 'too wide')) }]), /1,000 columns/);
  await assert.rejects(x.read([{ data: row(25002, cell('A25002', '1')) }]), /25,001 worksheet rows/);
  const controller = new x.w.AbortController(); controller.abort();
  await assert.rejects(x.F.read(await x.workbook([{ data: row(1, cell('A1', '1')) }]), { displayValues: true, signal: controller.signal }), /cancelled/);
});

async function studio(t, withTemplate = false) {
  const x = fixture(t), { w, d } = x;
  w.confirm = () => true; w.HTMLDialogElement.prototype.showModal = function () { this.open = true; }; w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const file of ['validator-compare-engine.js', 'validator-compare.js', 'validator-studio.js']) w.eval(source(file));
  const E = w.WorkHubValidatorEngine;
  let owner = 'owner', ready = true, writes = 0, ui, state = { projects: [], projectCompanies: [], workhub: { validator: { templates: withTemplate ? [E.example()] : [], runs: [] } } };
  const downloads = [], messages = [], render = () => { if (!ui.patchRender()) d.getElementById('view').innerHTML = ui.render(); };
  ui = w.WorkHubValidatorStudio.install({ state: () => state, owner: () => owner, ready: () => ready, render, tell: text => messages.push(text), mutate(fn) { const next = E.copy(state); fn(next); E.prepare(next, state); E.validateState(next); state = next; writes++; render(); return true; }, download(blob, name, type) { downloads.push({ blob, name, type }); }, openModal(title, body) { d.getElementById('modalBody').innerHTML = body; d.getElementById('modal').showModal(); }, closeModal() { d.getElementById('modal').close(); } });
  render();
  const mode = value => ui.handle({ dataset: { val: 'mode', mode: value } });
  const change = (el, value) => { if (el.type === 'checkbox') el.checked = value; else el.value = value; el.dispatchEvent(new w.Event('change', { bubbles: true })); };
  return { ...x, ui, downloads, messages, render, mode, change, writes: () => writes, state: () => plain(state), account(value) { owner = value; ui.sync(); render(); }, signOut() { ready = false; owner = ''; ui.sync(); render(); } };
}

test('standalone CSV workspace works without a template beside comparison, verifies once and supports download again', async t => {
  const x = await studio(t), initial = x.state();
  const compareButton = x.d.querySelector('[data-mode="file-compare"]'); assert.equal(compareButton.nextElementSibling.dataset.mode, 'excel-csv');
  await x.mode('excel-csv'); assert.ok(x.d.getElementById('valCSVWorkspace'));
  await x.ui.csvConverter.loadFile(await x.workbook([{ name: 'Values', data: row(1, textCell('A1', '000007')) }, { name: 'Extra', data: row(1, textCell('A1', 'right')) }]));
  assert.equal(x.d.querySelector('.vcsv-preview-table tbody td').textContent, '000007');
  await x.ui.csvConverter.convert(); assert.match(x.ui.csvConverter.snapshot().message, /Verified 1 cell/);
  x.ui.csvConverter.download(); x.ui.csvConverter.download();
  assert.equal(x.downloads.length, 2); assert.strictEqual(x.downloads[0].blob, x.downloads[1].blob); assert.match(x.d.querySelector('[data-vcsv="download"]').textContent, /Download again/);
  assert.deepEqual(await pythonCSV(x.downloads[0].blob), [['000007']]);
  x.change(x.d.getElementById('valCSVPreviewSheet'), '1'); assert.ok(x.ui.csvConverter.snapshot().ready, 'preview-only selection retains verified download');
  x.change(x.d.querySelector('[data-vcsv-sheet="1"]'), true); assert.equal(x.ui.csvConverter.snapshot().ready, null);
  assert.throws(() => x.ui.csvConverter.download(), /Convert and verify/);
  await x.ui.csvConverter.convert(); x.ui.csvConverter.download(); assert.equal(x.downloads.at(-1).type, 'application/zip');
  assert.equal(x.writes(), 0); assert.deepEqual(x.state(), initial);
});

test('CSV workspace retains loaded validation and comparison work when switching modes', async t => {
  const x = await studio(t, true), csv = 'Material,Description,Plant\n00001,Private original,P1';
  await x.ui.loadFile({ name: 'validation.csv', size: csv.length, text: async () => csv });
  const before = plain(x.ui.snapshot());
  await x.mode('excel-csv'); await x.ui.csvConverter.loadFile(await x.workbook([{ data: row(1, textCell('A1', 'separate')) }])); await x.ui.csvConverter.convert();
  await x.mode('file-compare'); assert.ok(x.d.getElementById('valStandaloneCompare')); await x.mode('check');
  const after = plain(x.ui.snapshot());
  for (const key of ['draft', 'originalRows', 'sourceRows', 'mapping', 'preparations', 'result']) assert.deepEqual(after[key], before[key], key);
  await x.mode('excel-csv'); assert.ok(x.ui.csvConverter.snapshot().ready); assert.equal(x.writes(), 0);
  assert.doesNotMatch(JSON.stringify(x.state()), /Private original|separate/);
});

test('new files, failed reads, account changes and permission changes cannot expose a stale CSV download', async t => {
  const x = await studio(t); await x.mode('excel-csv');
  const file = await x.workbook([{ data: row(1, textCell('A1', 'private')) }]);
  await x.ui.csvConverter.loadFile(file); await x.ui.csvConverter.convert();
  await assert.rejects(x.ui.csvConverter.loadFile({ name: 'bad.xlsm' }), /\.xls or \.xlsx/); assert.equal(x.ui.csvConverter.snapshot().ready, null); assert.deepEqual(plain(x.ui.csvConverter.snapshot().sheets), []);
  await x.ui.csvConverter.loadFile(file); await x.ui.csvConverter.convert();
  x.w.WorkHubCurrentAccess = { can: (feature, action) => action !== 'export' };
  assert.throws(() => x.ui.csvConverter.download(), /cannot export/); assert.equal(x.downloads.length, 0);
  delete x.w.WorkHubCurrentAccess; x.account('other'); assert.equal(x.ui.csvConverter.snapshot().ready, null); assert.deepEqual(plain(x.ui.csvConverter.snapshot().sheets), []);
  let release; const delayed = { ...file, arrayBuffer: () => new Promise(resolve => { release = resolve; }) };
  const pending = x.ui.csvConverter.loadFile(delayed); x.account('third'); release(await file.arrayBuffer()); await pending;
  assert.deepEqual(plain(x.ui.csvConverter.snapshot().sheets), []); assert.equal(x.ui.csvConverter.snapshot().busy, false);
  x.w.WorkHubCurrentAccess = { can: (feature, action) => action !== 'run' };
  await assert.rejects(x.ui.csvConverter.loadFile(file), /cannot run/);
  delete x.w.WorkHubCurrentAccess; x.signOut(); await assert.rejects(x.ui.csvConverter.loadFile(file), /Sign in/);
});

test('Cancel clears an in-flight read and selection/preview controls never clip exported rows', async t => {
  const x = await studio(t); await x.mode('excel-csv');
  const file = await x.workbook([{ data: Array.from({ length: 23 }, (_, i) => row(i + 1, textCell('J' + (i + 1), String(i).padStart(5, '0')))).join('') }]);
  let release; const pending = x.ui.csvConverter.loadFile({ ...file, arrayBuffer: () => new Promise(resolve => { release = resolve; }) });
  x.ui.csvConverter.clear(); release(await file.arrayBuffer()); await pending; assert.equal(x.ui.csvConverter.snapshot().filename, ''); assert.equal(x.ui.csvConverter.snapshot().ready, null);
  await x.ui.csvConverter.loadFile(file); await x.ui.csvConverter.handle({ dataset: { vcsv: 'rows-next' } }); await x.ui.csvConverter.handle({ dataset: { vcsv: 'cols-next' } });
  assert.match(x.d.querySelector('.vcsv-pages').textContent, /Rows 11–20/); assert.match(x.d.querySelector('.vcsv-pages').textContent, /Columns I–J/);
  await x.ui.csvConverter.convert(); x.ui.csvConverter.download(); const rows = await pythonCSV(x.downloads[0].blob); assert.equal(rows.length, 23); assert.equal(rows[22][9], '00022');
  await x.ui.csvConverter.handle({ dataset: { vcsv: 'select-none' } }); await x.ui.csvConverter.convert(); assert.equal(x.ui.csvConverter.snapshot().ready, null); assert.match(x.ui.csvConverter.snapshot().message, /Select at least one/);
});
