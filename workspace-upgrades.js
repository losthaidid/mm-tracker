/**
 * workspace-upgrades.js
 * Appearance options and explicit project status dates.
 * Exports appearance choices plus project-date upgrade, validation and save hooks.
 * Theme labels are configurable arrays here; project status dates save through the shared pipeline.
 * File map: docs/FILE-MAP.md
 */
/* Saved appearance and project status dates. Animation never writes to the database. */
(function (root) {
  'use strict';
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const uid = () =>
    root.crypto?.randomUUID?.() ||
    'change-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const THEMES = {
    ocean: ['Ocean', '#2563eb'],
    forest: ['Forest', '#16856d'],
    sunset: ['Sunset', '#bf4c39'],
    lavender: ['Lavender', '#7955b5'],
    rose: ['Rose garden', '#b14373'],
    lagoon: ['Lagoon', '#087f92'],
    amber: ['Honey', '#986218'],
    dark: ['After dark', '#78abff'],
  };
  const BACKGROUNDS = [
    ['mist', 'Soft mist'],
    ['plain', 'Plain paper'],
    ['grid', 'Planning grid'],
    ['night', 'Night sky'],
    ['diagonal', 'Diagonal ribbon'],
    ['weave', 'Woven linen'],
    ['honeycomb', 'Honeycomb'],
    ['ripple', 'Water ripples'],
    ['confetti', 'Confetti dots'],
    ['blueprint', 'Blueprint'],
    ['petals', 'Little petals'],
    ['stars', 'Constellation'],
  ];
  const COLORS = { page: '#f6f3fc', surface: '#fffdfb', text: '#302b44', secondary: '#9c79bc' };
  const color = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
  function appearanceUpgrade(p) {
    if (!p || typeof p !== 'object') return;
    if (p.colors === undefined) p.colors = { ...COLORS };
    if (p.palettes === undefined) p.palettes = [];
  }
  function appearanceValidate(p) {
    if (
      !p.colors ||
      Object.keys(COLORS).some(k => !color(p.colors[k])) ||
      !Array.isArray(p.palettes) ||
      p.palettes.length > 12 ||
      new Set(p.palettes.map(x => x?.id)).size !== p.palettes.length ||
      p.palettes.some(
        x =>
          !x ||
          typeof x.id !== 'string' ||
          !x.id ||
          x.id.length > 100 ||
          typeof x.name !== 'string' ||
          !x.name.trim() ||
          x.name.length > 60 ||
          /[\u0000-\u001f]/.test(x.name) ||
          !color(x.accent) ||
          !x.colors ||
          Object.keys(COLORS).some(k => !color(x.colors[k])) ||
          !BACKGROUNDS.some(([id]) => id === x.background)
      )
    )
      throw Error('Check your custom colours and saved combinations.');
  }
  const rgb = v =>
    v
      .slice(1)
      .match(/../g)
      .map(x => parseInt(x, 16));
  const mix = (a, b, n) =>
    '#' +
    rgb(a)
      .map((x, i) =>
        Math.round(x * (1 - n) + rgb(b)[i] * n)
          .toString(16)
          .padStart(2, '0')
      )
      .join('');
  const luminance = v => {
    const c = rgb(v)
      .map(x => x / 255)
      .map(x => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
    return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
  };
  const contrast = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const readable = (ink, bg) =>
    contrast(ink, bg) >= 4.5 ? ink : luminance(bg) > 0.179 ? '#19242f' : '#fff9f3';
  const APPLIED = [
    'bg',
    'surface',
    'surface-soft',
    'surface-hover',
    'text',
    'muted',
    'border',
    'mint',
    'yellow',
    'peach',
    'lavender',
    'blue-soft',
  ];
  function appearanceApply(p) {
    const style = document.body.style;
    for (const k of APPLIED) style.removeProperty('--hub-' + k);
    if (p.theme !== 'custom') return;
    const c = p.colors || COLORS,
      ink = readable(c.text, c.surface),
      vars = {
        bg: c.page,
        surface: c.surface,
        'surface-soft': mix(c.surface, c.secondary, 0.07),
        'surface-hover': mix(c.surface, c.secondary, 0.14),
        text: ink,
        muted: mix(ink, c.surface, 0.23),
        border: mix(c.surface, ink, 0.2),
        mint: mix(c.surface, c.secondary, 0.14),
        yellow: mix(c.surface, p.accent, 0.13),
        peach: mix(c.surface, c.secondary, 0.1),
        lavender: mix(c.surface, c.secondary, 0.18),
        'blue-soft': mix(c.surface, p.accent, 0.1),
      };
    for (const [k, v] of Object.entries(vars)) style.setProperty('--hub-' + k, v);
  }
  function appearanceFields(p) {
    return `<details class="workspace-colour-details"${p.theme === 'custom' ? ' open' : ''}><summary>Build your own colour combination</summary><p class="hub-meta">Pick Custom colours above to use these. Text contrast is adjusted for readability.</p><div class="workspace-colour-grid">${Object.entries(
      { page: 'Page', surface: 'Cards', text: 'Text', secondary: 'Secondary colour' }
    )
      .map(
        ([k, label]) =>
          `<label>${label}<input type="color" name="color-${k}" value="${esc(p.colors[k])}" aria-label="${label} colour"></label>`
      )
      .join(
        ''
      )}</div></details><div class="workspace-saved-palettes"><label for="workspacePaletteName">Name this combination</label><input id="workspacePaletteName" maxlength="60" placeholder="e.g. My lavender desk"><div class="actions"><button type="button" data-hub="palette-save">Save combination</button></div><label for="workspacePalette">Saved combinations (${p.palettes.length}/12)</label><select id="workspacePalette"><option value="">Choose a combination</option>${p.palettes.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select><div class="actions"><button type="button" data-hub="palette-load">Use combination</button><button type="button" data-hub="palette-delete">Delete combination</button></div></div>`;
  }
  function appearanceValues(form, p) {
    const colors = {};
    for (const k of Object.keys(COLORS))
      colors[k] = form.elements.namedItem('color-' + k)?.value || p.colors[k];
    return { colors };
  }
  function palette(p, name) {
    const theme = THEMES[p.theme],
      accent = theme?.[1] || p.accent,
      colors = p.theme === 'custom' ? { ...p.colors } : presetColors(p.theme);
    return { id: uid(), name: name.trim(), accent, colors, background: p.background };
  }
  function presetColors(theme) {
    return (
      {
        ocean: { page: '#f8f7f2', surface: '#fffefa', text: '#243449', secondary: '#7ca89c' },
        forest: { page: '#f2f6ef', surface: '#fefffb', text: '#253b33', secondary: '#7a9e68' },
        sunset: { page: '#fcf5ef', surface: '#fffdf9', text: '#4a332d', secondary: '#c48278' },
        lavender: { page: '#f6f2fc', surface: '#fffdfd', text: '#392d50', secondary: '#a48ac7' },
        rose: { page: '#fcf1f5', surface: '#fffdfb', text: '#4a2e3c', secondary: '#bd7b98' },
        lagoon: { page: '#eef8f7', surface: '#fcfffc', text: '#224449', secondary: '#66a8a5' },
        amber: { page: '#fbf5e8', surface: '#fffdf6', text: '#4d3b27', secondary: '#baa05f' },
        dark: { page: '#182431', surface: '#233443', text: '#eef6fb', secondary: '#849bbc' },
      }[theme] || { ...COLORS }
    );
  }
  root.WorkHubAppearance = {
    THEMES,
    BACKGROUNDS,
    upgrade: appearanceUpgrade,
    validate: appearanceValidate,
    apply: appearanceApply,
    fields: appearanceFields,
    values: appearanceValues,
    palette,
  };

  const rows = d => (d.specs || []).flatMap(p => [p, ...(p.subItems || [])]);
  const validDate = v => root.WorkHubReminders?.validDate(v) || false;
  function upgrade(d) {
    for (const r of rows(d)) {
      if (r.statusDate === undefined) r.statusDate = '';
      if (r.statusHistory === undefined) r.statusHistory = [];
    }
    return d;
  }
  function validate(d) {
    for (const r of rows(d))
      if (
        typeof r.statusDate !== 'string' ||
        (r.statusDate && !validDate(r.statusDate)) ||
        !Array.isArray(r.statusHistory) ||
        r.statusHistory.length > 1000 ||
        new Set(r.statusHistory.map(x => x?.id)).size !== r.statusHistory.length ||
        r.statusHistory.some(
          x =>
            !x ||
            typeof x.id !== 'string' ||
            !x.id ||
            x.id.length > 100 ||
            typeof x.status !== 'string' ||
            !x.status ||
            x.status.length > 200 ||
            !validDate(x.date) ||
            typeof x.changedAt !== 'string' ||
            !Number.isFinite(Date.parse(x.changedAt))
        )
      )
        throw Error('Check project item status dates and history.');
  }
  function prepare(next, previous, today, restoring = false) {
    upgrade(next);
    if (restoring) return;
    const old = new Map(rows(previous || {}).map(r => [r.id, r]));
    for (const r of rows(next)) {
      const before = old.get(r.id),
        explicit = r._statusDateExplicit === true;
      delete r._statusDateExplicit;
      const changed = !before || before.status !== r.status;
      if (changed) {
        r.statusDate = explicit
          ? r.statusDate || today
          : r.statusDate && r.statusDate !== before?.statusDate
            ? r.statusDate
            : today;
        if (!validDate(r.statusDate)) throw Error('Choose a valid status date.');
        r.statusHistory = [
          ...(before?.statusHistory || r.statusHistory || []),
          { id: uid(), status: r.status, date: r.statusDate, changedAt: new Date().toISOString() },
        ].slice(-1000);
      } else if (r.statusDate !== before.statusDate) {
        if (!validDate(r.statusDate)) throw Error('Choose a valid status date.');
        if (!r.statusHistory.length)
          r.statusHistory.push({
            id: uid(),
            status: r.status,
            date: r.statusDate,
            changedAt: new Date().toISOString(),
          });
        else {
          const last = r.statusHistory.at(-1);
          if (last.status === r.status) last.date = r.statusDate;
        }
      }
    }
  }
  function capture(form, r, old) {
    const input = form.elements.namedItem('statusDate');
    r.statusDate = input?.value || old?.statusDate || '';
    r.statusHistory = JSON.parse(JSON.stringify(old?.statusHistory || []));
    r._statusDateExplicit =
      !!input?.value &&
      (input.dataset.manual === 'true' || input.value !== (old?.statusDate || ''));
  }
  function install(a) {
    const find = (id, sub) => {
      const p = a.state().specs.find(p => p.id === id);
      return sub ? p?.subItems.find(s => s.id === sub) : p;
    };
    function open(id, sub = '') {
      const r = find(id, sub);
      if (!r) return;
      a.openModal(
        'Status date & history',
        `<form id="projectStatusDateForm" data-parent="${esc(id)}" data-sub="${esc(sub)}"><p class="hub-kicker">${sub ? 'SUB-ITEM' : 'PROJECT ITEM'}</p><h3 class="hub-sensitive">${esc(r.title || r.description)}</h3><p>Current status: <strong>${esc(r.status)}</strong></p><label for="statusDateCorrection">Status date</label><input id="statusDateCorrection" name="statusDate" type="date" min="1900-01-01" max="9999-12-31" value="${esc(r.statusDate || a.today())}" required><p class="hub-meta">New status changes capture today automatically. You can correct the date here.</p><ol class="project-status-timeline">${
          [...r.statusHistory]
            .reverse()
            .map(x => `<li><time>${esc(x.date)}</time><strong>${esc(x.status)}</strong></li>`)
            .join('') || '<li>Earlier dates were not recorded.</li>'
        }</ol><div class="modal-actions"><button type="button" data-action="cancel">Close</button><button type="submit" class="primary">Save date</button></div></form>`
      );
    }
    function dateButton(host, id, sub = '') {
      if (!host || host.querySelector('[data-project-status-date]')) return;
      const r = find(id, sub);
      if (!r) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'project-status-date small';
      b.dataset.projectStatusDate = id;
      b.dataset.sub = sub;
      b.textContent = r.statusDate ? '◷ Status date · ' + r.statusDate : '◷ Add status date';
      b.title = 'View status history or correct its date';
      host.append(b);
    }
    function decorate() {
      for (const b of document.querySelectorAll(
        '.item-card [data-action="edit"][data-group="specs"]'
      ))
        dateButton(b.closest('.item-card'), b.dataset.id);
      for (const b of document.querySelectorAll(
        '.subitem-manager-row [data-action="edit-subitem"]'
      ))
        dateButton(b.closest('.subitem-manager-row'), b.dataset.parent, b.dataset.id);
      for (const f of document.querySelectorAll('#editForm[data-group="specs"],#subItemForm')) {
        if (f.elements.namedItem('statusDate')) continue;
        const r =
            f.id === 'subItemForm' ? find(f.dataset.parent, f.dataset.id) : find(f.dataset.id),
          el = document.createElement('div');
        el.innerHTML = `<label for="projectStatusDate">Status date</label><input id="projectStatusDate" type="date" name="statusDate" min="1900-01-01" max="9999-12-31" value="${esc(r?.statusDate || (!r ? a.today() : ''))}"><p class="hint">Captured automatically when status changes. You can choose another date.</p>`;
        f.querySelector('.form-grid')?.append(el);
      }
    }
    document.addEventListener('change', e => {
      if (e.target.name === 'statusDate') e.target.dataset.manual = 'true';
      if (e.target.name === 'status') {
        const f = e.target.closest('#editForm[data-group="specs"],#subItemForm'),
          date = f?.elements.namedItem('statusDate');
        if (date && !date.dataset.manual) date.value = a.today();
      }
    });
    document.addEventListener('click', e => {
      const b = e.target.closest?.('[data-project-status-date]');
      if (b) {
        e.preventDefault();
        open(b.dataset.projectStatusDate, b.dataset.sub);
      }
    });
    document.addEventListener('submit', e => {
      const f = e.target;
      if (f.id !== 'projectStatusDateForm') return;
      e.preventDefault();
      try {
        const date = f.elements.namedItem('statusDate').value;
        if (!validDate(date)) throw Error('Choose a valid date.');
        if (
          a.mutate(d => {
            const p = d.specs.find(x => x.id === f.dataset.parent),
              r = f.dataset.sub ? p?.subItems.find(x => x.id === f.dataset.sub) : p;
            if (!r) throw Error('This item no longer exists.');
            r.statusDate = date;
            r._statusDateExplicit = true;
          })
        ) {
          a.closeModal();
          a.tell('Status date saved.');
        }
      } catch (err) {
        a.tell(err.message, true);
      }
    });
    const target = document.getElementById('modalBody');
    if (target)
      new root.MutationObserver(decorate).observe(target, { childList: true, subtree: true });
    return { decorate, open };
  }
  root.WorkHubProjectDates = { upgrade, validate, prepare, capture, install };
})(window);
