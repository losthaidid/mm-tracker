import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {test} from 'node:test';
import {JSDOM} from 'jsdom';

const root=new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',root),'utf8');

test('production loads existing local assets, engines before interfaces, and the application last',t=>{
 const dom=new JSDOM(html,{url:'https://losthaidid.github.io/mm-tracker/'});t.after(()=>dom.window.close());
 const {document}=dom.window;
 const scripts=[...document.querySelectorAll('script[src]')].map(s=>new URL(s.src).pathname.split('/mm-tracker/')[1]);
 const styles=[...document.querySelectorAll('link[rel="stylesheet"]')].map(s=>new URL(s.href).pathname.split('/mm-tracker/')[1]);
 for(const file of [...scripts,...styles])assert.ok(existsSync(new URL(file,root)),file+' exists');
 assert.equal(new Set(scripts).size,scripts.length);
 assert.equal(scripts.at(-1),'app.js');assert.equal(styles[0],'base.css');assert.equal(styles.at(-1),'custom.css');
 for(const [before,after]of [['vendor/jszip.min.js','app.js'],['tng-wallet.js','tng-engine.js'],['tng-engine.js','tng-files.js'],['studio.js','app.js'],['my-day-engine.js','my-day.js'],['my-day-visuals.js','my-day.js'],['my-day.js','studio.js'],['validator-engine.js','validator-studio.js'],['validator-files.js','validator-studio.js'],['leave-balance-engine.js','leave-balances.js'],['leave-balances.js','studio.js'],['claims-engine.js','claims.js'],['recipients-engine.js','recipients.js'],['work-library-engine.js','work-library.js']])assert.ok(scripts.indexOf(before)<scripts.indexOf(after),before+' before '+after);
 for(const [before,after]of [['rehearsal-engine.js','process-hub-files.js'],['process-hub-files.js','rehearsal.js'],['presentation-break.js','focus-panel.js'],['rest-audio.js','rest-room.js'],['rest-room.js','my-day.js']])assert.ok(scripts.indexOf(before)<scripts.indexOf(after));
 assert.ok(styles.indexOf('my-day.css')<styles.indexOf('my-day-visuals.css'));assert.ok(styles.indexOf('my-day-visuals.css')<styles.indexOf('rest-room.css'));
 assert.ok([...document.querySelectorAll('script:not([src])')].every(s=>s.type==='application/json'),'page only embeds JSON, not executable application code');
 const seed=JSON.parse(document.getElementById('seedData').textContent);
 for(const name of ['tickets','trackers','tasks','specs','schedule'])assert.deepEqual(seed[name],[],name+' starts empty');
});

test('production and development previews share the supplied ZIP reader',()=>{
 const vendor=readFileSync(new URL('vendor/jszip.min.js',root),'utf8');assert.match(vendor,/JSZip v3\.10\.1/);assert.match(vendor,/MIT license/);
 assert.ok(!existsSync(new URL('tests/validator-zip.js',root)));
 for(const file of ['tests/validator-preview.html','tests/wishlist-preview.html'])assert.match(readFileSync(new URL(file,root),'utf8'),/\.\.\/vendor\/jszip\.min\.js/);
});
