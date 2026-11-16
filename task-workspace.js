/* Tasks share their editor, layout controls and motion across List and Board. */
(function (root) {
  'use strict';

  const { BOARD, SUB_STATUS, status } = root.WorkHubTaskCompletion;
  const $ = id => document.getElementById(id);
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]
    );
  const motionQuery = root.matchMedia?.('(prefers-reduced-motion: reduce)');
  const playing = () =>
    !document.hidden &&
    !motionQuery?.matches &&
    document.body.dataset.motion !== 'off' &&
    !document.body.matches('.hub-private,.hub-present,.rest-room-open');
  const limit = 500;
  const childFields = ['title', 'status', 'remarks', 'feedback'];
  const drafts = new WeakMap();
  const expanded = new Set();
  const effects = new Set();
  const cardSelector = '.tasks-workspace :is([data-task-record], [data-task-card])';
  const cardId = card => card.dataset.taskRecord || card.dataset.taskCard;
  let account = '',
    generation;

  function syncAccount(owner, version) {
    if (owner === account && version === generation) return;
    account = owner;
    generation = version;
    expanded.clear();
    for (const effect of effects) effect.cancel();
  }

  function banner(board) {
    const toggles = [
      ['list', 'List', !board],
      ['board', 'Board', board],
    ];
    return `<header class="task-workspace-banner"><div><h2>Tasks</h2><p>${board ? 'Move tasks through each stage and track their sub-items.' : 'Review priorities, due dates, and sub-item progress.'}</p></div><div class="task-workspace-actions"><div class="task-view-switch" role="group" aria-label="Task layout">${toggles
      .map(
        ([mode, label, selected]) =>
          `<button type="button"${selected ? '' : ' id="hubBoardToggle"'} data-hub="toggle-board" data-board-mode="${mode}" aria-pressed="${selected}">${label}</button>`
      )
      .join(
        ''
      )}</div><button type="button" class="primary" data-action="new" data-group="tasks">＋ Add main task</button></div></header><div class="task-workspace-result" role="status" aria-live="polite"></div>`;
  }

  function progress(task) {
    const children = task.subTasks?.length || 0;
    const completed = task.subTasks?.filter(row => row.status === SUB_STATUS.done).length || 0;
    return { children, completed, fraction: children ? completed / children : 0 };
  }

  function subItems(task, content) {
    const { children, completed, fraction } = progress(task);
    return `<details class="task-subitems" data-task-disclosure="${esc(task.id)}"${expanded.has(task.id) ? ' open' : ''}>
      <summary class="task-subheading"><span class="task-disclosure-label">Sub-items</span><span class="task-progress-track" aria-hidden="true"><i data-task-progress-fill style="--task-progress:${fraction}"></i></span><span class="task-sub-count">${children ? `${completed}/${children} complete` : 'None yet'}</span></summary>
      <div class="task-subitems-body">${content}</div>
    </details>`;
  }

  function draftRow(row = {}) {
    const choices = Object.values(SUB_STATUS)
      .map(value => `<option${value === row.status ? ' selected' : ''}>${esc(value)}</option>`)
      .join('');
    return `<article class="task-draft-row" data-task-draft="${esc(row.id)}"><div class="task-draft-main">
      <label>Sub-item title<input data-task-field="title" maxlength="500" value="${esc(row.title)}" required></label>
      <label>Status<select data-task-field="status">${choices}</select></label>
      <button type="button" class="small task-draft-remove" data-action="task-draft-discard">Remove row</button>
      </div><details class="task-draft-notes"><summary>Remarks and feedback</summary><div class="task-draft-note-fields">
      <label>Remarks<textarea data-task-field="remarks" maxlength="32767">\n${esc(row.remarks)}</textarea></label>
      <label>Feedback<textarea data-task-field="feedback" maxlength="32767">\n${esc(row.feedback)}</textarea></label></div></details></article>`;
  }

  function editorChildren(task) {
    return `<details class="task-editor-children" data-task-editor-children open><summary>
      <strong>Sub-items</strong><span data-task-draft-count></span></summary>
      <div class="task-editor-children-body">
      <p class="task-status-preview" role="status" data-task-status-preview hidden></p>
      <div class="task-draft-list" data-task-draft-list>${(task.subTasks || []).map(draftRow).join('')}</div>
      <button type="button" class="task-add-row" data-action="task-draft-insert">＋ Add sub-item</button>
      </div></details>`;
  }

  function attachEditor(form, task) {
    drafts.set(form, { account, generation, saved: JSON.stringify(task || null) });
    updateEditor(form);
  }

  function updateEditor(form) {
    const value = form.elements.namedItem('boardStatus').value;
    const list = form.querySelector('[data-task-draft-list]');
    const count = list.childElementCount;
    const cascade = value !== form.dataset.originalStatus;
    const preview = form.querySelector('[data-task-status-preview]');
    const message =
      cascade && count
        ? `Saving sets all ${count} sub-item${count === 1 ? '' : 's'} to ${SUB_STATUS[value]}.`
        : '';
    if (preview.textContent !== message) preview.textContent = message;
    preview.hidden = !message;
    form.querySelector('[data-task-draft-count]').textContent = String(count);
    form.querySelector('[data-task-finished-date]').hidden = value !== 'done';
    for (const field of list.querySelectorAll('[data-task-field="status"]')) {
      if (cascade) {
        field.dataset.taskStatusDraft ??= field.value;
        field.value = SUB_STATUS[value];
      } else if (field.dataset.taskStatusDraft !== undefined) {
        field.value = field.dataset.taskStatusDraft;
        delete field.dataset.taskStatusDraft;
      }
      field.disabled = cascade;
    }
  }

  function changeDraft(button) {
    const form = button.closest('#editForm[data-group="tasks"]');
    if (!form || !drafts.has(form))
      throw Error('Open the main task editor before changing its sub-items.');
    const list = form.querySelector('[data-task-draft-list]');
    if (button.dataset.action === 'task-draft-insert') {
      if (list.childElementCount >= limit)
        throw Error(`Each main task supports up to ${limit} sub-items.`);
      list.insertAdjacentHTML(
        'beforeend',
        draftRow({ status: SUB_STATUS[form.elements.boardStatus.value] })
      );
      const row = list.lastElementChild;
      row.querySelector('input').focus();
      animate(
        row,
        [
          { opacity: 0, transform: 'translateY(-8px)' },
          { opacity: 1, transform: 'none' },
        ],
        220
      );
    } else {
      const row = button.closest('[data-task-draft]');
      const next = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      (next?.querySelector('input') || list.nextElementSibling).focus();
    }
    updateEditor(form);
  }

  function readEditor(form, current, uid, at) {
    const draft = drafts.get(form);
    if (
      !draft ||
      form !== $('editForm') ||
      !$('modal').open ||
      draft.account !== account ||
      draft.generation !== generation
    )
      throw Error('This task editor expired. Open it again.');
    if (draft.saved !== JSON.stringify(current || null))
      throw Error(
        'This task changed while the editor was open. Reopen it to see the latest changes.'
      );
    const saved = new Map((current?.subTasks || []).map(row => [row.id, row]));
    const rows = [...form.querySelectorAll('[data-task-draft]')];
    if (rows.length > limit) throw Error(`Each main task supports up to ${limit} sub-items.`);
    return rows.map(el => {
      const previous = saved.get(el.dataset.taskDraft);
      const values = Object.fromEntries(
        childFields.map(key => {
          const field = el.querySelector(`[data-task-field="${key}"]`);
          const value = field.dataset.taskStatusDraft ?? field.value;
          return [
            key,
            previous && previous[key].replace(/\r\n?/g, '\n') === value
              ? previous[key]
              : value.trim(),
          ];
        })
      );
      if (!values.title.trim()) {
        el.closest('details.task-editor-children').open = true;
        el.querySelector('input').focus();
        throw Error('Give each sub-item a title before saving.');
      }
      if (previous && childFields.every(key => values[key] === previous[key])) return previous;
      return {
        ...previous,
        ...values,
        id: previous?.id || uid(),
        createdAt: previous?.createdAt || at,
        updatedAt: at,
      };
    });
  }

  function animate(element, keyframes, duration) {
    if (!element?.animate || !playing()) return;
    const effect = element.animate(keyframes, {
      duration,
      easing: 'cubic-bezier(.2,.7,.25,1)',
    });
    effects.add(effect);
    const cleanup = () => effects.delete(effect);
    effect.finished.then(cleanup, cleanup);
  }

  function capture(previous, next) {
    if (!document.querySelector('#view .tasks-workspace')) return null;
    const changes = new Map();
    const earlier = new Map(previous.tasks.map(task => [task.id, task]));
    for (const task of next.tasks) {
      const old = earlier.get(task.id);
      const moved = old && status(old) !== status(task);
      const before = new Map((old?.subTasks || []).map(row => [row.id, row]));
      const rows = new Set(
        task.subTasks
          .filter(row => {
            const saved = before.get(row.id);
            return !saved || childFields.some(key => saved[key] !== row[key]);
          })
          .map(row => row.id)
      );
      if (!old || moved || rows.size || before.size !== task.subTasks.length)
        changes.set(task.id, {
          name: task.task,
          moved,
          rows,
          before: old ? progress(old).fraction : 0,
          fraction: progress(task).fraction,
          completed: task.done && !old?.done,
        });
    }
    if (!changes.size) return null;
    if (changes.size === 1) {
      const [id, change] = changes.entries().next().value;
      if (change.rows.size) expanded.add(id);
    }
    const positions = new Map();
    if (playing() && [...changes.values()].some(change => change.moved)) {
      for (const card of document.querySelectorAll('.tasks-workspace .hub-task')) {
        const box = card.getBoundingClientRect();
        if (box.width && box.bottom > 0 && box.top < root.innerHeight)
          positions.set(cardId(card), box);
      }
    }
    return { changes, positions };
  }

  function play(result) {
    if (!result) return;
    const { changes, positions } = result;
    for (const card of document.querySelectorAll(cardSelector)) {
      const id = cardId(card);
      const from = positions.get(id);
      if (from) {
        const to = card.getBoundingClientRect();
        const dx = from.left - to.left;
        const dy = from.top - to.top;
        if (Math.abs(dx) + Math.abs(dy) > 1)
          animate(
            card,
            [
              { transform: `translate(${dx}px, ${dy}px)`, zIndex: 2 },
              { transform: 'none', zIndex: 2 },
            ],
            360
          );
      }
      const change = changes.get(id);
      if (!change) continue;
      if (change.before !== change.fraction)
        animate(
          card.querySelector('[data-task-progress-fill]'),
          [{ transform: `scaleX(${change.before})` }, { transform: `scaleX(${change.fraction})` }],
          480
        );
      if (!playing()) continue;
      let delay = 0;
      for (const row of card.querySelectorAll('[data-subtask-id]')) {
        if (!change.rows.has(row.dataset.subtaskId) || delay >= 420) continue;
        row.style.setProperty('--task-row-delay', delay + 'ms');
        row.classList.add(change.moved ? 'task-cascade-wave' : 'task-row-updated');
        delay += 42;
      }
    }
    const complete = [...changes.values()].filter(change => change.completed);
    const announcement = document.querySelector('#view .task-workspace-result');
    if (announcement && complete.length) {
      const message =
        complete.length === 1
          ? complete[0].name + ' completed'
          : complete.length + ' tasks completed';
      announcement.innerHTML = `<span class="task-completion-check" aria-hidden="true">✓</span><span class="hub-sensitive">${esc(message)}</span>`;
      announcement.classList.add('task-workspace-success');
    }
  }

  function visibility() {
    document.documentElement.classList.toggle('task-motion-hidden', document.hidden);
    if (!playing()) for (const effect of effects) effect.cancel();
  }
  document.addEventListener('visibilitychange', visibility);
  motionQuery?.addEventListener?.('change', visibility);
  document.addEventListener(
    'toggle',
    event => {
      const panel = event.target;
      if (!panel.isConnected || !panel.matches('.task-subitems')) return;
      if (panel.open) expanded.add(panel.dataset.taskDisclosure);
      else expanded.delete(panel.dataset.taskDisclosure);
    },
    true
  );
  document.addEventListener(
    'invalid',
    event => {
      const details = event.target.closest?.('[data-task-editor-children]');
      if (details) details.open = true;
    },
    true
  );
  visibility();

  root.WorkHubTaskWorkspace = {
    banner,
    subItems,
    editorChildren,
    attachEditor,
    updateEditor,
    changeDraft,
    readEditor,
    syncAccount,
    capture,
    play,
  };
})(window);
