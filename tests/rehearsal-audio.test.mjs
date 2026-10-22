import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

function rehearsal(t, { motion = 'calm', reduced = false, pending = false, supported = true, fail = false } = {}) {
  const dom = new JSDOM('<body><main id="host"></main></body>', {
    url: 'https://losthaidid.github.io/mm-tracker/', runScripts: 'outside-only', pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  window.matchMedia = () => ({ matches: reduced });
  const audio = { contexts: [], starts: [], peaks: [], pending, fail };
  class AudioMock {
    constructor() { this.state = 'suspended'; this.currentTime = 0; this.destination = {}; audio.contexts.push(this); }
    resume() {
      if (audio.fail) return Promise.reject(Error('Audio blocked'));
      if (audio.pending) return new Promise(resolve => { this.finish = () => { this.state = 'running'; this.onstatechange?.(); resolve(); }; });
      this.state = 'running'; this.onstatechange?.(); return Promise.resolve();
    }
    suspend() { this.state = 'suspended'; this.onstatechange?.(); return Promise.resolve(); }
    close() { this.state = 'closed'; this.onstatechange?.(); return Promise.resolve(); }
    createOscillator() {
      const note = { frequency: { setValueAtTime(value) { note.pitch = value; } }, connect() {}, disconnect() {},
        start() { audio.starts.push(note); }, stop(at) { if (at === undefined) note.cancelled = true; } };
      return note;
    }
    createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime(peak) { audio.peaks.push(peak); }, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }; }
  }
  if (supported) window.AudioContext = AudioMock;
  window.eval(source('rehearsal-engine.js'));
  const state = { workhub: { tcodes: { records: [] } } };
  window.WorkHubRehearsalEngine.upgrade(state);
  const account = { id: 'owner', ready: true }, writes = [], messages = [];
  let ui;
  const render = () => { document.getElementById('host').innerHTML = ui.render(); ui.mount(); };
  window.eval(source('rehearsal.js'));
  ui = window.WorkHubRehearsal.install({
    state: () => state, ready: () => account.ready, owner: () => account.id, prefs: () => ({ motion }),
    mutate(fn) { fn(state); window.WorkHubRehearsalEngine.validate(state); writes.push(JSON.stringify(state)); render(); return true; },
    render, tell: message => messages.push(message), closeModal() {}, openModal() {},
  });
  render();
  const click = async action => { document.querySelector('[data-rehearsal="' + action + '"]').click(); await settle(); };
  return { window, document, state, ui, audio, account, writes, click, render, messages };
}

test('rehearsal sound: the first sound-button click unlocks a preview without muting the saved preference', async t => {
  const { document, state, ui, audio, writes, click, window } = rehearsal(t);
  assert.equal(audio.contexts.length, 0);
  assert.equal(document.getElementById('rehearsalSound').textContent, 'Enable sound');
  // A real mouse/touch click has a pointerdown first; it must not silently flip the intended action.
  document.getElementById('rehearsalSound').dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
  await click('sound');
  assert.equal(state.workhub.rehearsal.preferences.sound, true);
  assert.equal(writes.length, 0);
  assert.equal(ui.snapshot().sound, true);
  assert.ok(audio.starts.length > 0);
  assert.ok(audio.peaks.every(v => v > 0 && v <= .12));
  assert.equal(document.getElementById('rehearsalSound').textContent, 'Mute sound');
  assert.equal(document.getElementById('rehearsalSound').getAttribute('aria-pressed'), 'true');
  await click('sound');
  const muted = audio.starts.length;
  assert.equal(state.workhub.rehearsal.preferences.sound, false);
  assert.equal(ui.snapshot().sound, false);
  assert.ok(audio.starts.every(note => note.cancelled));
  await click('next');
  assert.equal(audio.starts.length, muted);
  await click('sound');
  assert.equal(state.workhub.rehearsal.preferences.sound, true);
  assert.ok(audio.starts.length > muted);
});

test('rehearsal sound: manual steps remain audible with reduced motion or animations off', async t => {
  for (const options of [{ reduced: true }, { motion: 'off' }]) {
    const { ui, audio, click, writes } = rehearsal(t, options);
    await click('sound');
    const before = audio.starts.length;
    await click('next');
    assert.equal(ui.snapshot().paused, true);
    assert.equal(ui.snapshot().index, 1);
    assert.ok(audio.starts.length > before);
    const at = ui.snapshot().index;
    for (let n = 1; n <= 60; n++) ui.tick(n * 150);
    assert.equal(ui.snapshot().index, at);
    await click('back');
    assert.equal(ui.snapshot().index, 0);
    assert.equal(writes.length, 0);
  }
});

