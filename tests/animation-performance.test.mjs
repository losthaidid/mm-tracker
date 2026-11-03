import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const source = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function fixture(t, { hardware = 8, memory = 8, iphone = false } = {}) {
  const dom = new JSDOM('<body data-motion="playful"><nav id="tabs"><button>Navigate</button></nav><main id="view"><section>' + Array.from({ length: 24 }, (_, n) => '<article class="hub-card"><label>Value<input value="Keep 001 and 6.00007"></label><button draggable="true">Move ' + n + '</button></article>').join('') + '</section></main><div class="hub-header-brand"><h1 id="hubSiteTitle"><span class="brand-title-letters"><span>W</span></span></h1></div><div class="rest-room" data-phase="complete" data-motion="flow"><div class="rest-moon"></div><div class="rest-globe"></div><div class="rest-fern"></div><button data-rest="resume">Resume work</button></div></body>', { url: 'https://example.test', runScripts: 'outside-only', pretendToBeVisual: true });
  t.after(() => dom.window.close()); const w = dom.window, d = w.document;
  Object.defineProperties(w.navigator, { userAgent: { value: iphone ? 'iPhone' : 'Desktop', configurable: true }, platform: { value: iphone ? 'iPhone' : 'Win32', configurable: true }, hardwareConcurrency: { value: hardware, configurable: true }, deviceMemory: { value: memory, configurable: true } });
  let clock = 0, id = 0, hidden = false; const frames = new Map(), timers = new Map(), delays = [], observers = [], media = { matches: false, addEventListener() {} };
  Object.defineProperty(d, 'hidden', { get: () => hidden, configurable: true }); Object.defineProperty(w.performance, 'now', { value: () => clock }); w.matchMedia = () => media;
  w.setTimeout = (fn, ms) => { const next = ++id; timers.set(next, { fn, ms }); delays.push(ms); return next; }; w.clearTimeout = n => timers.delete(n); w.requestAnimationFrame = fn => { const next = ++id; frames.set(next, fn); return next; }; w.cancelAnimationFrame = n => frames.delete(n);
  w.IntersectionObserver = class { constructor(fn) { this.fn = fn; this.targets = new Set(); observers.push(this); } observe(el) { this.targets.add(el); } unobserve(el) { this.targets.delete(el); } disconnect() { this.targets.clear(); } };
  w.eval(source('render-profile.js')); w.eval(source('dramatic-motion.js'));
  return { w, d, frames, timers, delays, observers, media, level: () => d.documentElement.dataset.effectLevel, visible() { observers[0].fn([...observers[0].targets].map(target => ({ target, isIntersecting: true }))); }, hide(value) { hidden = value; d.dispatchEvent(new w.Event('visibilitychange')); }, time(delta) { clock += delta; }, step(delta = 16.67) { clock += delta; const pending = [...frames.values()]; frames.clear(); for (const fn of pending) fn(clock); }, startSample() { w.dispatchEvent(new w.Event('pointerdown')); const entry = [...timers].find(([, job]) => job.ms === 250); assert.ok(entry, 'a single deferred sample is scheduled'); timers.delete(entry[0]); entry[1].fn(); } };
}

