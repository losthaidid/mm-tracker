/** Project table ordering and immutable, revision-safe edit previews. */
(function (root) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  const fields = ['status', 'priority', 'expectedDate', 'dueDate', 'description'];
  const labels = {
    status: 'Status',
    priority: 'Priority',
    expectedDate: 'Expected date',
    dueDate: 'Due date',
    description: 'Description',
  };
  const columns = [
    ['itemId', 'Item', 180],
    ['description', 'Description', 340],
    ['company', 'Company', 180],
    ['status', 'Status', 180],
    ['priority', 'Priority', 110],
    ['expectedDate', 'Expected date', 160],
    ['dueDate', 'Due date', 160],
    ['progress', 'Sub-items', 170],
  ];
  const label = item =>
    [item.itemType, item.itemId || item.ricefw].filter(Boolean).join(' · ') ||
    item.description ||
    'Project item';
  function selected(data, projectId, ids) {
    if (!Array.isArray(ids) || !ids.length || ids.length > 5000 || new Set(ids).size !== ids.length)
      throw Error('Select project items to update.');
    const map = new Map(data.specs.map(item => [item.id, item]));
    return ids.map(id => {
      const item = map.get(id);
      if (!item || item.projectId !== projectId || item.archived)
        throw Error('A selected item was removed, moved or archived. Select the items again.');
      return item;
    });
  }
  function capture(data, projectId, ids) {
    return selected(data, projectId, ids).map(item => ({
      id: item.id,
      value: JSON.stringify(item),
    }));
  }
  function assertSnapshot(data, projectId, snapshots) {
    const rows = selected(
      data,
      projectId,
      snapshots.map(row => row.id)
    );
    if (rows.some((row, i) => JSON.stringify(row) !== snapshots[i].value))
      throw Error('A selected item changed. Reopen the edit and review the latest values.');
    return rows;
  }
  function checkPatch(patch, options) {
    if (!patch || !Object.keys(patch).length || Object.keys(patch).some(k => !fields.includes(k)))
      throw Error('Choose at least one field to change.');
    for (const [field, value] of Object.entries(patch)) {
      if (typeof value !== 'string') throw Error('Check the values to update.');
      if (field === 'status' && !options.statuses.includes(value))
        throw Error('Choose a valid project item status.');
      if (field === 'priority' && value !== '' && !options.priorities.includes(value))
        throw Error('Choose a valid project priority.');
      if (
        ['expectedDate', 'dueDate'].includes(field) &&
        value &&
        !root.WorkHubReminders.validDate(value)
      )
        throw Error('Choose a valid date.');
      if (
        field === 'description' &&
        (!value.trim() ||
          value.length > 32767 ||
          /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
      )
        throw Error('Enter a description of up to 32,767 characters.');
    }
  }
  function patchRows(rows, patch, statusDate) {
    for (const item of rows) {
      Object.assign(item, patch);
      if (patch.status === 'Completed') item._completeSubItems = true;
      if (patch.status && statusDate) {
        item.statusDate = statusDate;
        item._statusDateExplicit = true;
      }
    }
  }
  function plan(data, projectId, ids, patch, options, snapshots) {
    checkPatch(patch, options);
    if (
      !root.WorkHubReminders.validDate(options.today) ||
      (options.statusDate && !root.WorkHubReminders.validDate(options.statusDate))
    )
      throw Error('Choose a valid status date.');
    const before = snapshots
      ? assertSnapshot(data, projectId, snapshots)
      : selected(data, projectId, ids);
    if (before.length !== ids.length || before.some((row, i) => row.id !== ids[i]))
      throw Error('The selected items changed. Reopen the edit.');
    const after = copy(before),
      changes = [];
    patchRows(after, patch, options.statusDate);
    root.WorkHubProjectDates.prepare({ specs: after }, { specs: before }, options.today);
    let children = 0;
    const changedItems = new Set();
    for (let i = 0; i < before.length; i++) {
      const old = before[i],
        next = after[i];
      for (const field of [...fields, 'statusDate'])
        if ((old[field] || '') !== (next[field] || '')) {
          changes.push({
            id: old.id,
            item: label(old),
            child: '',
            field,
            label: labels[field] || 'Status date',
            before: old[field] || '',
            after: next[field] || '',
          });
          changedItems.add(old.id);
        }
      const prior = new Map((old.subItems || []).map(sub => [sub.id, sub]));
      for (const sub of next.subItems || [])
        if (prior.get(sub.id)?.status !== sub.status) {
          children++;
          changedItems.add(old.id);
          changes.push({
            id: old.id,
            item: label(old),
            child: sub.title,
            field: 'status',
            label: 'Sub-item status',
            before: prior.get(sub.id)?.status || '',
            after: sub.status,
          });
        }
    }
    return {
      projectId,
      ids: [...ids],
      snapshots: capture(data, projectId, ids),
      patch: copy(patch),
      statusDate: options.statusDate || '',
      today: options.today,
      changes,
      changedItems: changedItems.size,
      children,
    };
  }
  function apply(data, review, options) {
    if (review.today !== options.today) throw Error('The date changed. Preview these edits again.');
    checkPatch(review.patch, options);
    const rows = assertSnapshot(data, review.projectId, review.snapshots);
    patchRows(rows, review.patch, review.statusDate);
  }
  function order(rows, sort, direction, companies = []) {
    const company = new Map(companies.map(c => [c.id, c.name])),
      compare = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }),
      dir = direction === 'desc' ? -1 : 1,
      value = row =>
        sort === 'company'
          ? company.get(row.companyId) || 'Unassigned'
          : sort === 'progress'
            ? row.subItems?.length
              ? row.subItems.filter(s => s.status === 'Completed').length / row.subItems.length
              : -1
            : sort === 'itemId'
              ? row.itemId || row.ricefw || ''
              : row[sort] || '';
    if (!columns.some(([key]) => key === sort)) return [...rows];
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const x = value(a.row),
          y = value(b.row);
        if (x === '' && y !== '') return 1;
        if (y === '' && x !== '') return -1;
        return (
          (typeof x === 'number' ? x - y : compare.compare(String(x), String(y))) * dir ||
          a.index - b.index
        );
      })
      .map(({ row }) => row);
  }
  root.WorkHubProjectItemsEngine = {
    columns,
    fields,
    label,
    capture,
    assertSnapshot,
    plan,
    apply,
    order,
  };
})(window);
