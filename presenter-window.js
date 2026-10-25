/** Private controller shell. Its verified same-origin opener supplies the control DOM; no account client. */
(function (root) {
  'use strict';
  const source = root.opener,
    origin = root.location.origin,
    token = root.location.hash.slice(1);
  let ended = false;
  function send(type) {
    if (!ended && source && /^[a-zA-Z0-9-]{16,100}$/.test(token)) {
      try {
        source.postMessage({ type, token }, origin);
      } catch {}
    }
  }
  root.addEventListener('message', event => {
    if (event.origin !== origin || event.source !== source || event.data?.token !== token) return;
    if (event.data.type === 'workhub-audience-end') {
      ended = true;
      document.body.replaceChildren();
      const p = document.createElement('p');
      p.textContent = 'Presentation ended.';
      document.body.append(p);
      root.clearInterval(timer);
    }
  });
  const timer = root.setInterval(() => {
    if (!source || source.closed) {
      ended = true;
      root.clearInterval(timer);
      document.body.replaceChildren();
      const p = document.createElement('p');
      p.textContent = 'The presenter workspace was closed. Your audience connection has ended.';
      document.body.append(p);
      return;
    }
    send('workhub-presenter-heartbeat');
  }, 1000);
  root.addEventListener('blur', () => send('workhub-presenter-blur'));
  root.addEventListener('pagehide', () => {
    send('workhub-presenter-closed');
    ended = true;
    root.clearInterval(timer);
  });
  send('workhub-presenter-ready');
})(window);
