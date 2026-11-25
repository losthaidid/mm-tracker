/* Optional transport details and account-defined reference fields for main tasks. */
(function (root) {
  'use strict';
  const defaultFields = [{ id: 'zticket', label: 'ZTICKET', visible: true }];
  const maxFields = 50;
  const definitions = lists =>
    lists.taskCustomFields === undefined ? defaultFields : lists.taskCustomFields;
  const validId = id => typeof id === 'string' && /^(?:zticket|field-[a-zA-Z0-9-]{1,90})$/.test(id);
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );

  function validate(data, checkText) {
    const fields = definitions(data.lists);
    if (!Array.isArray(fields) || fields.length > maxFields)
      throw Error('Tasks support up to ' + maxFields + ' custom fields.');
    const ids = new Set();
    const labels = new Set(['tr number', 'tr description']);
    for (const field of fields) {
      if (!validId(field?.id) || ids.has(field.id) || typeof field.visible !== 'boolean')
        throw Error('Check the task custom field definition.');
      if (!checkText(field.label, 80) || !field.label.trim())
        throw Error('Enter a name for each task custom field.');
      const key = field.label.trim().toLowerCase();
      if (labels.has(key)) throw Error('Each task tracking field needs a different name.');
      labels.add(key);
      ids.add(field.id);
    }
    for (const task of data.tasks) {
      if (task.trNumber !== undefined && !checkText(task.trNumber, 120))
        throw Error('Check the TR Number (up to 120 characters).');
      if (task.trDescription !== undefined && !checkText(task.trDescription))
        throw Error('Check the TR Description.');
      const values = task.customFieldValues;
      if (values === undefined) continue;
      if (
        !values ||
        typeof values !== 'object' ||
        Array.isArray(values) ||
        Object.keys(values).length > maxFields ||
        Object.entries(values).some(([id, value]) => !validId(id) || !checkText(value, 500))
      )
        throw Error('Task custom field values support up to 500 characters each.');
    }
  }

  function editor(task, lists) {
    const fields = definitions(lists).filter(field => field.visible);
    return `<section class="task-editor-details" aria-labelledby="taskTrackingHeading"><h3 id="taskTrackingHeading">Transport and ticket details</h3><div class="form-grid">
      <div><label for="taskTrNumber">TR Number</label><input name="trNumber" id="taskTrNumber" maxlength="120" value="${esc(task.trNumber)}"></div>
      ${fields.map(({ id, label }) => `<div><label for="taskCustom-${esc(id)}">${esc(label)}</label><input id="taskCustom-${esc(id)}" name="custom-${esc(id)}" maxlength="500" value="${esc(task.customFieldValues?.[id])}"></div>`).join('')}
      <div class="wide"><label for="taskTrDescription">TR Description</label><textarea id="taskTrDescription" name="trDescription" rows="2" maxlength="32767">${esc(task.trDescription)}</textarea></div>
      </div></section>`;
  }

  function capture(form, task, previous, lists) {
    for (const name of ['trNumber', 'trDescription']) {
      const value = form.elements.namedItem(name).value.trim();
      if (value) task[name] = value;
    }
    const values = { ...previous?.customFieldValues };
    for (const { id, visible } of definitions(lists)) {
      const input = form.elements.namedItem('custom-' + id);
      if (!visible || !input) continue;
      const value = input.value.trim();
      if (value) values[id] = value;
      else delete values[id];
    }
    if (Object.keys(values).length) task.customFieldValues = values;
  }

  function details(task, lists) {
    const entries = [
      ['TR Number', task.trNumber],
      ['TR Description', task.trDescription],
      ...definitions(lists).map(({ id, label }) => [label, task.customFieldValues?.[id]]),
    ].filter(([, value]) => value);
    if (!entries.length) return '';
    return `<section aria-labelledby="taskTrackingDetailHeading"><h3 id="taskTrackingDetailHeading">Transport and ticket details</h3><dl class="booking-facts">${entries.map(([label, value]) => `<div><dt>${esc(label)}</dt><dd class="prewrap hub-sensitive">${esc(value)}</dd></div>`).join('')}</dl></section>`;
  }

  function settingsRow({ id, label, visible }) {
    return `<div class="task-custom-field-row" data-task-field-id="${esc(id)}">
      <label>Field name<input type="text" name="fieldLabel" maxlength="80" value="${esc(label)}"${label ? ' required' : ''}></label>
      <label class="check-label"><input type="checkbox" name="fieldVisible"${visible ? ' checked' : ''}>Show on task form</label></div>`;
  }

  function settings(lists) {
    return `<form id="taskFieldSettingsForm"><p class="hint">Add a text field for each reference you track. Hiding a field keeps its saved values in task details.</p>
      <div data-task-field-rows>${definitions(lists).map(settingsRow).join('')}</div>
      <button type="button" class="small" data-action="task-field-add">Add field</button>
      <div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="primary">Save fields</button></div></form>`;
  }

  function addField(form, uid) {
    const rows = form.querySelector('[data-task-field-rows]');
    if (rows.children.length >= maxFields)
      throw Error('Tasks support up to ' + maxFields + ' custom fields.');
    rows.insertAdjacentHTML(
      'beforeend',
      settingsRow({ id: 'field-' + uid(), label: '', visible: true })
    );
    rows.lastElementChild.querySelector('[name="fieldLabel"]').focus();
  }

  function readSettings(form) {
    return [...form.querySelectorAll('[data-task-field-id]')].flatMap(row => {
      const input = row.querySelector('[name="fieldLabel"]');
      const label = input.value.trim();
      if (!label && !input.required) return [];
      return [
        {
          id: row.dataset.taskFieldId,
          label,
          visible: row.querySelector('[name="fieldVisible"]').checked,
        },
      ];
    });
  }

  root.WorkHubTaskTracking = {
    definitions,
    validate,
    editor,
    capture,
    details,
    settings,
    addField,
    readSettings,
  };
})(globalThis);
