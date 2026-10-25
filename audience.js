/** This page has no account client or storage access. Accept only its verified opener. */
(function (root) {
  'use strict';
  const token = root.location.hash.slice(1),
    source = root.opener,
    origin = root.location.origin;
  const stage = document.getElementById('audienceStage'),
    status = document.getElementById('audienceConnection');
  const view = root.WorkHubAudienceView.create(stage);
  let last = 0,
    ended = false,
    localLaser = false,
    windowedChosen = false,
    fullscreenWanted = new URLSearchParams(root.location.search).get('fullscreen') === '1';
  const prompt = document.getElementById('audienceFullscreenPrompt'),
    fullscreenButton = document.getElementById('audienceFullscreen'),
    fullscreenStatus = document.getElementById('audienceFullscreenStatus');
  function displayState() {
    const full = !!document.fullscreenElement;
    document.body.dataset.fullscreen = String(full);
    fullscreenButton.textContent = full ? '⛶ Exit full screen' : '⛶ Full screen';
    prompt.hidden = !last || ended || full || !fullscreenWanted || windowedChosen;
    if (full) fullscreenStatus.textContent = '';
  }
  async function enterFullscreen() {
    if (ended || !last) return;
    windowedChosen = false;
    fullscreenWanted = true;
    try {
      if (!document.documentElement.requestFullscreen) throw Error('unsupported');
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      if (ended || !last) {
        if (document.fullscreenElement) await document.exitFullscreen?.();
        return;
      }
      if (!document.fullscreenElement) throw Error('not fullscreen');
    } catch {
      fullscreenStatus.textContent =
        'Full screen was not allowed. Try Start full screen again in this window.';
    }
    displayState();
  }
  const neutral = message =>
    view.update({
      kind: 'cover',
      message,
      subtitle: 'Return to your presenter controls to reconnect.',
    });
  neutral('Connecting to your presentation…');
  function send(type, fields = {}) {
    if (!ended && source && /^[a-zA-Z0-9-]{16,100}$/.test(token)) {
      try {
        source.postMessage({ type, token, ...fields }, origin);
      } catch {}
    }
  }
  root.addEventListener('message', event => {
    if (event.origin !== origin || event.source !== source || event.data?.token !== token || ended)
      return;
    if (event.data.type === 'workhub-audience-pointer') {
      if (last && !localLaser) view.pointer(event.data.pointer);
      return;
    }
    if (event.data.type === 'workhub-audience-fullscreen-needed') {
      fullscreenWanted = true;
      windowedChosen = false;
      displayState();
      return;
    }
    if (event.data.type === 'workhub-audience-end') {
      ended = true;
      last = 0;
      status.textContent = 'Presentation ended';
      neutral('This presentation has ended.');
      displayState();
      return;
    }
    if (
      event.data.type !== 'workhub-audience-state' ||
      !event.data.snapshot ||
      !['process', 'cover', 'break'].includes(event.data.snapshot.kind)
    )
      return;
    last = Date.now();
    status.textContent = 'Connected · audience view';
    view.update(event.data.snapshot, event.data.marks || [], event.data.options || {});
    displayState();
  });
  const timer = root.setInterval(() => {
    if (ended) {
      root.clearInterval(timer);
      return;
    }
    let closed = true;
    try {
      closed = !source || source.closed;
    } catch {}
    if (closed || (last && Date.now() - last > 6000)) {
      last = 0;
      status.textContent = 'Presenter disconnected';
      neutral('The presentation is paused.');
      displayState();
    }
    send('workhub-audience-heartbeat');
  }, 1000);
  const laserButton = document.getElementById('audienceLaser');
  laserButton?.addEventListener('click', () => {
    localLaser = !localLaser;
    laserButton.setAttribute('aria-pressed', String(localLaser));
    stage.dataset.laser = String(localLaser);
    view.pointer(null);
  });
  stage.addEventListener('pointermove', event => {
    if (!localLaser || ended || !last) return;
    const r = stage.getBoundingClientRect();
    view.pointer([
      (event.clientX - r.left) / Math.max(1, r.width),
      (event.clientY - r.top) / Math.max(1, r.height),
    ]);
  });
  stage.addEventListener('pointerleave', () => view.pointer(null));
  root.addEventListener('blur', () => view.pointer(null));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) view.pointer(null);
  });
  fullscreenButton.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    else void enterFullscreen();
  });
  document
    .getElementById('audienceStartFullscreen')
    .addEventListener('click', () => void enterFullscreen());
  document.getElementById('audienceStayWindowed').addEventListener('click', () => {
    windowedChosen = true;
    displayState();
  });
  document.addEventListener('fullscreenchange', () => {
    windowedChosen = false;
    displayState();
    send('workhub-audience-fullscreen', { fullscreen: !!document.fullscreenElement });
  });
  root.addEventListener('pagehide', () => {
    send('workhub-audience-closed');
    root.clearInterval(timer);
    view.destroy();
    ended = true;
  });
  send('workhub-audience-ready');
})(window);
