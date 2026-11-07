/* Repositions the existing living window. Scene, weather, time, visitors and
   settings stay owned by atmosphere.js; positions are local to this account session. */
(function (root) {
  'use strict';
  function install(a) {
    let owner = '',
      generation,
      panel = null,
      position = null,
      drag = null,
      minimised = false;
    const context = () => (a.ready() ? a.owner() : '');
    function paintPosition() {
      if (!panel) return;
      if (!position) {
        panel.style.removeProperty('left');
        panel.style.removeProperty('top');
        panel.style.removeProperty('right');
        return;
      }
      panel.style.left = position.x + 'px';
      panel.style.top = position.y + 'px';
      panel.style.right = 'auto';
    }
    function move(x, y) {
      if (!panel || !a.ready() || owner !== a.owner()) return;
      const rect = panel.getBoundingClientRect(),
        w = rect.width || (minimised ? 222 : 292),
        h = rect.height || (minimised ? 45 : 285);
      position = {
        x: Math.max(12, Math.min(Math.max(12, root.innerWidth - w - 12), x)),
        y: Math.max(12, Math.min(Math.max(12, root.innerHeight - h - 12), y)),
      };
      paintPosition();
    }
    function finish(cancel = false) {
      if (!drag) return;
      const old = drag;
      drag = null;
      try {
        old.handle.releasePointerCapture?.(old.id);
      } catch {}
      if (cancel) {
        position = old.before;
        paintPosition();
      }
    }
    function reset() {
      finish();
      position = null;
      paintPosition();
      fit();
    }
    function fit() {
      if (!panel || panel.hidden || !a.ready()) return;
      if (position) return move(position.x, position.y);
      const rect = panel.getBoundingClientRect();
      if (
        rect.width &&
        rect.height &&
        (rect.left < 12 ||
          rect.top < 12 ||
          rect.right > root.innerWidth - 12 ||
          rect.bottom > root.innerHeight - 12)
      )
        move(rect.left, rect.top);
    }
    function paint() {
      if (!panel) return;
      panel.dataset.minimised = String(minimised);
      panel.querySelector('#whWorldContent').hidden = minimised;
      const toggle = panel.querySelector('[data-world-window="toggle"]');
      toggle.setAttribute('aria-expanded', String(!minimised));
      toggle.setAttribute(
        'aria-label',
        minimised ? 'Expand scenery window' : 'Minimise scenery window'
      );
      toggle.title = minimised ? 'Expand scenery window' : 'Minimise scenery window';
      toggle.textContent = minimised ? '＋' : '−';
      fit();
    }
    function create() {
      panel = document.createElement('aside');
      panel.id = 'whWorldWindow';
      panel.setAttribute('aria-label', 'Scenery window');
      panel.innerHTML =
        '<div class="wh-world-header"><button type="button" class="wh-world-handle" aria-label="Move scenery window. Drag or use arrow keys; Home resets its position." title="Drag to move · arrow keys move · Home resets"><span aria-hidden="true">⠿</span><span>World window</span></button><button type="button" data-world-window="reset" aria-label="Reset scenery window position" title="Reset position">↺</button><button type="button" data-world-window="toggle" aria-controls="whWorldContent"></button></div><div id="whWorldContent"></div>';
      const handle = panel.querySelector('.wh-world-handle');
      handle.addEventListener('pointerdown', event => {
        if (!a.ready() || owner !== a.owner() || event.button !== 0 || event.isPrimary === false)
          return;
        const rect = panel.getBoundingClientRect();
        drag = {
          id: event.pointerId,
          handle,
          x: event.clientX,
          y: event.clientY,
          left: rect.left,
          top: rect.top,
          before: position && { ...position },
        };
        event.preventDefault();
        try {
          handle.setPointerCapture?.(event.pointerId);
        } catch {}
      });
      handle.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        if (!a.ready() || owner !== a.owner() || generation !== a.generation()) {
          finish(true);
          return;
        }
        move(drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
      });
      handle.addEventListener('pointerup', event => {
        if (event.pointerId === drag?.id) finish();
      });
      handle.addEventListener('pointercancel', () => finish(true));
      handle.addEventListener('lostpointercapture', () => finish(true));
      handle.addEventListener('keydown', event => {
        if (event.key === 'Escape' && drag) {
          event.preventDefault();
          event.stopPropagation();
          finish(true);
          return;
        }
        if (
          !a.ready() ||
          owner !== a.owner() ||
          !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (event.key === 'Home') return reset();
        const rect = panel.getBoundingClientRect(),
          n = event.shiftKey ? 40 : 16;
        move(
          rect.left + (event.key === 'ArrowLeft' ? -n : event.key === 'ArrowRight' ? n : 0),
          rect.top + (event.key === 'ArrowUp' ? -n : event.key === 'ArrowDown' ? n : 0)
        );
      });
      panel.querySelector('[data-world-window="reset"]').addEventListener('click', reset);
      panel.querySelector('[data-world-window="toggle"]').addEventListener('click', () => {
        finish();
        minimised = !minimised;
        paint();
      });
      document.body.append(panel);
    }
    function mount() {
      const next = context(),
        epoch = a.generation();
      if (next !== owner || epoch !== generation) {
        finish(true);
        owner = next;
        generation = epoch;
        position = null;
        minimised = root.innerWidth <= 620;
        paintPosition();
        paint();
      }
      if (!next) {
        if (panel) panel.hidden = true;
        return;
      }
      const card = document.getElementById('hubAtmosphereCard');
      if (!card) return;
      if (!panel) create();
      const host = panel.querySelector('#whWorldContent');
      if (card.parentElement !== host) host.append(card);
      panel.hidden = false;
      paint();
    }
    root.addEventListener('resize', () => {
      finish(true);
      fit();
    });
    root.addEventListener('blur', () => finish(true));
    root.addEventListener('pagehide', () => finish(true));
    return { mount, reset };
  }
  root.WorkHubWorldWindow = { install };
})(window);
