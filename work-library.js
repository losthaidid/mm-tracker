/**
 * work-library.js
 * Snippet/bundle editors, message composition, field library and timeline views.
 * Uses work-library-engine.js. Previewing/copying does not save a ticket.
 * Button data-wl values dispatch to handle(); submit() validates form edits before saving.
 * File map: docs/FILE-MAP.md
 */
(function (root) {
  'use strict';
  const E = root.WorkHubWorkLibraryEngine,
    V = root.WorkHubValidatorEngine;
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const btn = (action, label, extra = '', cls = '') =>
    '<button type="button" class="wl-button ' +
    cls +
    '" data-wl="' +
    action +
    '" ' +
    extra +
    '>' +
    label +
    '</button>';
  const attrs = (kind, id) => 'data-kind="' + esc(kind) + '" data-id="' + esc(id) + '"';
  const options = (xs, value, blank = 'None') =>
    '<option value="">' +
    esc(blank) +
    '</option>' +
    xs
      .map(
        ([id, label]) =>
          '<option value="' +
          esc(id) +
          '"' +
          (value === id ? ' selected' : '') +
          '>' +
          esc(label) +
          '</option>'
      )
      .join('');
  const field = (name, label, value = '', type = 'text', extra = '') =>
    '<label class="wl-field">' +
    esc(label) +
    '<input name="' +
    name +
    '" type="' +
    type +
    '" value="' +
    esc(value) +
    '" ' +
    extra +
    '></label>';
  const area = (name, label, value = '', extra = '') =>
    '<label class="wl-field wl-wide">' +
    esc(label) +
    '<textarea name="' +
    name +
    '" rows="4" ' +
    extra +
    '>' +
    esc(value) +
    '</textarea></label>';
  const select = (name, label, xs, value = '', blank) =>
    '<label class="wl-field">' +
    esc(label) +
    '<select name="' +
    name +
    '">' +
    options(xs, value, blank) +
    '</select></label>';
  const check = (name, label, on) =>
    '<label class="wl-check"><input type="checkbox" name="' +
    name +
    '"' +
    (on ? ' checked' : '') +
    '>' +
    esc(label) +
    '</label>';
  const kindNames = {
    tickets: 'Ticket',
    tasks: 'Task',
    specs: 'Project item',
    notes: 'Knowledge note',
    projects: 'Project',
  };
  function install(a) {
    const $ = id => document.getElementById(id),
      state = () => a.state(),
      data = () => state().workhub.workLibrary,
      messages = () => data().snippets.filter(s => !E.isSubject(s)),
      can = (feature, action = 'view') => a.can?.(feature, action) ?? true;
    let owner = '',
      shelf = 'messages',
      subjectQuery = '',
      subjectEdit = null,
      bundle = '',
      query = '',
      compose = null,
      fieldSource = null,
      insertField = null,
      fieldQuery = '',
      timelineState = null,
      undo = null;
    function sync() {
      const next = a.owner?.() || '';
      if (owner !== next) {
        owner = next;
        shelf = 'messages';
        subjectEdit = null;
        bundle = query = fieldQuery = subjectQuery = '';
        compose = fieldSource = insertField = timelineState = undo = null;
        $('wlUndo')?.remove();
      }
      return next;
    }
    function ready() {
      sync();
      if (!a.ready()) throw Error('Sign in to open your saved work tools.');
    }
    function save(fn, message = 'Saved.') {
      ready();
      const ok = a.mutate(d => {
        E.upgrade(d);
        fn(d);
      });
      if (ok) a.tell(message);
      return ok;
    }
    function open(title, body) {
      a.openModal(title, body);
    }
    function footer(text = 'Save') {
      return (
        '<div class="modal-actions">' +
        btn('close', 'Cancel') +
        '<button class="primary" type="submit">' +
        text +
        '</button></div>'
      );
    }
    function form(title, id, body, extra = '') {
      open(
        title,
        '<form id="' +
          id +
          '" ' +
          extra +
          '><div class="wl-form">' +
          body +
          '</div>' +
          footer() +
          '</form>'
      );
    }
    function snippetRows() {
      const q = query.toLowerCase();
      return messages().filter(
        s =>
          (!bundle || bundle === 'none' ? !bundle || !s.bundleId : s.bundleId === bundle) &&
          (s.title + ' ' + s.category + ' ' + s.body).toLowerCase().includes(q)
      );
    }
    function collectionName() {
      return bundle === 'none'
        ? 'Unbundled'
        : data().bundles.find(b => b.id === bundle)?.name || 'All snippets';
    }
    function cards() {
      const snippets = snippetRows();
      return (
        '<div class="wl-result-line"><h3>' +
        esc(collectionName()) +
        '</h3><span role="status">' +
        snippets.length +
        ' message' +
        (snippets.length === 1 ? '' : 's') +
        '</span></div><div class="wl-snippet-grid">' +
        snippets
          .map(s => {
            const keys = E.placeholders(s.body),
              bundleName = data().bundles.find(b => b.id === s.bundleId)?.name;
            return (
              '<article class="wl-snippet"><div class="wl-snippet-content"><div class="wl-snippet-top"><span class="wl-document" aria-hidden="true">≡</span><span class="wl-eyebrow hub-sensitive">' +
              esc(s.category || bundleName || 'YOUR WORDS') +
              '</span></div><h3 class="hub-sensitive">' +
              esc(s.title) +
              '</h3><p class="wl-excerpt hub-sensitive">' +
              esc(s.body.slice(0, 360)) +
              (s.body.length > 360 ? '…' : '') +
              '</p></div><div class="wl-snippet-details"><div class="wl-details-heading"><span>Personalise before copying</span><b>' +
              keys.length +
              ' field' +
              (keys.length === 1 ? '' : 's') +
              '</b></div><div class="wl-placeholder-tags hub-sensitive">' +
              keys
                .slice(0, 6)
                .map(k => '<code>{' + esc(k) + '}</code>')
                .join('') +
              (keys.length > 6
                ? '<span class="wl-more-fields">+' + (keys.length - 6) + ' more</span>'
                : '') +
              (!keys.length
                ? '<span class="wl-ready-note">No fields to fill. Ready to review.</span>'
                : '') +
              '</div><p class="wl-bundle-caption hub-sensitive">Bundle · ' +
              esc(bundleName || 'Unbundled') +
              '</p></div><div class="wl-card-actions">' +
              btn(
                'compose',
                'Use snippet <span aria-hidden="true">↗</span>',
                'data-id="' + esc(s.id) + '"',
                'wl-primary'
              ) +
              btn(
                'snippet-edit',
                'Edit',
                'data-id="' + esc(s.id) + '" aria-label="Edit ' + esc(s.title) + '"'
              ) +
              btn(
                'snippet-remove',
                'Remove',
                'data-id="' + esc(s.id) + '" aria-label="Remove ' + esc(s.title) + '"',
                'wl-quiet'
              ) +
              '</div></article>'
            );
          })
          .join('') +
        '</div>' +
        (!snippets.length
          ? query || bundle
            ? '<div class="wl-empty"><span aria-hidden="true">⌕</span><h3>' +
              (query ? 'No matching snippets.' : 'No messages in this bundle yet.') +
              '</h3><p>Try another search or show all your snippets.</p>' +
              btn('snippet-reset', 'Show all snippets', '', 'wl-soft') +
              '</div>'
            : '<div class="wl-empty"><span aria-hidden="true">✎</span><h3>Your next good message starts here.</h3><p>Save wording you use often, then personalise the details each time.</p>' +
              btn('snippet-edit', 'Create a snippet', '', 'wl-primary') +
              btn('snippet-example', 'Add an editable example', '', 'wl-soft') +
              '</div>'
          : '')
      );
    }
    function render() {
      ready();
      const savedMessages = messages();
      const subjects = data().snippets.filter(E.isSubject);
      const showingSubjects = shelf === 'subjects';
      const bundleButton = (id, name, count) =>
        btn(
          'bundle',
          '<span class="wl-bundle-name">' + esc(name) + '</span><b>' + count + '</b>',
          'data-id="' + esc(id) + '" aria-pressed="' + (bundle === id) + '"',
          bundle === id ? 'is-active' : ''
        );
      return (
        '<section class="wl-workspace wl-snippets-page" aria-label="Snippets library"><header class="wl-hero"><div class="wl-hero-copy"><span class="wl-eyebrow">YOUR COMMUNICATION SHELF</span><h2>The right words, ready.</h2><p>Keep your best wording. Make every message your own.</p><div class="wl-library-summary"><span><b>' +
        savedMessages.length +
        '</b> saved message' +
        (savedMessages.length === 1 ? '' : 's') +
        '</span><span><b>' +
        data().bundles.length +
        '</b> bundle' +
        (data().bundles.length === 1 ? '' : 's') +
        '</span><span><b>' +
        subjects.length +
        '</b> subject template' +
        (subjects.length === 1 ? '' : 's') +
        '</span></div></div><div class="wl-actions">' +
        (showingSubjects
          ? can('snippets', 'create')
            ? btn('subject-new', 'New subject template', '', 'wl-primary')
            : ''
          : btn('bundles', 'Manage bundles', '', 'wl-soft') +
            btn('snippet-edit', '＋ New snippet', '', 'wl-primary')) +
        '</div></header><div class="wl-shelf-switch" role="group" aria-label="Snippets sections">' +
        [
          ['messages', 'Message snippets'],
          ['subjects', 'Email subject templates'],
        ]
          .map(([key, label]) =>
            btn('shelf', label, 'data-shelf="' + key + '" aria-pressed="' + (shelf === key) + '"')
          )
          .join('') +
        '</div>' +
        (showingSubjects
          ? subjectShelf()
          : '<div class="wl-library-layout"><aside class="wl-sidebar" aria-label="Filter snippets by bundle"><span class="wl-eyebrow">YOUR BUNDLES</span>' +
            bundleButton('', 'All snippets', savedMessages.length) +
            data()
              .bundles.map(b =>
                bundleButton(b.id, b.name, savedMessages.filter(s => s.bundleId === b.id).length)
              )
              .join('') +
            bundleButton('none', 'Unbundled', savedMessages.filter(s => !s.bundleId).length) +
            '<div class="wl-sidebar-note"><span aria-hidden="true">✉</span><h3>A little less retyping.</h3><p>Choose a message, fill in its fields, then review and copy.</p></div></aside><div class="wl-library-main"><div class="wl-search-bar"><label class="wl-search">Find a message<input id="wlSnippetSearch" type="search" value="' +
            esc(query) +
            '" placeholder="Search title, category or message…" aria-controls="wlSnippetCards"></label><span class="wl-search-note">Your wording, ready to reuse.</span></div><div id="wlSnippetCards">' +
            cards() +
            '</div></div></div>') +
        '</section>'
      );
    }
    function subjectShelf() {
      return `<section class="wl-subject-shelf" aria-label="Email subject templates">
        <div class="wl-search-bar"><label class="wl-search">Find a subject template<input type="search" id="wlSubjectSearch" value="${esc(subjectQuery)}" placeholder="Search names, subjects or placeholders" aria-controls="wlSubjectCards"></label></div>
        <div id="wlSubjectCards">${subjectCards()}</div></section>`;
    }
    function subjectCards() {
      const q = subjectQuery.trim().toLowerCase();
      const rows = data().snippets.filter(
        s => E.isSubject(s) && (s.title + ' ' + s.body).toLowerCase().includes(q)
      );
      const heading = `<div class="wl-result-line"><h3>Email subject templates</h3><span role="status">${rows.length} template${rows.length === 1 ? '' : 's'}</span></div>`;
      if (!rows.length)
        return (
          heading +
          (q
            ? '<p class="wl-empty">No matching subject templates.</p>'
            : '<div class="wl-empty"><h3>Save your first subject template</h3><p>For example, <code>[{project}] {ticket} – {topic}</code>. Fill in the details each time you use it.</p></div>')
        );
      return (
        heading +
        `<div class="wl-snippet-grid">${rows
          .map(s => {
            const id = `data-id="${esc(s.id)}"`;
            return `<article class="wl-snippet"><div class="wl-snippet-content"><h3 class="hub-sensitive">${esc(s.title)}</h3><p class="wl-excerpt hub-sensitive">${esc(s.body)}</p></div>
          <div class="wl-card-actions">${btn('compose', 'Use subject', id, 'wl-primary')}${can('snippets', 'edit') ? btn('subject-edit', 'Edit', id + ` aria-label="Edit ${esc(s.title)}"`) : ''}${can('snippets', 'delete') ? btn('snippet-remove', 'Remove', id + ` aria-label="Remove ${esc(s.title)}"`, 'wl-quiet') : ''}</div></article>`;
          })
          .join('')}</div>`
      );
    }
    const subjectFields = ['project', 'ticket', 'system', 'client', 'tr_number', 'today'];
    function sameSubject(current, original) {
      return (
        E.isSubject(current) &&
        ['id', 'title', 'body', 'updatedAt'].every(key => current[key] === original[key])
      );
    }
    function subjectEditor(id = '') {
      ready();
      if (!can('snippets', id ? 'edit' : 'create'))
        throw Error('Your account cannot save this template.');
      const s = data().snippets.find(row => row.id === id);
      if (id && !E.isSubject(s)) throw Error('This subject template no longer exists.');
      form(
        id ? 'Edit email subject template' : 'New email subject template',
        'wlSubject',
        field(
          'title',
          'Template name',
          s?.title,
          'text',
          'required maxlength="120" placeholder="Testing request"'
        ) +
          `<div class="wl-wide">${field('body', 'Subject line', s?.body, 'text', 'required maxlength="12000" placeholder="[{project}] {ticket} – {topic}"')}</div>
         <div class="wl-wide"><p class="wl-help">Use braces around any field name, such as <code>{topic}</code> or <code>{po_number}</code>. Repeated fields share one value. <code>{today}</code> fills in the current date.</p>
         <div class="wl-subject-tokens" role="group" aria-label="Insert a placeholder">${subjectFields.map(k => btn('insert-placeholder', '{' + k + '}', `data-field="${k}"`)).join('')}</div></div>`,
        `data-id="${esc(id)}" data-access-feature="snippets"`
      );
      subjectEdit = {
        form: $('wlSubject'),
        id,
        original: s ? E.copy(s) : null,
        owner,
        generation: a.cloud?.()?.generation,
      };
    }
    function saveSubject(f, get) {
      const draft = subjectEdit;
      if (
        !draft ||
        draft.form !== f ||
        f !== $('wlSubject') ||
        !$('modal').open ||
        owner !== draft.owner ||
        a.cloud?.()?.generation !== draft.generation ||
        !can('snippets', draft.id ? 'edit' : 'create')
      )
        throw Error('Reopen the subject template before saving.');
      const title = get('title'),
        body = E.singleLine(get('body'));
      if (!title || !body) throw Error('Enter a template name and a subject line.');
      if (E.placeholders(body).length > 40)
        throw Error('Use up to 40 different placeholders in one subject.');
      const ok = save(d => {
        const rows = d.workhub.workLibrary.snippets;
        const i = rows.findIndex(s => s.id === draft.id);
        if (draft.id && !sameSubject(rows[i], draft.original))
          throw Error('This template changed. Reopen it before saving.');
        const now = E.now();
        const record = {
          ...rows[i],
          id: draft.id || E.uid(),
          kind: 'email-subject',
          title,
          body,
          bundleId: '',
          category: '',
          createdAt: draft.original?.createdAt || now,
          updatedAt: now,
        };
        if (i < 0) rows.push(record);
        else rows[i] = record;
      }, 'Subject template saved.');
      if (ok) {
        subjectEdit = null;
        a.closeModal();
        if (!(title + ' ' + body).toLowerCase().includes(subjectQuery.trim().toLowerCase())) {
          subjectQuery = '';
          a.render();
        }
      }
    }
    function snippetEditor(id = '') {
      ready();
      const s = data().snippets.find(s => s.id === id) || {};
      if (E.isSubject(s)) return subjectEditor(id);
      form(
        id ? 'Edit message snippet' : 'A message worth keeping',
        'wlSnippet',
        field(
          'title',
          'Snippet name',
          s.title,
          'text',
          'required maxlength="120" placeholder="Request testing confirmation"'
        ) +
          field(
            'category',
            'Category',
            s.category,
            'text',
            'maxlength="80" placeholder="Testing coordination"'
          ) +
          select(
            'bundleId',
            'Bundle',
            data().bundles.map(b => [b.id, b.name]),
            s.bundleId,
            'Unbundled'
          ) +
          area(
            'body',
            'Your reusable message',
            s.body,
            'required maxlength="12000" rows="10" placeholder="Hi {name},&#10;The change for {ticket} is ready in {system}, client {client}."'
          ) +
          '<p class="wl-help wl-wide">Use braces for changing details: {name}, {ticket}, {system}, or your own {placeholder_name}. A repeated placeholder is filled once. Messages are reviewed and copied from the composer.</p>',
        'data-id="' + esc(id) + '"'
      );
    }
    function bundleManager() {
      ready();
      open(
        'Your snippet bundles',
        '<div class="wl-intro"><span class="wl-eyebrow">A PLACE FOR RELATED MESSAGES</span><h3>Keep your wording together.</h3><p>Use bundles for incident handling, testing coordination or project updates.</p></div><div class="wl-bundle-list">' +
          data()
            .bundles.map(
              b =>
                '<form class="wl-inline" id="wlBundle-' +
                esc(b.id) +
                '" data-bundle-id="' +
                esc(b.id) +
                '">' +
                field('name', 'Bundle name', b.name, 'text', 'required maxlength="120"') +
                '<span>' +
                data().snippets.filter(s => s.bundleId === b.id).length +
                ' snippets</span><button type="submit">Rename</button>' +
                btn('bundle-remove', 'Remove', 'data-id="' + esc(b.id) + '"', 'wl-quiet') +
                '</form>'
            )
            .join('') +
          '</div><form id="wlBundleNew"><div class="wl-inline">' +
          field(
            'name',
            'New bundle',
            '',
            'text',
            'required maxlength="120" placeholder="e.g. Testing coordination"'
          ) +
          '<button class="primary" type="submit">Add bundle</button></div></form>'
      );
    }
    function subjectRecordValues(kind, id) {
      if (
        !['tickets', 'tasks', 'projects'].includes(kind) ||
        !can(kind === 'projects' ? 'specs' : kind)
      )
        return {};
      const record = E.record(state(), kind, id);
      if (!record) return {};
      const values = E.contextValues(state(), kind, id);
      if (!can('tickets')) values.ticket = values.ticket_number = '';
      if (!can('specs')) values.project = '';
      if (kind === 'tasks') {
        values.tr_number = record.trNumber || '';
        values.transport = values.tr_number || values.transport;
      }
      return values;
    }
    function subjectSources(keys) {
      const kinds = ['tickets', 'tasks', 'projects'].filter(kind => {
        if (!can(kind === 'projects' ? 'specs' : kind) || !state()[kind]?.length) return false;
        const values = subjectRecordValues(kind, state()[kind][0].id);
        return keys.some(k => Object.hasOwn(values, k));
      });
      return kinds.length
        ? '<div class="wl-subject-source">' +
            select(
              'sourceKind',
              'Fill from a work record',
              kinds.map(k => [k, kindNames[k]]),
              '',
              'Enter details manually'
            ) +
            '<label class="wl-field" hidden>Work record<select name="sourceRecord" disabled></select></label></div>'
        : '';
    }
    function fillSubjectSource(f, changeKind) {
      if (f !== compose?.form || !compose.subject) return;
      const kind = f.elements.sourceKind.value,
        picker = f.elements.sourceRecord;
      if (changeKind) {
        const rows =
          ['tickets', 'tasks', 'projects'].includes(kind) &&
          can(kind === 'projects' ? 'specs' : kind)
            ? state()[kind]
            : [];
        picker.innerHTML = options(
          rows.map(r => [r.id, E.singleLine(E.title(r, kind)).slice(0, 180)]),
          '',
          'Choose a record'
        );
        picker.disabled = !rows.length;
        picker.parentElement.hidden = picker.disabled;
      }
      const values = subjectRecordValues(kind, picker.value);
      const filled = Object.create(null);
      for (const el of f.querySelectorAll('[data-placeholder]')) {
        const key = el.dataset.placeholder;
        if (key === 'today' || (el.value && el.value !== compose.prefilled[key])) continue;
        const value = Object.hasOwn(values, key) ? E.singleLine(values[key]) : '';
        el.value = value;
        filled[key] = value;
      }
      compose.prefilled = filled;
      updatePreview();
    }
    function composer(id, kind = '', recordId = '') {
      ready();
      const s = data().snippets.find(s => s.id === id);
      if (!s) throw Error('This snippet no longer exists.');
      const subject = E.isSubject(s);
      if (subject && !can('snippets')) throw Error('Your account cannot open subject templates.');
      compose = {
        id,
        subject,
        body: s.body,
        owner,
        generation: a.cloud?.()?.generation,
        prefilled: Object.create(null),
      };
      const values = subject
          ? { ...subjectRecordValues(kind, recordId), today: a.today() }
          : E.contextValues(state(), kind, recordId),
        keys = E.placeholders(s.body);
      const staticSubject = subject && !keys.length;
      const intro = subject
        ? ''
        : '<div class="wl-composer-intro"><span class="wl-eyebrow">MAKE IT FIT THIS MOMENT</span><h3>' +
          esc(s.title) +
          '</h3><p>' +
          (recordId
            ? 'Available record details are filled below. Review every value before copying.'
            : 'Fill the changing details, review the message, then copy it.') +
          '</p></div>';
      open(
        (subject ? 'Email subject · ' : 'Compose · ') + s.title,
        '<form id="wlCompose" data-id="' +
          esc(id) +
          '"' +
          (subject ? ' data-access-feature="snippets"' : '') +
          '>' +
          intro +
          `<div class="wl-composer-layout${staticSubject ? ' wl-subject-static' : ''}"><section${staticSubject ? ' hidden' : ''}><h3 class="wl-small-heading">The details</h3>` +
          (subject ? subjectSources(keys) : '') +
          '<div class="wl-compose-fields">' +
          keys
            .map(k =>
              field(
                'p_' + k,
                k.replaceAll('_', ' '),
                Object.hasOwn(values, k) ? (subject ? E.singleLine(values[k]) : values[k]) : '',
                'text',
                'maxlength="4000" data-placeholder="' + esc(k) + '"'
              )
            )
            .join('') +
          (!subject && !keys.length
            ? '<p class="wl-help">This snippet has no placeholders. Its wording is ready to review.</p>'
            : '') +
          '</div>' +
          (subject
            ? ''
            : select(
                'copyFormat',
                'Copy format',
                [
                  ['plain', 'Plain text'],
                  ['email', 'Email layout (rich text)'],
                  ['ticket', 'Ticket comment (Markdown)'],
                ],
                'plain'
              )) +
          '</section><section class="wl-message-paper"><div class="wl-message-heading"><span class="wl-eyebrow">' +
          (subject ? 'Subject preview' : 'YOUR MESSAGE PREVIEW') +
          '</span><span id="wlMissing" role="status"></span></div>' +
          (subject
            ? '<textarea id="wlMessagePreview" class="wl-subject-preview" readonly aria-label="Completed subject preview" rows="3"></textarea>'
            : '<div id="wlRichPreview" hidden></div><textarea id="wlMessagePreview" readonly aria-label="Completed message preview" rows="13"></textarea>') +
          '<div class="wl-copy-bar">' +
          btn('copy', subject ? 'Copy subject' : 'Copy message', '', 'wl-primary') +
          '<small id="wlCopyHelp">' +
          (subject ? '' : 'Review before copying.') +
          '</small></div></section></div></form>'
      );
      compose.form = $('wlCompose');
      updatePreview();
    }
    function composeResult() {
      const f = $('wlCompose'),
        s = data().snippets.find(s => s.id === compose?.id);
      if (
        !s ||
        !f ||
        f !== compose?.form ||
        !$('modal').open ||
        compose.owner !== a.owner?.() ||
        compose.generation !== a.cloud?.()?.generation
      )
        throw Error('Reopen the composer.');
      if (compose.subject && (!can('snippets') || !E.isSubject(s) || s.body !== compose.body))
        throw Error('Reopen the subject template to use its current wording.');
      const values = Object.create(null);
      for (const el of f.querySelectorAll('[data-placeholder]'))
        values[el.dataset.placeholder] = el.value;
      const format = compose.subject ? 'plain' : f.elements.namedItem('copyFormat').value;
      return { ...E.renderSnippet(s, values, format), format };
    }
    function updatePreview() {
      if (!$('wlCompose')) return;
      let r;
      try {
        r = composeResult();
      } catch (error) {
        $('wlMessagePreview').value = '';
        $('wlRichPreview')?.replaceChildren();
        $('wlMissing').textContent = error.message;
        $('wlCompose').querySelector('[data-wl="copy"]').disabled = true;
        return;
      }
      $('wlMessagePreview').value = r.text;
      const rich = $('wlRichPreview');
      if (rich) {
        rich.innerHTML = r.html;
        rich.hidden = r.format !== 'email';
      }
      $('wlMessagePreview').hidden = r.format === 'email';
      $('wlMissing').textContent = r.missing.length
        ? r.missing.length + ' detail' + (r.missing.length === 1 ? '' : 's') + ' to fill'
        : compose.subject
          ? 'Ready to copy'
          : 'Ready to review';
      $('wlCompose').querySelector('[data-wl="copy"]').disabled = !!r.missing.length;
    }
    async function copyMessage() {
      ready();
      const r = composeResult();
      if (r.missing.length) throw Error('Fill the remaining placeholders before copying.');
      const account = owner,
        form = compose.form,
        subject = compose.subject;
      let rich = false;
      try {
        if (r.format === 'email' && root.ClipboardItem && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new root.ClipboardItem({
              'text/html': new Blob([r.html], { type: 'text/html' }),
              'text/plain': new Blob([r.text], { type: 'text/plain' }),
            }),
          ]);
          rich = true;
        } else if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(r.text);
        else throw Error('Clipboard unavailable');
        if (account !== a.owner?.() || $('wlCompose') !== form || !$('modal').open) return;
        $('wlCopyHelp').textContent =
          r.format === 'email' && !rich
            ? 'Copied as plain text; rich copying is unavailable here.'
            : subject
              ? 'Copied. Paste into the email subject field.'
              : 'Copied. Paste it into your communication tool.';
        a.tell(subject ? 'Email subject copied.' : 'Message copied.');
      } catch {
        if (account !== a.owner?.() || $('wlCompose') !== form || !$('modal').open) return;
        if ($('wlRichPreview')) $('wlRichPreview').hidden = true;
        $('wlMessagePreview').hidden = false;
        $('wlMessagePreview').focus();
        $('wlMessagePreview').select();
        $('wlCopyHelp').textContent = subject
          ? 'The subject is selected. Use your usual copy shortcut.'
          : 'Select the preview and copy it manually; browser copying is unavailable.';
        a.tell(
          subject
            ? 'Select and copy the subject preview.'
            : 'Your completed message is ready to select and copy.',
          true
        );
      }
    }
    function chooseSnippet(kind, id) {
      ready();
      const r = E.record(state(), kind, id);
      if (!r) throw Error('This record no longer exists.');
      open(
        'A message for this work',
        '<div class="wl-intro"><span class="wl-eyebrow">' +
          kindNames[kind] +
          '</span><h3 class="hub-sensitive">' +
          esc(E.title(r, kind)) +
          '</h3><p>Choose a message. Available ticket, project and system details will fill matching placeholders.</p></div><div class="wl-picker-list">' +
          messages()
            .map(s =>
              btn(
                'compose',
                '<strong>' +
                  esc(s.title) +
                  '</strong><small>' +
                  esc(
                    data().bundles.find(b => b.id === s.bundleId)?.name || s.category || 'Unbundled'
                  ) +
                  '</small>',
                'data-id="' + esc(s.id) + '" data-kind="' + kind + '" data-record="' + esc(id) + '"'
              )
            )
            .join('') +
          '</div>' +
          (!messages().length ? '<p class="wl-empty">Create a message in Snippets first.</p>' : '')
      );
    }
    function openFields(source = null, onInsert = null) {
      ready();
      fieldSource = source ? E.copy(source) : null;
      insertField = onInsert;
      fieldQuery = '';
      fieldsView();
    }
    function fieldsView() {
      const q = fieldQuery.toLowerCase(),
        fields = data().fields.filter(f =>
          (f.name + ' ' + f.definition.key + ' ' + f.definition.label).toLowerCase().includes(q)
        );
      open(
        'Reusable field library',
        '<div class="wl-intro"><span class="wl-eyebrow">DEFINE ONCE. USE AGAIN.</span><h3>A familiar shape for your data.</h3><p>Insert a saved definition into a template. Each inserted field is an independent copy; existing drafts and published versions keep their settings.</p></div><div class="wl-inline">' +
          field(
            'search',
            'Find a field',
            fieldQuery,
            'search',
            'id="wlFieldSearch" placeholder="Search names or technical fields"'
          ) +
          btn(
            'field-edit',
            fieldSource ? 'Save selected column as a field' : '＋ New field',
            '',
            'wl-primary'
          ) +
          '</div><div id="wlFieldRows">' +
          fieldRows(fields) +
          '</div>'
      );
    }
    function fieldRows(fields) {
      return (
        fields
          .map(
            f =>
              '<article class="wl-field-card"><div><span class="wl-eyebrow">' +
              esc(f.definition.type) +
              '</span><h3>' +
              esc(f.name) +
              '</h3><code>' +
              esc(f.definition.key) +
              '</code><p>' +
              esc(f.definition.description || f.definition.label) +
              '</p></div><div class="wl-actions">' +
              (insertField
                ? btn(
                    'field-insert',
                    'Insert into template',
                    'data-id="' + esc(f.id) + '"',
                    'wl-primary'
                  )
                : '') +
              btn('field-edit', 'Edit', 'data-id="' + esc(f.id) + '"') +
              btn('field-remove', 'Remove', 'data-id="' + esc(f.id) + '"', 'wl-quiet') +
              '</div></article>'
          )
          .join('') +
        (!fields.length
          ? '<p class="wl-empty">Save a field definition to reuse its type, checks and instructions.</p>'
          : '')
      );
    }
    function fieldEditor(id = '') {
      const f = data().fields.find(f => f.id === id),
        c = f?.definition || fieldSource || V.column(0);
      form(
        id ? 'Edit reusable field' : 'Keep a field definition',
        'wlField',
        field('name', 'Library name', f?.name || c.label, 'text', 'required maxlength="120"') +
          field('key', 'Technical field name', c.key, 'text', 'required maxlength="64"') +
          field('label', 'Column label', c.label, 'text', 'required maxlength="120"') +
          select(
            'type',
            'Data type',
            V.TYPES.map(t => [t, t]),
            c.type
          ) +
          select(
            'format',
            'Format check',
            Object.keys(V.FORMATS).map(k => [k, k]),
            c.format,
            'Any format'
          ) +
          field('minLength', 'Minimum length', c.minLength, 'number', 'min="0" max="32000"') +
          field('maxLength', 'Maximum length', c.maxLength, 'number', 'min="0" max="32000"') +
          field('min', 'Minimum number', c.min, 'number', 'step="any"') +
          field('max', 'Maximum number', c.max, 'number', 'step="any"') +
          '<div class="wl-wide wl-check-grid">' +
          check('required', 'Required', c.required) +
          check('unique', 'Unique values', c.unique) +
          check('trim', 'Ignore surrounding spaces', c.trim) +
          check('caseSensitive', 'Case-sensitive comparisons', c.caseSensitive) +
          '</div>' +
          area('values', 'Allowed values', c.values, 'maxlength="8000"') +
          field('aliases', 'Alternative upload headers', c.aliases, 'text', 'maxlength="8000"') +
          area('description', 'Column instructions', c.description, 'maxlength="8000"'),
        'data-id="' + esc(id) + '"'
      );
    }
    const eventNames = {
      created: 'Created',
      status: 'Status',
      update: 'Update',
      session: 'Work session',
      pause: 'Pause / resume',
      dependency: 'Dependency',
      context: 'Work context',
      deleted: 'Removed',
    };
    function openTimeline(kind, id) {
      ready();
      const r = E.record(state(), kind, id);
      if (!r) throw Error('This record no longer exists.');
      timelineState = { kind, id, filter: '', page: 0 };
      timelineView();
    }
    function timelineView() {
      const s = timelineState,
        r = E.record(state(), s.kind, s.id);
      if (!r) throw Error('This record no longer exists.');
      const all = E.timeline(state(), s.kind, s.id),
        events = all.filter(e =>
          !s.filter || s.filter === 'updates'
            ? !s.filter || ['update', 'context', 'created', 'deleted'].includes(e.type)
            : e.type === s.filter
        ),
        shown = events.slice(s.page * 40, s.page * 40 + 40);
      open(
        'Work timeline · ' + E.title(r, s.kind),
        '<section class="wl-timeline"><div class="wl-intro"><span class="wl-eyebrow">THE STORY BEHIND THIS WORK</span><h3 class="hub-sensitive">' +
          esc(E.title(r, s.kind)) +
          '</h3><p>Newest first. Recorded changes and dated earlier records appear together.</p></div><div class="wl-timeline-toolbar">' +
          select(
            'timelineFilter',
            'Show events',
            [
              ['status', 'Status changes'],
              ['session', 'Work sessions'],
              ['pause', 'Pauses & resumes'],
              ['dependency', 'Dependencies'],
              ['updates', 'Notes & other updates'],
            ],
            s.filter,
            'All events'
          ) +
          '<span>' +
          events.length +
          ' events</span></div><div class="wl-event-list">' +
          shown
            .map(
              e =>
                '<article class="wl-event type-' +
                e.type +
                '"><span class="wl-event-dot" aria-hidden="true">' +
                ({
                  session: '◷',
                  pause: 'Ⅱ',
                  dependency: '⛓',
                  status: '✓',
                  created: '＋',
                  deleted: '−',
                }[e.type] || '•') +
                '</span><div><div class="wl-event-meta"><span>' +
                eventNames[e.type] +
                '</span><time>' +
                esc(
                  e.at.includes('T')
                    ? new Date(e.at).toLocaleString(undefined, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })
                    : new Date(e.at + 'T12:00:00').toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })
                ) +
                '</time></div><h4>' +
                esc(e.title) +
                '</h4><p class="hub-sensitive">' +
                esc(e.summary) +
                '</p>' +
                (e.note ? '<p class="wl-event-note hub-sensitive">' + esc(e.note) + '</p>' : '') +
                (e.legacy
                  ? '<small class="wl-help">From an existing dated record' +
                    (!e.at.includes('T') ? ' · date only' : '') +
                    '</small>'
                  : '') +
                (e.changes.length
                  ? '<details><summary>What changed · ' +
                    e.changes.length +
                    '</summary><div class="wl-change-scroll"><table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>' +
                    e.changes
                      .map(
                        c =>
                          '<tr><th>' +
                          esc(c.field) +
                          '</th><td class="hub-sensitive">' +
                          esc(c.before || '—') +
                          '</td><td class="hub-sensitive">' +
                          esc(c.after || '—') +
                          (c.shortened ? '<small>Long text shortened in history.</small>' : '') +
                          '</td></tr>'
                      )
                      .join('') +
                    '</tbody></table></div></details>'
                  : '') +
                '</div></article>'
            )
            .join('') +
          '</div>' +
          (!shown.length
            ? '<div class="wl-empty"><h3>A new chapter starts here.</h3><p>Future changes and saved sessions will appear here. Earlier events without a recorded date are not invented.</p></div>'
            : '') +
          '<div class="wl-pagination">' +
          btn('timeline-page', '← Previous', 'data-delta="-1"' + (!s.page ? ' disabled' : '')) +
          '<span>Page ' +
          (s.page + 1) +
          ' of ' +
          Math.max(1, Math.ceil(events.length / 40)) +
          '</span>' +
          btn(
            'timeline-page',
            'Next →',
            'data-delta="1"' + ((s.page + 1) * 40 >= events.length ? ' disabled' : '')
          ) +
          '</div>' +
          (data().eventsDropped
            ? '<p class="wl-help">The workspace retains up to ' +
              E.MAX_EVENTS.toLocaleString() +
              ' recent recorded events within its history size limit. Earlier history may be available in your backups.</p>'
            : '') +
          '</section>'
      );
    }
    function recordTools(kind, id) {
      return (
        '<div class="wl-record-tools">' +
        btn('timeline', '◷ Timeline', attrs(kind, id), 'wl-quiet') +
        btn('choose-snippet', '✎ Use a snippet', attrs(kind, id), 'wl-quiet') +
        '</div>'
      );
    }
    function mount() {
      sync();
      if (!a.ready()) return;
      const view = $('view');
      if (!view) return;
      const targets = new Map();
      for (const b of view.querySelectorAll('[data-action="edit"][data-group]')) {
        if (!['tasks', 'tickets', 'specs'].includes(b.dataset.group)) continue;
        const card = b.closest('.task-main-card,.ticket-queue-card,.item-card,tr,article');
        if (card) targets.set(card, { kind: b.dataset.group, id: b.dataset.id });
      }
      for (const card of view.querySelectorAll('[data-task-card]'))
        targets.set(card, { kind: 'tasks', id: card.dataset.taskCard });
      for (const b of view.querySelectorAll('[data-hub="note-view"]')) {
        const card = b.closest('.hub-card');
        if (card) targets.set(card, { kind: 'notes', id: b.dataset.id });
      }
      for (const [card, r] of targets) {
        if (card.querySelector('.wl-record-tools')) continue;
        if (card.tagName === 'TR')
          card.querySelector('td')?.insertAdjacentHTML('beforeend', recordTools(r.kind, r.id));
        else card.insertAdjacentHTML('beforeend', recordTools(r.kind, r.id));
      }
      const menu = $('settingsMenu');
      if (menu && !menu.querySelector('[data-wl="fields"]'))
        menu.insertAdjacentHTML('beforeend', btn('fields', 'Reusable field library'));
    }
    function decorateModal() {
      if (!a.ready()) return;
      const body = $('modalBody');
      if (!body || body.querySelector('[data-wl="timeline"]')) return;
      const link = body.querySelector('[data-batch="context"][data-kind][data-id]'),
        ticket = body.querySelector('[data-ticket-detail]');
      if (ticket)
        ticket
          .querySelector('.ticket-detail-tools')
          ?.insertAdjacentHTML('beforeend', recordTools('tickets', ticket.dataset.ticketDetail));
      else if (link) {
        const target = body.querySelector('.batch-detail,.hub-detail');
        target?.insertAdjacentHTML('beforeend', recordTools(link.dataset.kind, link.dataset.id));
      }
    }
    function rememberUndo(action, record, related = []) {
      undo = { owner, action, record: E.copy(record), related };
      $('wlUndo')?.remove();
      const b = document.createElement('button');
      b.id = 'wlUndo';
      b.dataset.wl = 'undo';
      b.className = 'wl-undo';
      b.textContent = 'Undo library removal';
      document.body.append(b);
    }
    async function handle(el) {
      ready();
      const action = el.dataset.wl,
        id = el.dataset.id,
        kind = el.dataset.kind;
      if (action === 'close') {
        a.closeModal();
        return;
      }
      if (action === 'shelf') {
        shelf = el.dataset.shelf === 'subjects' ? 'subjects' : 'messages';
        a.render();
        document.querySelector('[data-wl="shelf"][aria-pressed="true"]')?.focus();
        return;
      }
      if (action === 'subject-new' || action === 'subject-edit') {
        subjectEditor(action === 'subject-edit' ? id : '');
        return;
      }
      if (action === 'insert-placeholder') {
        const input = el.form?.elements.namedItem('body');
        if (input && el.form === subjectEdit?.form && subjectFields.includes(el.dataset.field)) {
          input.setRangeText(
            '{' + el.dataset.field + '}',
            input.selectionStart,
            input.selectionEnd,
            'end'
          );
          input.focus();
        }
        return;
      }
      if (action === 'snippet-edit') {
        snippetEditor(id);
        return;
      }
      if (action === 'compose') {
        composer(id, kind, el.dataset.record || '');
        return;
      }
      if (action === 'copy') {
        await copyMessage();
        return;
      }
      if (action === 'choose-snippet') {
        chooseSnippet(kind, id);
        return;
      }
      if (action === 'snippet-reset') {
        bundle = query = '';
        a.render();
        $('wlSnippetSearch')?.focus();
        return;
      }
      if (action === 'bundle') {
        bundle = id;
        query = '';
        a.render();
        return;
      }
      if (action === 'bundles') {
        bundleManager();
        return;
      }
      if (action === 'fields') {
        openFields();
        return;
      }
      if (action === 'field-edit') {
        fieldEditor(id);
        return;
      }
      if (action === 'field-insert') {
        const f = data().fields.find(f => f.id === id);
        if (!f || !insertField)
          throw Error('Open the field library from a template to insert a field.');
        insertField(E.copy(f.definition));
        return;
      }
      if (action === 'timeline') {
        openTimeline(kind, id);
        return;
      }
      if (action === 'timeline-page') {
        timelineState.page = Math.max(0, timelineState.page + Number(el.dataset.delta));
        timelineView();
        return;
      }
      if (action === 'snippet-example') {
        const s = {
          id: E.uid(),
          title: 'Request testing confirmation',
          category: 'Testing coordination',
          bundleId: '',
          body: 'Hi {name},\n\nThe change for {ticket} is ready for testing in {system}, client {client}.\nPlease test {scenario} and share your result by {date}.\n\nThank you.',
          createdAt: E.now(),
          updatedAt: E.now(),
        };
        save(d => d.workhub.workLibrary.snippets.push(s), 'Editable example added.');
        return;
      }
      if (['snippet-remove', 'bundle-remove', 'field-remove'].includes(action)) {
        const collection =
            action === 'snippet-remove'
              ? 'snippets'
              : action === 'bundle-remove'
                ? 'bundles'
                : 'fields',
          r = data()[collection].find(x => x.id === id);
        if (!r) return;
        const subject = collection === 'snippets' && E.isSubject(r);
        const removalOwner = owner,
          generation = a.cloud?.()?.generation;
        if (subject && !can('snippets', 'delete'))
          throw Error('Your account cannot remove this template.');
        if (
          !(await root.WorkHubDialogs.confirm(
            'Remove ' +
              (r.title || r.name) +
              '?' +
              (collection === 'bundles' ? ' Its snippets will remain unbundled.' : '')
          ))
        )
          return;
        const related =
          collection === 'bundles'
            ? data()
                .snippets.filter(s => s.bundleId === id)
                .map(s => s.id)
            : [];
        if (
          save(d => {
            const h = d.workhub.workLibrary;
            if (
              subject &&
              (owner !== removalOwner ||
                a.cloud?.()?.generation !== generation ||
                !can('snippets', 'delete') ||
                !sameSubject(
                  h.snippets.find(x => x.id === id),
                  r
                ))
            )
              throw Error('Reopen the subject template before removing it.');
            h[collection] = h[collection].filter(x => x.id !== id);
            if (collection === 'bundles')
              for (const s of h.snippets) if (s.bundleId === id) s.bundleId = '';
          }, 'Removed. Undo is available.')
        ) {
          rememberUndo(collection, r, related);
          if (collection === 'bundles') {
            if (bundle === id) bundle = '';
            bundleManager();
          } else if (collection === 'fields') fieldsView();
        }
        return;
      }
      if (action === 'undo') {
        if (undo?.owner !== owner) return;
        const u = undo;
        if (
          save(d => {
            const h = d.workhub.workLibrary;
            if (h[u.action].some(x => x.id === u.record.id))
              throw Error('This item already exists.');
            const r = E.copy(u.record);
            if (u.action === 'snippets' && r.bundleId && !h.bundles.some(b => b.id === r.bundleId))
              r.bundleId = '';
            h[u.action].push(r);
            if (u.action === 'bundles')
              for (const s of h.snippets)
                if (u.related.includes(s.id) && !s.bundleId) s.bundleId = r.id;
          }, 'Restored.')
        ) {
          undo = null;
          $('wlUndo')?.remove();
        }
        return;
      }
    }
    function submit(formEl) {
      ready();
      const v = new FormData(formEl),
        get = k => String(v.get(k) || '').trim(),
        id = formEl.dataset.id;
      if (formEl.id === 'wlSubject') return saveSubject(formEl, get);
      if (formEl.id === 'wlSnippet') {
        if (
          save(d => {
            const h = d.workhub.workLibrary,
              i = h.snippets.findIndex(s => s.id === id),
              old = h.snippets[i];
            if (id && i < 0) throw Error('Snippet no longer exists.');
            if (E.isSubject(old)) throw Error('Open this template in Email subject templates.');
            const s = {
              id: id || E.uid(),
              title: get('title'),
              category: get('category'),
              bundleId: get('bundleId'),
              body: get('body'),
              createdAt: old?.createdAt || E.now(),
              updatedAt: E.now(),
            };
            if (i < 0) h.snippets.push(s);
            else h.snippets[i] = s;
          }, 'Snippet saved.')
        )
          a.closeModal();
        return;
      }
      if (formEl.id === 'wlBundleNew' || formEl.dataset.bundleId) {
        if (
          save(d => {
            const h = d.workhub.workLibrary;
            if (formEl.dataset.bundleId) {
              const b = h.bundles.find(b => b.id === formEl.dataset.bundleId);
              if (!b) throw Error('Bundle no longer exists.');
              b.name = get('name');
            } else h.bundles.push({ id: E.uid(), name: get('name') });
          }, 'Bundle saved.')
        )
          bundleManager();
        return;
      }
      if (formEl.id === 'wlField') {
        const c = { ...V.column(0) };
        for (const k of [
          'key',
          'label',
          'type',
          'format',
          'minLength',
          'maxLength',
          'min',
          'max',
          'values',
          'aliases',
          'description',
        ])
          c[k] = get(k);
        for (const k of ['required', 'unique', 'trim', 'caseSensitive']) c[k] = v.has(k);
        if (
          save(d => {
            const h = d.workhub.workLibrary,
              i = h.fields.findIndex(f => f.id === id);
            if (id && i < 0) throw Error('Reusable field no longer exists.');
            const f = { id: id || E.uid(), name: get('name'), definition: c, updatedAt: E.now() };
            E.validateField(f);
            if (i < 0) h.fields.push(f);
            else h.fields[i] = f;
          }, 'Reusable field saved.')
        ) {
          fieldSource = null;
          fieldsView();
        }
        return;
      }
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-wl]');
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      void handle(el).catch(e => a.tell(e.message, true));
    });
    document.addEventListener('submit', event => {
      if (!event.target.id.startsWith('wl')) return;
      event.preventDefault();
      try {
        if (event.target.id !== 'wlCompose') submit(event.target);
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    document.addEventListener('input', event => {
      if (event.target.id === 'wlSubjectSearch') {
        subjectQuery = event.target.value;
        $('wlSubjectCards').innerHTML = subjectCards();
      }
      if (event.target.id === 'wlSnippetSearch') {
        query = event.target.value;
        $('wlSnippetCards').innerHTML = cards();
      }
      if (event.target.closest?.('#wlCompose')) updatePreview();
      if (event.target.id === 'wlFieldSearch') {
        fieldQuery = event.target.value;
        const q = fieldQuery.toLowerCase();
        $('wlFieldRows').innerHTML = fieldRows(
          data().fields.filter(f =>
            (f.name + ' ' + f.definition.key + ' ' + f.definition.label).toLowerCase().includes(q)
          )
        );
      }
    });
    document.addEventListener('change', event => {
      if (
        event.target.form === compose?.form &&
        compose?.subject &&
        ['sourceKind', 'sourceRecord'].includes(event.target.name)
      )
        fillSubjectSource(event.target.form, event.target.name === 'sourceKind');
      if (event.target.name === 'copyFormat' && event.target.form?.id === 'wlCompose')
        updatePreview();
      if (event.target.name === 'timelineFilter' && timelineState) {
        timelineState.filter = event.target.value;
        timelineState.page = 0;
        timelineView();
      }
    });
    return {
      sync,
      render,
      mount,
      decorateModal,
      handle,
      submit,
      snippetEditor,
      bundleManager,
      composer,
      chooseSnippet,
      openFields,
      fieldEditor,
      openTimeline,
      recordTools,
      copyMessage,
    };
  }
  root.WorkHubWorkLibrary = { install };
})(window);
