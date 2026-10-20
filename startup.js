/* startup.js — Covers the original HTML until app.js renders the current workspace.
   Loaded before feature assets so interrupted downloads offer a readable recovery screen. */
(function (root) {
  'use strict';
  const document = root.document,
    page = document.documentElement;
  let finished = false,
    blocked = false,
    message = 'Getting your workspace ready…';

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
    showMessage('WorkHub could not finish opening. Check your connection and reload.');
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
      showMessage(message);
      document.getElementById('workhubStartupReload')?.addEventListener('click', event => {
        event.preventDefault();
        root.location.reload();
      });
    },
    { once: true }
  );

  root.WorkHubStartup = {
    message(value) {
      if (!finished && !blocked) showMessage(value);
    },
    finish() {
      if (finished || blocked) return;
      finished = true;
      root.clearTimeout(watchdog);
      root.removeEventListener('error', failed, true);
      root.removeEventListener('unhandledrejection', rejected);
      delete page.dataset.workhubStartup;
      delete page.dataset.workhubStartupState;
      const screen = document.getElementById('workhubStartup');
      if (!screen) return;
      screen.setAttribute('aria-hidden', 'true');
      screen.inert = true;
      // CSS fades the cover; reduced-motion users see the workspace immediately.
      screen.classList.add('is-leaving');
      const remove = () => screen.remove();
      screen.addEventListener('transitionend', remove, { once: true });
      root.setTimeout(remove, 220);
    },
  };
})(window);
