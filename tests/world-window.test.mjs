import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
function fixture(t, width = 1440) {
  const dom = new JSDOM('<body data-hub-layout="renewed"><header id="hubHeader"><div class="hub-header-brand">My Workhub</div><div class="header-actions"><button id="exportButton">Export</button><button id="settings">Settings</button></div></header><aside id="hubSidebar"><button id="hubAtmosphereCard" data-atmosphere-action="settings" data-phase="afternoon" data-scenery="valley" data-weather="sunny"><svg class="ambient-landscape" viewBox="0 0 240 132"><g class="world-rain"></g></svg><span id="hubAtmosphereCaption">Afternoon glow</span><small id="hubAtmosphereClock">16:39 · Local time</small></button></aside></body>', { runScripts: 'outside-only' });
  t.after(() => dom.window.close()); const w = dom.window, d = w.document;
  Object.defineProperty(w, 'innerWidth', { value: width, writable: true });
  const style=d.createElement('style');style.textContent=readFileSync(new URL('../workspace-redesign.css',import.meta.url),'utf8');d.head.append(style);
  let owner = 'one', epoch = 1, ready = true, writes = 0, settings = 0, exports = 0;
  const actions = d.querySelector('.header-actions'), exportButton=d.getElementById('exportButton'),
    original = d.querySelector('#hubAtmosphereCard'), svg = original.querySelector('svg'),
    caption=d.getElementById('hubAtmosphereCaption'),clock=d.getElementById('hubAtmosphereClock');
  original.addEventListener('click', () => settings++);exportButton.addEventListener('click',()=>exports++);
  w.eval(readFileSync(new URL('../world-window.js', import.meta.url), 'utf8'));
  const ui = w.WorkHubWorldWindow.install({ ready: () => ready, owner: () => owner, generation: () => epoch, mutate() { writes++; } });
  ui.mount();const panel=d.getElementById('whWorldWindow'), toggle=panel.querySelector('[data-world-window="expand"]');
  return {ui,w,d,panel,toggle,original,svg,caption,clock,actions,exportButton,writes:()=>writes,settings:()=>settings,exports:()=>exports,
    account(){owner='two';epoch++;ui.mount();},signout(){ready=false;ui.mount();}};
}
test('World window docks the original scene between header identity and actions without replacing art, clock or listeners',t=>{
 const c=fixture(t),art=c.svg.outerHTML;
 for(let i=0;i<3;i++)c.ui.mount();
 assert.equal(c.panel.parentElement.id,'hubHeader');assert.equal(c.panel.nextElementSibling,c.actions);
 assert.equal(c.d.querySelectorAll('#whWorldWindow').length,1);assert.equal(c.d.querySelectorAll('#hubAtmosphereCard').length,1);
 assert.equal(c.d.getElementById('whWorldContent').firstElementChild,c.original);
 assert.equal(c.original.querySelector('svg'),c.svg);assert.equal(c.svg.outerHTML,art);
 assert.equal(c.d.getElementById('hubAtmosphereCaption'),c.caption);assert.equal(c.d.getElementById('hubAtmosphereClock'),c.clock);
 assert.equal(c.original.dataset.scenery,'valley');assert.equal(c.original.dataset.weather,'sunny');assert.match(c.clock.textContent,/16:39/);
 c.original.click();c.exportButton.click();assert.equal(c.settings(),1);assert.equal(c.exports(),1);
 assert.equal(c.w.getComputedStyle(c.panel).position,'relative');assert.equal(c.w.getComputedStyle(c.d.getElementById('hubHeader')).display,'grid');
 assert.equal(c.d.querySelector('.wh-world-handle'),null);assert.equal(c.d.querySelector('[data-world-window="reset"]'),null);assert.equal(c.writes(),0);
});
test('World window expands within the header and Escape restores compact view without hiding or replacing the scene',t=>{
 const c=fixture(t);assert.equal(c.panel.dataset.expanded,'false');
 c.toggle.click();assert.equal(c.panel.dataset.expanded,'true');assert.equal(c.toggle.getAttribute('aria-expanded'),'true');
 c.ui.mount();assert.equal(c.panel.dataset.expanded,'true');assert.equal(c.panel.parentElement.id,'hubHeader');
 assert.equal(c.original.querySelector('svg'),c.svg);assert.equal(c.d.getElementById('whWorldContent').hidden,false);
 c.original.dispatchEvent(new c.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
 assert.equal(c.panel.dataset.expanded,'false');assert.equal(c.d.activeElement,c.toggle);
 c.toggle.click();c.ui.reset();assert.equal(c.panel.dataset.expanded,'false');assert.equal(c.writes(),0);
});
test('World window follows Atmosphere Off and sign-out and resets only the local header view for another account',t=>{
 const c=fixture(t);c.toggle.click();c.account();assert.equal(c.panel.dataset.expanded,'false');
 c.original.hidden=true;assert.equal(c.w.getComputedStyle(c.panel).display,'none');
 c.original.hidden=false;assert.notEqual(c.w.getComputedStyle(c.panel).display,'none');
 c.signout();assert.equal(c.panel.hidden,true);assert.equal(c.d.body.hasAttribute('data-hub-world'),false);assert.equal(c.writes(),0);
});
test('World window stays available in the header on phones and resizing does not create a floating copy or alter the scene',t=>{
 const c=fixture(t,390);
 assert.equal(c.panel.hidden,false);assert.equal(c.panel.dataset.expanded,'false');assert.equal(c.panel.parentElement.id,'hubHeader');
 c.toggle.click();c.w.innerWidth=1440;c.w.dispatchEvent(new c.w.Event('resize'));c.ui.mount();
 assert.equal(c.panel.dataset.expanded,'true');assert.equal(c.original.querySelector('svg'),c.svg);
 assert.equal(c.panel.style.left,'');assert.equal(c.panel.style.top,'');assert.equal(c.writes(),0);
});
