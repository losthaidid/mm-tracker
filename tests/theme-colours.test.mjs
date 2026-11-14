import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

function luminance(hex) {
  const c = hex.replace('#', '').match(/../g).map(v => parseInt(v, 16) / 255)
    .map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a,b) => b-a);
  return (values[0] + .05) / (values[1] + .05);
}
test('Theme colours: primary buttons, website links and semantic text remain readable for every preset and custom dark/light palette', t => {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(readFileSync(new URL('../workspace-upgrades.js', import.meta.url), 'utf8'));
  const appearance = dom.window.WorkHubAppearance;
  const palettes = [...Object.keys(appearance.THEMES).map(theme => ({ theme })),
    { theme: 'custom', accent: '#b2eaff', colors: { page: '#101820', surface: '#1d2630', text: '#17202a', secondary: '#8888cc' } },
    { theme: 'custom', accent: '#ffeebb', colors: { page: '#fffefe', surface: '#fff9f4', text: '#dddddd', secondary: '#bb88cc' } },
    { theme: 'custom', accent: '#1e1630', colors: { page: '#777777', surface: '#808080', text: '#ffffff', secondary: '#44aaff' } },
  ];
  for (const p of palettes) {
    appearance.apply(p);
    const style = dom.window.document.body.style;
    const token = key => style.getPropertyValue('--hub-' + key);
    const palette = appearance.palette(p, 'Test');
    assert.ok(contrast(token('on-accent'), palette.accent) >= 4.5, p.theme + ' primary text');
    for (const role of ['link', 'success', 'warning', 'danger'])
      assert.ok(contrast(token(role), palette.colors.surface) >= 4.5, p.theme + ' ' + role);
    assert.ok(contrast(token('text'), palette.colors.surface) >= 4.5, p.theme + ' primary text on cards');
    assert.ok(contrast(token('muted'), palette.colors.surface) >= 4.5, p.theme + ' secondary text on cards');
    assert.ok(contrast(token('page-text'), palette.colors.page) >= 4.5, p.theme + ' page headings');
    assert.ok(contrast(token('page-muted'), palette.colors.page) >= 4.5, p.theme + ' page hints');
    const soft = token('surface-soft') || palette.colors.surface;
    assert.ok(contrast(token('soft-text'), soft) >= 4.5, p.theme + ' soft-card text');
    assert.ok(contrast(token('soft-muted'), soft) >= 4.5, p.theme + ' soft-card hints');
    for (const tone of ['positive', 'negative', 'caution']) {
      assert.ok(contrast(token(tone + '-text'), token(tone + '-bg')) >= 4.5,
        p.theme + ' ' + tone + ' highlighted values');
    }
  }
  appearance.apply({ theme: 'forest' });
  assert.equal(dom.window.document.body.style.getPropertyValue('--hub-surface'), '');
  assert.equal(dom.window.document.body.style.getPropertyValue('--hub-bg'), '');
  assert.notEqual(dom.window.document.body.style.getPropertyValue('--hub-negative-bg'), '');
});


