import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import '../english-grammar-data.js';
import '../english-grammar-checks.js';
import '../english-coach-engine.js';
import '../english-coach-rich.js';

test('grammar lessons cover three levels and every live feedback link resolves', () => {
  const { groups, byId } = globalThis.WorkHubEnglishGrammarData;
  const { lessons, ruleLinks, validState } = globalThis.WorkHubEnglishCoachEngine;
  assert.deepEqual([...new Set(groups.map(group => group.level))].sort(), ['Advanced','Foundations','Intermediate']);
  assert.equal(byId.size, groups.flatMap(group => group.lessons).length);
  assert.equal(byId.size, 98);
  assert.deepEqual(Object.keys(ruleLinks).sort(), Object.keys(lessons).sort());
  assert.ok(Object.values(ruleLinks).every(id => byId.has(id)));
  for (const row of byId.values()) {
    for (const key of ['title','pattern','explanation','email','teams','mistake','prompt','answer','alternative','reason'])
      assert.ok(row[key].trim(), row.id + ' ' + key);
    assert.notEqual(row.answer, row.alternative, row.id);
  }
  assert.deepEqual(validState({ draft:'Existing draft', grammar:{
    completed:['past-participles','past-participles','invalid'],
    last:'invalid',
  }}).grammar, {completed:['past-participles'], last:''});
  assert.deepEqual(validState().grammar, {completed:[], last:''});
});

test('English Coach checks common mistakes, honours writing style, and preserves procurement terminology', () => {
  const E = globalThis.WorkHubEnglishCoachEngine;
  const draft = 'The changes is ready. We have wrote the update. Kindly revert. Ping me when the PO is ready.';
  const matches = E.check(draft,'email');
  assert.deepEqual(matches.map(issue => issue.replacement), ['The changes are','have written','Please reply','Let me know']);
  assert.ok(matches.every(issue => draft.slice(issue.start,issue.end) === issue.original));
  assert.equal(E.check('Does the order have a plant? We discussed it. One of the project teams called.', 'email').length, 0);
  assert.equal(E.check('Please send the PO when you have a chance.', 'teams').length, 0);
  assert.equal(E.check('Ping me at your earliest convenience.', 'teams')[0].replacement, 'when you have a chance');
  assert.ok(Object.values(E.lessons).every(row => row.title && row.choices.length === 2));
});

test('English Coach rich clipboard keeps supported styles, lists and table values and strips active markup', t => {
  const { window } = new JSDOM('');
  t.after(() => window.close());
  const { document } = window, R = globalThis.WorkHubEnglishCoachRichText;
  const html = '<p><strong>Review</strong> <em>today</em> <span onclick="alert(1)" style="color:red;background-color:#fef08a">PO</span></p>' +
    '<ul><li>Verify quantity</li></ul><ol><li>Approve</li></ol>' +
    '<table><tr><th>Plant</th><th>Status</th></tr><tr><td>A</td><td>Ready</td></tr></table>' +
    '<script>alert(1)</script><img src="https://example.invalid/pixel"><a href="javascript:alert(1)">Reference</a>';
  const container = document.createElement('div');
  container.innerHTML = R.sanitize(document,html,true);
  assert.match(container.innerHTML, /<strong>Review<\/strong> <em>today<\/em>/);
  assert.equal(container.querySelector('span').style.color,'red');
  assert.ok(container.querySelector('span').style.backgroundColor);
  assert.equal(container.querySelector('img,script,a,[onclick]'),null);
  assert.match(container.querySelector('td').getAttribute('style'), /border/);
  assert.equal(R.plainText(container), 'Review today PO\n• Verify quantity\n1. Approve\nPlant\tStatus\nA\tReady\nReference');

  container.innerHTML = '<p>The <strong>changes</strong> is ready.</p><p>Next steps</p>';
  const {text,pieces} = R.linear(container);
  const issue = globalThis.WorkHubEnglishCoachEngine.check(text,'email')[0];
  assert.equal(R.range(document,pieces,issue).toString(), 'The changes is');
  container.innerHTML = R.tableHTML(3,2);
  assert.equal(container.querySelectorAll('tr').length,3);
  assert.equal(container.querySelectorAll('th').length,2);
});

test('live feedback catches the reported question and keeps valid modal questions', () => {
  const { check } = globalThis.WorkHubEnglishCoachEngine;
  const sample = 'Sorry to keep you waiting. May we has a discussion on something ?  ';
  for (const mode of ['email', 'teams']) {
    const issues = check(sample, mode);
    assert.deepEqual(issues.map(({id, original, replacement}) => [id, original, replacement]), [
      ['modal-base', 'May we has', 'May we have'],
      ['punctuation-spacing', ' ?', '?'],
    ]);
    assert.ok(issues.every(issue => sample.slice(issue.start,issue.end) === issue.original));
  }
  for (const [draft, fixed] of [
    ['Could you please sends the email?', 'Could you please send'],
    ['Can the supplier sent the quote?', 'Can the supplier send'],
    ['The buyer can checked the order.', 'can check'],
    ['Why can’t we just changed this?', 'can’t we just change'],
    ['Should we not has a call?', 'Should we not have'],
    ['Can we proceed\u00a0? I’m ready.', '?'],
  ]) {
    assert.deepEqual(check(draft, 'email').map(issue => issue.replacement), [fixed], draft);
  }
  for (const draft of [
    'Sorry to keep you waiting. May we have a discussion on something?',
    'Can checks run now? When can reviews resume?',
    'Can the supplier send the quote? Shall we discuss it?',
    'Could you please check the PO? May I have the printout?',
    'The formula is ready ? success : wait.',
    'https://example.invalid/page?row=50',
    'Can\nwe reached him?',
  ]) {
    assert.deepEqual(check(draft,'email'), [], draft);
  }
});
