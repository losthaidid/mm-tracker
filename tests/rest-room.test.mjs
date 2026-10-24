import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
const settle = async () => { for(let i=0;i<16;i++)await Promise.resolve(); };
function setup(t,{supported=true,reject=false,pending=false}={}) {
 const dom=new JSDOM('<button id="start">Break Terrarium</button>',{url:'https://losthaidid.github.io/mm-tracker/',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const {window}=dom,{document}=window;let now=100000,owner='one',ready=true,active=null,resolveRequest;
 const requests=[],events=[],resumed=[],audio={state:{music:true,playing:false,starting:false,paused:false,track:'garden',volume:60,alarm:true,alerting:false,error:''},snapshot(){return this.state;},start(){events.push('audio');this.state.playing=true;return Promise.resolve();},stop(){this.state.playing=false;this.state.alerting=false;},pause(value){this.state.paused=value;},finish(){this.state.playing=false;this.state.alerting=true;},tick(){},change(key,value){this.state[key]=value;}};
 window.WorkHubRestAudio={TRACKS:{garden:{name:'Cloud garden',detail:'Rest'}},install:()=>audio};window.Date.now=()=>now;
 window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};window.HTMLDialogElement.prototype.close=function(){this.open=false;};
 Object.defineProperty(document,'fullscreenElement',{get:()=>active,configurable:true});
 document.exitFullscreen=async()=>{events.push('exit');active=null;document.dispatchEvent(new window.Event('fullscreenchange'));};
 if(supported)window.HTMLElement.prototype.requestFullscreen=function(){requests.push(this);events.push('fullscreen');if(reject)return Promise.reject(Error('Blocked'));if(pending)return new Promise(resolve=>{resolveRequest=()=>{active=this;document.dispatchEvent(new window.Event('fullscreenchange'));resolve();};});active=this;document.dispatchEvent(new window.Event('fullscreenchange'));return Promise.resolve();};
 window.eval(readFileSync(new URL('../rest-room.js',import.meta.url),'utf8'));
 const room=window.WorkHubRestRoom.install({ready:()=>ready,owner:()=>owner,motion:()=>true,pauseWork:()=>({id:'work'}),resumeWork:value=>resumed.push(value),focus:()=>({active:false}),soundscape:()=>null,tell(){},change(){}});
 document.getElementById('start').addEventListener('click',()=>room.start('Rest your eyes',60));
 const start=()=>{document.getElementById('start').focus();document.getElementById('start').click();};
 return {window,document,room,requests,events,resumed,audio,start,get active(){return active;},finishRequest:()=>resolveRequest(),advance(ms){now+=ms;room.tick();},account(id,available=true){owner=id;ready=available;room.sync();},setActive:el=>{active=el;}};
}
test('terrarium requests native fullscreen on its content directly after audio is unlocked by the start click',async t=>{
 const c=setup(t);c.start();assert.equal(c.requests.length,1);assert.equal(c.requests[0].className,'rest-room-shell');assert.notEqual(c.requests[0].tagName,'DIALOG');assert.deepEqual(c.events.slice(0,2),['audio','fullscreen']);await settle();assert.equal(c.active,c.requests[0]);assert.equal(c.document.querySelector('[data-rest="fullscreen"]').textContent,'Exit full screen');assert.ok(c.active.querySelector('[data-rest="resume"]'));assert.equal(c.document.getElementById('restRoom').open,true);
 const before=c.room.snapshot();c.room.open();assert.equal(c.requests.length,1);assert.equal(c.room.snapshot().end,before.end);assert.equal(c.room.snapshot().start,before.start);
});
test('fullscreen exit keeps the countdown and paused work, and the control retries fullscreen without resetting the break',async t=>{
 const c=setup(t);c.start();await settle();c.advance(10000);const remaining=c.room.snapshot().seconds;c.document.querySelector('[data-rest="fullscreen"]').click();await settle();assert.equal(c.active,null);assert.equal(c.room.snapshot().seconds,remaining);assert.equal(c.room.snapshot().complete,false);assert.equal(c.resumed.length,0);assert.equal(c.document.getElementById('restRoom').open,true);c.document.querySelector('[data-rest="fullscreen"]').click();await settle();assert.equal(c.requests.length,2);assert.equal(c.room.snapshot().seconds,remaining);
 c.advance(60000);assert.equal(c.room.snapshot().complete,true);assert.equal(c.audio.state.alerting,true);assert.ok(c.active);c.document.querySelector('[data-rest="resume"]').click();await settle();assert.equal(c.active,null);assert.equal(c.audio.state.alerting,false);assert.equal(c.resumed.length,1);assert.equal(c.document.getElementById('restRoom'),null);
});
test('missing or rejected fullscreen leaves an accessible full-window terrarium and working break controls',async t=>{
 for(const options of [{supported:false},{reject:true}]){
  const c=setup(t,options);c.start();await settle();const dialog=c.document.getElementById('restRoom');assert.equal(dialog.open,true);assert.match(dialog.querySelector('[data-rest-fullscreen-status]').textContent,/unavailable/);assert.equal(c.room.snapshot().complete,false);assert.equal(c.audio.state.playing,true);assert.equal(c.resumed.length,0);if(options.reject)assert.equal(dialog.querySelector('[data-rest="fullscreen"]').disabled,false);else assert.equal(dialog.querySelector('[data-rest="fullscreen"]').hidden,true);dialog.querySelector('[data-rest="end"]').click();assert.equal(c.resumed.length,0);dialog.querySelector('[data-rest="resume"]').click();assert.equal(c.resumed.length,1);
 }
});
test('pending fullscreen cannot reopen an old account session and releases only its own late fullscreen target',async t=>{
 const c=setup(t,{pending:true});c.start();c.room.open();assert.equal(c.requests.length,1);c.account('two');assert.equal(c.room.snapshot(),null);assert.equal(c.document.getElementById('restRoom'),null);c.finishRequest();await settle();assert.equal(c.active,null);assert.equal(c.resumed.length,0);assert.equal(c.document.getElementById('restRoom'),null);
});
test('closing rest preserves a different feature fullscreen and page exit releases a terrarium-owned fullscreen',async t=>{
 const c=setup(t);c.start();await settle();const other=c.document.createElement('section');c.document.body.append(other);c.setActive(other);c.account('two');await settle();assert.equal(c.active,other);assert.equal(c.events.includes('exit'),false);c.start();await settle();assert.equal(c.active,c.requests.at(-1));c.window.dispatchEvent(new c.window.Event('pagehide'));await settle();assert.equal(c.active,null);assert.equal(c.room.snapshot(),null);assert.equal(c.document.body.classList.contains('rest-room-open'),false);
});
