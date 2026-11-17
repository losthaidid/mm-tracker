import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const context = createContext({});
for (const file of ['mm-configuration-data.js', 'mm-knowledge-data.js', 'mm-knowledge.js']) {
  runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
}
const { editions, areas, guides, sources } = context.WorkHubMmKnowledgeData;
const { search } = context.WorkHubMmKnowledge;
const ids = new Set(guides.map(guide => guide.id));
const hit = (query, edition, area) => Array.from(search(query, edition, area), row => row.guide.id);

test('MM Knowledge guides include prerequisites, practical tests and linked SAP references', () => {
  assert.equal(ids.size, guides.length);
  assert.ok(guides.length >= 50);
  assert.equal(new Set(guides.map(guide => guide.area)).size, Object.keys(areas).length);
  for (const guide of guides) {
    assert.ok(guide.title && guide.purpose && Object.hasOwn(areas, guide.area), guide.id);
    for (const field of ['prerequisites', 'steps', 'notes']) {
      assert.ok(guide[field].length && guide[field].every(value => typeof value === 'string' && value.trim()), `${guide.id} ${field}`);
    }
    assert.equal(guide.test.length, 2, guide.id);
    assert.ok(guide.checks.length && guide.checks.every(pair => pair.length === 2 && pair.every(Boolean)), guide.id);
    assert.ok(guide.related.every(id => ids.has(id) && id !== guide.id), guide.id);
    assert.ok(guide.refs.length && guide.refs.every(ref => {
      const url = new URL(sources[ref][1]);
      return url.protocol === 'https:' && ['help.sap.com', 'learning.sap.com', 'community.sap.com', 'userapps.support.sap.com'].includes(url.hostname);
    }), guide.id);
    for (const entry of [...guide.tools, ...guide.routes]) {
      assert.ok(entry.editions.length && entry.editions.every(id => Object.hasOwn(editions, id) && guide.editions.includes(id)), guide.id);
    }
  }
});

test('MM Knowledge searches ordinary phrases, all note matches and compact SAP message codes', () => {
  assert.equal(hit('').length, guides.length);
  assert.ok(hit('Batch Maintenance').includes('batch-master'));
  assert.ok(hit('CLASS for Batch').includes('batch-classes'));
  assert.ok(hit('Classification').includes('class-assignment'));
  assert.ok(hit('no batch proposed').includes('batch-procedure-allocation'));
  assert.ok(hit('GR posted without an accounting document').includes('non-valuated-gr'));
  assert.ok(hit('M8 147').includes('automatic-postings'));
  assert.ok(hit('M8147').includes('automatic-postings'));
  const noteMatches = guides.filter(guide => guide.notes.some(note => note.toLowerCase().includes('earliest expiry')));
  assert.ok(noteMatches.length > 1);
  const results = search('earliest expiry');
  for (const guide of noteMatches) {
    assert.match(results.find(result => result.guide.id === guide.id).note, /earliest expiry/i);
  }
  assert.equal(hit('zz-wxyz-123456').length, 0);
});

test('MM Knowledge filters editions and documents the supported maintenance screens', () => {
  assert.ok(hit('release strategy', 'ecc').includes('classic-release'));
  assert.ok(!hit('release strategy', 'cloud').includes('classic-release'));
  assert.ok(hit('MBC2', 'cloud', 'batch').includes('batch-strategy-records'));
  assert.ok(hit('102148', 'cloud', 'batch').includes('batch-procedure-allocation'));
  assert.ok(hit('102909', 'cloud').includes('po-types'));
  assert.equal(hit('102148', 'ecc').length, 0);
  const assignment = guides.find(guide => guide.id === 'class-assignment');
  assert.match(assignment.tools.find(tool => tool.code === 'CL20N').use, /Start from one supported object/);
  assert.match(assignment.tools.find(tool => tool.code === 'CL24N').use, /Start from a class/);
  assert.ok(assignment.notes.some(note => /022\/023.+MSC2N/.test(note)));
  const allocation = guides.find(guide => guide.id === 'batch-procedure-allocation');
  assert.ok(allocation.routes.some(route => route.editions.includes('ecc') && route.path.startsWith('SPRO →')));
  assert.ok(allocation.routes.some(route => route.editions.includes('cloud') && route.path.includes('Allocate IM Search Procedure')));
});
