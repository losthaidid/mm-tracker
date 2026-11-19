import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const context = createContext({});
for (const file of ['mm-configuration-data.js', 'mm-configuration-engine.js', 'mm-knowledge-data.js', 'sap-terms-data.js', 'sap-transaction-scenarios.js', 'sap-terms.js']) {
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

test('Account reference categories cover the catalog once and combine with scenario, edition, type and search', () => {
  const { categories } = context.WorkHubSapTermsData;
  const categorized = Object.keys(categories).flatMap(category => {
    const rows = Array.from(search('', '', '', '', category));
    assert.ok(rows.length, category + ' must contain entries');
    assert.ok(rows.every(row => row.category === category));
    return rows.map(row => row.id);
  });
  assert.equal(new Set(categorized).size, entries.length);
  assert.equal(categorized.length, entries.length);
  assert.deepEqual(categorized.sort(), Array.from(ids).sort());
  const hit = (...args) => Array.from(search(...args), row => row.id);
  assert.deepEqual(hit('501', 'modifier', 'ecc', 'without-po', 'inventory'), ['GBB/ZOB']);
  assert.deepEqual(hit('', 'key', 'cloud', 'fixed-asset', 'inventory'), ['BSX']);
  assert.deepEqual(hit('551', 'modifier', 'ecc', '', 'consumption'), ['GBB/VNG']);
  assert.deepEqual(hit('WRX', '', '', '', 'inventory'), []);
  assert.deepEqual(hit('', '', 'historical', '', 'historical').sort(), ['KDV', 'PRP', 'PRQ', 'PRV', 'WRY']);
  assert.deepEqual(hit('', 'modifier', '', '', 'historical'), []);
  assert.deepEqual(hit('', '', '', '', 'unknown-category'), []);
});

test('Transaction scenarios cover the Terms catalog, configuration models, and their movements and reversals', () => {
  const { scenarios, groups } = context.WorkHubSapTransactionScenarios;
  const config = context.WorkHubMmConfigurationData;
  const modelIds = new Set(scenarios.map(row => row.modelId));
  const movementIds = new Set(scenarios.flatMap(row => row.movements.map(code => code.split(' ')[0])));
  const covered = new Set(scenarios.flatMap(row => search('', '', '', row.id).map(entry => entry.id)));
  const guideIds = new Set(guides.map(guide => guide.id));
  assert.equal(new Set(scenarios.map(row => row.id)).size, scenarios.length);
  assert.equal(covered.size, entries.length);
  for (const model of config.scenarios) assert.ok(modelIds.has(model.id), model.id);
  for (const move of config.moves) {
    assert.ok(movementIds.has(move.code), move.code);
    assert.ok(!move.reversal || movementIds.has(move.reversal), move.reversal);
  }
  for (const row of scenarios) {
    assert.ok(groups[row.group] && row.label && row.demo.setup && row.demo.postings.length, row.id);
    assert.ok(row.editions.length && row.editions.every(edition => edition === 'historical' || Object.hasOwn(editions, edition)), row.id);
    assert.ok(row.sources.length && row.sources.every(([, url]) => url.startsWith('https://')), row.id);
    assert.ok(row.guides.every(id => guideIds.has(id)), row.id);
    for (const step of row.demo.postings) {
      assert.ok(step.title && step.effect, row.id);
      if (step.lookup || step.outcome) continue;
      const sum = lines => lines.reduce((total, line) => total + Math.round(line.amount * 100), 0);
      assert.ok([...step.debit, ...step.credit].every(line => line.account && line.amount > 0), row.id);
      assert.equal(sum(step.debit), sum(step.credit), row.id + ' ' + step.title);
    }
  }
});

test('Transaction scenarios distinguish posting context even when the movement type is shared', () => {
  const hit = (id, query = '', kind = '', edition = '') => Array.from(search(query, kind, edition, id), item => item.id);
  assert.deepEqual(hit('without-po'), ['BSX', 'GBB', 'GBB/ZOB']);
  assert.deepEqual(hit('without-po', '501', 'modifier'), ['GBB/ZOB']);
  assert.deepEqual(hit('without-po', 'WRX'), []);
  assert.deepEqual(hit('po-stock', '101'), ['BSX', 'WRX']);
  assert.deepEqual(hit('production-gr', '101').sort(), ['BSX', 'GBB', 'GBB/AUF']);
  assert.deepEqual(hit('fixed-asset', '241', '', 'cloud'), ['BSX']);
  assert.deepEqual(hit('storage-one'), []);
  assert.deepEqual(hit('fixed-asset', '', '', 'historical'), []);
});
