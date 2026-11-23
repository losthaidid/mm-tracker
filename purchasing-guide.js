(function purchasingGuide(root) {
  'use strict';
  const { escape: esc, asset, references, matrix, option, button } = root.WorkHubLearning;
  const catalog = asset('purchase-fields.json');
  const docs = {
    PR: [
      'Purchase Requisition',
      [
        ['ME51N', 'Create'],
        ['ME52N', 'Change'],
        ['ME53N', 'Display'],
      ],
    ],
    PO: [
      'Purchase Order',
      [
        ['ME21N', 'Create'],
        ['ME22N', 'Change'],
        ['ME23N', 'Display'],
      ],
    ],
    RFQ: [
      'RFQ & Quotation',
      [
        ['ME41', 'Create RFQ'],
        ['ME42', 'Change RFQ'],
        ['ME43', 'Display RFQ'],
        ['ME47', 'Maintain quotation'],
        ['ME48', 'Display quotation'],
        ['ME49', 'Compare quotations'],
      ],
    ],
    Contract: [
      'Purchasing Contract',
      [
        ['ME31K', 'Create'],
        ['ME32K', 'Change'],
        ['ME33K', 'Display'],
      ],
    ],
  };
  const action = (id, label, value = '', attrs = '') => button('pug', id, label, value, attrs);
  const screenSource = [
    'SAP Learning · Field selection in purchasing documents',
    'https://learning.sap.com/courses/purchasing-in-sap-s-4hana/setting-up-field-selection-in-purchasing-documents',
  ];
  const moreRefs = {
    gr: [
      [
        'SAP ERP · Account-assigned purchasing items',
        'https://help.sap.com/docs/SAP_ERP/967e1c2a6a8c4183b7e07d28e7574445/b47db65334e6b54ce10000000a174cb4-103.html',
      ],
    ],
    nonval: [
      [
        'SAP ERP · Invoices for account-assigned purchase orders',
        'https://help.sap.com/docs/SAP_ERP_SPV/98eed63ea3a544af84eb972dc68b0e84/d339b953495bb44ce10000000a174cb4.html',
      ],
    ],
    itemagr: [
      [
        'SAP ERP · Contract item and account assignment categories',
        'https://help.sap.com/docs/SAP_ERP_SPV/967e1c2a6a8c4183b7e07d28e7574445/187fb65334e6b54ce10000000a174cb4.html',
      ],
    ],
    part: [
      [
        'SAP ERP · Partner functions',
        'https://help.sap.com/docs/SAP_ERP/248c3cdd7e6548999a7f5b95118f4522/806fbd534f22b44ce10000000a174cb4.html',
      ],
    ],
  };
  const modes = Object.values(docs).flatMap(([, codes]) => codes.map(([code]) => code));
  const statuses = ['Required', 'Optional', 'Display-only', 'Hidden', 'Conditional'];
  const today = () => {
    const d = new Date();
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  };
  function validate(tcodes) {
    const s = tcodes?.learning;
    if (s === undefined) return;
    if (
      !s ||
      typeof s.exercises !== 'boolean' ||
      !s.fields ||
      typeof s.fields !== 'object' ||
      Array.isArray(s.fields) ||
      Object.keys(s.fields).length > 3500
    )
      throw Error('Check your purchasing study settings.');
    for (const [id, r] of Object.entries(s.fields)) {
      if (
        !r ||
        typeof r !== 'object' ||
        Array.isArray(r) ||
        !modes.includes(id.split('/')[0]) ||
        !/^[A-Z0-9]+\/[a-zA-Z0-9-]{1,60}$/.test(id)
      )
        throw Error('Check your purchasing study field.');
      for (const k of ['studied', 'practised'])
        if (k in r && typeof r[k] !== 'boolean') throw Error('Check the study progress.');
      for (const [k, max] of [
        ['client', 100],
        ['finding', 3000],
        ['date', 10],
        ['status', 20],
      ])
        if (k in r && (typeof r[k] !== 'string' || r[k].length > max))
          throw Error('Check the client observation.');
      if (r.status && !statuses.includes(r.status)) throw Error('Choose a field status.');
      if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw Error('Enter a dated observation.');
    }
  }
  function install(a) {
    let identity = '',
      open = false,
      doc = 'PO',
      tx = 'ME21N',
      id = 'gr',
      query = '',
      editor = null;
    const key = () => (a.ready() ? JSON.stringify([a.owner(), a.generation()]) : '');
    const allowed = (op = 'view') => !!key() && a.can('studio.tcodes', op);
    const active = () => a.active() && allowed(),
      data = () => catalog.rows[0];
    const place = (f, group = doc, code = tx) => {
      if (group !== 'RFQ') return f.places[group];
      if (code === 'ME49') return f.places.Comparison;
      if (code === 'ME47' || code === 'ME48') return f.places.Quotation || f.places.RFQ;
      return f.places.RFQ;
    };
    const shown = () => data().fields.filter(f => place(f));
    const study = () => a.state().workhub.tcodes.learning || { exercises: true, fields: {} };
    const fieldKey = f => tx + '/' + f.id;
    const observation = f => study().fields[fieldKey(f)] || {};
    function sync() {
      const val = key();
      if (val !== identity) {
        open = false;
        doc = 'PO';
        tx = 'ME21N';
        id = 'gr';
        query = '';
        editor = null;
        identity = val;
      }
      const form = document.getElementById('pugFinding');
      if (form && (!active() || !open || form.dataset.session !== val || !allowed('edit')))
        a.closeModal();
    }
    function guard(op = 'view', expected = identity) {
      if (!active() || !allowed(op) || expected !== key())
        throw Error('Reopen the purchasing guide with the required access.');
    }
    function update(change) {
      guard('edit');
      return a.mutate(d => {
        const t = d.workhub.tcodes,
          s = (t.learning ??= { exercises: true, fields: {} });
        change(s);
        validate(t);
      });
    }
    function amend(s, k, patch) {
      s.fields[k] = { ...s.fields[k], ...patch };
    }
    function refresh() {
      const app = document.getElementById('pugGuide');
      if (app && active() && open) app.outerHTML = view();
    }
    function renderHome(regular) {
      sync();
      if (!active()) return regular();
      if (!open)
        return (
          `<div class="pug-entry" data-access-feature="studio.tcodes">${action('enter', 'Purchasing transaction guide', '', 'class="primary"')}</div>` +
          regular()
        );
      return view();
    }
    const hasFinding = r => !!(r.finding || r.status || r.client);
    function checkControl(name, label, checked) {
      return `<label class="learn-check"><input type="checkbox" data-pug-check="${name}" ${checked ? 'checked' : ''} ${allowed('edit') ? '' : 'disabled'}>${esc(label)}</label>`;
    }
    function pathName(name) {
      return {
        PR: 'Purchase Requisition',
        PO: 'Purchase Order',
        RFQ: 'RFQ and Quotation',
        Contract: 'Contract',
      }[name];
    }
    function searchResults() {
      const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
      if (!words.length) return '';
      const hits = [];
      for (const [d, [, codes]] of Object.entries(docs)) {
        const variants = d === 'RFQ' ? [codes[0][0], 'ME47', 'ME49'] : [codes[0][0]];
        for (const code of variants)
          for (const f of data().fields) {
            const p = place(f, d, code);
            if (!p) continue;
            const relevant = codes.filter(
              ([c]) =>
                d !== 'RFQ' ||
                (code === 'ME49'
                  ? c === code
                  : code === 'ME47'
                    ? ['ME47', 'ME48'].includes(c)
                    : ['ME41', 'ME42', 'ME43'].includes(c))
            );
            const corpus = [
              pathName(d),
              ...relevant.map(x => x[0]),
              ...p,
              f.name,
              f.purpose,
              f.control,
              f.origin,
              f.trace,
              ...(f.scenarios || []),
            ]
              .join(' ')
              .toLowerCase();
            if (words.every(w => corpus.includes(w))) {
              const wanted = relevant.find(([c]) => words.includes(c.toLowerCase()));
              hits.push([f, d, wanted?.[0] || code]);
            }
          }
      }
      return `<div class="pug-hits"><p role="status">${hits.length} field matches</p>${hits
        .slice(0, 40)
        .map(([f, d, c]) =>
          action('jump', `${c} · ${f.name}`, f.id, `data-doc="${d}" data-tx="${c}"`)
        )
        .join('')}${hits.length > 40 ? '<p>Refine the search to see more matches.</p>' : ''}</div>`;
    }
    function lesson(f) {
      const [tab, technical] = place(f),
        g = data().groups[f.topic],
        r = observation(f);
      const scenario = f.scenarios || g.slice(1, 5);
      const display = docs[doc][1].find(([c]) => c === tx)[1].startsWith('Display');
      const special =
        tx === 'ME49'
          ? 'The report selections are inputs for a comparison run. Its calculated result columns are display-only.'
          : display
            ? 'Display transaction. The document values shown here are read-only.'
            : tx === 'ME47' && !f.places.Quotation
              ? 'Quotation maintenance uses the existing invitation as context. Use the RFQ change transaction for changes to the invitation itself.'
              : tab === 'Purchase order history' ||
                  tab === 'Release documentation' ||
                  f.id === 'relstat'
                ? 'Generated document information is read-only in this view.'
                : tx.includes('22') || tx === 'ME52N' || tx === 'ME32K' || tx === 'ME42'
                  ? 'Change transaction. Release status and existing follow-on documents may further restrict a field that was editable at creation.'
                  : 'Create or maintenance transaction. The effective field selection and business rules determine input availability.';
      const related = g[5]
        .split(' ')
        .map(i => shown().find(row => row.id === i && i !== f.id))
        .filter(Boolean);
      const sameName = data()
        .fields.filter(row => row.id === f.id)
        .flatMap(row =>
          Object.keys(docs)
            .filter(d => place(row, d, docs[d][1][0][0]))
            .map(d => [pathName(d), ...place(row, d, docs[d][1][0][0])])
        );
      const refs = [
        [
          `SAP · ${f.topic === 'layout' ? 'Purchasing document field selection' : f.name + ' process reference'}`,
          g[6],
        ],
        ...(moreRefs[f.id] || []),
      ];
      if (refs[0][1] !== screenSource[1]) refs.push(screenSource);
      return `<article class="pug-lesson" aria-labelledby="pugTitle"><p class="kg-depth">${esc(tx)} · ${esc(tab)}</p><h3 id="pugTitle" tabindex="-1">${esc(f.name)}</h3><p class="learn-intro">${esc(f.purpose)}</p>${technical ? `<code>${esc(technical)}</code>` : ''}
        <dl class="pug-facts"><dt>Where the value comes from</dt><dd>${esc(f.origin)}</dd><dt>Screen behavior in ${esc(tx)}</dt><dd>${esc(special)} ${esc(f.control)}</dd><dt>Downstream effect</dt><dd>${esc(f.effect)}</dd></dl>
        <details open><summary>Compare two scenarios</summary>${matrix(
          f.name,
          ['Scenario', 'Expected behavior'],
          [
            [scenario[0], scenario[1]],
            [scenario[2], scenario[3]],
          ]
        )}</details>
        <details><summary>Configuration and greyed-out fields</summary><p>${esc(g[0].replace('[document]', pathName(doc)))}</p><ol><li>${esc(special)}</li><li>Compare the document type, item category and account assignment with a known working item. ${esc(f.control)}</li><li>Inspect the effective field-selection keys where applicable. SAP combines hide, display, required and optional controls. Also check document history, release status and permissions.</li><li>Use F1 → Technical Information on the actual GUI field. A screen structure may differ from the stored business field. Record the effective status under Client findings.</li></ol></details>
        ${related.length ? `<details><summary>Related fields side by side</summary>${matrix('Compare their purposes', ['Field', 'What it controls'], [[f.name, f.purpose], ...related.map(v => [v.name, v.purpose])])}<div class="actions">${related.map(v => action('field', v.name, v.id)).join('')}</div></details>` : ''}
        <details><summary>Trace this field across documents</summary><p>${esc(f.trace)}</p>${
          sameName.length > 1
            ? matrix(
                'Where this business field appears',
                ['Document', 'Screen area', 'Stored field'],
                sameName.map(row => [row[0], row[1], row[2] || 'Inspect F1 on screen'])
              )
            : ''
        }</details>
        <details><summary>SAP references</summary><p>Classic ECC purchasing. S/4HANA learning references identify shared concepts. Verify release-specific and client-specific settings on your own system.</p>${references(refs)}</details>
        <section class="pug-findings"><h4>My client findings</h4>${hasFinding(r) ? `<p><strong>${esc([r.client, r.date, r.status].filter(Boolean).join(' · '))}</strong></p><p class="prewrap hub-sensitive">${esc(r.finding)}</p>` : '<p>No client observation recorded for this transaction and field.</p>'}${allowed('edit') ? action('finding', hasFinding(r) ? 'Edit finding' : 'Record a finding', f.id) : ''}</section>
        ${checkControl('studied', 'Mark field as studied', r.studied)}${study().exercises ? `<section class="pug-qa"><h4>Short QA exercise</h4><p>${esc(f.qa)}</p>${display || tx === 'ME49' ? '<p>Use this transaction to inspect the result. Prepare any test documents in the appropriate create or change transaction in QA.</p>' : ''}${checkControl('practised', 'Exercise completed', r.practised)}</section>` : ''}</article>`;
    }
    function view() {
      catalog.load(refresh);
      const head = `<header class="learn-guide-head"><div><p class="kg-depth">Classic SAP ECC</p><h2>Purchasing transaction guide</h2></div>${action('exit', 'T-code library')}</header>`;
      if (!catalog.loaded)
        return `<section id="pugGuide">${head}<p role="status">${catalog.failed ? 'Field lessons could not load.' : 'Loading field lessons…'}</p>${catalog.failed ? action('retry', 'Retry field lessons') : ''}</section>`;
      const rows = shown();
      let f = rows.find(v => v.id === id) || rows[0];
      id = f.id;
      const selectedTab = place(f)[0],
        tabs = [...new Set(rows.map(v => place(v)[0]))];
      return `<section id="pugGuide" data-access-feature="studio.tcodes" data-session="${esc(identity)}">${head}<div class="pug-controls"><label>Purchasing document<select id="pugDoc">${Object.entries(
        docs
      )
        .map(([d, v]) => option(d, v[0], doc))
        .join(
          ''
        )}</select></label><label>Transaction<select id="pugTx">${docs[doc][1].map(([c, label]) => option(c, c + ' · ' + label, tx)).join('')}</select></label><label>Search all field lessons<input type="search" id="pugSearch" maxlength="160" placeholder="Goods receipt, EKPO-WEPOS, ME41…" value="${esc(query)}"></label>${checkControl('exercises', 'Show QA exercises', study().exercises)}</div><div id="pugResults">${searchResults()}</div>
        <section class="pug-map"><h3>Screen map · ${esc(tx)}</h3><p>Illustrated screen areas. Select an area, then a field.</p><div class="pug-tabs">${tabs.map(tab => action('area', tab, tab, `aria-pressed="${tab === selectedTab}"`)).join('')}</div><div class="pug-fields">${rows
          .filter(v => place(v)[0] === selectedTab)
          .map(v => action('field', v.name, v.id, `aria-pressed="${v.id === id}"`))
          .join('')}</div></section>
        ${lesson(f)}<details class="pug-coverage"><summary>Coverage and study progress · ${rows.filter(v => observation(v).studied).length} of ${rows.length} field lessons studied</summary><p>These counts cover the authored field lessons in ${esc(tx)}. Record a QA observation to document your own client’s screen status.</p>${tabs
          .map(
            tab =>
              `<h4>${esc(tab)}</h4><ul>${rows
                .filter(v => place(v)[0] === tab)
                .map(
                  v =>
                    `<li>${action('field', v.name, v.id)} <span>${observation(v).studied ? 'Studied' : 'To study'} · ${hasFinding(observation(v)) ? 'Client finding saved' : 'Awaiting client check'}</span></li>`
                )
                .join('')}</ul>`
          )
          .join('')}</details></section>`;
    }
    function finding(f) {
      const prior = observation(f);
      editor = { key: key(), id: fieldKey(f), expected: JSON.stringify(prior) };
      a.openModal(
        'Client finding · ' + f.name,
        `<form id="pugFinding" data-id="${esc(fieldKey(f))}" data-access-feature="studio.tcodes" data-session="${esc(key())}" class="kg-form"><p>${esc(tx)} · ${esc(place(f)[0])} · ${esc(f.name)}</p><label>Client / system and scenario<input name="client" required maxlength="100" value="${esc(prior.client)}" placeholder="QA client, document type and item category"></label><label>Observed on<input name="date" type="date" required value="${esc(prior.date || today())}"></label><label>Observed screen status<select name="status">${option('', 'Choose status', prior.status)}${statuses.map(s => option(s, s, prior.status)).join('')}</select></label><label>What you observed<textarea name="finding" maxlength="3000" required>${esc(prior.finding)}</textarea></label><div class="modal-actions">${action('cancel', 'Cancel')}<button type="submit" class="primary">Save finding</button></div></form>`
      );
    }
    document.addEventListener('click', e => {
      const b = e.target.closest?.('[data-pug]');
      if (!b) return;
      try {
        guard();
        const cmd = b.dataset.pug,
          val = b.dataset.id;
        if (cmd === 'enter' || cmd === 'exit') {
          open = cmd === 'enter';
          a.render();
          return;
        }
        if (!open) return;
        if (cmd === 'retry') {
          catalog.retry(refresh);
          refresh();
          return;
        }
        if (cmd === 'cancel') {
          a.closeModal();
          return;
        }
        if (cmd === 'finding') {
          guard('edit');
          finding(shown().find(f => f.id === val));
          return;
        }
        if (cmd === 'jump') {
          doc = b.dataset.doc;
          tx = b.dataset.tx;
          id = val;
          query = '';
        }
        if (cmd === 'area') id = shown().find(f => place(f)[0] === val)?.id;
        if (cmd === 'field') id = val;
        refresh();
        document.getElementById('pugTitle')?.focus({ preventScroll: true });
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('input', e => {
      if (e.target.id === 'pugSearch' && active() && open) {
        query = e.target.value;
        document.getElementById('pugResults').innerHTML = searchResults();
      }
    });
    document.addEventListener('change', e => {
      const el = e.target,
        check = el.dataset.pugCheck;
      if (!active() || !open || (!check && !['pugDoc', 'pugTx'].includes(el.id))) return;
      try {
        if (check) {
          update(s => {
            if (check === 'exercises') s.exercises = el.checked;
            else if (['studied', 'practised'].includes(check))
              amend(s, tx + '/' + id, { [check]: el.checked });
          });
        } else {
          if (el.id === 'pugDoc') {
            doc = el.value;
            tx = docs[doc][1][0][0];
          } else tx = el.value;
          query = '';
          refresh();
        }
        (check
          ? document.querySelector(`[data-pug-check="${check}"]`)
          : document.getElementById(el.id)
        )?.focus({ preventScroll: true });
      } catch (err) {
        el.checked = !el.checked;
        a.tell(err.message, true);
      }
    });
    document.addEventListener('submit', e => {
      const form = e.target;
      if (form.id !== 'pugFinding') return;
      e.preventDefault();
      try {
        if (!editor || !form.isConnected || document.getElementById('pugFinding') !== form)
          throw Error('Reopen the field finding.');
        guard('edit', editor.key);
        const patch = Object.fromEntries([...new FormData(form)].map(([k, v]) => [k, v.trim()]));
        if (!patch.client || !patch.date || !patch.finding)
          throw Error('Enter the client, date and finding.');
        if (
          update(s => {
            const old = s.fields[editor.id] || {};
            if (JSON.stringify(old) !== editor.expected)
              throw Error('This field changed. Reopen the finding.');
            amend(s, editor.id, patch);
          })
        ) {
          editor = null;
          a.closeModal();
          a.tell('Client finding saved.');
        }
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    return { renderHome, sync };
  }
  root.WorkHubPurchasingGuide = Object.freeze({ install, validate });
})(globalThis);
