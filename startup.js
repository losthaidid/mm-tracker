/* startup.js — Covers the original HTML until app.js renders the current workspace.
   Loaded before feature assets so interrupted downloads offer a readable recovery screen. */
(function (root) {
  'use strict';
  const document = root.document,
    page = document.documentElement;

  // Clear the retired player’s device-only preferences and search key.
  try {
    localStorage.removeItem('mm-tracker.music.v1');
    localStorage.removeItem('mm-tracker.youtube-key.v1');
  } catch {}
  let finished = false,
    blocked = false,
    workspaceName = 'Your workspace',
    message = 'Getting your workspace ready…',
    stage = 'assets';

  function showName(value) {
    workspaceName =
      typeof value === 'string' &&
      value.trim() &&
      value.length <= 200 &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
        ? value.trim()
        : 'Your workspace';
    const brand = document.getElementById('workhubStartupBrand');
    if (brand) brand.textContent = workspaceName;
    if (!finished) document.title = workspaceName;
  }
  // Small, validated palette data is inline so the first frame needs no extra request.
  let themeConfig = {};
  try {
    themeConfig = JSON.parse(document.getElementById('startupThemePresets')?.textContent || '{}');
  } catch {}
  if (!themeConfig || typeof themeConfig !== 'object' || Array.isArray(themeConfig))
    themeConfig = {};
  const validColor = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value),
    rgb = value =>
      value
        .slice(1)
        .match(/../g)
        .map(n => parseInt(n, 16)),
    mix = (a, b, weight) =>
      '#' +
      rgb(a)
        .map((value, i) =>
          Math.round(value * (1 - weight) + rgb(b)[i] * weight)
            .toString(16)
            .padStart(2, '0')
        )
        .join(''),
    luminance = value => {
      const c = rgb(value)
        .map(n => n / 255)
        .map(n => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
      return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
    },
    contrast = (a, b) =>
      (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05),
    readable = (preferred, backgrounds, minimum = 4.5) => {
      const base = ['#ffffff', '#111820', '#000000'].sort(
        (a, b) =>
          Math.min(...backgrounds.map(bg => contrast(b, bg))) -
          Math.min(...backgrounds.map(bg => contrast(a, bg)))
      )[0];
      return (
        [preferred, ...[0.12, 0.24, 0.4, 0.6, 0.8, 1].map(n => mix(preferred, base, n))].find(
          value => backgrounds.every(bg => contrast(value, bg) >= minimum)
        ) || base
      );
    },
    tint = (surface, color, weight, ink) =>
      [weight, weight / 2, weight / 4, 0]
        .map(n => mix(surface, color, n))
        .find(value => contrast(ink, value) >= 4.5) || surface,
    neutral = {
      page: '#081722',
      surface: '#122b3a',
      text: '#f2fcff',
      secondary: '#c7b5ff',
      accent: '#91e9df',
    };
  const appearanceProperties = [];
  function clearAppearance() {
    for (const property of appearanceProperties) page.style.removeProperty(property);
    delete page.dataset.startupTheme;
    delete page.dataset.startupBackground;
  }
  function appearance(preferences) {
    if (finished) return;
    const p =
        preferences && typeof preferences === 'object' && !Array.isArray(preferences)
          ? preferences
          : {},
      preset =
        typeof p.theme === 'string' && Object.hasOwn(themeConfig.themes || {}, p.theme)
          ? themeConfig.themes[p.theme]
          : null,
      custom =
        p.theme === 'custom' &&
        validColor(p.accent) &&
        p.colors &&
        ['page', 'surface', 'text', 'secondary'].every(key => validColor(p.colors[key]));
    let colors = custom ? { ...p.colors, accent: p.accent } : preset;
    if (
      !colors ||
      !['page', 'surface', 'text', 'secondary', 'accent'].every(key => validColor(colors[key]))
    )
      colors = neutral;
    const baseInk = readable(colors.text, [colors.surface]),
      soft = tint(colors.surface, colors.secondary, 0.06, baseInk),
      alt = tint(colors.surface, colors.accent, 0.06, baseInk),
      backgrounds = [colors.surface, soft, alt],
      ink = readable(colors.text, backgrounds),
      muted = readable(mix(ink, colors.surface, 0.2), backgrounds),
      accent = readable(colors.accent, backgrounds),
      secondary = readable(colors.secondary, backgrounds, 3),
      active = mix(colors.surface, colors.accent, 0.12),
      artSurface = mix(colors.surface, colors.secondary, 0.08),
      artAlt = tint(artSurface, colors.accent, 0.12, readable(colors.text, [artSurface])),
      artAccent = readable(colors.accent, [artSurface, artAlt], 3),
      artLine = readable(ink, [artSurface, artAlt]),
      dark = luminance(colors.surface) < 0.179;
    const tokens = {
      page: colors.page,
      glow: mix(colors.page, colors.accent, 0.12),
      'page-mid': mix(colors.page, colors.secondary, 0.035),
      surface: colors.surface,
      'surface-soft': soft,
      'surface-alt': alt,
      text: ink,
      muted,
      border: mix(colors.surface, ink, 0.24),
      grid: ink + '08',
      pattern: accent + '12',
      shadow: dark ? '#00000044' : '#17232f18',
      'accent-color': accent,
      secondary,
      'active-surface': active,
      'active-text': readable(ink, [active]),
      inset: mix(colors.surface, colors.page, 0.25),
      hover: colors.accent + '12',
      track: mix(colors.surface, ink, 0.15),
      done: accent,
      'done-surface': mix(colors.surface, colors.accent, 0.1),
      link: accent,
      'progress-light': mix(accent, colors.surface, 0.45),
      'art-surface': artSurface,
      'art-alt': artAlt,
      'art-accent': artAccent,
      'art-line': artLine,
      'star-light': mix(artAccent, colors.surface, 0.2),
      'star-heart': readable(ink, [artAccent]),
      'color-scheme': dark ? 'dark' : 'light',
      radius: ([6, 12, 16, 24].includes(p.radius) ? p.radius : 30) + 'px',
      font:
        p.font === 'serif'
          ? 'Georgia,serif'
          : p.font === 'rounded'
            ? '"Trebuchet MS",system-ui,sans-serif'
            : 'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
    };
    for (const [key, value] of Object.entries(tokens)) {
      const property = '--startup-' + key;
      page.style.setProperty(property, value);
      if (!appearanceProperties.includes(property)) appearanceProperties.push(property);
    }
    page.dataset.startupTheme = colors === neutral ? 'default' : p.theme;
    page.dataset.startupBackground =
      Array.isArray(themeConfig.backgrounds) && themeConfig.backgrounds.includes(p.background)
        ? p.background
        : 'grid';
  }

  // Reuse only the matching account's existing recovery copy for its display name.
  // The stored session is a branding hint; app.js still verifies the actual session.
  function account(project, userId) {
    let name, motion, preferences;
    try {
      if (project && userId) {
        const cache = JSON.parse(
          localStorage.getItem('mm-tracker.cloud.v1:' + project + ':' + userId)
        );
        preferences = cache?.document?.data?.workhub?.preferences;
        name = preferences?.workspace;
        motion = preferences?.motion;
      }
    } catch {}
    appearance(preferences);
    if (!finished) {
      page.toggleAttribute('data-startup-motion', motion === 'off');
      if (motion === 'off') page.dataset.startupMotion = 'off';
    }
    showName(name);
  }
  try {
    const { project } = JSON.parse(document.getElementById('cloudConfig').textContent),
      session = JSON.parse(localStorage.getItem('mm-tracker.auth.v1:' + project));
    account(project, session?.user?.id);
  } catch {
    appearance();
    showName();
  }

  function phase(value, label) {
    if (finished || blocked || !['assets', 'account', 'records'].includes(value)) return;
    stage = value;
    page.dataset.startupPhase = stage;
    const stages = ['assets', 'account', 'records'],
      index = stages.indexOf(stage);
    for (const el of document.querySelectorAll('[data-startup-stage]')) {
      const i = stages.indexOf(el.dataset.startupStage);
      el.dataset.state = i < index ? 'done' : i === index ? 'active' : 'waiting';
      if (i === index) el.setAttribute('aria-current', 'step');
      else el.removeAttribute('aria-current');
    }
    document
      .getElementById('workhubStartupProgress')
      ?.setAttribute('aria-valuetext', label || message);
    if (label) showMessage(label);
  }
  function showMessage(value) {
    message = value;
    const status = document.getElementById('workhubStartupStatus');
    if (status) status.textContent = message;
  }
  function failed(event) {
    const target = event.target;
    if (finished || (target !== root && !target?.matches?.('script[src],link[rel="stylesheet"]')))
      return;
    blocked = true;
    page.dataset.workhubStartupState = 'error';
    showMessage('Your workspace could not finish opening. Check your connection and reload.');
  }
  function rejected() {
    failed({ target: root });
  }
  root.addEventListener('error', failed, true);
  root.addEventListener('unhandledrejection', rejected);
  // A slow connection offers recovery without uncovering an unfinished page.
  const watchdog = root.setTimeout(() => {
    if (finished || blocked) return;
    page.dataset.workhubStartupState = 'slow';
    showMessage('Taking a little longer. Check your connection, or reload to try again.');
  }, 12000);
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      if (finished) return;
      showName(workspaceName);
      showMessage(message);
      phase(stage);
      document.getElementById('workhubStartupReload')?.addEventListener('click', event => {
        event.preventDefault();
        root.location.reload();
      });
    },
    { once: true }
  );

  document.addEventListener('visibilitychange', () => {
    if (!finished) page.toggleAttribute('data-startup-hidden', document.hidden);
  });
  function spark(event) {
    const button = event.target.closest?.('#workhubStartup .startup-spark-button');
    if (
      !button ||
      finished ||
      blocked ||
      page.hasAttribute('data-workhub-startup-state') ||
      page.dataset.startupMotion === 'off' ||
      root.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const scene = button.closest('.startup-scene');
    // A finite burst can be replayed without timers, particles or a render loop.
    scene.classList.remove('is-sparked');
    void scene.getBoundingClientRect();
    scene.classList.add('is-sparked');
  }
  function endSpark(event) {
    if (event.animationName === 'startup-tap-wave')
      event.target.closest('.startup-scene')?.classList.remove('is-sparked');
  }
  document.addEventListener('click', spark);
  document.addEventListener('animationend', endSpark);
  root.WorkHubStartup = {
    account,
    appearance,
    phase,
    name: showName,
    brand() {
      showName(workspaceName);
    },
    message(value) {
      if (!finished && !blocked) showMessage(value);
    },
    finish() {
      if (finished || blocked) return;
      finished = true;
      root.clearTimeout(watchdog);
      root.removeEventListener('error', failed, true);
      root.removeEventListener('unhandledrejection', rejected);
      document.removeEventListener('click', spark);
      document.removeEventListener('animationend', endSpark);
      delete page.dataset.workhubStartup;
      delete page.dataset.workhubStartupState;
      delete page.dataset.startupHidden;
      delete page.dataset.startupPhase;
      delete page.dataset.startupMotion;
      const screen = document.getElementById('workhubStartup');
      if (!screen) {
        clearAppearance();
        return;
      }
      screen.setAttribute('aria-hidden', 'true');
      screen.inert = true;
      // CSS fades the cover; reduced-motion users see the workspace immediately.
      screen.classList.add('is-leaving');
      const remove = () => {
        screen.remove();
        clearAppearance();
      };
      screen.addEventListener('transitionend', remove, { once: true });
      root.setTimeout(remove, 220);
    },
  };
})(window);
