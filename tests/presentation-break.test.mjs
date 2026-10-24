import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
function setup(t) {
  const dom = new JSDOM('<button data-pb="open">Presentation break</button><main id="view"><input value="Private task"></main>', {runScripts:'outside-only',url:'https://losthaidid.github.io/mm-tracker/'});
  t.after(()=>dom.window.close());
  const {window}=dom,{document}=window;let now=100000,owner='one',ready=true;const fullscreen=[];
  window.Date.now=()=>now;
  window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  window.HTMLElement.prototype.requestFullscreen=function(options){fullscreen.push({element:this,options});return Promise.resolve();};
  window.eval(readFileSync(new URL('../presentation-break.js',import.meta.url),'utf8'));
  const ui=window.WorkHubPresentationBreak.install({ready:()=>ready,owner:()=>owner});
  const open=()=>{document.querySelector('[data-pb="open"]').focus();document.querySelector('[data-pb="open"]').click();return document.querySelector('.pb-settings form');};
  const start=(values={})=>{const f=open();for(const[k,v]of Object.entries({message:'Please discuss the next step\nI will be back shortly.',minutes:'2',scene:'coast',complete:'We can continue',...values}))f.elements.namedItem(k).value=v;f.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));};
  return {window,document,ui,fullscreen,open,start,advance:n=>{now+=n;ui.sync();},account:(value,active=true)=>{owner=value;ready=active;ui.sync();}};
}
test('custom audience text renders safely with its own scenery and countdown, without personal records or a second interval',t=>{
 const c=setup(t);let intervals=0;c.window.setInterval=()=>{intervals++;};c.start({message:'<img src=x onerror=alert(1)>\nPlease wait',scene:'mountains'});
 const stage=c.document.querySelector('.pb-stage');assert.equal(stage.querySelector('h1').textContent,'<img src=x onerror=alert(1)>\nPlease wait');assert.equal(stage.querySelector('img'),null);assert.doesNotMatch(stage.textContent,/Private task/);assert.equal(c.document.querySelector('.pb-audience').dataset.scene,'mountains');assert.equal(c.document.querySelector('[data-pb-clock]').textContent,'02:00');assert.equal(c.fullscreen[0].element,stage);assert.equal(intervals,0);
 c.advance(30000);assert.equal(c.document.querySelector('[data-pb-clock]').textContent,'01:30');c.document.querySelector('[data-pb="pause"]').click();c.advance(60000);assert.equal(c.document.querySelector('[data-pb-clock]').textContent,'01:30');c.document.querySelector('[data-pb="pause"]').click();c.advance(91000);assert.equal(c.document.querySelector('[data-pb-clock]').textContent,'00:00');assert.equal(c.document.querySelector('[data-pb-status]').textContent,'We can continue');assert.equal(c.document.querySelector('[data-pb="pause"]').hidden,true);c.document.querySelector('[data-pb="end"]').click();assert.equal(c.document.querySelector('.pb-audience'),null);assert.equal(c.document.activeElement.dataset.pb,'open');assert.equal(c.document.querySelector('#view input').value,'Private task');
});
test('missing fullscreen support leaves an audience-only overlay and a usable end control',async t=>{
 const c=setup(t);c.window.HTMLElement.prototype.requestFullscreen=undefined;c.start({scene:'stars'});await Promise.resolve();assert.match(c.document.querySelector('[data-pb-notice]').textContent,/unavailable/);assert.equal(c.document.querySelector('.pb-audience').open,true);c.document.querySelector('[data-pb="end"]').click();assert.equal(c.document.body.classList.contains('presentation-break-open'),false);
});
test('screen selection uses the chosen connected screen and permission denial keeps the current-screen fallback',async t=>{
 const c=setup(t),screens=[{label:'Laptop'},{label:'Shared monitor'}];c.window.getScreenDetails=async()=>({screens});const f=c.open();c.document.querySelector('[data-pb="screens"]').click();for(let i=0;i<12;i++)await Promise.resolve();const select=f.elements.namedItem('screen');select.value='1';select.dispatchEvent(new c.window.Event('change',{bubbles:true}));f.elements.namedItem('message').value='Back in a minute';f.dispatchEvent(new c.window.Event('submit',{bubbles:true,cancelable:true}));assert.equal(c.fullscreen[0].options.screen,screens[1]);c.document.querySelector('[data-pb="end"]').click();c.window.getScreenDetails=async()=>{throw Error('Denied');};c.open();c.document.querySelector('[data-pb="screens"]').click();for(let i=0;i<12;i++)await Promise.resolve();assert.match(c.document.querySelector('[data-pb-screen-note]').textContent,/permission was unavailable/);
});
test('invalid forms do not launch and account changes clear messages and pending screen selection',async t=>{
 const c=setup(t);c.start({minutes:'0'});assert.equal(c.document.querySelector('.pb-audience'),null);assert.ok(c.document.querySelector('[data-pb-error]').textContent);let resolve;c.window.getScreenDetails=()=>new Promise(r=>resolve=r);c.document.querySelector('[data-pb="screens"]').click();c.account('two');resolve({screens:[{label:'Old account screen'}]});for(let i=0;i<12;i++)await Promise.resolve();assert.equal(c.document.querySelector('.pb-settings'),null);const f=c.open();assert.equal(f.elements.namedItem('message').value,'');assert.equal(f.elements.namedItem('screen').options.length,1);c.account('',false);assert.equal(c.document.querySelector('.pb-settings'),null);
});
test('the countdown reconciles elapsed time when the page becomes visible and page exit cleans up',t=>{
 const c=setup(t);c.start({minutes:'1'});c.advance(75000);c.document.dispatchEvent(new c.window.Event('visibilitychange'));assert.equal(c.document.querySelector('[data-pb-clock]').textContent,'00:00');c.window.dispatchEvent(new c.window.Event('pagehide'));assert.equal(c.document.querySelector('.pb-audience'),null);
});
