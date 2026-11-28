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

const everyday = [
  ['Todays is a very good days.', 'Today is a very good day.'],
  ['how are your doing?', 'How are you doing?'],
  ['Yesterdays report is attached.', 'Yesterday’s report is attached.'],
  ['I need this by tomorrows.', 'I need this by tomorrow.'],
  ['A old chairs are available.', 'Old chairs are available.'],
  ['We have a unusual questions for the team.', 'We have an unusual question for the team.'],
  ['There is a very big cats in the garden.', 'There is a very big cat in the garden.'],
  ['There are a good days ahead.', 'There are good days ahead.'],
  ['There is two big dogs in the garden.', 'There are two big dogs in the garden.'],
  ['We saw an old birds in the park.', 'We saw an old bird in the park.'],
  ['There are many red apple on the table.', 'There are many red apples on the table.'],
  ['I got an important advice.', 'I got some important advice.'],
  ['I bought two big box for the move.', 'I bought two big boxes for the move.'],
  ['Two small child came to the show.', 'Two small children came to the show.'],
  ['Are your coming tonight?', 'Are you coming tonight?'],
  ['What are your working on?', 'What are you working on?'],
  ['Can your send the report?', 'Can you send the report?'],
  ['Does your know the answer?', 'Do you know the answer?'],
  ['She walk to school every day.', 'She walks to school every day.'],
  ['He don’t like coffee.', 'He doesn’t like coffee.'],
  ['They studies at home.', 'They study at home.'],
  ['The dog bark every morning.', 'The dog barks every morning.'],
  ['My dogs barks every night.', 'My dogs bark every night.'],
  ['My cat are asleep.', 'My cat is asleep.'],
  ['The children is drawing.', 'The children are drawing.'],
  ['She is eat breakfast.', 'She is eating breakfast.'],
  ['I have ate breakfast.', 'I have eaten breakfast.'],
  ['She have wrote the letter.', 'She has written the letter.'],
  ['I have already eat lunch.', 'I have already eaten lunch.'],
  ['I have never go there.', 'I have never gone there.'],
  ['He hasn’t drank water.', 'He hasn’t drunk water.'],
  ['She’s sang that song before.', 'She’s sung that song before.'],
  ['How often have you went there?', 'How often have you gone there?'],
  ['Has she eat lunch?', 'Has she eaten lunch?'],
  ['The food was eat yesterday.', 'The food was eaten yesterday.'],
];

test('the reported sentences and related everyday nouns, pronouns, tenses and participles get applicable fixes', () => {
  for (const mode of modes) {
    const [first, second] = everyday;
    assert.equal(check(first[0], mode).length, 2, first[0]);
    assert.equal(check(second[0], mode).length, 2, second[0]);
    for (const [mistake, corrected] of everyday) {
      assert.equal(applyAll(mistake, check(mistake, mode)), corrected, mistake + ' in ' + mode);
      assert.deepEqual(check(corrected, mode), [], corrected + ' in ' + mode);
    }
  }
});

const reliability = [
  ['today are a fun day.', 'Today is a fun day.'],
  ['yesterday were very tiring.', 'Yesterday was very tiring.'],
  ['Tomorrow are going to be busy.', 'Tomorrow is going to be busy.'],
  ['Tonight aren’t a holiday.', 'Tonight isn’t a holiday.'],
  ['today have been a good day.', 'Today has been a good day.'],
  ['Tomorrow are Monday.', 'Tomorrow is Monday.'],
  ['A new release is due. today are our last day.', 'A new release is due. Today is our last day.'],
  ['May   we\u00a0has a discussion\u00a0  ?', 'May   we\u00a0have a discussion?'],
  ['I\u00a0 have  ate breakfast.', 'I\u00a0 have  eaten breakfast.'],
  ['today\u202f  are\u2007a fun day.', 'Today\u202f  is\u2007a fun day.'],
  ['I sent a   email.', 'I sent an   email.'],
  ['The report was not send yesterday.', 'The report was not sent yesterday.'],
  ['The form hasn’t been send to me.', 'The form hasn’t been sent to me.'],
  ['It can’t be send today.', 'It can’t be sent today.'],
  ['Has it not been send to the vendor?', 'Has it not been sent to the vendor?'],
  ['Could you kindly sends the file?', 'Could you kindly send the file?'],
  ['He could of called us.', 'He could have called us.'],
  ['She should of went yesterday.', 'She should have gone yesterday.'],
];

test('time subjects, modal and passive forms, and pasted spacing produce range-safe edits', () => {
  for (const mode of modes) {
    assert.deepEqual(check(reliability[0][0], mode).map(issue => issue.id).sort(), ['agreement', 'capitals']);
    for (const [mistake, corrected] of reliability) {
      const issues = check(mistake, mode);
      assert.equal(applyAll(mistake, issues), corrected, mistake + ' in ' + mode);
      assert.deepEqual(check(corrected, mode), [], corrected + ' in ' + mode);
      for (const issue of issues) {
        assert.equal(mistake.slice(issue.start, issue.end), issue.original);
        assert.equal(
          applyAll(mistake, [issue]),
          mistake.slice(0, issue.start) + issue.replacement + mistake.slice(issue.end)
        );
      }
    }
  }
});

