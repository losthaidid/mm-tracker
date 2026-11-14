import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../mm-configuration-data.js';
import '../mm-configuration-engine.js';

const D = globalThis.WorkHubMmConfigurationData;
const E = globalThis.WorkHubMmConfigurationEngine;
const blank = () => ({ workhub: {} });
const run = (scenario, options, d = blank()) => E.run(d, scenario, options);
const step = (result, rule) => result.steps.find(row => row.rule === rule);
const lines = row => row.lines.map(line => [line.side, line.key, line.modifier, line.amount]);
const fi = row => row.docs.includes('FI accounting document');

test('MM Configuration: built-in scenarios have source-backed checkpoints, use valid movements, and balance', () => {
  assert.equal(new Set(D.scenarios.map(s => s.id)).size, D.scenarios.length);
  assert.equal(new Set(D.moves.map(m => m.code)).size, D.moves.length);
  assert.ok(D.scenarios.length >= 40);
  for (const checkpoint of Object.values(D.checkpoints)) {
    for (const key of checkpoint[4]) {
      const [label, link] = D.sources[key];
      assert.ok(label);
      assert.match(new URL(link).hostname, /^(?:help|learning|community)\.sap\.com$/);
    }
  }
  for (const scenario of D.scenarios) {
    const state = blank();
    const result = run(scenario.id, {}, state);
    assert.deepEqual(result.errors, [], scenario.id);
    assert.deepEqual(state, blank(), scenario.id);
    assert.ok(result.steps.every(row => row.status === 'completed'), scenario.id);
    for (const row of result.steps) {
      assert.ok(D.checkpoints[row.check], scenario.id + ' ' + row.check);
      if (row.movement) assert.equal(row.move.code, row.movement);
      const balance = row.lines.reduce((sum, line) =>
        sum + Math.round(line.amount * 100) * (line.side === 'debit' ? 1 : -1), 0);
      assert.equal(balance, 0, scenario.id + ' ' + row.title);
    }
  }
});

test('MM Configuration: receipt eligibility, inventory management, and cost posting are distinct', () => {
  const stock = run('stock-po', { qm: true });
  assert.deepEqual(lines(step(stock, 'gr')), [['debit', 'BSX', '', 100], ['credit', 'WRX', '', 100]]);
  assert.ok(step(stock, 'gr').docs.some(d => d.includes('inspection lot')));
  assert.match(step(stock, 'gr').stock, /\+10/);
  assert.equal(step(stock, 'gr').value, 'Increases');
  const nonstock = run('nonstock-po');
  assert.equal(fi(step(nonstock, 'gr')), true);
  assert.equal(step(nonstock, 'gr').value, 'Unchanged');
  assert.match(step(nonstock, 'gr').stock, /consumption/);
  assert.deepEqual(lines(step(nonstock, 'gr')), [['debit', '', '', 100], ['credit', 'WRX', '', 100]]);
  const nonValuated = run('nonstock-po', { nonValuated: true });
  assert.equal(fi(step(nonValuated, 'gr')), false);
  assert.ok(step(nonValuated, 'gr').docs.includes('Material document'));
  assert.deepEqual(lines(step(nonValuated, 'invoice')), [['debit', '', '', 100], ['credit', '', '', 100]]);
  const unbw = run('nonvaluated-po');
  assert.match(step(unbw, 'gr').stock, /\+10/);
  assert.equal(fi(step(unbw, 'gr')), false);
  const noReceipt = run('nonstock-po', { itemAllowsReceipt: false });
  assert.equal(step(noReceipt, 'gr').status, 'skipped');
  assert.match(step(noReceipt, 'gr').summary, /item category/);
  assert.ok(fi(step(noReceipt, 'invoice')));
  const grBased = run('nonstock-po', { receiptEnabled: false, grBased: true });
  assert.equal(step(grBased, 'invoice').status, 'blocked');
  assert.equal(step(grBased, 'payment').status, 'waiting');
  const invalid = run('nonstock-po', { category: '' });
  assert.ok(invalid.steps.every(row => row.status !== 'completed'));
});

