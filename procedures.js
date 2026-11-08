/* A quiet written companion to the animated Process Hub. Reading progress is session-only. */
(function (root) {
  'use strict';
  const E = root.WorkHubProceduresEngine;
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const btn = (op, label, attrs = '', cls = '') =>
    `<button type="button" class="${cls}" data-procedure="${op}" ${attrs}>${label}</button>`;
  const tabs = mode =>
    `<nav class="wp-tabs" aria-label="Process Hub sections" data-access-feature="processhub">${btn('tab', 'Animated processes', `data-mode="animated" aria-current="${mode === 'animated' ? 'page' : 'false'}"`)}${btn('tab', 'Written procedures', `data-mode="written" aria-current="${mode === 'written' ? 'page' : 'false'}"`)}</nav>`;
  const field = (name, label, value, max, area = false, attrs = '') =>
    `<label class="wp-field">${label}${area ? `<textarea rows="3" maxlength="${max}" data-wp-field="${name}" ${attrs}>${esc(value)}</textarea>` : `<input maxlength="${max}" data-wp-field="${name}" value="${esc(value)}" ${attrs}>`}</label>`;
  function install(a) {
    let owner = '',
      generation = 0,
      selected = '',
      draft = null,
      base = '',
      start = '',
      query = '',
      category = '',
      archive = false,
      force = false,
      checked = new Set(),
      reviewed = new Set(),
      reviewSource = '',
      undo = null,
      expanded = new Set();
    const $ = id => document.getElementById(id),
      rows = () => E.rows(a.state()),
      can = action => a.can('processhub', action),
      ready = () => a.cloud().ready && !!a.cloud().user?.id;
    const now = () => new Date().toISOString(),
      uid = () =>
        root.crypto?.randomUUID?.() ||
        'procedure-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
    const current = () => rows().find(p => p.id === selected);
    const dirty = () => !!draft && JSON.stringify(draft) !== start;
    function sync() {
      const next = ready() ? a.cloud().user?.id || '' : '';
      if (next !== owner || !can('view')) {
        generation++;
        owner = next;
        selected = '';
        draft = null;
        base = start = query = category = '';
        archive = false;
        checked.clear();
        reviewed.clear();
        undo = null;
        reviewSource = '';
        expanded.clear();
      }
      if (!draft && current() && reviewSource !== JSON.stringify(current())) {
        checked.clear();
        reviewed.clear();
        reviewSource = JSON.stringify(current());
      }
    }
    function guard(action = 'view', token = generation, account = owner) {
      if (
        !ready() ||
        !account ||
        account !== a.cloud().user?.id ||
        token !== generation ||
        !can(action)
      )
        throw Error('Your account or Process Hub permissions changed. Reopen Written procedures.');
    }
    function paint() {
      force = true;
      a.render();
    }
    async function discard() {
      const token = generation,
        account = owner,
        pending = draft,
        fingerprint = JSON.stringify(draft);
      if (
        dirty() &&
        !(await root.WorkHubDialogs.confirm(
          'Discard your unsaved written-procedure changes? Cancel to keep editing.'
        ))
      )
        return false;
      guard('view', token, account);
      if (draft !== pending || JSON.stringify(draft) !== fingerprint)
        throw Error('The draft changed while the confirmation was open. Try again.');
      return true;
    }
    function categories() {
      return [
        ...new Set(
          rows()
            .filter(p => p.archived === archive)
            .map(p => p.procedure.category)
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b));
    }
    function visible() {
      const q = query.toLowerCase().trim();
      return rows()
        .filter(
          p =>
            p.archived === archive &&
            (!category || p.procedure.category === category) &&
            [
              p.name,
              p.description,
              p.procedure.category,
              p.procedure.owner,
              ...p.steps.map(s => s.title),
            ]
              .join(' ')
              .toLowerCase()
              .includes(q)
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    function cards() {
      const list = visible();
      return (
        list
          .map(
            p =>
              `<button type="button" class="wp-card${selected === p.id ? ' is-selected' : ''}" data-procedure="open" data-id="${esc(p.id)}"><span class="wp-card-top"><span class="wp-paper-icon" aria-hidden="true">▤</span><span>${esc(p.procedure.category || 'General procedure')}</span><small>${p.steps.length} steps</small></span><strong>${esc(p.name)}</strong><span class="wp-card-description">${esc(p.description || 'A clear, written guide for the work ahead.')}</span><span class="wp-card-footer"><span>${esc(p.procedure.owner || 'Role not set')}</span><span>Open guide ↗</span></span></button>`
          )
          .join('') ||
        `<div class="wp-empty"><span aria-hidden="true">▤</span><h3>${query || category ? 'No procedures match this view.' : archive ? 'No archived procedures.' : 'Give a familiar process a clear home.'}</h3><p>${query || category ? 'Try another search or category.' : 'Write the steps once, then come back whenever you need them.'}</p>${!archive && can('create') ? btn('new', 'Create a written procedure', '', 'primary') : ''}</div>`
      );
    }
    function library() {
      return `<section class="wp-library"><div class="wp-library-heading"><div><span class="hub-kicker">YOUR PROCEDURE LIBRARY</span><h3>Find the way forward.</h3></div>${btn('archive-view', archive ? 'Show active' : 'Archived procedures', `aria-pressed="${archive}"`)}</div><div class="wp-library-filters"><label>Find a procedure<input id="wpSearch" type="search" placeholder="Name, step, category or responsible role" value="${esc(query)}" maxlength="200"></label><label>Category<select id="wpCategory"><option value="">All categories</option>${categories()
        .map(
          c => `<option value="${esc(c)}"${category === c ? ' selected' : ''}>${esc(c)}</option>`
        )
        .join(
          ''
        )}</select></label><span id="wpCount" role="status">${visible().length} shown</span></div><div id="wpLibraryCards" class="wp-cards">${cards()}</div></section>`;
    }
    function editor() {
      const p = draft,
        m = p.procedure;
      return `<section class="wp-editor" id="wpEditor" data-owner="${esc(owner)}"><div class="wp-editor-heading"><div><span class="hub-kicker">WRITE IT ONCE. MAKE IT CLEAR.</span><h3>${base ? 'Edit written procedure' : 'New written procedure'}</h3></div><div class="actions">${btn('cancel', 'Cancel')}<button type="submit" form="wpProcedureForm" class="primary">Save procedure</button></div></div><form id="wpProcedureForm" data-owner="${esc(owner)}" data-id="${base ? esc(p.id) : ''}"><div class="wp-editor-layout"><aside class="wp-brief"><h4>The essentials</h4>${field('name', 'Procedure name *', p.name, 200, false, 'required placeholder="e.g. How to handle a CR Form"')}${field('description', 'Purpose / overview', p.description, 4000, true)}${field('category', 'Category', m.category, 100)}${field('owner', 'Responsible role / owner', m.owner, 200)}${field('revision', 'Version label', m.revision, 60)}${field('prerequisites', 'Before you begin', m.prerequisites, 4000, true)}<p class="wp-note">Saved to your account when you choose Save procedure. Reading checkmarks stay separate from the saved instructions.</p></aside><div class="wp-steps-editor"><div class="wp-step-list-heading"><h4>Step-by-step instructions</h4><span>${p.steps.length} / ${E.LIMITS.steps} steps</span></div>${p.steps.map((s, i) => `<article class="wp-edit-step" data-wp-step="${esc(s.id)}"><div class="wp-edit-step-heading"><span class="wp-step-number">${i + 1}</span><strong>Step ${i + 1}</strong><div class="actions">${btn('move', '↑', `data-id="${esc(s.id)}" data-direction="-1" aria-label="Move step ${i + 1} up"${i === 0 ? ' disabled' : ''}`)}${btn('move', '↓', `data-id="${esc(s.id)}" data-direction="1" aria-label="Move step ${i + 1} down"${i === p.steps.length - 1 ? ' disabled' : ''}`)}${btn('remove-step', 'Remove', `data-id="${esc(s.id)}"${p.steps.length === 1 ? ' disabled' : ''}`)}</div></div>${field('title', 'Step title *', s.title, 500, false, 'required')}${field('notes', 'What to do', s.notes, 8000, true)}<details class="wp-step-details" data-wp-details="${esc(s.id)}"${expanded.has(s.id) ? ' open' : ''}><summary>Role, outcome, checklist & reference</summary>${field('role', 'Responsible role', s.role, 200)}${field('outcome', 'Expected outcome', s.outcome, 2000, true)}${field('checklist', 'Checklist · one item per line, up to 30', s.checklist.join('\n'), 15000, true)}${field('reference', 'Reference link', s.reference, 2048, false, 'type="url" placeholder="https://…"')}</details></article>`).join('')}<div class="wp-add-step">${btn('add-step', '＋ Add step', p.steps.length >= E.LIMITS.steps ? 'disabled' : '')}</div></div></div><footer class="wp-save-bar"><span id="wpDraftStatus" role="status">${dirty() ? 'Unsaved changes' : 'Draft · choose Save procedure to keep it'}</span><button type="submit" class="primary">Save procedure</button></footer></form></section>`;
    }
    function reader(p) {
      const m = p.procedure,
        complete = p.steps.filter(s => reviewed.has(s.id)).length,
        percent = Math.round((complete / p.steps.length) * 100);
      return `<article class="wp-reader" id="wpReader"><div class="wp-reader-title"><div><span class="hub-kicker">${esc(m.category || 'WRITTEN PROCEDURE')}</span><h3>${esc(p.name)}</h3><p class="wp-purpose">${esc(p.description)}</p></div><span class="wp-version">Version ${esc(m.revision || '—')}</span></div><div class="wp-reader-meta"><span>Responsible role: <strong>${esc(m.owner || 'Not specified')}</strong></span><span>${p.steps.length} steps</span><span>Updated ${esc(p.updatedAt.slice(0, 10))}</span></div><div class="wp-reader-actions actions">${can('edit') ? btn('edit', 'Edit procedure') + btn('archive', p.archived ? 'Restore procedure' : 'Archive') : ''}${can('create') ? btn('duplicate', 'Duplicate') : ''}${can('export') ? btn('download', 'Download Markdown') : ''}${p.archived && can('delete') ? btn('delete', 'Delete archived procedure', '', 'danger') : ''}</div>${m.prerequisites ? `<section class="wp-before"><span aria-hidden="true">✦</span><div><h4>Before you begin</h4><p>${esc(m.prerequisites)}</p></div></section>` : ''}<div class="wp-reading-progress"><div><strong id="wpReadingCount">${complete} of ${p.steps.length} steps reviewed</strong>${btn('reset-progress', 'Reset reading progress')}</div><div class="wp-progress-track"><span id="wpReadingBar" style="width:${percent}%"></span></div><small>Reading progress is for this visit only. It does not change the saved procedure.</small></div><nav class="wp-step-index" aria-label="Procedure steps">${p.steps.map((s, i) => btn('jump', `${i + 1}<span>${esc(s.title)}</span>`, `data-id="${esc(s.id)}"`)).join('')}</nav><ol class="wp-written-steps">${p.steps.map((s, i) => `<li class="wp-written-step${reviewed.has(s.id) ? ' is-reviewed' : ''}" id="wpStep-${esc(s.id)}"><div class="wp-step-number" aria-hidden="true">${i + 1}</div><div class="wp-step-content"><div class="wp-written-step-heading"><h4>${esc(s.title)}</h4>${s.role ? `<span class="wp-role">${esc(s.role)}</span>` : ''}</div>${s.notes ? `<p class="wp-instructions">${esc(s.notes)}</p>` : '<p class="wp-note">No additional instructions maintained.</p>'}${s.checklist.length ? `<div class="wp-checklist"><strong>Check as you go</strong>${s.checklist.map((c, n) => `<label><input type="checkbox" data-wp-check="${esc(s.id)}:${n}"${checked.has(s.id + ':' + n) ? ' checked' : ''}><span>${esc(c)}</span></label>`).join('')}</div>` : ''}${s.outcome ? `<div class="wp-outcome"><span>EXPECTED OUTCOME</span><p>${esc(s.outcome)}</p></div>` : ''}${s.reference ? `<a class="wp-reference" href="${esc(s.reference)}" target="_blank" rel="noopener noreferrer">Open reference ↗</a>` : ''}<label class="wp-reviewed"><input type="checkbox" data-wp-reviewed="${esc(s.id)}"${reviewed.has(s.id) ? ' checked' : ''}><span>I have reviewed this step</span></label></div></li>`).join('')}</ol><div class="wp-end-note"><span aria-hidden="true">✓</span><strong>A clear path, ready when you need it.</strong><span>The instructions stay saved; your reading progress stays personal to this visit.</span></div></article>`;
    }
    function render() {
      sync();
      if (!ready() || !can('view')) return '';
      const p = current();
      return `<section class="wp-room${draft || p ? ' has-workspace' : ''}" id="writtenProcedures" data-access-feature="processhub"><div class="wp-heading"><div><span class="hub-kicker">PROCESS HUB / WRITTEN PROCEDURES</span><h2>${draft || p ? 'Written procedures' : 'Everyday processes. Clearly written.'}</h2><p>A calm, step-by-step home for forms, handovers and the way you work.</p></div><span class="wp-heading-art" aria-hidden="true">▤<i>✦</i></span></div><div class="wp-toolbar"><div>${can('create') ? btn('new', '＋ New procedure', '', 'primary') + btn('example', 'Start with a CR Form example') : ''}</div>${draft ? btn('return-editor', 'Return to draft') : ''}${undo && can('create') ? btn('undo', 'Undo deletion') : ''}</div>${draft ? editor() : (p ? reader(p) : `<div class="wp-welcome"><span class="wp-welcome-number">01 → 02 → 03</span><h3>From a form to a familiar routine.</h3><p>Save clear instructions with roles, checklists and expected outcomes. Choose a procedure below, or start with an editable example.</p></div>`) + library()}</section>`;
    }
    async function open(id, editing = false) {
      sync();
      guard(editing ? 'edit' : 'view');
      if (!(await discard())) return;
      const p = rows().find(p => p.id === id);
      if (!p) throw Error('This written procedure no longer exists.');
      selected = id;
      checked.clear();
      reviewed.clear();
      reviewSource = JSON.stringify(p);
      expanded.clear();
      draft = editing ? E.copy(p) : null;
      base = editing ? JSON.stringify(p) : '';
      start = draft ? JSON.stringify(draft) : '';
      a.selectMode('written');
      a.navigate('processhub');
    }
    async function newDraft(example) {
      guard('create');
      if (!(await discard())) return;
      selected = '';
      base = '';
      expanded.clear();
      const blank = E.create(uid(), uid(), now());
      start = JSON.stringify(blank);
      draft = example ? E.example(blank.id, uid, blank.createdAt) : blank;
      paint();
    }
    function save(form) {
      guard(base ? 'edit' : 'create');
      if (!draft || !form?.isConnected || form.dataset.owner !== owner)
        throw Error('Reopen this procedure editor.');
      const p = E.copy(draft),
        prior = rows().find(r => r.id === p.id);
      if (base ? !prior || JSON.stringify(prior) !== base : !!prior)
        throw Error(
          'This procedure changed on another save. Your draft is kept. Reopen it or download a copy before replacing it.'
        );
      p.updatedAt = now();
      E.validateRecord(p);
      const ok = a.mutate(d => {
        const at = d.workhub.processes.findIndex(r => r.id === p.id);
        if (base) {
          if (JSON.stringify(d.workhub.processes[at]) !== base)
            throw Error('The procedure changed. Reopen it before saving.');
          d.workhub.processes[at] = p;
        } else d.workhub.processes.push(p);
      });
      if (ok === false) return;
      selected = p.id;
      draft = null;
      base = start = '';
      checked.clear();
      reviewed.clear();
      reviewSource = JSON.stringify(p);
      a.tell('Written procedure saved to your account.');
      paint();
    }
    function captureExpanded() {
      expanded = new Set(
        [...document.querySelectorAll('[data-wp-details][open]')].map(el => el.dataset.wpDetails)
      );
    }
    function progress() {
      const p = current();
      if (!p) return;
      const complete = p.steps.filter(s => reviewed.has(s.id)).length;
      if ($('wpReadingCount'))
        $('wpReadingCount').textContent = `${complete} of ${p.steps.length} steps reviewed`;
      if ($('wpReadingBar'))
        $('wpReadingBar').style.width = Math.round((complete / p.steps.length) * 100) + '%';
      for (const s of p.steps)
        $('wpStep-' + s.id)?.classList.toggle('is-reviewed', reviewed.has(s.id));
    }
    async function handle(el) {
      sync();
      guard();
      const op = el.dataset.procedure,
        id = el.dataset.id;
      if (op === 'tab') {
        if (!['animated', 'written'].includes(el.dataset.mode)) return;
        a.selectMode(el.dataset.mode);
        a.navigate('processhub');
        return;
      }
      if (op === 'new' || op === 'example') return newDraft(op === 'example');
      if (op === 'open') return open(id);
      if (op === 'edit') return open(selected, true);
      if (op === 'return-editor') {
        paint();
        return;
      }
      if (op === 'cancel') {
        if (!(await discard())) return;
        draft = null;
        base = start = '';
        paint();
        return;
      }
      if (['add-step', 'remove-step', 'move'].includes(op)) {
        guard(base ? 'edit' : 'create');
        if (!draft) throw Error('Open a procedure draft first.');
        captureExpanded();
        if (op === 'add-step') {
          if (draft.steps.length >= E.LIMITS.steps) throw Error('Use up to 100 steps.');
          draft.steps.push(E.step(uid()));
        } else {
          const i = draft.steps.findIndex(s => s.id === id);
          if (i < 0) return;
          if (op === 'remove-step') {
            if (draft.steps.length <= 1) return;
            const token = generation,
              account = owner;
            if (!(await root.WorkHubDialogs.confirm('Remove this step from the draft?'))) return;
            guard(base ? 'edit' : 'create', token, account);
            draft.steps.splice(i, 1);
          } else {
            const n = i + Number(el.dataset.direction);
            if (Number.isInteger(n) && n >= 0 && n < draft.steps.length)
              [draft.steps[i], draft.steps[n]] = [draft.steps[n], draft.steps[i]];
          }
        }
        paint();
        const fields = [...document.querySelectorAll('[data-wp-field="title"]')];
        (op === 'add-step'
          ? fields.at(-1)
          : fields.find(f => f.closest('[data-wp-step]').dataset.wpStep === id)
        )?.focus();
        return;
      }
      if (op === 'archive-view') {
        archive = !archive;
        category = '';
        paint();
        return;
      }
      if (op === 'reset-progress') {
        reviewed.clear();
        checked.clear();
        document
          .querySelectorAll('[data-wp-reviewed],[data-wp-check]')
          .forEach(el => (el.checked = false));
        progress();
        return;
      }
      if (op === 'jump') {
        const target = $('wpStep-' + id);
        target?.scrollIntoView?.({
          block: 'center',
          behavior:
            a.state().workhub.preferences.motion === 'off' ||
            root.matchMedia?.('(prefers-reduced-motion: reduce)').matches
              ? 'instant'
              : 'smooth',
        });
        if (target) {
          target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
        return;
      }
      if (op === 'undo') {
        guard('create');
        if (!undo || a.state().workhub.processes.some(p => p.id === undo.id))
          throw Error('This procedure cannot be restored here.');
        const record = E.copy(undo);
        if (a.mutate(d => d.workhub.processes.push(record)) !== false) {
          undo = null;
          selected = record.id;
          archive = record.archived;
          paint();
        }
        return;
      }
      const p = current();
      if (!p) throw Error('Choose a saved procedure first.');
      if (op === 'download') {
        guard('export');
        a.download(
          E.markdown(p),
          (p.name.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 70) || 'procedure') + '.md',
          'text/markdown;charset=utf-8',
          'processhub'
        );
        return;
      }
      if (op === 'duplicate') {
        guard('create');
        const copy = E.copy(p);
        copy.id = uid();
        copy.name = p.name.slice(0, 190) + ' (copy)';
        copy.steps.forEach(s => (s.id = uid()));
        copy.createdAt = copy.updatedAt = now();
        if (a.mutate(d => d.workhub.processes.push(copy)) !== false) {
          selected = copy.id;
          archive = copy.archived;
          paint();
        }
        return;
      }
      if (op === 'archive') {
        guard('edit');
        const fingerprint = JSON.stringify(p);
        if (
          a.mutate(d => {
            const row = d.workhub.processes.find(r => r.id === p.id);
            if (JSON.stringify(row) !== fingerprint)
              throw Error('The procedure changed. Reopen it.');
            row.archived = !row.archived;
            row.updatedAt = now();
          }) !== false
        ) {
          selected = '';
          paint();
        }
        return;
      }
      if (op === 'delete') {
        guard('delete');
        if (!p.archived) throw Error('Archive the procedure before deleting it.');
        const token = generation,
          account = owner,
          fingerprint = JSON.stringify(p);
        if (
          !(await root.WorkHubDialogs.confirm(
            'Delete this archived written procedure? You can undo the deletion here during this visit.'
          ))
        )
          return;
        guard('delete', token, account);
        if (JSON.stringify(current()) !== fingerprint)
          throw Error('The procedure changed. Reopen it.');
        if (
          a.mutate(d => (d.workhub.processes = d.workhub.processes.filter(r => r.id !== p.id))) !==
          false
        ) {
          undo = E.copy(p);
          selected = '';
          paint();
        }
      }
    }
    document.addEventListener('click', e => {
      const el = e.target.closest?.('[data-procedure]');
      if (!el || el.disabled) return;
      e.preventDefault();
      void handle(el).catch(error => a.tell(error.message, true));
    });
    document.addEventListener('input', e => {
      const el = e.target;
      if (el.id === 'wpSearch') {
        query = el.value;
        if ($('wpLibraryCards')) $('wpLibraryCards').innerHTML = cards();
        if ($('wpCount')) $('wpCount').textContent = visible().length + ' shown';
        return;
      }
      if (
        !el.matches?.('[data-wp-field]') ||
        !draft ||
        el.closest('#wpEditor')?.dataset.owner !== owner
      )
        return;
      try {
        guard(base ? 'edit' : 'create');
        const stepId = el.closest('[data-wp-step]')?.dataset.wpStep,
          key = el.dataset.wpField;
        if (stepId) {
          const s = draft.steps.find(s => s.id === stepId);
          if (!s) return;
          if (key === 'checklist')
            s.checklist = el.value
              .split(/\r?\n/)
              .map(x => x.trim())
              .filter(Boolean);
          else if (['title', 'notes', 'role', 'outcome', 'reference'].includes(key))
            s[key] = el.value;
        } else if (['name', 'description'].includes(key)) draft[key] = el.value;
        else if (['category', 'owner', 'revision', 'prerequisites'].includes(key))
          draft.procedure[key] = el.value;
        if ($('wpDraftStatus'))
          $('wpDraftStatus').textContent = dirty()
            ? 'Unsaved changes'
            : 'Draft · choose Save procedure to keep it';
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('change', e => {
      if (e.target.id === 'wpCategory') {
        category = e.target.value;
        if ($('wpLibraryCards')) $('wpLibraryCards').innerHTML = cards();
        if ($('wpCount')) $('wpCount').textContent = visible().length + ' shown';
        return;
      }
      if (!e.target.matches?.('[data-wp-reviewed],[data-wp-check]')) return;
      try {
        guard();
        const isReviewed = e.target.dataset.wpReviewed !== undefined,
          set = isReviewed ? reviewed : checked,
          value = isReviewed ? e.target.dataset.wpReviewed : e.target.dataset.wpCheck;
        if (e.target.checked) set.add(value);
        else set.delete(value);
        progress();
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener(
      'submit',
      e => {
        if (e.target.id !== 'wpProcedureForm') return;
        e.preventDefault();
        e.stopImmediatePropagation();
        try {
          save(e.target);
        } catch (error) {
          a.tell(error.message, true);
        }
      },
      true
    );
    root.addEventListener('beforeunload', e => {
      if (ready() && dirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
    return {
      render,
      open,
      handle,
      save,
      sync,
      hasDraft: () => !!draft,
      patchRender() {
        sync();
        return a.active() && !!$('wpEditor') && !!draft && !force;
      },
      mount() {
        sync();
        force = false;
      },
      snapshot: () => ({
        owner,
        selected,
        draft: draft ? E.copy(draft) : null,
        dirty: dirty(),
        reviewed: [...reviewed],
        checked: [...checked],
      }),
    };
  }
  root.WorkHubProcedures = { install, tabs };
})(window);
