/* Project Items own shared progress. Task records keep their own title, dates and notes. */
(function (root) {
  'use strict';
  const Tasks = root.WorkHubTaskCompletion;
  const itemStatus = {
    todo: 'Not yet Started',
    doing: 'In Progress',
    blocked: 'Blocked',
    done: 'Completed',
  };
  const matches = (task, item) =>
    item && task.taskType === 'Project' && task.linkId === item.projectId;
  const itemForTask = (d, task) =>
    task?.projectItemId
      ? d.specs.find(item => item.id === task.projectItemId && matches(task, item))
      : undefined;
  const taskForItem = (d, item) =>
    d.tasks.find(task => task.projectItemId === item.id && matches(task, item));

  function stored(d) {
    return {
      ...d,
      tasks: d.tasks.map(task =>
        task.projectItemId
          ? { ...task, subTasks: [], boardStatus: 'todo', done: false, doneDate: '' }
          : task
      ),
    };
  }

  function hydrate(d) {
    const items = new Map(d.specs.map(item => [item.id, item]));
    for (const task of d.tasks) {
      if (!task.projectItemId) continue;
      const item = items.get(task.projectItemId);
      const category = matches(task, item)
        ? root.WorkHubProjectStandupEngine.category(item.status)
        : 'notStarted';
      const status = { completed: 'done', inProgress: 'doing', blocked: 'blocked' }[category];
      task.subTasks = matches(task, item) ? JSON.parse(JSON.stringify(item.subItems || [])) : [];
      task.doneDate = status === 'done' ? item.statusDate || '' : '';
      Tasks.setStatus(task, status || 'todo', task.doneDate);
    }
    return d;
  }

  function projectSubItems(subTasks, existing = []) {
    const byId = new Map(existing.map(sub => [sub.id, sub]));
    return subTasks.map(sub => ({
      owner: '',
      dueDate: '',
      ...byId.get(sub.id),
      ...sub,
    }));
  }

  function create(d, task, itemType, itemId) {
    const item = {
      id: itemId,
      projectId: task.linkId,
      companyId: task.companyId,
      itemType,
      itemId: '',
      ricefw: '',
      description: task.task,
      status: itemStatus[Tasks.status(task)],
      statusDate: task.doneDate,
      priority: { Critical: 'A', High: 'A', Medium: 'B', Low: 'C' }[task.priority] || 'B',
      expectedDate: '',
      dueDate: task.dueDate,
      remarks: task.remarks,
      feedback: task.feedback,
      reference: '',
      url: '',
      subItems: projectSubItems(task.subTasks),
    };
    d.specs.push(item);
    return item.id;
  }

  function attach(d, task, itemId, uid) {
    const item = itemForTask(d, { ...task, projectItemId: itemId });
    if (!item) throw Error('Choose a project item from the linked project.');
    const linked = taskForItem(d, item);
    if (linked && linked.id !== task.id)
      throw Error('That project item already has a linked task.');
    const used = new Set(d.specs.flatMap(row => (row.subItems || []).map(sub => sub.id)));
    const children = projectSubItems(task.subTasks).map(sub =>
      used.has(sub.id) ? { ...sub, id: uid() } : sub
    );
    item.subItems.push(...children);
    return item.id;
  }

  function prepare(next, previous, canEdit, restoring) {
    if (restoring) return;
    const oldTasks = new Map(previous.tasks.map(task => [task.id, task]));
    const items = new Map(next.specs.map(item => [item.id, item]));
    for (const task of next.tasks) {
      const old = oldTasks.get(task.id);
      if (!task.projectItemId || task.projectItemId !== old?.projectItemId) continue;
      const statusChanged = Tasks.status(task) !== Tasks.status(old);
      const dateChanged = task.doneDate !== old.doneDate;
      const childrenChanged = JSON.stringify(task.subTasks) !== JSON.stringify(old.subTasks);
      if (!statusChanged && !dateChanged && !childrenChanged) continue;
      const item = items.get(task.projectItemId);
      if (!matches(task, item)) throw Error('The linked project item is unavailable.');
      if (!canEdit) throw Error('Your account cannot edit shared project item progress.');
      if (statusChanged) item.status = itemStatus[Tasks.status(task)];
      if (task.done && dateChanged && task.doneDate) {
        item.statusDate = task.doneDate;
        item._statusDateExplicit = true;
      }
      if (childrenChanged) item.subItems = projectSubItems(task.subTasks, item.subItems);
    }
  }

  root.WorkHubTaskProjectItems = {
    itemForTask,
    taskForItem,
    stored,
    hydrate,
    create,
    attach,
    prepare,
  };
})(globalThis);
