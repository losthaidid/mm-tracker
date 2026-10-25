/** Built-in list library: grouped navigation and live previews. app.js owns validation and saving. */
(function (root) {
  'use strict';
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const fields = [
    [
      'milestones',
      'Ticket milestones',
      'Tickets',
      'The 12 steps shown in each ticket’s milestone tracker.',
      'Keep exactly 12 names, in the order you want to see them.',
    ],
    [
      'ticketObjects',
      'Ticket objects',
      'Tickets',
      'Objects available in Pending ticket editors, filters and object bookmarks.',
      'One object per line. Existing ticket classifications are preserved when you change this list.',
    ],
    [
      'workLocations',
      'Work locations',
      'Workday',
      'Locations available when planning your work in Schedule.',
      'Keep locations that are already used by your bookings.',
    ],
    [
      'projectActivities',
      'Project activities',
      'Workday',
      'Reusable activities for project bookings and work plans.',
      'One activity per line, in your preferred dropdown order.',
    ],
    [
      'projectPhases',
      'Project phases',
      'Projects',
      'The ordered stages of your project lifecycle.',
      'Keep at least two phases. Position determines the phase sequence.',
    ],
    [
      'projectItemTypes',
      'Project item types',
      'Projects',
      'The types used to organise project deliverables.',
      'Keep types already assigned to project items.',
    ],
    [
      'feedbackCategories',
      'Feedback categories',
      'Projects',
      'Categories used to organise Phase Feedback.',
      'Keep categories already used by your feedback records.',
    ],
    [
      'departments',
      'Departments',
      'Reference data',
      'Responsible departments for companies, processes and feedback.',
      'Keep departments that are already assigned to records.',
    ],
    [
      'organizationObjects',
      'Organisation structure',
      'Reference data',
      'The structure items available for your company and process mappings.',
      'One item per line. Your order becomes the dropdown order.',
    ],
    [
      'masterDataObjects',
      'Master data items',
      'Reference data',
      'Reusable master data categories for your project mappings.',
      'One item per line. Paste several lines to add items together.',
    ],
  ];
  const values = text => [
    ...new Set(
      text
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(Boolean)
    ),
  ];
  function render(lists, defaults) {
    const entries = fields.map(([key, title, group, description, hint]) => ({
      key,
      title,
      group,
      description,
      hint,
      text: (lists[key] || []).join('\n'),
    }));
    lists.projectPhases.forEach((phase, index) =>
      entries.push({
        key: 'phaseGateCriteria' + index,
        title: phase,
        group: 'Phase gates',
        description: 'Acceptance criteria available when adding a gate for this project phase.',
        hint: 'These criteria belong to this phase. Save and reopen after changing the phase sequence.',
        text: (lists.phaseGateCriteria[phase] || defaults(phase)).join('\n'),
      })
    );
    let group = '';
    const navigation = entries
      .map((entry, index) => {
        const heading =
          entry.group !== group ? '<p class="bl-nav-group">' + esc(entry.group) + '</p>' : '';
        group = entry.group;
        return (
          heading +
          '<button type="button" role="tab" id="bl-tab-' +
          index +
          '" aria-controls="bl-pane-' +
          index +
          '" aria-selected="' +
          (index === 0) +
          '" tabindex="' +
          (index === 0 ? 0 : -1) +
          '" data-list-tab="' +
          index +
          '" data-list-search="' +
          esc(entry.title + ' ' + entry.group + ' ' + entry.description) +
          '"><span>' +
          esc(entry.title) +
          '</span><small data-list-badge="' +
          index +
          '">' +
          values(entry.text).length +
          '</small></button>'
        );
      })
      .join('');
    return (
      '<form id="listsForm" class="builtin-lists"><div class="bl-hero"><div><span class="bl-eyebrow">YOUR WORK VOCABULARY</span><h3>A little library for your dropdowns.</h3><p>Keep the names you use every day clear, familiar and easy to find.</p></div><div class="bl-library-mark" aria-hidden="true"><span></span><span></span><span></span></div></div><div class="bl-layout"><aside class="bl-sidebar"><label class="bl-search-label" for="blSearch">Find a list</label><input id="blSearch" type="search" placeholder="Search lists or phases…" autocomplete="off"><nav class="bl-nav" role="tablist" aria-label="Built-in lists" aria-orientation="vertical">' +
      navigation +
      '</nav><p id="blNoResults" class="bl-no-results" hidden>No matching lists. Try another name.</p></aside><div class="bl-editors">' +
      entries
        .map(
          (entry, index) =>
            '<section id="bl-pane-' +
            index +
            '" class="bl-pane" role="tabpanel" aria-labelledby="bl-tab-' +
            index +
            '" data-list-pane="' +
            index +
            '"' +
            (index ? ' hidden' : '') +
            '><div class="bl-pane-heading"><div><span class="bl-eyebrow">' +
            esc(entry.group) +
            '</span><h3>' +
            esc(entry.title) +
            '</h3></div><span class="bl-count" data-list-count="' +
            index +
            '"></span></div><p class="bl-description">' +
            esc(entry.description) +
            '</p><div class="bl-editor-grid"><div class="bl-input"><label for="list-' +
            esc(entry.key) +
            '">Edit items <small>One per line</small></label><textarea id="list-' +
            esc(entry.key) +
            '" name="' +
            esc(entry.key) +
            '" data-list-input="' +
            index +
            '" spellcheck="false" required aria-describedby="bl-hint-' +
            index +
            '">' +
            esc(entry.text) +
            '</textarea><p id="bl-hint-' +
            index +
            '" class="bl-hint">' +
            esc(entry.hint) +
            '</p></div><div class="bl-preview"><div class="bl-preview-title"><strong>Dropdown preview</strong><span>In this order</span></div><ol data-list-preview="' +
            index +
            '"></ol><p class="bl-preview-empty" data-list-empty="' +
            index +
            '" hidden>Your items will appear here as you type.</p></div></div><p class="bl-duplicate-note" data-list-duplicates="' +
            index +
            '" hidden>Repeated lines appear once when saved.</p></section>'
        )
        .join('') +
      '</div></div><div class="bl-footer"><span>Save applies all your list edits together.</span><div class="actions"><button type="button" data-action="cancel">Cancel</button><button class="primary" type="submit">Save all lists</button></div></div></form>'
    );
  }
  function mount(form) {
    const tabs = [...form.querySelectorAll('[data-list-tab]')];
    function select(index, focus = false) {
      for (const tab of tabs) {
        const active = tab.dataset.listTab === String(index);
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        form.querySelector('[data-list-pane="' + tab.dataset.listTab + '"]').hidden = !active;
        if (active && focus) tab.focus();
      }
    }
    function preview(input) {
      const index = input.dataset.listInput,
        items = values(input.value),
        list = form.querySelector('[data-list-preview="' + index + '"]');
      list.replaceChildren(
        ...items.map(value => {
          const li = document.createElement('li');
          li.textContent = value;
          return li;
        })
      );
      form.querySelector('[data-list-badge="' + index + '"]').textContent = items.length;
      const count = form.querySelector('[data-list-count="' + index + '"]');
      count.textContent =
        input.name === 'milestones'
          ? items.length + ' / 12 steps'
          : items.length + ' item' + (items.length === 1 ? '' : 's');
      count.dataset.valid = String(input.name !== 'milestones' || items.length === 12);
      form.querySelector('[data-list-empty="' + index + '"]').hidden = !!items.length;
      form.querySelector('[data-list-duplicates="' + index + '"]').hidden =
        items.length === input.value.split(/\r?\n/).filter(v => v.trim()).length;
    }
    form.querySelectorAll('[data-list-input]').forEach(preview);
    form.addEventListener('click', event => {
      const tab = event.target.closest('[data-list-tab]');
      if (tab) select(tab.dataset.listTab);
    });
    form.addEventListener('input', event => {
      if (event.target.matches('[data-list-input]')) preview(event.target);
      if (event.target.id !== 'blSearch') return;
      const query = event.target.value.trim().toLocaleLowerCase();
      tabs.forEach(
        tab => (tab.hidden = !tab.dataset.listSearch.toLocaleLowerCase().includes(query))
      );
      for (const heading of form.querySelectorAll('.bl-nav-group')) {
        let next = heading.nextElementSibling,
          visible = false;
        while (next && !next.matches('.bl-nav-group')) {
          if (!next.hidden) visible = true;
          next = next.nextElementSibling;
        }
        heading.hidden = !visible;
      }
      const visible = tabs.filter(tab => !tab.hidden);
      form.querySelector('#blNoResults').hidden = !!visible.length;
      if (visible.length && !visible.some(tab => tab.getAttribute('aria-selected') === 'true'))
        select(visible[0].dataset.listTab);
    });
    form.addEventListener('keydown', event => {
      const tab = event.target.closest('[data-list-tab]');
      if (!tab || !['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const visible = tabs.filter(t => !t.hidden),
        current = visible.indexOf(tab);
      const index =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? visible.length - 1
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + visible.length) % visible.length;
      select(visible[index].dataset.listTab, true);
    });
    form.addEventListener(
      'invalid',
      event => {
        if (event.target.matches('[data-list-input]')) {
          form.querySelector('#blSearch').value = '';
          tabs.forEach(tab => (tab.hidden = false));
          form.querySelectorAll('.bl-nav-group').forEach(el => (el.hidden = false));
          select(event.target.dataset.listInput);
        }
      },
      true
    );
  }
  root.WorkHubLists = { render, mount };
})(window);
