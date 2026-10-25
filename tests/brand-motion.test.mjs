import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';
test('Animated identity keeps maintained titles literal, supports keyboard/home actions and reuses its artwork between renders',t=>{
 const dom=new JSDOM('<div class="hub-header-brand"><span class="hub-brand-mark"></span><h1 id="title"></h1></div>',{runScripts:'outside-only'});t.after(()=>dom.window.close());const w=dom.window,d=w.document;
 w.eval(readFileSync(new URL('../brand-motion.js',import.meta.url),'utf8'));
 const brand=d.querySelector('.hub-header-brand'),title=d.getElementById('title');title.textContent='My <WorkHub> ✨';title.dataset.brandTitle=title.textContent;let homes=0;
 w.WorkHubBrandMotion.mount(brand,title,()=>homes++);const svg=brand.querySelector('svg'),button=title.querySelector('button');
 assert.equal(button.getAttribute('aria-label'),'My <WorkHub> ✨ · Go to My day');assert.equal(d.querySelector('workhub'),null);assert.equal(title.textContent,'My <WorkHub> ✨');
 button.click();assert.equal(homes,1);assert.ok(brand.classList.contains('brand-energised'));
 brand.querySelector('[data-epic-brand]').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.equal(homes,2);
 w.WorkHubBrandMotion.mount(brand,title,()=>homes++);assert.equal(brand.querySelector('svg'),svg);assert.equal(title.querySelector('button'),button);
 title.textContent='Renamed space';title.dataset.brandTitle='Renamed space';w.WorkHubBrandMotion.mount(brand,title,()=>homes++);assert.equal(title.querySelector('button').getAttribute('aria-label'),'Renamed space · Go to My day');assert.equal(brand.querySelector('svg'),svg);
});