test('rehearsal sound: a pending resume never stalls playback and mute cancels its eventual cue', async t => {
  const { ui, audio, state, document, click } = rehearsal(t, { pending: true });
  await click('sound');
  assert.equal(ui.snapshot().audioPending, true);
  await click('next');
  assert.equal(ui.snapshot().index, 1);
  assert.equal(ui.snapshot().paused, true);
  await click('sound');
  assert.equal(state.workhub.rehearsal.preferences.sound, false);
  audio.contexts[0].finish();
  await settle();
  assert.equal(audio.starts.length, 0);
  assert.equal(ui.snapshot().sound, false);
  assert.equal(document.getElementById('rehearsalSound').textContent, 'Enable sound');
});

test('rehearsal sound: zero volume, unavailable audio and rejected starts explain silence and can retry', async t => {
  const ctx = rehearsal(t), { state, document, audio, click, window } = ctx;
  state.workhub.rehearsal.preferences.volume = 0;
  ctx.render();
  await click('sound');
  assert.equal(audio.starts.length, 0);
  assert.match(document.getElementById('rehearsalAudioStatus').textContent, /Volume is zero/);
  const slider = document.getElementById('rehearsalVolume');
  slider.value = '.5'; slider.dispatchEvent(new window.Event('change', { bubbles: true })); await settle();
  assert.ok(audio.starts.length > 0);
  assert.ok(audio.peaks.every(v => v === .06));
  const unsupported = rehearsal(t, { supported: false });
  await unsupported.click('sound');
  assert.match(unsupported.document.getElementById('rehearsalAudioStatus').textContent, /unavailable/);
  assert.equal(unsupported.ui.snapshot().sound, false);
  const rejected = rehearsal(t, { fail: true });
  await rejected.click('sound');
  assert.match(rejected.document.getElementById('rehearsalAudioStatus').textContent, /could not start/);
  rejected.audio.fail = false;
  await rejected.click('sound');
  assert.ok(rejected.audio.starts.length > 0);
  assert.equal(rejected.ui.snapshot().audioError, '');
});

test('rehearsal sound: hiding, leaving and account changes stop sound and reject pending old-account cues', async t => {
  for (const mode of ['hidden', 'leave', 'account']) {
    const { window, document, ui, audio, account, click } = rehearsal(t, { pending: true });
    await click('sound');
    if (mode === 'hidden') {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new window.Event('visibilitychange'));
    } else if (mode === 'leave') {
      document.getElementById('host').replaceChildren(); ui.mount();
    } else {
      account.id = 'another-owner'; ui.mount();
    }
    audio.contexts[0].finish(); await settle();
    assert.equal(audio.starts.length, 0);
    assert.equal(ui.snapshot().sound, false);
  }
});

test('rehearsal sound: automatic steps play after activation and interrupted audio can resume', async t => {
  const { document, window, audio, ui, click, writes } = rehearsal(t);
  await click('sound');
  const before = audio.starts.length;
  for (let n = 1; n <= 60; n++) ui.tick(n * 150);
  assert.ok(audio.starts.length > before);
  await click('next');
  const beforeRewind = audio.starts.length;
  await click('back');
  for (let n = 61; n <= 75; n++) ui.tick(n * 150);
  await settle();
  assert.ok(audio.starts.length > beforeRewind);
  const context = audio.contexts[0];
  context.state = 'interrupted'; context.onstatechange();
  assert.equal(ui.snapshot().sound, false);
  assert.equal(document.getElementById('rehearsalSound').textContent, 'Enable sound');
  await click('sound');
  assert.equal(ui.snapshot().sound, true);
  Object.defineProperty(document, 'hidden', { configurable: true, value: true });
  document.dispatchEvent(new window.Event('visibilitychange'));
  assert.equal(context.state, 'suspended');
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  document.dispatchEvent(new window.Event('visibilitychange')); await settle();
  assert.equal(ui.snapshot().sound, true);
  assert.equal(writes.length, 0);
});
