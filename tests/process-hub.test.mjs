import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const source = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const copy = x => JSON.parse(JSON.stringify(x));
const settle = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };
function hub(t, initial = {}, rich = false) {
  const dom = new JSDOM('<body><main id="view"></main><dialog id="modal"><div id="modalBody"></div></dialog></body>', { url: 'http://preview.test/', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  window.requestAnimationFrame = () => 1; window.cancelAnimationFrame = () => {}; window.matchMedia = () => ({ matches: false }); window.confirm = () => true;
  window.URL.createObjectURL = () => 'blob:test-export'; window.URL.revokeObjectURL = () => {};
  window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  window.HTMLDialogElement.prototype.close = function () { this.open = false; };
  for (const f of ['rehearsal-engine.js', 'process-hub-files.js', ...(rich?['process-canvas-art.js','process-canvas.js']:[]), 'audience-view.js', 'presentation-screen.js', 'presenter.js', 'rehearsal.js']) window.eval(source(f));
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
test('Presentation feedback: live text and laser stay temporary, clear on scene change and leave saved processes untouched',async t=>{
 const h=hub(t);loadFlow(h,requestFlow(h));const {messages}=connectAudience(h),before=JSON.stringify(h.state());
 const host=h.document.querySelector('.presenter-preview');host.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:562.5});
 const field=h.document.querySelector('[name="annotationText"]');field.value='Please check this handoff <b>together</b>';
 h.document.querySelector('[data-presenter="tool"][data-value="text"]').click();host.dispatchEvent(new h.window.MouseEvent('pointerdown',{bubbles:true,button:0,clientX:200,clientY:300}));
 assert.equal(h.ui.presenter.snapshot().marks,1);assert.equal(messages.at(-1).message.marks[0].type,'text');assert.match(h.document.querySelector('.av-text-note').textContent,/<b>together<\/b>/);assert.equal(host.querySelector('b'),null);
 const frames=[];h.window.requestAnimationFrame=fn=>{frames.push(fn);return frames.length;};h.document.querySelector('[data-presenter="tool"][data-value="laser"]').click();host.dispatchEvent(new h.window.MouseEvent('pointermove',{bubbles:true,clientX:600,clientY:200}));for(const f of frames.splice(0))f(100);
 const packet=messages.findLast(x=>x.message.type==='workhub-audience-pointer'&&x.message.pointer);assert.deepEqual(packet.message.pointer,[.6,200/562.5]);assert.equal(h.ui.presenter.snapshot().marks,1);assert.equal(host.querySelector('.av-laser').hidden,false);
 host.dispatchEvent(new h.window.MouseEvent('pointerleave'));assert.equal(host.querySelector('.av-laser').hidden,true);
 h.document.querySelector('[data-presenter="next"]').click();await settle();assert.equal(h.ui.presenter.snapshot().marks,0);assert.equal(JSON.stringify(h.state()),before);assert.equal(h.writes.length,0);
});
test('Presentation feedback: selected Process Hub screen is passed to native fullscreen without saving records',async t=>{
 const h=hub(t),screen={label:'Shared display',availLeft:1440,availTop:0,availWidth:1920,availHeight:1080};h.window.getScreenDetails=async()=>({screens:[screen]});h.render();await h.click('screens');
 const select=h.document.getElementById('processPresentationScreen');select.value='0';select.dispatchEvent(new h.window.Event('change',{bubbles:true}));const calls=[];h.window.HTMLElement.prototype.requestFullscreen=function(options){calls.push({element:this,options});return Promise.resolve();};await h.click('present');
 assert.equal(calls.length,1);assert.equal(calls[0].options.screen,screen);assert.ok(calls[0].element.classList.contains('ph-fullscreen-stage'));assert.equal(h.writes.length,0);
});

function presenterPointer(h,target,type,x,y,id=41) {
  const e=new h.window.MouseEvent(type,{bubbles:true,cancelable:true,button:0,clientX:x,clientY:y});
  Object.defineProperty(e,'pointerId',{value:id});target.dispatchEvent(e);
}
test('Presenter canvas: placed arrows and text move, cancel, edit and delete without saving or losing shape',async t=>{
 const h=hub(t);loadFlow(h,requestFlow(h));const {messages}=connectAudience(h),before=JSON.stringify(h.state()),host=h.document.querySelector('.presenter-preview');
 host.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:562.5});
 const action=name=>h.document.querySelector('[data-presenter="'+name+'"]').click();
 h.document.querySelector('[data-value="arrow"]').click();
 presenterPointer(h,host,'pointerdown',100,100);presenterPointer(h,host,'pointermove',300,200);presenterPointer(h,host,'pointerup',300,200);
 assert.equal(host.dataset.tool,'select');assert.ok(host.querySelector('.av-selection'));
 presenterPointer(h,host,'pointerdown',200,150);presenterPointer(h,host,'pointermove',300,250);presenterPointer(h,host,'pointerup',300,250);
 let mark=messages.findLast(x=>x.message.type==='workhub-audience-state').message.marks[0];
 assert.ok(Math.abs(mark.points[0][0]-.2)<1e-8);assert.ok(Math.abs(mark.points[1][0]-.4)<1e-8);
 const moved=copy(mark);
 presenterPointer(h,host,'pointerdown',300,250);presenterPointer(h,host,'pointermove',400,300);presenterPointer(h,host,'pointercancel',400,300);
 mark=messages.findLast(x=>x.message.type==='workhub-audience-state').message.marks[0];assert.deepEqual(mark,moved);
 h.document.querySelector('[name="annotationText"]').value='Explain this clearly';
 h.document.querySelector('[data-value="text"]').click();presenterPointer(h,host,'pointerdown',500,300);
 presenterPointer(h,host,'pointerdown',550,330);presenterPointer(h,host,'pointermove',650,350);presenterPointer(h,host,'pointerup',650,350);
 assert.equal(h.ui.presenter.snapshot().selectedMark,1);
 h.document.querySelector('[name="annotationText"]').value='Updated explanation';action('update-text');await settle();assert.match(host.querySelector('.av-text-note').textContent,/Updated explanation/);
 host.dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(h.ui.presenter.snapshot().marks,2);
 host.dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true}));assert.equal(h.ui.presenter.snapshot().marks,1);
 assert.equal(JSON.stringify(h.state()),before);assert.equal(h.writes.length,0);
});
test('Presenter canvas: pan and zoom are shared, fit restores the whole diagram, and clicking an off-route node starts a paused walkthrough there',async t=>{
 const h=hub(t);loadFlow(h,requestFlow(h));const {messages}=connectAudience(h),before=JSON.stringify(h.state()),host=h.document.querySelector('.presenter-preview');
 host.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:562.5});
 host.querySelector('.av-graph').getBoundingClientRect=()=>({left:20,top:70,width:950,height:400});
 const graph=host.querySelector('.av-graph'),initial=graph.getAttribute('viewBox');
 presenterPointer(h,graph,'pointerdown',500,200);presenterPointer(h,host,'pointermove',600,250);presenterPointer(h,host,'pointerup',600,250);
 assert.notEqual(graph.getAttribute('viewBox'),initial);assert.ok(messages.findLast(x=>x.message.type==='workhub-audience-state').message.options.camera);
 h.document.querySelector('[data-presenter="zoom-in"]').click();await settle();assert.ok(h.ui.presenter.snapshot().camera.width<Number(initial.split(' ')[2]));
 h.document.querySelector('[data-presenter="fit"]').click();await settle();assert.equal(graph.getAttribute('viewBox'),initial);
 const node=host.querySelector('[data-node="no"]');assert.ok(node);assert.equal(node.getAttribute('role'),'button');
 presenterPointer(h,node,'pointerdown',450,240);presenterPointer(h,host,'pointerup',450,240);await settle();
 const payload=messages.findLast(x=>x.message.type==='workhub-audience-state').message;
 assert.equal(payload.snapshot.active,'no');assert.equal(payload.snapshot.playing,false);assert.equal(payload.snapshot.detail.title,h.ui.model().steps.find(s=>s.id==='no').title);
 assert.equal(JSON.stringify(h.state()),before);assert.equal(h.writes.length,0);
 h.document.querySelector('[data-presenter="expand"]').click();assert.equal(h.document.getElementById('processPresenter').dataset.expanded,'true');
});
test('Presenter fullscreen: a resized window or fulfilled request is not reported as true fullscreen; only verified audience status can confirm it',async t=>{
 const h=hub(t);loadFlow(h,requestFlow(h));
 let full=null,calls=0,url;const target=h.document.createElement('main'),doc={documentElement:target,get fullscreenElement(){return full;}};
 target.requestFullscreen=async options=>{calls++;assert.equal(options.navigationUI,'hide');};
 const sent=[],popup={closed:false,document:doc,focus(){},close(){this.closed=true;},postMessage:m=>sent.push(copy(m))};
 h.window.open=href=>{url=new URL(href);return popup;};h.ui.presenter.open();
 const receive=(type,fields={},source=popup)=>h.window.dispatchEvent(new h.window.MessageEvent('message',{origin:h.window.location.origin,source,data:{type,token:url.hash.slice(1),...fields}}));
 receive('workhub-audience-ready');await settle();assert.equal(calls,1);assert.equal(h.ui.presenter.snapshot().audienceFull,false);assert.ok(sent.some(m=>m.type==='workhub-audience-fullscreen-needed'));
 receive('workhub-audience-fullscreen',{fullscreen:true},{});assert.equal(h.ui.presenter.snapshot().audienceFull,false);
 full=target;receive('workhub-audience-fullscreen',{fullscreen:true});assert.equal(h.ui.presenter.snapshot().audienceFull,true);
 h.document.querySelector('[data-presenter="fullscreen"]').click();await settle();assert.equal(calls,1);
 full=null;receive('workhub-audience-fullscreen',{fullscreen:false});assert.match(h.document.querySelector('[data-presenter-display-status]').textContent,/windowed/);
 assert.equal(h.writes.length,0);
});

