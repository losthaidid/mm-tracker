import assert from 'node:assert/strict';
import { test } from 'node:test';
import '../english-grammar-data.js';
import '../english-grammar-checks.js';
import '../english-coach-engine.js';

const { groups, byId, contextNotes } = globalThis.WorkHubEnglishGrammarData;
const { check, liveLessons, ruleLinks } = globalThis.WorkHubEnglishCoachEngine;
const modes = ['email', 'teams'];

// Use a different example when the library's main example illustrates a different lesson too.
const alternate = {
  nouns: ['The meeting is on friday.', 'The meeting is on Friday.'],
  verbs: ['We did not to review the invoice.', 'We did not review the invoice.'],
  'past-simple': ['Yesterday I go to the office.', 'Yesterday I went to the office.'],
  'present-perfect': ['I have check the files.', 'I have checked the files.'],
  'irregular-verbs': ['We buyed the equipment.', 'We bought the equipment.'],
  'relative-defining': ['Please use the file, that I attached yesterday.', 'Please use the file that I attached yesterday.'],
  ellipsis: ['I can join the call, but Aisha can’t to join.', 'I can join the call, but Aisha can’t join.'],
  requests: ['Please do the needful.', 'Please take the required action.'],
};
const advisory = new Set(['commas', 'coordination', 'subjunctive', 'tone']);

function applyAll(text, issues) {
  const edits = issues.flatMap(issue => issue.edit ? [issue.edit] : []);
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start) + edit.replacement + text.slice(edit.end);
  }
  return text;
}

test('all 98 lessons have an audited live check or a note about the context to review', () => {
  const topics = Object.keys(contextNotes);
  assert.equal(liveLessons.size, 85);
  assert.equal(topics.length, 13);
  assert.ok(topics.every(id => contextNotes[id].trim() && !liveLessons.has(id)));
  assert.deepEqual([...liveLessons, ...topics].sort(), [...byId.keys()].sort());
});

for (const group of groups) {
  test(`Live Feedback examples for ${group.title}`, () => {
    for (const lesson of group.lessons) {
      const { id } = lesson;
      const [mistake, corrected] = alternate[id] ?? lesson.mistake.split(' → ');
      assert.deepEqual(check(lesson.email, 'email'), [], id + ' email example');
      assert.deepEqual(check(lesson.teams, 'teams'), [], id + ' Teams example');
      for (const mode of modes) {
        const issues = check(mistake, mode);
        if (contextNotes[id]) {
          assert.deepEqual(issues, [], id + ' needs the writer’s context');
          continue;
        }
        assert.ok(issues.some(issue => ruleLinks[issue.id] === id), id + ' missed in ' + mode);
        if (advisory.has(id)) {
          assert.ok(issues.every(issue => issue.replacement === null && !issue.edit), id + ' requires a review');
        } else {
          assert.equal(applyAll(mistake, issues), corrected, id + ' correction in ' + mode);
        }
        assert.deepEqual(check(corrected, mode), [], id + ' corrected example in ' + mode);
        for (const issue of issues.filter(issue => issue.edit)) {
          assert.equal(mistake.slice(issue.start, issue.end), issue.original);
          assert.equal(
            applyAll(mistake, [issue]),
            mistake.slice(0, issue.start) + issue.replacement + mistake.slice(issue.end)
          );
        }
      }
    }
  });
}

