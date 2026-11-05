/* Detached handover snapshots. Preview and PDF use the same ordered sections. */
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
  const key = (kind, id, child = '') => JSON.stringify([kind, string(id), string(child)]);
  const localDate = date =>
    [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0'),
    ].join('-');
  const dated = v => /^\d{4}-\d{2}-\d{2}$/.test(string(v));
  function duration(value) {
    const seconds = Math.max(0, Math.round(Number(value) || 0));
    return (
      Math.floor(seconds / 3600) +
      'h ' +
      String(Math.floor((seconds % 3600) / 60)).padStart(2, '0') +
      'm ' +
      String(seconds % 60).padStart(2, '0') +
      's'
    );
  }
  function collect(d, can = () => true) {
    const rows = [],
      exportProjects = can('specs', 'export'),
      exportContext = can('workspace', 'export'),
      meta = new Map(
        (exportContext ? d.workhub?.batchA?.records || [] : []).map(r => [r.id, r])
      ),
      projects = new Map((exportProjects ? d.projects || [] : []).map(p => [p.id, p.name])),
      companies = new Map(
        (exportProjects ? d.projectCompanies || [] : []).map(c => [c.id, c])
      ),
      tasks = new Map((can('tasks', 'export') ? d.tasks || [] : []).map(t => [t.id, t])),
      tickets = new Map((can('tickets', 'export') ? d.tickets || [] : []).map(t => [t.id, t])),
      closures = new Map((d.workhub?.ticketClosures || []).map(c => [c.id, c.date])),
      fileRefs = new Map(),
      sessions = new Map();
    if (can('files', 'export'))
      for (const f of d.workhub?.driveFiles?.files || []) {
        if (!f.source) continue;
        const source = f.source.kind + ':' + f.source.id;
        if (!fileRefs.has(source)) fileRefs.set(source, []);
        fileRefs.get(source).push({ label: string(f.name), url: string(f.webViewLink) });
      }
    if (can('studio.sessions', 'export'))
      for (const s of d.workhub?.sessions || []) {
        let source = '';
        if (s.kind === 'task') source = key('tasks', s.linkId, s.subTaskId || '');
        else if (s.kind === 'ticket') source = key('tickets', s.linkId);
        else if (s.kind === 'project' && s.itemId)
          source = key('specs', s.itemId, s.subItemId || '');
        if (!source) continue;
        if (!sessions.has(source)) sessions.set(source, []);
        sessions.get(source).push({
          title: string(s.title),
          start: string(s.start),
          end: string(s.end),
          seconds: Number.isFinite(s.seconds) ? Math.max(0, s.seconds) : 0,
          notes: string(s.notes),
          completedWork: string(s.completedWork),
          nextStep: string(s.nextStep),
        });
      }
    function add(kind, r, parent = null) {
      const base = parent || r,
        child = !!parent,
        context = child ? null : meta.get(kind + ':' + base.id),
        projectId =
          kind === 'tasks' && base.taskType === 'Project' ? base.linkId : base.projectId || '',
        project = projects.get(projectId) || '',
        company = companies.get(base.companyId),
        status =
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
              : r.status || 'Not started',
        id = string(base.id),
        childId = child ? string(r.id) : '',
        recordKey = key(kind, id, childId),
        subs = !child ? r.subTasks || r.subItems || [] : [],
        relatedTicket = !child && kind === 'tasks' && r.taskType === 'Ticket'
          ? tickets.get(r.linkId)
          : null;
      const references = [];
      if (r.url) references.push({ label: string(r.reference || 'Reference'), url: string(r.url) });
      else if (r.reference) references.push({ label: string(r.reference), url: '' });
      for (const ref of r.references || [])
        references.push({ label: string(ref.label || 'Reference'), url: string(ref.url) });
      if (!child) references.push(...(fileRefs.get(kind + ':' + id) || []));
      const details = [];
      const detail = (label, value) => {
        if (value !== undefined && value !== null && value !== '')
          details.push({ label, value: string(value) });
      };
      if (kind === 'tickets') {
        detail('JIRA / charge code', r.jira);
        detail('Object', r.object);
        detail('Action', r.action);
        detail('Latest transport', r.transport);
        detail('Ticket type', r.type);
        detail('Chargeable mandays', r.mandays);
        detail('Last history date', [r.historyDate, r.historyTime].filter(Boolean).join(' '));
      }
      if (kind === 'specs') {
        if (!child) detail('Item type', r.itemType);
        detail('Status date', r.statusDate);
      }
      if (!child && kind === 'tasks') detail('Task type', r.taskType);
      const dependencies = (context?.dependencies || [])
        .filter(dep => dep.type !== 'task' || can('tasks', 'export'))
        .map(dep => {
          const target = dep.type === 'task' ? tasks.get(dep.targetId) : null;
          return {
            type: string(dep.type),
            title: target
              ? [target.number, target.task].filter(Boolean).join(' · ')
              : string(dep.title || (dep.type === 'task' ? 'Removed task' : '')),
            resolved: dep.type === 'task' ? !!target?.done : !!dep.resolved,
          };
        });
      rows.push({
        key: recordKey,
        kind,
        id,
        childId,
        title: string(r.task || r.title || r.description || r.ticket || r.itemId || 'Untitled'),
        projectId: string(projectId),
        project: string(project),
        company: company && company.projectId === projectId
          ? string(company.name) + (company.active === false ? ' (inactive)' : '')
          : '',
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
        completedDate: string(
          kind === 'tasks' && !child
            ? r.doneDate
            : kind === 'tickets'
              ? closures.get(r.id) || r.closedDate || ''
              : closed(status)
                ? r.statusDate || ''
                : ''
        ),
        created: string(r.created || r.createdAt || ''),
        updated: string(r.updatedAt || context?.updatedAt || ''),
        contextUpdated: !r.updatedAt && !!context?.updatedAt,
        related: relatedTicket
          ? [relatedTicket.ticket, relatedTicket.description].filter(Boolean).join(' · ')
          : !child && kind === 'tasks' && r.taskType === 'Custom'
            ? string(r.customLink)
            : '',
        relatedFeature: relatedTicket ? 'tickets' : '',
        progress: subs.length
          ? { total: subs.length, completed: subs.filter(s => closed(s.status)).length }
          : null,
        notes: string(r.remarks || r.notes || ''),
        feedback: string(kind === 'tickets' ? r.history : r.feedback),
        statusHistory: (r.statusHistory || []).map(h => ({
          status: string(h.status),
          date: string(h.date),
          changedAt: string(h.changedAt),
        })),
        nextStep: string(context?.nextStep || ''),
        blocker: context?.pause?.active
          ? string(context.pause.notes || context.pause.reason)
          : '',
        dependencies,
        details,
        sessions: copy(sessions.get(recordKey) || []),
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
  function groups(records) {
    const result = new Map();
    for (const r of records) {
      const id = key(r.kind, r.id);
      if (!result.has(id)) result.set(id, { key: id, kind: r.kind, records: [] });
      result.get(id).records.push(r);
    }
    for (const group of result.values()) {
      group.records.sort((a, b) => Number(!!a.childId) - Number(!!b.childId));
      const first = group.records[0],
        parent = group.records.find(r => !r.childId);
      group.title = parent
        ? [parent.identifier, parent.title].filter(Boolean).join(' · ')
        : [first.parent?.identifier, first.parent?.title].filter(Boolean).join(' · ') || first.title;
      group.parentSelected = !!parent;
    }
    return [...result.values()];
  }
  function overview(pack) {
    const records = pack.records,
      open = records.filter(r => !closed(r.status)),
      attention = [];
    for (const r of open) {
      const reasons = [];
      if (dated(r.due) && r.due < pack.asOf) reasons.push('Overdue · ' + r.due);
      if (r.blocker || /blocked|on hold/i.test(r.status)) reasons.push('Blocked / on hold');
      if (/^(critical|high|urgent)$/i.test(r.priority)) reasons.push(r.priority + ' priority');
      if (r.dependencies?.some(d => !d.resolved)) reasons.push('Unresolved prerequisite');
      if (reasons.length) attention.push({ record: r, reasons });
    }
    return {
      total: records.length,
      groups: groups(records).length,
      main: records.filter(r => !r.childId).length,
      children: records.filter(r => r.childId).length,
      open: open.length,
      completed: records.length - open.length,
      overdue: attention.filter(a => a.reasons.some(s => s.startsWith('Overdue'))).length,
      blocked: attention.filter(a => a.reasons.includes('Blocked / on hold')).length,
      unassigned: open.filter(r => !r.owner).length,
      attention,
      actions: open.filter(r => r.nextStep),
      statuses: [...new Set(records.map(r => r.status))].map(status => ({
        status,
        count: records.filter(r => r.status === status).length,
      })),
    };
  }
  function sections(r) {
    const section = (title, fields) => ({
      title,
      fields: fields.filter(([, value]) => value !== '' && value != null).map(([label, value]) => ({
        label,
        value: string(value),
      })),
    });
    const facts = section('Record overview', [
      ['Status', r.status],
      ['Priority', r.priority],
      ['Owner / PIC', r.owner],
      ['Project', r.project || r.projectId],
      ['Company', r.company],
      ['Related work', r.related],
      ['Due / follow-up', r.due],
      ['Expected date', r.expected],
      ['Completed / resolved date', r.completedDate],
      ['Created', r.created],
      ['Last updated', r.updated],
      ['Sub-item progress', r.progress
        ? r.progress.completed + ' / ' + r.progress.total + ' complete (all source sub-items)'
        : ''],
      ...(r.details || []).map(d => [d.label, d.value]),
    ]);
    const notes = section('Notes and updates', [
      ['Notes', r.notes],
      [r.kind === 'tickets' ? 'Full ticket update history' : 'Feedback', r.feedback],
      ['Status history', (r.statusHistory || [])
        .map(h => [h.date, h.status, h.changedAt && 'Recorded ' + h.changedAt].filter(Boolean).join(' · '))
        .join('\n')],
    ]);
    const actions = section('Handover actions', [
      ['Next action', r.nextStep],
      ['Blocker', r.blocker],
      ['Prerequisites', (r.dependencies || []).map(d =>
        (d.resolved ? 'Completed' : 'Open') + ' · ' + d.type + ' · ' + d.title
      ).join('\n')],
    ]);
    const time = section('Recorded work', (r.sessions || []).length ? [
      ['Recorded active time', duration(r.sessions.reduce((n, s) => n + s.seconds, 0)) +
        ' · ' + r.sessions.length + ' saved session(s); running timers excluded'],
      ...r.sessions.map(s => ['Session · ' + s.title, [
        [s.start, s.end].filter(Boolean).join(' → '),
        duration(s.seconds),
        s.notes && 'Notes: ' + s.notes,
        s.completedWork && 'Completed work: ' + s.completedWork,
        s.nextStep && 'Next action: ' + s.nextStep,
      ].filter(Boolean).join('\n')]),
    ] : []);
    const refs = section('References', r.references.map(ref => [
      'Reference · ' + ref.label, ref.url || ref.label,
    ]));
    return [facts, notes, actions, time, refs].filter(s => s.fields.length);
  }
  function snapshot(d, selected, options = {}, can = () => true, now = new Date().toISOString()) {
    if (!can('handover', 'export')) throw Error('Handover export is disabled for this account.');
    const keys = new Set(selected);
    if (!keys.size || keys.size > MAX_RECORDS)
      throw Error('Choose between 1 and 500 work records for a pack.');
    const available = new Map(collect(d, can).map(r => [r.key, r])),
      records = [],
      requiredFeatures = new Set(['handover']);
    for (const recordKey of keys) {
      const r = available.get(recordKey);
      if (!r)
        throw Error('A selected record is no longer available for export. Refresh the selection.');
      const next = copy(r);
      delete next.open;
      if (options.notes === false) next.notes = '';
      if (options.feedback === false) {
        next.feedback = '';
        next.statusHistory = [];
      }
      if (options.nextSteps === false) {
        next.nextStep = '';
        next.blocker = '';
        next.dependencies = [];
      }
      if (options.references === false) next.references = [];
      if (options.time === false) next.sessions = [];
      if (options.context === false) {
        next.details = [];
        next.company = next.created = next.updated = next.completedDate = next.related = '';
        next.progress = null;
      }
      requiredFeatures.add(next.kind);
      if (next.project || next.company) requiredFeatures.add('specs');
      if (next.related && next.relatedFeature) requiredFeatures.add(next.relatedFeature);
      if (next.sessions.length) requiredFeatures.add('studio.sessions');
      if (next.nextStep || next.blocker || next.dependencies.length ||
          (next.updated && next.contextUpdated))
        requiredFeatures.add('workspace');
      if (next.dependencies.some(dep => dep.type === 'task')) requiredFeatures.add('tasks');
      delete next.relatedFeature;
      delete next.contextUpdated;
      records.push(next);
    }
    for (const k of ['title', 'from', 'to', 'summary'])
      if (
        options[k] != null &&
        (typeof options[k] !== 'string' || options[k].length > (k === 'summary' ? 10000 : 200))
      )
        throw Error('Check the handover title and details.');
    if (options.layout != null && !['detailed', 'compact'].includes(options.layout))
      throw Error('Choose a detailed or compact pack layout.');
    const created = new Date(now),
      asOf = options.asOf || localDate(created);
    if (!Number.isFinite(created.getTime()) || !dated(asOf) ||
        !Number.isFinite(Date.parse(asOf + 'T00:00:00Z')) ||
        new Date(asOf + 'T00:00:00Z').toISOString().slice(0, 10) !== asOf)
      throw Error('Check the handover snapshot date.');
    const out = {
      version: 2,
      createdAt: now,
      asOf,
      layout: options.layout || 'detailed',
      title: options.title?.trim() || 'Handover pack',
      from: options.from || '',
      to: options.to || '',
      summary: options.summary || '',
      includesFiles:
        options.references !== false &&
        can('files', 'export') &&
        records.some(r => r.references.some(f => /^https:\/\/drive\./.test(f.url))),
      requiredFeatures: [...requiredFeatures],
      records: groups(records).flatMap(g => g.records),
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
      Array.isArray(pack.records) &&
      can('handover', 'export') &&
      (!pack.includesFiles || can('files', 'export')) &&
      (pack.requiredFeatures || []).every(feature => can(feature, 'export')) &&
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
    MAX_RECORDS, MAX_CHARS, kinds, labels, closed, collect, groups, overview,
    sections, duration, snapshot, allowed, filename,
  };
})(globalThis);