const directQuestions = [
  ['what much this cost?', 'How much does this cost?'],
  ['What much does it cost?', 'How much does it cost?'],
  ['how much it costs?', 'How much does it cost?'],
  ['How much does this costs?', 'How much does this cost?'],
  ['How much do it cost?', 'How much does it cost?'],
  ['How much did the new order costs?', 'How much did the new order cost?'],
  ['How much does your team usually spends?', 'How much does your team usually spend?'],
  ['How much this cost yesterday?', 'How much did this cost yesterday?'],
  ['How much the device will cost?', 'How much will the device cost?'],
  ['how much you have spent?', 'How much have you spent?'],
  ['How much you have to pay?', 'How much do you have to pay?'],
  ['How much it is?', 'How much is it?'],
  ['How much these cost?', 'How much do these cost?'],
  ['How much it usually weighs?', 'How much does it usually weigh?'],
  ['How much time we have?', 'How much time do we have?'],
  ['How many boxes this holds?', 'How many boxes does this hold?'],
  ['How many units these packages holds?', 'How many units do these packages hold?'],
  ['What many boxes are in stock?', 'How many boxes are in stock?'],
  ['How much boxes did you buy?', 'How many boxes did you buy?'],
  ['How many equipment do we have?', 'How much equipment do we have?'],
  ['how much boxes you bought?', 'How many boxes did you buy?'],
  ['What this means?', 'What does this mean?'],
  ['When you sent the PO?', 'When did you send the PO?'],
  ['what  much\u00a0this cost ?', 'How  much does this cost?'],
];

test('direct questions get quantity, helping verb and base verb corrections in Email and Teams', () => {
  for (const mode of modes) {
    const [reported] = directQuestions;
    assert.deepEqual(check(reported[0], mode).map(issue => issue.id).sort(), ['quantity', 'questions']);
    for (const [mistake, corrected] of directQuestions) {
      const issues = check(mistake, mode);
      assert.equal(applyAll(mistake, issues), corrected, mistake + ' in ' + mode);
      assert.deepEqual(check(corrected, mode), [], corrected + ' in ' + mode);
      for (const issue of issues) assert.equal(mistake.slice(issue.start, issue.end), issue.original);
    }
  }
});

test('the lesson examples and variants exercise every new pattern', () => {
  const examples = [
    ...Array.from(byId.values(), lesson => alternate[lesson.id]?.[0] ?? lesson.mistake.split(' → ')[0]),
    ...variations.map(([text]) => text),
    ...everyday.map(([text]) => text),
    ...reliability.map(([text]) => text),
    ...directQuestions.map(([text]) => text),
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
    'How are your test results? Are your running shoes dry? Is her singing good?',
    'Did your report the supplier mentioned arrive yet?',
    'Are your reviewing the file and her writing the answer both enough?',
    'Today’s report is ready. Yesterday was a very good day. We had a few good days.',
    'I remember our yesterdays. A people with a shared history can have many languages.',
    'A children’s book, a sports day, and a goods receipt are listed in the examples.',
    'A lot of days have passed. A pair of birds landed in the garden.',
    'The dog walk to school was cancelled. The room was clean yesterday.',
    'The family are eating. The group are getting ready.',
    'I have eaten breakfast. Have you read the letter?',
    'Please open a Windows application or an RFQ template.',
    'The tickets that arrived today are on hold.',
    'The files that arrived at 2 p.m. today are good to go.',
    'At 2 p.m. today is still early in the review window.',
    'Today are you free? Tomorrow are the tests running?',
    'Today are a few people coming? Today are the start dates available?',
    'Tomorrow have the reports ready before noon.',
    'The report wasn’t sent yesterday. The meeting is still open.',
    'The team are ready to meet today. The class have completed the exercise.',
    'The team   are ready. The form was sent  yesterday.',
    'May\twe had a separate label',
    'The sample is `today   are a fun day`.',
    'How many boxes fit on a pallet? How much of the order was delivered?',
    'Could you tell me how much this costs? Could you check how many boxes we need?',
    'What did the order costs include? What did the delivery charges cover?',
    'How much did the order costs increase?',
    'What many people do after work is relax, right?',
    'What the new order costs is a separate issue, right?',
    'What many people do this for is the reward, right?',
    'What this will cost is up to you, right?',
    'How much do the company usually charge?',
    'What caused the price to change? What is the total price?',
    'The note heading reads “How much this costs”.',
    'The formula is `what much this cost?`.',
  ];
  for (const text of correct) {
    for (const mode of modes) assert.deepEqual(check(text, mode), [], text + ' in ' + mode);
  }
});
