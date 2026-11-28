import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../english-grammar-data.js';
import '../english-grammar-checks.js';
import '../english-coach-engine.js';
import {
  corrections,
  reviews,
  inContext,
  additionalCorrections,
  validLookalikes,
} from './fixtures/english-standard-examples.mjs';

const { byId, contextNotes } = globalThis.WorkHubEnglishGrammarData;
const { check, ruleLinks } = globalThis.WorkHubEnglishCoachEngine;

function applied(draft, issues) {
  const edits = issues.flatMap(issue => issue.edit ? [issue.edit] : []);
  for (const { start, end, replacement } of edits.sort((a, b) => b.start - a.start)) {
    draft = draft.slice(0, start) + replacement + draft.slice(end);
  }
  return draft;
}

test('the independent audit covers every Grammar Library lesson', () => {
  const ids = [...corrections, ...reviews, ...inContext].map(([id]) => id).sort();
  assert.deepEqual(ids, [...byId.keys()].sort());
  assert.deepEqual(inContext.map(([id]) => id).sort(), Object.keys(contextNotes).sort());
});

const agreementMatrix = [];
for (const [single, several] of [
  ['the new report', 'the new reports'],
  ['your supervisor’s file', 'your supervisor’s files'],
  ['the news report', 'the news reports'],
  ['her delivery', 'her deliveries'],
  ['that box', 'those boxes'],
]) {
  agreementMatrix.push(
    [`Is ${several} ready?`, `Are ${several} ready?`],
    [`When was ${several} delivered?`, `When were ${several} delivered?`],
    [`Has ${several} been checked?`, `Have ${several} been checked?`],
  );
  agreementMatrix.push(
    [`Are ${single} ready?`, `Is ${single} ready?`],
    [`When were ${single} delivered?`, `When was ${single} delivered?`],
    [`Have ${single} been checked?`, `Has ${single} been checked?`],
  );
}
for (const [single, several] of [['her brother', 'her brothers'], ['our manager', 'our managers']]) {
  agreementMatrix.push(
    [`Do ${single} work here?`, `Does ${single} work here?`],
    [`Does ${several} work here?`, `Do ${several} work here?`],
  );
}

const drafts = [
  [
    'Hello Sam,\n\nOne of the invoices was misplaced. Why have the delivery been delayed?\nThe supplier updated there address yesterday.\n\nThanks,\nMina',
    'Hello Sam,\n\nOne of the invoices was misplaced. Why has the delivery been delayed?\nThe supplier updated their address yesterday.\n\nThanks,\nMina',
  ],
  [
    'Quick update.  Me and my friend checked the form. On Friday, me and my cousin will submit it.\nCan you confirm why does she need it?',
    'Quick update.  My friend and I checked the form. On Friday, my cousin and I will submit it.\nCan you confirm why she needs it?',
  ],
];

for (const mode of ['email', 'teams']) {
  test(`Standard English corrections and valid usage in ${mode}`, () => {
    const scenarios = [
      ...corrections.map(([, example, corrected]) => [example, corrected]),
      ...additionalCorrections,
      ...agreementMatrix,
      ...drafts,
    ];
    const failures = [];
    for (const [draft, expected] of scenarios) {
      const issues = check(draft, mode);
      const result = applied(draft, issues);
      if (result !== expected) failures.push({ draft, expected, result });
      for (const issue of issues) {
        assert.equal(draft.slice(issue.start, issue.end), issue.original);
        if (issue.edit) {
          assert.equal(
            applied(draft, [issue]),
            draft.slice(0, issue.start) + issue.replacement + draft.slice(issue.end),
            draft,
          );
        }
      }
    }
    const valid = new Set([
      ...scenarios.map(([, expected]) => expected),
      ...inContext.flatMap(([, ...examples]) => examples),
      ...validLookalikes,
    ]);
    for (const draft of valid) {
      const issues = check(draft, mode);
      if (issues.length) failures.push({ draft, unexpected: issues.map(issue => issue.replacement ?? issue.reason) });
    }
    assert.deepEqual(failures, []);
  });

  test(`Review-only suggestions in ${mode} explain the problem without changing meaning`, () => {
    for (const [lesson, draft] of reviews) {
      const issues = check(draft, mode);
      assert.ok(issues.some(issue => ruleLinks[issue.id] === lesson && issue.reason), lesson);
      assert.equal(applied(draft, issues), draft);
    }
  });
}