test('MM Configuration: stock status, ownership, transfer route, and original postings drive documents', () => {
  assert.equal(fi(step(run('blocked-gr'), 'blocked')), false);
  assert.equal(fi(step(run('blocked-gr'), 'gr')), true);
  assert.equal(fi(step(run('origin-gr'), 'gr')), true);
  assert.equal(fi(step(run('origin-gr'), 'reclass')), false);
  assert.equal(fi(step(run('storage-transfer'), 'reclass')), false);
  assert.equal(fi(step(run('plant-transfer'), 'transfer')), true);
  assert.equal(run('sto-cross', { receivingPlant: '1100' }).steps[0].status, 'blocked');
  assert.equal(fi(step(run('consignment'), 'consignmentGr')), false);
  assert.equal(fi(step(run('consignment'), 'consignmentOwn')), true);
  assert.match(step(run('asset-issue'), 'issue').lines[0].name, /Asset/);
  assert.equal(fi(step(run('free-gr', { priceControl: 'V' }), 'freeReceipt')), false);
  assert.equal(fi(step(run('free-gr'), 'freeReceipt')), true);
  assert.equal(step(run('receipt-other', { referenceReady: false }), 'receipt').status, 'blocked');
  assert.equal(fi(step(run('return-blocked'), 'blockedReturn')), false);
  assert.deepEqual(lines(step(run('reverse-gr'), 'return')), [['credit', 'BSX', '', 100], ['debit', 'WRX', '', 100]]);
  assert.equal(fi(step(run('third-party'), 'statisticalGr')), false);
  assert.equal(fi(step(run('third-party'), 'invoice')), true);
});

test('MM Configuration: price control, partial stock coverage, and posting sequence change accounts', () => {
  const standard = run('invoice-variance');
  assert.deepEqual(lines(step(standard, 'invoice')), [
    ['debit', 'WRX', '', 100], ['debit', 'PRD', '', 20], ['credit', '', '', 120],
  ]);
  const moving = run('invoice-variance', { priceControl: 'V', stockCoverage: 50, blockedInvoice: true });
  assert.deepEqual(lines(step(moving, 'invoice')), [
    ['debit', 'WRX', '', 100], ['debit', 'BSX', '', 10], ['debit', 'PRD', '', 10], ['credit', '', '', 120],
  ]);
  assert.equal(step(moving, 'payment').status, 'blocked');
  const first = run('invoice-first');
  assert.deepEqual(lines(step(first, 'invoice')), [['debit', 'WRX', '', 120], ['credit', '', '', 120]]);
  assert.deepEqual(lines(step(first, 'gr')), [
    ['debit', 'BSX', '', 100], ['credit', 'WRX', '', 120], ['debit', 'PRD', '', 20],
  ]);
  assert.equal(step(run('invoice-first', { grBased: true }), 'invoice').status, 'blocked');
});

test('MM Configuration: saved material, movement, and G/L overlays are scoped and validate known formats', () => {
  const d = blank();
  const unbw = D.materials.find(row => row.code === 'UNBW');
  E.save(d, { ...unbw, id: 'mat', code: 'zccm', name: 'Quantity-only material', area: '1000' });
  E.save(d, { ...unbw, id: 'other', code: 'zccm', name: 'Different area', area: '1100', value: true });
  const quantityOnly = run('nonvaluated-po', { material: 'ZCCM' }, d);
  assert.equal(fi(step(quantityOnly, 'gr')), false);
  assert.match(step(quantityOnly, 'gr').stock, /\+10/);
  assert.equal(E.choices(d, 'material', '1100').find(row => row.code === 'ZCCM').value, true);
  assert.throws(() => E.save(d, { ...unbw, id: 'dup', code: 'ZCCM', area: '1000' }), /already exists/);
  assert.throws(() => E.save(d, { ...unbw, id: 'bad-config', quantity: false, value: true }), /Quantity Update/);
  const base = D.moves.find(row => row.code === '201');
  E.save(d, { ...base, id: 'move', code: 'z01', modifier: 'ZBR', reversal: 'Z02' });
  assert.throws(() => E.save(d, { ...base, id: 'bad-move', code: '501' }), /code lengths/);
  const account = { kind: 'account', chart: 'INT', key: 'GBB', side: 'both', notes: '',
    modifier: 'ZBR', name: 'Operations', group: '0001', valuationClass: '3000', gl: '0000511000', id: 'gl' };
  E.save(d, account);
  const issue = step(run('cost-issue', { movements: { 0: 'Z01' } }, d), 'issue');
  assert.equal(issue.move.reversal, 'Z02');
  assert.equal(issue.lines[0].account.gl, '0000511000');
  const po = run('direct-po', { assignmentModifier: 'ZBR', costAccount: '0000521000' }, d);
  assert.equal(step(po, 'gr').lines[0].account.gl, '0000521000');
  E.remove(d, 'account', 'gl');
  assert.equal(step(run('cost-issue', { movements: { 0: 'Z01' } }, d), 'issue').lines[0].account, undefined);
  assert.doesNotThrow(() => E.validate(d));
});
