/* Local checks linked to Grammar Library lessons. Match forms that have enough context to review. */
(function (root) {
  'use strict';

  const rules = [];
  const rx = source => new RegExp(source, 'gi');
  const choices = words => Object.keys(words).join('|');
  const pronouns = '(?:I|you|we|they|he|she|it)';
  const people =
    '(?:buyer|supplier|vendor|requester|approver|manager|reviewer|tester|user|colleague|developer|customer|friend|brother|sister|parent|neighbour|neighbor|student|teacher|coordinator)';
  const workspace =
    '(?:file|report|document|form|request|order|invoice|quote|message|email|delivery|application|system|process|record|update|attachment|purchase order|test|result|item|issue|PO|PR|RFQ)';
  const named = `(?:the|this|that|our|their|your|my|its) (?:${people}|${workspace})s?`;
  const subject = `(?:${pronouns}|${named})`;
  const clause = '(?:^|(?<=[.!?;\\n]) *)';
  const end = '(?=[ ,.?!;\\n]|$)';
  const terminal = '(?= *(?:[.!?;\\n]|$))';
  const adverb =
    '(?:(?:not|just|already|never|ever|always|still|really|also|please|kindly|only) )?';
  const objectStart =
    '(?= +(?:the|this|that|these|those|our|their|your|my|his|her|its|it|them|him|me|us|you|breakfast|lunch|dinner)\\b)(?! +the (?:next|following|same) (?:day|week|month|year)\\b)';
  const writtenNumber = '(?:two|three|four|five|six|seven|eight|nine|ten|several)';
  const numeral = `(?:${writtenNumber}|[2-9]|[1-9][0-9]+)`;
  const nounEnd =
    '(?= *(?:[,.!?;:\\n]|$)| +(?:is|are|was|were|has|have|needs?|require[sd]?|remain[sed]*|will|can|must|should|on hold|in stock)\\b)';

  function use(lessonId, pattern, replace, reason, type = 'Grammar', id = lessonId) {
    rules.push({ id, lessonId, pattern, replace, reason, type });
  }

  function sameCase(word, replacement) {
    if (/^(?:PO|PR|RFQ)$/.test(word) && replacement === word.toLowerCase() + 's') return word + 's';
    if (/^(?:PO|PR|RFQ)s$/.test(word) && replacement === word.slice(0, -1).toLowerCase())
      return word.slice(0, -1);
    if (/^[A-Z]{2,}$/.test(word)) return replacement.toUpperCase();
    if (/^[A-Z]/.test(word)) return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    return replacement;
  }

  // The prefix is kept verbatim. The suffix is lookahead and supplies context for the edit.
  function word(lesson, prefix, words, suffix, reason, type, id) {
    use(
      lesson,
      rx(`${prefix}(${choices(words)})\\b${suffix}`),
      (match, original) => {
        return match.slice(0, -original.length) + sameCase(original, words[original.toLowerCase()]);
      },
      reason,
      type,
      id
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
    activity: 'activities',
    city: 'cities',
    family: 'families',
    memory: 'memories',
    mouse: 'mice',
    party: 'parties',
    story: 'stories',
    watch: 'watches',
  };
  const nounForms = {
    ...Object.fromEntries(
      'apple appointment attachment bag bike bird book bottle call car cat chair change childminder coat colleague computer cup day desk detail document dog email error event example field file flower form friend game garden goal group hour idea image invoice issue item job lesson letter list meeting message minute month morning note office option order page paper parent photo picture plan plant problem project question quote record report request result review road room rule schedule school seat shop sign student supplier table task teacher test ticket tool train trip update user visit week window word year material po pr rfq'
        .split(' ')
        .concat('purchase order')
        .map(noun => [noun, noun + 's'])
    ),
    ...plurals,
    batch: 'batches',
    box: 'boxes',
    bus: 'buses',
    class: 'classes',
  };
  const singularForms = Object.fromEntries(
    Object.entries(nounForms).map(([singular, plural]) => [plural, singular])
  );
  const singularNoun = `(?:${choices(nounForms)})`;
  const pluralNoun = `(?:${choices(singularForms)})`;
  const nounModifiers =
    '(?:(?:(?:very|really|quite|rather|especially|extremely|particularly|surprisingly|unusually|incredibly|so) +){0,2}(?:amazing|annual|available|awful|bad|beautiful|big|bright|busy|clean|clear|cold|comfortable|complete|correct|current|difficult|different|easy|early|empty|exciting|excellent|final|fine|first|fresh|fun|funny|good|great|happy|hard|heavy|helpful|hot|important|interesting|large|last|late|latest|long|lovely|missing|modern|new|nice|old|open|original|outstanding|overdue|pending|pleasant|positive|productive|quiet|ready|recent|red|revised|short|simple|small|special|strange|successful|sunny|terrible|useful|updated|unusual|urgent|warm|white|wonderful|wrong|young) +){0,3}';
  const countNounEnd = `(?:${nounEnd}|(?= +(?:and|or|about|at|by|before|after|for|from|in|on|to|with|without|that|which|who|came|went|arrived|returned|joined|passed|ahead|left|today|tomorrow|yesterday)\\b))`;
  use(
    'countability',
    rx(
      `\\ban? +(${nounModifiers}(?:advice|equipment|feedback|furniture|information|luggage|research|evidence|software))\\b${countNounEnd}`
    ),
    (_, description) => 'some ' + description,
    'Use some with these uncountable nouns, or name the unit you mean, such as a piece of equipment.'
  );
  word(
    'plural-nouns',
    `\\b(?:${numeral}|both|many|several) +${nounModifiers}`,
    plurals,
    countNounEnd,
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
  const startsWithLabelA = (article, index, text) =>
    article === 'A' && labelBefore.test(text.slice(Math.max(0, index - 25), index));
  function articleForWord(next) {
    if (articleFollowing.test(next)) return;
    const initials = next.split('-')[0];
    if (/^(?:ERP|RFQ|HR|HTTP|HTTPS|MRI|MBA|MRP|SLA|SSO|XML|XLS|HTML)$/.test(initials)) return 'an';
    if (/^(?:PO|PR|PDF|CSV|VAT|UAT|USB|URL)$/.test(initials)) return 'a';
    if (/^[A-Z]{2,}$/.test(initials) || initials.length === 1) return;
    return vowelSound.test(next) && !consonantVowelStart.test(next) ? 'an' : 'a';
  }

  // “A people” can refer to a single community or nation.
  const articleNoun = `(a|an)( +${nounModifiers})((?!people\\b)${pluralNoun})\\b${countNounEnd}`;
  const articleNumber = new RegExp(`^${articleNoun}`, 'i');
  use(
    'articles-a-an',
    rx(`\\b${articleNoun}`),
    (match, article, modifiers, noun, index, text) => {
      if (startsWithLabelA(article, index, text) || noun === 'Windows') return;
      if (
        /^ +(?:are|were|have)\b/i.test(text.slice(index + match.length)) ||
        /\bthere +(?:are|were)(?: +(?:still|only|also))? +$/i.test(
          text.slice(Math.max(0, index - 24), index)
        )
      )
        return match.slice(article.length).trimStart();
      const singular = sameCase(noun, singularForms[noun.toLowerCase()]);
      const next = modifiers.trim().split(/ +/)[0] || singular;
      return (
        sameCase(article, articleForWord(next) || article.toLowerCase()) + modifiers + singular
      );
    },
    'Use a or an with a singular countable noun. Use the plural by itself when you mean more than one.'
  );
  use(
    'articles-a-an',
    /\b(a|an) +([A-Za-z]+(?:-[A-Za-z]+)*)\b/gi,
    (match, article, next, index, text) => {
      if (startsWithLabelA(article, index, text) || articleNumber.test(text.slice(index))) return;
      const corrected = articleForWord(next);
      if (corrected && article.toLowerCase() !== corrected)
        return sameCase(article, corrected) + match.slice(article.length);
    },
    'Choose a or an by the sound that immediately follows it.'
  );

  function quantityWord(lesson, options, nouns, explanation) {
    word(lesson, '\\b', options, `(?= +${nounModifiers}${nouns}\\b${countNounEnd})`, explanation);
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
  word(
    'quantity',
    `\\b(?:many|both|a few) +${nounModifiers}`,
    nounForms,
    countNounEnd,
    'Use a plural countable noun after many, both or a few.'
  );
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
  const timeWords = {
    todays: 'today',
    yesterdays: 'yesterday',
    tomorrows: 'tomorrow',
    tonights: 'tonight',
  };
  const sentenceStart = '(?:^ *|(?<=[.!?\\n]) *)';
  const calendarWord = '(?:today|yesterday|tomorrow|tonight)';
  const followsAbbreviation = (text, index) =>
    /\b(?:[a-z]\.[a-z]|(?:mr|mrs|ms|dr|prof|st|vs|fig|no|dept|approx))\.$/i.test(
      text.slice(Math.max(0, index - 16), index).trimEnd()
    );
  const calendarAdjective =
    '(?:busy|quiet|good|bad|tiring|fun|cold|hot|different|fine|special|exciting|hard|easy|important|nice|long|short|sunny|rainy|better|worse|lovely|unusual|difficult)';
  const calendarNounPhrase = `(?:an?|another|the|my|our|your) +${nounModifiers}(?:${singularNoun}|holiday|occasion|milestone|deadline|start|end|anniversary)\\b${countNounEnd}`;
  const calendarComplement = `(?= +(?:(?:not|very|really|quite|particularly|still) +){0,2}(?:${calendarNounPhrase}|going to be\\b|${day}\\b|${calendarAdjective}\\b(?= *(?:[.!?;,\\n]|$)| +(?:for|because|compared|when|to)\\b)))`;
  const calendarAgreement = {
    are: 'is',
    were: 'was',
    "aren't": 'isn’t',
    'aren’t': 'isn’t',
    "weren't": 'wasn’t',
    'weren’t': 'wasn’t',
    have: 'has',
    "haven't": 'hasn’t',
    'haven’t': 'hasn’t',
  };
  use(
    'agreement',
    rx(
      `${sentenceStart}${calendarWord} +(?:(are|were|(?:are|were)n['’]t)\\b${calendarComplement}|(have(?:n['’]t)?)\\b(?= +(?:not +)?been\\b))`
    ),
    (match, be, have, index, text) => {
      if (followsAbbreviation(text, index)) return;
      const verb = be || have;
      return match.slice(0, -verb.length) + sameCase(verb, calendarAgreement[verb.toLowerCase()]);
    },
    'Use a singular verb when today, tomorrow, yesterday or tonight is the subject.'
  );
  use(
    'capitals',
    new RegExp(
      `${sentenceStart}(${calendarWord})(?= +(?:is|are|was|were|has|have|will|would|can|could|should|may|might|starts?|ends?|marks?|begins?)(?:n['’]t)?\\b)`,
      'g'
    ),
    (match, time, index, text) => {
      if (followsAbbreviation(text, index)) return;
      return match.slice(0, -time.length) + time[0].toUpperCase() + time.slice(1);
    },
    'Capitalise the first word of a sentence.',
    'Capitalisation'
  );
  word(
    'word-formation',
    '\\b',
    timeWords,
    '(?= +(?:is|was|has|starts?|ends?|marks?|begins?)\\b)',
    'Use today, yesterday, tomorrow or tonight when the word itself names the time.'
  );
  word(
    'word-formation',
    '\\b(?:by|until|since|as of) +',
    timeWords,
    terminal,
    'Use the time word without an s when it gives a deadline or starting point.'
  );
  use(
    'possessives',
    rx(
      `\\b(today|yesterday|tomorrow|tonight)s(?= +${nounModifiers}(?:${singularNoun}|${pluralNoun})\\b${countNounEnd})`
    ),
    (_, time) => time + '’s',
    'Add an apostrophe before the s when a time word modifies a noun, as in “today’s meeting”.'
  );
  use(
    'reflexives',
    /\b((?:please|(?:could|can|would|will) you) (?:reply|respond|send|forward|return|write|give|email)(?: +[^,.;!?\n]{1,55}?)? +to +)myself\b/gi,
    (_, before) => before + 'me',
    'Use me when someone else sends something to you. Myself refers back to I in the same clause.'
  );

  // Common verbs and their forms. Keep unchanged participles when they are already valid.
  const spellingChanges = {
    cancel: ['cancelled', 'cancelling'],
    log: ['logged', 'logging'],
    plan: ['planned', 'planning'],
    refer: ['referred', 'referring'],
    stop: ['stopped', 'stopping'],
    shop: ['shopped', 'shopping'],
    submit: ['submitted', 'submitting'],
    tag: ['tagged', 'tagging'],
    transfer: ['transferred', 'transferring'],
    travel: ['travelled', 'travelling'],
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
    cost: ['costs', 'cost', 'cost', 'costing'],
    cut: ['cuts', 'cut', 'cut', 'cutting'],
    do: ['does', 'did', 'done', 'doing'],
    draw: ['draws', 'drew', 'drawn', 'drawing'],
    drink: ['drinks', 'drank', 'drunk', 'drinking'],
    drive: ['drives', 'drove', 'driven', 'driving'],
    eat: ['eats', 'ate', 'eaten', 'eating'],
    fall: ['falls', 'fell', 'fallen', 'falling'],
    feel: ['feels', 'felt', 'felt', 'feeling'],
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
    sing: ['sings', 'sang', 'sung', 'singing'],
    sit: ['sits', 'sat', 'sat', 'sitting'],
    sleep: ['sleeps', 'slept', 'slept', 'sleeping'],
    speak: ['speaks', 'spoke', 'spoken', 'speaking'],
    spend: ['spends', 'spent', 'spent', 'spending'],
    stand: ['stands', 'stood', 'stood', 'standing'],
    swim: ['swims', 'swam', 'swum', 'swimming'],
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
    [
      ...baseVerbs,
      ...'ask bake bark bathe brush believe charge clean climb cook dance enjoy exercise jump last like listen live love miss rain remember rest save shop smile sneeze study travel visit walk wash weigh'.split(
        ' '
      ),
    ].map(base => {
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
  const dailyActions =
    'ask bake bark bathe believe brush clean climb come cook dance draw drink drive eat enjoy exercise feel find forget give go grow hear jump know learn like listen live look love meet miss play rain remember rest run shop sing sit sleep smile sneeze speak study swim talk teach travel try visit walk wash wear'.split(
      ' '
    );
  const transitiveActions = [
    ...actions,
    ...'ask bake brush clean cook draw drink eat find grow learn like love play remember study visit wash wear'.split(
      ' '
    ),
  ];
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
  const activities =
    'check finish join review start stop submit test work wait walk sleep cook eat play read travel study'.split(
      ' '
    );

  function progressive(lesson, lead, reason) {
    word(lesson, lead, verbsOf([0], 4, transitiveActions), objectStart, reason);
    word(lesson, lead, verbsOf([0], 4, activities), timeMarker, reason);
  }

  const questionWord = '(?:how(?: +(?:long|often|much|far))?|what|where|when|why|who|which)';
  const questionOpening = `${clause}(?:${questionWord} +)?`;
  const questionTime =
    '(?:today|tomorrow|tonight|now|later|already|again|yet|here|there|right now|these days|at the moment|this (?:morning|afternoon|evening|week)|next (?:week|month))';
  const questionRecipient = '(?:it|them|him|her|me|us|you|this|that|these|those)';
  const questionNoun = `(?:a|an|the|this|that|those|these|my|your|our|their) +${nounModifiers}(?:${singularNoun}|${pluralNoun}|door|answer|breakfast|lunch|dinner)\\b`;
  const questionArgument = `(?:${questionRecipient}|${questionNoun}|(?:to|for|at|in|on|with) +${questionNoun})`;
  const questionClose = '(?= *(?:\\?|\\n|$))';
  const questionPronoun = {
    my: 'I',
    your: 'you',
    its: 'it',
    his: 'he',
    her: 'she',
    our: 'we',
    their: 'they',
    "you're": 'you',
    'you’re': 'you',
    "we're": 'we',
    'we’re': 'we',
    "they're": 'they',
    'they’re': 'they',
  };
  const pronounReason =
    'Use a subject pronoun after the helping verb in a question. A possessive like your introduces a noun.';
  const ingVerbs = choices(verbsOf([4], 0, Object.keys(verbs)));
  word(
    'pronouns',
    `${questionOpening}(?:are|were)(?:n['’]t)? +`,
    Object.fromEntries(
      Object.entries(questionPronoun).filter(([, form]) => /^(?:you|we|they)$/.test(form))
    ),
    `(?= +(?:${ingVerbs})\\b(?: +(?:${questionArgument}|well|fine|okay|better|worse|on|for|with))?(?: +${questionTime})?${questionClose})`,
    pronounReason
  );
  use(
    'pronouns',
    rx(
      `${questionOpening}(can|could|will|would|should|may|might|must|do|does|did)( +)(${choices(questionPronoun)})\\b(?= +(?:${[...new Set([...actions, ...dailyActions, 'be', 'have', 'need'])].join('|')})\\b(?: +(?:${questionArgument}|free|ready|available))?(?: +${questionTime})?${questionClose})`
    ),
    (match, auxiliary, space, form) => {
      const pronoun = questionPronoun[form.toLowerCase()];
      const singular = /^(?:he|she|it)$/.test(pronoun);
      const verb = /^do(?:es)?$/i.test(auxiliary)
        ? sameCase(auxiliary, singular ? 'does' : 'do')
        : auxiliary;
      const opening = match.slice(0, -(auxiliary.length + space.length + form.length));
      return opening + verb + space + pronoun;
    },
    pronounReason
  );

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
  const individualNouns = Object.keys(nounForms)
    .filter(noun => !['group', 'class', 'company', 'party', 'family'].includes(noun))
    .join('|');
  const singularSubjectPhrase = `(?:a|an|the|this|that|my|your|our|their|his|her) +${nounModifiers}(?:${individualNouns})`;
  const pluralSubjectPhrase = `(?:the|these|those|my|your|our|their|his|her) +${nounModifiers}${pluralNoun}`;

  // Require a subject and a known main verb in a direct question. In a question such
  // as “How many boxes fit?”, the question phrase itself is the subject.
  const countQuantity = `(?:${pluralNoun}|units|pallets|deliveries|goods)`;
  const massQuantity = `(?:${mass}|time|money|space|water|work)`;
  const quantityPhrase = `(?:much|many)(?: +${nounModifiers}(?:${countQuantity}|${massQuantity}))?`;
  const whQuestion = `(?:(?:how|what) +${quantityPhrase}|how +(?:long|far|often)|what|when|where|why)`;
  const questionNounSubject = `(?:a|an|the|this|that|these|those|my|your|our|their|his|her|its) +${nounModifiers}(?:${singularNoun}|${pluralNoun}|${workspace}s?|${people}s?|(?:unit|product|package|device|team)s?)`;
  const questionSubject = `(?:${questionNounSubject}|${pronouns}|this|that|these|those)`;
  const subjectTakesDo = new RegExp(
    `(?:^| +)(?:I|you|we|they|these|those|${pluralNoun}|${people}s|units|products|packages|systems|devices|teams)$`,
    'i'
  );
  const questionVerbs =
    'add arrive bring buy charge check contain cost deliver do finish go have hold know last leave make mean need open pay receive release save say sell send show spend start take use wait weigh work'.split(
      ' '
    );
  const pastQuestionForms = verbsOf([2], 0, questionVerbs);
  const questionForms = {
    ...Object.fromEntries(questionVerbs.map(verb => [verb, verb])),
    ...verbsOf([1], 0, questionVerbs),
    ...pastQuestionForms,
  };
  const questionTail = '[^.!?;\\n]{0,120}';
  const questionTag =
    "(?:right|correct|okay|(?:is|are|was|were|do|does|did|will|would|can|could)(?:n['’]t)? (?:it|they|we|you|he|she|I))";
  const directQuestionEnd = `(?=(?!${questionTail}, +${questionTag} *\\?)${questionTail}\\?)`;
  const questionAdverb = '(?:(?:usually|often|always|really|still|normally|already|actually) )?';
  const doAuxiliary = '(?:do|does|did)';
  const questionMainVerb = `(?:${choices(questionForms)})\\b`;
  const directQuestionClause = `(?:${doAuxiliary} +)?${questionSubject} +${questionAdverb}${questionMainVerb}${directQuestionEnd}`;
  const pastQuestionTime = new RegExp(
    `^ +(?:yesterday|last (?:${day}|week|month|year)|${numeral} (?:days|weeks|months|years) ago)\\b`,
    'i'
  );
  const anotherQuestionVerb = new RegExp(`^ +(?:${questionVerbs.join('|')})\\b`, 'i');
  const quantityWithAuxiliary = `(?:(?:am|is|are|was|were|do|does|did|can|could|will|would|should|has|have|had) +${questionSubject}\\b${directQuestionEnd}|(?:is|are|was|were) +(?:left|available|ready|in stock|on hold) *(?=\\?))`;
  const questionParticiples = verbsOf([3], 0, [...new Set([...actions, ...questionVerbs, 'be'])]);
  const participleAfterHave = `(?= +${adverb}(?:${choices(questionParticiples)})\\b)`;
  const startsWithParticiple = new RegExp(`^${participleAfterHave}`, 'i');
  const invertedQuestionAuxiliary = `(?:(?:(?:can(?:['’]t)?|(?:could|would|should|must|might)(?:n['’]t)?|will|won['’]t|may)\\b)(?= +${adverb}${questionMainVerb})|(?:am|is|are|was|were)\\b|(?:has|have|had)(?:n['’]t)?\\b${participleAfterHave})`;
  const invertedQuestionClause = `${questionSubject} +${invertedQuestionAuxiliary}${directQuestionEnd}`;
  const amountQuestionClause = new RegExp(
    `^ +(?:${quantityWithAuxiliary}|${directQuestionClause}|${invertedQuestionClause})`,
    'i'
  );
  const amountQuestionFollows = (text, index) =>
    amountQuestionClause.test(text.slice(index, index + 240));

  use(
    'quantity',
    rx(`${sentenceStart}(what)( +${quantityPhrase})(?= )`),
    (match, opening, amount, index, text) => {
      if (followsAbbreviation(text, index) || !amountQuestionFollows(text, index + match.length))
        return;
      return (
        match.slice(0, -(opening.length + amount.length)) +
        (opening === 'WHAT' ? 'HOW' : 'How') +
        amount
      );
    },
    'Use “how much” to ask about a price or an amount, and “how many” to ask for a count.'
  );
  use(
    'quantity',
    rx(
      `(${sentenceStart}how +)(?:(much)( +${nounModifiers}${countQuantity})|(many)( +${nounModifiers}(?:advice|equipment|feedback|furniture|information|luggage|evidence|software|water)))(?= )`
    ),
    (match, opening, much, count, many, amount, index, text) => {
      if (!amountQuestionFollows(text, index + match.length)) return;
      const quantity = much ? sameCase(much, 'many') : sameCase(many, 'much');
      return opening + quantity + (count || amount);
    },
    'Use “how many” for a count of individual things and “how much” for an uncountable amount.'
  );
  use(
    'questions',
    rx(
      `(${sentenceStart}${whQuestion} +)(?:(${doAuxiliary}) +)?(${questionSubject}) +(${questionAdverb})(${questionMainVerb})${directQuestionEnd}`
    ),
    (match, opening, auxiliary, actor, modifier, verb, index, text) => {
      if (followsAbbreviation(text, index)) return;
      const form = verb.toLowerCase();
      const base = questionForms[form];
      const tail = text.slice(index + match.length, index + match.length + 120);
      // A second verb may make do or have an auxiliary, or follow a full subject clause.
      if (
        !auxiliary &&
        ((base === 'do' && anotherQuestionVerb.test(tail)) ||
          (base === 'have' && startsWithParticiple.test(tail)) ||
          /^ +(?:is|are|was|were|depends?|varies?|matters?|means?)\b/i.test(tail))
      )
        return;
      const past = auxiliary
        ? auxiliary.toLowerCase() === 'did'
        : Object.hasOwn(pastQuestionForms, form) || pastQuestionTime.test(tail);
      const collective = /\b(?:team|company|family|class|group|party)$/i.test(actor);
      const helper = past ? 'did' : subjectTakesDo.test(actor) ? 'do' : 'does';
      const corrected = auxiliary ? (collective ? auxiliary : sameCase(auxiliary, helper)) : helper;
      return opening + corrected + ' ' + actor + ' ' + modifier + sameCase(verb, base);
    },
    'Put do, does or did before the subject in this type of direct question. Use the base form of the main verb.'
  );
  use(
    'questions',
    rx(
      `(${sentenceStart}${whQuestion} +)(${questionSubject}) +(${invertedQuestionAuxiliary})${directQuestionEnd}`
    ),
    (match, opening, actor, auxiliary, index, text) => {
      if (followsAbbreviation(text, index)) return;
      return opening + auxiliary + ' ' + actor;
    },
    'Put the helping verb before the subject in this direct question.'
  );
  use(
    'capitals',
    rx(`${sentenceStart}(${whQuestion} +)(?=${directQuestionClause}|${invertedQuestionClause})`),
    (match, opening, index, text) => {
      if (/^what +(?:much|many)\b/i.test(opening) || followsAbbreviation(text, index)) return;
      return match.slice(0, -opening.length) + opening[0].toUpperCase() + opening.slice(1);
    },
    'Capitalise the first word of a complete question.',
    'Capitalisation'
  );
  word(
    'agreement',
    `${clause}${singularSubjectPhrase} +`,
    singularBe,
    '',
    'A singular subject takes a singular verb.'
  );
  word(
    'agreement',
    `${clause}${pluralSubjectPhrase} +`,
    pluralBe,
    '',
    'A plural subject takes a plural verb.'
  );
  word(
    'there-it',
    '\\bthere ',
    { is: 'are', was: 'were' },
    `(?= +(?:both|${numeral}) +${nounModifiers}${pluralNoun}\\b)`,
    'Use a plural verb after there when you introduce more than one thing.'
  );
  word(
    'there-it',
    '\\bthere ',
    { are: 'is', were: 'was' },
    `(?= +(?:a|an|one) +${nounModifiers}${singularNoun}\\b)`,
    'Use a singular verb after there when you introduce one thing.'
  );
  use(
    'there-it',
    rx(`\\bthere['’]s(?= +(?:both|${numeral}) +${nounModifiers}${pluralNoun}\\b)`),
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

  const presentActions = [
    ...new Set([
      ...actions,
      ...dailyActions,
      'do',
      'have',
      'need',
      'want',
      'work',
      'wait',
      'say',
      'require',
    ]),
  ];
  const singularPresent = {
    ...verbsOf([0], 1, presentActions),
    "don't": 'doesn’t',
    'don’t': 'doesn’t',
  };
  const pluralPresent = {
    ...verbsOf([1], 0, presentActions),
    "doesn't": 'don’t',
    'doesn’t': 'don’t',
  };
  const singularPresentReason =
    'In a present-tense statement, a singular third-person subject takes forms like walks or has.';
  const pluralPresentReason =
    'In a present-tense statement, use the base verb with a plural subject or with I, you, we and they.';
  word(
    'present-simple',
    `${clause}(?:he|she|it|(?:the|this|that|our|your|their|my) ${people}) +${adverb}`,
    singularPresent,
    '',
    singularPresentReason
  );
  word(
    'present-simple',
    `${clause}(?:I|we|you|they|the ${people}s) +${adverb}`,
    pluralPresent,
    '',
    pluralPresentReason
  );
  const activityTail =
    '(?= +(?:every (?:day|morning|week|evening|night)|daily|often|together|at home|to school|to work|at night|in the (?:morning|evening)|outdoors)\\b(?: *[.!?;,\\n]|$| +(?:and|but|before|after|because)\\b))';
  word(
    'present-simple',
    `${clause}${singularSubjectPhrase} +${adverb}`,
    verbsOf([0], 1, dailyActions),
    activityTail,
    singularPresentReason
  );
  word(
    'present-simple',
    `${clause}${pluralSubjectPhrase} +${adverb}`,
    verbsOf([1], 0, dailyActions),
    activityTail,
    pluralPresentReason
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
  const perfectActions = verbsOf([0, 1], 3, transitiveActions);
  const differentPast = Object.fromEntries(
    Object.entries(irregular)
      .filter(
        ([base, [, past, participle]]) =>
          past !== participle && !['be', 'see', 'show'].includes(base)
      )
      .map(([, [, past, participle]]) => [past, participle])
  );
  const perfectReason = 'Use a past participle after have, has or had to form a perfect tense.';
  const have = "(?:(?:has|have)(?:n['’]t)?|(?:I|you|we|they)['’]ve|(?:he|she|it)['’]s)";
  word('present-perfect', `\\b${have} +${adverb}`, perfectActions, objectStart, perfectReason);
  word(
    'present-perfect',
    `\\b${have} ${adverb}`,
    { saw: 'seen', showed: 'shown' },
    objectStart,
    perfectReason
  );
  word(
    'past-participles',
    `\\b${have} +${adverb}`,
    differentPast,
    '',
    perfectReason,
    'Grammar',
    'past-participle'
  );
  word(
    'present-perfect',
    `\\b${have} +(?:not|just|already|never|ever|recently) +`,
    verbsOf([0, 1], 3, ['go', 'come', 'arrive', 'begin', 'fall', 'return', 'swim']),
    '(?= +(?:home|back|abroad|there|here|to|before|since|by|yet)\\b| *[.!?;\\n]|$)',
    perfectReason
  );
  const perfectQuestion = `${questionOpening}(?:has|have|had)(?:n['’]t)? +${subject} +${adverb}`;
  word(
    'past-participles',
    perfectQuestion,
    differentPast,
    '',
    perfectReason,
    'Grammar',
    'past-participle'
  );
  word(
    'past-participles',
    perfectQuestion,
    perfectActions,
    objectStart,
    perfectReason,
    'Grammar',
    'past-participle'
  );
  word('past-perfect', `\\bhad(?:n['’]t)? +${adverb}`, perfectActions, objectStart, perfectReason);
  word(
    'past-perfect',
    `\\bhad(?:n['’]t)? +${adverb}`,
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
  const modalPastForms = {
    ...Object.fromEntries(Object.keys(completedVerbs).map(form => [form, form])),
    ...differentPast,
  };
  use(
    'modal-past',
    rx(`\\b((?:could|should|would|might|must)(?:n['’]t)?) +of +(${choices(modalPastForms)})\\b`),
    (_, modal, form) => modal + ' have ' + sameCase(form, modalPastForms[form.toLowerCase()]),
    'Use have after a modal when referring to the past. The contraction ’ve sounds like of.'
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
  const passiveForm = verbsOf([0, 1, 2], 3, [
    ...passiveVerbs,
    'bake',
    'bring',
    'build',
    'buy',
    'choose',
    'cook',
    'draw',
    'drink',
    'eat',
    'find',
    'make',
    'see',
    'take',
    'wash',
    'wear',
  ]);
  const passiveObject = `(?:${singularNoun}|${pluralNoun}|goods|labels?|receipts?|food|water|breakfast|lunch|dinner|rice)`;
  const passiveSubject = `(?:it|they|(?:the|this|that|these|those|our|your|their) +${nounModifiers}${passiveObject})`;
  const bePassive = "(?:is|are|was|were)(?:n['’]t)?";
  const havePassive = "(?:has|have|had)(?:n['’]t)?";
  const modalPassive =
    "(?:will|won['’]t|can(?:['’]t)?|(?:could|should|must|would|might)(?:n['’]t)?)";
  const passiveSuffix =
    '(?= +(?:by|on|to|from|before|after|yesterday|last|today|tomorrow|earlier|later|already|this (?:morning|week))\\b| *[,.!?;\\n]|$)';
  const passiveReason =
    'When the subject receives the action, use a past participle after be to form the passive.';
  word(
    'passive',
    `\\b${passiveSubject} (?:${bePassive}|get|got|${havePassive} ${adverb}been|${modalPassive} ${adverb}be) ${adverb}`,
    passiveForm,
    passiveSuffix,
    passiveReason
  );
  word(
    'passive',
    `${clause}(?:${bePassive} ${passiveSubject}|${havePassive} ${passiveSubject} ${adverb}been|${modalPassive} ${passiveSubject} ${adverb}be) ${adverb}`,
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
    'capitals',
    /(?:^ *|(?<=[.!?\n]) *)(how|what|when|where|who|why|which)(?= +(?:(?:long|often|much|far) +)?(?:am|is|are|was|were|do|does|did|can|could|will|would|should|has|have|had)\b[^.!?\n]{1,140}\?)/g,
    (match, opening) =>
      match.slice(0, -opening.length) + opening[0].toUpperCase() + opening.slice(1),
    'Capitalise the first word of a complete question.',
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
  word(
    'each-every',
    `\\bone of (?:the|these|those|your|our|their) +${nounModifiers}`,
    nounForms,
    countNounEnd,
    'Use the plural noun to name the group after one of.'
  );
  word(
    'numbers-dates',
    `\\b${numeral} +${nounModifiers}`,
    nounForms,
    countNounEnd,
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
