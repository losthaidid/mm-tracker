import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
function modules(t) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'https://example.test/' });
  t.after(() => dom.window.close());
  for (const f of ['experience-appearance.js','command-palette.js','file-launcher.js','summary-cards.js']) dom.window.eval(readFileSync(new URL('../'+f, import.meta.url), 'utf8'));
  return dom.window;
}
test('Kept experience: extracted palettes are deterministic, ignore transparency, and keep readable text', t => {
  const w=modules(t), A=w.WorkHubExperienceAppearance, pixels=[];
  for(let i=0;i<100;i++) pixels.push(20,140,100,255);
  for(let i=0;i<80;i++) pixels.push(245,240,230,255);
  for(let i=0;i<1000;i++) pixels.push(255,0,255,0);
  const p=A.extract(pixels);assert.equal(p.options[0].accent,'#148c64');assert.equal(JSON.stringify(p),JSON.stringify(A.extract(pixels)));
  for(const o of p.options) { assert.ok(A.contrast(o.colors.text,o.colors.page)>=4.5); assert.ok(A.contrast(o.colors.text,o.colors.surface)>=4.5); }
  assert.throws(()=>A.extract([0,0,0,0]),/transparent/);
  const settings={};A.upgrade(settings);A.validate(settings);settings.branding.mode='logo';assert.throws(()=>A.validate(settings),/icon/);settings.branding.image='data:image/svg+xml,<script/>';assert.throws(()=>A.validate(settings),/icon/);
});
test('Kept experience: search matches several terms across title, status and details and escapes previews', t => {
  const w=modules(t), C=w.WorkHubCommandPalette, rows=[{id:'1',title:'<img src=x>',type:'ticket',group:'Records',detail:'Timeout on network',meta:'Ticket · Open'}, {id:'go:tasks',title:'Open Tasks',type:'command',group:'Pages',detail:'Browse tasks'}];
  assert.equal(C.search(rows,'OPEN network').length,1);w.document.body.innerHTML=C.render(rows,'');assert.equal(w.document.querySelector('img'),null);assert.equal(w.document.querySelectorAll('[data-command-index]').length,2);assert.match(w.document.body.textContent,/Pages.*Records/s);
});
test('Kept experience: file destinations match real formats, limits, permissions and setup', t => {
  const w=modules(t), F=w.WorkHubFileLauncher, a={can:()=>true,templateReady:()=>false,activeProject:()=>false,driveReady:()=>false};
  let c=F.choices({name:'data.xlsx',size:10},a);assert.ok(c.find(r=>r.id==='excel-report'&&!r.disabled));assert.match(c.find(r=>r.id==='validator').disabled,/template/);assert.match(c.find(r=>r.id==='issues').disabled,/project/);assert.match(c.find(r=>r.id==='drive').disabled,/Connect/);
  c=F.choices({name:'old.xls',size:10},a);assert.equal(c.some(r=>r.id==='validator'),false);
  c=F.choices({name:'manual.pdf',size:21000000},a);assert.equal(c.some(r=>r.id==='guide'),false);assert.ok(c.find(r=>r.id==='statement').disabled);
  c=F.choices({name:'photo.png',size:9000000},a);assert.ok(c.find(r=>r.id==='guide').disabled);
  assert.equal(F.choices({name:'data.json',size:5},a).some(r=>r.id==='issues'),false);
  c=F.choices({name:'data.json',size:5},{...a,can:()=>false});assert.equal(c.length,0);
});
test('Kept experience: summary models exclude denied sources and bound selection without hidden record fields', t => {
  const w=modules(t), S=w.WorkHubSummaryCards, state={tickets:[{id:'1',ticket:'T1',description:'A',history:'private history',status:'Open'}],tasks:[{id:'2',task:'Private task'}],projects:[]};
  const rows=S.records(state,(f)=>f==='tickets');assert.equal(rows.length,1);assert.equal(JSON.stringify(rows).includes('private history'),false);assert.equal(JSON.stringify(rows).includes('Private task'),false);
  assert.throws(()=>S.model([],{}),/1 and 6/);assert.throws(()=>S.model(Array(7).fill(rows[0]),{}),/1 and 6/);
  const m=S.model(rows,{title:'Weekly update',accent:'red'});assert.equal(m.accent,'#86d9c0');assert.equal(m.rows[0].title,'T1');
  const ctx={measureText:v=>({width:v.length*10})};assert.deepEqual(Array.from(S.wrap(ctx,'A very long identifier without spaces',100,2)).length,2);assert.match(S.wrap(ctx,'123456789012345678901234567890',100,2).at(-1),/…$/);
});
