(function knowledgeGarden(root) {
  'use strict';
  const { escape: esc, option, matrix, references, button } = root.WorkHubLearning;
  const catalog = root.WorkHubLearning.asset('mm-101.json');
  const shelfIds = {
    Foundations: 'foundations',
    Purchasing: 'purchasing',
    'Inventory & special procurement': 'inventory',
    'Valuation & invoice verification': 'valuation',
    'Expert practice': 'expert',
  };
  const bookId = 'sap-mm-101';
  const defaults = [
    { id: bookId, name: 'SAP MM 101', parentId: '' },
    ...Object.entries(shelfIds).map(([name, key]) => ({
      id: bookId + '-' + key,
      name,
      parentId: bookId,
    })),
  ];
  const folders = h => (h.knowledgeFolders === undefined ? defaults : h.knowledgeFolders);
  function trail(list, id) {
    const path = [],
      seen = new Set();
    const byId = new Map(list.map(f => [f.id, f]));
    while (id && byId.has(id) && !seen.has(id)) {
      seen.add(id);
      const f = byId.get(id);
      path.unshift(f);
      id = f.parentId;
    }
    return path;
  }
  const validText = (s, max) =>
    typeof s === 'string' && s.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s);
  const validId = s => validText(s, 100) && !!s.trim();
  function validate(h) {
    const list = folders(h);
    if (!Array.isArray(list) || list.length > 256) throw Error('Use up to 256 knowledge folders.');
    const ids = new Set(),
      names = new Set();
    for (const f of list) {
      if (
        !f ||
        !validId(f.id) ||
        ids.has(f.id) ||
        !validText(f.name, 100) ||
        !f.name.trim() ||
        !validText(f.parentId, 100)
      )
        throw Error('Check the knowledge folder name or identifier.');
      const key = JSON.stringify([f.parentId, f.name.trim().toLowerCase()]);
      if (names.has(key)) throw Error('A folder with this name already exists here.');
      ids.add(f.id);
      names.add(key);
    }
    for (const f of list) {
      const path = trail(list, f.id);
      if (path[0].parentId) throw Error('Choose an existing parent folder outside this folder.');
    }
    const records = h.knowledgeChapters === undefined ? {} : h.knowledgeChapters;
    if (
      !records ||
      typeof records !== 'object' ||
      Array.isArray(records) ||
      Object.keys(records).length > 2000
    )
      throw Error('Check the knowledge chapters.');
    for (const [id, r] of Object.entries(records)) {
      if (
        !r ||
        typeof r !== 'object' ||
        Array.isArray(r) ||
        !/^[a-z0-9][a-z0-9-]{0,99}$/.test(id) ||
        ('title' in r && (!validText(r.title, 500) || !r.title.trim())) ||
        ('body' in r && !validText(r.body, 32767)) ||
        ('removed' in r && typeof r.removed !== 'boolean') ||
        ('folderId' in r && (!validText(r.folderId, 100) || (r.folderId && !ids.has(r.folderId))))
      )
        throw Error('Check the chapter title, text or folder.');
    }
    for (const n of h.notes || [])
      if ('folderId' in n && (!validText(n.folderId, 100) || (n.folderId && !ids.has(n.folderId))))
        throw Error('Choose an existing folder for the knowledge note.');
  }
  const baseBody = c =>
    [c.lead, ...c.sections.map(([heading, prose]) => '## ' + heading + '\n' + prose)].join('\n\n');
  function chapterRows(h) {
    const changes = h.knowledgeChapters || {},
      ids = new Set(folders(h).map(f => f.id));
    return catalog.rows
      .map(c => {
        const user = changes[c.id] || {},
          folderId = user.folderId ?? bookId + '-' + shelfIds[c.shelf];
        return {
          id: c.id,
          title: user.title ?? c.title,
          body: user.body ?? baseBody(c),
          folderId: ids.has(folderId) ? folderId : '',
          level: c.level,
          source: c,
          removed: user.removed === true,
        };
      })
      .filter(r => !r.removed);
  }
  function updateChapter(h, id, patch) {
    const rows = (h.knowledgeChapters ??= {});
    rows[id] = { ...rows[id], ...patch };
  }
  function removeFolder(h, id) {
    const old = folders(h),
      target = old.find(f => f.id === id);
    if (!target) throw Error('This folder no longer exists.');
    const parent = target.parentId;
    for (const c of chapterRows(h))
      if (c.folderId === id) updateChapter(h, c.id, { folderId: parent });
    for (const c of Object.values(h.knowledgeChapters || {}))
      if (c.folderId === id) c.folderId = parent;
    for (const n of h.notes) if (n.folderId === id) n.folderId = parent;
    const names = new Set(
      old.filter(f => f.id !== id && f.parentId === parent).map(f => f.name.trim().toLowerCase())
    );
    h.knowledgeFolders = old
      .filter(f => f.id !== id)
      .map(f => {
        if (f.parentId !== id) return f;
        let name = f.name,
          copy = 2;
        while (names.has(name.trim().toLowerCase())) {
          const suffix = ' (' + copy++ + ')';
          name = f.name.trim().slice(0, 100 - suffix.length) + suffix;
        }
        names.add(name.trim().toLowerCase());
        return { ...f, name, parentId: parent };
      });
  }
  function folderOptions(h, id) {
    return (
      option('', 'Unfiled', id) +
      folders(h)
        .map(f => [
          f.id,
          trail(folders(h), f.id)
            .map(x => x.name)
            .join(' / '),
        ])
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([v, label]) => option(v, label, id))
        .join('')
    );
  }
  const btn = (action, label, id = '', extra = '') => button('kg', action, label, id, extra);
  function exhibits(c) {
    const flow = c.flow?.length
      ? `<figure class="learn-flow"><figcaption>Follow the example</figcaption><ol>${c.flow.map(v => `<li>${esc(v)}</li>`).join('')}</ol></figure>`
      : '';
    let chart = '';
    if (c.chart) {
      const [title, unit, values] = c.chart,
        max = Math.max(1, ...values.map(v => v[1]));
      chart = `<figure class="learn-chart"><figcaption>${esc(title)}</figcaption>${values.map(([label, n]) => `<div><span>${esc(label)}</span><meter min="0" max="${max}" value="${n}" aria-label="${esc(label)}"></meter><strong>${esc(n.toLocaleString())} ${esc(unit)}</strong></div>`).join('')}</figure>`;
    }
    return flow + chart + matrix(c.visual.title, c.visual.headers, c.visual.rows);
  }
  function prose(body) {
    return body
      .split('\n\n')
      .map(part => {
        if (part.startsWith('## ')) {
          const [head, ...rest] = part.slice(3).split('\n');
          return `<h3>${esc(head)}</h3>${rest.length ? `<p>${esc(rest.join('\n'))}</p>` : ''}`;
        }
        return `<p>${esc(part)}</p>`;
      })
      .join('');
  }
  function install(a) {
    let current = '',
      identity = '',
      level = '',
      editor = null;
    const h = () => a.state().workhub,
      token = () => (a.ready() ? JSON.stringify([a.owner(), a.generation()]) : '');
    const can = (op = 'view') => !!token() && a.can('knowledge', op);
    const active = () => a.active() && can();
    function sync() {
      const next = token();
      if (next !== identity) {
        current = level = '';
        identity = next;
        editor = null;
      }
      if (current && !folders(h()).some(f => f.id === current)) current = '';
      const modal = document.querySelector('#modal[open] [data-kg-session]');
      if (
        modal &&
        (!active() ||
          modal.dataset.kgSession !== next ||
          (modal.id === 'kgEdit' && !can(editor?.action === 'add' ? 'create' : 'edit')))
      )
        a.closeModal();
      const note = document.querySelector('#modal[open] #hubNote[data-knowledge-session]');
      if (
        note &&
        (note.dataset.knowledgeSession !== next || !can(note.dataset.id ? 'edit' : 'create'))
      )
        a.closeModal();
    }
    function guard(op = 'view', expected = identity) {
      if (!active() || expected !== token() || !can(op))
        throw Error('Reopen Knowledge with permission for this action.');
    }
    function refresh() {
      if (active() && document.getElementById('kgNav')) a.render();
    }
    function inScope(folderId, query) {
      if (!query && !level) return (folderId || '') === current;
      return !current || trail(folders(h()), folderId).some(f => f.id === current);
    }
    const matchesNote = (n, q) => !level && inScope(n.folderId, q);
    function navigate(id) {
      current = id;
      level = '';
      a.clearSearch();
      a.render();
      document.getElementById('kgNav')?.focus({ preventScroll: true });
    }
    function panel(query) {
      sync();
      if (!active()) return '';
      catalog.load(refresh);
      const fs = folders(h()),
        path = trail(fs, current),
        kids = fs.filter(f => f.parentId === current);
      const levels = ['Foundation', 'Practitioner', 'Advanced', 'Expert'];
      return `<section id="kgNav" class="kg-nav" data-access-feature="knowledge" tabindex="-1" aria-label="Knowledge folders" data-kg-session="${esc(identity)}"><nav aria-label="Folder location">${btn('folder', 'Library')}${path.map(f => `<span aria-hidden="true"> / </span>${btn('folder', f.name, f.id)}`).join('')}</nav>
        <div class="kg-bar"><h3>${esc(path.at(-1)?.name || 'My library')}</h3><div class="actions">${can('create') ? btn('add', 'New folder') : ''}${current && can('edit') ? btn('rename', 'Rename folder', current) : ''}${current && can('delete') ? btn('remove-folder', 'Delete folder', current) : ''}</div></div>
        ${kids.length && !query && !level ? `<div class="kg-shelves">${kids.map(f => btn('folder', f.name, f.id, 'class="kg-shelf"')).join('')}</div>` : ''}
        <label class="kg-level">Reading level <select id="kgLevel">${option('', 'All levels', level)}${levels.map(v => option(v, v, level)).join('')}</select></label></section>`;
    }
    function cards(query) {
      const needle = query.trim().toLowerCase();
      if (!catalog.loaded)
        return {
          html: catalog.failed
            ? `<p role="status">The reading collection could not load. ${btn('retry', 'Retry chapters')}</p>`
            : '<p role="status">Loading the reading collection…</p>',
          count: 0,
        };
      const rows = chapterRows(h()).filter(
        c =>
          inScope(c.folderId, needle) &&
          (!level || c.level === level) &&
          (!needle ||
            [c.title, c.body, c.level, c.source.shelf].join(' ').toLowerCase().includes(needle))
      );
      return {
        count: rows.length,
        html: rows
          .map(
            c =>
              `<article class="hub-card kg-chapter"><span class="kg-depth">${esc(c.level)}</span><h3>${esc(c.title)}</h3><p>${esc(c.body.split('\n')[0].slice(0, 205))}</p>${btn('read', 'Read chapter', c.id)}</article>`
          )
          .join(''),
      };
    }
    function readChapter(c) {
      const body = c.body.split(/\n\n(?=## )/);
      const excerpt = body.shift() || '';
      a.openModal(
        c.title,
        `<article class="kg-reader" data-access-feature="knowledge" data-kg-session="${esc(identity)}"><p class="kg-depth">${esc(c.level)} · ${esc(c.source.shelf)}</p>${prose(excerpt)}${exhibits(c.source)}${prose(body.join('\n\n'))}<h3>SAP references and release context</h3>${references(c.source.refs)}<div class="actions">${can('edit') ? btn('edit', 'Edit or move chapter', c.id) : ''}</div></article>`
      );
      document.getElementById('modalBody').scrollTop = 0;
    }
    function edit(action, id) {
      const chapter = action === 'edit',
        list = folders(h()),
        value = chapter ? chapterRows(h()).find(c => c.id === id) : list.find(f => f.id === id);
      if (action !== 'add' && !value) throw Error('This entry no longer exists.');
      editor = {
        key: token(),
        action,
        id,
        expected: chapter
          ? JSON.stringify(h().knowledgeChapters?.[id] || null)
          : JSON.stringify(value || null),
        parent: current,
      };
      const title = chapter ? 'Edit chapter' : action === 'add' ? 'New folder' : 'Rename folder';
      a.openModal(
        title,
        `<form id="kgEdit" data-id="${esc(id)}" data-access-feature="knowledge" data-kg-session="${esc(identity)}" class="kg-form"><label>${chapter ? 'Chapter title' : 'Folder name'}<input name="name" maxlength="${chapter ? 500 : 100}" required value="${esc(chapter ? value.title : action === 'rename' ? value.name : '')}"></label>${chapter ? `<label>Folder<select name="folderId">${folderOptions(h(), value.folderId)}</select></label><label>Chapter text<textarea name="body" rows="16" maxlength="32767" required>${esc(value.body)}</textarea></label>` : ''}<div class="modal-actions">${btn('cancel', 'Cancel')}<button type="submit" class="primary">Save</button></div></form>`
      );
    }
    document.addEventListener('click', async ev => {
      const el = ev.target.closest?.('[data-kg]');
      if (!el) return;
      try {
        const action = el.dataset.kg,
          id = el.dataset.id,
          key = el.closest('[data-kg-session]')?.dataset.kgSession ?? identity;
        guard('view', key);
        if (action === 'folder') {
          if (!id || folders(h()).some(f => f.id === id)) navigate(id);
          return;
        }
        if (action === 'retry') {
          catalog.retry(refresh);
          a.render();
          return;
        }
        if (action === 'cancel') {
          editor = null;
          a.closeModal();
          return;
        }
        if (action === 'read') {
          const c = chapterRows(h()).find(r => r.id === id);
          if (c) readChapter(c);
          return;
        }
        if (action === 'remove-folder') {
          guard('delete', key);
          if (!catalog.loaded) throw Error('Load the reading collection before deleting a folder.');
          const folder = folders(h()).find(f => f.id === id);
          if (!folder) return;
          if (
            !(await root.WorkHubDialogs.confirm(
              'Delete “' + folder.name + '”? Its notes and subfolders will move up one level.'
            ))
          )
            return;
          guard('delete', key);
          if (JSON.stringify(folders(h()).find(f => f.id === id)) !== JSON.stringify(folder))
            throw Error('This folder changed. Reopen it to delete it.');
          if (a.mutate(d => removeFolder(d.workhub, id))) navigate(folder.parentId);
          return;
        }
        if (['add', 'edit', 'rename'].includes(action)) {
          guard(action === 'add' ? 'create' : 'edit', key);
          edit(action, id);
        }
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    document.addEventListener('change', ev => {
      if (ev.target.id === 'kgLevel' && active()) {
        level = ev.target.value;
        a.render();
        document.getElementById('kgLevel')?.focus();
      }
    });
    document.addEventListener('submit', ev => {
      const form = ev.target;
      if (form.id !== 'kgEdit') return;
      ev.preventDefault();
      try {
        if (!editor || !form.isConnected || form !== document.getElementById('kgEdit'))
          throw Error('Reopen this editor.');
        const { action, id, key, expected, parent } = editor;
        guard(action === 'add' ? 'create' : 'edit', key);
        const title = form.elements.name.value.trim();
        if (!title) throw Error('Enter a name.');
        const ok = a.mutate(d => {
          const data = d.workhub,
            fs = folders(data);
          if (action === 'edit') {
            if (expected !== JSON.stringify(data.knowledgeChapters?.[id] || null))
              throw Error('This chapter changed. Reopen it before saving.');
            const body = form.elements.body.value.trim(),
              folderId = form.elements.folderId.value;
            if (!body) throw Error('Enter chapter text.');
            const c = chapterRows(data).find(c => c.id === id);
            if (!c) throw Error('This chapter no longer exists.');
            const patch = { folderId };
            if (body !== c.body) patch.body = body;
            if (title !== c.title) patch.title = title;
            updateChapter(data, id, patch);
          } else if (action === 'add') {
            if (parent && !fs.some(f => f.id === parent))
              throw Error('The parent folder was removed.');
            data.knowledgeFolders = [
              ...fs,
              { id: root.crypto.randomUUID(), parentId: parent, name: title },
            ];
          } else {
            const f = fs.find(r => r.id === id);
            if (!f || JSON.stringify(f) !== expected)
              throw Error('This folder changed. Reopen it before saving.');
            data.knowledgeFolders = fs.map(r => (r.id === id ? { ...r, name: title } : r));
          }
          validate(data);
        });
        if (ok) {
          editor = null;
          a.closeModal();
          a.tell('Saved.');
        }
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    return {
      panel,
      cards,
      matchesNote,
      sync,
      session: token,
      folderSelect(note) {
        sync();
        return `<div><label for="kgNoteFolder">Folder</label><select id="kgNoteFolder" name="folderId">${folderOptions(h(), note.id ? note.folderId || '' : current)}</select></div>`;
      },
      hasChildren: () => !level && folders(h()).some(f => f.parentId === current),
    };
  }
  root.WorkHubKnowledgeGarden = Object.freeze({ install, validate, folders, trail, removeFolder });
})(globalThis);
