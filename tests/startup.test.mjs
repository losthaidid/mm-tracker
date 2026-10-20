import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = readFileSync(new URL('../startup.js', import.meta.url), 'utf8');

function startup(t, execute = true) {
  const dom = new JSDOM(html, {
    url: 'https://losthaidid.github.io/mm-tracker/',
    runScripts: 'outside-only',
  });
  t.after(() => dom.window.close());
  const { window } = dom;
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