async function richPresenter(t, fullscreenAccepted = true) {
 const h=hub(t,{},true);loadFlow(h,requestFlow(h));
 const dom=new JSDOM('<body><main id="audienceStage"></main></body>',{url:'http://preview.test/audience.html',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window, audience=w.document;w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 for(const f of ['process-canvas-art.js','audience-view.js'])w.eval(source(f));
 const view=w.WorkHubAudienceView.create(audience.getElementById('audienceStage'));
 let full=null,url;const order=[],messages=[];
 Object.defineProperty(h.document,'fullscreenElement',{configurable:true,get:()=>null});
 Object.defineProperty(audience,'fullscreenElement',{configurable:true,get:()=>full});
 audience.documentElement.requestFullscreen=async function(options){order.push('fullscreen');assert.equal(options.navigationUI,'hide');if(!fullscreenAccepted)throw Error('not granted');full=this;};
 h.window.HTMLElement.prototype.requestFullscreen=()=>{throw Error('The private main browser must not enter fullscreen');};
 const popup={closed:false,document:audience,focus(){},close(){this.closed=true;full=null;},postMessage(m){messages.push(copy(m));if(m.type==='workhub-audience-state')view.update(m.snapshot,m.marks,m.options);if(m.type==='workhub-audience-pointer')view.pointer(m.pointer);}};
 h.window.open=href=>{order.push('window');url=new URL(href);assert.equal(url.pathname,'/audience.html');return popup;};
 h.ui.presenter.open();await settle();
 h.window.dispatchEvent(new h.window.MessageEvent('message',{origin:h.window.location.origin,source:popup,data:{type:'workhub-audience-ready',token:url.hash.slice(1)}}));await settle();
 const d=h.document,panel=d.getElementById('processPresenter'),host=d.querySelector('.presenter-preview');
 const geometry=()=>{host.getBoundingClientRect=()=>({left:0,top:0,width:850,height:450,right:850,bottom:450});const svg=host.querySelector('.av-graph'),box=svg.getAttribute('viewBox').split(' ').map(Number);svg.getBoundingClientRect=()=>({left:0,top:0,width:box[2],height:box[3],right:box[2],bottom:box[3]});};
 geometry();
 return {...h,d,panel,host,popup,audience,order,messages,geometry,action(name){panel.querySelector('[data-pc="'+name+'"]').click();},tool(name){panel.querySelector('[data-presenter="tool"][data-value="'+name+'"]').click();}};
}
test('Canvas studio: Presenter controls stays in the main browser and only the separate audience enters fullscreen',async t=>{
 const h=await richPresenter(t);
 assert.deepEqual(h.order,['window','fullscreen']);assert.equal(h.document.fullscreenElement,null);assert.equal(h.audience.fullscreenElement,h.audience.documentElement);assert.equal(h.panel.ownerDocument,h.document);
 assert.equal(h.audience.querySelectorAll('button,input,select').length,0);
 assert.doesNotMatch(h.audience.querySelector('#audienceStage').textContent,/PRIVATE SPEAKER NOTES|PRIVATE CONFIG/);
 assert.match(h.panel.textContent,/PRIVATE SPEAKER NOTES/);
 assert.ok([...h.panel.querySelectorAll('button')].every(b=>b.closest('.pc-stage')));
 assert.ok(h.panel.querySelector('.pc-stage .pc-bubbles'));assert.equal(h.panel.querySelector('[data-presenter-retry]').hidden,true);assert.equal(h.panel.querySelector('[data-presenter="fullscreen"]'),null);
 h.panel.querySelector('[data-presenter="end"]').click();await settle();assert.equal(h.document.getElementById('processAudienceOverlay'),null);assert.equal(h.popup.closed,true);
});
test('Canvas studio: notes persist in graph coordinates, attach to steps and resize text and box dimensions in one saved edit',async t=>{
 const h=await richPresenter(t);h.panel.querySelector('[name="annotationText"]').value='Attached explanation';h.tool('text');
 const step=h.host.querySelector('[data-node="ask"]'),before=h.ui.model().steps.find(s=>s.id==='ask');
 presenterPointer(h,step,'pointerdown',before.x+50,before.y+50);
 assert.equal(h.writes.length,1);
 let p=h.ui.model(),note=p.annotations[0];assert.equal(note.anchorId,'ask');assert.equal(note.text,'Attached explanation');
 assert.ok(h.host.querySelector('.pc-annotation'));assert.equal(h.audience.querySelectorAll('.pc-handle').length,0);
 h.geometry();const handle=h.host.querySelector('[data-pc-resize="se"]'),start={w:note.w,h:note.h,font:note.fontSize};
 presenterPointer(h,handle,'pointerdown',400,300);presenterPointer(h,h.host,'pointermove',500,400);presenterPointer(h,h.host,'pointerup',500,400);
 note=h.ui.model().annotations[0];assert.ok(note.w>start.w);assert.ok(note.h>start.h);assert.ok(note.fontSize>start.font);assert.equal(h.writes.length,2);
 h.tool('move');h.host.dispatchEvent(new h.window.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));assert.equal(h.ui.model().annotations[0].x,note.x);
 const saved=copy(h.state()),again=hub(t,saved.workhub,true);assert.equal(again.ui.model().annotations[0].text,'Attached explanation');
});
test('Canvas studio: new material steps maintain codes and valuation fields, magnetic parents persist and ports connect without changing existing routes',async t=>{
 const h=await richPresenter(t);const type=h.panel.querySelector('[data-pc-type="material"]');
 const parent=h.ui.model().steps.find(s=>s.id==='ask'),view=h.host.querySelector('.av-graph').getAttribute('viewBox').split(' ').map(Number);
 presenterPointer(h,type,'pointerdown',20,20);presenterPointer(h,h.host,'pointerup',parent.x-view[0]+60,parent.y-view[1]+60);
 let f=h.panel.querySelector('[data-pc-form="step"]');assert.ok(f);
 f.elements.title.value='Material master';f.elements.namedItem('entity-materialCode').value='MAT-001';f.elements.namedItem('entity-materialType').value='ROH';f.elements.namedItem('entity-valuationClass').value='3000';f.elements.namedItem('entity-batch').value='BATCH-A';
 f.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));
 let p=h.ui.model(),material=p.steps.find(s=>s.title==='Material master');assert.ok(material);assert.equal(material.entity.valuationClass,'3000');assert.equal(material.stackParent,'ask');assert.equal(h.writes.length,1);
 h.geometry();const from=h.host.querySelector('[data-pc-port="out"][data-pc-step="ask"]'),to=h.host.querySelector('[data-pc-port="in"][data-pc-step="'+material.id+'"]');
 h.d.elementFromPoint=()=>to;presenterPointer(h,from,'pointerdown',100,100);presenterPointer(h,h.host,'pointerup',300,200);
 p=h.ui.model();assert.ok(h.E.connections(p.steps.find(s=>s.id==='ask')).includes(material.id));assert.equal(p.steps.find(s=>s.id==='ask').next,'yes');assert.equal(h.writes.length,2);
 h.action('links');f=h.panel.querySelector('[data-pc-form="links"]');assert.ok(f);f.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(h.writes.length,3);
});
test('Canvas studio: stale editors and owner changes cannot overwrite a process or keep an audience alive',async t=>{
 const h=await richPresenter(t);h.tool('select');const card=h.host.querySelector('[data-node="ask"]');presenterPointer(h,card,'pointerdown',50,50);presenterPointer(h,h.host,'pointercancel',50,50);
 h.action('edit-step');const form=h.panel.querySelector('[data-pc-form="step"]');assert.ok(form);
 h.change(d=>{d.workhub.rehearsal.processes[0].notes='Changed elsewhere';});form.elements.title.value='Stale title';form.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));
 assert.match(form.querySelector('[role="alert"]').textContent,/changed/);assert.equal(h.writes.length,0);
 h.account.id='another';h.render();assert.equal(h.popup.closed,true);assert.equal(h.document.getElementById('processAudienceOverlay'),null);
 form.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(h.writes.length,0);
});
test('Canvas studio: rejected native fullscreen retains a button-free audience and reports the verified windowed state',async t=>{
 const h=await richPresenter(t,false);assert.equal(h.document.fullscreenElement,null);
 assert.ok(h.audience.querySelector('#audienceStage'));assert.equal(h.audience.querySelectorAll('button').length,0);
 assert.equal(h.ui.presenter.snapshot().audienceFull,false);assert.match(h.panel.querySelector('[data-presenter-display-status]').textContent,/click anywhere/);
 h.panel.querySelector('[data-presenter="end"]').click();assert.equal(h.document.querySelector('#processAudienceStage'),null);
});
test('Canvas studio: blocked private pop-up returns usable private controls with no orphan audience or false audience title',async t=>{
 const h=hub(t,{},true);loadFlow(h,requestFlow(h));const title=h.document.title;h.window.open=()=>null;
 h.ui.presenter.open();await settle();
 assert.equal(h.document.getElementById('processAudienceOverlay'),null);assert.equal(h.document.title,title);
 assert.ok(h.document.getElementById('processPresenter'));assert.match(h.document.querySelector('[data-pc-notice]').textContent,/pop-ups/);
 assert.equal(h.document.querySelector('[data-presenter-retry]').hidden,false);
 h.document.querySelector('[data-presenter="end"]').click();assert.equal(h.document.querySelector('#processPresenter'),null);
});
test('Canvas studio: arrows persist and resize, attachments retain world position, camera moves do not change saved geometry and the audience laser stays transient',async t=>{
 const h=await richPresenter(t),before=h.ui.model();h.tool('arrow');
 presenterPointer(h,h.host,'pointerdown',160,150);presenterPointer(h,h.host,'pointermove',290,210);presenterPointer(h,h.host,'pointerup',290,210);
 let p=h.ui.model(),arrow=p.annotations[0];assert.equal(arrow.type,'arrow');assert.ok(h.audience.querySelector('.pc-arrow'));
 h.geometry();const endpoint=h.host.querySelector('[data-pc-resize="end"]');assert.ok(endpoint);
 presenterPointer(h,endpoint,'pointerdown',290,210);presenterPointer(h,h.host,'pointermove',340,260);presenterPointer(h,h.host,'pointerup',340,260);
 arrow=h.ui.model().annotations[0];assert.deepEqual(copy(arrow.points.at(-1)),[180,110]);
 const Art=h.window.WorkHubProcessCanvasArt,world=copy(Art.box(arrow,h.ui.model().steps));
 h.action('attach');let form=h.panel.querySelector('[data-pc-form="attach"]');form.elements.anchorId.value='yes';form.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));
 p=h.ui.model();assert.equal(p.annotations[0].anchorId,'yes');assert.deepEqual(copy(Art.box(p.annotations[0],p.steps)),world);
 const saved=JSON.stringify(p),writes=h.writes.length;h.tool('move');h.panel.querySelector('[data-presenter="zoom-in"]').click();assert.equal(JSON.stringify(h.ui.model()),saved);assert.equal(h.writes.length,writes);
 h.window.requestAnimationFrame=fn=>{fn(1);return 1;};h.tool('laser');presenterPointer(h,h.host,'pointermove',200,100);
 const dot=h.audience.querySelector('.av-laser');assert.ok(dot&&!dot.hidden);assert.equal(h.writes.length,writes);
 h.tool('move');assert.equal(dot.hidden,true);assert.equal(before.annotations.length,0);
});
test('Canvas studio: named decisions edit inside the canvas and moving a magnetic parent carries its children',async t=>{
 const h=await richPresenter(t);h.tool('select');let card=h.host.querySelector('[data-node="ask"]');
 presenterPointer(h,card,'pointerdown',80,80);presenterPointer(h,h.host,'pointercancel',80,80);h.action('edit-step');
 let f=h.panel.querySelector('[data-pc-form="step"]');f.elements.decisionQuestion.value='Can we continue?';f.elements.defaultAnswer.value='1';f.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(h.ui.model().steps.find(s=>s.id==='ask').next,'no');assert.equal(h.ui.model().steps.find(s=>s.id==='ask').decision.question,'Can we continue?');
 h.geometry();const base=h.ui.model().steps.find(s=>s.id==='ask'),camera=h.host.querySelector('.av-graph').getAttribute('viewBox').split(' ').map(Number),type=h.panel.querySelector('[data-pc-type="plant"]');
 presenterPointer(h,type,'pointerdown',20,20);presenterPointer(h,h.host,'pointerup',base.x-camera[0]+50,base.y-camera[1]+50);
 f=h.panel.querySelector('[data-pc-form="step"]');f.elements.title.value='Magnetic plant';f.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));
 let p=h.ui.model(),child=p.steps.find(s=>s.title==='Magnetic plant');assert.equal(child.stackParent,'ask');const x=child.x,y=child.y;
 h.geometry();h.tool('select');card=h.host.querySelector('[data-node="ask"]');
 presenterPointer(h,card,'pointerdown',80,80);presenterPointer(h,h.host,'pointermove',110,110);presenterPointer(h,h.host,'pointerup',110,110);
 p=h.ui.model();child=p.steps.find(s=>s.id===child.id);assert.equal(child.x,x+30);assert.equal(child.y,y+30);
});
test('Canvas studio: idle presenter updates reuse the cached process instead of copying its private fields and screenshots',async t=>{
 const h=await richPresenter(t),original=h.E.copy;let copies=0;
 h.E.copy=(...args)=>{if(args[0]?.steps && args[0]?.presenterNotes!==undefined)copies++;return original(...args);};
 for(let i=0;i<20;i++)h.ui.presenter.publish(true);
 assert.equal(copies,0);assert.equal(h.writes.length,0);
});

