import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import '../english-coach-engine.js';
import '../english-coach-rich.js';

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
