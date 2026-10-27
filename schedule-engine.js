/** Daily execution is independent of record progress. No ticking saves or network calls. */
(function (root) {
  'use strict';
  const copy = x => JSON.parse(JSON.stringify(x));
  const kinds = ['custom', 'task', 'ticket', 'project'];
  const stamp = x => Number.isFinite(Date.parse(x));
  const text = (x, max = 500) =>
    typeof x === 'string' && x.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(x);
  const localDate = at => {
    const d = new Date(at);
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  };
  const time = at => {
    const d = new Date(at);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  function upgrade(d) {
    if (!d?.workhub) return d;
    if (d.workhub.daySchedule === undefined) d.workhub.daySchedule = { retained: [], changes: [] };
    return d;
  }
  function validateSession(s) {
    if (
      !s ||
      !text(s.id, 100) ||
      !s.id ||
      !text(s.title) ||
      !s.title.trim() ||
      !kinds.includes(s.kind) ||
      !stamp(s.start) ||
      !stamp(s.end) ||
      Date.parse(s.end) < Date.parse(s.start) ||
      !Array.isArray(s.intervals) ||
      s.intervals.length > 1000 ||
      !Number.isFinite(s.seconds) ||
      s.seconds < 0 ||
      s.seconds > 366 * 86400
    )
      throw Error('Check the recorded work and its start/end time.');
    let previous = -Infinity;
    for (const p of s.intervals) {
      if (
        !stamp(p.start) ||
        !stamp(p.end) ||
        Date.parse(p.start) < previous ||
        Date.parse(p.end) <= Date.parse(p.start) ||
        Date.parse(p.start) < Date.parse(s.start) ||
        Date.parse(p.end) > Date.parse(s.end)
      )
        throw Error('Work intervals must be ordered, non-overlapping and within the session.');
      previous = Date.parse(p.end);
    }
    if (
      Math.round(
        s.intervals.reduce((n, p) => n + (Date.parse(p.end) - Date.parse(p.start)) / 1000, 0)
      ) !== Math.round(s.seconds)
    )
      throw Error('Recorded duration must match the actual work intervals.');
    for (const key of [
      'unlistedName',
      'companyHint',
      'reference',
      'companyId',
      'allocationKey',
      'linkId',
      'projectId',
    ])
      if (s[key] !== undefined && !text(s[key])) throw Error('Check the captured work reference.');
    if (s.unlisted !== undefined && typeof s.unlisted !== 'boolean')
      throw Error('Check the unlisted work choice.');
    if (
      s.captureIdentity !== undefined &&
      (!s.captureIdentity ||
        !kinds.includes(s.captureIdentity.kind) ||
        ['linkId', 'projectId', 'companyId', 'itemId', 'subItemId', 'allocationKey', 'title'].some(
          k => !text(s.captureIdentity[k] || '')
        ))
    )
      throw Error('Check the original work identity.');
  }
  function validate(d) {
    const h = d.workhub?.daySchedule;
    if (!h) return;
    for (const key of ['retained', 'changes']) {
      if (
        !Array.isArray(h[key]) ||
        h[key].length > 5000 ||
        new Set(h[key].map(x => x?.id)).size !== h[key].length
      )
        throw Error('Daily Schedule history supports up to 5,000 unique records per collection.');
    }
    for (const s of [
      ...h.retained,
      ...(d.workhub.sessions || []).filter(s => s.scheduleVersion === 1),
    ])
      validateSession(s);
    for (const slot of d.schedule || [])
      if (slot.executionIdentity !== undefined) {
        const i = slot.executionIdentity;
        if (
          !i ||
          !kinds.includes(i.kind) ||
          [
            'linkId',
            'projectId',
            'companyId',
            'itemId',
            'subItemId',
            'allocationKey',
            'title',
          ].some(k => !text(i[k] || ''))
        )
          throw Error('Check the original booking identity.');
      }
    // Include both retained history and sessions so cross-device merges cannot
    // introduce overlapping new work. Historical legacy/legacy overlap is retained.
    const spans = sessions(d)
      .flatMap(s =>
        s.intervals.map(p => ({
          start: Date.parse(p.start),
          end: Date.parse(p.end),
          id: s.id,
          modern: s.scheduleVersion === 1,
        }))
      )
      .sort((a, b) => a.start - b.start);
    let any = { end: -Infinity },
      modern = { end: -Infinity };
    for (const span of spans) {
      if (
        (span.modern && any.end > span.start && any.id !== span.id) ||
        (!span.modern && modern.end > span.start && modern.id !== span.id)
      )
        throw Error('Actual work sessions overlap. Review their recorded times before saving.');
      if (span.end > any.end) any = span;
      if (span.modern && span.end > modern.end) modern = span;
    }
    for (const c of h.changes) {
      if (
        !c ||
        !text(c.id, 100) ||
        !c.id ||
        !['Moved', 'Cancelled'].includes(c.status) ||
        !stamp(c.at) ||
        !Array.isArray(c.entries) ||
        c.entries.length > 5000
      )
        throw Error('Check the Schedule change history.');
      for (const e of c.entries)
        if (
          !text(e.title) ||
          !kinds.includes(e.kind) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(e.date) ||
          !/^\d{2}:\d{2}$/.test(e.time) ||
          !/^\d{2}:\d{2}$/.test(e.endTime) ||
          e.endTime <= e.time
        )
          throw Error('Check the original Schedule range.');
    }
  }
  function key(slot) {
    return slot.date + '|' + (slot.bookingId || slot.planId || slot.time);
  }
  function identity(s, d) {
    if (s.executionIdentity) return s.executionIdentity;
    const task = s.kind === 'task' ? d.tasks?.find(t => t.id === s.linkId) : null;
    return {
      kind: s.kind,
      linkId: s.linkId || '',
      projectId:
        s.projectId ||
        (s.kind === 'project' ? s.linkId : task?.taskType === 'Project' ? task.linkId : '') ||
        '',
      companyId: s.companyId || task?.companyId || '',
      itemId: s.itemId || '',
      subItemId: s.subItemId || '',
      allocationKey: s.allocationKey || '',
      title: (s.title || s.text || '').slice(0, 500),
    };
  }
  function matches(slot, s, d) {
    const actual = s.captureIdentity || identity(s, d),
      planned = identity(slot, d);
    if (actual.allocationKey) return actual.allocationKey === key(slot);
    if (planned.companyId && actual.companyId && planned.companyId !== actual.companyId)
      return false;
    if (planned.itemId && actual.itemId && planned.itemId !== actual.itemId) return false;
    if (planned.subItemId && actual.subItemId && planned.subItemId !== actual.subItemId)
      return false;
    if (planned.kind === actual.kind && planned.linkId && planned.linkId === actual.linkId)
      return true;
    if (planned.kind === 'project' && planned.linkId === actual.projectId) return true;
    return (
      planned.kind === 'custom' &&
      actual.kind === 'custom' &&
      planned.title.trim() === actual.title.trim()
    );
  }
  const sessionCache = new WeakMap();
  function sessions(d, timer = null, at = Date.now()) {
    const signature = [
      Math.floor(at / 1000),
      timer?.id,
      timer?.started,
      timer?.runningSince,
      timer?.segments.length,
      timer?.segments.at(-1)?.end,
    ].join('|');
    const previous = sessionCache.get(d),
      saved = d.workhub?.sessions,
      retained = d.workhub?.daySchedule?.retained;
    if (
      previous &&
      previous.signature === signature &&
      previous.saved === saved &&
      previous.retained === retained &&
      previous.count === saved?.length &&
      previous.retainedCount === retained?.length
    )
      return previous.rows;
    const map = new Map();
    for (const s of [...(d.workhub?.daySchedule?.retained || []), ...(d.workhub?.sessions || [])]) {
      if (s.seconds <= 0) continue;
      const intervals = (
        s.intervals?.length ? s.intervals : [{ start: s.start, end: s.end }]
      ).filter(p => stamp(p.start) && stamp(p.end) && Date.parse(p.end) > Date.parse(p.start));
      if (intervals.length) map.set(s.id, { ...s, intervals, running: false });
    }
    if (timer && !map.has(timer.id)) {
      const intervals = [...timer.segments];
      if (timer.runningSince && at > Date.parse(timer.runningSince))
        intervals.push({ start: timer.runningSince, end: new Date(at).toISOString() });
      map.set(timer.id, {
        ...timer,
        start: timer.started,
        end: new Date(at).toISOString(),
        intervals,
        running: !!timer.runningSince,
      });
    }
    const rows = [...map.values()];
    sessionCache.set(d, {
      signature,
      saved,
      retained,
      count: saved?.length,
      retainedCount: retained?.length,
      rows,
    });
    return rows;
  }
  function union(parts) {
    const out = [];
    for (const p of parts.filter(p => p[1] > p[0]).sort((a, b) => a[0] - b[0])) {
      const last = out.at(-1);
      if (last && p[0] <= last[1]) last[1] = Math.max(last[1], p[1]);
      else out.push([...p]);
    }
    return out;
  }
  const minutes = parts => union(parts).reduce((n, p) => n + (p[1] - p[0]) / 60000, 0);
  function bounds(slot, d) {
    const block = slot.bookingId
      ? d.schedule.filter(
          r => !r.sessionId && r.date === slot.date && r.bookingId === slot.bookingId
        )
      : [slot];
    const startTime = block.map(r => r.time).sort()[0] || slot.time;
    const endTime =
      block
        .map(
          r =>
            r.endTime ||
            String(Math.min(24, Number(r.time.slice(0, 2)) + 1)).padStart(2, '0') + ':00'
        )
        .sort()
        .at(-1) || slot.endTime;
    const start = new Date(slot.date + 'T' + startTime + ':00').getTime();
    const end =
      endTime === '24:00'
        ? new Date(
            new Date(slot.date + 'T00:00:00').setDate(
              new Date(slot.date + 'T00:00:00').getDate() + 1
            )
          ).getTime()
        : new Date(slot.date + 'T' + endTime + ':00').getTime();
    return { start, end, startTime, endTime };
  }
  function describe(d, slot, at = Date.now(), timer = null) {
    if (slot.sessionId) return { status: 'Actual', source: 'Tracked', displacedMinutes: 0 };
    const b = bounds(slot, d),
      all = sessions(d, timer, at),
      own = [],
      other = [];
    let stopped = false,
      totalOwn = 0;
    const idle = [];
    for (const s of all) {
      const same = matches(slot, s, d);
      for (const p of s.intervals) {
        const a = Math.max(b.start, Date.parse(p.start)),
          z = Math.min(b.end, at, Date.parse(p.end));
        if (z > a) (same ? own : other).push([a, z]);
      }
      if (same && Date.parse(s.start) < b.end && Date.parse(s.end) > b.start) {
        totalOwn += minutes(
          s.intervals.map(p => [
            Math.max(b.start, Date.parse(p.start)),
            Math.min(at, Date.parse(p.end)),
          ])
        );
        let cursor = Math.max(b.start, Date.parse(s.start));
        const until = Math.min(b.end, at, Date.parse(s.end));
        for (const p of union(s.intervals.map(p => [Date.parse(p.start), Date.parse(p.end)]))) {
          if (p[0] > cursor) idle.push([cursor, Math.min(until, p[0])]);
          cursor = Math.max(cursor, p[1]);
        }
        if (until > cursor) idle.push([cursor, until]);
      }
      if (
        same &&
        s.endReason === 'stop' &&
        !s.running &&
        Date.parse(s.end) >= b.start &&
        Date.parse(s.end) < b.end &&
        Date.parse(s.end) <= at &&
        Date.parse(s.start) < b.end
      )
        stopped = true;
    }
    const lost = Math.min((b.end - b.start) / 60000, minutes([...other, ...idle])),
      tracked = minutes(own);
    const info = {
      ...b,
      plannedMinutes: (b.end - b.start) / 60000,
      displacedMinutes: lost,
      trackedMinutes: tracked,
      workedMinutes: Math.max(0, (Math.min(at, b.end) - b.start) / 60000 - lost),
      source: tracked || lost ? 'Tracked + plan' : 'From plan',
    };
    if (at < b.start) return { ...info, status: 'Planned' };
    const ownTimer = timer && matches(slot, timer, d) && Date.parse(timer.started) < b.end;
    if (ownTimer && timer.runningSince) return { ...info, source: 'Tracked', status: 'Active' };
    if (stopped) return { ...info, source: 'Tracked', status: 'Actual' };
    if (ownTimer && !timer.runningSince && at < b.end)
      return { ...info, source: 'Tracked', status: 'Paused' };
    if (at < b.end) {
      const interrupted = timer?.runningSince && !ownTimer && Date.parse(timer.runningSince) <= at;
      return { ...info, status: interrupted ? 'Paused' : 'Active' };
    }
    return {
      ...info,
      status:
        totalOwn >= info.plannedMinutes
          ? 'Actual'
          : minutes(other) >= info.plannedMinutes - 0.01
            ? 'Changed'
            : lost > 0
              ? 'Partial'
              : 'Actual',
    };
  }
  function day(d, date, timer = null, at = Date.now()) {
    const lo = new Date(date + 'T00:00:00').getTime(),
      next = new Date(lo);
    next.setDate(next.getDate() + 1);
    const hi = next.getTime(),
      rows = [];
    for (const s of sessions(d, timer, at)) {
      const parts = [];
      for (const p of s.intervals) {
        const a = Math.max(lo, Date.parse(p.start)),
          b = Math.min(hi, Date.parse(p.end));
        if (b > a) parts.push([a, b]);
      }
      if (
        !parts.length &&
        !(s.running && Date.parse(s.runningSince) >= lo && Date.parse(s.runningSince) < hi)
      )
        continue;
      rows.push({
        ...s,
        parts,
        minutes: minutes(parts),
        date,
        time: parts.length ? time(parts[0][0]) : time(Date.parse(s.runningSince)),
        endTime: parts.length
          ? parts.at(-1)[1] === hi
            ? '24:00'
            : time(parts.at(-1)[1])
          : time(at),
        status: s.running ? 'Active' : timer?.id === s.id ? 'Paused' : 'Actual',
      });
    }
    return rows.sort((a, b) => a.time.localeCompare(b.time));
  }
  function assertAvailable(d, intervals, ignore = '', timer = null) {
    for (const s of sessions(d, timer))
      if (s.id !== ignore)
        for (const a of intervals)
          for (const b of s.intervals)
            if (Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end))
              throw Error(
                'This actual time overlaps recorded work. Adjust the time or finish the running session first.'
              );
  }
  function title(d, slot) {
    return slot.kind === 'task'
      ? d.tasks.find(t => t.id === slot.linkId)?.task || 'Task'
      : slot.kind === 'ticket'
        ? d.tickets.find(t => t.id === slot.linkId)?.description || slot.text || 'Ticket'
        : slot.kind === 'project'
          ? d.projectPlans.find(p => p.id === slot.planId)?.title ||
            slot.title ||
            slot.activity ||
            'Project activity'
          : slot.text || 'Custom activity';
  }
  function history(d, rows, status, at = new Date().toISOString()) {
    upgrade(d);
    const entries = [],
      seen = new Set();
    for (const s of rows)
      if (!s.sessionId && kinds.includes(s.kind) && !seen.has(key(s))) {
        seen.add(key(s));
        const b = bounds(s, d);
        entries.push({
          date: s.date,
          time: b.startTime,
          endTime: b.endTime,
          title: title(d, s).slice(0, 500),
          kind: s.kind,
          linkId: s.linkId || '',
          projectId: identity(s, d).projectId,
        });
      }
    if (entries.length)
      d.workhub.daySchedule.changes.push({
        id:
          'change-' +
          (root.crypto?.randomUUID?.() ||
            Date.now().toString(36) + Math.random().toString(36).slice(2)),
        at,
        status,
        entries,
      });
  }
  function retain(d, session) {
    upgrade(d);
    if (
      session.scheduleVersion === 1 &&
      !d.workhub.daySchedule.retained.some(s => s.id === session.id)
    )
      d.workhub.daySchedule.retained.push(copy(session));
  }
  root.WorkHubScheduleEngine = Object.freeze({
    upgrade,
    validate,
    validateSession,
    key,
    identity,
    matches,
    sessions,
    describe,
    bounds,
    day,
    minutes,
    union,
    assertAvailable,
    history,
    retain,
    localDate,
    time,
    title,
  });
})(window);