test('Theme surfaces: scenic headings and metric text keep their light foreground while light controls follow the theme', t => {
  const dom = new JSDOM('<head></head><body><main id="view"><section class="my-day-page"><header class="hub-head md-day-intro mv-hero"><p class="mv-day-label">Morning</p><h2 class="mv-quote">Begin with one good step.</h2><button class="mv-hero-metric"><small>Today’s intention</small><strong>2<span> left</span></strong></button><button class="md-button md-primary">Start my day</button></header><div class="md-focus-orb"><span>25:00</span><small>Ready when you are</small></div></section></main></body>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { document } = dom.window;
  const style = document.createElement('style');
  style.textContent = ['studio.css','workspace-upgrades.css','my-day.css','my-day-visuals.css','theme-surfaces.css'].map(file => readFileSync(new URL('../'+file,import.meta.url),'utf8')).join('\n');
  document.head.append(style);
  dom.window.eval(readFileSync(new URL('../workspace-upgrades.js',import.meta.url),'utf8'));
  for (const theme of ['ocean','lagoon','forest','dark']) {
    dom.window.WorkHubAppearance.apply({theme});
    const colour = selector => dom.window.getComputedStyle(document.querySelector(selector)).color;
    assert.equal(colour('.mv-hero h2'),'var(--hub-scenic-text)',theme+' scenic heading');
    assert.equal(colour('.mv-day-label'),'var(--hub-scenic-muted)',theme+' date label');
    assert.equal(colour('.mv-hero-metric strong'),'var(--hub-scenic-text)',theme+' counter');
    assert.equal(colour('.mv-hero-metric small'),'var(--hub-scenic-muted)',theme+' metric label');
    assert.equal(colour('.md-primary'),'var(--hub-on-accent)',theme+' primary control');
    assert.equal(colour('.md-focus-orb span'),'var(--mv-scrim, #19242f)',theme+' light orb clock');
    assert.equal(colour('.md-focus-orb small'),'var(--mv-scrim, #19242f)',theme+' light orb label');
    const tokens = dom.window.getComputedStyle(document.body);
    for (const key of ['text','muted','link','success','warning','danger'])
      for (const bg of ['surface','surface-soft','surface-hover','blue-soft'])
        assert.ok(contrast(tokens.getPropertyValue('--hub-'+key).trim(),tokens.getPropertyValue('--hub-'+bg).trim())>=4.5,theme+' '+key+' on '+bg);
  }
});

test('Theme changes update root surfaces and inherited controls immediately without retaining the previous palette', t => {
  const dom = new JSDOM('<head></head><body><aside id="sidebar"></aside><dialog></dialog></body>', {runScripts:'outside-only'});
  t.after(() => dom.window.close());
  const {window} = dom, {document} = window, sheet = document.createElement('style');
  sheet.textContent = ['base.css','studio.css','workspace-upgrades.css','theme-surfaces.css'].map(file => readFileSync(new URL('../'+file,import.meta.url),'utf8')).join('\n');
  document.head.append(sheet);
  window.eval(readFileSync(new URL('../workspace-upgrades.js',import.meta.url),'utf8'));
  const originalBody=document.body, sidebar=document.getElementById('sidebar'), root=document.documentElement;
  const changes=[{theme:'forest'},{theme:'dark'},{theme:'ocean'},
    {theme:'custom',accent:'#9ee8ff',colors:{page:'#101820',surface:'#1d2630',text:'#eef6fb',secondary:'#a287d1'}},
    {theme:'rose'},{theme:'lagoon'},{theme:'ocean'}];
  for (const p of changes) {
    window.WorkHubAppearance.apply(p);
    const page=window.getComputedStyle(root), body=window.getComputedStyle(document.body);
    assert.equal(page.getPropertyValue('--hub-bg'),body.getPropertyValue('--hub-bg'),p.theme+' outer page');
    assert.equal(page.getPropertyValue('--hub-surface'),body.getPropertyValue('--hub-surface'),p.theme+' root surface');
    assert.equal(page.getPropertyValue('--hub-text'),body.getPropertyValue('--hub-text'),p.theme+' root text');
    assert.equal(page.getPropertyValue('--hub-on-accent'),body.getPropertyValue('--hub-on-accent'),p.theme+' primary button contrast');
    assert.equal(body.getPropertyValue('--hub-secondary').trim(),window.WorkHubAppearance.palette(p,'').colors.secondary,p.theme+' secondary colour');
    assert.equal(page.getPropertyValue('--hub-secondary'),body.getPropertyValue('--hub-secondary'),p.theme+' root secondary colour');
    assert.equal(root.style.colorScheme,document.body.style.colorScheme);
    assert.equal(document.body,originalBody); assert.equal(document.getElementById('sidebar'),sidebar);
  }
  assert.equal(root.style.getPropertyValue('--hub-bg'),'#f8f7f2');
  assert.equal(root.style.getPropertyValue('--hub-surface'),'#fffefa');
});

test('My Day scenery uses fixed time-of-day colours and takes its frame from the theme accent', t => {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const { window } = dom, { document } = window;
  const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  window.eval(source('my-day-visuals.js'));
  const { hero } = window.WorkHubMyDayVisuals.install({ ready: () => false });
  document.body.innerHTML = `<section class="my-day-page">${hero({ total: 0, done: 0, activities: 0, open: 0, actions: '' })}</section>`;
  const sheet = document.createElement('style');
  sheet.textContent = source('my-day-visuals.css');
  document.head.append(sheet);
  const banner = document.querySelector('.mv-hero');
  const skies = new Set();
  for (const period of ['morning', 'day', 'dusk', 'night']) {
    banner.dataset.mvPeriod = period;
    const properties = ['sky-top', 'sky-bottom', 'valley', 'river-deep', 'sun', 'cabin-wall'];
    const palette = () => properties.map(key => window.getComputedStyle(banner).getPropertyValue('--mv-' + key).trim());
    const before = palette();
    for (const token of before) assert.match(token, /^#[0-9a-f]{6}$/i);
    skies.add(before[0]);
    document.body.style.setProperty('--hub-accent', '#b14988');
    document.body.style.setProperty('--hub-secondary', '#ffba52');
    assert.deepEqual(palette(), before);
  }
  assert.equal(skies.size, 4);
  assert.match(sheet.textContent, /border: 2px solid var\(--hub-accent/);
  assert.equal(document.querySelector('#mvSky stop').getAttribute('stop-color'), 'var(--mv-sky-top)');
  assert.equal(document.querySelector('#mvRiver stop:last-child').getAttribute('stop-color'), 'var(--mv-river-deep)');
  assert.equal(document.querySelector('.mv-sun-light circle:last-child').getAttribute('fill'), 'var(--mv-sun)');
});
