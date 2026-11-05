/* Presentation-only website designs. Existing navigation nodes, editors and data engines are retained. */
(function (root) {
  'use strict';
  const DESIGNS = {
    current: {
      name: 'Current',
      eyebrow: 'FAMILIAR & EXPRESSIVE',
      description: 'Your original sidebar, warm details and living workspace.',
      layout: 'Full sidebar · familiar screens',
    },
    'clear-desk': {
      name: 'Clear Desk',
      eyebrow: 'CALM & STRUCTURED',
      description: 'A clean top navigation, grouped sections and a wide working area.',
      layout: 'Top navigation · focused surfaces',
    },
    'modern-hub': {
      name: 'Modern Hub',
      eyebrow: 'OPEN & CONNECTED',
      description: 'A compact navigation rail, generous cards and a fresh dashboard.',
      layout: 'Compact rail · spacious panels',
    },
  };
  const ORDER = [
    'home',
    'tickets',
    'tasks',
    'schedule',
    'specs',
    'notes',
    'knowledge',
    'processhub',
    'files',
    'handover',
    'waiting',
    'studio',
    'lab',
    'validator',
    'snippets',
  ];
  const GROUPS = [
    ['Plan & deliver', ['home', 'tickets', 'tasks', 'schedule', 'specs', 'waiting']],
    ['Keep & share', ['notes', 'knowledge', 'processhub', 'files', 'handover']],
    ['Tools & ideas', ['studio', 'lab', 'validator', 'snippets']],
  ];
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const choice = value => (Object.hasOwn(DESIGNS, value) ? value : 'current');
  function miniature(id) {
    return (
      '<span class="wd-mini wd-mini-' +
      id +
      '" aria-hidden="true"><i class="wd-mini-head"></i><i class="wd-mini-nav"></i><i class="wd-mini-title"></i><i class="wd-mini-card wd-mini-one"></i><i class="wd-mini-card wd-mini-two"></i><i class="wd-mini-card wd-mini-three"></i></span>'
    );
  }
  function launcher(p) {
    return (
      '<section class="wd-appearance-entry"><div><span class="hub-kicker">WEBSITE DESIGN</span><h4>A different way to feel at home.</h4><p>Keep your colours. Choose the layout that suits your day.</p><small>Active design: <strong data-wd-active-label>' +
      DESIGNS[choice(p.design)].name +
      '</strong></small></div><button type="button" data-website-design-open>Choose website design</button></section>'
    );
  }
  function install(a) {
    const $ = id => document.getElementById(id);
    const media = root.matchMedia?.('(max-width: 900px)');
    let owner = '',
      generation,
      dialog = null,
      draft = 'current',
      base = 'current',
      focus = null,
      saving = false,
      grouping = '',
      groupedNodes = [];
    const context = () => [a.ready() ? a.owner() : '', a.generation()];
    const current = () => choice(a.prefs()?.design);
    const valid = () => a.ready() && owner === a.owner() && generation === a.generation();
    function close(restoreFocus = true) {
      const old = dialog;
      dialog = null;
      old?.close();
      old?.remove();
      apply();
      if (restoreFocus && focus?.isConnected) focus.focus?.({ preventScroll: true });
      focus = null;
    }
    function apply() {
      const id = a.ready() ? (dialog ? draft : current()) : 'current';
      if (document.body.dataset.hubDesign !== id) document.body.dataset.hubDesign = id;
      arrange(id);
      for (const label of document.querySelectorAll('[data-wd-active-label]')) {
        const text = DESIGNS[id].name + (dialog && draft !== base ? ' · preview' : '');
        if (label.textContent !== text) label.textContent = text;
      }
      const bar = $('wdWorkspaceBar');
      if (bar) bar.hidden = id === 'current' || !a.ready();
    }
    function arrange(id) {
      const nav = $('tabs');
      if (!nav) return;
      const nodes = [...nav.querySelectorAll('button[data-tab]')];
      const mobile = !!media?.matches;
      const kind =
        id === 'clear-desk'
          ? mobile
            ? 'top-mobile'
            : 'top'
          : id === 'modern-hub' && mobile
            ? 'dock'
            : 'flat';
      if (
        grouping !== kind ||
        nodes.length !== groupedNodes.length ||
        nodes.some(n => !groupedNodes.includes(n))
      ) {
        const focused = nav.contains(document.activeElement) ? document.activeElement : null;
        const sorted = nodes
          .slice()
          .sort((x, y) => ORDER.indexOf(x.dataset.tab) - ORDER.indexOf(y.dataset.tab));
        // Detach the real controls before removing only our wrappers. Their handlers stay attached.
        for (const node of sorted) nav.append(node);
        for (const wrapper of [...nav.children])
          if (!wrapper.matches('button[data-tab]')) wrapper.remove();
        if (kind !== 'flat') {
          const primary =
            kind === 'top'
              ? ['home', 'tickets', 'tasks', 'schedule', 'specs']
              : kind === 'dock'
                ? ['home', 'tasks', 'schedule', 'specs']
                : [];
          const strip = document.createElement('div');
          strip.className = 'wd-primary-nav';
          for (const node of sorted.filter(n => primary.includes(n.dataset.tab)))
            strip.append(node);
          nav.append(strip);
          const more = document.createElement('details');
          more.id = 'wdSectionMenu';
          more.className = 'wd-section-menu';
          more.innerHTML =
            '<summary aria-label="Browse all workspace sections"><span class="wd-menu-symbol" aria-hidden="true">▦</span><span data-wd-menu-label>Sections</span><span aria-hidden="true">⌄</span></summary><div class="wd-section-popover"></div>';
          nav.append(more);
          const popover = more.lastElementChild;
          for (const [title, keys] of GROUPS) {
            const group = document.createElement('div');
            group.className = 'wd-nav-group';
            const heading = document.createElement('strong');
            heading.textContent = title;
            group.append(heading);
            for (const node of sorted.filter(
              n => keys.includes(n.dataset.tab) && !primary.includes(n.dataset.tab)
            ))
              group.append(node);
            if (group.querySelector('button')) popover.append(group);
          }
          more.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              more.open = false;
              more.querySelector('summary').focus();
            }
          });
        }
        grouping = kind;
        groupedNodes = nodes;
        if (focused?.isConnected) focused.focus?.({ preventScroll: true });
      }
      const active = nodes.find(n => n.classList.contains('active') && !n.hidden);
      const menu = $('wdSectionMenu');
      if (menu) {
        for (const group of menu.querySelectorAll('.wd-nav-group'))
          group.hidden = ![...group.querySelectorAll('button')].some(
            b => !b.hidden && b.style.display !== 'none'
          );
        menu.hidden = ![...menu.querySelectorAll('button')].some(
          b => !b.hidden && b.style.display !== 'none'
        );
        const label = menu.querySelector('[data-wd-menu-label]');
        const text = active && menu.contains(active) ? active.textContent.trim() : 'Sections';
        if (label.textContent !== text) label.textContent = text;
      }
      for (const button of nodes) {
        if (id === 'modern-hub' && !button.title) {
          button.dataset.wdTitle =
            button.querySelector('.hub-nav-label')?.textContent || button.textContent.trim();
          button.title = button.dataset.wdTitle;
        } else if (id !== 'modern-hub' && button.dataset.wdTitle) {
          if (button.title === button.dataset.wdTitle) button.removeAttribute('title');
          delete button.dataset.wdTitle;
        }
      }
      const section = $('wdSectionTitle');
      const title = active?.querySelector('.hub-nav-label')?.textContent || 'Your workspace';
      if (section && section.textContent !== title) section.textContent = title;
    }
    function mount() {
      const [next, epoch] = context();
      if (next !== owner || epoch !== generation) {
        owner = next;
        generation = epoch;
        close(false);
      } else if (dialog && !saving && current() !== base) close(false);
      const host = $('hubSettingsAppearance');
      if (host && !$('websiteDesignButton')) {
        const button = document.createElement('button');
        button.id = 'websiteDesignButton';
        button.type = 'button';
        button.dataset.websiteDesignOpen = '';
        button.dataset.accessFeature = 'workspace';
        button.textContent = 'Website design';
        host.append(button);
      }
      const page = document.querySelector('#hubShell > main.page');
      if (page && !$('wdWorkspaceBar')) {
        const bar = document.createElement('div');
        bar.id = 'wdWorkspaceBar';
        bar.hidden = true;
        bar.innerHTML =
          '<div><span class="wd-context-eyebrow">YOUR WORKSPACE / <span data-wd-active-label></span></span><strong id="wdSectionTitle"></strong></div><button type="button" data-website-design-open>Change design</button>';
        page.prepend(bar);
      }
      if (dialog) {
        const submit = dialog.querySelector('[type="submit"]');
        submit.disabled = !a.canEdit();
      }
      apply();
    }
    function open() {
      mount();
      if (!valid()) throw Error('Sign in to choose a website design.');
      if (dialog) {
        dialog.focus();
        return;
      }
      const settings = $('settingsMenu');
      if (settings) settings.open = false;
      base = current();
      draft = base;
      focus = document.activeElement;
      dialog = document.createElement('dialog');
      dialog.id = 'websiteDesignChooser';
      dialog.className = 'wd-chooser';
      dialog.dataset.accessFeature = 'workspace';
      dialog.setAttribute('aria-labelledby', 'wdChooserTitle');
      dialog.innerHTML =
        '<form><header class="wd-chooser-head"><div><span class="hub-kicker">A SPACE THAT FITS YOUR DAY</span><h2 id="wdChooserTitle">Make room for a different view.</h2><p>Three designs. The same work, always with you.</p></div><button type="button" data-wd-close aria-label="Close website design preview">×</button></header><fieldset class="wd-design-options"><legend>Choose your website design</legend>' +
        Object.entries(DESIGNS)
          .map(
            ([id, d]) =>
              '<label class="wd-design-option"><input type="radio" name="websiteDesign" value="' +
              id +
              '"' +
              (id === draft ? ' checked' : '') +
              '>' +
              miniature(id) +
              '<span class="wd-design-info"><small>' +
              d.eyebrow +
              '</small><strong>' +
              d.name +
              '</strong><span>' +
              d.description +
              '</span><em>' +
              d.layout +
              '</em></span></label>'
          )
          .join('') +
        '</fieldset><p class="wd-preview-note">Choosing a card previews the layout immediately. Your colour theme stays with you. Use this design to save it to your account.</p><footer class="wd-chooser-foot"><span role="status" id="wdChooserStatus">' +
        (a.canEdit()
          ? 'Your saved design is ' + DESIGNS[base].name + '.'
          : 'Preview is available. Your account cannot save appearance changes.') +
        '</span><div><button type="button" data-wd-close>Cancel preview</button><button type="submit" class="primary"' +
        (!a.canEdit() ? ' disabled' : '') +
        '>Use this design</button></div></footer></form>';
      (document.fullscreenElement || document.body).append(dialog);
      dialog.addEventListener('keydown', e => e.stopPropagation());
      dialog.addEventListener('cancel', e => {
        e.preventDefault();
        close();
      });
      dialog.addEventListener('close', () => {
        if (dialog && !dialog.open) close();
      });
      for (const button of dialog.querySelectorAll('[data-wd-close]'))
        button.onclick = () => close();
      dialog.addEventListener('change', e => {
        if (e.target.name !== 'websiteDesign') return;
        if (!valid()) {
          close(false);
          return;
        }
        draft = choice(e.target.value);
        apply();
        $('wdChooserStatus').textContent =
          'Previewing ' + DESIGNS[draft].name + ' · your saved design is unchanged.';
      });
      dialog.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        try {
          if (!valid() || current() !== base)
            throw Error('Your account or design changed. Open the chooser again.');
          if (!a.canEdit()) throw Error('Your account does not allow appearance changes.');
          const selected = draft;
          if (selected === base) {
            close();
            return;
          }
          saving = true;
          let ok;
          try {
            ok = a.mutate(d => {
              d.workhub.preferences.design = selected;
            });
          } finally {
            saving = false;
          }
          if (ok) {
            close();
            mount();
            a.tell(DESIGNS[selected].name + ' is now your website design.');
          } else {
            if ($('wdChooserStatus'))
              $('wdChooserStatus').textContent =
                'The design could not be saved. Your preview is still open.';
          }
        } catch (error) {
          if ($('wdChooserStatus')) $('wdChooserStatus').textContent = error.message;
          a.tell(error.message, true);
        }
      });
      dialog.showModal();
      dialog.querySelector('[data-wd-close]').focus({ preventScroll: true });
    }
    document.addEventListener('click', e => {
      const opener = e.target.closest?.('[data-website-design-open]');
      if (opener) {
        try {
          open();
        } catch (error) {
          a.tell(error.message, true);
        }
        return;
      }
      const menu = $('wdSectionMenu');
      if (!menu?.open) return;
      if (!menu.contains(e.target)) menu.open = false;
      else if (e.target.closest?.('button[data-tab]')) {
        menu.open = false;
        menu.querySelector('summary').focus({ preventScroll: true });
      }
    });
    media?.addEventListener?.('change', () => {
      grouping = '';
      mount();
    });
    root.addEventListener('pagehide', () => close(false));
    return {
      mount,
      open,
      close,
      preservingContent: () => saving,
      snapshot: () => ({
        design: document.body.dataset.hubDesign || 'current',
        saved: current(),
        preview: !!dialog,
      }),
    };
  }
  root.WorkHubWebsiteDesigns = { DESIGNS, choice, launcher, install };
})(globalThis);
