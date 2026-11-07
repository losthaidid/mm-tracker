/* Header-mounted living window. Atmosphere retains the original scene, clock,
   weather, visitors and settings; wide view is a local presentation choice. */
(function (root) {
  'use strict';
  function install(a) {
    let owner = '',
      generation,
      panel = null,
      expanded = false;
    const context = () => (a.ready() ? a.owner() : '');
    function paint() {
      if (!panel) return;
      const value = String(expanded),
        toggle = panel.querySelector('[data-world-window="expand"]');
      if (panel.dataset.expanded !== value) panel.dataset.expanded = value;
      toggle.setAttribute('aria-expanded', value);
      toggle.setAttribute(
        'aria-label',
        expanded ? 'Use compact scenery in the header' : 'Enlarge scenery within the header'
      );
      toggle.title = expanded ? 'Use compact header view' : 'See a larger scene in the header';
      toggle.querySelector('[data-world-expand-icon]').textContent = expanded ? '↙' : '↗';
      toggle.querySelector('[data-world-expand-label]').textContent = expanded
        ? 'Compact view'
        : 'Wide view';
    }
    function reset() {
      expanded = false;
      paint();
    }
    function create() {
      panel = document.createElement('aside');
      panel.id = 'whWorldWindow';
      panel.setAttribute('aria-label', 'Live scenery in the header');
      panel.innerHTML =
        '<div id="whWorldContent"></div><button type="button" class="wh-world-expand" data-world-window="expand" aria-controls="whWorldContent"><span data-world-expand-icon aria-hidden="true">↗</span><span data-world-expand-label>Wide view</span></button>';
      panel.querySelector('[data-world-window="expand"]').addEventListener('click', () => {
        if (!a.ready() || owner !== a.owner() || generation !== a.generation()) return;
        expanded = !expanded;
        paint();
      });
      panel.addEventListener('keydown', event => {
        if (event.key !== 'Escape' || !expanded) return;
        event.preventDefault();
        event.stopPropagation();
        reset();
        panel.querySelector('[data-world-window="expand"]').focus({ preventScroll: true });
      });
    }
    function mount() {
      const next = context(),
        epoch = a.generation(),
        header = document.getElementById('hubHeader');
      if (next !== owner || epoch !== generation) {
        owner = next;
        generation = epoch;
        expanded = false;
      }
      if (!next || !header) {
        if (panel) panel.hidden = true;
        delete document.body.dataset.hubWorld;
        return;
      }
      const card = document.getElementById('hubAtmosphereCard');
      if (!card) return;
      if (!panel) create();
      const host = panel.querySelector('#whWorldContent');
      let caption = card.querySelector('.wh-world-caption');
      if (!caption) {
        caption = document.createElement('span');
        caption.className = 'wh-world-caption';
        for (const node of card.querySelectorAll('#hubAtmosphereCaption,#hubAtmosphereClock'))
          caption.append(node);
        card.append(caption);
      }
      if (card.parentElement !== host) host.replaceChildren(card);
      if (panel.parentElement !== header) {
        const actions = header.querySelector(':scope > .header-actions');
        header.insertBefore(panel, actions);
      }
      panel.hidden = false;
      document.body.dataset.hubWorld = 'header';
      paint();
    }
    return { mount, reset };
  }
  root.WorkHubWorldWindow = { install };
})(window);
