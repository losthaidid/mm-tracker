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
    for (const tone of ['negative', 'caution']) {
      assert.ok(contrast(token(tone + '-text'), token(tone + '-bg')) >= 4.5,
        p.theme + ' ' + tone + ' highlighted values');
    }
  }
  appearance.apply({ theme: 'forest' });
  assert.equal(dom.window.document.body.style.getPropertyValue('--hub-surface'), '');
  assert.equal(dom.window.document.body.style.getPropertyValue('--hub-bg'), '');
  assert.notEqual(dom.window.document.body.style.getPropertyValue('--hub-negative-bg'), '');
});
