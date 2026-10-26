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
  const dom = new JSDOM('<head></head><body><main id="view"><section class="my-day-page"><header class="hub-head md-day-intro mv-hero"><h2>Your day.<em>A world of possibility.</em></h2><p class="mv-welcome">A little space for yourself.</p><button class="mv-hero-metric"><small>Today’s intention</small><strong>2<span> left</span></strong></button><button class="md-button md-primary">Start my day</button></header><div class="md-focus-orb"><span>25:00</span><small>Ready when you are</small></div></section></main></body>', { runScripts: 'outside-only' });
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
    assert.equal(colour('.mv-welcome'),'var(--hub-scenic-muted)',theme+' description');
    assert.equal(colour('.mv-hero-metric strong'),'var(--hub-scenic-text)',theme+' counter');
    assert.equal(colour('.mv-hero-metric small'),'var(--hub-scenic-muted)',theme+' metric label');
    assert.equal(colour('.mv-hero h2 em'),'var(--hub-scenic-accent)',theme+' heading accent');
    assert.equal(colour('.md-primary'),'var(--hub-on-accent)',theme+' primary control');
    assert.equal(colour('.md-focus-orb span'),'rgb(36, 75, 61)',theme+' light orb clock');
    assert.equal(colour('.md-focus-orb small'),'rgb(36, 75, 61)',theme+' light orb label');
    const tokens = dom.window.getComputedStyle(document.body);
    for (const key of ['text','muted','link','success','warning','danger'])
      for (const bg of ['surface','surface-soft','surface-hover','blue-soft'])
        assert.ok(contrast(tokens.getPropertyValue('--hub-'+key).trim(),tokens.getPropertyValue('--hub-'+bg).trim())>=4.5,theme+' '+key+' on '+bg);
  }
});
