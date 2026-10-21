import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
const window = {};
runInNewContext(readFileSync(new URL('../project-standup-engine.js', import.meta.url), 'utf8'), { window });
const E = window.WorkHubProjectStandupEngine, copy = x => JSON.parse(JSON.stringify(x));
const now = '2026-10-20T16:00:00.000Z', later = '2026-10-21T01:00:00.000Z';
function state() {
  const d = { projects: [{ id: 'p', name: 'MM' }], tasks: [], specs: [{ id: 'i', projectId: 'p', description: 'Pricing', status: 'In Progress', remarks: 'Awaiting confirmation', subItems: [{ id: 's', title: 'Freight', status: 'Blocked', remarks: 'Need approval' }, { id: 'done', title: 'Base price', status: 'Completed', remarks: '' }] }], workhub: {} };
  E.upgrade(d); return d;
}
const input = { id: 'action-1', projectId: 'p', itemId: 'i', subItemId: 's', text: 'Email the owner', dueDate: '', originalText: '', originalDueDate: '' };

test('stand-up totals separate parent completion from sub-item completion and preserve custom status labels', () => {
  const d = state(), m = E.metrics(d, 'p');
  assert.equal(m.items.percent, 0); assert.equal(m.subs.percent, 50); assert.equal(m.all.blocked, 1); assert.equal(m.all.inProgress, 1);
  assert.equal(E.category('Pending Review'), 'inProgress'); assert.equal(E.category('Not yet Started'), 'notStarted');
  assert.equal(E.category('On Hold'), 'blocked'); assert.equal(E.metrics(d, 'missing').all.total, 0);
});

test('stand-up preserves unknown legacy times and tracks remarks separately from later status changes', () => {
  const before = state(), d = copy(before); E.prepare(d, before, false, now);
  assert.equal(E.updateTime(d, d.specs[0]).updatedAt, ''); assert.equal(E.data(d).updates.length, 0);
  d.specs[0].remarks = 'Received confirmation'; E.prepare(d, before, false, now);
  assert.equal(E.updateTime(d, d.specs[0]).remarksAt, now);
  const afterRemarks = copy(d); d.specs[0].status = 'Completed'; E.prepare(d, afterRemarks, false, later);
  assert.equal(E.updateTime(d, d.specs[0]).updatedAt, later); assert.equal(E.updateTime(d, d.specs[0]).remarksAt, now);
  const restored = state(); E.prepare(restored, d, true, later); assert.equal(E.data(restored).updates.length, 0);
});

test('stand-up Actions atomically create one task and edits preserve its workflow, feedback and completion', () => {
  const d = state(); let n = 0; const uid = () => 'task-' + ++n;
  E.upsertAction(d, input, now, uid); const task = d.tasks[0];
  Object.assign(task, { boardStatus: 'done', done: true, feedback: 'Reply received', remarks: 'Keep notes', archived: true });
  E.upsertAction(d, { ...input, text: 'Email the confirmed details', dueDate: '2026-10-23', originalText: task.task }, later, uid);
  assert.equal(d.tasks.length, 1); assert.equal(E.data(d).actions.length, 1); assert.equal(task.id, 'task-1');
  assert.equal(task.task, 'Email the confirmed details'); assert.equal(task.done, true); assert.equal(task.archived, true); assert.equal(task.feedback, 'Reply received');
  assert.equal(E.taskStatus(task), 'Archived'); assert.equal(d.specs[0].status, 'In Progress'); E.validate(d);
});

test('stand-up rejects foreign sources and stale task edits without adding a duplicate', () => {
  const d = state(), uid = () => 'task'; E.upsertAction(d, input, now, uid);
  assert.throws(() => E.upsertAction(d, { ...input, projectId: 'foreign' }, later, uid), /no longer exists/);
  d.tasks[0].task = 'A newer instruction';
  assert.throws(() => E.upsertAction(d, { ...input, text: 'Stale', originalText: 'Email the owner' }, later, uid), /changed/);
  assert.equal(d.tasks.length, 1); assert.equal(d.tasks[0].task, 'A newer instruction');
  const previous = state(); previous.tasks = [{ id: 'task', task: 'Old' }];
  E.prepare(d, previous, false, later); assert.equal(E.data(d).actions[0].text, 'A newer instruction');
});

