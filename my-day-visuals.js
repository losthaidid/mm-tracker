/** My Day presentation only. Scene, light, counters and layout motion never write account records. */
(function (root) {
  'use strict';
  const esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const PHASES = {
    plan: ['today', 'dayJourney', 'missions', 'radar', 'upNext', 'gaps'],
    work: ['tasks', 'waiting', 'focus', 'orb', 'energy', 'canvas', 'knowledge'],
    reflect: ['journey', 'achievements', 'desk', 'replay', 'garden', 'terrarium'],
  };
  const LABELS = {
    all: 'Your whole day',
    plan: 'Make a plan',
    work: 'Find your flow',
    reflect: 'Pause & reflect',
  };
  const phase = id => Object.keys(PHASES).find(k => PHASES[k].includes(id)) || 'work';
  const period = hour =>
    hour >= 6 && hour < 12
      ? 'morning'
      : hour >= 12 && hour < 17
        ? 'day'
        : hour >= 17 && hour < 20
          ? 'dusk'
          : 'night';
  const PHASE_NAMES = {
    morning: 'Morning light',
    day: 'A little daylight',
    dusk: 'Golden hour',
    night: 'A quieter constellation',
  };
  function trees(x, y, n, scale = 1) {
    return Array.from({ length: n }, (_, i) => {
      const px = x + i * 32,
        py = y + Math.sin(i * 1.9) * 13,
        s = (0.7 + (i % 4) * 0.14) * scale;
      return `<g transform="translate(${px} ${py}) scale(${s})"><path d="M-3 0 3 0 2-82-2-82Z" fill="var(--mv-trunk)"/><path d="M0-130-32-74-18-74-43-31-20-31-48-2 46-2 20-31 40-31 17-74 31-74Z" fill="currentColor"/><path d="M0-130 0-5 46-2 20-31 40-31 17-74 31-74Z" fill="#102e2e" opacity=".17"/></g>`;
    }).join('');
  }
  function scene() {
    return `<div class="mv-scene" aria-hidden="true"><svg class="mv-landscape" viewBox="0 0 1440 500" preserveAspectRatio="xMidYMid slice"><defs>
      <linearGradient id="mvSky" x2="0" y2="1"><stop stop-color="var(--mv-sky-top)"/><stop offset="1" stop-color="var(--mv-sky-bottom)"/></linearGradient>
      <linearGradient id="mvRiver" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#d4e9d3"/><stop offset=".45" stop-color="#95c5b3"/><stop offset="1" stop-color="#4b8c8b"/></linearGradient>
      <linearGradient id="mvEarth" x2="0" y2="1"><stop stop-color="#8dab85"/><stop offset="1" stop-color="#254b43"/></linearGradient>
      <linearGradient id="mvRoof" x2="0" y2="1"><stop stop-color="#d0ae7e"/><stop offset="1" stop-color="#8c7560"/></linearGradient>
      <radialGradient id="mvGlow"><stop stop-color="#f5d999" stop-opacity=".58"/><stop offset="1" stop-color="#f5d999" stop-opacity="0"/></radialGradient>
      <linearGradient id="mvMist"><stop stop-color="#d3e7cf" stop-opacity="0"/><stop offset=".5" stop-color="#d3e7cf" stop-opacity=".25"/><stop offset="1" stop-color="#d3e7cf" stop-opacity="0"/></linearGradient>
      <mask id="mvMoonShape" maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="500"><rect width="1440" height="500" fill="white"/><circle class="mv-moon-cutout" cx="1127" cy="111" r="44" fill="black"/></mask>
    </defs>
    <rect width="1440" height="500" fill="url(#mvSky)"/>
    <g class="mv-stars">${Array.from({ length: 25 }, (_, i) => `<circle cx="${470 + ((i * 173) % 950)}" cy="${22 + ((i * 43) % 175)}" r="${i % 3 === 0 ? 1.5 : 0.8}" style="--i:${i}"/>`).join('')}</g>
    <g class="mv-layer mv-layer-sky"><g transform="translate(1110 125)"><g class="mv-sun-rays" stroke="#f5dfac" stroke-width="2">${Array.from({ length: 24 }, (_, i) => `<path d="M72 0H190" transform="rotate(${i * 15})"/>`).join('')}</g></g><circle class="mv-celestial-halo" cx="1110" cy="125" r="160" fill="url(#mvGlow)"/><circle class="mv-celestial" cx="1110" cy="125" r="49" fill="#f1d79b" mask="url(#mvMoonShape)"/>
      <g class="mv-cloud mv-cloud-one" fill="#d9e7db" opacity=".25"><path d="M645 99q33-26 70-5 6-38 42-30 29-22 54 7 43-8 60 28Z"/><path d="M978 60q18-15 40-5 18-28 49-5 22-6 35 10Z"/></g>
      <g class="mv-cloud mv-cloud-two" fill="#e4ecdc" opacity=".2"><path d="M1122 198q27-24 63-11 3-24 34-20 34-15 55 15 43-6 60 15Z"/></g>
    </g>
    <g class="mv-layer mv-layer-far"><path d="M170 320 415 137 563 252 737 118 903 248 1030 162 1280 290 1440 180 1440 500 170 500Z" fill="var(--mv-mountain-far)"/><path d="m624 216 113-98 82 64-83-22-45 44Z" fill="#e1ebd7" opacity=".23"/><path d="m922 240 108-78 72 42-64-18-46 43Z" fill="#e1ebd7" opacity=".19"/></g>
    <g class="mv-layer mv-layer-mid"><path d="M-10 393Q140 198 351 293T713 264Q864 194 1003 286T1455 249V520H-10Z" fill="var(--mv-mountain-mid)"/><path d="M380 330Q648 226 909 325T1520 282" fill="none" stroke="url(#mvMist)" stroke-width="34"/>
      <g style="color:var(--mv-tree-far)">${trees(665, 334, 17, 0.65)}</g>
    </g>
    <g class="mv-layer mv-layer-valley"><path d="M-40 427Q161 311 386 367T750 324Q920 346 988 312T1490 350L1460 520H-40Z" fill="var(--mv-valley)"/>
      <path d="M971 310Q998 336 936 350T861 392Q901 419 1026 415T1189 468L1270 520H793Q807 450 745 423T764 369Q886 337 936 310Z" fill="url(#mvRiver)" opacity=".87"/>
      <g class="mv-water-lines" fill="none" stroke="#f6edc6" stroke-linecap="round" opacity=".46"><path d="M908 352h48m-126 45h72m-46 47h120m74 31h112m-23 29h114" stroke-width="2"/><path d="M944 326h18m-58 42h33m-87 52h63m115 25h56m-21 48h54"/></g>
      <path d="M1015 361q43-44 85-9" fill="none" stroke="#d5c7a1" stroke-width="7"/><path d="M1015 359v-23m16 8v-22m17 13v-20m18 21v-19m17 25v-18m16 31v-21" stroke="#c3b48e" stroke-width="3"/>
    </g>
    <g class="mv-layer mv-layer-near"><path d="M-20 431Q180 347 378 414T749 414L760 520H-20Z" fill="var(--mv-foreground)"/><path d="M1080 419Q1194 309 1475 367V520H1243Q1176 432 1080 419Z" fill="url(#mvEarth)"/>
      <g style="color:var(--mv-tree-near)">${trees(1215, 390, 9, 1.1)}${trees(80, 427, 5, 0.85)}</g>
      <g class="mv-cabin" transform="translate(1146 318)"><path d="M-37 43V-4L0-30 42-4V43Z" fill="#a39276"/><path d="M-52-4 0-45 54-4 43 3 0-29-41 3Z" fill="url(#mvRoof)"/><path d="M26-25V-53h12v39" fill="#8e8e77"/><path d="M-25 10h16v17h-16Zm36 0h16v17H11Z" fill="#f0d394" class="mv-cabin-window"/><path d="M-4 43V11H6v32" fill="#5b6a58"/><path d="M-52 43H54" stroke="#c2b08c" stroke-width="5"/>
        <g class="mv-smoke" fill="none" stroke="#dfdfc5" opacity=".38" stroke-width="4" stroke-linecap="round"><path d="M32-57q-13-12-1-24t-2-26"/></g>
      </g>
      <g fill="#b5c899" opacity=".7"><ellipse cx="1263" cy="427" rx="32" ry="5"/><ellipse cx="1189" cy="447" rx="20" ry="4"/><ellipse cx="1347" cy="448" rx="46" ry="8"/></g>
    </g>
    <g class="mv-layer mv-layer-front"><path d="M-20 503Q147 444 276 481T616 492L640 530H-20Z" fill="#183d37"/><g class="mv-fern" fill="#537d61"><path d="M1355 530q-11-78 51-144-12 81-51 144Z"/><path d="M1350 530q-41-53-22-119 31 52 22 119Z"/><path d="M1343 530q-52-28-61-77 47 21 61 77Z"/></g>
      <g fill="#d5d5a2"><circle cx="1274" cy="436" r="2"/><circle cx="1228" cy="464" r="2.4"/><circle cx="1323" cy="409" r="2"/></g>
    </g>
    <g class="mv-butterflies">${[
      [995, 265, '#e7d5a2'],
      [1260, 288, '#b9d7cd'],
    ]
      .map(
        ([x, y, c], i) =>
          `<g transform="translate(${x} ${y})"><g class="mv-butterfly" style="--i:${i}"><g class="mv-butterfly-wings" fill="${c}"><path d="M0 0C-22-21-24 11 0 4Z"/><path d="M0 0C22-21 24 11 0 4Z"/></g><path d="M0-3V7" stroke="#294f46" stroke-width="2"/></g></g>`
      )
      .join('')}</g>
    </svg><div class="mv-light-beams"></div><div class="mv-aurora"><i></i><i></i></div><div class="mv-shooting-stars"><i></i><i></i></div><div class="mv-scene-haze"></div><div class="mv-motes">${Array.from({ length: 16 }, (_, i) => `<i style="--i:${i};left:${35 + ((i * 17) % 63)}%;top:${15 + ((i * 23) % 70)}%"></i>`).join('')}</div></div>`;
  }
  function install(a) {
    let owner = '',
      view = 'all',
      page = null,
      observer = null,
      pending = null,
      sort = null,
      raf = 0,
      lightFrame = 0,
      lastPointer = null,
      effectTimer = 0,
      counterGeneration = 0,
      entered = false,
      observedPage = null,
      landed = '',
      burstNode = null,
      touchLayer = null,
      completionPoint = null,
      lastSpark = 0,
      sparkPoint = null;
    const animations = new Set(),
      numbers = new Map(),
      charts = new Map(),
      revealed = new Set(),
      counterJobs = new Map(),
      frames = new Set();
    const reduced = () => !!root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const allowed = () =>
      a.ready() &&
      !document.hidden &&
      a.prefs().motion !== 'off' &&
      a.settings().effects !== 'calm' &&
      !reduced() &&
      !document.body.matches('.hub-private,.hub-present');
    function cancelAnimations() {
      for (const anim of animations) anim.cancel?.();
      animations.clear();
    }
    function stopCounters() {
      counterGeneration++;
      for (const [el, job] of counterJobs) {
        el.textContent = job.final;
      }
      counterJobs.clear();
      for (const id of frames) root.cancelAnimationFrame?.(id);
      frames.clear();
    }
    function clearEffects() {
      clearTimeout(effectTimer);
      burstNode?.remove();
      touchLayer?.remove();
      burstNode = touchLayer = null;
      page?.classList.remove('mv-day-lit');
      completionPoint = null;
      sparkPoint = null;
    }
    function resetLight() {
      if (page) {
        page.style.removeProperty('--mv-pointer-x');
        page.style.removeProperty('--mv-pointer-y');
        page.querySelectorAll('.mv-lit').forEach(el => {
          el.classList.remove('mv-lit');
          el.style.removeProperty('--mv-rx');
          el.style.removeProperty('--mv-ry');
        });
      }
    }
    function sync() {
      const next = a.ready() ? a.owner() : '';
      if (owner !== next) {
        endSort();
        clearEffects();
        owner = next;
        view = 'all';
        page = null;
        pending = null;
        entered = false;
        observedPage = null;
        numbers.clear();
        charts.clear();
        revealed.clear();
        stopCounters();
        cancelAnimations();
        observer?.disconnect();
        observer = null;
      }
      const live = document.querySelector('.my-day-page');
      if (!live) {
        clearEffects();
        observer?.disconnect();
        observer = null;
        resetLight();
        page = null;
        observedPage = null;
        entered = false;
        charts.clear();
        revealed.clear();
        stopCounters();
        cancelAnimations();
        return;
      }
      page = live;
      const hero = page.querySelector('.mv-hero'),
        when = period(new Date().getHours());
      if (hero && hero.dataset.mvPeriod !== when) {
        hero.dataset.mvPeriod = when;
        const label = hero.querySelector('[data-mv-period-name]');
        if (label) label.textContent = PHASE_NAMES[when];
      }
      page.dataset.mvMotion = allowed() ? 'flow' : 'still';
      if (!a.settings().celebrations && burstNode) {
        clearTimeout(effectTimer);
        burstNode.remove();
        burstNode = null;
        page.classList.remove('mv-day-lit');
      }
      if (!a.settings().particles)
        touchLayer?.querySelectorAll('.mv-pointer-spark').forEach(el => el.remove());
      if (!allowed()) {
        clearEffects();
        resetLight();
        stopCounters();
        cancelAnimations();
      }
    }
    function hero(data) {
      const when = period(new Date().getHours()),
        greeting = data.name
          ? `A little space for ${esc(data.name)}.`
          : 'A little space for yourself.';
      return `<div class="mv-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div><header class="hub-head md-day-intro mv-hero" data-mv-period="${when}">${scene()}<div class="mv-hero-shade"></div><div class="mv-hero-content"><div class="mv-hero-eyebrow"><span class="mv-status-orbit" aria-hidden="true"></span><span>YOUR WORKSPACE, IN BLOOM</span><span class="mv-edition">MY DAY</span></div><p class="mv-day-label">${esc(new Date(data.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))} <i></i> <span data-mv-period-name>${PHASE_NAMES[when]}</span></p><h2>Your day.<br><em>A world of possibility.</em></h2><p class="mv-welcome">${greeting} Give your ideas room, find your rhythm, and let the small wins grow.</p><div class="md-hero-actions">${data.actions}</div></div><div class="mv-scene-note"><span class="mv-note-mark" aria-hidden="true">✧</span><span>SMALL STEPS. NEW PERSPECTIVES.</span></div><div class="mv-hero-metrics"><button type="button" data-md="missions" class="mv-hero-metric"><span class="mv-metric-icon" aria-hidden="true">✧</span><span><small>Today’s intention</small><strong>${Math.max(0, data.total - data.done)}<span> left</span></strong><em>${data.total ? (data.done === data.total ? 'today’s priorities complete' : 'priorities to move forward') : 'choose your priorities'}</em></span><i class="mv-metric-track" style="--mv-meter:${data.total ? (data.done / data.total) * 100 : 0}%"></i></button><button type="button" data-mv="jump" data-target="dayJourney" class="mv-hero-metric"><span class="mv-metric-icon" aria-hidden="true">◷</span><span><small>Room to make progress</small><strong>${data.activities}<span> planned</span></strong><em>activities on your calendar</em></span><span class="mv-metric-arrow" aria-hidden="true">↗</span></button><button type="button" data-mv="jump" data-target="tasks" class="mv-hero-metric"><span class="mv-metric-icon" aria-hidden="true">↗</span><span><small>One step at a time</small><strong>${data.open}<span> open</span></strong><em>tasks ready for your next step</em></span><span class="mv-metric-arrow" aria-hidden="true">↗</span></button></div></header>`;
    }
    function toolbar() {
      return `<div class="mv-dashboard-nav"><div><span class="mv-section-kicker">A PLACE FOR GOOD WORK</span><h3>Your personal landscape</h3></div><div class="mv-view-switch" role="group" aria-label="Dashboard sections">${Object.entries(
        LABELS
      )
        .map(
          ([id, label]) =>
            `<button type="button" data-mv="view" data-view="${id}" aria-pressed="${view === id}">${label}</button>`
        )
        .join(
          ''
        )}</div><button type="button" data-md="layout" class="md-button mv-arrange">⠿ <span>Arrange dashboard</span></button></div><div class="mv-layout-caption"><span><i></i> Drag to shape your space. Expand to explore.</span><span data-mv-view-status role="status">Your widgets, in your saved order.</span></div><div class="mv-no-widgets" hidden><span aria-hidden="true">✧</span><h4>A little room for this part of your day.</h4><p>Choose the widgets you want to see here.</p><button type="button" data-md="layout" class="md-button">Choose widgets</button></div>`;
    }
    function applyView() {
      if (!page) return;
      const widgets = [...page.querySelectorAll('.hub-layout > [data-widget]')];
      let count = 0;
      for (const el of widgets) {
        const visible = view === 'all' || phase(el.dataset.widget) === view;
        el.hidden = !visible;
        if (visible) count++;
      }
      page.dataset.mvView = view;
      for (const b of page.querySelectorAll('[data-mv="view"]'))
        b.setAttribute('aria-pressed', String(b.dataset.view === view));
      const empty = page.querySelector('.mv-no-widgets');
      if (empty) empty.hidden = count > 0;
      const status = page.querySelector('[data-mv-view-status]');
      if (status)
        status.textContent =
          view === 'all'
            ? 'Your widgets, in your saved order.'
            : `${count} widget${count === 1 ? '' : 's'} · ${LABELS[view]}`;
    }
    function captureLayout() {
      if (!page || !allowed() || pending) return;
      pending = new Map(
        [...page.querySelectorAll('.hub-layout > [data-widget]')]
          .filter(el => !el.hidden)
          .map(el => [el.dataset.widget, el.getBoundingClientRect()])
      );
    }
    function animate(el, keyframes, options = {}) {
      if (!allowed() || typeof el.animate !== 'function') return;
      const animation = el.animate(keyframes, {
        duration: a.settings().effects === 'playful' ? 520 : 360,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        ...options,
      });
      animations.add(animation);
      animation.finished?.catch(() => {}).finally(() => animations.delete(animation));
      return animation;
    }
    function flip(previous) {
      if (!previous || !page || !allowed()) return;
      for (const el of page.querySelectorAll('.hub-layout > [data-widget]')) {
        if (el.hidden) continue;
        const old = previous.get(el.dataset.widget),
          r = el.getBoundingClientRect();
        if (!old || !old.width || !r.width || !r.height) continue;
        const dx = old.left - r.left,
          dy = old.top - r.top,
          sx = old.width / r.width,
          sy = old.height / r.height;
        if (Math.abs(dx) + Math.abs(dy) + Math.abs(sx - 1) + Math.abs(sy - 1) < 0.5) continue;
        animate(el, [
          {
            transform: `translate(${dx}px,${dy}px) scale(${sx},${sy})`,
            transformOrigin: 'top left',
            opacity: 0.85,
          },
          { transform: 'none', transformOrigin: 'top left', opacity: 1 },
        ]);
      }
    }
    function previewSort(source, target) {
      if (!page || !source?.closest('.my-day-page') || !target || source === target) return;
      const grid = source.parentElement;
      if (!sort) sort = { source, grid, nodes: [...grid.children], target: null };
      if (sort.source !== source || sort.target === target) return;
      sort.target = target;
      const before = new Map(
        [...grid.children]
          .filter(x => x.dataset.widget)
          .map(el => [el.dataset.widget, el.getBoundingClientRect()])
      );
      source.classList.add('mv-sort-space');
      page.classList.add('mv-sorting');
      if (sort.nodes.indexOf(source) < sort.nodes.indexOf(target)) target.after(source);
      else target.before(source);
      flip(before);
    }
    function endSort(commit = false) {
      if (!sort) return;
      const old = sort;
      sort = null;
      const before = new Map(
        [...old.grid.children]
          .filter(el => el.dataset.widget)
          .map(el => [el.dataset.widget, el.getBoundingClientRect()])
      );
      if (commit) {
        pending = before;
        landed = old.source.dataset.widget;
      }
      old.source.classList.remove('mv-sort-space');
      old.grid.closest('.my-day-page')?.classList.remove('mv-sorting');
      // Restore DOM order before the existing save/cancel path decides the final record order.
      for (const node of old.nodes) if (node.parentElement === old.grid) old.grid.append(node);
      if (!commit && old.grid.isConnected) flip(before);
    }
    function animateNumbers() {
      if (!page) return;
      const generation = counterGeneration;
      for (const el of page.querySelectorAll('.hub-stats strong')) {
        const text = el.textContent.trim();
        if (!/^\d+$/.test(text) || counterJobs.has(el)) continue;
        const target = +text,
          widget = el.closest('[data-widget]'),
          index = [...widget.querySelectorAll('.hub-stats strong')].indexOf(el),
          key = widget.dataset.widget + ':' + index,
          previous = numbers.get(key) ?? 0;
        numbers.set(key, target);
        if (previous === target || !allowed() || typeof root.requestAnimationFrame !== 'function')
          continue;
        const start = root.performance.now();
        counterJobs.set(el, { final: text });
        const draw = now => {
          if (!el.isConnected || generation !== counterGeneration || !allowed()) {
            el.textContent = text;
            counterJobs.delete(el);
            return;
          }
          const t = Math.min(1, (now - start) / 700),
            v = Math.round(previous + (target - previous) * (1 - Math.pow(1 - t, 3)));
          el.textContent = String(v);
          if (t < 1) {
            const id = root.requestAnimationFrame(n => {
              frames.delete(id);
              draw(n);
            });
            frames.add(id);
          } else {
            el.textContent = text;
            counterJobs.delete(el);
          }
        };
        const id = root.requestAnimationFrame(n => {
          frames.delete(id);
          draw(n);
        });
        frames.add(id);
      }
    }
    function animateCharts(scope) {
      if (!allowed()) return;
      const selectors = [
        '.md-donut',
        '.md-progress-orbit',
        '.mv-metric-track',
        '.md-replay-track button',
      ];
      for (const selector of selectors) {
        for (const [index, el] of [...scope.querySelectorAll(selector)].entries()) {
          const box = el.getBoundingClientRect();
          if (!box.height || box.bottom < 0 || box.top > root.innerHeight || el.closest('[hidden]'))
            continue;
          const key =
              (el.closest('[data-widget]')?.dataset.widget || 'hero') +
              ':' +
              selector +
              ':' +
              index +
              ':' +
              (el.dataset.id || ''),
            value = (el.getAttribute('style') || '') + el.textContent;
          if (charts.get(key) === value) continue;
          charts.set(key, value);
          const ring = selector === '.md-donut' || selector === '.md-progress-orbit';
          animate(
            el,
            [
              {
                opacity: 0.3,
                transform: ring ? 'scale(.85) rotate(-25deg)' : 'scaleX(.05)',
                transformOrigin: ring ? 'center' : 'left',
              },
              { opacity: 1, transform: 'none', transformOrigin: ring ? 'center' : 'left' },
            ],
            { duration: 750 }
          );
        }
      }
    }
    function reveal(el) {
      const id = el.dataset.widget;
      if (!id || el.hidden || revealed.has(id) || !allowed()) return;
      revealed.add(id);
      animate(
        el,
        [
          { opacity: 0.15, transform: 'translateY(30px) scale(.975)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 650 }
      );
    }
    function mount() {
      sync();
      if (!page) return;
      const fresh = page !== observedPage;
      observedPage = page;
      applyView();
      for (const el of page.querySelectorAll('[data-widget]')) {
        el.dataset.mvPhase = phase(el.dataset.widget);
        const eyebrow = el.querySelector('.mv-widget-kicker');
        if (eyebrow)
          eyebrow.textContent = {
            plan: 'MAKE ROOM',
            work: 'IN YOUR FLOW',
            reflect: 'A LITTLE PERSPECTIVE',
          }[phase(el.dataset.widget)];
      }
      if (fresh) {
        observer?.disconnect();
        if (typeof root.IntersectionObserver === 'function') {
          observer = new root.IntersectionObserver(
            entries => {
              for (const entry of entries) {
                entry.target.classList.toggle('mv-out-of-view', !entry.isIntersecting);
                if (entry.isIntersecting) {
                  animateCharts(entry.target);
                  reveal(entry.target);
                }
              }
            },
            { rootMargin: '80px' }
          );
          for (const node of page.querySelectorAll('.mv-hero,.md-widget')) observer.observe(node);
        }
      }
      if (pending) {
        const before = pending;
        pending = null;
        flip(before);
      } else if (!entered && !observer)
        for (const el of page.querySelectorAll('.hub-layout > [data-widget]')) reveal(el);
      if (landed) {
        const el = [...page.querySelectorAll('[data-widget]')]
          .find(x => x.dataset.widget === landed)
          ?.querySelector('.mv-widget-shell');
        if (el)
          animate(
            el,
            [
              { transform: 'translateY(-7px) scale(1.012)', filter: 'brightness(1.08)' },
              { transform: 'none', filter: 'brightness(1)' },
            ],
            { duration: 400 }
          );
        landed = '';
      }
      entered = true;
      animateNumbers();
      animateCharts(page);
    }
    function celebrate() {
      if (!page || !allowed() || !a.settings().celebrations) return;
      clearTimeout(effectTimer);
      burstNode?.remove();
      page.classList.remove('mv-day-lit');
      const box = document.createElement('div');
      box.className = 'mv-milestone';
      box.setAttribute('aria-hidden', 'true');
      const point = completionPoint || {
          x: root.innerWidth / 2,
          y: Math.min(root.innerHeight * 0.45, 420),
        },
        count = a.settings().effects === 'playful' ? 32 : 20;
      completionPoint = null;
      box.style.setProperty(
        '--mv-burst-x',
        Math.max(32, Math.min(root.innerWidth - 32, point.x)) + 'px'
      );
      box.style.setProperty(
        '--mv-burst-y',
        Math.max(70, Math.min(root.innerHeight - 100, point.y)) + 'px'
      );
      box.innerHTML = `${Array.from({ length: 3 }, (_, i) => `<i class="mv-ripple" style="--i:${i}"></i>`).join('')}${Array.from(
        { length: count },
        (_, i) => {
          const angle = (i / count) * Math.PI * 2,
            range = 80 + (i % 4) * 27;
          return `<b style="--i:${i};--dx:${Math.cos(angle) * range}px;--dy:${Math.sin(angle) * range - 55}px">${i % 3 ? '✦' : '●'}</b>`;
        }
      ).join('')}<span class="mv-win-note">A little win. A brighter day.</span>`;
      burstNode = box;
      document.body.append(box);
      page.classList.add('mv-day-lit');
      effectTimer = setTimeout(() => {
        box.remove();
        if (burstNode === box) burstNode = null;
        page?.classList.remove('mv-day-lit');
      }, 2600);
    }
    function markComplete(id) {
      if (!page || !allowed()) return;
      const row = [...page.querySelectorAll('[data-md-priority]')].find(
          el => el.dataset.mdPriority === id
        ),
        r = row?.getBoundingClientRect();
      if (r && r.bottom > 0 && r.top < root.innerHeight)
        completionPoint = { x: r.left + r.width * 0.6, y: r.top + r.height / 2 };
    }
    function touchEffect(kind, x, y) {
      if (!page || !allowed()) return;
      let layer = touchLayer;
      if (!layer) {
        layer = document.createElement('div');
        layer.className = 'mv-touch-effects';
        layer.setAttribute('aria-hidden', 'true');
        touchLayer = layer;
        document.body.append(layer);
      }
      const dot = document.createElement('i');
      dot.className = 'mv-' + kind;
      dot.style.left = x + 'px';
      dot.style.top = y + 'px';
      dot.addEventListener('animationend', () => dot.remove(), { once: true });
      layer.append(dot);
      while (layer.childElementCount > 18) layer.firstElementChild.remove();
    }
    function light() {
      lightFrame = 0;
      if (
        !page ||
        !lastPointer ||
        !allowed() ||
        root.matchMedia?.('(pointer: coarse)').matches ||
        document.body.classList.contains('hub-sorting')
      )
        return;
      const { x, y, target } = lastPointer,
        hero = page.querySelector('.mv-hero'),
        h = hero?.getBoundingClientRect();
      if (
        a.settings().effects === 'playful' &&
        a.settings().particles &&
        target?.closest?.('.my-day-page') &&
        root.performance.now() - lastSpark > 90 &&
        (!sparkPoint || Math.hypot(x - sparkPoint.x, y - sparkPoint.y) > 16)
      ) {
        lastSpark = root.performance.now();
        sparkPoint = { x, y };
        touchEffect('pointer-spark', x, y);
      }
      if (h) {
        page.style.setProperty(
          '--mv-pointer-x',
          String(Math.max(-1, Math.min(1, ((x - h.left) / h.width) * 2 - 1)))
        );
        page.style.setProperty(
          '--mv-pointer-y',
          String(Math.max(-1, Math.min(1, ((y - h.top) / h.height) * 2 - 1)))
        );
      }
      const card = target?.closest?.('.md-widget');
      page.querySelectorAll('.mv-lit').forEach(el => {
        if (el !== card) {
          el.classList.remove('mv-lit');
          el.style.setProperty('--mv-rx', '0deg');
          el.style.setProperty('--mv-ry', '0deg');
        }
      });
      if (card && card.closest('.my-day-page')) {
        const r = card.getBoundingClientRect();
        card.classList.add('mv-lit');
        card.style.setProperty('--mv-light-x', x - r.left + 'px');
        card.style.setProperty('--mv-light-y', y - r.top + 'px');
        card.style.setProperty(
          '--mv-rx',
          Math.max(-1, Math.min(1, ((y - r.top) / r.height) * 2 - 1)) * -0.8 + 'deg'
        );
        card.style.setProperty(
          '--mv-ry',
          Math.max(-1, Math.min(1, ((x - r.left) / r.width) * 2 - 1)) * 0.9 + 'deg'
        );
      }
    }
    document.addEventListener(
      'pointermove',
      event => {
        if (event.pointerType === 'touch' || !page || !allowed()) return;
        lastPointer = { x: event.clientX, y: event.clientY, target: event.target };
        if (!lightFrame) lightFrame = root.requestAnimationFrame?.(light) || 0;
      },
      { passive: true }
    );
    document.addEventListener('pointerleave', () => resetLight());
    root.addEventListener(
      'scroll',
      () => {
        if (raf || !page) return;
        raf =
          root.requestAnimationFrame?.(() => {
            raf = 0;
            if (!allowed() || !page) return;
            const rect = page.querySelector('.mv-hero')?.getBoundingClientRect();
            if (rect)
              page.style.setProperty(
                '--mv-scroll',
                Math.max(-100, Math.min(350, -rect.top)) + 'px'
              );
          }) || 0;
      },
      { passive: true }
    );
    document.addEventListener('visibilitychange', () => {
      sync();
    });
    root
      .matchMedia?.('(prefers-reduced-motion: reduce)')
      .addEventListener?.('change', () => sync());
    document.addEventListener('click', event => {
      const button = event.target.closest?.('.my-day-page button');
      if (button && !button.disabled && !document.body.classList.contains('hub-sorting')) {
        const r = button.getBoundingClientRect();
        touchEffect(
          'tap-ripple',
          event.detail ? event.clientX : r.left + r.width / 2,
          event.detail ? event.clientY : r.top + r.height / 2
        );
      }
      const el = event.target.closest?.('[data-mv]');
      if (!el) return;
      event.preventDefault();
      event.stopPropagation();
      if (!a.ready()) return;
      if (el.dataset.mv === 'view') {
        captureLayout();
        view = Object.hasOwn(LABELS, el.dataset.view) ? el.dataset.view : 'all';
        applyView();
        flip(pending);
        pending = null;
        if (allowed())
          for (const card of page.querySelectorAll('.md-widget:not([hidden])'))
            animate(
              card,
              [
                { opacity: 0.4, transform: 'translateY(8px)' },
                { opacity: 1, transform: 'none' },
              ],
              { duration: 300 }
            );
      }
      if (el.dataset.mv === 'jump') {
        const target = [...page.querySelectorAll('[data-widget]')].find(
          x => x.dataset.widget === el.dataset.target
        );
        if (!target) {
          a.layout();
          return;
        }
        view = 'all';
        applyView();
        target.scrollIntoView?.({ behavior: allowed() ? 'smooth' : 'auto', block: 'center' });
        target.querySelector('button')?.focus({ preventScroll: true });
      }
    });
    return {
      hero,
      toolbar,
      mount,
      sync,
      captureLayout,
      previewSort,
      endSort,
      celebrate,
      markComplete,
      phase,
      period,
      active: allowed,
    };
  }
  root.WorkHubMyDayVisuals = { install, phase, period };
})(window);
