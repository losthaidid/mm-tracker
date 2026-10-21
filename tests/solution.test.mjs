import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
const window = {};
for (const file of ['solution-engine.js', 'solution-demo.js']) runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { window });
const E = window.WorkHubSolutionEngine, D = window.WorkHubSolutionDemo, copy = x => JSON.parse(JSON.stringify(x));
let serial = 0; const uid = () => 'test-' + ++serial, at = '2026-10-21T03:00:00.000Z';
const tx = (...args) => E.action(...args);
function fixture() { return D.create(); }
function balance(event) { assert.equal(event.postings.reduce((n, x) => n + x.debit, 0), event.postings.reduce((n, x) => n + x.credit, 0)); }

test('solution: additive upgrades are empty and preserve existing account data', () => {
 const d = { workhub: { notes: [{ id: 'keep' }] } }; E.upgrade(d); const h = E.data(d); E.upgrade(d); assert.equal(E.data(d), h); assert.equal(h.products.length, 0); assert.equal(d.workhub.notes[0].id, 'keep');
});
test('solution: complete demo contains five products, eight shared/current processes, ten alternatives, requirements, users and replay evidence', () => {
 const d = fixture(), h = E.data(d); E.validate(d); assert.equal(h.products.length, 5); assert.equal(h.processes.length, 8); assert.equal(h.proposals.length, 10); assert.equal(d.workhub.projectPeople.people.length, 7); assert.ok(h.processes.every(p => p.steps.length === 4 && p.requirements.length === 2)); assert.equal(h.processes.find(x => x.id === 'demo-process-approvals').productIds.length, 4); assert.equal(h.proposals.filter(x => x.processId === 'demo-process-spares').length, 3); assert.equal(h.decisions[0].outcome, 'Agreed');
 const run = h.runs[0], r = E.simulate(run.snapshot.profile, run.actions, run.snapshot.scenario); assert.deepEqual(copy(r.events.map(x => x.status)), ['error', 'success', 'error']); assert.equal(r.final.qty, 0); assert.equal(r.final.expense, 120000);
});
test('solution: standard-price receipt separates stock valuation, PO accrual and price difference; consumption uses standard price', () => {
 const r = E.simulate(E.profile(), [tx('gr', 100), tx('issue', 30)]);
 assert.equal(r.events[0].after.inventory, 100000); assert.equal(r.events[0].after.grir, 120000); assert.equal(r.events[0].after.variance, 20000); assert.equal(r.final.qty, 70000); assert.equal(r.final.inventory, 70000); assert.equal(r.final.expense, 30000); r.events.forEach(balance);
 const p = E.profile(); p.poPrice = 8; const low = E.simulate(p, [tx('gr', 100)]); assert.equal(low.final.variance, -20000); balance(low.events[0]);
});
test('solution: quantity-only UNBW stock costs are recognised once at GR and not charged again at GI', () => {
 const p = E.profile('quantity'), r = E.simulate(p, [tx('gr', 100), tx('issue', 30)]); assert.equal(r.final.qty, 70000); assert.equal(r.final.inventory, 0); assert.equal(r.final.expense, 120000); assert.equal(r.final.consumedQty, 30000); assert.equal(r.events[1].postings.length, 0); assert.equal(r.events[1].code, 'UNBW_COST_TIMING'); r.events.forEach(balance);
});
test('solution: non-stock PO GR for consumption is valid while inventory receipt, stock GI and transfer fail without effects', () => {
 const p = E.profile('nonstock'), r = E.simulate(p, [tx('gr', 100, 'inventory'), tx('gr', 100, 'consumption'), tx('issue', 5), tx('transfer', 5)]);
 assert.deepEqual(copy(r.events.map(x => x.status)), ['error', 'success', 'error', 'error']); assert.equal(r.final.qty, 0); assert.equal(r.final.inventory, 0); assert.equal(r.final.expense, 120000); assert.equal(r.final.consumedQty, 100000); for (const e of r.events.filter(e => e.status !== 'success')) assert.deepEqual(e.after, e.before);
});
test('solution: stock-capable valuated material can be procured directly for consumption', () => {
 const p = { ...E.profile(), purpose: 'consumption', accountCategory: 'K', glAccount: 'Expense' }, r = E.simulate(p, [tx('gr', 100, 'consumption')]); assert.equal(r.events[0].status, 'success'); assert.equal(r.final.inventory, 0); assert.equal(r.final.qty, 0); assert.equal(r.final.expense, 120000); assert.equal(r.final.variance, 0);
});
test('solution: K assignment, cost centre and consumption account are independently required', () => {
 for (const key of ['accountCategory', 'costCenter', 'glAccount']) { const p = E.profile('nonstock'); p[key] = ''; const r = E.simulate(p, [tx('gr', 5, 'consumption')]); assert.equal(r.events[0].code, 'ACCOUNT_ASSIGNMENT'); assert.equal(r.events[0].status, 'error'); assert.deepEqual(r.final, r.initial); }
});
test('solution: document eligibility is distinct from non-valuated GR coverage', () => {
 const p = E.profile(); p.grAllowed = false; let r = E.simulate(p, [tx('gr', 1)]); assert.equal(r.events[0].code, 'GR_ELIGIBILITY'); assert.equal(r.events[0].status, 'error'); p.grAllowed = true; p.grNonValuated = true; r = E.simulate(p, [tx('gr', 1)]); assert.equal(r.events[0].status, 'unsupported'); assert.deepEqual(r.final, r.initial);
});
test('solution: partial receipts, overdelivery percentage and unlimited receipt controls use net PO quantity', () => {
 const a = tx('gr', 60), b = tx('gr', 40), c = tx('gr', 1), p = E.profile(); let r = E.simulate(p, [a, b, c]); assert.deepEqual(copy(r.events.map(e => e.status)), ['success', 'success', 'error']); assert.equal(r.final.netReceived, 100000);
 p.overTolerance = 5; r = E.simulate(p, [tx('gr', 105), tx('gr', .001)]); assert.equal(r.events[0].status, 'success'); assert.equal(r.events[1].code, 'PO_QUANTITY'); p.unlimited = true; assert.equal(E.simulate(p, [tx('gr', 999)]).events[0].status, 'success');
 const receipt = tx('gr', 100); r = E.simulate(E.profile(), [receipt, tx('return', 20, 'inventory', receipt.id), tx('gr', 20)]); assert.equal(r.final.netReceived, 100000); assert.ok(r.events.every(x => x.status === 'success'));
});
test('solution: 311 transfers preserve plant totals and FI while location quantities change; 312 restores them', () => {
 const gr = tx('gr', 100), transfer = tx('transfer', 25), cancel = tx('reverse', 0, 'inventory', transfer.id), r = E.simulate(E.profile(), [gr, transfer, cancel]);
 assert.equal(r.events[1].movement, '311'); assert.deepEqual(copy(r.events[1].after.locations), { MAIN: 75000, LINE: 25000 }); assert.equal(r.events[1].after.qty, 100000); assert.equal(r.events[1].after.inventory, 100000); assert.equal(r.events[1].postings.length, 0); assert.equal(r.events[1].after.grir, 120000); assert.equal(r.events[1].after.expense, 0); assert.equal(r.events[2].movement, '312'); assert.deepEqual(r.final, r.events[0].after);
});
test('solution: transfer and issue availability checks the selected location rather than total stock', () => {
 const gr = tx('gr', 100), transfer = tx('transfer', 25), issue = tx('issue', 30); issue.location = 'LINE';
 const bad = tx('transfer', 1); bad.toLocation = 'MAIN'; const unknown = tx('transfer', 1); unknown.toLocation = 'OTHER';
 const r = E.simulate(E.profile(), [gr, transfer, issue, bad, unknown]); assert.equal(r.events[2].code, 'NEGATIVE_STOCK'); assert.equal(r.events[2].status, 'error'); assert.equal(r.events[3].code, 'STORAGE_TRANSFER'); assert.equal(r.events[4].code, 'STORAGE_TRANSFER'); assert.equal(r.final.qty, 100000);
});
test('solution: UNBW location transfers keep quantity-only stock and no additional expense', () => {
 const r = E.simulate(E.profile('quantity'), [tx('gr', 100), tx('transfer', 40)]); assert.equal(r.final.inventory, 0); assert.equal(r.final.expense, 120000); assert.equal(r.final.locations.LINE, 40000); assert.equal(r.events[1].postings.length, 0);
});
test('solution: negative stock needs both explicit configuration and material permissions', () => {
 for (const [config, material, expected] of [[false, false, 'error'], [true, false, 'error'], [false, true, 'error'], [true, true, 'success']]) { const p = { ...E.profile(), negativeConfig: config, negativeMaterial: material }; const r = E.simulate(p, [tx('issue', 10)]); assert.equal(r.events[0].status, expected); if (expected === 'success') { assert.equal(r.final.qty, -10000); assert.equal(r.final.inventory, -10000); balance(r.events[0]); } }
});
test('solution: 102 and 202 cancel the last active original document and preserve prior failure history', () => {
 const gr = tx('gr', 100), gi = tx('issue', 30); const r = E.simulate(E.profile(), [gr, gi, tx('reverse', 0, 'inventory', gr.id), tx('reverse', 0, 'inventory', gi.id), tx('reverse', 0, 'inventory', gr.id)]);
 assert.equal(r.events[2].status, 'unsupported'); assert.equal(r.events[3].movement, '202'); assert.deepEqual(r.events[3].after, r.events[0].after); assert.equal(r.events[4].movement, '102'); assert.deepEqual(r.final, r.initial); assert.equal(r.activeDocuments.length, 0); r.events.forEach(balance);
});
test('solution: supplier return requires an eligible receipt and updates stock, GRIR and price difference', () => {
 const gr = tx('gr', 100), r = E.simulate(E.profile(), [gr, tx('return', 10, 'inventory', gr.id), tx('return', 91, 'inventory', gr.id)]); assert.equal(r.events[1].movement, '122'); assert.equal(r.events[2].code, 'REFERENCE'); assert.equal(r.final.qty, 90000); assert.equal(r.final.inventory, 90000); assert.equal(r.final.grir, 108000); assert.equal(r.final.variance, 18000); r.events.forEach(balance);
});
test('solution: transaction references survive deletion/reordering and never retarget a different receipt', () => {
 const original = tx('gr', 20), other = tx('gr', 30), returned = tx('return', 10, 'inventory', original.id); const r = E.simulate(E.profile(), [other, returned]); assert.equal(r.events[1].status, 'error'); assert.equal(r.events[1].code, 'REFERENCE'); assert.equal(r.final.qty, 30000);
});
test('solution: quantity fractions round cumulatively without residual stock value or accounting imbalance', () => {
 const p = { ...E.profile(), standardPrice: .01, poPrice: .03, poQty: 1 }, receipt = tx('gr', 1); const r = E.simulate(p, [receipt, tx('issue', .333), tx('issue', .333), tx('issue', .334)]); assert.equal(r.final.qty, 0); assert.equal(r.final.inventory, 0); assert.equal(r.final.expense, 1); r.events.forEach(balance);
 const big = E.simulate({ ...E.profile(), standardPrice: 999999.99, poPrice: 1000000 }, [tx('gr', 999999.999)]); balance(big.events[0]); assert.ok(Number.isSafeInteger(big.final.inventory));
});
test('solution: unsupported transactions and specialist processes never mutate stock or pretend to post', () => {
 for (const [kind, scope] of [['invoice', 'procurement'], ['plant-transfer', 'procurement'], ['gr', 'context']]) { const r = E.simulate(E.profile(), [tx(kind, 10)], scope); assert.equal(r.events[0].status, 'unsupported'); assert.deepEqual(r.final, r.initial); assert.equal(r.events[0].postings.length, 0); }
});
test('solution: malformed, excessive or unsafe simulation data is rejected before playback', () => {
 assert.throws(() => E.simulate({ ...E.profile(), poQty: Infinity }, []), /profile/); assert.throws(() => E.simulate({ ...E.profile(), sourceLocation: '__proto__' }, []), /profile/); assert.throws(() => E.simulate(E.profile(), Array.from({ length: 41 }, () => tx('gr', 1))), /40 transactions/); const a = tx('gr', 1); assert.throws(() => E.simulate(E.profile(), [a, a]), /unique/); assert.throws(() => E.simulate(E.profile(), [{ ...a, qty: .0001 }]), /transactions/);
});
test('solution: linked products, companies, people, MM areas and step mappings must remain inside their project context', () => {
 for (const change of [d => E.data(d).processes[0].productIds.push('missing'), d => E.data(d).products[0].companyId = 'missing', d => E.data(d).processes[0].ownerId = 'foreign', d => E.data(d).processes[0].areaId = 'foreign', d => E.data(d).proposals[0].steps[0].sourceIds.push('foreign')]) { const d = fixture(); change(d); assert.throws(() => E.validate(d)); }
 const d = fixture(); E.data(d).decisions[0].snapshot = 'broken'; assert.throws(() => E.validate(d), /snapshot/);
});
test('solution: demo copying is explicit, remaps every relationship and does not import business approval or user contacts', () => {
 const d = fixture(); d.projects.push({ id: 'target', name: 'Real project', mmAreas: [{ id: 'real-area', name: 'Procurement', visible: true }] }); D.copyInto(d, 'target', '', uid); const r = E.records(d, 'target'); assert.equal(r.products.length, 5); assert.equal(r.processes.length, 8); assert.equal(r.proposals.length, 10); assert.equal(r.decisions.length, 0); assert.equal(r.runs.length, 0); assert.ok(r.products.every(p => !p.ownerId && !p.id.startsWith('demo-'))); assert.ok(r.proposals.every(p => p.status === 'Exploring')); E.validate(d); assert.throws(() => D.copyInto(d, 'target', '', uid), /empty/);
});
test('solution: revising an agreed proposal or source process requires fresh review and preserves decision snapshots', () => {
 const d = fixture(), p = E.data(d).proposals.find(p => p.status === 'Agreed'), original = E.data(d).decisions[0].snapshot; const next = { ...copy(p), benefits: 'Revised benefit' }; E.upsert(d, 'proposals', next); assert.equal(next.status, 'Under review'); assert.equal(E.data(d).decisions[0].snapshot, original); E.decision(d, next.id, { by: 'Owner', outcome: 'Agreed', note: 'Reviewed again' }, uid, at); assert.equal(next.status, 'Agreed');
 const process = copy(E.data(d).processes.find(x => x.id === next.processId)); process.objective = 'Changed business need'; E.upsert(d, 'processes', process); assert.equal(next.status, 'Under review'); assert.equal(E.data(d).decisions.length, 2);
});
test('solution: keeping a run freezes inputs independently of later proposal changes and saved snapshots survive proposal removal', () => {
 const d = fixture(), p = E.data(d).proposals.find(x => x.id === 'demo-proposal-spares-valuated'), run = E.saveRun(d, p.id, { title: 'Evidence', actions: E.defaultActions(p.profile) }, uid, at); const initial = copy(run); p.profile.poPrice = 55; assert.deepEqual(copy(run), initial); E.remove(d, 'proposals', p.projectId, p.id); E.validate(d); assert.equal(E.simulate(run.snapshot.profile, run.actions).final.grir, 108000);
});
test('solution: business agreement gates idempotent delivery links and acceptance notes', () => {
 const d = fixture(), p = E.data(d).proposals.find(x => x.id === 'demo-proposal-spares-valuated'); assert.throws(() => E.delivery(d, p.id, { title: 'Delivery' }, uid, at), /agreement/); E.decision(d, p.id, { by: 'Business owner', outcome: 'Agreed', note: 'Use this approach' }, uid, at); const work = E.delivery(d, p.id, { title: 'Implement spares' }, uid, at); assert.equal(d.specs.length, 1); assert.equal(d.tasks.length, 3); assert.equal(work.tests.length, 2); assert.equal(E.delivery(d, p.id, { title: 'Duplicate' }, uid, at), work); assert.equal(d.tasks.length, 3); assert.throws(() => E.remove(d, 'proposals', p.projectId, p.id), /traceability/);
});
test('solution: project deletion cascades its blueprint while contact/company deletion retains readable role/context text', () => {
 const before = fixture(), next = copy(before); next.projectCompanies = []; next.workhub.projectPeople.people = []; E.prepare(next, before); E.validate(next); assert.ok(E.data(next).products.every(x => !x.companyId && !x.ownerId && x.companyName)); assert.ok(E.data(next).processes.every(x => x.steps.every(s => !s.actorId && s.actor)));
 const removed = copy(before); removed.projects = []; E.prepare(removed, before); assert.ok(Object.keys(E.LIMITS).every(k => E.data(removed)[k].length === 0));
});
