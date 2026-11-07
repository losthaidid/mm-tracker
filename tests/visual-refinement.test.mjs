import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../visual-refinement.js',import.meta.url),'utf8');
function fixture(t){
 const dom=new JSDOM('<body><nav id="tabs"><button data-tab="home">My day</button><button class="active" data-tab="tasks">Tasks</button></nav><main id="view"><input id="draft" value="Uncommitted"></main></body>',{url:'https://example.test/',runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 const w=dom.window,d=w.document,frames=new Map(),animations=[];let number=0,ready=true,owner='one',reduced=false,prefs={motion:'calm'};
 const media={get matches(){return reduced;},addEventListener(){}};w.matchMedia=()=>media;
 w.requestAnimationFrame=fn=>{frames.set(++number,fn);return number;};w.cancelAnimationFrame=id=>frames.delete(id);
 const nav=d.getElementById('tabs'),buttons=[...nav.querySelectorAll('button')];
 const box=(left,top,width,height)=>({left,top,width,height,right:left+width,bottom:top+height});
 nav.getBoundingClientRect=()=>box(10,20,200,180);
 buttons.forEach((b,i)=>{b.getBoundingClientRect=()=>box(18,30+i*44,180,40);b.getClientRects=()=>b.hidden?[]:[b.getBoundingClientRect()];});
 d.getElementById('view').animate=(keys,options)=>{const a={keys,options,cancelled:false,cancel(){this.cancelled=true;}};animations.push(a);return a;};
 w.eval(source);const ui=w.WorkHubVisualRefinement.install({ready:()=>ready,owner:()=>owner,prefs:()=>prefs});
 const flush=()=>{const pending=[...frames.values()];frames.clear();for(const fn of pending)fn();};
 return{w,d,ui,buttons,animations,flush,setReady(value){ready=value;},setOwner(value){owner=value;},setMotion(value){prefs.motion=value;},setReduced(value){reduced=value;}};
}
test('visual refinement preserves real route controls, a typed draft and focus through page changes',t=>{
 const x=fixture(t),{d,ui,buttons,animations,flush}=x,input=d.getElementById('draft');input.value='Keep exactly 0001';input.focus();input.setSelectionRange(5,9);
 ui.mount('home');flush();ui.mount('tasks');flush();
 assert.deepEqual([...d.querySelectorAll('#tabs button')],buttons);assert.equal(d.getElementById('draft'),input);assert.equal(input.value,'Keep exactly 0001');assert.equal(d.activeElement,input);assert.equal(input.selectionStart,5);
 assert.equal(animations.length,1);ui.mount('tasks');flush();assert.equal(animations.length,1);
 assert.equal(d.querySelectorAll('#vsNavIndicator').length,1);assert.equal(d.getElementById('vsNavIndicator').getAttribute('aria-hidden'),'true');
 buttons[1].hidden=true;ui.measureNavigation();assert.equal(d.getElementById('vsNavIndicator').hidden,true);
});
test('visual refinement respects reduced motion and stops when the account closes',t=>{
 const x=fixture(t),{ui,d,animations,flush}=x;ui.mount('home');flush();ui.mount('tickets');flush();assert.equal(animations.length,1);
 x.setMotion('off');ui.mount('tasks');flush();assert.equal(animations.length,1);assert.equal(animations[0].cancelled,true);assert.equal(d.getElementById('vsNavIndicator').dataset.motion,'off');
 x.setMotion('calm');x.setReduced(true);ui.mount('notes');flush();assert.equal(animations.length,1);
 x.setReady(false);ui.mount('home');flush();assert.equal(d.getElementById('vsNavIndicator'),null);assert.equal(d.body.dataset.vs,undefined);assert.equal(d.body.style.getPropertyValue('--vs-glyph'),'');
});
test('visual refinement supplies distinct section art and conservative status meanings',t=>{
 const {w}=fixture(t),V=w.WorkHubVisualRefinement;
 assert.equal(Object.keys(V.PAGES).length,15);assert.notEqual(V.artwork('files'),V.artwork('tasks'));
 assert.equal(V.tone('Closed'),'positive');assert.equal(V.tone('In Progress'),'progress');assert.equal(V.tone('Work In Progress'),'progress');assert.equal(V.tone('Not started yet'),'quiet');assert.equal(V.tone('On hold'),'caution');assert.equal(V.tone('Critical'),'negative');assert.equal(V.tone('Not completed'),'');assert.equal(V.tone('Custom status'),'');
});
