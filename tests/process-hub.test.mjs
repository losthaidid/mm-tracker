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
  for (const f of ['rehearsal-engine.js', 'process-hub-files.js', 'audience-view.js', 'presenter.js', 'rehearsal.js']) window.eval(source(f));
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

function requestFlow(h, loop = false) {
  const p = h.E.normalize(h.E.seed('request-flow','2026-10-25T00:00:00.000Z',true));
  const base = p.steps[0];
  p.name='Request review';p.presenterNotes='PRIVATE SPEAKER NOTES';p.startId='ask';
  p.scenarios=[{id:'normal',name:'Default route',notes:'PRIVATE SCENARIO',initial:{},choices:{},routes:{}}];
  p.steps=[
    {...copy(base),id:'ask',title:'Review request',type:'decision',next:'yes',alternatives:['no'],configuration:'PRIVATE CONFIG',instruction:'PUBLIC INSTRUCTION',audienceText:'PUBLIC EXPLANATION',decision:{question:'Is the information complete?',answers:[{label:'Complete',next:'yes'},{label:'Need more information',next:'no'}]}},
    {...copy(base),id:'yes',title:'Proceed',next:'',x:310,y:40},
    {...copy(base),id:'no',title:'Request details',next:loop?'ask':'',x:310,y:220},
  ];return p;
}
function loadFlow(h,p) {h.change(d=>d.workhub.rehearsal.processes.push(p));h.ui.open(p.id);h.render();}
function setInteractive(h) {const select=h.document.getElementById('rehearsalDecisionMode');select.value='interactive';select.dispatchEvent(new h.window.Event('change',{bubbles:true}));}
function connectAudience(h) {
  const messages=[],popup={closed:false,focus(){},close(){this.closed=true;},postMessage(message,origin){messages.push({message:copy(message),origin});}};
  let url;h.window.open=href=>{url=new URL(href);return popup;};h.ui.presenter.open();
  const ready=()=>h.window.dispatchEvent(new h.window.MessageEvent('message',{origin:h.window.location.origin,source:popup,data:{type:'workhub-audience-ready',token:url.hash.slice(1)}}));ready();
  return {messages,popup,url,ready};
}
test('Batch D: interactive decisions wait, follow a named answer from the current step and never write records', async t=>{
  const h=hub(t),p=requestFlow(h);loadFlow(h,p);setInteractive(h);
  const before=copy(h.state());for(let n=1;n<150;n++)h.ui.tick(n*150);
  assert.equal(h.ui.snapshot().index,0);assert.equal(h.ui.snapshot().waitingForDecision,true);assert.match(h.document.getElementById('rehearsalStatus').textContent,/Choose an answer/);
  await h.click('next');assert.equal(h.ui.snapshot().index,0);
  h.document.querySelector('[data-rehearsal="answer"][data-answer="1"]').click();await settle();
  assert.equal(h.ui.snapshot().index,0);assert.equal(h.ui.snapshot().waitingForDecision,false);assert.equal(h.ui.plan().entries[1].id,'no');
  await h.click('next');assert.equal(h.ui.snapshot().index,1);assert.match(h.document.getElementById('rehearsalInspector').textContent,/Request details/);
  assert.deepEqual(copy(h.state()),before);assert.equal(h.writes.length,0);
});
test('Batch D: repeated decisions preserve earlier answers and bound loops while allowing a later different answer',t=>{
  const h=hub(t),p=requestFlow(h,true),sc=p.scenarios[0];
  const route=h.E.plan(p,sc,{}, {},{0:{id:'ask',next:'no',outcome:'success'},2:{id:'ask',next:'yes',outcome:'success'}});
  assert.deepEqual(copy(route.entries.map(e=>e.id)),['ask','no','ask','yes']);
  assert.throws(()=>h.E.plan(p,sc,{}, {},{0:{id:'ask',next:'foreign',outcome:'success'}}),/connected/);
});
test('Batch D: decision form saves named answers, automatic default and exports while rejecting invalid destinations', async t=>{
  const h=hub(t);loadFlow(h,requestFlow(h));h.ui.stepEditor('ask');
  const f=h.fill('rehearsalStepForm',{'decisionQuestion':'Choose the next action','decisionLabel-0':'Proceed now','decisionLabel-1':'Follow up','decisionDefault':'1'});
  h.ui.saveForm(f);const p=h.ui.model();assert.equal(p.steps[0].next,'no');assert.equal(p.steps[0].decision.question,'Choose the next action');
  assert.equal(h.E.plan(p,p.scenarios[0]).entries[1].id,'no');
  const exported=h.F.stepSections(p,p.steps[0],'audience');assert.match(JSON.stringify(exported),/Choose the next action|Proceed now/);
  assert.doesNotMatch(JSON.stringify(exported),/PRIVATE CONFIG|PRIVATE SPEAKER/);
  const bad=copy(h.state());bad.workhub.rehearsal.processes[0].steps[0].decision.answers[1].next='foreign';assert.throws(()=>h.E.validate(bad),/decision/);
  bad.workhub.rehearsal.processes[0]=copy(p);bad.workhub.rehearsal.processes[0].steps[0].decision.answers[1].label='Proceed now';assert.throws(()=>h.E.validate(bad),/decision/);
});
test('Batch D: default end-route answer survives validation and explicit scenario selection',t=>{
  const h=hub(t),p=requestFlow(h);p.steps[0].next='';p.steps[0].alternatives=['no'];p.steps[0].decision.answers[0].next='';
  loadFlow(h,p);h.E.validate(h.state());assert.equal(h.ui.plan().entries.length,1);
  assert.equal(h.E.plan(p,p.scenarios[0],{}, {ask:'no'}).entries[1].id,'no');
});
test('Batch D: legacy Process Hub stores decision metadata in place and keeps its existing references',t=>{
  const h=hub(t,{processes:[oldProcess()]});const p=h.ui.model(),s=p.steps[0];s.type='decision';s.decision={question:'Which path?',answers:[{label:'First',next:'s1'},{label:'Second',next:'s2'}]};h.E.store(h.state(),p);h.E.validate(h.state());
  assert.equal(h.state().workhub.rehearsal.processes.length,0);assert.equal(h.E.library(h.state())[0].steps[0].decision.question,'Which path?');assert.equal(h.state().workhub.processes[0].steps[0].noteId,'note-old');
});
test('Batch D: audience handshake rejects foreign origin, source and token and sends only public content',t=>{
  const h=hub(t);loadFlow(h,requestFlow(h));
  const messages=[],popup={closed:false,focus(){},close(){this.closed=true;},postMessage(m,o){messages.push({message:copy(m),origin:o});}};let url;
  h.window.open=href=>{url=new URL(href);return popup;};h.ui.presenter.open();
  for(const options of [{origin:'https://foreign.test',source:popup,token:url.hash.slice(1)},{origin:h.window.location.origin,source:{},token:url.hash.slice(1)},{origin:h.window.location.origin,source:popup,token:'wrong'}]){
    h.window.dispatchEvent(new h.window.MessageEvent('message',{origin:options.origin,source:options.source,data:{type:'workhub-audience-ready',token:options.token}}));
    assert.equal(h.ui.presenter.connected(),false);
  }
  h.window.dispatchEvent(new h.window.MessageEvent('message',{origin:h.window.location.origin,source:popup,data:{type:'workhub-audience-ready',token:url.hash.slice(1)}}));
  assert.equal(h.ui.presenter.connected(),true);assert.ok(messages.length);const payload=JSON.stringify(messages);
  assert.match(payload,/PUBLIC EXPLANATION/);assert.doesNotMatch(payload,/PRIVATE SPEAKER NOTES|PRIVATE CONFIG|PRIVATE SCENARIO/);
  assert.match(h.document.querySelector('[data-presenter-notes]').textContent,/PRIVATE SPEAKER NOTES/);
  assert.ok(messages.every(m=>m.origin===h.window.location.origin));
});
test('Batch D: private annotations, hold, cover and audience breaks remain temporary and account changes clear both windows',async t=>{
  const h=hub(t);loadFlow(h,requestFlow(h));const {messages,popup}=connectAudience(h);
  const click=async name=>{h.document.querySelector(`[data-presenter="${name}"]`).click();await settle();};
  await click('hold');assert.equal(h.ui.presenter.snapshot().holding,true);
  await click('cover');assert.equal(messages.at(-1).message.snapshot.kind,'cover');assert.doesNotMatch(JSON.stringify(messages.at(-1)),/Review request|PUBLIC EXPLANATION/);
  await click('cover');await click('hold');
  const preview=h.document.querySelector('.presenter-preview');preview.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:562.5});preview.setPointerCapture=()=>{};
  h.document.querySelector('[data-presenter="tool"][data-value="arrow"]').click();
  for(const [type,x,y]of [['pointerdown',100,100],['pointermove',300,200],['pointerup',300,200]])preview.dispatchEvent(new h.window.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0}));
  assert.equal(h.ui.presenter.snapshot().marks,1);assert.equal(messages.at(-1).message.marks[0].type,'arrow');
  await click('undo');assert.equal(h.ui.presenter.snapshot().marks,0);
  const f=h.document.getElementById('presenterBreakForm');f.elements.namedItem('message').value='Please give us a moment';f.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(messages.at(-1).message.snapshot.kind,'break');assert.equal(messages.at(-1).message.snapshot.seconds,300);
  await click('break-pause');assert.equal(messages.at(-1).message.snapshot.paused,true);await click('break-end');assert.equal(messages.at(-1).message.snapshot.kind,'process');
  assert.equal(h.writes.length,0);h.account.id='other-owner';h.render();assert.equal(popup.closed,true);assert.equal(h.document.getElementById('processPresenter'),null);assert.equal(h.ui.presenter.connected(),false);
});
test('Batch D: blocked pop-ups retain usable private controls and allow a retry',t=>{
  const h=hub(t);h.window.open=()=>null;h.ui.presenter.open();assert.ok(h.document.getElementById('processPresenter').open);assert.match(h.messages.join(' '),/pop-ups/);assert.equal(h.ui.presenter.connected(),false);
});
test('Batch D: legacy decisions preserve an end-route automatic default through store and reload',t=>{
  const h=hub(t,{processes:[oldProcess()]}),p=h.ui.model(),s=p.steps[0];
  s.type='decision';s.next='';s.alternatives=['s1'];s.decision={question:'Continue?',answers:[{label:'Finish now',next:''},{label:'Continue',next:'s1'}]};h.E.store(h.state(),p);h.E.validate(h.state());
  const restored=h.E.library(h.state())[0];assert.equal(restored.steps[0].next,'');assert.equal(h.E.plan(restored,restored.scenarios[0]).entries.length,1);
});