test('Automatic caps visible glints and burst cleanup, without changing fields, focus or navigation handlers', async t => {
  const x = fixture(t); await settle(); x.visible(); const { w, d } = x, field = d.querySelector('input'); field.focus(); field.setSelectionRange(5, 8); let clicks = 0; d.querySelector('nav button').addEventListener('click', () => clicks++);
  assert.equal(x.level(), 'balanced'); assert.equal(d.querySelectorAll('.fx-dust').length, 14); assert.equal(d.querySelectorAll('.fx-visible').length, 6);
  for (let i = 0; i < 100; i++) d.querySelector('nav button').click(); assert.equal(clicks, 100); assert.ok(d.querySelector('.fx-reactions').childElementCount <= 36); assert.equal(d.querySelector('.fx-scene-sweep'), null); assert.equal(x.delays.filter(ms => ms === 2200).length, 1, 'all particles share one expiry timer');
  const before = d.querySelector('.hub-card'), controls = before.innerHTML; w.WorkHubRenderProfile.setMode('smooth'); await settle(); assert.equal(d.querySelectorAll('.fx-panel-aura').length, 0); assert.equal(d.querySelectorAll('.fx-visible').length, 0); assert.equal(d.querySelector('.fx-reactions').childElementCount, 0); assert.equal(d.activeElement, field); assert.equal(field.value, 'Keep 001 and 6.00007'); assert.equal(field.selectionStart, 5);
  w.WorkHubRenderProfile.setMode('full'); await settle(); assert.equal(d.querySelectorAll('.fx-dust').length, 32); assert.equal(d.querySelectorAll('.fx-visible').length, 24); assert.equal(before.innerHTML, controls); assert.equal(d.querySelector('input'), field); assert.equal(d.querySelectorAll('[draggable="true"]').length, 24); assert.equal(x.observers.length, 1);
  w.WorkHubRenderProfile.setMode('auto'); assert.equal(d.querySelectorAll('.fx-dust').length, 14); assert.equal(d.querySelectorAll('.fx-visible').length, 6); assert.equal(w.localStorage.length, 0);
});

test('mode changes rebuild only decorative nodes and newly opened cards follow the current budget', async t => {
  const x = fixture(t); await settle(); x.visible(); const { w, d } = x; const old = d.querySelectorAll('.fx-sky i')[0]; w.WorkHubRenderProfile.setMode('smooth'); assert.equal(old.isConnected, false); assert.equal(d.querySelectorAll('.fx-dust').length, 8); assert.equal(d.querySelectorAll('.fx-orbit,.fx-comet').length, 0);
  const modal = d.createElement('dialog'); modal.innerHTML = '<article class="hub-card"><input value="New draft"></article>'; d.body.append(modal); await settle(); assert.equal(modal.querySelector('.fx-panel-aura'), null); const input = modal.querySelector('input'); w.WorkHubRenderProfile.setMode('full'); await settle(); assert.equal(modal.querySelectorAll('.fx-panel-aura').length, 1); assert.equal(modal.querySelector('input'), input); assert.equal(input.value, 'New draft'); modal.remove(); await settle(); assert.ok([...x.observers[0].targets].every(el => el.isConnected));
});

test('two sustained poor frame windows select Smooth locally; explicit Full always takes effect', async t => {
  const x = fixture(t); await settle(); x.startSample(); x.step(); for (let i = 0; i < 32; i++) x.step(40); assert.equal(x.level(), 'balanced'); for (let i = 0; i < 32; i++) x.step(40);
  assert.equal(x.level(), 'smooth'); assert.equal(x.d.documentElement.dataset.renderReason, 'frame-time'); assert.equal(x.frames.size, 0); assert.equal(x.d.querySelectorAll('.fx-dust').length, 8); assert.equal(x.w.localStorage.length, 0);
  x.w.WorkHubRenderProfile.setMode('full'); assert.equal(x.level(), 'full'); assert.equal(x.d.querySelectorAll('.fx-dust').length, 32); assert.equal(x.timers.size, 0); x.w.WorkHubRenderProfile.setMode('auto'); assert.equal(x.level(), 'balanced'); assert.equal([...x.timers.values()].filter(t => t.ms === 250).length, 1);
});

test('healthy frames, isolated long tasks and interrupted samples never force a quality downgrade or permanent sampling loop', async t => {
  const x = fixture(t); await settle(); x.startSample(); x.step(); for (let i = 0; i < 32; i++) x.step(); assert.equal(x.level(), 'balanced'); assert.equal(x.frames.size, 0);
  x.time(21000); x.startSample(); x.step(); for (let i = 0; i < 32; i++) x.step(40); for (let i = 0; i < 32; i++) x.step(); assert.equal(x.level(), 'balanced'); assert.equal(x.frames.size, 0);
  x.time(21000); x.startSample(); x.step(); x.step(800); for (let i = 0; i < 31; i++) x.step(); assert.equal(x.level(), 'balanced'); assert.equal(x.frames.size, 0); assert.equal(x.timers.size, 0);
  for (let i = 0; i < 50; i++) x.w.dispatchEvent(new x.w.Event('pointerdown')); assert.equal(x.timers.size, 0, 'sampling is rate limited after a completed or interrupted sample');
});

