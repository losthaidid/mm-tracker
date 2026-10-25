/**
 * settings-panel.js
 * Groups and searches the existing Settings buttons.
 * GROUPS controls category labels; ITEMS maps existing button IDs to descriptions and categories.
 * Navigation/search are interface state only. Original buttons keep their save/account handlers.
 * File map: docs/FILE-MAP.md
 */
/* Group existing Settings actions without replacing their buttons or handlers. */
(function (root) {
  'use strict';
  const GROUPS = [
    {
      id: 'workspace',
      name: 'Workspace',
      note: 'Make the workspace feel like yours.',
      path: 'M3 3h7v7H3V3m11 0h7v7h-7V3M3 14h7v7H3v-7m11 0h7v7h-7v-7',
    },
    {
      id: 'work',
      name: 'Work setup',
      note: 'Projects, reusable lists, locations and contacts.',
      path: 'M8 7V4h8v3M3 7h18v14H3V7m0 6h18m-11-2v4h4v-4',
    },
    {
      id: 'companion',
      name: 'Companion & sound',
      note: 'A little company and a calmer working day.',
      path: 'M20 4c-9-2-16 3-15 9 1 5 8 7 12 1 2-3 3-7 3-10ZM5 21c1-7 5-11 11-14',
    },
    {
      id: 'data',
      name: 'Backups & sync',
      note: 'Keep a copy and stay in sync across devices.',
      path: 'M3 6l9-3 9 3-9 3-9-3Zm0 0v12l9 3 9-3V6M12 9v12',
    },
    {
      id: 'account',
      name: 'Account',
      note: 'Your sign-in and account controls.',
      path: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
    },
  ];
  const ITEMS = {
    hubSettingsHeader: [
      'workspace',
      'Website title and welcome subtitle.',
      'header branding title name',
    ],
    appearance: [
      'workspace',
      'Colours, themes, spacing and animation.',
      'theme appearance design font motion density',
    ],
    'tab-visibility': [
      'workspace',
      'Choose the screens shown in navigation.',
      'tabs sidebar menu show hide screens',
    ],
    'charge-codes': [
      'work',
      'Maintain the codes used to charge your work.',
      'billing ticket code charge',
    ],
    'project-management': [
      'work',
      'Manage projects, companies and their records.',
      'project company governance archive delete',
    ],
    'manage-mm-areas': [
      'work',
      'Choose and organize your SAP MM areas.',
      'sap mm modules processes procurement',
    ],
    'edit-lists': [
      'work',
      'Statuses, phases and reusable dropdown options.',
      'built in lists dropdown status phase options',
    ],
    claimSettingsButton: [
      'work',
      'On-site locations, distances and mileage rates.',
      'site schedule kilometre km cost claim expense travel mileage',
    ],
    leaveBalanceSettingsButton: [
      'work',
      'Yearly leave allowances, earlier usage and remaining days.',
      'annual leave al medical mc sick allowance balance entitlement used schedule days holiday',
    ],
    leaveTypeSettingsButton: [
      'work',
      'Add, rename or archive the leave types available in Schedule.',
      'leave types annual al medical mc sick unpaid compassionate emergency custom category',
    ],
    recipientSettingsButton: [
      'work',
      'Company email lists, ready to copy.',
      'recipients email address contacts to cc bcc company',
    ],
    momoAdventureSettings: [
      'companion',
      'Name, greetings, tricks and playful adventures.',
      'momo pet mascot rename soccer juggle tricks',
    ],
    momentsSettings: [
      'companion',
      'Little moments, surprises and gentle nudges.',
      'momo moments discoveries reminders theatre',
    ],
    atmosphereSettings: [
      'companion',
      'Window scenery, weather and visiting friends.',
      'atmosphere landscape rain sun visitors window',
    ],
    soundscapeSettings: [
      'companion',
      'Ambient sounds and lo-fi music for focus.',
      'soundscape music audio nature rain focus lofi',
    ],
    backupButton: [
      'data',
      'Download a copy of your records.',
      'backup download export json save data',
    ],
    restoreButton: [
      'data',
      'Restore records from a saved backup.',
      'restore import upload backup json recovery',
    ],
    experienceSettingsButton: [
      'workspace',
      'Lighting, habitat, greetings and completion moments.',
      'day night companion expressions greetings celebrations',
    ],
    cloudRetry: [
      'data',
      'Refresh records or retry waiting changes.',
      'cloud retry refresh sync offline pending',
    ],
    cloudReload: [
      'data',
      'Reload saved records and review sync issues.',
      'cloud reload conflict sync recovery records',
    ],
    cloudAccountButton: [
      'account',
      'Sign in or manage your account.',
      'account login sign in email password',
    ],
    cloudSignOut: ['account', 'Leave this account on this device.', 'account logout sign out'],
  };
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const icon = path =>
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' +
    path +
    '"/></svg>';
  const words = value =>
    String(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  function install(a) {
    const $ = id => document.getElementById(id),
      records = new Map();
    let panel = null,
      observer = null,
      owner = null,
      active = 'workspace',
      query = '',
      queued = false,
      index = 0;
    /** Create the category shell once; the existing action buttons are moved into its rows. */
    function setup() {
      panel = document.querySelector('#settingsMenu > .settings-panel');
      if (!panel || $('settingsSections')) return;
      const status = $('settingsSaveStatus');
      panel.classList.add('settings-organized');
      $('settingsMenu').dataset.organized = 'true';
      const shell = document.createElement('div');
      shell.className = 'settings-sections';
      shell.id = 'settingsSections';
      shell.innerHTML =
        '<div class="settings-top"><div><span class="settings-eyebrow">MAKE IT YOURS</span><h2>Settings</h2></div><div id="settingsStatusHost"></div></div><div class="settings-search"><label for="settingsSearch" class="sr-only">Search all settings</label>' +
        icon('M21 21l-5-5m2-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z') +
        '<input id="settingsSearch" type="search" autocomplete="off" placeholder="Find a setting…"><button type="button" id="settingsSearchClear" data-settings-stay aria-label="Clear settings search" hidden>×</button></div><div class="settings-workspace" id="settingsWorkspace"><div class="settings-categories" id="settingsCategories" role="tablist" aria-label="Settings sections" aria-orientation="vertical">' +
        GROUPS.map(
          g =>
            '<button type="button" id="settingsTab-' +
            g.id +
            '" role="tab" aria-controls="settingsGroup-' +
            g.id +
            '" aria-selected="false" tabindex="-1" data-settings-stay data-settings-group="' +
            g.id +
            '">' +
            icon(g.path) +
            '<span>' +
            esc(g.name) +
            '</span><small data-settings-count="' +
            g.id +
            '"></small></button>'
        ).join('') +
        '</div><div class="settings-content"><p id="settingsSearchResults" class="settings-results-count" role="status" aria-live="polite" hidden></p>' +
        GROUPS.map(
          g =>
            '<section id="settingsGroup-' +
            g.id +
            '" class="settings-group" role="tabpanel" aria-labelledby="settingsTab-' +
            g.id +
            '" hidden><div class="settings-group-heading"><h3 id="settingsHeading-' +
            g.id +
            '">' +
            esc(g.name) +
            '</h3><p>' +
            esc(g.note) +
            '</p></div><div id="settingsItems-' +
            g.id +
            '" class="settings-items"></div></section>'
        ).join('') +
        '<div id="settingsNoResults" class="settings-no-results" hidden><strong>No settings found</strong><p>Try “email”, “mileage”, “theme” or “backup”.</p></div></div></div><div class="settings-footer"><span>Choose a section or search all settings.</span><span><kbd>Esc</kbd> to close</span></div>';
      panel.prepend(shell);
      if (status) $('settingsStatusHost').append(status);
      observer = new root.MutationObserver(changes => {
        const relevant = changes.some(change => {
          const button =
            change.target.closest?.('button') || change.target.parentElement?.closest('button');
          if (button && records.has(button)) return true;
          return [...change.addedNodes].some(
            node =>
              node.nodeType === 1 &&
              ((node.matches('button:not([data-settings-stay])') && !records.has(node)) ||
                [...node.querySelectorAll('button:not([data-settings-stay])')].some(
                  b => !records.has(b)
                ))
          );
        });
        if (relevant && !queued) {
          queued = true;
          root.queueMicrotask(() => {
            queued = false;
            mount();
          });
        }
      });
      observer.observe(panel, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['hidden', 'disabled'],
      });
    }
    /** Match button IDs/actions to ITEMS without replacing the original event handlers. */
    function scan() {
      for (const [button, r] of records)
        if (!panel.contains(button)) {
          r.row.remove();
          records.delete(button);
        }
      for (const button of panel.querySelectorAll('button:not([data-settings-stay])')) {
        if (records.has(button)) continue;
        const key =
            button.id ||
            (button.dataset.hub === 'tool' && button.dataset.tool === 'theme'
              ? 'appearance'
              : button.dataset.action),
          item = ITEMS[key] || ['workspace', 'More options for your workspace.', ''],
          group = GROUPS.find(g => g.id === item[0]),
          row = document.createElement('div'),
          noteId = 'settingsOptionNote-' + ++index,
          required = ['workspace', 'work', 'companion'].includes(group.id);
        row.className = 'settings-entry';
        row.dataset.settingsEntry = key || 'extra-' + index;
        row.innerHTML =
          '<span class="settings-entry-icon">' +
          icon(group.path) +
          '</span><small id="' +
          noteId +
          '" class="settings-entry-note">' +
          esc(item[1]) +
          '</small><span class="settings-entry-arrow" aria-hidden="true">›</span>';
        button.classList.add('settings-option');
        button.setAttribute(
          'aria-describedby',
          [button.getAttribute('aria-describedby'), noteId].filter(Boolean).join(' ')
        );
        row.prepend(button);
        $('settingsItems-' + group.id).append(row);
        records.set(button, { row, group: group.id, keywords: item[2], required });
      }
      // This original host remains available to feature modules that add launchers later.
      const source = $('hubSettingsAppearance');
      if (source) source.classList.add('settings-source');
    }
    /** Filter and count visible actions; search/navigation must not mutate account records. */
    function paint() {
      const tokens = words(query),
        searching = !!tokens.length,
        counts = Object.fromEntries(GROUPS.map(g => [g.id, 0]));
      let total = 0;
      for (const [button, r] of records) {
        const label = words(
            button.textContent +
              ' ' +
              r.keywords +
              ' ' +
              GROUPS.find(g => g.id === r.group).name +
              ' ' +
              r.row.querySelector('.settings-entry-note').textContent
          ).join(' '),
          shown =
            !button.hidden &&
            (!r.required || a.ready()) &&
            tokens.every(token => label.includes(token));
        r.row.hidden = !shown;
        r.row.classList.toggle('is-disabled', button.disabled);
        if (shown) {
          counts[r.group]++;
          total++;
        }
      }
      if (!searching && !counts[active]) active = GROUPS.find(g => counts[g.id])?.id || 'workspace';
      $('settingsCategories').hidden = searching;
      $('settingsCategories').setAttribute(
        'aria-orientation',
        root.innerWidth <= 540 ? 'horizontal' : 'vertical'
      );
      $('settingsWorkspace').dataset.searching = String(searching);
      $('settingsSearchClear').hidden = !query;
      $('settingsNoResults').hidden = !!total;
      const result = $('settingsSearchResults'),
        message = total + ' setting' + (total === 1 ? '' : 's') + ' found';
      result.hidden = !searching;
      if (result.textContent !== message) result.textContent = message;
      for (const g of GROUPS) {
        const tab = $('settingsTab-' + g.id),
          section = $('settingsGroup-' + g.id),
          selected = active === g.id;
        tab.hidden = !counts[g.id];
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        const count = tab.querySelector('small');
        if (count.textContent !== String(counts[g.id])) count.textContent = String(counts[g.id]);
        section.hidden = searching ? !counts[g.id] : !selected || !counts[g.id];
        section.setAttribute('role', searching ? 'region' : 'tabpanel');
        section.setAttribute(
          'aria-labelledby',
          (searching ? 'settingsHeading-' : 'settingsTab-') + g.id
        );
      }
    }
    function mount() {
      setup();
      if (!panel) return;
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        owner = next;
        active = a.ready() ? 'workspace' : 'account';
        query = '';
        $('settingsSearch').value = '';
      }
      scan();
      paint();
    }
    function select(id, focus = false) {
      if (!GROUPS.some(g => g.id === id)) return;
      active = id;
      query = '';
      $('settingsSearch').value = '';
      paint();
      if (focus) $('settingsTab-' + active).focus();
      const content = panel.querySelector('.settings-content');
      content.scrollTop = 0;
    }
    document.addEventListener('input', event => {
      if (event.target.id !== 'settingsSearch') return;
      query = event.target.value;
      paint();
    });
    document.addEventListener('click', event => {
      const target = event.target.closest?.('[data-settings-group],#settingsSearchClear');
      if (!target) return;
      event.preventDefault();
      if (target.id === 'settingsSearchClear') {
        query = '';
        $('settingsSearch').value = '';
        paint();
        $('settingsSearch').focus();
      } else select(target.dataset.settingsGroup);
    });
    document.addEventListener('keydown', event => {
      const tab = event.target.closest?.('[data-settings-group]');
      if (
        !tab ||
        !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
      )
        return;
      event.preventDefault();
      const tabs = [...$('settingsCategories').querySelectorAll('[data-settings-group]')].filter(
          b => !b.hidden
        ),
        current = tabs.indexOf(tab),
        next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? tabs.length - 1
              : (current +
                  (['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : -1) +
                  tabs.length) %
                tabs.length;
      select(tabs[next].dataset.settingsGroup, true);
    });
    $('settingsMenu')?.addEventListener('toggle', () => {
      if ($('settingsMenu').open) mount();
    });
    root.addEventListener('resize', () => {
      if ($('settingsCategories'))
        $('settingsCategories').setAttribute(
          'aria-orientation',
          root.innerWidth <= 540 ? 'horizontal' : 'vertical'
        );
    });
    return {
      mount,
      select,
      snapshot: () => ({
        active,
        query,
        groups: GROUPS.map(g => ({
          id: g.id,
          count: [...records.values()].filter(r => r.group === g.id && !r.row.hidden).length,
        })),
      }),
    };
  }
  root.WorkHubSettings = { install };
})(window);
