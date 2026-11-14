/** Process Hub simulator and private SAP configuration examples. */
(function (root) {
  'use strict';

  const D = root.WorkHubMmConfigurationData;
  const E = root.WorkHubMmConfigurationEngine;
  const feature = 'processhub.configuration';
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (op, label, attrs = '', type = '') =>
    `<button type="button" class="${type}" data-mm-config="${op}" ${attrs}>${label}</button>`;
  const options = (values, current) =>
    values
      .map(
        ([value, label]) =>
          `<option value="${esc(value)}"${String(value) === String(current) ? ' selected' : ''}>${esc(label)}</option>`
      )
      .join('');
  const select = (key, label, choices, value, attrs = '') =>
    `<label>${label}<select name="${key}" ${attrs}>${options(choices, value)}</select></label>`;
  const input = (key, label, value, attrs = '') =>
    `<label>${label}<input name="${key}" value="${esc(value)}" ${attrs}></label>`;
  const check = (key, label, value, attrs = '') =>
    `<label class="mmc-check"><input name="${key}" type="checkbox"${value ? ' checked' : ''} ${attrs}><span>${label}</span></label>`;
  const source = id => {
    const [label, url] = D.sources[id];
    return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;
  };
  const kinds = {
    material: ['Material types', 'material type'],
    movement: ['Movement types', 'movement type'],
    plant: ['Plants & valuation areas', 'plant'],
    account: ['G/L account mappings', 'G/L mapping'],
  };
  const categories = [
    ['', 'None / stock purchase'],
    ['K', 'K · Cost center'],
    ['A', 'A · Asset'],
    ['P', 'P · Project / WBS'],
    ['F', 'F · Order'],
    ['X', 'X · Third-party procurement'],
  ];
  const stages = {
    completed: 'Simulated',
    skipped: 'Skipped',
    blocked: 'Needs a setting',
    waiting: 'Waiting',
  };

  function install(a) {
    const $ = id => document.getElementById(id);
    const ready = () => a.cloud().ready && !!a.cloud().user?.id;
    const can = (action = 'view') => ready() && a.can(feature, action);
    const allowed = (action = 'view') => a.active() && can(action);
    let owner = '';
    let generation;
    let editor = null;
    let scenario = D.scenarios[0];
    let draft = E.defaults(scenario);
    let view = 'simulate';
    let stepIndex = 2;
    let kind = 'material';
    let query = '';
    let panelOpen = false;
    let lastRun = null;
    let mayRun = false;

    function sync() {
      const cloud = a.cloud();
      const next = ready() ? cloud.user.id : '';
      if (next !== owner || generation !== cloud.generation || !can()) {
        owner = next;
        generation = cloud.generation;
        scenario = D.scenarios[0];
        draft = E.defaults(scenario);
        view = 'simulate';
        stepIndex = 2;
        kind = 'material';
        query = '';
        panelOpen = false;
        lastRun = null;
      }
      if (mayRun && !can('run')) draft = E.defaults(scenario);
      mayRun = can('run');
      if (editor && (editor.form !== $('mmConfigEditor') || !$('modal')?.open)) editor = null;
      if (
        editor &&
        (!allowed(editor.id ? 'edit' : 'create') ||
          editor.owner !== owner ||
          editor.generation !== generation)
      ) {
        editor = null;
        a.closeModal();
      }
    }

    function guard(action = 'view') {
      if (!allowed(action) || owner !== a.cloud().user?.id || generation !== a.cloud().generation)
        throw Error('Reopen MM Configuration with an account that has access to this action.');
    }

    function reference(code, type) {
      const available = type === 'table' ? a.hasTable(code, draft.edition) : a.hasTcode(code);
      if (!available) return `<code>${esc(code)}</code>`;
      return button(type, esc(code), `data-code="${esc(code)}"`, 'mmc-code');
    }

    function checkpoint(id) {
      const [title, location, description, tables, sources] = D.checkpoints[id];
      const codes =
        draft.edition === 'public'
          ? []
          : location.split(' / ').filter(value => /^[A-Z0-9]{2,6}$/.test(value));
      const roles =
        draft.edition === 'public'
          ? E.publicChecks(id)
          : draft.edition === 'ecc' && id === 'service'
            ? 'ML81N · Service entry and acceptance'
            : location;
      const related =
        draft.edition === 'public'
          ? [...new Set(tables.map(table => E.publicTable(table)).filter(Boolean))]
          : draft.edition === 'ecc'
            ? tables.filter(code => !['MATDOC', 'ACDOCA'].includes(code))
            : tables.filter(code => code !== 'MSEG');
      return `<section class="mmc-checkpoint">
        <h4>${esc(title)}</h4>
        <p>${esc(description)}</p>
        ${
          codes.length
            ? `<div class="mmc-references">${codes.map(code => reference(code, 'tcode')).join('')}</div>`
            : roles
              ? `<p class="mmc-location">${esc(roles)}</p>`
              : ''
        }
        ${related.length ? `<div class="mmc-references">${related.map(code => reference(code, 'table')).join('')}</div>` : ''}
        <div class="mmc-sources">${sources.map(source).join('')}</div>
      </section>`;
    }

    function detailsPanels() {
      const hasPO = scenario.steps.some(step =>
        ['po', 'sto', 'gr', 'serviceGr'].includes(step.rule)
      );
      const hasInvoice = scenario.steps.some(step => ['invoice', 'credit'].includes(step.rule));
      const fields = [
        select(
          'priceControl',
          'Price control',
          [
            ['S', 'S · Standard price'],
            ['V', 'V · Moving average'],
          ],
          draft.priceControl
        ),
        input(
          'stockPrice',
          'Stock price per unit',
          draft.stockPrice,
          'type="number" min="0" max="10000000" step="any" required'
        ),
        ...(hasPO || hasInvoice || scenario.group === 'special'
          ? [
              input(
                'poPrice',
                'PO or reference price per unit',
                draft.poPrice,
                'type="number" min="0" max="10000000" step="any" required'
              ),
            ]
          : []),
        ...(hasInvoice
          ? [
              input(
                'invoicePrice',
                'Invoice price per unit',
                draft.invoicePrice,
                'type="number" min="0" max="10000000" step="any" required'
              ),
              input(
                'stockCoverage',
                'Stock coverage for invoice variance (%)',
                draft.stockCoverage,
                'type="number" min="0" max="100" step="any"'
              ),
            ]
          : []),
      ];
      const controls = [
        ...(hasPO || scenario.category || scenario.group === 'returns'
          ? [
              select('category', 'PO or movement account assignment', categories, draft.category),
              input(
                'costAccount',
                'G/L on the PO (optional)',
                draft.costAccount,
                'maxlength="10" pattern="[A-Za-z0-9]{1,10}"'
              ),
              input(
                'accountObject',
                'Cost center, asset, WBS or order (optional)',
                draft.accountObject,
                'maxlength="40"'
              ),
              input(
                'assignmentModifier',
                'PO account assignment modifier (optional)',
                draft.assignmentModifier,
                'maxlength="3" pattern="[A-Za-z0-9_]{1,3}"'
              ),
            ]
          : []),
        ...(hasPO && !scenario.receivingPlant
          ? [
              check(
                'itemAllowsReceipt',
                'PO item category permits a goods receipt',
                draft.itemAllowsReceipt
              ),
              check(
                'receiptEnabled',
                'Goods Receipt selected on the PO item',
                draft.receiptEnabled
              ),
              check(
                'nonValuated',
                'GR Non-Valuated selected',
                draft.nonValuated,
                scenario.id === 'third-party' ? 'disabled' : ''
              ),
              check('qm', 'QM inspection setup triggers an inspection lot', draft.qm),
            ]
          : []),
        ...(hasInvoice
          ? [
              check('grBased', 'GR-based invoice verification', draft.grBased),
              check('blockedInvoice', 'Invoice posts with a payment block', draft.blockedInvoice),
            ]
          : []),
        ...(scenario.steps.some(step => step.movement)
          ? [
              check(
                'referenceReady',
                'Required movement reference is available',
                draft.referenceReady
              ),
            ]
          : []),
        ...(scenario.id === 'material-transfer'
          ? [
              check(
                'sameUnit',
                'Sending and receiving materials use the same base unit',
                draft.sameUnit
              ),
            ]
          : []),
      ];
      return `<details class="mmc-input-details" id="mmConfigInputs"${panelOpen ? ' open' : ''}>
        <summary>Prices, references & PO controls</summary>
        <div class="mmc-advanced">${fields.join('')}${controls.join('')}</div>
      </details>`;
    }

    function materialFields(plant) {
      const materials = E.choices(a.state(), 'material', plant?.area);
      const chosen = materials.find(row => row.code === draft.material);
      const required = scenario.service ? '' : 'required';
      const opts = [
        ['', scenario.service ? 'Service or invoice example' : 'Select a material type'],
        ...materials.map(row => [row.code, row.code + ' · ' + row.name]),
      ];
      const classes = (chosen?.classes || '').split(/[\s,]+/).filter(Boolean);
      if (scenario.service) return '';
      return (
        select('material', 'Material type', opts, draft.material, required) +
        (classes.length
          ? select(
              'valuationClass',
              'Valuation class',
              [['', 'Use example class'], ...classes.map(code => [code, code])],
              draft.valuationClass
            )
          : input(
              'valuationClass',
              'Valuation class (if applicable)',
              draft.valuationClass,
              'maxlength="4" pattern="[A-Za-z0-9_]{4}"'
            ))
      );
    }

    function movementFields() {
      return scenario.steps
        .map((step, index) => {
          if (!step.movement) return '';
          const moves = E.matchingMoves(a.state(), step);
          const value = draft.movements[index] || step.movement;
          return select(
            'movementChoice-' + index,
            'Movement · ' + esc(step.title),
            moves.map(row => [row.code, row.code + ' · ' + row.name]),
            value
          );
        })
        .join('');
    }

    function form() {
      const plants = E.choices(a.state(), 'plant');
      const plant = plants.find(p => p.code === draft.plant);
      const plantChoices = plants.map(row => [row.code, row.code + ' · ' + row.name]);
      const groups = Object.entries(D.groups)
        .map(([group, label]) => {
          const rows = D.scenarios.filter(example => example.group === group);
          return `<optgroup label="${esc(label)}">${options(
            rows.map(row => [row.id, row.title]),
            scenario.id
          )}</optgroup>`;
        })
        .join('');
      return `<aside class="mmc-panel mmc-controls">
        <h3>Scenario settings</h3>
        <label>Scenario<select id="mmConfigScenario">${groups}</select></label>
        <form id="mmConfigForm">
          <fieldset${can('run') ? '' : ' disabled'}>
            ${select('edition', 'SAP edition', Object.entries(D.editions), draft.edition)}
            ${select('plant', scenario.receivingPlant ? 'Supplying plant' : 'Plant', plantChoices, draft.plant)}
            ${scenario.receivingPlant ? select('receivingPlant', 'Receiving plant', plantChoices, draft.receivingPlant) : ''}
            ${materialFields(plant)}
            ${
              scenario.id === 'material-transfer'
                ? select(
                    'targetMaterialCode',
                    'Receiving material type / valuation settings',
                    E.choices(a.state(), 'material', plant?.area).map(row => [
                      row.code,
                      row.code + ' · ' + row.name,
                    ]),
                    draft.targetMaterialCode
                  )
                : ''
            }
            <div id="mmConfigMovements">${movementFields()}</div>
            ${input('quantity', 'Quantity or difference', draft.quantity, 'type="number" min=".001" max="1000000" step="any" required')}
            ${detailsPanels()}
            <div class="mmc-form-actions">
              <button type="submit" class="primary">Run scenario</button>
              ${button('reset', 'Reset inputs')}
            </div>
          </fieldset>
        </form>
      </aside>`;
    }

    const money = new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    function postingLines(lines) {
      if (!lines.length) return '';
      return `<div class="mmc-table-wrap"><table class="mmc-posting">
        <caption>Illustrative accounting lines</caption>
        <thead><tr><th>Side</th><th>Account</th><th>Key / modifier</th><th class="mmc-number">Amount</th></tr></thead>
        <tbody>${lines
          .map(
            line => `<tr>
          <td>${line.side === 'debit' ? 'Debit' : 'Credit'}</td>
          <td>${esc(line.name)}${
            line.account?.gl
              ? `<small>G/L <code>${esc(line.account.gl)}</code>${line.account.name ? ' · ' + esc(line.account.name) : ''}</small>`
              : line.account?.ambiguous
                ? '<small>Multiple saved mappings match</small>'
                : line.key
                  ? '<small>No matching saved G/L mapping</small>'
                  : ''
          }${line.reference ? '<small>Assignment ' + esc(line.reference) + '</small>' : ''}</td>
          <td>${line.key ? `<code>${esc(line.key)}${line.modifier ? ' / ' + esc(line.modifier) : ''}</code>` : '—'}</td>
          <td class="mmc-number">${line.amount == null ? '—' : money.format(line.amount)}</td>
        </tr>`
          )
          .join('')}</tbody></table></div>`;
    }

    function determination(c) {
      const selected = c.material;
      const override = selected?.id ? ' · My settings' : '';
      return `<div class="mmc-determination">
        <div><strong>Material</strong><span>${selected ? esc(selected.code + override) : 'Service or invoice'}</span>
          ${selected ? `<small>Quantity Update ${selected.quantity ? 'on' : 'off'} · Value Update ${selected.value ? 'on' : 'off'}</small>` : ''}
        </div>
        <div><strong>Valuation area</strong><span>${esc(c.sourcePlant?.area || '—')}${c.scenario.receivingPlant && c.targetPlant ? ' → ' + esc(c.targetPlant.area) : ''}</span>
          <small>Company ${esc(c.sourcePlant?.company || '—')} · Chart ${esc(c.sourcePlant?.chart || '—')} · Group ${esc(c.sourcePlant?.group || '—')}</small>
        </div>
        <div><strong>Valuation class</strong><span>${esc(c.valuationClass || '—')}</span>
          <small>${selected?.reference ? 'Account category reference ' + esc(selected.reference) : 'From the selected material valuation'}</small>
        </div>
      </div>`;
    }

    function result(run) {
      const { context, steps, errors } = run;
      stepIndex = Math.min(stepIndex, steps.length - 1);
      const step = steps[stepIndex];
      const financial = step.docs.some(doc => /FI (accounting|payment|posting)/.test(doc));
      const note = [step.note, ...step.notes].filter(Boolean);
      const stepChecks = [
        ...new Set([
          step.check,
          ...(step.rule === 'gr' && context.assigned ? ['assignment'] : []),
          ...(step.docs.some(document => document.includes('QM inspection lot'))
            ? ['stockType']
            : []),
          ...(step.movement ? ['movement'] : []),
          ...(financial || step.lines.length ? ['posting'] : []),
        ]),
      ];
      const hasTarget = !!step.move && (step.move.code !== step.movement || step.move.id);
      const targetInfo =
        hasTarget && step.move.notes ? '<p class="mmc-note">' + esc(step.move.notes) + '</p>' : '';
      const advice =
        context.assignmentAccount && step.rule === 'po'
          ? `<p class="mmc-note">${
              context.assignmentAccount.ambiguous
                ? 'Multiple GBB mappings match the proposed PO account.'
                : 'Illustrative proposed PO G/L ' + esc(context.assignmentAccount.gl)
            }. Confirm the account on the PO item.</p>`
          : '';
      return `<section class="mmc-panel mmc-results" aria-labelledby="mmConfigResultTitle">
        <div class="mmc-result-heading"><div><h3 id="mmConfigResultTitle">${esc(run.scenario.title)}</h3>
        <p id="mmConfigRunStatus" role="status">${errors.length ? esc(errors.join(' ')) : steps.length + (steps.length === 1 ? ' step' : ' steps') + ' · Select a step to inspect its result'}</p></div>
        <span class="mmc-status" data-status="${step.status}">${stages[step.status]}</span></div>
        ${run.context.edition === 'public' ? '<p class="mmc-edition">Public Edition reference. Check app, configuration activity, and movement availability for your release and scope.</p>' : ''}
        ${determination(context)}
        <ol class="mmc-steps" aria-label="Process steps">${steps
          .map(
            (item, index) =>
              `<li>${button(
                'step',
                `<span aria-hidden="true" class="mmc-step-dot" data-status="${item.status}"></span><span>${esc(item.title)}</span>${item.move ? `<code>${esc(item.move.code)}</code>` : ''}`,
                `data-index="${index}" aria-current="${stepIndex === index ? 'step' : 'false'}"`
              )}</li>`
          )
          .join('')}</ol>
        <section class="mmc-stage">
          <div class="mmc-stage-head"><h4>${esc(step.title)}</h4>
            ${step.move ? `<span><code>${esc(step.move.code)}</code>${step.move.reversal ? ' · Reversal ' + esc(step.move.reversal) : ''}</span>` : ''}
          </div>
          <p>${esc(step.summary)}</p>
          ${targetInfo}${advice}
          <dl class="mmc-effects">
            <div><dt>Stock quantity</dt><dd>${esc(step.stock)}</dd></div>
            <div><dt>Stock value</dt><dd>${esc(step.value)}</dd></div>
            <div><dt>Documents and updates</dt><dd>${step.docs.length ? step.docs.map(esc).join(' · ') : 'None for this step'}</dd></div>
          </dl>
          ${postingLines(step.lines)}
          ${note.length ? `<ul class="mmc-notes">${note.map(item => '<li>' + esc(item) + '</li>').join('')}</ul>` : ''}
          <details open class="mmc-where"><summary>What to check in SAP</summary>
            ${stepChecks.map(checkpoint).join('')}
          </details>
          <details class="mmc-where"><summary>Material, organization & account rules</summary>
            ${['material', 'org', 'posting']
              .filter(id => !stepChecks.includes(id))
              .map(checkpoint)
              .join('')}
          </details>
        </section>
      </section>`;
    }

    function rowLabel(row) {
      if (row.kind === 'account') {
        return row.chart + ' · ' + row.key + ' · ' + row.gl;
      }
      return row.code + ' · ' + row.name;
    }

    function rowInfo(row) {
      if (row.kind === 'material')
        return [
          row.area ? 'Valuation area ' + row.area : 'Default valuation settings',
          'Quantity ' + (row.quantity ? 'on' : 'off'),
          'Value ' + (row.value ? 'on' : 'off'),
          row.classes && 'Classes ' + row.classes,
        ]
          .filter(Boolean)
          .join(' · ');
      if (row.kind === 'movement')
        return [
          row.code !== row.base && 'Base ' + row.base,
          row.reversal && 'Reversal ' + row.reversal,
          row.modifier && 'Modifier ' + row.modifier,
          row.required,
        ]
          .filter(Boolean)
          .join(' · ');
      if (row.kind === 'plant')
        return [
          'Company ' + row.company,
          'Valuation area ' + row.area,
          'Chart ' + row.chart,
          row.group && 'Group ' + row.group,
        ]
          .filter(Boolean)
          .join(' · ');
      return [
        row.group && 'Group ' + row.group,
        row.modifier && 'Modifier ' + row.modifier,
        row.valuationClass && 'Class ' + row.valuationClass,
        row.side,
        row.name,
      ]
        .filter(Boolean)
        .join(' · ');
    }

    function configRows() {
      const rows = E.entries(a.state(), kind).filter(row =>
        [rowLabel(row), rowInfo(row)].some(value =>
          value.toLowerCase().includes(query.trim().toLowerCase())
        )
      );
      return rows.length
        ? `<ul class="mmc-config-rows">${rows
            .map(row => {
              const attrs = `data-kind="${row.kind}" data-id="${esc(row.id)}" data-code="${esc(row.code || '')}"`;
              const action = row.id ? 'edit' : 'copy';
              return `<li><div><strong>${esc(rowLabel(row))}</strong>
          <p>${esc(rowInfo(row))}</p>${row.notes ? '<p>' + esc(row.notes) + '</p>' : ''}
        </div><div class="mmc-row-actions">${row.id ? '<span>My settings</span>' : '<span>' + (row.kind === 'plant' ? 'Example plant' : 'SAP preset') + '</span>'}
          ${can(row.id ? 'edit' : 'create') ? button(action, row.id ? 'Edit' : 'Copy & edit', attrs, 'small') : ''}
        </div></li>`;
            })
            .join('')}</ul>`
        : '<p class="mmc-empty">No matching configuration entries.</p>';
    }

    function configuration() {
      return `<section class="mmc-panel mmc-maintain">
        <div class="mmc-maintain-head"><div><h3>Maintain configuration</h3>
        <p>Keep your own settings for a valuation area, movement, plant, or G/L mapping.</p></div>
        ${can('create') ? button('add', '＋ Add ' + kinds[kind][1], '', 'primary') : ''}</div>
        <div class="mmc-config-tabs" aria-label="Configuration lists">
          ${Object.entries(kinds)
            .map(([key, labels]) =>
              button('kind', labels[0], `data-kind="${key}" aria-pressed="${kind === key}"`)
            )
            .join('')}
        </div>
        <label class="mmc-search">Search configuration<input id="mmConfigSearch" type="search" value="${esc(query)}" placeholder="Search by code or description"></label>
        <div id="mmConfigRows">${configRows()}</div>
      </section>`;
    }

    function render() {
      sync();
      if (!allowed()) return '';
      if (view === 'simulate')
        lastRun = E.run(a.state(), scenario.id, can('run') ? draft : undefined);
      return `<section id="mmConfigRoot" class="mmc-room" data-access-feature="${feature}">
        <div class="mmc-hero">
          <div><h2>MM Configuration</h2><p>Trace what SAP updates and posts, from material settings through the goods movement and invoice.</p></div>
          <div class="mmc-view-controls" aria-label="MM Configuration workspace">
            ${button('simulate', 'Simulator', `aria-pressed="${view === 'simulate'}"`)}
            ${button('configure', 'Maintain configuration', `aria-pressed="${view === 'configure'}"`)}
          </div>
        </div>
        ${
          view === 'simulate'
            ? `<div class="mmc-layout">${form()}<div id="mmConfigResult">${result(lastRun)}</div></div>
          <p class="mmc-footer">Standard examples and your saved settings. Posting amounts use a single currency and exclude tax and delivery charges.</p>`
            : configuration()
        }
      </section>`;
    }

    const controls = {
      material: row =>
        input(
          'code',
          'Material type code',
          row.code,
          'required maxlength="4" pattern="[A-Za-z0-9_]{4}"'
        ) +
        input('name', 'Description', row.name, 'required maxlength="120"') +
        input(
          'area',
          'Valuation area (blank applies as a default)',
          row.area,
          'maxlength="4" pattern="[A-Za-z0-9_]{4}"'
        ) +
        input(
          'reference',
          'Account category reference',
          row.reference,
          'maxlength="4" pattern="[A-Za-z0-9_]{4}"'
        ) +
        input(
          'classes',
          'Permitted valuation classes (comma separated)',
          row.classes,
          'maxlength="150"'
        ) +
        check('quantity', 'Quantity Update', row.quantity) +
        check('value', 'Value Update', row.value),
      movement: row =>
        input(
          'code',
          'Movement type code',
          row.code,
          'required maxlength="3" pattern="[A-Za-z0-9_]{3}"'
        ) +
        input('name', 'Description', row.name, 'required maxlength="120"') +
        select(
          'base',
          'Standard movement used for the simulation',
          D.moves.map(move => [move.code, move.code + ' · ' + move.name]),
          row.base
        ) +
        input(
          'reversal',
          'Reversal movement',
          row.reversal,
          'maxlength="3" pattern="[A-Za-z0-9_]{3}"'
        ) +
        input(
          'modifier',
          'Account modifier / general modification',
          row.modifier,
          'maxlength="3" pattern="[A-Za-z0-9_]{1,3}"'
        ) +
        input('required', 'Required reference or condition', row.required, 'maxlength="180"'),
      plant: row =>
        input('code', 'Plant code', row.code, 'required maxlength="4" pattern="[A-Za-z0-9_]{4}"') +
        input('name', 'Description', row.name, 'required maxlength="120"') +
        input(
          'area',
          'Valuation area',
          row.area,
          'required maxlength="4" pattern="[A-Za-z0-9_]{4}"'
        ) +
        input(
          'company',
          'Company code',
          row.company,
          'required maxlength="4" pattern="[A-Za-z0-9_]{4}"'
        ) +
        input(
          'chart',
          'Chart of accounts',
          row.chart,
          'required maxlength="4" pattern="[A-Za-z0-9_]{1,4}"'
        ) +
        input(
          'group',
          'Valuation grouping code',
          row.group,
          'maxlength="4" pattern="[A-Za-z0-9_]{1,4}"'
        ),
      account: row =>
        input(
          'key',
          'Transaction key',
          row.key,
          'required maxlength="3" pattern="[A-Za-z0-9_]{3}"'
        ) +
        input('gl', 'G/L account', row.gl, 'required maxlength="10" pattern="[A-Za-z0-9_]{1,10}"') +
        input('name', 'Account description', row.name, 'maxlength="120"') +
        input(
          'chart',
          'Chart of accounts',
          row.chart,
          'required maxlength="4" pattern="[A-Za-z0-9_]{1,4}"'
        ) +
        input(
          'group',
          'Valuation grouping code',
          row.group,
          'maxlength="4" pattern="[A-Za-z0-9_]{1,4}"'
        ) +
        input(
          'modifier',
          'Account modifier',
          row.modifier,
          'maxlength="3" pattern="[A-Za-z0-9_]{1,3}"'
        ) +
        input(
          'valuationClass',
          'Valuation class',
          row.valuationClass,
          'maxlength="4" pattern="[A-Za-z0-9_]{4}"'
        ) +
        select(
          'side',
          'Applies to',
          [
            ['both', 'Both sides'],
            ['debit', 'Debit'],
            ['credit', 'Credit'],
          ],
          row.side
        ),
    };

    function openEditor(control, op) {
      const rowKind = control.dataset.kind || kind;
      if (!Object.hasOwn(controls, rowKind)) return;
      const id = op === 'edit' ? control.dataset.id : '';
      guard(id ? 'edit' : 'create');
      const rows = E.entries(a.state(), rowKind);
      const row =
        op === 'add'
          ? E.blank(rowKind, a.state(), draft.plant)
          : rows.find(row => (id ? row.id === id : !row.id && row.code === control.dataset.code));
      if (!row) throw Error('This configuration entry is no longer available.');
      const tip =
        rowKind === 'movement'
          ? 'A custom movement uses the posting behavior of its selected standard base. For a new code, use a three-character value starting with 9, X, Y or Z. Enter the reference, reversal and modifier for your system.'
          : rowKind === 'account'
            ? 'Fill the fields used by the selected OBYC rule. A blank valuation group or class applies across those values in this example.'
            : '';
      a.openModal(
        (id ? 'Edit ' : 'Add ') + kinds[rowKind][1],
        `<form id="mmConfigEditor" class="mmc-editor" data-id="${esc(id)}" data-access-feature="${feature}">
        ${tip ? `<p>${tip}</p>` : ''}
        <div class="mmc-editor-grid">${controls[rowKind](row)}</div>
        <label>My notes<textarea name="notes" maxlength="2000" rows="3">${esc(row.notes)}</textarea></label>
        <div class="modal-actions">
          ${id && can('delete') ? button('delete', 'Delete', '', 'mmc-delete') : ''}
          <button type="button" data-action="cancel">Cancel</button>
          <button type="submit" class="primary">Save configuration</button>
        </div>
      </form>`
      );
      const form = $('mmConfigEditor');
      editor = { form, id, rowKind, owner, generation, original: id ? JSON.stringify(row) : '' };
      form.querySelector('input,select')?.focus();
    }

    function verifyEditor(action) {
      guard(action);
      if (
        !$('modal')?.open ||
        !editor ||
        editor.form !== $('mmConfigEditor') ||
        editor.owner !== owner ||
        editor.generation !== generation
      )
        throw Error('Reopen the configuration editor before saving.');
      if (editor.id) {
        const row = E.entries(a.state(), editor.rowKind).find(row => row.id === editor.id);
        if (JSON.stringify(row) !== editor.original)
          throw Error('The saved configuration changed. Reopen the editor to review it.');
      }
    }

    function saveEditor(form) {
      if (editor?.form !== form) return;
      const entry = editor;
      verifyEditor(entry.id ? 'edit' : 'create');
      if (!form.reportValidity()) return;
      const record = { id: entry.id || root.crypto.randomUUID(), kind: entry.rowKind };
      for (const control of form.elements) {
        if (control.name)
          record[control.name] =
            control.type === 'checkbox' ? control.checked : control.value.trim();
      }
      if (a.mutate(d => E.save(d, record)) !== false) {
        a.closeModal();
        editor = null;
        a.tell('MM configuration saved.');
      }
    }

    function recalculate() {
      lastRun = E.run(a.state(), scenario.id, can('run') ? draft : undefined);
      const host = $('mmConfigResult');
      if (host) host.innerHTML = result(lastRun);
    }

    function resetScenario(id, preserve = false) {
      const next = D.scenarios.find(row => row.id === id);
      if (!next) return;
      const edition = draft.edition;
      const plant = draft.plant;
      scenario = next;
      draft = E.defaults(next);
      if (preserve) {
        draft.edition = edition;
        draft.plant = plant;
      }
      stepIndex = Math.max(
        scenario.steps.findIndex(step => step.movement),
        0
      );
      a.render();
    }

    function readInput(control) {
      if (control.name.startsWith('movementChoice-')) {
        draft.movements[control.name.slice('movementChoice-'.length)] = control.value;
      } else if (Object.hasOwn(draft, control.name)) {
        draft[control.name] = control.type === 'checkbox' ? control.checked : control.value;
      }
    }

    document.addEventListener('input', event => {
      const control = event.target;
      if (control.id === 'mmConfigSearch' && allowed()) {
        query = control.value;
        $('mmConfigRows').innerHTML = configRows();
      } else if (control.closest?.('#mmConfigForm') && allowed('run') && control.name) {
        readInput(control);
      }
    });

    document.addEventListener('change', event => {
      const control = event.target;
      if (control.id === 'mmConfigScenario' && allowed()) {
        resetScenario(control.value, true);
        $('mmConfigScenario')?.focus({ preventScroll: true });
      } else if (control.closest?.('#mmConfigForm') && allowed('run')) {
        readInput(control);
        if (['plant', 'material'].includes(control.name)) {
          if (control.name === 'material') draft.valuationClass = '';
          if (control.name === 'plant') {
            draft.valuationClass = '';
            const area = E.choices(a.state(), 'plant').find(row => row.code === draft.plant)?.area;
            if (
              !scenario.service &&
              !E.choices(a.state(), 'material', area).some(row => row.code === draft.material)
            )
              draft.material = scenario.material;
          }
          panelOpen = !!$('mmConfigInputs')?.open;
          a.render();
          $('mmConfigForm')?.elements.namedItem(control.name)?.focus({ preventScroll: true });
        } else {
          recalculate();
        }
      }
    });

    document.addEventListener(
      'toggle',
      event => {
        if (event.target.id === 'mmConfigInputs') panelOpen = event.target.open;
      },
      true
    );

    document.addEventListener('submit', event => {
      const form = event.target;
      if (!['mmConfigForm', 'mmConfigEditor'].includes(form.id)) return;
      event.preventDefault();
      try {
        if (form.id === 'mmConfigEditor') {
          saveEditor(form);
        } else {
          guard('run');
          for (const control of form.elements) if (control.name) readInput(control);
          recalculate();
          $('mmConfigRunStatus')?.scrollIntoView?.({ block: 'nearest' });
        }
      } catch (error) {
        a.tell(error.message, true);
      }
    });

    document.addEventListener('click', async event => {
      const control = event.target.closest?.('[data-mm-config]');
      if (!control || control.disabled) return;
      const op = control.dataset.mmConfig;
      if (!['table', 'tcode'].includes(op)) event.preventDefault();
      try {
        guard();
        if (op === 'simulate' || op === 'configure') {
          view = op === 'simulate' ? 'simulate' : 'configure';
          a.render();
          $('mmConfigRoot')
            ?.querySelector(`[data-mm-config="${op}"]`)
            ?.focus({ preventScroll: true });
        } else if (op === 'reset') {
          guard('run');
          resetScenario(scenario.id, true);
        } else if (op === 'step') {
          const index = Number(control.dataset.index);
          if (!lastRun?.steps[index]) return;
          stepIndex = index;
          $('mmConfigResult').innerHTML = result(lastRun);
          $('mmConfigResult')
            ?.querySelector(`[data-index="${index}"]`)
            ?.focus({ preventScroll: true });
        } else if (op === 'kind') {
          if (!Object.hasOwn(kinds, control.dataset.kind)) return;
          kind = control.dataset.kind;
          query = '';
          a.render();
          $('mmConfigRoot')?.querySelector(`[data-kind="${kind}"]`)?.focus({ preventScroll: true });
        } else if (['add', 'edit', 'copy'].includes(op)) {
          openEditor(control, op);
        } else if (op === 'delete') {
          const entry = editor;
          verifyEditor('delete');
          if (
            !entry.id ||
            !(await root.WorkHubDialogs.confirm('Delete this saved configuration entry?'))
          )
            return;
          if (editor !== entry) return;
          verifyEditor('delete');
          if (a.mutate(d => E.remove(d, entry.rowKind, entry.id)) !== false) {
            editor = null;
            a.closeModal();
            a.tell('MM configuration entry deleted.');
          }
        } else if (op === 'table') {
          a.openTable(control.dataset.code, draft.edition);
        } else if (op === 'tcode') {
          a.openTcode(control.dataset.code);
        }
      } catch (error) {
        a.tell(error.message, true);
      }
    });

    return { render, sync };
  }

  root.WorkHubMmConfiguration = { install };
})(window);
