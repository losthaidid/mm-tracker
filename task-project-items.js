/* Project Items and Go-Live Issues hold shared work. A Task's type and source are independent. */
(function (root) {
  'use strict';
  const Tasks = root.WorkHubTaskCompletion;
  const TYPES = ['Project', 'Ticket', 'Custom'];
  const itemStatus = {
    todo: 'Not yet Started',
    doing: 'In Progress',
    blocked: 'Blocked',
    done: 'Completed',
  };
  const issueStatus = { todo: 'Open', doing: 'In progress', blocked: 'Blocked', done: 'Resolved' };
  const itemPriority = { Critical: 'A', High: 'A', Medium: 'B', Low: 'C' };
  const priorities = {
    a: 'High',
    b: 'Medium',
    c: 'Low',
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  const taskPriority = value => {
    const key = String(value || '')
      .trim()
      .toLowerCase();
    return Object.hasOwn(priorities, key) ? priorities[key] : 'Medium';
  };
  const copy = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const sourceProject = task =>
    task?.sourceProjectId || (task?.taskType === 'Project' ? task.linkId : '');
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
    return (
      { resolved: 'done', progress: 'doing' }[
        root.WorkHubGoLiveIssuesEngine.category(issue.status)
      ] || 'todo'
    );
  }

  const findIssue = (d, projectId, issueId) =>
    d.projects.find(p => p.id === projectId)?.goLiveIssues?.find(issue => issue.id === issueId);
  const matches = (task, item) => item && sourceProject(task) === item.projectId;
  const itemForTask = (d, task) =>
    task?.projectItemId
      ? d.specs.find(item => item.id === task.projectItemId && matches(task, item))
      : undefined;
  const taskForItem = (d, item) =>
    d.tasks.find(task => task.projectItemId === item.id && matches(task, item));
  const issueForTask = (d, task) =>
    task?.goLiveIssueId ? findIssue(d, sourceProject(task), task.goLiveIssueId) : undefined;
  const taskForIssue = (d, projectId, issueId) =>
    d.tasks.find(task => sourceProject(task) === projectId && task.goLiveIssueId === issueId);
  const itemForIssue = (d, projectId, issueId) =>
    d.specs.find(item => item.projectId === projectId && item.goLiveIssueId === issueId);

  const taskFields = ['task', 'priority', 'dueDate', 'remarks', 'feedback', 'subTasks'];
  const issueFields = [
    'title',
    'priority',
    'dueDate',
    'description',
    'resolution',
    'subItems',
    'status',
    'resolvedDate',
  ];
  const taskValues = task => Object.fromEntries(taskFields.map(key => [key, task[key]]));
  function stored(d) {
    return {
      ...d,
      tasks: d.tasks.map(task => {
        const { _issueTaskValues, ...record } = task;
        if (!task.projectItemId && !task.goLiveIssueId) return record;
        return {
          ...record,
          ...(task.goLiveIssueId ? _issueTaskValues : { subTasks: [] }),
          boardStatus: 'todo',
          done: false,
          doneDate: '',
        };
      }),
    };
  }

  function projectSubItems(subTasks, existing = []) {
    const byId = new Map(existing.map(sub => [sub.id, sub]));
    return (subTasks || []).map(sub => ({
      owner: '',
      dueDate: '',
      remarks: '',
      feedback: '',
      createdAt: '',
      updatedAt: '',
      ...byId.get(sub.id),
      ...sub,
    }));
  }
  function combinedChildren(primary, secondary) {
    const rows = new Map(projectSubItems(primary).map(row => [row.id, row]));
    for (const row of projectSubItems(secondary)) if (!rows.has(row.id)) rows.set(row.id, row);
    return [...rows.values()];
  }
  function sharedChildren(issue, task) {
    if (issue.linkedTaskId || !task) return copy(issue.subItems || []);
    return combinedChildren(issue.subItems, task._issueTaskValues?.subTasks || task.subTasks);
  }

  function hydrate(d) {
    const items = new Map(d.specs.map(item => [item.id, item]));
    for (const task of d.tasks) {
      if (task.goLiveIssueId) {
        const issue = issueForTask(d, task);
        if (issue) {
          task._issueTaskValues ||= taskValues(task);
          const fallback = issue.linkedTaskId ? {} : task._issueTaskValues;
          task.task = issue.title;
          task.priority = taskPriority(issue.priority || fallback.priority);
          task.dueDate = issue.dueDate ?? fallback.dueDate ?? '';
          task.remarks = issue.description || fallback.remarks || '';
          task.feedback = issue.resolution || fallback.feedback || '';
          task.subTasks = sharedChildren(issue, task);
        } else if (task._issueTaskValues) {
          Object.assign(task, task._issueTaskValues);
        }
        task.doneDate = issue?.resolvedDate || '';
        Tasks.setStatus(task, issue ? issueBoardStatus(issue) : 'todo', task.doneDate);
      } else if (task.projectItemId) {
        const item = items.get(task.projectItemId);
        const source = matches(task, item) ? item : null;
        task.subTasks = copy(source?.subItems || []);
        task.doneDate = source?.statusDate || '';
        Tasks.setStatus(task, source ? itemBoardStatus(source) : 'todo', task.doneDate);
      }
    }
    return d;
  }

  function create(d, task, itemType, itemId, projectId = task.linkId) {
    const item = {
      id: itemId,
      projectId,
      companyId: task.companyId || '',
      itemType,
      itemId: '',
      ricefw: '',
      description: task.task,
      status: itemStatus[Tasks.status(task)],
      statusDate: task.doneDate,
      priority: itemPriority[task.priority] || 'B',
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

  const taskToIssue = {
    task: 'title',
    priority: 'priority',
    dueDate: 'dueDate',
    remarks: 'description',
    feedback: 'resolution',
  };
  const itemToIssue = {
    description: 'title',
    priority: 'priority',
    dueDate: 'dueDate',
    remarks: 'description',
    feedback: 'resolution',
  };
  function updateDetails(issue, record, previous, fields, priority) {
    for (const [from, to] of Object.entries(fields))
      if (record[from] !== previous[from])
        issue[to] = from === 'priority' ? priority(record[from]) : record[from];
  }
  function adopt(issue, task, previousIssue = issue) {
    if (issue.linkedTaskId || !task) return;
    issue.linkedTaskId = task.id;
    if (same(issue.subItems, previousIssue.subItems))
      issue.subItems = combinedChildren(issue.subItems, task.subTasks);
    issue.dueDate ??= task.dueDate || '';
    if (!issue.description && issue.description === previousIssue.description)
      issue.description = task.remarks || '';
    if (!issue.resolution && issue.resolution === previousIssue.resolution)
      issue.resolution = task.feedback || '';
    issue.priority ||= task.priority || '';
  }

  function projectItemFromIssue(item, issue) {
    item.description = issue.title;
    item.priority = itemPriority[taskPriority(issue.priority)] || 'B';
    item.dueDate = issue.dueDate || '';
    item.remarks = issue.description;
    item.feedback = issue.resolution;
    const board = issueBoardStatus(issue);
    const status = ['Testing', 'Development', 'UAT', 'Pending Review'].find(
      v => v.toLowerCase() === issue.status.toLowerCase()
    );
    item.status = status || itemStatus[board];
    if (board === 'done' && issue.resolvedDate && item.statusDate !== issue.resolvedDate) {
      item.statusDate = issue.resolvedDate;
      item._statusDateExplicit = true;
    }
    item.subItems = projectSubItems(issue.subItems, item.subItems);
  }

  function connectIssue(d, task, projectId, issueId, choice, defaults, uid) {
    const issue = findIssue(d, projectId, issueId);
    if (!issue) throw Error('The Go-Live issue is unavailable.');
    const current = taskForIssue(d, projectId, issueId);
    const assigned = itemForIssue(d, projectId, issueId);
    if (assigned) throw Error('This issue already has a Project Item.');
    if (current && current.id !== task.id)
      throw Error('This issue already has another linked task.');
    const itemId =
      choice === 'new'
        ? create(d, { ...task, companyId: '' }, defaults.itemType, uid(), projectId)
        : choice;
    const item = d.specs.find(row => row.id === itemId && row.projectId === projectId);
    if (!item || item.goLiveIssueId)
      throw Error('Choose an available Project Item from this project.');
    const existing = taskForItem(d, item);
    if (existing?.goLiveIssueId && existing.goLiveIssueId !== issueId)
      throw Error('That task is already linked to a different Go-Live issue.');
    if (current && existing && existing.id !== task.id)
      throw Error('Choose a Project Item that can use this issue’s existing task.');
    const target = existing || task;
    const children = combinedChildren(sharedChildren(issue, current), item.subItems);
    adopt(issue, { ...target, subTasks: children });
    issue.linkedTaskId = target.id;
    issue.subItems = children;
    updateDetails(issue, task, defaults.prefill, taskToIssue, taskPriority);
    item.goLiveIssueId = issueId;
    target.sourceProjectId = projectId;
    target.projectItemId = item.id;
    target.goLiveIssueId = issueId;
    target._issueTaskValues ||= {
      ...taskValues(target),
      ...(existing ? {} : { remarks: '', feedback: '' }),
      subTasks: [],
    };
    projectItemFromIssue(item, issue);
    return target;
  }

  function prepare(next, previous, canEdit, restoring, today) {
    if (restoring) return;
    const oldTasks = new Map(previous.tasks.map(task => [task.id, task]));
    const oldItems = new Map(previous.specs.map(item => [item.id, item]));
    const oldProjects = new Map(previous.projects.map(project => [project.id, project]));
    const items = new Map(next.specs.map(item => [item.id, item]));
    const taskChanges = new Set();
    for (const task of next.tasks) {
      const old = oldTasks.get(task.id);
      if (!old || sourceProject(task) !== sourceProject(old)) continue;
      const statusChanged = Tasks.status(task) !== Tasks.status(old);
      const dateChanged = task.doneDate !== old.doneDate;
      const childrenChanged = !same(task.subTasks, old.subTasks);
      if (task.goLiveIssueId && task.goLiveIssueId === old.goLiveIssueId) {
        const detailsChanged = Object.keys(taskToIssue).some(key => task[key] !== old[key]);
        if (!statusChanged && !dateChanged && !childrenChanged && !detailsChanged) continue;
        const issue = issueForTask(next, task);
        if (!issue) throw Error('The linked Go-Live issue is unavailable.');
        if (!canEdit) throw Error('Project edit access is required to change shared Go-Live work.');
        adopt(issue, old);
        updateDetails(issue, task, old, taskToIssue, taskPriority);
        if (statusChanged) issue.status = issueStatus[Tasks.status(task)];
        if (task.done && dateChanged && task.doneDate) issue.resolvedDate = task.doneDate;
        if (childrenChanged) issue.subItems = projectSubItems(task.subTasks, issue.subItems);
        taskChanges.add(issue);
      } else if (task.projectItemId && task.projectItemId === old.projectItemId) {
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
    for (const item of next.specs) {
      if (!item.goLiveIssueId) continue;
      const issue = findIssue(next, item.projectId, item.goLiveIssueId);
      if (!issue) continue;
      const old = oldItems.get(item.id);
      if (old?.goLiveIssueId === item.goLiveIssueId && !taskChanges.has(issue)) {
        updateDetails(issue, item, old, itemToIssue, taskPriority);
        if (old.status !== item.status) {
          const board = itemBoardStatus(item);
          issue.status = board === 'doing' ? item.status : issueStatus[board];
        }
        if (
          itemBoardStatus(item) === 'done' &&
          item.statusDate !== old.statusDate &&
          item.statusDate
        )
          issue.resolvedDate = item.statusDate;
        if (!same(item.subItems, old.subItems))
          issue.subItems = projectSubItems(item.subItems, issue.subItems);
      }
    }

    for (const project of next.projects) {
      const oldIssues = new Map(
        (oldProjects.get(project.id)?.goLiveIssues || []).map(issue => [issue.id, issue])
      );
      for (const issue of project.goLiveIssues || []) {
        const before = oldIssues.get(issue.id);
        if (!before || issueFields.some(key => !same(issue[key], before[key]))) {
          adopt(issue, taskForIssue(next, project.id, issue.id), before || issue);
          const board = issueBoardStatus(issue);
          const children = issue.subItems || [];
          if (board === 'done' && before && issueBoardStatus(before) !== 'done') {
            issue.resolvedDate ||= today;
            issue.subItems = children.map(sub => ({ ...sub, status: 'Completed' }));
          } else if (
            before?.status === issue.status &&
            board !== 'done' &&
            children.length &&
            !same(children, before.subItems || []) &&
            children.every(sub => sub.status === 'Completed')
          ) {
            issue.status = 'Resolved';
            issue.resolvedDate = today;
          } else if (board !== 'done') {
            delete issue.resolvedDate;
          }
        }
      }
    }
    for (const item of next.specs) {
      if (!item.goLiveIssueId) continue;
      const issue = findIssue(next, item.projectId, item.goLiveIssueId);
      if (issue) projectItemFromIssue(item, issue);
    }
  }

  function finish(d, today) {
    for (const item of d.specs) {
      if (!item.goLiveIssueId) continue;
      const issue = findIssue(d, item.projectId, item.goLiveIssueId);
      if (!issue) continue;
      const statuses = new Map(item.subItems.map(sub => [sub.id, sub.status]));
      for (const sub of issue.subItems || [])
        if (statuses.has(sub.id)) sub.status = statuses.get(sub.id);
      if (itemBoardStatus(item) === 'done' && issueBoardStatus(issue) !== 'done') {
        issue.status = 'Resolved';
        issue.resolvedDate = item.statusDate || today;
      }
    }
  }

  root.WorkHubTaskProjectItems = {
    TYPES,
    itemForTask,
    taskForItem,
    issueForTask,
    taskForIssue,
    itemForIssue,
    sourceProject,
    itemBoardStatus,
    issueBoardStatus,
    taskPriority,
    sharedChildren,
    stored,
    hydrate,
    create,
    attach,
    connectIssue,
    prepare,
    finish,
  };
})(globalThis);
