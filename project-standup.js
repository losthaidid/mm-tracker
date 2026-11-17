/** project-standup.js — Project Overview report card, item/sub-item remarks and Actions. */
(function (root) {
  'use strict';
  const E = root.WorkHubProjectStandupEngine;
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const uid = () => root.crypto.randomUUID();
  const dateTime = value => {
    if (!value || !Number.isFinite(Date.parse(value))) return '';
    return new Intl.DateTimeFormat('en-MY', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Asia/Kuala_Lumpur',
    }).format(new Date(value));
  };
  const itemName = item =>
    [item.itemId || item.ricefw, item.description].filter(Boolean).join(' · ') || 'Untitled item';
  function install(a) {
    let owner = '',
      projectId = '',
      searchQuery = '';
    const $ = id => document.getElementById(id);
    const links = root.WorkHubTaskProjectItems;
    const generalTasks = id => (a.can('tasks') ? E.generalTasks(a.state(), id) : []);
    const reportRows = report => [...report.querySelectorAll('[data-report-row]')];
    const openRows = report =>
      new Set(
        reportRows(report)
          .filter(row => row.open)
          .map(row => row.dataset.reportRow)
      );
    const attrs = (item, sub = '') =>
      `data-project="${esc(item.projectId)}" data-item="${esc(item.id)}" data-sub="${esc(sub)}"`;
    const button = (action, label, attributes = '', cls = 'small') =>
      `<button type="button" class="${cls}" data-standup="${action}" ${attributes}>${label}</button>`;
    function guard(expected = owner) {
      if (!a.ready() || !a.owner() || (expected && expected !== a.owner()))
        throw Error('Open this project again after signing in.');
    }
    function badge(status, category = E.category(status)) {
      return `<span class="standup-status" data-status="${category}">${esc(status) || 'Not started'}</span>`;
    }
    function progress(label, count) {
      return `<div class="standup-progress-row"><span>${label}</span><strong>${count.completed}/${count.total} completed · ${count.percent}%</strong><div role="progressbar" aria-label="${label} completed" aria-valuenow="${count.percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${count.percent}%"></span></div></div>`;
    }
    function strip(id) {
      const m = E.metrics(a.state(), id);
      return `<section class="standup-progress" aria-label="Project progress summary"><div class="standup-metrics">${[
        ['Project items', m.items.total, 'items'],
        ['Sub-items', m.subs.total, 'subs'],
        ['Completed', m.all.completed, 'completed'],
        ['In progress', m.all.inProgress, 'inProgress'],
        ['Blocked / on hold', m.all.blocked, 'blocked'],
        ['Not started', m.all.notStarted, 'notStarted'],
      ]
        .map(
          ([label, count, tone]) =>
            `<div data-tone="${tone}"><strong>${count}</strong><span>${label}</span></div>`
        )
        .join(
          ''
        )}</div><p class="standup-note">Totals cover project items and their sub-items.</p><div class="standup-progress-pair">${progress('Project items', m.items)}${progress('Sub-items', m.subs)}</div></section>`;
    }
    function card(id) {
      const m = E.metrics(a.state(), id),
        actions = E.data(a.state()).actions.filter(r => r.projectId === id),
        tasks = new Map(a.can('tasks') ? a.state().tasks.map(t => [t.id, t]) : []),
        general = generalTasks(id).length,
        open = actions.filter(
          r => tasks.has(r.taskId) && !tasks.get(r.taskId).done && !tasks.get(r.taskId).archived
        ).length;
      return `<button type="button" class="standup-overview-card" data-standup="open" data-project="${esc(id)}"><span class="standup-card-icon" aria-hidden="true">▤</span><span class="standup-card-copy"><span class="standup-kicker">READY FOR YOUR DAILY UPDATE</span><strong>Daily stand-up</strong><span>Project items, tasks, remarks &amp; Actions</span><span class="standup-card-counts"><span>${m.items.total} items</span><span>${m.subs.total} sub-items</span>${general ? `<span>${general} general task${general === 1 ? '' : 's'}</span>` : ''}<span>${open} open Actions</span></span></span><span class="standup-card-progress"><strong>${m.items.percent}%</strong><span>items completed</span></span><span class="standup-card-arrow" aria-hidden="true">↗</span></button>`;
    }
    function stamp(item, sub) {
      const times = E.updateTime(a.state(), item, sub),
        stale = times.updatedAt && Date.now() - Date.parse(times.updatedAt) > 14 * 86400000;
      return `<div class="standup-stamp${stale ? ' is-stale' : ''}">${times.updatedAt ? `<time datetime="${esc(times.updatedAt)}">Updated ${esc(dateTime(times.updatedAt))}</time>${stale ? '<span>Over 14 days ago</span>' : ''}` : '<span>Update time not recorded</span>'}${times.remarksAt && times.remarksAt !== times.updatedAt ? `<span>Remarks ${esc(dateTime(times.remarksAt))}</span>` : ''}</div>`;
    }
    function actions(item, sub = null) {
      const rows = E.data(a.state()).actions.filter(
          r =>
            r.projectId === item.projectId &&
            r.itemId === item.id &&
            r.subItemId === (sub?.id || '')
        ),
        tasks = new Map(a.can('tasks') ? a.state().tasks.map(t => [t.id, t]) : []);
      return `<section class="standup-actions"><div class="standup-actions-head"><h4>Actions <span>${rows.length || ''}</span></h4>${button('add', '+ Add action', attrs(item, sub?.id))}</div>${
        rows.length
          ? `<ul>${rows
              .map(r => {
                const task = tasks.get(r.taskId),
                  status = E.taskStatus(task);
                return `<li><div class="standup-action-text"><p>${esc(task?.task || r.text)}</p><div class="standup-action-meta">${badge(status, task?.done ? 'completed' : task?.boardStatus === 'blocked' ? 'blocked' : 'action')}<span>${task?.dueDate ? 'Due ' + esc(task.dueDate) : task ? 'No due date' : 'Saved instruction retained'}</span></div></div><div class="standup-action-controls">${task ? button('task', 'Open task ↗', `data-id="${esc(task.id)}"`) : ''}${button('edit', task ? 'Edit' : 'Recreate task', `data-id="${esc(r.id)}" ${attrs(item, sub?.id)}`)}</div></li>`;
              })
              .join('')}</ul>`
          : '<p class="standup-empty-actions">Capture a follow-up here. Saving creates its linked task.</p>'
      }<div class="standup-composer-slot" ${attrs(item, sub?.id)}></div></section>`;
    }
    function row(item, sub = null) {
      const r = sub || item;
      return `<div class="standup-row${sub ? ' standup-sub-row' : ''}" ${attrs(item, sub?.id)}>${sub ? `<div class="standup-sub-heading"><span class="standup-sub-marker" aria-hidden="true">↳</span><h3>${esc(sub.title)}</h3>${badge(sub.status)}</div>` : ''}<div class="standup-row-columns"><section class="standup-remarks"><h4>Remarks</h4><p${r.remarks ? '' : ' class="is-empty"'}>${esc(r.remarks) || 'No remarks yet.'}</p>${stamp(item, sub)}</section>${actions(item, sub)}</div></div>`;
    }
    function rowHeading(symbol, label, title, status, subs) {
      const complete = subs.filter(sub => E.category(sub.status) === 'completed').length;
      return `<summary><span class="standup-item-symbol" aria-hidden="true">${symbol}</span><span class="standup-item-heading"><small>${esc(label)}</small><strong>${esc(title)}</strong><span>${subs.length ? `${complete}/${subs.length} sub-items completed` : 'No sub-items'}</span></span>${badge(status)}<span class="standup-chevron" aria-hidden="true">⌄</span></summary>`;
    }
    function itemCard(item, task) {
      const subs = item.subItems || [],
        label = [item.itemType || 'Project item', item.itemId, task && 'Linked task']
          .filter(Boolean)
          .join(' · ');
      return `<details class="standup-item" data-report-item="${esc(item.id)}" data-report-row="item:${esc(item.id)}">${rowHeading('▤', label, item.description || 'Untitled item', item.status, subs)}<div class="standup-item-body">${task ? `<div class="standup-linked-task"><span class="standup-task-title"><small>Linked task</small><strong>${esc(task.task)}</strong></span>${button('task', 'Open task ↗', `data-id="${esc(task.id)}"`)}</div>` : ''}${row(item)}${subs.length ? `<div class="standup-sub-list">${subs.map(sub => row(item, sub)).join('')}</div>` : ''}</div></details>`;
    }
    function taskNotes(record) {
      return `<section class="standup-remarks"><h4>Remarks</h4><p${record.remarks ? '' : ' class="is-empty"'}>${esc(record.remarks) || 'No remarks yet.'}</p>${record.feedback ? `<h4>Feedback</h4><p>${esc(record.feedback)}</p>` : ''}</section>`;
    }
    function taskCard(task) {
      const subs = task.subTasks || [],
        label = [
          task.number && 'Task ' + task.number,
          a.taskCompanyLabel(task),
          task.dueDate && 'Due ' + task.dueDate,
        ]
          .filter(Boolean)
          .join(' · ');
      return `<details class="standup-item standup-general-task" data-report-task="${esc(task.id)}" data-report-row="task:${esc(task.id)}">${rowHeading('☷', label || 'General project task', task.task, E.taskStatus(task), subs)}<div class="standup-item-body"><div class="standup-row standup-row-columns">${taskNotes(task)}${button('task', 'Open task ↗', `data-id="${esc(task.id)}"`)}</div>${subs.length ? `<div class="standup-sub-list">${subs.map(sub => `<div class="standup-row standup-sub-row" data-sub="${esc(sub.id)}"><div class="standup-sub-heading"><span class="standup-sub-marker" aria-hidden="true">↳</span><h3>${esc(sub.title)}</h3>${badge(sub.status)}</div>${sub.remarks || sub.feedback ? taskNotes(sub) : ''}</div>`).join('')}</div>` : ''}</div></details>`;
    }
    function searchBar() {
      return `<section class="standup-search" role="search" aria-label="Search daily stand-up"><div class="standup-search-toolbar"><label for="standupSearch">Find an item, task or update</label><div class="actions">${button('expand', 'Expand all')}${button('collapse', 'Collapse all')}</div></div><div class="standup-search-field"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="standupSearch" type="search" maxlength="200" autocomplete="off" placeholder="Search tasks, items, remarks or Actions…" aria-describedby="standupSearchResults" value="${esc(searchQuery)}">${button('clear-search', 'Clear', 'hidden', 'small standup-search-clear')}</div><p id="standupSearchResults" role="status" aria-live="polite" aria-atomic="true"></p></section>`;
    }
    function highlight(report, terms) {
      // Build marks as text nodes: punctuation and pasted HTML are always literal text.
      const targets = report.querySelectorAll(
        '.standup-item-heading small, .standup-item-heading strong, .standup-task-title strong, .standup-sub-heading h3, .standup-status, .standup-remarks > p:not(.is-empty), .standup-action-text > p, .standup-action-meta > span:not(.standup-status)'
      );
      for (const el of targets) {
        const value = el.textContent,
          lower = value.toLowerCase(),
          fragments = [];
        let at = 0;
        while (terms.length && at < value.length) {
          const hits = terms
              .map(term => ({ term, at: lower.indexOf(term, at) }))
              .filter(hit => hit.at !== -1)
              .sort((a, b) => a.at - b.at || b.term.length - a.term.length),
            hit = hits[0];
          if (!hit) break;
          fragments.push(document.createTextNode(value.slice(at, hit.at)));
          const mark = document.createElement('mark');
          mark.textContent = value.slice(hit.at, hit.at + hit.term.length);
          fragments.push(mark);
          at = hit.at + hit.term.length;
        }
        fragments.push(document.createTextNode(value.slice(at)));
        el.replaceChildren(...fragments);
      }
    }
    function applySearch(report) {
      searchQuery = report.querySelector('#standupSearch').value;
      const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean),
        active = !!terms.length,
        id = report.dataset.project,
        cards = reportRows(report),
        tasks = generalTasks(id),
        itemMatches = E.search(a.state(), id, searchQuery, a.can('tasks')),
        taskMatches = E.searchTasks(tasks, searchQuery),
        matches = new Map([
          ...itemMatches.map(row => ['item:' + row.itemId, row]),
          ...taskMatches.map(row => ['task:' + row.taskId, row]),
        ]);
      let subMatches = 0;
      for (const card of cards) {
        const match = matches.get(card.dataset.reportRow);
        card.hidden = !match;
        for (const sub of card.querySelectorAll('.standup-sub-row'))
          sub.classList.toggle(
            'is-search-match',
            active && !!match?.subItemIds.includes(sub.dataset.sub)
          );
        subMatches += match?.subItemIds.length || 0;
      }
      for (const group of report.querySelectorAll('.standup-group'))
        group.hidden = active && !group.querySelector('[data-report-row]:not([hidden])');
      report.querySelector('[data-standup="clear-search"]').hidden = !searchQuery;
      report.querySelector('.standup-no-results').hidden = !active || !!matches.size;
      const itemCount = cards.length - tasks.length,
        taskCount = tasks.length
          ? ` · ${active ? taskMatches.length + ' of ' : ''}${tasks.length} general task${tasks.length === 1 ? '' : 's'}`
          : '',
        subCount = `${subMatches} ${active ? 'matching ' : ''}sub-item${subMatches === 1 ? '' : 's'}`;
      report.querySelector('#standupSearchResults').textContent =
        `${active ? itemMatches.length + ' of ' : 'Showing '}${itemCount} project item${itemCount === 1 ? '' : 's'}${taskCount} · ${subCount}`;
      highlight(report, terms);
    }
    function body(id) {
      const state = a.state(),
        project = state.projects.find(p => p.id === id);
      if (!project) throw Error('Project no longer exists.');
      const items = state.specs.filter(s => s.projectId === id),
        tasks = generalTasks(id),
        linked = new Map(
          a.can('tasks')
            ? state.tasks
                .filter(
                  task => task.taskType === 'Project' && task.linkId === id && task.projectItemId
                )
                .map(task => [task.projectItemId, task])
            : []
        );
      return `<div class="standup-report" data-owner="${esc(a.owner())}" data-project="${esc(id)}"><div class="standup-hero"><h2>${esc(project.name)}</h2></div>${strip(id)}${searchBar()}<div class="standup-items"><div class="standup-blank standup-no-results" hidden><strong>No matching items or updates</strong><p>Try another keyword, or clear your search.</p></div><section class="standup-group" aria-labelledby="standupItemsTitle"><h3 class="standup-group-title" id="standupItemsTitle">Project items <span>${items.length}</span></h3>${items.map(item => itemCard(item, linked.get(item.id))).join('') || '<div class="standup-blank"><strong>No project items yet</strong></div>'}</section>${a.can('tasks') ? `<section class="standup-group" aria-labelledby="standupGeneralTitle"><h3 class="standup-group-title" id="standupGeneralTitle">General project work <span>${tasks.length}</span></h3>${tasks.map(taskCard).join('') || '<div class="standup-blank"><strong>No general project tasks yet</strong></div>'}</section>` : ''}</div><footer class="standup-footer">Actions stay linked to Tasks. Completing an Action’s task leaves the project item’s own status unchanged.</footer></div>`;
    }
    function open(id, itemId = '', retainSearch = false) {
      guard(a.owner());
      const currentReport = document.querySelector('.standup-report'),
        keep = retainSearch && owner === a.owner() && projectId === id && currentReport,
        opened = keep ? openRows(currentReport) : new Set();
      if (!keep) searchQuery = '';
      if (itemId) opened.add('item:' + itemId);
      owner = a.owner();
      projectId = id;
      a.openModal('Daily stand-up', body(id));
      const report = document.querySelector('.standup-report');
      for (const row of reportRows(report)) row.open = opened.has(row.dataset.reportRow);
      applySearch(report);
      if (itemId)
        reportRows(report)
          .find(row => row.dataset.reportItem === itemId)
          ?.scrollIntoView?.({ block: 'nearest' });
    }
    function editor(itemId, subItemId = '', actionId = '') {
      guard();
      const state = a.state(),
        old = actionId ? E.data(state).actions.find(r => r.id === actionId) : null;
      if (actionId && !old) throw Error('Action no longer exists.');
      const source = E.source(state, projectId, itemId, subItemId),
        task = old && state.tasks.find(t => t.id === old.taskId);
      for (const el of document.querySelectorAll('.standup-composer-slot')) el.innerHTML = '';
      const slot = [...document.querySelectorAll('.standup-composer-slot')].find(
        el => el.dataset.item === itemId && el.dataset.sub === subItemId
      );
      if (!slot) return;
      slot.innerHTML = `<form id="standupActionForm" data-owner="${esc(owner)}" data-id="${esc(old?.id || uid())}" data-existing="${!!old}" data-task="${esc(task?.id || '')}" ${attrs(source.item, subItemId)}><label for="standupActionText">Actions</label><textarea id="standupActionText" name="text" required maxlength="32767" placeholder="e.g. Email the business team to request feedback">${esc(task?.task || old?.text || '')}</textarea><label for="standupActionDue">Due date <span>optional</span></label><input id="standupActionDue" name="dueDate" type="date" value="${esc(task?.dueDate || '')}"><input type="hidden" name="originalText" value="${esc(task?.task || '')}"><input type="hidden" name="originalDueDate" value="${esc(task?.dueDate || '')}"><div class="actions">${button('cancel-action', 'Cancel')}<button type="submit" class="primary">${task ? 'Save action' : 'Save action & create task'}</button></div><p class="standup-note">${task ? 'Updates the same linked task.' : 'Creates one task linked to this project and item.'}</p></form>`;
      $('standupActionText').focus();
    }
    function saveAction(form) {
      guard(form.dataset.owner);
      const value = name => form.elements.namedItem(name).value,
        values = {
          id: form.dataset.id,
          projectId: form.dataset.project,
          itemId: form.dataset.item,
          subItemId: form.dataset.sub,
          text: value('text'),
          dueDate: value('dueDate'),
          originalText: value('originalText'),
          originalDueDate: value('originalDueDate'),
          originalTaskId: form.dataset.task || '',
        };
      if (
        form.dataset.existing === 'true' &&
        !E.data(a.state()).actions.some(r => r.id === values.id)
      )
        throw Error('This Action changed. Reopen the summary before saving.');
      const ok = a.mutate(d => E.upsertAction(d, values, new Date().toISOString(), uid));
      if (ok) {
        open(values.projectId, values.itemId, true);
        a.tell('Action saved to Tasks.');
      }
    }
    function taskContext(taskId) {
      const r = E.data(a.state()).actions.find(r => r.taskId === taskId);
      if (!a.can('specs')) return '';
      if (!r) {
        const state = a.state(),
          task = state.tasks.find(row => row.id === taskId);
        const item = links.itemForTask(state, task);
        if (!item)
          return task?.projectItemId
            ? '<p class="standup-task-context wide">Linked project item unavailable.</p>'
            : '';
        const open = a.can('projects.standup')
          ? button('source', 'Open in Daily stand-up ↗', attrs(item))
          : `<button type="button" class="small" data-action="manage-subitems" data-access-feature="specs" data-id="${esc(item.id)}">Open project sub-items ↗</button>`;
        return `<div class="standup-task-context wide"><span class="standup-kicker">PROJECT ITEM</span><strong class="hub-sensitive">${esc(itemName(item))}</strong>${open}</div>`;
      }
      let src;
      try {
        src = E.source(a.state(), r.projectId, r.itemId, r.subItemId);
      } catch {
        return '<p class="standup-task-context">Action · original project item was removed.</p>';
      }
      return `<div class="standup-task-context wide"><span class="standup-kicker">PROJECT ACTION</span><strong>${esc(src.project.name)}</strong><span>${esc(itemName(src.item))}${src.sub ? ' → ' + esc(src.sub.title) : ''}</span>${button('source', 'Open in project summary ↗', `data-project="${esc(r.projectId)}" data-item="${esc(r.itemId)}"`)}</div>`;
    }
    function sync() {
      const report = document.querySelector('.standup-report');
      if (report && (!a.ready() || report.dataset.owner !== a.owner())) {
        a.closeModal();
        owner = '';
        projectId = '';
        searchQuery = '';
        return;
      }
      if (report && !a.state().projects.some(p => p.id === report.dataset.project)) {
        a.closeModal();
        return;
      }
      if (report && !$('standupActionForm')) {
        const opened = openRows(report),
          scroll = $('modalBody').scrollTop,
          input = $('standupSearch'),
          focused = document.activeElement === input,
          selection = [input.selectionStart, input.selectionEnd];
        searchQuery = input.value;
        report.outerHTML = body(report.dataset.project);
        const updated = document.querySelector('.standup-report');
        for (const row of reportRows(updated)) row.open = opened.has(row.dataset.reportRow);
        applySearch(updated);
        if (focused) {
          $('standupSearch').focus({ preventScroll: true });
          $('standupSearch').setSelectionRange(...selection);
        }
        $('modalBody').scrollTop = scroll;
      }
      for (const card of document.querySelectorAll('.task-main-card,[data-task-card]')) {
        const id =
          card.dataset.taskCard ||
          card.querySelector('[data-action="edit"][data-group="tasks"]')?.dataset.id;
        if (id && !card.querySelector('.standup-task-context')) {
          const html = taskContext(id);
          if (html) card.insertAdjacentHTML('beforeend', html);
        }
      }
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-standup]');
      if (!el) return;
      event.preventDefault();
      try {
        const action = el.dataset.standup;
        if (action === 'open' || action === 'source') {
          open(el.dataset.project, el.dataset.item);
          return;
        }
        guard();
        if (action === 'add' || action === 'edit')
          editor(el.dataset.item, el.dataset.sub, action === 'edit' ? el.dataset.id : '');
        else if (action === 'task' && a.can('tasks'))
          a.hubAction({ dataset: { hub: 'task-detail', id: el.dataset.id } });
        else if (action === 'cancel-action') el.closest('.standup-composer-slot').innerHTML = '';
        else if (action === 'clear-search') {
          $('standupSearch').value = '';
          applySearch(el.closest('.standup-report'));
          $('standupSearch').focus({ preventScroll: true });
        } else if (action === 'expand' || action === 'collapse')
          document.querySelectorAll('[data-report-row]:not([hidden])').forEach(item => {
            item.open = action === 'expand';
          });
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('input', event => {
      if (event.target.id !== 'standupSearch') return;
      try {
        guard();
        applySearch(event.target.closest('.standup-report'));
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    document.addEventListener('submit', event => {
      if (event.target.id !== 'standupActionForm') return;
      event.preventDefault();
      try {
        saveAction(event.target);
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    return { card, open, sync, saveAction, taskContext };
  }
  root.WorkHubProjectStandup = { install };
})(window);
