import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const context = createContext({});
for (const file of ['mm-configuration-data.js', 'mm-knowledge-data.js', 'sap-terms-data.js', 'sap-terms.js']) {
  runInContext(readFileSync(new URL('../' + file, import.meta.url), 'utf8'), context);
}
const { entries, refs } = context.WorkHubSapTermsData;
const { search, highlights } = context.WorkHubSapTerms;
const { editions, guides } = context.WorkHubMmKnowledgeData;
const ids = new Set(entries.map(entry => entry.id));

test('SAP Terms cover the IMG transaction list and standard groupings with complete examples', () => {
  const classicKeys = 'AG1 AG2 AG3 AKO AUM BO1 BO2 BO3 BSD BSV BSX COC DEL DIF EIN EKG FRE FR1 FR2 FR3 FR4 FRL FRN GBB KBS KDG KDM KDR KDV KON KTR LKW PRA PRC PRD PRG PRK PRL PRM PRP PRQ PRV PRY RAP RKA RUE TXO UMB UMD UPF VST WGB WGI WGR WPA WPM WRX WRY';
  for (const key of classicKeys.split(' ')) assert.ok(ids.has(key), key);
  const expectedGroups = [
    ...'AUA AUF AUI BSA INV VAX VAY VBO VBR VKA VKP VNG VQP VQY ZOB ZOF'.split(' ').map(code => 'GBB/' + code),
    'KON/PIP', 'KON/blank', 'PRD/PRA', 'PRD/PRF', 'PRD/PRU', 'PRD/blank',
  ];
  assert.deepEqual(Array.from(search('', 'modifier'), entry => entry.id).sort(), expectedGroups.sort());
  assert.equal(ids.size, entries.length);
  const guideIds = new Set(guides.map(guide => guide.id));
  for (const entry of entries) {
    assert.ok(entry.title && entry.explanation && entry.check && entry.demo.setup, entry.id);
    assert.ok(entry.historical ? entry.editions.length === 0 : entry.editions.length > 0, entry.id);
    assert.ok(entry.editions.every(edition => Object.hasOwn(editions, edition)), entry.id);
    assert.ok(entry.sources.length && entry.sources.every(id => refs[id]?.[1]?.startsWith('https://')), entry.id);
    assert.ok(entry.guides.length && entry.guides.every(id => guideIds.has(id)), entry.id);
    let featured = false;
    for (const posting of entry.demo.postings) {
      assert.ok(posting.title && posting.effect, entry.id);
      if (posting.lookup) {
        assert.ok(posting.lookup.account, entry.id);
        featured ||= highlights(entry, posting.lookup.code);
        continue;
      }
      const sum = rows => rows.reduce((total, row) => total + Math.round(row.amount * 100), 0);
      const lines = [...posting.debit, ...posting.credit];
      for (const line of lines) {
        assert.ok(line.account && Number.isFinite(line.amount) && line.amount > 0, entry.id);
        assert.ok(!line.code || ids.has(line.code), `${entry.id} references ${line.code}`);
      }
      assert.equal(sum(posting.debit), sum(posting.credit), entry.id);
      featured ||= lines.some(line => highlights(entry, line.code));
    }
    assert.ok(featured, `${entry.id} should appear in its own example`);
  }
});

test('SAP Terms search finds codes, context, and the right edition and kind', () => {
  const hit = (query, kind, edition) => Array.from(search(query, kind, edition), entry => entry.id);
  assert.equal(hit('GBB/VNG')[0], 'GBB/VNG');
  assert.equal(hit('551')[0], 'GBB/VNG');
  assert.equal(hit('scrapping')[0], 'GBB/VNG');
  assert.equal(hit('vbr')[0], 'GBB/VBR');
  assert.equal(hit('GBBVBR')[0], 'GBB/VBR');
  assert.equal(hit('B01')[0], 'BO1');
  assert.deepEqual(hit('PRA').slice(0, 2), ['PRA', 'PRD/PRA']);
  assert.deepEqual(hit('PRA', 'modifier'), ['PRD/PRA']);
  assert.equal(hit('WRY', '', 'ecc').length, 0);
  assert.equal(hit('WRY', '', 'historical')[0], 'WRY');
  assert.equal(hit('TM1', '', 'cloud')[0], 'TM1');
  assert.equal(hit('TM1', '', 'ecc').length, 0);
});
