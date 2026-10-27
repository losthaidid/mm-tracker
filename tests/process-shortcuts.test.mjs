import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';

test('Process shortcuts are scoped, preserve typing and native undo, and ignore composition, alternate modifiers and repeats', t => {
 const dom=new JSDOM('<main id="hub"><button>Canvas control</button><input><textarea></textarea><div contenteditable="true"><span>Typing</span></div></main><button id="outside">Other section</button>',{runScripts:'outside-only'});t.after(()=>dom.window.close());
 const {window:w}=dom,d=w.document;w.eval(readFileSync(new URL('../process-shortcuts.js',import.meta.url),'utf8'));const shortcuts=w.WorkHubProcessShortcuts,calls=[],surface=d.getElementById('hub');
 d.addEventListener('keydown',e=>shortcuts.dispatch(e,{surface,run:command=>calls.push(command)}),true);
 const press=(target,key,init={})=>{const e=new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...init});target.dispatchEvent(e);return e.defaultPrevented;};
 const button=surface.querySelector('button');assert.equal(press(button,'v'),true);assert.deepEqual(calls,['select']);assert.equal(press(button,'v',{repeat:true}),true);assert.equal(calls.length,1);
 for(const target of [surface.querySelector('input'),surface.querySelector('textarea'),surface.querySelector('span')]){
  for(const key of ['p','e','Delete','Backspace','?'])assert.equal(press(target,key),false);
  for(const key of ['a','z'])assert.equal(press(target,key,{ctrlKey:true}),false);
  assert.equal(press(target,'s',{metaKey:true}),true);
 }
 for(const init of [{altKey:true},{isComposing:true},{ctrlKey:true,shiftKey:true}])assert.equal(press(button,'z',init),false);
 assert.equal(press(d.getElementById('outside'),'p'),false);assert.equal(press(button,'k',{ctrlKey:true}),false);
 assert.equal(press(button,'+',{shiftKey:true}),true);assert.equal(calls.at(-1),'zoom-in');
 assert.equal(press(button,'?',{shiftKey:true}),true);assert.equal(calls.at(-1),'help');
 assert.equal(shortcuts.match({key:'b',target:button},{presenter:false}),null);assert.equal(shortcuts.match({key:'b',target:button},{presenter:true}),'pen');
 assert.equal(shortcuts.match({key:'Delete',target:button},{readOnly:true}),null);assert.equal(shortcuts.match({key:'p',target:button},{readOnly:true}),'play');
});
