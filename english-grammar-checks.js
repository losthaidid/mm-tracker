/* Local checks linked to Grammar Library lessons. Match forms that have enough context to review. */
(function (root) {
  'use strict';

  const rules = [];
  const rx = source => new RegExp(source, 'gi');
  const choices = words => Object.keys(words).join('|');
  const pronouns = '(?:I|you|we|they|he|she|it)';
  const people =
    '(?:buyer|supplier|vendor|requester|approver|manager|reviewer|tester|user|colleague|developer|customer)';
  const workspace =
    '(?:file|report|document|form|request|order|invoice|quote|message|email|delivery|application|system|process|record|update|attachment|purchase order|test|result|item|issue|PO|PR|RFQ)';
  const named = `(?:the|this|that|our|their|your|my|its) (?:${people}|${workspace})s?`;
  const subject = `(?:${pronouns}|${named})`;
  const clause = '(?:^|(?<=[.!?;\\n]) *)';
  const end = '(?=[ ,.?!;\\n]|$)';
  const terminal = '(?= *(?:[.!?;\\n]|$))';
  const adverb = '(?:(?:not|just|already|never|ever|always|still|really|also|please|only) )?';
  const objectStart =
    '(?= +(?:the|this|that|these|those|our|their|your|my|his|her|its|it|them|him|me|us|you)\\b)(?! +the (?:next|following|same) (?:day|week|month|year)\\b)';
  const writtenNumber = '(?:two|three|four|five|six|seven|eight|nine|ten|several)';
  const numeral = `(?:${writtenNumber}|[2-9]|[1-9][0-9]+)`;
  const nounEnd =
    '(?= *(?:[,.!?;:\\n]|$)| +(?:is|are|was|were|has|have|needs?|require[sd]?|remain[sed]*|will|can|must|should|on hold|in stock)\\b)';

  function use(lessonId, pattern, replace, reason, type = 'Grammar') {
    rules.push({ id: lessonId, lessonId, pattern, replace, reason, type });
  }

  function sameCase(word, replacement) {
    if (/^(?:PO|PR)$/.test(word) && replacement === word.toLowerCase() + 's') return word + 's';
    if (/^[A-Z]{2,}$/.test(word)) return replacement.toUpperCase();
    if (/^[A-Z]/.test(word)) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    return replacement;
  }

  // The prefix is kept verbatim. The suffix is lookahead and supplies context for the edit.
  function word(lesson, prefix, words, suffix, reason, type) {
    use(
      lesson,
      rx(`${prefix}(${choices(words)})\\b${suffix}`),
      (match, original) => {
        return match.slice(0, -original.length) + sameCase(original, words[original.toLowerCase()]);
      },
      reason,
      type
    );
  }

  const day = '(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)';
  use(
    'nouns',
    /\b((?:[Oo]n|[Bb]y|[Nn]ext|[Ll]ast|[Ee]very|[Uu]ntil|[Tt]his) +)(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/g,
    (_, before, name) => before + name[0].toUpperCase() + name.slice(1),
    'Capitalise the names of weekdays.',
    'Capitalisation'
  );

  const objectPronoun = { i: 'me', we: 'us', he: 'him', she: 'her', they: 'them' };
  use(
    'pronouns',
    /\b((?:to|for|with|from|between|beside|without) +(?:(?:[A-Z][\p{L}’-]{1,29}|the team) +and +)?)(I|we|he|she|they)\b(?= *(?:[,.;!?\n]|$)| +(?:today|tomorrow|later|first)\b)/gu,
    (_, before, wrong) => before + objectPronoun[wrong.toLowerCase()],
    'Use an object pronoun after a preposition, including when someone else is named with it.'
  );

  word(
    'adjectives',
    '\\b(?:are|were|is|was|look(?:ed)?|seem(?:ed)?) ',
    {
      importants: 'important',
      availables: 'available',
      differents: 'different',
      relevants: 'relevant',
      consistents: 'consistent',
      necessaries: 'necessary',
    },
    terminal,
    'Adjectives such as important keep the same form when they describe plural nouns.'
  );
  word(
    'adverbs',
    `\\b(?:check(?:s|ed)?|review(?:s|ed)?|read|handle[sd]?|explain(?:s|ed)?|validate[sd]?) (?:it|them|this|that|the ${workspace}s?) `,
    {
      careful: 'carefully',
      accurate: 'accurately',
      thorough: 'thoroughly',
      clear: 'clearly',
      quick: 'quickly',
    },
    terminal,
    'Use an adverb to describe how the action was done.'
  );
  for (const [pattern, wrong, correct] of [
    ['responsible', 'of', 'for'],
    ['interested', 'on', 'in'],
    ['(?:depend|depends|depended|depending)', 'of', 'on'],
    ['(?:related|relevant)', 'with', 'to'],
  ]) {
    word(
      'prepositions',
      `\\b${pattern} `,
      { [wrong]: correct },
      '',
      `Use “${correct}” in this expression. Fixed combinations like “responsible for” have their own preposition.`
    );
  }
  use(
    'conjunctions',
    rx(
      `${clause}(Although [^,.;!?:\\n]{4,110}, +)but (?=(?:${subject}|there|two|three|several|both)\\b)`
    ),
    (_, lead) => lead,
    'Although already introduces the contrast. The main clause can follow it directly.'
  );
  use(
    'determiners',
    /\bthe +(my|your|our|his|her|their|its)(?= +[\p{L}])/giu,
    (_, possessive) => possessive,
    'Use the possessive determiner by itself before this noun phrase.'
  );

  const mass =
    '(?:advice|equipment|feedback|furniture|information|luggage|research|evidence|software|stock|training)';
  const plurals = {
    analysis: 'analyses',
    child: 'children',
    person: 'people',
    foot: 'feet',
    tooth: 'teeth',
    country: 'countries',
    policy: 'policies',
    category: 'categories',
    shelf: 'shelves',
    company: 'companies',
    status: 'statuses',
  };
  use(
    'countability',
    rx(`\\ban? (${mass})\\b${nounEnd}`),
    (_, noun) => 'some ' + noun,
    'Use some with these uncountable nouns, or name the unit you mean, such as a piece of equipment.'
  );
  word(
    'plural-nouns',
    `\\b(?:${numeral}|both|many|several) `,
    plurals,
    nounEnd,
    'A quantity greater than one takes a plural noun. This noun has a spelling change in the plural.'
  );
  word(
    'plural-nouns',
    '\\b',
    { childrens: 'children', peopleses: 'people', analysises: 'analyses', shelfes: 'shelves' },
    '',
    'This noun already has an irregular plural form.'
  );

  // Choose the article by sound. Leave optional pronunciations such as SAP, SQL and FAQ alone.
  const vowelSound = /^(?:honest|honou?r|hours?\b|heirs?\b|[aeiou])/i;
  const consonantVowelStart =
    /^(?:euro|ewe|eulogy|euphem|eucalyptus|ouija|one\b|once\b|u(?:se|sual|ni(?:vers|corn|form|que|t|on)|til|tensil|top|biq))/i;
  const articleFollowing =
    /^(?:and|or|but|the|a|an|is|are|was|were|has|have|can|will|should|could|would|may|might|must|to|of|for|in|on|at|as|my|your|their|our|its|this|that|these|those|not|herb|homage|historic)$/i;
  const labelBefore =
    /\b(?:option|grade|letter|section|line|column|plant|company|warehouse|item|choice|answer|class|group|type|tier|tab|figure|appendix) +$/i;
  use(
    'articles-a-an',
    /\b(a|an) +([A-Za-z]+(?:-[A-Za-z]+)*)\b/gi,
    (match, article, next, index, text) => {
      if (
        articleFollowing.test(next) ||
        (article === 'A' && labelBefore.test(text.slice(Math.max(0, index - 25), index)))
      )
        return;
      const initials = next.split('-')[0];
      let vowel;
      if (/^(?:ERP|RFQ|HR|HTTP|HTTPS|MRI|MBA|MRP|SLA|SSO|XML|XLS|HTML)$/.test(initials))
        vowel = true;
      else if (/^(?:PO|PR|PDF|CSV|VAT|UAT|USB|URL)$/.test(initials)) vowel = false;
      else if (/^[A-Z]{2,}$/.test(initials) || initials.length === 1) return;
      else vowel = vowelSound.test(next) && !consonantVowelStart.test(next);
      const corrected = vowel ? 'an' : 'a';
      if (article.toLowerCase() !== corrected)
        return sameCase(article, corrected) + match.slice(article.length);
    },
    'Choose a or an by the sound that immediately follows it.'
  );

  const singularNoun =
    '(?:file|report|document|form|request|order|invoice|quote|message|email|record|update|attachment|test|result|item|issue|field|error|task|supplier|option|project|material|question|box|day|week|hour|purchase order|PO|PR|RFQ)';
  const pluralNoun = `(?:${singularNoun}s|boxes|people|children|analyses|companies|policies)`;
  function quantityWord(lesson, options, nouns, explanation) {
    word(lesson, '\\b', options, `(?= ${nouns}\\b${nounEnd})`, explanation);
  }
  quantityWord(
    'demonstratives',
    { these: 'this', those: 'that' },
    singularNoun,
    'Use this or that with a singular noun.'
  );
  quantityWord('demonstratives', { this: 'these' }, pluralNoun, 'Use these with a plural noun.');
  quantityWord('quantity', { much: 'many' }, pluralNoun, 'Use many with plural count nouns.');
  quantityWord('quantity', { many: 'much' }, mass, 'Use much with an uncountable noun.');
  use(
    'few-little',
    rx(`\\ba few(?= (?:${mass}|time|work|space)\\b${nounEnd})`),
    () => 'a little',
    'Use a little for a small amount of something uncountable.'
  );
  use(
    'few-little',
    rx(`\\ba little(?= ${pluralNoun}\\b${nounEnd})`),
    () => 'a few',
    'Use a few for a small number of countable things.'
  );
  const singularBe = { are: 'is', were: 'was', have: 'has', do: 'does', "don't": 'doesn’t' };
  const pluralBe = { is: 'are', was: 'were', has: 'have', does: 'do' };
  word(
    'each-every',
    `\\b(?:each|every|one) of (?:the|these|those|your|our|their) ${pluralNoun} `,
    singularBe,
    '',
    'Each and one refer to an individual member of the group. Use a singular verb.'
  );
  word(
    'each-every',
    `\\bevery ${singularNoun} `,
    {
      need: 'needs',
      require: 'requires',
      contain: 'contains',
      include: 'includes',
      go: 'goes',
      ...singularBe,
    },
    '',
    'Every with a singular noun takes a singular verb.'
  );
  use(
    'possessives',
    /\b((?:changed?|lost|loses|updated?|keeps?|kept|uses?|used|retains?|retained) +)it['’]s(?= +(?:code|name|format|formatting|value|status|position|shape|colour|color|number|label|meaning)\b)/gi,
    (_, before) => before + 'its',
    'Use its for possession. It’s means “it is” or “it has”.'
  );
  use(
    'possessives',
    rx(`${clause}its(?= +(?:ready|available|finished|missing|blocked|complete)${terminal})`),
    () => 'it’s',
    'Use it’s when you mean “it is”.'
  );
  use(
    'reflexives',
    /\b((?:please|(?:could|can|would|will) you) (?:reply|respond|send|forward|return|write|give|email)(?: +[^,.;!?\n]{1,55}?)? +to +)myself\b/gi,
    (_, before) => before + 'me',
    'Use me when someone else sends something to you. Myself refers back to I in the same clause.'
  );

  // Common workplace verbs and their forms. Keep unchanged participles when they are already valid.
  const spellingChanges = {
    cancel: ['cancelled', 'cancelling'],
    log: ['logged', 'logging'],
    plan: ['planned', 'planning'],
    refer: ['referred', 'referring'],
    stop: ['stopped', 'stopping'],
    submit: ['submitted', 'submitting'],
    tag: ['tagged', 'tagging'],
    transfer: ['transferred', 'transferring'],
  };
  const baseVerbs =
    'accept add agree allow answer apply approve arrive attach call cancel change check close complete confirm consider contain correct count create deal decide delay deliver describe discuss document e-mail email explain fail file fill finish fix follow handle help include inform join keep know launch learn leave link list log look mention move need open order pass paste pick plan play point post prepare print process provide receive record refer reject release remain remove reply report request require resolve respond return review revise schedule share show sign start stay stop store submit support tag talk test transfer try update upload use validate wait want watch work'.split(
      ' '
    );
  const irregular = {
    be: ['is', 'was', 'been', 'being'],
    become: ['becomes', 'became', 'become', 'becoming'],
    begin: ['begins', 'began', 'begun', 'beginning'],
    break: ['breaks', 'broke', 'broken', 'breaking'],
    bring: ['brings', 'brought', 'brought', 'bringing'],
    build: ['builds', 'built', 'built', 'building'],
    buy: ['buys', 'bought', 'bought', 'buying'],
    catch: ['catches', 'caught', 'caught', 'catching'],
    choose: ['chooses', 'chose', 'chosen', 'choosing'],
    come: ['comes', 'came', 'come', 'coming'],
    cut: ['cuts', 'cut', 'cut', 'cutting'],
    do: ['does', 'did', 'done', 'doing'],
    draw: ['draws', 'drew', 'drawn', 'drawing'],
    drink: ['drinks', 'drank', 'drunk', 'drinking'],
    drive: ['drives', 'drove', 'driven', 'driving'],
    eat: ['eats', 'ate', 'eaten', 'eating'],
    fall: ['falls', 'fell', 'fallen', 'falling'],
    find: ['finds', 'found', 'found', 'finding'],
    forget: ['forgets', 'forgot', 'forgotten', 'forgetting'],
    get: ['gets', 'got', 'got', 'getting'],
    give: ['gives', 'gave', 'given', 'giving'],
    go: ['goes', 'went', 'gone', 'going'],
    grow: ['grows', 'grew', 'grown', 'growing'],
    have: ['has', 'had', 'had', 'having'],
    hear: ['hears', 'heard', 'heard', 'hearing'],
    hold: ['holds', 'held', 'held', 'holding'],
    keep: ['keeps', 'kept', 'kept', 'keeping'],
    know: ['knows', 'knew', 'known', 'knowing'],
    lead: ['leads', 'led', 'led', 'leading'],
    leave: ['leaves', 'left', 'left', 'leaving'],
    lose: ['loses', 'lost', 'lost', 'losing'],
    make: ['makes', 'made', 'made', 'making'],
    mean: ['means', 'meant', 'meant', 'meaning'],
    meet: ['meets', 'met', 'met', 'meeting'],
    pay: ['pays', 'paid', 'paid', 'paying'],
    put: ['puts', 'put', 'put', 'putting'],
    read: ['reads', 'read', 'read', 'reading'],
    run: ['runs', 'ran', 'run', 'running'],
    say: ['says', 'said', 'said', 'saying'],
    see: ['sees', 'saw', 'seen', 'seeing'],
    sell: ['sells', 'sold', 'sold', 'selling'],
    send: ['sends', 'sent', 'sent', 'sending'],
    set: ['sets', 'set', 'set', 'setting'],
    show: ['shows', 'showed', 'shown', 'showing'],
    speak: ['speaks', 'spoke', 'spoken', 'speaking'],
    spend: ['spends', 'spent', 'spent', 'spending'],
    stand: ['stands', 'stood', 'stood', 'standing'],
    take: ['takes', 'took', 'taken', 'taking'],
    teach: ['teaches', 'taught', 'taught', 'teaching'],
    tell: ['tells', 'told', 'told', 'telling'],
    think: ['thinks', 'thought', 'thought', 'thinking'],
    understand: ['understands', 'understood', 'understood', 'understanding'],
    wear: ['wears', 'wore', 'worn', 'wearing'],
    win: ['wins', 'won', 'won', 'winning'],
    write: ['writes', 'wrote', 'written', 'writing'],
  };
  const verbs = Object.fromEntries(
    baseVerbs.map(base => {
      const endingY = /[^aeiou]y$/.test(base);
      const third = endingY
        ? base.slice(0, -1) + 'ies'
        : base + (/(?:ss|sh|ch|x|z|o)$/.test(base) ? 'es' : 's');
      const past =
        spellingChanges[base]?.[0] ??
        (endingY ? base.slice(0, -1) + 'ied' : base + (base.endsWith('e') ? 'd' : 'ed'));
      const ing =
        spellingChanges[base]?.[1] ??
        (/(?:[^e]e)$/.test(base) && !/^(?:agree|see)$/.test(base) ? base.slice(0, -1) : base) +
          'ing';
      return [base, [third, past, past, ing]];
    })
  );
  Object.assign(verbs, irregular);

  const actions =
    'accept add answer approve attach bring buy cancel change check close complete confirm correct create delay deliver describe discuss document email explain file fill finish fix give handle include join link log make mention move open order pay pick plan post prepare print process provide read receive record reject release remove report request resolve return review revise schedule see sell send share show sign start stop store submit support tag take test transfer update upload use validate watch write'.split(
      ' '
    );
  const timedActions =
    'arrive begin call check close complete confirm finish go join leave meet move open post receive reply return review send start submit test update work'.split(
      ' '
    );
  const verbsOf = (from, to, bases) =>
    Object.fromEntries(
      bases.flatMap(base => {
        const forms = [base, ...verbs[base]];
        return from
          .filter(index => forms[index] !== forms[to])
          .map(index => [forms[index], forms[to]]);
      })
    );
  const baseForm = verbsOf([1, 2, 3], 0, Object.keys(verbs));
  const activeBe = `(?:I am|I['’]m|(?:we|you|they) are|(?:we|you|they)['’]re|(?:he|she|it) is|(?:he|she|it)['’]s|the ${people} is)`;
  const activeWas = `(?:(?:I|he|she|it|the ${people}) was|(?:we|you|they) were)`;
  const workplaceActor = `(?:I|we|you|they|he|she|the ${people}s?)`;
  const timeMarker = `(?= +(?:since|for|when|now|today|tomorrow|this (?:morning|afternoon|evening|week)|at [0-9])\\b)`;
  const activities = 'check finish join review start stop submit test work wait'.split(' ');

  function progressive(lesson, lead, reason) {
    word(lesson, lead, verbsOf([0], 4, actions), objectStart, reason);
    word(lesson, lead, verbsOf([0], 4, activities), timeMarker, reason);
  }

  // Clauses and common agreement errors.
  use(
    'clause-order',
    rx(
      `${clause}(received|approved|posted|released|checked|sent) (the (?:team|warehouse|buyer|supplier|vendor|reviewer)) (the|this|those|our|their) (?=(?:${workspace}s?|goods)\\b)`
    ),
    (_, verb, actor, article) => `${actor} ${verb.toLowerCase()} ${article} `,
    'In an ordinary statement, put the subject before the verb.'
  );
  word(
    'agreement',
    `\\b(?:the|a|this|our|your) (?:list|set|collection|batch|copy|summary|risk|cost) of (?:the |open |pending |recent )?${pluralNoun} `,
    singularBe,
    '',
    'Match the verb to the head noun, such as list or batch.'
  );
  word('agreement', '\\b(?:we|you) ', pluralBe, '', 'Use are, were, have or do with we and you.');
  word(
    'agreement',
    '\\b(?:he|she|it) ',
    { are: 'is', were: 'was' },
    '',
    'Use is or was with he, she and it.',
    'Grammar'
  );
  word(
    'agreement',
    '\\bI ',
    { is: 'am', are: 'am', has: 'have', does: 'do' },
    '',
    'Use am, have and do with I.'
  );
  word(
    'there-it',
    '\\bthere ',
    { is: 'are', was: 'were' },
    `(?= (?:both|${numeral}) ${pluralNoun}\\b)`,
    'Use a plural verb after there when you introduce more than one thing.'
  );
  word(
    'there-it',
    '\\bthere ',
    { are: 'is', were: 'was' },
    `(?= (?:a|an|one) ${singularNoun}\\b)`,
    'Use a singular verb after there when you introduce one thing.'
  );
  use(
    'there-it',
    rx(`\\bthere['’]s(?= (?:both|${numeral}) ${pluralNoun}\\b)`),
    () => 'there are',
    'There’s is short for there is. Use there are to introduce a plural noun.'
  );
  word(
    'questions',
    `\\b(?:do|does|did)(?:n['’]t)? ${subject} ${adverb}`,
    baseForm,
    '',
    'Use the base verb after do, does or did, even when the subject comes in between.'
  );
  word(
    'negatives',
    `\\b(?:do|does|did)(?:n['’]t| not) ${adverb}`,
    baseForm,
    '',
    'Use the base verb after do not, does not and did not.'
  );
  use(
    'negatives',
    /\b((?:do|does|did)n[’']t (?:have|see|find|receive|need|get|send|hear) +)no\b/gi,
    (_, before) => before + 'any',
    'Use any after a negative verb when you mean a single negative.'
  );
  use(
    'imperatives',
    rx(`\\b(please +)to +(?=(?:${choices(baseForm)}|${actions.join('|')})\\b)`),
    (_, please) => please,
    'After please in a direct request, use the base verb.'
  );
  use(
    'verbs',
    rx(`\\b((?:do|does|did)(?:n['’]t| not) +)to +(?=(?:${actions.join('|')})\\b)`),
    (_, auxiliary) => auxiliary,
    'The helping verb do takes the base verb directly.'
  );

  word(
    'present-simple',
    `${clause}(?:he|she|it|(?:the|this|that|our|your|their|my) ${people}) ${adverb}`,
    verbsOf([0], 1, [
      ...actions,
      'do',
      'have',
      'need',
      'want',
      'go',
      'work',
      'wait',
      'say',
      'require',
    ]),
    '',
    'In a present-tense statement, a singular third-person subject takes forms like checks or has.'
  );
  word(
    'present-simple',
    `${clause}(?:I|we|you|they|the ${people}s) ${adverb}`,
    verbsOf([1], 0, [...actions, 'do', 'have', 'need', 'want', 'go', 'work', 'wait', 'say']),
    '',
    'In a present-tense statement, use the base verb with I, you, we and they.'
  );
  progressive(
    'present-continuous',
    `\\b${activeBe} ${adverb}`,
    'Use an -ing form after am, is or are for an action in progress.'
  );
  progressive(
    'present-continuous',
    `${clause}(?:am|is|are) ${workplaceActor} ${adverb}`,
    'For a question about an ongoing action, use am, is or are with the -ing form.'
  );
  progressive(
    'past-continuous',
    `\\b${activeWas} ${adverb}`,
    'Use was or were with the -ing form for an action in progress in the past.'
  );
  progressive(
    'past-continuous',
    `${clause}(?:was|were) ${workplaceActor} ${adverb}`,
    'For a question about an action in progress in the past, use was or were with the -ing form.'
  );

  use(
    'stative-verbs',
    rx(
      `\\b(I|you|we|they|he|she|it)(?: (?:am|is|are)|['’](?:m|re|s)) (knowing|owning)(?= (?:the|this|that|our|what|how|who)\\b)`
    ),
    (_, actor, verb) => {
      const base = verb.toLowerCase() === 'knowing' ? 'know' : 'own';
      return `${actor} ${/^(?:he|she|it)$/i.test(actor) ? base + 's' : base}`;
    },
    'Use the simple present to describe a state such as knowing something or owning something.'
  );
  const finishedTime = `(?:yesterday(?: morning| afternoon| evening)?|last (?:${day}|week|month|year)|${numeral} (?:days|weeks|months|years) ago)`;
  const pastActions = [...new Set([...actions, ...timedActions, 'eat', 'drink', 'fall'])];
  word(
    'past-simple',
    `\\b${finishedTime},? +${subject} ${adverb}`,
    verbsOf([0, 1], 2, pastActions),
    '',
    'A finished time such as yesterday usually goes with the simple past.'
  );
  const perfectActions = verbsOf([0], 3, actions);
  const differentPast = Object.fromEntries(
    Object.entries(irregular)
      .filter(
        ([base, [, past, participle]]) =>
          past !== participle && !['be', 'see', 'show', 'drink'].includes(base)
      )
      .map(([, [, past, participle]]) => [past, participle])
  );
  const perfectReason = 'Use a past participle after have, has or had to form a perfect tense.';
  const have = `(?:have|has|(?:I|you|we|they)['’]ve|(?:he|she|it)['’]s)`;
  word('present-perfect', `\\b${have} ${adverb}`, perfectActions, objectStart, perfectReason);
  word(
    'present-perfect',
    `\\b${have} ${adverb}`,
    { saw: 'seen', drank: 'drunk', showed: 'shown' },
    objectStart,
    perfectReason
  );
  word(
    'present-perfect',
    `\\b(?:(?:I|you|we|they)['’]ve|(?:he|she|it)['’]s) ${adverb}`,
    differentPast,
    '',
    perfectReason
  );
  word('past-perfect', `\\bhad ${adverb}`, perfectActions, objectStart, perfectReason);
  word(
    'past-perfect',
    `\\bhad ${adverb}`,
    differentPast,
    '',
    'Use had with a past participle to describe the earlier of two past events.'
  );
  const presentHave = `(?:(${subject}) (?:have|has)|(I|you|we|they)['’]ve)`;
  const completedVerbs = Object.fromEntries(
    pastActions.map(base => [verbs[base][2], verbs[base][1]])
  );
  const completedObject = `(?: (?:it|them|(?:the|this|that|our|your|their) (?:new |updated |revised )?${workspace}s?))?`;
  use(
    'perfect-vs-past',
    rx(
      `\\b${presentHave} (${choices(completedVerbs)})(${completedObject} ${finishedTime})${terminal}`
    ),
    (_, actor, contraction, verb, rest) =>
      `${actor || contraction} ${completedVerbs[verb.toLowerCase()]}${rest}`,
    'Use the simple past with a finished time such as yesterday or last Friday.'
  );
  progressive(
    'perfect-continuous',
    `\\b${workplaceActor}(?: (?:have|has)|['’]ve) ${adverb}been `,
    'Use the -ing form after have been or has been when describing an ongoing action.'
  );
  progressive(
    'past-perfect-continuous',
    `\\b${workplaceActor} had ${adverb}been `,
    'Use had been with an -ing form for an activity that continued up to a past point.'
  );
  progressive(
    'future-perfect-continuous',
    `\\b${workplaceActor}(?: will|['’]ll) have ${adverb}been `,
    'Use will have been with an -ing form for an activity continuing up to a future point.'
  );
  use(
    'for-since',
    rx(`\\bsince ((?:a|an|one|${numeral}) (?:minute|hour|day|week|month|year)s?)${terminal}`),
    (_, length) => 'for ' + length,
    'Use for with a duration and since with the starting point.'
  );

  use(
    'future-forms',
    rx(
      `\\b(${subject}(?: will(?: not)?| won['’]t|['’]ll) +)to +(?=(?:${actions.join('|')}|be|do|have|go|work)\\b)`
    ),
    (_, lead) => lead,
    'Use will directly with the base verb.'
  );
  const future = `\\b${subject}(?: will|['’]ll) ${adverb}have ${adverb}`;
  word(
    'future-progress',
    future,
    perfectActions,
    objectStart,
    'For completion by a future point, use will have with a past participle.'
  );
  word(
    'future-progress',
    future,
    verbsOf([0], 3, timedActions),
    '(?= +(?:by|before)\\b)',
    'For completion by a future point, use will have with a past participle.'
  );

  const regularised = {
    buyed: 'buy',
    bringed: 'bring',
    breaked: 'break',
    choosed: 'choose',
    eated: 'eat',
    finded: 'find',
    goed: 'go',
    maked: 'make',
    readed: 'read',
    runned: 'run',
    sayed: 'say',
    sended: 'send',
    selled: 'sell',
    speaked: 'speak',
    taked: 'take',
    teached: 'teach',
    telled: 'tell',
    thinked: 'think',
    writed: 'write',
  };
  use(
    'irregular-verbs',
    rx(`\\b(?:(have|has|had|am|is|are|was|were|been) )?(${choices(regularised)})\\b`),
    (_, auxiliary, wrong) => {
      const form = verbs[regularised[wrong.toLowerCase()]][auxiliary ? 2 : 1];
      return (auxiliary ? auxiliary + ' ' : '') + sameCase(wrong, form);
    },
    'This verb has an irregular past form and does not take the regular -ed ending.'
  );
  const modal =
    "(?:can|could|should|would|must|may|might|will|shall|can['’]t|(?:could|should|would|must|might)n['’]t|won['’]t)";
  word(
    'modals',
    `\\b${modal} ${subject} ${adverb}`,
    baseForm,
    '',
    'A modal takes the base verb, including in a question with the subject in between.'
  );
  word(
    'modals',
    `\\b${subject} ${modal} ${adverb}`,
    baseForm,
    '',
    'Use the base verb after a modal such as can, should or would.'
  );
  const modalHave = `\\b(?:could|should|would|must|may|might)(?:n['’]t)? (?:${subject} )?${adverb}have ${adverb}`;
  word(
    'modal-past',
    modalHave,
    perfectActions,
    objectStart,
    'Use modal + have + past participle when you refer to a past action.'
  );
  word(
    'modal-past',
    modalHave,
    differentPast,
    '',
    'Use modal + have + past participle when you refer to a past action.'
  );
  word(
    'modal-past',
    modalHave,
    verbsOf([0], 3, timedActions),
    '(?= +(?:first|earlier|sooner|yesterday|before|by)\\b)',
    'Use modal + have + past participle when you refer to a past action.'
  );

  use(
    'gerunds',
    rx(
      `\\b((?:avoid(?:s|ed)?|finish(?:es|ed)?|enjoy(?:s|ed)?|suggest(?:s|ed)?) )to (${actions.join('|')})\\b`
    ),
    (_, lead, verb) => lead + sameCase(verb, verbs[verb.toLowerCase()][3]),
    'After avoid, finish, enjoy or suggest, use the -ing form for the next activity.'
  );
  const ingToBase = verbsOf([4], 0, actions);
  use(
    'infinitives',
    rx(
      `\\b((?:decid(?:e|es|ed)|agree[sd]?|refuse[sd]?|manage[sd]?|offered|planned) )(${choices(ingToBase)})(?=${completedObject}(?: (?:tomorrow|today|soon|then|later))?${terminal})`
    ),
    (_, lead, verb) => lead + 'to ' + sameCase(verb, ingToBase[verb.toLowerCase()]),
    'When the next words name the planned action, use to with the base verb after decide, agree, refuse or manage.'
  );
  word(
    'used-to',
    `\\b(?:I am|I['’]m|I was|we are|we['’]re|we were|he is|she is|he['’]s|she['’]s) used to `,
    verbsOf([0], 4, ['work', 'handle', 'use', 'deal', 'process', 'review', 'check']),
    '(?= (?:with|the|this|these|those|it|them|our)\\b)',
    'Use an -ing form after be used to when you mean accustomed to an activity.'
  );
  use(
    'phrasal',
    /\b(look(?:s|ed|ing)? up|pick(?:s|ed|ing)? (?:up|out)|fill(?:s|ed|ing)? out|hand(?:s|ed|ing)? (?:in|over)|set(?:s|ting)? up) (it|them)\b/gi,
    (_, phrasal, object) => {
      const [verb, particle] = phrasal.split(' ');
      return verb + ' ' + object + ' ' + particle;
    },
    'With a separable phrasal verb, put a pronoun between the verb and its particle.'
  );

  // Relative clauses and reported or embedded statements.
  use(
    'relative-defining',
    rx(
      `\\b((?:use|open|choose|send|read|click|review|update|check) (?:the|this|that) ${workspace}), +(that) (?=${pronouns} (?:added|attached|shared|sent|updated|marked|mentioned|created|posted)\\b[^,;.!?\\n]{0,85}${terminal})`
    ),
    (_, noun, relative) => noun + ' ' + relative + ' ',
    'When the clause identifies the particular item, keep it joined to the noun.'
  );
  use(
    'relative-extra',
    /\b([\p{Lu}][\p{L}’-]{2,28}, +)that(?= (?:leads|owns|runs|oversees|manages|handles|supports|tested|approved|wrote|will review|is (?:leading|managing))\b[^,;\n.!?]{0,75},)/gu,
    (_, name) => name + 'who',
    'Use who for a person in a relative clause that adds extra information between commas.'
  );
  use(
    'relative-extra',
    rx(
      `\\b((?:the|this|that|our|your|their) ${workspace}, +)that(?= (?:is|was|contains|shows|lists|will be)\\b[^,;\\n.!?]{0,75},)`
    ),
    (_, noun) => noun + 'which',
    'Use which for a thing in a relative clause that adds extra information between commas.'
  );

  const embeddedSubject = `(?:${pronouns}|(?:the|this|our|your|their) (?:${workspace}|${people}|goods|files|results|tests)s?)`;
  const questionAux = '(?:can|could|will|would|should|is|are|was|were|has|have|had)';
  function embedded(lesson, opening, reason) {
    use(
      lesson,
      rx(
        `\\b(${opening} (?:when|where|how(?: long)?|why|whether|if) )(${questionAux}) (${embeddedSubject})\\b${end}`
      ),
      (_, lead, auxiliary, actor) => `${lead}${actor} ${auxiliary}`,
      reason
    );
  }
  embedded(
    'indirect-questions',
    '(?:tell me|confirm|let (?:me|us) know|do you know|can you explain|check|find out)',
    'Use statement order in an indirect question. Put the subject before its helping verb.'
  );
  embedded(
    'reported-questions',
    '(?:asked(?: (?:me|us|them|him|her))?|wondered|wanted to know)',
    'In a reported question, put the subject before the helping verb.'
  );
  use(
    'reported',
    /\bsaid (me|us|him|her|them)(?= that\b)/gi,
    (_, person) => 'told ' + person,
    'Use told before the person receiving the message, or use said to.'
  );
  use(
    'because-although',
    rx(
      `\\bdespite(?= ${subject} (?:is|are|was|were|had|has|have|could|ran|failed|stopped|arrived)\\b[^,;\\n.!?]{0,85},)`
    ),
    () => 'although',
    'Use although before a full clause. Despite is followed by a noun phrase or an -ing form.'
  );
  use(
    'because-although',
    /\bbecause (?=(?:the|a|this|that) (?:delay|outage|weather|error|change|deadline|incident)(?:[,.!?;\n]|$))/gi,
    match => match + 'of ',
    'Use because of before a noun phrase that gives the reason.'
  );

  const eventVerbs = [
    'arrive',
    'begin',
    'close',
    'complete',
    'confirm',
    'finish',
    'open',
    'receive',
    'return',
    'start',
  ];
  const laterEvent = `(${subject}) will (${eventVerbs.join('|')})\\b`;
  const singularActor = new RegExp(
    `^(?:he|she|it|(?:the|this|our|your|their) (?:${workspace}|${people}))$`,
    'i'
  );
  function presentVerb(actor, verb) {
    return singularActor.test(actor) ? sameCase(verb, verbs[verb.toLowerCase()][0]) : verb;
  }
  use(
    'time-clauses',
    rx(
      `\\b((?:${subject})(?: will|['’]ll) (?:ping|reply|notify|message|send|start|release|reopen|continue|follow up)(?: (?:it|you|them|the ${workspace}))? (?:when|until|before|after|once|as soon as) )${laterEvent}`
    ),
    (_, lead, actor, verb) => lead + actor + ' ' + presentVerb(actor, verb),
    'Use the present form in a time clause about a future event after when, once or as soon as.'
  );
  use(
    'purpose-result',
    rx(
      `\\b((?:sent|attached|shared|forwarded|prepared|tagged|saved|posted)(?: (?:it|them|the ${workspace}s?)) )for ((?:you|we|they|he|she) (?:can|could))\\b`
    ),
    (_, before, after) => before + 'so that ' + after,
    'Use so that before a clause that explains the purpose of the action.'
  );
  use(
    'comparisons',
    /\bmore (better|worse|faster|slower|easier|harder|longer|shorter|sooner|clearer|closer|simpler|cheaper|larger|smaller|taller|quicker|higher|lower|earlier|later)\b/gi,
    (_, comparative) => comparative,
    'Use one comparative form. Words such as faster and better already express a comparison.'
  );
  use(
    'too-enough',
    /\benough (small|large|clear|simple|accurate|complete|safe|fast|light|easy|close|strong|detailed|short|long|good)(?= to\b)/gi,
    (_, adjective) => adjective + ' enough',
    'Put enough after an adjective when it describes the degree needed to do something.'
  );
  use(
    'parallelism',
    rx(
      `\\b((?:goals?|plans?|priorities|objectives) (?:are|is) to (?:${actions.join('|')})[^,;\\n.!?]{0,65}, )(${choices(ingToBase)})(?=[^,;\\n.!?]{0,65}(?:, and| and) (?:${actions.join('|')})\\b)`
    ),
    (_, lead, gerund) => lead + sameCase(gerund, ingToBase[gerund.toLowerCase()]),
    'Use matching verb forms for the actions in this list.'
  );

  const passiveVerbs = [
    'accept',
    'add',
    'approve',
    'attach',
    'cancel',
    'change',
    'check',
    'confirm',
    'create',
    'deliver',
    'document',
    'email',
    'file',
    'fill',
    'give',
    'log',
    'pay',
    'post',
    'prepare',
    'print',
    'process',
    'receive',
    'record',
    'reject',
    'release',
    'remove',
    'report',
    'resolve',
    'review',
    'revise',
    'schedule',
    'send',
    'share',
    'sign',
    'store',
    'submit',
    'test',
    'transfer',
    'update',
    'upload',
    'use',
    'validate',
    'write',
  ];
  const passiveForm = verbsOf([0, 2], 3, passiveVerbs);
  const passiveObject = `(?:${workspace}|goods|labels|forms|orders|files|invoices|documents|messages|receipts|items|materials)`;
  const passiveSubject = `(?:it|they|(?:the|this|that|these|those|our|your|their) ${passiveObject}s?)`;
  const passiveSuffix =
    '(?= +(?:by|on|to|from|before|after|yesterday|last|today|tomorrow|earlier|later|already|this (?:morning|week))\\b| *[,.!?;\\n]|$)';
  const passiveReason =
    'When the subject receives the action, use a past participle after be to form the passive.';
  word(
    'passive',
    `\\b${passiveSubject} (?:(?:is|are|was|were|get|got)(?: already| just)?|(?:had|has|have) been|(?:will|should|must|can|could) be) `,
    passiveForm,
    passiveSuffix,
    passiveReason
  );
  word(
    'passive',
    `${clause}(?:(?:is|are|was|were) ${passiveSubject}|(?:has|have|had) ${passiveSubject} been|(?:will|can|should|could) ${passiveSubject} be) ${adverb}`,
    passiveForm,
    passiveSuffix,
    passiveReason
  );

  // Explicit pairs of conditional clauses supply the time relationship.
  const willResult = `(?=[^,.;!?\\n]{0,85}, +${subject}(?: will|['’]ll)\\b)`;
  use(
    'zero-first',
    rx(`${clause}(if )${laterEvent}${willResult}`),
    (_, lead, actor, verb) => lead + actor + ' ' + presentVerb(actor, verb),
    'A condition about a possible future event normally takes the present form after if.'
  );
  use(
    'second',
    rx(
      `${clause}(if ${subject}) would (have|be|know)(?=[^,.;!?\\n]{1,85}, +${subject}(?: would|['’]d) (?:${actions.join('|')}|be|go|work|wait)\\b)`
    ),
    (_, lead, base) =>
      lead + ' ' + (base.toLowerCase() === 'be' ? 'were' : verbs[base.toLowerCase()][1]),
    'In this hypothetical conditional, use a past form after if and would in the result.'
  );
  use(
    'third',
    rx(
      `${clause}(if ${subject}) would have(?= (?:${choices(completedVerbs)})\\b[^,.;!?\\n]{0,85}, +${subject}(?: would|['’]d) have\\b)`
    ),
    (_, lead) => lead + ' had',
    'Use had and a past participle for the unreal past condition. The result takes would have.'
  );
  use(
    'wishes',
    /\b((I|we|you|they|he|she) wish(?:es)? \2) (am|is|are|have|has|know|knows)(?= (?:access|the|more|enough|what|how|where|there|ready|available|free)\b)/gi,
    (_, lead, actor, verb) =>
      lead +
      ' ' +
      { am: 'were', is: 'were', are: 'were', have: 'had', has: 'had', know: 'knew', knows: 'knew' }[
        verb.toLowerCase()
      ],
    'For a wish about your current situation, use a past form after wish.'
  );

  use(
    'inversion',
    rx(
      `${clause}((?:only then|only later|never before|rarely) )(${pronouns}) (did|do|does|have|has|had|can|could|will|would)\\b`
    ),
    (_, lead, actor, auxiliary) => lead + auxiliary + ' ' + actor,
    'When this limiting phrase starts the sentence, put the helping verb before the subject.'
  );
  use(
    'cleft',
    rx(
      `${clause}(what ${pronouns} (?:need|want|needed|wanted|requires?|lacks?)) (?=(?:a|an|the|this|that) (?:${workspace}|solution|answer)s?${terminal})`
    ),
    (_, lead) => lead + (/\b(?:needed|wanted)$/i.test(lead) ? ' was ' : ' is '),
    'Use a form of be to connect the what-clause to the thing it emphasises.'
  );
  use(
    'ellipsis',
    rx(
      `\\b((?:can['’]t|(?:could|should|would|must|might)n['’]t|shan['’]t) )to +(?=(?:${actions.join('|')}|be|go|work)\\b)`
    ),
    (_, lead) => lead,
    'A modal can stand alone when you omit a repeated action. If you keep the action, use the base verb directly.'
  );
  use(
    'subjunctive',
    rx(
      `\\b((?:require[sd]?|ask(?:s|ed)?|recommend(?:s|ed)?|suggest(?:s|ed)?|insist(?:s|ed)?) that ${subject} )to +(?=(?:${actions.join('|')}|be|have)\\b)`
    ),
    (_, lead) => lead,
    'After these expressions with that, use the base form for the requested or recommended action.'
  );
  use(
    'subjunctive',
    rx(
      `\\brecommend(?:s|ed)? (?:the|your|our) ${people} to (?:review|check|approve|confirm|update)\\b`
    ),
    null,
    'If you mean to recommend an action, use recommend that followed by the person and the base verb.',
    'Review'
  );
  word(
    'causatives',
    `\\b${workplaceActor}(?: (?:had|have|has|got|get|gets)|(?: will|['’]ll) (?:get|have)) (?:the|this|these|our|your) (?:labels|forms|reports?|invoices?|files?|documents?|request|badges) `,
    verbsOf([0], 3, ['check', 'review', 'print', 'send', 'approve', 'process', 'post', 'update']),
    '(?= +(?:yesterday|today|tomorrow|by|on|this (?:morning|week)|before)\\b| *[.!?;\\n]|$)',
    'Use a past participle when you arrange for someone to do something to the item.'
  );
  word(
    'advanced-agreement',
    `\\bthe number of (?:the |open |pending |overdue )?${pluralNoun} `,
    singularBe,
    '',
    'The subject is the number, which refers to one total. Use a singular verb.'
  );
  word(
    'advanced-agreement',
    `\\ba number of (?:the |open |pending |overdue )?${pluralNoun} `,
    pluralBe,
    '',
    'A number of means several, so use a plural verb.'
  );
  use(
    'coordination',
    /\beither (?!\s*[.!?])(?:(?!\bor\b)[^.!?;\n]){2,80}?\band\b(?:(?!\bor\b)[^.!?;\n]){2,75}(?=[.!?;\n])/gi,
    null,
    'Check whether you mean a choice or both actions. Use either … or for a choice.',
    'Review'
  );

  use(
    'capitals',
    /\bi(?=['’](?:m|ll|ve|d)\b| (?:am|was|will|can|could|would|should|have|had|did|do|need|want|think|sent|saw|went|wrote|checked|received|emailed|said|will)\b)/g,
    () => 'I',
    'Capitalise the pronoun I, including in a contraction.',
    'Capitalisation'
  );
  use(
    'commas',
    rx(
      `${clause}${subject} (?:arrived|failed|finished|ended|closed|was|were|is|are|has been|have been)\\b[^,.!?;\\n]{0,75}, +(?!and\\b|but\\b|so\\b)${subject} (?:was|were|is|are|has been|have been|will|could|can|would)\\b[^,.!?;\\n]{1,75}${terminal}`
    ),
    null,
    'These clauses can each stand as a sentence. Consider a full stop or a conjunction that shows how they connect.',
    'Review'
  );
  word(
    'contractions',
    '\\b',
    {
      arent: 'aren’t',
      couldnt: 'couldn’t',
      didnt: 'didn’t',
      doesnt: 'doesn’t',
      dont: 'don’t',
      hadnt: 'hadn’t',
      hasnt: 'hasn’t',
      havent: 'haven’t',
      isnt: 'isn’t',
      mustnt: 'mustn’t',
      shouldnt: 'shouldn’t',
      wasnt: 'wasn’t',
      werent: 'weren’t',
      wouldnt: 'wouldn’t',
    },
    '',
    'Use an apostrophe in this negative contraction.',
    'Punctuation'
  );
  word(
    'contractions',
    `\\b${subject} `,
    { cant: 'can’t', wont: 'won’t' },
    `(?= +(?:${actions.join('|')}|be|go|have|join|work)\\b)`,
    'Use an apostrophe when you mean cannot or will not.',
    'Punctuation'
  );
  use(
    'punctuation',
    /(?<=[\p{L}\p{N})\]]) +(,|\.)(?= *(?:$|[\r\n!?'"’”)\]]| [\p{L}]))/gu,
    (_, mark) => mark,
    'Place this punctuation directly after the preceding word.',
    'Punctuation'
  );
  use(
    'punctuation',
    /(?<=[\p{L})])[!?](?=[\p{Lu}][\p{Ll}])/gu,
    mark => mark + ' ',
    'Put a space after the punctuation when a new sentence follows.',
    'Punctuation'
  );
  use(
    'hyphens',
    rx(
      `\\b(${numeral}|one|[0-9]+)(?:-| )(hours?|days?|weeks?|months?|years?|minutes?)(?= (?:review|call|workshop|meeting|session|training|plan|period|delay|window|deadline|notice|extension|lead time)\\b)`
    ),
    (_, amount, unit) => amount + '-' + unit.replace(/s$/i, ''),
    'Use a hyphen and a singular time unit when the quantity modifies the next noun.',
    'Punctuation'
  );
  use(
    'tone',
    /(?:^|(?<=[.!?;\n]) *)reply ASAP\b/gi,
    null,
    'Consider naming the reply you need and giving a deadline the reader can act on.',
    'Review'
  );

  use(
    'time-prepositions',
    rx(
      `\\bin (${day})(?= *(?:$|[,.!?;\\n])| +(?:morning|afternoon|evening|at [0-9]|next week)\\b)`
    ),
    (_, weekday) => 'on ' + weekday,
    'Use on with a weekday.'
  );
  use(
    'time-prepositions',
    /\bon (?=(?:[01]?\d|2[0-3]):[0-5]\d\b|\d{1,2} *(?:a\.?m\.?|p\.?m\.?)\b)/gi,
    () => 'at ',
    'Use at with a clock time.'
  );
  use(
    'object-order',
    rx(
      `\\b(explain(?:s|ed)?|describe[sd]?|mention(?:s|ed)?) (me|us|him|her|them) ((?:the|this|that|these|those|our|your|their) (?:new |updated |revised )?(?:${workspace}|issue|problem|rule|changes)s?)\\b(?= *(?:[,.!?;\\n]|$)| +(?:again|today|later|tomorrow|in more detail)\\b)`
    ),
    (_, verb, person, object) => `${verb} ${object} to ${person}`,
    'Put the thing being explained before to and the person receiving the explanation.'
  );
  word(
    'singular-they',
    '\\bthey ',
    pluralBe,
    '',
    'Use are, were, have or do with they, even when they refers to one person.'
  );

  const tagAux = "(?:is|are|was|were|has|have|can|could|will|would|do|does|did)(?:n['’]t)?";
  use(
    'tags',
    rx(
      `\\b((?:${subject}) (is|are|was|were|can|could|will|would)(?:n['’]t)?\\b[^,.;!?\\n]{1,65}, +)(${tagAux})(?= +(?:it|they|you|we|he|she|I) *\\?)`
    ),
    (_, lead, auxiliary, tag) => {
      if (tag.toLowerCase().replace(/n['’]t$/, '') === auxiliary.toLowerCase()) return;
      const negative = /n['’]t$/i.test(tag);
      return (
        lead +
        (negative && auxiliary.toLowerCase() === 'will'
          ? 'won’t'
          : auxiliary + (negative ? 'n’t' : ''))
      );
    },
    'Use the same helping verb in the question tag as in the main clause.'
  );
  use(
    'whether-if',
    /\b((?:decide[sd]?|discuss(?:es|ed)?|talk(?:s|ed)? about|depends? on|asked|cho(?:ose|se)|unsure|uncertain|a question of) +)if(?= to +[a-z])/gi,
    (_, lead) => lead + 'whether',
    'Use whether before a to-infinitive that expresses a choice.'
  );
  word(
    'too-much-agreement',
    `\\b(?:half|most|all|some|part|a portion) of (?:the|this|our|your|their) ${mass} `,
    singularBe,
    '',
    'Use a singular verb when a fraction or quantity refers to an uncountable noun.'
  );
  word(
    'too-much-agreement',
    `\\b(?:half|most|all|some) of (?:the|these|those|our|your|their) ${pluralNoun} `,
    pluralBe,
    '',
    'Use a plural verb when a fraction or quantity refers to a plural noun.'
  );
  word(
    'word-formation',
    '\\b(?:need(?:s|ed)?|require[sd]?|await(?:s|ed|ing)?|pending|waiting for) (?:your|our|their|his|her|final|written) ',
    {
      approve: 'approval',
      agree: 'agreement',
      confirm: 'confirmation',
      decide: 'decision',
      depart: 'departure',
      accept: 'acceptance',
      perform: 'performance',
      respond: 'response',
    },
    `(?:${nounEnd}|(?= +(?:by|before)\\b))`,
    'Use the noun form here, where the phrase names the thing you need or are waiting for.'
  );
  const regularNouns = Object.fromEntries(
    [
      'file',
      'report',
      'document',
      'form',
      'request',
      'order',
      'invoice',
      'quote',
      'message',
      'email',
      'record',
      'attachment',
      'test',
      'result',
      'item',
      'issue',
      'field',
      'error',
      'task',
      'supplier',
      'option',
      'project',
      'material',
      'question',
      'day',
      'week',
      'hour',
      'purchase order',
      'po',
      'pr',
    ].map(noun => [noun, noun + 's'])
  );
  word(
    'each-every',
    '\\bone of (?:the|these|those|your|our|their) ',
    { ...regularNouns, ...plurals, box: 'boxes' },
    nounEnd,
    'Use the plural noun to name the group after one of.'
  );
  word(
    'numbers-dates',
    `\\b${numeral} `,
    { ...regularNouns, box: 'boxes', batch: 'batches', class: 'classes' },
    nounEnd,
    'Use the plural noun after a number greater than one.'
  );
  use(
    'numbers-dates',
    /\b([1-9][0-9]*)(st|nd|rd|th)(?= +(?:of +)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\b)/gi,
    (_, number, old) => {
      const suffix = /^1[123]$/.test(number.slice(-2))
        ? 'th'
        : { 1: 'st', 2: 'nd', 3: 'rd' }[number.at(-1)] || 'th';
      if (old.toLowerCase() !== suffix) return number + suffix;
    },
    'Use the ordinal ending for this date. Numbers ending in 11, 12 or 13 take th.'
  );

  root.WorkHubEnglishGrammarChecks = rules;
})(globalThis);