test('Display recovery: selected monitor coordinates position only the audience even when native fullscreen is refused',async t=>{
 const h=hub(t,{},true);loadFlow(h,requestFlow(h));
 const target={label:'Shared monitor',availLeft:-2560,availTop:120,availWidth:2560,availHeight:1440},moves=[],sizes=[];
 h.window.getScreenDetails=async()=>({screens:[target]});h.render();await h.click('screens');
 const select=h.document.querySelector('#processPresentationScreen');select.value='0';select.dispatchEvent(new h.window.Event('change',{bubbles:true}));
 const child=new JSDOM('<main></main>',{url:'http://preview.test/audience.html'});t.after(()=>child.window.close());let href,features,calls=0;
 child.window.document.documentElement.requestFullscreen=async options=>{calls++;assert.equal(options.screen,target);throw Error('needs audience click');};
 h.window.HTMLElement.prototype.requestFullscreen=()=>{throw Error('Main browser must remain private');};
 const popup={closed:false,document:child.window.document,moveTo:(...x)=>moves.push(x),resizeTo:(...x)=>sizes.push(x),focus(){},close(){this.closed=true;},postMessage(){}};
 h.window.open=(url,name,opts)=>{href=new URL(url);features=opts;return popup;};
 h.ui.presenter.open();assert.match(features,/left=-2560,top=120,width=2560,height=1440/);
 h.window.dispatchEvent(new h.window.MessageEvent('message',{origin:h.window.location.origin,source:popup,data:{type:'workhub-audience-ready',token:href.hash.slice(1)}}));await settle();
 assert.ok(moves.some(x=>x[0]===-2560&&x[1]===120));assert.ok(sizes.some(x=>x[0]===2560&&x[1]===1440));assert.equal(calls,1);
 assert.equal(h.document.getElementById('processAudienceOverlay'),null);assert.equal(h.document.getElementById('processPresenter').ownerDocument,h.document);
 assert.equal(h.ui.presenter.snapshot().audienceFull,false);assert.equal(h.writes.length,0);
});

