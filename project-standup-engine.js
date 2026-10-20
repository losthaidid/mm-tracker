/**
 * project-standup-engine.js — Project reporting totals, update times and linked Actions.
 * Actions and their task are saved in one document mutation. No duplicate task metadata
 * is stored on project items, so the existing item/task editors preserve these links.
 */
(function (root) {
  'use strict';
  const key = (itemId, subItemId = '') => JSON.stringify([itemId, subItemId]);
  const text = (v, max = 32767) => typeof v === 'string' && v.length <= max;
  const timestamp = v =>
    v === '' || (text(v, 50) && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v)));
  function upgrade(d) {
    if (!d.workhub) d.workhub = {};
    if (d.workhub.projectStandup === undefined)
      d.workhub.projectStandup = { version: 1, actions: [], updates: [] };
    return d;
  }
  const data = d => d.workhub.projectStandup;
  function validate(d) {
    const h = data(d);
    if (
      !h ||
      h.version !== 1 ||
      !Array.isArray(h.actions) ||
      !Array.isArray(h.updates) ||
      h.actions.length > 5000 ||
      h.updates.length > 10000
    )
      throw Error('Check the project summary records.');
    const ids = new Set(),
      tasks = new Set();
    for (const r of h.actions) {
      if (
        !r ||
        !text(r.id, 100) ||
        !r.id ||
        ids.has(r.id) ||
        !text(r.projectId, 100) ||
        !r.projectId ||
        !text(r.itemId, 100) ||
        !r.itemId ||
        !text(r.subItemId, 100) ||
        !text(r.taskId, 100) ||
        !r.taskId ||
        tasks.has(r.taskId) ||
        !text(r.text) ||
        !r.text.trim() ||
        !timestamp(r.createdAt) ||
        !r.createdAt ||
        !timestamp(r.updatedAt) ||
        !r.updatedAt
      )
        throw Error('Check the project Actions.');
      ids.add(r.id);
      tasks.add(r.taskId);
    }
    ids.clear();
    for (const r of h.updates) {
      if (
        !r ||
        !text(r.itemId, 100) ||
        !r.itemId ||
        !text(r.subItemId, 100) ||
        r.id !== key(r.itemId, r.subItemId) ||
        ids.has(r.id) ||
        !timestamp(r.updatedAt) ||
        !timestamp(r.remarksAt)
      )
        throw Error('Check the project update times.');
      ids.add(r.id);
    }
  }
  function source(d, projectId, itemId, subItemId = '') {
    const project = d.projects.find(p => p.id === projectId),
      item = d.specs.find(p => p.id === itemId && p.projectId === projectId),
      sub = subItemId ? item?.subItems?.find(s => s.id === subItemId) : null;
    if (!project || !item || (subItemId && !sub))
      throw Error('The project item or sub-item no longer exists.');
    return { project, item, sub, row: sub || item };
  }
  function category(status) {
    const s = String(status || '')
      .trim()
      .toLowerCase();
    if (['completed', 'complete', 'done', 'closed'].includes(s)) return 'completed';
    if (/block|hold/.test(s)) return 'blocked';
    if (/not.*start|^pending$|^open$|^new$|^to do$/.test(s)) return 'notStarted';
    return s ? 'inProgress' : 'notStarted';
  }
  function counts(rows) {
    const c = { total: rows.length, completed: 0, inProgress: 0, blocked: 0, notStarted: 0 };
    for (const r of rows) c[category(r.status)]++;
    c.percent = c.total ? Math.round((c.completed / c.total) * 100) : 0;
    return c;
  }
  function metrics(d, projectId) {
    const rows = d.specs.filter(s => s.projectId === projectId),
      subs = rows.flatMap(s => s.subItems || []);
    return { items: counts(rows), subs: counts(subs), all: counts([...rows, ...subs]) };
  }
  function prepare(next, previous, restoring = false, now = new Date().toISOString()) {
    if (restoring || !previous) return;
    const h = data(next),
      times = new Map(h.updates.map(r => [r.id, r])),
      alive = new Set(),
      oldItems = new Map(previous.specs.map(r => [r.id, r]));
    for (const item of next.specs) {
      const old = oldItems.get(item.id),
        oldSubs = new Map((old?.subItems || []).map(r => [r.id, r]));
      for (const [row, before, subItemId] of [
        [item, old, ''],
        ...(item.subItems || []).map(s => [s, oldSubs.get(s.id), s.id]),
      ]) {
        const id = key(item.id, subItemId);
        alive.add(id);
        const remarksChanged = !before ? !!row.remarks : row.remarks !== before.remarks;
        const changed =
          !before ||
          remarksChanged ||
          row.status !== before.status ||
          (row.title || row.description) !== (before.title || before.description);
        if (changed) {
          const entry = times.get(id) || {
            id,
            itemId: item.id,
            subItemId,
            updatedAt: '',
            remarksAt: '',
          };
          entry.updatedAt = now;
          if (remarksChanged) entry.remarksAt = now;
          times.set(id, entry);
        }
      }
    }
    h.updates = [...times.values()].filter(r => alive.has(r.id));
    // Task edits remain the source of truth for action text, status and due dates.
    const oldTasks = new Map(previous.tasks.map(t => [t.id, t])),
      tasks = new Map(next.tasks.map(t => [t.id, t]));
    for (const action of h.actions) {
      const task = tasks.get(action.taskId),
        before = oldTasks.get(action.taskId);
      if (task && before && task.task !== before.task) {
        action.text = task.task;
        action.updatedAt = now;
      }
    }
  }
  function updateTime(d, item, sub = null) {
    const r = data(d).updates.find(r => r.id === key(item.id, sub?.id || ''));
    return {
      updatedAt:
        r?.updatedAt || (timestamp((sub || item).updatedAt) ? (sub || item).updatedAt : '') || '',
      remarksAt: r?.remarksAt || '',
    };
  }
  function upsertAction(d, values, now, uid) {
    const { projectId, itemId, subItemId = '', id } = values;
    source(d, projectId, itemId, subItemId);
    const h = data(d),
      old = h.actions.find(r => r.id === id),
      instruction = String(values.text || '').trim();
    if (!instruction || instruction.length > 32767)
      throw Error('Enter an Action of up to 32,767 characters.');
    if (
      values.dueDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(values.dueDate) ||
        !Number.isFinite(Date.parse(values.dueDate + 'T00:00:00Z')))
    )
      throw Error('Choose a valid due date.');
    if (
      old &&
      (old.projectId !== projectId || old.itemId !== itemId || old.subItemId !== subItemId)
    )
      throw Error('This Action belongs to a different project item.');
    let task = old ? d.tasks.find(t => t.id === old.taskId) : null;
    if (old && values.originalTaskId && old.taskId !== values.originalTaskId)
      throw Error('This Action changed. Reopen it before saving.');
    if (!task && values.originalTaskId)
      throw Error('The linked task was removed. Reopen the Action to recreate it.');
    if (task && (task.task !== values.originalText || task.dueDate !== values.originalDueDate))
      throw Error('This task changed. Reopen the Action before saving.');
    if (!task) {
      if (d.tasks.length >= 5000 || (!old && h.actions.length >= 5000))
        throw Error('The task or Actions section is full.');
      task = {
        id: uid(),
        number: String(Math.max(0, ...d.tasks.map(t => +t.number || 0)) + 1),
        task: instruction,
        taskType: 'Project',
        linkId: projectId,
        customLink: '',
        priority: 'Medium',
        dueDate: values.dueDate || '',
        done: false,
        doneDate: '',
        remarks: '',
        feedback: '',
        subTasks: [],
        boardStatus: 'todo',
        archived: false,
        archivedAt: '',
      };
      d.tasks.push(task);
    } else {
      task.task = instruction;
      task.dueDate = values.dueDate || '';
    }
    const action = {
      id,
      projectId,
      itemId,
      subItemId,
      taskId: task.id,
      text: instruction,
      createdAt: old?.createdAt || now,
      updatedAt: now,
    };
    if (old) h.actions[h.actions.indexOf(old)] = action;
    else h.actions.push(action);
    return action;
  }
  const taskStatus = t =>
    !t
      ? 'Task removed'
      : t.archived
        ? 'Archived'
        : t.done
          ? 'Completed'
          : { todo: 'To do', doing: 'In progress', blocked: 'Blocked', done: 'Completed' }[
              t.boardStatus
            ] || 'To do';
  root.WorkHubProjectStandupEngine = {
    upgrade,
    validate,
    data,
    source,
    category,
    metrics,
    prepare,
    updateTime,
    upsertAction,
    taskStatus,
  };
})(window);