test('hidden pages and motion-off stop only the sampler and decoration, leaving timer and audio APIs untouched', async t => {
  const x = fixture(t); await settle(); const interval = x.w.setInterval, audio = x.w.Audio, timeout = x.w.setTimeout; x.startSample(); x.step(); x.hide(true); assert.equal(x.frames.size, 0); assert.equal(x.timers.size, 0); assert.equal(x.d.getElementById('hubSpectacle').hidden, true); assert.equal(x.w.setInterval, interval); assert.equal(x.w.setTimeout, timeout); assert.equal(x.w.Audio, audio);
  x.hide(false); x.time(21000); x.d.body.dataset.motion = 'off'; x.w.dispatchEvent(new x.w.Event('pointerdown')); assert.equal(x.timers.size, 0); x.d.body.dataset.motion = 'playful'; x.w.dispatchEvent(new x.w.Event('pointerdown')); assert.equal(x.timers.size, 1); x.w.WorkHubRenderProfile.setMode('smooth'); assert.equal(x.timers.size, 0); assert.equal(x.frames.size, 0);
});

test('Smooth and Automatic respect small devices, display hysteresis and the existing iPhone safety budget', async t => {
  const low = fixture(t, { hardware: 2 }); await settle(); assert.equal(low.level(), 'smooth'); assert.equal(low.d.documentElement.dataset.renderReason, 'device'); low.w.WorkHubRenderProfile.setMode('full'); assert.equal(low.level(), 'full');
  const phone = fixture(t, { iphone: true }); await settle(); assert.equal(phone.level(), 'phone'); assert.equal(phone.d.querySelectorAll('.fx-dust').length, 12); phone.w.WorkHubRenderProfile.setMode('smooth'); assert.equal(phone.level(), 'smooth'); assert.equal(phone.d.querySelectorAll('.fx-dust').length, 8); phone.w.WorkHubRenderProfile.setMode('full'); assert.equal(phone.level(), 'phone');
  const x = fixture(t); await settle(); const size = width => { Object.defineProperty(x.w, 'innerWidth', { value: width, configurable: true }); x.w.dispatchEvent(new x.w.Event('resize')); x.step(); }; size(2600); assert.equal(x.level(), 'smooth'); size(2400); assert.equal(x.level(), 'smooth'); size(2200); assert.equal(x.level(), 'balanced');
});

test('opening the rest scene clears covered workspace effects without pausing the visible plants or changing Resume work', async t => {
  const x = fixture(t); await settle(); x.visible(); x.d.querySelector('nav button').click(); let resumes = 0; const resume = x.d.querySelector('[data-rest="resume"]'); resume.addEventListener('click', () => resumes++); x.d.body.classList.add('rest-room-open'); await settle(); assert.equal(x.d.getElementById('hubSpectacle').hidden, true); assert.equal(x.d.querySelector('.fx-reactions').childElementCount, 0); resume.click(); assert.equal(resumes, 1); x.d.body.classList.remove('rest-room-open'); await settle(); assert.equal(x.d.getElementById('hubSpectacle').hidden, false);
});

test('reaction expiry removes every expired node even without animationend events', async t => {
  const x = fixture(t); await settle(); for (let i = 0; i < 10; i++) x.d.querySelector('nav button').click(); assert.equal(x.d.querySelector('.fx-reactions').childElementCount, 36); const entry = [...x.timers].find(([, job]) => job.ms === 2200); x.timers.delete(entry[0]); x.time(2300); entry[1].fn(); assert.equal(x.d.querySelector('.fx-reactions').childElementCount, 0); assert.equal(x.timers.size, 0);
});

