/**
 * app.js
 * Main application: state, core editors, Projects, Schedule, exports and cloud saving.
 * Owns the account record document. Feature modules call mutate() through studio.js.
 * Start learning at FIELDS, render(), mutate() and saveCloud(); see docs/EDITING-GUIDE.md.
 * File map: docs/FILE-MAP.md
 */

'use strict';
let hub = null;

// =============================================================================
// 1. Defaults, field definitions and shared helpers
// =============================================================================
const $ = id => document.getElementById(id),
  KEY = 'mm-tracker.web.v4:' + location.pathname.replace(/\/index\.html$/, '/'),
  LIMIT = 5000;
const CLOUD_MODE = !!$('cloudConfig')?.textContent;
const seed = JSON.parse($('seedData').textContent),
  clone = v => JSON.parse(JSON.stringify(v));
const STEPS = [
  'Analysing/Designing',
  'Functional Spec',
  'Sr Review',
  'ABAP Estimation',
  'ADL Approval Dev',
  'ABAP Dev',
  'ABAP Fixing',
  'Unit Testing',
  'UAT',
  'External Approval',
  'BASIS',
  'FMP',
];
const OPTIONS = {
  priority: ['Critical', 'High', 'Medium', 'Low'],
  status: [
    'Pending',
    'On Hold',
    'Closed',
    'not yet started',
    'Work In Progress',
    'Completed',
    'Not started yet',
  ],
  object: ['Internal', 'Senior', 'External', 'ABAP', 'BASIS', 'ADL', 'Closed', 'On Hold'],
  action: [
    'Review',
    'Internal Creation',
    'Mandays Estimation',
    'Development',
    'Testing',
    'UAT',
    'Closed',
    'Email',
    'Approval',
    'Sign Off',
  ],
  transport: ['FMD', 'FMQ', 'FMP', 'N/A'],
  type: ['Enhancement', 'Fixing', 'Change Requests', 'New'],
  specStatus: [
    'Not yet Started',
    'In Progress',
    'Completed',
    'Testing',
    'Development',
    'UAT',
    'Pending Review',
  ],
  specPriority: ['A', 'B', 'C'],
};
// Each field: [saved property name, visible label, control type, required?].
// Change the label for wording edits; saved property names are part of the backup/data format.
const FIELDS = {
  tickets: [
    ['ticket', 'AMS Ticket', 'text', true],
    ['jira', 'JIRA Ticket / Charge Code'],
    ['created', 'Date Created', 'date'],
    ['description', 'Description', 'textarea', true],
    ['priority', 'Priority', 'select'],
    ['pic', 'PIC'],
    ['status', 'Status', 'select', true],
    ['object', 'Object', 'select'],
    ['action', 'Action', 'select'],
    ['transport', 'Latest Transport', 'select'],
    ['type', 'Type', 'select'],
    ['mandays', 'Mandays Chargable', 'number'],
    ['history', 'History tracker', 'textarea'],
    ['historyDate', 'History date', 'date'],
    ['historyTime', 'History time', 'time'],
  ],
  tasks: [
    ['number', 'No.'],
    ['task', 'Task', 'textarea', true],
    ['priority', 'Priority', 'select'],
    ['dueDate', 'Due date', 'date'],
    ['done', 'Done?', 'checkbox'],
    ['doneDate', 'Date done', 'date'],
    ['remarks', 'Remarks', 'textarea'],
    ['feedback', 'Feedback', 'textarea'],
  ],
  specs: [
    ['itemType', 'Item type', 'select', true],
    ['itemId', 'Item ID'],
    ['description', 'Description', 'textarea', true],
    ['status', 'Status', 'select', true],
    ['priority', 'Priority', 'select'],
    ['expectedDate', 'Expected date', 'date'],
    ['dueDate', 'Due date', 'date'],
    ['remarks', 'Remarks', 'textarea'],
    ['feedback', 'Feedback updates', 'textarea'],
    ['reference', 'Reference File'],
    ['url', 'Reference link', 'url'],
  ],
};
let state = upgradeFeatures(upgradeLegacy(clone(seed))),
  temporary = false,
  corrupt = false,
  lastRaw = null,
  tab = 'home',
  filterState = { query: '', status: 'Pending', object: '', priority: '' },
  progressQuery = '',
  progressFilter = '',
  tasksQuery = '',
  specQuery = '',
  specFilter = '',
  month = seed.calendarMonth,
  toastTimer;
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const timeNow = () => new Date().toTimeString().slice(0, 8);
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  'r' + Date.now().toString(36) + Math.random().toString(36).slice(2);
/** Escape user-controlled values before including them in generated HTML. Use textContent for plain text. */
const esc = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
const dateLabel = s => (s ? esc(s) : '—');
/** Wrap records in the versioned backup/cloud format. Changing field meanings needs upgrade and validation support. */
const payload = d =>
  JSON.stringify(
    { app: 'mm-ticket-tracker', version: 9, savedAt: new Date().toISOString(), data: d },
    null,
    2
  );
const emptyState = () =>
  upgradeFeatures(
    upgradeLegacy({
      tickets: [],
      trackers: [],
      tasks: [],
      specs: [],
      schedule: [],
      lists: clone(seed.lists),
      calendarMonth: seed.calendarMonth,
      source: seed.source,
    })
  );
function upgradeLegacy(d) {
  if (!d || typeof d !== 'object') return d;
  d.projects = [{ id: 'project-default', name: 'SAP Projects', code: '' }];
  d.activeProjectId = 'project-default';
  if (Array.isArray(d.specs)) d.specs.forEach(r => (r.projectId = 'project-default'));
  if (Array.isArray(d.schedule))
    d.schedule.forEach(r => {
      r.kind = 'custom';
      r.linkId = '';
      r.activity = '';
    });
  return d;
}
function validDate(s) {
  if (s === '') return true;
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s) || s < '1900-01-01') return false;
  const d = new Date(s + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
function checkText(s, max = 32767) {
  return (
    typeof s === 'string' && s.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s)
  );
}
/** Check the whole document before accepting a restore or save. Delegates feature-specific rules below. */
function validate(d) {
  if (!d || typeof d !== 'object') throw Error('Invalid backup data.');
  for (const group of ['tickets', 'trackers', 'tasks', 'specs', 'schedule'])
    if (!Array.isArray(d[group]) || d[group].length > LIMIT)
      throw Error('Each section supports up to 5,000 records.');
  for (const group of ['tickets', 'tasks', 'specs'])
    for (const r of d[group]) {
      if (!checkText(r.id, 100) || !r.id) throw Error('Invalid record ID.');
      for (const [k, label, type, required] of FIELDS[group]) {
        const v = r[k];
        if (type === 'checkbox') {
          if (typeof v !== 'boolean') throw Error('Invalid checkbox.');
        } else if (type === 'number') {
          if (v !== null && (typeof v !== 'number' || !Number.isFinite(v) || v < 0))
            throw Error('Mandays must be a positive number or blank.');
        } else {
          if (!checkText(v)) throw Error('Invalid or oversized text field.');
          if (required && !v.trim()) throw Error(label + ' is required.');
          if (type === 'date' && !validDate(v)) throw Error('Invalid ' + label + '.');
          if (type === 'time' && v && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v))
            throw Error('Invalid time.');
          if (type === 'url' && v && !/^https?:\/\//i.test(v))
            throw Error('Use an http or https reference link.');
        }
      }
    }
  for (const group of ['tickets', 'trackers', 'tasks', 'specs'])
    if (new Set(d[group].map(r => r.id)).size !== d[group].length)
      throw Error('Duplicate record IDs.');
  if (new Set(d.tickets.map(r => r.ticket.trim().toLowerCase())).size !== d.tickets.length)
    throw Error('AMS Ticket values must be unique.');
  for (const r of d.trackers)
    if (
      !checkText(r.id, 100) ||
      !checkText(r.ticket, 200) ||
      typeof r.onHold !== 'boolean' ||
      !Array.isArray(r.steps) ||
      r.steps.length !== STEPS.length ||
      r.steps.some(b => typeof b !== 'boolean') ||
      !checkText(r.remarks)
    )
      throw Error('Invalid progress tracker.');
  if (new Set(d.trackers.map(r => r.ticket.toLowerCase())).size !== d.trackers.length)
    throw Error('Duplicate ticket progress trackers.');
  for (const r of d.schedule)
    if (
      !validDate(r.date) ||
      !r.date ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ||
      !checkText(r.text)
    )
      throw Error('Invalid schedule entry.');
  if (new Set(d.schedule.map(r => r.date + '|' + r.time)).size !== d.schedule.length)
    throw Error('Duplicate schedule entries.');
  if (
    !d.lists ||
    ![
      'codes',
      'ticketActivities',
      'projectActivities',
      'milestones',
      'workLocations',
      'projectPhases',
    ].every(
      k =>
        Array.isArray(d.lists[k]) &&
        d.lists[k].length <= 500 &&
        d.lists[k].every(v => checkText(v, 500))
    )
  )
    throw Error('Invalid built-in lists.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(d.calendarMonth)) throw Error('Invalid calendar month.');
  validateProjects(d);
  validateFeatures(d);
  return d;
}
/** Read supported backup versions, upgrade older fields, then validate without discarding the original file. */
function parseBackup(raw) {
  const p = JSON.parse(raw);
  if (p.app !== 'mm-ticket-tracker' || ![1, 2, 3, 4, 5, 6, 7, 8, 9].includes(p.version))
    throw Error('Choose a backup from SAP MM WorkHub.');
  return validate(
    alignClosedTickets(validate(upgradeFeatures(p.version === 1 ? upgradeLegacy(p.data) : p.data)))
  );
}
function tell(text, error = false) {
  $('toast').textContent = text;
  $('toast').classList.toggle('error', error);
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), error ? 9000 : 4000);
}

/** Prepare derived context/history first, then save through the selected storage mode. */
function save(next, restoring = false) {
  if (hub) hub.prepare(next, state, restoring);
  if (typeof syncCalculatedProjectHealth === 'function') syncCalculatedProjectHealth(next);
  if (CLOUD_MODE) return saveCloud(next, restoring);
  if (corrupt && !restoring) throw Error('Restore a valid backup before editing.');
  validate(next);
  if (!temporary && !restoring) {
    let raw;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      temporary = true;
    }
    if (!temporary && raw !== lastRaw)
      throw Error(
        'Another copy of this tracker has changed. Back up, then reopen this page before saving.'
      );
  }
  const raw = payload(next);
  try {
    localStorage.setItem(KEY, raw);
    lastRaw = raw;
    temporary = false;
  } catch {
    temporary = true;
  }
  state = next;
  corrupt = false;
  notice();
  render();
  if (temporary) tell('Session only. Download a backup before closing.', true);
  return !temporary;
}
/** The shared edit path: clone current state, change the draft, then prepare, validate and save it.
 * Do not assign directly to state from a feature button: that bypasses autosave and conflict protection. */
function mutate(fn) {
  const next = clone(state);
  fn(next);
  return save(next);
}
function tag(v) {
  const k = String(v).toLowerCase();
  const cls =
    k === 'pending'
      ? 'pending'
      : k === 'closed'
        ? 'closed'
        : k.includes('hold')
          ? 'hold'
          : k === 'high' || k === 'critical'
            ? k
            : k.includes('completed')
              ? 'complete'
              : k.includes('review')
                ? 'review'
                : '';
  return `<span class="tag ${cls}">${esc(v) || '—'}</span>`;
}
function selectOptions(values, current, empty = 'All') {
  const merged = [
    ...new Set([...values, ...(current && !values.includes(current) ? [current] : [])]),
  ];
  return (
    `<option value="">${esc(empty)}</option>` +
    merged
      .map(v => `<option value="${esc(v)}"${v === current ? ' selected' : ''}>${esc(v)}</option>`)
      .join('')
  );
}
function ticketFor(code) {
  return state.tickets.find(t => t.ticket === code);
}
function progressFor(code) {
  return state.trackers.find(t => t.ticket === code);
}

function progressStatus(r) {
  return r.onHold
    ? 'On Hold'
    : pct(r) === 1
      ? 'Completed'
      : pct(r) === 0
        ? 'Not started yet'
        : 'Work In Progress';
}
function daysSince(d) {
  if (!d) return null;
  return Math.floor((Date.parse(today() + 'T00:00:00Z') - Date.parse(d + 'T00:00:00Z')) / 86400000);
}
function checked(t) {
  if (isClosed(t.status) || t.status === 'On Hold') return '—';
  const n = daysSince(t.historyDate);
  return n === null
    ? 'Not recorded'
    : n < 0
      ? dateLabel(t.historyDate)
      : n === 0
        ? 'Today'
        : n + ' days ago';
}
function match(r, q) {
  return (
    !q ||
    Object.values(r)
      .filter(v => typeof v === 'string')
      .join(' ')
      .toLowerCase()
      .includes(q.toLowerCase())
  );
}
function filteredTickets() {
  return state.tickets.filter(
    t =>
      match(t, filterState.query) &&
      (!filterState.status || t.status === filterState.status) &&
      (!filterState.object ||
        t.object === (filterState.object === '__unassigned' ? '' : filterState.object)) &&
      (!filterState.priority || t.priority === filterState.priority)
  );
}
function stats() {
  return `<div class="stats"><div class="stat"><span>Total tickets</span><strong>${state.tickets.length}</strong></div><div class="stat"><span>Pending</span><strong>${state.tickets.filter(t => t.status === 'Pending').length}</strong></div><div class="stat"><span>Closed</span><strong>${state.tickets.filter(t => isClosed(t.status)).length}</strong></div><div class="stat"><span>On Hold</span><strong>${state.tickets.filter(t => t.status === 'On Hold').length}</strong></div></div>`;
}

function renderTasks() {
  const rs = state.tasks.filter(r => match(r, tasksQuery));
  return `<section class="panel"><div class="panel-top"><div><h2>Tasks</h2><p class="muted">${state.tasks.filter(t => !t.done).length} open · ${state.tasks.filter(t => t.done).length} done</p></div><button class="primary" data-action="new" data-group="tasks">Add task</button></div><div class="toolbar"><input id="tasksSearch" type="search" value="${esc(tasksQuery)}" placeholder="Search task, remarks, or feedback" aria-label="Search tasks"></div><div class="scroll"><table><thead><tr><th>No.</th><th>Task</th><th>Done?</th><th>Date done</th><th>Remarks</th><th>Feedback</th><th>Actions</th></tr></thead><tbody>${rs.map(t => `<tr><td>${esc(t.number)}</td><td class="desc">${esc(t.task)}</td><td class="check-cell"><input type="checkbox" data-task="${esc(t.id)}" aria-label="Mark task ${esc(t.number)} done"${t.done ? ' checked' : ''}></td><td class="nowrap">${dateLabel(t.doneDate)}</td><td class="desc">${esc(t.remarks) || '—'}</td><td class="desc">${esc(t.feedback) || '—'}</td><td><button class="small" data-action="edit" data-group="tasks" data-id="${esc(t.id)}">Edit</button></td></tr>`).join('')}</tbody></table>${!rs.length ? '<div class="empty">No matching tasks.</div>' : ''}</div><div class="footerline">Marking a task done records today’s date. The date stays fixed.</div></section>`;
}
function monthDates(m) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) return [];
  const [y, n] = m.split('-').map(Number),
    count = new Date(y, n, 0).getDate();
  return Array.from({ length: count }, (_, i) => m + '-' + String(i + 1).padStart(2, '0'));
}
function slotText(date, time) {
  return scheduleDisplayText(state.schedule.find(s => s.date === date && s.time === time));
}

function renderSpecs() {
  return renderProjectSpecs();
}

/** Use the shared dialog and decorate linked feature controls after its HTML is inserted. */
function openModal(title, body) {
  $('modal').classList.toggle('standup-dialog', body.includes('class="standup-report"'));
  $('modal').classList.toggle(
    'hub-drawer',
    !body.includes('<form') && !/Search|Quick|Review/.test(title)
  );
  $('modalTitle').textContent = title;
  $('modalBody').innerHTML = body;
  hub?.batchA?.decorateModal();
  hub?.library?.decorateModal();
  window.WorkHubTicketWorkspace?.decorateEditor();
  $('modal').classList.toggle(
    'ticket-dialog',
    !!$('modalBody').querySelector('[data-ticket-detail],.ticket-editor')
  );
  if (!$('modal').open) $('modal').showModal();
  updateSelectAllControls();
}

/** A field definition becomes one labelled HTML control. Preserve each name: saveEdit reads it by name. */
function field(k, label, type = 'text', required = false, value = '', group = 'tickets') {
  let input;
  const req = required ? ' required' : '';
  if (type === 'textarea')
    input = `<textarea id="field-${k}" name="${k}" maxlength="32767"${req}>${esc(value)}</textarea>`;
  else if (type === 'checkbox')
    input = `<input type="checkbox" id="field-${k}" name="${k}"${value ? ' checked' : ''}>`;
  else if (type === 'select') {
    const values =
      group === 'specs' && k === 'itemType'
        ? state.lists.projectItemTypes || ['RICEFW ID', 'Blueprint', 'Data Migration']
        : OPTIONS[group === 'specs' ? (k === 'status' ? 'specStatus' : 'specPriority') : k];
    input = `<select id="field-${k}" name="${k}"${req}>${selectOptions(values, value, '—')}</select>`;
  } else
    input = `<input id="field-${k}" name="${k}" type="${type}"${type === 'number' ? ' min="0" step="any"' : type === 'date' ? ' min="1900-01-01" max="9999-12-31"' : type === 'time' ? ' step="1"' : ' maxlength="32767"'} value="${esc(value)}"${req}>`;
  return `<div class="${type === 'textarea' ? 'wide' : ''}"><label for="field-${k}">${label}${required ? ' *' : ''}</label>${input}</div>`;
}

function detail(id) {
  const t = state.tickets.find(t => t.id === id);
  if (!t) return;
  detailTicketId = id;
  const p = progressFor(t.ticket);
  const details = [
    ['JIRA / Charge Code', t.jira],
    ['Created', t.created],
    ['Priority', t.priority],
    ['PIC', t.pic],
    ['Status', t.status],
    ['Object', t.object],
    ['Action', t.action],
    ['Latest Transport', t.transport],
    ['Type', t.type],
    ['Mandays Chargable', t.mandays ?? ''],
    ['History changed', t.historyDate + ' ' + t.historyTime],
    ['Last checked', checked(t)],
  ];
  openModal(
    t.ticket,
    WorkHubTicketWorkspace.details(t, {
      facts: details,
      complete: p?.steps.filter(Boolean).length || 0,
      total: STEPS.length,
      statusTag: tag(t.status),
      priorityTag: tag(t.priority),
      latest: latestHistory(t),
      owner: cloud.user?.id || '',
      milestoneHtml: p
        ? milestonePanel(p)
        : `<button data-action="new-progress" data-ticket="${esc(t.ticket)}">Add progress tracker</button>`,
    })
  );
}
function saveHistory(form) {
  if (form.dataset.saved === 'true') return;
  if (!cloud.ready || !cloud.user || form.dataset.owner !== cloud.user.id)
    throw Error('Finish signing in and reopen the ticket before saving.');
  if (!form.isConnected || !$('modal').open || $('historyForm') !== form)
    throw Error('Reopen the ticket before saving.');
  const id = form.dataset.id,
    text = form.elements.namedItem('newHistory').value.trim();
  if (!text) throw Error('Enter a history update.');
  const ok = mutate(d => {
    const t = d.tickets.find(t => t.id === id);
    if (!t) throw Error('Ticket not found.');
    autoHistory(t, text);
    if (t.history.length > 32767)
      throw Error(
        'Status update history is full. Shorten this update or edit earlier history to make room.'
      );
  });
  if (ok) {
    form.dataset.saved = 'true';
    detail(id);
    tell('Status update saved and timestamped.');
  }
}

function saveProgress(form) {
  return saveLinkedProgress(form);
}
function scheduleEditor(date, time) {
  return openScheduleEditor(date, time);
}
function saveSchedule(form) {
  return saveLinkedSchedule(form);
}

async function copyCharge() {
  const text = $('chargeOutput').textContent;
  try {
    if (!navigator.clipboard?.writeText) throw Error();
    await navigator.clipboard.writeText(text);
    tell('Copied.');
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('chargeOutput'));
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    tell('Text selected. Press Ctrl+C to copy.');
  }
}

document.addEventListener('click', async e => {
  try {
    const b = e.target.closest('[data-action]');
    if (b) {
      await action(b);
      return;
    }
    const slot = e.target.closest('td[data-date]');
    if (slot) scheduleEditor(slot.dataset.date, slot.dataset.time);
  } catch (err) {
    tell(err.message, true);
  }
});
$('tabs').addEventListener('click', e => {
  const b = e.target.closest('button[data-tab]');
  if (b) {
    tab = b.dataset.tab;
    render();
  }
});
$('closeModal').addEventListener('click', closeModal);
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('td[data-date]')) {
    e.preventDefault();
    scheduleEditor(e.target.dataset.date, e.target.dataset.time);
  }
});
document.addEventListener('submit', e => {
  if (
    ![
      'editForm',
      'historyForm',
      'progressForm',
      'scheduleForm',
      'listsForm',
      'projectForm',
      'planForm',
    ].includes(e.target.id)
  )
    return;
  e.preventDefault();
  try {
    const form = e.target;
    switch (form.id) {
      case 'planForm':
        savePlan(form);
        break;
      case 'projectForm':
        saveProject(form);
        break;
      case 'editForm':
        saveEdit(form);
        break;
      case 'historyForm':
        saveHistory(form);
        break;
      case 'progressForm':
        saveProgress(form);
        break;
      case 'scheduleForm':
        saveSchedule(form);
        break;
      case 'listsForm':
        saveLists(form);
        break;
    }
  } catch (err) {
    tell(err.message, true);
  }
});
function rerenderKeepFocus(id) {
  const el = $(id),
    start = el.selectionStart,
    end = el.selectionEnd;
  render();
  const next = $(id);
  next.focus();
  if (start !== null) next.setSelectionRange(start, end);
}
document.addEventListener('input', e => {
  const id = e.target.id,
    v = e.target.value;
  if (id === 'governanceSearch') {
    governanceQuery = v;
    rerenderKeepFocus(id);
  } else if (id === 'ticketSearch') {
    filterState.query = v;
    rerenderKeepFocus(id);
  } else if (id === 'progressSearch') {
    progressQuery = v;
    rerenderKeepFocus(id);
  } else if (id === 'tasksSearch') {
    tasksQuery = v;
    rerenderKeepFocus(id);
  } else if (id === 'specSearch') {
    specQuery = v;
    rerenderKeepFocus(id);
  }
});
document.addEventListener('change', e => {
  try {
    const el = e.target,
      id = el.id;
    if (progressFormChange(el) || enhancementChange(el) || projectChange(el)) return;
    if (id === 'statusFilter') {
      filterState.status = el.value;
      render();
    } else if (id === 'objectFilter') {
      filterState.object = el.value;
      render();
    } else if (id === 'priorityFilter') {
      filterState.priority = el.value;
      render();
    } else if (id === 'specFilter') {
      specFilter = el.value;
      render();
    } else if (id === 'month') {
      if (!el.value || !monthDates(el.value).length) return;
      month = el.value;
      render();
    } else if (el.dataset.progress) {
      changeProgressCheckbox(el.dataset.progress, el.dataset.step, el.checked);
      if (detailTicketId) detail(detailTicketId);
    } else if (el.dataset.task) {
      const ok = mutate(d => {
        const t = d.tasks.find(t => t.id === el.dataset.task);
        if (t.archived) throw Error('Restore the task before changing its completion.');
        t.done = el.checked;
        t.doneDate = el.checked ? today() : '';
      });
      if (ok)
        tell(
          el.checked ? 'Task completed. View it in Completed tasks.' : 'Task moved to Active tasks.'
        );
    } else if (id === 'activityKind') {
      $('chargeActivity').innerHTML = state.lists[el.value]
        .map(v => `<option>${esc(v)}</option>`)
        .join('');
      updateCharge();
    } else if (id === 'chargeCode' || id === 'chargeActivity') updateCharge();
  } catch (err) {
    render();
    tell(err.message, true);
  }
});
function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
$('backupButton').addEventListener('click', () => {
  closeSettingsMenu();
  download(payload(state), 'MM-Tracker-backup-' + today() + '.json', 'application/json');
  tell('Backup download started.');
});
$('restoreButton').addEventListener('click', () => void beginRestore());
$('restoreFile').addEventListener('change', async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    if (f.size > 128 * 1024 * 1024) throw Error('Choose a backup below 128 MB.');
    const next = parseBackup(await f.text());
    if (
      !confirm(
        `Replace all current records with this backup (${next.tickets.length} tickets, ${next.tasks.length} tasks, ${next.specs.length} specs)? Back up current records first if needed.`
      )
    )
      return;
    month = next.calendarMonth;
    filterState = { query: '', status: 'Pending', object: '', priority: '' };
    progressQuery = progressFilter = tasksQuery = specQuery = specFilter = '';
    taskView = 'active';
    taskPriority = '';
    projectView = 'overview';
    projectMonth = today().slice(0, 7);
    selectedCodeProject = next.activeProjectId;
    const ok = save(next, true);
    if (ok) tell('All records restored.');
  } catch (err) {
    tell('Restore failed: ' + err.message, true);
  } finally {
    e.target.value = '';
  }
});
// =============================================================================
// 2. Core editors, Projects and ticket progress
// =============================================================================
let codeScope = 'tickets',
  selectedCodeProject = '',
  scheduleDraft = null;
function validateProjects(d) {
  if (!Array.isArray(d.projects) || !d.projects.length || d.projects.length > 500)
    throw Error('Maintain between 1 and 500 projects.');
  for (const p of d.projects)
    if (
      !p ||
      !checkText(p.id, 100) ||
      !p.id ||
      !checkText(p.name, 80) ||
      !p.name.trim() ||
      !checkText(p.code, 80)
    )
      throw Error('Check the project name and charge code.');
  if (
    new Set(d.projects.map(p => p.id)).size !== d.projects.length ||
    new Set(d.projects.map(p => p.name.trim().toLowerCase())).size !== d.projects.length
  )
    throw Error('Project names and IDs must be unique.');
  const ids = new Set(d.projects.map(p => p.id));
  if (!ids.has(d.activeProjectId)) throw Error('Choose an active project.');
  for (const s of d.specs)
    if (!ids.has(s.projectId)) throw Error('Each project item must belong to a project.');
  for (const s of d.schedule) {
    if (
      !['custom', 'task', 'project', 'annual-leave', 'medical-leave'].includes(s.kind) ||
      !checkText(s.linkId, 100) ||
      !checkText(s.activity, 500)
    )
      throw Error('Invalid schedule selection.');
    if (s.kind === 'project' && !ids.has(s.linkId))
      throw Error('A schedule project no longer exists.');
    if (s.kind === 'task' && !d.tasks.some(t => t.id === s.linkId))
      throw Error('A schedule task no longer exists.');
  }
}
function activeProject(d = state) {
  return d.projects.find(p => p.id === d.activeProjectId);
}
function projectOptions(current) {
  return state.projects
    .map(
      p =>
        `<option value="${esc(p.id)}"${p.id === current ? ' selected' : ''}>${esc(p.name)}${p.id === state.activeProjectId ? ' (active)' : ''}</option>`
    )
    .join('');
}
function filteredProgress() {
  return state.trackers.filter(
    r =>
      match({ ...r, description: ticketFor(r.ticket)?.description || '' }, progressQuery) &&
      (!progressFilter ||
        (progressFilter === '__hide_completed'
          ? progressStatus(r) !== 'Completed'
          : progressStatus(r) === progressFilter))
  );
}
function activeSpecs() {
  return state.specs.filter(r => r.projectId === state.activeProjectId);
}

function projectField(current) {
  return `<div class="wide"><label for="field-projectId">Project *</label><select id="field-projectId" name="projectId" required>${projectOptions(current)}</select></div>`;
}
function oldOpenScheduleEditor(date, time) {
  const old = state.schedule.find(s => s.date === date && s.time === time);
  scheduleDraft = {
    date,
    time,
    text: old?.text || '',
    kind: old?.kind || 'custom',
    linkId: old?.linkId || '',
    activity: old?.activity || '',
  };
  renderScheduleEditor();
}
function renderScheduleEditor() {
  const s = scheduleDraft;
  const taskChoices = state.tasks
    .map(
      t =>
        `<option value="${esc(t.id)}"${t.id === s.linkId ? ' selected' : ''}>${esc((t.number ? t.number + '. ' : '') + t.task.slice(0, 130))}${t.done ? ' (done)' : ''}</option>`
    )
    .join('');
  const projectChoice = s.linkId || state.activeProjectId;
  openModal(
    s.date + ' · ' + s.time,
    `<form id="scheduleForm" data-date="${s.date}" data-time="${s.time}"><div class="form-grid"><div class="wide"><label for="scheduleKind">Schedule type</label><select id="scheduleKind" name="kind"><option value="custom"${s.kind === 'custom' ? ' selected' : ''}>Custom activity</option><option value="task"${s.kind === 'task' ? ' selected' : ''}>Task</option><option value="project"${s.kind === 'project' ? ' selected' : ''}>Project</option></select></div>${s.kind === 'task' ? `<div class="wide"><label for="scheduleLink">Choose a task *</label><select id="scheduleLink" name="linkId" required><option value="">Choose a task</option>${taskChoices}</select></div>` : s.kind === 'project' ? `<div class="span2"><label for="scheduleLink">Choose a project *</label><select id="scheduleLink" name="linkId" required>${projectOptions(projectChoice)}</select></div><div><label for="scheduleActivity">Project activity</label><select id="scheduleActivity" name="activity">${selectOptions(state.lists.projectActivities, s.activity, '—')}</select></div>` : ''}<div class="wide"><label for="slotText">${s.kind === 'custom' ? 'Activity' : 'Additional notes'}</label><textarea id="slotText" name="text" maxlength="32767" placeholder="${s.kind === 'custom' ? 'Leave blank to clear this time slot.' : 'Optional notes for this task or project.'}">${esc(s.text)}</textarea></div></div><div class="modal-actions"><div>${state.schedule.some(r => r.date === s.date && r.time === s.time) ? `<button type="button" class="danger" data-action="clear-slot" data-date="${s.date}" data-time="${s.time}">Clear slot</button>` : ''}</div><div class="actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save activity</button></div></div></form>`
  );
}
function oldChangeScheduleKind(el) {
  const form = el.form;
  const text = form.elements.namedItem('text').value;
  scheduleDraft = {
    ...scheduleDraft,
    text,
    kind: el.value,
    linkId: el.value === 'project' ? state.activeProjectId : '',
    activity: '',
  };
  renderScheduleEditor();
}
function oldSaveLinkedSchedule(form) {
  const date = form.dataset.date,
    time = form.dataset.time,
    text = form.elements.namedItem('text').value,
    kind = form.elements.namedItem('kind')?.value || 'custom',
    linkId = kind === 'custom' ? '' : form.elements.namedItem('linkId')?.value || '',
    activity = kind === 'project' ? form.elements.namedItem('activity')?.value || '' : '';
  if (kind === 'task' && !state.tasks.some(t => t.id === linkId)) throw Error('Choose a task.');
  if (kind === 'project' && !state.projects.some(p => p.id === linkId))
    throw Error('Choose a project.');
  const ok = mutate(d => {
    d.schedule = d.schedule.filter(s => s.date !== date || s.time !== time);
    if (text.trim() || kind !== 'custom')
      d.schedule.push({ date, time, text, kind, linkId, activity });
    d.calendarMonth = month;
  });
  closeModal();
  if (ok) tell('Schedule saved.');
}

function projectChange(el) {
  if (el.id === 'progressFilter') {
    progressFilter = el.value;
    render();
    return true;
  }
  if (el.id === 'codeProject') {
    selectedCodeProject = el.value;
    openChargeCodes('projects');
    return true;
  }
  if (el.id === 'scheduleKind') {
    changeScheduleKind(el);
    return true;
  }
  if (
    (el.id === 'scheduleLink' && el.form?.id === 'scheduleForm') ||
    (el.id === 'planProject' && el.form?.id === 'planForm')
  ) {
    updateScheduleCompanyField(el.form);
    return true;
  }
  return false;
}

function changeScheduleKind(el) {
  return changeRangeKind(el);
}
function saveLinkedSchedule(form) {
  return saveRange(form);
}

/** Ticket history is a dated remarks journal; status changes stay in their own controls/timeline. */
function autoHistory(ticket, remarks = '') {
  const text = remarks.trim();
  if (!text) return;
  const [year, mo, day] = today().split('-'),
    clock = timeNow();
  const line = `${text} [${day}-${mo}-${year} ${clock}]`;
  ticket.history = (ticket.history ? ticket.history.replace(/\s+$/, '') + '\n' : '') + line;
  ticket.historyDate = today();
  ticket.historyTime = clock;
}
function ticketStatusFromProgress(r) {
  return r.onHold
    ? 'On Hold'
    : r.steps.every(Boolean)
      ? 'Closed'
      : r.steps.some(Boolean)
        ? 'Pending'
        : 'not yet started';
}

function updateSelectAllControls() {
  for (const el of [
    ...$('view').querySelectorAll('input[data-step="all"]'),
    ...$('modalBody').querySelectorAll('input[data-step="all"]'),
  ]) {
    const r = state.trackers.find(r => r.id === el.dataset.progress);
    if (r) el.indeterminate = r.steps.some(Boolean) && !r.steps.every(Boolean);
  }
  const form = $('progressForm');
  if (form) updateFormSelectAll(form);
}

// Version 3: additive data migration, task archive, range bookings, and project planning.
let taskView = 'active',
  taskPriority = '',
  taskSort = 'due',
  projectView = 'overview',
  projectMonth = today().slice(0, 7),
  detailTicketId = '';
const PLAN_STATUS = ['Planned', 'In Progress', 'Completed', 'On Hold'];
const isClosed = s => s === 'Closed' || s === 'Completed';

function latestHistory(t) {
  return window.WorkHubReports.historyEntries(t.history).at(-1) || '';
}

function changeTicketStatus(id, status) {
  if (!OPTIONS.status.includes(status)) throw Error('Choose a status.');
  const ok = mutate(d => {
    const t = d.tickets.find(t => t.id === id);
    if (!t) throw Error('Ticket not found.');
    const old = clone(t);
    if (t.status === status) return;
    t.status = status;
    syncProgressFromTicket(d, t, old);
  });
  if (ok) tell('Status and milestones saved.');
}
function taskOverdue(t) {
  return !t.done && !t.archived && !!t.dueDate && t.dueDate < today();
}

function archiveTasks(id = '') {
  const ok = mutate(d => {
    if (id && !d.tasks.some(t => t.id === id && t.done && !t.archived))
      throw Error('Only completed tasks can be archived.');
    for (const t of d.tasks)
      if (t.done && !t.archived && (!id || t.id === id)) {
        t.archived = true;
        t.archivedAt = today();
      }
  });
  if (ok) tell('Completed tasks archived.');
}
function hourTime(n) {
  return String(n).padStart(2, '0') + ':00';
}

function changeRangeKind(el) {
  const f = el.form,
    val = k => f.elements.namedItem(k)?.value,
    leave = window.WorkHubLeave.isLeave(el.value);
  scheduleDraft = {
    ...scheduleDraft,
    travel: window.WorkHubClaims.draft(f, el.value),
    ...window.WorkHubClaims.context(f, el.value),
    date: val('date'),
    endDate: val('endDate'),
    time: leave ? '09:00' : val('time'),
    endTime: leave ? '18:00' : val('endTime'),
    text: val('text'),
    companyId: val('companyId') || '',
    companyName: f.elements.namedItem('companyId')?.selectedOptions[0]?.dataset.companyName || '',
    kind: el.value,
    linkId: el.value === 'project' ? state.activeProjectId : '',
    activity: '',
    location: leave
      ? ''
      : val('location') ||
        (f.elements.namedItem('travelLocationId')?.value &&
        state.lists.workLocations.includes('Client site')
          ? 'Client site'
          : ''),
    title: leave ? window.WorkHubLeave.TYPES[el.value] : '',
    status: 'Planned',
    leave: leave ? { ...window.WorkHubLeave.DEFAULTS } : undefined,
  };
  renderRangeEditor();
}

function removeDraftBooking(d, draft) {
  d.schedule = d.schedule.filter(s =>
    draft.bookingId
      ? s.bookingId !== draft.bookingId
      : !(s.date === draft.originalDate && s.time === draft.originalTime)
  );
  if (draft.planId) d.projectPlans = d.projectPlans.filter(p => p.id !== draft.planId);
}

function clearDraftBooking() {
  if (!scheduleDraft) return;
  const ok = mutate(d => removeDraftBooking(d, scheduleDraft));
  closeModal();
  scheduleDraft = null;
  if (ok) tell('Activity cleared from Schedule and the project calendar.');
}

function rangeDates(start, end = start) {
  if (!start || !end || !validDate(start) || !validDate(end) || end < start)
    throw Error('Choose a valid date range with the end on or after the start.');
  const a = Date.parse(start + 'T00:00:00Z'),
    b = Date.parse(end + 'T00:00:00Z'),
    length = Math.round((b - a) / 86400000) + 1;
  if (length > LIMIT) throw Error('This date range is too large. Use a shorter range.');
  return Array.from({ length }, (_, i) => new Date(a + i * 86400000).toISOString().slice(0, 10));
}

function pendingObjectCounts() {
  const pending = state.tickets.filter(t => t.status === 'Pending'),
    objects = [...new Set([...OPTIONS.object, ...pending.map(t => t.object)])];
  return `<section class="pending-objects" aria-label="Pending tickets by object"><span>Pending by object</span>${objects.map(o => `<button class="small${filterState.status === 'Pending' && filterState.object === o ? ' selected' : ''}" data-action="pending-object" data-object="${esc(o || '__unassigned')}">${esc(o) || 'Unassigned'} <strong>${pending.filter(t => t.object === o).length}</strong></button>`).join('')}</section>`;
}

// Version 5: configurable milestones, linked tasks, secured actions, TOIL, and project governance.

OPTIONS.taskType = ['Project', 'Ticket', 'Custom'];
if (!FIELDS.tasks.some(([k]) => k === 'taskType'))
  FIELDS.tasks.splice(2, 0, ['taskType', 'Task type', 'select', true]);
upgradeFeatures(state);

function closeSettingsMenu() {
  const menu = $('settingsMenu');
  if (menu) menu.open = false;
}
function notice() {
  if (CLOUD_MODE) return cloudNotice();
  const n = $('storageNotice'),
    problem = temporary || corrupt;
  n.hidden = !problem;
  n.classList.toggle('warn', problem);
  n.textContent = corrupt
    ? 'Saved data could not be read. Restore a valid backup to continue.'
    : 'Browser storage is unavailable or full. Changes are kept for this session only; download a backup before closing.';
  $('saveStatus').textContent = corrupt
    ? 'Data needs recovery'
    : temporary
      ? 'Session only'
      : 'Saved on this device';
  $('settingsSaveStatus').textContent = $('saveStatus').textContent;
  $('exportButton').disabled = corrupt;
  $('backupButton').disabled = corrupt;
}

/** Choose the current screen, refresh its markup and then let feature modules decorate it. Rendering is not a save. */
function render() {
  if (CLOUD_MODE && !cloud.ready) {
    $('view').innerHTML = '';
    $('tabs').hidden = true;
    hub?.afterRender(tab);
    return;
  }
  const mainTabs = [
      'home',
      'tickets',
      'tasks',
      'schedule',
      'specs',
      'knowledge',
      'processhub',
      'waiting',
      'studio',
      'lab',
      'validator',
      'snippets',
    ],
    hidden = new Set(state.preferences.hiddenTabs || []),
    visible = mainTabs.filter(t => !hidden.has(t));
  if (!visible.includes(tab)) tab = visible[0] || 'tickets';
  const preserved = tab === 'lab' && hub?.workbench?.workshop?.patchRender();
  if (!preserved) {
    const fn = {
        tickets: renderTickets,
        progress: renderProgress,
        tasks: renderTasksV3,
        schedule: renderSchedule,
        specs: renderProjectDashboard,
      }[tab],
      custom = hub?.render(tab);
    $('view').innerHTML = custom !== undefined ? custom : fn ? fn() : '';
  }
  $('tabs').hidden = false;
  for (const b of $('tabs').querySelectorAll('button')) {
    const key = b.dataset.tab;
    b.hidden = hidden.has(key);
    if (key === 'specs') b.textContent = activeProject()?.name || 'SAP Projects';
    const active = key === tab;
    b.classList.toggle('active', active);
    if (active) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  }
  $('recordSummary').textContent =
    `${state.tickets.length} tickets · ${state.tasks.length} tasks · ${state.specs.length} project items`;
  updateSelectAllControls();
  queueActualReview();
  hub?.afterRender(tab);
}

function taskLinkedLabel(t, d = state) {
  if (t.taskType === 'Project')
    return d.projects.find(p => p.id === t.linkId)?.name || 'Missing project';
  if (t.taskType === 'Ticket') {
    const ticket = d.tickets.find(x => x.id === t.linkId);
    return ticket
      ? [ticket.ticket, ticket.description].filter(Boolean).join(' · ')
      : 'Missing ticket';
  }
  return t.customLink || 'Custom';
}
function filteredTasks() {
  const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return state.tasks
    .filter(
      t =>
        match(
          {
            ...t,
            linkedRecord: taskLinkedLabel(t),
            subTaskText: (t.subTasks || [])
              .map(sub => [sub.title, sub.status, sub.remarks, sub.feedback].join(' '))
              .join(' '),
          },
          tasksQuery
        ) &&
        (!taskPriority || t.priority === taskPriority) &&
        (taskView === 'archive'
          ? t.archived
          : taskView === 'done'
            ? !t.archived && t.done
            : taskView === 'overdue'
              ? taskOverdue(t)
              : !t.archived && !t.done)
    )
    .sort((a, b) =>
      taskSort === 'priority'
        ? (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4) ||
          (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
        : taskSort === 'number'
          ? (+a.number || 0) - (+b.number || 0)
          : Number(a.done) - Number(b.done) ||
            (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
    );
}
function taskLinkFields(r) {
  const type = r.taskType || 'Custom';
  return (
    (hub?.standup?.taskContext(r.id) || '') +
    `<div class="wide task-link-fields" data-task-link="Project"${type === 'Project' ? '' : ' hidden'}><label for="taskProjectLink">Linked project *</label><select id="taskProjectLink" name="projectLink"><option value="">Choose a project</option>${state.projects.map(p => `<option value="${esc(p.id)}"${r.linkId === p.id ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div><div class="wide task-link-fields" data-task-link="Ticket"${type === 'Ticket' ? '' : ' hidden'}><label for="taskTicketLink">Linked ticket *</label><select id="taskTicketLink" name="ticketLink"><option value="">Choose a ticket</option>${state.tickets.map(t => `<option value="${esc(t.id)}"${r.linkId === t.id ? ' selected' : ''}>${esc(t.ticket + ' — ' + t.description.slice(0, 90))}</option>`).join('')}</select></div><div class="wide task-link-fields" data-task-link="Custom"${type === 'Custom' ? '' : ' hidden'}><label for="taskCustomLink">Custom link / reference</label><input id="taskCustomLink" name="customLink" maxlength="500" value="${esc(r.customLink || '')}" placeholder="e.g. Internal follow-up or meeting"></div>`
  );
}
function updateTaskLinkFields(form) {
  const type = form.elements.namedItem('taskType')?.value || 'Custom';
  for (const box of form.querySelectorAll?.('[data-task-link]') || [])
    box.hidden = box.dataset.taskLink !== type;
}

function pct(r) {
  return r.steps.filter(Boolean).length / STEPS.length;
}
function renderProgress() {
  const rs = filteredProgress();
  return `<section class="panel"><div class="panel-top"><div><h2>Ticket progress</h2><p class="muted">${rs.length} of ${state.trackers.length} trackers · ${STEPS.length} milestones per ticket</p></div><button class="primary" data-action="new-progress">Add tracker</button></div><div class="toolbar"><input id="progressSearch" type="search" value="${esc(progressQuery)}" placeholder="Search ticket, description, or remarks" aria-label="Search progress"><select id="progressFilter" aria-label="Filter progress status">${selectOptions(['On Hold', 'Completed', 'Not started yet', 'Work In Progress'], progressFilter, 'All statuses').replace('<option value="__hide_completed" selected>__hide_completed</option>', '')}<option value="__hide_completed"${progressFilter === '__hide_completed' ? ' selected' : ''}>Hide completed</option></select></div><div class="scroll"><table class="steps-table"><thead><tr><th>Ticket</th><th>Select all</th><th>On Hold</th>${STEPS.map(s => `<th>${esc(s)}</th>`).join('')}<th>Progress</th><th>Status</th><th>Remarks</th></tr></thead><tbody>${rs.map(r => `<tr><td><button class="ticket-button" data-action="progress-detail" data-id="${esc(r.id)}">${esc(r.ticket)}</button></td><td class="check-cell"><input type="checkbox" data-progress="${esc(r.id)}" data-step="all"${r.steps.every(Boolean) && !r.onHold ? ' checked' : ''}></td><td class="check-cell"><input type="checkbox" data-progress="${esc(r.id)}" data-step="hold"${r.onHold ? ' checked' : ''}></td>${r.steps.map((done, i) => `<td class="check-cell"><input type="checkbox" data-progress="${esc(r.id)}" data-step="${i}" aria-label="${esc(r.ticket + ' ' + STEPS[i])}"${done ? ' checked' : ''}></td>`).join('')}<td>${Math.round(pct(r) * 100)}%</td><td>${tag(progressStatus(r))}</td><td class="desc">${esc(r.remarks) || '—'}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function milestonePanel(p) {
  return `<section class="ticket-milestones"><div class="flex-title"><h3 class="section-label" style="margin:0">Milestones</h3><span>${tag(progressStatus(p))} · ${p.steps.filter(Boolean).length}/${STEPS.length}</span></div><div class="actions" style="margin:12px 0"><label class="check-label"><input type="checkbox" data-progress="${esc(p.id)}" data-step="all"${p.steps.every(Boolean) && !p.onHold ? ' checked' : ''}>Select all (complete ticket)</label><label class="check-label"><input type="checkbox" data-progress="${esc(p.id)}" data-step="hold"${p.onHold ? ' checked' : ''}>On Hold</label></div><div class="milestones">${STEPS.map((s, i) => `<label><input type="checkbox" data-progress="${esc(p.id)}" data-step="${i}"${p.steps[i] ? ' checked' : ''}>${esc(s)}</label>`).join('')}</div><div class="actions" style="margin-top:12px"><button class="small" data-action="progress-detail" data-id="${esc(p.id)}">Edit progress remarks</button><span class="muted">${esc(p.remarks) || 'Each checkbox saves immediately.'}</span></div></section>`;
}
function progressEditor(id, ticket = '') {
  detailTicketId = '';
  const r = id ? state.trackers.find(t => t.id === id) : null;
  if (id && !r) return;
  const available = state.tickets.filter(t => !progressFor(t.ticket));
  openModal(
    r ? 'Progress · ' + r.ticket : 'Add progress tracker',
    `<form id="progressForm" data-id="${esc(id || '')}">${r ? `<input type="hidden" name="ticket" value="${esc(r.ticket)}">` : `<label for="progressTicket">Ticket *</label><select id="progressTicket" name="ticket" required><option value="">Choose a ticket</option>${available.map(t => `<option value="${esc(t.ticket)}"${t.ticket === ticket ? ' selected' : ''}>${esc(t.ticket + ' — ' + t.description.slice(0, 65))}</option>`).join('')}</select>`}<label class="check-label"><input type="checkbox" name="onHold"${r?.onHold ? ' checked' : ''}>On Hold</label><h3 class="section-label">Milestones</h3><label class="check-label"><input type="checkbox" name="allMilestones"${r?.steps.every(Boolean) && !r?.onHold ? ' checked' : ''}>Select all milestones (complete ticket)</label><div class="milestones" style="margin-top:12px">${STEPS.map((s, i) => `<label><input type="checkbox" name="step${i}"${r?.steps[i] ? ' checked' : ''}>${esc(s)}</label>`).join('')}</div><label for="progressRemarks" style="margin-top:17px">Remarks</label><textarea id="progressRemarks" name="remarks" maxlength="32767">${esc(r?.remarks || '')}</textarea><div class="modal-actions"><div>${r ? `<button type="button" class="danger" data-action="delete-progress" data-id="${esc(id)}">Delete tracker</button>` : ''}</div><div class="actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save progress</button></div></div></form>`
  );
}

function progressChanges(before, after) {
  const changed = [];
  if (!before) changed.push('Progress tracker created');
  for (let i = 0; i < STEPS.length; i++)
    if ((before?.steps[i] || false) !== after.steps[i])
      changed.push(STEPS[i] + ' ' + (after.steps[i] ? 'checked' : 'unchecked'));
  if ((before?.onHold || false) !== after.onHold)
    changed.push('On Hold ' + (after.onHold ? 'checked' : 'unchecked'));
  if (before && before.remarks !== after.remarks) changed.push('Progress remarks updated');
  return changed;
}
function syncTicketFromProgress(d, r, before) {
  const t = d.tickets.find(t => t.ticket === r.ticket);
  if (!t) throw Error('The ticket for this tracker was not found.');
  const changes = progressChanges(before, r),
    next = ticketStatusFromProgress(r),
    old = t.status;
  if (!changes.length && old === next) return false;
  t.status = next;
  if ((before?.remarks || '').trim() !== r.remarks.trim()) autoHistory(t, r.remarks);
  return true;
}
function alignClosedTickets(d) {
  for (const t of d.tickets) {
    if (!isClosed(t.status)) continue;
    let r = d.trackers.find(r => r.ticket === t.ticket);
    if (!r) {
      r = {
        id: uid(),
        ticket: t.ticket,
        onHold: false,
        steps: Array(STEPS.length).fill(true),
        remarks: '',
      };
      d.trackers.push(r);
    } else {
      r.steps = Array(STEPS.length).fill(true);
      r.onHold = false;
    }
  }
  return d;
}
function syncProgressFromTicket(d, t, old) {
  let r = d.trackers.find(r => r.ticket === t.ticket);
  const changed = !old || t.status !== old.status;
  if (!changed && !isClosed(t.status)) return;
  if (!r) {
    if (!isClosed(t.status) && !changed) return;
    r = {
      id: uid(),
      ticket: t.ticket,
      onHold: false,
      steps: Array(STEPS.length).fill(false),
      remarks: '',
    };
    d.trackers.push(r);
  }
  if (isClosed(t.status)) {
    r.steps = Array(STEPS.length).fill(true);
    r.onHold = false;
  } else if (t.status === 'On Hold') r.onHold = true;
  else if (t.status === 'not yet started' || t.status === 'Not started yet') {
    r.steps = Array(STEPS.length).fill(false);
    r.onHold = false;
  } else if (t.status === 'Pending' || t.status === 'Work In Progress') {
    r.onHold = false;
    if (r.steps.every(Boolean)) r.steps[STEPS.length - 1] = false;
    if (t.status === 'Work In Progress' && !r.steps.some(Boolean)) r.steps[0] = true;
  }
}
function changeProgressCheckbox(id, step, checked) {
  const ok = mutate(d => {
    const r = d.trackers.find(r => r.id === id);
    if (!r) throw Error('Progress tracker not found.');
    const before = clone(r);
    if (step === 'all') {
      r.steps = r.steps.map(() => checked);
      if (checked) r.onHold = false;
    } else if (step === 'hold') r.onHold = checked;
    else {
      const i = Number(step);
      if (!Number.isInteger(i) || i < 0 || i >= STEPS.length) throw Error('Invalid milestone.');
      r.steps[i] = checked;
    }
    syncTicketFromProgress(d, r, before);
  });
  if (ok) tell('Progress and ticket status saved.');
}
function saveLinkedProgress(form) {
  const id = form.dataset.id,
    r = {
      id: id || uid(),
      ticket: form.elements.namedItem('ticket').value,
      onHold: form.elements.namedItem('onHold').checked,
      steps: STEPS.map((_, i) => form.elements.namedItem('step' + i).checked),
      remarks: form.elements.namedItem('remarks').value,
    };
  if (!ticketFor(r.ticket)) throw Error('Choose a valid ticket.');
  const ok = mutate(d => {
    const old = id ? d.trackers.find(t => t.id === id) : null;
    if (id && !old) throw Error('Progress tracker not found.');
    if (old) d.trackers = d.trackers.map(t => (t.id === id ? r : t));
    else d.trackers.push(r);
    syncTicketFromProgress(d, r, old);
  });
  closeModal();
  if (ok) tell('Progress and ticket status saved.');
}
function updateFormSelectAll(form) {
  const master = form.elements?.namedItem('allMilestones');
  if (!master) return;
  const values = STEPS.map((_, i) => form.elements.namedItem('step' + i).checked),
    all = values.every(Boolean),
    hold = form.elements.namedItem('onHold').checked;
  master.checked = all && !hold;
  master.indeterminate = values.some(Boolean) && !all;
}
function progressFormChange(el) {
  const form = el.form;
  if (form?.id !== 'progressForm') return false;
  if (el.name === 'allMilestones') {
    for (let i = 0; i < STEPS.length; i++) form.elements.namedItem('step' + i).checked = el.checked;
    if (el.checked) form.elements.namedItem('onHold').checked = false;
    updateFormSelectAll(form);
    return true;
  }
  if (el.name === 'onHold' || /^step\d+$/.test(el.name)) {
    updateFormSelectAll(form);
    return true;
  }
  return false;
}

function listValues(form, key) {
  return [
    ...new Set(
      form.elements
        .namedItem(key)
        .value.split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean)
    ),
  ];
}

function editVisibility() {
  const hidden = new Set(state.preferences.hiddenTabs);
  openModal(
    'Screen visibility',
    `<form id="visibilityForm"><p class="muted">Choose which main screens appear. At least one must remain visible.</p><div class="visibility-list" style="margin-top:16px">${[
      ['tickets', 'Tickets'],
      ['tasks', 'Tasks'],
      ['schedule', 'Schedule'],
      ['specs', 'SAP Projects'],
    ]
      .map(
        ([v, l]) =>
          `<label><input type="checkbox" name="visibleTabs" value="${v}"${hidden.has(v) ? '' : ' checked'}>${l}</label>`
      )
      .join(
        ''
      )}</div><div class="modal-actions"><span></span><div class="actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save visibility</button></div></div></form>`
  );
}
function saveVisibility(form) {
  const visible = [...form.querySelectorAll('input[name="visibleTabs"]:checked')].map(x => x.value);
  if (!visible.length) throw Error('Keep at least one screen visible.');
  const all = ['tickets', 'tasks', 'schedule', 'specs'],
    ok = mutate(d => (d.preferences.hiddenTabs = all.filter(x => !visible.includes(x))));
  closeModal();
  if (ok) tell('Screen visibility saved.');
}

function openChargeCodes(scope = 'tickets') {
  codeScope = scope === 'projects' ? 'projects' : 'tickets';
  if (!state.projects.some(p => p.id === selectedCodeProject))
    selectedCodeProject = state.activeProjectId;
  openModal('Charge codes', renderCodeScreen());
  updateCharge();
}
function renderCodeScreen() {
  const project = state.projects.find(p => p.id === selectedCodeProject) || activeProject(),
    ticketCodes = [...new Set(state.tickets.map(t => t.jira).filter(Boolean))];
  return `<div class="tabs" aria-label="Charge-code type"><button type="button" data-action="code-scope" data-scope="tickets" class="${codeScope === 'tickets' ? 'active' : ''}">Tickets</button><button type="button" data-action="code-scope" data-scope="projects" class="${codeScope === 'projects' ? 'active' : ''}">Projects</button></div><div class="list-grid"><section class="panel box">${codeScope === 'projects' ? `<h2>Project charge code</h2><label for="codeProject" style="margin-top:16px">Project</label><select id="codeProject">${projectOptions(project?.id)}</select><div class="actions" style="margin-top:12px"><button class="primary" type="button" data-action="activate-project" data-id="${esc(project?.id || '')}" data-return="codes"${project?.id === state.activeProjectId ? ' disabled' : ''}>Set active project</button><button type="button" data-action="edit-project" data-id="${esc(project?.id || '')}" data-return="codes">Edit project</button></div><label for="chargeCode" style="margin-top:15px">Charge code</label><input id="chargeCode" readonly value="${esc(project?.code || '')}" placeholder="Set in Project management"><label for="chargeActivity" style="margin-top:15px">Project activity</label><select id="chargeActivity">${state.lists.projectActivities.map(c => `<option>${esc(c)}</option>`).join('')}</select>` : `<h2>Ticket charge code</h2><label for="chargeCode" style="margin-top:16px">Ticket / charge code</label><select id="chargeCode">${ticketCodes.map(c => `<option>${esc(c)}</option>`).join('')}</select><p class="hint">Ticket activities were removed because they were not connected to ticket status or progress.</p>`}<div class="copy-output" id="chargeOutput"></div><div class="actions" style="margin-top:12px"><button type="button" class="primary" id="copyChargeButton" data-action="copy-charge">Copy text</button></div></section><section class="panel box"><div class="flex-title"><h2>${codeScope === 'projects' ? 'Projects' : 'Built-in lists'}</h2>${codeScope === 'projects' ? '<button type="button" data-action="project-management">Manage</button>' : ''}</div>${codeScope === 'projects' ? `<div class="scroll" style="margin-top:12px"><table><thead><tr><th>Project</th><th>Phase</th><th>Active</th></tr></thead><tbody>${state.projects.map(p => `<tr><td>${esc(p.name)}<div class="hint">${esc(p.code)}</div></td><td>${esc(p.phase)}</td><td>${p.id === state.activeProjectId ? 'Yes' : '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p>Milestones, project activities, work locations, and project phases can be maintained without changing ticket or project records.</p>'}<div class="actions" style="margin-top:16px"><button type="button" data-action="edit-lists">Edit built-in lists</button></div></section></div>`;
}
function updateCharge() {
  const code = $('chargeCode')?.value || '',
    activity = codeScope === 'projects' ? $('chargeActivity')?.value || '' : '';
  if ($('chargeOutput'))
    $('chargeOutput').textContent =
      codeScope === 'projects' && !code
        ? 'Set this project’s charge code in Project management.'
        : [code, activity].filter(Boolean).join(' ');
  if ($('copyChargeButton'))
    $('copyChargeButton').disabled = !code || (codeScope === 'projects' && !activity);
}

function hourOptions(current, end = false) {
  const first = end ? 2 : 1,
    last = end ? 24 : 23;
  return Array.from({ length: last - first + 1 }, (_, i) => hourTime(first + i))
    .map(
      t =>
        `<option value="${t}"${t === current ? ' selected' : ''}>${t === '24:00' ? '24:00 (midnight)' : t}</option>`
    )
    .join('');
}
function projectLocationField(location = '') {
  return `<div><label for="projectLocation">Work location *</label><select id="projectLocation" name="location" required>${selectOptions(state.lists.workLocations, location, 'Choose location')}</select></div>`;
}
function isWeekend(date) {
  const day = new Date(date + 'T12:00:00').getDay();
  return day === 0 || day === 6;
}
function isToilSchedule(s, d = state) {
  if (!s || !isWeekend(s.date)) return false;
  if (s.kind === 'project') return true;
  if (s.kind === 'task') {
    const t = d.tasks.find(t => t.id === s.linkId);
    return t && ['Project', 'Ticket'].includes(t.taskType);
  }
  return false;
}

function statusClass(status) {
  return String(status || '')
    .toLowerCase()
    .replace(/\s+/g, '-');
}
function scheduleDisplayText(s, d = state) {
  if (!s) return '';
  if (window.WorkHubLeave.isLeave(s.kind))
    return [
      s.title || window.WorkHubLeave.TYPES[s.kind],
      scheduleCompanyName(s, d),
      s.leave.status,
      s.text,
    ]
      .filter(Boolean)
      .join('\n');
  let linked = '';
  if (s.kind === 'task') {
    const t = d.tasks.find(t => t.id === s.linkId);
    linked = t
      ? `[${t.taskType}] ${t.task}${taskLinkedLabel(t, d) ? ' · ' + taskLinkedLabel(t, d) : ''}`
      : '';
  } else if (s.kind === 'project') {
    const p = d.projectPlans.find(p => p.id === s.planId);
    linked = [
      d.projects.find(p => p.id === s.linkId)?.name || '',
      p?.title || p?.activity || s.activity || 'Project activity',
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return [
    isToilSchedule(s, d) ? 'TOIL' : '',
    linked,
    scheduleCompanyName(s, d),
    s.kind === 'project' ? s.location : '',
    s.text,
  ]
    .filter(Boolean)
    .join('\n');
}
function weekStart(date) {
  const x = new Date(date + 'T12:00:00'),
    day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function toilSummary() {
  const slots = state.schedule.filter(s => s.date.startsWith(month) && isToilSchedule(s)),
    weeks = new Map();
  for (const s of slots) {
    const key = weekStart(s.date);
    weeks.set(key, (weeks.get(key) || 0) + 1);
  }
  const days = new Set(slots.map(s => s.date)).size;
  return `<div class="toil-summary"><span>Weekend TOIL</span><strong>${slots.length} hour${slots.length === 1 ? '' : 's'}</strong><span>${days} day${days === 1 ? '' : 's'}</span>${[
    ...weeks.entries(),
  ]
    .sort()
    .map(([w, h]) => `<span>Week of ${esc(w)}: <strong>${h}h</strong></span>`)
    .join('')}</div>`;
}
function earlyScheduleBookings() {
  const rows = state.schedule
    .filter(s => s.date.startsWith(month) && s.time < '09:00')
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (!rows.length) return '';
  return `<div class="box" style="border-top:1px solid var(--line)"><div class="flex-title"><h3 class="section-label" style="margin:0">Early-hours bookings · 01:00–09:00</h3><span class="muted">Calendar grid unchanged</span></div><div class="actions" style="margin-top:12px">${rows.map(s => `<button class="small" data-action="open-booking" data-date="${esc(s.date)}" data-time="${esc(s.time)}">${esc(s.date + ' ' + s.time + ' · ' + scheduleTimeStatus(s) + ' · ' + scheduleDisplayText(s).split('\n')[0])}</button>`).join('')}</div></div>`;
}

/** Company records belong to Projects; bookings keep a name for historical/deleted companies. */
function scheduleCompanyProject(row, d = state) {
  if (row.kind === 'project' || (!row.kind && row.projectId))
    return row.linkId || row.projectId || d.activeProjectId;
  return '';
}
function scheduleCompanyName(row, d = state) {
  const plan = row.planId ? d.projectPlans.find(p => p.id === row.planId) : null;
  return (
    d.projectCompanies.find(c => c.id === (row.companyId || plan?.companyId))?.name ||
    row.companyName ||
    plan?.companyName ||
    ''
  );
}
function scheduleCompanyOptions(projectId, selected = '', savedName = '') {
  const groups = state.projects
    .filter(p => !projectId || p.id === projectId)
    .map(p => {
      const companies = state.projectCompanies
        .filter(c => c.projectId === p.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      return companies.length
        ? `<optgroup label="${esc(p.name)}">${companies.map(c => `<option value="${esc(c.id)}" data-company-name="${esc(c.name)}"${c.id === selected ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`
        : '';
    })
    .join('');
  const former = selected && savedName && !state.projectCompanies.some(c => c.id === selected);
  return `<option value="">No company / personal time</option>${groups}${former ? `<option value="${esc(selected)}" data-company-name="${esc(savedName)}" selected>${esc(savedName)} (saved company)</option>` : ''}`;
}
function scheduleCompanyField(row) {
  const projectId = scheduleCompanyProject(row);
  return `<div class="wide schedule-company-field"><label for="bookingCompany">Company <span class="muted">(optional)</span></label><select id="bookingCompany" name="companyId" data-project-scope="${esc(projectId)}" aria-describedby="bookingCompanyHint">${scheduleCompanyOptions(projectId, row.companyId, row.companyName)}</select><p class="hint" id="bookingCompanyHint">${projectId ? 'Companies from the selected project.' : 'Companies are grouped by project.'} Maintain them in Projects → Companies &amp; processes. Leave blank for personal time.</p></div>`;
}
function updateScheduleCompanyField(form) {
  const select = form.elements.namedItem('companyId');
  if (!select) return;
  const value = k => form.elements.namedItem(k)?.value || '',
    projectId = scheduleCompanyProject({
      kind: form.id === 'planForm' ? 'project' : value('kind'),
      linkId: form.id === 'planForm' ? value('projectId') : value('linkId'),
    }),
    savedName =
      !projectId || projectId === select.dataset.projectScope
        ? select.selectedOptions[0]?.dataset.companyName || ''
        : '';
  select.innerHTML = scheduleCompanyOptions(projectId, select.value, savedName);
  select.dataset.projectScope = projectId;
  $('bookingCompanyHint').textContent =
    (projectId ? 'Companies from the selected project.' : 'Companies are grouped by project.') +
    ' Maintain them in Projects → Companies & processes. Leave blank for personal time.';
}
function readScheduleCompany(form, previous, row) {
  const id = form.elements.namedItem('companyId')?.value || '';
  if (!id) return { companyId: '', companyName: '' };
  const company = state.projectCompanies.find(c => c.id === id),
    projectId = scheduleCompanyProject(row);
  if (company && (!projectId || company.projectId === projectId))
    return { companyId: company.id, companyName: company.name };
  if (
    !company &&
    previous?.companyId === id &&
    previous.companyName &&
    (!projectId || projectId === scheduleCompanyProject(previous))
  )
    return { companyId: id, companyName: previous.companyName };
  throw Error('Choose a company maintained in Projects for the selected project.');
}
function validateScheduleCompany(row, d) {
  if (
    (row.companyId !== undefined && !checkText(row.companyId, 100)) ||
    (row.companyName !== undefined && !checkText(row.companyName, 200))
  )
    throw Error('Check the schedule company.');
  const company = d.projectCompanies.find(c => c.id === row.companyId),
    projectId = scheduleCompanyProject(row, d);
  if (company && projectId && company.projectId !== projectId)
    throw Error('The schedule company must belong to the selected project.');
}
function scheduleCompanyBadge(row) {
  const name = scheduleCompanyName(row);
  return name
    ? `<span class="booking-company" title="Company: ${esc(name)}"><span class="booking-company-label">Company</span> ${esc(name)}</span>`
    : '';
}
function renderRangeEditor() {
  const s = scheduleDraft,
    tasks = state.tasks.filter(t => !t.archived || t.id === s.linkId);
  openModal(
    'Schedule date and time range',
    `<form id="scheduleForm"><div class="form-grid">${scheduleRangeFields(s)}<div class="wide"><label for="scheduleKind">Schedule type</label><select id="scheduleKind" name="kind">${[
      ['custom', 'Custom activity'],
      ['task', 'Task'],
      ['project', 'Project'],
      ['annual-leave', 'Annual Leave'],
      ['medical-leave', 'Medical Leave'],
    ]
      .map(([v, l]) => `<option value="${v}"${v === s.kind ? ' selected' : ''}>${l}</option>`)
      .join(
        ''
      )}</select></div>${window.WorkHubLeave.fields(s)}${window.WorkHubClaims.fields(s, state)}${s.kind === 'task' ? `<div class="wide"><label for="scheduleLink">Task *</label><select id="scheduleLink" name="linkId" required><option value="">Choose a task</option>${tasks.map(t => `<option value="${esc(t.id)}"${t.id === s.linkId ? ' selected' : ''}>[${esc(t.taskType)}] ${esc((t.number ? t.number + '. ' : '') + t.task.slice(0, 105))} · ${esc(taskLinkedLabel(t))}${t.done ? ' (done)' : ''}</option>`).join('')}</select></div>` : s.kind === 'project' ? `<div class="span2"><label for="scheduleLink">Project *</label><select id="scheduleLink" name="linkId" required>${projectOptions(s.linkId || state.activeProjectId)}</select></div><div><label for="scheduleActivity">Project activity</label><select id="scheduleActivity" name="activity">${selectOptions(state.lists.projectActivities, s.activity, '—')}</select></div>${projectLocationField(s.location)}<div class="span2"><label for="bookingTitle">Activity title</label><input id="bookingTitle" name="title" maxlength="500" value="${esc(s.title)}" placeholder="Defaults to the selected activity"></div><div><label for="bookingStatus">Plan status</label><select id="bookingStatus" name="status">${selectOptions(PLAN_STATUS, s.status, 'Choose status')}</select></div>` : ''}${scheduleCompanyField(s)}<div class="wide"><label for="slotText">${window.WorkHubLeave.isLeave(s.kind) ? 'Leave / handover notes' : s.kind === 'custom' ? 'Activity' : 'Additional notes'}</label><textarea id="slotText" name="text" maxlength="32767">${esc(s.text)}</textarea></div></div><p class="hint">The same time range fills every selected date. Weekend project or ticket-linked task time is marked TOIL automatically. Existing bookings are protected.</p><div class="modal-actions"><div>${s.bookingId || state.schedule.some(r => r.date === s.originalDate && r.time === s.originalTime) ? '<button type="button" class="danger" data-action="clear-booking">Delete activity</button>' : ''}</div><div class="actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save time range</button></div></div></form>`
  );
  hub?.claims?.updateTravel($('scheduleForm'));
}
/** Validate the edited booking range and write its linked Schedule/project records together. */
function saveRange(form) {
  const value = k => form.elements.namedItem(k)?.value || '',
    date = value('date') || form.dataset.date,
    endDate = value('endDate') || date,
    time = value('time') || form.dataset.time,
    endTime = value('endTime') || hourTime(+time.slice(0, 2) + 1),
    kind = value('kind') || 'custom',
    linkId = ['task', 'project'].includes(kind) ? value('linkId') : '',
    text = value('text'),
    activity = kind === 'project' ? value('activity') : '',
    location = window.WorkHubLeave.isLeave(kind) ? '' : value('location'),
    times = rangeTimes(time, endTime),
    dates = rangeDates(date, endDate),
    draft = scheduleDraft || { bookingId: '', planId: '', originalDate: date, originalTime: time },
    bookingId = draft.bookingId || uid(),
    oldPlan = state.projectPlans.find(p => p.id === draft.planId),
    oldBooking = state.schedule.find(s =>
      draft.bookingId
        ? s.bookingId === draft.bookingId
        : s.date === draft.originalDate && s.time === draft.originalTime
    ),
    company = readScheduleCompany(form, oldBooking || oldPlan, { kind, linkId }),
    leaveData = window.WorkHubLeave.read(form, kind),
    travel = window.WorkHubClaims.read(form, kind),
    claimContext = window.WorkHubClaims.context(form, kind, true);
  if (dates.length * times.length > LIMIT)
    throw Error('A booking can contain at most 5,000 time segments.');
  if (kind === 'project' && !state.lists.workLocations.includes(location))
    throw Error('Choose a valid work location.');
  const daySet = new Set(dates),
    timeSet = new Set(times);
  const ok = mutate(d => {
    removeDraftBooking(d, draft);
    if (!text.trim() && kind === 'custom') throw Error('Enter the activity details.');
    if (kind === 'task' && !d.tasks.some(t => t.id === linkId)) throw Error('Choose a task.');
    if (kind === 'project' && !d.projects.some(p => p.id === linkId))
      throw Error('Choose a project.');
    if (bookingOverlaps(d.schedule, dates, time, endTime))
      throw Error('This range overlaps an existing activity. Choose an empty range.');
    let planId = '';
    if (kind === 'project') {
      planId = draft.planId || bookingId;
      d.projectPlans.push({
        id: planId,
        projectId: linkId,
        ...company,
        title: value('title').trim() || activity || 'Project activity',
        activity,
        text,
        date,
        endDate,
        time,
        endTime,
        location,
        status: value('status') || 'Planned',
        source: oldPlan?.source || 'Schedule',
        actualTask: oldPlan?.actualTask || '',
        actualSame: oldPlan?.actualSame ?? null,
        actualReviewedAt: oldPlan?.actualReviewedAt || '',
      });
    }
    for (const day of dates)
      for (const hour of times)
        d.schedule.push({
          date: day,
          time: hour,
          endTime: segmentEnd(hour, endTime),
          text,
          kind,
          linkId,
          ...company,
          activity,
          location,
          bookingId,
          planId,
          travel,
          ...claimContext,
          ...leaveData,
        });
    d.calendarMonth = date.slice(0, 7);
  });
  month = state.calendarMonth;
  render();
  closeModal();
  scheduleDraft = null;
  if (ok)
    tell(
      'Date and time range saved' + (kind === 'project' ? ' and project calendar updated.' : '.')
    );
}

function projectPhasePercent(p) {
  const phases = state.lists.projectPhases,
    i = phases.indexOf(p.phase);
  return i < 0 ? 0 : Math.round((i / Math.max(1, phases.length - 1)) * 100);
}
function daysUntil(date) {
  if (!date) return null;
  return Math.round(
    (Date.parse(date + 'T00:00:00Z') - Date.parse(today() + 'T00:00:00Z')) / 86400000
  );
}
function goLiveInfo(p) {
  if (!p.goLiveDate) return '<span class="muted">Go-Live date not set</span>';
  const days = daysUntil(p.goLiveDate),
    cls = days < 0 ? 'overdue' : days < 15 ? 'red' : days <= 60 ? 'yellow' : 'green',
    label = new Date(p.goLiveDate + 'T12:00:00').toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    count =
      days === 0
        ? 'Today'
        : days > 0
          ? `${days} day${days === 1 ? '' : 's'}`
          : `${Math.abs(days)} day${days === -1 ? '' : 's'} overdue`;
  return `<span class="go-live ${cls}">${esc(label)}<sub>${esc(count)}</sub></span>`;
}
function planHasToil(p) {
  return rangeDates(p.date, p.endDate || p.date).some(isWeekend);
}

function planStatusClass(p, date = '') {
  return isWeekend(date || p.date) ? 'toil' : statusClass(p.status);
}
function planRow(p) {
  return `<button class="plan-row ${planStatusClass(p)}" data-action="view-plan" data-id="${esc(p.id)}"><span class="plan-date">${esc(p.date)}${p.endDate !== p.date ? ' to ' + esc(p.endDate) : ''}<small>${esc(p.time)}–${esc(p.endTime)}</small></span><span class="plan-title">${esc(p.activity || p.title)}${scheduleCompanyBadge(p)}<small>${esc([p.location, p.title !== p.activity ? p.title : '', p.text.slice(0, 100)].filter(Boolean).join(' · '))}${planHasToil(p) ? ' · TOIL' : ''}</small></span><span>${tag(p.status)}</span></button>`;
}

function viewPlan(id) {
  const p = state.projectPlans.find(p => p.id === id);
  if (!p) throw Error('Project activity not found.');
  const project = state.projects.find(x => x.id === p.projectId);
  openModal(
    'Planned activity',
    `<div class="view-details"><div><div class="detail-label">Project</div><div class="detail-value">${esc(project?.name) || '—'}</div></div><div><div class="detail-label">Company</div><div class="detail-value">${esc(scheduleCompanyName(p)) || 'Not specified'}</div></div><div><div class="detail-label">Project activity</div><div class="detail-value">${esc(p.activity) || '—'}</div></div><div><div class="detail-label">Status</div><div class="detail-value">${tag(p.status)}</div></div><div><div class="detail-label">Date range</div><div class="detail-value">${esc(p.date)}${p.endDate !== p.date ? ' to ' + esc(p.endDate) : ''}</div></div><div><div class="detail-label">Time</div><div class="detail-value">${esc(p.time)}–${esc(p.endTime)}</div></div><div><div class="detail-label">Work location</div><div class="detail-value">${esc(p.location) || '—'}</div></div><div class="wide"><div class="detail-label">Activity title</div><div class="detail-value">${esc(p.title)}</div></div><div class="wide"><div class="detail-label">Notes</div><div class="detail-value">${esc(p.text) || '—'}</div></div>${p.actualReviewedAt ? `<div class="wide"><div class="detail-label">Confirmed actual task</div><div class="detail-value">${esc(p.actualTask)} · ${p.actualSame ? 'Same as planned' : 'Different from plan'} · ${esc(p.actualReviewedAt)}</div></div>` : ''}</div><div class="modal-actions"><span>${planHasToil(p) ? '<span class="phase-badge">TOIL</span>' : ''}</span><div class="actions"><button type="button" data-action="cancel">Close</button><button class="primary" type="button" data-action="edit-plan" data-id="${esc(p.id)}">Edit activity</button></div></div>`
  );
}
function editPlan(id = '', date = today()) {
  const p = id ? state.projectPlans.find(p => p.id === id) : null;
  if (id && !p) throw Error('Project activity not found.');
  const r = p || {
    projectId: state.activeProjectId,
    title: '',
    activity: '',
    text: '',
    date,
    endDate: date,
    time: '09:00',
    endTime: '10:00',
    location: state.lists.workLocations[0],
    status: 'Planned',
  };
  openModal(
    p ? 'Edit planned activity' : 'Plan project activity',
    `<form id="planForm" data-id="${esc(id)}"><div class="form-grid"><div class="wide"><label for="planProject">Project *</label><select id="planProject" name="projectId">${projectOptions(r.projectId)}</select></div>${scheduleCompanyField(r)}<div class="span2"><label for="planTitle">Activity title *</label><input id="planTitle" name="title" value="${esc(r.title)}" maxlength="500" required></div><div><label for="planActivity">Project activity</label><select id="planActivity" name="activity">${selectOptions(state.lists.projectActivities, r.activity, '—')}</select></div>${scheduleRangeFields(r)}${projectLocationField(r.location)}<div><label for="planStatus">Status</label><select id="planStatus" name="status">${selectOptions(PLAN_STATUS, r.status, 'Choose status')}</select></div><div class="wide"><label for="planNotes">Notes</label><textarea id="planNotes" name="text" maxlength="32767">${esc(r.text)}</textarea></div></div><p class="hint">Times use the 24-hour system. Saving also updates Schedule.</p><div class="modal-actions"><div>${p ? `<button class="danger" type="button" data-action="delete-plan" data-id="${esc(p.id)}">Delete activity</button>` : ''}</div><div class="actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save activity</button></div></div></form>`
  );
}
function savePlan(form) {
  const value = k => form.elements.namedItem(k)?.value || '',
    id = form.dataset.id || uid(),
    old = state.projectPlans.find(p => p.id === id),
    p = {
      id,
      projectId: value('projectId'),
      ...readScheduleCompany(form, old, { kind: 'project', linkId: value('projectId') }),
      title: value('title').trim(),
      activity: value('activity'),
      text: value('text'),
      date: value('date'),
      endDate: value('endDate') || value('date'),
      time: value('time'),
      endTime: value('endTime'),
      location: value('location'),
      status: value('status'),
      source: old?.source || 'Projects',
      actualTask: old?.actualTask || '',
      actualSame: old?.actualSame ?? null,
      actualReviewedAt: old?.actualReviewedAt || '',
    },
    times = rangeTimes(p.time, p.endTime),
    dates = rangeDates(p.date, p.endDate);
  if (dates.length * times.length > LIMIT)
    throw Error('A booking can contain at most 5,000 time segments.');
  if (!state.lists.workLocations.includes(p.location)) throw Error('Choose a valid work location.');
  const daySet = new Set(dates),
    timeSet = new Set(times),
    ok = mutate(d => {
      d.schedule = d.schedule.filter(s => s.planId !== id);
      if (bookingOverlaps(d.schedule, dates, p.time, p.endTime))
        throw Error('This range overlaps an existing activity. Choose an empty range.');
      if (old) d.projectPlans = d.projectPlans.map(x => (x.id === id ? p : x));
      else d.projectPlans.push(p);
      for (const day of dates)
        for (const hour of times)
          d.schedule.push({
            date: day,
            time: hour,
            endTime: segmentEnd(hour, p.endTime),
            text: p.text,
            kind: 'project',
            linkId: p.projectId,
            companyId: p.companyId,
            companyName: p.companyName,
            activity: p.activity,
            location: p.location,
            bookingId: id,
            planId: id,
          });
      d.calendarMonth = p.date.slice(0, 7);
    });
  month = state.calendarMonth;
  projectMonth = p.date.slice(0, 7);
  render();
  closeModal();
  if (ok) tell('Project activity and Schedule updated.');
}

function editDecision(id = '') {
  const r = id ? state.projectDecisions.find(x => x.id === id) : null;
  if (id && !r) throw Error('Decision not found.');
  const value = r || {
      companyId: '',
      category: 'Organization structure',
      decision: '',
      owner: '',
      date: today(),
      status: 'Proposed',
    },
    companies = state.projectCompanies.filter(c => c.projectId === state.activeProjectId);
  openModal(
    r ? 'Edit implementation decision' : 'Add implementation decision',
    `<form id="decisionForm" data-id="${esc(id)}"><div class="form-grid"><div><label for="decisionCompany">Company</label><select id="decisionCompany" name="companyId"><option value="">Project-wide</option>${companies.map(c => `<option value="${esc(c.id)}"${c.id === value.companyId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div><div><label for="decisionCategory">SAP MM area *</label><select id="decisionCategory" name="category">${[
      ...new Set([
        ...mmAreaNames(),
        value.category,
        'Valuation & account determination',
        'Invoice verification',
        'Integration',
        'Data migration',
        'Cutover',
        'Other',
      ]),
    ]
      .filter(Boolean)
      .map(v => `<option${v === value.category ? ' selected' : ''}>${v}</option>`)
      .join(
        ''
      )}</select></div><div><label for="decisionStatus">Status *</label><select id="decisionStatus" name="status">${['Proposed', 'Approved', 'Superseded'].map(v => `<option${v === value.status ? ' selected' : ''}>${v}</option>`).join('')}</select></div><div><label for="decisionDate">Decision date</label><input id="decisionDate" name="date" type="date" min="1900-01-01" max="9999-12-31" value="${esc(value.date)}"></div><div class="span2"><label for="decisionOwner">Owner</label><input id="decisionOwner" name="owner" maxlength="200" value="${esc(value.owner)}"></div><div class="wide"><label for="decisionText">Decision *</label><textarea id="decisionText" name="decision" maxlength="32767" required>${esc(value.decision)}</textarea></div></div><div class="modal-actions"><span></span><div class="actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save decision</button></div></div></form>`
  );
}
function saveDecision(form) {
  const id = form.dataset.id || uid(),
    old = state.projectDecisions.find(x => x.id === id),
    value = k => form.elements.namedItem(k).value,
    r = {
      id,
      projectId: state.activeProjectId,
      companyId: value('companyId'),
      category: value('category'),
      decision: value('decision').trim(),
      owner: value('owner').trim(),
      date: value('date'),
      status: value('status'),
    };
  const ok = mutate(d => {
    if (old) d.projectDecisions = d.projectDecisions.map(x => (x.id === id ? r : x));
    else d.projectDecisions.push(r);
  });
  projectView = 'companies';
  render();
  closeModal();
  if (ok) tell('Implementation decision saved.');
}

let actualReviewTimer = 0;
function queueActualReview(delay = 350) {
  clearTimeout(actualReviewTimer);
  if (CLOUD_MODE && !cloud.ready) return;
  actualReviewTimer = setTimeout(() => reviewPastPlans(), delay);
}
function planNeedsActualReview(p, date = today(), time = timeNow().slice(0, 5)) {
  const endDate = p.endDate || p.date;
  return endDate < date || (endDate === date && p.endTime !== '24:00' && p.endTime <= time);
}
function reviewPastPlans() {
  refreshScheduleStatuses();
  if ($('modal').open) {
    if (typeof window !== 'undefined') queueActualReview(30000);
    return;
  }
  const p = state.projectPlans
    .filter(
      p =>
        planNeedsActualReview(p) &&
        !p.actualReviewedAt &&
        !['Completed', 'On Hold'].includes(p.status)
    )
    .sort((a, b) =>
      ((a.endDate || a.date) + a.endTime).localeCompare((b.endDate || b.date) + b.endTime)
    )[0];
  if (!p) {
    if (typeof window !== 'undefined') queueActualReview(30000);
    return;
  }
  const project = state.projects.find(x => x.id === p.projectId);
  openModal(
    'Confirm planned versus actual work',
    `<p><strong>${esc(project?.name || 'Project')} · ${esc(p.activity || p.title)}</strong></p><p class="muted">Planned for ${esc(p.date)}${p.endDate !== p.date ? ' to ' + esc(p.endDate) : ''}, ${esc(p.time)}–${esc(p.endTime)}. Was the actual task the same as planned?</p><div class="view-details" style="margin-top:16px"><div class="wide"><div class="detail-label">Planned title</div><div class="detail-value">${esc(p.title)}</div></div><div class="wide"><div class="detail-label">Notes</div><div class="detail-value">${esc(p.text) || '—'}</div></div></div><div class="modal-actions"><button type="button" data-action="actual-later">Review later</button><div class="actions"><button type="button" data-action="actual-different" data-id="${esc(p.id)}">Different actual task</button><button class="primary" type="button" data-action="actual-same" data-id="${esc(p.id)}">Same as planned</button></div></div>`
  );
}
function actualDifferent(id) {
  const p = state.projectPlans.find(p => p.id === id);
  if (!p) throw Error('Project activity not found.');
  openModal(
    'Specify actual task',
    `<form id="actualDifferentForm" data-id="${esc(id)}"><label for="actualTask">Actual task completed *</label><textarea id="actualTask" name="actualTask" maxlength="32767" required placeholder="Describe the work actually completed."></textarea><div class="modal-actions"><button type="button" data-action="actual-later">Review later</button><button class="primary" type="submit">Save actual task & complete</button></div></form>`
  );
}
function completeActual(id, actualTask, same) {
  const ok = mutate(d => {
    const p = d.projectPlans.find(p => p.id === id);
    if (!p) throw Error('Project activity not found.');
    p.status = 'Completed';
    p.actualTask = actualTask.trim();
    p.actualSame = same;
    p.actualReviewedAt = new Date().toISOString();
  });
  closeModal();
  if (ok) tell('Actual work confirmed and plan marked Completed.');
  queueActualReview();
}
function saveActualDifferent(form) {
  const p = state.projectPlans.find(p => p.id === form.dataset.id);
  if (!p) throw Error('Project activity not found.');
  const text = form.elements.namedItem('actualTask').value.trim();
  if (!text) throw Error('Specify the actual task.');
  completeActual(p.id, text, false);
}

async function beginRestore() {
  closeSettingsMenu();
  if (CLOUD_MODE) {
    const ok = await verifyCloudCredentials('Restore backup', true);
    if (!ok) return;
  }
  $('restoreFile').click();
}
async function authorizeActivityDeletion(label) {
  if (!confirm(label)) return false;
  if (CLOUD_MODE) return verifyCloudCredentials('Delete activity', false);
  return true;
}

async function projectAction(b) {
  const a = b.dataset.action;
  if (a === 'charge-codes') {
    closeSettingsMenu();
    selectedCodeProject = state.activeProjectId;
    openChargeCodes(b.dataset.scope);
    return true;
  }
  if (a === 'code-scope') {
    openChargeCodes(b.dataset.scope);
    return true;
  }
  if (a === 'new-project') {
    editProject(null, b.dataset.return);
    return true;
  }
  if (a === 'edit-project') {
    editProject(b.dataset.id, b.dataset.return);
    return true;
  }
  if (a === 'activate-project') {
    activateProject(b.dataset.id, b.dataset.return);
    return true;
  }
  if (a === 'clear-slot') {
    openRangeEditor(b.dataset.date, b.dataset.time);
    if (await authorizeActivityDeletion('Delete this scheduled activity?')) clearDraftBooking();
    return true;
  }
  return false;
}
function activateProject(id, returnTo = 'codes') {
  if (!state.projects.some(p => p.id === id)) throw Error('Choose a valid project.');
  specQuery = specFilter = '';
  const ok = mutate(d => (d.activeProjectId = id));
  selectedCodeProject = id;
  if (returnTo === 'manager') openProjectManagement();
  else openChargeCodes('projects');
  if (ok) tell('Active project changed.');
}

function closeModal() {
  detailTicketId = '';
  if (CLOUD_MODE && typeof cancelSensitiveAuth === 'function') cancelSensitiveAuth();
  $('modal').close();
  if (CLOUD_MODE && cloud.refreshDeferred) void retryCloud();
}
/** Route data-action buttons to their editor/status handlers. A button label can change while its action stays the same. */
async function action(b) {
  const a = b.dataset.action,
    id = b.dataset.id,
    g = b.dataset.group;
  if (CLOUD_MODE && (await cloudAction(b))) return;
  if ((await enhancementAction(b)) || (await projectAction(b))) return;
  switch (a) {
    case 'new':
      editRecord(g);
      break;
    case 'edit':
      editRecord(g, id);
      break;
    case 'detail':
      detail(id);
      break;
    case 'cancel':
      closeModal();
      break;
    case 'progress-detail':
      progressEditor(id);
      break;
    case 'new-progress':
      progressEditor(null, b.dataset.ticket || '');
      break;
    case 'edit-lists':
      closeSettingsMenu();
      editLists();
      break;
    case 'copy-charge':
      await copyCharge();
      break;
    case 'check-ticket': {
      const ok = mutate(d => {
        const t = d.tickets.find(r => r.id === id);
        t.historyDate = today();
        t.historyTime = timeNow();
      });
      detail(id);
      if (ok) tell('Check date saved.');
      break;
    }
    case 'delete':
      if (
        confirm(`Delete this ${g === 'tickets' ? 'ticket and its progress tracker' : 'record'}?`)
      ) {
        const ok = mutate(d => {
          const old = d[g].find(t => t.id === id);
          if (!old) throw Error('Record not found.');
          if (g === 'tasks')
            d.schedule.forEach(s => {
              if (s.kind === 'task' && s.linkId === id) {
                s.text = scheduleDisplayText(s, d);
                s.kind = 'custom';
                s.linkId = '';
                s.activity = '';
              }
            });
          if (g === 'tickets')
            for (const t of d.tasks)
              if (t.taskType === 'Ticket' && t.linkId === id) {
                t.taskType = 'Custom';
                t.customLink = 'Former ticket: ' + old.ticket;
                t.linkId = '';
              }
          d[g] = d[g].filter(t => t.id !== id);
          if (g === 'tickets') d.trackers = d.trackers.filter(t => t.ticket !== old.ticket);
        });
        closeModal();
        if (ok) tell('Deleted.');
      }
      break;
    case 'delete-progress':
      if (confirm('Delete this progress tracker? The ticket itself will remain.')) {
        const ok = mutate(d => (d.trackers = d.trackers.filter(t => t.id !== id)));
        closeModal();
        if (ok) tell('Tracker deleted.');
      }
      break;
  }
}

document.addEventListener('submit', e => {
  const id = e.target.id;
  if (
    !['visibilityForm', 'companyForm', 'decisionForm', 'gateForm', 'actualDifferentForm'].includes(
      id
    )
  )
    return;
  e.preventDefault();
  try {
    if (id === 'visibilityForm') saveVisibility(e.target);
    else if (id === 'companyForm') saveCompany(e.target);
    else if (id === 'decisionForm') saveDecision(e.target);
    else if (id === 'gateForm') saveGate(e.target);
    else saveActualDifferent(e.target);
  } catch (err) {
    tell(err.message, true);
  }
});

// Version 6: phase-specific gates and upload-first company/process governance.
// =============================================================================
// 3. Company/process governance and spreadsheet import
// =============================================================================
const GOVERNANCE_AREAS = [
  'Organization Structure',
  'Master Data',
  'Inventory Management',
  'Procurement',
];
function defaultMMAreas() {
  return ['Organization Structure', 'Master Data', 'Inventory Management', 'Procurement'].map(
    (name, index) => ({ id: 'mm-area-' + index, name, visible: true, aliases: [name] })
  );
}
function mmAreaKey(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}
function projectMMAreas(projectId = state.activeProjectId, d = state) {
  return d.projects.find(p => p.id === projectId)?.mmAreas || defaultMMAreas();
}
function mmAreaNames(projectId = state.activeProjectId, d = state) {
  return projectMMAreas(projectId, d).map(area => area.name);
}
function visibleMMAreas(projectId = state.activeProjectId, d = state) {
  return projectMMAreas(projectId, d).filter(area => area.visible);
}
function upgradeMMAreas(d) {
  for (const project of d.projects || []) {
    if (project.mmAreas === undefined) project.mmAreas = defaultMMAreas();
    if (!Array.isArray(project.mmAreas)) continue;
    for (const mapping of d.projectProcessMappings || []) {
      if (
        mapping.projectId !== project.id ||
        typeof mapping.area !== 'string' ||
        !mapping.area.trim()
      )
        continue;
      const existing = project.mmAreas.find(
        area =>
          mmAreaKey(area.name) === mmAreaKey(mapping.area) ||
          area.aliases?.some(name => mmAreaKey(name) === mmAreaKey(mapping.area))
      );
      if (existing) {
        mapping.area = existing.name;
        continue;
      }
      project.mmAreas.push({
        id: 'recovered-mm-area-' + project.mmAreas.length,
        name: mapping.area,
        visible: true,
        aliases: [mapping.area],
      });
    }
  }
}
function validateMMAreas(d) {
  for (const project of d.projects) {
    const areas = project.mmAreas;
    if (!Array.isArray(areas) || !areas.length || areas.length > 100)
      throw Error('Keep between 1 and 100 SAP MM areas per project.');
    const ids = new Set(),
      names = new Map();
    for (const area of areas) {
      if (
        !area ||
        !checkText(area.id, 100) ||
        !area.id ||
        ids.has(area.id) ||
        !checkText(area.name, 100) ||
        !area.name.trim() ||
        typeof area.visible !== 'boolean' ||
        !Array.isArray(area.aliases) ||
        area.aliases.length > 50 ||
        area.aliases.some(name => !checkText(name, 100) || !name.trim())
      )
        throw Error('Check the SAP MM area names and visibility.');
      ids.add(area.id);
      for (const name of [area.name, ...area.aliases]) {
        const key = mmAreaKey(name);
        if (names.has(key) && names.get(key) !== area.id)
          throw Error(
            'SAP MM area names, including previous names, must be unique within a project.'
          );
        names.set(key, area.id);
      }
    }
  }
}
function mmAreaEditorRow(area, projectId) {
  const used = state.projectProcessMappings.filter(
    m => m.projectId === projectId && m.area === area.name
  ).length;
  return `<div class="mm-area-row" data-area-id="${esc(area.id)}"><div><label class="sr-only" for="mm-name-${esc(area.id)}">Area name</label><input id="mm-name-${esc(area.id)}" data-area-name maxlength="100" value="${esc(area.name)}" required placeholder="SAP MM area name"><small class="hint">${used} mapped item${used === 1 ? '' : 's'}</small></div><label class="check-label"><input type="checkbox" data-area-visible${area.visible ? ' checked' : ''}>Show</label><div class="actions"><button type="button" class="small" data-action="mm-area-up" aria-label="Move area up">↑</button><button type="button" class="small" data-action="mm-area-down" aria-label="Move area down">↓</button><button type="button" class="small danger" data-action="mm-area-remove"${used ? ' disabled title="Hide this area to keep its mapped records"' : ''}>Remove</button></div></div>`;
}
function openMMAreaManager() {
  closeSettingsMenu();
  const project = activeProject();
  openModal(
    'Manage SAP MM areas',
    `<form id="mmAreasForm" data-project="${esc(project.id)}"><p>Areas for <strong>${esc(project.name)}</strong>, shared by all companies in this project.</p><p class="muted">Add or rename areas, change their order, and choose which ones to show. Hiding an area keeps its processes and reports. Areas with mapped records cannot be removed.</p><div id="mmAreaRows" class="mm-area-list">${projectMMAreas()
      .map(area => mmAreaEditorRow(area, project.id))
      .join(
        ''
      )}</div><button type="button" data-action="mm-area-add" style="margin-top:14px">+ Add area</button><p class="hint">Renaming an area also updates its process mappings. Previous names still work in Excel imports.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save areas</button></div></form>`
  );
}
function editMMAreaDraft(button) {
  const form = $('mmAreasForm'),
    rows = $('mmAreaRows');
  if (!form || !rows) return;
  if (button.dataset.action === 'mm-area-add') {
    if (rows.children.length >= 100) throw Error('A project supports up to 100 SAP MM areas.');
    rows.insertAdjacentHTML(
      'beforeend',
      mmAreaEditorRow({ id: uid(), name: '', visible: true }, form.dataset.project)
    );
    rows.lastElementChild.querySelector('input').focus();
    return;
  }
  const row = button.closest('[data-area-id]');
  if (!row) return;
  if (button.dataset.action === 'mm-area-remove') {
    const area = projectMMAreas(form.dataset.project).find(area => area.id === row.dataset.areaId);
    if (
      area &&
      state.projectProcessMappings.some(
        m => m.projectId === form.dataset.project && m.area === area.name
      )
    )
      throw Error('Hide this area to keep its mapped records.');
    if (rows.children.length === 1)
      throw Error('Keep at least one area. You can hide every area if needed.');
    row.remove();
    return;
  }
  if (button.dataset.action === 'mm-area-up' && row.previousElementSibling)
    rows.insertBefore(row, row.previousElementSibling);
  if (button.dataset.action === 'mm-area-down' && row.nextElementSibling)
    rows.insertBefore(row.nextElementSibling, row);
  button.focus();
}
function saveMMAreas(form) {
  const projectId = form.dataset.project,
    oldAreas = projectMMAreas(projectId),
    areas = [...form.querySelectorAll('[data-area-id]')].map(row => {
      const old = oldAreas.find(area => area.id === row.dataset.areaId),
        name = row.querySelector('[data-area-name]').value.trim();
      return {
        id: row.dataset.areaId,
        name,
        visible: row.querySelector('[data-area-visible]').checked,
        aliases: [...new Set([...(old?.aliases || []), ...(old ? [old.name] : []), name])].slice(
          -50
        ),
      };
    });
  const renames = new Map();
  for (const old of oldAreas) {
    const area = areas.find(area => area.id === old.id);
    if (
      !area &&
      state.projectProcessMappings.some(m => m.projectId === projectId && m.area === old.name)
    )
      throw Error('Hide an area with mapped records instead of removing it.');
    if (area) renames.set(old.name, area.name);
  }
  const currentArea = governanceArea,
    ok = mutate(d => {
      const project = d.projects.find(p => p.id === projectId);
      if (!project) throw Error('Project not found.');
      project.mmAreas = areas;
      validateMMAreas(d);
      for (const mapping of d.projectProcessMappings)
        if (mapping.projectId === projectId && renames.has(mapping.area))
          mapping.area = renames.get(mapping.area);
      for (const decision of d.projectDecisions)
        if (decision.projectId === projectId) {
          const old = oldAreas.find(area => mmAreaKey(area.name) === mmAreaKey(decision.category));
          if (old && renames.has(old.name)) decision.category = renames.get(old.name);
        }
    });
  if (ok) {
    governanceArea = renames.get(currentArea) || currentArea;
    governanceQuery = '';
    closeModal();
    render();
    tell('SAP MM areas saved.');
  }
}
const MAPPING_DECISIONS = ['Pending review', 'Approved', 'Not approved', 'Revision required'];
const GATE_STATUSES = ['Pending', 'Blocked', 'Completed', 'Skipped'];
const DEFAULT_DEPARTMENTS = [
  'Unassigned',
  'Purchasing / Procurement',
  'Warehouse',
  'Inventory Management',
  'Master Data',
  'Production',
  'Planning',
  'Quality Management',
  'Finance / Accounts Payable',
  'Logistics',
  'IT / SAP Support',
  'Business Process Owner',
  'Project Management',
  'Management / Approver',
];
const DEFAULT_ORG_OBJECTS = [
  'Company',
  'Company Code',
  'Plant',
  'Storage Location',
  'Purchasing Organization',
  'Purchasing Group',
  'Valuation Area',
  'Warehouse Number',
  'Controlling Area',
  'Business Area',
];
const DEFAULT_MASTER_OBJECTS = [
  'Material Type',
  'Material Group',
  'Material Master',
  'Vendor / Business Partner',
  'Purchasing Info Record',
  'Source List',
  'Quota Arrangement',
  'Batch',
  'Classification',
  'Purchase Requisition Document Type',
  'Purchase Order Document Type',
];
const DEFAULT_PROJECT_ITEM_TYPES = ['RICEFW ID', 'Blueprint', 'Data Migration'];

function defaultGateCriteria(phase) {
  const key = String(phase || '').toLowerCase();
  if (key.includes('workshop'))
    return [
      'Project scope and objectives confirmed',
      'Process owners and key users identified',
      'Workshop schedule completed',
      'Current-state processes documented',
      'Open workshop actions assigned',
    ];
  if (key.includes('clarification'))
    return [
      'Open requirements clarified',
      'Organization structure agreed',
      'Master data requirements agreed',
      'Procurement process design agreed',
      'Inventory Management process design agreed',
      'Integration dependencies identified',
      'Gaps and developments documented',
    ];
  if (key.includes('blueprint'))
    return [
      'Blueprint document reviewed',
      'Business process owners approved the design',
      'Organizational assignments confirmed',
      'Roles and responsibilities confirmed',
      'Reports, forms, interfaces, conversions and enhancements agreed',
      'Critical open items resolved or accepted',
      'Blueprint sign-off received',
    ];
  if (key.includes('build') || key.includes('config'))
    return [
      'Configuration completed in Development',
      'Functional specifications approved',
      'Required developments completed',
      'Unit testing completed',
      'Critical defects resolved',
      'Transport list prepared',
    ];
  if (key === 'sit' || key.includes('system integration'))
    return [
      'SIT scripts and test data prepared',
      'End-to-end integration testing completed',
      'Critical SIT defects resolved',
      'Interfaces and outputs validated',
      'SIT results approved',
    ];
  if (key === 'uat' || key.includes('user acceptance'))
    return [
      'UAT scripts and users confirmed',
      'UAT data and access ready',
      'UAT execution completed',
      'Critical UAT defects resolved',
      'Business UAT sign-off received',
    ];
  if (key.includes('cutover'))
    return [
      'Cutover plan approved',
      'Master data load completed and reconciled',
      'Open transaction strategy confirmed',
      'Production roles and access validated',
      'Transport sequence confirmed',
      'Go / No-Go meeting completed',
    ];
  if (key.includes('go-live') || key.includes('go live'))
    return [
      'Production readiness confirmed',
      'Business and support teams ready',
      'Go-Live approval received',
      'Initial production transactions validated',
      'Hypercare support activated',
    ];
  if (key.includes('hypercare'))
    return [
      'Priority incidents resolved',
      'Daily reconciliation completed',
      'User support handover completed',
      'Outstanding issues assigned',
      'Hypercare exit approved',
    ];
  if (key.includes('complete') || key.includes('close'))
    return [
      'Final project acceptance received',
      'Documentation handed over',
      'Lessons learned recorded',
      'Project closure approved',
    ];
  return [
    'Required deliverables completed',
    'Business owner approval received',
    'Critical issues resolved',
    'Handover to the next phase confirmed',
  ];
}

function upgradeFeaturesV6(d) {
  if (!d || typeof d !== 'object') return d;
  const mappingDecisions = ['Pending review', 'Approved', 'Not approved', 'Revision required'],
    gateStatuses = ['Pending', 'Blocked', 'Completed', 'Skipped'];
  const defaultDepartments = [
    'Unassigned',
    'Purchasing / Procurement',
    'Warehouse',
    'Inventory Management',
    'Master Data',
    'Production',
    'Planning',
    'Quality Management',
    'Finance / Accounts Payable',
    'Logistics',
    'IT / SAP Support',
    'Business Process Owner',
    'Project Management',
    'Management / Approver',
  ];
  const defaultOrgObjects = [
    'Company',
    'Company Code',
    'Plant',
    'Storage Location',
    'Purchasing Organization',
    'Purchasing Group',
    'Valuation Area',
    'Warehouse Number',
    'Controlling Area',
    'Business Area',
  ];
  const defaultMasterObjects = [
    'Material Type',
    'Material Group',
    'Material Master',
    'Vendor / Business Partner',
    'Purchasing Info Record',
    'Source List',
    'Quota Arrangement',
    'Batch',
    'Classification',
    'Purchase Requisition Document Type',
    'Purchase Order Document Type',
  ];
  const defaultProjectItemTypes = ['RICEFW ID', 'Blueprint', 'Data Migration'];
  const defaultMilestones = [
    'Analysing/Designing',
    'Functional Spec',
    'Sr Review',
    'ABAP Estimation',
    'ADL Approval Dev',
    'ABAP Dev',
    'ABAP Fixing',
    'Unit Testing',
    'UAT',
    'External Approval',
    'BASIS',
    'FMP',
  ];
  const defaultActivities = [
    'Requirement Gathering',
    'Blueprint Preparation',
    'Blueprint Clarification',
    'Blueprint Confirmation',
    'Functional Spec',
    'Configuration',
    'Unit Testing',
    'SIT',
    'UAT',
    'Data Migration',
    'Cutover',
    'Go-live',
    'Hypercare',
  ];
  const defaultLocations = ['Office', 'Client site'];
  const defaultPhases = [
    'Workshop',
    'Blueprint Clarifications',
    'Blueprint Confirmation',
    'Build / Configuration',
    'SIT',
    'UAT',
    'Cutover',
    'Go-live',
    'Hypercare',
    'Completed',
  ];
  d.lists = d.lists && typeof d.lists === 'object' ? d.lists : {};
  if (!Array.isArray(d.lists.codes)) d.lists.codes = [];
  d.lists.ticketActivities = [];
  if (!Array.isArray(d.lists.projectActivities) || !d.lists.projectActivities.length)
    d.lists.projectActivities = defaultActivities.slice();
  if (!Array.isArray(d.lists.milestones) || d.lists.milestones.length !== 12)
    d.lists.milestones = defaultMilestones.slice();
  if (!Array.isArray(d.lists.workLocations) || !d.lists.workLocations.length)
    d.lists.workLocations = defaultLocations.slice();
  if (!Array.isArray(d.lists.projectPhases) || d.lists.projectPhases.length < 2)
    d.lists.projectPhases = defaultPhases.slice();
  if (!Array.isArray(d.lists.departments) || !d.lists.departments.length)
    d.lists.departments = defaultDepartments.slice();
  if (!Array.isArray(d.lists.organizationObjects) || !d.lists.organizationObjects.length)
    d.lists.organizationObjects = defaultOrgObjects.slice();
  if (!Array.isArray(d.lists.masterDataObjects) || !d.lists.masterDataObjects.length)
    d.lists.masterDataObjects = defaultMasterObjects.slice();
  if (!Array.isArray(d.lists.projectItemTypes) || !d.lists.projectItemTypes.length)
    d.lists.projectItemTypes = defaultProjectItemTypes.slice();
  if (
    !d.lists.phaseGateCriteria ||
    typeof d.lists.phaseGateCriteria !== 'object' ||
    Array.isArray(d.lists.phaseGateCriteria)
  )
    d.lists.phaseGateCriteria = {};
  for (const phase of d.lists.projectPhases)
    if (
      !Array.isArray(d.lists.phaseGateCriteria[phase]) ||
      !d.lists.phaseGateCriteria[phase].length
    )
      d.lists.phaseGateCriteria[phase] = defaultGateCriteria(phase);
  STEPS.splice(0, STEPS.length, ...d.lists.milestones);
  if (Array.isArray(d.tasks))
    for (const t of d.tasks) {
      if (!t || typeof t !== 'object') continue;
      for (const [k, v] of Object.entries({
        priority: '',
        dueDate: '',
        archived: false,
        archivedAt: '',
        taskType: 'Custom',
        linkId: '',
        customLink: '',
      }))
        if (t[k] === undefined) t[k] = v;
      if (!['Project', 'Ticket', 'Custom'].includes(t.taskType)) t.taskType = 'Custom';
    }
  if (Array.isArray(d.specs))
    for (const s of d.specs) {
      if (!s || typeof s !== 'object') continue;
      if (s.companyId === undefined) s.companyId = '';
      if (s.expectedDate === undefined) s.expectedDate = '';
      if (s.dueDate === undefined) s.dueDate = '';
      if (s.feedback === undefined) s.feedback = '';
      if (!s.itemType) s.itemType = 'RICEFW ID';
      if (!d.lists.projectItemTypes.includes(s.itemType)) d.lists.projectItemTypes.push(s.itemType);
      if (s.itemId === undefined) s.itemId = s.ricefw || '';
      s.ricefw = s.itemId || '';
    }
  if (!Array.isArray(d.projectPlans)) d.projectPlans = [];
  if (Array.isArray(d.schedule))
    for (const s of d.schedule) {
      if (!s || typeof s !== 'object') continue;
      if (s.bookingId === undefined) s.bookingId = '';
      if (s.planId === undefined) s.planId = '';
      if (s.location === undefined) s.location = '';
    }
  if (Array.isArray(d.projectPlans) && Array.isArray(d.schedule)) {
    const old = d.schedule
      .filter(s => s && s.kind === 'project' && !s.planId)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    for (const s of old) {
      let p = d.projectPlans.find(
        p =>
          p.projectId === s.linkId &&
          p.date === s.date &&
          p.endTime === s.time &&
          p.title === (s.activity || 'Project activity') &&
          p.text === s.text &&
          p.source === 'Schedule'
      );
      if (p) p.endTime = hourTime(+s.time.slice(0, 2) + 1);
      else {
        p = {
          id: uid(),
          projectId: s.linkId,
          title: s.activity || 'Project activity',
          activity: s.activity,
          text: s.text,
          date: s.date,
          time: s.time,
          endTime: hourTime(+s.time.slice(0, 2) + 1),
          status: 'Planned',
          source: 'Schedule',
        };
        d.projectPlans.push(p);
      }
      s.planId = p.id;
      s.bookingId = p.id;
    }
  }
  for (const p of d.projectPlans) {
    if (p.endDate === undefined) p.endDate = p.date;
    if (p.location === undefined) p.location = '';
    if (p.actualTask === undefined) p.actualTask = '';
    if (p.actualSame === undefined) p.actualSame = null;
    if (p.actualReviewedAt === undefined) p.actualReviewedAt = '';
  }
  if (Array.isArray(d.projects))
    for (const p of d.projects) {
      if (p.phase === undefined || !d.lists.projectPhases.includes(p.phase))
        p.phase = d.lists.projectPhases[0];
      if (p.goLiveDate === undefined) p.goLiveDate = '';
      if (p.health === undefined) p.health = 'On track';
      if (p.nextMilestone === undefined) p.nextMilestone = '';
    }
  if (!Array.isArray(d.projectCompanies)) d.projectCompanies = [];
  for (const c of d.projectCompanies) {
    if (c.role === undefined) c.role = '';
    for (const k of [
      'organizationStructure',
      'procurement',
      'inventoryManagement',
      'masterData',
      'valuation',
      'invoiceVerification',
    ])
      if (c[k] === undefined) c[k] = '';
  }
  if (!Array.isArray(d.projectDecisions)) d.projectDecisions = [];
  if (!Array.isArray(d.projectProcessMappings)) d.projectProcessMappings = [];
  const legacyAreas = [
    ['organizationStructure', 'Organization Structure'],
    ['masterData', 'Master Data'],
    ['inventoryManagement', 'Inventory Management'],
    ['procurement', 'Procurement'],
  ];
  for (const c of d.projectCompanies)
    for (const [k, area] of legacyAreas)
      if (String(c[k] || '').trim()) {
        const id = 'legacy-' + c.id + '-' + k;
        if (!d.projectProcessMappings.some(m => m.id === id))
          d.projectProcessMappings.push({
            id,
            projectId: c.projectId,
            companyId: c.id,
            area,
            item: 'Migrated legacy notes',
            code: '',
            description: String(c[k]),
            department: 'IT / SAP Support',
            decision: 'Pending review',
            sourceFile: 'Migrated tracker record',
            sourceSheet: '',
            sourceRow: 0,
            proposalVersion: 1,
            importedAt: new Date().toISOString(),
          });
      }
  upgradeMMAreas(d);
  for (const m of d.projectProcessMappings) {
    if (!mappingDecisions.includes(m.decision)) m.decision = 'Pending review';
    if (!m.department) m.department = 'IT / SAP Support';
    if (!d.lists.departments.includes(m.department)) d.lists.departments.push(m.department);
    if (m.code === undefined) m.code = '';
    if (m.description === undefined) m.description = '';
    if (m.sourceFile === undefined) m.sourceFile = '';
    if (m.sourceSheet === undefined) m.sourceSheet = '';
    if (m.sourceRow === undefined) m.sourceRow = 0;
    if (!Number.isInteger(m.proposalVersion) || m.proposalVersion < 1) m.proposalVersion = 1;
    if (m.importedAt === undefined) m.importedAt = '';
  }
  if (!Array.isArray(d.phaseGates)) d.phaseGates = [];
  for (const g of d.phaseGates) {
    if (g.status === 'Accepted') g.status = 'Completed';
    if (!gateStatuses.includes(g.status)) g.status = g.done ? 'Completed' : 'Pending';
    if (
      g.companyId === undefined ||
      (g.companyId &&
        !d.projectCompanies.some(c => c.id === g.companyId && c.projectId === g.projectId))
    )
      g.companyId = '';
    g.done = ['Completed', 'Skipped'].includes(g.status);
  }
  if (!d.preferences || typeof d.preferences !== 'object') d.preferences = {};
  if (!Array.isArray(d.preferences.hiddenTabs)) d.preferences.hiddenTabs = [];
  return d;
}

function validateFeaturesV6(d) {
  validateMMAreas(d);
  const locations = d.lists.workLocations,
    phases = d.lists.projectPhases,
    projectIds = new Set(d.projects.map(p => p.id)),
    ticketIds = new Set(d.tickets.map(t => t.id));
  if (
    !Array.isArray(d.lists.milestones) ||
    d.lists.milestones.length !== 12 ||
    d.lists.milestones.some(v => !checkText(v, 120) || !v.trim())
  )
    throw Error('Keep exactly 12 named milestones.');
  for (const key of [
    'projectActivities',
    'workLocations',
    'projectPhases',
    'departments',
    'organizationObjects',
    'masterDataObjects',
    'projectItemTypes',
  ])
    if (
      !Array.isArray(d.lists[key]) ||
      !d.lists[key].length ||
      d.lists[key].length > 150 ||
      d.lists[key].some(v => !checkText(v, 500) || !v.trim())
    )
      throw Error('Check the editable built-in lists.');
  if (!d.lists.phaseGateCriteria || typeof d.lists.phaseGateCriteria !== 'object')
    throw Error('Check the phase-gate criteria lists.');
  for (const phase of phases) {
    const rows = d.lists.phaseGateCriteria[phase];
    if (
      !Array.isArray(rows) ||
      !rows.length ||
      rows.length > 100 ||
      rows.some(v => !checkText(v, 500) || !v.trim())
    )
      throw Error('Keep at least one acceptance criterion for every project phase.');
  }
  for (const t of d.tasks) {
    if (
      !checkText(t.priority, 50) ||
      !validDate(t.dueDate) ||
      typeof t.archived !== 'boolean' ||
      !validDate(t.archivedAt) ||
      (t.archived && !t.done)
    )
      throw Error('Check the task priority, dates, and archive status.');
    if (
      !['Project', 'Ticket', 'Custom'].includes(t.taskType) ||
      !checkText(t.linkId, 100) ||
      !checkText(t.customLink, 500)
    )
      throw Error('Check the task type and link.');
    if (t.taskType === 'Project' && !projectIds.has(t.linkId))
      throw Error('Choose a valid project for every project task.');
    if (t.taskType === 'Ticket' && !ticketIds.has(t.linkId))
      throw Error('Choose a valid ticket for every ticket task.');
  }
  if (!Array.isArray(d.projectPlans) || d.projectPlans.length > LIMIT)
    throw Error('Project plans support up to 5,000 activities.');
  const ids = new Set(d.projectPlans.map(p => p.id));
  if (ids.size !== d.projectPlans.length) throw Error('Duplicate project plan IDs.');
  for (const p of d.projectPlans) {
    validateScheduleCompany(p, d);
    if (
      !checkText(p.id, 100) ||
      !p.id ||
      !projectIds.has(p.projectId) ||
      !checkText(p.title, 500) ||
      !p.title.trim() ||
      !checkText(p.activity, 500) ||
      !checkText(p.text) ||
      !validDate(p.date) ||
      !p.date ||
      !PLAN_STATUS.includes(p.status) ||
      !['Projects', 'Schedule', 'Stopwatch'].includes(p.source) ||
      !checkText(p.actualTask) ||
      !checkText(p.actualReviewedAt, 50) ||
      ![null, true, false].includes(p.actualSame)
    )
      throw Error('Check the project activity.');
    rangeTimes(p.time, p.endTime);
    rangeDates(p.date, p.endDate);
    if (!['', ...locations].includes(p.location)) throw Error('Invalid project location.');
  }
  for (const s of d.schedule) {
    validateScheduleCompany(s, d);
    if (
      !checkText(s.bookingId, 100) ||
      !checkText(s.planId, 100) ||
      !['', ...locations].includes(s.location)
    )
      throw Error('Invalid schedule booking.');
    if (s.planId) {
      const p = d.projectPlans.find(p => p.id === s.planId);
      if (
        !p ||
        s.kind !== 'project' ||
        s.linkId !== p.projectId ||
        s.date < p.date ||
        s.date > p.endDate ||
        s.location !== p.location ||
        (s.companyId || '') !== (p.companyId || '') ||
        (s.companyName || '') !== (p.companyName || '') ||
        s.time < p.time ||
        s.time >= p.endTime
      )
        throw Error('Schedule and project plan do not match.');
    }
  }
  for (const p of d.projectPlans) {
    const slots = d.schedule.filter(s => s.planId === p.id);
    if (
      slots.length !==
      rangeTimes(p.time, p.endTime).length * rangeDates(p.date, p.endDate).length
    )
      throw Error('A project plan must reserve its full time range.');
  }
  for (const p of d.projects)
    if (
      !phases.includes(p.phase) ||
      !validDate(p.goLiveDate) ||
      !['On track', 'At risk', 'Blocked'].includes(p.health) ||
      !checkText(p.nextMilestone, 500)
    )
      throw Error('Check the project phase, Go-Live date, health, and next milestone.');
  if (
    !Array.isArray(d.projectCompanies) ||
    d.projectCompanies.length > LIMIT ||
    !Array.isArray(d.projectDecisions) ||
    d.projectDecisions.length > LIMIT ||
    !Array.isArray(d.projectProcessMappings) ||
    d.projectProcessMappings.length > LIMIT ||
    !Array.isArray(d.phaseGates) ||
    d.phaseGates.length > LIMIT
  )
    throw Error('Project governance records exceed the 5,000-record limit.');
  const companyIds = new Set(d.projectCompanies.map(c => c.id));
  if (companyIds.size !== d.projectCompanies.length) throw Error('Duplicate company IDs.');
  for (const c of d.projectCompanies)
    if (
      !checkText(c.id, 100) ||
      !c.id ||
      !projectIds.has(c.projectId) ||
      !checkText(c.name, 200) ||
      !c.name.trim() ||
      !checkText(c.role, 500)
    )
      throw Error('Check the project company details.');
  for (const s of d.specs)
    if (
      !checkText(s.companyId, 100) ||
      (s.companyId &&
        (!companyIds.has(s.companyId) ||
          !d.projectCompanies.some(c => c.id === s.companyId && c.projectId === s.projectId))) ||
      !d.lists.projectItemTypes.includes(s.itemType) ||
      !checkText(s.itemId, 200) ||
      !checkText(s.ricefw, 200) ||
      s.ricefw !== s.itemId
    )
      throw Error('Check the type, ID, and company for each project item.');
  for (const r of d.projectDecisions)
    if (
      !checkText(r.id, 100) ||
      !r.id ||
      !projectIds.has(r.projectId) ||
      !checkText(r.companyId, 100) ||
      (r.companyId && !companyIds.has(r.companyId)) ||
      !checkText(r.category, 100) ||
      !r.category.trim() ||
      !checkText(r.decision) ||
      !r.decision.trim() ||
      !checkText(r.owner, 200) ||
      !validDate(r.date) ||
      !['Proposed', 'Approved', 'Superseded'].includes(r.status)
    )
      throw Error('Check the legacy implementation decision log.');
  const mappingIds = new Set(d.projectProcessMappings.map(m => m.id));
  if (mappingIds.size !== d.projectProcessMappings.length)
    throw Error('Duplicate process-mapping IDs.');
  for (const m of d.projectProcessMappings)
    if (
      !checkText(m.id, 100) ||
      !m.id ||
      !projectIds.has(m.projectId) ||
      !companyIds.has(m.companyId) ||
      !mmAreaNames(m.projectId, d).includes(m.area) ||
      !checkText(m.item, 500) ||
      !m.item.trim() ||
      !checkText(m.code, 200) ||
      !checkText(m.description) ||
      !d.lists.departments.includes(m.department) ||
      !MAPPING_DECISIONS.includes(m.decision) ||
      !checkText(m.sourceFile, 500) ||
      !checkText(m.sourceSheet, 200) ||
      !Number.isInteger(m.sourceRow) ||
      m.sourceRow < 0 ||
      !Number.isInteger(m.proposalVersion) ||
      m.proposalVersion < 1 ||
      !checkText(m.importedAt, 50)
    )
      throw Error('Check the imported company and process mappings.');
  for (const g of d.phaseGates)
    if (
      !checkText(g.id, 100) ||
      !g.id ||
      !projectIds.has(g.projectId) ||
      !phases.includes(g.phase) ||
      !checkText(g.companyId, 100) ||
      (g.companyId &&
        !d.projectCompanies.some(c => c.id === g.companyId && c.projectId === g.projectId)) ||
      !checkText(g.text, 500) ||
      !g.text.trim() ||
      !GATE_STATUSES.includes(g.status) ||
      typeof g.done !== 'boolean' ||
      g.done !== ['Completed', 'Skipped'].includes(g.status)
    )
      throw Error('Check the phase-gate checklist.');
  const allowedTabs = ['tickets', 'tasks', 'schedule', 'specs'];
  if (
    !Array.isArray(d.preferences.hiddenTabs) ||
    d.preferences.hiddenTabs.some(t => !allowedTabs.includes(t)) ||
    new Set(d.preferences.hiddenTabs).size !== d.preferences.hiddenTabs.length ||
    d.preferences.hiddenTabs.length === allowedTabs.length
  )
    throw Error('Keep at least one main screen visible.');
}

function editLists() {
  openModal('Built-in list library', window.WorkHubLists.render(state.lists, defaultGateCriteria));
  const form = $('listsForm');
  form.dataset.owner = cloud.user?.id || '';
  window.WorkHubLists.mount(form);
}

function saveLists(form) {
  if (form.dataset.owner !== (cloud.user?.id || ''))
    throw Error('Reopen the built-in lists for the current account.');
  const milestones = listValues(form, 'milestones'),
    projectActivities = listValues(form, 'projectActivities'),
    workLocations = listValues(form, 'workLocations'),
    projectPhases = listValues(form, 'projectPhases'),
    projectItemTypes = listValues(form, 'projectItemTypes'),
    departments = listValues(form, 'departments'),
    organizationObjects = listValues(form, 'organizationObjects'),
    masterDataObjects = listValues(form, 'masterDataObjects'),
    feedbackCategories = form.elements.namedItem('feedbackCategories')
      ? listValues(form, 'feedbackCategories')
      : state.lists.feedbackCategories || ['Observation'];
  if (milestones.length !== 12) throw Error('Enter exactly 12 milestone names.');
  if (
    !projectActivities.length ||
    !workLocations.length ||
    projectPhases.length < 2 ||
    !projectItemTypes.length ||
    !departments.length ||
    !organizationObjects.length ||
    !masterDataObjects.length ||
    !feedbackCategories.length
  )
    throw Error('Keep all built-in lists populated and at least two project phases.');
  const usedLocations = new Set(
      [...state.projectPlans.map(p => p.location), ...state.schedule.map(s => s.location)].filter(
        Boolean
      )
    ),
    missingLocations = [...usedLocations].filter(v => !workLocations.includes(v));
  if (missingLocations.length)
    throw Error(
      'Keep work location' +
        (missingLocations.length > 1 ? 's ' : ' ') +
        missingLocations.join(', ') +
        ' because existing schedule records use ' +
        (missingLocations.length > 1 ? 'them.' : 'it.')
    );
  const usedDepartments = new Set([
      ...state.projectProcessMappings.map(m => m.department),
      ...(state.projectFeedback || []).map(f => f.department),
    ]),
    missingDepartments = [...usedDepartments].filter(v => !departments.includes(v));
  if (missingDepartments.length)
    throw Error(
      'Keep department' +
        (missingDepartments.length > 1 ? 's ' : ' ') +
        missingDepartments.join(', ') +
        ' because existing records use ' +
        (missingDepartments.length > 1 ? 'them.' : 'it.')
    );
  const usedCategories = new Set((state.projectFeedback || []).map(f => f.category)),
    missingCategories = [...usedCategories].filter(v => !feedbackCategories.includes(v));
  if (missingCategories.length)
    throw Error(
      'Keep Phase Feedback categor' +
        (missingCategories.length > 1 ? 'ies ' : 'y ') +
        missingCategories.join(', ') +
        ' because existing feedback uses ' +
        (missingCategories.length > 1 ? 'them.' : 'it.')
    );
  const usedItemTypes = new Set(state.specs.map(s => s.itemType || 'RICEFW ID')),
    missingItemTypes = [...usedItemTypes].filter(v => !projectItemTypes.includes(v));
  if (missingItemTypes.length)
    throw Error(
      'Keep project item type' +
        (missingItemTypes.length > 1 ? 's ' : ' ') +
        missingItemTypes.join(', ') +
        ' because existing project items use ' +
        (missingItemTypes.length > 1 ? 'them.' : 'it.')
    );
  const oldSteps = STEPS.slice(),
    oldPhases = state.lists.projectPhases.slice(),
    phaseGateCriteria = {};
  for (let i = 0; i < projectPhases.length; i++) {
    const el = form.elements.namedItem('phaseGateCriteria' + i),
      rows = el
        ? [
            ...new Set(
              el.value
                .split(/\r?\n/)
                .map(s => s.trim())
                .filter(Boolean)
            ),
          ]
        : defaultGateCriteria(projectPhases[i]);
    phaseGateCriteria[projectPhases[i]] = rows.length
      ? rows
      : defaultGateCriteria(projectPhases[i]);
  }
  STEPS.splice(0, STEPS.length, ...milestones);
  try {
    const ok = mutate(d => {
      d.lists = {
        ...d.lists,
        milestones,
        projectActivities,
        workLocations,
        projectPhases,
        projectItemTypes,
        departments,
        organizationObjects,
        masterDataObjects,
        feedbackCategories,
        phaseGateCriteria,
        ticketActivities: [],
      };
      for (const p of d.projects) {
        const i = oldPhases.indexOf(p.phase);
        p.phase = projectPhases[Math.max(0, Math.min(i < 0 ? 0 : i, projectPhases.length - 1))];
      }
      for (const g of d.phaseGates) {
        const i = oldPhases.indexOf(g.phase);
        g.phase = projectPhases[Math.max(0, Math.min(i < 0 ? 0 : i, projectPhases.length - 1))];
      }
      for (const f of d.projectFeedback || []) {
        const i = oldPhases.indexOf(f.phase);
        f.phase = projectPhases[Math.max(0, Math.min(i < 0 ? 0 : i, projectPhases.length - 1))];
      }
    });
    closeModal();
    if (ok) tell('Built-in lists and phase-gate criteria saved.');
  } catch (err) {
    STEPS.splice(0, STEPS.length, ...oldSteps);
    throw err;
  }
}

function gateOptions(phase, selected = '') {
  const values = (state.lists.phaseGateCriteria[phase] || defaultGateCriteria(phase)).slice();
  if (selected && !values.includes(selected)) values.unshift(selected);
  return selectOptions(values, selected, 'Choose an acceptance criterion');
}
function updateGateOptions(form) {
  const phase = form.elements.namedItem('phase')?.value || '',
    criterion = form.elements.namedItem('text');
  if (criterion) criterion.innerHTML = gateOptions(phase, '');
}
function gateCompanyOptions(projectId, current = '') {
  const companies = state.projectCompanies
    .filter(c => c.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    `<option value="">Project-wide / all companies</option>` +
    companies
      .map(
        c =>
          `<option value="${esc(c.id)}"${c.id === current ? ' selected' : ''}>${esc(c.name)}</option>`
      )
      .join('')
  );
}
function gateCompanyName(g) {
  return g.companyId
    ? state.projectCompanies.find(c => c.id === g.companyId)?.name || 'Former company'
    : 'Project-wide';
}

function projectCompanyOptions(projectId, current = '') {
  const companies = state.projectCompanies
    .filter(c => c.projectId === projectId)
    .sort((a, b) => a.name.localeCompare(b.name));
  return (
    `<option value="">${companies.length ? 'Unassigned' : 'Import companies first'}</option>` +
    companies
      .map(
        c =>
          `<option value="${esc(c.id)}"${c.id === current ? ' selected' : ''}>${esc(c.name)}${c.role ? ' · ' + esc(c.role) : ''}</option>`
      )
      .join('')
  );
}
function projectCompanyField(projectId, current = '') {
  return `<div class="wide"><label for="field-companyId">Company</label><select id="field-companyId" name="companyId">${projectCompanyOptions(projectId, current)}</select><p class="hint">Companies come from the Excel mapping uploaded in Companies &amp; processes.</p></div>`;
}
function updateSpecCompanyOptions(form) {
  const projectId = form.elements.namedItem('projectId')?.value || state.activeProjectId,
    company = form.elements.namedItem('companyId');
  if (company) company.innerHTML = projectCompanyOptions(projectId, '');
}

function rootDateCapture(form, r, old) {
  window.WorkHubProjectDates.capture(form, r, old);
}
/** Build a ticket/task/project-item editor from FIELDS and attach its existing record ID. */
function editRecord(group, id) {
  const old = id ? state[group].find(r => r.id === id) : null;
  if (id && !old) return;
  const defaults =
    group === 'tickets'
      ? { created: today(), priority: 'High', status: 'Pending', object: 'Internal' }
      : group === 'tasks'
        ? {
            number: String(Math.max(0, ...state.tasks.map(t => +t.number || 0)) + 1),
            taskType: 'Custom',
            linkId: '',
            customLink: '',
            done: false,
          }
        : group === 'specs'
          ? {
              itemType: state.lists.projectItemTypes?.[0] || 'RICEFW ID',
              itemId: '',
              status: 'Not yet Started',
              priority: 'A',
              companyId: '',
              expectedDate: '',
              dueDate: '',
            }
          : {};
  const r = old || defaults,
    projectId = old?.projectId || state.activeProjectId;
  openModal(
    (old ? 'Edit ' : 'Add ') + { tickets: 'ticket', tasks: 'task', specs: 'project item' }[group],
    `<form id="editForm" data-group="${group}" data-id="${esc(id || '')}"><div class="form-grid">${group === 'specs' ? projectField(projectId) + projectCompanyField(projectId, r.companyId || '') : ''}${FIELDS[group].map(([k, l, t, required]) => field(k, l, t, required, r[k] ?? '', group)).join('')}${group === 'tasks' ? taskLinkFields(r) : ''}</div>${group === 'tickets' ? '<p class="hint">Changing History tracker automatically updates the history date and time when you save.</p>' : ''}<div class="modal-actions"><div>${old ? `<button type="button" class="danger" data-action="delete" data-group="${group}" data-id="${esc(id)}">Delete ${group === 'tickets' ? 'ticket' : 'record'}</button>` : ''}</div><div class="actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save ${group === 'tickets' ? 'ticket' : 'record'}</button></div></div></form>`
  );
}

/** Read known form fields, preserve existing linked details, and commit one complete mutation. */
function saveEdit(form) {
  const group = form.dataset.group,
    id = form.dataset.id,
    old = id ? state[group].find(r => r.id === id) : null,
    r = { id: id || uid() };
  if (id && !old) throw Error('The record no longer exists.');
  for (const [k, l, type] of FIELDS[group]) {
    const el = form.elements.namedItem(k);
    r[k] =
      type === 'checkbox'
        ? el.checked
        : type === 'number'
          ? el.value === ''
            ? null
            : Number(el.value)
          : el.value;
  }
  if (group === 'tickets') {
    r.ticket = r.ticket.trim();
    if (!old ? r.history !== '' : r.history !== old.history) {
      r.historyDate = today();
      r.historyTime = timeNow();
    }
  }
  if (group === 'tasks') {
    r.subTasks = old?.subTasks || [];
    r.boardStatus = old?.boardStatus || (r.done ? 'done' : 'todo');
    r.archived = old?.archived || false;
    r.archivedAt = old?.archivedAt || '';
    r.linkId =
      r.taskType === 'Project'
        ? form.elements.namedItem('projectLink')?.value || ''
        : r.taskType === 'Ticket'
          ? form.elements.namedItem('ticketLink')?.value || ''
          : '';
    r.customLink =
      r.taskType === 'Custom' ? form.elements.namedItem('customLink')?.value.trim() || '' : '';
    if (r.taskType !== 'Custom' && !r.linkId)
      throw Error('Choose the ' + r.taskType.toLowerCase() + ' to link.');
    if (r.archived && !r.done) {
      r.archived = false;
      r.archivedAt = '';
    }
    if (r.done && (!old || !old.done) && !r.doneDate) r.doneDate = today();
    if (!r.done) r.doneDate = '';
  }
  if (group === 'specs') {
    rootDateCapture(form, r, old);
    r.projectId =
      form.elements.namedItem('projectId')?.value || old?.projectId || state.activeProjectId;
    r.companyId = form.elements.namedItem('companyId')?.value || '';
    r.itemType = r.itemType.trim();
    r.itemId = r.itemId.trim();
    r.ricefw = r.itemId;
    r.subItems = old?.subItems || [];
    if (!state.lists.projectItemTypes.includes(r.itemType))
      throw Error('Choose a project item type from the built-in list.');
    if (
      r.companyId &&
      !state.projectCompanies.some(c => c.id === r.companyId && c.projectId === r.projectId)
    )
      throw Error('Choose a company belonging to this project.');
    if (
      r.itemId &&
      state.specs.some(
        s =>
          s.id !== r.id &&
          s.projectId === r.projectId &&
          (s.itemType || 'RICEFW ID') === r.itemType &&
          (s.itemId || s.ricefw || '').trim().toLowerCase() === r.itemId.toLowerCase()
      )
    )
      throw Error('That item ID already exists for this item type in the project.');
  }
  const ok = mutate(d => {
    if (old) d[group] = d[group].map(t => (t.id === id ? r : t));
    else {
      if (d[group].length >= LIMIT) throw Error('The section is full.');
      d[group].push(r);
    }
    hub?.batchA?.capture(d, form, group, r.id);
    if (group === 'tickets') {
      if (old && old.ticket !== r.ticket)
        d.trackers.forEach(t => {
          if (t.ticket === old.ticket) t.ticket = r.ticket;
        });
      syncProgressFromTicket(d, r, old);
    }
  });
  closeModal();
  if (ok) tell('Saved.');
}

let pendingGovernanceImport = null,
  governanceImportCompanyId = '',
  governanceCompanyId = '',
  governanceArea = GOVERNANCE_AREAS[0];
const GOVERNANCE_HEADER_ALIASES = {
  company: ['company', 'company name', 'legal entity', 'entity'],
  role: ['company role', 'role', 'what this company does', 'company function'],
  area: ['area', 'sap mm area', 'module', 'category', 'section'],
  item: [
    'item',
    'object',
    'process',
    'process name',
    'bpml process',
    'item bpml process',
    'organization object',
    'master data object',
  ],
  code: ['code', 'process id', 'bpml id', 'object code', 'ricefw id', 'code process id', 'id'],
  description: ['description', 'details', 'proposal', 'requirement'],
  department: ['department', 'responsible department', 'owner department', 'process owner'],
  decision: ['decision', 'approval', 'decision status', 'approval status'],
};
function normalizedHeader(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function decodeXml(s) {
  return String(s || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}
function xmlAttr(attrs, name) {
  const safe = name.replace(':', '\\:'),
    m = String(attrs).match(new RegExp('(?:^|\\s)' + safe + '=(?:"([^"]*)"|\'([^\']*)\')', 'i'));
  return decodeXml(m?.[1] ?? m?.[2] ?? '');
}
function columnIndex(ref) {
  let n = 0;
  for (const c of String(ref).match(/^[A-Z]+/i)?.[0] || '')
    n = n * 26 + c.toUpperCase().charCodeAt(0) - 64;
  return n - 1;
}
async function zipText(zip, path, max = 12 * 1024 * 1024) {
  const entry = zip.file(path);
  if (!entry) throw Error('The workbook is missing ' + path + '.');
  if (Number(entry._data?.uncompressedSize) > max)
    throw Error('The workbook contains an oversized XML part.');
  const text = await entry.async('string');
  if (text.length > max) throw Error('The workbook contains an oversized XML part.');
  return text;
}
function parseSharedStrings(xml) {
  const out = [];
  for (const m of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)) {
    let value = '';
    for (const t of m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)) value += decodeXml(t[1]);
    out.push(value);
  }
  return out;
}
function parseWorksheetRows(xml, shared) {
  const rows = [];
  for (const m of xml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/gi)) {
    const attrs = m[1],
      body = m[2],
      ref = xmlAttr(attrs, 'r'),
      type = xmlAttr(attrs, 't');
    if (!ref) continue;
    const row = +(ref.match(/\d+$/)?.[0] || 0) - 1,
      col = columnIndex(ref);
    if (row < 0 || col < 0 || row > 100000 || col > 500) continue;
    let value = '';
    if (type === 'inlineStr') {
      for (const t of body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)) value += decodeXml(t[1]);
    } else {
      const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] || '';
      value = type === 's' ? (shared[+raw] ?? '') : decodeXml(raw);
    }
    if (!rows[row]) rows[row] = [];
    rows[row][col] = String(value).trim();
  }
  return rows;
}
function workbookPath(target) {
  if (target.startsWith('/')) return target.slice(1);
  if (target.startsWith('xl/')) return target;
  const parts = ('xl/' + target).split('/'),
    out = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part !== '.') out.push(part);
  }
  return out.join('/');
}
function canonicalArea(value) {
  const key = mmAreaKey(value),
    areas = projectMMAreas();
  if (!key) return '';
  const exact =
    areas.find(area => mmAreaKey(area.name) === key) ||
    areas.find(area => area.aliases.some(name => mmAreaKey(name) === key));
  if (exact) return exact.name;
  const name = normalizedHeader(value),
    index =
      name.includes('organization') || name.includes('organisation') || name === 'org structure'
        ? 0
        : name.includes('master')
          ? 1
          : name.includes('inventory') || name === 'im'
            ? 2
            : name.includes('procure') ||
                name.includes('purchas') ||
                name === 'p2p' ||
                name.includes('source to pay')
              ? 3
              : -1;
  return areas.find(area => area.id === 'mm-area-' + index)?.name || '';
}
function canonicalDecision(value) {
  const s = normalizedHeader(value);
  if (!s) return 'Pending review';
  if (['approved', 'approve', 'accepted', 'accept', 'yes'].includes(s)) return 'Approved';
  if (['not approved', 'rejected', 'reject', 'declined', 'no'].includes(s)) return 'Not approved';
  if (s.includes('revision') || s.includes('revise') || s.includes('rework'))
    return 'Revision required';
  return 'Pending review';
}
function headerMap(row) {
  const map = {};
  row.forEach((v, i) => {
    const n = normalizedHeader(v);
    for (const [k, aliases] of Object.entries(GOVERNANCE_HEADER_ALIASES))
      if (map[k] === undefined && aliases.includes(n)) map[k] = i;
  });
  return map;
}
function findHeader(rows, inferredArea) {
  let best = null;
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const map = headerMap(rows[i] || []),
      score = Object.keys(map).length;
    if (
      map.company !== undefined &&
      map.item !== undefined &&
      (map.area !== undefined || inferredArea) &&
      (!best || score > best.score)
    )
      best = { index: i, map, score };
  }
  return best;
}
function summarizeGovernanceRows(sheets, fileName) {
  const rows = [],
    warnings = [];
  for (const sheet of sheets) {
    const inferred = canonicalArea(sheet.name),
      header = findHeader(sheet.rows, inferred);
    if (!header) {
      if (sheet.rows.some(r => r?.some(Boolean)))
        warnings.push(
          `${sheet.name}: no table with Company and Item / BPML Process headers was found.`
        );
      continue;
    }
    for (let i = header.index + 1; i < sheet.rows.length; i++) {
      const source = sheet.rows[i] || [],
        v = k => String(source[header.map[k]] ?? '').trim(),
        company = v('company'),
        item = v('item'),
        area = v('area') ? canonicalArea(v('area')) : inferred;
      if (!source.some(Boolean)) continue;
      if (!company || !item || !area) {
        warnings.push(
          `${sheet.name} row ${i + 1}: skipped because Company, Item / BPML Process, or a supported Area is missing.`
        );
        continue;
      }
      const department = v('department') || 'Unassigned';
      if (!v('department'))
        warnings.push(
          `${sheet.name} row ${i + 1}: Department was blank and will be imported as Unassigned.`
        );
      rows.push({
        company: company.slice(0, 200),
        role: v('role').slice(0, 500),
        area,
        item: item.slice(0, 500),
        code: v('code').slice(0, 200),
        description: v('description').slice(0, 32767),
        department: department.slice(0, 500),
        decision: canonicalDecision(v('decision')),
        sourceFile: fileName.slice(0, 500),
        sourceSheet: sheet.name.slice(0, 200),
        sourceRow: i + 1,
      });
      if (rows.length > LIMIT)
        throw Error(
          'The workbook contains more than 5,000 valid mapping rows. Split it into smaller files.'
        );
    }
  }
  if (!rows.length)
    throw Error(
      'No valid company/process rows were found. Use Company, Area, Item / BPML Process, Department, and Decision columns.'
    );
  return { rows, warnings };
}
async function parseGovernanceWorkbook(file) {
  if (!file || !file.name) throw Error('Choose an Excel workbook.');
  if (!/\.(xlsx|xlsm)$/i.test(file.name))
    throw Error('Choose an .xlsx or .xlsm workbook. Legacy .xls files are not supported.');
  if (file.size > 20 * 1024 * 1024) throw Error('Choose a workbook below 20 MB.');
  if (typeof JSZip === 'undefined')
    throw Error('The Excel reader is unavailable. Refresh the tracker and try again.');
  const zip = await JSZip.loadAsync(await file.arrayBuffer()),
    entries = Object.values(zip.files);
  if (entries.length > 1000) throw Error('The workbook contains too many files.');
  if (entries.reduce((n, e) => n + (Number(e._data?.uncompressedSize) || 0), 0) > 60 * 1024 * 1024)
    throw Error('The workbook expands beyond the 60 MB safety limit.');
  const workbook = await zipText(zip, 'xl/workbook.xml'),
    rels = await zipText(zip, 'xl/_rels/workbook.xml.rels'),
    shared = zip.file('xl/sharedStrings.xml')
      ? parseSharedStrings(await zipText(zip, 'xl/sharedStrings.xml'))
      : [],
    relMap = {};
  for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?\s*>/gi))
    relMap[xmlAttr(m[1], 'Id')] = workbookPath(xmlAttr(m[1], 'Target'));
  const sheets = [];
  for (const m of workbook.matchAll(/<sheet\b([^>]*)\/?\s*>/gi)) {
    const name = xmlAttr(m[1], 'name'),
      path = relMap[xmlAttr(m[1], 'r:id')];
    if (path && zip.file(path))
      sheets.push({ name, rows: parseWorksheetRows(await zipText(zip, path), shared) });
  }
  if (!sheets.length) throw Error('No readable worksheets were found.');
  return { fileName: file.name, ...summarizeGovernanceRows(sheets, file.name) };
}

function previewGovernanceImport(result) {
  const project = activeProject(),
    knownCompanies = new Set(
      state.projectCompanies.filter(c => c.projectId === project.id).map(c => c.name.toLowerCase())
    ),
    knownDepartments = new Set(state.lists.departments.map(v => v.toLowerCase())),
    newCompanies = [
      ...new Set(result.rows.map(r => r.company).filter(v => !knownCompanies.has(v.toLowerCase()))),
    ],
    newDepartments = [
      ...new Set(
        result.rows.map(r => r.department).filter(v => !knownDepartments.has(v.toLowerCase()))
      ),
    ],
    areaCounts = mmAreaNames().map(a => [a, result.rows.filter(r => r.area === a).length]),
    target = state.projectCompanies.find(c => c.id === governanceImportCompanyId);
  if (target && !result.rows.some(r => r.company.toLowerCase() === target.name.toLowerCase()))
    result.warnings.unshift(
      `This revised-proposal upload does not contain a row for ${target.name}. It can still be imported for the companies listed below.`
    );
  pendingGovernanceImport = { ...result, projectId: project.id };
  openModal(
    'Review Excel mapping import',
    `<div class="import-summary"><div><span>Project</span><strong>${esc(project.name)}</strong></div><div><span>Rows ready</span><strong>${result.rows.length}</strong></div><div><span>New companies</span><strong>${newCompanies.length}</strong></div><div><span>New departments</span><strong>${newDepartments.length}</strong></div></div><div class="subtle-card"><strong>Rows by SAP MM area</strong><p>${areaCounts.map(([a, n]) => `${esc(a)}: ${n}`).join(' · ')}</p>${newCompanies.length ? `<p><strong>Companies to add:</strong> ${newCompanies.map(esc).join(', ')}</p>` : ''}${newDepartments.length ? `<p><strong>Departments to add:</strong> ${newDepartments.map(esc).join(', ')}</p>` : ''}</div>${
      result.warnings.length
        ? `<div class="import-warnings"><strong>Review notes</strong><ul>${result.warnings
            .slice(0, 30)
            .map(w => `<li>${esc(w)}</li>`)
            .join(
              ''
            )}</ul>${result.warnings.length > 30 ? `<p>${result.warnings.length - 30} more notes are not shown.</p>` : ''}</div>`
        : ''
    }<div class="scroll import-preview"><table><thead><tr><th>Company</th><th>Area</th><th>Item / BPML process</th><th>Code / Process ID</th><th>Department</th><th>Decision</th><th>Source</th></tr></thead><tbody>${result.rows
      .slice(0, 60)
      .map(
        r =>
          `<tr><td>${esc(r.company)}</td><td>${esc(r.area)}</td><td class="desc">${esc(r.item)}</td><td>${esc(r.code) || '—'}</td><td>${esc(r.department)}</td><td>${tag(r.decision)}</td><td>${esc(r.sourceSheet)} · row ${r.sourceRow}</td></tr>`
      )
      .join(
        ''
      )}</tbody></table>${result.rows.length > 60 ? `<div class="table-caption">Showing 60 of ${result.rows.length} rows. All valid rows will be imported.</div>` : ''}</div><p class="hint">The workbook stays in your browser. Only the normalized rows shown here are saved to SAP MM WorkHub.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="button" data-action="apply-governance-import">Import ${result.rows.length} rows</button></div>`
  );
}
function mappingIdentity(m) {
  return [m.companyId, m.area, normalizedHeader(m.code || m.item)].join('|');
}
function applyGovernanceImport() {
  const batch = pendingGovernanceImport;
  if (!batch) throw Error('Choose a workbook first.');
  if (!state.projects.some(p => p.id === batch.projectId))
    throw Error('The selected project no longer exists.');
  let companiesAdded = 0,
    rowsAdded = 0,
    rowsUpdated = 0;
  const ok = mutate(d => {
    const companyMap = new Map(
      d.projectCompanies
        .filter(c => c.projectId === batch.projectId)
        .map(c => [c.name.toLowerCase(), c])
    );
    for (const row of batch.rows) {
      let company = companyMap.get(row.company.toLowerCase());
      if (!company) {
        company = {
          id: uid(),
          projectId: batch.projectId,
          name: row.company,
          role: row.role || '',
          organizationStructure: '',
          procurement: '',
          inventoryManagement: '',
          masterData: '',
          valuation: '',
          invoiceVerification: '',
        };
        d.projectCompanies.push(company);
        companyMap.set(row.company.toLowerCase(), company);
        companiesAdded++;
      } else if (row.role) company.role = row.role;
      if (!d.lists.departments.some(v => v.toLowerCase() === row.department.toLowerCase()))
        d.lists.departments.push(row.department);
      const objectList =
        row.area === 'Organization Structure'
          ? 'organizationObjects'
          : row.area === 'Master Data'
            ? 'masterDataObjects'
            : '';
      if (objectList && !d.lists[objectList].some(v => v.toLowerCase() === row.item.toLowerCase()))
        d.lists[objectList].push(row.item);
      const candidate = {
          ...row,
          id: '',
          projectId: batch.projectId,
          companyId: company.id,
          proposalVersion: 1,
          importedAt: new Date().toISOString(),
        },
        codeKey = normalizedHeader(row.code),
        itemKey = normalizedHeader(row.item),
        existing = d.projectProcessMappings.find(
          m =>
            m.companyId === company.id &&
            m.area === row.area &&
            ((codeKey && normalizedHeader(m.code) === codeKey) ||
              normalizedHeader(m.item) === itemKey)
        );
      if (existing) {
        Object.assign(existing, {
          area: row.area,
          item: row.item,
          code: row.code,
          description: row.description,
          department: row.department,
          decision: row.decision,
          sourceFile: row.sourceFile,
          sourceSheet: row.sourceSheet,
          sourceRow: row.sourceRow,
          proposalVersion: existing.proposalVersion + 1,
          importedAt: candidate.importedAt,
        });
        rowsUpdated++;
      } else {
        candidate.id = uid();
        d.projectProcessMappings.push(candidate);
        rowsAdded++;
      }
    }
  });
  pendingGovernanceImport = null;
  governanceImportCompanyId = '';
  projectView = 'companies';
  closeModal();
  render();
  if (ok)
    tell(
      `Excel mapping imported: ${companiesAdded} companies added, ${rowsAdded} rows added, ${rowsUpdated} rows updated.`
    );
}
function openGovernanceFile(companyId = '') {
  governanceImportCompanyId = companyId;
  const input = $('governanceFile');
  input.value = '';
  input.click();
}
async function handleGovernanceFile(file) {
  if (!file) return;
  try {
    tell('Reading Excel workbook…');
    previewGovernanceImport(await parseGovernanceWorkbook(file));
  } catch (err) {
    tell('Excel import failed: ' + err.message, true);
  } finally {
    $('governanceFile').value = '';
  }
}

function mappingSelect(values, current, attribute, id) {
  return `<select ${attribute}="${esc(id)}" aria-label="${esc(attribute.includes('department') ? 'Responsible department' : 'Decision')}">${values.map(v => `<option${v === current ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
}

function managerCompanyRows(companies, mappings) {
  return companies
    .map(c => {
      const rows = mappings.filter(m => m.companyId === c.id);
      return `<details class="manager-company"><summary><span><strong>${esc(c.name)}</strong><small>${esc(c.role) || 'Role not supplied'} · ${rows.length} mapped item${rows.length === 1 ? '' : 's'}</small></span><span>Manage ▾</span></summary><div class="manager-company-body"><div class="actions manager-company-actions"><button class="small" data-action="revise-mapping" data-id="${esc(c.id)}">Upload revised proposal</button><button class="small danger" data-action="delete-company" data-id="${esc(c.id)}">Delete company</button></div>${rows.length ? `<div class="scroll"><table class="proposal-table"><thead><tr><th>Area</th><th>Item / process</th><th>Proposal</th><th>Source</th><th>Actions</th></tr></thead><tbody>${rows.map(m => `<tr><td>${esc(m.area)}</td><td class="desc"><strong>${esc(m.item)}</strong><div class="hint">${esc(m.code) || 'No process ID'}</div></td><td class="nowrap">v${m.proposalVersion}</td><td>${esc(m.sourceFile) || '—'}${m.sourceSheet ? `<div class="hint">${esc(m.sourceSheet)}${m.sourceRow ? ' · row ' + m.sourceRow : ''}</div>` : ''}</td><td><button class="small danger" data-action="delete-mapping" data-id="${esc(m.id)}">Delete record</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No imported records for this company.</p>'}</div></details>`;
    })
    .join('');
}

function managerGateRows(gates) {
  return gates
    .map(
      g =>
        `<div class="project-manager-row gate-manager-row"><div><strong>${esc(g.phase)} · ${esc(gateCompanyName(g))}</strong><div class="hint">${esc(g.text)}</div></div><div class="actions">${tag(g.status)}<button class="small danger" data-action="delete-gate" data-id="${esc(g.id)}">Delete gate</button></div></div>`
    )
    .join('');
}

function syncCalculatedProjectHealth(d) {
  for (const p of d.projects) p.health = projectHealthDetails(p.id, d, today()).status;
  return d;
}
function healthClass(status) {
  return 'health-' + String(status).toLowerCase().replace(/\s+/g, '-');
}
function healthBadge(health) {
  return `<span class="health-badge ${healthClass(health.status)}">${esc(health.status)}</span>`;
}
function projectAlerts(p, m) {
  const health = projectHealthDetails(p.id),
    alerts = health.reasons.map(t => [health.status === 'Blocked' ? 'blocked' : '', t]);
  if (m.overdue.length)
    alerts.push([
      '',
      `${m.overdue.length} planned activit${m.overdue.length === 1 ? 'y is' : 'ies are'} overdue.`,
    ]);
  return alerts.length
    ? `<div class="project-alerts">${alerts.map(([c, t]) => `<div class="project-alert ${c}">${esc(t)}</div>`).join('')}</div>`
    : '';
}

function renderProjectOverview(m) {
  const p = activeProject(),
    health = projectHealthDetails(p.id),
    statuses = [...new Set([...OPTIONS.specStatus, ...m.items.map(s => s.status)])],
    attention = m.overdue.slice(0, 5),
    gateDone = m.gates.filter(g => g.status !== 'Pending').length;
  return `<div class="dashboard-grid">${hub?.standup?.card(p.id) || ''}<section class="panel box"><h2>Project overview</h2><div class="view-details" style="margin-top:16px"><div><div class="detail-label">Current phase</div><div class="detail-value">${esc(p.phase)} · ${projectPhasePercent(p)}%</div></div><div><div class="detail-label">Health · automatic</div><div class="detail-value">${healthBadge(health)}<small class="health-summary">${esc(health.summary)}</small></div></div><div><div class="detail-label">Go-Live</div><div class="detail-value">${goLiveInfo(p)}</div></div><div class="wide"><div class="detail-label">Next milestone</div><div class="detail-value">${esc(p.nextMilestone) || 'Not set'}</div></div></div>${projectAlerts(p, m)}<h3 class="section-label">Project item progress</h3><div class="status-breakdown">${
    statuses
      .map(s => {
        const n = m.items.filter(i => i.status === s).length;
        return n
          ? `<div class="status-row"><span>${esc(s)}</span><div class="progress"><span style="width:${m.items.length ? (n / m.items.length) * 100 : 0}%"></span></div><strong>${n}</strong></div>`
          : '';
      })
      .join('') || '<p>No project items yet.</p>'
  }</div><div class="actions"><button data-action="project-view" data-view="items">Project items</button><button data-action="project-view" data-view="gates">Phase gates ${gateDone}/${m.gates.length}</button></div></section><section class="panel box"><div class="flex-title"><h2>Upcoming activities</h2><button class="small" data-action="project-view" data-view="calendar">Calendar</button></div><div class="plan-list">${m.upcoming.slice(0, 7).map(planRow).join('') || '<p class="muted">No upcoming activities. Use Plan activity to schedule one.</p>'}</div>${attention.length ? '<h3 class="section-label">Past due plans</h3>' + attention.map(planRow).join('') : ''}<div class="subtle-card" style="margin-top:18px"><strong>Implementation governance</strong><p class="muted">${m.companies.length} companies · ${m.mappings.length} mapped processes · ${m.gates.filter(g => g.status === 'Pending').length} open gates</p><button class="small" data-action="project-view" data-view="companies">Companies &amp; processes</button></div></section></div>`;
}

async function enhancementAction(b) {
  if (workhubAction(b)) return true;
  const a = b.dataset.action,
    id = b.dataset.id;
  if (a === 'delete-project') {
    deleteProject(id);
    return true;
  }
  if (a === 'project-management') {
    closeSettingsMenu();
    openProjectManagement();
    return true;
  }
  if (a === 'tab-visibility') {
    closeSettingsMenu();
    editVisibility();
    return true;
  }
  if (a === 'pending-object') {
    filterState = { query: '', status: 'Pending', object: b.dataset.object, priority: '' };
    render();
    return true;
  }
  if (a === 'archive-task' || a === 'archive-done') {
    archiveTasks(a === 'archive-task' ? id : '');
    return true;
  }
  if (a === 'restore-task') {
    const ok = mutate(d => {
      const t = d.tasks.find(t => t.id === id);
      if (!t) throw Error('Task not found.');
      t.archived = false;
      t.archivedAt = '';
    });
    if (ok) tell('Task restored.');
    return true;
  }
  if (a === 'schedule-task') {
    openRangeEditor(today(), '09:00', id, true);
    return true;
  }
  if (a === 'new-range') {
    openRangeEditor(month === today().slice(0, 7) ? today() : month + '-01', '09:00', '', true);
    return true;
  }
  if (a === 'open-booking') {
    openRangeEditor(b.dataset.date, b.dataset.time);
    return true;
  }
  if (a === 'clear-booking') {
    if (
      await authorizeActivityDeletion(
        'Delete this scheduled activity and its full date/time range?'
      )
    )
      clearDraftBooking();
    return true;
  }
  if (a === 'project-view') {
    projectView = b.dataset.view;
    render();
    return true;
  }
  if (a === 'governance-area') {
    governanceQuery = '';
    governanceArea = b.dataset.area;
    render();
    return true;
  }
  if (a === 'new-plan') {
    editPlan('', b.dataset.date || today());
    return true;
  }
  if (a === 'view-plan') {
    viewPlan(id);
    return true;
  }
  if (a === 'edit-plan') {
    editPlan(id, b.dataset.date || today());
    return true;
  }
  if (a === 'delete-plan') {
    if (
      await authorizeActivityDeletion('Delete this project activity and its scheduled time range?')
    ) {
      mutate(d => {
        d.projectPlans = d.projectPlans.filter(p => p.id !== id);
        d.schedule = d.schedule.filter(s => s.planId !== id);
      });
      closeModal();
      tell('Activity deleted.');
    }
    return true;
  }
  if (a === 'project-month') {
    const [y, m] = projectMonth.split('-').map(Number),
      next = new Date(y, m - 1 + Number(b.dataset.direction), 1);
    if (next.getFullYear() < 1900 || next.getFullYear() > 9999) return true;
    projectMonth = next.getFullYear() + '-' + String(next.getMonth() + 1).padStart(2, '0');
    render();
    return true;
  }
  if (a === 'import-governance' || a === 'revise-mapping') {
    openGovernanceFile(a === 'revise-mapping' ? id : '');
    return true;
  }
  if (a === 'apply-governance-import') {
    applyGovernanceImport();
    return true;
  }
  if (a === 'delete-mapping') {
    if (confirm('Delete this imported mapping row?')) {
      const ok = mutate(
        d => (d.projectProcessMappings = d.projectProcessMappings.filter(x => x.id !== id))
      );
      openProjectManagement();
      if (ok) tell('Mapping row deleted.');
    }
    return true;
  }
  if (a === 'delete-company') {
    const c = state.projectCompanies.find(c => c.id === id);
    if (
      c &&
      confirm(
        `Delete company "${c.name}", its process mappings, and its project-item links? Company-linked phase gates will be kept as project-wide gates.`
      )
    ) {
      const ok = mutate(d => {
        d.projectCompanies = d.projectCompanies.filter(x => x.id !== id);
        d.projectDecisions = d.projectDecisions.filter(x => x.companyId !== id);
        d.projectProcessMappings = d.projectProcessMappings.filter(x => x.companyId !== id);
        for (const s of d.specs) if (s.companyId === id) s.companyId = '';
        for (const g of d.phaseGates) if (g.companyId === id) g.companyId = '';
      });
      governanceCompanyId = '';
      openProjectManagement();
      if (ok) tell('Company and linked mappings deleted; its phase gates are now project-wide.');
    }
    return true;
  }
  if (a === 'new-company' || a === 'edit-company') {
    tell('Companies are maintained through the Excel mapping import.');
    return true;
  }
  if (a === 'new-decision' || a === 'edit-decision') {
    tell('Decisions are selected on imported mapping rows.');
    return true;
  }
  if (a === 'delete-decision') {
    if (confirm('Delete this legacy implementation decision?')) {
      mutate(d => (d.projectDecisions = d.projectDecisions.filter(x => x.id !== id)));
      render();
      tell('Decision deleted.');
    }
    return true;
  }
  if (a === 'new-gate' || a === 'edit-gate') {
    editGate(a === 'edit-gate' ? id : '');
    return true;
  }
  if (a === 'skip-gate') {
    const ok = mutate(d => {
      const g = d.phaseGates.find(x => x.id === id);
      if (!g) throw Error('Phase gate not found.');
      g.status = g.status === 'Skipped' ? 'Pending' : 'Skipped';
      g.done = g.status !== 'Pending';
    });
    if (ok)
      tell(
        state.phaseGates.find(x => x.id === id)?.status === 'Skipped'
          ? 'Phase gate skipped.'
          : 'Phase gate restored to Pending.'
      );
    return true;
  }
  if (a === 'delete-gate') {
    if (confirm('Permanently delete this phase gate from the active project?')) {
      const ok = mutate(d => (d.phaseGates = d.phaseGates.filter(x => x.id !== id)));
      openProjectManagement();
      if (ok) tell('Phase gate deleted.');
    }
    return true;
  }
  if (a === 'actual-same') {
    const p = state.projectPlans.find(p => p.id === id);
    if (!p) throw Error('Project activity not found.');
    completeActual(id, p.activity || p.title, true);
    return true;
  }
  if (a === 'actual-different') {
    actualDifferent(id);
    return true;
  }
  if (a === 'actual-later') {
    closeModal();
    return true;
  }
  return false;
}

function enhancementChange(el) {
  if (workhubChange(el)) return true;
  const id = el.id;
  if (id === 'bookingDate') {
    const end = el.form.elements.namedItem('endDate');
    end.min = el.value;
    if (end.value < el.value) end.value = el.value;
    return true;
  }
  if (id === 'bookingStart') {
    const end = el.form.elements.namedItem('endTime');
    if (end.value <= el.value) end.value = hourTime(Math.min(24, +el.value.slice(0, 2) + 1));
    return true;
  }
  if (id === 'field-taskType') {
    updateTaskLinkFields(el.form);
    return true;
  }
  if (id === 'field-projectId' && el.form?.dataset.group === 'specs') {
    updateSpecCompanyOptions(el.form);
    return true;
  }
  if (id === 'gatePhase') {
    updateGateOptions(el.form);
    return true;
  }
  if (el.dataset.gateToggle) {
    const ok = mutate(d => {
      const g = d.phaseGates.find(g => g.id === el.dataset.gateToggle);
      if (!g) throw Error('Phase gate not found.');
      g.status = el.checked ? 'Completed' : 'Pending';
      g.done = g.status !== 'Pending';
    });
    if (ok) tell('Phase gate updated.');
    return true;
  }
  if (el.dataset.mappingDepartment) {
    const ok = mutate(d => {
      const m = d.projectProcessMappings.find(m => m.id === el.dataset.mappingDepartment);
      if (!m) throw Error('Mapping row not found.');
      m.department = el.value;
    });
    if (ok) tell('Responsible department saved.');
    return true;
  }
  if (el.dataset.mappingDecision) {
    const ok = mutate(d => {
      const m = d.projectProcessMappings.find(m => m.id === el.dataset.mappingDecision);
      if (!m) throw Error('Mapping row not found.');
      m.decision = el.value;
    });
    if (ok) tell('Decision saved.');
    return true;
  }
  if (el.dataset.ticketStatus) {
    changeTicketStatus(el.dataset.ticketStatus, el.value);
    return true;
  }
  if (['taskView', 'taskPriority', 'taskSort'].includes(id)) {
    if (id === 'taskView') taskView = el.value;
    else if (id === 'taskPriority') taskPriority = el.value;
    else taskSort = el.value;
    render();
    return true;
  }
  if (id === 'dashboardProject') {
    specQuery = specFilter = '';
    mutate(d => (d.activeProjectId = el.value));
    return true;
  }
  if (id === 'governanceCompany') {
    governanceQuery = '';
    governanceCompanyId = el.value;
    render();
    return true;
  }
  if (id === 'projectMonth') {
    if (el.value && monthDates(el.value).length) {
      projectMonth = el.value;
      render();
    }
    return true;
  }
  return false;
}

$('governanceFile').addEventListener('change', e => void handleGovernanceFile(e.target.files?.[0]));

// SAP MM WorkHub presentation changes. Existing record IDs and backup formats stay intact.
let itemCompanyId = '',
  governanceQuery = '',
  scheduleLayout = 'calendar',
  scheduleDay = '';

function scopedProjectItems() {
  const project = activeProject(),
    companies = state.projectCompanies.filter(c => c.projectId === project?.id);
  if (
    itemCompanyId &&
    itemCompanyId !== 'unassigned' &&
    !companies.some(c => c.id === itemCompanyId)
  )
    itemCompanyId = '';
  return activeSpecs().filter(
    r =>
      !itemCompanyId ||
      (itemCompanyId === 'unassigned' ? !r.companyId : r.companyId === itemCompanyId)
  );
}

function filteredMappingRows(rows) {
  return rows.filter(m =>
    match(
      {
        item: m.item,
        code: m.code,
        description: m.description,
        department: m.department,
        decision: m.decision,
      },
      governanceQuery
    )
  );
}

function scheduleEntryTitle(e) {
  const s = e.slot;
  if (window.WorkHubLeave.isLeave(s.kind)) return s.title || window.WorkHubLeave.TYPES[s.kind];
  if (s.kind === 'project')
    return (
      state.projectPlans.find(p => p.id === s.planId)?.title ||
      state.projectPlans.find(p => p.id === s.planId)?.activity ||
      s.activity ||
      'Project activity'
    );
  if (s.kind === 'task') return state.tasks.find(t => t.id === s.linkId)?.task || 'Task';
  return s.text || 'Custom activity';
}
function scheduleEntryContext(e) {
  const s = e.slot;
  if (window.WorkHubLeave.isLeave(s.kind))
    return [
      window.WorkHubLeave.TYPES[s.kind],
      s.leave.status,
      s.kind === 'medical-leave'
        ? s.leave.mcSubmitted
          ? 'MC submitted'
          : 'MC to submit'
        : s.leave.contact
          ? 'Cover: ' + s.leave.contact
          : '',
    ]
      .filter(Boolean)
      .join(' · ');
  return s.kind === 'project'
    ? [state.projects.find(p => p.id === s.linkId)?.name, s.location].filter(Boolean).join(' · ')
    : s.kind === 'task'
      ? taskLinkedLabel(state.tasks.find(t => t.id === s.linkId) || { taskType: 'Custom' })
      : 'Custom activity';
}

function refreshScheduleStatuses() {
  for (const el of $('view')?.querySelectorAll?.('[data-schedule-status]') || []) {
    const s = state.schedule.find(s => s.date === el.dataset.date && s.time === el.dataset.time);
    if (!s) continue;
    const e = el.dataset.scheduleClass
        ? scheduleEntries(s.date).find(e => e.slot.time === s.time)
        : null,
      status = e ? scheduleEntryStatus(e) : scheduleTimeStatus(s),
      badge = el.querySelector('.slot-state');
    el.className = [
      el.dataset.scheduleClass || 'slot',
      'status-' + statusClass(status),
      isToilSchedule(s) ? 'toil' : '',
    ]
      .filter(Boolean)
      .join(' ');
    if (badge) badge.textContent = status;
  }
  const count = $('scheduleReviewCount');
  if (count) count.textContent = scheduleMonthMetrics().review;
}

// Version 8: phase feedback, gate workspace, and end-to-end project-item traceability.
// =============================================================================
// 4. Phase feedback, gates and traceability
// =============================================================================
const FEEDBACK_STATUSES = ['Open', 'Under Review', 'Action Required', 'Resolved', 'Deferred'];
const FEEDBACK_PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const FEEDBACK_LINK_TYPES = ['Task', 'Project Item', 'Schedule', 'Phase Gate', 'Decision'];
let gatePhaseFilter = '',
  gateCompanyFilter = '',
  gateStatusFilter = '',
  gateQuery = '';
let feedbackPhase = '',
  feedbackCompany = '',
  feedbackStatus = '',
  feedbackQuery = '',
  feedbackView = 'timeline',
  feedbackDraft = null;

function upgradeFeaturesV8(d) {
  d = upgradeFeaturesV6(d);
  const categories = [
    'Clarification',
    'Issue',
    'Decision',
    'Action',
    'Risk',
    'Observation',
    'Lesson Learned',
  ];
  if (!Array.isArray(d.lists.feedbackCategories) || !d.lists.feedbackCategories.length)
    d.lists.feedbackCategories = categories.slice();
  if (!Array.isArray(d.projectFeedback)) d.projectFeedback = [];
  for (const g of d.phaseGates) {
    for (const [k, v] of Object.entries({
      owner: '',
      targetDate: '',
      skipReason: '',
      watched: false,
      updatedAt: '',
    }))
      if (g[k] === undefined) g[k] = v;
    if (g.status === 'Blocked') g.done = false;
    else g.done = ['Completed', 'Skipped'].includes(g.status);
  }
  for (const f of d.projectFeedback) {
    for (const [k, v] of Object.entries({
      companyId: '',
      category: 'Observation',
      summary: '',
      details: '',
      raisedBy: '',
      raisedDate: '',
      department: 'Unassigned',
      owner: '',
      priority: 'Medium',
      dueDate: '',
      status: 'Open',
      resolution: '',
      gateId: '',
      carriedFromId: '',
      carriedToId: '',
      meetingId: '',
      meetingTitle: '',
      referenceLabel: '',
      referenceUrl: '',
      watched: false,
      createdAt: '',
      updatedAt: '',
    }))
      if (f[k] === undefined) f[k] = v;
    if (!Array.isArray(f.ricefwIds)) f.ricefwIds = [];
    if (!Array.isArray(f.links)) f.links = [];
    if (!Array.isArray(f.history)) f.history = [];
    if (!d.lists.feedbackCategories.includes(f.category))
      d.lists.feedbackCategories.push(f.category);
    if (!d.lists.departments.includes(f.department)) d.lists.departments.push(f.department);
  }
  return d;
}

function validateFeaturesV8(d) {
  validateFeaturesV6(d);
  const statuses = ['Open', 'Under Review', 'Action Required', 'Resolved', 'Deferred'],
    priorities = ['Critical', 'High', 'Medium', 'Low'],
    types = ['Task', 'Project Item', 'Schedule', 'Phase Gate', 'Decision'],
    projectIds = new Set(d.projects.map(p => p.id)),
    companyIds = new Set(d.projectCompanies.map(c => c.id)),
    specIds = new Set(d.specs.map(s => s.id)),
    gateIds = new Set(d.phaseGates.map(g => g.id)),
    feedbackIds = new Set(d.projectFeedback.map(f => f.id));
  if (
    !Array.isArray(d.lists.feedbackCategories) ||
    !d.lists.feedbackCategories.length ||
    d.lists.feedbackCategories.length > 100 ||
    d.lists.feedbackCategories.some(v => !checkText(v, 120) || !v.trim())
  )
    throw Error('Check the feedback category list.');
  if (
    !Array.isArray(d.projectFeedback) ||
    d.projectFeedback.length > LIMIT ||
    feedbackIds.size !== d.projectFeedback.length
  )
    throw Error('Check the Phase Feedback records.');
  for (const g of d.phaseGates)
    if (
      !checkText(g.owner, 200) ||
      !validDate(g.targetDate) ||
      !checkText(g.skipReason, 500) ||
      typeof g.watched !== 'boolean' ||
      !checkText(g.updatedAt, 50) ||
      (g.status === 'Skipped' && !g.skipReason.trim())
    )
      throw Error('Check the phase-gate owner, date, and skip reason.');
  for (const f of d.projectFeedback) {
    if (
      !checkText(f.id, 100) ||
      !f.id ||
      !projectIds.has(f.projectId) ||
      !d.lists.projectPhases.includes(f.phase) ||
      !checkText(f.companyId, 100) ||
      (f.companyId &&
        (!companyIds.has(f.companyId) ||
          !d.projectCompanies.some(c => c.id === f.companyId && c.projectId === f.projectId))) ||
      !d.lists.feedbackCategories.includes(f.category) ||
      !checkText(f.summary, 500) ||
      !f.summary.trim() ||
      !checkText(f.details) ||
      !checkText(f.raisedBy, 200) ||
      !validDate(f.raisedDate) ||
      !f.raisedDate ||
      !d.lists.departments.includes(f.department) ||
      !checkText(f.owner, 200) ||
      !priorities.includes(f.priority) ||
      !validDate(f.dueDate) ||
      !statuses.includes(f.status) ||
      !checkText(f.resolution) ||
      !checkText(f.gateId, 100) ||
      (f.gateId &&
        (!gateIds.has(f.gateId) ||
          !d.phaseGates.some(g => g.id === f.gateId && g.projectId === f.projectId))) ||
      !checkText(f.carriedFromId, 100) ||
      (f.carriedFromId && !feedbackIds.has(f.carriedFromId)) ||
      !checkText(f.carriedToId, 100) ||
      (f.carriedToId && !feedbackIds.has(f.carriedToId)) ||
      !checkText(f.meetingId, 100) ||
      !checkText(f.meetingTitle, 500) ||
      !checkText(f.referenceLabel, 200) ||
      !checkText(f.referenceUrl, 2000) ||
      typeof f.watched !== 'boolean' ||
      !checkText(f.createdAt, 50) ||
      !checkText(f.updatedAt, 50)
    )
      throw Error('Check the Phase Feedback details.');
    if (
      !Array.isArray(f.ricefwIds) ||
      new Set(f.ricefwIds).size !== f.ricefwIds.length ||
      f.ricefwIds.some(
        id => !specIds.has(id) || !d.specs.some(s => s.id === id && s.projectId === f.projectId)
      )
    )
      throw Error('Check the feedback project-item links.');
    if (
      !Array.isArray(f.links) ||
      f.links.length > 100 ||
      f.links.some(
        x =>
          !x ||
          !types.includes(x.type) ||
          !checkText(x.id, 100) ||
          !checkText(x.label, 500) ||
          !checkText(x.createdAt, 50)
      )
    )
      throw Error('Check the feedback converted-record links.');
    if (
      !Array.isArray(f.history) ||
      f.history.length > 500 ||
      f.history.some(
        x =>
          !x ||
          !validDate(x.date) ||
          !x.date ||
          !/^\d\d:\d\d(?::\d\d)?$/.test(x.time) ||
          !checkText(x.action, 500) ||
          !x.action.trim()
      )
    )
      throw Error('Check the feedback history.');
  }
}

function feedbackCompanyName(f, d = state) {
  return f.companyId
    ? d.projectCompanies.find(c => c.id === f.companyId)?.name || 'Former company'
    : 'Project-wide';
}
function linkedSpecs(f, d = state) {
  return (f.ricefwIds || []).map(id => d.specs.find(s => s.id === id)).filter(Boolean);
}
function projectItemId(s) {
  return String(s?.itemId ?? s?.ricefw ?? '');
}
function projectItemLabel(s) {
  return (
    [s?.itemType || 'RICEFW ID', projectItemId(s)].filter(Boolean).join(' · ') ||
    s?.description ||
    'Project item'
  );
}
function feedbackOpen(f) {
  return !['Resolved', 'Deferred'].includes(f.status);
}
function feedbackOverdue(f, asOf = today()) {
  return feedbackOpen(f) && !!f.dueDate && f.dueDate < asOf;
}
function feedbackAge(f, asOf = today()) {
  return Math.max(
    0,
    Math.floor(
      (Date.parse(asOf + 'T00:00:00Z') - Date.parse(f.raisedDate + 'T00:00:00Z')) / 86400000
    )
  );
}
function feedbackAgeClass(f) {
  return f.carriedFromId
    ? 'carried'
    : feedbackOverdue(f)
      ? 'overdue'
      : f.dueDate && daysUntil(f.dueDate) <= 7
        ? 'due-soon'
        : 'recent';
}
function feedbackHistory(action) {
  return { date: today(), time: timeNow(), action: String(action).slice(0, 500) };
}
function feedbackLinkLabel(f) {
  return linkedSpecs(f).map(projectItemLabel).join(', ');
}
function currentFeedback() {
  return state.projectFeedback.filter(f => f.projectId === state.activeProjectId);
}
function currentGatePhase() {
  const p = activeProject();
  if (!state.lists.projectPhases.includes(gatePhaseFilter)) gatePhaseFilter = p.phase;
  return gatePhaseFilter;
}
function currentFeedbackPhase() {
  const p = activeProject();
  if (!state.lists.projectPhases.includes(feedbackPhase)) feedbackPhase = p.phase;
  return feedbackPhase;
}
function phaseIndex(phase) {
  return state.lists.projectPhases.indexOf(phase);
}
function nextPhase(phase) {
  return state.lists.projectPhases[phaseIndex(phase) + 1] || '';
}
function projectItemFeedback(id, d = state) {
  return (d.projectFeedback || []).filter(f => f.ricefwIds?.includes(id));
}
function projectItemTrace(id, d = state) {
  const feedback = projectItemFeedback(id, d),
    feedbackIds = new Set(feedback.map(f => f.id)),
    gateIds = new Set(feedback.map(f => f.gateId).filter(Boolean)),
    links = feedback.flatMap(f => f.links || []);
  return {
    feedback,
    gates: d.phaseGates.filter(g => gateIds.has(g.id)),
    tasks: d.tasks.filter(t => links.some(x => x.type === 'Task' && x.id === t.id)),
    plans: d.projectPlans.filter(p => links.some(x => x.type === 'Schedule' && x.id === p.id)),
    decisions: d.projectDecisions.filter(x =>
      links.some(l => l.type === 'Decision' && l.id === x.id)
    ),
    feedbackIds,
  };
}
function readinessForPhase(projectId, phase, d = state, companyId = null) {
  const gates = d.phaseGates.filter(
      g =>
        g.projectId === projectId &&
        g.phase === phase &&
        (companyId === null || g.companyId === companyId)
    ),
    feedback = (d.projectFeedback || []).filter(
      f =>
        f.projectId === projectId &&
        f.phase === phase &&
        (companyId === null || f.companyId === companyId)
    ),
    open = feedback.filter(feedbackOpen),
    critical = open.filter(f => ['Critical', 'High'].includes(f.priority)),
    blocked = gates.filter(g => g.status === 'Blocked'),
    pending = gates.filter(g => g.status === 'Pending'),
    resolved = gates.filter(g => ['Completed', 'Skipped'].includes(g.status));
  return {
    gates,
    feedback,
    open,
    critical,
    blocked,
    pending,
    resolved,
    ready: !blocked.length && !pending.length && !critical.length,
    percent: gates.length ? Math.round((resolved.length / gates.length) * 100) : 0,
  };
}

function projectMetrics(id = state.activeProjectId) {
  const items = state.specs.filter(s => s.projectId === id),
    completed = items.filter(s => s.status === 'Completed').length,
    plans = state.projectPlans.filter(p => p.projectId === id),
    companies = state.projectCompanies.filter(c => c.projectId === id),
    mappings = state.projectProcessMappings.filter(x => x.projectId === id),
    gates = state.phaseGates.filter(g => g.projectId === id),
    feedback = (state.projectFeedback || []).filter(f => f.projectId === id);
  return {
    items,
    completed,
    rate: items.length ? completed / items.length : 0,
    plans,
    companies,
    mappings,
    decisions: mappings,
    gates,
    feedback,
    upcoming: plans
      .filter(p => (p.endDate || p.date) >= today() && p.status !== 'Completed')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    overdue: plans.filter(p => (p.endDate || p.date) < today() && p.status !== 'Completed'),
  };
}

function projectHealthDetails(projectId = state.activeProjectId, d = state, asOf = today()) {
  const p = d.projects.find(x => x.id === projectId);
  if (!p)
    return {
      status: 'On track',
      summary: 'No project selected.',
      reasons: [],
      itemPercent: 0,
      phasePercent: 0,
      pendingGates: 0,
      currentGates: 0,
      overdueItems: 0,
    };
  const items = d.specs.filter(s => s.projectId === projectId),
    completed = items.filter(s => s.status === 'Completed').length,
    incomplete = items.filter(s => s.status !== 'Completed'),
    itemPercent = items.length ? Math.round((completed / items.length) * 100) : 0,
    phases = d.lists.projectPhases,
    index = Math.max(0, phases.indexOf(p.phase)),
    phasePercent = Math.round((index / Math.max(1, phases.length - 1)) * 100),
    gates = d.phaseGates.filter(g => g.projectId === projectId && g.phase === p.phase),
    pending = gates.filter(g => g.status === 'Pending'),
    blockedGates = gates.filter(g => g.status === 'Blocked'),
    resolved = gates.filter(g => ['Completed', 'Skipped'].includes(g.status)).length,
    feedback = (d.projectFeedback || []).filter(
      f => f.projectId === projectId && f.phase === p.phase && feedbackOpen(f)
    ),
    criticalFeedback = feedback.filter(f => ['Critical', 'High'].includes(f.priority)),
    overdueFeedback = feedback.filter(f => f.dueDate && f.dueDate < asOf),
    overdue = incomplete.filter(s => s.dueDate && s.dueDate < asOf),
    goLiveDays = p.goLiveDate
      ? Math.round(
          (Date.parse(p.goLiveDate + 'T00:00:00Z') - Date.parse(asOf + 'T00:00:00Z')) / 86400000
        )
      : null,
    unfinished = incomplete.length + pending.length + blockedGates.length + criticalFeedback.length,
    blocked = [],
    risk = [];
  if (overdue.length)
    blocked.push(
      `${overdue.length} incomplete project item${overdue.length === 1 ? ' is' : 's are'} past due.`
    );
  if (blockedGates.length)
    blocked.push(
      `${blockedGates.length} current-phase gate${blockedGates.length === 1 ? ' is' : 's are'} blocked.`
    );
  if (overdueFeedback.length)
    blocked.push(
      `${overdueFeedback.length} open feedback item${overdueFeedback.length === 1 ? ' is' : 's are'} overdue.`
    );
  if (index === phases.length - 1 && unfinished)
    blocked.push('The final project phase still has unresolved work.');
  if (goLiveDays !== null && goLiveDays < 0 && unfinished)
    blocked.push('Go-Live has passed while tracked work remains incomplete.');
  if (pending.length)
    risk.push(
      `${pending.length} current-phase gate${pending.length === 1 ? ' is' : 's are'} pending.`
    );
  if (criticalFeedback.length)
    risk.push(
      `${criticalFeedback.length} high-priority feedback item${criticalFeedback.length === 1 ? ' needs' : 's need'} resolution.`
    );
  if (items.length && itemPercent + 15 < phasePercent)
    risk.push(
      `Item completion (${itemPercent}%) trails phase progress (${phasePercent}%) by more than 15 points.`
    );
  if (goLiveDays !== null && goLiveDays >= 0 && goLiveDays < 15 && unfinished)
    risk.push(
      `Go-Live is within ${goLiveDays === 0 ? 'today' : goLiveDays + ' day' + (goLiveDays === 1 ? '' : 's')} and tracked work remains incomplete.`
    );
  const reasons = blocked.length ? blocked : risk,
    status = blocked.length ? 'Blocked' : risk.length ? 'At risk' : 'On track',
    itemText = items.length ? `${itemPercent}% items complete` : 'No project items yet',
    gateText = gates.length
      ? `${resolved}/${gates.length} current-phase gates resolved`
      : 'No current-phase gates',
    feedbackText = feedback.length ? `${feedback.length} open feedback` : 'No open feedback';
  return {
    status,
    summary: `${itemText} · ${gateText} · ${feedbackText}`,
    reasons,
    itemPercent,
    phasePercent,
    pendingGates: pending.length,
    currentGates: gates.length,
    overdueItems: overdue.length,
    openFeedback: feedback.length,
  };
}

function phaseRail(selected, action) {
  const p = activeProject();
  return `<div class="phase-rail" role="navigation" aria-label="Project phases">${state.lists.projectPhases
    .map((phase, i) => {
      const ready = readinessForPhase(p.id, phase),
        cls = [
          phase === selected ? 'active' : '',
          phase === p.phase ? 'current' : '',
          ready.ready && ready.gates.length ? 'ready' : '',
        ]
          .filter(Boolean)
          .join(' ');
      return `<button class="${cls}" data-action="${action}" data-phase="${esc(phase)}"><span>${i + 1}</span><strong>${esc(phase)}</strong><small>${ready.gates.length ? ready.percent + '% gates' : ready.open.length ? ready.open.length + ' feedback' : 'No records'}</small></button>`;
    })
    .join('')}</div>`;
}

function watchlistPanel() {
  const p = activeProject(),
    feedback = currentFeedback().filter(f => f.watched),
    gates = state.phaseGates.filter(g => g.projectId === p.id && g.watched);
  if (!feedback.length && !gates.length) return '';
  return `<section class="panel box watchlist-panel"><div class="flex-title"><div><span class="eyebrow">My attention</span><h2>Watchlist</h2></div><span>${feedback.length + gates.length} pinned</span></div><div class="watchlist-grid">${gates.map(g => `<button data-action="project-view-gate" data-id="${esc(g.id)}"><span>Gate · ${esc(g.phase)}</span><strong>${esc(g.text)}</strong>${tag(g.status)}</button>`).join('')}${feedback.map(f => `<button data-action="view-feedback" data-id="${esc(f.id)}"><span>Feedback · ${esc(f.phase)}</span><strong>${esc(f.summary)}</strong>${tag(f.status)}</button>`).join('')}</div></section>`;
}

function renderProjectDashboard() {
  const p = activeProject(),
    m = projectMetrics(),
    rate = Math.round(m.rate * 100),
    phaseRate = projectPhasePercent(p),
    health = projectHealthDetails(p.id),
    openFeedback = m.feedback.filter(feedbackOpen).length;
  return `<section class="project-banner"><div><div class="project-kicker">SAP Projects${p.code ? ' · ' + esc(p.code) : ''}</div><h2>${esc(p.name)}</h2><div class="actions" style="margin-top:12px"><select id="dashboardProject" aria-label="Active project">${projectOptions(p.id)}</select><span class="phase-badge">${esc(p.phase)}</span>${goLiveInfo(p)}</div></div><div class="phase-rings"><div class="completion-ring" style="--completion:${rate}%"><div><strong>${rate}%</strong><span>Items complete</span></div></div><div class="completion-ring" style="--completion:${phaseRate}%"><div><strong>${phaseRate}%</strong><span>Project phase</span></div></div></div></section><div class="stats"><div class="stat"><span>Current phase</span><strong style="font-size:1.05rem">${esc(p.phase)}</strong></div><div class="stat calculated-health-stat"><span>Project health · automatic</span>${healthBadge(health)}<small>${esc(health.summary)}</small></div><div class="stat"><span>Open phase gates</span><strong>${m.gates.filter(g => ['Pending', 'Blocked'].includes(g.status)).length}</strong></div><div class="stat"><span>Open phase feedback</span><strong>${openFeedback}</strong></div></div><div class="project-nav"><div class="tabs" aria-label="Project views">${[
    ['overview', 'Overview'],
    ['calendar', 'Timeline calendar'],
    ['items', 'Project items'],
    ['companies', 'Companies & processes'],
    ['gates', 'Phase gates'],
    ['feedback', 'Phase Feedback'],
  ]
    .map(
      ([v, l]) =>
        `<button data-action="project-view" data-view="${v}" class="${projectView === v ? 'active' : ''}"${projectView === v ? ' aria-current="page"' : ''}>${l}</button>`
    )
    .join(
      ''
    )}</div><button class="primary" data-action="new-plan">Plan activity</button></div>${projectView === 'calendar' ? renderProjectCalendar() : projectView === 'items' ? renderProjectSpecs() : projectView === 'companies' ? renderProjectCompanies() : projectView === 'gates' ? renderPhaseGates() : projectView === 'feedback' ? renderPhaseFeedback() : renderProjectOverview(m) + watchlistPanel()}`;
}

function gateDueState(g) {
  return !g.targetDate || ['Completed', 'Skipped'].includes(g.status)
    ? ''
    : g.targetDate < today()
      ? 'overdue'
      : daysUntil(g.targetDate) <= 7
        ? 'due-soon'
        : '';
}
function phaseGateCompanyMatrix(phase, gates) {
  const p = activeProject(),
    companies = state.projectCompanies
      .filter(c => c.projectId === p.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    rows = [{ id: '', name: 'Project-wide' }, ...companies];
  return `<div class="gate-matrix"><div class="flex-title"><div><h3>Company readiness</h3><p class="muted">A phase is ready when it has no pending or blocked gates and no unresolved high-priority feedback.</p></div><button class="small" data-action="phase-closure-review" data-phase="${esc(phase)}">Review phase closure</button></div><div class="readiness-grid">${rows
    .map(c => {
      const r = readinessForPhase(p.id, phase, state, c.id),
        label = r.ready ? 'Ready' : r.blocked.length ? 'Blocked' : 'Needs attention',
        filterValue = c.id || '__project';
      return `<button data-action="gate-company" data-company="${esc(filterValue)}" class="readiness-card ${r.ready ? 'ready' : r.blocked.length ? 'blocked' : 'attention'}${gateCompanyFilter === filterValue ? ' selected' : ''}"><span>${esc(c.name)}</span><strong>${label}</strong><small>${r.resolved.length}/${r.gates.length} gates · ${r.open.length} open feedback</small><div class="progress"><span style="width:${r.percent}%"></span></div></button>`;
    })
    .join('')}</div></div>`;
}

function gateCard(g) {
  const feedback = currentFeedback().filter(f => f.gateId === g.id),
    due = gateDueState(g);
  return `<article class="gate-card ${statusClass(g.status)} ${due}${g.watched ? ' watched' : ''}"><div class="gate-card-head"><label class="check-label"><input type="checkbox" data-gate-toggle="${esc(g.id)}"${g.status === 'Completed' ? ' checked' : ''}${g.status === 'Skipped' ? ' disabled' : ''}><span>${esc(g.text)}</span></label><button class="pin-button${g.watched ? ' active' : ''}" data-action="watch-gate" data-id="${esc(g.id)}" aria-label="${g.watched ? 'Remove from' : 'Add to'} watchlist">★</button></div><div class="gate-card-meta"><span>Company: ${esc(gateCompanyName(g))}</span>${g.owner ? `<span>Owner: ${esc(g.owner)}</span>` : ''}${g.targetDate ? `<span>Target: ${esc(g.targetDate)}${due === 'overdue' ? ' · Overdue' : due === 'due-soon' ? ' · Due soon' : ''}</span>` : ''}</div>${g.status === 'Skipped' ? `<div class="gate-skip-reason"><strong>Skipped:</strong> ${esc(g.skipReason)}</div>` : ''}<div class="gate-card-footer"><div class="actions">${tag(g.status)}${feedback.length ? `<button class="small" data-action="feedback-for-gate" data-id="${esc(g.id)}">${feedback.length} feedback</button>` : ''}</div><div class="actions"><button class="small" data-action="skip-gate" data-id="${esc(g.id)}">${g.status === 'Skipped' ? 'Restore' : 'Skip'}</button><button class="small" data-action="edit-gate" data-id="${esc(g.id)}">Edit</button></div></div></article>`;
}

function renderPhaseGates() {
  const p = activeProject(),
    phase = currentGatePhase(),
    all = state.phaseGates.filter(g => g.projectId === p.id),
    phaseGates = all.filter(g => g.phase === phase),
    companies = state.projectCompanies.filter(c => c.projectId === p.id),
    companyMatch = g =>
      gateCompanyFilter === '' ||
      (gateCompanyFilter === '__project' ? !g.companyId : g.companyId === gateCompanyFilter),
    shown = phaseGates.filter(
      g =>
        companyMatch(g) &&
        (!gateStatusFilter || g.status === gateStatusFilter) &&
        match({ ...g, company: gateCompanyName(g) }, gateQuery)
    ),
    counts = Object.fromEntries(
      GATE_STATUSES.map(s => [s, phaseGates.filter(g => g.status === s).length])
    ),
    groups = [...new Set(shown.map(g => g.companyId || ''))].sort((a, b) =>
      gateCompanyName({ companyId: a }).localeCompare(gateCompanyName({ companyId: b }))
    ),
    ready = readinessForPhase(p.id, phase);
  return `<section class="panel box phase-workspace"><div class="flex-title"><div><span class="eyebrow">Governance &amp; acceptance</span><h2>Phase gates</h2><p class="muted">Track acceptance by phase and company, with ownership, dates, blockers, and explicit skip reasons.</p></div><div class="actions"><button data-action="phase-closure-review" data-phase="${esc(phase)}">Closure review</button><button class="primary" data-action="new-gate">Add phase gate</button></div></div>${phaseRail(phase, 'gate-phase')}<div class="phase-summary-grid">${GATE_STATUSES.map(s => `<button data-action="gate-status" data-status="${esc(s)}" class="phase-summary-card ${statusClass(s)}${gateStatusFilter === s ? ' active' : ''}"><span>${esc(s)}</span><strong>${counts[s]}</strong></button>`).join('')}<div class="phase-summary-card readiness"><span>Phase readiness</span><strong>${ready.ready ? 'Ready' : ready.blocked.length ? 'Blocked' : 'Review'}</strong><small>${ready.percent}% gates resolved</small></div></div>${phaseGateCompanyMatrix(phase, phaseGates)}<div class="phase-toolbar"><label class="sr-only" for="gateSearch">Search phase gates</label><input id="gateSearch" type="search" value="${esc(gateQuery)}" placeholder="Search gate, company, owner or status"><select id="gateCompanyFilter" aria-label="Filter gates by company"><option value="">All companies</option><option value="__project"${gateCompanyFilter === '__project' ? ' selected' : ''}>Project-wide</option>${companies.map(c => `<option value="${esc(c.id)}"${gateCompanyFilter === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>${gateCompanyFilter || gateStatusFilter || gateQuery ? '<button data-action="clear-gate-filters">Clear filters</button>' : ''}</div><div class="gate-company-groups">${
    groups
      .map(id => {
        const rows = shown.filter(g => (g.companyId || '') === id);
        return `<section class="gate-company-group"><div class="gate-company-title"><div><span class="eyebrow">${id ? 'Maintained company' : 'Shared acceptance'}</span><h3>${esc(gateCompanyName({ companyId: id }))}</h3></div><strong>${rows.filter(g => ['Completed', 'Skipped'].includes(g.status)).length}/${rows.length}</strong></div><div class="gate-card-grid">${rows.map(gateCard).join('')}</div></section>`;
      })
      .join('') ||
    '<div class="governance-empty"><strong>No matching gates</strong><p>Add a phase gate or clear the current filters.</p></div>'
  }</div><p class="hint">Permanent deletion remains in Settings → Project management.</p></section>`;
}

function editGate(id = '') {
  const g = id ? state.phaseGates.find(x => x.id === id) : null;
  if (id && !g) throw Error('Phase gate not found.');
  const r = g || {
    phase: currentGatePhase(),
    companyId: gateCompanyFilter && !gateCompanyFilter.startsWith('__') ? gateCompanyFilter : '',
    text: '',
    status: 'Pending',
    owner: '',
    targetDate: '',
    skipReason: '',
    watched: false,
  };
  openModal(
    g ? 'Edit phase gate' : 'Add phase gate',
    `<form id="gateForm" data-id="${esc(id)}"><div class="form-grid"><div><label for="gatePhase">Project phase *</label><select id="gatePhase" name="phase">${selectOptions(state.lists.projectPhases, r.phase, 'Choose phase')}</select></div><div><label for="gateCompany">Company</label><select id="gateCompany" name="companyId">${gateCompanyOptions(state.activeProjectId, r.companyId || '')}</select></div><div><label for="gateStatus">Status</label><select id="gateStatus" name="status">${selectOptions(GATE_STATUSES, r.status)}</select></div><div><label for="gateOwner">Owner</label><input id="gateOwner" name="owner" maxlength="200" value="${esc(r.owner)}" placeholder="Person or role"></div><div><label for="gateTargetDate">Target date</label><input id="gateTargetDate" name="targetDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(r.targetDate)}"></div><label class="check-label"><input type="checkbox" name="watched"${r.watched ? ' checked' : ''}>Pin to My attention</label><div class="wide"><label for="gateText">Gate / acceptance criterion *</label><select id="gateText" name="text" required>${gateOptions(r.phase, r.text)}</select></div><div class="wide" data-skip-reason${r.status === 'Skipped' ? '' : ' hidden'}><label for="gateSkipReason">Reason for skipping *</label><textarea id="gateSkipReason" name="skipReason" maxlength="500">${esc(r.skipReason)}</textarea></div></div><p class="hint">Blocked gates affect Project Health. Skipped gates require a reason and remain visible in reporting.</p><div class="modal-actions"><span></span><div class="actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save gate</button></div></div></form>`
  );
}

function saveGate(form) {
  const field = k => form.elements.namedItem(k),
    id = form.dataset.id || uid(),
    old = state.phaseGates.find(x => x.id === id),
    status = field('status').value,
    companyId = field('companyId')?.value || '',
    skipReason = field('skipReason')?.value.trim() || '',
    g = {
      id,
      projectId: state.activeProjectId,
      companyId,
      phase: field('phase').value,
      text: field('text').value,
      status,
      done: ['Completed', 'Skipped'].includes(status),
      owner: field('owner')?.value.trim() || '',
      targetDate: field('targetDate')?.value || '',
      skipReason: status === 'Skipped' ? skipReason : '',
      watched: field('watched')?.checked || false,
      updatedAt: new Date().toISOString(),
    };
  if (
    companyId &&
    !state.projectCompanies.some(c => c.id === companyId && c.projectId === g.projectId)
  )
    throw Error('Choose a company maintained for this project.');
  if (status === 'Skipped' && !skipReason) throw Error('Enter the reason for skipping this gate.');
  if (
    state.phaseGates.some(
      x =>
        x.id !== id &&
        x.projectId === g.projectId &&
        (x.companyId || '') === g.companyId &&
        x.phase === g.phase &&
        x.text.toLowerCase() === g.text.toLowerCase()
    )
  )
    throw Error('This phase gate already exists for the selected company.');
  const ok = mutate(d => {
    if (old) d.phaseGates = d.phaseGates.map(x => (x.id === id ? g : x));
    else d.phaseGates.push(g);
  });
  gatePhaseFilter = g.phase;
  projectView = 'gates';
  render();
  closeModal();
  if (ok) tell('Phase gate saved.');
}

function skipGatePrompt(id) {
  const g = state.phaseGates.find(x => x.id === id);
  if (!g) throw Error('Phase gate not found.');
  if (g.status === 'Skipped') {
    const ok = mutate(d => {
      const x = d.phaseGates.find(x => x.id === id);
      x.status = 'Pending';
      x.done = false;
      x.skipReason = '';
      x.updatedAt = new Date().toISOString();
    });
    if (ok) tell('Phase gate restored to Pending.');
    return;
  }
  openModal(
    'Skip phase gate',
    `<form id="gateSkipForm" data-id="${esc(id)}"><p><strong>${esc(g.text)}</strong></p><p class="muted">The gate remains in the phase history and report.</p><label for="quickSkipReason">Reason for skipping *</label><textarea id="quickSkipReason" name="skipReason" maxlength="500" required placeholder="Why does this acceptance criterion not apply?"></textarea><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Skip gate</button></div></form>`
  );
}

function saveGateSkip(form) {
  const id = form.dataset.id,
    reason = form.elements.namedItem('skipReason').value.trim();
  if (!reason) throw Error('Enter the skip reason.');
  const ok = mutate(d => {
    const g = d.phaseGates.find(x => x.id === id);
    if (!g) throw Error('Phase gate not found.');
    g.status = 'Skipped';
    g.done = true;
    g.skipReason = reason;
    g.updatedAt = new Date().toISOString();
  });
  closeModal();
  if (ok) tell('Phase gate skipped with its reason recorded.');
}

function feedbackFiltered() {
  const phase = currentFeedbackPhase(),
    companyMatch = f =>
      !feedbackCompany ||
      (feedbackCompany === '__project' ? !f.companyId : f.companyId === feedbackCompany);
  return currentFeedback()
    .filter(
      f =>
        f.phase === phase &&
        companyMatch(f) &&
        (!feedbackStatus || f.status === feedbackStatus) &&
        match(
          { ...f, company: feedbackCompanyName(f), ricefw: feedbackLinkLabel(f) },
          feedbackQuery
        )
    )
    .sort(
      (a, b) =>
        Number(b.watched) - Number(a.watched) ||
        (b.raisedDate + b.updatedAt).localeCompare(a.raisedDate + a.updatedAt)
    );
}
function feedbackCounts() {
  const rows = currentFeedback().filter(f => f.phase === currentFeedbackPhase());
  return {
    open: rows.filter(f => f.status === 'Open').length,
    action: rows.filter(f => f.status === 'Action Required').length,
    overdue: rows.filter(feedbackOverdue).length,
    resolved: rows.filter(f => f.status === 'Resolved').length,
  };
}
function feedbackRicefwBadges(f) {
  const specs = linkedSpecs(f);
  return specs.length
    ? `<div class="ricefw-links">${specs.map(s => `<button data-action="view-item-links" data-id="${esc(s.id)}"><span>${esc(projectItemLabel(s))}</span>${esc(s.description)}</button>`).join('')}</div>`
    : '<span class="hint">No project item linked</span>';
}
function feedbackCard(f) {
  const age = feedbackAge(f),
    ageClass = feedbackAgeClass(f),
    gate = f.gateId ? state.phaseGates.find(g => g.id === f.gateId) : null;
  return `<article class="feedback-card ${statusClass(f.status)} priority-${statusClass(f.priority)} ${ageClass}${f.watched ? ' watched' : ''}"><div class="feedback-card-head"><div><span class="feedback-category">${esc(f.category)}</span><h3>${esc(f.summary)}</h3></div><button class="pin-button${f.watched ? ' active' : ''}" data-action="watch-feedback" data-id="${esc(f.id)}" aria-label="${f.watched ? 'Remove from' : 'Add to'} watchlist">★</button></div><div class="feedback-meta"><span>${esc(feedbackCompanyName(f))}</span><span>${esc(f.priority)} priority</span><span>${age} day${age === 1 ? '' : 's'} open</span>${f.dueDate ? `<span>Due ${esc(f.dueDate)}${feedbackOverdue(f) ? ' · Overdue' : ''}</span>` : ''}</div>${f.details ? `<p class="feedback-details">${esc(f.details)}</p>` : ''}${feedbackRicefwBadges(f)}${gate ? `<button class="linked-gate" data-action="project-view-gate" data-id="${esc(gate.id)}">Gate · ${esc(gate.text)}</button>` : ''}<div class="feedback-card-footer"><select data-feedback-status="${esc(f.id)}" aria-label="Status for ${esc(f.summary)}">${FEEDBACK_STATUSES.map(s => `<option${s === f.status ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select><div class="actions"><button class="small" data-action="view-feedback" data-id="${esc(f.id)}">View</button><button class="small" data-action="convert-feedback" data-id="${esc(f.id)}">Convert to action</button>${nextPhase(f.phase) && feedbackOpen(f) ? `<button class="small" data-action="carry-feedback" data-id="${esc(f.id)}">Carry forward</button>` : ''}<button class="small" data-action="edit-feedback" data-id="${esc(f.id)}">Edit</button></div></div></article>`;
}

function feedbackCompanyHeatmap() {
  const p = activeProject(),
    phases = state.lists.projectPhases,
    companies = [
      { id: '', name: 'Project-wide' },
      ...state.projectCompanies
        .filter(c => c.projectId === p.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    ];
  return `<section class="traceability-matrix"><div class="flex-title"><div><span class="eyebrow">Company × phase</span><h2>Feedback and project-item traceability</h2><p class="muted">Select a cell to open its phase and company records.</p></div></div><div class="scroll"><table><thead><tr><th>Company</th>${phases.map(x => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${companies
    .map(
      c =>
        `<tr><th>${esc(c.name)}</th>${phases
          .map(phase => {
            const rows = currentFeedback().filter(f => f.phase === phase && f.companyId === c.id),
              open = rows.filter(feedbackOpen),
              ricefw = new Set(rows.flatMap(f => f.ricefwIds || [])),
              gates = state.phaseGates.filter(
                g => g.projectId === p.id && g.phase === phase && g.companyId === c.id
              ),
              cls = open.some(f => ['Critical', 'High'].includes(f.priority))
                ? 'blocked'
                : open.length
                  ? 'attention'
                  : rows.length || gates.length
                    ? 'ready'
                    : '';
            return `<td><button class="heatmap-cell ${cls}" data-action="feedback-cell" data-phase="${esc(phase)}" data-company="${esc(c.id)}"><strong>${open.length}</strong><span>open</span><small>${ricefw.size} items · ${gates.length} gates</small></button></td>`;
          })
          .join('')}</tr>`
    )
    .join('')}</tbody></table></div></section>`;
}

function renderPhaseFeedback() {
  const p = activeProject(),
    phase = currentFeedbackPhase(),
    rows = feedbackFiltered(),
    counts = feedbackCounts(),
    companies = state.projectCompanies
      .filter(c => c.projectId === p.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  return `<section class="panel box phase-workspace feedback-workspace"><div class="flex-title"><div><span class="eyebrow">Listen, decide, act</span><h2>Phase Feedback</h2><p class="muted">Capture feedback once, link it to project items, and carry every decision into action.</p></div><div class="actions"><button data-action="meeting-feedback">Meeting capture</button><button data-action="export-phase-pack">Export phase pack</button><button class="primary" data-action="new-feedback">Add feedback</button></div></div>${phaseRail(phase, 'feedback-phase')}<div class="phase-summary-grid feedback-summary"><button data-action="feedback-status-filter" data-status="Open" class="phase-summary-card open${feedbackStatus === 'Open' ? ' active' : ''}"><span>Open</span><strong>${counts.open}</strong></button><button data-action="feedback-status-filter" data-status="Action Required" class="phase-summary-card action-required${feedbackStatus === 'Action Required' ? ' active' : ''}"><span>Action Required</span><strong>${counts.action}</strong></button><button data-action="feedback-overdue" class="phase-summary-card overdue${feedbackOverdueOnly ? ' active' : ''}"><span>Overdue</span><strong>${counts.overdue}</strong></button><button data-action="feedback-status-filter" data-status="Resolved" class="phase-summary-card resolved${feedbackStatus === 'Resolved' ? ' active' : ''}"><span>Resolved</span><strong>${counts.resolved}</strong></button><button data-action="phase-closure-review" data-phase="${esc(phase)}" class="phase-summary-card readiness"><span>Phase readiness</span><strong>${readinessForPhase(p.id, phase).ready ? 'Ready' : 'Review'}</strong></button></div><div class="feedback-toolbar"><div class="schedule-view-switch"><button data-action="feedback-view" data-view="timeline" class="${feedbackView === 'timeline' ? 'active' : ''}">Timeline</button><button data-action="feedback-view" data-view="matrix" class="${feedbackView === 'matrix' ? 'active' : ''}">Traceability matrix</button></div><label class="sr-only" for="feedbackSearch">Search Phase Feedback</label><input id="feedbackSearch" type="search" value="${esc(feedbackQuery)}" placeholder="Search feedback, company, owner or item ID"><select id="feedbackCompanyFilter" aria-label="Filter feedback by company"><option value="">All companies</option><option value="__project"${feedbackCompany === '__project' ? ' selected' : ''}>Project-wide</option>${companies.map(c => `<option value="${esc(c.id)}"${feedbackCompany === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>${feedbackCompany || feedbackStatus || feedbackQuery || feedbackOverdueOnly || feedbackLinkedGateId ? '<button data-action="clear-feedback-filters">Clear filters</button>' : ''}</div>${feedbackView === 'matrix' ? feedbackCompanyHeatmap() : `<div class="feedback-timeline">${rows.map(feedbackCard).join('') || '<div class="governance-empty"><strong>No matching feedback</strong><p>Use Quick Add or Meeting Capture to record the first item for this phase.</p></div>'}</div>`}<div class="footerline">Feedback history records status and ownership changes automatically. Permanent deletion is in Settings → Project management.</div></section>`;
}

function feedbackSpecOptions(projectId, companyId, selected = []) {
  const rows = state.specs
    .filter(
      s =>
        s.projectId === projectId &&
        (!companyId || s.companyId === companyId || selected.includes(s.id))
    )
    .sort((a, b) => projectItemLabel(a).localeCompare(projectItemLabel(b)));
  return rows
    .map(s => {
      const mismatch = companyId && s.companyId !== companyId;
      return `<option value="${esc(s.id)}"${selected.includes(s.id) ? ' selected' : ''}>${mismatch ? '⚠ Different company · ' : ''}${esc(projectItemLabel(s))} · ${esc(s.description.slice(0, 90))}</option>`;
    })
    .join('');
}
function feedbackGateOptions(projectId, phase, companyId, current = '') {
  const rows = state.phaseGates.filter(
    g =>
      g.projectId === projectId &&
      g.phase === phase &&
      (!companyId || !g.companyId || g.companyId === companyId || g.id === current)
  );
  return (
    `<option value="">No linked phase gate</option>` +
    rows
      .map(g => {
        const mismatch = companyId && g.companyId && g.companyId !== companyId;
        return `<option value="${esc(g.id)}"${g.id === current ? ' selected' : ''}>${mismatch ? '⚠ Different company · ' : ''}${esc(gateCompanyName(g))} · ${esc(g.text)}</option>`;
      })
      .join('')
  );
}

function editFeedback(id = '') {
  const f = id ? state.projectFeedback.find(x => x.id === id) : null;
  if (id && !f) throw Error('Feedback not found.');
  const r = f || {
    phase: currentFeedbackPhase(),
    companyId: feedbackCompany && !feedbackCompany.startsWith('__') ? feedbackCompany : '',
    category: 'Observation',
    summary: '',
    details: '',
    raisedBy: '',
    raisedDate: today(),
    department: 'Unassigned',
    owner: '',
    priority: 'Medium',
    dueDate: '',
    status: 'Open',
    resolution: '',
    ricefwIds: [],
    gateId: '',
    referenceLabel: '',
    referenceUrl: '',
    watched: false,
  };
  openModal(
    f ? 'Edit phase feedback' : 'Add phase feedback',
    `<form id="feedbackForm" data-id="${esc(id)}"><div class="quick-feedback"><span class="eyebrow">Quick capture</span><div class="form-grid"><div><label for="feedbackPhase">Phase *</label><select id="feedbackPhase" name="phase" required>${selectOptions(state.lists.projectPhases, r.phase, 'Choose phase')}</select></div><div><label for="feedbackCompany">Company</label><select id="feedbackCompany" name="companyId">${gateCompanyOptions(state.activeProjectId, r.companyId)}</select></div><div><label for="feedbackCategory">Category *</label><select id="feedbackCategory" name="category" required>${selectOptions(state.lists.feedbackCategories, r.category, 'Choose category')}</select></div><div><label for="feedbackStatus">Status *</label><select id="feedbackStatus" name="status" required>${selectOptions(FEEDBACK_STATUSES, r.status, 'Choose status')}</select></div><div class="wide"><label for="feedbackSummary">Feedback summary *</label><input id="feedbackSummary" name="summary" maxlength="500" value="${esc(r.summary)}" required placeholder="What was raised or agreed?"></div><div class="wide"><label for="feedbackRicefw">Related project items</label><select id="feedbackRicefw" name="ricefwIds" multiple size="5">${feedbackSpecOptions(state.activeProjectId, r.companyId, r.ricefwIds)}</select><p class="hint">Hold Ctrl/Cmd to choose several. Items are filtered by the selected company.</p></div></div></div><details class="feedback-advanced"${f ? ' open' : ''}><summary>Owner, dates, resolution &amp; references</summary><div class="form-grid"><div><label for="feedbackRaisedBy">Raised by</label><input id="feedbackRaisedBy" name="raisedBy" maxlength="200" value="${esc(r.raisedBy)}"></div><div><label for="feedbackRaisedDate">Date raised *</label><input id="feedbackRaisedDate" name="raisedDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(r.raisedDate)}" required></div><div><label for="feedbackDepartment">Responsible department</label><select id="feedbackDepartment" name="department">${selectOptions(state.lists.departments, r.department, 'Choose department')}</select></div><div><label for="feedbackOwner">Owner</label><input id="feedbackOwner" name="owner" maxlength="200" value="${esc(r.owner)}"></div><div><label for="feedbackPriority">Priority</label><select id="feedbackPriority" name="priority">${selectOptions(FEEDBACK_PRIORITIES, r.priority, 'Choose priority')}</select></div><div><label for="feedbackDueDate">Target date</label><input id="feedbackDueDate" name="dueDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(r.dueDate)}"></div><div class="wide"><label for="feedbackGate">Related phase gate</label><select id="feedbackGate" name="gateId">${feedbackGateOptions(state.activeProjectId, r.phase, r.companyId, r.gateId)}</select></div><div class="wide"><label for="feedbackDetails">Details</label><textarea id="feedbackDetails" name="details" maxlength="32767">${esc(r.details)}</textarea></div><div class="wide"><label for="feedbackResolution">Resolution / outcome</label><textarea id="feedbackResolution" name="resolution" maxlength="32767">${esc(r.resolution)}</textarea></div><div><label for="feedbackReferenceLabel">Reference label</label><input id="feedbackReferenceLabel" name="referenceLabel" maxlength="200" value="${esc(r.referenceLabel)}"></div><div><label for="feedbackReferenceUrl">Reference link</label><input id="feedbackReferenceUrl" name="referenceUrl" type="url" maxlength="2000" value="${esc(r.referenceUrl)}" placeholder="https://..."></div><label class="check-label"><input type="checkbox" name="watched"${r.watched ? ' checked' : ''}>Pin to My attention</label></div></details><div class="modal-actions"><span class="hint">Similar open records will be flagged before saving.</span><div class="actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save feedback</button></div></div></form>`
  );
}

function feedbackSimilarity(a, b) {
  const words = s =>
      new Set(
        normalizedHeader(s)
          .split(' ')
          .filter(x => x.length > 2)
      ),
    x = words(a),
    y = words(b),
    shared = [...x].filter(w => y.has(w)).length,
    total = new Set([...x, ...y]).size;
  return total ? shared / total : 0;
}
function feedbackChangeSummary(old, next) {
  if (!old) return 'Feedback created.';
  const changes = [];
  for (const [k, label] of [
    ['status', 'Status'],
    ['owner', 'Owner'],
    ['department', 'Department'],
    ['priority', 'Priority'],
    ['dueDate', 'Target date'],
    ['phase', 'Phase'],
    ['companyId', 'Company'],
  ])
    if (old[k] !== next[k]) changes.push(`${label}: ${old[k] || '—'} → ${next[k] || '—'}`);
  if (JSON.stringify(old.ricefwIds || []) !== JSON.stringify(next.ricefwIds || []))
    changes.push('Project-item links updated');
  if (old.summary !== next.summary || old.details !== next.details)
    changes.push('Feedback text updated');
  if (old.resolution !== next.resolution) changes.push('Resolution updated');
  return changes.join(' · ') || 'Feedback reviewed with no field changes.';
}

function saveFeedback(form) {
  const value = k => form.elements.namedItem(k)?.value || '',
    id = form.dataset.id || uid(),
    old = state.projectFeedback.find(x => x.id === id),
    companyId = value('companyId'),
    phase = value('phase'),
    ricefwIds = [...form.elements.namedItem('ricefwIds').selectedOptions].map(o => o.value),
    status = value('status'),
    now = new Date().toISOString(),
    next = {
      id,
      projectId: state.activeProjectId,
      phase,
      companyId,
      category: value('category'),
      summary: value('summary').trim(),
      details: value('details').trim(),
      raisedBy: value('raisedBy').trim(),
      raisedDate: value('raisedDate'),
      department: value('department') || 'Unassigned',
      owner: value('owner').trim(),
      priority: value('priority') || 'Medium',
      dueDate: value('dueDate'),
      status,
      resolution: value('resolution').trim(),
      ricefwIds,
      gateId: value('gateId'),
      carriedFromId: old?.carriedFromId || '',
      carriedToId: old?.carriedToId || '',
      meetingId: old?.meetingId || '',
      meetingTitle: old?.meetingTitle || '',
      referenceLabel: value('referenceLabel').trim(),
      referenceUrl: value('referenceUrl').trim(),
      watched: form.elements.namedItem('watched').checked,
      links: old?.links || [],
      history: [...(old?.history || [])],
      createdAt: old?.createdAt || now,
      updatedAt: now,
    };
  if (!next.summary) throw Error('Enter the feedback summary.');
  if (
    companyId &&
    !state.projectCompanies.some(c => c.id === companyId && c.projectId === next.projectId)
  )
    throw Error('Choose a company maintained for this project.');
  if (ricefwIds.some(sid => !state.specs.some(s => s.id === sid && s.projectId === next.projectId)))
    throw Error('Choose project items belonging to the selected project.');
  if (
    ricefwIds.some(
      sid =>
        companyId &&
        !state.specs.some(s => s.id === sid && s.companyId === companyId) &&
        !old?.ricefwIds?.includes(sid)
    )
  )
    throw Error('New project-item links must belong to the selected company.');
  if (
    next.gateId &&
    !state.phaseGates.some(
      g => g.id === next.gateId && g.projectId === next.projectId && g.phase === phase
    )
  )
    throw Error('Choose a gate from the selected phase.');
  if (next.referenceUrl && !/^https?:\/\//i.test(next.referenceUrl))
    throw Error('Reference links must start with http:// or https://.');
  if (status === 'Resolved' && !next.resolution)
    throw Error('Enter the resolution or outcome before marking feedback Resolved.');
  const similar = state.projectFeedback.find(
    f =>
      f.id !== id &&
      f.projectId === next.projectId &&
      f.phase === phase &&
      f.companyId === companyId &&
      feedbackOpen(f) &&
      feedbackSimilarity(f.summary, next.summary) >= 0.58
  );
  if (
    similar &&
    !confirm(
      `Similar open feedback already exists: “${similar.summary}”. Save this as a separate record anyway?`
    )
  )
    return;
  next.history.push(feedbackHistory(feedbackChangeSummary(old, next)));
  const ok = mutate(d => {
    if (old) d.projectFeedback = d.projectFeedback.map(x => (x.id === id ? next : x));
    else d.projectFeedback.push(next);
  });
  feedbackPhase = phase;
  projectView = 'feedback';
  render();
  closeModal();
  if (ok) tell('Phase Feedback saved with its history and project-item links.');
}

function viewFeedback(id) {
  const f = state.projectFeedback.find(x => x.id === id);
  if (!f) throw Error('Feedback not found.');
  const gate = f.gateId ? state.phaseGates.find(g => g.id === f.gateId) : null;
  openModal(
    'Phase Feedback',
    `<div class="feedback-view-head"><div><span class="feedback-category">${esc(f.category)}</span><h2>${esc(f.summary)}</h2><p class="muted">${esc(f.phase)} · ${esc(feedbackCompanyName(f))}</p></div><div>${tag(f.status)} ${tag(f.priority)}</div></div><div class="view-details"><div><div class="detail-label">Raised by</div><div class="detail-value">${esc(f.raisedBy) || '—'}</div></div><div><div class="detail-label">Date raised</div><div class="detail-value">${dateLabel(f.raisedDate)}</div></div><div><div class="detail-label">Responsible department</div><div class="detail-value">${esc(f.department)}</div></div><div><div class="detail-label">Owner / target</div><div class="detail-value">${esc(f.owner) || '—'}${f.dueDate ? ' · ' + esc(f.dueDate) : ''}</div></div><div class="wide"><div class="detail-label">Details</div><div class="detail-value prewrap">${esc(f.details) || '—'}</div></div><div class="wide"><div class="detail-label">Resolution / outcome</div><div class="detail-value prewrap">${esc(f.resolution) || '—'}</div></div></div><h3 class="section-label">Project-item mapping</h3>${feedbackRicefwBadges(f)}${gate ? `<h3 class="section-label">Linked phase gate</h3><button class="linked-gate" data-action="project-view-gate" data-id="${esc(gate.id)}">${esc(gate.text)} · ${esc(g.status)}</button>` : ''}${f.referenceUrl ? `<h3 class="section-label">Reference</h3><a class="button-link" href="${esc(f.referenceUrl)}" target="_blank" rel="noopener noreferrer">${esc(f.referenceLabel) || 'Open reference'} ↗</a>` : ''}<h3 class="section-label">Converted actions</h3><div class="linked-action-list">${(f.links || []).map(x => `<div><span>${esc(x.type)}</span><strong>${esc(x.label)}</strong><small>${esc(x.createdAt.slice(0, 10))}</small></div>`).join('') || '<p class="muted">No actions created from this feedback yet.</p>'}</div><h3 class="section-label">History</h3><div class="feedback-history">${
      (f.history || [])
        .slice()
        .reverse()
        .map(
          h =>
            `<div><time>${esc(h.date)} ${esc(h.time.slice(0, 5))}</time><span>${esc(h.action)}</span></div>`
        )
        .join('') || '<p class="muted">No history recorded.</p>'
    }</div><div class="modal-actions"><span></span><div class="actions"><button data-action="convert-feedback" data-id="${esc(f.id)}">Convert to action</button><button class="primary" data-action="edit-feedback" data-id="${esc(f.id)}">Edit feedback</button></div></div>`
  );
}

function meetingFeedback() {
  const phase = currentFeedbackPhase(),
    company = feedbackCompany && !feedbackCompany.startsWith('__') ? feedbackCompany : '';
  openModal(
    'Meeting capture',
    `<form id="feedbackMeetingForm"><p class="muted">Enter meeting details once, then add one feedback item per line.</p><div class="form-grid"><div><label for="meetingTitle">Meeting / session *</label><input id="meetingTitle" name="meetingTitle" maxlength="500" required placeholder="e.g. UAT day 2 review"></div><div><label for="meetingDate">Meeting date *</label><input id="meetingDate" name="raisedDate" type="date" value="${today()}" required></div><div><label for="meetingPhase">Phase *</label><select id="meetingPhase" name="phase">${selectOptions(state.lists.projectPhases, phase, 'Choose phase')}</select></div><div><label for="meetingCompany">Company</label><select id="meetingCompany" name="companyId">${gateCompanyOptions(state.activeProjectId, company)}</select></div><div><label for="meetingCategory">Default category</label><select id="meetingCategory" name="category">${selectOptions(state.lists.feedbackCategories, 'Observation', 'Choose category')}</select></div><div><label for="meetingPriority">Default priority</label><select id="meetingPriority" name="priority">${selectOptions(FEEDBACK_PRIORITIES, 'Medium', 'Choose priority')}</select></div><div><label for="meetingRaisedBy">Participants / raised by</label><input id="meetingRaisedBy" name="raisedBy" maxlength="200"></div><div><label for="meetingOwner">Default owner</label><input id="meetingOwner" name="owner" maxlength="200"></div><div><label for="meetingDepartment">Responsible department</label><select id="meetingDepartment" name="department">${selectOptions(state.lists.departments, 'Unassigned', 'Choose department')}</select></div><div><label for="meetingDueDate">Target date</label><input id="meetingDueDate" name="dueDate" type="date" min="1900-01-01" max="9999-12-31"></div><div class="wide"><label for="meetingRows">Feedback items · one per line *</label><textarea id="meetingRows" name="rows" required placeholder="Confirm batch numbering approach\nClarify stock transfer approval\nReview open UAT defect"></textarea></div></div><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Add feedback items</button></div></form>`
  );
}

function saveMeetingFeedback(form) {
  const value = k => form.elements.namedItem(k)?.value || '',
    rows = [
      ...new Set(
        value('rows')
          .split(/\r?\n/)
          .map(x => x.trim())
          .filter(Boolean)
      ),
    ];
  if (!rows.length) throw Error('Enter at least one feedback item.');
  if (state.projectFeedback.length + rows.length > LIMIT)
    throw Error('The feedback section is full.');
  const meetingId = uid(),
    now = new Date().toISOString(),
    records = rows.map(summary => ({
      id: uid(),
      projectId: state.activeProjectId,
      phase: value('phase'),
      companyId: value('companyId'),
      category: value('category'),
      summary,
      details: '',
      raisedBy: value('raisedBy').trim(),
      raisedDate: value('raisedDate'),
      department: value('department') || 'Unassigned',
      owner: value('owner').trim(),
      priority: value('priority') || 'Medium',
      dueDate: value('dueDate'),
      status: 'Open',
      resolution: '',
      ricefwIds: [],
      gateId: '',
      carriedFromId: '',
      carriedToId: '',
      meetingId,
      meetingTitle: value('meetingTitle').trim(),
      referenceLabel: '',
      referenceUrl: '',
      watched: false,
      links: [],
      history: [feedbackHistory(`Captured in meeting: ${value('meetingTitle').trim()}`)],
      createdAt: now,
      updatedAt: now,
    }));
  const ok = mutate(d => d.projectFeedback.push(...records));
  feedbackPhase = value('phase');
  projectView = 'feedback';
  closeModal();
  if (ok) tell(`${records.length} feedback items captured from the meeting.`);
}

let feedbackOverdueOnly = false,
  feedbackLinkedGateId = '';

function carryFeedback(id) {
  const source = state.projectFeedback.find(f => f.id === id),
    phase = source && nextPhase(source.phase);
  if (!source) throw Error('Feedback not found.');
  if (!phase) throw Error('This feedback is already in the final project phase.');
  if (source.carriedToId) throw Error('This feedback has already been carried forward.');
  if (
    !confirm(
      `Carry this feedback from ${source.phase} to ${phase}? The current record will remain in history as Deferred.`
    )
  )
    return;
  const copyId = uid(),
    now = new Date().toISOString(),
    ok = mutate(d => {
      const old = d.projectFeedback.find(f => f.id === id);
      if (!old) throw Error('Feedback not found.');
      old.status = 'Deferred';
      old.carriedToId = copyId;
      old.updatedAt = now;
      old.history.push(feedbackHistory(`Carried forward to ${phase}.`));
      d.projectFeedback.push({
        ...clone(old),
        id: copyId,
        phase,
        status: 'Open',
        resolution: '',
        carriedFromId: id,
        carriedToId: '',
        watched: true,
        links: [],
        history: [feedbackHistory(`Carried forward from ${old.phase}.`)],
        createdAt: now,
        updatedAt: now,
      });
    });
  feedbackPhase = phase;
  feedbackCompany = source.companyId || '__project';
  feedbackStatus = '';
  feedbackOverdueOnly = false;
  projectView = 'feedback';
  render();
  if (ok) tell(`Feedback carried forward to ${phase}.`);
}

function phaseClosureReview(phase = currentFeedbackPhase()) {
  const p = activeProject(),
    r = readinessForPhase(p.id, phase),
    companies = [
      { id: '', name: 'Project-wide' },
      ...state.projectCompanies
        .filter(c => c.projectId === p.id)
        .sort((a, b) => a.name.localeCompare(b.name)),
    ],
    open = r.open
      .slice()
      .sort(
        (a, b) => FEEDBACK_PRIORITIES.indexOf(a.priority) - FEEDBACK_PRIORITIES.indexOf(b.priority)
      ),
    linked = [...new Map(open.flatMap(f => linkedSpecs(f)).map(s => [s.id, s])).values()],
    overdueItems = linked.filter(s => s.status !== 'Completed' && s.dueDate && s.dueDate < today()),
    next = nextPhase(phase),
    canAdvance = r.ready && p.phase === phase && !!next;
  const blockers = [
    ...r.blocked.map(g => `Blocked gate: ${g.text}`),
    ...r.pending.map(g => `Pending gate: ${g.text}`),
    ...r.critical.map(f => `${f.priority} feedback: ${f.summary}`),
  ];
  openModal(
    `${phase} closure review`,
    `<section class="closure-hero ${r.ready ? 'ready' : 'attention'}"><span class="eyebrow">Phase acceptance</span><h2>${r.ready ? 'Ready for closure' : 'Closure needs attention'}</h2><p>${r.ready ? 'All gates are resolved and no high-priority feedback remains.' : 'Resolve or explicitly skip the items below before advancing the project.'}</p><div class="closure-score"><strong>${r.percent}%</strong><span>${r.resolved.length}/${r.gates.length} gates resolved</span></div></section><div class="closure-grid"><div><span>Pending gates</span><strong>${r.pending.length}</strong></div><div><span>Blocked gates</span><strong>${r.blocked.length}</strong></div><div><span>Open feedback</span><strong>${r.open.length}</strong></div><div><span>Overdue linked items</span><strong>${overdueItems.length}</strong></div></div><h3 class="section-label">Company acceptance</h3><div class="closure-company-list">${companies
      .map(c => {
        const x = readinessForPhase(p.id, phase, state, c.id);
        return `<button data-action="closure-company" data-phase="${esc(phase)}" data-company="${esc(c.id || '__project')}"><span><strong>${esc(c.name)}</strong><small>${x.resolved.length}/${x.gates.length} gates · ${x.open.length} open feedback</small></span>${tag(x.ready ? 'Ready' : x.blocked.length ? 'Blocked' : 'Review')}</button>`;
      })
      .join(
        ''
      )}</div><h3 class="section-label">Readiness checks</h3>${blockers.length ? `<div class="closure-blockers">${blockers.map(x => `<div>${esc(x)}</div>`).join('')}</div>` : '<div class="closure-clear">No blocking acceptance items.</div>'}${open.length ? `<details class="closure-open"><summary>${open.length} unresolved feedback item${open.length === 1 ? '' : 's'}</summary>${open.map(f => `<button data-action="view-feedback" data-id="${esc(f.id)}"><span>${esc(f.priority)} · ${esc(feedbackCompanyName(f))}</span><strong>${esc(f.summary)}</strong></button>`).join('')}</details>` : ''}${overdueItems.length ? `<div class="closure-warning"><strong>Overdue project items:</strong> ${overdueItems.map(s => esc(projectItemLabel(s))).join(', ')}</div>` : ''}<div class="modal-actions"><span class="hint">${p.phase !== phase ? 'This is not the project’s current phase.' : !next ? 'This is the final configured phase.' : r.ready ? 'Advancing updates the project phase everywhere.' : 'Advancing is enabled when readiness checks pass.'}</span><div class="actions"><button type="button" data-action="cancel">Close</button>${canAdvance ? `<button class="primary" data-action="advance-phase" data-phase="${esc(phase)}">Close ${esc(phase)} &amp; advance to ${esc(next)}</button>` : ''}</div></div>`
  );
}

function advancePhase(phase) {
  const p = activeProject(),
    next = nextPhase(phase),
    r = readinessForPhase(p.id, phase);
  if (p.phase !== phase || !next) throw Error('The selected phase cannot be advanced.');
  if (!r.ready) throw Error('Resolve pending or blocked gates and high-priority feedback first.');
  const ok = mutate(d => {
    const project = d.projects.find(x => x.id === p.id);
    project.phase = next;
    project.nextMilestone = `Complete ${next} acceptance`;
  });
  gatePhaseFilter = feedbackPhase = next;
  gateCompanyFilter =
    feedbackCompany =
    gateStatusFilter =
    feedbackStatus =
    gateQuery =
    feedbackQuery =
      '';
  feedbackOverdueOnly = false;
  closeModal();
  render();
  if (ok) tell(`Project advanced to ${next}.`);
}

function feedbackConvertForm(id) {
  const f = state.projectFeedback.find(x => x.id === id);
  if (!f) throw Error('Feedback not found.');
  const location = state.lists.workLocations[0] || '',
    activity = state.lists.projectActivities[0] || '';
  openModal(
    'Convert feedback to action',
    `<form id="feedbackConvertForm" data-id="${esc(id)}"><div class="conversion-source"><span>${esc(f.phase)} · ${esc(feedbackCompanyName(f))}</span><strong>${esc(f.summary)}</strong></div><div class="form-grid"><div class="wide"><label for="conversionType">Create *</label><select id="conversionType" name="type">${FEEDBACK_LINK_TYPES.map(x => `<option>${esc(x)}</option>`).join('')}</select></div><div class="wide"><label for="conversionTitle">Title / description *</label><input id="conversionTitle" name="title" maxlength="500" required value="${esc(f.summary)}"></div><div><label for="conversionDue">Target date</label><input id="conversionDue" name="dueDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(f.dueDate)}"></div><div><label for="conversionOwner">Owner</label><input id="conversionOwner" name="owner" maxlength="200" value="${esc(f.owner)}"></div><div data-conversion-fields="Project Item" hidden><label for="conversionItemType">Item type *</label><select id="conversionItemType" name="itemType" required>${selectOptions(state.lists.projectItemTypes, state.lists.projectItemTypes[0] || 'RICEFW ID', 'Choose item type')}</select></div><div data-conversion-fields="Project Item" hidden><label for="conversionItemId">Item ID</label><input id="conversionItemId" name="itemId" maxlength="200" placeholder="Enter the item reference"></div><div data-conversion-fields="Project Item" hidden><label for="conversionExpected">Expected date</label><input id="conversionExpected" name="expectedDate" type="date" min="1900-01-01" max="9999-12-31" value="${today()}"></div><div data-conversion-fields="Schedule" hidden><label for="conversionDate">Schedule date *</label><input id="conversionDate" name="date" type="date" min="1900-01-01" max="9999-12-31" value="${esc(f.dueDate || today())}"></div><div data-conversion-fields="Schedule" hidden><label for="conversionEndDate">End date *</label><input id="conversionEndDate" name="endDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(f.dueDate || today())}"></div>${bookingTimeFields('09:00', '10:00', true)}<div data-conversion-fields="Schedule" hidden><label for="conversionActivity">Project activity</label><select id="conversionActivity" name="activity">${selectOptions(state.lists.projectActivities, activity, 'Choose activity')}</select></div><div data-conversion-fields="Schedule" hidden><label for="conversionLocation">Work location</label><select id="conversionLocation" name="location">${selectOptions(state.lists.workLocations, location, 'Choose location')}</select></div><div data-conversion-fields="Phase Gate" hidden><label for="conversionGateStatus">Gate status</label><select id="conversionGateStatus" name="gateStatus">${selectOptions(GATE_STATUSES, 'Pending')}</select></div><div data-conversion-fields="Decision" hidden><label for="conversionDecisionStatus">Decision status</label><select id="conversionDecisionStatus" name="decisionStatus">${selectOptions(['Proposed', 'Approved', 'Superseded'], 'Proposed')}</select></div><div class="wide"><label for="conversionNotes">Notes</label><textarea id="conversionNotes" name="notes" maxlength="32767">${esc(f.details)}</textarea></div></div><p class="hint">The new record stays linked to this feedback and appears in project-item traceability.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Create linked action</button></div></form>`
  );
  updateConversionFields($('conversionType'));
}

function updateConversionFields(select) {
  for (const el of select.form.querySelectorAll('[data-conversion-fields]'))
    el.hidden = el.dataset.conversionFields !== select.value;
}

function saveFeedbackConversion(form) {
  const f = state.projectFeedback.find(x => x.id === form.dataset.id);
  if (!f) throw Error('Feedback not found.');
  const value = k => form.elements.namedItem(k)?.value || '',
    type = value('type'),
    title = value('title').trim(),
    notes = value('notes').trim(),
    dueDate = value('dueDate'),
    owner = value('owner').trim(),
    id = uid(),
    createdAt = new Date().toISOString();
  if (!FEEDBACK_LINK_TYPES.includes(type) || !title)
    throw Error('Choose an action type and enter its title.');
  let label = title;
  const ok = mutate(d => {
    const feedback = d.projectFeedback.find(x => x.id === f.id);
    if (!feedback) throw Error('Feedback not found.');
    if (type === 'Task') {
      const number = String(Math.max(0, ...d.tasks.map(t => +t.number || 0)) + 1);
      d.tasks.push({
        id,
        number,
        task: title,
        priority: f.priority,
        dueDate,
        done: false,
        doneDate: '',
        remarks: notes,
        feedback: `Created from Phase Feedback: ${f.summary}`,
        archived: false,
        archivedAt: '',
        taskType: 'Project',
        linkId: f.projectId,
        customLink: '',
        subTasks: [],
      });
      label = `Task ${number}: ${title}`;
    } else if (type === 'Project Item') {
      const itemType = value('itemType'),
        itemId = value('itemId').trim(),
        expectedDate = value('expectedDate');
      if (!d.lists.projectItemTypes.includes(itemType))
        throw Error('Choose a valid project item type.');
      if (
        itemId &&
        d.specs.some(
          s =>
            s.projectId === f.projectId &&
            (s.itemType || 'RICEFW ID') === itemType &&
            projectItemId(s).trim().toLowerCase() === itemId.toLowerCase()
        )
      )
        throw Error('That item ID already exists for this type in the project.');
      d.specs.push({
        id,
        itemType,
        itemId,
        ricefw: itemId,
        description: title,
        status: 'Not yet Started',
        priority: { Critical: 'A', High: 'A', Medium: 'B', Low: 'C' }[f.priority] || 'B',
        expectedDate,
        dueDate,
        remarks: notes,
        reference: f.referenceLabel,
        url: f.referenceUrl,
        projectId: f.projectId,
        companyId: f.companyId,
        subItems: [],
      });
      feedback.ricefwIds = [...new Set([...feedback.ricefwIds, id])];
      label = `${[itemType, itemId].filter(Boolean).join(' · ')}: ${title}`;
    } else if (type === 'Schedule') {
      const date = value('date'),
        endDate = value('endDate') || date,
        time = value('time'),
        endTime = value('endTime'),
        activity = value('activity'),
        location = value('location'),
        dates = rangeDates(date, endDate),
        times = rangeTimes(time, endTime),
        daySet = new Set(dates),
        timeSet = new Set(times);
      if (!d.lists.workLocations.includes(location)) throw Error('Choose a valid work location.');
      if (bookingOverlaps(d.schedule, dates, time, endTime))
        throw Error('This range overlaps an existing activity. Choose an empty range.');
      d.projectPlans.push({
        id,
        projectId: f.projectId,
        title,
        activity,
        text: notes,
        date,
        endDate,
        time,
        endTime,
        location,
        status: 'Planned',
        source: 'Projects',
        actualTask: '',
        actualSame: null,
        actualReviewedAt: '',
      });
      for (const day of dates)
        for (const hour of times)
          d.schedule.push({
            date: day,
            time: hour,
            endTime: segmentEnd(hour, endTime),
            text: notes,
            kind: 'project',
            linkId: f.projectId,
            activity,
            location,
            bookingId: id,
            planId: id,
          });
      d.calendarMonth = date.slice(0, 7);
      label = `${date} ${time}–${endTime}: ${title}`;
    } else if (type === 'Phase Gate') {
      const status = value('gateStatus') || 'Pending',
        skipReason = status === 'Skipped' ? 'Created as skipped from Phase Feedback.' : '';
      if (
        d.phaseGates.some(
          g =>
            g.projectId === f.projectId &&
            (g.companyId || '') === f.companyId &&
            g.phase === f.phase &&
            g.text.toLowerCase() === title.toLowerCase()
        )
      )
        throw Error('That phase gate already exists for this company.');
      d.phaseGates.push({
        id,
        projectId: f.projectId,
        companyId: f.companyId,
        phase: f.phase,
        text: title,
        status,
        done: ['Completed', 'Skipped'].includes(status),
        owner,
        targetDate: dueDate,
        skipReason,
        watched: true,
        updatedAt: createdAt,
      });
      feedback.gateId = id;
      label = `${f.phase} gate: ${title}`;
    } else {
      const status = value('decisionStatus') || 'Proposed';
      d.projectDecisions.push({
        id,
        projectId: f.projectId,
        companyId: f.companyId,
        category: f.category.slice(0, 100),
        decision: [title, notes].filter(Boolean).join('\n\n'),
        owner,
        date: today(),
        status,
      });
      label = `${status} decision: ${title}`;
    }
    feedback.links.push({ type, id, label: label.slice(0, 500), createdAt });
    feedback.history.push(feedbackHistory(`Converted to ${type}: ${label}`));
    feedback.updatedAt = createdAt;
  });
  closeModal();
  render();
  if (ok) tell(`${type} created and linked to Phase Feedback.`);
}

function viewItemLinks(id) {
  const item = state.specs.find(s => s.id === id);
  if (!item) throw Error('Project item not found.');
  const trace = projectItemTrace(id),
    mismatches = trace.feedback.filter(f => f.companyId && f.companyId !== item.companyId),
    sections = [
      [
        'Phase Feedback',
        trace.feedback.map(
          f =>
            `<button data-action="view-feedback" data-id="${esc(f.id)}"><span>${esc(f.phase)} · ${esc(feedbackCompanyName(f))}</span><strong>${esc(f.summary)}</strong>${tag(f.status)}</button>`
        ),
      ],
      [
        'Phase gates',
        trace.gates.map(
          g =>
            `<button data-action="project-view-gate" data-id="${esc(g.id)}"><span>${esc(g.phase)} · ${esc(gateCompanyName(g))}</span><strong>${esc(g.text)}</strong>${tag(g.status)}</button>`
        ),
      ],
      [
        'Created tasks',
        trace.tasks.map(
          t =>
            `<div><span>${esc(t.number)}</span><strong>${esc(t.task)}</strong>${tag(t.done ? 'Completed' : 'Open')}</div>`
        ),
      ],
      [
        'Schedule actions',
        trace.plans.map(
          p =>
            `<button data-action="view-plan" data-id="${esc(p.id)}"><span>${esc(p.date)} · ${esc(p.time)}–${esc(p.endTime)}</span><strong>${esc(p.title)}</strong>${tag(p.status)}</button>`
        ),
      ],
      [
        'Decisions',
        trace.decisions.map(
          x =>
            `<div><span>${esc(x.date)} · ${esc(x.category)}</span><strong>${esc(x.decision)}</strong>${tag(x.status)}</div>`
        ),
      ],
    ];
  openModal(
    `Project item traceability · ${projectItemLabel(item)}`,
    `<div class="trace-hero"><span class="eyebrow">End-to-end mapping</span><h2>${esc(item.description)}</h2><p>${esc(state.projectCompanies.find(c => c.id === item.companyId)?.name || 'Unassigned')} · Due ${dateLabel(item.dueDate)}</p></div>${mismatches.length ? `<div class="trace-warning"><strong>Company mapping needs review.</strong> ${mismatches.length} linked feedback record${mismatches.length === 1 ? ' uses' : 's use'} a different company. Links were preserved so nothing is lost.</div>` : ''}${projectItemFeedbackSections(item)}<div class="trace-sections">${sections.map(([name, rows]) => `<section><div><h3>${name}</h3><span>${rows.length}</span></div><div class="trace-records">${rows.join('') || '<p class="muted">No linked records.</p>'}</div></section>`).join('')}</div><div class="modal-actions"><span class="hint">Mappings are created from Phase Feedback and converted actions.</span><button type="button" data-action="cancel">Close</button></div>`
  );
}

function managerFeedbackRows(rows) {
  return rows
    .map(
      f =>
        `<div class="project-manager-row feedback-manager-row"><div><strong>${esc(f.phase)} · ${esc(feedbackCompanyName(f))}</strong><div class="hint">${esc(f.summary)} · ${esc(f.priority)} · ${esc(f.status)}</div></div><div class="actions"><button class="small" data-action="view-feedback" data-id="${esc(f.id)}">View</button><button class="small danger" data-action="delete-feedback" data-id="${esc(f.id)}">Delete feedback</button></div></div>`
    )
    .join('');
}

function openProjectManagement() {
  const p = activeProject(),
    companies = state.projectCompanies
      .filter(c => c.projectId === p.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    mappings = state.projectProcessMappings.filter(m => m.projectId === p.id),
    gates = state.phaseGates
      .filter(g => g.projectId === p.id)
      .sort((a, b) => (a.phase + a.text).localeCompare(b.phase + b.text)),
    feedback = currentFeedback()
      .slice()
      .sort((a, b) => (a.phase + a.summary).localeCompare(b.phase + b.summary));
  openModal(
    'Project management',
    `<div class="flex-title"><div><p class="muted" style="margin:0">Manage projects and keep every destructive governance control in one protected workspace.</p></div><button class="primary" data-action="new-project" data-return="manager">Add project</button></div><h3 class="section-label">Projects</h3><div class="project-manager-list">${managerProjectRows()}</div><div class="manager-divider"><div><h3>Company &amp; proposal controls</h3><p class="muted">Active project: ${esc(p.name)}. Expand a company to review import versions, upload a revision, or remove records.</p></div></div><div class="manager-company-list">${managerCompanyRows(companies, mappings) || '<div class="governance-empty"><strong>No companies in the active project</strong><p>Use Companies &amp; processes to upload the first Excel mapping.</p></div>'}</div><div class="manager-divider"><div><h3>Phase-gate controls</h3><p class="muted">Edit or skip gates in Phase Gates. Permanent deletion is available only here.</p></div></div><div class="project-manager-list gate-manager-list">${managerGateRows(gates) || '<div class="governance-empty"><strong>No phase gates in the active project</strong><p>Add a gate from the Phase Gates tab.</p></div>'}</div><div class="manager-divider"><div><h3>Phase Feedback controls</h3><p class="muted">Feedback stays visible in normal workflows. Permanent deletion is isolated here.</p></div></div><div class="project-manager-list feedback-manager-list">${managerFeedbackRows(feedback) || '<div class="governance-empty"><strong>No Phase Feedback in the active project</strong><p>Add feedback from the project workspace.</p></div>'}</div>`
  );
}

function deleteProject(id) {
  const p = state.projects.find(x => x.id === id);
  if (!p) throw Error('Project not found.');
  const items = state.specs.filter(s => s.projectId === id).length,
    plans = state.projectPlans.filter(s => s.projectId === id).length,
    companies = state.projectCompanies.filter(c => c.projectId === id).length,
    feedback = state.projectFeedback.filter(f => f.projectId === id).length;
  if (
    !confirm(
      `Delete project "${p.name}"? This removes ${items} project items, ${plans} planned activities, ${companies} companies, all gates, mappings, and ${feedback} feedback records. Linked tasks will be kept as Custom tasks. Download a backup first if needed.`
    )
  )
    return;
  const ok = mutate(d => {
    d.projects = d.projects.filter(x => x.id !== id);
    d.specs = d.specs.filter(s => s.projectId !== id);
    const planIds = new Set(d.projectPlans.filter(x => x.projectId === id).map(x => x.id));
    d.projectPlans = d.projectPlans.filter(x => x.projectId !== id);
    d.schedule = d.schedule.filter(
      s => !(s.kind === 'project' && s.linkId === id) && !planIds.has(s.planId)
    );
    d.projectCompanies = d.projectCompanies.filter(c => c.projectId !== id);
    d.projectDecisions = d.projectDecisions.filter(x => x.projectId !== id);
    d.projectProcessMappings = d.projectProcessMappings.filter(x => x.projectId !== id);
    d.phaseGates = d.phaseGates.filter(x => x.projectId !== id);
    d.projectFeedback = d.projectFeedback.filter(x => x.projectId !== id);
    for (const t of d.tasks)
      if (t.taskType === 'Project' && t.linkId === id) {
        t.taskType = 'Custom';
        t.customLink = 'Former project: ' + p.name;
        t.linkId = '';
      }
    if (!d.projects.length)
      d.projects.push({
        id: uid(),
        name: 'SAP Projects',
        code: '',
        phase: d.lists.projectPhases[0],
        goLiveDate: '',
        health: 'On track',
        nextMilestone: '',
      });
    if (d.activeProjectId === id) d.activeProjectId = d.projects[0].id;
  });
  selectedCodeProject = state.activeProjectId;
  specQuery = specFilter = '';
  openProjectManagement();
  if (ok)
    tell('Project and its governance records deleted; linked tasks were preserved as Custom.');
}

function exportPhasePack() {
  const p = activeProject(),
    phase = currentFeedbackPhase(),
    pack = clone(state),
    taskIds = new Set(
      state.projectFeedback
        .filter(f => f.projectId === p.id && f.phase === phase)
        .flatMap(f => (f.links || []).filter(x => x.type === 'Task').map(x => x.id))
    );
  pack.projects = pack.projects.filter(x => x.id === p.id);
  pack.activeProjectId = p.id;
  pack.specs = pack.specs.filter(x => x.projectId === p.id);
  pack.projectCompanies = pack.projectCompanies.filter(x => x.projectId === p.id);
  pack.projectProcessMappings = pack.projectProcessMappings.filter(x => x.projectId === p.id);
  pack.projectDecisions = pack.projectDecisions.filter(x => x.projectId === p.id);
  pack.phaseGates = pack.phaseGates.filter(x => x.projectId === p.id && x.phase === phase);
  pack.projectFeedback = pack.projectFeedback.filter(
    x => x.projectId === p.id && x.phase === phase
  );
  const keptFeedback = new Set(pack.projectFeedback.map(x => x.id));
  for (const f of pack.projectFeedback) {
    if (!keptFeedback.has(f.carriedFromId)) f.carriedFromId = '';
    if (!keptFeedback.has(f.carriedToId)) f.carriedToId = '';
  }
  pack.projectPlans = pack.projectPlans.filter(x => x.projectId === p.id);
  pack.tasks = pack.tasks.filter(
    t => (t.taskType === 'Project' && t.linkId === p.id) || taskIds.has(t.id)
  );
  const keptTasks = new Set(pack.tasks.map(t => t.id)),
    keptPlans = new Set(pack.projectPlans.map(x => x.id));
  pack.schedule = pack.schedule.filter(
    s => keptPlans.has(s.planId) || (s.kind === 'task' && keptTasks.has(s.linkId))
  );
  pack.tickets = [];
  pack.trackers = [];
  const filename =
    `${p.name}-${phase}-Phase-Pack-${today()}`.replace(/[^a-z0-9._-]+/gi, '-') + '.xlsx';
  download(
    exportReport(pack),
    filename,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  tell(`${phase} phase pack downloaded with gates, feedback, project items, and linked actions.`);
}

function workhubAction(b) {
  const a = b.dataset.action,
    id = b.dataset.id;
  if (a === 'item-status') {
    specFilter = b.dataset.status || '';
    render();
    return true;
  }
  if (a === 'schedule-layout') {
    scheduleLayout = b.dataset.layout === 'grid' ? 'grid' : 'calendar';
    render();
    return true;
  }
  if (a === 'schedule-day') {
    scheduleDay = b.dataset.date;
    render();
    return true;
  }
  if (a === 'schedule-add-day') {
    openRangeEditor(scheduleDay || today(), '09:00', '', true);
    return true;
  }
  if (a === 'schedule-month') {
    const days = monthDates(month),
      d = new Date(days[0] + 'T12:00:00');
    d.setMonth(d.getMonth() + Number(b.dataset.step));
    if (d.getFullYear() < 1900 || d.getFullYear() > 9999) return true;
    month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    scheduleDay = '';
    render();
    return true;
  }
  if (a === 'gate-phase') {
    gatePhaseFilter = b.dataset.phase;
    gateStatusFilter = '';
    render();
    return true;
  }
  if (a === 'gate-company') {
    gateCompanyFilter = gateCompanyFilter === b.dataset.company ? '' : b.dataset.company;
    render();
    return true;
  }
  if (a === 'gate-status') {
    gateStatusFilter = gateStatusFilter === b.dataset.status ? '' : b.dataset.status;
    render();
    return true;
  }
  if (a === 'clear-gate-filters') {
    gateCompanyFilter = gateStatusFilter = gateQuery = '';
    render();
    return true;
  }
  if (a === 'new-gate' || a === 'edit-gate') {
    editGate(a === 'edit-gate' ? id : '');
    return true;
  }
  if (a === 'skip-gate') {
    skipGatePrompt(id);
    return true;
  }
  if (a === 'watch-gate') {
    const ok = mutate(d => {
      const g = d.phaseGates.find(x => x.id === id);
      if (!g) throw Error('Phase gate not found.');
      g.watched = !g.watched;
      g.updatedAt = new Date().toISOString();
    });
    if (ok) tell('Gate watchlist updated.');
    return true;
  }
  if (a === 'project-view-gate') {
    const g = state.phaseGates.find(x => x.id === id);
    if (!g) throw Error('Phase gate not found.');
    if ($('modal').open) closeModal();
    projectView = 'gates';
    gatePhaseFilter = g.phase;
    gateCompanyFilter = g.companyId || '__project';
    gateStatusFilter = '';
    gateQuery = g.text;
    tab = 'specs';
    render();
    return true;
  }
  if (a === 'feedback-phase') {
    feedbackPhase = b.dataset.phase;
    feedbackStatus = feedbackQuery = '';
    feedbackOverdueOnly = false;
    feedbackLinkedGateId = '';
    render();
    return true;
  }
  if (a === 'feedback-view') {
    feedbackView = b.dataset.view === 'matrix' ? 'matrix' : 'timeline';
    render();
    return true;
  }
  if (a === 'feedback-status-filter') {
    feedbackStatus = feedbackStatus === b.dataset.status ? '' : b.dataset.status;
    feedbackOverdueOnly = false;
    feedbackLinkedGateId = '';
    render();
    return true;
  }
  if (a === 'feedback-overdue') {
    feedbackOverdueOnly = !feedbackOverdueOnly;
    feedbackStatus = '';
    render();
    return true;
  }
  if (a === 'clear-feedback-filters') {
    feedbackCompany = feedbackStatus = feedbackQuery = '';
    feedbackOverdueOnly = false;
    feedbackLinkedGateId = '';
    render();
    return true;
  }
  if (a === 'feedback-cell') {
    feedbackPhase = b.dataset.phase;
    feedbackCompany = b.dataset.company || '__project';
    feedbackStatus = feedbackQuery = '';
    feedbackOverdueOnly = false;
    feedbackView = 'timeline';
    render();
    return true;
  }
  if (a === 'new-feedback' || a === 'edit-feedback') {
    editFeedback(a === 'edit-feedback' ? id : '');
    return true;
  }
  if (a === 'view-feedback') {
    viewFeedback(id);
    return true;
  }
  if (a === 'meeting-feedback') {
    meetingFeedback();
    return true;
  }
  if (a === 'carry-feedback') {
    carryFeedback(id);
    return true;
  }
  if (a === 'convert-feedback') {
    feedbackConvertForm(id);
    return true;
  }
  if (a === 'watch-feedback') {
    const ok = mutate(d => {
      const f = d.projectFeedback.find(x => x.id === id);
      if (!f) throw Error('Feedback not found.');
      f.watched = !f.watched;
      f.updatedAt = new Date().toISOString();
      f.history.push(
        feedbackHistory(f.watched ? 'Added to My attention.' : 'Removed from My attention.')
      );
    });
    if (ok) tell('Feedback watchlist updated.');
    return true;
  }
  if (a === 'feedback-for-gate') {
    const g = state.phaseGates.find(x => x.id === id);
    if (!g) throw Error('Phase gate not found.');
    projectView = 'feedback';
    feedbackPhase = g.phase;
    feedbackCompany = g.companyId || '__project';
    feedbackStatus = feedbackQuery = '';
    feedbackLinkedGateId = id;
    feedbackOverdueOnly = false;
    render();
    return true;
  }
  if (a === 'view-item-links') {
    viewItemLinks(id);
    return true;
  }
  if (a === 'phase-closure-review') {
    phaseClosureReview(b.dataset.phase);
    return true;
  }
  if (a === 'closure-company') {
    if ($('modal').open) closeModal();
    projectView = 'gates';
    gatePhaseFilter = b.dataset.phase;
    gateCompanyFilter = b.dataset.company;
    gateStatusFilter = gateQuery = '';
    render();
    return true;
  }
  if (a === 'advance-phase') {
    advancePhase(b.dataset.phase);
    return true;
  }
  if (a === 'export-phase-pack') {
    exportPhasePack();
    return true;
  }
  if (a === 'delete-feedback') {
    const f = state.projectFeedback.find(x => x.id === id);
    if (
      f &&
      confirm(`Permanently delete feedback "${f.summary}"? Converted actions will remain.`)
    ) {
      const ok = mutate(d => {
        d.projectFeedback = d.projectFeedback.filter(x => x.id !== id);
        for (const x of d.projectFeedback) {
          if (x.carriedFromId === id) x.carriedFromId = '';
          if (x.carriedToId === id) x.carriedToId = '';
        }
      });
      openProjectManagement();
      if (ok) tell('Phase Feedback record deleted.');
    }
    return true;
  }
  if (a === 'delete-gate') {
    const g = state.phaseGates.find(x => x.id === id);
    if (
      g &&
      confirm('Permanently delete this phase gate? Linked feedback will remain and be unlinked.')
    ) {
      const ok = mutate(d => {
        d.phaseGates = d.phaseGates.filter(x => x.id !== id);
        for (const f of d.projectFeedback)
          if (f.gateId === id) {
            f.gateId = '';
            f.history.push(feedbackHistory('Linked phase gate was deleted in Project management.'));
          }
      });
      openProjectManagement();
      if (ok) tell('Phase gate deleted; linked feedback was preserved.');
    }
    return true;
  }
  if (a === 'delete-company') {
    const c = state.projectCompanies.find(x => x.id === id);
    if (
      c &&
      confirm(
        `Delete company "${c.name}", its process mappings, and its project-item links? Gates and feedback will be kept as project-wide records.`
      )
    ) {
      const ok = mutate(d => {
        d.projectCompanies = d.projectCompanies.filter(x => x.id !== id);
        d.projectDecisions = d.projectDecisions.filter(x => x.companyId !== id);
        d.projectProcessMappings = d.projectProcessMappings.filter(x => x.companyId !== id);
        for (const s of d.specs) if (s.companyId === id) s.companyId = '';
        for (const g of d.phaseGates) if (g.companyId === id) g.companyId = '';
        for (const f of d.projectFeedback)
          if (f.companyId === id) {
            f.companyId = '';
            f.history.push(
              feedbackHistory(`Company ${c.name} was deleted; feedback changed to project-wide.`)
            );
          }
      });
      governanceCompanyId = '';
      openProjectManagement();
      if (ok) tell('Company deleted; its gates and feedback are now project-wide.');
    }
    return true;
  }
  if (a === 'delete' && b.dataset.group === 'specs') {
    const item = state.specs.find(x => x.id === id);
    if (
      item &&
      confirm(
        'Delete this project item? Phase Feedback will remain, with this project-item link removed.'
      )
    ) {
      const ok = mutate(d => {
        d.specs = d.specs.filter(x => x.id !== id);
        for (const f of d.projectFeedback)
          if (f.ricefwIds.includes(id)) {
            f.ricefwIds = f.ricefwIds.filter(x => x !== id);
            f.history.push(
              feedbackHistory(
                `Project-item link removed because ${projectItemLabel(item)} was deleted.`
              )
            );
          }
      });
      closeModal();
      if (ok) tell('Project item deleted; linked feedback was preserved.');
    }
    return true;
  }
  return false;
}

function workhubChange(el) {
  const id = el.id;
  if (id === 'itemCompany') {
    itemCompanyId = el.value;
    render();
    return true;
  }
  if (id === 'gateCompanyFilter') {
    gateCompanyFilter = el.value;
    render();
    return true;
  }
  if (id === 'feedbackCompanyFilter') {
    feedbackCompany = el.value;
    render();
    return true;
  }
  if (id === 'dashboardProject') {
    specQuery = specFilter = gateQuery = feedbackQuery = '';
    gateCompanyFilter = gateStatusFilter = feedbackCompany = feedbackStatus = '';
    feedbackOverdueOnly = false;
    feedbackLinkedGateId = '';
    gatePhaseFilter = feedbackPhase = '';
    mutate(d => (d.activeProjectId = el.value));
    return true;
  }
  if (id === 'gateStatus') {
    const box = el.form.querySelector('[data-skip-reason]');
    if (box) box.hidden = el.value !== 'Skipped';
    return true;
  }
  if (el.dataset.gateToggle) {
    const ok = mutate(d => {
      const g = d.phaseGates.find(x => x.id === el.dataset.gateToggle);
      if (!g) throw Error('Phase gate not found.');
      g.status = el.checked ? 'Completed' : 'Pending';
      g.done = el.checked;
      g.skipReason = '';
      g.updatedAt = new Date().toISOString();
    });
    if (ok) tell('Phase gate updated.');
    return true;
  }
  if (el.dataset.feedbackStatus) {
    const f = state.projectFeedback.find(x => x.id === el.dataset.feedbackStatus);
    if (!f) throw Error('Feedback not found.');
    if (el.value === 'Resolved' && !f.resolution) {
      editFeedback(f.id);
      $('feedbackStatus').value = 'Resolved';
      $('feedbackStatus').closest('form').querySelector('details').open = true;
      tell('Add the resolution or outcome before resolving this feedback.', true);
      return true;
    }
    const previous = f.status,
      ok = mutate(d => {
        const x = d.projectFeedback.find(x => x.id === f.id);
        x.status = el.value;
        x.updatedAt = new Date().toISOString();
        x.history.push(feedbackHistory(`Status: ${previous} → ${el.value}`));
      });
    if (ok) tell('Feedback status and history updated.');
    return true;
  }
  if (id === 'feedbackCompany' || id === 'feedbackPhase') {
    const form = el.form,
      company = form.elements.namedItem('companyId').value,
      phase = form.elements.namedItem('phase').value,
      ricefw = form.elements.namedItem('ricefwIds'),
      gate = form.elements.namedItem('gateId'),
      selected = [...ricefw.selectedOptions].map(o => o.value),
      gateId = gate.value;
    ricefw.innerHTML = feedbackSpecOptions(state.activeProjectId, company, selected);
    gate.innerHTML = feedbackGateOptions(state.activeProjectId, phase, company, gateId);
    return true;
  }
  if (id === 'conversionType') {
    updateConversionFields(el);
    return true;
  }
  if (id === 'conversionDate') {
    const end = el.form.elements.namedItem('endDate');
    end.min = el.value;
    if (!end.value || end.value < el.value) end.value = el.value;
    return true;
  }
  return false;
}

const feedbackFilteredV8 = feedbackFiltered;
feedbackFiltered = function () {
  return feedbackFilteredV8().filter(
    f =>
      (!feedbackOverdueOnly || feedbackOverdue(f)) &&
      (!feedbackLinkedGateId || f.gateId === feedbackLinkedGateId)
  );
};

document.addEventListener('input', e => {
  const id = e.target.id;
  if (id === 'gateSearch') {
    gateQuery = e.target.value;
    rerenderKeepFocus(id);
  } else if (id === 'feedbackSearch') {
    feedbackQuery = e.target.value;
    rerenderKeepFocus(id);
  }
});
document.addEventListener('submit', e => {
  if (
    !['feedbackForm', 'feedbackMeetingForm', 'feedbackConvertForm', 'gateSkipForm'].includes(
      e.target.id
    )
  )
    return;
  e.preventDefault();
  try {
    if (e.target.id === 'feedbackForm') saveFeedback(e.target);
    else if (e.target.id === 'feedbackMeetingForm') saveMeetingFeedback(e.target);
    else if (e.target.id === 'feedbackConvertForm') saveFeedbackConversion(e.target);
    else saveGateSkip(e.target);
  } catch (err) {
    tell(err.message, true);
  }
});

// Version 9: manual company/process maintenance, project-item sub-items, and synchronized Go-Live milestones.
// =============================================================================
// 5. Project sub-items, tasks and precise Schedule times
// =============================================================================
const SUBITEM_STATUSES = ['Not started', 'In Progress', 'Blocked', 'Completed'];

function normalizeGoLiveDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const candidate = /^\d{4}-\d{2}-\d{2}/.test(raw) ? raw.slice(0, 10) : raw;
  return validDate(candidate) ? candidate : '';
}

/** Fill missing fields for older documents. Upgrade helpers must preserve IDs, notes and existing values. */
function upgradeFeatures(d) {
  d = upgradeFeaturesV8(d);
  const statuses = ['Not started', 'In Progress', 'Blocked', 'Completed'];
  for (const item of d.specs || []) {
    if (!Array.isArray(item.subItems)) item.subItems = [];
    const used = new Set();
    item.subItems = item.subItems
      .map((sub, index) => {
        sub = sub && typeof sub === 'object' ? sub : {};
        let id = String(sub.id || `sub-${item.id}-${index + 1}`).slice(0, 100);
        while (used.has(id)) id = (id + '-' + (index + 1)).slice(0, 100);
        used.add(id);
        const status = statuses.includes(sub.status) ? sub.status : 'Not started';
        return {
          id,
          title: String(sub.title || sub.name || '').slice(0, 500),
          status,
          remarks: String(sub.remarks || '').slice(0, 32767),
          feedback: sub.feedback === undefined ? '' : sub.feedback,
          owner: String(sub.owner || '').slice(0, 200),
          dueDate: validDate(String(sub.dueDate || '')) ? String(sub.dueDate || '') : '',
          createdAt: String(sub.createdAt || '').slice(0, 50),
          updatedAt: String(sub.updatedAt || '').slice(0, 50),
        };
      })
      .filter(sub => sub.title.trim());
  }
  for (const project of d.projects || []) {
    project.goLiveDate = normalizeGoLiveDate(project.goLiveDate);
    if (project.goLiveUpdatedAt === undefined) project.goLiveUpdatedAt = '';
  }
  return WorkHubStudio.upgrade(upgradePreciseRecords(d));
}

/** Validate feature records after the base document checks; upgrades are not a substitute for validation. */
function validateFeatures(d) {
  validateFeaturesV8(d);
  let total = 0;
  const ids = new Set();
  for (const item of d.specs) {
    const subItems = Array.isArray(item.subItems) ? item.subItems : [];
    if (subItems.length > 500) throw Error('Each project item supports up to 500 sub-items.');
    total += subItems.length;
    for (const sub of subItems) {
      if (
        !sub ||
        !checkText(sub.id, 100) ||
        !sub.id ||
        ids.has(sub.id) ||
        !checkText(sub.title, 500) ||
        !sub.title.trim() ||
        !SUBITEM_STATUSES.includes(sub.status) ||
        !checkText(sub.remarks) ||
        !checkText(sub.feedback) ||
        !checkText(sub.owner, 200) ||
        !validDate(sub.dueDate) ||
        !checkText(sub.createdAt, 50) ||
        !checkText(sub.updatedAt, 50)
      )
        throw Error('Check the project sub-item details.');
      ids.add(sub.id);
    }
  }
  if (total > LIMIT) throw Error('Project items support up to 5,000 sub-items in total.');
  validatePreciseRecords(d);
  WorkHubStudio.validate(d);
  for (const project of d.projects)
    if (!checkText(project.goLiveUpdatedAt || '', 50))
      throw Error('Check the Go-Live update timestamp.');
}

function editProcess(id = '') {
  const companies = state.projectCompanies
    .filter(c => c.projectId === state.activeProjectId)
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!companies.length)
    throw Error('Upload a company first, then you can add its processes manually.');
  const old = id ? state.projectProcessMappings.find(m => m.id === id) : null;
  if (id && !old) throw Error('Process mapping not found.');
  const areas = visibleMMAreas().map(area => area.name);
  if (old && !areas.includes(old.area)) areas.unshift(old.area);
  if (!areas.length)
    throw Error('Show at least one SAP MM area in Manage areas before adding a process.');
  const companyId = old?.companyId || governanceCompanyId || companies[0].id,
    area = old?.area || (areas.includes(governanceArea) ? governanceArea : areas[0]);
  const row = old || {
    companyId,
    area,
    item: '',
    code: '',
    description: '',
    department: 'Unassigned',
    decision: 'Pending review',
  };
  openModal(
    old ? 'Edit process' : 'Add process manually',
    `<form id="processForm" data-id="${esc(id)}"><div class="manual-entry-hero"><span class="eyebrow">No spreadsheet required</span><strong>${old ? 'Update this process mapping' : 'Create one process for a maintained company'}</strong><p>The record uses the same company, department, decision and reporting structure as an Excel import.</p></div><div class="form-grid"><div><label for="processCompany">Company *</label><select id="processCompany" name="companyId" required>${companies.map(c => `<option value="${esc(c.id)}"${c.id === row.companyId ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div><div><label for="processArea">SAP MM area *</label><select id="processArea" name="area" required>${areas.map(v => `<option${v === row.area ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div><div><label for="processCode">Code / Process ID</label><input id="processCode" name="code" maxlength="200" value="${esc(row.code)}" placeholder="e.g. IM-001"></div><div class="wide"><label for="processItem">Item / BPML process *</label><input id="processItem" name="item" maxlength="500" value="${esc(row.item)}" required placeholder="e.g. Physical Inventory Process"></div><div class="wide"><label for="processDescription">Description</label><textarea id="processDescription" name="description" maxlength="32767">${esc(row.description)}</textarea></div><div><label for="processDepartment">Responsible department *</label><select id="processDepartment" name="department" required>${state.lists.departments.map(v => `<option${v === row.department ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div><div><label for="processDecision">Decision *</label><select id="processDecision" name="decision" required>${MAPPING_DECISIONS.map(v => `<option${v === row.decision ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div></div><p class="hint">Manual records can be edited here. Permanent deletion remains in Settings → Project management.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">${old ? 'Save process changes' : 'Add process'}</button></div></form>`
  );
}

function saveProcess(form) {
  const value = k => form.elements.namedItem(k)?.value || '',
    id = form.dataset.id || uid(),
    old = state.projectProcessMappings.find(m => m.id === id),
    companyId = value('companyId'),
    area = value('area'),
    item = value('item').trim(),
    code = value('code').trim(),
    department = value('department'),
    decision = value('decision');
  if (
    !state.projectCompanies.some(c => c.id === companyId && c.projectId === state.activeProjectId)
  )
    throw Error('Choose a company maintained for the active project.');
  if (
    !mmAreaNames().includes(area) ||
    !state.lists.departments.includes(department) ||
    !MAPPING_DECISIONS.includes(decision)
  )
    throw Error('Choose valid process values.');
  if (!item) throw Error('Enter the item or BPML process.');
  const codeKey = normalizedHeader(code),
    itemKey = normalizedHeader(item),
    duplicate = state.projectProcessMappings.some(
      m =>
        m.id !== id &&
        m.companyId === companyId &&
        m.area === area &&
        ((codeKey && normalizedHeader(m.code) === codeKey) || normalizedHeader(m.item) === itemKey)
    );
  if (duplicate) throw Error('That process ID or item already exists for this company and area.');
  const now = new Date().toISOString(),
    record = {
      id,
      projectId: state.activeProjectId,
      companyId,
      area,
      item,
      code,
      description: value('description').trim(),
      department,
      decision,
      sourceFile: old?.sourceFile || 'Manual entry',
      sourceSheet: old?.sourceSheet || '',
      sourceRow: old?.sourceRow || 0,
      proposalVersion: old ? (old.proposalVersion || 1) + 1 : 1,
      importedAt: now,
    };
  const ok = mutate(d => {
    if (old)
      d.projectProcessMappings = d.projectProcessMappings.map(m => (m.id === id ? record : m));
    else {
      if (d.projectProcessMappings.length >= LIMIT)
        throw Error('The process mapping section is full.');
      d.projectProcessMappings.push(record);
    }
  });
  governanceCompanyId = companyId;
  governanceArea = area;
  governanceQuery = '';
  projectView = 'companies';
  closeModal();
  render();
  if (ok) tell(old ? 'Process updated.' : 'Process added without an Excel upload.');
}

function editCompany(id = '') {
  const old = id ? state.projectCompanies.find(c => c.id === id) : null;
  if (id && !old) throw Error('Company not found.');
  const row = old || { name: '', role: '' };
  openModal(
    old ? 'Edit project company' : 'Add company manually',
    `<form id="companyForm" data-id="${esc(id)}"><div class="manual-entry-hero"><span class="eyebrow">Quick company setup</span><strong>${old ? 'Update the company name or role' : 'Create a company without an Excel upload'}</strong><p>After saving, this company becomes available in Schedule, processes, project items, phase gates and Phase Feedback.</p></div><div class="form-grid"><div class="wide"><label for="companyName">Company *</label><input id="companyName" name="name" maxlength="200" value="${esc(row.name)}" required placeholder="e.g. Farms"></div><div class="wide"><label for="companyRole">Company role</label><input id="companyRole" name="role" maxlength="500" value="${esc(row.role)}" placeholder="e.g. Farm operations"></div></div><p class="hint">Add processes after saving the company. Permanent deletion remains in Settings → Project management.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">${old ? 'Save company changes' : 'Add company'}</button></div></form>`
  );
}

function saveCompany(form) {
  const value = k => form.elements.namedItem(k)?.value || '',
    id = form.dataset.id || uid(),
    old = state.projectCompanies.find(c => c.id === id),
    name = value('name').trim(),
    role = value('role').trim(),
    nameKey = normalizedHeader(name);
  if (!name) throw Error('Enter the company name.');
  if (
    state.projectCompanies.some(
      c =>
        c.id !== id && c.projectId === state.activeProjectId && normalizedHeader(c.name) === nameKey
    )
  )
    throw Error('That company already exists in this project.');
  const record = {
    ...(old || {}),
    id,
    projectId: state.activeProjectId,
    name,
    role,
    organizationStructure: old?.organizationStructure || '',
    procurement: old?.procurement || '',
    inventoryManagement: old?.inventoryManagement || '',
    masterData: old?.masterData || '',
    valuation: old?.valuation || '',
    invoiceVerification: old?.invoiceVerification || '',
    entryMethod: old?.entryMethod || 'Manual entry',
  };
  const ok = mutate(d => {
    if (old) d.projectCompanies = d.projectCompanies.map(c => (c.id === id ? record : c));
    else {
      if (d.projectCompanies.length >= LIMIT) throw Error('The project company section is full.');
      d.projectCompanies.push(record);
    }
  });
  governanceCompanyId = id;
  governanceQuery = '';
  projectView = 'companies';
  closeModal();
  render();
  if (ok)
    tell(old ? 'Company updated.' : 'Company added. Choose an area to add its first process.');
}

function renderMappingArea(company, area, rows) {
  const shown = filteredMappingRows(rows);
  return `<section class="governance-detail"><div class="governance-detail-head process-detail-head"><div><span class="eyebrow">${esc(company.name)}</span><h3>${esc(area)}</h3><p class="muted">${shown.length} of ${rows.length} mapped items for this company</p></div><button class="primary" data-action="new-process" data-company="${esc(company.id)}" data-area="${esc(area)}">+ Add process</button><label class="sr-only" for="governanceSearch">Search ${esc(area)}</label><input id="governanceSearch" type="search" value="${esc(governanceQuery)}" placeholder="Search this area: process, code, department or decision"></div>${shown.length ? `<div class="process-card-grid">${shown.map(m => `<article class="process-card"><div class="process-card-head"><div><span class="process-code">${esc(m.code) || 'No process ID'}</span><h4>${esc(m.item)}</h4></div>${tag(m.decision)}</div><p>${esc(m.description) || 'No description supplied.'}</p><div class="process-source"><span class="${m.sourceFile === 'Manual entry' ? 'manual' : ''}">${m.sourceFile === 'Manual entry' ? 'Manual entry' : 'Excel import'}</span><small>v${m.proposalVersion || 1}</small></div><div class="process-fields"><div><label>Responsible department</label>${mappingSelect(state.lists.departments, m.department, 'data-mapping-department', m.id)}</div><div><label>Decision</label>${mappingSelect(MAPPING_DECISIONS, m.decision, 'data-mapping-decision', m.id)}</div></div><div class="process-card-actions"><button class="small" data-action="edit-process" data-id="${esc(m.id)}">Edit process</button></div></article>`).join('')}</div>` : `<div class="governance-empty"><strong>${rows.length ? 'No matching information' : 'No information in this area yet'}</strong><p>${rows.length ? 'Try a different search.' : 'Use the Add process button above or upload an Excel mapping.'}</p></div>`}</section>`;
}

function renderProjectCompanies() {
  const p = activeProject(),
    companies = state.projectCompanies
      .filter(c => c.projectId === p.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    mappings = state.projectProcessMappings.filter(m => m.projectId === p.id),
    areas = visibleMMAreas();
  if (!companies.some(c => c.id === governanceCompanyId))
    governanceCompanyId = companies[0]?.id || '';
  if (!areas.some(area => area.name === governanceArea)) governanceArea = areas[0]?.name || '';
  const company = companies.find(c => c.id === governanceCompanyId),
    rows = mappings.filter(m => m.companyId === company?.id),
    hiddenCount = projectMMAreas().filter(area => !area.visible).length;
  return `<section class="panel box governance-shell"><div class="flex-title"><div><span class="eyebrow">Flexible process capture</span><h2>Companies &amp; processes</h2><p class="muted">Add companies individually or use Excel for bulk mapping.</p></div><div class="actions"><button data-action="manage-mm-areas">Manage SAP MM areas</button><a class="button-link" href="./company-process-template.xlsx" download>Download Excel template</a><button data-action="import-governance">Upload Excel</button><button class="primary" data-action="new-company">+ Add company</button></div></div><div class="capture-choice"><div><strong>Company setup</strong><span>Add one company manually or use Excel for a bulk setup.</span></div><div><strong>Process maintenance</strong><span>Select a company and area, then add individual processes.</span></div></div>${
    company
      ? `<div class="governance-browser"><aside class="governance-picker"><label for="governanceCompany">Company</label><select id="governanceCompany">${companies.map(c => `<option value="${esc(c.id)}"${c.id === company.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select><div class="company-focus"><span>Company role</span><strong>${esc(company.role) || 'Not supplied'}</strong><small>${rows.length} mapped item${rows.length === 1 ? '' : 's'}</small><button class="small" data-action="edit-company" data-id="${esc(company.id)}">Edit company</button></div><nav class="area-picker" aria-label="Company information areas">${areas
          .map(({ name }) => {
            const count = rows.filter(m => m.area === name).length;
            return `<button type="button" data-action="governance-area" data-area="${esc(name)}" class="${name === governanceArea ? 'active' : ''}"${name === governanceArea ? ' aria-current="page"' : ''}><span>${esc(name)}</span><strong>${count}</strong></button>`;
          })
          .join(
            ''
          )}</nav><button class="small mm-area-manage" data-action="manage-mm-areas">Manage areas${hiddenCount ? ' · ' + hiddenCount + ' hidden' : ''}</button><p class="hint">Area settings apply to all companies in this project. Hidden areas keep their records.</p></aside>${
          governanceArea
            ? renderMappingArea(
                company,
                governanceArea,
                rows.filter(m => m.area === governanceArea)
              )
            : '<section class="governance-detail"><div class="governance-empty"><strong>All SAP MM areas are hidden</strong><p>Choose Manage areas to show an area again. All process records are preserved.</p><button data-action="manage-mm-areas">Manage areas</button></div></section>'
        }</div>`
      : '<div class="governance-empty"><strong>No project companies yet</strong><p>Use Add company above for a quick setup, or upload Excel to create companies and process mappings together. You can manage the SAP MM areas before adding a company.</p></div>'
  }</section>`;
}

function subItemMetrics(item) {
  const rows = item.subItems || [],
    completed = rows.filter(s => s.status === 'Completed').length,
    blocked = rows.filter(s => s.status === 'Blocked').length,
    overdue = rows.filter(s => s.status !== 'Completed' && s.dueDate && s.dueDate < today()).length;
  return {
    rows,
    completed,
    blocked,
    overdue,
    percent: rows.length ? Math.round((completed / rows.length) * 100) : 0,
  };
}

function subItemTrackedTime(itemId, subItemId = '') {
  const sessions = (state.workhub?.sessions || []).filter(
      s => s.itemId === itemId && (!subItemId || s.subItemId === subItemId)
    ),
    seconds = sessions.reduce((n, s) => n + s.seconds, 0);
  return `<span class="subitem-time-summary"><strong>${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m</strong> tracked · ${sessions.length} session${sessions.length === 1 ? '' : 's'}</span>`;
}
function subItemTimerButton(item, sub) {
  return `<button type="button" class="small" data-hub="timer-new" data-kind="project" data-id="${esc(item.projectId)}" data-item="${esc(item.id)}" data-subitem="${esc(sub.id)}" aria-label="Track time for ${esc(sub.title)}">◷ Track time</button>`;
}
function renderSubItemSummary(item) {
  const m = subItemMetrics(item);
  if (!m.rows.length)
    return `<div class="subitem-empty"><span>No sub-items yet</span><button class="small" data-action="manage-subitems" data-id="${esc(item.id)}">Add sub-item</button></div>`;
  return `<div class="subitem-summary"><div class="subitem-summary-head"><div><span>Sub-item progress</span><strong>${m.completed}/${m.rows.length} complete</strong></div><strong>${m.percent}%</strong></div><div class="progress"><span style="width:${m.percent}%"></span></div><div class="subitem-chips">${m.rows
    .slice(0, 3)
    .map(s => `<span class="subitem-chip status-${statusClass(s.status)}">${esc(s.title)}</span>`)
    .join(
      ''
    )}${m.rows.length > 3 ? `<span class="subitem-chip more">+${m.rows.length - 3} more</span>` : ''}</div>${m.blocked || m.overdue ? `<small>${m.blocked ? m.blocked + ' blocked' : ''}${m.blocked && m.overdue ? ' · ' : ''}${m.overdue ? m.overdue + ' overdue' : ''}</small>` : ''}<button class="small" data-action="manage-subitems" data-id="${esc(item.id)}">Manage sub-items</button></div>`;
}

function projectItemFeedbackPanel(item, sub = null) {
  const record = sub || item;
  return `<section class="item-feedback${sub ? ' item-feedback-sub' : ''}" data-feedback-item="${esc(item.id)}" data-feedback-sub="${esc(sub?.id || '')}"><div class="item-feedback-heading"><h5 class="hub-sensitive">${sub ? 'Sub-item feedback · ' + esc(sub.title) : 'Main item feedback'}</h5><button type="button" class="small" data-hub="item-feedback" data-id="${esc(item.id)}"${sub ? ` data-sub="${esc(sub.id)}"` : ''}>Add feedback</button></div><p class="prewrap hub-sensitive"${record.feedback ? ' tabindex="0"' : ''}>${esc(record.feedback) || 'No feedback yet.'}</p></section>`;
}
function projectItemFeedbackSections(item) {
  return (
    projectItemFeedbackPanel(item) +
    (item.subItems || [])
      .filter(sub => sub.feedback)
      .map(sub => projectItemFeedbackPanel(item, sub))
      .join('')
  );
}
function renderProjectSpecs() {
  const project = activeProject(),
    all = activeSpecs().filter(r => !hub?.batchA || hub.batchA.matches('specs', r.id)),
    companies = state.projectCompanies
      .filter(c => c.projectId === project?.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
    companyName = id => companies.find(c => c.id === id)?.name || 'Unassigned',
    scoped = scopedProjectItems(),
    rs = scoped.filter(
      r =>
        match(
          {
            ...r,
            company: companyName(r.companyId),
            subItems: (r.subItems || [])
              .map(s => `${s.title} ${s.status} ${s.owner} ${s.remarks} ${s.feedback}`)
              .join(' '),
          },
          specQuery
        ) &&
        (!specFilter || r.status === specFilter)
    ),
    completed = scoped.filter(r => r.status === 'Completed').length,
    overdue = scoped.filter(
      r => r.status !== 'Completed' && r.dueDate && r.dueDate < today()
    ).length,
    statuses = [...new Set([...OPTIONS.specStatus, ...scoped.map(r => r.status)])],
    subTotal = scoped.reduce((n, r) => n + (r.subItems?.length || 0), 0),
    subDone = scoped.reduce(
      (n, r) => n + (r.subItems || []).filter(s => s.status === 'Completed').length,
      0
    );
  return `<section class="panel box governance-shell"><div class="flex-title"><div><span class="eyebrow">${esc(project?.name || 'SAP Projects')}</span><h2>Project items</h2><p class="muted">Parent deliverables, company ownership and trackable sub-items in one board.</p></div><button class="primary" data-action="new" data-group="specs">Add project item</button></div><div class="item-board-summary"><div><span>Project items</span><strong>${all.length}</strong></div><div><span>Sub-items</span><strong>${subTotal}</strong></div><div><span>Sub-items completed</span><strong>${subDone}</strong></div></div><div class="governance-browser"><aside class="governance-picker"><label for="itemCompany">Company</label><select id="itemCompany"><option value="">All companies</option>${companies.map(c => `<option value="${esc(c.id)}"${itemCompanyId === c.id ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="unassigned"${itemCompanyId === 'unassigned' ? ' selected' : ''}>Unassigned items</option></select><div class="company-focus"><span>Delivery progress</span><strong>${completed} of ${scoped.length} completed</strong><div class="progress"><span style="width:${scoped.length ? (completed / scoped.length) * 100 : 0}%"></span></div><small>${overdue} overdue · ${all.length} items in this project</small></div><nav class="area-picker" aria-label="Project item statuses">${['', ...statuses].map(s => `<button data-action="item-status" data-status="${esc(s)}" class="${specFilter === s ? 'active' : ''}"><span>${esc(s) || 'All statuses'}</span><strong>${s ? scoped.filter(r => r.status === s).length : scoped.length}</strong></button>`).join('')}</nav></aside><section class="governance-detail"><div class="governance-detail-head"><span class="eyebrow">${esc(itemCompanyId ? (itemCompanyId === 'unassigned' ? 'Unassigned items' : companyName(itemCompanyId)) : 'All companies')}</span><h3>${esc(specFilter) || 'Delivery board'}</h3><p class="muted">${rs.length} of ${scoped.length} items shown</p><label class="sr-only" for="specSearch">Search project items</label><input id="specSearch" type="search" value="${esc(specQuery)}" placeholder="Search item, company, sub-item, owner or status"></div>${
    rs.length
      ? `<div class="process-card-grid item-trace-grid">${rs
          .map(r => {
            const trace = projectItemTrace(r.id),
              linked =
                trace.feedback.length +
                trace.tasks.length +
                trace.plans.length +
                trace.decisions.length,
              mismatch = trace.feedback.some(f => f.companyId && f.companyId !== r.companyId);
            return `<article class="process-card item-card${r.status !== 'Completed' && r.dueDate && r.dueDate < today() ? ' item-overdue' : ''}${mismatch ? ' trace-mismatch' : ''}"><div class="process-card-head"><div><button class="process-code trace-code" data-action="view-item-links" data-id="${esc(r.id)}">${esc(projectItemLabel(r))}</button><h4>${esc(r.description) || 'Untitled item'}</h4></div>${tag(r.status)}</div><div class="item-meta"><span>${esc(companyName(r.companyId))}</span><span>Priority ${esc(r.priority) || '—'}</span></div><dl class="item-dates"><div><dt>Expected date</dt><dd>${dateLabel(r.expectedDate)}</dd></div><div><dt>Due date</dt><dd>${dateLabel(r.dueDate)}${r.status !== 'Completed' && r.dueDate && r.dueDate < today() ? '<small>Overdue</small>' : ''}</dd></div></dl>${r.remarks ? `<p class="item-remarks">${esc(r.remarks)}</p>` : ''}${projectItemFeedbackSections(r)}${subItemTrackedTime(r.id)}${renderSubItemSummary(r)}${mismatch ? '<div class="trace-inline-warning">Company link needs review</div>' : ''}<div class="trace-strip"><button data-action="view-item-links" data-id="${esc(r.id)}"><strong>${trace.feedback.length}</strong><span>phase feedback</span></button><button data-action="view-item-links" data-id="${esc(r.id)}"><strong>${linked}</strong><span>linked actions</span></button></div><div class="item-card-footer"><span>${r.url && /^https?:\/\//i.test(r.url) ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.reference) || 'Open reference'} ↗</a>` : esc(r.reference) || 'No reference'}</span><div class="actions"><button class="small" data-action="manage-subitems" data-id="${esc(r.id)}">Sub-items</button><button class="small" data-action="view-item-links" data-id="${esc(r.id)}">Traceability</button><button class="small" data-action="edit" data-group="specs" data-id="${esc(r.id)}">Edit item</button></div></div></article>`;
          })
          .join('')}</div>`
      : '<div class="governance-empty"><strong>No matching project items</strong><p>Choose another company or status, clear the search, or add a project item.</p></div>'
  }</section></div></section>`;
}

function openSubItems(parentId) {
  const item = state.specs.find(s => s.id === parentId);
  if (!item) throw Error('Project item not found.');
  const m = subItemMetrics(item);
  openModal(
    `Sub-items · ${projectItemLabel(item)}`,
    `<div class="subitem-hero"><div><span class="eyebrow">${esc(item.description)}</span><h2>${m.completed} of ${m.rows.length} completed</h2><p>${m.blocked} blocked · ${m.overdue} overdue</p></div><div class="subitem-ring" style="--completion:${m.percent}%"><strong>${m.percent}%</strong></div></div><div class="subitem-manager-list">${m.rows.map(sub => `<div class="subitem-manager-row${sub.status === 'Blocked' ? ' blocked' : ''}${sub.status !== 'Completed' && sub.dueDate && sub.dueDate < today() ? ' overdue' : ''}"><div><strong>${esc(sub.title)}</strong><small>${sub.owner ? `Owner: ${esc(sub.owner)}` : 'No owner'}${sub.dueDate ? ` · Due ${esc(sub.dueDate)}` : ''}</small>${sub.remarks ? `<p class="prewrap">${esc(sub.remarks)}</p>` : ''}${projectItemFeedbackPanel(item, sub)}${subItemTrackedTime(item.id, sub.id)}</div><select data-subitem-status="${esc(parentId)}" data-subitem-id="${esc(sub.id)}" aria-label="Status for ${esc(sub.title)}">${SUBITEM_STATUSES.map(v => `<option${v === sub.status ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select><div class="actions subitem-work-actions">${subItemTimerButton(item, sub)}<button class="small" data-action="edit-subitem" data-parent="${esc(parentId)}" data-id="${esc(sub.id)}">Edit</button><button class="small danger" data-action="delete-subitem" data-parent="${esc(parentId)}" data-id="${esc(sub.id)}">Delete</button></div></div>`).join('') || '<div class="governance-empty"><strong>No sub-items yet</strong><p>Break this deliverable into smaller trackable actions.</p></div>'}</div><div class="modal-actions"><button type="button" data-action="cancel">Close</button><button class="primary" data-action="new-subitem" data-parent="${esc(parentId)}">+ Add sub-item</button></div>`
  );
}

function editSubItem(parentId, id = '') {
  const item = state.specs.find(s => s.id === parentId);
  if (!item) throw Error('Project item not found.');
  const old = id ? (item.subItems || []).find(s => s.id === id) : null;
  if (id && !old) throw Error('Sub-item not found.');
  const row = old || { title: '', status: 'Not started', owner: '', dueDate: '' };
  openModal(
    old ? 'Edit sub-item' : 'Add sub-item',
    `<form id="subItemForm" data-parent="${esc(parentId)}" data-id="${esc(id)}"><div class="manual-entry-hero"><span class="eyebrow">Parent item</span><strong>${esc(projectItemLabel(item))} · ${esc(item.description)}</strong></div><div class="form-grid"><div class="wide"><label for="subItemTitle">Sub-item *</label><input id="subItemTitle" name="title" maxlength="500" value="${esc(row.title)}" required placeholder="Describe the smaller action or deliverable"></div><div><label for="subItemStatus">Status *</label><select id="subItemStatus" name="status" required>${SUBITEM_STATUSES.map(v => `<option${v === row.status ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select></div><div><label for="subItemOwner">Owner</label><input id="subItemOwner" name="owner" maxlength="200" value="${esc(row.owner)}"></div><div><label for="subItemDue">Due date</label><input id="subItemDue" name="dueDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(row.dueDate)}"></div><div class="wide"><label for="subItemRemarks">Remarks</label><textarea id="subItemRemarks" name="remarks" maxlength="32767">${esc(row.remarks || '')}</textarea></div><div class="wide"><label for="subItemFeedback">Feedback updates</label><textarea id="subItemFeedback" name="feedback" maxlength="32767">${esc(row.feedback || '')}</textarea></div></div><div class="modal-actions"><button type="button" data-action="subitem-back" data-parent="${esc(parentId)}">Back to sub-items</button><button class="primary" type="submit">Save sub-item</button></div></form>`
  );
}

function saveSubItem(form) {
  const parentId = form.dataset.parent,
    id = form.dataset.id || uid(),
    item = state.specs.find(s => s.id === parentId),
    old = item?.subItems?.find(s => s.id === id),
    value = k => form.elements.namedItem(k)?.value || '',
    title = value('title').trim(),
    status = value('status'),
    now = new Date().toISOString();
  if (!item) throw Error('Project item not found.');
  if (!title) throw Error('Enter the sub-item.');
  if (!SUBITEM_STATUSES.includes(status)) throw Error('Choose a valid sub-item status.');
  const sub = {
    id,
    title,
    status,
    remarks: value('remarks').trim(),
    feedback: form.elements.namedItem('feedback')?.value ?? old?.feedback ?? '',
    owner: value('owner').trim(),
    dueDate: value('dueDate'),
    createdAt: old?.createdAt || now,
    updatedAt: now,
  };
  rootDateCapture(form, sub, old);
  const ok = mutate(d => {
    const parent = d.specs.find(s => s.id === parentId);
    if (!parent) throw Error('Project item not found.');
    if (old) parent.subItems = parent.subItems.map(s => (s.id === id ? sub : s));
    else {
      if (parent.subItems.length >= 500)
        throw Error('This project item already has 500 sub-items.');
      parent.subItems.push(sub);
    }
  });
  openSubItems(parentId);
  if (ok) tell(old ? 'Sub-item updated.' : 'Sub-item added.');
}

function goLiveProjectsOn(date, d = state) {
  return (d.projects || []).filter(p => p.goLiveDate === date);
}
function goLiveScheduleCard(project, compact = false) {
  return `<button type="button" class="go-live-schedule-card${compact ? ' compact' : ''}" data-action="edit-project" data-id="${esc(project.id)}"><span>Go-Live</span><strong>${esc(project.name)}</strong>${compact ? '' : `<small>${esc(project.phase)} · synced from Project Management</small>`}</button>`;
}
function renderGoLiveMonthStrip(scopeProjectId = '') {
  const rows = state.projects
    .filter(
      p =>
        (!scopeProjectId || p.id === scopeProjectId) &&
        p.goLiveDate?.slice(0, 7) === (scopeProjectId ? projectMonth : month)
    )
    .sort((a, b) => a.goLiveDate.localeCompare(b.goLiveDate));
  return rows.length
    ? `<div class="go-live-month-strip"><span class="eyebrow">Synced Go-Live milestones</span>${rows.map(p => `<button data-action="edit-project" data-id="${esc(p.id)}"><time>${esc(p.goLiveDate)}</time><strong>${esc(p.name)}</strong></button>`).join('')}</div>`
    : '';
}

function renderProjectCalendar() {
  const project = activeProject(),
    dates = monthDates(projectMonth),
    first = dates[0],
    offset = (new Date(first + 'T12:00:00').getDay() + 6) % 7,
    plans = state.projectPlans
      .filter(
        p =>
          p.projectId === state.activeProjectId && p.date <= dates.at(-1) && p.endDate >= dates[0]
      )
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    cells = Array(offset).fill('<div class="calendar-day outside" aria-hidden="true"></div>');
  for (const date of dates) {
    const dayPlans = plans.filter(p => p.date <= date && p.endDate >= date),
      isGoLive = project.goLiveDate === date;
    cells.push(
      `<div class="calendar-day${date === today() ? ' today' : ''}${isGoLive ? ' go-live-day' : ''}"><button class="calendar-number" data-action="new-plan" data-date="${date}" aria-label="Plan activity on ${date}">${+date.slice(8)}</button>${isGoLive ? goLiveScheduleCard(project, true) : ''}${dayPlans.map(p => `<button class="calendar-event ${planStatusClass(p, date)}" data-action="view-plan" data-id="${esc(p.id)}"><span>${esc(p.time)}–${esc(p.endTime)}${isWeekend(date) ? ' · TOIL' : ''}</span><strong>${esc(p.activity || p.title)}</strong>${scheduleCompanyBadge(p)}<small>${esc(p.status)}${p.location ? ' · ' + esc(p.location) : ''}</small></button>`).join('')}</div>`
    );
  }
  while (cells.length % 7)
    cells.push('<div class="calendar-day outside" aria-hidden="true"></div>');
  return `<section class="panel"><div class="panel-top"><div><span class="eyebrow">Plans + milestone</span><h2>Timeline calendar</h2><p class="muted">Project plans and Go-Live use the same saved dates shown in Schedule.</p></div><div class="actions"><button data-action="project-month" data-direction="-1" aria-label="Previous month">Previous</button><input id="projectMonth" type="month" min="1900-01" max="9999-12" value="${projectMonth}" aria-label="Project calendar month"><button data-action="project-month" data-direction="1" aria-label="Next month">Next</button></div></div>${renderGoLiveMonthStrip(project.id)}<div class="calendar-scroll"><div class="calendar-grid">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="calendar-weekday">${d}</div>`).join('')}${cells.join('')}</div></div><div class="box"><h3 class="section-label" style="margin-top:0">Activity timeline · ${esc(projectMonth)}</h3>${project.goLiveDate?.slice(0, 7) === projectMonth ? `<div class="go-live-timeline-row"><time>${esc(project.goLiveDate)}</time><div><strong>Go-Live · ${esc(project.name)}</strong><small>Automatically synced from the project record</small></div><button class="small" data-action="edit-project" data-id="${esc(project.id)}">Edit date</button></div>` : ''}${plans.map(planRow).join('') || (!project.goLiveDate || project.goLiveDate.slice(0, 7) !== projectMonth ? '<p class="muted">No project activities this month.</p>' : '')}</div></section>`;
}

function renderSchedule() {
  if (scheduleLayout === 'grid')
    return `<div class="schedule-view-switch"><button data-action="schedule-layout" data-layout="calendar">Month &amp; agenda</button><button class="active" data-action="schedule-layout" data-layout="grid">Time grid</button></div>${renderGoLiveMonthStrip()}${renderScheduleGrid()}`;
  const days = monthDates(month);
  if (!days.includes(scheduleDay)) scheduleDay = days.includes(today()) ? today() : days[0];
  const entries = scheduleEntries(scheduleDay),
    dayGoLives = goLiveProjectsOn(scheduleDay),
    metrics = scheduleMonthMetrics(),
    monthGoLives = state.projects.filter(p => p.goLiveDate?.slice(0, 7) === month).length,
    offset = (new Date(days[0] + 'T12:00:00').getDay() + 6) % 7,
    label = new Date(days[0] + 'T12:00:00').toLocaleDateString(undefined, {
      month: 'long',
      year: 'numeric',
    });
  return `<section class="panel workhub-schedule"><div class="panel-top"><div><span class="eyebrow">Your work, in view</span><h2>Schedule</h2><p class="muted">Bookings and project Go-Live milestones stay synchronized automatically.</p></div><div class="actions"><button class="primary" data-action="new-range">Add date / time range</button><div><label for="month">Month</label><input id="month" type="month" min="1900-01" max="9999-12" value="${esc(month)}"></div></div></div><div class="schedule-metrics"><div><span>Daily bookings</span><strong>${metrics.bookings}</strong></div><div><span>Scheduled time</span><strong>${formatDuration(metrics.minutes)}</strong></div><div><span>Review due</span><strong id="scheduleReviewCount">${metrics.review}</strong></div><div><span>Weekend TOIL</span><strong>${formatDuration(metrics.toilMinutes)}</strong></div><div class="go-live-metric"><span>Go-Lives this month</span><strong>${monthGoLives}</strong></div></div><div class="schedule-navigation"><div class="actions"><button class="small" data-action="schedule-month" data-step="-1" aria-label="Previous month">‹</button><h3>${esc(label)}</h3><button class="small" data-action="schedule-month" data-step="1" aria-label="Next month">›</button></div><div class="schedule-view-switch"><button class="active" data-action="schedule-layout" data-layout="calendar">Month &amp; agenda</button><button data-action="schedule-layout" data-layout="grid">Time grid</button></div></div><div class="workhub-schedule-body"><div class="workhub-calendar"><div class="weekday-row">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span>${d}</span>`).join('')}</div><div class="workhub-month-grid">${Array.from({ length: offset }, () => '<div class="calendar-pad" aria-hidden="true"></div>').join('')}${days
    .map(d => {
      const es = scheduleEntries(d),
        goLives = goLiveProjectsOn(d),
        visible = es.slice(0, goLives.length ? 1 : 2);
      return `<div class="workhub-day${isWeekend(d) ? ' weekend' : ''}${d === scheduleDay ? ' selected' : ''}${d === today() ? ' today' : ''}${goLives.length ? ' go-live-day' : ''}"><button class="calendar-day-select" data-action="schedule-day" data-date="${d}" aria-label="View ${d}" aria-pressed="${d === scheduleDay}"><span>${Number(d.slice(8))}</span><small>${es.length ? es.length + ' booking' + (es.length === 1 ? '' : 's') : ''}</small></button><div class="day-bookings">${goLives.map(p => goLiveScheduleCard(p, true)).join('')}${visible.map(e => scheduleEntryCard(e, true)).join('')}${es.length > visible.length ? `<button class="more-bookings" data-action="schedule-day" data-date="${d}">+${es.length - visible.length} more</button>` : ''}</div></div>`;
    })
    .join(
      ''
    )}</div></div><aside class="workhub-agenda"><span class="eyebrow">Day agenda</span><h3>${esc(new Date(scheduleDay + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}</h3><p class="muted">${entries.length} bookings · ${formatDuration(entries.reduce((n, e) => n + e.hours, 0) * 60)} scheduled</p><button class="agenda-add" data-action="schedule-add-day">+ Plan this day</button>${dayGoLives.length ? `<div class="agenda-milestones"><span class="eyebrow">Project milestones</span>${dayGoLives.map(p => goLiveScheduleCard(p)).join('')}</div>` : ''}<div class="agenda-bookings">${entries.map(e => scheduleEntryCard(e)).join('') || (!dayGoLives.length ? '<div class="agenda-empty"><strong>A little breathing room</strong><p>No activities planned for this day.</p></div>' : '')}</div></aside></div><div class="schedule-status-legend"><span class="status-planned">Planned</span><span class="status-in-progress">In Progress</span><span class="status-review-due">Review due</span><span class="status-completed">Completed</span><span class="status-elapsed">Elapsed</span><span class="legend-toil">TOIL</span><span class="legend-go-live">Go-Live milestone</span></div><div class="footerline">01:00–24:00 · Go-Live milestones come directly from each project record and do not reserve working hours.</div></section>`;
}

function editProject(id, returnTo = '') {
  const project = id ? state.projects.find(p => p.id === id) : null;
  if (id && !project) throw Error('Project not found.');
  const row = project || {
      name: '',
      code: '',
      phase: state.lists.projectPhases[0],
      goLiveDate: '',
      health: 'On track',
      nextMilestone: '',
    },
    health = project
      ? projectHealthDetails(project.id)
      : {
          status: 'On track',
          summary: 'Health starts automatically after project items and phase gates are added.',
        };
  openModal(
    project ? 'Edit project' : 'Add project',
    `<form id="projectForm" data-id="${esc(id || '')}" data-return="${esc(returnTo)}"><div class="form-grid"><div class="span2"><label for="projectName">Project name *</label><input id="projectName" name="name" value="${esc(row.name)}" maxlength="80" required></div><div><label for="projectCode">Charge code</label><input id="projectCode" name="code" value="${esc(row.code)}" maxlength="80"></div><div><label for="projectPhase">Current phase *</label><select id="projectPhase" name="phase" required>${selectOptions(state.lists.projectPhases, row.phase, 'Choose phase')}</select></div><div><label for="projectGoLive">Go-Live date</label><input id="projectGoLive" name="goLiveDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(normalizeGoLiveDate(row.goLiveDate))}"><p class="hint">One saved date feeds Overview, Project Timeline and Schedule.</p></div><div><label>Project health</label><div class="calculated-health ${healthClass(health.status)}"><strong>${esc(health.status)}</strong><small>${esc(health.summary)}</small></div></div><div class="wide"><label for="projectNextMilestone">Next milestone</label><input id="projectNextMilestone" name="nextMilestone" maxlength="500" value="${esc(row.nextMilestone)}" placeholder="Next outcome, owner, or target"></div></div><p class="hint">Project health is calculated automatically and also considers blocked or overdue sub-items.</p>${project?.id === state.activeProjectId ? '<p class="hint">This is the active project. Saving its name also renames the project tab.</p>' : `<label class="check-label"><input type="checkbox" name="makeActive"${project ? '' : ' checked'}>Set as the active project</label>`}<div class="modal-actions"><span class="hint">Deletion is available from Project management.</span><div class="actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save project</button></div></div></form>`
  );
}

function saveProject(form) {
  const id = form.dataset.id || uid(),
    isNew = !form.dataset.id,
    old = state.projects.find(p => p.id === id),
    named = k => form.elements.namedItem(k),
    goLiveField = named('goLiveDate'),
    goLiveDate = goLiveField
      ? normalizeGoLiveDate(goLiveField.value)
      : normalizeGoLiveDate(old?.goLiveDate),
    name = named('name')?.value.trim() || '',
    code = named('code')?.value.trim() || '',
    phase = named('phase')?.value || old?.phase || state.lists.projectPhases[0],
    nextMilestone = named('nextMilestone')?.value.trim() || '',
    setActive = !!named('makeActive')?.checked;
  if (goLiveField?.value && !goLiveDate) throw Error('Choose a valid Go-Live date.');
  const changed = goLiveDate !== (old?.goLiveDate || ''),
    record = {
      id,
      name,
      code,
      phase,
      goLiveDate,
      mmAreas: old?.mmAreas || defaultMMAreas(),
      health: old?.health || 'On track',
      nextMilestone,
      goLiveUpdatedAt: changed ? new Date().toISOString() : old?.goLiveUpdatedAt || '',
    };
  const ok = mutate(d => {
    if (isNew) d.projects.push(record);
    else {
      if (!d.projects.some(p => p.id === id)) throw Error('Project not found.');
      d.projects = d.projects.map(p => (p.id === id ? { ...p, ...record } : p));
    }
    hub?.batchA?.capture(d, form, 'projects', id);
    if (setActive) d.activeProjectId = id;
  });
  if (setActive) specQuery = specFilter = '';
  selectedCodeProject = id;
  if (form.dataset.return === 'codes') openChargeCodes('projects');
  else if (form.dataset.return === 'manager') openProjectManagement();
  else closeModal();
  if (ok)
    tell(
      goLiveDate
        ? `Project saved. Go-Live ${goLiveDate} is synced to both calendars.`
        : 'Project saved.'
    );
}

function managerProjectRows() {
  return state.projects
    .map(
      project =>
        `<div class="project-manager-row"><div><strong>${esc(project.name)}</strong><div class="hint">${esc(project.code) || 'No charge code'} · ${esc(project.phase)} · Health: ${esc(projectHealthDetails(project.id).status)}${project.id === state.activeProjectId ? ' · Active' : ''}</div>${project.goLiveDate ? `<div class="manager-go-live"><span>Go-Live</span><strong>${esc(project.goLiveDate)}</strong><small>${daysUntil(project.goLiveDate)} days</small></div>` : '<div class="hint">Go-Live not set</div>'}</div><div class="actions">${project.id !== state.activeProjectId ? `<button class="small" data-action="activate-project" data-id="${esc(project.id)}" data-return="manager">Set active</button>` : ''}<button class="small" data-action="edit-project" data-id="${esc(project.id)}" data-return="manager">Edit</button><button class="small danger" data-action="delete-project" data-id="${esc(project.id)}">Delete</button></div></div>`
    )
    .join('');
}

const projectHealthDetailsV9Base = projectHealthDetails;
projectHealthDetails = function (projectId = state.activeProjectId, d = state, asOf = today()) {
  const base = projectHealthDetailsV9Base(projectId, d, asOf),
    rows = d.specs
      .filter(item => item.projectId === projectId)
      .flatMap(item => item.subItems || []),
    blocked = rows.filter(sub => sub.status === 'Blocked'),
    overdue = rows.filter(sub => sub.status !== 'Completed' && sub.dueDate && sub.dueDate < asOf),
    reasons = [...(base.reasons || [])];
  if (blocked.length)
    reasons.push(
      `${blocked.length} project sub-item${blocked.length === 1 ? ' is' : 's are'} blocked.`
    );
  if (overdue.length)
    reasons.push(
      `${overdue.length} project sub-item${overdue.length === 1 ? ' is' : 's are'} overdue.`
    );
  const status = blocked.length
      ? 'Blocked'
      : overdue.length && base.status === 'On track'
        ? 'At risk'
        : base.status,
    summary = blocked.length
      ? `${blocked.length} blocked sub-item${blocked.length === 1 ? '' : 's'} need action`
      : overdue.length && base.status === 'On track'
        ? `${overdue.length} overdue sub-item${overdue.length === 1 ? '' : 's'} need attention`
        : base.summary;
  return { ...base, status, summary, reasons };
};

const workhubActionV9Base = workhubAction;
workhubAction = function (button) {
  const action = button.dataset.action,
    id = button.dataset.id;
  if (action === 'manage-mm-areas') {
    openMMAreaManager();
    return true;
  }
  if (action.startsWith('mm-area-')) {
    editMMAreaDraft(button);
    return true;
  }
  if (action === 'new-company') {
    editCompany();
    return true;
  }
  if (action === 'edit-company') {
    editCompany(id);
    return true;
  }
  if (action === 'new-process') {
    if (button.dataset.company) governanceCompanyId = button.dataset.company;
    if (button.dataset.area) governanceArea = button.dataset.area;
    editProcess();
    return true;
  }
  if (action === 'edit-process') {
    editProcess(id);
    return true;
  }
  if (action === 'manage-subitems') {
    openSubItems(id);
    return true;
  }
  if (action === 'new-subitem') {
    editSubItem(button.dataset.parent);
    return true;
  }
  if (action === 'edit-subitem') {
    editSubItem(button.dataset.parent, id);
    return true;
  }
  if (action === 'subitem-back') {
    openSubItems(button.dataset.parent);
    return true;
  }
  if (action === 'delete-subitem') {
    const parentId = button.dataset.parent,
      item = state.specs.find(s => s.id === parentId),
      sub = item?.subItems?.find(s => s.id === id);
    if (sub && confirm(`Delete sub-item "${sub.title}"?`)) {
      const ok = mutate(d => {
        const parent = d.specs.find(s => s.id === parentId);
        parent.subItems = parent.subItems.filter(s => s.id !== id);
      });
      openSubItems(parentId);
      if (ok) tell('Sub-item deleted.');
    }
    return true;
  }
  return workhubActionV9Base(button);
};

const workhubChangeV9Base = workhubChange;
workhubChange = function (element) {
  if (element.dataset.subitemStatus) {
    const parentId = element.dataset.subitemStatus,
      id = element.dataset.subitemId,
      status = element.value;
    if (!SUBITEM_STATUSES.includes(status)) throw Error('Choose a valid sub-item status.');
    const ok = mutate(d => {
      const parent = d.specs.find(s => s.id === parentId),
        sub = parent?.subItems?.find(s => s.id === id);
      if (!sub) throw Error('Sub-item not found.');
      sub.status = status;
      sub.updatedAt = new Date().toISOString();
    });
    openSubItems(parentId);
    if (ok) tell('Sub-item status updated.');
    return true;
  }
  return workhubChangeV9Base(element);
};

document.addEventListener('submit', event => {
  if (!['processForm', 'subItemForm', 'mmAreasForm'].includes(event.target.id)) return;
  event.preventDefault();
  try {
    if (event.target.id === 'processForm') saveProcess(event.target);
    else if (event.target.id === 'mmAreasForm') saveMMAreas(event.target);
    else saveSubItem(event.target);
  } catch (error) {
    tell(error.message, true);
  }
});

// Record format 8: individual subtask notes and precise daily booking segments.
function timeMinutes(value, end = false) {
  if (end && value === '24:00') return 1440;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value))
    throw Error('Enter a valid time in hours and minutes.');
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function minuteTime(value) {
  return (
    String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0')
  );
}
function rangeSegments(start, end) {
  const a = timeMinutes(start),
    b = timeMinutes(end, true);
  if (b <= a)
    throw Error(
      'The end time must be after the start. Use the same time range on each selected date.'
    );
  const segments = [];
  for (let cursor = a; cursor < b; ) {
    const next = Math.min(b, (Math.floor(cursor / 60) + 1) * 60);
    segments.push({ time: minuteTime(cursor), endTime: minuteTime(next) });
    cursor = next;
  }
  return segments;
}
/** Expand an exact time interval using minute boundaries; adjacent bookings may share an endpoint. */
function rangeTimes(start, end) {
  return rangeSegments(start, end).map(segment => segment.time);
}
function segmentEnd(start, end) {
  return minuteTime(
    Math.min(timeMinutes(end, true), (Math.floor(timeMinutes(start) / 60) + 1) * 60)
  );
}
function scheduleRangeFields(s) {
  return `<div><label for="bookingDate">Start date *</label><input id="bookingDate" name="date" type="date" min="1900-01-01" max="9999-12-31" value="${esc(s.date)}" required></div><div><label for="bookingEndDate">End date *</label><input id="bookingEndDate" name="endDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(s.endDate || s.date)}" required></div>${bookingTimeFields(s.time, s.endTime)}<div class="wide booking-duration-box"><div class="actions"><span>Quick duration</span>${[15, 30, 45, 60, 90].map(minutes => `<button type="button" class="small" data-action="booking-duration" data-minutes="${minutes}">${formatDuration(minutes)}</button>`).join('')}</div><strong data-booking-duration role="status">${formatDuration(timeMinutes(s.endTime, true) - timeMinutes(s.time))} per day</strong><small>Dates repeat the same daily time range. Minutes are supported throughout the day.</small></div>`;
}
function openRangeEditor(date = today(), time = '09:00', taskId = '', createNew = false) {
  const old = createNew ? null : state.schedule.find(row => row.date === date && row.time === time),
    plan = state.projectPlans.find(plan => plan.id === old?.planId),
    block = old?.bookingId
      ? state.schedule
          .filter(row => row.bookingId === old.bookingId)
          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      : old
        ? [old]
        : [],
    times = block.map(row => row.time).sort(),
    ends = block.map(slotEnd).sort();
  scheduleDraft = {
    date: plan?.date || block[0]?.date || date,
    endDate: plan?.endDate || block.at(-1)?.date || date,
    time: plan?.time || times[0] || time,
    endTime: plan?.endTime || ends.at(-1) || minuteTime(Math.min(1440, timeMinutes(time) + 60)),
    text: old?.text || '',
    kind: taskId ? 'task' : old?.kind || 'custom',
    linkId: taskId || old?.linkId || '',
    activity: old?.activity || '',
    location: plan?.location || old?.location || '',
    bookingId: old?.bookingId || '',
    planId: old?.planId || '',
    originalDate: createNew ? '' : date,
    originalTime: createNew ? '' : time,
    status: plan?.status || 'Planned',
    title: plan?.title || old?.title || '',
    companyId: old?.companyId || plan?.companyId || '',
    companyName: old?.companyName || plan?.companyName || '',
    travel: old?.travel ? JSON.parse(JSON.stringify(old.travel)) : null,
    claimType: window.WorkHubClaimsEngine.claimType(old),
    claimLocationName: old?.claimLocationName || '',
    leave: old?.leave ? JSON.parse(JSON.stringify(old.leave)) : undefined,
  };
  renderRangeEditor();
}
function openScheduleEditor(date, time) {
  return viewBooking(date, time);
}
function scheduleEntries(date) {
  const entries = new Map();
  for (const slot of state.schedule
    .filter(row => row.date === date)
    .sort((a, b) => a.time.localeCompare(b.time))) {
    const key = slot.bookingId || slot.planId || slot.time;
    if (!entries.has(key))
      entries.set(key, {
        slot,
        time: slot.time,
        endTime: slotEnd(slot),
        hours: slotMinutes(slot) / 60,
      });
    else {
      const entry = entries.get(key);
      entry.endTime = slotEnd(slot);
      entry.hours += slotMinutes(slot) / 60;
    }
  }
  return [...entries.values()];
}
function scheduleTimeStatus(slot, d = state, date = today(), time = timeNow().slice(0, 5)) {
  if (!slot) return '';
  if (window.WorkHubLeave.isLeave(slot.kind)) return slot.leave.status;
  const plan = d.projectPlans.find(plan => plan.id === slot.planId),
    task = slot.kind === 'task' ? d.tasks.find(task => task.id === slot.linkId) : null;
  if (plan?.status === 'Completed' || task?.done) return 'Completed';
  if (plan?.status === 'On Hold') return 'On Hold';
  const block = slot.bookingId
      ? d.schedule.filter(row => row.date === slot.date && row.bookingId === slot.bookingId)
      : [slot],
    startTime = plan?.time || block.map(row => row.time).sort()[0],
    endTime = plan?.endTime || block.map(slotEnd).sort().at(-1),
    now = date + time,
    start = (plan?.date || slot.date) + startTime,
    end = (plan?.endDate || slot.date) + endTime;
  if (now < start) return 'Planned';
  if (now < end) return 'In Progress';
  return plan ? 'Review due' : 'Elapsed';
}
function scheduleEntryStatus(entry, date = today(), time = timeNow().slice(0, 5)) {
  return scheduleTimeStatus(entry.slot, state, date, time);
}
function scheduleEntryCard(entry, compact = false) {
  const slot = entry.slot,
    status = scheduleEntryStatus(entry);
  return `<button type="button" class="slot workhub-booking${compact ? ' compact' : ''} status-${statusClass(status)}${isToilSchedule(slot) ? ' toil' : ''}" data-schedule-status="${esc(slot.date + '|' + slot.time)}" data-schedule-class="slot workhub-booking${compact ? ' compact' : ''}" data-action="open-booking" data-date="${esc(slot.date)}" data-time="${esc(slot.time)}"><span class="booking-time">${entry.time}–${entry.endTime}${isToilSchedule(slot) ? ' · TOIL' : ''}</span><strong>${esc(scheduleEntryTitle(entry))}</strong>${scheduleCompanyBadge(slot)}${window.WorkHubClaims.badge(slot)}${!compact ? `<span class="booking-context">${esc(scheduleEntryContext(entry))}</span><span class="booking-duration-label">${formatDuration(entry.hours * 60)} · View details ↗</span>` : ''}<span class="slot-state">${esc(status)}</span></button>`;
}
function scheduleMonthMetrics() {
  const entries = monthDates(month).flatMap(scheduleEntries);
  return {
    bookings: entries.length,
    minutes: Math.round(entries.reduce((sum, entry) => sum + entry.hours * 60, 0)),
    hours: formatHours(entries.reduce((sum, entry) => sum + entry.hours, 0)),
    review: entries.filter(entry => scheduleEntryStatus(entry) === 'Review due').length,
    toilMinutes: Math.round(
      entries
        .filter(entry => isToilSchedule(entry.slot))
        .reduce((sum, entry) => sum + entry.hours * 60, 0)
    ),
    toil: formatHours(
      entries
        .filter(entry => isToilSchedule(entry.slot))
        .reduce((sum, entry) => sum + entry.hours, 0)
    ),
  };
}
function slotEnd(slot) {
  return slot.endTime || minuteTime(Math.min(1440, timeMinutes(slot.time) + 60));
}
function slotMinutes(slot) {
  return timeMinutes(slotEnd(slot), true) - timeMinutes(slot.time);
}
function bookingOverlaps(rows, dates, start, end) {
  const set = new Set(dates),
    a = timeMinutes(start),
    b = timeMinutes(end, true);
  return rows.some(
    row => set.has(row.date) && timeMinutes(row.time) < b && timeMinutes(slotEnd(row), true) > a
  );
}
function formatDuration(minutes) {
  const value = Math.round(minutes),
    hours = Math.floor(value / 60),
    rest = value % 60;
  return [hours ? hours + 'h' : '', rest ? rest + 'm' : ''].filter(Boolean).join(' ') || '0m';
}
function formatHours(hours) {
  return Number(hours.toFixed(2));
}
function upgradePreciseRecords(d) {
  for (const task of d.tasks || []) {
    if (task.subTasks === undefined) task.subTasks = [];
    if (Array.isArray(task.subTasks))
      for (const sub of task.subTasks) {
        if (sub.remarks === undefined) sub.remarks = '';
        if (sub.feedback === undefined) sub.feedback = '';
      }
  }
  for (const slot of d.schedule || []) if (slot.endTime === undefined) slot.endTime = slotEnd(slot);
  return d;
}
function validatePreciseRecords(d) {
  const ids = new Set();
  let total = 0;
  for (const task of d.tasks) {
    if (!Array.isArray(task.subTasks) || task.subTasks.length > 500)
      throw Error('Each main task supports up to 500 sub-tasks.');
    total += task.subTasks.length;
    for (const sub of task.subTasks) {
      if (
        !sub ||
        !checkText(sub.id, 100) ||
        !sub.id ||
        ids.has(sub.id) ||
        !checkText(sub.title, 500) ||
        !sub.title.trim() ||
        !SUBITEM_STATUSES.includes(sub.status) ||
        !checkText(sub.remarks) ||
        !checkText(sub.feedback) ||
        !checkText(sub.createdAt, 50) ||
        !checkText(sub.updatedAt, 50)
      )
        throw Error('Check the sub-task title, status, remarks and feedback.');
      ids.add(sub.id);
    }
  }
  if (total > LIMIT) throw Error('Tasks support up to 5,000 sub-tasks in total.');
  const ordered = d.schedule
    .slice()
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  for (let i = 0; i < ordered.length; i++) {
    const row = ordered[i];
    if (timeMinutes(slotEnd(row), true) <= timeMinutes(row.time))
      throw Error('Every schedule entry needs a later end time.');
    const previous = ordered[i - 1];
    if (previous?.date === row.date && slotEnd(previous) > row.time)
      throw Error('This range overlaps an existing activity. Choose an empty range.');
  }
  for (const plan of d.projectPlans) {
    const expected = rangeSegments(plan.time, plan.endTime),
      dates = rangeDates(plan.date, plan.endDate),
      rows = d.schedule.filter(row => row.planId === plan.id);
    for (const date of dates)
      for (const segment of expected)
        if (
          !rows.some(
            row =>
              row.date === date && row.time === segment.time && slotEnd(row) === segment.endTime
          )
        )
          throw Error('Schedule and project plan time ranges do not match.');
  }
}
function bookingTimeFields(start = '09:00', end = '10:00', conversion = false) {
  const attr = conversion ? ' data-conversion-fields="Schedule" hidden' : '';
  return `<div${attr}><label for="bookingStart">Start time *</label><input id="bookingStart" name="time" type="time" step="60" value="${esc(start)}" required></div><div${attr}><label for="bookingEndClock">End time *</label><input id="bookingEndClock" name="endClock" type="time" step="60" value="${esc(end === '24:00' ? '23:59' : end)}"${end === '24:00' ? ' disabled' : ''} required><input id="bookingEnd" name="endTime" type="hidden" value="${esc(end)}"><label class="check-label"><input id="bookingMidnight" type="checkbox"${end === '24:00' ? ' checked' : ''}>End at midnight (24:00)</label></div>`;
}
document.addEventListener('change', event => {
  const f = event.target.form;
  if (f?.id !== 'scheduleForm') return;
  if (event.target.id === 'leavePortion') {
    const range = window.WorkHubLeave.PORTIONS[event.target.value];
    if (range?.[1]) {
      f.elements.namedItem('time').value = range[1];
      setBookingEnd(f, range[2]);
    }
  }
  if (
    ['bookingStart', 'bookingEndClock', 'bookingMidnight'].includes(event.target.id) &&
    f.elements.namedItem('leavePortion')
  )
    f.elements.namedItem('leavePortion').value = 'custom';
  if (event.target.id === 'mcSubmitted') {
    const sent = event.target.value === 'yes',
      date = f.elements.namedItem('mcSubmittedDate');
    $('mcDateField').hidden = !sent;
    date.required = sent;
    if (!sent) date.value = '';
    else if (!date.value) date.value = today();
  }
});
function setBookingEnd(form, value) {
  form.elements.namedItem('endTime').value = value;
  const clock = form.elements.namedItem('endClock');
  clock.disabled = value === '24:00';
  clock.value = value === '24:00' ? '23:59' : value;
  form.querySelector('#bookingMidnight').checked = value === '24:00';
  updateBookingDuration(form);
}
function updateBookingDuration(form) {
  const box = form?.querySelector('[data-booking-duration]');
  if (!box) return;
  try {
    const start = form.elements.namedItem('time').value,
      end = form.elements.namedItem('endTime').value,
      days = rangeDates(
        form.elements.namedItem('date').value,
        form.elements.namedItem('endDate').value
      ).length;
    rangeSegments(start, end);
    const minutes = timeMinutes(end, true) - timeMinutes(start);
    box.textContent =
      formatDuration(minutes) +
      ' per day' +
      (days > 1 ? ' · ' + days + ' days · ' + formatDuration(minutes * days) + ' total' : '');
  } catch {
    box.textContent = 'Choose a start and a later end time.';
  }
}
function viewBooking(date, time) {
  const entry = scheduleEntries(date).find(
    entry => entry.slot.time === time || (entry.time <= time && entry.endTime > time)
  );
  if (!entry) {
    openRangeEditor(date, time, '', true);
    return;
  }
  const slot = entry.slot,
    block = state.schedule.filter(row =>
      slot.bookingId ? row.bookingId === slot.bookingId : row.date === date && row.time === time
    ),
    dates = [...new Set(block.map(row => row.date))].sort(),
    plan = state.projectPlans.find(plan => plan.id === slot.planId),
    task = state.tasks.find(task => task.id === slot.linkId),
    status = scheduleEntryStatus(entry);
  openModal(
    'Scheduled activity',
    `<div class="booking-view-hero"><span class="eyebrow">${esc(window.WorkHubLeave.isLeave(slot.kind) ? window.WorkHubLeave.TYPES[slot.kind] : slot.kind === 'task' ? 'Main task' : slot.kind === 'project' ? 'Project activity' : 'Activity')}</span><h3>${esc(scheduleEntryTitle(entry))}</h3><p>${esc(scheduleEntryContext(entry))}</p>${tag(status)}</div><dl class="booking-facts"><div><dt>Company</dt><dd>${esc(scheduleCompanyName(slot)) || 'Not specified'}</dd></div><div><dt>Dates</dt><dd>${esc(dates[0])}${dates.length > 1 ? ' → ' + esc(dates.at(-1)) : ''}</dd></div><div><dt>Time each day</dt><dd>${esc(entry.time)}–${esc(entry.endTime)}</dd></div><div><dt>Duration</dt><dd>${formatDuration(entry.hours * 60)} per day${dates.length > 1 ? ' · ' + formatDuration(block.reduce((sum, row) => sum + slotMinutes(row), 0)) + ' total' : ''}</dd></div><div><dt>Work location</dt><dd>${esc(slot.location) || 'Not specified'}</dd></div></dl>${window.WorkHubLeave.details(slot)}${window.WorkHubClaims.details(slot, state)}<h3 class="section-label">${slot.kind === 'custom' ? 'Activity details' : 'Remarks / notes'}</h3><p class="prewrap">${esc(slot.text) || 'No notes added.'}</p>${plan?.actualReviewedAt ? `<h3 class="section-label">Actual work</h3><p class="prewrap">${esc(plan.actualTask) || 'Same as planned'}</p>` : ''}${slot.kind === 'task' && task?.subTasks?.length ? `<h3 class="section-label">Sub-tasks · ${task.subTasks.filter(sub => sub.status === 'Completed').length}/${task.subTasks.length} complete</h3>${task.subTasks.map(sub => `<p><strong>${esc(sub.title)}</strong> · ${esc(sub.status)}</p>`).join('')}` : ''}<div class="modal-actions"><button type="button" data-action="cancel">Close</button><button type="button" class="primary" data-action="edit-booking" data-date="${esc(date)}" data-time="${esc(entry.slot.time)}">Edit activity</button></div>`
  );
}
function subTaskCard(task, sub) {
  return `<article class="task-child status-${statusClass(sub.status)}"><div class="task-child-head"><strong>${esc(sub.title)}</strong>${tag(sub.status)}${WorkHubStudio.subtaskCompletionButton(task, sub)}<button class="small" data-action="edit-task-sub" data-parent="${esc(task.id)}" data-id="${esc(sub.id)}">Edit</button></div><dl class="task-child-notes"><div><dt>Remarks</dt><dd>${esc(sub.remarks) || 'No remarks yet'}</dd></div><div><dt>Feedback</dt><dd>${esc(sub.feedback) || 'No feedback yet'}</dd></div></dl></article>`;
}
function editTaskSub(parentId, id = '') {
  const task = state.tasks.find(task => task.id === parentId),
    old = task?.subTasks.find(sub => sub.id === id);
  if (!task || (id && !old)) throw Error('Sub-task not found.');
  const sub = old || { title: '', status: 'Not started', remarks: '', feedback: '' };
  openModal(
    old ? 'Edit sub-task' : 'Add sub-task',
    `<form id="taskSubForm" data-parent="${esc(parentId)}" data-id="${esc(id)}"><div class="manual-entry-hero"><span class="eyebrow">Main task${task.number ? ' · ' + esc(task.number) : ''}</span><strong>${esc(task.task)}</strong></div><div class="form-grid"><div class="wide"><label for="taskSubTitle">Sub-task *</label><input id="taskSubTitle" name="title" maxlength="500" required value="${esc(sub.title)}"></div><div><label for="taskSubStatus">Status *</label><select id="taskSubStatus" name="status">${SUBITEM_STATUSES.map(status => `<option${status === sub.status ? ' selected' : ''}>${esc(status)}</option>`).join('')}</select></div><div class="wide"><label for="taskSubRemarks">Remarks</label><textarea id="taskSubRemarks" name="remarks" maxlength="32767">${esc(sub.remarks)}</textarea></div><div class="wide"><label for="taskSubFeedback">Feedback</label><textarea id="taskSubFeedback" name="feedback" maxlength="32767">${esc(sub.feedback)}</textarea></div></div><p class="hint">Status, remarks and feedback belong only to this sub-task.</p><div class="modal-actions"><div>${old ? `<button type="button" class="danger" data-action="delete-task-sub" data-parent="${esc(parentId)}" data-id="${esc(id)}">Delete sub-task</button>` : ''}</div><div class="actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save sub-task</button></div></div></form>`
  );
}
function saveTaskSub(form) {
  const parentId = form.dataset.parent,
    id = form.dataset.id || uid(),
    value = name => form.elements.namedItem(name).value,
    title = value('title').trim(),
    status = value('status'),
    now = new Date().toISOString();
  const ok = mutate(d => {
    const task = d.tasks.find(task => task.id === parentId);
    if (!task) throw Error('Main task not found.');
    const old = task.subTasks.find(sub => sub.id === id);
    if (form.dataset.id && !old) throw Error('Sub-task no longer exists.');
    const sub = {
      id,
      title,
      status,
      remarks: value('remarks').trim(),
      feedback: value('feedback').trim(),
      createdAt: old?.createdAt || now,
      updatedAt: now,
    };
    if (old) task.subTasks = task.subTasks.map(row => (row.id === id ? sub : row));
    else task.subTasks.push(sub);
  });
  if (ok) {
    closeModal();
    tell('Sub-task saved.');
  }
}
function taskCard(task) {
  const subs = task.subTasks || [],
    done = subs.filter(sub => sub.status === 'Completed').length;
  return `<article class="task-main-card${taskOverdue(task) ? ' overdue' : ''}"><div class="task-card-heading"><div><span class="eyebrow">Main task${task.number ? ' · ' + esc(task.number) : ''}</span><h3>${esc(task.task)}</h3><div class="task-card-meta">${tag(task.taskType)}${tag(task.priority)}<span>${esc(taskLinkedLabel(task))}</span></div></div></div><div class="task-date-strip"><span>Due <strong>${dateLabel(task.dueDate)}</strong>${taskOverdue(task) ? ' · Overdue' : ''}</span>${task.doneDate ? `<span>Completed ${esc(task.doneDate)}</span>` : ''}${task.archived ? `<span>Archived ${esc(task.archivedAt)}</span>` : ''}</div><dl class="task-parent-notes"><div><dt>Main task remarks</dt><dd>${esc(task.remarks) || 'No remarks yet'}</dd></div><div><dt>Main task feedback</dt><dd>${esc(task.feedback) || 'No feedback yet'}</dd></div></dl><div class="task-subheading"><div><strong>Sub-tasks</strong><span>${done}/${subs.length} complete</span></div><button class="small" data-action="new-task-sub" data-parent="${esc(task.id)}">+ Add sub-task</button></div>${subs.length ? `<div class="progress"><span style="width:${(done / subs.length) * 100}%"></span></div><div class="task-child-list">${subs.map(sub => subTaskCard(task, sub)).join('')}</div>` : '<p class="task-sub-empty">Break this task into smaller actions, each with its own updates.</p>'}<div class="task-card-footer"><button class="small" data-action="edit" data-group="tasks" data-id="${esc(task.id)}">Edit main task</button>${task.archived ? `<button class="small" data-action="restore-task" data-id="${esc(task.id)}">Restore task</button>` : task.done ? `<button class="small" data-action="archive-task" data-id="${esc(task.id)}">Archive task</button>` : `<button class="small" data-action="schedule-task" data-id="${esc(task.id)}">Schedule task</button>`}</div></article>`;
}
function taskSummary() {
  const active = state.tasks.filter(task => !task.archived),
    subs = active.flatMap(task => task.subTasks || []);
  return `<div class="workspace-summary">${[
    ['Open main tasks', active.filter(task => !task.done).length],
    ['Sub-tasks open', subs.filter(sub => sub.status !== 'Completed').length],
    ['Overdue', state.tasks.filter(taskOverdue).length],
    ['Completed main tasks', active.filter(task => task.done).length],
  ]
    .map(([label, count]) => `<div><span>${label}</span><strong>${count}</strong></div>`)
    .join('')}</div>`;
}
function renderTasksV3() {
  const rows = filteredTasks(),
    completed = state.tasks.filter(task => task.done && !task.archived).length;
  return `<div class="workspace-v10 tasks-workspace"><div class="workspace-heading"><div><span class="eyebrow">Tasks &amp; next steps</span><h2>From the main task to the smallest detail</h2><p>Keep every action, remark and piece of feedback connected.</p></div><button class="primary" data-action="new" data-group="tasks">+ Add main task</button></div>${taskSummary()}<section class="panel"><div class="workspace-toolbar"><input id="tasksSearch" type="search" value="${esc(tasksQuery)}" aria-label="Search tasks" placeholder="Search main tasks, sub-tasks, remarks or feedback"><select id="taskView" aria-label="Task view">${[
    ['active', 'Active tasks'],
    ['done', 'Completed tasks'],
    ['overdue', 'Overdue tasks'],
    ['archive', 'Archive'],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}"${taskView === value ? ' selected' : ''}>${label}</option>`
    )
    .join(
      ''
    )}</select><select id="taskPriority" aria-label="Task priority">${selectOptions(OPTIONS.priority, taskPriority, 'All priorities')}</select><select id="taskSort" aria-label="Sort tasks">${[
    ['due', 'Due date first'],
    ['priority', 'Priority first'],
    ['number', 'Task number'],
  ]
    .map(
      ([value, label]) =>
        `<option value="${value}"${taskSort === value ? ' selected' : ''}>${label}</option>`
    )
    .join(
      ''
    )}</select></div><div class="workspace-results"><span>${rows.length} main task${rows.length === 1 ? '' : 's'}</span><button class="small" data-action="archive-done"${completed ? '' : ' disabled'}>Archive completed (${completed})</button></div><div class="task-board">${rows.map(taskCard).join('') || '<div class="workspace-empty"><strong>No tasks in this view</strong><p>Add a main task or adjust your filters to get started.</p></div>'}</div></section></div>`;
}
/** Tickets use the card workspace; status, details and editors share the existing handlers. */
function renderTickets() {
  const rows = filteredTickets(),
    tools = `<input id="ticketSearch" type="search" value="${esc(filterState.query)}" placeholder="Search ticket, description, PIC or history" aria-label="Search tickets"><select id="statusFilter" aria-label="Filter ticket status">${selectOptions(OPTIONS.status, filterState.status, 'All statuses')}</select><select id="objectFilter" aria-label="Filter ticket object">${selectOptions(OPTIONS.object, filterState.object, 'All objects')}</select><select id="priorityFilter" aria-label="Filter ticket priority">${selectOptions(OPTIONS.priority, filterState.priority, 'All priorities')}</select>`;
  const heading = `<div class="workspace-heading"><div><span class="eyebrow">Ticket workspace</span><h2>A clearer view of your support queue</h2><p>Track priorities, ownership and the latest update in one place.</p></div><button class="primary" data-action="new" data-group="tickets">+ Add ticket</button></div>`;
  return `<div class="workspace-v10 tickets-workspace">${heading}${stats()}${pendingObjectCounts()}<section class="panel"><div class="workspace-toolbar">${tools}</div><div class="workspace-results">${rows.length} of ${state.tickets.length} tickets</div><div class="ticket-board">${
    rows
      .map(ticket => {
        const progress = progressFor(ticket.ticket),
          complete = progress?.steps.filter(Boolean).length || 0;
        return WorkHubTicketWorkspace.card(ticket, {
          complete,
          total: STEPS.length,
          priorityClass: statusClass(ticket.priority),
          priorityTag: tag(ticket.priority),
          statusOptions: selectOptions(OPTIONS.status, ticket.status, 'Choose status'),
          latest: latestHistory(ticket),
          checked: checked(ticket),
        });
      })
      .join('') ||
    '<div class="workspace-empty"><strong>Your queue is clear</strong><p>Add a ticket or adjust your filters.</p></div>'
  }</div></section></div>`;
}
const scheduleRenderV10 = renderSchedule;
renderSchedule = function () {
  return `<div class="workspace-v10 schedule-workspace">${scheduleRenderV10().replace('Bookings and project Go-Live milestones stay synchronized automatically.', 'Plan to the minute. Open an activity to review its details, then choose Edit when you need to make a change.').replace('01:00–24:00 ·', '00:00–24:00 ·').replace('<div class="schedule-view-switch"><button class="active" data-action="schedule-layout"', '<button class="small" data-action="schedule-today">Today</button><div class="schedule-view-switch"><button class="active" data-action="schedule-layout"')}</div>`;
};
function renderScheduleGrid() {
  const days = monthDates(month),
    selected = days.includes(scheduleDay)
      ? scheduleDay
      : days.includes(today())
        ? today()
        : days[0],
    first = weekStart(selected),
    week = rangeDates(first, shiftDate(first, 6));
  scheduleDay = selected;
  return `<section class="panel"><div class="panel-top"><div><span class="eyebrow">Week time grid</span><h2>${esc(first)} → ${esc(week.at(-1))}</h2><p class="muted">Exact times appear on every activity. Select one to view its details.</p></div><div class="actions"><button data-action="schedule-week" data-step="-7">Previous week</button><button data-action="schedule-today">Today</button><button data-action="schedule-week" data-step="7">Next week</button><button class="primary" data-action="schedule-add-day">+ Plan activity</button></div></div><div class="scroll precision-grid"><table><thead><tr><th>Hour</th>${week
    .map(
      date =>
        `<th>${esc(new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }))}${goLiveProjectsOn(
          date
        )
          .map(project => goLiveScheduleCard(project, true))
          .join('')}</th>`
    )
    .join('')}</tr></thead><tbody>${Array.from(
    { length: 24 },
    (_, hour) =>
      `<tr><th>${hourTime(hour)}</th>${week
        .map(date => {
          const entries = scheduleEntries(date).filter(
            entry =>
              timeMinutes(entry.time) < (hour + 1) * 60 &&
              timeMinutes(entry.endTime, true) > hour * 60
          );
          return `<td>${entries.length ? entries.map(entry => scheduleEntryCard(entry, true)).join('') : `<button class="grid-add" data-action="new-grid-booking" data-date="${date}" data-time="${hourTime(hour)}" aria-label="Plan ${date} at ${hourTime(hour)}">+</button>`}</td>`;
        })
        .join('')}</tr>`
  ).join(
    ''
  )}</tbody></table></div><div class="footerline">A long activity appears in each hour it occupies. Each card opens the same saved booking.</div></section>`;
}
function shiftDate(date, days) {
  const value = new Date(date + 'T12:00:00');
  value.setDate(value.getDate() + days);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}
const workhubActionV10Base = workhubAction;
workhubAction = function (button) {
  const action = button.dataset.action;
  if (action === 'edit-project' && tab === 'schedule') {
    const project = state.projects.find(project => project.id === button.dataset.id);
    if (!project) throw Error('Project not found.');
    openModal(
      'Go-Live milestone',
      `<div class="booking-view-hero"><span class="eyebrow">Project milestone</span><h3>${esc(project.name)}</h3><p>Go-Live · ${esc(project.goLiveDate)}</p>${tag(project.phase)}</div><p class="muted">This milestone comes from the project record and does not reserve working time.</p><div class="modal-actions"><button data-action="cancel">Close</button><button class="primary" data-action="edit-schedule-milestone" data-id="${esc(project.id)}">Edit milestone</button></div>`
    );
    return true;
  }
  if (action === 'edit-schedule-milestone') {
    editProject(button.dataset.id);
    return true;
  }
  if (action === 'open-booking') {
    viewBooking(button.dataset.date, button.dataset.time);
    return true;
  }
  if (action === 'edit-booking') {
    openRangeEditor(button.dataset.date, button.dataset.time);
    return true;
  }
  if (action === 'new-grid-booking') {
    openRangeEditor(button.dataset.date, button.dataset.time, '', true);
    return true;
  }
  if (action === 'new-task-sub' || action === 'edit-task-sub') {
    editTaskSub(button.dataset.parent, action === 'edit-task-sub' ? button.dataset.id : '');
    return true;
  }
  if (action === 'delete-task-sub') {
    if (confirm('Delete this sub-task and its remarks and feedback?')) {
      mutate(d => {
        const task = d.tasks.find(task => task.id === button.dataset.parent);
        if (!task) throw Error('Main task not found.');
        task.subTasks = task.subTasks.filter(sub => sub.id !== button.dataset.id);
      });
      closeModal();
      tell('Sub-task deleted.');
    }
    return true;
  }
  if (action === 'schedule-today' || action === 'schedule-week') {
    scheduleDay =
      action === 'schedule-today'
        ? today()
        : shiftDate(scheduleDay || month + '-01', Number(button.dataset.step));
    month = scheduleDay.slice(0, 7);
    render();
    return true;
  }
  if (action === 'booking-duration') {
    const form = button.form,
      start = timeMinutes(form.elements.namedItem('time').value),
      portion = form.elements.namedItem('leavePortion');
    if (portion) portion.value = 'custom';
    setBookingEnd(form, minuteTime(Math.min(1440, start + Number(button.dataset.minutes))));
    return true;
  }
  return workhubActionV10Base(button);
};
const workhubChangeV10Base = workhubChange;
workhubChange = function (element) {
  if (element.id === 'bookingEndClock') {
    setBookingEnd(element.form, element.value);
    return true;
  }
  if (element.id === 'bookingMidnight') {
    setBookingEnd(
      element.form,
      element.checked ? '24:00' : element.form.elements.namedItem('endClock').value
    );
    return true;
  }
  if (element.id === 'bookingStart') {
    const form = element.form;
    if (form.elements.namedItem('endTime').value <= element.value)
      setBookingEnd(form, minuteTime(Math.min(1440, timeMinutes(element.value) + 60)));
    updateBookingDuration(form);
    return true;
  }
  return workhubChangeV10Base(element);
};
document.addEventListener('submit', event => {
  if (event.target.id !== 'taskSubForm') return;
  event.preventDefault();
  try {
    saveTaskSub(event.target);
  } catch (error) {
    tell(error.message, true);
  }
});
document.addEventListener('input', event => {
  if (
    ['bookingStart', 'bookingDate', 'bookingEndDate', 'bookingEndClock'].includes(event.target.id)
  ) {
    if (event.target.id === 'bookingEndClock')
      event.target.form.elements.namedItem('endTime').value = event.target.value;
    updateBookingDuration(event.target.form);
  }
});
const reportModelV10Base = reportModel;
reportModel = function (d, asof) {
  const models = reportModelV10Base(d, asof),
    tasks = models.find(model => model.name === 'Tasks'),
    items = models.find(model => model.name === 'Project items'),
    schedule = models.find(model => model.name === 'Schedule');
  schedule.headers.push('End time', 'Duration (minutes)');
  schedule.widths.push(16, 22);
  const slots = d.schedule.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  schedule.rows.forEach((row, index) => row.push(slotEnd(slots[index]), slotMinutes(slots[index])));
  tasks.headers.push(
    'Record type',
    'Main task ID',
    'Main title',
    'Sub-task ID',
    'Sub-task',
    'Sub-task status',
    'Sub-task remarks',
    'Sub-task feedback'
  );
  tasks.widths.push(20, 24, 65, 24, 65, 22, 70, 70);
  tasks.rows.forEach((row, index) =>
    row.push('Main task', d.tasks[index].id, d.tasks[index].task, '', '', '', '', '')
  );
  for (const task of d.tasks)
    for (const sub of task.subTasks || [])
      tasks.rows.push([
        ...Array(15).fill(''),
        'Sub-task',
        task.id,
        task.task,
        sub.id,
        sub.title,
        sub.status,
        sub.remarks,
        sub.feedback,
      ]);
  items.headers.push(
    'Record type',
    'Parent item ID',
    'Main title',
    'Sub-item ID',
    'Sub-item',
    'Sub-item status',
    'Sub-item owner',
    'Sub-item due date',
    'Sub-item remarks',
    'Item feedback'
  );
  items.widths.push(20, 24, 65, 24, 65, 22, 28, 20, 70, 70);
  items.rows.forEach((row, index) =>
    row.push(
      'Project item',
      d.specs[index].id,
      d.specs[index].description,
      '',
      '',
      '',
      '',
      '',
      '',
      d.specs[index].feedback || ''
    )
  );
  for (const item of d.specs)
    for (const sub of item.subItems || [])
      items.rows.push([
        ...Array(20).fill(''),
        'Sub-item',
        item.id,
        item.description,
        sub.id,
        sub.title,
        sub.status,
        sub.owner,
        sub.dueDate,
        sub.remarks,
        sub.feedback || '',
      ]);
  return models;
};

// The workbook is built locally as OOXML inside a ZIP, without network access.
// =============================================================================
// 6. Local workbook/ZIP export utilities
// =============================================================================
const encoder = new TextEncoder();
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
/** Small uncompressed ZIP writer used for generated Excel files. JSZip separately reads compressed uploads. */
function zip(files) {
  const parts = [],
    central = [];
  let offset = 0;
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const [name, content] of Object.entries(files)) {
    const fn = encoder.encode(name),
      data = encoder.encode(content),
      crc = crc32(data),
      h = new Uint8Array(30 + fn.length),
      v = new DataView(h.buffer);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(10, time, true);
    v.setUint16(12, date, true);
    v.setUint32(14, crc, true);
    v.setUint32(18, data.length, true);
    v.setUint32(22, data.length, true);
    v.setUint16(26, fn.length, true);
    h.set(fn, 30);
    parts.push(h, data);
    const c = new Uint8Array(46 + fn.length),
      cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, fn.length, true);
    cv.setUint32(42, offset, true);
    c.set(fn, 46);
    central.push(c);
    offset += h.length + data.length;
  }
  const size = central.reduce((n, c) => n + c.length, 0),
    end = new Uint8Array(22),
    ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, size, true);
  ev.setUint32(16, offset, true);
  parts.push(...central, end);
  return new Blob(parts, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const xmlHeader = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
  sheetNS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
function colName(n) {
  let s = '';
  for (n++; n; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}
function dateCell(s) {
  if (!s) return '';
  return {
    value:
      Math.floor((Date.parse(s + 'T00:00:00Z') - Date.UTC(1899, 11, 31)) / 86400000) +
      (s >= '1900-03-01' ? 1 : 0),
    style: 2,
  };
}
function makeCell(v, x, y, header = false) {
  const ref = colName(x) + (y + 1);
  if (v === null || v === undefined) v = '';
  const obj = typeof v === 'object' ? v : { value: v },
    style = header ? 1 : obj.style || 0;
  if (obj.formula) return `<c r="${ref}" s="${style}"><f>${esc(obj.formula)}</f></c>`;
  const value = obj.value;
  if (typeof value === 'number') return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  if (typeof value === 'boolean')
    return `<c r="${ref}" s="${style}" t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
}
function workbookSheets(d) {
  const mainFields = [
    'ticket',
    'jira',
    'description',
    'created',
    'priority',
    'pic',
    'history',
    'status',
    'object',
    'action',
    'transport',
    'historyDate',
    'historyTime',
    'type',
    'mandays',
  ];
  const main = [
    [
      'AMS Ticket',
      'JIRA Ticket / Charge Code',
      'Description',
      'Date Created',
      'Priorities',
      'PIC',
      'History tracker',
      'Status',
      'Object',
      'Action',
      'Latest Transport',
      'Date',
      'Time',
      'Type',
      'Mandays Chargable',
      'Last Checked',
    ],
    ...d.tickets.map((t, i) => [
      ...mainFields.map(k =>
        ['created', 'historyDate'].includes(k)
          ? dateCell(t[k])
          : k === 'history'
            ? { value: t[k], style: 3 }
            : t[k]
      ),
      {
        formula: `IF(OR(H${i + 2}="Closed",H${i + 2}="On Hold",L${i + 2}=""),"",L${i + 2}-TODAY())`,
      },
    ]),
  ];
  const tracker = [
    ['Ticket', 'JIRA', 'Description', 'On Hold', ...STEPS, 'Progress', '%', 'Status', 'Remarks'],
    ...d.trackers.map((t, i) => {
      const r = i + 2,
        p = `COUNTIF(E${r}:P${r},TRUE)/COUNTA(E${r}:P${r})`,
        source = d.tickets.find(x => x.ticket === t.ticket);
      return [
        t.ticket,
        source?.jira || '',
        source?.description || '',
        t.onHold,
        ...t.steps,
        { formula: p, style: 4 },
        { formula: p, style: 4 },
        {
          formula: `IF(D${r},"On Hold",IF(Q${r}=1,"Completed",IF(Q${r}=0,"Not started yet","Work In Progress")))`,
        },
        { value: t.remarks, style: 3 },
      ];
    }),
  ];
  const tasks = [
    ['No.', 'Task', 'Done?', 'Date done', 'Remarks', 'Feedback'],
    ...d.tasks.map(t => [
      t.number,
      { value: t.task, style: 3 },
      t.done,
      dateCell(t.doneDate),
      { value: t.remarks, style: 3 },
      { value: t.feedback, style: 3 },
    ]),
  ];
  const dates = [
    ...new Set([...monthDates(d.calendarMonth), ...d.schedule.map(r => r.date)]),
  ].sort();
  const calendar = [
    ['Time', ...dates.map(dateCell)],
    ...Array.from({ length: 15 }, (_, i) => {
      const time = String(i + 9).padStart(2, '0') + ':00';
      return [
        time,
        ...dates.map(date => ({
          value: scheduleDisplayText(
            d.schedule.find(s => s.date === date && s.time === time),
            d
          ),
          style: 3,
        })),
      ];
    }),
  ];
  const lists = [
    [
      'Tickets / Projects',
      'Ticket activities',
      'Project activities',
      'Project name',
      'Project code',
      'Active',
    ],
    ...Array.from(
      {
        length: Math.max(
          d.lists.codes.length,
          d.lists.ticketActivities.length,
          d.lists.projectActivities.length,
          d.projects.length
        ),
      },
      (_, i) => [
        d.lists.codes[i] || '',
        d.lists.ticketActivities[i] || '',
        d.lists.projectActivities[i] || '',
        d.projects[i]?.name || '',
        d.projects[i]?.code || '',
        d.projects[i] ? d.projects[i].id === d.activeProjectId : '',
      ]
    ),
  ];
  const specs = [
    [
      'Item type',
      'Item ID',
      'Description',
      'Status',
      'Remarks',
      'Priority',
      'Reference File',
      'Reference Link',
      'Project',
      'Project code',
    ],
    ...d.specs.map(r => {
      const p = d.projects.find(p => p.id === r.projectId);
      return [
        r.itemType || 'RICEFW ID',
        r.itemId ?? r.ricefw ?? '',
        { value: r.description, style: 3 },
        r.status,
        { value: r.remarks, style: 3 },
        r.priority,
        r.reference,
        r.url,
        p?.name || '',
        p?.code || '',
      ];
    }),
  ];
  return [
    {
      name: 'Main',
      rows: main,
      widths: [24, 25, 60, 15, 14, 24, 95, 16, 16, 24, 17, 15, 15, 23, 23, 18],
    },
    {
      name: 'Ticket tracker',
      rows: tracker,
      widths: [24, 25, 60, 16, ...STEPS.map(() => 18), 17, 12, 25, 60],
    },
    { name: 'Task', rows: tasks, widths: [10, 75, 12, 16, 55, 55] },
    { name: 'Date', rows: calendar, widths: [14, ...dates.map(() => 30)], dateHeader: true },
    { name: 'Built-In lists', rows: lists, widths: [27, 35, 35, 30, 27, 12] },
    { name: 'SAP Projects', rows: specs, widths: [24, 22, 65, 24, 65, 14, 24, 85, 30, 27] },
  ];
}
function exportXlsx(d) {
  const sheets = workbookSheets(d),
    files = {};
  files['[Content_Types].xml'] =
    `${xmlHeader}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`;
  files['_rels/.rels'] =
    `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  files['xl/workbook.xml'] =
    `${xmlHeader}<workbook xmlns="${sheetNS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1" forceFullCalc="1"/></workbook>`;
  files['xl/_rels/workbook.xml.rels'] =
    `${xmlHeader}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  files['xl/styles.xml'] =
    `${xmlHeader}<styleSheet xmlns="${sheetNS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1B3353"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="9" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="14" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  sheets.forEach((s, i) => {
    const end = colName(s.rows[0].length - 1) + s.rows.length;
    files[`xl/worksheets/sheet${i + 1}.xml`] =
      `${xmlHeader}<worksheet xmlns="${sheetNS}"><dimension ref="A1:${end}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${s.widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${s.rows.map((r, y) => `<row r="${y + 1}"${y === 0 ? ' ht="28" customHeight="1"' : ''}>${r.map((v, x) => makeCell(y === 0 && s.dateHeader && x > 0 ? { ...v, style: 5 } : v, x, y, y === 0 && !(s.dateHeader && x > 0))).join('')}</row>`).join('')}</sheetData>${s.name === 'Date' ? '' : `<autoFilter ref="A1:${end}"/>`}</worksheet>`;
  });
  return zip(files);
}
// Raw workbook models retain precise-time/subtask compatibility for export utilities.
const REPORT_STEPS = [
  'Analysing/Designing',
  'Functional Spec',
  'Sr Review',
  'ABAP Estimation',
  'ADL Approval Dev',
  'ABAP Dev',
  'ABAP Fixing',
  'Unit Testing',
  'UAT',
  'External Approval',
  'BASIS',
  'FMP',
];
const reportSerial = s =>
  s
    ? Math.floor((Date.parse(s + 'T00:00:00Z') - Date.UTC(1899, 11, 31)) / 86400000) +
      (s >= '1900-03-01' ? 1 : 0)
    : '';
const reportLatest = t =>
  (t.history || '')
    .trim()
    .split(/\r?\n(?=\s*-\s)/)
    .at(-1) || '';

const rf = (formula, value) => ({ formula, value });
function reportModel(d, asof) {
  const steps = d.lists.milestones || REPORT_STEPS,
    tracker = t => d.trackers.find(r => r.ticket === t.ticket),
    closed = s => s === 'Closed' || s === 'Completed',
    ps = p =>
      p.onHold
        ? 'On Hold'
        : p.steps.every(Boolean)
          ? 'Completed'
          : p.steps.some(Boolean)
            ? 'Work In Progress'
            : 'Not started yet',
    itemRef = s =>
      s ? [s.itemType || 'RICEFW ID', s.itemId ?? s.ricefw ?? ''].filter(Boolean).join(' · ') : '';
  const sheet = (name, headers, rows, widths, kinds = {}) => ({
    name,
    headers,
    rows,
    widths,
    kinds,
  });
  const tickets = sheet(
    'Tickets',
    [
      'ID',
      'AMS Ticket',
      'JIRA / Charge code',
      'Description',
      'Created',
      'Priority',
      'PIC',
      'Status',
      'Object',
      'Action',
      'Transport',
      'Type',
      'Mandays',
      'Full history',
      'History date',
      'History time',
      'Latest update',
      'Days since last check',
      'Milestones complete',
      'Progress %',
      'Progress status',
    ],
    d.tickets.map((t, i) => {
      const r = i + 5,
        p = tracker(t),
        n = p?.steps.filter(Boolean).length || 0;
      return [
        t.id,
        t.ticket,
        t.jira,
        t.description,
        reportSerial(t.created),
        t.priority,
        t.pic,
        t.status,
        t.object,
        t.action,
        t.transport,
        t.type,
        t.mandays ?? '',
        t.history,
        reportSerial(t.historyDate),
        t.historyTime,
        reportLatest(t),
        rf(
          `IF(OR(H${r}="Closed",H${r}="Completed",H${r}="On Hold",O${r}=""),"",'Dashboard'!$C$3-O${r})`,
          closed(t.status) || t.status === 'On Hold' || !t.historyDate
            ? ''
            : reportSerial(asof) - reportSerial(t.historyDate)
        ),
        rf(`SUMIFS('Milestones'!$P$5:$P$5004,'Milestones'!$B$5:$B$5004,B${r})`, n),
        rf(`S${r}/${steps.length}`, n / steps.length),
        rf(
          `IFERROR(INDEX('Milestones'!$R$5:$R$5004,MATCH(B${r},'Milestones'!$B$5:$B$5004,0)),"No tracker")`,
          p ? ps(p) : 'No tracker'
        ),
      ];
    }),
    [22, 21, 24, 65, 16, 14, 24, 24, 18, 22, 16, 22, 14, 95, 16, 16, 80, 24, 24, 16, 24],
    { 4: 'date', 14: 'date', 19: 'percent', 12: 'decimal', 17: 'number', 18: 'number' }
  );
  const milestones = sheet(
    'Milestones',
    [
      'ID',
      'Ticket',
      'On Hold',
      ...steps,
      'Complete count',
      'Progress %',
      'Progress status',
      'Remarks',
    ],
    d.trackers.map((p, i) => {
      const r = i + 5,
        n = p.steps.filter(Boolean).length;
      return [
        p.id,
        p.ticket,
        p.onHold,
        ...p.steps,
        rf(`SUMPRODUCT(--(D${r}:O${r}=TRUE))`, n),
        rf(`P${r}/${steps.length}`, n / steps.length),
        rf(
          `IF(C${r},"On Hold",IF(P${r}=${steps.length},"Completed",IF(P${r}=0,"Not started yet","Work In Progress")))`,
          ps(p)
        ),
        p.remarks,
      ];
    }),
    [22, 21, 14, ...steps.map(() => 23), 19, 16, 25, 65],
    { 16: 'percent', 15: 'number' }
  );
  const tasks = sheet(
    'Tasks',
    [
      'ID',
      'No.',
      'Task',
      'Priority',
      'Due date',
      'Done',
      'Date done',
      'Archived',
      'Archived on',
      'Remarks',
      'Feedback',
      'Task status',
      'Task type',
      'Linked ID',
      'Linked to',
    ],
    d.tasks.map((t, i) => {
      const r = i + 5,
        status = t.archived
          ? 'Archived'
          : t.done
            ? 'Completed'
            : t.dueDate && t.dueDate < asof
              ? 'Overdue'
              : 'Open',
        linked =
          t.taskType === 'Project'
            ? d.projects.find(p => p.id === t.linkId)?.name || ''
            : t.taskType === 'Ticket'
              ? d.tickets.find(x => x.id === t.linkId)?.ticket || ''
              : t.customLink;
      return [
        t.id,
        t.number,
        t.task,
        t.priority,
        reportSerial(t.dueDate),
        t.done,
        reportSerial(t.doneDate),
        t.archived,
        reportSerial(t.archivedAt),
        t.remarks,
        t.feedback,
        rf(
          `IF(H${r},"Archived",IF(F${r},"Completed",IF(AND(E${r}<>"",E${r}<'Dashboard'!$C$3),"Overdue","Open")))`,
          status
        ),
        t.taskType,
        t.linkId,
        linked,
      ];
    }),
    [22, 10, 75, 14, 16, 12, 16, 14, 16, 65, 65, 18, 16, 24, 45],
    { 4: 'date', 6: 'date', 8: 'date' }
  );
  const weekend = date => [0, 6].includes(new Date(date + 'T12:00:00').getDay()),
    toil = s =>
      weekend(s.date) &&
      (s.kind === 'project' ||
        (s.kind === 'task' &&
          ['Project', 'Ticket'].includes(d.tasks.find(t => t.id === s.linkId)?.taskType)));
  const schedule = sheet(
    'Schedule',
    [
      'Date',
      'Time',
      'Type',
      'Linked ID',
      'Task / Project',
      'Project activity',
      'Notes',
      'Booking ID',
      'Project plan ID',
      'Work location',
      'Plan status',
      'TOIL',
    ],
    d.schedule
      .slice()
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(s => {
        const plan = d.projectPlans.find(p => p.id === s.planId);
        return [
          reportSerial(s.date),
          timeMinutes(s.time) / 1440,
          s.kind,
          s.linkId,
          s.kind === 'task'
            ? d.tasks.find(t => t.id === s.linkId)?.task || ''
            : s.kind === 'project'
              ? d.projects.find(p => p.id === s.linkId)?.name || ''
              : '',
          s.kind === 'project' ? plan?.activity || s.activity : '',
          s.text,
          s.bookingId,
          s.planId,
          s.location,
          plan?.status || '',
          toil(s),
        ];
      }),
    [16, 14, 16, 24, 65, 40, 70, 24, 24, 20, 18, 12],
    { 0: 'date', 1: 'time' }
  );
  const projects = sheet(
    'Projects',
    [
      'ID',
      'Project',
      'Charge code',
      'Active',
      'Project items',
      'Completed items',
      'Completion %',
      'Planned activities',
      'Current phase',
      'Phase %',
      'Go-Live date',
      'Days to Go-Live',
      'Health',
      'Next milestone',
      'Companies & roles',
      'Process mappings & decisions',
      'Phase gates',
    ],
    d.projects.map((p, i) => {
      const r = i + 5,
        items = d.specs.filter(s => s.projectId === p.id),
        n = items.filter(s => s.status === 'Completed').length,
        phaseIndex = d.lists.projectPhases.indexOf(p.phase),
        phaseRate = phaseIndex < 0 ? 0 : phaseIndex / Math.max(1, d.lists.projectPhases.length - 1),
        companies = d.projectCompanies.filter(c => c.projectId === p.id),
        companyText = companies.map(c => `${c.name}: ${c.role || 'Role not supplied'}`).join('\n'),
        mappingText = (d.projectProcessMappings || [])
          .filter(x => x.projectId === p.id)
          .map(x => {
            const company = companies.find(c => c.id === x.companyId)?.name || 'Unknown company';
            return `${company} · ${x.area} · ${x.code || x.item}: ${x.item} [${x.decision}] · ${x.department}`;
          })
          .join('\n'),
        gateText = d.phaseGates
          .filter(g => g.projectId === p.id)
          .map(g => {
            const company = companies.find(c => c.id === g.companyId)?.name || 'Project-wide';
            return `[${g.status || (g.done ? 'Completed' : 'Pending')}] ${g.phase} · ${company}: ${g.text}`;
          })
          .join('\n'),
        health =
          typeof projectHealthDetails === 'function'
            ? projectHealthDetails(p.id, d, asof).status
            : p.health;
      return [
        p.id,
        p.name,
        p.code,
        p.id === d.activeProjectId,
        rf(`COUNTIFS('Project items'!$N$5:$N$5004,A${r})`, items.length),
        rf(
          `COUNTIFS('Project items'!$N$5:$N$5004,A${r},'Project items'!$G$5:$G$5004,"Completed")`,
          n
        ),
        rf(`IF(E${r}=0,0,F${r}/E${r})`, items.length ? n / items.length : 0),
        rf(
          `COUNTIFS('Project plans'!$B$5:$B$5004,A${r})`,
          d.projectPlans.filter(x => x.projectId === p.id).length
        ),
        p.phase,
        phaseRate,
        reportSerial(p.goLiveDate),
        p.goLiveDate
          ? Math.round(
              (Date.parse(p.goLiveDate + 'T00:00:00Z') - Date.parse(asof + 'T00:00:00Z')) / 86400000
            )
          : '',
        health,
        p.nextMilestone,
        companyText,
        mappingText,
        gateText,
      ];
    }),
    [24, 38, 25, 12, 20, 22, 20, 23, 28, 16, 18, 20, 16, 55, 70, 115, 95],
    { 4: 'number', 5: 'number', 6: 'percent', 7: 'number', 9: 'percent', 10: 'date', 11: 'number' }
  );
  const items = sheet(
    'Project items',
    [
      'ID',
      'Item type',
      'Item ID',
      'Company ID',
      'Company',
      'Description',
      'Status',
      'Priority',
      'Expected date',
      'Due date',
      'Remarks',
      'Reference file',
      'Reference link',
      'Project ID',
      'Project',
      'Phase Feedback',
      'Linked actions',
      'Sub-items',
      'Sub-items completed',
      'Sub-item details',
    ],
    d.specs.map(s => {
      const feedback = (d.projectFeedback || []).filter(f => f.ricefwIds?.includes(s.id)),
        feedbackText = feedback.map(f => `[${f.status}] ${f.phase} · ${f.summary}`).join('\n'),
        actions = feedback
          .flatMap(f => f.links || [])
          .map(x => `${x.type}: ${x.label}`)
          .join('\n'),
        subItems = s.subItems || [],
        subDetails = subItems
          .map(
            x =>
              `[${x.status}] ${x.title}${x.owner ? ' · ' + x.owner : ''}${x.dueDate ? ' · Due ' + x.dueDate : ''}`
          )
          .join('\n');
      return [
        s.id,
        s.itemType || 'RICEFW ID',
        s.itemId ?? s.ricefw ?? '',
        s.companyId || '',
        d.projectCompanies.find(c => c.id === s.companyId)?.name || '',
        s.description,
        s.status,
        s.priority,
        reportSerial(s.expectedDate),
        reportSerial(s.dueDate),
        s.remarks,
        s.reference,
        s.url,
        s.projectId,
        d.projects.find(p => p.id === s.projectId)?.name || '',
        feedbackText,
        actions,
        subItems.length,
        subItems.filter(x => x.status === 'Completed').length,
        subDetails,
      ];
    }),
    [22, 24, 23, 24, 38, 65, 25, 14, 18, 18, 65, 30, 70, 24, 38, 90, 90, 16, 22, 100],
    { 8: 'date', 9: 'date', 17: 'number', 18: 'number' }
  );
  const plans = sheet(
    'Project plans',
    [
      'ID',
      'Project ID',
      'Project',
      'Activity title',
      'Project activity',
      'Date',
      'Start',
      'End',
      'Status',
      'Notes',
      'Created in',
      'End date',
      'Work location',
      'Actual task',
      'Same as planned',
      'Actual reviewed at',
      'TOIL',
    ],
    d.projectPlans
      .slice()
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .map(p => [
        p.id,
        p.projectId,
        d.projects.find(x => x.id === p.projectId)?.name || '',
        p.title,
        p.activity,
        reportSerial(p.date),
        timeMinutes(p.time) / 1440,
        timeMinutes(p.endTime, true) / 1440,
        p.status,
        p.text,
        p.source,
        reportSerial(p.endDate || p.date),
        p.location,
        p.actualTask,
        p.actualSame === null ? '' : p.actualSame,
        p.actualReviewedAt,
        rangeDates(p.date, p.endDate || p.date).some(weekend),
      ]),
    [24, 24, 38, 60, 25, 16, 14, 14, 20, 65, 18, 16, 20, 70, 18, 28, 12],
    { 5: 'date', 6: 'time', 7: 'time', 11: 'date' }
  );
  const governanceHeaders = [
    'Record type',
    'Project ID',
    'Project',
    'Company ID',
    'Company',
    'Company role',
    'Area / list',
    'Item / value',
    'Code / Process ID',
    'Description / criterion',
    'Responsible department',
    'Decision / status',
    'Version',
    'Source file',
    'Source sheet',
    'Source row',
    'Imported at',
    'Phase',
    'Owner / raised by',
    'Target / raised date',
    'Priority',
    'Resolution / skip reason',
    'Project item links',
    'Linked actions',
    'History',
  ];
  const governanceRows = [
    ...(d.projectProcessMappings || []).map(m => {
      const company = d.projectCompanies.find(c => c.id === m.companyId);
      return [
        'Process mapping',
        m.projectId,
        d.projects.find(p => p.id === m.projectId)?.name || '',
        m.companyId,
        company?.name || '',
        company?.role || '',
        m.area,
        m.item,
        m.code,
        m.description,
        m.department,
        m.decision,
        m.proposalVersion,
        m.sourceFile,
        m.sourceSheet,
        m.sourceRow,
        m.importedAt,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ];
    }),
    ...d.projectCompanies.map(c => [
      'Company',
      c.projectId,
      d.projects.find(p => p.id === c.projectId)?.name || '',
      c.id,
      c.name,
      c.role,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ]),
    ...[
      ['Ticket milestones', d.lists.milestones],
      ['Project activities', d.lists.projectActivities],
      ['Work locations', d.lists.workLocations],
      ['Project phases', d.lists.projectPhases],
      ['Project item types', d.lists.projectItemTypes || []],
      ['Responsible departments', d.lists.departments || []],
      ['Organization structure items', d.lists.organizationObjects || []],
      ['Master data items', d.lists.masterDataObjects || []],
      ['Phase Feedback categories', d.lists.feedbackCategories || []],
    ].flatMap(([name, values]) =>
      values.map(value => [
        'Built-in list',
        '',
        '',
        '',
        '',
        '',
        name,
        value,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ])
    ),
    ...d.lists.projectPhases.flatMap(phase =>
      (d.lists.phaseGateCriteria?.[phase] || []).map(text => [
        'Phase-gate criterion',
        '',
        '',
        '',
        '',
        '',
        phase,
        '',
        '',
        text,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        phase,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
      ])
    ),
    ...d.phaseGates.map(g => {
      const company = d.projectCompanies.find(c => c.id === g.companyId);
      return [
        'Phase gate',
        g.projectId,
        d.projects.find(p => p.id === g.projectId)?.name || '',
        g.companyId || '',
        company?.name || 'Project-wide',
        company?.role || '',
        g.phase,
        g.text,
        '',
        '',
        '',
        g.status || (g.done ? 'Completed' : 'Pending'),
        '',
        '',
        '',
        '',
        '',
        g.phase,
        g.owner || '',
        g.targetDate || '',
        '',
        g.skipReason || '',
        '',
        '',
        '',
      ];
    }),
    ...(d.projectFeedback || []).map(f => {
      const company = d.projectCompanies.find(c => c.id === f.companyId),
        ricefw = (f.ricefwIds || [])
          .map(id => itemRef(d.specs.find(s => s.id === id)) || id)
          .join(', '),
        links = (f.links || []).map(x => `${x.type}: ${x.label}`).join('\n'),
        history = (f.history || []).map(h => `${h.date} ${h.time} · ${h.action}`).join('\n');
      return [
        'Phase feedback',
        f.projectId,
        d.projects.find(p => p.id === f.projectId)?.name || '',
        f.companyId || '',
        company?.name || 'Project-wide',
        company?.role || '',
        f.category,
        f.summary,
        '',
        f.details,
        f.department,
        f.status,
        '',
        f.referenceLabel || '',
        f.referenceUrl || '',
        '',
        f.updatedAt,
        f.phase,
        [f.owner, f.raisedBy].filter(Boolean).join(' / '),
        f.dueDate || f.raisedDate,
        f.priority,
        f.resolution,
        ricefw,
        links,
        history,
      ];
    }),
    ...d.projectDecisions.map(x => [
      'Legacy decision',
      x.projectId,
      d.projects.find(p => p.id === x.projectId)?.name || '',
      x.companyId,
      d.projectCompanies.find(c => c.id === x.companyId)?.name || '',
      '',
      x.category,
      x.decision,
      '',
      x.owner,
      '',
      x.status,
      '',
      '',
      x.date,
      '',
      '',
      '',
      x.owner,
      x.date,
      '',
      '',
      '',
      '',
      '',
    ]),
  ];
  const governance = sheet(
    'Project governance',
    governanceHeaders,
    governanceRows,
    [
      24, 24, 38, 24, 38, 45, 30, 55, 24, 70, 34, 22, 14, 36, 24, 14, 28, 28, 34, 20, 16, 70, 55,
      90, 110,
    ],
    { 12: 'number', 15: 'number' }
  );
  const history = sheet(
    'History',
    ['Ticket ID', 'AMS Ticket', 'Entry no.', 'History entry'],
    d.tickets.flatMap(t =>
      (t.history || '').trim()
        ? t.history
            .trim()
            .split(/\r?\n(?=\s*-\s)/)
            .map((entry, i) => [t.id, t.ticket, i + 1, entry])
        : []
    ),
    [24, 21, 14, 120],
    { 2: 'number' }
  );
  return [tickets, milestones, tasks, schedule, projects, items, plans, governance, history];
}
function reportDashboard(d, asof) {
  const serial = reportSerial(asof),
    rng = (s, c) => `'${s}'!$${c}$5:$${c}$5004`,
    count = (s, c, v) => `COUNTIFS(${rng(s, c)},"${v}")`,
    nstatus = s => d.tickets.filter(t => t.status === s).length,
    closed = nstatus('Closed') + nstatus('Completed'),
    arch = d.tasks.filter(t => t.archived).length,
    done = d.tasks.filter(t => t.done && !t.archived).length,
    open = d.tasks.filter(t => !t.done && !t.archived).length,
    overdue = d.tasks.filter(t => !t.done && !t.archived && t.dueDate && t.dueDate < asof).length;
  const cells = {
    C3: asof,
    B7: rf(`COUNTA(${rng('Tickets', 'B')})`, d.tickets.length),
    G7: rf(`B7-L7`, d.tickets.length - closed),
    L7: rf(`${count('Tickets', 'H', 'Closed')}+${count('Tickets', 'H', 'Completed')}`, closed),
    Q7: rf(`COUNTIFS(${rng('Tasks', 'L')},"Open")+COUNTIFS(${rng('Tasks', 'L')},"Overdue")`, open),
  };
  const statuses = [
    'Pending',
    'On Hold',
    'Closed',
    'not yet started',
    'Work In Progress',
    'Completed',
    'Not started yet',
  ];
  statuses.forEach((s, i) => {
    cells['B' + (13 + i)] = s;
    cells['C' + (13 + i)] = rf(count('Tickets', 'H', s), nstatus(s));
  });
  [
    [
      'Open',
      open,
      `COUNTIFS(${rng('Tasks', 'L')},"Open")+COUNTIFS(${rng('Tasks', 'L')},"Overdue")`,
    ],
    ['Completed', done, `COUNTIFS(${rng('Tasks', 'L')},"Completed")`],
    ['Archived', arch, count('Tasks', 'H', 'TRUE')],
  ].forEach(([s, n, f], i) => {
    cells['L' + (13 + i)] = s;
    cells['M' + (13 + i)] = rf(f, n);
  });
  // Boolean TRUE is emitted as a boolean criterion rather than text.
  cells.M15 = rf(`COUNTIFS(${rng('Tasks', 'L')},"Archived")`, arch);
  cells.L17 = 'Overdue open tasks';
  cells.M17 = rf(`COUNTIFS(${rng('Tasks', 'L')},"Overdue")`, overdue);
  for (let i = 0; i < 7; i++) {
    const date = new Date((serial + i - 25569) * 86400000).toISOString().slice(0, 10),
      r = 30 + i;
    cells['B' + r] = date;
    cells['C' + r] = rf(
      `SUMIFS(${rng('Schedule', 'N')},${rng('Schedule', 'A')},$C$3+${i})/60`,
      d.schedule.filter(s => s.date === date).reduce((sum, slot) => sum + slotMinutes(slot), 0) / 60
    );
  }
  const itemStatuses = [
    'Not yet Started',
    'In Progress',
    'Completed',
    'Testing',
    'Development',
    'UAT',
    'Pending Review',
  ];
  itemStatuses.forEach((s, i) => {
    cells['L' + (30 + i)] = s;
    cells['M' + (30 + i)] = rf(
      count('Project items', 'G', s),
      d.specs.filter(x => x.status === s).length
    );
  });
  cells.B44 = 'Project items completed';
  cells.C44 = rf(
    count('Project items', 'G', 'Completed'),
    d.specs.filter(x => x.status === 'Completed').length
  );
  cells.G44 = 'Total project items';
  cells.H44 = rf(`COUNTA(${rng('Project items', 'A')})`, d.specs.length);
  cells.L44 = 'Upcoming project activities';
  cells.P44 = rf(
    `COUNTIFS(${rng('Project plans', 'L')},">="&$C$3,${rng('Project plans', 'I')},"<>Completed")`,
    d.projectPlans.filter(p => (p.endDate || p.date) >= asof && p.status !== 'Completed').length
  );
  return cells;
}

/** Build the current Excel report through reports.js; validate before exporting. */
function exportReport(d, asof = today(), options = {}) {
  validate(d);
  return WorkHubReports.export(d, { asOf: asof, ...options }, zip);
}
$('exportButton').addEventListener('click', () => {
  try {
    download(
      exportReport(state),
      'MM-Tracker-Report-' + today() + '.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    tell(
      'Excel report downloaded. Dashboard and all records, including archived tasks, are included.'
    );
  } catch (err) {
    tell('Report failed: ' + err.message, true);
  }
});

// Private cloud records, automatic saving, durable upload queue, and revision conflict recovery.
// =============================================================================
// 7. Private account loading, autosave and conflict recovery
// =============================================================================
const cloudConfig = JSON.parse($('cloudConfig').textContent);
const cloud = {
  client: null,
  user: null,
  ready: false,
  revision: 0,
  pending: null,
  inFlight: null,
  busy: false,
  conflict: false,
  status: 'Sign in to open your records.',
  key: '',
  lastCache: null,
  generation: 0,
  loading: false,
  retryTimer: null,
  error: false,
  hasDocument: false,
  changeSerial: 0,
  browserImportDismissed: false,
  baseDocument: null,
  refreshing: false,
  refreshDeferred: false,
};
let legacyBrowserCache = { raw: null, value: null };
function hasTrackerRecords(d) {
  if (
    d.workhub?.recipients?.companies?.length ||
    d.workhub?.validator?.templates?.length ||
    d.workhub?.validator?.runs?.length
  )
    return true;
  return (
    [
      'tickets',
      'tasks',
      'specs',
      'schedule',
      'projectCompanies',
      'projectProcessMappings',
      'projectPlans',
      'phaseGates',
      'projectFeedback',
      'projectDecisions',
    ].some(key => d[key]?.length) ||
    (d.projects || []).some(
      project =>
        project.id !== 'project-default' ||
        project.name !== 'SAP Projects' ||
        project.code ||
        project.goLiveDate
    )
  );
}
function legacyBrowserRecords() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === legacyBrowserCache.raw) return legacyBrowserCache.value;
  legacyBrowserCache = { raw, value: null };
  if (!raw) return null;
  const steps = STEPS.slice();
  try {
    const data = parseBackup(raw);
    if (hasTrackerRecords(data)) legacyBrowserCache.value = { raw, data };
  } catch {
  } finally {
    STEPS.splice(0, STEPS.length, ...steps);
  }
  return legacyBrowserCache.value;
}
function browserMigrationNotice() {
  const panel = $('browserMigrationNotice');
  if (!panel) return;
  let imported = false;
  try {
    imported = localStorage.getItem(cloud.key + ':browser-imported') === 'yes';
  } catch {}
  const legacy =
    cloud.ready && !cloud.browserImportDismissed && !imported ? legacyBrowserRecords() : null;
  panel.hidden = !legacy;
  if (!legacy) {
    panel.innerHTML = '';
    return;
  }
  const canImport = !cloud.hasDocument && !cloud.pending && !cloud.inFlight && !cloud.conflict;
  panel.innerHTML = `<strong>Earlier records are still in this browser.</strong><p>${legacy.data.tickets.length} tickets · ${legacy.data.tasks.length} tasks · ${legacy.data.projects.length} projects · ${legacy.data.projectProcessMappings.length} process mappings.</p><p>${canImport ? `Import them once into <strong>${esc(cloud.user.email || 'this account')}</strong>. Future changes save automatically to Supabase.` : 'Your cloud records are already open or waiting to save. Download the earlier browser backup to review it; Restore can replace cloud records if needed.'}</p><div class="actions">${canImport ? '<button class="primary" data-action="cloud-import-browser">Import browser records</button>' : ''}<button data-action="cloud-download-browser">Download browser backup</button><button data-action="cloud-dismiss-browser">Dismiss</button></div>`;
}
async function browserMigrationAction(action) {
  if (action === 'cloud-dismiss-browser') {
    cloud.browserImportDismissed = true;
    browserMigrationNotice();
    return true;
  }
  if (
    !['cloud-import-browser', 'cloud-apply-browser-import', 'cloud-download-browser'].includes(
      action
    )
  )
    return false;
  const legacy = legacyBrowserRecords();
  if (!legacy)
    throw Error('No earlier browser records were found. Use Restore to import a saved backup.');
  if (action === 'cloud-download-browser') {
    download(legacy.raw, 'MM-Tracker-browser-backup-' + today() + '.json', 'application/json');
    return true;
  }
  if (
    !cloud.user ||
    !cloud.ready ||
    cloud.hasDocument ||
    cloud.pending ||
    cloud.inFlight ||
    cloud.conflict ||
    cloud.revision !== 0
  )
    throw Error(
      'Cloud records already exist or are waiting to save. Download the browser backup before using Restore.'
    );
  if (action === 'cloud-import-browser') {
    openModal(
      'Import earlier browser records',
      `<p>Import the records from this browser into <strong>${esc(cloud.user.email)}</strong>?</p><p>${legacy.data.tickets.length} tickets · ${legacy.data.tasks.length} tasks · ${legacy.data.projects.length} projects · ${legacy.data.specs.length} project items · ${legacy.data.projectProcessMappings.length} process mappings · ${legacy.data.schedule.length} scheduled slots.</p><p class="muted">This is available only while the cloud account is empty. The original browser records will remain available as a recovery copy.</p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" data-action="cloud-apply-browser-import">Import to my account</button></div>`
    );
    return true;
  }
  const ownerId = cloud.user.id,
    generation = cloud.generation,
    row = await fetchCloudRow();
  if (generation !== cloud.generation || cloud.user?.id !== ownerId)
    throw Error('The signed-in account changed. Open the import again.');
  if (row || cloud.pending || cloud.inFlight || cloud.revision !== 0)
    throw Error(
      'Cloud records now exist. Download the browser backup and review it before using Restore.'
    );
  const steps = STEPS.slice();
  try {
    if (save(parseBackup(legacy.raw), true)) {
      try {
        localStorage.setItem(cloud.key + ':browser-imported', 'yes');
      } catch {}
      closeModal();
      notice();
      tell('Browser records imported. Wait for the green cloud tick before closing.');
    }
  } catch (error) {
    STEPS.splice(0, STEPS.length, ...steps);
    throw error;
  }
  return true;
}
function cloudCacheValue() {
  return JSON.stringify({
    document: JSON.parse(payload(state)),
    revision: cloud.revision,
    pending: cloud.pending,
    inFlight: cloud.inFlight,
    baseDocument: cloud.baseDocument,
  });
}
function persistCloudCache(check = false) {
  if (!cloud.key) return;
  try {
    if (check && localStorage.getItem(cloud.key) !== cloud.lastCache)
      throw Error(
        'Another tab changed these records. Download a backup, then reload cloud records.'
      );
    const raw = cloudCacheValue();
    localStorage.setItem(cloud.key, raw);
    cloud.lastCache = raw;
    temporary = false;
  } catch (err) {
    if (/Another tab/.test(err.message)) {
      cloud.conflict = true;
      throw err;
    }
    temporary = true;
  }
}
function cloudNotice() {
  const signed = !!cloud.user,
    n = $('storageNotice'),
    pending = !!(cloud.pending || cloud.inFlight),
    problem =
      cloud.error ||
      cloud.conflict ||
      temporary ||
      /Could not|Offline|unavailable|failed|Another tab/i.test(cloud.status);
  n.hidden = !problem;
  n.classList.toggle('warn', problem);
  n.textContent = problem
    ? cloud.status +
      (temporary
        ? ' The browser recovery copy is unavailable; keep this page open until saved to Supabase.'
        : '')
    : '';
  const status = $('saveStatus');
  status.classList.toggle('pending', pending && !problem);
  status.classList.toggle('save-error', problem);
  status.classList.toggle('saved-online', cloud.ready && !pending && !problem);
  window.WorkHubChromeUX.renderStatus(status, {
    message: cloud.status,
    pending,
    problem,
    ready: cloud.ready,
    signed,
    conflict: cloud.conflict,
  });
  $('cloudAccountButton').hidden = false;
  $('cloudAccountButton').textContent = signed
    ? 'Account · ' + (cloud.user.email || '')
    : 'Sign in';
  $('cloudGate').hidden = cloud.ready;
  $('tabs').hidden = !cloud.ready;
  $('exportButton').disabled = !cloud.ready;
  $('backupButton').disabled = !cloud.ready;
  $('restoreButton').disabled = !cloud.ready || cloud.conflict;
  $('cloudRetry').hidden = !signed || cloud.conflict;
  $('cloudReload').hidden = !signed;
  $('cloudSignOut').hidden = !signed;
  browserMigrationNotice();
}
function applyCloudDocument(document) {
  state = document ? parseBackup(JSON.stringify(document)) : emptyState();
  month = state.calendarMonth;
  corrupt = false;
  if (!$('modal').open) detailTicketId = '';
}
async function fetchCloudRevision() {
  const { data, error } = await cloud.client
    .from('mm_tracker_documents')
    .select('revision,mutation_id,updated_at')
    .eq('user_id', cloud.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
async function fetchCloudRow() {
  const { data, error } = await cloud.client
    .from('mm_tracker_documents')
    .select('document,revision,mutation_id,updated_at')
    .eq('user_id', cloud.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
function cloudErrorMessage(err) {
  if (err?.code === 'PT409') return 'Another device saved newer records.';
  if (err?.code === '23514')
    return 'Supabase rejected the record format or size. Changes are waiting on this device. Download a backup; the site owner may need to update cloud saving.';
  if (err?.code === '42501') return 'Sign in again to save your records.';
  if (/fetch|network|abort|timeout/i.test(err?.message || ''))
    return 'Connection unavailable. Your changes are waiting to upload.';
  return err?.message || 'Online saving failed. Your changes are waiting to upload.';
}
function canonicalCloudDocument(document) {
  if (!document) return document;
  const steps = STEPS.slice();
  try {
    return { ...document, data: parseBackup(JSON.stringify(document)) };
  } finally {
    STEPS.splice(0, STEPS.length, ...steps);
  }
}
function queueCloudReview(row, cache) {
  if (row) row = { ...row, document: canonicalCloudDocument(row.document) };
  const local = canonicalCloudDocument(cache.document),
    base = canonicalCloudDocument(
      cache.baseDocument ||
        (row?.mutation_id === cache.inFlight?.mutationId ? cache.inFlight.document : null)
    );
  if (row && MMTrackerMerge.sameRecords(local, row.document))
    return { document: row.document, pending: null, inFlight: null, conflict: false };
  if (base && row) {
    const result = MMTrackerMerge.merge(base, local, row.document);
    if (!result.conflicts.length) {
      try {
        const document = { ...row.document, version: 9, data: result.data };
        parseBackup(JSON.stringify(document));
        return {
          document,
          pending: MMTrackerMerge.sameRecords(document, row.document) ? null : document,
          inFlight: null,
          conflict: false,
        };
      } catch {}
    }
  }
  const inFlight =
    cache.inFlight && row?.mutation_id !== cache.inFlight.mutationId ? cache.inFlight : null;
  const conflict = !!(
    (inFlight && inFlight.expectedRevision !== Number(row?.revision || 0)) ||
    (!inFlight &&
      cache.pending &&
      cache.revision !== Number(row?.revision || 0) &&
      row?.mutation_id !== cache.inFlight?.mutationId)
  );
  return { document: local, pending: cache.pending || null, inFlight, conflict };
}
/** Load one signed-in account. Generation checks reject responses from a previous account/session. */
async function loadCloud(session) {
  if (!session?.user) {
    cloud.generation++;
    cloud.user = null;
    cloud.ready = false;
    cloud.loading = false;
    cloud.pending = cloud.inFlight = cloud.baseDocument = null;
    cloud.busy = false;
    cloud.error = false;
    cloud.conflict = false;
    cloud.hasDocument = false;
    cloud.browserImportDismissed = false;
    cloud.status = 'Sign in to open your records.';
    state = emptyState();
    closeModal();
    notice();
    render();
    window.WorkHubStartup?.finish();
    return;
  }
  if (cloud.user?.id === session.user.id && (cloud.ready || cloud.loading)) {
    if (cloud.ready) void refreshCloud();
    return;
  }
  cloud.generation++;
  const generation = cloud.generation;
  cloud.user = session.user;
  cloud.ready = false;
  cloud.loading = true;
  cloud.error = false;
  cloud.conflict = false;
  cloud.key = 'mm-tracker.cloud.v1:' + cloudConfig.project + ':' + cloud.user.id;
  cloud.status = 'Opening cloud records…';
  window.WorkHubStartup?.message('Opening your records…');
  notice();
  render();
  let cache = null;
  try {
    cloud.lastCache = localStorage.getItem(cloud.key);
    if (cloud.lastCache) {
      cache = JSON.parse(cloud.lastCache);
      parseBackup(JSON.stringify(cache.document));
      if (!Number.isSafeInteger(cache.revision) || cache.revision < 0)
        throw Error('Invalid cloud cache.');
    }
  } catch {
    cache = null;
    cloud.lastCache = null;
    temporary = true;
  }
  try {
    const row = await fetchCloudRow();
    if (generation !== cloud.generation) return;
    const reviewed =
      cache && (cache.pending || cache.inFlight)
        ? queueCloudReview(row, cache)
        : { document: row?.document, pending: null, inFlight: null, conflict: false };
    applyCloudDocument(reviewed.document);
    cloud.revision = Number(row?.revision || 0);
    cloud.hasDocument = !!row;
    cloud.baseDocument = reviewed.conflict ? cache?.baseDocument || null : row?.document || null;
    cloud.pending = reviewed.pending;
    cloud.inFlight = reviewed.inFlight;
    cloud.conflict = reviewed.conflict;
    cloud.ready = true;
    cloud.loading = false;
    cloud.status = cloud.conflict
      ? 'Unsaved edits on this device need review. Your cloud records are safe.'
      : cloud.pending || cloud.inFlight
        ? 'Saving to Supabase…'
        : 'Saved to Supabase';
    persistCloudCache();
    notice();
    render();
    window.WorkHubStartup?.finish();
    if (!cloud.conflict) void flushCloud();
  } catch (err) {
    if (generation !== cloud.generation) return;
    cloud.loading = false;
    cloud.error = true;
    if (cache) {
      applyCloudDocument(cache.document);
      cloud.revision = cache.revision;
      cloud.baseDocument = cache.baseDocument || null;
      cloud.inFlight = cache.inFlight || null;
      cloud.pending = cache.pending || null;
      cloud.ready = true;
      cloud.status = 'Offline copy · ' + cloudErrorMessage(err);
      notice();
      render();
    } else {
      cloud.ready = false;
      cloud.status = 'Could not open cloud records. ' + cloudErrorMessage(err);
      notice();
    }
    window.WorkHubStartup?.finish();
    scheduleCloudRetry();
  }
}
/** Validate and cache a pending document before queuing its asynchronous Supabase upload. */
function saveCloud(next, restoring = false) {
  if (!cloud.user || !cloud.ready) throw Error('Sign in and open your records before editing.');
  if (cloud.conflict) throw Error('Download a backup, then reload cloud records before editing.');
  validate(next);
  const document = JSON.parse(payload(next));
  if (new Blob([JSON.stringify(document)]).size > 16 * 1024 * 1024)
    throw Error('The cloud limit is 16 MB. Shorten oversized records before saving.');
  try {
    if (!temporary && localStorage.getItem(cloud.key) !== cloud.lastCache) {
      cloud.conflict = true;
      cloud.status = 'Another tab changed these records.';
      notice();
      throw Error(
        'Another tab changed these records. Download a backup, then reload cloud records.'
      );
    }
  } catch (err) {
    if (cloud.conflict) throw err;
    temporary = true;
  }
  const previous = state;
  state = next;
  cloud.changeSerial++;
  if (MMTrackerMerge.sameRecords(document, JSON.parse(payload(previous)))) {
    persistCloudCache();
    render();
    return true;
  }
  cloud.pending = document;
  cloud.error = false;
  cloud.status = 'Saving to Supabase…';
  persistCloudCache();
  notice();
  render();
  void flushCloud();
  hub?.saved(previous, next);
  return true;
}
function scheduleCloudRetry() {
  clearTimeout(cloud.retryTimer);
  if (cloud.user && !cloud.conflict) cloud.retryTimer = setTimeout(() => void retryCloud(), 15000);
}
/** Upload against the known revision. Retry uses the same mutation ID so a repeated request is idempotent. */
async function flushCloud() {
  if (
    !cloud.user ||
    !cloud.ready ||
    cloud.busy ||
    cloud.conflict ||
    (!cloud.pending && !cloud.inFlight)
  )
    return;
  cloud.busy = true;
  const generation = cloud.generation;
  try {
    while (
      (cloud.pending || cloud.inFlight) &&
      generation === cloud.generation &&
      !cloud.conflict
    ) {
      if (!cloud.inFlight) {
        cloud.inFlight = {
          document: cloud.pending,
          expectedRevision: cloud.revision,
          mutationId: uid(),
        };
        cloud.pending = null;
        persistCloudCache(true);
      }
      const packet = cloud.inFlight;
      cloud.status = 'Saving to Supabase…';
      notice();
      const { data, error } = await cloud.client.rpc('save_mm_tracker', {
        p_document: packet.document,
        p_expected_revision: packet.expectedRevision,
        p_mutation_id: packet.mutationId,
      });
      if (generation !== cloud.generation) return;
      if (error) throw error;
      const saved = data?.[0];
      if (!saved || !Number.isSafeInteger(Number(saved.revision)))
        throw Error('The cloud save returned no confirmation.');
      cloud.revision = Number(saved.revision);
      cloud.hasDocument = true;
      cloud.baseDocument = packet.document;
      cloud.error = false;
      cloud.inFlight = null;
      persistCloudCache(true);
      cloud.status = cloud.pending ? 'Saving to Supabase…' : 'Saved to Supabase';
      notice();
    }
  } catch (err) {
    if (generation === cloud.generation) {
      cloud.error = true;
      cloud.conflict = cloud.conflict || err?.code === 'PT409';
      cloud.status = cloudErrorMessage(err);
      notice();
      if (!cloud.conflict) scheduleCloudRetry();
    }
  } finally {
    if (generation === cloud.generation) {
      cloud.busy = false;
      if (cloud.conflict) void refreshCloud();
    }
  }
}
/** Compare remote revision and merge independent edits; unresolved conflicts require visible review. */
async function refreshCloud(force = false) {
  if (!cloud.user || cloud.busy || cloud.loading || cloud.refreshing) return;
  if (!force) {
    try {
      const raw = localStorage.getItem(cloud.key);
      if (raw !== cloud.lastCache && raw) {
        const other = JSON.parse(raw);
        if (other.pending || other.inFlight) {
          cloud.status = 'Another browser tab is saving these records. Keep this tab open.';
          if (cloud.pending || cloud.inFlight) cloud.conflict = true;
          notice();
          return;
        }
        cloud.lastCache = raw;
      }
    } catch {
      temporary = true;
    }
  }
  if (!force && $('modal').open && $('modal').querySelector('form')) {
    cloud.refreshDeferred = true;
    return;
  }
  cloud.refreshDeferred = false;
  cloud.refreshing = true;
  if (!cloud.pending && !cloud.inFlight && !cloud.conflict) {
    cloud.status = 'Checking for updates…';
    notice();
  }
  const generation = cloud.generation,
    changeSerial = cloud.changeSerial,
    startingRevision = cloud.revision;
  try {
    if (!force) {
      const meta = await fetchCloudRevision();
      if (
        generation !== cloud.generation ||
        changeSerial !== cloud.changeSerial ||
        startingRevision !== cloud.revision ||
        cloud.busy
      )
        return;
      if (
        !cloud.pending &&
        !cloud.inFlight &&
        !cloud.conflict &&
        Number(meta?.revision || 0) === cloud.revision
      ) {
        cloud.hasDocument = !!meta;
        cloud.error = false;
        cloud.status = 'Saved to Supabase';
        notice();
        return;
      }
    }
    const row = await fetchCloudRow();
    if (
      generation !== cloud.generation ||
      changeSerial !== cloud.changeSerial ||
      startingRevision !== cloud.revision ||
      cloud.busy
    )
      return;
    if (!force && $('modal').open && $('modal').querySelector('form')) {
      cloud.refreshDeferred = true;
      return;
    }
    const revision = Number(row?.revision || 0),
      queued = !!(cloud.pending || cloud.inFlight),
      changed = force || queued || revision !== cloud.revision || cloud.conflict;
    if (!force && queued) {
      const reviewed = queueCloudReview(row, {
        document: JSON.parse(payload(state)),
        baseDocument: cloud.baseDocument,
        revision: cloud.revision,
        pending: cloud.pending,
        inFlight: cloud.inFlight,
      });
      if (reviewed.conflict) {
        cloud.conflict = true;
        cloud.status = 'Unsaved edits on this device need review. Your cloud records are safe.';
        notice();
        return;
      }
      applyCloudDocument(reviewed.document);
      cloud.pending = reviewed.pending;
      cloud.inFlight = reviewed.inFlight;
    } else if (force || revision !== cloud.revision || cloud.conflict) {
      applyCloudDocument(row?.document);
      cloud.pending = cloud.inFlight = null;
    }
    cloud.revision = revision;
    cloud.baseDocument = row?.document || null;
    cloud.conflict = false;
    cloud.ready = true;
    cloud.hasDocument = !!row;
    cloud.error = false;
    cloud.status = cloud.pending || cloud.inFlight ? 'Saving to Supabase…' : 'Saved to Supabase';
    persistCloudCache();
    if (changed) {
      if ($('modal').open && !$('modal').querySelector('form')) closeModal();
      render();
    }
    notice();
  } catch (err) {
    if (generation === cloud.generation) {
      cloud.error = true;
      cloud.status = 'Could not refresh. ' + cloudErrorMessage(err);
      notice();
      scheduleCloudRetry();
    }
  } finally {
    cloud.refreshing = false;
    if (cloud.pending && !cloud.conflict && !cloud.busy) void flushCloud();
  }
}
async function retryCloud() {
  if (!cloud.user) return;
  if (!cloud.ready) {
    cloud.user = null;
    const { data, error } = await cloud.client.auth.getSession();
    if (error) throw error;
    return loadCloud(data.session);
  }
  await refreshCloud();
  if (!cloud.conflict && (cloud.pending || cloud.inFlight)) return flushCloud();
}
function openCloudAccount() {
  closeSettingsMenu();
  if (!cloud.user) {
    $('cloudGate').scrollIntoView?.({ behavior: 'smooth' });
    return;
  }
  openModal(
    'Your cloud account',
    `<p>Signed in as <strong>${esc(cloud.user.email)}</strong>.</p><p>Changes save automatically to this private account. Recovery, backup, restore, and sign-out controls are available from Settings.</p><div class="view-details"><div><div class="detail-label">Cloud status</div><div class="detail-value">${esc(cloud.status)}</div></div><div><div class="detail-label">Revision</div><div class="detail-value">${cloud.revision}</div></div><div><div class="detail-label">Pending upload</div><div class="detail-value">${cloud.pending || cloud.inFlight ? 'Yes' : 'No'}</div></div></div><div class="modal-actions"><button type="button" data-action="cancel">Close</button><button class="primary" type="button" data-action="cloud-change-password">Change password</button></div>`
  );
}
function passwordRecoveryUrl() {
  return location.origin + location.pathname;
}
function openPasswordResetRequest() {
  closeSettingsMenu();
  const remembered = ($('cloudEmail')?.value || cloud.user?.email || '').trim();
  openModal(
    'Reset your password',
    `<form id="passwordResetRequestForm"><p class="muted">Enter the email used for this tracker. Supabase will send a secure recovery link; no new account will be created.</p><label for="passwordResetEmail">Tracker email</label><input id="passwordResetEmail" name="email" type="email" autocomplete="username" value="${esc(remembered)}" required><p id="passwordResetMessage" class="hint" role="status" aria-live="polite"></p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Send recovery email</button></div></form>`
  );
}
async function submitPasswordResetRequest(form) {
  const message = $('passwordResetMessage'),
    button = form.querySelector('button[type="submit"]'),
    email = form.elements.namedItem('email').value.trim();
  button.disabled = true;
  message.textContent = 'Sending recovery email…';
  try {
    const { error } = await cloud.client.auth.resetPasswordForEmail(email, {
      redirectTo: passwordRecoveryUrl(),
    });
    if (error) throw error;
    form.elements.namedItem('email').value = '';
    message.textContent =
      'If a tracker login exists for that email, a recovery link has been sent. Open it on this device to choose a new password.';
  } catch (err) {
    message.textContent = err.message || 'The recovery email could not be sent. Try again shortly.';
  } finally {
    button.disabled = false;
  }
}
function openPasswordChange(recovery = false) {
  closeSettingsMenu();
  if (!cloud.user) throw Error('Open a valid password-recovery link or sign in first.');
  openModal(
    recovery ? 'Choose a new password' : 'Change password',
    `<form id="passwordChangeForm"><input type="hidden" name="recovery" value="${recovery ? 'yes' : 'no'}"><p class="muted">${recovery ? 'This recovery link is connected to your existing tracker account. Choose a new password to keep the same records.' : 'Confirm your current password, then choose a new one. Your cloud records remain linked to this account.'}</p>${recovery ? '' : `<label for="currentAccountPassword">Current password</label><input id="currentAccountPassword" name="currentPassword" type="password" autocomplete="current-password" minlength="8" required>`}<label for="newAccountPassword" style="margin-top:15px">New password</label><input id="newAccountPassword" name="newPassword" type="password" autocomplete="new-password" minlength="8" required><label for="confirmAccountPassword" style="margin-top:15px">Confirm new password</label><input id="confirmAccountPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required><p id="passwordChangeMessage" class="hint" role="status" aria-live="polite"></p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Update password</button></div></form>`
  );
}
async function submitPasswordChange(form) {
  const message = $('passwordChangeMessage'),
    button = form.querySelector('button[type="submit"]'),
    recovery = form.elements.namedItem('recovery').value === 'yes',
    newPassword = form.elements.namedItem('newPassword').value,
    confirmPassword = form.elements.namedItem('confirmPassword').value;
  if (newPassword.length < 8) {
    message.textContent = 'Use at least 8 characters.';
    return;
  }
  if (newPassword !== confirmPassword) {
    message.textContent = 'The new passwords do not match.';
    return;
  }
  button.disabled = true;
  message.textContent = recovery ? 'Updating your password…' : 'Confirming your current password…';
  try {
    if (!recovery) {
      const currentPassword = form.elements.namedItem('currentPassword').value,
        { data, error } = await cloud.client.auth.signInWithPassword({
          email: cloud.user.email,
          password: currentPassword,
        });
      if (error) throw error;
      if (data.user?.id !== cloud.user.id)
        throw Error('The password does not match the current tracker account.');
      message.textContent = 'Updating your password…';
    }
    const { error } = await cloud.client.auth.updateUser({ password: newPassword });
    if (error) throw error;
    for (const name of ['currentPassword', 'newPassword', 'confirmPassword']) {
      const field = form.elements.namedItem(name);
      if (field) field.value = '';
    }
    if (recovery) window.history?.replaceState?.(null, '', location.pathname);
    closeModal();
    tell('Password updated. Your existing cloud records remain linked to this account.');
  } catch (err) {
    message.textContent = err.message || 'The password could not be updated.';
  } finally {
    button.disabled = false;
  }
}
let sensitiveAuth = null;
function verifyCloudCredentials(action, emailRequired = true) {
  if (!cloud.user || !cloud.ready) throw Error('Sign in and open your cloud records first.');
  if (sensitiveAuth) {
    sensitiveAuth.resolve(false);
    sensitiveAuth = null;
  }
  return new Promise(resolve => {
    sensitiveAuth = { resolve, action, emailRequired };
    openModal(
      'Confirm your identity',
      `<form id="reauthForm"><p class="muted">Confirm your account before you ${esc(action.toLowerCase())}. Your password is verified securely and is not stored.</p>${emailRequired ? `<label for="reauthEmail" style="margin-top:15px">Email</label><input id="reauthEmail" name="email" type="email" autocomplete="username" value="${esc(cloud.user.email || '')}" required>` : `<p>Signed in as <strong>${esc(cloud.user.email || '')}</strong>.</p>`}<label for="reauthPassword" style="margin-top:15px">Password</label><input id="reauthPassword" name="password" type="password" autocomplete="current-password" minlength="8" required><p id="reauthMessage" class="hint" role="status" aria-live="polite"></p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Confirm & continue</button></div></form>`
    );
  });
}
function cancelSensitiveAuth() {
  if (!sensitiveAuth) return;
  const pending = sensitiveAuth;
  sensitiveAuth = null;
  pending.resolve(false);
}
async function submitSensitiveAuth(form) {
  if (!sensitiveAuth) return;
  const message = $('reauthMessage'),
    button = form.querySelector('button[type="submit"]'),
    email = (
      sensitiveAuth.emailRequired ? form.elements.namedItem('email').value : cloud.user.email || ''
    ).trim(),
    password = form.elements.namedItem('password').value;
  if (email.toLowerCase() !== (cloud.user.email || '').toLowerCase()) {
    message.textContent = 'Enter the email of the currently signed-in tracker account.';
    return;
  }
  button.disabled = true;
  message.textContent = 'Verifying…';
  try {
    const currentId = cloud.user.id,
      { data, error } = await cloud.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user?.id !== currentId)
      throw Error('The credentials do not match the current tracker account.');
    const pending = sensitiveAuth;
    sensitiveAuth = null;
    form.elements.namedItem('password').value = '';
    closeModal();
    pending.resolve(true);
  } catch (err) {
    message.textContent = err.message || 'Authentication failed.';
  } finally {
    button.disabled = false;
  }
}
async function cloudAction(b) {
  const a = b.dataset.action;
  if (await browserMigrationAction(a)) return true;
  if (a === 'cloud-account') {
    openCloudAccount();
    return true;
  }
  if (a === 'cloud-forgot-password') {
    openPasswordResetRequest();
    return true;
  }
  if (a === 'cloud-change-password') {
    openPasswordChange(false);
    return true;
  }
  if (a === 'cloud-retry') {
    closeSettingsMenu();
    await retryCloud();
    return true;
  }
  if (a === 'cloud-reload') {
    closeSettingsMenu();
    if (
      (cloud.pending || cloud.inFlight || cloud.conflict) &&
      !confirm(
        'Reload cloud records and discard changes waiting in this browser? Download a backup first if you need them.'
      )
    )
      return true;
    if (!(await verifyCloudCredentials('Reload cloud records', true))) return true;
    await refreshCloud(true);
    return true;
  }
  if (a === 'cloud-signout') {
    closeSettingsMenu();
    if (cloud.busy || cloud.pending || cloud.inFlight)
      throw Error(
        'Wait for the online save before signing out, or download a backup and reload cloud records first.'
      );
    const { error } = await cloud.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    try {
      localStorage.removeItem(cloud.key);
    } catch {}
    await loadCloud(null);
    return true;
  }
  return false;
}
async function submitCloudAuth(form) {
  const button = form.querySelector('button[type="submit"]'),
    email = form.elements.namedItem('email').value.trim(),
    password = form.elements.namedItem('password').value,
    signup = form.elements.namedItem('mode').value === 'signup';
  $('cloudAuthMessage').textContent = signup ? 'Creating your tracker login…' : 'Signing in…';
  button.disabled = true;
  try {
    const response = signup
      ? await cloud.client.auth.signUp({ email, password })
      : await cloud.client.auth.signInWithPassword({ email, password });
    if (response.error) throw response.error;
    form.elements.namedItem('password').value = '';
    if (response.data.session) {
      $('cloudAuthMessage').textContent = '';
      await loadCloud(response.data.session);
    } else
      $('cloudAuthMessage').textContent =
        'Check your email to confirm the tracker login, then return here and sign in.';
  } catch (err) {
    $('cloudAuthMessage').textContent = err.message || 'Sign-in failed.';
  } finally {
    button.disabled = false;
  }
}
/** Add a request timeout while preserving a caller-provided cancellation signal. */
function cloudFetch(input, init = {}) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 20000),
    abort = () => controller.abort();
  init.signal?.addEventListener('abort', abort, { once: true });
  if (init.signal?.aborted) controller.abort();
  return fetch(input, { ...init, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
    init.signal?.removeEventListener('abort', abort);
  });
}
/** Create the Supabase client and subscribe to auth, connectivity and cross-tab changes. */
function startCloud() {
  if (!window.MMTrackerSupabase?.createClient) {
    cloud.error = true;
    cloud.status = 'Cloud sign-in could not load. Refresh this page.';
    notice();
    window.WorkHubStartup?.finish();
    return;
  }
  cloud.client = window.MMTrackerSupabase.createClient(
    cloudConfig.url,
    cloudConfig.publishableKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'mm-tracker.auth.v1:' + cloudConfig.project,
      },
      global: { fetch: cloudFetch },
    }
  );
  document.addEventListener('submit', e => {
    if (e.target.id === 'cloudAuthForm') {
      e.preventDefault();
      void submitCloudAuth(e.target);
    } else if (e.target.id === 'reauthForm') {
      e.preventDefault();
      void submitSensitiveAuth(e.target);
    } else if (e.target.id === 'passwordResetRequestForm') {
      e.preventDefault();
      void submitPasswordResetRequest(e.target);
    } else if (e.target.id === 'passwordChangeForm') {
      e.preventDefault();
      void submitPasswordChange(e.target);
    }
  });
  cloud.client.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY')
      setTimeout(() => void loadCloud(session).then(() => openPasswordChange(true)), 0);
    else if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' || event === 'SIGNED_IN')
      setTimeout(() => void loadCloud(session), 0);
  });
  window.addEventListener('online', () => void retryCloud());
  window.addEventListener('focus', () => {
    void retryCloud();
    queueActualReview();
  });
  window.addEventListener('beforeunload', e => {
    if (cloud.pending || cloud.inFlight) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  window.addEventListener('storage', e => {
    if (e.key === cloud.key && e.newValue !== cloud.lastCache) {
      if (!cloud.pending && !cloud.inFlight) {
        cloud.conflict = false;
        void refreshCloud();
      } else {
        cloud.conflict = true;
        cloud.status = 'Another tab changed these records.';
        notice();
        void refreshCloud();
      }
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void retryCloud();
  });
  setInterval(() => {
    if (!document.hidden) void retryCloud();
  }, 20000);
  cloud.client.auth
    .getSession()
    .then(({ data, error }) => {
      if (error) {
        cloud.error = true;
        cloud.status = error.message;
        notice();
        window.WorkHubStartup?.finish();
      } else void loadCloud(data.session);
    })
    .catch(() => {
      cloud.error = true;
      cloud.status = 'Cloud sign-in could not open. Check your connection and refresh this page.';
      notice();
      window.WorkHubStartup?.finish();
    });
}

// =============================================================================
// 8. Connect feature adapters and start the application
// =============================================================================
const ticketsBeforeReminders = filteredTickets,
  tasksBeforeReminders = filteredTasks;
filteredTickets = () =>
  ticketsBeforeReminders().filter(
    r =>
      !WorkHubReminders.isSnoozed(state, 'tickets', r.id, today()) &&
      (!hub?.batchA || hub.batchA.matches('tickets', r.id))
  );
filteredTasks = () =>
  tasksBeforeReminders().filter(
    r =>
      !WorkHubReminders.isSnoozed(state, 'tasks', r.id, today()) &&
      (!hub?.batchA || hub.batchA.matches('tasks', r.id))
  );
hub = WorkHubStudio.install({
  state: () => state,
  cloud: () => cloud,
  today,
  month: () => month,
  day: () => scheduleDay,
  mutate,
  tell,
  openModal(title, body) {
    $('modal').classList.toggle(
      'hub-drawer',
      !body.includes('<form') && !/Search|Quick|Review/.test(title)
    );
    openModal(title, body);
  },
  closeModal,
  render,
  navigate(value) {
    tab = value;
    render();
  },
  editRecord,
  editSub: editTaskSub,
  newRange() {
    openRangeEditor(today(), '09:00', '', true);
  },
  viewBooking,
  entries: scheduleEntries,
  entryTitle: scheduleEntryTitle,
  taskLabel: taskLinkedLabel,
  itemLabel: projectItemLabel,
  appendTicketHistory: autoHistory,
  rangeSegments,
  overlaps: bookingOverlaps,
  download,
  statusOptions: { tickets: OPTIONS.status, specs: OPTIONS.specStatus, subtasks: SUBITEM_STATUSES },
  openSubItems,
  latestHistory,
  project(id) {
    if (!state.projects.some(p => p.id === id)) throw Error('Project no longer exists.');
    mutate(d => (d.activeProjectId = id));
    projectView = 'overview';
    tab = 'specs';
    closeModal();
    render();
  },
  ticket(id) {
    detail(id);
  },
});
WorkHubReports.install({
  state: () => state,
  today,
  openModal,
  closeModal,
  download,
  tell,
  zip,
  validate,
});

if (!CLOUD_MODE) {
  try {
    lastRaw = localStorage.getItem(KEY);
    if (lastRaw !== null) {
      try {
        state = parseBackup(lastRaw);
      } catch {
        corrupt = true;
        state = emptyState();
      }
    }
    if (!corrupt) {
      alignClosedTickets(state);
      validate(state);
      const raw = payload(state);
      try {
        localStorage.setItem(KEY, raw);
        lastRaw = raw;
      } catch {
        temporary = true;
      }
    }
  } catch {
    temporary = true;
  }
}
$('modal').addEventListener('close', () => {
  if (CLOUD_MODE && cloud.refreshDeferred) void retryCloud();
});
month = state.calendarMonth;
notice();
render();
if (CLOUD_MODE) startCloud();
else window.WorkHubStartup?.finish();
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(
      document.modelContext.registerTool({
        name: 'search_mm_tickets',
        description:
          'Read ticket records matching a query and show matching tickets. Does not modify saved records.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string', maxLength: 200 } },
          required: ['query'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute(input) {
          if (typeof input?.query !== 'string' || input.query.length > 200)
            throw Error('Provide a query of up to 200 characters.');
          tab = 'tickets';
          filterState = { query: input.query, status: '', object: '', priority: '' };
          render();
          return { count: filteredTickets().length, tickets: filteredTickets() };
        },
      })
    ).catch(() => {});
  } catch {}
}
