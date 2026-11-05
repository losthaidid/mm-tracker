/* Selected work -> frozen preview -> local PDF or private Google Drive file. */
(function (root) {
  'use strict';
  const E = root.WorkHubHandoverEngine;
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (op, label, extra = '') =>
    `<button type="button" data-ho="${op}" ${extra}>${label}</button>`;
  function install(a) {
    let owner = '',
      generation = 0,
      selected = new Set(),
      pack = null,
      blob = null,
      fileUrl = '',
      query = '',
      kind = '',
      project = '',
      completed = false,
      page = 0,
      previewPage = 0,
      busy = false,
      message = '',
      error = false;
    let options = defaults();
    function defaults() {
      return {
        title: 'Handover pack',
        from: '',
        to: '',
        summary: '',
        notes: true,
        feedback: true,
        nextSteps: true,
        references: true,
      };
    }
    const can = (feature, action = 'view') => a.can(feature, action);
    function sync() {
      const next = a.ready() ? a.owner() : '';
      if (owner !== next || generation !== a.generation()) {
        owner = next;
        generation = a.generation();
        selected = new Set();
        pack = blob = null;
        if (fileUrl) URL.revokeObjectURL(fileUrl);
        fileUrl = '';
        query = kind = project = message = '';
        options = defaults();
        completed = busy = error = false;
        page = previewPage = 0;
      }
      if (pack && !E.allowed(pack, can)) {
        pack = blob = null;
        if (fileUrl) URL.revokeObjectURL(fileUrl);
        fileUrl = '';
        message = 'Source export access changed. Choose the available records and preview again.';
      }
    }
    function guard(action = 'view') {
      sync();
      if (!a.ready() || !owner || !can('handover', action))
        throw Error('This Handover action is not available for your account.');
    }
    const records = () => E.collect(a.state(), can);
    const filtered = rows =>
      rows.filter(
        r =>
          (completed || r.open) &&
          (!kind || r.kind === kind) &&
          (!project || r.projectId === project) &&
          [
            r.title,
            r.identifier,
            r.parent?.title,
            r.parent?.identifier,
            r.project,
            r.owner,
            r.status,
          ]
            .join(' ')
            .toLowerCase()
            .includes(query.toLowerCase())
      );
    function render() {
      sync();
      const all = records(),
        available = new Set(all.map(r => r.key));
      selected = new Set([...selected].filter(k => available.has(k)));
      const rows = filtered(all),
        visible = rows.slice(page * 50, page * 50 + 50),
        count = selected.size;
      if (page > 0 && !visible.length) {
        page = 0;
        return render();
      }
      const projects = can('specs') ? a.state().projects || [] : [];
      const history = can('files')
        ? (a.state().workhub.driveFiles?.files || [])
            .filter(f => f.sourceType === 'handover')
            .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
            .slice(0, 5)
        : [];
      return `<section class="df-room ho-room"><header class="df-hero ho-hero"><div><span class="hub-kicker">A CLEAR NEXT CHAPTER</span><h2>Leave the work in good hands.</h2><p>Choose the records that matter. Add context, review a dated snapshot, and take a Handover pack with you.</p></div><div class="df-hero-symbol" aria-hidden="true">▥<span>✓</span></div></header><div class="ho-workflow"><span class="${!pack ? 'current' : ''}"><b>1</b> Choose work</span><span class="${pack ? 'current' : ''}"><b>2</b> Preview snapshot</span><span><b>3</b> Download or share</span></div><div class="ho-layout"><section class="df-panel"><div class="df-bar"><div><h3>Build your pack</h3><p class="muted">Tasks, tickets, project items and follow-ups. Sub-items keep their parent reference.</p></div><span class="df-badge">${count} selected / 500</span></div><div class="ho-details"><label>Pack title<input data-ho-field="title" value="${esc(options.title)}" maxlength="200"></label><label>From<input data-ho-field="from" value="${esc(options.from)}" maxlength="200" placeholder="Your name / team"></label><label>To<input data-ho-field="to" value="${esc(options.to)}" maxlength="200" placeholder="Next owner / team"></label><label class="ho-wide">Handover note<textarea data-ho-field="summary" maxlength="10000" rows="3" placeholder="What should the next person know first?">${esc(options.summary)}</textarea></label></div><div class="ho-include">${[
        ['notes', 'Notes'],
        ['feedback', 'Feedback / latest ticket update'],
        ['nextSteps', 'Next steps & blockers'],
        ['references', 'References'],
      ]
        .map(
          ([k, label]) =>
            `<label class="df-check"><input type="checkbox" data-ho-field="${k}" ${options[k] ? 'checked' : ''}>${label}</label>`
        )
        .join(
          ''
        )}</div><div class="df-filters"><label>Search work<input type="search" data-ho-filter="query" value="${esc(query)}" placeholder="Title, number or owner"></label><label>Source<select data-ho-filter="kind"><option value="">All sources</option>${E.kinds
        .filter(k => can(k, 'export'))
        .map(k => `<option value="${k}"${kind === k ? ' selected' : ''}>${E.labels[k]}</option>`)
        .join(
          ''
        )}</select></label>${projects.length ? `<label>Project<select data-ho-filter="project"><option value="">All projects</option>${projects.map(p => `<option value="${esc(p.id)}"${p.id === project ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}<label class="df-check"><input type="checkbox" data-ho-filter="completed"${completed ? ' checked' : ''}>Include completed</label></div><div class="actions ho-select">${button('select-filtered', 'Select all filtered', busy ? 'disabled' : '')}${button('clear', 'Clear selection', busy ? 'disabled' : '')}<small>${rows.length} available · only sources you may export are shown</small></div>${rows.length ? `<div class="ho-records">${visible.map(r => `<label class="ho-record${r.childId ? ' ho-child' : ''}"><input type="checkbox" data-ho-record="${esc(r.key)}" ${selected.has(r.key) ? 'checked' : ''} ${busy ? 'disabled' : ''}><span><small>${E.labels[r.kind]}${r.childId ? ' · Sub-item' : ''}${r.project ? ' / ' + esc(r.project) : ''}</small><strong>${esc([r.identifier, r.title].filter(Boolean).join(' · '))}</strong>${r.parent ? `<small>Under ${esc([r.parent.identifier, r.parent.title].filter(Boolean).join(' · '))}</small>` : ''}<small>${esc([r.status, r.owner, r.due ? 'Due ' + r.due : ''].filter(Boolean).join(' · '))}</small></span></label>`).join('')}</div><div class="df-pagination">${button('prev', 'Previous', page === 0 || busy ? 'disabled' : '')}<span>Page ${page + 1} of ${Math.ceil(rows.length / 50)}</span>${button('next', 'Next', (page + 1) * 50 >= rows.length || busy ? 'disabled' : '')}</div>` : '<div class="df-empty"><h3>No matching unfinished work</h3><p>Try another filter or include completed work.</p></div>'}<div class="modal-actions">${button('preview', 'Preview Handover pack', `class="primary" ${!count || busy || !can('handover', 'export') ? 'disabled' : ''}`)}</div></section><aside class="ho-aside"><section class="df-panel ho-ready"><span class="df-badge">YOUR SNAPSHOT</span><h3>${pack ? 'Ready to pass on.' : 'A useful handover starts with context.'}</h3><p>${pack ? `${pack.records.length} records captured ${esc(new Date(pack.createdAt).toLocaleString())}.` : 'Keep open work, the latest feedback and the next action together in one readable PDF.'}</p><p class="muted">Preview captures a fixed copy. Later edits to live work do not change an exported file. Create a fresh preview for an updated pack.</p>${pack ? `<div class="actions">${fileUrl ? `<a class="ph-download-link" href="${esc(fileUrl)}" download="${esc(E.filename(pack))}" data-ho-file>Download PDF</a>` : button('download', 'Prepare PDF', `class="primary" ${busy ? 'disabled' : ''}`)}${can('files', 'create') && can('files', 'export') ? button('drive', 'Save to Drive & QR', busy ? 'disabled' : '') : ''}</div>` : ''}<p id="hoStatus" role="status" class="${error ? 'df-error' : ''}">${esc(message)}</p></section>${history.length ? `<section class="df-panel"><h3>Recent saved packs</h3><p class="muted">Each file is a separate dated snapshot.</p>${history.map(f => `<div class="ho-history"><strong>${esc(f.name)}</strong><small>${esc(new Date(f.createdAt).toLocaleString())}</small>${can('files', 'export') ? `<button type="button" data-df="file" data-id="${esc(f.id)}">Download / QR</button>` : ''}</div>`).join('')}</section>` : ''}</aside></div>${pack ? previewHTML() : ''}</section>`;
    }
    function previewHTML() {
      previewPage = Math.min(previewPage, Math.max(0, Math.ceil(pack.records.length / 25) - 1));
      return `<section class="df-panel ho-preview" id="hoPreview"><div class="df-bar"><div><span class="hub-kicker">DATED PREVIEW</span><h3>${esc(pack.title)}</h3><p>${esc([pack.from && 'From ' + pack.from, pack.to && 'To ' + pack.to].filter(Boolean).join(' → '))}</p></div><span class="df-badge">${pack.records.length} records</span></div>${pack.summary ? `<p class="ho-preserve">${esc(pack.summary)}</p>` : ''}${pack.records
        .slice(previewPage * 25, previewPage * 25 + 25)
        .map(
          r =>
            `<article class="ho-preview-record"><small>${E.labels[r.kind]}${r.childId ? ' · Sub-item' : ''} · ${esc(r.id)}${r.childId ? ' / ' + esc(r.childId) : ''}</small><h4>${esc([r.identifier, r.title].filter(Boolean).join(' · '))}</h4>${r.parent ? `<p>Parent: ${esc([r.parent.identifier, r.parent.title].filter(Boolean).join(' · '))}</p>` : ''}<p>${esc([r.status, r.priority, r.owner, r.project, r.due ? 'Due ' + r.due : '', r.expected ? 'Expected ' + r.expected : ''].filter(Boolean).join(' · '))}</p>${[
              ['Notes', r.notes],
              [r.kind === 'tickets' ? 'Latest ticket update' : 'Feedback', r.feedback],
              ['Next step', r.nextStep],
              ['Blocker', r.blocker],
            ]
              .filter(([, v]) => v)
              .map(
                ([k, v]) => `<div><strong>${k}</strong><p class="ho-preserve">${esc(v)}</p></div>`
              )
              .join(
                ''
              )}${r.references.map(f => `<p class="ho-preserve"><strong>Reference · ${esc(f.label)}</strong>${f.url ? '<br>' + esc(f.url) : ''}</p>`).join('')}</article>`
        )
        .join(
          ''
        )}<div class="df-pagination">${button('preview-prev', 'Previous records', previewPage === 0 || busy ? 'disabled' : '')}<span>Preview ${previewPage + 1} / ${Math.ceil(pack.records.length / 25)}</span>${button('preview-next', 'Next records', (previewPage + 1) * 25 >= pack.records.length || busy ? 'disabled' : '')}</div></section>`;
    }
    function invalidate() {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      fileUrl = '';
      pack = blob = null;
      message = '';
    }
    async function handle(el) {
      guard();
      if (busy) return;
      const op = el.dataset.ho;
      if (op === 'prev' || op === 'next') {
        page += op === 'next' ? 1 : -1;
        a.render();
        return;
      }
      if (op === 'preview-prev' || op === 'preview-next') {
        previewPage += op === 'preview-next' ? 1 : -1;
        a.render();
        document.getElementById('hoPreview')?.scrollIntoView?.({ block: 'start' });
        return;
      }
      if (op === 'select-filtered') {
        const rows = filtered(records()),
          next = new Set([...selected, ...rows.map(r => r.key)]);
        if (next.size > E.MAX_RECORDS)
          throw Error(
            'There are more than 500 records in this selection. Narrow the filters before selecting all.'
          );
        selected = next;
        invalidate();
        a.render();
        return;
      }
      if (op === 'clear') {
        selected.clear();
        invalidate();
        a.render();
        return;
      }
      if (op === 'preview') {
        guard('export');
        if (fileUrl) URL.revokeObjectURL(fileUrl);
        fileUrl = '';
        pack = E.snapshot(a.state(), selected, options, can);
        blob = null;
        previewPage = 0;
        message = 'Snapshot captured. Review the records below before exporting.';
        error = false;
        a.render();
        document.getElementById('hoPreview')?.scrollIntoView?.({ block: 'start' });
        return;
      }
      if (!['download', 'drive'].includes(op)) return;
      guard('export');
      if (!E.allowed(pack, can)) throw Error('Create a permitted preview before exporting.');
      const captured = pack,
        identity = owner,
        g = generation;
      const alive = () =>
        a.ready() &&
        a.owner() === identity &&
        a.generation() === g &&
        captured === pack &&
        E.allowed(captured, can);
      busy = true;
      error = false;
      message = blob ? 'Preparing your file…' : 'Preparing PDF pages…';
      a.render();
      try {
        if (!blob) {
          const prepared = await root.WorkHubHandoverFiles.pdf(captured, { alive });
          if (!alive())
            throw Error('The account, selection or export permissions changed. Preview again.');
          blob = prepared;
        }
        if (!alive())
          throw Error('The account, selection or export permissions changed. Preview again.');
        if (op === 'download') {
          if (!fileUrl) fileUrl = URL.createObjectURL(blob);
          message = 'Your PDF is ready. Select Download PDF to save this snapshot.';
        } else {
          await a.saveDriveFile({
            blob,
            name: E.filename(captured),
            sourceType: 'handover',
            allowed: alive,
          });
          if (alive())
            message = 'Saved in Google Drive. Download and QR controls are available in Files.';
        }
      } catch (e) {
        if (a.owner() === identity && a.generation() === g) {
          message = e.message;
          error = true;
          a.tell(e.message, true);
        }
      } finally {
        if (a.owner() === identity && a.generation() === g) {
          busy = false;
          a.render();
        }
      }
    }
    document.addEventListener('click', e => {
      if (e.target.closest('[data-ho-file]')) {
        try {
          guard('export');
          if (!E.allowed(pack, can) || !fileUrl) throw Error('Preview and prepare the PDF again.');
        } catch (err) {
          e.preventDefault();
          a.tell(err.message, true);
        }
        return;
      }
      const el = e.target.closest('[data-ho]');
      if (!el || el.disabled) return;
      e.preventDefault();
      void handle(el).catch(e => a.tell(e.message, true));
    });
    document.addEventListener('input', e => {
      const k = e.target.dataset.hoField;
      if (!k || e.target.type === 'checkbox') return;
      options[k] = e.target.value;
      invalidate();
      // Leave the editing control in place; update the stale preview on blur/change.
      document
        .querySelectorAll('[data-ho="download"],[data-ho="drive"]')
        .forEach(b => (b.disabled = true));
      document.querySelector('[data-ho-file]')?.remove();
      const p = document.getElementById('hoPreview');
      if (p) p.remove();
    });
    document.addEventListener('change', e => {
      if (!e.target.matches('[data-ho-record],[data-ho-field],[data-ho-filter]')) return;
      try {
        guard();
        if (busy) return;
        if (e.target.hasAttribute('data-ho-record')) {
          const key = e.target.dataset.hoRecord;
          if (e.target.checked && selected.size >= E.MAX_RECORDS) {
            e.target.checked = false;
            throw Error('Choose up to 500 records per pack.');
          }
          e.target.checked ? selected.add(key) : selected.delete(key);
          invalidate();
          a.render();
        } else if (e.target.dataset.hoField) {
          const k = e.target.dataset.hoField;
          options[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
          invalidate();
          a.render();
        } else if (e.target.dataset.hoFilter) {
          const k = e.target.dataset.hoFilter;
          if (k === 'query') query = e.target.value;
          else if (k === 'kind') kind = e.target.value;
          else if (k === 'project') project = e.target.value;
          else completed = e.target.checked;
          page = 0;
          a.render();
        }
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    return { render, sync, handle, snapshot: () => pack };
  }
  root.WorkHubHandover = { install };
})(globalThis);
