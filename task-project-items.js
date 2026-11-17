/* Project Items and Go-Live Issues own the progress they share with Tasks. */
(function (root) {
  'use strict';
  const Tasks = root.WorkHubTaskCompletion;
  const itemStatus = {
    todo: 'Not yet Started',
    doing: 'In Progress',
    blocked: 'Blocked',
    done: 'Completed',
  };
  const issueStatus = { todo: 'Open', doing: 'In progress', blocked: 'Blocked', done: 'Resolved' };
  const itemBoardStatus = item =>
    ({ completed: 'done', inProgress: 'doing', blocked: 'blocked' })[
      root.WorkHubProjectStandupEngine.category(item.status)
    ] || 'todo';
  function issueBoardStatus(issue) {
    const status = issue.status
      .trim()
      .toLowerCase()
      .replace(/[\s_./-]+/g, ' ');
    if (status === 'blocked' || status === 'on hold') return 'blocked';
    const category = root.WorkHubGoLiveIssuesEngine.category(issue.status);
    return { resolved: 'done', progress: 'doing' }[category] || 'todo';
  }
  const matches = (task, item) =>
    item && task.taskType === 'Project' && task.linkId === item.projectId;
  const itemForTask = (d, task) =>
    task?.projectItemId
      ? d.specs.find(item => item.id === task.projectItemId && matches(task, item))
      : undefined;
  const taskForItem = (d, item) =>
    d.tasks.find(task => task.projectItemId === item.id && matches(task, item));
  const issueForTask = (d, task) =>
    task?.taskType === 'Project' && task.goLiveIssueId
      ? d.projects
          .find(p => p.id === task.linkId)
          ?.goLiveIssues?.find(issue => issue.id === task.goLiveIssueId)
      : undefined;
  const taskForIssue = (d, projectId, issueId) =>
    d.tasks.find(
      task =>
        task.taskType === 'Project' && task.linkId === projectId && task.goLiveIssueId === issueId
    );

  function stored(d) {
    return {
      ...d,
      tasks: d.tasks.map(task =>
        task.projectItemId
          ? { ...task, subTasks: [], boardStatus: 'todo', done: false, doneDate: '' }
          : task.goLiveIssueId
            ? { ...task, boardStatus: 'todo', done: false, doneDate: '' }
            : task
      ),
    };
  }

  function hydrate(d) {
    const items = new Map(d.specs.map(item => [item.id, item]));
    for (const task of d.tasks) {
      if (task.projectItemId) {
        const item = items.get(task.projectItemId);
        const source = matches(task, item) ? item : null;
        task.subTasks = JSON.parse(JSON.stringify(source?.subItems || []));
        task.doneDate = source?.statusDate || '';
        Tasks.setStatus(task, source ? itemBoardStatus(source) : 'todo', task.doneDate);
      } else if (task.goLiveIssueId) {
        const issue = issueForTask(d, task);
        task.doneDate = issue?.resolvedDate || '';
        Tasks.setStatus(task, issue ? issueBoardStatus(issue) : 'todo', task.doneDate);
      }
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

  function prepare(next, previous, canEdit, restoring, today) {
    if (restoring) return;
    const oldTasks = new Map(previous.tasks.map(task => [task.id, task]));
    const items = new Map(next.specs.map(item => [item.id, item]));
    for (const task of next.tasks) {
      const old = oldTasks.get(task.id);
      if (task.goLiveIssueId && task.goLiveIssueId === old?.goLiveIssueId) {
        const issue = issueForTask(next, task);
        const before = issueForTask(previous, old);
        const statusChanged = Tasks.status(task) !== Tasks.status(old);
        const dateChanged = task.doneDate !== old.doneDate;
        if (statusChanged || dateChanged) {
          if (!issue) throw Error('The linked Go-Live issue is unavailable.');
          if (!canEdit) throw Error('Your account cannot edit the linked Go-Live issue status.');
          if (statusChanged) issue.status = issueStatus[Tasks.status(task)];
          if (task.done && task.doneDate) issue.resolvedDate = task.doneDate;
        }
        if (issue && issueBoardStatus(issue) === 'done') {
          if (before && issueBoardStatus(before) !== 'done') issue.resolvedDate ||= today;
        } else if (issue) {
          delete issue.resolvedDate;
        }
      }
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
    issueForTask,
    taskForIssue,
    itemBoardStatus,
    issueBoardStatus,
    stored,
    hydrate,
    create,
    attach,
    prepare,
  };
})(globalThis);
