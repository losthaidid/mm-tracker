/* Main-task completion uses the shared save pipeline; older groups need an explicit review. */
(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(
    /[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
  const allComplete = task =>
    !!task.subTasks?.length && task.subTasks.every(sub => sub.status === 'Completed');
  const pending = tasks => tasks.filter(task => !task.done && !task.archived && allComplete(task));
  function prepare(next, previous, date, at, restoring = false) {
    const oldTasks = new Map((previous?.tasks || []).map(task => [task.id, task]));
    for (const task of next.tasks || []) {
      const old = oldTasks.get(task.id),
        lifecycleChanged = !!old && ['done', 'boardStatus', 'archived']
          .some(field => old[field] !== task[field]);
      if (!restoring && !lifecycleChanged && !task.done && !task.archived && allComplete(task)) {
        const oldSubs = new Map((old?.subTasks || []).map(sub => [sub.id, sub.status])),
          changed = oldSubs.size !== task.subTasks.length ||
            task.subTasks.some(sub => oldSubs.get(sub.id) !== sub.status);
        if (changed) {
          task.done = true;
          task.doneDate = task.doneDate || date;
        }
      }
      if (task.done) {
        task.boardStatus = 'done';
        if (!restoring && !old?.done)
          task.subTasks = (task.subTasks || []).map(sub =>
            sub.status === 'Completed' ? sub : { ...sub, status: 'Completed', updatedAt: at }
          );
      } else if (task.boardStatus === 'done') task.boardStatus = 'todo';
    }
  }
  function install(a) {
    const reviews = new WeakMap(),
      ready = () => !!a.cloud().ready,
      identity = () => a.cloud().user?.id || 'local',
      generation = () => a.cloud().generation,
      editable = () => ready() && a.canEdit();
    function mount(tab) {
      const old = document.getElementById('taskCompletionNotice');
      if (tab !== 'tasks' || !editable()) {
        old?.remove();
        return;
      }
      const rows = pending(a.state().tasks);
      if (!rows.length) {
        old?.remove();
        return;
      }
      const notice = old || document.createElement('aside');
      notice.id = 'taskCompletionNotice';
      notice.className = 'task-completion-notice';
      notice.setAttribute('aria-label', 'Main tasks ready to complete');
      notice.innerHTML =
        '<div><strong>All subtasks complete. One last step.</strong><p>' +
        rows.length + ' main task' + (rows.length === 1 ? ' still has' : 's still have') +
        ' an open status.</p></div><button type="button" data-task-completion-review>' +
        'Review main tasks</button>';
      if (!old) document.getElementById('view')?.prepend(notice);
    }
    function review() {
      if (!editable()) throw Error('Your account cannot complete main tasks.');
      const available = pending(a.state().tasks),
        rows = available.slice(0, 100);
      if (!rows.length) throw Error('There are no main tasks ready to complete.');
      a.openModal(
        'Complete main tasks',
        '<form id="taskCompletionForm" data-access-feature="tasks">' +
        '<p>These main tasks have completed subtasks. Choose which main tasks to mark Completed.</p>' +
        (available.length > 100 ? '<p class="muted">Showing the first 100 of ' +
          available.length + ' tasks. Review the remaining tasks in another batch.</p>' : '') +
        '<div class="task-completion-list">' + rows.map(task =>
          '<label><input type="checkbox" name="tasks" value="' + esc(task.id) +
          '" checked><span><strong>' +
          esc([task.number, task.task].filter(Boolean).join(' · ')) +
          '</strong><small>' + task.subTasks.length + ' / ' + task.subTasks.length +
          ' subtasks complete</small></span></label>'
        ).join('') + '</div><label for="taskCompletionDate">Completion date</label>' +
        '<input type="date" id="taskCompletionDate" name="completionDate" required value="' +
        esc(a.today()) + '"><p class="muted">Subtask notes, feedback and dates stay as recorded. ' +
        'Completed main tasks appear in Completed tasks.</p><div class="modal-actions">' +
        '<button type="button" data-action="cancel">Cancel</button>' +
        '<button type="submit" class="primary">Complete selected tasks</button></div></form>'
      );
      const form = document.getElementById('taskCompletionForm');
      if (!form) throw Error('The completion review could not be opened.');
      reviews.set(form, {
        owner: identity(),
        generation: generation(),
        rows: new Map(rows.map(task => [task.id, JSON.stringify(task)])),
      });
    }
    function apply(form) {
      const review = reviews.get(form),
        modal = document.getElementById('modal');
      if (!editable()) throw Error('Your account cannot complete main tasks.');
      if (!review || document.getElementById('taskCompletionForm') !== form || !modal?.open ||
          review.owner !== identity() || review.generation !== generation())
        throw Error('This completion review expired. Open it again.');
      const selected = [...form.querySelectorAll('[name="tasks"]:checked')].map(el => el.value),
        date = form.elements.namedItem('completionDate')?.value;
      if (!selected.length) throw Error('Choose at least one main task.');
      if (!date || !a.validDate(date)) throw Error('Choose a valid completion date.');
      const current = new Map(a.state().tasks.map(task => [task.id, task]));
      for (const id of selected) {
        const task = current.get(id);
        if (!review.rows.has(id) || !task || review.rows.get(id) !== JSON.stringify(task) ||
            task.done || task.archived || !allComplete(task))
          throw Error('A reviewed task changed. Open the review again before completing it.');
      }
      const chosen = new Set(selected);
      const ok = a.mutate(d => {
        for (const task of d.tasks)
          if (chosen.has(task.id)) {
            task.done = true;
            task.doneDate = date;
            task.boardStatus = 'done';
          }
      });
      if (ok) {
        reviews.delete(form);
        a.closeModal();
        a.tell(selected.length + ' main task(s) completed. View in Completed tasks.');
      }
      return ok;
    }
    document.addEventListener('click', event => {
      if (!event.target.closest?.('[data-task-completion-review]')) return;
      event.preventDefault();
      try { review(); } catch (error) { a.tell(error.message, true); }
    });
    document.addEventListener('submit', event => {
      if (event.target.id !== 'taskCompletionForm') return;
      event.preventDefault();
      try { apply(event.target); } catch (error) { a.tell(error.message, true); }
    });
    return { mount, review, apply };
  }
  root.WorkHubTaskCompletion = { allComplete, pending, prepare, install };
})(globalThis);
