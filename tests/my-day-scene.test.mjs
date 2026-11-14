import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const source = file => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
const periods = ['morning', 'day', 'dusk', 'night'];

function fixture(t, hour = 7) {
  const dom = new JSDOM('<body><main id="view"></main></body>', {
    url: 'https://example.test',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  t.after(() => dom.window.close());
  const { window } = dom;
  const { document } = window;
  const RealDate = window.Date;
  let clock = new RealDate(2026, 10, 14, hour, 0).getTime();
  window.Date = class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : [clock]));
    }
    static now() {
      return clock;
    }
  };
  const prefs = { motion: 'playful' };
  const settings = { effects: 'ambient', celebrations: false, particles: true };
  const media = { matches: false, addEventListener() {} };
  window.matchMedia = () => media;
  for (const file of ['my-day-quotes.js', 'my-day-scenes.js', 'my-day-visuals.js']) window.eval(source(file));
  const ui = window.WorkHubMyDayVisuals.install({
    ready: () => true,
    owner: () => 'test',
    prefs: () => prefs,
    settings: () => settings,
  });
  const view = document.getElementById('view');
  const hero = () => view.querySelector('.mv-hero');
  const render = () => {
    view.innerHTML = `<section class="my-day-page">${ui.hero({
      done: 0,
      total: 0,
      activities: 0,
      open: 0,
      actions: '<button type="button">Existing action</button>',
    })}</section>`;
    ui.mount();
  };
  const moveTime = seconds => {
    for (let i = 0; i < seconds; i++) {
      clock += 1000;
      ui.sync();
    }
  };
  render();
  return {
    window, document, ui, view, prefs, settings, media, render, hero, moveTime,
    quote: () => hero().querySelector('.mv-quote').textContent.slice(1, -1),
    moment: () => hero().querySelector('.mv-life-layer').dataset.moment,
    setHour(h) {
      clock = new RealDate(2026, 10, 14, h, 0).getTime();
      ui.sync();
    },
  };
}

test('My Day provides 300 distinct quotes and 15 illustrated activities for every local period', t => {
  const { window } = fixture(t);
  const all = new Set();
  for (const period of periods) {
    const quotes = window.WorkHubMyDayQuotes[period];
    assert.equal(new Set(quotes.map(quote => quote.text)).size, 300);
    assert.equal(new Set(quotes.map(quote => quote.opening)).size, 100);
    quotes.forEach(quote => all.add(quote.text));
    const scenes = window.WorkHubMyDayScenes[period];
    assert.equal(new Set(scenes.map(x => x.id)).size, 15);
    for (const scene of scenes) {
      assert.ok(scene.duration >= 9);
      assert.match(scene.render(), /<g.+<\/(?:g|path)>/);
      assert.doesNotMatch(scene.render(), /NaN|undefined|script|href=/);
    }
  }
  assert.equal(all.size, 1200);
});

test('My Day quote stays through a rerender, advances on demand and on returning, and changes with time', t => {
  const x = fixture(t);
  const before = x.quote();
  const next = x.hero().querySelector('[data-mv="next-quote"]');
  assert.ok(x.window.WorkHubMyDayQuotes.morning.some(quote => quote.text === before));
  next.focus();
  next.click();
  assert.notEqual(x.quote(), before);
  const manual = x.quote();
  assert.equal(x.document.activeElement, next);
  x.render();
  assert.equal(x.quote(), manual);
  x.view.replaceChildren();
  x.ui.sync();
  x.render();
  assert.notEqual(x.quote(), manual);
  for (const [hour, period, lighting] of [[10, 'morning', 'off'], [12, 'day', 'off'], [18, 'dusk', 'lit'], [22, 'night', 'lit']]) {
    x.setHour(hour);
    assert.equal(x.hero().dataset.mvPeriod, period);
    assert.equal(x.hero().dataset.mvWindows, lighting);
    assert.ok(x.window.WorkHubMyDayQuotes[period].some(quote => quote.text === x.quote()));
  }
  assert.equal(x.window.localStorage.length, 0);
});

test('My Day uses a full shuffle before repeating and prevents a repeat across cycles', t => {
  const { window } = fixture(t);
  const shuffle = window.WorkHubMyDayVisuals.shuffleBag;
  const mixed = shuffle(window.WorkHubMyDayQuotes.night, () => 0.33, quote => quote.opening);
  const full = Array.from({ length: 300 }, mixed);
  assert.equal(new Set(full).size, 300);
  assert.notEqual(mixed().opening, full.at(-1).opening);
  const draw = shuffle([1, 2, 3], () => 0.32);
  const numbers = Array.from({ length: 12 }, draw);
  for (let i = 0; i < numbers.length; i += 3) assert.equal(new Set(numbers.slice(i, i + 3)).size, 3);
  assert.ok(numbers.every((value, index) => !index || value !== numbers[index - 1]));
});

test('My Day rotates one activity at a time, pauses offscreen, and keeps the quote when motion stops', t => {
  const x = fixture(t);
  assert.ok(x.moment());
  const seen = new Set([x.moment()]);
  let previous = x.moment();
  let sawQuiet = false;
  for (let second = 0; second < 600 && seen.size < 15; second++) {
    x.moveTime(1);
    const now = x.moment();
    if (!now) sawQuiet = true;
    if (now && now !== previous) {
      assert.ok(!seen.has(now), 'each moment plays once per cycle');
      seen.add(now);
      assert.ok(x.hero().querySelectorAll('.mv-moment').length === 1);
    }
    previous = now;
  }
  assert.equal(seen.size, 15);
  assert.ok(sawQuiet);
  x.hero().classList.add('mv-out-of-view');
  const current = x.moment();
  x.moveTime(40);
  assert.equal(x.moment(), current);
  x.hero().classList.remove('mv-out-of-view');
  x.media.matches = true;
  const quote = x.quote();
  x.ui.sync();
  assert.equal(x.moment(), '');
  assert.equal(x.hero().parentElement.dataset.mvMotion, 'still');
  assert.equal(x.quote(), quote);
  x.hero().querySelector('[data-mv="next-quote"]').click();
  assert.notEqual(x.quote(), quote);
});
