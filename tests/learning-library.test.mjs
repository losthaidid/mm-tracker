import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import '../learning-core.js';
import '../knowledge-garden.js';
import '../purchasing-guide.js';
const read = name => JSON.parse(readFileSync(new URL('../learning/' + name, import.meta.url), 'utf8'));
const book = read('mm-101.json'), guide = read('purchase-fields.json')[0];
const official = url => /^https:\/\/(help|learning|userapps\.support)\.sap\.com\//.test(url);

test('Every published SAP MM chapter has a shelf, an illustration and primary references', () => {
  assert.equal(book.length,49);
  assert.equal(new Set(book.map(c=>c.id)).size,book.length);
  assert.equal(new Set(book.map(c=>c.shelf)).size,5);
  assert.equal(new Set(book.map(c=>c.level)).size,4);
  for (const c of book) {
    assert.ok(c.lead && c.sections.length >= 2 && c.sections.every(([name,body])=>name && body),c.id);
    assert.ok(c.visual.rows.length >= 2 && c.visual.rows.every(row=>row.length===c.visual.headers.length),c.id);
    assert.ok(c.refs.every(([name,url])=>name && official(url)) && c.refs.length>=2,c.id);
    if (c.chart) assert.ok(c.chart[2].every(([label,n])=>label && Number.isFinite(n) && n>=0),c.id);
  }
});

test('All purchasing lessons resolve to existing screen areas, scenarios and related fields', () => {
  const ids = new Set(guide.fields.map(f=>f.id));
  assert.equal(ids.size,93);
  assert.equal(ids.size,guide.fields.length);
  for (const [name,group] of Object.entries(guide.groups)) {
    assert.ok(group.slice(0,5).every(Boolean) && official(group[6]),name);
    for(const id of group[5].split(' ')) assert.ok(ids.has(id),name+' / '+id);
  }
  for(const f of guide.fields){
    assert.ok(guide.groups[f.topic], f.id);
    assert.ok(['purpose','origin','control','effect','trace','qa'].every(k=>f[k]?.trim()),f.id);
    assert.ok(Object.keys(f.places).length && Object.values(f.places).every(([area,code])=>area && typeof code==='string'),f.id);
    if(f.scenarios) assert.ok(f.scenarios.length===4 && f.scenarios.every(Boolean),f.id);
  }
  assert.equal(guide.fields.find(f=>f.id==='gr').places.PO[1],'EKPO-WEPOS');
});

test('Removing a folder preserves colliding child names and references, and validation rejects broken relationships',()=>{
  const G = globalThis.WorkHubKnowledgeGarden;
  const h = {knowledgeFolders:[
    {id:'old',name:'Archive',parentId:''}, {id:'same',name:'Cases',parentId:''},
    {id:'a',name:'Cases',parentId:'old'}, {id:'b',name:'Samples',parentId:'a'}
  ],notes:[{id:'note',folderId:'old'}],knowledgeChapters:{private:{folderId:'old',body:'Keep this'}}};
  G.validate(h);G.removeFolder(h,'old');G.validate(h);
  assert.equal(h.knowledgeFolders.find(f=>f.id==='a').name,'Cases (2)');
  assert.equal(h.knowledgeFolders.find(f=>f.id==='b').parentId,'a');
  assert.equal(h.notes[0].folderId,'');
  assert.deepEqual(h.knowledgeChapters.private,{folderId:'',body:'Keep this'});
  assert.throws(()=>G.validate({...h,knowledgeFolders:[{id:'x',parentId:'x',name:'X'}]}),/parent/);
  assert.throws(()=>G.validate({...h,knowledgeChapters:{private:{folderId:'gone'}}}),/chapter/);
  assert.throws(()=>globalThis.WorkHubPurchasingGuide.validate({learning:{exercises:true,fields:{'BAD/field':{studied:true}}}}),/study field/);
});
