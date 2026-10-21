import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
const window = {};
for (const file of ['solution-materials.js', 'solution-engine.js', 'solution-demo.js']) runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { window });
const E = window.WorkHubSolutionEngine, M = window.WorkHubSolutionMaterials, D = window.WorkHubSolutionDemo;
const copy = x => JSON.parse(JSON.stringify(x));
test('materials: explicit attributes determine the outcome independently of the type code', () => {
 const custom = { ...M.reference('NLAG'), quantityUpdate: true, valueUpdate: true, name: 'Client configured stock profile' };
 const p = M.applyType(custom, E.profile()), r = E.simulate(p, [E.action('gr', 100)]);
 assert.equal(p.mode, 'valuated'); assert.equal(r.final.qty, 100000); assert.equal(r.final.inventory, 100000);
 const mismatch = copy(p); mismatch.mode = 'nonstock'; const failed = E.simulate(mismatch, [E.action('gr', 100)]);
 assert.equal(failed.events[0].code, 'MATERIAL_ATTRIBUTES'); assert.deepEqual(copy(failed.final), copy(failed.initial));
});
test('materials: UNBW and NLAG preserve their different quantity and cost consequences', () => {
 const unbw = M.applyType(M.reference('UNBW'), E.profile()), nlag = M.applyType(M.reference('NLAG'), E.profile());
 const a = E.simulate(unbw, [E.action('gr', 100), E.action('issue', 30)]), b = E.simulate(nlag, [E.action('gr', 100, 'consumption'), E.action('issue', 30)]);
 assert.equal(a.final.qty, 70000); assert.equal(a.final.inventory, 0); assert.equal(a.final.expense, 120000); assert.equal(a.events[1].postings.length, 0);
 assert.equal(b.final.qty, 0); assert.equal(b.final.expense, 120000); assert.equal(b.events[1].status, 'error');
 assert.ok(M.reference('NLAG').views.includes('Accounting')); assert.ok(!M.reference('UNBW').views.includes('Accounting'));
});
test('materials: service, production-only and value-only profiles never pretend to post physical PO stock', () => {
 for (const t of [M.reference('SERV'), M.reference('DIEN'), M.reference('FERT'), { ...M.reference('ERSA'), quantityUpdate: false }]) {
  const p = M.applyType(t, E.profile()), r = E.simulate(p, E.defaultActions(p));
  assert.ok(r.events.every(e => e.status === 'unsupported')); assert.deepEqual(copy(r.final), copy(r.initial)); assert.ok(r.events.every(e => !e.document && !e.postings.length));
 }
 const changed = { ...M.reference('FERT'), procurement: 'external', views: [...M.reference('FERT').views, 'Purchasing'] };
 assert.equal(E.simulate(M.applyType(changed, E.profile()), [E.action('gr', 10)]).events[0].status, 'success');
});
test('materials: prior engine snapshots replay after an additive upgrade without new material controls', () => {
 const d = D.create(), h = E.data(d), run = h.runs[0]; run.snapshot.engineVersion = 'mm-core-2026-10-21.1'; delete run.snapshot.profile.materialType;
 for (const k of ['materialTypes', 'businessRules', 'workshopNotes', 'preparations']) delete h[k]; E.upgrade(d); E.validate(d);
 const old = E.simulate(run.snapshot.profile, run.actions, run.snapshot.scenario, run.snapshot.engineVersion), current = E.simulate(run.snapshot.profile, run.actions, run.snapshot.scenario);
 assert.equal(old.engineVersion, run.snapshot.engineVersion); assert.deepEqual(copy(old.final), copy(current.final));
 assert.throws(() => E.simulate(M.applyType(M.reference('SERV'), E.profile()), [E.action('gr', 10)], 'procurement', run.snapshot.engineVersion), /current simulation rule version/);
});
test('materials: custom profile edits cannot alter an attached proposal or a saved run snapshot', () => {
 const t = M.reference('ERSA'), d = D.create(), h = E.data(d), p = h.proposals.find(x => x.id === 'demo-proposal-spares-valuated');
 p.profile = M.applyType(t, p.profile); let n = 0; const run = E.saveRun(d, p.id, { title: 'Stable reference', actions: E.defaultActions(p.profile) }, () => 'new-run-' + ++n, '2026-10-21T04:00:00.000Z');
 t.valueUpdate = false; p.profile.materialType.notes = 'Revised design note'; assert.equal(run.snapshot.profile.materialType.valueUpdate, true); assert.notEqual(run.snapshot.profile.materialType.notes, p.profile.materialType.notes);
});
test('materials: rule links remain within their process and deliberate step deletion detaches them', () => {
 const d = D.create(), h = E.data(d), rule = h.businessRules[0], process = h.processes.find(x => x.id === rule.processId), foreign = h.processes.find(x => x.id !== rule.processId);
 const bad = copy(d); E.data(bad).businessRules[0].stepIds = [foreign.steps[0].id]; assert.throws(() => E.validate(bad), /business rule/);
 const removed = rule.stepIds[0], next = copy(process); next.steps = next.steps.filter(s => s.id !== removed);
 for (const p of h.proposals.filter(p => p.processId === process.id)) for (const s of p.steps) s.sourceIds = s.sourceIds.filter(id => id !== removed);
 E.upsert(d, 'processes', next); assert.equal(h.businessRules[0].stepIds.length, 0); E.validate(d);
 E.remove(d, 'processes', process.projectId, process.id); assert.ok(!h.businessRules.some(r => r.processId === process.id)); assert.ok(!h.workshopNotes.some(r => r.processId === process.id));
});
test('materials: wizard choices produce candidates with explicit follow-up checks', () => {
 for (const [answers, code] of [[{ stored: true, valued: true, route: 'external', kind: 'spares' }, 'ERSA'], [{ stored: true, valued: false, route: 'external', kind: 'spares' }, 'UNBW'], [{ stored: false, valued: true, route: 'external', kind: 'supplies' }, 'NLAG'], [{ stored: true, valued: true, route: 'internal', kind: 'input' }, 'FERT'], [{ stored: false, valued: false, route: 'external', kind: 'service' }, 'SERV']]) {
  const result = M.recommend(answers); assert.equal(result.type.code, code); assert.ok(result.checks.length >= 3); M.validateType(result.type);
 }
});
test('materials: preparation is separate from agreement and rejects cross-project or malformed references', () => {
 const d = D.create(), h = E.data(d), agreed = h.proposals.find(p => p.status === 'Agreed');
 h.preparations.push({ id: 'preparation-1', projectId: agreed.projectId, proposalId: agreed.id, profile: JSON.stringify(agreed.profile), checked: ['identity', 'valuation'] }); E.validate(d); assert.equal(agreed.status, 'Agreed');
 h.preparations[0].checked.push('execute-arbitrary-code'); assert.throws(() => E.validate(d), /preparation checklist/);
});
