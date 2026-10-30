import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, after } from 'node:test';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('', { runScripts: 'outside-only' });
const w = dom.window;
w.Blob = Blob;
w.TextEncoder = TextEncoder;
w.TextDecoder = TextDecoder;
w.setImmediate = setImmediate;
w.clearImmediate = clearImmediate;
w.eval(readFileSync(new URL('../vendor/jszip.min.js', import.meta.url), 'utf8'));
for (const file of ['validator-engine.js', 'validator-files.js', 'validator-setup.js']) {
  w.eval(readFileSync(new URL('../' + file, import.meta.url), 'utf8'));
}
after(() => w.close());
const E = w.WorkHubValidatorEngine, S = w.WorkHubValidatorSetup, F = w.WorkHubValidatorFiles;
const copy = v => JSON.parse(JSON.stringify(v));
const bytes = readFileSync(new URL('../validation-setup-template.xlsx', import.meta.url));
const sample = await F.read({ name: 'setup.xlsx', size: bytes.length, arrayBuffer: async () => bytes });
const sheet = (b, name) => b.sheets.find(s => s.name === name);
function set(b, name, row, header, value) {
  const s = sheet(b, name);
  s.rows[row][s.rows[0].indexOf(header)] = value;
}
const data = overrides => ({ MATERIAL: '000123', PLANT: 'P001', STORAGE_LOCATION: '0001', QUANTITY: '0', MOVEMENT_TYPE: '101', COST_CENTER: '', ...overrides });

test('Excel setup: shipped workbook creates working columns, conditional rules, tuple references and unique combinations', () => {
  const before = copy(sample), t = S.parse(sample);
  assert.deepEqual(copy(sample), before);
  assert.equal(t.columns.length, 6);
  assert.equal(t.rules.length, 3);
  assert.equal(t.lookups.length, 2);
  assert.deepEqual(copy(t.uniqueGroups), [['MATERIAL', 'PLANT', 'STORAGE_LOCATION']]);
  assert.equal(t.lookups[1].rows[0][1], '0001');
  assert.equal(t.columns[3].min, 0);
  assert.equal(E.validateRows(t, [data()]).errors, 0);
  assert.equal(E.validateRows(t, [data({ STORAGE_LOCATION: '0002' })]).errors, 1);
  assert.equal(E.validateRows(t, [data({ MOVEMENT_TYPE: '201' })]).errors, 1);
  assert.equal(E.validateRows(t, [data({ MOVEMENT_TYPE: '201', COST_CENTER: 'CC01' })]).errors, 0);
  assert.equal(E.validateRows(t, [data(), data()]).errors, 2);
  assert.equal(t.releases.length, 0);
  E.validateState({ workhub: { validator: { templates: [t], runs: [] } } });
});

test('Excel setup: older multi-sheet headers remain General and keep their existing checks', () => {
  const b=copy(sample);
  const metadata=sheet(b,'Template');metadata.rows=metadata.rows.map(row=>row.slice(0,3));
  const columns=sheet(b,'Columns');columns.rows=columns.rows.map(row=>row.slice(0,15));
  const t=S.parse(b);assert.equal(t.mode,'general');assert.equal(t.columns.length,6);
  assert.equal(E.validateRows(t,[data()]).errors,0);
  assert.equal(E.validateRows(t,[data({MOVEMENT_TYPE:'201'})]).errors,1);
  assert.equal(t.rules.length,3);assert.equal(t.lookups.length,2);
});

