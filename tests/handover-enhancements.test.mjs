import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
await import('../handover-engine.js');
const E = globalThis.WorkHubHandoverEngine;
const clone = value => JSON.parse(JSON.stringify(value));
function source() {
  return {
    projects: [{ id: 'p', name: 'Delivery project' }],
    projectCompanies: [{ id: 'c', projectId: 'p', name: 'Company 001' }],
    tasks: [{
      id: 't', number: '001', task: 'Material 6.00007', taskType: 'Project',
      linkId: 'p', companyId: 'c', boardStatus: 'blocked', done: false,
      priority: 'High', dueDate: '2026-11-01', remarks: 'Parent notes only',
      feedback: 'Parent feedback only', createdAt: '2026-11-01T01:00:00Z',
      references: [{ label: 'Original values', url: 'https://example.test/001' }],
      subTasks: [
        { id: 'a', title: 'Child A', status: 'In Progress', owner: 'A', feedback: 'A feedback', remarks: 'A notes' },
        { id: 'b', title: 'Child B', status: 'Completed', owner: 'B', feedback: 'B feedback', remarks: 'B notes' },
      ],
    }],
    tickets: [{
      id: 'tk', ticket: 'T-001', description: 'Ticket exact 6.00007', status: 'Pending',
      pic: 'Ticket owner', jira: 'J-001', mandays: 0,
      history: '- First exact 001 [01-11-2026]\n- Second µL 原文 [04-11-2026]\n- Latest 6.00007 [05-11-2026]',
      historyDate: '2026-11-05', historyTime: '09:15',
    }],
    specs: [{
      id: 'sp', itemId: '006', description: 'Project item', projectId: 'p', companyId: 'c',
      status: 'In progress', statusDate: '2026-11-03', itemType: 'Other',
      statusHistory: [{ status: 'In progress', date: '2026-11-03', changedAt: '2026-11-03T01:00:00Z' }],
      subItems: [{ id: 'sa', title: 'Child 001', status: 'Completed', statusDate: '2026-11-04' }],
    }],
    workhub: {
      waiting: [{ id: 'w', title: 'Approval', person: 'Approver', followUp: '2026-11-20', resolved: false }],
      batchA: { records: [{
        id: 'tasks:t', nextStep: 'Confirm the source values', updatedAt: '2026-11-05T01:00:00Z',
        pause: { active: true, reason: 'approval', notes: 'Approval pending' },
        dependencies: [{ type: 'document', title: 'Signed input', targetId: '', resolved: false }],
      }] },
      sessions: [
        { kind: 'task', linkId: 't', title: 'Main session', seconds: 3601, start: '2026-11-01T01:00:00Z', end: '2026-11-01T02:00:01Z', notes: 'Main session notes' },
        { kind: 'task', linkId: 't', subTaskId: 'a', title: 'A session', seconds: 65, start: '2026-11-02T01:00:00Z', end: '2026-11-02T01:01:05Z', notes: 'A session notes', completedWork: 'Checked 001', nextStep: 'Review 6.00007' },
        { kind: 'project', projectId: 'p', linkId: 'p', itemId: 'sp', subItemId: 'sa', title: 'Project child session', seconds: 125 },
        { kind: 'ticket', linkId: 'tk', title: 'Ticket session', seconds: 10 },
        { kind: 'custom', title: 'Unrelated session', seconds: 99999 },
      ],
    },
  };
}
const pack = (d, options = {}, can = () => true) =>
  E.snapshot(d, E.collect(d, can).map(r => r.key), { asOf: '2026-11-06', ...options }, can, '2026-11-06T01:00:00Z');
