/** Button-free audience window for existing presentation links. No account client or storage. */
(function (root) {
  'use strict';
  const token = root.location.hash.slice(1),
    source = root.opener,
    origin = root.location.origin;
  const stage = document.getElementById('audienceStage'),
    view = root.WorkHubAudienceView.create(stage);
  let last = 0,
    ended = false;
  const neutral = message =>
    view.update({
      kind: 'cover',
      message,
      subtitle: 'Return to the private presenter controls to reconnect.',
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
      if (last) view.pointer(event.data.pointer);
      return;
    }
    if (event.data.type === 'workhub-audience-end') {
      ended = true;
      last = 0;
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
    document.title = 'Audience · ' + (event.data.snapshot.title || 'Process Hub');
    view.update(event.data.snapshot, event.data.marks || [], event.data.options || {});
  });
  let fullscreenPending = false;
  function reportFullscreen() {
    send('workhub-audience-fullscreen', { fullscreen: !!document.fullscreenElement });
  }
  async function enterFullscreen() {
    if (
      ended ||
      !last ||
      !source ||
      source.closed ||
      fullscreenPending ||
      document.fullscreenElement
    )
      return;
    fullscreenPending = true;
    try {
      await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' });
    } catch {
    } finally {
      fullscreenPending = false;
      reportFullscreen();
    }
  }
  // A direct audience gesture is the fallback where a new window cannot
  // inherit the launch click. No buttons or presenter controls enter this page.
  document.addEventListener('click', () => void enterFullscreen());
  document.addEventListener('keydown', e => {
    if (['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      void enterFullscreen();
    }
  });
  document.addEventListener('fullscreenchange', reportFullscreen);
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
      neutral('The presentation is paused.');
    }
    send('workhub-audience-heartbeat');
  }, 1000);
  root.addEventListener('pagehide', () => {
    send('workhub-audience-closed');
    root.clearInterval(timer);
    view.destroy();
    ended = true;
  });
  send('workhub-audience-ready');
})(window);
