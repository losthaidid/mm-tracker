/** A spacious personal notebook. Editor DOM stays mounted while autosave uses app.mutate. */
(function (root) {
  'use strict';
  const E = root.WorkHubNotesEngine;
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const paths = {
    book: 'M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm2 0v18M9 8h7M9 12h5',
    pen: 'm16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5',
    pin: 'm8 3 8 0-1 5 4 4H5l4-4-1-5Zm4 9v9',
    spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z',
    arrow: 'M4 12h16m-6-6 6 6-6 6',
    trash: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',
  };
  const icon = (name, cls = '') =>
    '<svg class="nt-icon ' +
    cls +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
    (paths[name] || paths.book) +
    '"/></svg>';
  const btn = (action, label, extra = '', cls = '') =>
    '<button type="button" class="nt-button ' +
    cls +
    '" data-nt="' +
    action +
    '" ' +
    extra +
    '>' +
    label +
    '</button>';
  const options = (rows, selected, blank) =>
    '<option value="">' +
    esc(blank) +
    '</option>' +
    rows
      .map(
        r =>
          '<option value="' +
          esc(r.id) +
          '"' +
          (selected === r.id ? ' selected' : '') +
          '>' +
          esc(r.name || r.title || r.ticket) +
          '</option>'
      )
      .join('');
  function install(a) {
    const $ = id => document.getElementById(id);
    let owner = '',
      query = '',
      notebookId = '',
      filter = 'all',
      sort = 'updated',
      editor = null,
      timer = 0,
      signature = '',
      returnFocus = null;
    const store = () => E.store(a.state());
    const allowed = () => a.ready() && !!a.owner();
    function sync() {
      const next = allowed() ? a.owner() : '';
      if (next !== owner) {
        clearTimeout(timer);
        $('notesRoom')?.remove();
        if ($('ntBookForm')) a.closeModal();
        editor = null;
        owner = next;
        query = notebookId = signature = '';
        filter = 'all';
        sort = 'updated';
      }
      return !!owner;
    }
    function guard() {
      if (!sync()) throw Error('Sign in to open your notes.');
    }
    function date(value) {
      return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    }
    function art() {
      return (
        '<div class="nt-art" aria-hidden="true"><span class="nt-art-orbit"></span><span class="nt-art-spark nt-art-spark-a">✧</span><span class="nt-art-spark nt-art-spark-b">✦</span><div class="nt-art-book"><i></i><i></i><i></i>' +
        icon('pen') +
        '</div></div>'
      );
    }
    function cards() {
      const rows = E.find(a.state(), { query, notebookId, filter, sort });
      if (!rows.length)
        return (
          '<div class="nt-empty">' +
          icon(filter === 'trash' ? 'trash' : 'book') +
          '<h3>' +
          (query
            ? 'No notes match that search.'
            : filter === 'trash'
              ? 'Your Trash is empty.'
              : filter === 'pinned'
                ? 'Keep something close.'
                : 'A little space for your next idea.') +
          '</h3><p>' +
          (query
            ? 'Try a different word or notebook.'
            : filter === 'trash'
              ? 'Notes moved here can be restored whenever you need them.'
              : filter === 'pinned'
                ? 'Pin a note to find it here.'
                : 'Capture a thought, a meeting or something worth remembering.') +
          '</p>' +
          (filter === 'all' && !query
            ? btn('new', 'Write your first note', '', 'nt-primary')
            : '') +
          '</div>'
        );
      return rows
        .map((n, i) => {
          const book = store().notebooks.find(b => b.id === n.notebookId)?.name || 'Loose pages',
            project = a.state().projects.find(p => p.id === n.projectId);
          return (
            '<article class="nt-card" data-note-card="' +
            esc(n.id) +
            '" style="--nt-order:' +
            Math.min(i, 8) +
            '"><div class="nt-card-top"><span class="nt-eyebrow">' +
            icon('book') +
            esc(book) +
            '</span>' +
            (!n.trashed
              ? btn(
                  'pin',
                  icon('pin'),
                  'data-id="' +
                    esc(n.id) +
                    '" aria-label="' +
                    (n.pinned ? 'Unpin' : 'Pin') +
                    ': ' +
                    esc(n.title) +
                    '" aria-pressed="' +
                    n.pinned +
                    '"',
                  'nt-icon-button'
                )
              : icon('trash')) +
            '</div><button type="button" class="nt-card-open" data-nt="open" data-id="' +
            esc(n.id) +
            '"><h3 class="hub-sensitive">' +
            esc(n.title) +
            '</h3><p class="hub-sensitive">' +
            esc(
              n.body.replace(/[#*`\[\]]/g, '').slice(0, 160) || 'A fresh page, ready when you are.'
            ) +
            '</p></button><div class="nt-card-tags hub-sensitive">' +
            n.tags
              .split(',')
              .map(t => t.trim())
              .filter(Boolean)
              .slice(0, 3)
              .map(t => '<span>' + esc(t) + '</span>')
              .join('') +
            (project ? '<span>' + esc(project.name) + '</span>' : '') +
            '</div><div class="nt-card-foot"><small>Edited ' +
            esc(date(n.updatedAt)) +
            '</small>' +
            (n.trashed
              ? btn('restore', '↶ Restore', 'data-id="' + esc(n.id) + '"')
              : btn(
                  'open',
                  'Open note ' + icon('arrow'),
                  'data-id="' + esc(n.id) + '"',
                  'nt-quiet'
                )) +
            '</div></article>'
          );
        })
        .join('');
    }
    function render() {
      sync();
      return (
        '<section class="nt-workspace" data-nt-owner="' +
        esc(owner) +
        '"><div class="nt-hero"><div><span class="nt-eyebrow">A LITTLE ROOM FOR YOUR THOUGHTS</span><h2>Your notes.<br><em>Ideas worth keeping.</em></h2><p>Catch a thought. Give it a home. Pick it up when you’re ready.</p><div class="nt-actions">' +
        btn('new', icon('pen') + ' New note', '', 'nt-primary') +
        btn('meeting', 'Meeting note') +
        btn('book-new', '+ Notebook') +
        '</div></div>' +
        art() +
        '</div><div class="nt-library-bar"><div class="nt-tabs" role="group" aria-label="Show notes">' +
        [
          ['all', 'All notes'],
          ['pinned', 'Pinned'],
          ['trash', 'Trash'],
        ]
          .map(([id, label]) =>
            btn(
              'filter',
              label + ' <span data-nt-count="' + id + '"></span>',
              'data-filter="' + id + '" aria-pressed="' + (filter === id) + '"'
            )
          )
          .join('') +
        '</div><span class="nt-library-hint">Your thoughts, in one place</span></div><div class="nt-filters"><label class="nt-search"><span class="nt-sr-only">Search notes</span><input id="ntSearch" type="search" placeholder="Search your notes…" value="' +
        esc(query) +
        '"></label><label><span class="nt-sr-only">Notebook</span><select id="ntNotebook" aria-label="Filter by notebook">' +
        options(store().notebooks, notebookId, 'All notebooks') +
        '</select></label>' +
        btn(
          'book-edit',
          'Rename notebook',
          'id="ntRename"' + (!notebookId ? ' hidden' : ''),
          'nt-quiet'
        ) +
        '<label><span class="nt-sr-only">Sort notes</span><select id="ntSort" aria-label="Sort notes"><option value="updated">Recently edited</option><option value="title"' +
        (sort === 'title' ? ' selected' : '') +
        '>Title A–Z</option></select></label></div><div class="nt-results" aria-live="polite">' +
        cards() +
        '</div><p class="nt-footnote">Notes save with your private workspace. Knowledge remains your reference library.</p></section>'
      );
    }
    function paintList(force = false) {
      const page = document.querySelector('.nt-workspace');
      if (!page || page.dataset.ntOwner !== owner || !allowed()) return;
      if (notebookId && !store().notebooks.some(b => b.id === notebookId)) notebookId = '';
      const sig = JSON.stringify([
        store(),
        query,
        notebookId,
        filter,
        sort,
        a.state().projects.map(p => [p.id, p.name]),
      ]);
      if (!force && sig === signature) return;
      signature = sig;
      page.querySelector('.nt-results').innerHTML = cards();
      for (const el of page.querySelectorAll('[data-nt-count]'))
        el.textContent = store().notes.filter(n =>
          el.dataset.ntCount === 'trash'
            ? n.trashed
            : !n.trashed && (el.dataset.ntCount !== 'pinned' || n.pinned)
        ).length;
      for (const el of page.querySelectorAll('[data-filter]'))
        el.setAttribute('aria-pressed', String(el.dataset.filter === filter));
      const select = $('ntNotebook'),
        markup = options(store().notebooks, notebookId, 'All notebooks');
      if (select.innerHTML !== markup) select.innerHTML = markup;
      $('ntRename').hidden = !notebookId;
    }
    function patchRender() {
      if (!sync()) return false;
      const page = document.querySelector('.nt-workspace');
      if (!page || page.dataset.ntOwner !== owner) return false;
      paintList();
      return true;
    }
    function status(message, error = false) {
      const node = $('ntSaveStatus');
      if (node) {
        if (node.textContent !== message) node.textContent = message;
        node.dataset.error = String(error);
      }
    }
    function saveStatus() {
      if (!editor || editor.dirty || editor.error) return;
      if (!editor.base) {
        status('Your note saves as you write');
        return;
      }
      const c = a.cloud?.();
      status(
        c?.conflict
          ? 'Sync needs review · see Settings'
          : c?.error
            ? 'Saved on device · upload needs attention'
            : c?.pending || c?.inFlight
              ? 'Saved on device · syncing…'
              : 'All changes saved'
      );
    }
    function read() {
      const f = $('ntEditorForm');
      if (!editor || !f) return;
      for (const k of ['title', 'body', 'tags', 'notebookId', 'projectId', 'ticketId'])
        editor.draft[k] = f.elements.namedItem(k).value;
      editor.draft.companyIds = [...f.querySelectorAll('[name="companyIds"]:checked')].map(
        x => x.value
      );
    }
    function history() {
      const list = $('ntHistory');
      if (list && editor)
        list.innerHTML =
          editor.draft.history
            .map(
              v =>
                '<li><span>' +
                esc(new Date(v.at).toLocaleString()) +
                '</span>' +
                btn('history', 'Restore text', 'data-id="' + esc(v.id) + '"') +
                '</li>'
            )
            .join('') || '<li>Earlier text versions appear here as you continue editing.</li>';
    }
    function flush() {
      clearTimeout(timer);
      if (!sync() || !editor) return false;
      read();
      if (!editor.dirty) {
        saveStatus();
        return true;
      }
      if (!editor.base && !editor.draft.title.trim() && !editor.draft.body.trim()) return true;
      try {
        const expected = editor.base && E.copy(editor.base),
          draft = E.copy(editor.draft);
        let saved;
        const ok = a.mutate(d => {
          saved = E.copy(E.put(d, draft, expected));
        });
        if (!ok)
          throw Error('Your note could not be saved. Keep this page open or export your draft.');
        editor.base = saved;
        editor.draft = E.copy(saved);
        editor.dirty = false;
        editor.error = '';
        $('ntSaveCopy').hidden = true;
        history();
        saveStatus();
        return true;
      } catch (err) {
        editor.error = err.message;
        status(err.message, true);
        $('ntSaveCopy').hidden = !/changed elsewhere/.test(err.message);
        return false;
      }
    }
    function dirty() {
      if (!sync() || !editor) return;
      editor.dirty = true;
      editor.error = '';
      status('Saving your thought…');
      clearTimeout(timer);
      timer = setTimeout(flush, 1100);
      const words = $('ntWords');
      if (words)
        words.textContent = ($('ntBody').value.trim().match(/\S+/g) || []).length + ' words';
    }
    function companyFields() {
      const projectId = $('ntProject').value,
        selected = new Set(editor.draft.companyIds),
        companies = (a.state().projectCompanies || []).filter(
          c => c.projectId === projectId && (c.active !== false || selected.has(c.id))
        );
      $('ntCompanies').innerHTML = projectId
        ? '<span class="nt-field-label">Companies</span><div class="nt-company-list">' +
          (companies
            .map(
              c =>
                '<label><input type="checkbox" name="companyIds" value="' +
                esc(c.id) +
                '"' +
                (selected.has(c.id) ? ' checked' : '') +
                '><span>' +
                esc(c.name) +
                (c.active === false ? ' (inactive)' : '') +
                '</span></label>'
            )
            .join('') || '<small>No companies maintained for this project.</small>') +
          '</div>'
        : '';
    }
    function open(id = '', template = '') {
      guard();
      if (editor && !close()) return;
      const existing = id ? store().notes.find(n => n.id === id) : null;
      if (id && !existing) throw Error('This note no longer exists.');
      if (existing?.trashed) {
        a.tell('Restore this note from Trash before editing.');
        return;
      }
      const draft = existing ? E.copy(existing) : E.create(notebookId);
      if (template === 'meeting') {
        draft.title = 'Meeting · ' + date(new Date().toISOString());
        draft.body =
          '# Meeting notes\n\n## Discussion\n\n\n## Decisions\n\n\n## Action items\n- [ ] ';
      }
      returnFocus = document.activeElement;
      editor = {
        draft,
        base: existing ? E.copy(existing) : null,
        dirty: template === 'meeting',
        error: '',
        owner,
      };
      const room = document.createElement('dialog');
      room.id = 'notesRoom';
      room.className = 'nt-room';
      room.setAttribute('aria-labelledby', 'ntRoomTitle');
      room.innerHTML =
        '<form id="ntEditorForm" autocomplete="off"><div class="nt-room-bar"><div class="nt-room-identity">' +
        icon('book') +
        '<span id="ntRoomTitle">A page of your own</span></div><div class="nt-actions">' +
        btn('focus', '⤢ Focus view', 'aria-pressed="false"') +
        btn('close', '✕', 'aria-label="Save and close note"') +
        '</div></div><div class="nt-editor-scroll"><div class="nt-writing-page"><div class="nt-page-meta"><span class="nt-eyebrow">MAKE ROOM FOR A THOUGHT</span><span id="ntSaveStatus" role="status" aria-live="polite">' +
        (existing ? 'All changes saved' : 'Your note saves as you write') +
        '</span></div><label class="nt-sr-only" for="ntTitle">Note title</label><input id="ntTitle" name="title" class="nt-title hub-sensitive" maxlength="180" placeholder="Give your thought a title…" value="' +
        esc(draft.title) +
        '"><div class="nt-format-bar" role="group" aria-label="Note formatting">' +
        btn('format', '<strong>B</strong>', 'data-format="bold" aria-label="Bold text"') +
        btn('format', '<em>I</em>', 'data-format="italic" aria-label="Italic text"') +
        btn('format', 'H', 'data-format="heading" aria-label="Heading"') +
        btn('format', '☷', 'data-format="bullet" aria-label="Bullet list"') +
        btn('format', '☑', 'data-format="check" aria-label="Checklist"') +
        btn('format', '↗', 'data-format="link" aria-label="Website link"') +
        '<span class="nt-format-spacer"></span>' +
        btn('preview', 'Preview', 'aria-pressed="false" id="ntPreviewButton"') +
        '</div><label class="nt-sr-only" for="ntBody">Note content</label><textarea id="ntBody" class="nt-body hub-sensitive" name="body" maxlength="32767" placeholder="Start anywhere. A thought, a plan, something worth remembering…">' +
        esc(draft.body) +
        '</textarea><div id="ntPreview" class="nt-preview hub-sensitive" hidden></div><div class="nt-writing-footer"><span id="ntWords">' +
        (draft.body.trim().match(/\S+/g) || []).length +
        ' words</span><span>Formatting uses simple Markdown · Ctrl / ⌘ + S to save</span></div><details class="nt-details"><summary>Notebook, tags & linked work</summary><div class="nt-detail-grid"><label>Notebook<select name="notebookId">' +
        options(store().notebooks, draft.notebookId, 'Loose pages') +
        '</select></label><label>Tags, separated by commas<input name="tags" maxlength="300" value="' +
        esc(draft.tags) +
        '" placeholder="Ideas, meetings, personal…"></label><label>Project<select id="ntProject" name="projectId">' +
        options(a.state().projects, draft.projectId, 'No project link') +
        '</select></label><label>Ticket<select name="ticketId">' +
        options(
          a
            .state()
            .tickets.map(t => ({ id: t.id, name: t.ticket + ' · ' + t.description.slice(0, 75) })),
          draft.ticketId,
          'No ticket link'
        ) +
        '</select></label><div id="ntCompanies" class="nt-wide"></div></div></details><details class="nt-details"><summary>Earlier text versions</summary><p class="nt-history-hint">Keep up to three earlier versions, spaced at least a minute apart. Restoring replaces the title and text.</p><ul id="ntHistory"></ul></details></div></div><div class="nt-room-footer"><div class="nt-actions">' +
        btn('trash', icon('trash') + ' Move to Trash', '', 'nt-quiet') +
        btn('export', 'Export .md') +
        '</div><div class="nt-actions">' +
        btn('save-copy', 'Save draft as a copy', 'id="ntSaveCopy" hidden') +
        '<button type="submit" class="nt-button nt-primary">Save note</button></div></div></form>';
      document.body.append(room);
      room.showModal();
      companyFields();
      history();
      room.addEventListener('cancel', event => {
        event.preventDefault();
        close();
      });
      $('ntTitle').focus({ preventScroll: true });
      if (editor.dirty) dirty();
    }
    function close() {
      if (!editor) return true;
      if (!flush()) return false;
      $('notesRoom')?.close();
      $('notesRoom')?.remove();
      editor = null;
      clearTimeout(timer);
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
      return true;
    }
    function notebookEditor(id = '') {
      guard();
      const b = store().notebooks.find(x => x.id === id);
      a.openModal(
        id ? 'Rename notebook' : 'A home for your notes',
        '<form id="ntBookForm" data-id="' +
          esc(id) +
          '" data-owner="' +
          esc(owner) +
          '"><label>Notebook name<input name="name" maxlength="60" value="' +
          esc(b?.name || '') +
          '" placeholder="Meetings, personal, ideas…" required></label><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save notebook</button></div></form>'
      );
      $('ntBookForm').elements.name.focus();
    }
    function flag(id, key) {
      guard();
      a.mutate(d => {
        const n = E.store(d).notes.find(x => x.id === id);
        if (!n) throw Error('This note no longer exists.');
        n[key] = !n[key];
        n.updatedAt = new Date().toISOString();
      });
    }
    function preview() {
      const on = $('ntPreview').hidden;
      $('ntPreview').hidden = !on;
      $('ntBody').hidden = on;
      $('ntPreviewButton').textContent = on ? 'Write' : 'Preview';
      $('ntPreviewButton').setAttribute('aria-pressed', String(on));
      for (const b of document.querySelectorAll('[data-nt="format"]')) b.disabled = on;
      if (on)
        $('ntPreview').innerHTML =
          E.markdown($('ntBody').value) ||
          '<p class="nt-placeholder">Your words will appear here.</p>';
      else $('ntBody').focus({ preventScroll: true });
    }
    function format(kind) {
      const t = $('ntBody'),
        start = t.selectionStart,
        end = t.selectionEnd,
        selection = t.value.slice(start, end);
      let value;
      if (kind === 'heading' || kind === 'bullet' || kind === 'check') {
        const from = t.value.lastIndexOf('\n', start - 1) + 1,
          prefix = { heading: '# ', bullet: '- ', check: '- [ ] ' }[kind];
        value = t.value
          .slice(from, end)
          .split('\n')
          .map(line => prefix + line)
          .join('\n');
        t.setRangeText(value, from, end, 'select');
      } else {
        const [before, after, placeholder] = {
          bold: ['**', '**', 'bold text'],
          italic: ['*', '*', 'italic text'],
          link: ['[', '](https://example.com)', 'link text'],
        }[kind];
        value = before + (selection || placeholder) + after;
        t.setRangeText(value, start, end, 'select');
        t.setSelectionRange(
          start + before.length,
          start + before.length + (selection || placeholder).length
        );
      }
      t.focus({ preventScroll: true });
      dirty();
    }
    function exportDraft() {
      read();
      const n = editor.draft,
        file =
          (n.title || 'Untitled-note')
            .replace(/[^\p{L}\p{N} _-]/gu, '')
            .trim()
            .slice(0, 80) || 'Note';
      a.download(
        '# ' + (n.title || 'Untitled note') + '\n\n' + n.body,
        file + '.md',
        'text/markdown;charset=utf-8'
      );
    }
    async function handle(el) {
      guard();
      const action = el.dataset.nt,
        id = el.dataset.id;
      if (action === 'new') open();
      if (action === 'meeting') open('', 'meeting');
      if (action === 'open') open(id);
      if (action === 'library') a.navigate('notes');
      if (action === 'filter') {
        filter = el.dataset.filter;
        paintList(true);
      }
      if (action === 'pin') flag(id, 'pinned');
      if (action === 'restore') flag(id, 'trashed');
      if (action === 'book-new') notebookEditor();
      if (action === 'book-edit') notebookEditor(notebookId);
      if (!editor) return;
      if (action === 'close') close();
      if (action === 'save') flush();
      if (action === 'format') format(el.dataset.format);
      if (action === 'preview') preview();
      if (action === 'focus') {
        const on = $('notesRoom').classList.toggle('nt-focus');
        el.setAttribute('aria-pressed', String(on));
        el.textContent = on ? '↙ Comfortable view' : '⤢ Focus view';
      }
      if (action === 'export') exportDraft();
      if (action === 'save-copy') {
        read();
        editor.draft.id = E.uid();
        editor.draft.createdAt = new Date().toISOString();
        editor.draft.history = [];
        editor.base = null;
        editor.dirty = true;
        flush();
      }
      if (action === 'history') {
        const version = editor.draft.history.find(v => v.id === id);
        if (version) {
          $('ntTitle').value = version.title;
          $('ntBody').value = version.body;
          if (!$('ntPreview').hidden) $('ntPreview').innerHTML = E.markdown(version.body);
          dirty();
        }
      }
      if (action === 'trash') {
        const noteId = editor.draft.id;
        if (!close()) return;
        if (store().notes.some(n => n.id === noteId)) {
          flag(noteId, 'trashed');
          a.tell('Note moved to Trash. You can restore it in Notes.');
        }
      }
    }
    function mount() {
      sync();
      if (!allowed()) return;
      paintList();
      const actions = document.querySelector('.my-day-page .md-hero-actions');
      if (actions && !actions.querySelector('[data-nt]'))
        actions.insertAdjacentHTML(
          'beforeend',
          btn('new', icon('pen') + ' Quick note', '', 'nt-day-quick')
        );
      saveStatus();
    }
    document.addEventListener('click', event => {
      const el = event.target.closest('[data-nt]');
      if (!el) return;
      event.preventDefault();
      void handle(el).catch(err => {
        if (editor) status(err.message, true);
        else a.tell(err.message, true);
      });
    });
    document.addEventListener('input', event => {
      if (event.target.id === 'ntSearch') {
        query = event.target.value;
        paintList();
      }
      if (
        event.target.closest('#ntEditorForm') &&
        event.target.matches('input:not([type="checkbox"]), textarea')
      )
        dirty();
    });
    document.addEventListener('change', event => {
      const el = event.target;
      if (el.id === 'ntNotebook') {
        notebookId = el.value;
        paintList(true);
      }
      if (el.id === 'ntSort') {
        sort = el.value;
        paintList(true);
      }
      if (!sync() || !editor) return;
      if (el.id === 'ntProject') {
        editor.draft.projectId = el.value;
        editor.draft.companyIds = [];
        companyFields();
      }
      if (el.closest('#ntEditorForm') && el.matches('select, input[type="checkbox"]')) dirty();
      if (el.hasAttribute('data-nt-check')) {
        const lines = $('ntBody').value.split('\n'),
          i = +el.dataset.ntCheck;
        lines[i] = lines[i].replace(/^(\s*- \[)[ xX](\])/, '$1' + (el.checked ? 'x' : ' ') + '$2');
        $('ntBody').value = lines.join('\n');
        dirty();
      }
    });
    document.addEventListener('submit', event => {
      if (event.target.id === 'ntEditorForm') {
        event.preventDefault();
        flush();
      }
      if (event.target.id === 'ntBookForm') {
        event.preventDefault();
        try {
          guard();
          if (event.target.dataset.owner !== owner) throw Error('The account changed.');
          const form = event.target;
          let book;
          const ok = a.mutate(d => {
            book = E.notebook(d, form.dataset.id, form.elements.name.value);
          });
          if (ok) {
            notebookId = book.id;
            a.closeModal();
            paintList(true);
            a.tell('Notebook saved.');
          }
        } catch (err) {
          a.tell(err.message, true);
        }
      }
    });
    document.addEventListener('keydown', event => {
      if (!editor || !event.target.closest('#notesRoom')) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        flush();
      }
      if (
        (event.ctrlKey || event.metaKey) &&
        ['b', 'i'].includes(event.key.toLowerCase()) &&
        event.target.id === 'ntBody'
      ) {
        event.preventDefault();
        format(event.key.toLowerCase() === 'b' ? 'bold' : 'italic');
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && editor) flush();
    });
    root.addEventListener('beforeunload', event => {
      if (editor?.dirty && !flush()) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
    root.setInterval(() => {
      sync();
      saveStatus();
    }, 1500);
    return { render, patchRender, sync, mount, open, close, flush, handle };
  }
  root.WorkHubNotes = { install };
})(window);