test('stand-up retains an instruction when its task or source is removed and validates imported Actions', () => {
  const d = state(); E.upsertAction(d, input, now, () => 'task'); d.tasks = []; d.specs = [];
  E.validate(d); assert.equal(E.data(d).actions[0].text, 'Email the owner'); assert.equal(E.taskStatus(null), 'Task removed');
  const invalid = copy(d); invalid.workhub.projectStandup.actions.push(copy(invalid.workhub.projectStandup.actions[0]));
  assert.throws(() => E.validate(invalid), /Actions/);
});

test('stand-up search matches real item/sub-item fields, combines terms and stays project-scoped', () => {
  const d = state();
  d.specs[0].itemId = 'MM-042';
  d.specs[0].itemType = 'Configuration';
  d.specs.push({ id: 'other', projectId: 'elsewhere', description: 'Pricing', status: 'Blocked', remarks: 'Foreign remarks', subItems: [] });
  assert.equal(E.search(d, 'p', ' pricing ').length, 1);
  assert.deepEqual(Array.from(E.search(d, 'p', 'MM-042 BLOCKED')[0].subItemIds), ['s']);
  assert.equal(E.search(d, 'p', 'MM-042 BLOCKED')[0].itemMatch, false);
  assert.equal(E.search(d, 'p', 'configuration')[0].itemMatch, true);
  assert.equal(E.search(d, 'p', 'Awaiting confirmation')[0].itemMatch, true);
  assert.equal(E.search(d, 'p', 'Foreign').length, 0);
  assert.equal(E.search(d, 'p', 'Remarks').length, 0);
  assert.equal(E.search(d, 'missing', '').length, 0);
});

test('stand-up search reads live linked tasks, falls back to removed instructions and treats punctuation literally', () => {
  const d = state();
  E.upsertAction(d, { ...input, dueDate: '2026-10-23' }, now, () => 'task');
  d.tasks[0].task = 'Request feedback (phase 2)';
  d.tasks[0].boardStatus = 'blocked';
  assert.equal(E.search(d, 'p', 'Email').length, 0);
  assert.deepEqual(Array.from(E.search(d, 'p', 'feedback blocked 2026-10-23')[0].subItemIds), ['s']);
  assert.equal(E.search(d, 'p', '(phase').length, 1);
  d.specs[0].remarks = '<img src=x onerror=alert(1)>';
  assert.equal(E.search(d, 'p', '<img')[0].itemMatch, true);
  assert.equal(E.search(d, 'p', '.*').length, 0);
  d.tasks = [];
  assert.deepEqual(Array.from(E.search(d, 'p', 'Email removed')[0].subItemIds), ['s']);
});

test('stand-up search retains every Action when an item has several follow-ups', () => {
  const d = state(); let n = 0;
  E.upsertAction(d, input, now, () => 'task-' + ++n);
  E.upsertAction(d, { ...input, id: 'action-2', text: 'Call finance about costing' }, now, () => 'task-' + ++n);
  assert.equal(E.search(d, 'p', 'Email the owner').length, 1);
  assert.equal(E.search(d, 'p', 'Call finance').length, 1);
  assert.deepEqual(Array.from(E.search(d, 'p', 'Email costing')[0].subItemIds), ['s']);
  d.tasks[0].task = 'Request approval';
  assert.equal(E.search(d, 'p', 'Email the owner').length, 0);
  assert.equal(E.search(d, 'p', 'Request approval').length, 1);
  assert.equal(E.search(d, 'p', 'Call finance').length, 1);
});
