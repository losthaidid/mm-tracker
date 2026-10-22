import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
const window = {};
for (const file of ['solution-materials.js', 'solution-valuation.js', 'solution-engine.js', 'solution-demo.js']) runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { window });
const E = window.WorkHubSolutionEngine, V = window.WorkHubSolutionValuation;
const copy = x => JSON.parse(JSON.stringify(x));
const tx = (type, qty, values = {}) => Object.assign(E.action(type, qty), values);
const map = () => ({ ...E.profile(), priceControl: 'V', openingQty: 100, movingAveragePrice: 10 });
const batch = () => ({ ...E.profile(), batchManaged: true, openingQty: 40, openingBatch: 'LOT-A' });
function split(batched = false) {
  return { ...E.profile(), priceControl: 'V', splitValuation: true, valuationCategory: 'H', openingQty: 15, batchManaged: batched, valuationTypes: [
    { ...V.typeDefaults('LOCAL'), priceControl: 'S', openingQty: 10, openingBatch: batched ? 'LOC-OPEN' : '' },
    { ...V.typeDefaults('IMPORT'), valuationClass: '3100', openingQty: 5, movingAveragePrice: 20, openingBatch: batched ? 'IMP-OPEN' : '' },
  ] };
}
const balanced = e => assert.equal(e.postings.reduce((n, x) => n + x.debit, 0), e.postings.reduce((n, x) => n + x.credit, 0));
test('valuation: MAP receipt blends opening inventory and PO value; GI consumes the current average', () => {
  const p = map(), r = E.simulate(p, [tx('gr', 100), tx('issue', 30)]);
  assert.equal(r.initial.inventory, 100000); assert.equal(r.events[0].after.inventory, 220000); assert.equal(r.events[0].after.mapPrice, 11);
  assert.equal(r.final.inventory, 187000); assert.equal(r.final.expense, 33000); assert.equal(r.final.grir, 120000); assert.equal(r.final.variance, 0); r.events.forEach(balanced);
  assert.equal(r.events[0].code, 'MOVING_AVERAGE');
});
test('valuation: S retains standard value and PRD instead of applying the MAP calculation', () => {
  const p = { ...map(), priceControl: 'S' }, r = E.simulate(p, [tx('gr', 100), tx('issue', 30)]);
  assert.equal(r.events[0].after.inventory, 200000); assert.equal(r.final.inventory, 170000); assert.equal(r.final.expense, 30000); assert.equal(r.final.variance, 20000);
});
test('valuation: exact integer stock values drain without residual sen and the next receipt sets MAP from zero stock', () => {
  const p = { ...map(), poQty: 300 }, r = E.simulate(p, [tx('gr', 100), tx('issue', 200), tx('gr', 100)]);
  assert.equal(r.events[1].after.qty, 0); assert.equal(r.events[1].after.inventory, 0); assert.equal(r.events[1].after.mapPrice, 11); assert.equal(r.final.mapPrice, 12);
  const tiny = { ...map(), openingQty: .003, movingAveragePrice: 3.3333, poQty: 1, poPrice: 4.33 };
  const small = E.simulate(tiny, [tx('gr', .003), tx('issue', .001), tx('issue', .002), tx('issue', .003)]);
  assert.equal(small.final.qty, 0); assert.equal(small.final.inventory, 0); small.events.forEach(balanced);
});
test('valuation: supported no-invoice return removes PO receipt value and cancellations restore exact MAP state', () => {
  const p = map(), gr = tx('gr', 100), issue = tx('issue', 30), r = E.simulate(p, [gr, issue, tx('return', 10, { reference: gr.id })]);
  assert.equal(r.final.qty, 160000); assert.equal(r.final.inventory, 175000); assert.equal(r.final.mapPrice, 10.9375); r.events.forEach(balanced);
  for (const original of [gr, issue]) {
    const actions = original === gr ? [gr] : [gr, issue], before = E.simulate(p, actions).events.at(-1).before;
    const undone = E.simulate(p, [...actions, tx('reverse', 0, { reference: original.id })]);
    assert.deepEqual(copy(undone.final), copy(before));
  }
});
test('valuation: unsupported negative MAP stock and residual-value returns make no posting', () => {
  const p = { ...map(), negativeConfig: true, negativeMaterial: true }, negative = E.simulate(p, [tx('issue', 101)]).events[0];
  assert.equal(negative.status, 'unsupported'); assert.deepEqual(negative.after, negative.before);
  const gr = tx('gr', 100), r = E.simulate({ ...p, movingAveragePrice: 1 }, [gr, tx('issue', 150), tx('return', 50, { reference: gr.id })]);
  assert.equal(r.events[2].code, 'MAP_SCOPE'); assert.equal(r.events[2].status, 'unsupported'); assert.deepEqual(r.events[2].after, r.events[2].before); assert.equal(r.events[2].postings.length, 0);
});
test('valuation: named batches retain location balances and cannot borrow stock from another batch', () => {
  const p = batch(), gr = tx('gr', 60, { batch: 'LOT-B' }), move = tx('transfer', 20, { batch: 'LOT-B' }), r = E.simulate(p, [gr, move, tx('issue', 50, { batch: 'LOT-A' }), tx('issue', 10, { batch: 'LOT-A' })]);
  assert.equal(r.final.qty, 90000); assert.equal(V.batchQty(r.final, 'LOT-B', 'MAIN'), 40000); assert.equal(V.batchQty(r.final, 'LOT-B', 'LINE'), 20000); assert.equal(V.batchQty(r.final, 'LOT-A', 'MAIN'), 30000);
  assert.equal(r.events[2].code, 'BATCH_STOCK'); assert.deepEqual(r.events[2].before, r.events[2].after); assert.equal(r.events[1].postings.length, 0);
  for (const location of ['MAIN', 'LINE']) assert.equal(r.final.locations[location], r.final.batches.reduce((n, b) => n + b.locations[location], 0));
});
test('valuation: missing batches stop postings; referenced returns inherit the original batch and reject another one', () => {
  const p = batch(), missing = E.simulate(p, [tx('gr', 10)]).events[0]; assert.equal(missing.code, 'BATCH_REQUIRED'); assert.deepEqual(missing.before, missing.after);
  const gr = tx('gr', 60, { batch: 'LOT-B' }), r = E.simulate(p, [gr, tx('return', 10, { reference: gr.id }), tx('return', 10, { reference: gr.id, batch: 'LOT-A' })]);
  assert.equal(r.events[1].status, 'success'); assert.equal(r.events[1].batch, 'LOT-B'); assert.equal(V.batchQty(r.final, 'LOT-B', 'MAIN'), 50000); assert.equal(r.events[2].code, 'BATCH_REFERENCE');
});
test('valuation: batch 312 and 202 cancellations restore all batch/location and valuation balances', () => {
  for (const type of ['transfer', 'issue']) {
    const p = batch(), gr = tx('gr', 60, { batch: 'LOT-B' }), a = tx(type, 10, { batch: 'LOT-B' }), r = E.simulate(p, [gr, a, tx('reverse', 0, { reference: a.id })]);
    assert.deepEqual(copy(r.final), copy(r.events[0].after)); assert.equal(r.events[2].batch, 'LOT-B'); assert.equal(r.events[2].movement, type === 'transfer' ? '312' : '202');
  }
});
test('valuation: split types have independent prices, classes and stock while the header totals them', () => {
  const p = split(), r = E.simulate(p, [tx('gr', 10, { valuationType: 'IMPORT' }), tx('issue', 2, { valuationType: 'LOCAL' })]);
  assert.equal(r.initial.inventory, 20000); assert.equal(r.events[0].after.inventory, 32000);
  const local = r.final.valuations.find(t => t.type === 'LOCAL'), imported = r.final.valuations.find(t => t.type === 'IMPORT');
  assert.equal(local.inventory, 8000); assert.equal(local.unitPrice, 10); assert.equal(imported.inventory, 22000); assert.equal(imported.qty, 15000); assert.equal(imported.unitPrice, 220 / 15);
  assert.equal(r.final.qty, 23000); assert.equal(r.final.inventory, 30000); assert.equal(r.events[0].valuationClass, '3100'); assert.equal(r.events[1].valuationClass, '3000'); r.events.forEach(balanced);
  assert.equal(r.events[0].segmentBefore.inventory, 10000); assert.equal(r.events[0].segmentAfter.inventory, 22000);
});
test('valuation: split movement requires a known type and checks that type instead of plant stock', () => {
  const p = split(), r = E.simulate(p, [tx('issue', 1), tx('issue', 1, { valuationType: 'MISSING' }), tx('issue', 11, { valuationType: 'LOCAL' })]);
  assert.deepEqual(copy(r.events.map(e => e.status)), ['error', 'error', 'error']); assert.equal(r.events[0].code, 'VALUATION_TYPE'); assert.equal(r.events[2].code, 'NEGATIVE_STOCK'); assert.deepEqual(r.final, r.initial);
});
test('valuation: PO tolerance is shared across split types and references never retarget another type', () => {
  const p = split(), local = tx('gr', 60, { valuationType: 'LOCAL' }), imported = tx('gr', 60, { valuationType: 'IMPORT' });
  const r = E.simulate(p, [local, imported, tx('return', 5, { valuationType: 'IMPORT', reference: local.id })]);
  assert.equal(r.events[1].code, 'PO_QUANTITY'); assert.equal(r.events[2].code, 'VALUATION_REFERENCE'); assert.equal(r.final.netReceived, 60000);
  const returned = E.simulate(p, [local, tx('return', 5, { reference: local.id })]); assert.equal(returned.events[1].valuationType, 'LOCAL'); assert.equal(returned.events[1].status, 'success'); assert.match(returned.events[1].message, /SIM-001/);
});
test('valuation: split cancellation is global, restores its type and preserves the other type', () => {
  const p = split(), a = tx('gr', 10, { valuationType: 'LOCAL' }), b = tx('gr', 10, { valuationType: 'IMPORT' });
  const r = E.simulate(p, [a, b, tx('reverse', 0, { reference: a.id }), tx('reverse', 0, { reference: b.id })]);
  assert.equal(r.events[2].status, 'unsupported'); assert.equal(r.events[3].status, 'success'); assert.equal(r.events[3].valuationType, 'IMPORT'); assert.deepEqual(copy(r.final), copy(r.events[0].after));
});
test('valuation: combined batch and split stock enforces one type per batch and transfers retain that type', () => {
  const p = split(true), a = tx('gr', 20, { batch: 'NEW-LOT', valuationType: 'LOCAL' }), b = tx('gr', 10, { batch: 'NEW-LOT', valuationType: 'IMPORT' }), move = tx('transfer', 5, { batch: 'NEW-LOT', valuationType: 'LOCAL' });
  const r = E.simulate(p, [a, b, move]); assert.equal(r.events[1].code, 'BATCH_VALUATION'); assert.deepEqual(r.events[1].before, r.events[1].after); assert.equal(r.events[2].status, 'success');
  const lot = r.final.batches.find(b => b.batch === 'NEW-LOT'); assert.equal(lot.valuationType, 'LOCAL'); assert.equal(lot.locations.LINE, 5000); assert.equal(lot.locations.MAIN, 15000); assert.equal(r.events[2].postings.length, 0);
});
test('valuation: malformed imported profiles/actions and cross-version new features are rejected', () => {
  for (const patch of [{priceControl:'X'}, {valuationClass:'12345'}, {batchManaged:'yes'}, {movingAveragePrice:NaN}, {openingBatch:'__proto__'}]) assert.throws(() => E.validateProfile({...E.profile(),...patch}));
  const p=split();p.priceControl='S';assert.throws(()=>E.validateProfile(p),/header uses price control V/);
  const same=split(true);same.valuationTypes[1].openingBatch='LOC-OPEN';assert.throws(()=>E.validateProfile(same),/two valuation types/);
  assert.throws(()=>E.simulate(map(),[tx('gr',1)],'procurement','mm-core-2026-10-21.2'),/current simulation rule version/);
  assert.throws(()=>E.validateActions([tx('gr',1,{batch:'BATCH-TOO-LONG'})]));
  const automatic={...split(),valuationCategory:'X'}, boundary=E.simulate(automatic,[tx('gr',1,{valuationType:'LOCAL'})]).events[0];assert.equal(boundary.status,'unsupported');assert.deepEqual(boundary.before,boundary.after);
});
test('valuation: previous material snapshots still replay unchanged and simulation never mutates the inputs', () => {
  const d=window.WorkHubSolutionDemo.create(), run=E.data(d).runs[0];run.snapshot.engineVersion='mm-core-2026-10-21.2';E.validate(d);
  const old=E.simulate(run.snapshot.profile,run.actions,run.snapshot.scenario,run.snapshot.engineVersion), current=E.simulate(run.snapshot.profile,run.actions,run.snapshot.scenario);
  assert.deepEqual(copy(old.final),copy(current.final));
  const p=split(true), a=[tx('gr',10,{batch:'NEW',valuationType:'LOCAL'})], before=JSON.stringify({p,a});E.simulate(p,a);assert.equal(JSON.stringify({p,a}),before);
});
