/**
 * reminders.js
 * Account reminder dates/times, visible alerts, calendar export and record decorations.
 * Compact reminder data saves with the workhub document; timers only refresh the visible interface.
 * These are in-app reminders; this module does not send messages when the website is closed.
 * File map: docs/FILE-MAP.md
 */
/* Account-owned reminder dates. No background messaging or paid services. */
(function (root) {
  'use strict';
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const TYPES = { tickets: 'Ticket', tasks: 'Task', projects: 'Project' };
  const date = d =>
    [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  const validDate = s =>
    typeof s === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s + 'T12:00:00Z')) &&
    new Date(s + 'T12:00:00Z').toISOString().slice(0, 10) === s;
  function shift(s, n) {
    const d = new Date(s + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return date(d);
  }
  const validTime = s => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const localTime = d =>
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  /** Store a fixed instant; reject impossible local times instead of silently shifting them. */
  function localInstant(day, time) {
    if (!validDate(day) || !validTime(time)) throw Error('Choose a valid date and time.');
    const d = new Date(day + 'T' + time + ':00');
    if (!Number.isFinite(d.getTime()) || date(d) !== day || localTime(d) !== time)
      throw Error('That time is unavailable in your timezone. Choose another time.');
    return d.toISOString();
  }
  const hides = r => r.hideUntilDue ?? !r.at;
  const isDue = (r, today, now = Date.now()) => (r.at ? Date.parse(r.at) <= now : r.until <= today);
  const when = r =>
    r.at
      ? new Date(r.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : r.until;
  /** A calendar copy is explicit, local and independent of the in-app reminder. */
  function calendar(r, url = 'https://losthaidid.github.io/mm-tracker/') {
    if (!r.at || !Number.isFinite(Date.parse(r.at))) throw Error('Set a reminder time first.');
    const text = s =>
        String(s || '')
          .replace(/\\/g, '\\\\')
          .replace(/\r\n?|\n/g, '\\n')
          .replace(/[,;]/g, '\\$&'),
      stamp = s =>
        new Date(s)
          .toISOString()
          .replace(/[-:]/g, '')
          .replace(/\.\d{3}/, ''),
      title = String(r.title || 'WorkHub reminder'),
      encoder = new TextEncoder();
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//WorkHub//Reminders//EN',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:' + encodeURIComponent(r.id) + '@workhub',
      'DTSTAMP:' + stamp(r.updatedAt),
      'DTSTART:' + stamp(r.at),
      'DTEND:' + stamp(Date.parse(r.at) + 15 * 60000),
      'SUMMARY:' + text(title),
      'DESCRIPTION:' + text([r.note, 'Review in WorkHub: ' + url].filter(Boolean).join('\n')),
      'URL:' + url,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT0S',
      'DESCRIPTION:' + text(r.note || title),
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    // iCalendar folds by UTF-8 bytes, not JavaScript character count.
    return (
      lines
        .map(line => {
          let out = '',
            count = 0;
          for (const ch of line) {
            const n = encoder.encode(ch).length;
            if (count + n > 75) {
              out += '\r\n ';
              count = 1;
            }
            out += ch;
            count += n;
          }
          return out;
        })
        .join('\r\n') + '\r\n'
    );
  }
  function upgrade(d) {
    if (d.workhub && d.workhub.reminders === undefined) d.workhub.reminders = [];
    return d;
  }
  function validate(d) {
    const rs = d.workhub.reminders;
    if (!Array.isArray(rs) || rs.length > 5000) throw Error('Check reminder records.');
    const ids = new Set();
    for (const r of rs) {
      if (
        !r ||
        !Object.hasOwn(TYPES, r.kind) ||
        typeof r.recordId !== 'string' ||
        r.recordId.length > 100 ||
        !r.recordId ||
        r.id !== r.kind + ':' + r.recordId ||
        ids.has(r.id) ||
        !validDate(r.until) ||
        typeof r.note !== 'string' ||
        r.note.length > 2000 ||
        typeof r.updatedAt !== 'string' ||
        !Number.isFinite(Date.parse(r.updatedAt)) ||
        (r.at !== undefined &&
          (typeof r.at !== 'string' ||
            !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.at) ||
            !Number.isFinite(Date.parse(r.at)) ||
            new Date(r.at).toISOString() !== r.at)) ||
        (r.hideUntilDue !== undefined && typeof r.hideUntilDue !== 'boolean')
      )
        throw Error('Check reminder dates and notes.');
      ids.add(r.id);
    }
  }
  const lookup = (d, kind, id) =>
    d.workhub?.reminders?.find(r => r.kind === kind && r.recordId === id);
  const isSnoozed = (d, kind, id, today, now = Date.now()) => {
    const r = lookup(d, kind, id);
    return !!r && hides(r) && !isDue(r, today, now);
  };
  function records(d, today, now) {
    // Historical report snapshots use the end of that local day; live views use the clock.
    now ??= today === date(new Date()) ? Date.now() : new Date(today + 'T23:59:59.999').getTime();
    const maps = Object.fromEntries(
      Object.keys(TYPES).map(k => [k, new Map((d[k] || []).map(r => [r.id, r]))])
    );
    return (d.workhub?.reminders || [])
      .map(r => ({ ...r, record: maps[r.kind]?.get(r.recordId) }))
      .filter(r => r.record)
      .map(r => ({
        ...r,
        title:
          r.kind === 'tickets'
            ? [r.record.ticket, r.record.description].filter(Boolean).join(' · ')
            : r.kind === 'tasks'
              ? r.record.task
              : r.record.name,
        due: isDue(r, today, now),
        hidden: hides(r),
        when: when(r),
      }))
      .sort(
        (a, b) => (a.at || a.until).localeCompare(b.at || b.until) || a.title.localeCompare(b.title)
      );
  }
  function install(a) {
    const $ = id => document.getElementById(id),
      items = () => records(a.state(), a.today(), Date.now());
    let lastDay = a.today(),
      announced = '',
      owner = '',
      lastSignature = '',
      alertSignature = '',
      seen = new Set();
    const alertKey = r => r.id + '|' + (r.at || r.until) + '|' + r.updatedAt;
    function syncOwner() {
      const next = a.cloud().ready ? a.cloud().user?.id || '' : '';
      if (next !== owner) {
        owner = next;
        announced = '';
        lastSignature = '';
        alertSignature = '';
        seen = new Set();
        $('reminderAlert')?.remove();
        const oldReview = document.querySelector('#reminderForm,.reminder-inbox');
        if (oldReview && oldReview.dataset.owner !== next && $('modal')?.open) a.closeModal();
        if (owner)
          try {
            const saved = JSON.parse(
              localStorage.getItem('mm-tracker.reminder-seen.' + owner) || '[]'
            );
            if (Array.isArray(saved))
              seen = new Set(saved.filter(x => typeof x === 'string').slice(-5000));
          } catch {}
      }
      return !!owner;
    }
    function rememberSeen(rs) {
      for (const r of rs) seen.add(alertKey(r));
      const current = new Set(items().map(alertKey));
      seen = new Set([...seen].filter(key => current.has(key)));
      try {
        localStorage.setItem('mm-tracker.reminder-seen.' + owner, JSON.stringify([...seen]));
      } catch {}
      syncAlert();
    }
    function endOfDay() {
      try {
        const time = localStorage.getItem('mm-tracker.reminder-end-time');
        if (validTime(time)) return time;
      } catch {}
      return '18:00';
    }
    const button = (action, label, r) =>
      `<button type="button" class="small" data-owner="${esc(owner)}" data-reminder="${action}" data-kind="${esc(r.kind)}" data-id="${esc(r.recordId)}">${label}</button>`;
    function change(fn, message) {
      const ok = a.mutate(d => {
        upgrade(d);
        fn(d.workhub.reminders, d);
      });
      if (ok) {
        a.tell(message);
        a.closeModal();
      }
      return ok;
    }
    function set(kind, id, until, note = '') {
      syncOwner();
      if (!Object.hasOwn(TYPES, kind) || !a.state()[kind].some(r => r.id === id))
        throw Error('That record no longer exists.');
      if (!validDate(until) || until <= a.today())
        throw Error('Choose a reminder date after today.');
      if (note.length > 2000) throw Error('Keep the reminder note within 2,000 characters.');
      return change(
        rs => {
          const r = {
              id: kind + ':' + id,
              kind,
              recordId: id,
              until,
              note: note.trim(),
              updatedAt: new Date().toISOString(),
            },
            i = rs.findIndex(x => x.id === r.id);
          if (i < 0) rs.push(r);
          else rs[i] = r;
        },
        'Set aside until ' + until + '. Your status and due date are kept.'
      );
    }
    function schedule(kind, id, at, note = '', hideUntilDue = false) {
      if (!syncOwner()) throw Error('Sign in before setting reminders.');
      if (!Object.hasOwn(TYPES, kind) || !a.state()[kind].some(r => r.id === id))
        throw Error('That record no longer exists.');
      const instant = Date.parse(at);
      if (!Number.isFinite(instant) || instant <= Date.now())
        throw Error('Choose a date and time in the future.');
      if (typeof note !== 'string' || note.length > 2000)
        throw Error('Keep the reminder note within 2,000 characters.');
      if (typeof hideUntilDue !== 'boolean') throw Error('Choose whether to hide the item.');
      const d = new Date(instant);
      return change(
        rs => {
          const r = {
            id: kind + ':' + id,
            kind,
            recordId: id,
            until: date(d),
            at: d.toISOString(),
            hideUntilDue,
            note: note.trim(),
            updatedAt: new Date().toISOString(),
          };
          const i = rs.findIndex(x => x.id === r.id);
          if (i < 0) rs.push(r);
          else rs[i] = r;
        },
        'Reminder set for ' + when({ at: d.toISOString() }) + '.'
      );
    }
    function snooze(kind, id, minutes) {
      if (!syncOwner()) return;
      const r = lookup(a.state(), kind, id);
      if (!r || ![15, 60].includes(minutes)) throw Error('Choose a valid reminder delay.');
      schedule(kind, id, new Date(Date.now() + minutes * 60000).toISOString(), r.note, hides(r));
    }
    function exportCalendar(kind, id) {
      if (!syncOwner()) return;
      const r = items().find(r => r.kind === kind && r.recordId === id);
      if (!r?.at) throw Error('Set a reminder time first.');
      a.download(calendar(r), 'workhub-reminder.ics', 'text/calendar;charset=utf-8');
      a.tell(
        'Open the downloaded calendar file and confirm its alert. Calendar copies do not update automatically.'
      );
    }
    function dismiss(kind, id) {
      if (!syncOwner()) return;
      return change(rs => {
        const i = rs.findIndex(r => r.kind === kind && r.recordId === id);
        if (i >= 0) rs.splice(i, 1);
      }, 'Reminder cleared. The item is available in its normal view.');
    }
    function editor(kind, id) {
      if (!syncOwner()) throw Error('Sign in before setting reminders.');
      const item = a.state()[kind]?.find(x => x.id === id);
      if (!item) throw Error('That record no longer exists.');
      const r = lookup(a.state(), kind, id),
        title =
          kind === 'tickets'
            ? [item.ticket, item.description].filter(Boolean).join(' · ')
            : kind === 'tasks'
              ? item.task
              : item.name;
      let initial = r?.at
        ? new Date(r.at)
        : new Date((r?.until || a.today()) + 'T' + (r ? '09:00' : endOfDay()));
      if (!r && initial.getTime() <= Date.now()) initial.setDate(initial.getDate() + 1);
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'your device timezone';
      a.openModal(
        'Choose your reminder moment',
        `<div class="reminder-record"><span class="hub-kicker">A NUDGE AT THE RIGHT MOMENT · ${TYPES[kind]}</span><h3 class="hub-sensitive">${esc(title)}</h3></div><form id="reminderForm" data-owner="${esc(owner)}" data-kind="${kind}" data-id="${esc(id)}"><div class="reminder-quick-grid" role="group" aria-label="Quick reminder times">${[
          ['15', 'In 15 minutes'],
          ['60', 'In 1 hour'],
          ['120', 'In 2 hours'],
          ['eod', 'End of day · ' + endOfDay()],
          ['morning', 'Tomorrow · 09:00'],
        ]
          .map(
            ([key, label]) =>
              `<button type="button" data-reminder="quick" data-quick="${key}">${label}</button>`
          )
          .join(
            ''
          )}</div><label class="reminder-end-setting">My end-of-day time<input id="reminderEndTime" type="time" value="${endOfDay()}" aria-label="My end-of-day time"></label><div class="form-grid"><div><label for="reminderDate">Date</label><input id="reminderDate" name="until" type="date" min="${a.today()}" value="${date(initial)}" required></div><div><label for="reminderTime">Time</label><input id="reminderTime" name="time" type="time" value="${localTime(initial)}" step="60" required></div><div class="wide"><label for="reminderNote">What should I remind you to do?</label><textarea id="reminderNote" name="note" maxlength="2000" placeholder="For example: update the ticket before signing off">${esc(r?.note || '')}</textarea></div></div><p id="reminderPreview" class="reminder-time-preview" role="status"></p><p class="hub-meta">Times use ${esc(zone)}. This date and time sync to your other devices as the same moment.</p><details class="reminder-more-days"><summary>Choose a number of days instead</summary><div class="reminder-presets" role="group" aria-label="Choose days">${[1, 3, 7, 14, 30].map(n => `<button type="button" data-reminder="days" data-days="${n}">${n} day${n === 1 ? '' : 's'}</button>`).join('')}</div><label for="reminderDays">Number of days</label><input id="reminderDays" name="days" type="number" min="0" max="3650" value="0" inputmode="numeric"></details><label class="check-label reminder-hide-choice"><input type="checkbox" name="hideUntilDue"${r && hides(r) ? ' checked' : ''}>Hide this item until the reminder is due</label><p class="hub-meta">Leave this off to keep the item visible and get an alert at the chosen time. While WorkHub is closed, alerts wait until your next visit. Add a saved reminder to your calendar for phone alerts; confirm the calendar’s alert settings.</p>${kind === 'projects' ? '<p class="hub-meta">This project reminder has its own time. Its tasks and tickets keep their own reminders.</p>' : ''}<div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Set reminder</button></div></form>`
      );
      $('reminderDays').value = Math.max(
        0,
        Math.round((Date.parse($('reminderDate').value) - Date.parse(a.today())) / 86400000)
      );
      previewTime();
    }
    function previewTime() {
      if (!$('reminderPreview')) return;
      try {
        const at = localInstant($('reminderDate').value, $('reminderTime').value);
        $('reminderPreview').textContent =
          Date.parse(at) > Date.now()
            ? 'Your reminder: ' + when({ at })
            : 'Choose a future time for this reminder.';
      } catch {
        $('reminderPreview').textContent = 'Choose a valid reminder date and time.';
      }
    }
    function quick(key) {
      const form = $('reminderForm');
      if (!form || form.dataset.owner !== owner) return;
      let d;
      if (['15', '60', '120'].includes(key)) {
        // Round up to the next minute so a short delay is never shortened by seconds.
        d = new Date(Math.ceil((Date.now() + Number(key) * 60000) / 60000) * 60000);
      } else if (key === 'morning') d = new Date(shift(a.today(), 1) + 'T09:00');
      else if (key === 'eod') {
        d = new Date(a.today() + 'T' + endOfDay());
        if (d.getTime() <= Date.now()) d = new Date(shift(a.today(), 1) + 'T' + endOfDay());
      } else return;
      $('reminderDate').value = date(d);
      $('reminderTime').value = localTime(d);
      $('reminderDays').value = Math.round(
        (Date.parse(date(d)) - Date.parse(a.today())) / 86400000
      );
      previewTime();
    }
    function open(kind, id) {
      if (!syncOwner()) return;
      const r = items().find(r => r.kind === kind && r.recordId === id);
      if (r?.due) rememberSeen([r]);
      if (kind === 'projects') a.project(id);
      else if (kind === 'tickets') a.ticket(id);
      else {
        a.closeModal();
        a.hubAction({ dataset: { hub: 'task-detail', id } });
      }
    }
    function rows(rs) {
      return rs
        .map(
          r =>
            `<article class="reminder-row"><div><span class="hub-badge">${TYPES[r.kind]} · ${r.due ? 'Time to revisit' : r.hidden ? 'Snoozed' : 'Scheduled'}</span><h4 class="hub-sensitive">${esc(r.title)}</h4>${r.note ? `<p class="hub-sensitive">${esc(r.note)}</p>` : ''}<small>${r.at ? 'Reminder time: ' : 'Reminder date: '}${esc(r.when)}</small></div><div class="actions">${button('open', 'Open', r)}${r.due ? button('later15', '＋15 min', r) + button('later60', '＋1 hour', r) : ''}${button('edit', r.due ? 'Remind me again' : 'Change date & time', r)}${r.at && !r.due ? button('calendar', '↓ Add to calendar', r) : ''}${button('dismiss', r.due ? 'Dismiss reminder' : r.hidden ? 'Bring back now' : 'Clear reminder', r)}</div></article>`
        )
        .join('');
    }
    function inbox() {
      if (!syncOwner()) return;
      const all = items(),
        due = all.filter(r => r.due),
        sleep = all.filter(r => !r.due);
      a.openModal(
        'Your reminders',
        `<div class="reminder-inbox" data-owner="${esc(owner)}"><h3>Time to revisit · ${due.length}</h3>${rows(due) || '<p class="hub-meta">Nothing is due for review.</p>'}<details${due.length ? '' : ' open'}><summary>Upcoming · ${sleep.length}</summary>${rows(sleep) || '<p class="hub-meta">Set a reminder from any ticket, task or project.</p>'}</details><p class="hub-meta">Calendar downloads are separate copies. After changing or dismissing a WorkHub reminder, update the calendar copy yourself.</p></div>`
      );
    }
    /** A non-modal alert waits until editing/privacy is finished; it never steals focus. */
    function syncAlert() {
      if (
        !syncOwner() ||
        document.hidden ||
        document.body.matches('.hub-private,.hub-present') ||
        document.querySelector('dialog[open]') ||
        document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')
      ) {
        $('reminderAlert')?.remove();
        alertSignature = '';
        return;
      }
      const due = items().filter(r => r.due && !seen.has(alertKey(r)));
      if (!due.length) {
        $('reminderAlert')?.remove();
        alertSignature = '';
        return;
      }
      const signature = JSON.stringify(due.map(r => [alertKey(r), r.title, r.note]));
      if (signature === alertSignature && $('reminderAlert')) return;
      alertSignature = signature;
      const panel = $('reminderAlert') || document.createElement('section');
      panel.id = 'reminderAlert';
      panel.className = 'reminder-alert';
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-label', 'Due reminders');
      panel.setAttribute('aria-live', 'polite');
      panel.innerHTML = `<header><div><span class="hub-kicker">A GENTLE NUDGE</span><h3>${due.length === 1 ? 'Your reminder is due' : due.length + ' reminders are due'}</h3></div><button type="button" data-reminder="hide-alert" aria-label="Hide reminder alert">×</button></header><div class="reminder-alert-items">${rows(due.slice(0, 3))}</div><button type="button" data-reminder="inbox">Open reminder inbox${due.length > 3 ? ' · ' + due.length : ''}</button>`;
      if (!panel.isConnected) document.body.append(panel);
      const key = due.map(alertKey).join('|');
      if (key !== announced) {
        announced = key;
        a.react?.(
          'busy',
          due.length === 1
            ? 'Your reminder is due. Open it when you’re ready.'
            : due.length + ' reminders are due. Open Reminders to review.'
        );
      }
    }
    const signatureOf = all => all.map(r => alertKey(r) + ':' + r.due).join('|');
    function decorate(tab) {
      if (!syncOwner()) return;
      const all = items(),
        due = all.filter(r => r.due);
      lastSignature = signatureOf(all);
      lastDay = a.today();
      let toolbar = $('hubToolbar');
      if (toolbar && !$('reminderInboxButton')) {
        const b = document.createElement('button');
        b.id = 'reminderInboxButton';
        b.dataset.reminder = 'inbox';
        toolbar.append(b);
      }
      if ($('reminderInboxButton'))
        $('reminderInboxButton').textContent =
          '◷ Reminders' + (due.length ? ' · ' + due.length : '');
      if ($('reminderInboxButton')) $('reminderInboxButton').dataset.owner = owner;
      const view = $('view');
      if (!view) return;
      function attach(target, kind, id) {
        if (!target || target.querySelector(':scope > [data-reminder="edit"]')) return;
        const r = lookup(a.state(), kind, id),
          holder = document.createElement('div');
        holder.className = 'reminder-item-control';
        holder.innerHTML = button(
          'edit',
          r && isDue(r, a.today())
            ? 'Time to revisit · Remind me again'
            : r?.at
              ? '◷ ' + esc(when(r))
              : 'Remind me in…',
          { kind, recordId: id }
        );
        if (r && isDue(r, a.today())) holder.classList.add('is-due');
        target.append(holder);
      }
      if (tab === 'tickets')
        for (const card of view.querySelectorAll('.ticket-queue-card,.ticket-card,tr')) {
          const b = card.querySelector(
            '[data-action="edit"][data-group="tickets"],[data-action="detail"][data-id]'
          );
          if (b)
            attach(card.tagName === 'TR' ? card.lastElementChild : card, 'tickets', b.dataset.id);
        }
      if (tab === 'tasks')
        for (const card of view.querySelectorAll('.task-main-card,[data-task-card]')) {
          const id =
            card.dataset.taskCard ||
            card.querySelector('[data-action="edit"][data-group="tasks"]')?.dataset.id;
          if (id) attach(card, 'tasks', id);
        }
      if (tab === 'specs') {
        attach(
          view.querySelector('.project-banner .actions'),
          'projects',
          a.state().activeProjectId
        );
        for (const row of view.querySelectorAll('[data-project-id]'))
          attach(row, 'projects', row.dataset.projectId);
      }
      const kind =
        tab === 'tickets'
          ? 'tickets'
          : tab === 'tasks'
            ? 'tasks'
            : tab === 'specs'
              ? 'projects'
              : '';
      if (kind) {
        const snoozed = all.filter(r => r.kind === kind && !r.due && r.hidden);
        if (snoozed.length) {
          const box = document.createElement('details');
          box.className = 'reminder-snoozed';
          box.innerHTML = `<summary>Snoozed ${TYPES[kind].toLowerCase()}${snoozed.length === 1 ? '' : 's'} · ${snoozed.length}</summary>${rows(snoozed)}`;
          view.prepend(box);
        }
      }
      if (tab === 'home' && due.length) {
        const panel = document.createElement('section');
        panel.className = 'hub-card reminder-due-panel';
        panel.innerHTML = `<div class="flex-title"><div><span class="hub-kicker">WELCOME BACK TO THESE</span><h3>Time to revisit · ${due.length}</h3></div><button type="button" data-reminder="inbox">All reminders</button></div>${rows(due.slice(0, 5))}`;
        view.querySelector('.hub-layout')?.before(panel);
      }
      syncAlert();
    }
    document.addEventListener(
      'click',
      event => {
        const el = event.target.closest?.('[data-reminder]');
        if (!el) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        try {
          if (!syncOwner() || (el.dataset.owner && el.dataset.owner !== owner)) return;
          const form = el.closest('#reminderForm');
          if (form && form.dataset.owner !== owner) return;
          const action = el.dataset.reminder,
            kind = el.dataset.kind,
            id = el.dataset.id;
          if (action === 'inbox') {
            rememberSeen(items().filter(r => r.due));
            inbox();
          }
          if (action === 'edit') editor(kind, id);
          if (action === 'open') open(kind, id);
          if (action === 'dismiss') dismiss(kind, id);
          if (action === 'quick') quick(el.dataset.quick);
          if (action === 'calendar') exportCalendar(kind, id);
          if (action === 'later15') snooze(kind, id, 15);
          if (action === 'later60') snooze(kind, id, 60);
          if (action === 'hide-alert') rememberSeen(items().filter(r => r.due));
          if (action === 'days') {
            const n = Number(el.dataset.days);
            $('reminderDays').value = n;
            $('reminderDate').value = shift(a.today(), n);
            previewTime();
          }
        } catch (error) {
          a.tell(error.message, true);
        }
      },
      true
    );
    document.addEventListener('input', event => {
      const form = event.target.closest?.('#reminderForm');
      if (!form || !syncOwner() || form.dataset.owner !== owner) return;
      if (event.target.id === 'reminderDays') {
        const n = Number(event.target.value);
        if (Number.isInteger(n) && n >= 0 && n <= 3650)
          $('reminderDate').value = shift(a.today(), n);
      }
      if (event.target.id === 'reminderDate' && validDate(event.target.value))
        $('reminderDays').value = Math.round(
          (Date.parse(event.target.value) - Date.parse(a.today())) / 86400000
        );
      previewTime();
    });
    document.addEventListener('change', event => {
      if (event.target.id === 'reminderEndTime' && validTime(event.target.value)) {
        try {
          localStorage.setItem('mm-tracker.reminder-end-time', event.target.value);
        } catch {}
        const b = document.querySelector('[data-reminder="quick"][data-quick="eod"]');
        if (b) b.textContent = 'End of day · ' + event.target.value;
      }
      if (['reminderDate', 'reminderTime'].includes(event.target.id)) previewTime();
    });
    document.addEventListener(
      'submit',
      event => {
        if (event.target.id !== 'reminderForm') return;
        event.preventDefault();
        event.stopImmediatePropagation();
        try {
          const f = event.target;
          if (!syncOwner() || f.dataset.owner !== owner)
            throw Error('Reopen the reminder for the current account.');
          schedule(
            f.dataset.kind,
            f.dataset.id,
            localInstant(f.elements.namedItem('until').value, f.elements.namedItem('time').value),
            f.elements.namedItem('note').value,
            f.elements.namedItem('hideUntilDue').checked
          );
        } catch (error) {
          a.tell(error.message, true);
        }
      },
      true
    );
    function tick() {
      if (!syncOwner()) return;
      if (document.hidden) {
        $('reminderAlert')?.remove();
        alertSignature = '';
        return;
      }
      const all = items(),
        signature = signatureOf(all);
      if (
        (lastDay !== a.today() || signature !== lastSignature) &&
        !document.querySelector('dialog[open] form')
      ) {
        lastDay = a.today();
        lastSignature = signature;
        a.render();
      }
      syncAlert();
    }
    root.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) tick();
    });
    setInterval(tick, 5000);
    return { set, schedule, snooze, dismiss, editor, inbox, decorate, tick, exportCalendar };
  }
  root.WorkHubReminders = {
    upgrade,
    validate,
    isSnoozed,
    lookup,
    records,
    shift,
    validDate,
    validTime,
    localInstant,
    localTime,
    isDue,
    calendar,
    when,
    install,
  };
})(window);
