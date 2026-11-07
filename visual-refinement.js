/** Shared presentation: section artwork, a moving navigation accent and finite page arrivals.
 * No account records, navigation controls or working editor nodes are replaced here. */
(function (root) {
  'use strict';
  const PAGES = Object.freeze({
    home: ['mint', 'M4 13 12 5l8 8M6 11v10h12V11M10 21v-6h4v6'],
    tickets: ['peach', 'M4 5h16v5a3 3 0 0 0 0 6v4H4v-4a3 3 0 0 0 0-6V5Zm9 3v2m0 4v2'],
    tasks: ['blue', 'M8 5h12v15H4V5h4m0-2h8v4H8V3Zm0 9 2 2 4-4m-6 8h8'],
    schedule: ['lavender', 'M5 5h14v15H5V5Zm3-3v6m8-6v6M5 10h14M8 14h2m4 0h2m-8 3h2'],
    specs: ['blue', 'M3 7h7l2 3h9v10H3V7Zm0 0V4h8l2 3h8v3M7 14h10m-10 3h6'],
    notes: ['yellow', 'M5 3h14v18H5V3Zm4 5h6m-6 4h6m-6 4h4'],
    knowledge: ['lavender', 'M12 6C8 3 4 4 3 5v15c3-2 6-1 9 1m0-15c4-3 8-2 9-1v15c-3-2-6-1-9 1V6Z'],
    processhub: ['mint', 'M9 3h6v5H9V3Zm3 5v5M3 15h6v6H3v-6Zm12 0h6v6h-6v-6ZM6 15v-3h12v3'],
    files: ['blue', 'M5 3h9l5 5v13H5V3Zm9 0v6h5M9 13h6m-6 4h6'],
    handover: ['mint', 'M3 7h10v13H3V7Zm4-4h10v4m-5 7h9m-4-4 4 4-4 4'],
    waiting: ['peach', 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9Zm0 4v6l4 2'],
    studio: ['lavender', 'M3 4h18v14H3V4Zm5 18h8m-4-4v4M7 8l3 3-3 3m6 0h4'],
    lab: ['mint', 'M9 3h6m-5 0v6L4 19q-1 2 2 2h12q3 0 2-2L14 9V3M7 15h10'],
    validator: ['mint', 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Zm-5 10 3 3 7-7'],
    snippets: ['yellow', 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18'],
  });
  const TONES = {
    positive: [
      'completed',
      'complete',
      'closed',
      'resolved',
      'done',
      'on track',
      'approved',
      'found',
    ],
    progress: [
      'in progress',
      'in-progress',
      'work in progress',
      'active',
      'in review',
      'review',
      'planned',
      'running',
    ],
    caution: ['pending', 'open', 'to do', 'on hold', 'hold', 'medium', 'partial', 'paused'],
    negative: [
      'blocked',
      'critical',
      'high',
      'overdue',
      'rejected',
      'not found',
      'needs attention',
    ],
    quiet: [
      'low',
      'cancelled',
      'canceled',
      'skipped',
      'archived',
      'not started',
      'not yet started',
      'not started yet',
    ],
  };
  function tone(value) {
    const key = String(value ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    return Object.keys(TONES).find(t => TONES[t].includes(key)) || '';
  }
  function artwork(tab) {
    const path = (PAGES[tab] || PAGES.home)[1];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="black" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="48" height="48" rx="16" stroke-width="1.2" opacity=".3"/><path d="M4 20h5m46 24h5M44 3v6M20 55v6" stroke-width="1.2" opacity=".5"/><g transform="translate(17 17) scale(1.25)" stroke-width="1.5"><path d="${path}"/></g></svg>`;
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
  }
  let current = null;
  function install(a) {
    let owner = '',
      route = '',
      frame = 0,
      animation = null,
      observed = null,
      observer = null;
    const media = root.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motion = () =>
      a.prefs().motion !== 'off' &&
      !media?.matches &&
      !document.hidden &&
      !document.body.classList.contains('hub-motion-paused');
    const set = (node, key, value) => {
      if (node.style.getPropertyValue(key) !== value) node.style.setProperty(key, value);
    };
    function measureNavigation() {
      frame = 0;
      const nav = document.getElementById('tabs');
      if (!nav) return;
      if (observed !== nav) {
        observer?.disconnect();
        observed = nav;
        if (root.ResizeObserver) {
          observer = new root.ResizeObserver(schedule);
          observer.observe(nav);
        }
      }
      let mark = nav.querySelector('#vsNavIndicator');
      if (!mark) {
        mark = document.createElement('span');
        mark.id = 'vsNavIndicator';
        mark.className = 'vs-nav-indicator';
        mark.setAttribute('aria-hidden', 'true');
        nav.append(mark);
      }
      const active = nav.querySelector('button[data-tab].active:not([hidden])');
      const rect = active?.getBoundingClientRect();
      if (
        !a.ready() ||
        document.hidden ||
        !rect?.width ||
        !rect.height ||
        !active.getClientRects().length
      ) {
        mark.hidden = true;
        delete nav.dataset.vsNav;
        return;
      }
      if (root.getComputedStyle(nav).position === 'static' || !root.getComputedStyle(nav).position)
        nav.classList.add('vs-nav-static');
      const host = active.closest('.wd-nav-group,.wd-primary-nav') || nav;
      const neighbours = [...host.querySelectorAll('button[data-tab]')].filter(
        b => !b.hidden && b.getClientRects().length
      );
      const first = neighbours[0]?.getBoundingClientRect(),
        second = neighbours[1]?.getBoundingClientRect();
      const horizontal = !!(
        first &&
        second &&
        Math.abs(second.left - first.left) > Math.abs(second.top - first.top)
      );
      const base = nav.getBoundingClientRect();
      const x = rect.left - base.left + nav.scrollLeft + (horizontal ? 8 : 2),
        y = rect.top - base.top + nav.scrollTop + (horizontal ? rect.height - 4 : 8);
      nav.dataset.vsNav = horizontal ? 'horizontal' : 'vertical';
      mark.hidden = false;
      set(mark, 'width', (horizontal ? Math.max(12, rect.width - 16) : 3) + 'px');
      set(mark, 'height', (horizontal ? 3 : Math.max(12, rect.height - 16)) + 'px');
      set(mark, 'transform', `translate(${Math.round(x)}px,${Math.round(y)}px)`);
      mark.dataset.motion = motion() ? 'on' : 'off';
    }
    function schedule() {
      if (!a.ready() || frame) return;
      frame = root.requestAnimationFrame(measureNavigation);
    }
    function clear() {
      animation?.cancel();
      animation = null;
      if (frame) root.cancelAnimationFrame(frame);
      frame = 0;
      observer?.disconnect();
      observer = null;
      observed = null;
      document.getElementById('vsNavIndicator')?.remove();
      const nav = document.getElementById('tabs');
      if (nav) delete nav.dataset.vsNav;
      delete document.body.dataset.vs;
      delete document.body.dataset.vsPage;
      document.body.style.removeProperty('--vs-glyph');
      document.body.style.removeProperty('--vs-section-soft');
      const view = document.getElementById('view');
      if (view) delete view.dataset.vsPage;
      owner = route = '';
    }
    function mount(tab) {
      if (!a.ready()) {
        clear();
        return;
      }
      const account = a.owner();
      if (owner && account !== owner) clear();
      owner = account;
      const page = PAGES[tab] ? tab : 'home',
        view = document.getElementById('view');
      document.body.dataset.vs = 'ready';
      document.body.dataset.vsPage = page;
      if (view) view.dataset.vsPage = page;
      set(document.body, '--vs-glyph', artwork(page));
      set(
        document.body,
        '--vs-section-soft',
        `var(--hub-${PAGES[page][0] === 'blue' ? 'blue-soft' : PAGES[page][0]})`
      );
      if (!motion()) {
        animation?.cancel();
        animation = null;
      } else if (route && route !== page && view?.animate) {
        animation?.cancel();
        animation = view.animate([{ opacity: 0.5 }, { opacity: 1 }], {
          duration: 170,
          easing: 'ease-out',
        });
      }
      route = page;
      schedule();
    }
    root.addEventListener('resize', schedule, { passive: true });
    media?.addEventListener?.('change', () => {
      if (!motion()) animation?.cancel();
      schedule();
    });
    document.addEventListener(
      'toggle',
      e => {
        if (e.target.closest?.('#tabs')) schedule();
      },
      true
    );
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) animation?.cancel();
      else schedule();
    });
    document.addEventListener('pointerdown', () => animation?.cancel(), { passive: true });
    document.addEventListener('focusin', () => animation?.cancel());
    current = { mount, schedule, measureNavigation, clear };
    return current;
  }
  root.WorkHubVisualRefinement = Object.freeze({
    PAGES,
    tone,
    artwork,
    install,
    refreshNavigation: () => current?.schedule(),
  });
})(window);
