import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

function fixture(t) {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  for (const name of ['pattern-characters.js', 'pattern-collection.js', 'workspace-upgrades.js']) dom.window.eval(readFileSync(new URL('../' + name, import.meta.url), 'utf8'));
  return { window: dom.window, document: dom.window.document, collection: dom.window.WorkHubPatternCollection };
}
function contrast(a, b) {
  const luminance = hex => hex.slice(1).match(/../g).map(n => parseInt(n, 16) / 255).map(n => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + .05) / (low + .05);
}
test('Pattern collections contain exactly 20 anime and 20 cartoon sets with distinct safe repeat tiles', t => {
  const { window, collection: c } = fixture(t);
  assert.equal(c.SETS.length, 40);
  assert.equal(Object.keys(window.WorkHubPatternCharacters).length, 40);
  assert.equal(Object.values(window.WorkHubPatternCharacters).filter(c=>c.original).length, 20);
  assert.equal(c.SETS.filter(s => s.group === 'anime').length, 20);
  assert.equal(c.SETS.filter(s => s.group === 'cartoon').length, 20);
  assert.equal(new Set(c.SETS.map(s => s.id)).size, 40);
  assert.equal(new Set(c.SETS.map(s => s.series)).size, 40);
  assert.equal(new Set(c.SETS.map(s => c.image(s.id))).size, 40);
  for (const set of c.SETS) {
    assert.ok(c.TYPE[set.type]); assert.ok(['system', 'rounded', 'serif'].includes(set.font));
    const url = c.image(set.id), svg = decodeURIComponent(url.slice('url("data:image/svg+xml,'.length, -2));
    const xml = new window.DOMParser().parseFromString(svg, 'image/svg+xml');
    assert.equal(xml.querySelector('parsererror'), null, set.id);
    assert.equal(xml.documentElement.getAttribute('viewBox'), '0 0 280 220');
    assert.equal(xml.querySelectorAll('script,foreignObject,animate,filter').length, 0);
    assert.doesNotMatch(svg.replace(/data:image\/png;base64,[A-Za-z0-9+/=]+/g, ''), /undefined|NaN|https?:\/\/(?!www.w3.org)/);
    assert.ok(url.length < 30000, set.id + ' uses a compressed repeat tile');
    assert.match(xml.querySelector('image').getAttribute('href'), /^data:image\/png;base64,/);
    const plain = decodeURIComponent(c.image(set.id, 70, false)); assert.doesNotMatch(plain, /<image /);
  }
  assert.equal(c.image('foreign-upload'), '');
});
test('Every coordinated collection keeps page text, card text and action labels readable', t => {
  const { window, document, collection: c } = fixture(t);
  for (const set of c.SETS) {
    window.WorkHubAppearance.apply({ theme: 'custom', accent: set.accent, colors: set.colors });
    const token = name => document.body.style.getPropertyValue('--hub-' + name);
    assert.ok(contrast(token('text'), set.colors.surface) >= 4.5, set.id + ' card text');
    assert.ok(contrast(token('page-text'), set.colors.page) >= 4.5, set.id + ' page text');
    assert.ok(contrast(token('on-accent'), set.accent) >= 4.5, set.id + ' action text');
    assert.ok(contrast(token('link'), set.colors.surface) >= 4.5, set.id + ' links');
  }
});
test('Pattern preferences validate optional legacy values and reject invalid imports before rendering', t => {
  const { collection: c } = fixture(t);
  c.validate({}); c.validate({ patternSet: '', patternStrength: 20, patternScale: 180, patternTypography: false });
  for (const set of c.SETS) c.validate({ patternSet: set.id, patternStrength: 70, patternScale: 100, patternTypography: true });
  for (const values of [{ patternSet: '<script>' }, { patternSet: null }, { patternStrength: 0 }, { patternStrength: 101 }, { patternStrength: '70' }, { patternScale: 59 }, { patternScale: 181 }, { patternScale: 100.2 }, { patternTypography: 'true' }, { patternCharacters: 'true' }]) assert.throws(() => c.validate(values), /pattern collection/);
});
test('Pattern controls choose complete coordinated sets and switch galleries without changing another form', t => {
  const { document, collection: c } = fixture(t);
  document.body.innerHTML = '<form id="theme"><input name="theme"><input name="accent"><select name="background"><option value="plain">Plain</option></select><select name="font">' + ['system', 'rounded', 'serif'].map(v => '<option>' + v + '</option>').join('') + '</select>' + ['page', 'surface', 'text', 'secondary'].map(v => '<input name="color-' + v + '">').join('') + c.fields({}) + '</form><form id="other"><input value="Unfinished"></form>';
  const form = document.getElementById('theme'), other = document.getElementById('other');
  assert.equal(form.querySelectorAll('[data-hub="pattern-set"]').length, 40);
  assert.equal(form.querySelector('[data-pattern-group="anime"]').hidden, false);
  c.showGroup(form, 'cartoon');
  assert.equal(form.querySelector('[data-pattern-group="anime"]').hidden, true);
  assert.equal(form.querySelector('[data-pattern-group="cartoon"]').hidden, false);
  for (const set of c.SETS) {
    c.choose(form, set.id); const p = c.values(form, {}); c.sync(form, p);
    assert.equal(p.patternSet, set.id); assert.equal(form.elements.theme.value, 'custom');
    assert.equal(form.elements.accent.value, set.accent); assert.equal(form.elements.font.value, set.font);
    for (const [name, value] of Object.entries(set.colors)) assert.equal(form.elements.namedItem('color-' + name).value, value);
    assert.equal(form.querySelectorAll('[data-hub="pattern-set"][aria-pressed="true"]').length, 1);
    assert.match(form.querySelector('#pcSelection').textContent, new RegExp(set.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.equal(document.getElementById('other'), other); assert.equal(other.querySelector('input').value, 'Unfinished');
  assert.throws(() => c.choose(form, 'not-a-set'), /Choose a pattern/);
});
test('Pattern rendering updates strength and size, avoids ordinary render writes and clears on reset', t => {
  const { window, document, collection: c } = fixture(t), p = { patternSet: 'naruto-clouds', patternStrength: 70, patternScale: 100, patternTypography: true };
  c.apply(p); const body = document.body, before = body.style.getPropertyValue('--pc-image');
  assert.equal(body.dataset.hubPatternSet, p.patternSet); assert.ok(body.hasAttribute('data-hub-pattern-typography'));
  const observer = new window.MutationObserver(() => {}); observer.observe(body, { attributes: true });
  c.apply({ ...p }); assert.equal(observer.takeRecords().length, 0);
  c.apply({ ...p, patternStrength: 90, patternScale: 140, patternTypography: false });
  assert.notEqual(body.style.getPropertyValue('--pc-image'), before); assert.equal(body.style.getPropertyValue('--pc-size'), '392px 308px');
  assert.equal(body.hasAttribute('data-hub-pattern-typography'), false);
  c.apply({}); assert.equal(body.hasAttribute('data-hub-pattern-set'), false); assert.equal(body.style.getPropertyValue('--pc-image'), '');
  assert.equal(p.patternStrength, 70); observer.disconnect();
});
