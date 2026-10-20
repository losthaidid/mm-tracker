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
      projectId = '';
    const $ = id => document.getElementById(id);
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
        )}</div><p class="standup-note">Status totals include project items and sub-items. Completion is shown separately below.</p><div class="standup-progress-pair">${progress('Project items', m.items)}${progress('Sub-items', m.subs)}</div></section>`;
    }
    function card(id) {
      const m = E.metrics(a.state(), id),
        actions = E.data(a.state()).actions.filter(r => r.projectId === id),
        tasks = new Map(a.state().tasks.map(t => [t.id, t])),
        open = actions.filter(
          r => tasks.has(r.taskId) && !tasks.get(r.taskId).done && !tasks.get(r.taskId).archived
        ).length;
      return `<button type="button" class="standup-overview-card" data-standup="open" data-project="${esc(id)}"><span class="standup-card-icon" aria-hidden="true">▤</span><span class="standup-card-copy"><span class="standup-kicker">READY FOR YOUR DAILY UPDATE</span><strong>Daily stand-up</strong><span>Project items, sub-items, remarks &amp; Actions</span><span class="standup-card-counts"><span>${m.items.total} items</span><span>${m.subs.total} sub-items</span><span>${open} open Actions</span></span></span><span class="standup-card-progress"><strong>${m.items.percent}%</strong><span>items completed</span></span><span class="standup-card-arrow" aria-hidden="true">↗</span></button>`;
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
        tasks = new Map(a.state().tasks.map(t => [t.id, t]));
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
    function itemCard(item) {
      const subs = item.subItems || [],
        complete = subs.filter(s => E.category(s.status) === 'completed').length;
      return `<details class="standup-item" open data-report-item="${esc(item.id)}"><summary><span class="standup-item-symbol" aria-hidden="true">▤</span><span class="standup-item-heading"><small>${esc(item.itemType || 'Project item')}${item.itemId ? ' · ' + esc(item.itemId) : ''}</small><strong>${esc(item.description) || 'Untitled item'}</strong><span>${subs.length ? `${complete}/${subs.length} sub-items completed` : 'No sub-items'}</span></span>${badge(item.status)}<span class="standup-chevron" aria-hidden="true">⌄</span></summary><div class="standup-item-body">${row(item)}${subs.length ? `<div class="standup-sub-list">${subs.map(sub => row(item, sub)).join('')}</div>` : ''}</div></details>`;
    }
    function body(id) {
      const project = a.state().projects.find(p => p.id === id);
      if (!project) throw Error('Project no longer exists.');
      const items = a.state().specs.filter(s => s.projectId === id);
      return `<div class="standup-report" data-owner="${esc(a.owner())}" data-project="${esc(id)}"><header class="standup-hero"><span class="standup-kicker">PROJECT OVERVIEW · DAILY STAND-UP</span><h2>${esc(project.name)}</h2><p>Every item. Every update. Your next Actions.</p></header>${strip(id)}<div class="standup-report-toolbar"><div><h3>Items &amp; updates</h3><span>All remarks shown in full · Times in Malaysia (MYT)</span></div><div class="actions">${button('expand', 'Expand all')}${button('collapse', 'Collapse all')}</div></div><div class="standup-items">${items.map(itemCard).join('') || '<div class="standup-blank"><strong>No project items yet</strong><p>Add project items to see their statuses, remarks and Actions here.</p></div>'}</div><footer class="standup-footer">Actions stay linked to Tasks. Completing an Action’s task leaves the project item’s own status unchanged.</footer></div>`;
    }
    function open(id, itemId = '') {
      guard(a.owner());
      owner = a.owner();
      projectId = id;
      a.openModal('Daily stand-up', body(id));
      if (itemId)
        [...document.querySelectorAll('[data-report-item]')]
          .find(el => el.dataset.reportItem === itemId)
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
        open(values.projectId, values.itemId);
        a.tell('Action saved to Tasks.');
      }
    }
    function taskContext(taskId) {
      const r = E.data(a.state()).actions.find(r => r.taskId === taskId);
      if (!r) return '';
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
        return;
      }
      if (report && !a.state().projects.some(p => p.id === report.dataset.project)) {
        a.closeModal();
        return;
      }
      if (report && !$('standupActionForm')) {
        const closed = [...report.querySelectorAll('details:not([open])')].map(
            el => el.dataset.reportItem
          ),
          scroll = $('modalBody').scrollTop;
        report.outerHTML = body(report.dataset.project);
        for (const el of document.querySelectorAll('[data-report-item]'))
          if (closed.includes(el.dataset.reportItem)) el.open = false;
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
        else if (action === 'task')
          a.hubAction({ dataset: { hub: 'task-detail', id: el.dataset.id } });
        else if (action === 'cancel-action') el.closest('.standup-composer-slot').innerHTML = '';
        else if (action === 'expand' || action === 'collapse')
          document.querySelectorAll('[data-report-item]').forEach(item => {
            item.open = action === 'expand';
          });
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
