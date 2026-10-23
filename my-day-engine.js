/** My Day calculations and bounded, account-owned planning records. No network or timers. */
(function (root) {
  'use strict';
  const WIDGETS = {
    dayJourney: ['Day journey', '◷'],
    missions: ['Today’s three priorities', '✧'],
    orb: ['Focus orb', '◉'],
    radar: ['Workload balance', '◌'],
    upNext: ['Up next', '↗'],
    energy: ['Match your energy', 'ϟ'],
    gaps: ['Find a little room', '⌕'],
    replay: ['Plan & reality', '≋'],
    garden: ['Today’s growing scene', '❀'],
    terrarium: ['Break terrarium', '♧'],
    canvas: ['Thinking canvas', '✎'],
  };
  const SETTINGS = {
    effects: 'ambient',
    particles: true,
    celebrations: true,
    sounds: false,
    workStart: '09:00',
    workEnd: '18:00',
    breakMinutes: 5,
  };
  const DEFAULT_WIDGETS = ['dayJourney', 'missions', 'orb', 'terrarium', 'canvas'];
  const EFFORT = ['low', 'steady', 'challenge'],
    COLORS = ['sage', 'peach', 'sky', 'lavender'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const uid = () =>
    root.crypto?.randomUUID?.() ||
    'day-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const text = (v, n = 500) =>
    typeof v === 'string' && v.length <= n && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
  const dateOK = value =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value + 'T12:00:00Z')) &&
    new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
  const minute = value =>
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      ? +value.slice(0, 2) * 60 + +value.slice(3)
      : value === '24:00'
        ? 1440
        : NaN;
  const clock = value =>
    String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
  const store = d => d.workhub.myDay;
  function upgrade(d) {
    if (!d.workhub) d.workhub = {};
    if (d.workhub.myDay === undefined) {
      d.workhub.myDay = {
        version: 1,
        settings: { ...SETTINGS },
        days: [],
        taskProfiles: [],
        ideas: [],
        groups: [],
        links: [],
      };
      if (Array.isArray(d.workhub.widgets))
        for (const id of DEFAULT_WIDGETS)
          if (!d.workhub.widgets.some(w => w.id === id))
            d.workhub.widgets.push({
              id,
              span: ['dayJourney', 'canvas'].includes(id) ? 'wide' : 'normal',
            });
    }
    return d;
  }
  function validate(d) {
    const h = store(d),
      s = h?.settings;
    if (
      !h ||
      h.version !== 1 ||
      !s ||
      !['calm', 'ambient', 'playful'].includes(s.effects) ||
      !['particles', 'celebrations', 'sounds'].every(k => typeof s[k] === 'boolean') ||
      !Number.isFinite(minute(s.workStart)) ||
      !Number.isFinite(minute(s.workEnd)) ||
      minute(s.workStart) >= minute(s.workEnd) ||
      !Number.isInteger(s.breakMinutes) ||
      s.breakMinutes < 1 ||
      s.breakMinutes > 60
    )
      throw Error('Check My Day effects and working hours.');
    const check = (key, max, valid) => {
      const xs = h[key];
      if (
        !Array.isArray(xs) ||
        xs.length > max ||
        xs.some(x => !x || !text(x.id, 100) || !x.id) ||
        new Set(xs.map(x => x.id)).size !== xs.length ||
        xs.some(x => !valid(x))
      )
        throw Error('Check My Day ' + key + ' records (up to ' + max + ').');
    };
    check(
      'days',
      730,
      x =>
        dateOK(x.id) &&
        EFFORT.includes(x.energy) &&
        typeof x.started === 'boolean' &&
        typeof x.closed === 'boolean' &&
        text(x.reflection, 4000) &&
        Array.isArray(x.missions) &&
        x.missions.length <= 3 &&
        new Set(x.missions).size === x.missions.length &&
        x.missions.every(id => text(id, 100) && id) &&
        Array.isArray(x.plan) &&
        x.plan.length <= 200 &&
        x.plan.every(
          p =>
            text(p.id, 100) &&
            text(p.title, 500) &&
            Number.isFinite(p.start) &&
            Number.isFinite(p.end) &&
            p.start >= 0 &&
            p.end <= 1440 &&
            p.end > p.start
        )
    );
    check(
      'taskProfiles',
      5000,
      x =>
        Number.isInteger(x.minutes) &&
        x.minutes >= 1 &&
        x.minutes <= 1440 &&
        EFFORT.includes(x.effort)
    );
    check('groups', 30, x => text(x.name, 80) && x.name.trim() && COLORS.includes(x.color));
    const groups = new Set(h.groups.map(g => g.id));
    check(
      'ideas',
      120,
      x =>
        text(x.title, 160) &&
        x.title.trim() &&
        text(x.notes, 4000) &&
        COLORS.includes(x.color) &&
        text(x.groupId, 100) &&
        (!x.groupId || groups.has(x.groupId)) &&
        text(x.taskId, 100) &&
        Number.isFinite(x.x) &&
        Number.isFinite(x.y) &&
        x.x >= 0 &&
        x.x <= 680 &&
        x.y >= 0 &&
        x.y <= 450
    );
    const ids = new Set(h.ideas.map(x => x.id)),
      pairs = new Set();
    check('links', 240, x => {
      const key = [x.from, x.to].sort().join('|');
      if (!ids.has(x.from) || !ids.has(x.to) || x.from === x.to || pairs.has(key)) return false;
      pairs.add(key);
      return true;
    });
    if ([...h.groups, ...h.ideas, ...h.links].some(x => !/^[A-Za-z0-9_-]{1,100}$/.test(x.id)))
      throw Error('Use valid canvas record IDs.');
    if (JSON.stringify(h).length > 1000000)
      throw Error('Keep My Day records within 1 MB. Export a backup before reducing older notes.');
  }
  function day(d, date, create = false) {
    const h = store(d),
      existing = h.days.find(x => x.id === date);
    if (existing) return existing;
    if (!dateOK(date)) throw Error('Choose a valid day.');
    const value = {
      id: date,
      energy: 'steady',
      missions: [],
      started: false,
      closed: false,
      reflection: '',
      plan: [],
    };
    if (create) {
      if (h.days.length >= 730)
        throw Error(
          'My Day supports 730 saved days. Export a backup before removing older daily plans.'
        );
      h.days.push(value);
    }
    return value;
  }
  const profile = (d, id) =>
    store(d).taskProfiles.find(x => x.id === id) || { id, minutes: 25, effort: 'steady' };
  const openTasks = d => (d.tasks || []).filter(t => !t.done && !t.archived);
  function taskOptions(d, date, energy, duration = 1440) {
    const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return openTasks(d)
      .filter(t => {
        const p = profile(d, t.id);
        return (
          p.minutes <= duration &&
          (!energy || EFFORT.indexOf(p.effort) <= EFFORT.indexOf(energy)) &&
          !root.WorkHubReminders?.isSnoozed?.(d, 'tasks', t.id, date)
        );
      })
      .sort(
        (a, b) =>
          (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4) ||
          (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
      );
  }
  function agenda(d, date) {
    const map = new Map();
    for (const row of (d.schedule || [])
      .filter(
        x => x.date === date && !(x.leave && ['Cancelled', 'Rejected'].includes(x.leave.status))
      )
      .sort((a, b) => a.time.localeCompare(b.time))) {
      const start = minute(row.time),
        end = minute(row.endTime || clock(Math.min(1440, start + 60)));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
      const id = row.bookingId || row.planId || row.time,
        prior = map.get(id);
      if (prior) {
        prior.start = Math.min(prior.start, start);
        prior.end = Math.max(prior.end, end);
        continue;
      }
      const task = (d.tasks || []).find(t => t.id === row.linkId),
        plan = (d.projectPlans || []).find(p => p.id === row.planId);
      const title =
        row.kind === 'task'
          ? task?.task || row.text || 'Task activity'
          : plan?.title || row.title || row.activity || row.text || 'Scheduled activity';
      map.set(id, { id, start, end, title: title.slice(0, 500), row, kind: row.kind });
    }
    return [...map.values()].sort((a, b) => a.start - b.start);
  }
  function union(intervals) {
    const out = [];
    for (const [start, end] of intervals
      .filter(([a, b]) => Number.isFinite(a) && b > a)
      .sort((a, b) => a[0] - b[0])) {
      const last = out.at(-1);
      if (last && start <= last[1]) last[1] = Math.max(last[1], end);
      else out.push([start, end]);
    }
    return out;
  }
  function gaps(d, date, after = 0) {
    const s = store(d).settings,
      start = Math.max(minute(s.workStart), after),
      end = minute(s.workEnd);
    let cursor = start;
    const out = [];
    for (const [a, b] of union(
      agenda(d, date).map(x => [Math.max(start, x.start), Math.min(end, x.end)])
    )) {
      if (a > cursor) out.push({ start: cursor, end: a, minutes: a - cursor });
      cursor = Math.max(cursor, b);
    }
    if (cursor < end) out.push({ start: cursor, end, minutes: end - cursor });
    return out;
  }
  function workload(d, date) {
    const s = store(d).settings,
      start = minute(s.workStart),
      end = minute(s.workEnd),
      sums = { task: 0, project: 0, custom: 0, leave: 0 };
    // Classify each occupied minute once, even when importing overlapping legacy rows.
    const slots = new Map();
    for (const a of agenda(d, date))
      for (let m = Math.max(start, a.start); m < Math.min(end, a.end); m++)
        if (!slots.has(m))
          slots.set(
            m,
            a.kind === 'task'
              ? 'task'
              : a.kind === 'project'
                ? 'project'
                : a.kind === 'custom'
                  ? 'custom'
                  : 'leave'
          );
    for (const k of slots.values()) sums[k]++;
    return { ...sums, free: end - start - slots.size, total: end - start };
  }
  function actual(d, date) {
    const lo = new Date(date + 'T00:00:00').getTime(),
      hiDate = new Date(lo);
    hiDate.setDate(hiDate.getDate() + 1);
    const hi = hiDate.getTime();
    const result = [];
    for (const s of d.workhub.sessions || []) {
      const parts =
        Array.isArray(s.intervals) && s.intervals.length
          ? s.intervals
          : [{ start: s.start, end: s.end }];
      let seconds = 0,
        first = Infinity,
        last = -Infinity;
      const intervals = [];
      for (const p of parts) {
        const a = Math.max(lo, Date.parse(p.start)),
          b = Math.min(hi, Date.parse(p.end));
        if (Number.isFinite(a) && b > a) {
          seconds += (b - a) / 1000;
          intervals.push({ start: (a - lo) / 60000, end: (b - lo) / 60000 });
          first = Math.min(first, a);
          last = Math.max(last, b);
        }
      }
      if (!s.intervals?.length && seconds) seconds = Math.min(seconds, s.seconds || seconds);
      if (seconds > 0)
        result.push({
          id: s.id,
          title: s.title,
          seconds,
          start: (first - lo) / 60000,
          end: (last - lo) / 60000,
          kind: s.kind,
          linkId: s.linkId,
          intervals,
        });
    }
    return result;
  }
  function snapshot(d, date) {
    return agenda(d, date)
      .filter(x => !x.row.sourceSessionId)
      .map(x => ({ id: x.id, title: x.title, start: x.start, end: x.end }));
  }
  function convertIdeas(d, ids, date) {
    const h = store(d),
      chosen = h.ideas.filter(x => ids.includes(x.id));
    if (!chosen.length) throw Error('Select at least one idea.');
    const created = [];
    for (const idea of chosen) {
      if (idea.taskId && d.tasks.some(t => t.id === idea.taskId)) continue;
      const id = uid();
      d.tasks.push({
        id,
        number: String(Math.max(0, ...d.tasks.map(t => +t.number || 0)) + 1),
        task: idea.title,
        taskType: 'Custom',
        linkId: '',
        customLink: 'Thinking canvas',
        priority: 'Medium',
        dueDate: '',
        done: false,
        doneDate: '',
        remarks: idea.notes,
        feedback: '',
        archived: false,
        archivedAt: '',
        boardStatus: 'todo',
        subTasks: [],
      });
      idea.taskId = id;
      created.push(id);
    }
    return created;
  }
  root.WorkHubMyDayEngine = {
    WIDGETS,
    SETTINGS,
    DEFAULT_WIDGETS,
    EFFORT,
    COLORS,
    upgrade,
    validate,
    store,
    day,
    profile,
    openTasks,
    taskOptions,
    agenda,
    gaps,
    workload,
    actual,
    snapshot,
    convertIdeas,
    uid,
    copy,
    minute,
    clock,
    union,
    dateOK,
  };
})(window);
