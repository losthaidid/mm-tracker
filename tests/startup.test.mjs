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

const storedAppearance = preferences => JSON.stringify({ document: { data: { workhub: { preferences } } } });
function startupContrast(a,b) {
  const light = value => { const c=value.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4); return .2126*c[0]+.7152*c[1]+.0722*c[2]; };
  return (Math.max(light(a),light(b))+.05)/(Math.min(light(a),light(b))+.05);
}
test('startup restores all eight Studio presets from the matching account and keeps its palette snapshots consistent with Studio',t=>{
 const h=startup(t),{window,document}=h;window.eval(readFileSync(new URL('../workspace-upgrades.js',import.meta.url),'utf8'));
 const config=JSON.parse(document.getElementById('startupThemePresets').textContent),surfaces=new Set();
 assert.deepEqual(Object.keys(config.themes),Object.keys(window.WorkHubAppearance.THEMES));
 assert.deepEqual(config.backgrounds,Array.from(window.WorkHubAppearance.BACKGROUNDS,x=>x[0]));
 for(const theme of Object.keys(config.themes)){
  const p={workspace:'Saved '+theme,theme,accent:'#ff0000',background:'petals',font:'serif',radius:24};
  window.localStorage.setItem(cacheKey('owner'),storedAppearance(p));window.WorkHubStartup.account(project,'owner');
  const palette=window.WorkHubAppearance.palette(p,'Test'),get=key=>document.documentElement.style.getPropertyValue('--startup-'+key);
  assert.equal(config.themes[theme].accent,palette.accent);assert.deepEqual(config.themes[theme],{accent:palette.accent,...JSON.parse(JSON.stringify(palette.colors))});
  assert.equal(document.documentElement.dataset.startupTheme,theme);assert.equal(get('page'),palette.colors.page);assert.equal(get('surface'),palette.colors.surface);assert.equal(get('font'),'Georgia,serif');assert.equal(get('radius'),'24px');assert.equal(document.documentElement.dataset.startupBackground,'petals');surfaces.add(get('page'));
 }
 assert.equal(surfaces.size,8);
});
test('startup custom palettes preserve saved colours while keeping text, hints, links and active stages readable',t=>{
 const {window,document}=startup(t),root=document.documentElement;
 for(const p of [
  {theme:'custom',accent:'#ffffff',colors:{page:'#ffffff',surface:'#fffdfb',text:'#ffffff',secondary:'#fffafa'}},
  {theme:'custom',accent:'#101010',colors:{page:'#080808',surface:'#141414',text:'#151515',secondary:'#241836'}},
  {theme:'custom',accent:'#ffeebb',colors:{page:'#faf5e8',surface:'#fff9f0',text:'#dddddd',secondary:'#7744a1'}},
  {theme:'custom',accent:'#a8eaff',colors:{page:'#101820',surface:'#1d2630',text:'#17202a',secondary:'#8888cc'}},
  {theme:'custom',accent:'#111111',colors:{page:'#777777',surface:'#808080',text:'#ffffff',secondary:'#44aaff'}},
  {theme:'custom',accent:'#ffffff',colors:{page:'#777777',surface:'#707070',text:'#ffffff',secondary:'#ffffff'}},
 ]){
  window.localStorage.setItem(cacheKey('owner'),storedAppearance(p));window.WorkHubStartup.account(project,'owner');
  const get=key=>root.style.getPropertyValue('--startup-'+key);assert.equal(root.dataset.startupTheme,'custom');assert.equal(get('page'),p.colors.page);assert.equal(get('surface'),p.colors.surface);
  for(const foreground of ['text','muted','link','accent-color']) for(const bg of ['surface','surface-soft','surface-alt']) assert.ok(startupContrast(get(foreground),get(bg))>=4.5,foreground+' on '+bg);
  assert.ok(startupContrast(get('active-text'),get('active-surface'))>=4.5);assert.ok(startupContrast(get('art-accent'),get('art-surface'))>=3);
 }
});
test('startup palette rejects corrupt or unsafe cached colours and resets colours when the account changes',t=>{
 const {window,document}=startup(t),root=document.documentElement;
 window.localStorage.setItem(cacheKey('owner'),storedAppearance({workspace:'My forest',theme:'forest',background:'grid'}));
 window.WorkHubStartup.account(project,'owner');assert.equal(root.dataset.startupTheme,'forest');
 window.WorkHubStartup.account(project,'unknown');assert.equal(root.dataset.startupTheme,'default');assert.equal(root.style.getPropertyValue('--startup-page'),'#081722');
 for(const p of [{theme:'constructor'},{theme:'__proto__'},{theme:'custom',accent:'url(https://example.com/x)',colors:{page:'#000000',surface:'#ffffff',text:'#111111',secondary:'#444444'}},{theme:'custom',accent:'#112233',colors:{page:'red',surface:'#ffffff',text:'#111111',secondary:'#444444'}}]){
  window.localStorage.setItem(cacheKey('owner'),storedAppearance(p));window.WorkHubStartup.account(project,'owner');assert.equal(root.dataset.startupTheme,'default');assert.ok(!root.getAttribute('style').includes('url('));
 }
 window.localStorage.setItem(cacheKey('owner'),'{corrupt');window.WorkHubStartup.account(project,'owner');assert.equal(root.dataset.startupTheme,'default');
});
test('startup theme changes preserve the live animation markup and clear only loading colours after the immediate reveal',t=>{
 const {window,document,timers}=startup(t),scene=document.querySelector('.startup-scene'),root=document.documentElement;
 root.style.setProperty('--hub-accent','#abcdef');const stored=JSON.stringify(Object.fromEntries(Object.keys(window.localStorage).map(key=>[key,window.localStorage.getItem(key)])));
 window.WorkHubStartup.appearance({theme:'rose',background:'plain'});assert.equal(document.querySelector('.startup-scene'),scene);assert.equal(root.dataset.startupTheme,'rose');
 assert.equal(JSON.stringify(Object.fromEntries(Object.keys(window.localStorage).map(key=>[key,window.localStorage.getItem(key)]))),stored);
 window.WorkHubStartup.phase('records','Opening records…');assert.equal(root.dataset.startupTheme,'rose');assert.equal(root.style.getPropertyValue('--startup-page'),'#fcf1f5');
 window.WorkHubStartup.finish();assert.equal(root.hasAttribute('data-workhub-startup'),false);assert.equal(document.getElementById('workhubStartup').classList.contains('is-leaving'),true);
 [...timers.values()].find(timer=>timer.delay===220).callback();assert.equal(root.hasAttribute('data-startup-theme'),false);assert.equal(root.style.getPropertyValue('--startup-page'),'');assert.equal(root.style.getPropertyValue('--hub-accent'),'#abcdef');
 window.WorkHubStartup.appearance({theme:'forest'});assert.equal(root.hasAttribute('data-startup-theme'),false);
});
