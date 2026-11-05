import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
await import('../task-completion.js');
const E = globalThis.WorkHubTaskCompletion;
const clone = value => JSON.parse(JSON.stringify(value));
const child = (id, status = 'In Progress') => ({
  id, status, title: 'Child ' + id, remarks: 'Notes 001', feedback: 'Own 6.00007',
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-02T00:00:00Z',
});
const task = (id, children = []) => ({
  id, number: '001', task: 'Material 6.00007 <review>', done: false, doneDate: '',
  boardStatus: 'doing', archived: false, subTasks: children,
});
test('Task completion: last unfinished child completes only its parent with preserved exact content', () => {
  const before = { tasks: [task('a', [child('a1', 'Completed'), child('a2')]), task('b', [child('b1')])] },
    next = clone(before);
  next.tasks[0].subTasks[1].status = 'Completed';
  E.prepare(next, before, '2026-11-06', '2026-11-06T01:00:00Z');
  assert.equal(next.tasks[0].done, true);
  assert.equal(next.tasks[0].doneDate, '2026-11-06');
  assert.equal(next.tasks[0].boardStatus, 'done');
  assert.deepEqual(next.tasks[0].subTasks, before.tasks[0].subTasks.map(s =>
    s.id === 'a2' ? { ...s, status: 'Completed' } : s
  ));
  assert.deepEqual(next.tasks[1], before.tasks[1]);
  assert.equal(before.tasks[0].done, false);
});
test('Task completion: empty, partial, archived and unchanged legacy groups stay unchanged', () => {
  const before = { tasks: [
    task('empty'), task('partial', [child('p1'), child('p2', 'Completed')]),
    { ...task('archived', [child('ar', 'Completed')]), archived: true },
    task('legacy', [child('l1', 'Completed')]),
  ] }, next = clone(before);
  next.tasks[3].feedback = 'Unrelated feedback';
  E.prepare(next, before, '2026-11-06', 'now');
  assert.ok(next.tasks.every(t => !t.done));
  assert.deepEqual(E.pending(next.tasks).map(t => t.id), ['legacy']);
});
test('Task completion: manual parent reopening and board changes are preserved', () => {
  const before = { tasks: [{ ...task('a', [child('s', 'Completed')]), done: true, doneDate: '2026-11-01', boardStatus: 'done' }] },
    next = clone(before);
  next.tasks[0].done = false;
  next.tasks[0].doneDate = '';
  E.prepare(next, before, '2026-11-06', 'now');
  assert.equal(next.tasks[0].done, false);
  assert.equal(next.tasks[0].boardStatus, 'todo');
  const later = clone(next);
  later.tasks[0].feedback = 'More feedback';
  E.prepare(later, next, '2026-11-06', 'now');
  assert.equal(later.tasks[0].done, false);
});
test('Task completion: parent cascade does not mutate shared children in the original document', () => {
  const before = { tasks: [task('a', [child('s'), child('done', 'Completed')])] },
    original = clone(before),
    next = { tasks: [{ ...before.tasks[0], done: true, doneDate: '2026-11-06' }] };
  E.prepare(next, before, '2026-11-06', 'completed-at');
  assert.deepEqual(before, original);
  assert.equal(next.tasks[0].subTasks[0].status, 'Completed');
  assert.equal(next.tasks[0].subTasks[0].updatedAt, 'completed-at');
  assert.equal(next.tasks[0].subTasks[1].updatedAt, original.tasks[0].subTasks[1].updatedAt);
});
test('Task completion: restore keeps recorded statuses and child reopening does not rewrite a completed parent', () => {
  const before = { tasks: [task('a', [child('s')])] }, next = clone(before);
  next.tasks[0].subTasks[0].status = 'Completed';
  E.prepare(next, before, '2026-11-06', 'now', true);
  assert.equal(next.tasks[0].done, false);
  const done = { tasks: [{ ...task('done', [child('d', 'Completed')]), done: true, doneDate: '2026-11-01', boardStatus: 'done' }] },
    reopened = clone(done);
  reopened.tasks[0].subTasks[0].status = 'In Progress';
  E.prepare(reopened, done, '2026-11-06', 'now');
  assert.equal(reopened.tasks[0].done, true);
  assert.equal(reopened.tasks[0].doneDate, '2026-11-01');
  assert.equal(reopened.tasks[0].subTasks[0].status, 'In Progress');
});
test('Task completion: deleting the last unfinished child completes a nonempty group but never an empty group', () => {
  const before = { tasks: [task('a', [child('done', 'Completed'), child('open')]), task('b', [child('only')])] },
    next = clone(before);
  next.tasks[0].subTasks.pop();
  next.tasks[1].subTasks = [];
  E.prepare(next, before, '2026-11-06', 'now');
  assert.equal(next.tasks[0].done, true);
  assert.equal(next.tasks[1].done, false);
});
function fixture(t, count = 2) {
  const dom = new JSDOM('<body><div id="view"></div><dialog id="modal"></dialog></body>', { runScripts: 'outside-only' }),
    w = dom.window, d = w.document;
  t.after(() => w.close());
  w.eval(readFileSync(new URL('../task-completion.js', import.meta.url), 'utf8'));
  let state = { tasks: Array.from({ length: count }, (_, i) => task(String(i), [child('child' + i, 'Completed')])) },
    owner = 'a', generation = 1, permitted = true, writes = 0;
  const messages = [], modal = d.getElementById('modal');
  const ui = w.WorkHubTaskCompletion.install({
    state: () => state, cloud: () => ({ ready: true, user: { id: owner }, generation }),
    canEdit: () => permitted, today: () => '2026-11-06',
    validDate: value => /^\d{4}-\d{2}-\d{2}$/.test(value),
    openModal(title, body) { modal.innerHTML = body; modal.setAttribute('open', ''); },
    closeModal() { modal.removeAttribute('open'); },
    tell: (...args) => messages.push(args),
    mutate(fn) {
      const next = clone(state); fn(next);
      w.WorkHubTaskCompletion.prepare(next, state, '2026-11-06', 'now');
      state = next; writes++; ui.mount('tasks'); return true;
    },
  });
  return { w, d, ui, messages, state: () => state, writes: () => writes,
    change() { state.tasks[0].feedback = 'Newer update'; },
    switchOwner() { owner = 'b'; generation++; },
    deny() { permitted = false; },
  };
}
test('Task completion review: 100-record batches escape titles, respect selection/date and preserve every child', t => {
  const x = fixture(t, 101), before = clone(x.state());
  x.ui.mount('tasks');
  assert.match(x.d.getElementById('taskCompletionNotice').textContent, /101 main tasks/);
  x.ui.review();
  let form = x.d.getElementById('taskCompletionForm');
  assert.equal(form.querySelectorAll('[name="tasks"]').length, 100);
  assert.equal(form.querySelector('review'), null);
  assert.match(form.textContent, /001 · Material 6.00007 <review>/);
  for (const checkbox of form.querySelectorAll('[name="tasks"]')) checkbox.checked = false;
  assert.throws(() => x.ui.apply(form), /at least one/);
  assert.equal(x.writes(), 0);
  const boxes = form.querySelectorAll('[name="tasks"]');
  boxes[0].checked = boxes[1].checked = true;
  form.elements.namedItem('completionDate').value = '2026-11-04';
  x.ui.apply(form);
  assert.equal(x.writes(), 1);
  for (const current of x.state().tasks.slice(0, 2)) {
    assert.equal(current.done, true);
    assert.equal(current.doneDate, '2026-11-04');
    assert.deepEqual(current.subTasks, before.tasks.find(t => t.id === current.id).subTasks);
  }
  assert.deepEqual(x.state().tasks.slice(2), before.tasks.slice(2));
});
test('Task completion review: changed records, closed dialogs, account changes and denied access cannot apply stale reviews', t => {
  const x = fixture(t), before = clone(x.state());
  x.ui.review(); let form = x.d.getElementById('taskCompletionForm');
  x.d.getElementById('modal').removeAttribute('open');
  assert.throws(() => x.ui.apply(form), /expired/);
  x.ui.review(); form = x.d.getElementById('taskCompletionForm'); x.change();
  assert.throws(() => x.ui.apply(form), /changed/);
  x.ui.review(); form = x.d.getElementById('taskCompletionForm'); x.switchOwner();
  assert.throws(() => x.ui.apply(form), /expired/);
  x.deny();
  assert.throws(() => x.ui.review(), /cannot complete/);
  assert.equal(x.writes(), 0);
  assert.equal(x.state().tasks[0].done, before.tasks[0].done);
});
