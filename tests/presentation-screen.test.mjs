import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
function setup(t){const dom=new JSDOM('<body><main></main></body>',{url:'https://preview.test',runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window;w.eval(readFileSync(new URL('../presentation-screen.js',import.meta.url),'utf8'));let valid=true;const messages=[],ui=w.WorkHubPresentationScreen.create({valid:()=>valid,report:m=>messages.push(m)});return {w,ui,messages,invalidate(){valid=false;ui.clear();}};}
test('screen picker requests permission only on discovery, selects a real screen and handles disconnected displays',async t=>{
 const h=setup(t),screen={label:'Projector <script>',availLeft:-1920,availTop:0,availWidth:1920,availHeight:1080},details={screens:[screen]};let count=0;h.w.getScreenDetails=async()=>{count++;return details;};assert.equal(count,0);assert.equal(await h.ui.discover(),true);h.ui.choose('0');assert.match(h.ui.markup('screen','data-screen="choose"'),/Projector &lt;script&gt;/);assert.match(h.ui.features(),/left=-1920/);const calls=[],el=h.w.document.querySelector('main');el.requestFullscreen=options=>{calls.push(options);return Promise.resolve();};assert.equal(await h.ui.fullscreen(el),true);assert.equal(calls[0].screen,screen);details.screens=[];assert.equal(await h.ui.fullscreen(el),false);assert.equal(calls.length,1);assert.match(h.messages.at(-1),/disconnected/);
});
test('screen picker rejects late permission and fullscreen results after the owning account changes',async t=>{
 const h=setup(t);let resolve;h.w.getScreenDetails=()=>new Promise(r=>resolve=r);const pending=h.ui.discover();h.invalidate();resolve({screens:[{label:'Old account monitor'}]});assert.equal(await pending,false);assert.doesNotMatch(h.ui.markup('screen','data-choose'),/Old account/);
 const k=setup(t),el=k.w.document.querySelector('main');let finish,exited=0;el.requestFullscreen=()=>new Promise(r=>finish=r);Object.defineProperty(k.w.document,'fullscreenElement',{get:()=>el});k.w.document.exitFullscreen=async()=>{exited++;};const full=k.ui.fullscreen(el);k.invalidate();finish();assert.equal(await full,false);assert.equal(exited,1);
});
test('screen picker leaves current-screen fallback usable after denied permission or unsupported fullscreen',async t=>{
 const h=setup(t);h.w.getScreenDetails=async()=>{throw Error('denied');};assert.equal(await h.ui.discover(),false);assert.equal(await h.ui.fullscreen(h.w.document.body),false);assert.match(h.messages.join(' '),/Screen access|Fullscreen/);assert.match(h.ui.markup('screen','data-choose'),/Current screen/);
});
