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
    ended = false;
  const neutral = message =>
    view.update({
      kind: 'cover',
      message,
      subtitle: 'Return to your presenter controls to reconnect.',
    });
  neutral('Connecting to your presentation…');
  function send(type) {
    if (!ended && source && /^[a-zA-Z0-9-]{16,100}$/.test(token)) {
      try {
        source.postMessage({ type, token }, origin);
      } catch {}
    }
  }
  root.addEventListener('message', event => {
    if (event.origin !== origin || event.source !== source || event.data?.token !== token || ended)
      return;
    if (event.data.type === 'workhub-audience-end') {
      ended = true;
      last = 0;
      status.textContent = 'Presentation ended';
      neutral('This presentation has ended.');
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
    }
    send('workhub-audience-heartbeat');
  }, 1000);
  document.getElementById('audienceFullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen)
      void document.documentElement.requestFullscreen().catch(() => {
        status.textContent = 'Use this window at full size; native fullscreen is unavailable.';
      });
    else if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
    else status.textContent = 'Fullscreen is unavailable; maximise this window instead.';
  });
  root.addEventListener('pagehide', () => {
    send('workhub-audience-closed');
    root.clearInterval(timer);
    view.destroy();
    ended = true;
  });
  send('workhub-audience-ready');
})(window);