test('Enhanced handover: full updates, exact identifiers, zero mandays and status history survive without source changes', () => {
  const d = source(), before = clone(d), p = pack(d), ticket = p.records.find(r => r.kind === 'tickets');
  assert.deepEqual(d, before);
  assert.equal(p.version, 2);
  assert.equal(ticket.feedback, d.tickets[0].history);
  assert.equal(ticket.details.find(f => f.label === 'Chargeable mandays').value, '0');
  assert.equal(p.records.find(r => r.kind === 'specs' && !r.childId).statusHistory[0].changedAt, '2026-11-03T01:00:00Z');
  assert.equal(p.records.find(r => r.kind === 'tasks' && !r.childId).identifier, '001');
  d.tickets[0].history = 'Later history';
  d.tasks[0].task = 'Later material';
  assert.match(ticket.feedback, /First exact 001/);
  assert.equal(p.records[0].title, 'Material 6.00007');
});
test('Enhanced handover: children keep their own feedback, notes and saved time without copying siblings or parent context', () => {
  const p = pack(source()), main = p.records.find(r => r.kind === 'tasks' && !r.childId),
    a = p.records.find(r => r.childId === 'a'), b = p.records.find(r => r.childId === 'b'),
    sp = p.records.find(r => r.childId === 'sa');
  assert.deepEqual(main.progress, { total: 2, completed: 1 });
  assert.equal(main.sessions.length, 1);
  assert.equal(main.sessions[0].seconds, 3601);
  assert.equal(a.sessions[0].title, 'A session');
  assert.equal(a.notes, 'A notes');
  assert.equal(a.feedback, 'A feedback');
  assert.equal(a.nextStep, '');
  assert.equal(a.blocker, '');
  assert.deepEqual(a.dependencies, []);
  assert.equal(b.sessions.length, 0);
  assert.equal(sp.sessions[0].title, 'Project child session');
  assert.equal(a.company, 'Company 001');
  assert.match(E.sections(a).find(s => s.title === 'Recorded work').fields[0].value, /0h 01m 05s/);
  assert.ok(!JSON.stringify(p).includes('Unrelated session'));
});
test('Enhanced handover: group identity includes source kind and child-only selection does not export the parent content', () => {
  const d = source(); d.specs[0].id = 't';
  const child = E.collect(d).find(r => r.childId === 'a'),
    project = E.collect(d).find(r => r.kind === 'specs' && !r.childId),
    p = E.snapshot(d, [child.key, project.key], { asOf: '2026-11-06' }, () => true, '2026-11-06T01:00:00Z');
  assert.equal(E.groups(p.records).length, 2);
  assert.equal(E.groups(p.records)[0].parentSelected, false);
  assert.equal(E.groups(p.records)[0].title, '001 · Material 6.00007');
  assert.ok(!JSON.stringify(p).includes('Parent notes only'));
  assert.ok(!JSON.stringify(p).includes('Parent feedback only'));
});
test('Enhanced handover: summary counts selected records and flags actual overdue, blocked and prerequisite work only', () => {
  const p = pack(source()), info = E.overview(p);
  assert.equal(info.total, 7);
  assert.equal(info.main, 4);
  assert.equal(info.children, 3);
  assert.equal(info.completed, 2);
  assert.equal(info.overdue, 1);
  assert.equal(info.blocked, 1);
  assert.equal(info.actions.length, 1);
  assert.ok(info.attention.some(a => a.reasons.includes('Unresolved prerequisite')));
  assert.ok(info.attention.every(a => !E.closed(a.record.status)));
});
test('Enhanced handover: optional content removes its fields while compact layout retains the full included content', () => {
  const d = source(), detailed = pack(d), compact = pack(d, { layout: 'compact' });
  assert.deepEqual(compact.records, detailed.records);
  const p = pack(d, { notes: false, feedback: false, context: false, time: false, nextSteps: false, references: false });
  for (const r of p.records) {
    assert.equal(r.notes, ''); assert.equal(r.feedback, ''); assert.equal(r.nextStep, '');
    assert.equal(r.blocker, ''); assert.equal(r.company, ''); assert.equal(r.created, '');
    for (const name of ['statusHistory', 'details', 'sessions', 'dependencies', 'references']) assert.deepEqual(r[name], []);
  }
  assert.throws(() => pack(d, { layout: 'unknown' }), /layout/);
  assert.throws(() => pack(d, { asOf: '2026-02-30' }), /date/);
  d.tasks[0].remarks = 'x'.repeat(E.MAX_CHARS);
  assert.throws(() => pack(d), /too large/);
});
test('Enhanced handover: related project, workflow and recorded-time access is checked when collecting and again at export', () => {
  const d = source(), can = feature => !['specs', 'studio.sessions', 'workspace'].includes(feature),
    rows = E.collect(d, can);
  assert.ok(rows.every(r => r.project === '' && r.company === '' && !r.sessions.length && !r.nextStep && !r.blocker));
  assert.ok(rows.every(r => r.kind !== 'specs'));
  const p = pack(d);
  for (const feature of ['specs', 'studio.sessions', 'workspace', 'tasks', 'handover'])
    assert.equal(E.allowed(p, k => k !== feature), false, feature + ' revocation invalidates snapshot');
  const permitted = E.snapshot(d, rows.map(r => r.key), { asOf: '2026-11-06' }, can);
  assert.equal(E.allowed(permitted, can), true);
});
function uiFixture(t) {
  const dom = new JSDOM('<body><main id="view"></main></body>', { runScripts: 'outside-only', url: 'https://example.test' }),
    w = dom.window, d = w.document;
  t.after(() => w.close());
  for (const path of ['handover-engine.js', 'handover.js'])
    w.eval(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
  const data = source(); let permission = true, generation = 1, writes = 0, ui;
  ui = w.WorkHubHandover.install({
    state: () => data, ready: () => true, owner: () => 'a', generation: () => generation,
    can: feature => permission || feature !== 'tasks', tell() {},
    render() { d.getElementById('view').innerHTML = ui.render(); },
    saveDriveFile() { writes++; },
  });
  const render = () => { d.getElementById('view').innerHTML = ui.render(); };
  render();
  return { w, d, ui, data, render, writes: () => writes,
    deny() { permission = false; render(); }, switchAccount() { generation++; render(); } };
}
test('Enhanced handover UI: preview groups selected records, escapes markup and keeps later source changes out of the snapshot', t => {
  const x = uiFixture(t);
  x.data.tasks[0].task = '<img src=x onerror=alert(1)> 001 / 6.00007';
  x.render();
  x.d.querySelector('[data-ho="select-filtered"]').click();
  x.d.querySelector('[data-ho="preview"]').click();
  const preview = x.d.getElementById('hoPreview'), snapshot = x.ui.snapshot();
  assert.ok(preview);
  assert.equal(preview.querySelector('img'), null);
  assert.match(preview.textContent, /First exact 001/);
  assert.match(preview.textContent, /Second µL 原文/);
  assert.match(preview.textContent, /Needs attention/);
  assert.ok(preview.querySelector('.ho-preview-child'));
  assert.match(preview.querySelector('.ho-object-header').textContent, /Detailed layout/);
  x.data.tasks[0].task = 'Later changed';
  x.render();
  assert.equal(x.ui.snapshot(), snapshot);
  assert.match(x.d.getElementById('hoPreview').textContent, /<img src=x onerror=alert\(1\)> 001/);
  assert.equal(x.writes(), 0);
});
test('Enhanced handover UI: layout changes invalidate the previous preview and permission changes clear private snapshots', t => {
  const x = uiFixture(t);
  x.d.querySelector('[data-ho="select-filtered"]').click();
  x.d.querySelector('[data-ho="preview"]').click();
  const field = x.d.querySelector('[data-ho-field="layout"]');
  field.value = 'compact'; field.dispatchEvent(new x.w.Event('change', { bubbles: true }));
  assert.equal(x.ui.snapshot(), null);
  assert.equal(x.d.getElementById('hoPreview'), null);
  x.d.querySelector('[data-ho="preview"]').click();
  assert.equal(x.ui.snapshot().layout, 'compact');
  x.deny(); assert.equal(x.ui.snapshot(), null);
  assert.equal(x.d.getElementById('hoPreview'), null);
  assert.equal(x.writes(), 0);
});
