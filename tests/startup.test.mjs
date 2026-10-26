import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../startup.js', import.meta.url), 'utf8');

function startup(t, execute = true, storage = {}) {
  const dom = new JSDOM(html, {
    url: 'https://losthaidid.github.io/mm-tracker/',
    runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  for (const [key, value] of Object.entries(storage)) window.localStorage.setItem(key, value);
  const timers = new Map();
  let id = 0;
  window.setTimeout = (callback, delay) => {
    timers.set(++id, { callback, delay });
    return id;
  };
  window.clearTimeout = timer => timers.delete(timer);
  if (execute) window.eval(source);
  return { window, document: window.document, timers };
}

const project = 'aaotojqkiewbhtnrlcur',
  authKey = 'mm-tracker.auth.v1:' + project,
  cacheKey = id => 'mm-tracker.cloud.v1:' + project + ':' + id,
  cache = workspace => JSON.stringify({ document: { data: { workhub: { preferences: { workspace } } } } });

test('startup uses the returning account website name before feature assets load', t => {
  const name = 'My calm desk 🌿',
    { window, document } = startup(t, true, {
      [authKey]: JSON.stringify({ user: { id: 'owner' } }),
      [cacheKey('owner')]: cache(name),
      [cacheKey('other')]: cache('Another account'),
    });
  assert.equal(document.getElementById('workhubStartupBrand').textContent, name);
  assert.equal(document.title, name);
  assert.equal(document.querySelectorAll('#cloudConfig').length, 1);
  assert.ok(document.getElementById('cloudConfig').compareDocumentPosition(document.querySelector('script[src]')) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  // The parser hook applies the cached name as soon as the brand markup is available.
  const brand = document.getElementById('workhubStartupBrand');
  brand.remove();
  window.eval(source);
  brand.textContent = 'Your workspace';
  document.getElementById('workhubStartup').prepend(brand);
  window.eval(readFileSync(new URL('../startup-brand.js', import.meta.url), 'utf8'));
  assert.equal(brand.textContent, name);
});

test('startup handles missing or corrupt account storage without another account name or old branding', t => {
  for (const storage of [
    {},
    { [cacheKey('other')]: cache('Another account') },
    { [authKey]: '{broken', [cacheKey('owner')]: cache('A saved name') },
    { [authKey]: JSON.stringify({ user: { id: 'owner' } }), [cacheKey('owner')]: '{broken' },
    { [authKey]: JSON.stringify({ user: { id: 'owner' } }), [cacheKey('owner')]: cache(' '.repeat(12)) },
  ]) {
    const { window, document } = startup(t, true, storage);
    assert.equal(document.getElementById('workhubStartupBrand').textContent, 'Your workspace');
    assert.doesNotMatch(document.getElementById('workhubStartup').textContent, /SAP MM WorkHub/);
    window.WorkHubStartup.account(project, 'unknown');
    assert.equal(document.getElementById('workhubStartupBrand').textContent, 'Your workspace');
  }
  const { window, document } = startup(t, false);
  Object.defineProperty(window, 'localStorage', { get() { throw Error('Storage is blocked'); } });
  assert.doesNotThrow(() => window.eval(source));
  assert.equal(document.getElementById('workhubStartupBrand').textContent, 'Your workspace');
});

test('startup renders names as text and resets branding when the verified account changes or signs out', t => {
  const name = '<img src=x onerror=alert(1)> & my desk',
    { window, document } = startup(t, true, { [cacheKey('owner')]: cache(name) });
  window.WorkHubStartup.account(project, 'owner');
  const brand = document.getElementById('workhubStartupBrand');
  assert.equal(brand.textContent, name);
  assert.equal(brand.children.length, 0);
  window.WorkHubStartup.account(project, 'new-owner');
  assert.equal(brand.textContent, 'Your workspace');
  window.WorkHubStartup.name('Renamed website');
  assert.equal(brand.textContent, 'Renamed website');
  window.WorkHubStartup.account(project, null);
  assert.equal(brand.textContent, 'Your workspace');
});

test('startup cover hides original markup before external JavaScript or styles arrive', t => {
  const { window, document } = startup(t, false);
  assert.equal(window.getComputedStyle(document.querySelector('body > header')).visibility, 'hidden');
  assert.equal(window.getComputedStyle(document.querySelector('main.page')).visibility, 'hidden');
  assert.equal(window.getComputedStyle(document.getElementById('workhubStartup')).visibility, 'visible');
  assert.equal(document.querySelector('script[src]').getAttribute('src').split('?')[0], './startup.js');
  assert.ok(document.querySelector('#workhubStartup a[href]'));
  assert.match(document.querySelector('#workhubStartup noscript').textContent, /Enable JavaScript/);
  assert.match(document.querySelector('style').textContent, /prefers-reduced-motion: reduce/);
});

test('startup cover fades and is removed after readiness without delaying the workspace', t => {
  const { window, document, timers } = startup(t);
  window.WorkHubStartup.finish();
  assert.equal(document.documentElement.hasAttribute('data-workhub-startup'), false);
  assert.notEqual(window.getComputedStyle(document.querySelector('body > header')).visibility, 'hidden');
  assert.equal(document.getElementById('workhubStartup').getAttribute('aria-hidden'), 'true');
  assert.equal(window.getComputedStyle(document.getElementById('workhubStartup')).opacity, '0');
  assert.equal([...timers.values()].some(timer => timer.delay === 12000), false);
  [...timers.values()].find(timer => timer.delay === 220).callback();
  assert.equal(document.getElementById('workhubStartup'), null);
  window.dispatchEvent(new window.ErrorEvent('error', { message: 'An unrelated later error' }));
  assert.equal(document.documentElement.hasAttribute('data-workhub-startup'), false);
});

test('slow startup offers recovery while keeping unfinished content covered and can still complete', t => {
  const { window, document, timers } = startup(t);
  [...timers.values()].find(timer => timer.delay === 12000).callback();
  assert.match(document.getElementById('workhubStartupStatus').textContent, /Taking a little longer/);
  assert.equal(window.getComputedStyle(document.querySelector('body > header')).visibility, 'hidden');
  assert.equal(document.documentElement.dataset.workhubStartupState, 'slow');
  window.WorkHubStartup.finish();
  assert.equal(document.documentElement.hasAttribute('data-workhub-startup'), false);
});

test('failed startup files or runtime errors keep recovery visible without revealing partial layout', t => {
  for (const selector of ['script[src]', 'link[rel="stylesheet"]', null]) {
    const { window, document } = startup(t);
    const target = selector ? document.querySelector(selector) : window;
    target.dispatchEvent(new window.Event('error'));
    window.WorkHubStartup.finish();
    assert.equal(document.documentElement.dataset.workhubStartup, 'loading');
    assert.equal(document.documentElement.dataset.workhubStartupState, 'error');
    assert.match(document.getElementById('workhubStartupStatus').textContent, /could not finish opening/);
    assert.equal(window.getComputedStyle(document.querySelector('body > header')).visibility, 'hidden');
    assert.ok(document.getElementById('workhubStartupReload'));
  }
});

test('startup shows real opening stages without a fabricated percentage or minimum delay', t => {
  const {window,document,timers}=startup(t);
  window.WorkHubStartup.phase('account','Connecting your account…');
  assert.equal(document.querySelector('[data-startup-stage="assets"]').dataset.state,'done');
  assert.equal(document.querySelector('[aria-current="step"]').dataset.startupStage,'account');
  const progress=document.getElementById('workhubStartupProgress');assert.equal(progress.hasAttribute('aria-valuenow'),false);assert.match(progress.getAttribute('aria-valuetext'),/Connecting/);
  window.WorkHubStartup.phase('records','Opening your records…');assert.equal(document.querySelector('[aria-current="step"]').dataset.startupStage,'records');
  window.WorkHubStartup.finish();assert.equal(document.documentElement.hasAttribute('data-workhub-startup'),false);assert.equal([...timers.values()].filter(t=>t.delay!==220).length,0);
});


test('startup star interaction replays a finite burst, cleans up on completion, and never adds a readiness delay', t => {
  const { window, document, timers } = startup(t), button = document.querySelector('.startup-spark-button'), scene = button.closest('.startup-scene');
  const before = timers.size;
  button.click(); assert.equal(scene.classList.contains('is-sparked'), true); assert.equal(timers.size, before);
  const ended = new window.Event('animationend', { bubbles: true }); Object.defineProperty(ended, 'animationName', { value: 'startup-tap-wave' });
  document.querySelector('.startup-tap-wave').dispatchEvent(ended); assert.equal(scene.classList.contains('is-sparked'), false);
  button.click(); assert.equal(scene.classList.contains('is-sparked'), true); window.WorkHubStartup.finish();
  scene.classList.remove('is-sparked'); button.click(); assert.equal(scene.classList.contains('is-sparked'), false);
  assert.equal(document.documentElement.hasAttribute('data-workhub-startup'), false);
  assert.deepEqual([...timers.values()].map(timer => timer.delay), [220]);
  window.WorkHubStartup.account(project, 'owner'); assert.equal(document.documentElement.hasAttribute('data-startup-motion'), false); assert.equal(document.documentElement.hasAttribute('data-startup-phase'), false);
});

test('startup uses only the matching account motion setting, respects reduced motion for interactions and stops recovery-screen bursts', t => {
  const stored = workspace => JSON.stringify({ document: { data: { workhub: { preferences: { workspace, motion: 'off' } } } } });
  const h = startup(t, true, { [authKey]: JSON.stringify({ user: { id: 'owner' } }), [cacheKey('owner')]: stored('Quiet workspace'), [cacheKey('other')]: stored('Other workspace') });
  const { window, document } = h, scene = document.querySelector('.startup-scene'), button = document.querySelector('.startup-spark-button');
  assert.equal(document.documentElement.dataset.startupMotion, 'off'); button.click(); assert.equal(scene.classList.contains('is-sparked'), false);
  window.WorkHubStartup.account(project, 'new-owner'); assert.equal(document.documentElement.hasAttribute('data-startup-motion'), false);
  window.matchMedia = () => ({ matches: true }); button.click(); assert.equal(scene.classList.contains('is-sparked'), false);
  window.matchMedia = () => ({ matches: false }); window.WorkHubStartup.phase('records', 'Opening your records…');
  assert.equal(document.documentElement.dataset.startupPhase, 'records'); window.WorkHubStartup.phase('made-up'); assert.equal(document.documentElement.dataset.startupPhase, 'records');
  document.querySelector('script[src]').dispatchEvent(new window.Event('error')); button.click(); assert.equal(scene.classList.contains('is-sparked'), false); assert.equal(document.documentElement.dataset.workhubStartupState, 'error');
});
