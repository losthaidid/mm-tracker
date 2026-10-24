import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const source = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const copy = x => JSON.parse(JSON.stringify(x));
const settle = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
function hub(t, initial = {}) {
  const dom = new JSDOM('<body><main id="view"></main><dialog id="modal"><div id="modalBody"></div></dialog></body>', { url: 'http://preview.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  window.requestAnimationFrame = () => 1; window.cancelAnimationFrame = () => {}; window.matchMedia = () => ({ matches: false }); window.confirm = () => true;
  window.URL.createObjectURL = () => 'blob:test-export'; window.URL.revokeObjectURL = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const f of ['rehearsal-engine.js', 'process-hub-files.js', 'rehearsal.js']) window.eval(source(f));
  const E = window.WorkHubRehearsalEngine, F = window.WorkHubProcessFiles;
  let state = { projects: [], tickets: [], specs: [], workhub: { processes: [], notes: [], tcodes: { records: [] }, ...initial } };
  E.upgrade(state);
  const account = { id: 'owner', ready: true, active: true }, writes = [], downloads = [], messages = [];
  let ui;
  const render = () => { document.getElementById('view').innerHTML = account.active ? ui.render() : '<p>Another section</p>'; ui.mount(); };
  ui = window.WorkHubRehearsal.install({ state: () => state, ready: () => account.ready, owner: () => account.id, active: () => account.active, prefs: () => ({ motion: 'calm' }), render,
    mutate(fn) { const next = copy(state); fn(next); E.validate(next); state = next; writes.push(copy(state)); render(); return true; },
    tell: s => messages.push(s), download: (blob, name) => downloads.push({ blob, name }),
    openModal(title, html) { document.getElementById('modalBody').innerHTML = html; document.getElementById('modal').showModal(); }, closeModal() { document.getElementById('modal').close(); },
  });
  render();
  const click = async action => { document.querySelector('[data-rehearsal="' + action + '"]').click(); await settle(); };
  const fill = (id, fields) => { const f = document.getElementById(id); for (const [k, v] of Object.entries(fields)) f.elements.namedItem(k).value = v; return f; };
  return { window, document, E, F, ui, account, writes, downloads, messages, render, click, fill, state: () => state, change(fn) { const next = copy(state); fn(next); state = next; render(); } };
}
function oldProcess(n = 3) {
  return { id: 'existing', name: 'Existing hub flow', description: 'Preserved context', archived: false, steps: Array.from({ length: n }, (_, i) => ({ id: 's' + i, title: 'Step ' + i, tcodes: 'REF-' + i, notes: 'Instructions ' + i, prerequisites: 'Input', configuration: 'Setup', errors: 'Recovery', testing: 'Verify', projectId: 'project-old', ticketId: 'ticket-old', itemId: 'item-old', noteId: 'note-old', next: i === 0 && n > 2 ? ['s1', 's2'] : [] })) };
}
test('Process Hub adapts both libraries without writes and saves old branches, notes and references in place', t => {
  const h = hub(t, { processes: [oldProcess()] }), { E } = h;
  const before = copy(h.state()); let p = E.library(h.state())[0];
  assert.deepEqual(copy(h.state()), before); assert.equal(p.steps[0].next, 's1'); assert.equal(p.steps[0].alternatives[0], 's2');
  p.steps[0].expected = 'An outcome'; p.steps[0].inputs = 'New input'; p.presenterNotes = 'For me'; E.store(h.state(), p); E.validate(h.state());
  const saved = h.state().workhub.processes[0]; assert.equal(h.state().workhub.rehearsal.processes.length, 0);
  assert.deepEqual(copy(saved.steps[0].next), ['s1', 's2']); assert.equal(saved.steps[0].configuration, 'Setup'); assert.equal(saved.steps[0].noteId, 'note-old');
  p = E.library(h.state())[0]; assert.equal(p.steps[0].expected, 'An outcome'); assert.equal(p.presenterNotes, 'For me');
});
test('Process Hub preserves the previous 200-step allowance and rejects invalid extended graph links', t => {
  const h = hub(t, { processes: [oldProcess(200)] }), p = h.E.library(h.state())[0]; h.E.store(h.state(), p); h.E.validate(h.state());
  h.state().workhub.processes[0].steps[0].next.push('foreign'); assert.throws(() => h.E.validate(h.state()), /route|connection/);
});
test('Process Hub new drafts open full screen, stage palette additions and save current step details in one write', async t => {
  const h = hub(t); await h.click('new');
  assert.equal(h.ui.snapshot().mode, 'full'); assert.ok(h.document.getElementById('processHubOverlay').open); assert.equal(h.writes.length, 0);
  h.fill('processHubDetails', { name: 'Service request', objective: 'Explain the handoffs', presenterNotes: 'PRIVATE NOTES', revision: 'v1' });
  h.document.querySelector('[data-step-type="decision"]').click(); await settle();
  h.fill('rehearsalStepForm', { title: 'Review the request', instruction: 'Check the required details', audienceText: 'We review your request', inputs: 'Request form', outputs: 'Decision', system: 'Portal' });
  assert.equal(h.writes.length, 0); await h.click('save-draft');
  assert.equal(h.writes.length, 1); assert.equal(h.ui.snapshot().drafting, false); assert.equal(h.ui.snapshot().mode, 'full');
  const p = h.state().workhub.rehearsal.processes[0]; assert.equal(p.name, 'Service request'); assert.equal(p.steps[2].type, 'decision'); assert.equal(p.steps[2].inputs, 'Request form'); assert.equal(p.presenterNotes, 'PRIVATE NOTES');
  for (let i = 1; i < 180; i++) h.ui.tick(i * 150); assert.ok(h.ui.snapshot().loops > 0); assert.equal(h.writes.length, 1);
  h.ui.setMode('normal', false); assert.equal(h.document.getElementById('processHubOverlay'), null); assert.ok(h.document.querySelector('#view #rehearsalRoot')); assert.equal(h.writes.length, 1);
});
test('Process Hub drop coordinates respect zoom and a dropped type opens its details without saving records', async t => {
  const h = hub(t); await h.click('new');
  const board = h.document.getElementById('rehearsalBoard'); board.getBoundingClientRect = () => ({ left: 100, top: 200 });
  const event = new h.window.Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperties(event, { clientX: { value: 465 }, clientY: { value: 430 }, dataTransfer: { value: { getData: () => 'approval' } } });
  h.document.getElementById('rehearsalViewport').dispatchEvent(event); await settle();
  const s = h.ui.model().steps.at(-1); assert.equal(s.type, 'approval'); assert.equal(s.x, 260); assert.equal(s.y, 180); assert.ok(h.document.getElementById('rehearsalStepForm')); assert.equal(h.writes.length, 0);
});
test('Process Hub presentation hides private details and retains looping playback in its own full-screen dialog', async t => {
  const h = hub(t); await h.click('keep');
  h.change(d => { const p = d.workhub.rehearsal.processes[0]; p.presenterNotes = 'SECRET NOTES'; p.steps[0].configuration = 'SECRET CONFIG'; p.steps[0].audienceText = 'PUBLIC EXPLANATION'; });
  h.ui.setMode('present', false);
  assert.match(h.document.getElementById('rehearsalInspector').textContent, /PUBLIC EXPLANATION/);
  assert.doesNotMatch(h.document.getElementById('processHubOverlay').textContent, /SECRET NOTES|SECRET CONFIG/);
  const calls = h.writes.length; for (let i = 1; i < 420; i++) h.ui.tick(i * 150);
  assert.ok(h.ui.snapshot().loops > 0); assert.equal(h.writes.length, calls);
});
test('Process Hub discarding a draft does not create records and account changes reject detached editors', async t => {
  const h = hub(t); await h.click('new'); h.document.querySelector('[data-step-type="task"]').click(); await settle();
  const form = h.document.getElementById('rehearsalStepForm'); await h.click('discard-draft'); assert.equal(h.writes.length, 0); assert.equal(h.state().workhub.rehearsal.processes.length, 0);
  await h.click('new'); h.account.id = 'new-owner'; h.render(); assert.equal(h.ui.snapshot().drafting, false); assert.equal(h.document.getElementById('processHubOverlay'), null); assert.throws(() => h.ui.saveForm(form), /Sign in/);
});
test('Process Hub detects changes to a saved process before committing a full editor draft', async t => {
  const h = hub(t); await h.click('keep'); await h.click('edit-process');
  h.fill('processHubDetails', { name: 'Unsaved local title' }); h.change(d => { d.workhub.rehearsal.processes[0].notes = 'Newer remote content'; });
  assert.throws(() => h.ui.saveDraft(), /changed on another save/); assert.equal(h.state().workhub.rehearsal.processes[0].notes, 'Newer remote content'); assert.equal(h.ui.snapshot().drafting, true);
});
test('Process Hub alternate normal routes are explicit, bounded and validated', t => {
  const h = hub(t, { processes: [oldProcess()] }), p = h.ui.model();
  p.scenarios[0].routes.s0 = 's2'; const plan = h.E.plan(p, p.scenarios[0]); assert.equal(plan.entries[1].id, 's2');
  assert.equal(h.E.plan(p, p.scenarios[0], {}, { s0: 's1' }).entries[1].id, 's1');
  assert.throws(() => h.E.plan(p, p.scenarios[0], {}, { s0: 'foreign' }), /connected/);
});
test('Process Hub downloads saved snapshots and cancels a pending export after account changes', async t => {
  const h = hub(t); await h.click('keep'); let finish;
  h.F.export = async () => new Promise(resolve => { finish = resolve; });
  await h.click('export'); const form = h.document.getElementById('processHubExport'); form.dispatchEvent(new h.window.Event('submit', { bubbles: true, cancelable: true })); await settle();
  h.account.id = 'new-owner'; h.render(); finish(new Blob(['test'])); await settle(); assert.equal(h.downloads.length, 0);
  h.F.export = async () => new Blob(['png']); await h.click('export'); const next = h.document.getElementById('processHubExport'); next.elements.namedItem('format').value = 'png'; next.dispatchEvent(new h.window.Event('submit', { bubbles: true, cancelable: true })); await settle(); const link=h.document.querySelector('#processHubExportReady a');assert.ok(link);assert.match(link.download,/\.png$/);assert.equal(h.downloads.length,0);
});
test('Process Hub export scopes separate user explanations from reference-only details and wrap long Unicode text', t => {
  const h = hub(t), p = h.E.normalize(h.E.seed('test', '2026-10-24T00:00:00.000Z'));
  const s = p.steps[0]; s.audienceText = 'For the user'; s.configuration = 'Private configuration';
  const audience = h.F.stepSections(p, s, 'audience'), reference = h.F.stepSections(p, s, 'reference');
  assert.match(JSON.stringify(audience), /For the user/); assert.doesNotMatch(JSON.stringify(audience), /Private configuration/); assert.match(JSON.stringify(reference), /Private configuration/);
  const text = '中文😀'.repeat(80), lines = h.F.wrap({ measureText: s => ({ width: Array.from(s).length * 10 }) }, text, 80);
  assert.equal(lines.join(''), text); assert.ok(lines.every(s => Array.from(s).length <= 8));
});
test('Process Hub animation reuses the library model between edits instead of copying it every frame', t => {
  const h = hub(t), old = h.E.library; let calls = 0; h.E.library = (...args) => { calls++; return old(...args); };
  for (let i = 1; i < 100; i++) h.ui.tick(i * 150); assert.equal(calls, 0);
  h.change(d => { d.workhub.rehearsal.preferences.volume = .4; }); assert.equal(calls, 1);
});


test('Process Hub can add the first animated step to an empty older process without copying it',async t=>{
 const old=oldProcess();old.steps=[];const h=hub(t,{processes:[old]});h.ui.addStep('task');await settle();assert.equal(h.state().workhub.processes[0].steps.length,1);assert.equal(h.state().workhub.rehearsal.processes.length,0);h.E.validate(h.state());assert.equal(h.ui.model().startId,h.ui.model().steps[0].id);
});

test('Process Hub keeps both records selectable if the two older libraries contain overlapping IDs',t=>{
 const h=hub(t,{processes:[oldProcess()]});const p=h.E.seed('hub:existing','2026-10-24T00:00:00.000Z');h.state().workhub.rehearsal.processes.push(p);const rows=h.E.library(h.state());assert.equal(new Set(rows.map(x=>x.id)).size,2);assert.equal(rows.find(x=>x.hubId).hubId,'existing');
});