test('lighter styles retain privacy redaction and visible scenery while removing per-letter and shadow painting', async t => {
  const x = fixture(t); await settle(); const style = x.d.createElement('style'); style.textContent = ['base.css', 'studio.css', 'my-day-visuals.css', 'brand-motion.css', 'rest-room.css', 'dramatic-motion.css', 'large-display.css'].map(source).join('\n'); x.d.head.append(style); const secret = x.d.createElement('span'); secret.className = 'hub-sensitive'; secret.textContent = 'Private text'; x.d.body.append(secret); x.d.body.classList.add('hub-private'); await settle();
  assert.match(x.w.getComputedStyle(secret).filter, /blur/); x.d.body.classList.remove('hub-private'); await settle(); assert.equal(x.w.getComputedStyle(x.d.querySelector('.brand-title-letters > span')).animation, 'none'); assert.equal(x.w.getComputedStyle(x.d.querySelector('.rest-globe')).animationName, 'motion-rest-breathe'); assert.equal(x.w.getComputedStyle(x.d.querySelector('[data-rest="resume"]')).animationName, 'motion-ready-light'); assert.notEqual(x.w.getComputedStyle(x.d.querySelector('.rest-fern')).animation, 'none'); x.w.WorkHubRenderProfile.setMode('full'); assert.match(x.w.getComputedStyle(x.d.querySelector('.rest-globe')).animation, /rest-breathe/); x.d.body.classList.add('hub-private'); await settle(); assert.match(x.w.getComputedStyle(secret).filter, /blur/);
});

test('My Day keeps offscreen scenery paused in Smooth and cancels pending tilt without changing the widget or draft', async t => {
  const x = fixture(t); await settle(); x.d.getElementById('view').innerHTML = '<section class="my-day-page"><header class="mv-hero"><input value="Keep my draft"></header><div class="hub-layout"><article class="md-widget" data-widget="orb"><div class="mv-widget-shell">Focus orb</div></article></div></section>'; x.w.eval(source('my-day-visuals.js'));
  const ui = x.w.WorkHubMyDayVisuals.install({ ready: () => true, owner: () => 'example', prefs: () => ({ motion: 'playful' }), settings: () => ({ effects: 'friendly', particles: false, celebrations: false }) }); ui.mount(); const observer = x.observers.at(-1), hero = x.d.querySelector('.mv-hero'), widget = x.d.querySelector('[data-widget]'), draft = hero.querySelector('input'); draft.focus();
  x.time(40); hero.dispatchEvent(new x.w.MouseEvent('pointermove', { bubbles: true, clientX: 10, clientY: 10 })); assert.ok(x.frames.size > 0); x.w.WorkHubRenderProfile.setMode('smooth'); assert.equal(x.frames.size, 0); observer.fn([{ target: hero, isIntersecting: false }, { target: widget, isIntersecting: false }]); assert.ok(hero.classList.contains('mv-out-of-view')); assert.ok(widget.classList.contains('mv-out-of-view')); x.w.dispatchEvent(new x.w.Event('scroll')); assert.equal(x.frames.size, 0); observer.fn([{ target: hero, isIntersecting: true }]); assert.ok(!hero.classList.contains('mv-out-of-view')); assert.equal(draft.value, 'Keep my draft'); assert.equal(x.d.activeElement, draft); assert.equal(x.d.querySelector('[data-widget]'), widget);
});


test('four consecutive severely slow frames select Smooth, while hidden-page gaps never do', async t => {
 const x = fixture(t); await settle(); x.startSample(); x.step(); for(let i=0;i<3;i++)x.step(400); assert.equal(x.level(),'balanced'); x.step(400); assert.equal(x.level(),'smooth'); assert.equal(x.frames.size,0);
 const gap = fixture(t); await settle(); gap.startSample(); gap.step(); gap.step(8000); assert.equal(gap.level(),'balanced'); assert.equal(gap.frames.size,0);
});
