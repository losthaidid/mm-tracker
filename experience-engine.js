/** Compact, validated workspace preferences and deterministic in-app reminder rules. */
(function (root) {
  'use strict';
  const defaults = () => ({
    version: 1,
    appearance: {
      lighting: 'auto',
      habitat: 'auto',
      celebrations: true,
      expressions: true,
      greetings: true,
    },
    rules: [],
    acknowledged: [],
  });
  const KINDS = {
    'stale-ticket': 'Ticket without an update',
    'overdue-task': 'Incomplete task overdue',
    'activity-soon': 'Activity starts soon',
    'leave-balance': 'Leave balance at or below threshold',
  };
  const text = (v, n) => typeof v === 'string' && v.length <= n;
  function upgrade(d) {
    if (d.workhub && d.workhub.experience === undefined) d.workhub.experience = defaults();
  }
  function validate(d) {
    const e = d.workhub.experience;
    if (
      !e ||
      e.version !== 1 ||
      !e.appearance ||
      !Array.isArray(e.rules) ||
      e.rules.length > 40 ||
      !Array.isArray(e.acknowledged) ||
      e.acknowledged.length > 1000
    )
      throw Error('Check workspace experience settings.');
    const p = e.appearance;
    if (
      !['auto', 'morning', 'afternoon', 'evening', 'night', 'off'].includes(p.lighting) ||
      !['auto', 'reading', 'resting'].includes(p.habitat) ||
      ['celebrations', 'expressions', 'greetings'].some(k => typeof p[k] !== 'boolean')
    )
      throw Error('Check appearance preferences.');
    const ids = new Set();
    for (const r of e.rules) {
      if (
        !r ||
        !text(r.id, 100) ||
        !r.id ||
        ids.has(r.id) ||
        !text(r.name, 160) ||
        !r.name.trim() ||
        !Object.hasOwn(KINDS, r.kind) ||
        typeof r.enabled !== 'boolean' ||
        !Number.isInteger(r.threshold) ||
        r.threshold < 0 ||
        r.threshold > 3650 ||
        !text(r.updatedAt, 50) ||
        !Number.isFinite(Date.parse(r.updatedAt))
      )
        throw Error('Check personal reminder rules.');
      ids.add(r.id);
    }
    for (const a of e.acknowledged)
      if (!a || !text(a.key, 700) || !a.key || !Number.isFinite(a.until) || a.until < 0)
        throw Error('Check reminder acknowledgements.');
  }
  function lighting(mode, date = new Date()) {
    const hour = date.getHours() + date.getMinutes() / 60;
    let warmth, night;
    if (mode === 'off') return { phase: 'off', warmth: 0, night: 0 };
    if (mode !== 'auto')
      return {
        phase: mode,
        warmth: { morning: 0.3, afternoon: 0, evening: 1, night: 0.1 }[mode],
        night: mode === 'night' ? 1 : 0,
      };
    warmth =
      hour >= 15 && hour <= 22
        ? Math.max(0, 1 - Math.abs(hour - 18.5) / 3.5)
        : hour >= 5 && hour < 9
          ? 0.25
          : 0;
    night =
      hour < 5 || hour >= 21 ? 1 : hour < 7 ? (7 - hour) / 2 : hour >= 19 ? (hour - 19) / 2 : 0;
    return {
      phase:
        hour >= 5 && hour < 11
          ? 'morning'
          : hour < 17 && hour >= 11
            ? 'afternoon'
            : hour >= 17 && hour < 21
              ? 'evening'
              : 'night',
      warmth,
      night,
    };
  }
  function fingerprint(value) {
    let hash = 2166136261;
    for (const c of JSON.stringify(value)) {
      hash ^= c.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
  function results(d, now = Date.now(), leave = null) {
    const e = d.workhub.experience || defaults(),
      out = [],
      today = new Date(now);
    const day = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
    const push = (r, kind, id, title, reason, stamp) => {
      const key = [r.id, r.updatedAt, kind, id, stamp].join('|');
      if (!e.acknowledged.some(a => a.key === key && (a.until === 0 || a.until > now)))
        out.push({ key, ruleId: r.id, kind, id, title, reason });
    };
    for (const r of e.rules.filter(r => r.enabled)) {
      if (r.kind === 'stale-ticket')
        for (const t of d.tickets || []) {
          if (t.archived || ['Closed', 'Completed', 'Resolved'].includes(t.status)) continue;
          const stamp =
            t.historyDate || (!String(t.history || '').trim() ? t.created || t.createdAt : '');
          const time = Date.parse(stamp || '');
          if (Number.isFinite(time) && now - time >= r.threshold * 86400000)
            push(
              r,
              'tickets',
              t.id,
              t.ticket + ' · ' + t.description,
              `No dated update for at least ${r.threshold} day(s).`,
              [stamp, fingerprint(t)].join(':')
            );
        }
      if (r.kind === 'overdue-task')
        for (const t of d.tasks || []) {
          const due = t.dueDate || t.due;
          if (
            !t.done &&
            !t.archived &&
            /^\d{4}-\d{2}-\d{2}$/.test(due || '') &&
            due < day &&
            now - Date.parse(due + 'T23:59:59') >= r.threshold * 86400000
          )
            push(
              r,
              'tasks',
              t.id,
              t.task,
              `Due ${due}; still incomplete.`,
              due + ':' + fingerprint(t)
            );
        }
      if (r.kind === 'activity-soon')
        for (const t of d.schedule || []) {
          const start = Date.parse(t.date + 'T' + (t.start || t.time || '') + ':00');
          if (Number.isFinite(start) && start >= now && start - now <= r.threshold * 60000)
            push(
              r,
              'schedule',
              t.bookingId || t.id || t.date + '@' + t.time,
              t.text || t.title || t.activity || 'Scheduled activity',
              `Starts ${t.date} at ${t.start || t.time}.`,
              start
            );
        }
      if (r.kind === 'leave-balance' && leave)
        for (const y of d.workhub.leaveBalances || [])
          for (const type of leave.types(d)) {
            if (String(y.id) !== String(today.getFullYear())) continue;
            const b = leave.balance(d, y.id, type.id);
            if (b.remaining !== null && b.remaining <= r.threshold)
              push(
                r,
                'leave',
                String(type.id),
                leave.typeLabel(d, type.id),
                `${b.remaining} day(s) remaining in ${y.id}.`,
                [y.id, b.remaining].join(':')
              );
          }
    }
    return out.slice(0, 100);
  }
  function syncHealth(c, cacheAvailable, online = true) {
    if (!c.user)
      return { state: 'signed-out', title: 'Sign in to open your records', pending: false };
    const pending = !!(c.pending || c.inFlight);
    if (c.conflict) return { state: 'conflict', title: 'Review required before saving', pending };
    if (c.loading) return { state: 'loading', title: 'Opening your account records', pending };
    if (c.error || !online)
      return {
        state: 'waiting',
        title: pending
          ? cacheAvailable
            ? 'Saved on this device · waiting for cloud'
            : 'Changes waiting · browser copy unavailable'
          : 'Connection needs attention',
        pending,
      };
    if (c.busy && pending) return { state: 'saving', title: 'Uploading changes', pending };
    if (pending)
      return {
        state: 'pending',
        title: cacheAvailable
          ? 'Saved on this device · waiting to upload'
          : 'Changes waiting · keep this page open',
        pending,
      };
    if (c.ready && c.hasDocument)
      return { state: 'confirmed', title: 'Cloud save confirmed', pending: false };
    return { state: 'ready', title: 'Ready · no document saved yet', pending: false };
  }
  root.WorkHubExperienceEngine = {
    defaults,
    KINDS,
    upgrade,
    validate,
    lighting,
    results,
    syncHealth,
  };
})(window);
