/** Local decorative budgets. Bounded frame sampling never owns clocks, audio or account data. */
(function (root) {
  'use strict';
  const detect = navigator =>
    /\biPhone\b/i.test(navigator?.userAgent || '') || navigator?.platform === 'iPhone';
  const iphone = detect(root.navigator);
  let large = false,
    heavyDisplay = false,
    adaptive = false,
    activeBudget = null,
    mode = 'auto',
    frame = 0,
    sampleFrame = 0,
    sampleTimer = null,
    lastSample = -Infinity,
    pageActive = true;
  const phone = Object.freeze({
    orbits: 1,
    particles: 12,
    comets: 2,
    reactions: 28,
    rings: 1,
    burst: 8,
    panels: 6,
  });
  const full = Object.freeze({
    orbits: 3,
    particles: 32,
    comets: 5,
    reactions: 140,
    rings: 3,
    burst: 22,
    panels: Infinity,
  });
  const smooth = Object.freeze({
    orbits: 0,
    particles: 8,
    comets: 0,
    reactions: 16,
    rings: 0,
    burst: 0,
    panels: 0,
  });
  const balanced = Object.freeze({
    orbits: 1,
    particles: 14,
    comets: 2,
    reactions: 36,
    rings: 1,
    burst: 8,
    panels: 6,
  });
  const reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)');
  const lowDevice =
    (root.navigator?.hardwareConcurrency > 0 && root.navigator.hardwareConcurrency <= 2) ||
    (root.navigator?.deviceMemory > 0 && root.navigator.deviceMemory <= 2);
  const now = () => root.performance?.now?.() ?? Date.now();
  function attribute(key, value) {
    if (document.documentElement.dataset[key] !== value)
      document.documentElement.dataset[key] = value;
  }
  function sync() {
    const w = root.innerWidth || 0,
      h = root.innerHeight || 0,
      dpr = Math.max(1, root.devicePixelRatio || 1),
      pixels = w * h * dpr * dpr;
    heavyDisplay =
      !iphone && (heavyDisplay ? w >= 2300 || pixels >= 4500000 : w >= 2500 || pixels >= 6000000);
    large = mode === 'smooth' || (mode === 'auto' && (heavyDisplay || lowDevice || adaptive));
    const next = large ? smooth : iphone ? phone : mode === 'full' ? full : balanced,
      level = large ? 'smooth' : iphone ? 'phone' : mode === 'full' ? 'full' : 'balanced',
      reason =
        mode !== 'auto'
          ? 'preference'
          : heavyDisplay
            ? 'display'
            : lowDevice
              ? 'device'
              : adaptive
                ? 'frame-time'
                : 'default';
    attribute('largeDisplay', String(large));
    attribute('effectLevel', level);
    attribute('renderReason', reason);
    if (activeBudget !== next) {
      activeBudget = next;
      root.dispatchEvent(new CustomEvent('workhub:render-profile', { detail: { level, reason } }));
    }
  }
  function stopSample() {
    if (sampleFrame) root.cancelAnimationFrame?.(sampleFrame);
    if (sampleTimer !== null) root.clearTimeout(sampleTimer);
    sampleFrame = 0;
    sampleTimer = null;
  }
  function canSample() {
    return (
      pageActive &&
      mode === 'auto' &&
      !large &&
      !document.hidden &&
      !reduced?.matches &&
      document.body?.dataset.motion !== 'off' &&
      !document.body?.matches('.hub-private,.hub-present,.hub-sorting,.rest-room-open')
    );
  }
  function scheduleSample() {
    if (
      !canSample() ||
      sampleFrame ||
      sampleTimer !== null ||
      now() - lastSample < 20000 ||
      typeof root.requestAnimationFrame !== 'function'
    )
      return;
    sampleTimer = root.setTimeout(() => {
      sampleTimer = null;
      if (!canSample()) return;
      lastSample = now();
      let previous = null,
        count = 0,
        slow = 0,
        stalled = 0,
        poorWindows = 0;
      const sample = time => {
        sampleFrame = 0;
        if (!canSample()) return;
        if (previous !== null) {
          const elapsed = time - previous;
          // Ignore suspended-page gaps; one long task alone never selects a lower quality.
          if (elapsed <= 0 || elapsed > 5000) return;
          stalled = elapsed > 80 ? stalled + 1 : 0;
          count++;
          if (elapsed > 28) slow++;
          if (stalled === 4 || count === 32) {
            if (stalled === 4 || slow >= 13) poorWindows++;
            else return;
            if (stalled === 4 || poorWindows === 2) {
              // Keep the lighter path for this Automatic session; avoid quality oscillation.
              adaptive = true;
              sync();
              return;
            }
            count = slow = 0;
          }
        }
        previous = time;
        sampleFrame = root.requestAnimationFrame(sample);
      };
      sampleFrame = root.requestAnimationFrame(sample);
    }, 250);
  }
  function setMode(value) {
    const next = ['auto', 'smooth', 'full'].includes(value) ? value : 'auto';
    if (next === mode) return;
    stopSample();
    mode = next;
    adaptive = false;
    lastSample = -Infinity;
    sync();
    scheduleSample();
  }
  document.documentElement.dataset.renderProfile = iphone ? 'iphone' : 'full';
  sync();
  root.addEventListener(
    'resize',
    () => {
      if (!frame)
        frame = root.requestAnimationFrame(() => {
          frame = 0;
          sync();
          scheduleSample();
        });
    },
    { passive: true }
  );
  for (const event of ['pointerdown', 'keydown', 'scroll'])
    root.addEventListener(event, scheduleSample, { passive: true });
  root.addEventListener('load', scheduleSample, { once: true });
  document.addEventListener('visibilitychange', () => {
    stopSample();
    if (!document.hidden) scheduleSample();
  });
  reduced?.addEventListener?.('change', () => {
    stopSample();
    scheduleSample();
  });
  root.addEventListener('pagehide', () => {
    pageActive = false;
    stopSample();
    if (frame) root.cancelAnimationFrame?.(frame);
    frame = 0;
  });
  root.addEventListener('pageshow', () => {
    pageActive = true;
    scheduleSample();
  });
  root.WorkHubRenderProfile = Object.freeze({
    iphone,
    detect,
    get largeDisplay() {
      return large;
    },
    get budget() {
      return activeBudget;
    },
    setMode,
  });
})(window);
