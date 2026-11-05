/* Handover snapshots are detached export data; creating a pack never edits the source records. */
(function (root) {
  'use strict';
  const MAX_RECORDS = 500,
    MAX_CHARS = 1000000;
  const kinds = ['tasks', 'tickets', 'specs', 'waiting'];
  const labels = {
    tasks: 'Tasks',
    tickets: 'Tickets',
    specs: 'Project items',
    waiting: 'Waiting on',
  };
  const closed = value =>
    /^(completed|complete|closed|done|resolved|cancelled|canceled)$/i.test(
      String(value || '').trim()
    );
  const string = v => (v == null ? '' : String(v));
  const copy = v => JSON.parse(JSON.stringify(v));
  function collect(d, can = () => true) {
    const rows = [],
      meta = new Map((d.workhub?.batchA?.records || []).map(r => [r.id, r])),
      projects = new Map((can('specs') ? d.projects || [] : []).map(p => [p.id, p.name])),
      fileRefs = new Map();
    if (can('files', 'export'))
      for (const f of d.workhub?.driveFiles?.files || []) {
        if (!f.source) continue;
        const key = f.source.kind + ':' + f.source.id;
        if (!fileRefs.has(key)) fileRefs.set(key, []);
        fileRefs.get(key).push({ label: string(f.name), url: string(f.webViewLink) });
      }
    function add(kind, r, parent = null) {
      const base = parent || r,
        child = !!parent,
        context = meta.get(kind + ':' + base.id);
      const projectId =
        kind === 'tasks' && base.taskType === 'Project' ? base.linkId : base.projectId || '';
      const project = projects.get(projectId) || '';
      const status =
        kind === 'tasks' && !child
          ? r.done
            ? 'Completed'
            : { todo: 'To do', doing: 'In progress', blocked: 'Blocked', done: 'Done' }[
                r.boardStatus
              ] || 'To do'
          : kind === 'waiting'
            ? r.resolved
              ? 'Resolved'
              : 'Waiting'
            : r.status || 'Not started';
      const id = string(base.id),
        childId = child ? string(r.id) : '';
      const title = string(
        r.task || r.title || r.description || r.ticket || r.itemId || 'Untitled'
      );
      const references = [];
      if (r.url) references.push({ label: string(r.reference || 'Reference'), url: string(r.url) });
      else if (r.reference) references.push({ label: string(r.reference), url: '' });
      for (const ref of r.references || [])
        references.push({ label: string(ref.label || 'Reference'), url: string(ref.url) });
      if (!child) references.push(...(fileRefs.get(kind + ':' + id) || []));
      rows.push({
        key: JSON.stringify([kind, id, childId]),
        kind,
        id,
        childId,
        title,
        projectId,
        project,
        identifier: string(r.ticket || r.number || r.itemId || ''),
        parent: parent
          ? {
              id,
              title: string(base.task || base.description || base.title),
              identifier: string(base.number || base.itemId || ''),
            }
          : null,
        status: string(status),
        owner: string(r.owner || r.pic || (kind === 'waiting' ? r.person : '')),
        priority: string(r.priority || ''),
        due: string(r.dueDate || r.followUp || ''),
        expected: string(r.expectedDate || ''),
        notes: string(r.remarks || r.notes || ''),
        feedback:
          kind === 'tickets'
            ? root.WorkHubReports?.historyEntries(r.history).at(-1) || string(r.history)
            : string(r.feedback || ''),
        nextStep: child ? '' : string(context?.nextStep || ''),
        blocker: child
          ? ''
          : context?.pause?.active
            ? string(context.pause.notes || context.pause.reason)
            : '',
        references,
        open: !(kind === 'tasks' && !child
          ? r.done
          : kind === 'waiting'
            ? r.resolved
            : closed(status)),
      });
    }
    for (const kind of kinds) {
      if (!can(kind, 'export')) continue;
      const records = kind === 'waiting' ? d.workhub?.waiting || [] : d[kind] || [];
      for (const r of records) {
        if (r.archived) continue;
        add(kind, r);
        if (kind === 'tasks' || kind === 'specs')
          for (const sub of r.subTasks || r.subItems || []) add(kind, sub, r);
      }
    }
    return rows;
  }
  function snapshot(d, selected, options = {}, can = () => true, now = new Date().toISOString()) {
    if (!can('handover', 'export')) throw Error('Handover export is disabled for this account.');
    const keys = new Set(selected);
    if (!keys.size || keys.size > MAX_RECORDS)
      throw Error('Choose between 1 and 500 work records for a pack.');
    const available = new Map(collect(d, can).map(r => [r.key, r]));
    const records = [];
    for (const key of keys) {
      const r = available.get(key);
      if (!r)
        throw Error('A selected record is no longer available for export. Refresh the selection.');
      const next = copy(r);
      delete next.open;
      if (options.notes === false) next.notes = '';
      if (options.feedback === false) next.feedback = '';
      if (options.nextSteps === false) {
        next.nextStep = '';
        next.blocker = '';
      }
      if (options.references === false) next.references = [];
      records.push(next);
    }
    for (const k of ['title', 'from', 'to', 'summary'])
      if (
        options[k] != null &&
        (typeof options[k] !== 'string' || options[k].length > (k === 'summary' ? 10000 : 200))
      )
        throw Error('Check the handover title and details.');
    const out = {
      version: 1,
      createdAt: now,
      title: options.title?.trim() || 'Handover pack',
      from: options.from || '',
      to: options.to || '',
      summary: options.summary || '',
      includesFiles:
        options.references !== false &&
        can('files', 'export') &&
        records.some(r => r.references.some(f => /^https:\/\/drive\./.test(f.url))),
      records,
    };
    if (JSON.stringify(out).length > MAX_CHARS)
      throw Error(
        'This pack is too large. Select fewer records or exclude long notes. No content has been shortened.'
      );
    return out;
  }
  function allowed(pack, can) {
    return (
      !!pack &&
      can('handover', 'export') &&
      (!pack.includesFiles || can('files', 'export')) &&
      pack.records.every(r => can(r.kind, 'export'))
    );
  }
  function filename(pack) {
    return (
      (pack.title.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 70) || 'Handover') +
      '-' +
      pack.createdAt.slice(0, 10) +
      '.pdf'
    );
  }
  root.WorkHubHandoverEngine = {
    MAX_RECORDS,
    MAX_CHARS,
    kinds,
    labels,
    closed,
    collect,
    snapshot,
    allowed,
    filename,
  };
})(globalThis);
