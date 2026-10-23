/**
 * Yearly AL / MC allowances and Schedule reservations. Pure rules; no account writes.
 * Days use integer half-day units. Settings live in workhub.leaveBalances, keyed by year.
 * Existing bookings are counted without rewriting their saved hours or approval details.
 */
(function (root) {
  'use strict';
  const TYPES = { 'annual-leave': 'Annual leave (AL)', 'medical-leave': 'Medical leave (MC)' };
  const BUILTINS = [
    { id: 'annual-leave', name: 'Annual Leave', code: 'AL', archived: false },
    { id: 'medical-leave', name: 'Medical Leave', code: 'MC', archived: false },
  ];
  const isKind = kind =>
    typeof kind === 'string' &&
    (Object.hasOwn(TYPES, kind) || /^leave-[a-z0-9][a-z0-9-]{0,88}$/.test(kind));
  const types = d => (d?.workhub?.leaveTypes === undefined ? BUILTINS : d.workhub.leaveTypes);
  const type = (d, kind) => types(d).find(t => t.id === kind);
  const typeLabel = (d, kind) => {
    const t = type(d, kind);
    return t ? t.name + ' (' + t.code + ')' : 'Saved leave';
  };
  const weekdays = kind => (kind === 'medical-leave' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]);
  const defaultPolicy = kind => ({
    allowance: null,
    openingUsed: 0,
    weekdays: weekdays(kind),
    excludeHolidays: kind === 'annual-leave',
  });
  const validYear = year => typeof year === 'string' && /^(19\d{2}|[2-9]\d{3})$/.test(year);
  const validDays = n =>
    typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 366 && Number.isInteger(n * 2);
  function defaults(year, d) {
    return {
      id: year,
      ...Object.fromEntries(types(d).map(t => [t.id, defaultPolicy(t.id)])),
    };
  }
  function upgrade(d) {
    if (d.workhub && d.workhub.publicHolidays === undefined) d.workhub.publicHolidays = [];
    if (d.workhub && d.workhub.leaveBalances === undefined) d.workhub.leaveBalances = [];
    if (d.workhub && d.workhub.leaveTypes === undefined)
      d.workhub.leaveTypes = BUILTINS.map(t => ({ ...t }));
    return d;
  }
  function validateTypes(rows) {
    if (!Array.isArray(rows) || rows.length < 2 || rows.length > 30)
      throw Error('Maintain between 2 and 30 leave types, including AL and MC.');
    const ids = new Set(),
      names = new Set(),
      codes = new Set();
    for (const t of rows) {
      if (
        !t ||
        !isKind(t.id) ||
        ids.has(t.id) ||
        typeof t.name !== 'string' ||
        !t.name.trim() ||
        t.name !== t.name.trim() ||
        t.name.length > 80 ||
        /[\u0000-\u001f]/.test(t.name) ||
        typeof t.code !== 'string' ||
        !/^[A-Z0-9][A-Z0-9-]{0,11}$/.test(t.code) ||
        typeof t.archived !== 'boolean' ||
        names.has(t.name.toLowerCase()) ||
        codes.has(t.code)
      )
        throw Error(
          'Leave type names, codes and IDs must be valid and unique. Use a short code of up to 12 letters, numbers or hyphens.'
        );
      ids.add(t.id);
      names.add(t.name.toLowerCase());
      codes.add(t.code);
    }
    if (!ids.has('annual-leave') || !ids.has('medical-leave'))
      throw Error('Keep the existing AL and MC types; archive a type instead of removing it.');
  }
  function validate(d) {
    const holidays = d.workhub?.publicHolidays === undefined ? [] : d.workhub.publicHolidays;
    if (
      !Array.isArray(holidays) ||
      holidays.length > 5000 ||
      new Set(holidays.map(h => h?.id)).size !== holidays.length ||
      holidays.some(
        h =>
          !h ||
          !root.WorkHubReminders.validDate(h.id) ||
          typeof h.name !== 'string' ||
          !h.name.trim() ||
          h.name !== h.name.trim() ||
          h.name.length > 120 ||
          /[\u0000-\u001f]/.test(h.name)
      )
    )
      throw Error('Public holidays need unique dates and names of up to 120 characters.');
    validateTypes(types(d));
    const years = d.workhub?.leaveBalances;
    if (!Array.isArray(years) || years.length > 100)
      throw Error('Check the yearly leave allowances.');
    const ids = new Set();
    for (const y of years) {
      if (!y || !validYear(y.id) || ids.has(y.id))
        throw Error('Use one leave allowance record per year (1900–9999).');
      ids.add(y.id);
      if (Object.keys(y).some(k => k !== 'id' && !type(d, k)))
        throw Error('An allowance refers to an unknown leave type.');
      for (const t of types(d)) {
        const kind = t.id;
        const p = y[kind];
        if (p === undefined && !Object.hasOwn(TYPES, kind)) continue;
        if (
          !p ||
          (p.excludeHolidays !== undefined && typeof p.excludeHolidays !== 'boolean') ||
          (p.allowance !== null && !validDays(p.allowance)) ||
          !validDays(p.openingUsed) ||
          !Array.isArray(p.weekdays) ||
          !p.weekdays.length ||
          p.weekdays.length > 7 ||
          p.weekdays.some(day => !Number.isInteger(day) || day < 0 || day > 6) ||
          new Set(p.weekdays).size !== p.weekdays.length
        )
          throw Error(
            'Enter leave days from 0 to 366 in half-day steps and choose the days that count.'
          );
      }
    }
    for (const s of d.schedule || [])
      if (
        isKind(s.kind) &&
        s.leave?.daysPerDate !== undefined &&
        ![0.5, 1].includes(s.leave.daysPerDate)
      )
        throw Error('Custom leave must charge either 0.5 or 1 day per date.');
    for (const s of d.schedule || [])
      if (isKind(s.kind) && !type(d, s.kind))
        throw Error(
          'A booking refers to an unknown leave type. Restore its maintained type before saving.'
        );
  }
  function policy(d, year, kind) {
    return {
      ...defaultPolicy(kind),
      ...(d.workhub?.leaveBalances || []).find(y => y.id === year)?.[kind],
    };
  }
  function units(row) {
    const p = row.leave || {};
    return ['morning', 'afternoon'].includes(p.portion)
      ? 1
      : p.portion === 'custom' && p.daysPerDate === 0.5
        ? 1
        : 2;
  }
  /** Group hourly fragments by booking/date, then cap each date at one day per leave type. */
  function scheduled(d, year, kind) {
    const p = policy(d, year, kind),
      holidays = new Set((d.workhub?.publicHolidays || []).map(h => h.id)),
      groups = new Map(),
      dates = new Map();
    for (const row of d.schedule || []) {
      if (
        row.kind !== kind ||
        row.date?.slice(0, 4) !== year ||
        !root.WorkHubReminders.validDate(row.date)
      )
        continue;
      if (!p.weekdays.includes(new Date(row.date + 'T00:00:00Z').getUTCDay())) continue;
      if (p.excludeHolidays && holidays.has(row.date)) continue;
      const key =
        row.date +
        '|' +
        (row.bookingId || row.planId || 'legacy-' + (row.leave?.portion || 'full'));
      const current = groups.get(key);
      if (!current || current.units < units(row))
        groups.set(key, { date: row.date, units: units(row) });
    }
    for (const row of groups.values())
      dates.set(row.date, Math.min(2, (dates.get(row.date) || 0) + row.units));
    return [...dates.values()].reduce((sum, n) => sum + n, 0) / 2;
  }
  function balance(d, year, kind) {
    const p = policy(d, year, kind),
      booked = scheduled(d, year, kind);
    return {
      year,
      kind,
      ...p,
      scheduled: booked,
      remaining: p.allowance === null ? null : p.allowance - p.openingUsed - booked,
    };
  }
  function dates(start, end) {
    if (
      !root.WorkHubReminders.validDate(start) ||
      !root.WorkHubReminders.validDate(end) ||
      end < start
    )
      throw Error('Choose a valid start and end date.');
    const from = Date.parse(start + 'T00:00:00Z'),
      length = (Date.parse(end + 'T00:00:00Z') - from) / 86400000 + 1;
    if (length > 5000) throw Error('Choose a shorter leave date range.');
    return Array.from({ length }, (_, i) =>
      new Date(from + i * 86400000).toISOString().slice(0, 10)
    );
  }
  function sameBooking(row, draft) {
    return draft.bookingId
      ? row.bookingId === draft.bookingId
      : row.date === draft.originalDate && row.time === draft.originalTime;
  }
  /** Build the exact replacement for preview; exclude the old booking so edits do not double count. */
  function preview(d, draft) {
    const selectedDates = dates(draft.date, draft.endDate || draft.date),
      schedule = (d.schedule || []).filter(row => !sameBooking(row, draft)),
      base = { ...d, schedule },
      next = {
        ...d,
        schedule: [
          ...schedule,
          ...selectedDates.map(date => ({
            ...draft,
            date,
            bookingId: '__leave_preview__',
            time: draft.time || '09:00',
          })),
        ],
      },
      years = [...new Set(selectedDates.map(date => date.slice(0, 4)))];
    return {
      next,
      years,
      rows: years.map(year => {
        const before = balance(base, year, draft.kind),
          after = balance(next, year, draft.kind);
        return {
          ...after,
          beforeRemaining: before.remaining,
          requested: after.scheduled - before.scheduled,
        };
      }),
    };
  }
  /** Quotas guard new/increased reservations, while allowing older overdrawn records to be reduced. */
  function assertWithinBalance(previous, next) {
    for (const y of next.workhub.leaveBalances)
      for (const t of types(next)) {
        const kind = t.id;
        const after = balance(next, y.id, kind),
          before = balance(previous, y.id, kind);
        if (after.remaining !== null && after.remaining < 0 && after.scheduled > before.scheduled)
          throw Error(
            `${typeLabel(next, kind)} for ${y.id}: only ${Math.max(0, before.remaining)} day(s) remain. Reduce this range or update your allowance in Settings.`
          );
      }
  }
  root.WorkHubLeaveBalancesEngine = {
    TYPES,
    types,
    type,
    typeLabel,
    isKind,
    validateTypes,
    defaults,
    upgrade,
    validate,
    validYear,
    policy,
    balance,
    scheduled,
    dates,
    preview,
    assertWithinBalance,
  };
})(window);