function installBreaks(h) {
 const audio={state:{music:true,playing:false,starting:false,paused:false,track:'garden',volume:45,error:''},snapshot(){return this.state;},start(){this.state.playing=true;return Promise.resolve();},stop(){this.state.playing=false;},pause(){},finish(){},tick(){}};
 h.window.WorkHubRestAudio={TRACKS:{garden:{name:'Garden',detail:'Rest'}},install:()=>audio};
 for(const f of ['rest-room.js','presentation-break.js'])h.window.eval(source(f));
 const ctx={ready:()=>h.account.ready,owner:()=>h.account.id,tell(){}};
 const room=h.window.WorkHubRestRoom.install({...ctx,motion:()=>true,pauseWork:()=>null,focus:()=>({active:false}),soundscape:()=>null,change(){}});
 const pb=h.window.WorkHubPresentationBreak.install(ctx),button=h.document.createElement('button');button.dataset.pb='open';h.document.body.append(button);
 let native=null;Object.defineProperty(h.document,'fullscreenElement',{configurable:true,get:()=>native});
 h.document.exitFullscreen=async()=>{native=null;};
 const targets=[];h.window.HTMLElement.prototype.requestFullscreen=async function(options){native=this;targets.push(this);assert.equal(options.navigationUI,'hide');};
 return {room,pb,button,targets,get native(){return native;}};
}
test('Display recovery: starting either break closes presenter controls and its audience, leaving fullscreen in the main document',async t=>{
 for(const kind of ['rest','presentation']){
  const h=await richPresenter(t),b=installBreaks(h);
  if(kind==='rest')b.room.start('Rest',60);
  else {b.button.click();const f=h.document.querySelector('#presentationBreakSettings form');f.elements.message.value='Back shortly';f.dispatchEvent(new h.window.Event('submit',{bubbles:true,cancelable:true}));}
  await settle();assert.equal(h.popup.closed,true);assert.equal(h.document.getElementById('processPresenter'),null);assert.equal(h.document.body.classList.contains('pc-presenting'),false);
  assert.equal(b.targets.length,1);assert.equal(b.native.ownerDocument,h.document);assert.equal(b.native.matches(kind==='rest'?'.rest-room-shell':'.pb-stage'),true);
  assert.equal(h.writes.length,0);assert.equal(h.document.querySelectorAll('#processAudienceOverlay').length,0);
 }
});
test('Display recovery: an active terrarium cannot be replaced by a presenter or presentation break before Resume work',async t=>{
 const h=await richPresenter(t),b=installBreaks(h);b.room.start('Rest',60);await settle();
 h.ui.presenter.open();assert.equal(h.document.getElementById('processPresenter'),null);b.button.click();assert.equal(h.document.getElementById('presentationBreakSettings'),null);
 assert.ok(h.document.getElementById('restRoom'));assert.equal(b.room.snapshot().complete,false);
 b.room.finish(false);h.ui.presenter.open();assert.equal(h.document.getElementById('processPresenter'),null);
 b.room.resume();assert.equal(h.document.getElementById('restRoom'),null);b.button.click();assert.ok(h.document.getElementById('presentationBreakSettings'));
 assert.equal(h.writes.length,0);
});
