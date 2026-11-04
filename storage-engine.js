/** On-demand storage accounting and lossless archive plans. Never writes or coerces record values. */
(function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const bytes = value =>
    new TextEncoder().encode(typeof value === 'string' ? value : JSON.stringify(value)).length;
  const get = (value, path) => path.split('.').reduce((v, key) => v?.[key], value);
  const safe = key => !['__proto__', 'prototype', 'constructor'].includes(key);
  const key = (path, id) => JSON.stringify([path, id]);
  const closed = r => ['closed', 'completed'].includes(String(r.status || '').toLowerCase());
  const collections = [
    { path: 'tasks', name: 'Completed tasks', feature: 'tasks', eligible: r => r.done === true },
    { path: 'tickets', name: 'Closed tickets', feature: 'tickets', eligible: closed },
    { path: 'specs', name: 'Completed project items', feature: 'specs', eligible: closed },
    {
      path: 'schedule',
      name: 'Past schedule entries',
      feature: 'schedule',
      eligible: (r, today) => !!r.date && r.date < today,
    },
    {
      path: 'workhub.validator.runs',
      name: 'Validation run history',
      feature: 'validator',
      eligible: () => true,
    },
    {
      path: 'workhub.sessions',
      name: 'Saved work sessions',
      feature: 'studio.sessions',
      eligible: () => true,
    },
    {
      path: 'workhub.notebook.notes',
      name: 'Notes in Trash',
      feature: 'notes',
      eligible: r => r.trashed === true,
    },
    {
      path: 'workhub.scrapbook',
      name: 'Scrapbook entries',
      feature: 'studio.scrapbook',
      eligible: () => true,
    },
  ];
  const descriptor = path => collections.find(c => c.path === path);
  function label(r) {
    return String(
      r.title || r.task || r.ticket || r.description || r.templateName || r.text || r.name || r.id
    ).slice(0, 180);
  }
  function date(r) {
    return String(
      r.doneDate ||
        r.historyDate ||
        r.date ||
        r.completedAt ||
        r.endedAt ||
        r.at ||
        r.start ||
        r.createdAt ||
        r.updatedAt ||
        r.created ||
        ''
    ).slice(0, 10);
  }
  function candidates(data, { path = '', before = '', today = '9999-12-31' } = {}) {
    return collections
      .filter(c => !path || c.path === path)
      .flatMap(c =>
        (get(data, c.path) || [])
          .filter(
            r =>
              r &&
              typeof r.id === 'string' &&
              r.id &&
              c.eligible(r, today) &&
              (!before || (date(r) && date(r) < before))
          )
          .map(r => ({
            key: key(c.path, r.id),
            path: c.path,
            id: r.id,
            title: label(r),
            date: date(r),
            bytes: bytes(r),
            feature: c.feature,
          }))
      );
  }
  function overview(data, features = []) {
    const parts = [],
      seen = new Set();
    const add = (path, name) => {
      if (seen.has(path)) return;
      seen.add(path);
      const v = get(data, path);
      if (v !== undefined)
        parts.push({ path, name, bytes: bytes(v), count: Array.isArray(v) ? v.length : null });
    };
    // Partition the document once; no overlap between parent and child buckets.
    const names = new Map(features.flatMap(f => f.paths.map(p => [p, f.name])));
    for (const k of Object.keys(data)) {
      if (k === 'workhub')
        for (const p of Object.keys(data.workhub || {})) {
          const path = 'workhub.' + p;
          add(
            path,
            names.get(path) ||
              {
                validator: 'Validation Studio',
                notebook: 'Personal notes',
                solutionStudio: 'Solution Studio',
                projectPeople: 'Project people',
                workLibrary: 'Snippets & library',
                myDay: 'My day',
                preferences: 'Appearance & settings',
              }[p] ||
              p.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())
          );
        }
      else add(k, names.get(k) || k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()));
    }
    const grouped = new Map();
    for (const part of parts) {
      const existing = grouped.get(part.name);
      if (existing) {
        existing.bytes += part.bytes;
        existing.count =
          existing.count !== null && part.count !== null ? existing.count + part.count : null;
      } else grouped.set(part.name, { ...part });
    }
    const sections = [...grouped.values()].sort((a, b) => b.bytes - a.bytes);
    return { bytes: bytes(data), parts: sections };
  }
  function selectedRows(data, selection) {
    if (
      !Array.isArray(selection) ||
      selection.length > 20000 ||
      new Set(selection).size !== selection.length
    )
      throw Error('Choose a valid record selection.');
    return selection.map(k => {
      let path, id;
      try {
        [path, id] = JSON.parse(k);
      } catch {
        throw Error('Invalid archive selection.');
      }
      if (!descriptor(path) || typeof id !== 'string')
        throw Error('Unsupported archive selection.');
      const rows = get(data, path),
        matches = Array.isArray(rows) ? rows.filter(r => r.id === id) : [];
      if (matches.length !== 1)
        throw Error('A selected record is missing or has an ambiguous identifier.');
      return { key: k, path, id, row: matches[0], title: label(matches[0]) };
    });
  }
  function ownership(data) {
    const result = new Map();
    const add = (parentPath, id, path, row) => {
      const k = key(parentPath, id);
      if (!result.has(k)) result.set(k, []);
      result.get(k).push({ path, id: row.id, row });
    };
    for (const row of data.workhub?.batchA?.records || [])
      if (['tasks', 'tickets', 'specs'].includes(row.kind))
        add(row.kind, row.recordId, 'workhub.batchA.records', row);
    for (const row of data.workhub?.ticketClosures || [])
      add('tickets', row.id, 'workhub.ticketClosures', row);
    for (const row of data.workhub?.myDay?.taskProfiles || [])
      add('tasks', row.id, 'workhub.myDay.taskProfiles', row);
    return result;
  }
  function cleanup(data, selection, today) {
    const selected = selectedRows(data, selection),
      owners = new WeakMap(),
      tokens = new Map(),
      ticketTokens = new Map(),
      inbound = new Map(),
      blocked = new Map(),
      owned = ownership(data);
    for (const s of selected) {
      owners.set(s.row, s.key);
      inbound.set(s.key, new Set());
      if (!descriptor(s.path).eligible(s.row, today))
        blocked.set(s.key, 'This record is no longer eligible for cleanup.');
      const identifiers = new Set([s.id]);
      const collect = v => {
        if (!v || typeof v !== 'object') return;
        if (typeof v.id === 'string' && v.id) identifiers.add(v.id);
        for (const child of Object.values(v))
          if (child && typeof child === 'object') collect(child);
      };
      collect(s.row);
      for (const attached of owned.get(s.key) || []) {
        owners.set(attached.row, s.key);
        collect(attached.row);
      }
      for (const token of identifiers) {
        if (!tokens.has(token)) tokens.set(token, new Set());
        tokens.get(token).add(s.key);
      }
      if (s.path === 'tickets' && s.row.ticket) {
        const token = s.row.ticket.trim().toLowerCase();
        if (!ticketTokens.has(token)) ticketTokens.set(token, new Set());
        ticketTokens.get(token).add(s.key);
      }
    }
    const reference = (token, owner) => {
      for (const target of [
        ...(tokens.get(token) || []),
        ...(ticketTokens.get(token.trim().toLowerCase()) || []),
      ])
        if (target !== owner) inbound.get(target).add(owner);
    };
    const walk = (value, owner = '') => {
      // Historical snapshots already support deleted records and stay unchanged.
      if (value === data.workhub?.workLibrary?.events) return;
      if (typeof value === 'string') {
        reference(value, owner);
        return;
      }
      if (!value || typeof value !== 'object') return;
      owner = owners.get(value) || owner;
      for (const [k, v] of Object.entries(value)) {
        reference(k, owner);
        walk(v, owner);
      }
    };
    walk(data);
    const pending = [];
    for (const s of selected)
      if ([...inbound.get(s.key)].some(owner => !inbound.has(owner)))
        blocked.set(s.key, 'Still referenced by records or settings that will remain online.');
    for (const k of blocked.keys()) pending.push(k);
    // If a retained selection references another selection, retain that one too.
    const outgoing = new Map();
    for (const [target, sources] of inbound)
      for (const source of sources) {
        if (!outgoing.has(source)) outgoing.set(source, []);
        outgoing.get(source).push(target);
      }
    for (let i = 0; i < pending.length; i++)
      for (const target of outgoing.get(pending[i]) || [])
        if (!blocked.has(target)) {
          blocked.set(target, 'Needed by another record kept online.');
          pending.push(target);
        }
    const removable = selected.filter(s => !blocked.has(s.key)),
      next = copy(data),
      byPath = new Map();
    for (const s of removable) {
      if (!byPath.has(s.path)) byPath.set(s.path, new Set());
      byPath.get(s.path).add(s.id);
    }
    for (const [path, ids] of byPath)
      setArray(
        next,
        path,
        get(next, path).filter(r => !ids.has(r.id))
      );
    const attachments = removable.flatMap(s => owned.get(s.key) || []),
      removeOwned = new Map();
    for (const row of attachments) {
      if (!removeOwned.has(row.path)) removeOwned.set(row.path, new Set());
      removeOwned.get(row.path).add(row.id);
    }
    for (const [path, ids] of removeOwned)
      setArray(
        next,
        path,
        get(next, path).filter(r => !ids.has(r.id))
      );
    return {
      next,
      removable,
      protected: selected
        .filter(s => blocked.has(s.key))
        .map(s => ({ ...s, reason: blocked.get(s.key) })),
      savings: bytes(data) - bytes(next),
      ownedCount: attachments.length,
    };
  }
  function setArray(data, path, value) {
    const parts = path.split('.');
    if (parts.some(k => !safe(k))) throw Error('Unsafe archive path.');
    const last = parts.pop();
    let parent = data;
    for (const p of parts) {
      if (!parent[p] || typeof parent[p] !== 'object' || Array.isArray(parent[p]))
        throw Error('A required parent section is missing.');
      parent = parent[p];
    }
    parent[last] = value;
  }
  // Outermost record arrays are the units of restoration; nested children stay with their parent.
  function units(data) {
    const list = [],
      ids = new Map();
    function visit(v, path) {
      if (Array.isArray(v)) {
        if (
          v.length &&
          v.every(r => r && typeof r === 'object' && typeof r.id === 'string' && r.id)
        ) {
          for (const row of v)
            list.push({
              key: key(path, row.id),
              path,
              id: row.id,
              row,
              title: label(row),
              identifiers: new Set(),
            });
        } else for (const row of v) if (row && typeof row === 'object') return; // Non-record arrays are retained as context only.
        return;
      }
      if (v && typeof v === 'object')
        for (const [k, val] of Object.entries(v)) {
          if (!safe(k)) throw Error('Unsafe archive property.');
          visit(val, path ? path + '.' + k : k);
        }
    }
    visit(data, '');
    function index(v, unit) {
      if (!v || typeof v !== 'object') return;
      if (typeof v.id === 'string') {
        unit.identifiers.add(v.id);
        if (!ids.has(v.id)) ids.set(v.id, new Set());
        ids.get(v.id).add(unit);
      }
      for (const val of Object.values(v)) if (val && typeof val === 'object') index(val, unit);
    }
    for (const u of list) index(u.row, u);
    return { list, byKey: new Map(list.map(u => [u.key, u])), ids };
  }
  function restore(current, archived, selection) {
    selectedRows(archived, selection);
    const source = units(archived),
      present = units(current),
      additions = new Map(),
      conflicts = [],
      unchanged = [],
      required = new Set(selection),
      pending = [],
      owned = ownership(archived),
      parentOf = new Map();
    for (const [parent, children] of owned)
      for (const child of children) parentOf.set(key(child.path, child.id), parent);
    function add(k, dependency = false) {
      const unit = source.byKey.get(k);
      if (!unit) throw Error('A selected archive record cannot be restored independently.');
      const live = present.byKey.get(k);
      if (live) {
        if (!dependency)
          (JSON.stringify(live.row) === JSON.stringify(unit.row) ? unchanged : conflicts).push(
            unit
          );
        return;
      }
      if (additions.has(k)) return;
      // Never create a duplicate nested/global identifier in a different record.
      for (const id of unit.identifiers)
        if (present.ids.has(id))
          throw Error('An archived identifier already belongs to another live record.');
      additions.set(k, { ...unit, dependency: dependency && !required.has(k) });
      pending.push(unit);
      for (const child of owned.get(k) || []) add(key(child.path, child.id), true);
    }
    for (const k of required) add(k);
    for (let i = 0; i < pending.length; i++) {
      const unit = pending[i];
      const scan = v => {
        if (typeof v === 'string') {
          const targets = source.ids.get(v);
          if (targets && !targets.has(unit)) {
            const roots = new Set([...targets].map(t => parentOf.get(t.key) || t.key));
            if (roots.size !== 1)
              throw Error('An archived dependency has an ambiguous identifier.');
            add([...roots][0], true);
          }
        } else if (v && typeof v === 'object')
          for (const [k, x] of Object.entries(v)) {
            scan(k);
            scan(x);
          }
      };
      scan(unit.row);
    }
    const next = copy(current);
    for (const u of additions.values()) {
      let rows = get(next, u.path);
      if (rows !== undefined && !Array.isArray(rows))
        throw Error('The live archive section has changed format.');
      if (rows === undefined) {
        rows = [];
        setArray(next, u.path, rows);
      }
      rows.push(copy(u.row));
    }
    return { next, additions: [...additions.values()], conflicts, unchanged };
  }
  async function hash(value) {
    if (!root.crypto?.subtle)
      throw Error(
        'Archive verification needs a secure browser connection (HTTPS). Open your published website to continue.'
      );
    const input = typeof value === 'string' ? new TextEncoder().encode(value) : value;
    return Array.from(new Uint8Array(await root.crypto.subtle.digest('SHA-256', input)), n =>
      n.toString(16).padStart(2, '0')
    ).join('');
  }
  async function pack(data, selection, owner, ZIP) {
    selectedRows(data, selection);
    const raw = JSON.stringify({ app: 'mm-ticket-tracker', version: 9, data });
    if (bytes(raw) > 16777216)
      throw Error('This workspace is too large for a storage archive (16 MiB).');
    const manifest = {
      format: 'workhub-local-archive',
      version: 1,
      owner,
      createdAt: new Date().toISOString(),
      selected: selection,
      workspaceSha256: await hash(raw),
    };
    const archive = new ZIP();
    archive.file('workspace.json', raw);
    archive.file('manifest.json', JSON.stringify(manifest));
    archive.file(
      'README.txt',
      'WorkHub local archive\nIncludes a complete safety snapshot plus the selected records.\nOpen Settings > Storage & cleanup > Local archives to inspect or selectively restore.\nKeep this file outside browser storage. It contains private workspace data and is not encrypted.\n'
    );
    const buffer = await archive.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
      streamFiles: true,
    });
    return { buffer, hash: await hash(buffer), manifest, rawBytes: bytes(raw) };
  }
  async function unpack(buffer, ZIP, validate) {
    if (buffer.byteLength > 24 * 1024 * 1024) throw Error('Choose a WorkHub archive below 24 MiB.');
    const archive = await ZIP.loadAsync(buffer),
      entries = Object.values(archive.files);
    if (
      entries.length !== 3 ||
      entries.some(
        e => !['workspace.json', 'manifest.json', 'README.txt'].includes(e.name) || e.dir
      ) ||
      entries.some(
        e =>
          !Number.isSafeInteger(e._data?.uncompressedSize) ||
          e._data.uncompressedSize > 17 * 1024 * 1024
      ) ||
      entries.reduce((n, e) => n + e._data.uncompressedSize, 0) > 18 * 1024 * 1024
    )
      throw Error('Invalid or oversized archive contents.');
    const raw = await archive.file('workspace.json').async('string'),
      manifestRaw = await archive.file('manifest.json').async('string');
    if (bytes(manifestRaw) > 2 * 1024 * 1024 || bytes(raw) > 16777216)
      throw Error('Archive contents exceed the supported size.');
    const manifest = JSON.parse(manifestRaw),
      document = JSON.parse(raw);
    if (
      manifest.format !== 'workhub-local-archive' ||
      manifest.version !== 1 ||
      typeof manifest.owner !== 'string' ||
      !manifest.owner ||
      !Number.isFinite(Date.parse(manifest.createdAt)) ||
      document.app !== 'mm-ticket-tracker' ||
      document.version !== 9 ||
      !document.data ||
      (await hash(raw)) !== manifest.workspaceSha256
    )
      throw Error('The archive is damaged or is not a supported WorkHub archive.');
    selectedRows(document.data, manifest.selected);
    validate(copy(document.data));
    return { data: document.data, manifest, hash: await hash(buffer), rawBytes: bytes(raw) };
  }
  root.WorkHubStorageEngine = {
    bytes,
    get,
    key,
    copy,
    collections,
    candidates,
    overview,
    cleanup,
    restore,
    hash,
    pack,
    unpack,
    label,
  };
})(typeof window === 'undefined' ? globalThis : window);
