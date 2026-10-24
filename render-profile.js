/** Select a rendering budget before feature CSS is parsed. No stored preferences or records. */
(function (root) {
  'use strict';
  const detect = navigator =>
    /\biPhone\b/i.test(navigator?.userAgent || '') || navigator?.platform === 'iPhone';
  const iphone = detect(root.navigator);
  const budget = Object.freeze(
    iphone
      ? {
          orbits: 1,
          particles: 12,
          comets: 2,
          reactions: 28,
          rings: 1,
          burst: 8,
          panels: 6,
        }
      : {
          orbits: 3,
          particles: 32,
          comets: 5,
          reactions: 140,
          rings: 3,
          burst: 22,
          panels: Infinity,
        }
  );
  document.documentElement.dataset.renderProfile = iphone ? 'iphone' : 'full';
  root.WorkHubRenderProfile = Object.freeze({ iphone, budget, detect });
})(window);
