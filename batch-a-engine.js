/**
 * batch-a-engine.js
 * Workflow rules: dependencies, record context, labels, glossary and stale-work summaries.
 * Saved under state.workhub.batchA. Pure helpers operate on supplied documents.
 * Cycle checks and context preservation protect existing work when linking or splitting tasks.
 * File map: docs/FILE-MAP.md
 */
/* Batch A: account-owned workflow context and pure calculations. */
(function (root) {
  'use strict';
  const KINDS = ['tasks', 'tickets', 'specs', 'notes', 'projects'];
  const DEPENDENCIES = {
    task: 'Task prerequisite',
    approval: 'Approval',
    document: 'Document',
    event: 'External event',
  };
  const PAUSES = {
    approval: 'Waiting for approval',
    information: 'Missing information',
    blocker: 'Blocked',
    break: 'Taking a break',
    other: 'Other',
  };
  const OUTCOMES = {
    implemented: 'Implemented',
    workaround: 'Resolved by workaround',
    duplicate: 'Duplicate',
    'not-needed': 'No longer needed',
  };
  const copy = x => JSON.parse(JSON.stringify(x));
  const uid = () =>
    root.crypto?.randomUUID?.() ||
    'batch-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const iso = () => new Date().toISOString();
  const rows = (d, kind) => (kind === 'notes' ? d.workhub?.notes || [] : d[kind] || []);
  const record = (d, kind, id) => rows(d, kind).find(r => r.id === id);
  const key = (kind, id) => kind + ':' + id;
  const store = d => d.workhub.batchA;
  const meta = (d, kind, id) => store(d).records.find(r => r.id === key(kind, id));
  const title = (r, kind) =>
    kind === 'tasks'
      ? r.task
      : kind === 'tickets'
        ? [r.ticket, r.description].filter(Boolean).join(' · ')
        : kind === 'specs'
          ? r.description
          : kind === 'projects'
            ? r.name
            : r.title;
  const closed = (r, kind) =>
    kind === 'tasks'
      ? r.done || r.archived
      : kind === 'tickets'
        ? ['Closed', 'Completed'].includes(r.status)
        : kind === 'specs'
          ? r.status === 'Completed'
          : false;
  function upgrade(d) {
    if (!d?.workhub) return d;
    if (d.workhub.batchA === undefined)
      d.workhub.batchA = {
        version: 1,
        staleDays: 14,
        records: [],
        labels: [],
        environments: [
          { id: 'dev', name: 'DEV' },
          { id: 'qas', name: 'QAS' },
          { id: 'prd', name: 'PRD' },
        ],
        glossary: [],
      };
    return d;
  }
  function touch(d, kind, id, at = iso()) {
    if (!KINDS.includes(kind) || !record(d, kind, id)) throw Error('This record no longer exists.');
    let r = meta(d, kind, id);
    if (!r) {
      r = {
        id: key(kind, id),
        kind,
        recordId: id,
        createdAt: at,
        updatedAt: at,
        labelIds: [],
        environmentId: '',
        systemId: '',
        client: '',
        dependencies: [],
        pause: null,
        nextStep: '',
        lastSessionId: '',
        outcome: '',
        outcomeNote: '',
        splitFrom: '',
      };
      store(d).records.push(r);
    }
    return r;
  }
  function patch(d, kind, id, values) {
    const m = touch(d, kind, id);
    Object.assign(m, values, { updatedAt: iso() });
    return m;
  }
  function dependencyState(d, dep) {
    if (dep.type === 'task') {
      const t = record(d, 'tasks', dep.targetId);
      return {
        done: !!t?.done,
        title: t?.task || dep.title || 'Removed task — review this prerequisite',
        missing: !t,
      };
    }
    return { done: dep.resolved, title: dep.title, missing: false };
  }
  function blockers(d, id) {
    return (meta(d, 'tasks', id)?.dependencies || []).filter(x => !dependencyState(d, x).done);
  }
  function checkCycles(d) {
    const edges = new Map(
      store(d)
        .records.filter(m => m.kind === 'tasks')
        .map(m => [
          m.recordId,
          m.dependencies
            .filter(x => x.type === 'task' && record(d, 'tasks', x.targetId))
            .map(x => x.targetId),
        ])
    );
    const visited = new Set(),
      active = new Set();
    function visit(id) {
      if (active.has(id)) throw Error('Task dependencies cannot form a loop.');
      if (visited.has(id)) return;
      active.add(id);
      for (const target of edges.get(id) || []) visit(target);
      active.delete(id);
      visited.add(id);
    }
    for (const id of edges.keys()) visit(id);
  }
  function validate(d) {
    const h = d.workhub?.batchA;
    if (!h) return;
    const text = (v, n = 8000) =>
      typeof v === 'string' && v.length <= n && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
    const timestamp = v =>
      text(v, 40) && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
    const collection = (v, max, name) => {
      if (
        !Array.isArray(v) ||
        v.length > max ||
        new Set(v.map(x => x?.id)).size !== v.length ||
        v.some(x => !x || !text(x.id, 220) || !x.id)
      )
        throw Error('Check the ' + name + ' records.');
    };
    if (h.version !== 1 || !Number.isInteger(h.staleDays) || h.staleDays < 0 || h.staleDays > 365)
      throw Error('Choose 0–365 days for stale-work alerts.');
    collection(h.records, 22000, 'work context');
    collection(h.labels, 100, 'shared label');
    collection(h.environments, 50, 'environment');
    collection(h.glossary, 1000, 'glossary');
    for (const [name, list] of [
      ['label', h.labels],
      ['environment', h.environments],
    ]) {
      if (
        list.some(x => !text(x.name, 80) || !x.name.trim()) ||
        new Set(list.map(x => x.name.trim().toLowerCase())).size !== list.length
      )
        throw Error('Use unique, non-empty ' + name + ' names of up to 80 characters.');
    }
    const labels = new Set(h.labels.map(x => x.id)),
      env = new Set(h.environments.map(x => x.id));
    for (const m of h.records) {
      if (
        !KINDS.includes(m.kind) ||
        !text(m.recordId, 100) ||
        !m.recordId ||
        m.id !== key(m.kind, m.recordId) ||
        !timestamp(m.createdAt) ||
        !timestamp(m.updatedAt) ||
        !Array.isArray(m.labelIds) ||
        m.labelIds.length > 20 ||
        new Set(m.labelIds).size !== m.labelIds.length ||
        m.labelIds.some(id => !labels.has(id)) ||
        !text(m.environmentId, 100) ||
        (m.environmentId && !env.has(m.environmentId)) ||
        !text(m.systemId, 80) ||
        !text(m.client, 40) ||
        !text(m.nextStep) ||
        !text(m.lastSessionId, 100) ||
        !text(m.splitFrom, 100) ||
        !text(m.outcomeNote) ||
        (m.outcome && !Object.hasOwn(OUTCOMES, m.outcome)) ||
        typeof m.outcome !== 'string'
      )
        throw Error('Check the work context, labels and environment.');
      if (m.reviewedAt !== undefined && !timestamp(m.reviewedAt))
        throw Error('Check the review date.');
      if (
        m.pause !== null &&
        (!m.pause ||
          !Object.hasOwn(PAUSES, m.pause.reason) ||
          !text(m.pause.notes) ||
          !timestamp(m.pause.at) ||
          typeof m.pause.active !== 'boolean')
      )
        throw Error('Choose a valid pause reason.');
      collection(m.dependencies, 40, 'dependency');
      if (m.kind !== 'tasks' && m.dependencies.length)
        throw Error('Only tasks support dependencies.');
      const targets = new Set();
      for (const dep of m.dependencies) {
        if (
          !Object.hasOwn(DEPENDENCIES, dep.type) ||
          !text(dep.title, 500) ||
          !text(dep.targetId, 100) ||
          typeof dep.resolved !== 'boolean'
        )
          throw Error('Check the dependency.');
        if (dep.type === 'task') {
          if (!dep.targetId || dep.targetId === m.recordId || targets.has(dep.targetId))
            throw Error('Choose distinct prerequisite tasks other than this task.');
          targets.add(dep.targetId);
        } else if (!dep.title.trim() || dep.targetId)
          throw Error('Give the approval, document or event a name.');
      }
    }
    const terms = new Set();
    for (const g of h.glossary) {
      const k = (g.projectId || '') + '|' + g.term?.trim().toLowerCase();
      if (
        !text(g.term, 120) ||
        !g.term.trim() ||
        !text(g.meaning) ||
        !g.meaning.trim() ||
        !text(g.aliases, 500) ||
        !text(g.context, 1000) ||
        !text(g.projectId, 100) ||
        !timestamp(g.updatedAt) ||
        terms.has(k)
      )
        throw Error('Use a unique glossary term and meaning for each project.');
      terms.add(k);
    }
    for (const s of d.workhub.sessions || [])
      for (const k of ['completedWork', 'nextStep', 'pauseReason', 'pauseNotes'])
        if (s[k] !== undefined && !text(s[k], k === 'pauseReason' ? 40 : 8000))
          throw Error('Check the session wrap-up.');
    checkCycles(d);
    if (JSON.stringify(h).length > 6000000)
      throw Error(
        'Workflow context is limited to 6 MB. Export a backup before reducing older notes.'
      );
  }
  function prepare(next, previous, restoring = false) {
    upgrade(next);
    if (restoring) return;
    const h = store(next),
      at = iso();
    h.records = h.records.filter(m => record(next, m.kind, m.recordId));
    for (const kind of KINDS) {
      const old = new Map(rows(previous || {}, kind).map(r => [r.id, r]));
      for (const r of rows(next, kind)) {
        const before = old.get(r.id);
        if (!before || JSON.stringify(before) !== JSON.stringify(r)) {
          const m = touch(next, kind, r.id, at);
          m.updatedAt = at;
        }
        const m = meta(next, kind, r.id);
        if (closed(r, kind) && m?.pause) m.pause.active = false;
      }
    }
  }
  function latestUpdate(d, kind, r) {
    const m = meta(d, kind, r.id),
      date = m?.reviewedAt && m.reviewedAt > m.updatedAt ? m.reviewedAt : m?.updatedAt;
    if (date) return date;
    return r.updatedAt || r.historyDate || r.createdAt || r.created || '';
  }
  function stale(d, today) {
    const days = store(d).staleDays;
    if (!days) return { items: [], unknown: [] };
    const at = Date.parse(today + 'T00:00:00Z'),
      items = [],
      unknown = [];
    for (const kind of ['tasks', 'tickets'])
      for (const r of rows(d, kind)) {
        if (closed(r, kind)) continue;
        const date = latestUpdate(d, kind, r),
          instant = new Date(date),
          day =
            date.includes('T') && Number.isFinite(instant.getTime())
              ? [
                  instant.getFullYear(),
                  String(instant.getMonth() + 1).padStart(2, '0'),
                  String(instant.getDate()).padStart(2, '0'),
                ].join('-')
              : date.slice(0, 10),
          value = Date.parse(day + 'T00:00:00Z');
        if (!Number.isFinite(value)) {
          unknown.push({ kind, id: r.id, title: title(r, kind) });
          continue;
        }
        const age = Math.floor((at - value) / 86400000);
        if (age >= days) items.push({ kind, id: r.id, title: title(r, kind), age, date: day });
      }
    return { items: items.sort((a, b) => b.age - a.age), unknown };
  }
  function attachSession(d, s) {
    const kind =
      s.kind === 'task'
        ? 'tasks'
        : s.kind === 'ticket'
          ? 'tickets'
          : s.kind === 'project'
            ? s.itemId
              ? 'specs'
              : 'projects'
            : '';
    const id = s.itemId || s.linkId;
    if (!kind || !record(d, kind, id)) return;
    const m = touch(d, kind, id);
    m.lastSessionId = s.id;
    m.nextStep = s.nextStep || '';
    m.updatedAt = iso();
    if (m.pause) m.pause.active = false;
  }
  function resumable(d) {
    return store(d)
      .records.filter(m => {
        const r = record(d, m.kind, m.recordId);
        return r && !closed(r, m.kind) && (m.pause?.active || m.nextStep);
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  function split(d, id, titles) {
    const original = record(d, 'tasks', id);
    if (!original || original.done || original.archived)
      throw Error('Choose an open task to split.');
    if (
      !Array.isArray(titles) ||
      titles.length < 2 ||
      titles.length > 20 ||
      titles.some(x => typeof x !== 'string' || !x.trim() || x.length > 500) ||
      new Set(titles.map(x => x.trim().toLowerCase())).size !== titles.length
    )
      throw Error('Enter 2–20 different task titles, one per line.');
    if (d.tasks.length + titles.length > 5000)
      throw Error('There is not enough room for these tasks.');
    const source = meta(d, 'tasks', id),
      saved = source ? copy(source) : null,
      number = Math.max(0, ...d.tasks.map(t => Number(t.number) || 0)),
      created = [];
    for (const [i, name] of titles.entries()) {
      const t = {
        ...copy(original),
        id: uid(),
        number: String(number + i + 1),
        task: name.trim(),
        done: false,
        doneDate: '',
        boardStatus: 'todo',
        archived: false,
        archivedAt: '',
        subTasks: [],
      };
      d.tasks.push(t);
      const m = touch(d, 'tasks', t.id);
      if (saved)
        Object.assign(m, {
          labelIds: copy(saved.labelIds),
          environmentId: saved.environmentId,
          systemId: saved.systemId,
          client: saved.client,
          dependencies: saved.dependencies.map(dep => ({ ...copy(dep), id: uid() })),
        });
      m.splitFrom = id;
      created.push(t.id);
    }
    return created;
  }
  function locations(d, start, end) {
    const valid = v => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
      const d = new Date(v + 'T00:00:00Z');
      return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
    };
    if (
      !valid(start) ||
      !valid(end) ||
      end < start ||
      Date.parse(end) - Date.parse(start) > 366 * 86400000
    )
      throw Error('Choose a valid date range of up to 367 days.');
    const groups = new Map(),
      allDays = new Set();
    let minutes = 0;
    const mins = v => {
      const [h, m] = v.split(':').map(Number);
      return h * 60 + m;
    };
    for (const s of d.schedule || []) {
      if (s.date < start || s.date > end || ['annual-leave', 'medical-leave'].includes(s.kind))
        continue;
      const name = s.location || 'Location not set',
        duration = (s.endTime ? mins(s.endTime) : Math.min(1440, mins(s.time) + 60)) - mins(s.time);
      if (!groups.has(name)) groups.set(name, { name, minutes: 0, days: new Set() });
      const g = groups.get(name);
      g.minutes += duration;
      g.days.add(s.date);
      allDays.add(s.date);
      minutes += duration;
    }
    return {
      minutes,
      days: allDays.size,
      groups: [...groups.values()]
        .map(g => ({ name: g.name, minutes: g.minutes, days: g.days.size }))
        .sort((a, b) => b.minutes - a.minutes),
    };
  }
  root.WorkHubBatchEngine = {
    KINDS,
    DEPENDENCIES,
    PAUSES,
    OUTCOMES,
    copy,
    uid,
    iso,
    rows,
    record,
    key,
    meta,
    title,
    closed,
    upgrade,
    touch,
    patch,
    dependencyState,
    blockers,
    validate,
    prepare,
    latestUpdate,
    stale,
    attachSession,
    resumable,
    split,
    locations,
  };
})(window);
