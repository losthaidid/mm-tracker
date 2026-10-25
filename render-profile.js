/** Rendering budgets selected before feature CSS. No account data or network. */
(function (root) {
  'use strict';
  const detect = navigator =>
    /\biPhone\b/i.test(navigator?.userAgent || '') || navigator?.platform === 'iPhone';
  const iphone = detect(root.navigator);
  let large = false,
    mode = 'auto',
    frame = 0;
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
  function sync() {
    frame = 0;
    const w = root.innerWidth || 0,
      h = root.innerHeight || 0,
      dpr = Math.max(1, root.devicePixelRatio || 1),
      pixels = w * h * dpr * dpr;
    const next =
      !iphone &&
      (mode === 'smooth' ||
        (mode === 'auto' &&
          (large ? w >= 2300 || pixels >= 4500000 : w >= 2500 || pixels >= 6000000)));
    if (next !== large) {
      large = next;
      document.documentElement.dataset.largeDisplay = String(large);
      root.dispatchEvent(new CustomEvent('workhub:render-profile'));
    } else document.documentElement.dataset.largeDisplay = String(large);
  }
  function setMode(value) {
    const next = ['auto', 'smooth', 'full'].includes(value) ? value : 'auto';
    if (next === mode) return;
    mode = next;
    sync();
  }
  document.documentElement.dataset.renderProfile = iphone ? 'iphone' : 'full';
  sync();
  root.addEventListener(
    'resize',
    () => {
      if (!frame) frame = root.requestAnimationFrame(sync);
    },
    { passive: true }
  );
  root.WorkHubRenderProfile = Object.freeze({
    iphone,
    detect,
    get largeDisplay() {
      return large;
    },
    get budget() {
      return iphone ? phone : large ? smooth : full;
    },
    setMode,
  });
})(window);
