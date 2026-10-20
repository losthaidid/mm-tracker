/* Pause decorative CSS motion while the page is hidden. No timers, network or record writes. */
(function () {
  'use strict';
  const sync = () => document.body.classList.toggle('hub-motion-paused', document.hidden);
  document.addEventListener('visibilitychange', sync);
  sync();
})();
