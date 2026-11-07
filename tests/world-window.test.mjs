import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
function fixture(t, width = 1440) {
  const dom = new JSDOM('<body><aside id="hubSidebar"><button id="hubAtmosphereCard" data-atmosphere-action="settings" data-phase="afternoon" data-scenery="valley" data-weather="sunny"><svg class="ambient-landscape"><g class="world-rain"></g></svg><span id="hubAtmosphereCaption">Afternoon glow</span><small id="hubAtmosphereClock">16:39 · Local time</small></button></aside></body>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close()); const w = dom.window, d = w.document;
  Object.defineProperty(w, 'innerWidth', { value: width, writable: true });
  Object.defineProperty(w, 'innerHeight', { value: 900, writable: true });
  let owner = 'one', epoch = 1, ready = true, writes = 0, settings = 0;
  d.querySelector('#hubAtmosphereCard').addEventListener('click', () => settings++);
  w.eval(readFileSync(new URL('../world-window.js', import.meta.url), 'utf8'));
  const ui = w.WorkHubWorldWindow.install({ ready: () => ready, owner: () => owner, generation: () => epoch, mutate() { writes++; } });
  const original = d.querySelector('#hubAtmosphereCard'), svg = original.querySelector('svg');
  ui.mount(); const panel = d.querySelector('#whWorldWindow'), handle = panel.querySelector('.wh-world-handle');
  panel.getBoundingClientRect = () => {
    const left=panel.style.left ? parseFloat(panel.style.left) : w.innerWidth - 316,
      top=panel.style.top ? parseFloat(panel.style.top) : 210,
      height=panel.dataset.minimised === 'true' ? 45 : 280;
    return {left,top,width:292,height,right:left+292,bottom:top+height};
  };
  handle.setPointerCapture = () => {}; handle.releasePointerCapture = () => {};
  const pointer = (type, x, y) => { const e = new w.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { button: 0, isPrimary: true, pointerId: 7, clientX: x, clientY: y }); handle.dispatchEvent(e); };
  const key = value => handle.dispatchEvent(new w.KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }));
  return { ui, w, d, panel, handle, original, svg, pointer, key, writes: () => writes, settings: () => settings,
    account() { owner = 'two'; epoch++; ui.mount(); }, signout() { ready = false; ui.mount(); } };
}
test('World window moves the original interactive scene without replacing its art, clock, metadata or settings listener', t => {
  const c = fixture(t);
  for (let i = 0; i < 3; i++) c.ui.mount();
  assert.equal(c.d.querySelectorAll('#whWorldWindow').length, 1);
  assert.equal(c.d.querySelectorAll('#hubAtmosphereCard').length, 1);
  assert.equal(c.d.querySelector('#whWorldContent').firstElementChild, c.original);
  assert.equal(c.original.querySelector('svg'), c.svg);
  assert.equal(c.original.dataset.scenery, 'valley'); assert.equal(c.original.dataset.weather, 'sunny');
  assert.match(c.original.textContent, /16:39/); c.original.click(); assert.equal(c.settings(), 1);
  assert.equal(c.writes(), 0);
});
test('World window supports bounded pointer and keyboard movement, cancel, resize and reset without writing records', t => {
  const c = fixture(t); c.pointer('pointerdown', 100, 100); c.pointer('pointermove', -10000, -10000);
  assert.equal(c.panel.style.left, '12px'); assert.equal(c.panel.style.top, '12px');
  c.pointer('pointercancel', 0, 0); assert.equal(c.panel.style.left, '');
  c.key('ArrowLeft'); assert.equal(c.panel.style.left, '1108px');
  const before = c.panel.style.left; c.pointer('pointerdown', 100, 100); c.pointer('pointermove', 150, 150);
  c.key('Escape'); assert.equal(c.panel.style.left, before);
  c.pointer('pointerdown', 100, 100); c.pointer('pointermove', 140, 130); c.pointer('pointerup', 140, 130);
  assert.equal(c.panel.style.left, '1136px');
  c.w.innerWidth = 700; c.w.dispatchEvent(new c.w.Event('resize'));
  assert.equal(c.panel.style.left, '396px');
  c.key('Home'); assert.equal(c.panel.style.left, '');
  c.key('ArrowUp'); c.panel.querySelector('[data-world-window="reset"]').click();
  assert.equal(c.panel.style.left, ''); c.w.innerHeight=260;c.w.dispatchEvent(new c.w.Event('resize'));
  assert.equal(c.panel.style.top,'12px');assert.equal(c.writes(), 0);
});
test('World window minimises without losing scene state and resets view position for another account or sign-out', t => {
  const c = fixture(t), toggle = c.panel.querySelector('[data-world-window="toggle"]');
  toggle.click(); assert.equal(c.d.querySelector('#whWorldContent').hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  toggle.click(); assert.equal(c.d.querySelector('#whWorldContent').hidden, false);
  assert.equal(c.original.querySelector('svg'), c.svg);
  c.key('ArrowDown'); c.account(); assert.equal(c.panel.style.left, '');
  assert.equal(c.panel.dataset.minimised, 'false');
  c.signout(); assert.equal(c.panel.hidden, true); assert.equal(c.writes(), 0);
});
test('World window starts compact on a phone and can reveal the same full scene', t => {
  const c = fixture(t, 390);
  assert.equal(c.panel.dataset.minimised, 'true');
  c.panel.querySelector('[data-world-window="toggle"]').click();
  assert.equal(c.panel.dataset.minimised, 'false');
  assert.equal(c.d.querySelector('#whWorldContent').firstElementChild, c.original);
});
