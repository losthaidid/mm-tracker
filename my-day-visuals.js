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
    day: 'Afternoon light',
    dusk: 'Golden hour',
    night: 'Night',
  };
  const MOON_OUTLINES = {
    'waxing-crescent': 'M0-49A49 49 0 0 1 0 49A34 49 0 0 0 0-49Z',
    'first-quarter': 'M0-49A49 49 0 0 1 0 49Z',
    'waxing-gibbous': 'M0-49A49 49 0 0 1 0 49A27 49 0 0 1 0-49Z',
    full: 'M0-49A49 49 0 1 1 0 49A49 49 0 1 1 0-49Z',
    'waning-gibbous': 'M0-49A49 49 0 0 0 0 49A27 49 0 0 0 0-49Z',
    'last-quarter': 'M0-49A49 49 0 0 0 0 49Z',
    'waning-crescent': 'M0-49A49 49 0 0 0 0 49A34 49 0 0 1 0-49Z',
  };
  const CLOUD = 'M-88 12Q-85-9-59-10Q-52-35-22-33Q1-54 33-30Q64-29 66-12Q90-9 95 12Z';
  const CLOUD_LIGHT = 'M-84 11Q-71-7-56-4Q-42-28-14-22Q6-36 27-20Q59-23 67-3Q84 1 93 11Z';
  const RAIN_DURATION = 18000;
  const CLOUD_DURATION = 15000;
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeLabel = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const MOON_PHASES = Object.keys(MOON_OUTLINES);
  const fallback = 'Give your attention to one thing you can move forward.';
  const QUOTE_FALLBACK = { opening: fallback, text: fallback };
  const between = (min, max) => Math.round(min + Math.random() * (max - min));
  const houseLit = hour => hour < 8 || hour >= 17;

  function quoteLines({ opening, text }) {
    const ending = text.slice(opening.length);
    return ending ? ['“' + opening, ending + '”'] : ['“' + text + '”', ''];
  }

  // Map local daylight onto the landscape's east-to-west arc.
  function sunPosition(now) {
    const hour = now.getHours() + now.getMinutes() / 60;
    const progress = Math.max(0, Math.min(1, (hour - 6) / 14));
    const x = 1010 + progress * 205;
    const y = 258 - Math.sin(progress * Math.PI) * 180;
    return `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
  }

  function starField() {
    return Array.from({ length: 36 }, (_, i) => {
      const x = Math.round(430 + ((i % 12) + Math.random()) * 83);
      const y = Math.round(16 + (Math.floor(i / 12) + Math.random()) * 58);
      if (Math.hypot(x - 1110, y - 125) < 54) return '';
      const radius = i % 5 === 0 ? 1.6 : 0.7 + Math.random() * 0.55;
      const brightness = (0.39 + Math.random() * 0.48).toFixed(2);
      const interval = (2.8 + Math.random() * 4.5).toFixed(1);
      const delay = (-Math.random() * +interval).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="${radius.toFixed(1)}" style="--star-light:${brightness};--star-period:${interval}s;--star-delay:${delay}s"/>`;
    }).join('');
  }

  // Keep each period's full cycle available across visits within this tab.
  function shuffleBag(items, random = Math.random, key = value => value) {
    let remaining = [];
    let previous;
    return () => {
      if (!remaining.length) {
        remaining = [...items];
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
      }
      const index = remaining.findIndex(item => key(item) !== previous);
      const item = remaining.splice(index < 0 ? 0 : index, 1)[0];
      if (item !== undefined) previous = key(item);
      return item;
    };
  }

  const periodBags = (items = {}, key) =>
    Object.fromEntries(
      Object.entries(items).map(([slot, rows]) => [slot, shuffleBag(rows, Math.random, key)])
    );
  const heroIcon = (d, size = 20) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
  const quoteIcon = heroIcon('M20 7v5h-5M20 12a8 8 0 1 0-2.4 5.7', 17);
  const metricIcons = {
    priorities: heroIcon('M12 3l2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6L12 3Z', 19),
    schedule: heroIcon('M4 6h16v14H4ZM4 10h16M8 4v4m8-4v4M8 14h3m2 0h3', 19),
    tasks: heroIcon('M6 5h12v15H6ZM9 13l2 2 4-5m-6 8h6', 19),
    arrow: heroIcon('M6 18 18 6M9 6h9v9', 14),
  };
  function paintMoment(hero, moment, elapsed) {
    const layer = hero.querySelector('.mv-life-layer');
    if (!layer || layer.dataset.moment === (moment?.id || '')) return;
    layer.dataset.moment = moment?.id || '';
    if (moment?.id === 'windows-light' && elapsed < 3000) hero.classList.add('mv-lighting-cabin');
    else hero.classList.remove('mv-lighting-cabin');
    layer.innerHTML = moment
      ? `<g class="mv-moment" style="--mv-moment-duration:${moment.duration}s;--mv-moment-start:${-elapsed / 1000}s">${moment.render()}</g>`
      : '';
    const caption = hero.querySelector('.mv-scene-note');
    if (caption) {
      caption.textContent = moment?.label || '';
      caption.hidden = !moment;
    }
  }
  function trees(x, y, n, scale = 1) {
    return Array.from({ length: n }, (_, i) => {
      const px = x + i * 32,
        py = y + Math.sin(i * 1.9) * 13,
        s = (0.7 + (i % 4) * 0.14) * scale;
      return `<g transform="translate(${px} ${py}) scale(${s})"><g class="mv-tree" style="--tree:${i}"><path d="M-3 0 3 0 2-82-2-82Z" fill="var(--mv-scrim)"/><path d="M0-130-32-74-18-74-43-31-20-31-48-2 46-2 20-31 40-31 17-74 31-74Z" fill="currentColor"/><path d="M0-130 0-5 46-2 20-31 40-31 17-74 31-74Z" fill="var(--mv-scrim)" opacity=".17"/></g></g>`;
    }).join('');
  }
  function scene(prefix = 'mv', now = new Date(), night) {
    const moon = night?.phase || 'full';
    const stars = night?.stars || '';
    return `<div class="mv-scene" aria-hidden="true"><svg class="mv-landscape" viewBox="0 0 1440 500" preserveAspectRatio="xMaxYMid slice"><defs>
      <linearGradient id="${prefix}Sky" x2="0%" y2="100%"><stop stop-color="var(--mv-sky-top)"/><stop offset="1" stop-color="var(--mv-sky-bottom)"/></linearGradient>
      <linearGradient id="${prefix}River" x2="80%" y2="100%"><stop stop-color="var(--mv-river-shine)"/><stop offset=".45" stop-color="var(--mv-river-light)"/><stop offset="1" stop-color="var(--mv-river-deep)"/></linearGradient>
      <linearGradient id="${prefix}Earth" x2="0%" y2="100%"><stop stop-color="var(--mv-bank-light)"/><stop offset="1" stop-color="var(--mv-foreground)"/></linearGradient>
      <linearGradient id="${prefix}Roof" x2="0%" y2="100%"><stop stop-color="#d0ae7e"/><stop offset="1" stop-color="#8c7560"/></linearGradient>
      <radialGradient id="${prefix}Glow"><stop stop-color="var(--mv-sun)" stop-opacity=".58"/><stop offset="1" stop-color="var(--mv-sun)" stop-opacity="0"/></radialGradient>
      <linearGradient id="${prefix}Moon" x2="26%" y2="100%"><stop stop-color="#f5f6e5"/><stop offset="1" stop-color="#b9d2d0"/></linearGradient>
      <linearGradient id="${prefix}Mist"><stop stop-color="var(--mv-light)" stop-opacity="0"/><stop offset=".5" stop-color="var(--mv-light)" stop-opacity=".25"/><stop offset="1" stop-color="var(--mv-light)" stop-opacity="0"/></linearGradient>
      <clipPath id="${prefix}RiverClip"><path d="M971 310Q998 336 936 350T861 392Q901 419 1026 415T1189 468L1270 520H793Q807 450 745 423T764 369Q886 337 936 310Z"/></clipPath>
      <clipPath id="${prefix}MoonShape"><path data-mv-moon-outline d="${MOON_OUTLINES[moon]}"/></clipPath>
      <pattern id="${prefix}Rain" width="86" height="94" patternUnits="userSpaceOnUse"><path d="M13 12 8 24m33 6-6 15m37-31-6 15m-42 28-7 16m44-17-6 13m18 9-5 14M40 83l-2 5" fill="none" stroke="#c9e2eb" stroke-width="1.6" stroke-linecap="round"/></pattern>
    </defs>
    <rect width="1440" height="500" fill="url(#${prefix}Sky)"/>
    <g class="mv-stars">${stars}</g>
    <g class="mv-layer mv-layer-sky">
      <g class="mv-sun-position" transform="${sunPosition(now)}"><g class="mv-sun-light"><g class="mv-sun-rays" stroke="var(--mv-sun)" stroke-width="2">${Array.from({ length: 24 }, (_, i) => `<path d="M72 0H190" transform="rotate(${i * 15})"/>`).join('')}</g><circle class="mv-celestial-halo" r="160" fill="url(#${prefix}Glow)"/><circle r="49" fill="var(--mv-sun)"/></g>
        <g class="mv-sun-cover"><g transform="scale(1.5 1.6)"><path d="${CLOUD}" fill="#9ab2b1"/><path d="${CLOUD_LIGHT}" fill="#dae5de" opacity=".82"/></g><path d="M-123 24Q-94 8-64 20Q-35 11-14 24H-123ZM40 28Q77 15 109 26Q132 15 160 29H40Z" fill="#c1d5d2" opacity=".7"/></g>
      </g>
      <g class="mv-moon" transform="translate(1110 125)"><circle class="mv-celestial-halo" r="118" fill="url(#${prefix}Glow)"/><g clip-path="url(#${prefix}MoonShape)"><circle r="49" fill="url(#${prefix}Moon)"/><g fill="#688d97" opacity=".26"><circle cx="-20" cy="-17" r="8"/><circle cx="17" cy="-23" r="5"/><circle cx="27" cy="-4" r="9"/><circle cx="12" cy="12" r="6"/><circle cx="-27" cy="11" r="11"/><circle cx="-13" cy="29" r="5"/><circle cx="27" cy="24" r="4"/></g></g></g>
      <g class="mv-cloud mv-cloud-one"><g transform="translate(750 111) scale(1.17)"><path d="${CLOUD}"/><path d="${CLOUD_LIGHT}" fill="#f3f4e8" opacity=".6"/></g><path d="M888 53q18-15 40-5 18-28 49-5 22-6 35 10Z"/></g>
      <g class="mv-cloud mv-cloud-two"><g transform="translate(1245 178) scale(1.02 .78)"><path d="${CLOUD}"/><path d="${CLOUD_LIGHT}" fill="#f3f4e8" opacity=".6"/></g></g>
    </g>
    <g class="mv-layer mv-layer-far"><path d="M170 320 415 137 563 252 737 118 903 248 1030 162 1280 290 1440 180 1440 500 170 500Z" fill="var(--mv-mountain-far)"/><path d="m624 216 113-98 82 64-83-22-45 44Z" fill="var(--mv-light)" opacity=".23"/><path d="m922 240 108-78 72 42-64-18-46 43Z" fill="var(--mv-light)" opacity=".19"/></g>
    <g class="mv-layer mv-layer-mid"><path d="M-10 393Q140 198 351 293T713 264Q864 194 1003 286T1455 249V520H-10Z" fill="var(--mv-mountain-mid)"/><path d="M380 330Q648 226 909 325T1520 282" fill="none" stroke="url(#${prefix}Mist)" stroke-width="34"/>
      <g style="color:var(--mv-tree-far)">${trees(665, 334, 17, 0.65)}</g>
    </g>
    <g class="mv-layer mv-layer-valley"><path d="M-40 427Q161 311 386 367T750 324Q920 346 988 312T1490 350L1460 520H-40Z" fill="var(--mv-valley)"/>
      <path class="mv-river-body" d="M971 310Q998 336 936 350T861 392Q901 419 1026 415T1189 468L1270 520H793Q807 450 745 423T764 369Q886 337 936 310Z" fill="url(#${prefix}River)" opacity=".95"/>
      <g clip-path="url(#${prefix}RiverClip)"><g class="mv-river-caustics" stroke="var(--mv-light)" fill="none">${Array.from({ length: 16 }, (_, i) => `<path style="--i:${i}" d="M710 ${315 + i * 14}q65-15 130 0t130 0t130 0t130 0"/>`).join('')}</g><path class="mv-river-current" d="M953 305Q1018 337 913 361T821 392Q864 438 1028 435T1220 515" fill="none" stroke="var(--mv-sun)" stroke-width="5"/><g class="mv-river-ripples" fill="none" stroke="var(--mv-light)">${Array.from({ length: 7 }, (_, i) => `<g transform="translate(${820 + ((i * 47) % 360)} ${375 + i * 22})"><ellipse style="--i:${i}" rx="18" ry="4"/></g>`).join('')}</g></g>
      <g class="mv-water-lines" fill="none" stroke="var(--mv-light)" stroke-linecap="round" opacity=".46"><path d="M908 352h48m-126 45h72m-46 47h120m74 31h112m-23 29h114" stroke-width="2"/><path d="M944 326h18m-58 42h33m-87 52h63m115 25h56m-21 48h54"/></g>
      <path d="M1015 361q43-44 85-9" fill="none" stroke="var(--mv-river-light)" stroke-width="7"/><path d="M1015 359v-23m16 8v-22m17 13v-20m18 21v-19m17 25v-18m16 31v-21" stroke="var(--mv-cabin-roof)" stroke-width="3"/>
    </g>
    <g class="mv-layer mv-layer-near"><path d="M-20 431Q180 347 378 414T749 414L760 520H-20Z" fill="var(--mv-foreground)"/><path d="M1080 419Q1194 309 1475 367V520H1243Q1176 432 1080 419Z" fill="url(#${prefix}Earth)"/>
      <g style="color:var(--mv-tree-near)">${trees(1215, 390, 9, 1.1)}${trees(80, 427, 5, 0.85)}</g>
      <g class="mv-cabin" transform="translate(1146 318)"><path d="M-37 43V-4L0-30 42-4V43Z" fill="var(--mv-cabin-wall)"/><path d="M-52-4 0-45 54-4 43 3 0-29-41 3Z" fill="url(#${prefix}Roof)"/><path d="M26-25V-53h12v39" fill="#8e8e77"/><g class="mv-cabin-glow" fill="#ffd88e"><ellipse cx="-17" cy="19" rx="17" ry="16"/><ellipse cx="19" cy="19" rx="17" ry="16"/></g><path d="M-25 10h16v17h-16Zm36 0h16v17H11Z" fill="#62766a" class="mv-cabin-window"/><path d="M-4 43V11H6v32" fill="#514a3f"/><path d="M-52 43H54" stroke="var(--mv-cabin-roof)" stroke-width="5"/>
        <g class="mv-smoke" fill="none" stroke="var(--mv-light)" opacity=".38" stroke-width="4" stroke-linecap="round"><path d="M32-57q-13-12-1-24t-2-26"/></g>
      </g>
      <g fill="var(--mv-valley)" opacity=".7"><ellipse cx="1263" cy="427" rx="32" ry="5"/><ellipse cx="1189" cy="447" rx="20" ry="4"/><ellipse cx="1347" cy="448" rx="46" ry="8"/></g>
    </g>
    <g class="mv-layer mv-layer-front"><path d="M-20 503Q147 444 276 481T616 492L640 530H-20Z" fill="var(--mv-scrim)"/><g class="mv-fern" fill="var(--mv-tree-far)"><path d="M1355 530q-11-78 51-144-12 81-51 144Z"/><path d="M1350 530q-41-53-22-119 31 52 22 119Z"/><path d="M1343 530q-52-28-61-77 47 21 61 77Z"/></g>
      <g fill="var(--mv-sun)"><circle cx="1274" cy="436" r="2"/><circle cx="1228" cy="464" r="2.4"/><circle cx="1323" cy="409" r="2"/></g>
    </g>
    <g class="mv-life-layer mv-layer mv-layer-near" data-moment=""></g>
    <g class="mv-wind-leaves" fill="var(--mv-river-light)">${Array.from({ length: 12 }, (_, i) => `<g transform="translate(${770 + ((i * 71) % 650)} ${170 + ((i * 37) % 220)})"><path style="--i:${i}" d="M0 0Q14-11 19 1Q9 14 0 0Z"/></g>`).join('')}</g>
    <g class="mv-rain"><rect width="1440" height="500" fill="#244859" opacity=".23"/><rect class="mv-rain-streaks" x="-100" y="-100" width="1700" height="700" fill="url(#${prefix}Rain)"/></g>
    </svg><div class="mv-light-beams"></div><div class="mv-scene-haze"></div><div class="mv-motes">${Array.from({ length: 16 }, (_, i) => `<i style="--i:${i};left:${35 + ((i * 17) % 63)}%;top:${15 + ((i * 23) % 70)}%"></i>`).join('')}</div></div>`;
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
      litCard = null,
      effectTimer = 0,
      counterGeneration = 0,
      entered = false,
      observedPage = null,
      landed = '',
      burstNode = null,
      touchLayer = null,
      completionPoint = null,
      lastSpark = 0,
      lastLight = 0,
      sparkPoint = null;
    let quoteBags, sceneBags;
    let quotePeriod = '',
      currentQuote = '',
      clockMinute,
      displayDay;
    let scenePeriod = '',
      activeMoment,
      elapsed = 0,
      quietFor = 0,
      lastSceneTick;
    const moonPhases = shuffleBag(MOON_PHASES);
    let nightSky = null,
      skyWeather = 'clear',
      nextWeatherAt = 0;
    const animations = new Set(),
      numbers = new Map(),
      charts = new Map(),
      revealed = new Set(),
      counterJobs = new Map(),
      frames = new Set();
    const motionPreference = '(prefers-reduced-motion: reduce)';
    const reduced = () => !!root.matchMedia?.(motionPreference)?.matches;
    const allowed = () =>
      a.ready() &&
      !document.hidden &&
      a.prefs().motion !== 'off' &&
      a.settings().effects !== 'calm' &&
      !reduced() &&
      !document.body.matches('.hub-private,.hub-present,.rest-room-open');
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
        const hero = page.querySelector('.mv-hero');
        hero?.style.removeProperty('--mv-pointer-x');
        hero?.style.removeProperty('--mv-pointer-y');
      }
      if (litCard) {
        litCard.classList.remove('mv-lit');
        litCard.style.removeProperty('--mv-rx');
        litCard.style.removeProperty('--mv-ry');
        litCard = null;
      }
    }
    function quoteFor(when, advance = false) {
      if (quotePeriod !== when || !currentQuote || advance) {
        quoteBags ||= periodBags(root.WorkHubMyDayQuotes, quote => quote.opening);
        quotePeriod = when;
        currentQuote = quoteBags[when]?.() || QUOTE_FALLBACK;
      }
      return currentQuote;
    }
    function updateQuote(hero, when, advance = false) {
      const target = hero.querySelector('[data-mv-quote]');
      if (target) {
        const [opening, ending] = quoteLines(quoteFor(when, advance));
        if (target.firstElementChild.textContent !== opening)
          target.firstElementChild.textContent = opening;
        if (target.lastElementChild.textContent !== ending)
          target.lastElementChild.textContent = ending;
        target.lastElementChild.hidden = !ending;
      }
    }
    function skyFor(now, when) {
      if (when !== 'night') return null;
      const nightDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - (now.getHours() < 6 ? 1 : 0)
      );
      const key = nightDate.toDateString();
      if (nightSky?.key !== key) nightSky = { key, phase: moonPhases(), stars: starField() };
      return nightSky;
    }
    function resetWeather() {
      skyWeather = 'clear';
      nextWeatherAt = 0;
    }
    function updateWeather(hero, when, now, moving) {
      if (!moving || when === 'night' || hero.classList.contains('mv-out-of-view')) {
        resetWeather();
      } else if (!nextWeatherAt) {
        nextWeatherAt = now + between(16000, 32000);
      } else if (now >= nextWeatherAt) {
        if (skyWeather === 'clear') {
          skyWeather = a.settings().particles && Math.random() < 0.26 ? 'rain' : 'cloud';
          nextWeatherAt = now + (skyWeather === 'rain' ? RAIN_DURATION : CLOUD_DURATION);
        } else {
          skyWeather = 'clear';
          nextWeatherAt = now + between(33000, 70000);
        }
      }
      if (hero.dataset.mvWeather !== skyWeather) hero.dataset.mvWeather = skyWeather;
    }
    function resetScene() {
      activeMoment = undefined;
      elapsed = quietFor = 0;
      lastSceneTick = undefined;
    }
    function updateScene(hero, when, now, enabled) {
      if (!hero.querySelector('.mv-life-layer') || document.hidden) {
        lastSceneTick = undefined;
        return;
      }
      if (scenePeriod !== when) {
        scenePeriod = when;
        resetScene();
      }
      if (!enabled) {
        resetScene();
        paintMoment(hero, null, 0);
        return;
      }
      if (hero.classList.contains('mv-out-of-view')) {
        lastSceneTick = undefined;
        return;
      }
      sceneBags ||= periodBags(root.WorkHubMyDayScenes, item => item.id);
      const particles = a.settings().particles;
      elapsed += lastSceneTick === undefined ? 0 : Math.min(1500, Math.max(0, now - lastSceneTick));
      lastSceneTick = now;
      if (
        activeMoment &&
        (elapsed >= activeMoment.duration * 1000 ||
          (!particles && activeMoment.id === 'bank-fireflies'))
      ) {
        activeMoment = undefined;
        elapsed = 0;
        quietFor = 9000 + Math.round(Math.random() * 8500);
      } else if (!activeMoment && elapsed >= quietFor) {
        activeMoment = sceneBags[when]?.();
        if (!particles && activeMoment?.id === 'bank-fireflies') activeMoment = sceneBags[when]();
        elapsed = 0;
      }
      paintMoment(hero, activeMoment, elapsed);
    }
    function refreshHero(hero, moving) {
      if (!hero || document.hidden) {
        lastSceneTick = undefined;
        return;
      }
      const now = new Date();
      const hour = now.getHours();
      const when = period(hour);
      if (hero.dataset.mvPeriod !== when) {
        hero.dataset.mvPeriod = when;
        resetWeather();
        const label = hero.querySelector('[data-mv-period-name]');
        if (label) label.textContent = PHASE_NAMES[when];
      }
      const minute = Math.floor(now.getTime() / 60000);
      if (clockMinute !== minute) {
        clockMinute = minute;
        const night = skyFor(now, when);
        if (hero.dataset.mvNight !== (night?.key || '')) {
          hero.dataset.mvNight = night?.key || '';
          hero.dataset.mvMoon = night?.phase || '';
          const outline = hero.querySelector('[data-mv-moon-outline]');
          const stars = hero.querySelector('.mv-stars');
          if (night) outline?.setAttribute('d', MOON_OUTLINES[night.phase]);
          if (stars) stars.innerHTML = night?.stars || '';
        }
        const time = hero.querySelector('[data-mv-time]');
        if (time) time.textContent = timeLabel.format(now);
        if (when !== 'night') {
          const sun = hero.querySelector('.mv-sun-position');
          const position = sunPosition(now);
          if (sun?.getAttribute('transform') !== position) sun?.setAttribute('transform', position);
        }
        hero.dataset.mvWindows = houseLit(hour) ? 'lit' : 'off';
        const date = hero.querySelector('[data-mv-date]');
        if (date && displayDay !== now.toDateString()) date.textContent = dateLabel.format(now);
        displayDay = now.toDateString();
      }
      if (quotePeriod !== when || !currentQuote) updateQuote(hero, when);
      updateWeather(hero, when, now.getTime(), moving);
      updateScene(hero, when, now.getTime(), moving);
    }
    function sync() {
      const next = a.ready() ? a.owner() : '';
      if (owner !== next) {
        endSort();
        clearEffects();
        resetLight();
        owner = next;
        view = 'all';
        quoteBags = sceneBags = undefined;
        quotePeriod = currentQuote = '';
        nightSky = null;
        resetWeather();
        resetScene();
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
      const live = document.querySelector('.my-day-page:not(.hub-palette-preview-scenery)');
      if (!live) {
        clearEffects();
        observer?.disconnect();
        observer = null;
        resetLight();
        page = null;
        observedPage = null;
        entered = false;
        quotePeriod = currentQuote = '';
        resetWeather();
        resetScene();
        charts.clear();
        revealed.clear();
        stopCounters();
        cancelAnimations();
        return;
      }
      page = live;
      const moving = allowed();
      const motion = moving ? 'flow' : 'still';
      if (page.dataset.mvMotion !== motion) page.dataset.mvMotion = motion;
      refreshHero(page.querySelector('.mv-hero'), moving);
      if (!a.settings().celebrations && burstNode) {
        clearTimeout(effectTimer);
        burstNode.remove();
        burstNode = null;
        page.classList.remove('mv-day-lit');
      }
      if (!a.settings().particles)
        touchLayer?.querySelectorAll('.mv-pointer-spark').forEach(el => el.remove());
      if (!moving) {
        clearEffects();
        resetLight();
        stopCounters();
        cancelAnimations();
      }
    }
    function hero(data) {
      const now = new Date();
      const when = period(now.getHours());
      const [opening, ending] = quoteLines(quoteFor(when));
      const night = skyFor(now, when);
      return `<div class="mv-atmosphere" aria-hidden="true"><i></i><i></i><i></i></div>
        <header class="hub-head md-day-intro mv-hero" data-mv-period="${when}" data-mv-night="${night?.key || ''}" data-mv-moon="${night?.phase || ''}" data-mv-weather="${skyWeather}" data-mv-windows="${houseLit(now.getHours()) ? 'lit' : 'off'}">
          ${scene('mv', now, night)}<div class="mv-hero-shade"></div>
          <div class="mv-hero-content">
            <p class="mv-day-label"><span data-mv-date>${esc(dateLabel.format(now))}</span><i aria-hidden="true"></i><span data-mv-time>${esc(timeLabel.format(now))}</span><i aria-hidden="true"></i><span data-mv-period-name>${PHASE_NAMES[when]}</span></p>
            <h2 class="mv-quote" data-mv-quote aria-live="polite" aria-atomic="true"><span>${esc(opening)}</span><em${ending ? '' : ' hidden'}>${esc(ending)}</em></h2>
            <button type="button" class="mv-next-quote" data-mv="next-quote">${quoteIcon}<span>Next quote</span></button>
            <div class="md-hero-actions">${data.actions}</div>
          </div>
          <div class="mv-scene-note" aria-hidden="true" hidden></div>
          <div class="mv-hero-metrics"><button type="button" data-md="missions" class="mv-hero-metric"><span class="mv-metric-icon" aria-hidden="true">${metricIcons.priorities}</span><span><small>Today’s intention</small><strong>${Math.max(0, data.total - data.done)}<span> left</span></strong><em>${data.total ? (data.done === data.total ? 'today’s priorities complete' : 'priorities to move forward') : 'choose your priorities'}</em></span><i class="mv-metric-track" style="--mv-meter:${data.total ? (data.done / data.total) * 100 : 0}%"></i></button><button type="button" data-mv="jump" data-target="dayJourney" class="mv-hero-metric"><span class="mv-metric-icon" aria-hidden="true">${metricIcons.schedule}</span><span><small>Room to make progress</small><strong>${data.activities}<span> planned</span></strong><em>activities on your calendar</em></span><span class="mv-metric-arrow" aria-hidden="true">${metricIcons.arrow}</span></button><button type="button" data-mv="jump" data-target="tasks" class="mv-hero-metric"><span class="mv-metric-icon" aria-hidden="true">${metricIcons.tasks}</span><span><small>One step at a time</small><strong>${data.open}<span> open</span></strong><em>tasks ready for your next step</em></span><span class="mv-metric-arrow" aria-hidden="true">${metricIcons.arrow}</span></button></div></header>`;
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
      if (
        root.WorkHubRenderProfile?.largeDisplay &&
        el.matches('.mv-hero,.md-widget,.mv-widget-shell')
      )
        return;
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
        if (
          previous === target ||
          root.WorkHubRenderProfile?.largeDisplay ||
          !allowed() ||
          typeof root.requestAnimationFrame !== 'function'
        )
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
          if (el.textContent !== String(v)) el.textContent = String(v);
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
                if (entry.target.classList.contains('mv-hero')) {
                  lastSceneTick = undefined;
                  if (entry.isIntersecting) refreshHero(entry.target, allowed());
                  else
                    updateWeather(entry.target, entry.target.dataset.mvPeriod, Date.now(), false);
                }
                if (entry.isIntersecting) {
                  animateCharts(entry.target);
                  reveal(entry.target);
                }
              }
            },
            { rootMargin: '80px' }
          );
          for (const node of page.querySelectorAll('.mv-hero,.md-widget,.mv-atmosphere i'))
            observer.observe(node);
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
      if (root.WorkHubRenderProfile?.largeDisplay) {
        lightFrame = 0;
        resetLight();
        return;
      }
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
        h = hero?.getBoundingClientRect(),
        card = target?.closest?.('.md-widget'),
        r = card?.getBoundingClientRect();
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
      if (h && h.bottom >= 0 && h.top <= root.innerHeight) {
        hero.style.setProperty(
          '--mv-pointer-x',
          String(Math.max(-1, Math.min(1, ((x - h.left) / h.width) * 2 - 1)))
        );
        hero.style.setProperty(
          '--mv-pointer-y',
          String(Math.max(-1, Math.min(1, ((y - h.top) / h.height) * 2 - 1)))
        );
      }
      if (litCard && litCard !== card) {
        litCard.classList.remove('mv-lit');
        litCard.style.removeProperty('--mv-rx');
        litCard.style.removeProperty('--mv-ry');
        litCard = null;
      }
      if (r && card.closest('.my-day-page')) {
        litCard = card;
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
        if (
          event.pointerType === 'touch' ||
          event.buttons ||
          !page ||
          root.WorkHubRenderProfile?.largeDisplay ||
          !allowed()
        )
          return;
        const time = root.performance?.now?.() ?? Date.now();
        if (document.documentElement.dataset.effectLevel === 'balanced' && time - lastLight < 32)
          return;
        lastLight = time;
        lastPointer = { x: event.clientX, y: event.clientY, target: event.target };
        if (!lightFrame) lightFrame = root.requestAnimationFrame?.(light) || 0;
      },
      { passive: true }
    );
    document.addEventListener('pointerleave', () => resetLight());
    root.addEventListener('workhub:render-profile', () => {
      if (lightFrame) root.cancelAnimationFrame?.(lightFrame);
      if (raf) root.cancelAnimationFrame?.(raf);
      lightFrame = raf = 0;
      lastPointer = null;
      lastLight = 0;
      resetLight();
      if (root.WorkHubRenderProfile?.largeDisplay)
        page?.querySelector('.mv-hero')?.style.removeProperty('--mv-scroll');
      stopCounters();
      cancelAnimations();
    });
    root.addEventListener(
      'scroll',
      () => {
        if (raf || !page || root.WorkHubRenderProfile?.largeDisplay) return;
        raf =
          root.requestAnimationFrame?.(() => {
            raf = 0;
            if (!allowed() || !page) return;
            const hero = page.querySelector('.mv-hero'),
              rect = hero?.getBoundingClientRect();
            if (rect) {
              const value = Math.max(-100, Math.min(350, -rect.top)) + 'px';
              if (hero.style.getPropertyValue('--mv-scroll') !== value)
                hero.style.setProperty('--mv-scroll', value);
            }
          }) || 0;
      },
      { passive: true }
    );
    document.addEventListener('visibilitychange', () => {
      sync();
    });
    root.matchMedia?.(motionPreference)?.addEventListener?.('change', () => sync());
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
      if (el.dataset.mv === 'next-quote') {
        const hero = el.closest('.mv-hero');
        if (hero) updateQuote(hero, period(new Date().getHours()), true);
        return;
      }
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
  root.WorkHubMyDayVisuals = { install, phase, period, scene, shuffleBag };
})(window);
