/* Grouped, permission-filtered command results. Execution uses the existing guarded handlers. */
(function (root) {
  'use strict';
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function search(rows, query) {
    const terms = String(query || '')
      .toLocaleLowerCase()
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return rows.filter(r =>
      terms.every(term => [r.title, r.detail, r.meta].join(' ').toLocaleLowerCase().includes(term))
    );
  }
  function render(rows, query) {
    const found = search(rows, query),
      groups = ['Pages', 'Records', 'Actions'];
    if (!found.length)
      return '<p role="status">No matching records or commands. Try a shorter word.</p>';
    let index = 0;
    return `<div class="cp-layout"><div class="cp-results">${groups
      .map(group => {
        const all = found.filter(r => r.group === group),
          shown = all.slice(0, group === 'Records' ? 18 : 16);
        if (!all.length) return '';
        return `<section aria-label="${group}" class="cp-group"><h3>${group}<small>${all.length}</small></h3>${shown.map(r => `<button type="button" class="cp-result" data-hub="${esc(r.type)}" data-id="${esc(r.id)}" data-command-index="${index++}" data-command-title="${esc(r.title)}" data-command-detail="${esc(String(r.detail || 'Open this item to see its full details.').slice(0, 700))}" data-command-meta="${esc(r.meta || group)}"><span class="cp-result-symbol" aria-hidden="true">${group === 'Pages' ? '↗' : group === 'Actions' ? '＋' : '▤'}</span><span><strong>${esc(r.title)}</strong><small>${esc(r.meta || r.detail || group)}</small></span><span aria-hidden="true">↵</span></button>`).join('')}${all.length > shown.length ? '<p class="hub-meta">Showing ' + shown.length + ' of ' + all.length + '. Refine your search for more.</p>' : ''}</section>`;
      })
      .join(
        ''
      )}</div><aside id="hubCommandPreview" class="cp-preview" aria-label="Result preview"><span class="hub-kicker">A CLOSER LOOK</span><h3 data-cp-title>Select a result</h3><span class="hub-badge" data-cp-meta>Preview</span><p data-cp-detail>Use ↑ ↓ to explore. Press Enter to open.</p></aside></div>`;
  }
  function install() {
    const input = () => document.getElementById('hubCommandQuery'),
      buttons = () => [...document.querySelectorAll('#hubCommandResults [data-command-index]')];
    function activate(button, scroll = false) {
      if (!button) return;
      for (const el of buttons()) el.classList.toggle('cp-active', el === button);
      const preview = document.getElementById('hubCommandPreview');
      if (preview)
        for (const key of ['title', 'detail', 'meta'])
          preview.querySelector('[data-cp-' + key + ']').textContent =
            button.dataset['command' + key[0].toUpperCase() + key.slice(1)];
      if (scroll) button.scrollIntoView?.({ block: 'nearest' });
    }
    function mount() {
      activate(buttons()[0]);
    }
    document.addEventListener('keydown', e => {
      if (
        e.isComposing ||
        !input() ||
        !e.target.closest('#modal') ||
        !['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)
      )
        return;
      if (e.key === 'Enter' && e.target !== input()) return;
      const list = buttons();
      if (!list.length) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      let index = list.findIndex(b => b.classList.contains('cp-active'));
      if (e.key === 'Enter') {
        list[Math.max(0, index)].click();
        return;
      }
      index = (index + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length;
      activate(list[index], true);
      input().setAttribute('aria-describedby', 'hubCommandHelp');
    });
    document.addEventListener('focusin', e => {
      const b = e.target.closest?.('[data-command-index]');
      if (b) activate(b);
    });
    document.addEventListener('pointerover', e => {
      const b = e.target.closest?.('[data-command-index]');
      if (b) activate(b);
    });
    return { mount };
  }
  root.WorkHubCommandPalette = { search, render, install };
})(window);
