/* Local rules and exercises for common English writing patterns. */
(function (root) {
  'use strict';

  const maxText = 20000;
  const modalForms = {
    am: 'be',
    is: 'be',
    are: 'be',
    was: 'be',
    were: 'be',
    has: 'have',
    had: 'have',
    does: 'do',
    did: 'do',
    goes: 'go',
    went: 'go',
    sends: 'send',
    sent: 'send',
    changes: 'change',
    changed: 'change',
    needs: 'need',
    checks: 'check',
    checked: 'check',
    reviewed: 'review',
    reviews: 'review',
    confirms: 'confirm',
    confirmed: 'confirm',
    posted: 'post',
    posts: 'post',
    receives: 'receive',
    received: 'receive',
    joins: 'join',
    joined: 'join',
    shares: 'share',
    shared: 'share',
    makes: 'make',
    made: 'make',
    approves: 'approve',
    approved: 'approve',
  };
  const horizontal = '[ \\t\\u00a0]+';
  const modals =
    "(?:can(?:['’]t)?|(?:could|should|would|must|might)(?:n['’]t)?|may|shall|will|won['’]t|shan['’]t)";
  // Limit inverted noun phrases to familiar subject forms to avoid treating any following noun as a verb.
  const subjects = `(?:i|you|he|she|it|we|they|(?:the|a|an|this|that|our|your|my|their)${horizontal}(?:(?:new|current|original|revised|updated|purchase|project|support|finance)${horizontal})?(?:team|supplier|buyer|user|approver|manager|requester|system|order|request|report|document|file|invoice|PO|PR)s?)`;
  const adverbs = '(?:please|not|still|also|really|just|already|ever|only|possibly)';
  const modalPattern = new RegExp(
    String.raw`\b(${modals})(${horizontal}${subjects})?((?:${horizontal}${adverbs})?${horizontal})(${Object.keys(modalForms).join('|')})\b`,
    'gi'
  );
  const questionPrefix = /(?:^|[.!?:;\n"'“(]|\b(?:why|when|where|how|what|which|who))\s*$/i;
  const rules = [
    [
      'plural-be',
      'Grammar',
      /\b(the (?:changes|items|results|documents|files|details|invoices|tests|orders|materials|records|updates|errors)) (is|was|has)\b/gi,
      (_, subject, verb) =>
        subject + ' ' + { is: 'are', was: 'were', has: 'have' }[verb.toLowerCase()],
      'A plural subject takes are, were, or have.',
      'The files ___ ready to review.',
      ['are', 'is'],
    ],
    [
      'singular-be',
      'Grammar',
      /\b(the (?:change|item|result|document|file|invoice|test|order|material|record|update|error)|UAT) (are|were|have)\b/gi,
      (_, subject, verb) =>
        subject + ' ' + { are: 'is', were: 'was', have: 'has' }[verb.toLowerCase()],
      'A singular subject takes is, was, or has.',
      'The invoice ___ been posted.',
      ['has', 'have'],
    ],
    [
      'does-base',
      'Grammar',
      /\b(does|doesn't|does not|did|didn't|did not) (requires|needed|means|works|supports|affects|contains|posts|changes|received|failed|sent|went)\b/gi,
      (_, helper, verb) =>
        helper +
        ' ' +
        {
          requires: 'require',
          needed: 'need',
          means: 'mean',
          works: 'work',
          supports: 'support',
          affects: 'affect',
          contains: 'contain',
          posts: 'post',
          changes: 'change',
          received: 'receive',
          failed: 'fail',
          sent: 'send',
          went: 'go',
        }[verb.toLowerCase()],
      'After does or did, use the base form of the next verb.',
      'Does this PO ___ approval?',
      ['require', 'requires'],
    ],
    [
      'modal-base',
      'Grammar',
      modalPattern,
      (_, modal, subject, spacing, verb) =>
        modal + (subject || '') + spacing + modalForms[verb.toLowerCase()],
      'Use the base verb with a modal such as may, can, or should, even with the subject in between. For example, “we may have” and “may we have”.',
      'Could you ___ the test results?',
      ['review', 'reviewed'],
    ],
    [
      'subject-agreement',
      'Grammar',
      /\b(he|she|it) (have|do|need|want|say|work|look|seem|require)\b(?![ -])/gi,
      (_, subject, verb) =>
        subject +
        ' ' +
        {
          have: 'has',
          do: 'does',
          need: 'needs',
          want: 'wants',
          say: 'says',
          work: 'works',
          look: 'looks',
          seem: 'seems',
          require: 'requires',
        }[verb.toLowerCase()],
      'In a present-tense statement, he, she, and it take a singular verb.',
      'She ___ more time to test.',
      ['needs', 'need'],
    ],
    [
      'look-forward',
      'Grammar',
      /\blook(ing)? forward to (hear|meet|receive|see|discuss|work|talk|review)\b/gi,
      (_, ending, verb) =>
        'look' +
        (ending || '') +
        ' forward to ' +
        {
          hear: 'hearing',
          meet: 'meeting',
          receive: 'receiving',
          see: 'seeing',
          discuss: 'discussing',
          work: 'working',
          talk: 'talking',
          review: 'reviewing',
        }[verb.toLowerCase()],
      'Use an -ing form after “look forward to”.',
      'I look forward to ___ from you.',
      ['hearing', 'hear'],
    ],
    [
      'past-participle',
      'Grammar',
      /\b((?:has|have|had)(?: not)?) (went|wrote|saw|took|spoke|chose|broke|forgot|began|gave|drove)\b/gi,
      (_, helper, verb) =>
        helper +
        ' ' +
        {
          went: 'gone',
          wrote: 'written',
          saw: 'seen',
          took: 'taken',
          spoke: 'spoken',
          chose: 'chosen',
          broke: 'broken',
          forgot: 'forgotten',
          began: 'begun',
          gave: 'given',
          drove: 'driven',
        }[verb.toLowerCase()],
      'After has, have, or had, use the past participle.',
      'We have ___ the instructions.',
      ['written', 'wrote'],
    ],
    [
      'one-of',
      'Grammar',
      /\bone of the (reason|issue|item|task|file|material|supplier|test|project|question|option|invoice|cause)\b(?=\s*(?:[.,!?;:]|$)| +(?:we|you|they|he|she|that|which|is|was)\b)/gi,
      match => match + 's',
      '“One of the” refers to one member of a group, so the noun after it is plural.',
      'This is one of the ___ we discussed.',
      ['issues', 'issue'],
    ],
    [
      'discuss-about',
      'Grammar',
      /\bdiscuss(?:ed|ing|es)? about\b/gi,
      match => match.replace(/ about$/i, ''),
      '“Discuss” takes its topic directly. “Talk about” is another option.',
      'Let’s ___ the new approval process.',
      ['discuss', 'discuss about'],
    ],
    [
      'since-duration',
      'Grammar',
      /\bsince (\d+ (?:days|weeks|months|years|hours))(?=\s*[.,!?;:]|\s*$)/gi,
      (_, duration) => 'for ' + duration,
      'Use “for” with a length of time and “since” with a starting point.',
      'I have been waiting ___ two days.',
      ['for', 'since'],
    ],
    [
      'informations',
      'Grammar',
      /\b(?:informations|feedbacks|equipments)\b/gi,
      match => match.slice(0, -1),
      'Information, feedback, and equipment are normally uncountable in standard business English.',
      'Thanks for the useful ___.',
      ['feedback', 'feedbacks'],
    ],
    [
      'double-negative',
      'Grammar',
      /\b(don't|doesn't|didn't|do not|does not|did not) (have|see|find|receive|need|get) no\b/gi,
      (_, helper, verb) => `${helper} ${verb} any`,
      'Use “any” after a negative verb to express a single negative.',
      'We did not receive ___ response.',
      ['any', 'no'],
    ],
    [
      'duplicate',
      'Grammar',
      /\b(the|to|for|from|and|with|of|in|please) +\1\b/gi,
      (_, word) => word,
      'This word appears twice. Read the sentence to check whether one occurrence is enough.',
      'Please send the file ___ me.',
      ['to', 'to to'],
    ],
    [
      'spelling',
      'Spelling',
      /\b(teh|recieve|recieved|recieving|seperate|definately|sucessful|untill|wierd|acheive|occured|availabe|tomorow|grammer)\b/gi,
      match =>
        ({
          teh: 'the',
          recieve: 'receive',
          recieved: 'received',
          recieving: 'receiving',
          seperate: 'separate',
          definately: 'definitely',
          sucessful: 'successful',
          untill: 'until',
          wierd: 'weird',
          acheive: 'achieve',
          occured: 'occurred',
          availabe: 'available',
          tomorow: 'tomorrow',
          grammer: 'grammar',
        })[match.toLowerCase()],
      'This word matches a common spelling mix-up.',
      'Can you ___ the file today?',
      ['receive', 'recieve'],
    ],
    [
      'revert-back',
      'Word choice',
      /\b(?:kindly |please )?revert back to me\b|\b(?:kindly |please )revert\b/gi,
      () => 'please reply',
      'In international workplace English, “reply” makes it clear you want a response.',
      'Could you ___ once the PO is approved?',
      ['reply', 'revert back'],
    ],
    [
      'clarify',
      'Word choice',
      /\bfor your kind information\b/gi,
      () => 'for your information',
      'Use “for your information” to share context, or name the action you need if you expect one.',
      '___, the testing slot has moved to Friday.',
      ['For your information', 'For your kind information'],
    ],
    [
      'do-needful',
      'Word choice',
      /\b(?:kindly |please )?do the needful\b/gi,
      () => 'please take the required action',
      'Name the specific action and deadline where possible. For example, “Please approve the PO by Friday”.',
      'Which request gives the reader a clear action?',
      ['Please approve the PO by Friday.', 'Please do the needful.'],
    ],
    [
      'asap',
      'Word choice',
      /\bat your earliest convenience\b/gi,
      () => 'when you have a chance',
      'A shorter phrase may suit Teams. For a time-sensitive request, give a specific deadline.',
      'Which request gives the reader a clear deadline?',
      ['Please confirm by 3 pm on Friday.', 'Please confirm at your earliest convenience.'],
      'teams',
    ],
    [
      'ping-me',
      'Word choice',
      /\bping me\b/gi,
      () => 'let me know',
      '“Let me know” works well in an email when you want a reply.',
      'Please ___ when the transport is ready.',
      ['let me know', 'make me know'],
      'email',
    ],
    [
      'punctuation-spacing',
      'Punctuation',
      /(?<=[\p{L}\p{N})\]])[ \t\u00a0]+([?!])(?=$|[\r\n?!’”'"\])]|[ \t\u00a0]+(?:$|[\r\n\p{Lu}]))/gu,
      (_, mark) => mark,
      'Put a question mark or exclamation mark directly after the preceding word in English.',
      'Which question uses standard punctuation spacing?',
      ['May we discuss this?', 'May we discuss this ?'],
    ],
  ];

  const titles = [
    'Plural subjects',
    'Singular subjects',
    'Verbs after does and did',
    'Verbs after can and should',
    'He, she and it',
    'Look forward to',
    'Past participles',
    'One of the',
    'Discuss and talk about',
    'For and since',
    'Uncountable nouns',
    'Single negatives',
    'Repeated words',
    'Common spellings',
    'Asking for a reply',
    'Sharing information',
    'Making a clear request',
    'Giving a deadline',
    'Choosing a tone for email',
    'Spacing before punctuation',
  ];
  const lessons = Object.fromEntries(
    rules.map(([id, type, , , reason, prompt, choices], index) => [
      id,
      { id, type, title: titles[index], reason, prompt, choices },
    ])
  );
  const phrases = [
    [
      'Could you confirm whether…?',
      'Ask someone to verify a decision or fact.',
      'Could you confirm whether UAT can start on Monday?',
    ],
    [
      'I’ll follow up on…',
      'Say what you will check or pursue afterwards.',
      'I’ll follow up on the outstanding approvals tomorrow.',
    ],
    [
      'To clarify…',
      'Explain a point more precisely.',
      'To clarify, you can post the goods receipt once the PO is released.',
    ],
    [
      'Pending confirmation',
      'The next step depends on someone confirming a detail.',
      'The deployment date is pending confirmation from the project lead.',
    ],
    [
      'Could you walk me through…?',
      'Ask someone to explain a process step by step.',
      'Could you walk me through how you handle delivery discrepancies?',
    ],
    [
      'We’re on track to…',
      'Say that progress is good enough to meet an expected result.',
      'We’re on track to finish testing by Friday.',
    ],
  ];

  function check(text, mode) {
    const found = [];
    const draft = text.slice(0, maxText);
    for (const [id, type, pattern, replace, reason, , , context] of rules) {
      if (context && mode !== context) continue;
      for (const match of draft.matchAll(pattern)) {
        const prefix = draft.slice(Math.max(0, match.index - 18), match.index);
        if (
          ['plural-be', 'singular-be'].includes(id) &&
          /\b(?:does|do|did|can|could|would|should|will|must|may|might)\s+$/i.test(prefix)
        )
          continue;
        if (id === 'subject-agreement' && !/(?:^|[.!?\n])\s*$/.test(prefix)) continue;
        // At a question opening a token after the modal may be its subject, as in “Can checks run?”.
        if (id === 'modal-base' && !match[2] && questionPrefix.test(prefix)) continue;
        const original = match[0];
        let replacement = replace(...match);
        if (/^[A-Z]/.test(original))
          replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
        const end = match.index + original.length;
        const verbOffset = id === 'modal-base' ? original.length - match[4].length : 0;
        found.push({
          id,
          type,
          reason,
          start: match.index,
          end,
          original,
          replacement,
          ...(verbOffset
            ? {
                edit: {
                  start: match.index + verbOffset,
                  end,
                  replacement: replacement.slice(verbOffset),
                },
              }
            : {}),
        });
      }
    }
    return found.sort((a, b) => a.start - b.start || b.end - a.end).slice(0, 100);
  }

  function validState(raw) {
    const mode = raw?.mode === 'teams' ? 'teams' : 'email';
    const draft = typeof raw?.draft === 'string' ? raw.draft.slice(0, 160000) : '';
    const vocab = Array.isArray(raw?.vocab)
      ? raw.vocab.slice(0, 200).flatMap(card =>
          [card?.term, card?.meaning, card?.example].every(value => typeof value === 'string') &&
          card.term.trim()
            ? [
                {
                  term: card.term.slice(0, 120),
                  meaning: card.meaning.slice(0, 300),
                  example: card.example.slice(0, 500),
                },
              ]
            : []
        )
      : [];
    const counts = {};
    for (const id of Object.keys(lessons)) {
      const row = raw?.counts?.[id];
      if (!row) continue;
      counts[id] = Object.fromEntries(
        ['seen', 'right', 'attempts'].map(key => [
          key,
          Number.isInteger(row[key]) ? Math.max(0, Math.min(1000000, row[key])) : 0,
        ])
      );
    }
    const grammarIds = root.WorkHubEnglishGrammarData?.byId;
    const grammar = {
      completed:
        grammarIds && Array.isArray(raw?.grammar?.completed)
          ? [...new Set(raw.grammar.completed.slice(0, 1000).filter(id => grammarIds.has(id)))]
          : [],
      last: grammarIds?.has(raw?.grammar?.last) ? raw.grammar.last : '',
    };
    return { mode, draft, vocab, counts, grammar };
  }

  root.WorkHubEnglishCoachEngine = { maxText, check, lessons, phrases, validState };
})(globalThis);
