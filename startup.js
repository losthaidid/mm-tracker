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
  // Reuse only the matching account's existing recovery copy for its display name.
  // The stored session is a branding hint; app.js still verifies the actual session.
  function account(project, userId) {
    let name;
    try {
      if (project && userId) {
        const cache = JSON.parse(
          localStorage.getItem('mm-tracker.cloud.v1:' + project + ':' + userId)
        );
        name = cache?.document?.data?.workhub?.preferences?.workspace;
      }
    } catch {}
    showName(name);
  }
  try {
    const { project } = JSON.parse(document.getElementById('cloudConfig').textContent),
      session = JSON.parse(localStorage.getItem('mm-tracker.auth.v1:' + project));
    account(project, session?.user?.id);
  } catch {
    showName();
  }

  function phase(value, label) {
    if (finished || blocked || !['assets', 'account', 'records'].includes(value)) return;
    stage = value;
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
  root.WorkHubStartup = {
    account,
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
      delete page.dataset.workhubStartup;
      delete page.dataset.workhubStartupState;
      const screen = document.getElementById('workhubStartup');
      if (!screen) return;
      screen.setAttribute('aria-hidden', 'true');
      screen.inert = true;
      // CSS fades the cover; reduced-motion users see the workspace immediately.
      screen.classList.add('is-leaving');
      delete page.dataset.startupHidden;
      const remove = () => screen.remove();
      screen.addEventListener('transitionend', remove, { once: true });
      root.setTimeout(remove, 220);
    },
  };
})(window);