const variations = [
  ['I sent a email yesterday.', 'I sent an email yesterday.'],
  ['We waited a hour for a urgent update.', 'We waited an hour for an urgent update.'],
  ['Please add a RFQ and an PO.', 'Please add an RFQ and a PO.'],
  ['We need an useful template.', 'We need a useful template.'],
  ['The report was send yesterday.', 'The report was sent yesterday.'],
  ['The forms were write before the call.', 'The forms were written before the call.'],
  ['Has it been send to the vendor?', 'Has it been sent to the vendor?'],
  ['Are you review the PO now?', 'Are you reviewing the PO now?'],
  ['Are you wait for the supplier?', 'Are you waiting for the supplier?'],
  ['Were you review the PO yesterday?', 'Were you reviewing the PO yesterday?'],
  ['Were you wait for the supplier?', 'Were you waiting for the supplier?'],
  ['This vendor have replied.', 'This vendor has replied.'],
  ['I was interested on the quote.', 'I was interested in the quote.'],
  ['The result depends of the stock level.', 'The result depends on the stock level.'],
  ['This is related with the recent change.', 'This is related to the recent change.'],
  ['That is a equipment.', 'That is some equipment.'],
  ['The childrens are ready.', 'The children are ready.'],
  ['This invoices are ready.', 'These invoices are ready.'],
  ['We received many equipment.', 'We received much equipment.'],
  ['We ordered a little boxes.', 'We ordered a few boxes.'],
  ['Each of the suppliers have a contract.', 'Each of the suppliers has a contract.'],
  ['Every invoice need a number.', 'Every invoice needs a number.'],
  ['Its ready.', 'It’s ready.'],
  ['We is ready. He are waiting. I is ready too.', 'We are ready. He is waiting. I am ready too.'],
  ['There are a file missing. There’s two invoices missing.', 'There is a file missing. There are two invoices missing.'],
  ['She doesn’t needs approval.', 'She doesn’t need approval.'],
  ['We didn’t receive no replies.', 'We didn’t receive any replies.'],
  ['We checks the invoices daily.', 'We check the invoices daily.'],
  ['I am wait now. He was check the file.', 'I am waiting now. He was checking the file.'],
  ['We are review the quote now. I was work when you called.', 'We are reviewing the quote now. I was working when you called.'],
  ['We have saw the revised order.', 'We have seen the revised order.'],
  ['I’ve wrote the instructions.', 'I’ve written the instructions.'],
  ['She had approve the order already.', 'She had approved the order already.'],
  ['We have been review the file.', 'We have been reviewing the file.'],
  ['We had been review the file.', 'We had been reviewing the file.'],
  ['We will have been review the file.', 'We will have been reviewing the file.'],
  ['We will have approve the PO by Monday.', 'We will have approved the PO by Monday.'],
  ['Would the buyer accepted this?', 'Would the buyer accept this?'],
  ['The buyer could accepted the quote.', 'The buyer could accept the quote.'],
  ['We should have review the attachment.', 'We should have reviewed the attachment.'],
  ['Could we have went earlier?', 'Could we have gone earlier?'],
  ['Please avoid to use the wrong material type.', 'Please avoid using the wrong material type.'],
  ['The report, that was attached yesterday, is ready.', 'The report, which was attached yesterday, is ready.'],
  ['We postponed the workshop because the delay.', 'We postponed the workshop because of the delay.'],
  ['They require that it to be approved.', 'They require that it be approved.'],
  ['A number of issues is still open.', 'A number of issues are still open.'],
  ['We cant submit it.', 'We can’t submit it.'],
  ['Could you check , please?Is it ready?', 'Could you check, please? Is it ready?'],
  ['We’ll start on 9:30 am.', 'We’ll start at 9:30 am.'],
  ['Half of the invoices is on hold.', 'Half of the invoices are on hold.'],
  ['We ordered 2 PO. The count starts on 2th May.', 'We ordered 2 POs. The count starts on 2nd May.'],
];

test('live grammar checks also handle adjacent mistakes, acronyms, time expressions, and contractions', () => {
  for (const [mistake, corrected] of variations) {
    for (const mode of modes) {
      assert.equal(applyAll(mistake, check(mistake, mode)), corrected, mistake + ' in ' + mode);
      assert.deepEqual(check(corrected, mode), [], corrected + ' in ' + mode);
    }
  }
});

test('the lesson examples and variants exercise every new pattern', () => {
  const examples = [
    ...Array.from(byId.values(), lesson => alternate[lesson.id]?.[0] ?? lesson.mistake.split(' → ')[0]),
    ...variations.map(([text]) => text),
  ];
  for (const { id, pattern, replace } of globalThis.WorkHubEnglishGrammarChecks) {
    const exercised = examples.some(text =>
      Array.from(text.matchAll(pattern)).some(match => {
        const replacement = replace === null ? null : replace(...match, match.index, text);
        return replacement !== undefined && replacement !== match[0];
      })
    );
    assert.ok(exercised, id + ' ' + pattern.source);
  }
});

test('valid questions, alternate English forms, and text copied from SAP remain intact', () => {
  const correct = [
    'Could the supplier checks take longer?',
    'Can the order changes go live tonight?',
    'Did the invoice reviews take two hours?',
    'Did changes take effect? Can checks run now? When can reviews resume?',
    'The team are working on it. The data are available.',
    'The invoice is open. The issue is close to being resolved.',
    'I have saw blades in stock. I have read the email.',
    'We’ll have test results tomorrow.',
    'We have review the next day.',
    'There are a few time slots available. Two analysis tools were ordered.',
    'The tool is used to review invoices. I’m used to working with it.',
    'I remembered attaching the file. I remembered to attach the file.',
    'I can look in it. Look after them. I agreed testing is essential.',
    'The field is stored in Friday’s report. Submit a copy by Friday.',
    'A SAP system and an SAP application. A UAT session, an ERP system, and a URL.',
    'A one-page summary, an honest answer, a university contact, and a useful reference.',
    'Option A email sounds good. Option B invoice template is available.',
    'If you will wait, I will get the supplier. If it will help, I’ll send this advice.',
    'I wish he were here. If the file were attached, we could review it.',
    'We can either test today and release tomorrow or start Friday.',
    'Aisha is one of the suppliers who have accepted the request.',
    'We insisted that the team review the updated terms.',
    'There is a file and two spreadsheets attached.',
    'The review for section (i) will be due on Friday.',
    'Open check_is_ready.csv, then contact i.sent@example.com.',
    'Use the field Z_WE_HAVE_WROTE. See https://example.test/cant.',
    'The note says `we have wrote`. Here are the results.',
    '```text\ni sent a email yesterday\nThe report was send yesterday.\n```\nWe need the report.',
    'Note\tinvoices have been sent',
    'We can\tchecks completed',
    'I’ve heard that yesterday the file was approved.',
  ];
  for (const text of correct) {
    for (const mode of modes) assert.deepEqual(check(text, mode), [], text + ' in ' + mode);
  }
});