test('Excel setup: missing or misspelled sections and invalid column options fail without partial results', () => {
  for (const [name, change, error] of [
    ['missing sheet', b => b.sheets.splice(b.sheets.findIndex(s => s.name === 'Columns'), 1), /Missing Columns/],
    ['misspelled header', b => sheet(b, 'Columns').rows[0][3] = 'Reqired', /unknown header/],
    ['boolean', b => set(b, 'Columns', 1, 'Required', 'maybe'), /Yes or No/],
    ['number', b => set(b, 'Columns', 1, 'Min', '12x'), /must be a number/],
    ['duplicate field', b => set(b, 'Columns', 2, 'Field', 'MATERIAL'), /unique/],
    ['unsafe field', b => set(b, 'Columns', 1, 'Field', 'constructor'), /Technical field/],
    ['type', b => set(b, 'Columns', 1, 'Type', 'javascript'), /types/],
    ['reference column', b => set(b, 'References', 1, 'Code column', 'Missing'), /reference code column/],
    ['missing data sheet', b => set(b, 'References', 1, 'Sheet', 'Missing'), /reference data sheet/],
    ['unsupported version', b => set(b, 'Template', 1, 'Format version', '2'), /version 1/],
  ]) {
    const b = copy(sample);
    change(b);
    assert.throws(() => S.parse(b), error, name);
  }
});

test('Excel setup: nested AND/OR groups preserve joins, typed comparisons and explicit warning metadata', () => {
  const b = copy(sample), s = sheet(b, 'Conditions'), h = s.rows[0];
  const row = values => h.map(k => values[k] ?? '');
  s.rows = [h,
    row({ 'Rule ID': 'conditional', Name: 'Owner review', Severity: 'warning', Part: 'when', Group: 'root', Join: 'all', Field: 'QUANTITY', Operator: 'gte', Value: '10' }),
    row({ 'Rule ID': 'conditional', Part: 'when', Group: '1', Join: 'any', Field: 'PLANT', Operator: 'eq', Value: 'P001' }),
    row({ 'Rule ID': 'conditional', Part: 'when', Group: '1', Field: 'MOVEMENT_TYPE', Operator: 'eq', Value: '201' }),
    row({ 'Rule ID': 'conditional', Part: 'assert', Field: 'COST_CENTER', Operator: 'notEmpty' }),
  ];
  const t = S.parse(b);
  assert.equal(t.rules[0].when.groups[0].join, 'any');
  assert.equal(E.validateRows(t, [data({ QUANTITY: '20' })]).warnings, 1);
  assert.equal(E.validateRows(t, [data({ QUANTITY: '0' })]).warnings, 0);
  assert.equal(E.validateRows(t, [data({ QUANTITY: '20', PLANT: 'P002' })]).warnings, 0);
  assert.equal(E.validateRows(t, [data({ QUANTITY: '20', PLANT: 'P002', MOVEMENT_TYPE: '201' })]).warnings, 1);
});

test('Excel setup: incomplete rules and invalid reference links cannot silently become different checks', () => {
  for (const [change, error] of [
    [b => set(b, 'Conditions', 1, 'Operator', ''), /choose an Operator/],
    [b => set(b, 'Conditions', 1, 'Reference ID', 'missing'), /reference list/],
    [b => set(b, 'Conditions', 3, 'Pairs', 'PLANT'), /write pairs/],
    [b => sheet(b, 'Conditions').rows.pop(), /needs an assert row/],
    [b => set(b, 'Conditions', 2, 'Join', 'maybe'), /Join must/],
    [b => set(b, 'Conditions', 2, 'Group', '1.1.1.1.1'), /up to four levels/],
    [b => set(b, 'Conditions', 3, 'Name', 'Different rule name'), /conflicting Name/],
  ]) {
    const b = copy(sample); change(b); assert.throws(() => S.parse(b), error);
  }
});

test('Excel setup: optional sections can be omitted and limits still use the existing schema guards', () => {
  const b = copy(sample);
  b.sheets = b.sheets.filter(s => ['Template', 'Columns'].includes(s.name));
  assert.equal(S.parse(b).rules.length, 0);
  const cols = sheet(b, 'Columns');
  for (let i = 6; i < 200; i++) {
    const row = copy(cols.rows[1]); row[0] = 'FIELD_' + i; row[1] = 'Field ' + i; cols.rows.push(row);
  }
  assert.equal(S.parse(b).columns.length, 200);
  const row = copy(cols.rows[1]); row[0] = 'FIELD_200'; row[1] = 'Field 200'; cols.rows.push(row);
  assert.throws(() => S.parse(b), /200 columns/);
});
