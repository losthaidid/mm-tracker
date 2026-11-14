import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const window = {};
for (const file of ['sap-tables-data.js', 'sap-tables-engine.js'])
  runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { window });
const disallowed = /^(javascript|data):/i;
const data = window.WorkHubSapTablesData;
const engine = window.WorkHubSapTablesEngine;
const snapshot = value => JSON.parse(JSON.stringify(value));
const blank = () => ({ workhub: {} });
const record = (code, id = 'custom-1') => ({
  id,
  code,
  title: 'Goods receipt audit',
  module: 'MM',
  group: 'Custom tables',
  systemLabel: 'MM QA',
  description: 'Track additional checks for each purchase order item.',
  systems: ['ecc', 's4'],
  kind: 'table',
  fields: ['EBELN', 'EBELP'],
  links: [{ code: 'EKPO', fields: 'EBELN + EBELP', note: 'Use for receipts with QA failures.' }],
  notes: '',
  sourceUrl: '',
  favorite: false,
  archived: false,
});

test('the starter tables and views have unique technical names, valid sources and resolvable relationships', () => {
  assert.ok(data.tables.length >= 50);
  const codeMap = new Map(data.tables.map(row => [row.code, row]));
  assert.equal(codeMap.size, data.tables.length);
  assert.deepEqual(
    [...new Set(data.tables.map(row => row.module))].sort(),
    ['BP', 'CO', 'EWM', 'FI', 'MM', 'PP', 'PS', 'QM', 'SD', 'WM'],
  );
  for (const row of data.tables) {
    assert.equal(row.standard, undefined);
    assert.ok(row.fields.length);
    assert.ok(row.systems.every(system => Object.hasOwn(data.systems, system)));
    if (row.alternative) assert.equal(codeMap.get(row.alternative).kind, 'cds');
    for (const id of row.sources) {
      const url = new URL(data.sources[id][1]);
      assert.equal(url.protocol, 'https:');
      assert.ok(['help.sap.com', 'community.sap.com'].includes(url.hostname));
    }
  }
  for (const link of data.relationships) {
    assert.ok(data.sources[link.source], link.source);
    assert.ok(codeMap.has(link.from), link.from);
    assert.ok(codeMap.has(link.to), link.to);
    assert.ok(link.systems.every(system => codeMap.get(link.from).systems.includes(system)));
    assert.ok(link.systems.every(system => codeMap.get(link.to).systems.includes(system)));
  }
  for (const process of Object.values(data.workflows))
    assert.ok(process.codes.every(code => codeMap.has(code)));
});

test('search and process filters distinguish ECC storage, S/4HANA compatibility and Public Edition CDS', () => {
  const d = blank();
  const codes = filters => Array.from(engine.query(d, filters), row => row.code);
  assert.ok(codes({ query: 'GR/IR' }).includes('T030'));
  assert.equal(codes({ query: 'EKPO' })[0], 'EKPO');
  assert.equal(codes({ query: '/scwm/ordim_c' })[0], '/SCWM/ORDIM_C');
  assert.ok(codes({ query: 'storage location' }).includes('MARD'));
  assert.ok(codes({ workflow: 'p2p', system: 'ecc' }).includes('MSEG'));
  assert.ok(!codes({ workflow: 'p2p', system: 'ecc' }).includes('MATDOC'));
  assert.ok(codes({ workflow: 'p2p', system: 's4' }).includes('MATDOC'));
  assert.ok(engine.editableRow(d, 'mseg').compatibility);
  const publicEdition = engine.query(d, { system: 'public' });
  assert.ok(publicEdition.length > 4);
  assert.ok(publicEdition.every(row => row.kind === 'cds'));
  assert.ok(!publicEdition.some(row => row.code === 'MSEG'));
  assert.ok(codes({ module: 'FI' }).includes('BKPF'));
  assert.equal(codes({ workflow: 'p2p', module: 'SD' }).length, 0);
  assert.ok(!Object.hasOwn(d.workhub, 'sapTables'), 'looking up references needs no account data');
});

test('standard annotations stay private while custom entries resolve links and keep renamed references', () => {
  const d = blank();
  const std = engine.editableRow(d, 'EKPO');
  engine.updateAnnotation(d, std, { favorite: true, notes: 'Private PO note' });
  const custom = record('/ACME/PO_TRACE');
  engine.saveCustom(d, custom);
  const child = record('ZMY_TRACE', 'custom-2');
  child.links[0].code = '/acme/po_trace';
  engine.saveCustom(d, child);
  engine.validate(d);
  assert.equal(engine.linksFor(d, std).find(link => link.code === custom.code).direction, 'in');
  assert.ok(engine.linksFor(d, custom).some(link => link.code === 'EKPO' && link.direction === 'out'));
  assert.equal(engine.query(d, { favorites: true, query: 'Private PO' }).length, 1);
  assert.equal(engine.query(blank(), { query: 'Private PO' }).length, 0);
  assert.deepEqual(Object.keys(d.workhub.sapTables.standard.EKPO).sort(), ['archived', 'favorite', 'notes']);

  const renamed = { ...custom, code: 'ZPO_TRACE' };
  engine.saveCustom(d, renamed, custom.code);
  assert.equal(d.workhub.sapTables.records[1].links[0].code, 'ZPO_TRACE');
  engine.updateAnnotation(d, renamed, { archived: true });
  assert.equal(engine.query(d, { custom: true, archived: true }).length, 1);
  assert.equal(engine.query(d, { custom: true, query: 'ZPO_TRACE' })[0].id, child.id);
  engine.validate(snapshot(d));
});

test('invalid references and duplicate technical names are rejected', () => {
  const d = blank();
  assert.throws(() => engine.saveCustom(d, record('ekpo')), /already exists/);
  assert.throws(() => engine.saveCustom(d, record('Z TABLE')), /valid SAP/);
  const r = record('ZMM_AUDIT');
  r.links[0].code = 'zmm_audit';
  assert.throws(() => engine.saveCustom(d, r), /cannot link to itself/);
  r.links[0].code = 'MSEG';
  engine.saveCustom(d, r);
  assert.throws(() => engine.saveCustom(d, record('zmm_audit', 'another-id')), /already exists/);
  r.sourceUrl = 'javascript:alert(1)';
  assert.match(r.sourceUrl, disallowed);
  assert.throws(() => engine.validate(d), /SAP table details/);
});
