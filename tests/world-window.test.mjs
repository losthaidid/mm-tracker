import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

function fixture(t, displaced = false) {
  const dom = new JSDOM('<body><header id="hubHeader"><div class="hub-header-brand">My WorkHub</div></header><aside id="hubSidebar"><nav id="tabs"></nav><button id="hubAtmosphereCard" data-scenery="valley" data-weather="sunny"><svg viewBox="0 0 240 132"></svg><span id="hubAtmosphereCaption">Afternoon glow</span><small id="hubAtmosphereClock">16:39 · Local time</small></button><div class="hub-side-note">Small steps count.</div></aside></body>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const w = dom.window, d = w.document, card = d.getElementById('hubAtmosphereCard');
  if (displaced) d.getElementById('hubHeader').append(card);
  let ready = true, writes = 0, settings = 0;
  card.addEventListener('click', () => settings++);
  w.eval(readFileSync(new URL('../world-window.js', import.meta.url), 'utf8'));
  const ui = w.WorkHubWorldWindow.install({ ready: () => ready, mutate() { writes++; } });
  ui.mount();
  return { w, d, ui, card, writes: () => writes, settings: () => settings,
    signedIn(value) { ready = value; ui.mount(); } };
}

test('World window returns the original scene to the sidebar before the note and preserves artwork, clock and listeners', t => {
  const c = fixture(t, true), svg = c.card.querySelector('svg'), caption = c.d.getElementById('hubAtmosphereCaption'), clock = c.d.getElementById('hubAtmosphereClock');
  for (let i = 0; i < 3; i++) c.ui.mount();
  assert.equal(c.card.parentElement.id, 'hubSidebar');
  assert.equal(c.card.previousElementSibling.id, 'tabs');
  assert.equal(c.card.nextElementSibling.className, 'hub-side-note');
  assert.equal(c.d.querySelectorAll('#hubAtmosphereCard').length, 1);
  assert.equal(c.card.querySelector('svg'), svg);
  assert.equal(c.d.getElementById('hubAtmosphereCaption'), caption);
  assert.equal(c.d.getElementById('hubAtmosphereClock'), clock);
  assert.equal(c.card.dataset.scenery, 'valley');
  assert.equal(c.card.dataset.weather, 'sunny');
  c.card.click();
  assert.equal(c.settings(), 1);
  assert.equal(c.d.querySelector('#hubHeader #hubAtmosphereCard'), null);
  assert.equal(c.d.querySelector('[data-world-window="expand"]'), null);
  assert.equal(c.writes(), 0);
});

test('World window docking respects Atmosphere Off, account changes and a shell without a sidebar', t => {
  const c = fixture(t);
  c.card.hidden = true; c.ui.mount();
  assert.equal(c.card.hidden, true);
  c.signedIn(false);
  assert.equal(c.d.body.hasAttribute('data-hub-world'), false);
  c.signedIn(true);
  assert.equal(c.d.body.dataset.hubWorld, 'sidebar');
  assert.equal(c.card.hidden, true);
  c.d.getElementById('hubSidebar').remove(); c.ui.mount();
  assert.equal(c.d.body.hasAttribute('data-hub-world'), false);
  assert.equal(c.writes(), 0);
});
