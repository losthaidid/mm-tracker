/** Personal notebooks. Plain text/Markdown only; saved through the existing private document. */
(function (root) {
  'use strict';
  const LIMITS = { notes: 1000, notebooks: 50, body: 32767, history: 3, bytes: 5000000 };
  const copy = x => JSON.parse(JSON.stringify(x));
  const uid = () =>
    root.crypto?.randomUUID?.() ||
    'note-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const now = () => new Date().toISOString();
  const text = (v, max) =>
    typeof v === 'string' && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
  const stamp = v => text(v, 50) && Number.isFinite(Date.parse(v));
  const store = d => d.workhub.notebook;
  function upgrade(d) {
    if (!d.workhub) d.workhub = {};
    if (d.workhub.notebook === undefined)
      d.workhub.notebook = { version: 1, notebooks: [], notes: [] };
    return d;
  }
  function validate(d) {
    const h = d.workhub?.notebook;
    if (!h || h.version !== 1) throw Error('Check your personal notebooks.');
    for (const [key, max] of [
      ['notebooks', LIMITS.notebooks],
      ['notes', LIMITS.notes],
    ]) {
      const xs = h[key];
      if (
        !Array.isArray(xs) ||
        xs.length > max ||
        new Set(xs.map(x => x?.id)).size !== xs.length ||
        xs.some(x => !x || !text(x.id, 100) || !x.id)
      )
        throw Error('Check your ' + key + ' (up to ' + max + ').');
    }
    const names = new Set();
    for (const b of h.notebooks) {
      if (!text(b.name, 60) || !b.name.trim() || names.has(b.name.trim().toLowerCase()))
        throw Error('Use different notebook names of up to 60 characters.');
      names.add(b.name.trim().toLowerCase());
    }
    const books = new Set(h.notebooks.map(b => b.id));
    for (const n of h.notes) {
      if (
        !text(n.title, 180) ||
        !n.title.trim() ||
        !text(n.body, LIMITS.body) ||
        !text(n.tags, 300) ||
        !text(n.notebookId, 100) ||
        (n.notebookId && !books.has(n.notebookId)) ||
        !text(n.projectId, 100) ||
        !Array.isArray(n.companyIds) ||
        n.companyIds.length > 200 ||
        new Set(n.companyIds).size !== n.companyIds.length ||
        n.companyIds.some(id => !text(id, 100) || !id) ||
        !text(n.ticketId, 100) ||
        typeof n.pinned !== 'boolean' ||
        typeof n.trashed !== 'boolean' ||
        !stamp(n.createdAt) ||
        !stamp(n.updatedAt) ||
        !Array.isArray(n.history) ||
        n.history.length > LIMITS.history ||
        n.history.some(
          v =>
            !v ||
            !text(v.id, 100) ||
            !v.id ||
            !stamp(v.at) ||
            !text(v.title, 180) ||
            !text(v.body, LIMITS.body)
        )
      )
        throw Error('Check your note title, content and linked details.');
    }
    if (new Blob([JSON.stringify(h)]).size > LIMITS.bytes)
      throw Error(
        'Your notes have reached 5 MB. Export and shorten older notes before adding more.'
      );
  }
  function create(notebookId = '') {
    const at = now();
    return {
      id: uid(),
      title: '',
      body: '',
      tags: '',
      notebookId,
      projectId: '',
      companyIds: [],
      ticketId: '',
      pinned: false,
      trashed: false,
      createdAt: at,
      updatedAt: at,
      history: [],
    };
  }
  function put(d, draft, expected = null) {
    const h = store(d),
      i = h.notes.findIndex(n => n.id === draft.id),
      old = h.notes[i];
    if (
      (expected && (!old || JSON.stringify(old) !== JSON.stringify(expected))) ||
      (!expected && old)
    )
      throw Error('This note changed elsewhere. Save a copy of your draft to keep both versions.');
    if (!draft.title.trim() && !draft.body.trim())
      throw Error('Write a title or a little content first.');
    const n = {
      ...copy(draft),
      title: draft.title.trim() || 'Untitled note',
      updatedAt: now(),
      history: copy(old?.history || []),
    };
    if (
      old &&
      (old.title !== n.title || old.body !== n.body) &&
      (!n.history.length || Date.parse(n.updatedAt) - Date.parse(n.history[0].at) >= 60000)
    )
      n.history.unshift({ id: uid(), at: n.updatedAt, title: old.title, body: old.body });
    n.history = n.history.slice(0, LIMITS.history);
    if (old) h.notes[i] = n;
    else h.notes.push(n);
    validate(d);
    return n;
  }
  function notebook(d, id, name) {
    name = String(name || '').trim();
    const h = store(d),
      existing = h.notebooks.find(b => b.id === id);
    if (id && !existing) throw Error('This notebook no longer exists.');
    const b = existing || { id: uid(), name };
    if (!existing) h.notebooks.push(b);
    b.name = name;
    validate(d);
    return b;
  }
  function find(d, { query = '', notebookId = '', filter = 'all', sort = 'updated' } = {}) {
    const q = query.trim().toLocaleLowerCase();
    return store(d)
      .notes.filter(
        n =>
          n.trashed === (filter === 'trash') &&
          (filter !== 'pinned' || n.pinned) &&
          (!notebookId || n.notebookId === notebookId) &&
          (!q || [n.title, n.body, n.tags].join(' ').toLocaleLowerCase().includes(q))
      )
      .sort((a, b) =>
        sort === 'title'
          ? a.title.localeCompare(b.title)
          : Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)
      );
  }
  const esc = v =>
    String(v).replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const inline = value =>
    esc(value)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(
        /\[([^\]\n]+)\]\((https?:\/\/[^\s<>]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
      );
  function markdown(body) {
    return String(body)
      .split('\n')
      .map((line, index) => {
        const heading = line.match(/^(#{1,3})\s+(.+)$/),
          check = line.match(/^\s*- \[([ xX])\]\s?(.*)$/),
          bullet = line.match(/^\s*[-*]\s+(.*)$/);
        if (heading)
          return (
            '<h' +
            (heading[1].length + 1) +
            '>' +
            inline(heading[2]) +
            '</h' +
            (heading[1].length + 1) +
            '>'
          );
        if (check)
          return (
            '<label class="nt-check"><input type="checkbox" data-nt-check="' +
            index +
            '"' +
            (check[1] !== ' ' ? ' checked' : '') +
            '><span>' +
            inline(check[2]) +
            '</span></label>'
          );
        if (bullet) return '<p class="nt-bullet">' + inline(bullet[1]) + '</p>';
        return line.trim() ? '<p>' + inline(line) + '</p>' : '<div class="nt-line-gap"></div>';
      })
      .join('');
  }
  root.WorkHubNotesEngine = {
    LIMITS,
    copy,
    uid,
    store,
    upgrade,
    validate,
    create,
    put,
    notebook,
    find,
    markdown,
  };
})(window);
