/* Sentence builder and rule maintenance use the existing Process Hub account boundary. */
(function (root) {
  'use strict';
  const T = root.WorkHubProcessSentenceEngine,
    E = root.WorkHubRehearsalEngine;
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (op, label, attrs = '', cls = '') =>
    `<button type="button" data-ps="${op}" ${attrs} class="${cls}">${label}</button>`;
  const EXAMPLE =
    'Requester: Receive the CR Form. Then Coordinator: Review the form. Then Manager: Request approval. If approved, Delivery team: Implement the change, then Delivery team: Notify the requester. Otherwise, Coordinator: Return the form for clarification.';
  const options = (rows, value) =>
    rows
      .map(
        ([k, label]) =>
          `<option value="${esc(k)}"${k === value ? ' selected' : ''}>${esc(label)}</option>`
      )
      .join('');
  function conditionFields(s) {
    const c = s.sentenceCondition;
    return `<details class="ps-condition"${c ? ' open' : ''}><summary>Automatic condition</summary><label class="check-label"><input type="checkbox" name="psConditionEnabled"${c ? ' checked' : ''}>Evaluate a sample field automatically</label><p>Use exactly two named answers: first = condition matches; second = otherwise. Interactive playback can override the result.</p><label>Sample field<input name="psConditionField" maxlength="80" value="${esc(c?.field || '')}"></label><label>Comparison<select name="psConditionOperator">${options(
      [
        ['eq', 'Equals'],
        ['ne', 'Does not equal'],
        ['gt', 'Greater than'],
        ['ge', 'Greater than or equal'],
        ['lt', 'Less than'],
        ['le', 'Less than or equal'],
      ],
      c?.operator || 'eq'
    )}</select></label><label>Compare as<select name="psConditionValueType">${options(
      [
        ['number', 'Number'],
        ['text', 'Text'],
      ],
      !c || typeof c.value === 'number' ? 'number' : 'text'
    )}</select></label><label>Compare with<input name="psConditionValue" maxlength="300" value="${esc(c?.value ?? '')}"></label><p>Numbers compare numerically. Text equality ignores case and surrounding spaces. Clear the switch for a manual decision.</p></details>`;
  }
  function readCondition(form, step) {
    if (!form.elements.namedItem('psConditionEnabled')) return step.sentenceCondition;
    if (!form.elements.namedItem('psConditionEnabled').checked) return undefined;
    if (step.type !== 'decision' || !step.decision) return undefined;
    if (step.decision.answers.length !== 2)
      throw Error('An automatic condition requires exactly two named decision answers.');
    const field = form.elements.namedItem('psConditionField').value.trim(),
      operator = form.elements.namedItem('psConditionOperator').value,
      raw = form.elements.namedItem('psConditionValue').value.trim();
    if (!field || !raw) throw Error('Complete the automatic condition field and comparison value.');
    return { field, operator, value: /^-?\d+(?:\.\d+)?$/.test(raw) ? Number(raw) : raw };
  }
  function install(a) {
    let account = '',
      epoch = 0,
      session = null,
      ruleDraft = null,
      baseRules = '',
      section = 'fields',
      rowEdit = null,
      lastRemoved = null;
    const $ = id => document.getElementById(id),
      allowed = op => !a.can || a.can('processhub', op),
      ready = () => a.ready() && !!a.owner();
    const rules = () => a.state().workhub.rehearsal.sentenceRules || T.defaults(),
      uid = () =>
        root.crypto?.randomUUID?.() ||
        'sentence-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    function sync() {
      const next = ready() ? a.owner() : '';
      if (next !== account || !allowed('view')) {
        epoch++;
        account = next;
        session = null;
        ruleDraft = null;
        baseRules = '';
        rowEdit = null;
        lastRemoved = null;
        if ($('psBuilder') || $('psRules')) a.closeModal();
      }
      if ((session && !allowed('create')) || (ruleDraft && !allowed('edit'))) {
        session = null;
        ruleDraft = null;
        baseRules = '';
        if ($('psBuilder') || $('psRules')) a.closeModal();
      }
    }
    function guard(op = 'create', form = null) {
      sync();
      if (
        !ready() ||
        !account ||
        !allowed(op) ||
        (form &&
          (form.dataset.owner !== account ||
            form.dataset.epoch !== String(epoch) ||
            !form.isConnected))
      )
        throw Error(
          'Your account or Process Hub permissions changed. Reopen the sentence builder.'
        );
    }
    function header() {
      sync();
      return (
        (!a.busy() && allowed('create') ? button('open', '✎ Describe a process') : '') +
        (allowed('edit') ? button('rules', 'Sentence rules') : '')
      );
    }
    function open() {
      guard();
      if (a.busy())
        throw Error('Save or discard the open process or step draft before starting another.');
      session ||= {
        name: '',
        description: '',
        owner: '',
        initial: '',
        choices: {},
        filters: {},
        result: null,
        fingerprint: '',
      };
      builder();
    }
    function builder() {
      a.openModal(
        'Describe an animated process',
        `<section id="psBuilder" data-access-feature="processhub"><div class="ps-intro"><span class="hub-kicker">YOUR WORDS → YOUR PROCESS</span><h3>A clear sentence. A living process.</h3><p>Uses your maintained rules on this device. Review matches, then open the existing animated editor.</p></div><form id="psBuilderForm" data-owner="${esc(account)}" data-epoch="${epoch}"><div class="ps-fields"><label>Process name<input name="name" maxlength="200" value="${esc(session.name)}" placeholder="e.g. CR Form handling"></label><label>Default responsible person / department<input name="owner" list="psResponsibles" maxlength="200" value="${esc(session.owner)}" placeholder="Person: John Tan or Department: Warehouse"></label></div><datalist id="psResponsibles">${rules()
          .fields.filter(f => ['person', 'department'].includes(f.kind))
          .flatMap(f =>
            T.valueRows(f, E.library(a.state())).map(
              v =>
                `<option value="${esc((f.kind === 'person' ? 'Person: ' : 'Department: ') + v.value)}">${esc(v.label)}</option>`
            )
          )
          .join(
            ''
          )}</datalist><label>Your process description<textarea name="description" rows="6" maxlength="12000" required placeholder="Receive the form, then review it. If approved, implement the change. Otherwise, return it.">${esc(session.description)}</textarea></label><p class="ps-help">Use then, →, commas or separate lines. Use <strong>Person or Department: Action</strong> to assign a step. Use <strong>If …, … Otherwise, …</strong> for one decision; add more in the canvas. Double quotes protect words containing commas or “then”.</p><div class="actions">${button('example', 'Use CR Form example')}${button('rules', 'Maintain sentence rules')}<button type="submit" class="primary">Generate draft preview</button></div><details class="ps-samples"><summary>Starting sample values · optional</summary><label>One field = value per line<textarea name="initial" rows="3" maxlength="4000" placeholder="Status = Approved">${esc(session.initial)}</textarea></label><p>Matched numeric inputs fill their own fields. Add values here for other decision fields or starting counters. Sample values can also be edited in the existing Scenario editor.</p></details></form><div id="psResult" aria-live="polite">${session.result ? preview() : ''}</div></section>`
      );
    }
    function capture(form) {
      for (const key of ['name', 'description', 'owner', 'initial'])
        session[key] = form.elements.namedItem(key).value;
    }
    function matchOptions(b) {
      const q = (session.filters[b.key] || '').toLowerCase(),
        list = b.options
          .filter(o => !q || [o.value, o.label, ...o.aliases].join(' ').toLowerCase().includes(q))
          .slice(0, 100),
        selected = session.choices[b.key] || b.match?.key || '';
      if (selected && !list.some(x => x.key === selected)) {
        const v = b.options.find(x => x.key === selected);
        if (v) list.unshift(v);
      }
      return `<option value="">Choose a maintained value</option>${list.map(v => `<option value="${esc(v.key)}"${v.key === selected ? ' selected' : ''}>${esc(v.label)}</option>`).join('')}`;
    }
    function preview() {
      const r = session.result;
      if (!r) return '';
      return `<section class="ps-preview"><div class="ps-preview-heading"><h3>Match preview</h3><span>${r.nodes.length} steps · ${r.nodes.filter(n => n.type === 'decision').length} decision</span></div>${r.issues.length ? `<div class="ps-issues" role="alert"><strong>Resolve these matches first</strong><ul>${r.issues.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}${r.warnings.length ? `<details class="ps-notices"><summary>Review notes · ${r.warnings.length}</summary><ul>${r.warnings.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}<ol class="ps-preview-steps">${r.nodes.map((n, i) => `<li><div><span class="ps-type">${esc(n.type)}</span><strong>${esc(n.title)}</strong>${n.owner || session.owner ? `<span class="ps-owner">Responsible · ${esc(n.owner || session.owner)}</span>` : ''}</div>${n.pattern ? `<small>Pattern: ${esc(n.pattern)}</small>` : ''}${n.bindings.map(b => `<div class="ps-binding"><span>${esc(b.label)}: <strong>${esc(b.match?.label ?? b.value)}</strong></span>${b.options.length ? `<details${!b.match ? ' open' : ''}><summary>${b.match ? 'Change match' : 'Choose match'}</summary><label>Search maintained values<input type="search" data-ps-search="${esc(b.key)}" value="${esc(session.filters[b.key] || '')}" maxlength="100"></label><label>Matched ${esc(b.label)}<select data-ps-choice="${esc(b.key)}">${matchOptions(b)}</select></label></details>` : b.kind === 'entity' || b.kind === 'person' || b.kind === 'department' ? '<small>No maintained values. Add them in Sentence rules or existing process steps.</small>' : ''}</div>`).join('')}${n.answers ? `<div class="ps-routes">${n.answers.map(answer => `<span>${esc(answer.label)} → ${esc(r.nodes.find(x => x.id === answer.next)?.title || 'End')}</span>`).join('')}${n.conditionRule ? `<small>Automatic condition: ${esc(n.conditionRule.field)} ${esc({ eq: '=', ne: '≠', gt: '>', ge: '≥', lt: '<', le: '≤' }[n.conditionRule.operator])} ${esc(n.conditionRule.value)}</small>` : ''}</div>` : `<small>Next → ${esc(r.nodes.find(x => x.id === n.next)?.title || 'End route')}</small>`}</li>`).join('')}</ol><div class="ps-next"><span>Opening a draft does not save account records. Review and choose Save process in the canvas.</span>${button('use', 'Open in animated editor', r.issues.length ? 'disabled' : '', 'primary')}</div></section>`;
    }
    function generate(scroll = false) {
      const form = $('psBuilderForm');
      guard('create', form);
      capture(form);
      const fingerprint = JSON.stringify([rules(), E.library(a.state())]);
      if (session.fingerprint && session.fingerprint !== fingerprint) session.choices = {};
      session.result = T.analyse(
        session.description,
        rules(),
        E.library(a.state()),
        session.choices,
        E.values(session.initial)
      );
      session.fingerprint = JSON.stringify([rules(), E.library(a.state())]);
      $('psResult').innerHTML = preview();
      if (scroll) {
        const result = $('psResult');
        result.tabIndex = -1;
        result.focus({ preventScroll: true });
        result.scrollIntoView?.({ block: 'start', behavior: 'instant' });
      }
    }
    function use() {
      guard('create', $('psBuilderForm'));
      if (
        !session?.result ||
        session.fingerprint !== JSON.stringify([rules(), E.library(a.state())])
      )
        throw Error('Your rules or saved processes changed. Generate a fresh preview first.');
      if (a.busy()) throw Error('Finish the current process draft first.');
      const candidate = T.build(session.result, {
          id: uid(),
          uid,
          at: new Date().toISOString(),
          name: session.name,
          owner: session.owner,
          initial: E.values(session.initial),
        }),
        probe = E.copy(a.state());
      E.store(probe, candidate);
      E.validate(probe);
      a.closeModal();
      a.adopt(candidate);
      session = null;
    }
    function openRules() {
      guard('edit');
      ruleDraft ||= T.copy(rules());
      baseRules ||= JSON.stringify(rules());
      rowEdit = null;
      rulesView();
    }
    const groups = () =>
      section === 'people'
        ? ruleDraft.fields.filter(f => ['person', 'department'].includes(f.kind))
        : section === 'fields'
          ? ruleDraft.fields.filter(f => !['person', 'department'].includes(f.kind))
          : ruleDraft[section];
    function rulesView() {
      const rows = groups();
      a.openModal(
        'Sentence rules',
        `<section id="psRules" data-access-feature="processhub" data-owner="${esc(account)}" data-epoch="${epoch}"><div class="ps-intro"><span class="hub-kicker">WORDS WITH A MEANING</span><h3>Teach the rules once.</h3><p>Changes here are staged until you choose Save rules. Existing generated processes keep their saved steps.</p></div><nav class="ps-tabs" aria-label="Sentence rule sections">${[
          ['fields', 'Terms & values'],
          ['actions', 'Actions'],
          ['patterns', 'Sentence patterns'],
          ['people', 'People & departments'],
        ]
          .map(([k, label]) =>
            button(
              'section',
              label,
              `data-section="${k}" aria-current="${section === k ? 'page' : 'false'}"`
            )
          )
          .join(
            ''
          )}</nav>${rowEdit ? rowForm() : `<div class="ps-rule-tools">${button('reload-rules', 'Reload saved rules')}${button('add', '＋ Add ' + (section === 'people' ? 'person / department' : section === 'fields' ? 'term' : section === 'actions' ? 'action' : 'pattern'))}${lastRemoved ? button('undo', 'Undo removal') : ''}</div><div class="ps-rule-list">${rows.map(r => `<article><div><strong>${esc(r.label)}</strong><small>${esc(r.key)} · ${esc(section === 'patterns' ? r.pattern : section === 'actions' ? r.aliases.join(', ') + ' · ' + r.type : r.kind + ' · ' + r.aliases.join(', '))}</small>${r.values ? `<small>${r.values.length} maintained values${r.kind === 'entity' ? ' + references from saved process steps' : ''}</small>` : ''}</div><div class="actions">${button('edit', 'Edit', `data-key="${esc(r.key)}"`)}${button('remove', 'Remove', `data-key="${esc(r.key)}"`)}</div></article>`).join('') || '<p>No entries in this section yet.</p>'}</div>`}<div class="ps-save-rules"><p>Rules belong to your account and are included in JSON backups.</p>${button('save-rules', 'Save rules', '', 'primary')}${button('back-builder', 'Back to sentence builder')}</div></section>`
      );
    }
    function rowForm() {
      const { kind, row } = rowEdit,
        input = (k, label, limit = 100) =>
          `<label>${label}<input name="${k}" maxlength="${limit}" value="${esc(row[k] || '')}"${k === 'key' && !rowEdit.fresh ? ' readonly' : ''}></label>`,
        aliases = `<label>Aliases · one per line<textarea name="aliases" rows="3" maxlength="2000">${esc((row.aliases || []).join('\n'))}</textarea></label>`;
      return `<form id="psRuleForm" data-id="sentence-rules" data-owner="${esc(account)}" data-epoch="${epoch}"><div class="ps-fields">${input('key', 'Unique key · letters, numbers, underscore', 40)}${input('label', 'Display name')}</div>${
        kind === 'fields'
          ? `<div class="ps-fields"><label>Meaning<select name="kind">${options(
              section === 'people'
                ? [
                    ['person', 'Person'],
                    ['department', 'Department'],
                  ]
                : [
                    ['number', 'Number'],
                    ['text', 'Text / status'],
                    ['entity', 'Organization / material reference'],
                  ],
              row.kind
            )}</select></label><label>Target field<select name="entityTarget"><option value="">Choose for an organization / material term</option>${options(E.ENTITY_FIELDS, row.kind === 'entity' ? row.target : '')}</select></label></div>${input('target', 'Sample field name · for number or text', 80)}${aliases}<label>Maintained values · one per line<textarea name="values" rows="6" maxlength="60000" placeholder="QA01 | Quality store | Warehouse A">${esc((row.values || []).map(v => [v.value, v.label, v.aliases.join(', ')].join(' | ')).join('\n'))}</textarea></label><p class="ps-help">Format: value | display name | aliases separated by commas. Storage and material references also match entity fields already saved in Process Hub. People/departments may be used in templates or as “Name: Action”.</p>`
          : kind === 'actions'
            ? `${aliases}<div class="ps-fields"><label>Animated step type<select name="type">${options(
                E.TYPES.map(t => [t, E.TYPE_LABELS[t]]),
                row.type
              )}</select></label><label>Quantity effect<select name="effect">${options(
                [
                  ['none', 'None'],
                  ['set', 'Set counter to quantity'],
                  ['add', 'Add quantity to counter'],
                  ['subtract', 'Subtract quantity from counter'],
                ],
                row.effect
              )}</select></label><label>Quantity term<select name="quantity"><option value="">None</option>${options(
                ruleDraft.fields.filter(f => f.kind === 'number').map(f => [f.key, f.label]),
                row.quantity
              )}</select></label>${input('counter', 'Sample counter name', 80)}</div><p>Receive, issue and transfer track separate counters by default. Change the effect and counter explicitly to model your own sample balance.</p>`
            : `<label>Action rule<select name="action">${options(
                ruleDraft.actions.map(a => [a.key, a.label]),
                row.action
              )}</select></label><label>Sentence pattern<textarea name="pattern" maxlength="600" rows="4" placeholder="{action} {quantity} into SLoc {SLoc} by {department}">${esc(row.pattern || '')}</textarea></label><p>Use {action} for the selected action’s aliases. Other placeholders must match a term key exactly. More specific patterns take priority. Literal wording is case-insensitive; each placeholder can appear once. Add patterns for your preferred wording.</p><p>Available terms: ${ruleDraft.fields.map(f => `<code>{${esc(f.key)}}</code>`).join(' ')}</p>`
      }<div class="actions"><button type="submit" class="primary">Keep row in draft</button>${button('cancel-row', 'Cancel row')}</div></form>`;
    }
    function syncTermControls() {
      const form = $('psRuleForm');
      if (!form || !form.elements.namedItem('entityTarget')) return;
      const kind = form.elements.namedItem('kind').value;
      form.elements.namedItem('entityTarget').closest('label').hidden = kind !== 'entity';
      form.elements.namedItem('target').closest('label').hidden = !['number', 'text'].includes(
        kind
      );
    }
    function editRow(key) {
      const kind = section === 'people' ? 'fields' : section;
      rowEdit = {
        kind,
        fresh: !key,
        row: key
          ? T.copy(ruleDraft[kind].find(r => r.key === key))
          : kind === 'fields'
            ? {
                key: '',
                label: '',
                kind: section === 'people' ? 'person' : 'text',
                target: '',
                aliases: [],
                values: [],
              }
            : kind === 'actions'
              ? {
                  key: '',
                  label: '',
                  aliases: [],
                  type: 'task',
                  effect: 'none',
                  quantity: '',
                  counter: '',
                }
              : { key: '', label: '', action: ruleDraft.actions[0]?.key || '', pattern: '' },
      };
      rulesView();
      syncTermControls();
    }
    function saveRow(form) {
      guard('edit', form);
      const v = k => form.elements.namedItem(k)?.value.trim() || '',
        r = T.copy(rowEdit.row);
      r.key = v('key');
      r.label = v('label');
      if (!/^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(r.key) || !r.label)
        throw Error('Enter a unique short key and a display name.');
      if (rowEdit.fresh && ruleDraft[rowEdit.kind].some(x => x.key === r.key))
        throw Error('That rule key already exists.');
      if (rowEdit.kind === 'fields') {
        r.kind = v('kind');
        r.target =
          r.kind === 'entity'
            ? v('entityTarget')
            : ['number', 'text'].includes(r.kind)
              ? v('target')
              : '';
        r.aliases = v('aliases')
          .split('\n')
          .map(x => x.trim())
          .filter(Boolean);
        r.values = v('values')
          .split('\n')
          .map(x => x.trim())
          .filter(Boolean)
          .map(line => {
            const [value, label = '', aliases = ''] = line.split('|').map(x => x.trim());
            return {
              value,
              label,
              aliases: aliases
                .split(',')
                .map(x => x.trim())
                .filter(Boolean),
            };
          });
      } else if (rowEdit.kind === 'actions') {
        for (const k of ['type', 'effect', 'quantity', 'counter']) r[k] = v(k);
        r.aliases = v('aliases')
          .split('\n')
          .map(x => x.trim())
          .filter(Boolean);
      } else {
        r.action = v('action');
        r.pattern = v('pattern');
      }
      const list = ruleDraft[rowEdit.kind],
        at = list.findIndex(x => x.key === r.key);
      if (at < 0) list.push(r);
      else list[at] = r;
      rowEdit = null;
      rulesView();
    }
    function saveRules() {
      guard('edit', $('psRules'));
      if (rowEdit) throw Error('Keep or cancel the current row first.');
      T.validateRules(ruleDraft);
      if (JSON.stringify(rules()) !== baseRules)
        throw Error(
          'Sentence rules changed on another save. Reopen the rules before replacing them.'
        );
      const candidate = T.copy(ruleDraft);
      if (
        a.mutate(d => {
          d.workhub.rehearsal.sentenceRules = candidate;
        }) === false
      )
        return;
      baseRules = JSON.stringify(candidate);
      if (session) {
        session.result = null;
        session.fingerprint = '';
        session.choices = {};
        session.filters = {};
      }
      a.tell('Sentence rules saved. Existing processes keep their saved definitions.');
      rulesView();
    }
    document.addEventListener('click', e => {
      const el = e.target.closest?.('[data-ps]');
      if (!el) return;
      e.preventDefault();
      try {
        const op = el.dataset.ps;
        if (op === 'open') return open();
        if (op === 'rules') return openRules();
        if (op === 'use') return use();
        guard(op === 'example' || op === 'back-builder' ? 'create' : 'edit');
        if (op === 'example') {
          session.description = EXAMPLE;
          session.result = null;
          session.choices = {};
          builder();
        } else if (op === 'section') {
          if (rowEdit) throw Error('Keep or cancel the current row first.');
          section = el.dataset.section;
          rulesView();
        } else if (op === 'add') editRow();
        else if (op === 'edit') editRow(el.dataset.key);
        else if (op === 'cancel-row') {
          rowEdit = null;
          rulesView();
        } else if (op === 'remove') {
          const kind = section === 'people' ? 'fields' : section,
            at = ruleDraft[kind].findIndex(x => x.key === el.dataset.key);
          if (at < 0) return;
          lastRemoved = { kind, row: ruleDraft[kind].splice(at, 1)[0], at };
          rulesView();
        } else if (op === 'undo') {
          if (lastRemoved) {
            ruleDraft[lastRemoved.kind].splice(lastRemoved.at, 0, lastRemoved.row);
            lastRemoved = null;
            rulesView();
          }
        } else if (op === 'reload-rules') {
          ruleDraft = T.copy(rules());
          baseRules = JSON.stringify(rules());
          rowEdit = null;
          lastRemoved = null;
          rulesView();
        } else if (op === 'save-rules') saveRules();
        else if (op === 'back-builder') open();
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('input', e => {
      const f = e.target.closest?.('#psBuilderForm');
      if (f && session) {
        try {
          guard('create', f);
          capture(f);
          session.result = null;
          session.choices = {};
          $('psResult').innerHTML =
            '<p class="ps-help">Description changed. Generate a new preview.</p>';
        } catch (err) {
          a.tell(err.message, true);
        }
      }
      if (e.target.dataset.psSearch && session?.result) {
        const key = e.target.dataset.psSearch;
        session.filters[key] = e.target.value;
        const b = session.result.bindings.find(b => b.key === key),
          select = e.target.closest('details').querySelector('select');
        if (b && select) select.innerHTML = matchOptions(b);
      }
    });
    document.addEventListener('change', e => {
      if (e.target.closest?.('#psRuleForm') && e.target.name === 'kind') syncTermControls();
      const key = e.target.dataset.psChoice;
      if (!key || !session) return;
      try {
        guard('create', $('psBuilderForm'));
        session.choices[key] = e.target.value;
        generate();
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener(
      'submit',
      e => {
        if (!['psBuilderForm', 'psRuleForm'].includes(e.target.id)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        try {
          if (e.target.id === 'psBuilderForm') generate(true);
          else saveRow(e.target);
        } catch (err) {
          a.tell(err.message, true);
          if (e.target.id === 'psBuilderForm') {
            $('psResult').textContent = err.message;
            session.result = null;
          }
        }
      },
      true
    );
    return {
      header,
      open,
      openRules,
      sync,
      snapshot: () => ({
        account,
        session: session ? T.copy(session) : null,
        rulesDraft: ruleDraft ? T.copy(ruleDraft) : null,
      }),
      conditionFields,
      readCondition,
    };
  }
  root.WorkHubProcessSentences = { install, conditionFields, readCondition };
})(window);
