/** Site-wide cinematic decoration. No account data, network requests or saved positions. */
(function (root) {
  'use strict';
  const body = document.body,
    view = document.getElementById('view'),
    reduced = root.matchMedia?.('(prefers-reduced-motion: reduce)'),
    surfaces =
      '.hub-card,.mv-widget-shell,.ticket-folio,.task-main-card,.wl-snippet,.panel.box,.val-summary,.claim-summary,.project-banner,.hub-head,.workspace-v10 > header,.bl-library-mark',
    layer = document.createElement('div');
  const observedSurfaces = new Set();
  let queued = false,
    lastStage = null,
    lastTrail = 0,
    lastX = 0,
    lastY = 0;
  layer.id = 'hubSpectacle';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = `<div class="fx-sky">${Array.from({ length: 3 }, (_, i) => `<i class="fx-ribbon" style="--i:${i}"></i>`).join('')}${Array.from({ length: 3 }, (_, i) => `<i class="fx-orbit" style="--i:${i}"></i>`).join('')}${Array.from({ length: 32 }, (_, i) => `<i class="fx-dust" style="--i:${i};--x:${(i * 37) % 100}%;--y:${(i * 61) % 100}%;--travel:${45 + ((i * 23) % 110)}px"></i>`).join('')}${Array.from({ length: 5 }, (_, i) => `<i class="fx-comet" style="--i:${i};top:${8 + i * 19}%;left:${35 + ((i * 17) % 60)}%"></i>`).join('')}</div><div class="fx-reactions"></div>`;
  body.append(layer);
  const reactions = layer.querySelector('.fx-reactions');
  const allowed = () =>
    !document.hidden &&
    body.dataset.motion !== 'off' &&
    !root.matchMedia?.('(prefers-reduced-motion: reduce)').matches &&
    !body.matches('.hub-private,.hub-present');
  const busy = target =>
    body.matches('.hub-sorting,.rest-room-open') ||
    !!target?.closest?.(
      'input,textarea,select,[contenteditable="true"],[draggable="true"],[data-md-drag],[data-lab-drag]'
    );
  const visibility =
    typeof root.IntersectionObserver === 'function'
      ? new root.IntersectionObserver(
          entries =>
            entries.forEach(({ target, isIntersecting }) =>
              target.classList.toggle('fx-visible', isIntersecting)
            ),
          { rootMargin: '80px' }
        )
      : null;
  function dress() {
    queued = false;
    if (!allowed()) return;
    for (const el of observedSurfaces) {
      if (!el.isConnected) {
        visibility?.unobserve(el);
        observedSurfaces.delete(el);
      }
    }
    const stage = view?.firstElementChild;
    if (stage && stage !== lastStage) {
      lastStage = stage;
      stage.classList.add('fx-stage');
    }
    for (const el of document.querySelectorAll(surfaces)) {
      if (el.closest('#hubSpectacle') || el.matches('input,select,textarea')) continue;
      if (!el.classList.contains('fx-surface')) {
        el.classList.add('fx-surface');
      }
      if (visibility && !observedSurfaces.has(el)) {
        visibility.observe(el);
        observedSurfaces.add(el);
      } else if (!visibility) el.classList.add('fx-visible');
      if (!el.querySelector(':scope > .fx-panel-aura')) {
        const aura = document.createElement('span');
        aura.className = 'fx-panel-aura';
        aura.setAttribute('aria-hidden', 'true');
        el.append(aura);
      }
    }
  }
  function scheduleDress() {
    if (queued) return;
    queued = true;
    void Promise.resolve().then(dress);
  }
  function sync() {
    const live = allowed();
    body.classList.toggle('hub-motion-paused', document.hidden);
    const mode = live ? 'spectacle' : 'off';
    if (body.dataset.spectacle !== mode) body.dataset.spectacle = mode;
    layer.hidden = !live;
    if (!live) {
      reactions.replaceChildren();
      lastTrail = 0;
      visibility?.disconnect();
      observedSurfaces.clear();
    } else scheduleDress();
  }
  function effect(className, x, y, dx = 0, dy = 0, i = 0) {
    // Rapid clicking cannot accumulate unlimited DOM or animation work.
    while (reactions.childElementCount >= 140) reactions.firstElementChild.remove();
    const el = document.createElement('i');
    el.className = className;
    el.style.cssText = `left:${x}px;top:${y}px;--dx:${dx}px;--dy:${dy}px;--i:${i}`;
    reactions.append(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
    root.setTimeout(() => el.remove(), 2200);
  }
  document.addEventListener(
    'pointermove',
    event => {
      if (!allowed() || event.buttons || busy(event.target) || event.pointerType === 'touch')
        return;
      const now = root.performance?.now() || Date.now();
      if (now - lastTrail < 42 || Math.hypot(event.clientX - lastX, event.clientY - lastY) < 7)
        return;
      lastTrail = now;
      lastX = event.clientX;
      lastY = event.clientY;
      effect('fx-pointer-star', lastX, lastY, Math.sin(now) * 35, -40, Math.round(now) % 8);
      effect('fx-pointer-streak', lastX, lastY, -25, -12);
    },
    { passive: true }
  );
  document.addEventListener(
    'click',
    event => {
      if (!allowed() || busy(event.target)) return;
      const control = event.target.closest?.('button,a,summary,[role="button"]');
      if (!control || control.disabled) return;
      const rect = control.getBoundingClientRect(),
        x = event.clientX || rect.left + rect.width / 2,
        y = event.clientY || rect.top + rect.height / 2,
        navigation = !!control.closest('#tabs');
      for (let i = 0; i < 3; i++) effect('fx-shockwave', x, y, 0, 0, i);
      for (let i = 0; i < (navigation ? 22 : 14); i++) {
        const angle = i * 2.39996,
          distance = 55 + (i % 5) * 23;
        effect('fx-burst-star', x, y, Math.cos(angle) * distance, Math.sin(angle) * distance, i);
      }
      if (navigation) effect('fx-scene-sweep', x, y);
    },
    { capture: true, passive: true }
  );
  if (view)
    new MutationObserver(records => {
      if (
        records.some(r =>
          [...r.addedNodes].some(n => n.nodeType === 1 && !n.classList.contains('fx-panel-aura'))
        )
      )
        scheduleDress();
    }).observe(view, { childList: true, subtree: true });
  new MutationObserver(sync).observe(body, {
    attributes: true,
    attributeFilter: ['class', 'data-motion'],
  });
  document.addEventListener('visibilitychange', sync);
  reduced?.addEventListener?.('change', sync);
  root.addEventListener('pagehide', () => {
    reactions.replaceChildren();
    visibility?.disconnect();
    observedSurfaces.clear();
  });
  root.addEventListener('pageshow', sync);
  root.WorkHubSpectacle = { sync };
  sync();
})(window);
