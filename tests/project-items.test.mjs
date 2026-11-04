import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
const window = { crypto: { randomUUID }, WorkHubReminders: { validDate: v => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v + 'T00:00:00Z')) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v } };
for (const file of ['workspace-upgrades.js', 'project-items-engine.js']) runInNewContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), { window, Intl });
const E = window.WorkHubProjectItemsEngine, copy = value => JSON.parse(JSON.stringify(value)), opts = { statuses: ['In Progress', 'Completed', 'Testing'], priorities: ['A', 'B', 'C'], today: '2026-11-04' };
function fixture(n = 3) {
  const d = { specs: Array.from({ length: n }, (_, i) => ({ id: 'item-' + i, projectId: 'project', itemType: 'Blueprint', itemId: '001-' + i, description: 'Material 6.00007 / ' + i, status: 'In Progress', priority: 'A', companyId: i % 2 ? 'one' : 'two', expectedDate: '2026-11-05', dueDate: '2026-11-10', remarks: 'Own notes ' + i, feedback: 'Exact 001\nµL', url: 'https://example.com/' + i, subItems: ['In Progress', 'Completed'].map((status, j) => ({ id: 'sub-' + i + '-' + j, title: 'Child ' + i + '-' + j, status, remarks: 'Do not change', feedback: 'Keep ' + i + '/' + j, owner: 'Owner ' + i, dueDate: '2026-12-01', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z' })) })) };
  window.WorkHubProjectDates.upgrade(d); return d;
}
test('Project items preview lists exact field and cascaded child changes without mutating records', () => {
  const d = fixture(), before = copy(d), plan = E.plan(d, 'project', ['item-0', 'item-2'], { status: 'Completed', priority: 'B', dueDate: '' }, { ...opts, statusDate: '2026-11-02' });
  assert.deepEqual(copy(d), before); assert.equal(plan.changedItems, 2); assert.equal(plan.children, 2);
  assert.equal(plan.changes.filter(c => c.child).length, 2); assert.ok(plan.changes.some(c => c.field === 'dueDate' && c.after === ''));
  E.apply(d, plan, opts); window.WorkHubProjectDates.prepare(d, before, opts.today);
  for (const i of [0, 2]) { const p = d.specs[i]; assert.equal(p.statusDate, '2026-11-02'); assert.equal(p.status, 'Completed'); assert.equal(p.priority, 'B'); assert.equal(p.dueDate, ''); assert.ok(p.subItems.every(s => s.status === 'Completed')); assert.deepEqual(copy(p.subItems[1]), before.specs[i].subItems[1]); for (const k of ['id', 'itemId', 'description', 'remarks', 'feedback', 'url']) assert.equal(p[k], before.specs[i][k]); }
  assert.deepEqual(copy(d.specs[1]), before.specs[1]);
});
test('Project items stale review, removed items, foreign projects and invalid fields are blocked before mutation', () => {
  const d = fixture(), plan = E.plan(d, 'project', ['item-0'], { priority: 'C' }, opts);
  d.specs[0].subItems[0].feedback += 'new'; const before = copy(d); assert.throws(() => E.apply(d, plan, opts), /changed/); assert.deepEqual(copy(d), before);
  assert.throws(() => E.plan(d, 'other', ['item-0'], { priority: 'C' }, opts), /moved/);
  assert.throws(() => E.plan(d, 'project', ['item-0', 'item-0'], { priority: 'C' }, opts), /Select/);
  assert.throws(() => E.plan(d, 'project', ['item-0'], { remarks: 'overwrite' }, opts), /field/);
  assert.throws(() => E.plan(d, 'project', ['item-0'], { dueDate: '2026-02-30' }, opts), /date/);
  assert.throws(() => E.plan(d, 'project', ['item-0'], { status: 'Unknown' }, opts), /status/);
  assert.throws(() => E.plan(d, 'project', ['item-0'], { description: '' }, opts), /description/);
  d.specs.shift(); assert.throws(() => E.apply(d, plan, opts), /removed/);
});
test('Project items applying a preview preserves unrelated current edits and rejects a changed day', () => {
  const d = fixture(), plan = E.plan(d, 'project', ['item-0'], { description: '001, 6.00007, µL\nExact text' }, opts);
  d.specs[1].feedback = 'Another item edited after preview'; E.apply(d, plan, opts); assert.equal(d.specs[0].description, '001, 6.00007, µL\nExact text'); assert.equal(d.specs[1].feedback, 'Another item edited after preview');
  assert.throws(() => E.apply(d, plan, { ...opts, today: '2026-11-05' }), /date changed/);
});
test('Project items ordering is stable, preserves identifiers and handles company, progress and empty dates', () => {
  const d = fixture(), before = copy(d); d.specs[0].dueDate = '';
  assert.deepEqual(copy(E.order(d.specs, 'dueDate', 'desc')).map(r => r.id), ['item-1', 'item-2', 'item-0']);
  assert.equal(E.order(d.specs, 'company', 'asc', [{ id: 'one', name: 'Alpha' }, { id: 'two', name: 'Zulu' }])[0].id, 'item-1');
  d.specs[1].subItems[0].status = 'Completed'; assert.equal(E.order(d.specs, 'progress', 'desc')[0].id, 'item-1');
  assert.equal(E.order(d.specs, 'itemId', 'asc')[0].itemId, '001-0'); assert.deepEqual(d.specs.map(r => r.description), before.specs.map(r => r.description));
});
test('Project items large bulk plan includes every affected child and applies one bounded pass', () => {
  const d = fixture(1000), prior = copy(d), ids = d.specs.map(r => r.id), p = E.plan(d, 'project', ids, { status: 'Completed' }, opts);
  assert.equal(p.children, 1000); assert.equal(p.changedItems, 1000); assert.equal(p.changes.filter(c => c.child).length, 1000);
  E.apply(d, p, opts); window.WorkHubProjectDates.prepare(d, prior, opts.today);
  assert.ok(d.specs.every(item => item.status === 'Completed' && item.subItems.every(s => s.status === 'Completed'))); assert.equal(d.specs[999].feedback, 'Exact 001\nµL');
});
