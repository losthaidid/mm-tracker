/**
 * solution-guide.js — Plain-language guidance for the existing Solution Studio.
 * These are presentation-only views. Transaction explanations read the same engine
 * events as the theatre; they never calculate a separate result or save a record.
 */
(function (root) {
  'use strict';
  const E = root.WorkHubSolutionEngine;
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const money = n =>
    'RM ' +
    (n / 100).toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const qty = n => (n / 1000).toLocaleString('en-MY', { maximumFractionDigits: 3 });
  const btn = (op, label, attrs = '', primary = false) =>
    `<button type="button" class="ss-btn${primary ? ' ss-primary' : ''}" data-ss="${op}" ${attrs}>${label}</button>`;
  const PAGES = [
    ['start', 'Start here', 'Understand the Studio', '✦'],
    ['discovery', '1 · Business process', 'Today vs your SAP approach', '↗'],
    ['proposals', '2 · Solution options', 'Benefits, gaps & requirements', '◇'],
    ['simulation', '3 · Test the outcome', 'Follow stock, value & documents', '▷'],
    ['decisions', '4 · Review & deliver', 'Feedback, agreement & tasks', '✓'],
    ['materials', 'Material explorer', 'Understand product behaviour', '▦'],
    ['tools', 'Design tools', 'Interviews, workshops & reports', '✎'],
  ];
  const TERMS = [
    [
      'product',
      'Product / group',
      'The thing the business buys, stores, uses, makes or sells. A group can share a process.',
      'Maintenance bearings are a product group. Buying and issuing them is a process.',
    ],
    [
      'process',
      'Business process',
      'A sequence of activities with people, handovers and an expected outcome.',
      'A technician requests a bearing; Purchasing orders it; Stores receives it; Maintenance uses it.',
    ],
    [
      'proposal',
      'Proposal / alternative',
      'One possible SAP design for the same business process. Each proposal keeps its own assumptions and simulation profile.',
      'Compare bearing stock with value, quantities without stock value, and direct consumption.',
    ],
    [
      'asis',
      'AS-IS / TO-BE',
      'AS-IS means how the business works today. TO-BE means your proposed future SAP process.',
      'An email request today may become a structured purchase requisition in your proposed design. Connecting lines show which current steps a proposed step addresses.',
    ],
    [
      'requirement',
      'Requirement / acceptance',
      'A requirement states what the business needs. Acceptance explains how someone will confirm it works.',
      'Need: see bearing stock by location. Acceptance: the storekeeper can demonstrate the agreed balances in SAP.',
    ],
    [
      'quantity',
      'Quantity updating',
      'The material profile permits a managed stock quantity. Whether this particular purchase creates stock also depends on the procurement purpose.',
      'A stock receipt can increase inventory quantity. A direct-consumption PO can charge a cost centre without adding stock, even for a stock-capable material.',
    ],
    [
      'value',
      'Value updating / valuation',
      'The profile permits inventory value. In this model, valuated stock uses a fixed standard price.',
      'At a standard price of RM 10, receiving 100 units into valuated stock adds RM 1,000 to inventory.',
    ],
    [
      'consumption',
      'Direct consumption',
      'The purchase is assigned directly to a receiving cost object instead of being held as inventory in this scenario.',
      'For the supported K-assigned PO, a consumption receipt recognises purchase cost without creating a stock balance.',
    ],
    [
      'gr',
      'GR / goods receipt',
      'A record of received goods. The selected proposal decides whether the receipt is for inventory or direct consumption.',
      'Movement 101 is the PO goods receipt in this model. A non-stock consumption receipt can be valid.',
    ],
    [
      'gi',
      'GI / goods issue',
      'A withdrawal from managed stock for a receiving cost centre in this model.',
      'Movement 201 reduces the chosen location. Valuated stock moves its standard-price cost into consumption.',
    ],
    [
      'transfer',
      'Transfer / cancellation / return',
      'A transfer moves stock between locations. A cancellation reverses an eligible posting. A supplier return sends goods back against a receipt.',
      '311 moves stock within the same plant; 312 cancels that transfer; 122 is a referenced supplier return. This model limits cancellation to the latest active eligible posting.',
    ],
    [
      'grir',
      'GR/IR / price difference',
      'GR/IR is the symbolic goods-receipt accrual here. Price difference separates the PO price from the fixed standard price.',
      'For 100 units at PO price RM 12 and standard price RM 10: inventory RM 1,000, GR/IR credit RM 1,200 and price difference debit RM 200. Invoice clearing is outside this model.',
    ],
    [
      'assignment',
      'K / account assignment',
      'The supported consumption PO records the receiving cost centre and consumption G/L account using category K.',
      'Record the responsible department in the cost centre. The material type’s account category reference is a separate configuration concept.',
    ],
    [
      'snapshot',
      'Trial / kept run / agreement',
      'A trial changes the local simulation. Keep this run saves its exact inputs. Agreement records a reviewer’s decision about the current design.',
      'A successful animation does not approve a proposal. Record feedback under Review & deliver before creating linked delivery work.',
    ],
    [
      'material',
      'Material type / profile',
      'A reference or maintained set of material attributes. A product or proposal receives an independent snapshot when you explicitly attach it.',
      'ERSA and UNBW are starting references. Confirm quantity/value updating and dependent client configuration; the code alone does not decide every posting.',
    ],
  ];
  const HELP = {
    discovery: [
      'Capture the business before choosing SAP.',
      'Read the current steps on the left and the proposed SAP steps on the right. Open any step to see who does it, the details and the problem it addresses.',
      'Write the current activities, then add requirements and a proposed step. The connecting lines show the relationship between today and your design.',
      'proposals',
      'Compare the solution options →',
    ],
    proposals: [
      'Compare ways to solve the same business need.',
      'Each card is an independent proposal for the selected process. Selecting one changes the design used by the simulator.',
      'Read the benefits, trade-offs and requirement coverage. Open Edit design for the written approach; expand its simulation assumptions when you want to change posting behaviour.',
      'simulation',
      'Test the selected option →',
    ],
    simulation: [
      'Ask: what would this design actually do?',
      'The selected proposal supplies the starting assumptions. Next transaction checks one movement, then explains its before-and-after balances.',
      'Start with Next transaction and read “What just happened?”. Use Learning pace for automatic playback. Open the scenario inputs to try a different assumption.',
      'decisions',
      'Review the evidence & decision →',
    ],
    decisions: [
      'Keep the decision and turn it into work.',
      'Record who reviewed the design, their feedback and the outcome. Saved runs are supporting evidence; agreement is a separate business decision.',
      'After agreement in My workspace, Create delivery work makes one project item and three linked tasks. Workshop notes are separate from formal agreement.',
      'tools',
      'Prepare the workshop or handover →',
    ],
    materials: [
      'Understand what controls the product’s behaviour.',
      'A reference profile explains quantity, value, procurement and relevant views. The behaviour cards show what those attributes mean.',
      'Use Help me choose, compare two profiles, then Explore in simulator. Link to product and Use for proposal are separate, explicit actions.',
      'simulation',
      'Watch the selected proposal in action →',
    ],
    tools: [
      'Turn your notes into a clear design story.',
      'The interview captures discovery answers. Business rules record conditions. The workshop presents the process; the handover collects its evidence.',
      'Start with the discovery interview if you do not know what to write. It creates an editable draft from your answers. Present workshop uses the selected process and proposal.',
      'discovery',
      'Return to the business process →',
    ],
  };

  function navigation(pane) {
    return `<nav class="ss-pane-tabs sg-navigation" aria-label="Solution workspace sections">${PAGES.map(
      ([id, title, detail, icon]) =>
        btn(
          'pane',
          `<span aria-hidden="true">${icon}</span><span><strong>${title}</strong><small>${detail}</small></span>`,
          `data-pane="${id}" aria-pressed="${pane === id}"${pane === id ? ' aria-current="page"' : ''}`,
          pane === id
        )
    ).join('')}</nav>`;
  }

  function context(c) {
    const products = c.product
      ? c.product.name
      : (c.process?.productIds || [])
          .map(id => c.rows.products.find(p => p.id === id)?.name)
          .filter(Boolean)
          .join(', ');
    return `<section class="sg-context" aria-label="Current solution context"><span class="sg-source ${c.isDemo ? 'is-demo' : ''}">${c.isDemo ? '✦ Fictional sample' : '◇ My project'}</span>${[
      ['Project', c.project.name],
      ['Product / group', products || 'Shared process / select a product'],
      ['Process', c.process?.name || 'Not selected'],
      ['Selected proposal', c.proposal?.title || 'Not selected'],
    ]
      .map(([title, value]) => `<div><small>${title}</small><strong>${esc(value)}</strong></div>`)
      .join('')}</section>`;
  }

  function readiness(c) {
    return [
      [
        'Product / group',
        !!c.rows.products.length,
        'product-new',
        'Capture what the business works with.',
      ],
      [
        'Current process',
        !!c.process?.steps.length,
        c.process ? 'process-edit' : 'process-new',
        'Record people, activities and pain points.',
      ],
      [
        'Business requirements',
        !!c.process?.requirements.length,
        'requirement-new',
        'Define the need and how it will be checked.',
      ],
      [
        'Proposed solution',
        !!c.proposal?.steps.length,
        'proposal-new',
        'Describe a possible SAP approach.',
      ],
      [
        'Kept simulation evidence',
        !!c.rows.runs.some(r => r.proposalId === c.proposal?.id),
        'runs',
        'Keep a useful test run after reviewing its results.',
      ],
      [
        'Business agreement',
        c.proposal?.status === 'Agreed',
        'decision',
        'Record a reviewer and their decision.',
      ],
    ];
  }

  function overview(c) {
    const checks = readiness(c),
      done = checks.filter(x => x[1]).length;
    return `<section class="sg-start"><div class="sg-welcome"><div><span class="sg-kicker">A CLEARER WAY THROUGH SOLUTION STUDIO</span><h2>One business story.<br><em>Follow it all the way.</em></h2><p>Capture how work happens today, propose a SAP approach, test its consequences, then record the business decision.</p><div class="ss-actions">${btn('tour', '✦ Teach me with the complete example', '', true)}${btn('start-interview', 'Start my own discovery interview')}${btn('glossary', 'Explain the words')}</div><small>The guided example uses fictional maintenance bearings. Your project records stay separate.</small></div><div class="sg-story-orbit" aria-hidden="true"><i></i><span class="sg-orbit-card one">▧<b>A product</b><small>Maintenance bearings</small></span><span class="sg-orbit-card two">↗<b>A process</b><small>Buy → store → use</small></span><span class="sg-orbit-card three">◇<b>A solution</b><small>Test the business outcome</small></span><b>✦</b></div></div>
      <details class="sg-start-index"><summary>Browse all Studio screens</summary>${navigation('start')}</details>
      <section class="sg-map"><div class="sg-section-title"><div><span class="sg-kicker">HOW THE PIECES CONNECT</span><h3>Start with the question. Follow the evidence.</h3></div><span>Click any stage to explore</span></div><div class="sg-journey">${[
        [
          '1',
          'What do they work with?',
          'Product / group',
          'Bearings used by Maintenance.',
          'start',
        ],
        [
          '2',
          'How does work happen?',
          'Business process',
          'Request, purchase, receive, store and use.',
          'discovery',
        ],
        [
          '3',
          'What could SAP improve?',
          'Solution options',
          'Compare stock/value and consumption designs.',
          'proposals',
        ],
        [
          '4',
          'What would change?',
          'Test the outcome',
          'Follow quantities, costs and documents.',
          'simulation',
        ],
        [
          '5',
          'What was agreed?',
          'Review & deliver',
          'Keep feedback and create implementation work.',
          'decisions',
        ],
      ]
        .map(
          ([n, question, title, detail, pane]) =>
            `<button type="button" ${n === '1' ? `data-ss="${c.product ? 'product-edit' : 'product-new'}"${c.product ? ` data-id="${esc(c.product.id)}"` : ''}` : `data-ss="pane" data-pane="${pane}"`} class="sg-journey-stop" style="--sg-order:${n}"><b>${n}</b><small>${question}</small><strong>${title}</strong><span>${detail}</span></button>`
        )
        .join('')}</div></section>
      <section class="sg-case"><div class="sg-section-title"><div><span class="sg-kicker">THE SAME BEARING. THREE DIFFERENT DESIGNS.</span><h3>See why the choice matters.</h3></div><span>Fictional learning examples</span></div><p>Maintenance needs bearings. Do you need to track the stock quantity, its value, or charge the purchase directly to the department?</p><div class="sg-case-options">${[
        [
          'valuated',
          '▦',
          'Stock with value',
          'Track how many bearings are held and the inventory value. A later issue moves standard-price cost into consumption.',
          'Watch stock & value',
        ],
        [
          'quantity',
          '▧',
          'Quantities without stock value',
          'Keep a stock count without an inventory-value balance. In this supported PO setup, the cost is recognised at receipt.',
          'Watch quantity-only stock',
        ],
        [
          'nonstock',
          '↗',
          'Direct consumption',
          'Receive against an assigned cost centre without creating inventory. See why a later stock issue is blocked.',
          'See a blocked & valid receipt',
        ],
      ]
        .map(
          ([mode, icon, title, detail, label]) =>
            `<article><span aria-hidden="true">${icon}</span><h4>${title}</h4><p>${detail}</p>${btn('learn-case', label + ' →', `data-mode="${mode}"`)}</article>`
        )
        .join(
          ''
        )}</div><p class="sg-caption">These buttons open the fictional sample. The simulator checks the explicit profile, PO settings and movement; material type codes alone do not decide the outcome.</p></section>
      <section class="sg-readiness"><div class="sg-section-title"><div><span class="sg-kicker">${c.isDemo ? 'WHAT THE SAMPLE ALREADY CONTAINS' : 'YOUR SELECTED DESIGN'}</span><h3>What is captured so far?</h3></div><span>${done} / ${checks.length} checkpoints present</span></div><p>These checkpoints show recorded content. They do not certify SAP configuration or business acceptance.</p><ul>${checks.map(([title, complete, op, detail], i) => `<li><span class="sg-check ${complete ? 'is-done' : ''}" aria-label="${complete ? 'Present' : 'Not yet recorded'}">${complete ? '✓' : i + 1}</span><div><strong>${title}</strong><small>${detail}</small></div><span>${complete ? 'Present' : 'Not yet'}</span></li>`).join('')}</ul><div class="ss-actions">${btn('pane', 'Open the current business process →', 'data-pane="discovery"', true)}${btn('pane', 'Understand material behaviour', 'data-pane="materials"')}${btn('pane', 'Find interviews & presentation tools', 'data-pane="tools"')}</div></section></section>`;
  }

  function intro(pane, c) {
    const h = HELP[pane];
    if (!h) return '';
    return `<section class="sg-screen-help"><div><span class="sg-kicker">WHAT TO DO ON THIS SCREEN</span><h3>${h[0]}</h3><p>${h[1]}</p></div><details><summary>Show me how to use this screen</summary><p>${h[2]}</p><div class="ss-actions">${btn('pane', h[4], `data-pane="${h[3]}"`)}${btn('glossary', 'Explain unfamiliar words')}${btn('pane', 'Return to Start here', 'data-pane="start"')}</div>${!c.process && !['materials', 'tools'].includes(pane) ? '<p>Begin by capturing a product and process, or open the complete sample from Start here.</p>' : ''}</details></section>`;
  }

  const LESSONS = [
    [
      'Meet the business',
      'What is the business trying to achieve?',
      'Meridian is a fictional food manufacturer. Its maintenance team needs bearings to repair machines.',
      'The product is the bearing. The process is how people request, buy, receive and use it. The proposal is your possible SAP design.',
      'Open the Maintenance bearings product profile and read its purpose. Then look at the selected purchasing process.',
      'You can now separate the thing being managed from the activities and the proposed solution.',
    ],
    [
      'Understand today',
      'What happens before your SAP proposal?',
      'The left AS-IS lane records the current activities. The right TO-BE lane is the proposed future approach.',
      'A proposed step can address more than one current step. Connecting lines preserve those links; requirements explain the business need.',
      'Open a current step. Read who does it, how it works and the pain point. Then open its proposed SAP step.',
      'You can explain which business problem each proposed change is intended to solve.',
    ],
    [
      'Compare the options',
      'Does the business need a stock quantity, a value, or a direct cost?',
      'The same maintenance-bearing process has three alternatives. Selecting a card changes the proposal used by the simulator.',
      'Stock with value, quantity-only stock and non-stock consumption are different designs with different cost and stock timing.',
      'Read the benefits and trade-offs, then choose an option. The requirement coverage is a design claim to verify during testing.',
      'You can justify a choice using business needs, rather than choosing a material type code by habit.',
    ],
    [
      'Watch the consequences',
      'What changes after each supported movement?',
      'The simulator reads the selected proposal. Its sequence starts with a receipt, then a same-plant transfer, an issue and a supplier return.',
      'The “What just happened?” panel compares the selected step’s actual before/after values. The warehouse, documents and accounting show the same event.',
      'Press Next transaction. Read the request, the reason and the balance changes. Continue one step at a time, or use the slower Learning pace.',
      'You can follow the quantity and cost story instead of judging the animation alone.',
    ],
    [
      'Understand a blocked attempt',
      'Why can a non-stock receipt succeed while a stock receipt fails?',
      'This saved example first requests an inventory receipt for a non-stock design, then a consumption receipt, then a stock issue.',
      'A blocked attempt is a useful teaching moment. The engine explains the failed rule and leaves balances unchanged. “Outside model” means the learning model does not cover that case.',
      'Press Next transaction to see the blocked inventory receipt. Press it again to see the valid consumption receipt and its cost. The third attempt cannot issue stock that was never held.',
      'You can distinguish an invalid request under the selected assumptions from a transaction outside the model.',
    ],
    [
      'Record the decision',
      'What turns an explored idea into agreed work?',
      'Review & deliver records the reviewer, feedback, outcome and a snapshot of the current proposal.',
      'A successful simulation, a workshop note and formal business agreement are separate records. Agreement can then support implementation tasks in My workspace.',
      'Read the decision trail. In your project, record feedback after reviewing assumptions and evidence, then use Create delivery work once agreed.',
      'You can keep the reasoning connected to the delivery work and the acceptance tests.',
    ],
  ];
  function tourNav(index) {
    if (index < 0) return '';
    return `<nav class="sg-lesson-nav" aria-label="Guided sample walkthrough">${LESSONS.map((lesson, i) => btn('tour-step', `<b>${i + 1}</b><span>${lesson[0]}</span>`, `data-index="${i}" aria-current="${index === i ? 'step' : 'false'}"`, index === i)).join('')}</nav>`;
  }
  function lesson(index, c = {}) {
    const l = LESSONS[index];
    if (!l) return '';
    const action =
      index === 0 && c.product
        ? btn(
            'product-edit',
            'Open the sample product profile →',
            `data-id="${esc(c.product.id)}"`,
            true
          )
        : index === 1 && c.process?.steps[0]
          ? btn(
              'step-view',
              'Open the first current activity →',
              `data-lane="as" data-id="${esc(c.process.steps[0].id)}"`,
              true
            )
          : index === 2
            ? btn('compare', 'Show the outcome comparison →', '', true)
            : index === 3 || index === 4
              ? btn('lesson-transaction', 'Check the next transaction →', '', true)
              : index === 5
                ? btn('decision', 'Open the business feedback form →', '', true)
                : '';

    return `<section class="sg-lesson" aria-label="Walkthrough lesson ${index + 1}"><header><span class="sg-kicker">GUIDED EXAMPLE · ${index + 1} OF ${LESSONS.length}</span>${btn('tour-close', 'Exit walkthrough')}</header><h2>${l[1]}</h2><p class="sg-lesson-scene">${l[2]}</p><div class="sg-lesson-grid"><article><span>01 · UNDERSTAND</span><h4>What you are looking at</h4><p>${l[3]}</p></article><article><span>02 · TRY IT</span><h4>Your next action</h4><p>${l[4]}</p>${action}</article><article><span>03 · TAKE AWAY</span><h4>What this teaches you</h4><p>${l[5]}</p></article></div><footer><span>Fictional sample · learning actions stay in this session</span><div class="ss-actions">${index ? btn('tour-back', '← Previous lesson') : ''}${btn('glossary', 'Explain the words')}${btn(index === 5 ? 'tour-close' : 'tour-next', index === 5 ? 'Finish walkthrough ✓' : 'Next lesson →', '', true)}</div></footer></section>`;
  }

  function glossary(term = '') {
    return `<section class="sg-glossary"><span class="sg-kicker">SOLUTION STUDIO · PLAIN LANGUAGE</span><h2>What does that mean?</h2><p>Each explanation connects the term to the maintenance-bearing example. Transaction behaviour below describes the Studio’s supported model.</p>${TERMS.map(([id, title, definition, example], i) => `<details${term === id || (!term && i === 0) ? ' open' : ''}><summary>${title}</summary><p>${definition}</p><div><strong>Example</strong><p>${example}</p></div></details>`).join('')}</section>`;
  }
  function formHelp(kind) {
    const notes = {
      product: [
        'Start with the thing the business works with.',
        'Example: “Maintenance bearings”, unit “EA”, purpose “Keep machine repairs moving”. You can reuse this product in more than one process.',
      ],
      process: [
        'Describe a repeatable piece of work.',
        'Example: “Buy and issue maintenance bearings”. Select the relevant products, record the business objective, then add the current activities after saving. Choose specialist context for processes outside the core PO/inventory model.',
      ],
      proposal: [
        'Describe one possible SAP approach.',
        'Explain the business benefit, trade-offs and requirements first. The simulation profile below supplies posting assumptions; expand it when you want to adjust quantities, prices or PO controls.',
      ],
      requirement: [
        'Connect a business need to a way to check it.',
        'Need: “See stock by storage location”. Acceptance: “The storekeeper demonstrates the agreed balances after receipt and transfer in SAP”.',
      ],
      step: [
        'Make one activity easy to understand.',
        'State who does it, what they do and the business problem. In a proposed step, link the current steps it addresses so the AS-IS/TO-BE relationship stays visible.',
      ],
      decision: [
        'Record a real review outcome.',
        'Capture the reviewer and their reasoning. “Agreed” applies to this current design; later design changes return it for review. A simulation result alone is not agreement.',
      ],
      run: [
        'Keep an example you can explain again.',
        'The saved run keeps its exact assumptions and transaction inputs. Give it a name that states the business question, such as “Bearing receipt and location transfer”.',
      ],
    };
    const h = notes[kind];
    return h ? `<aside class="sg-form-help"><strong>${h[0]}</strong><p>${h[1]}</p></aside>` : '';
  }

  function narration(snap, event, count = 0, cursor = -1) {
    const profile = snap.profile;
    if (!event)
      return `<section class="sg-narrator is-ready"><span class="sg-kicker">YOUR SIMULATION, EXPLAINED</span><h3>Start with one transaction.</h3><p>Press <strong>Next transaction</strong>. We will show what was requested, why it passed or stopped, and the exact changes in quantity and value.</p><div class="sg-explain-route" aria-hidden="true"><span>Request</span><i>→</i><span>Check the rules</span><i>→</i><span>Explain the effects</span></div><p class="sg-caption">${count} transaction${count === 1 ? '' : 's'} in this sequence · before the first step · opening stock ${qty(E.tracks(profile) ? Math.round(profile.openingQty * 1000) : 0)} units</p></section>`;
    const ok = event.status === 'success',
      unsupported = event.status === 'unsupported',
      title = ok
        ? 'What just happened?'
        : unsupported
          ? 'This case needs separate SAP verification.'
          : 'Why did this attempt stop?',
      request =
        {
          gr: `Receive ${event.action.qty} units for ${event.action.intent === 'inventory' ? 'inventory' : 'consumption'}.`,
          issue: `Issue ${event.action.qty} units from ${event.action.location || profile.sourceLocation} to the cost centre.`,
          transfer: `Move ${event.action.qty} units from ${event.action.location || profile.sourceLocation} to ${event.action.toLocation || profile.destinationLocation}.`,
          return: `Return ${event.action.qty} units against a previous goods receipt.`,
          reverse: 'Cancel the referenced eligible posting and reverse its effects.',
        }[event.action.type] || `Try ${event.action.type}.`,
      fields = [
        ['qty', 'Total stock', 'units'],
        ['inventory', 'Inventory value', 'money'],
        ['expense', 'Consumption cost', 'money'],
      ],
      changes = fields.map(([key, label, format]) => ({
        key,
        label,
        format,
        before: event.before[key],
        after: event.after[key],
      }));
    if (event.action.type === 'transfer')
      for (const location of new Set([
        event.action.location || profile.sourceLocation,
        event.action.toLocation || profile.destinationLocation,
      ]))
        changes.push({
          key: location,
          label: `Stock in ${location}`,
          format: 'units',
          before: event.before.locations[location] || 0,
          after: event.after.locations[location] || 0,
        });
    return `<section class="sg-narrator is-${esc(event.status)}" data-explained-event="${esc(event.action.id)}"><header><span class="sg-kicker">STEP ${cursor + 1} OF ${count} · ${ok ? 'SUPPORTED TRANSACTION SUCCEEDED' : unsupported ? 'OUTSIDE THIS LEARNING MODEL' : 'STOPPED BY A RULE'}</span><span class="sg-event-seal" aria-hidden="true">${ok ? '✓' : unsupported ? '?' : '×'}</span></header><h3>${title}</h3><p class="sg-request">${esc(request)}</p><div class="sg-explain-route" aria-hidden="true"><span>Request received</span><i>→</i><span>${ok ? 'Checks passed' : unsupported ? 'Coverage boundary' : 'Rule stopped it'}</span><i>→</i><span>${ok ? 'Effects recorded' : 'Balances retained'}</span></div><div class="sg-reason"><strong>${ok ? 'Why this result makes sense' : unsupported ? 'What the result means' : 'The rule to understand'}</strong><p>${esc(ok ? event.explanation : event.message)}</p>${!ok ? `<strong>What to try next</strong><p>${esc(event.fix || 'Review the selected proposal and its supported coverage.')}</p>` : ''}</div><div class="sg-balance-changes" aria-label="Before and after this transaction">${changes
      .map(x => {
        const delta = x.after - x.before,
          format = x.format === 'money' ? money : n => qty(n) + ' units';
        return `<article class="${delta ? 'has-change' : ''}"><small>${esc(x.label)}</small><div><span>${format(x.before)}</span><i aria-hidden="true">→</i><strong>${format(x.after)}</strong></div><b>${delta ? (delta > 0 ? '+' : '−') + format(Math.abs(delta)) : 'No change'}</b></article>`;
      })
      .join(
        ''
      )}</div><details class="sg-reading-key"><summary>How to read the rest of this screen</summary><p>The moving scene, warehouse balances, document flow and accounting companion all show this selected step. The transaction list contains the whole sequence; click a step to inspect it. ${ok ? 'A simulated material document appears after a successful supported movement; symbolic FI lines appear only when that event has accounting entries.' : 'A stopped or unsupported attempt creates no simulated posting and changes no balances.'} Trial edits and playback stay local until you explicitly keep a run.</p><button type="button" class="ss-btn" data-ss="glossary" data-term="grir">Explain GR/IR &amp; price difference</button></details></section>`;
  }
  root.WorkHubSolutionGuide = {
    navigation,
    context,
    readiness,
    overview,
    intro,
    tourNav,
    lesson,
    glossary,
    formHelp,
    narration,
  };
})(window);
