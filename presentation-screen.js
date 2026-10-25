/** User-selected displays only. Never captures a screen or inspects a meeting app. */
(function (root) {
  'use strict';
  const esc = value =>
    String(value ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  function create({ valid = () => true, report = () => {} } = {}) {
    let details = null,
      selected = null,
      generation = 0;
    const available = () => !selected || !!details?.screens.includes(selected);
    function clear() {
      generation++;
      details = null;
      selected = null;
    }
    function markup(id, actionAttribute) {
      const screens = details?.screens || [];
      return `<div class="presentation-screen-picker"><label>Presentation screen<select id="${esc(id)}" data-presentation-screen><option value="current"${!selected ? ' selected' : ''}>Current screen</option>${screens.map((s, i) => `<option value="${i}"${s === selected ? ' selected' : ''}>${esc(s.label || 'Screen ' + (i + 1))}${s.isPrimary ? ' · primary' : ''}</option>`).join('')}</select></label>${root.getScreenDetails ? `<button type="button" ${actionAttribute}>Choose screen…</button>` : ''}<p>${root.getScreenDetails ? 'Choose the same display you share in your meeting app.' : 'Screen selection is unavailable here. Move the presentation window to your shared display, then choose Full screen.'}</p></div>`;
    }
    async function discover() {
      if (!valid() || !root.getScreenDetails) return false;
      const epoch = ++generation;
      try {
        const next = await root.getScreenDetails();
        if (epoch !== generation || !valid()) return false;
        details = next;
        if (!available()) selected = null;
        return true;
      } catch {
        if (epoch === generation && valid())
          report(
            'Screen access was not available. Use Current screen, or move the audience window to your shared display.'
          );
        return false;
      }
    }
    function choose(value) {
      if (!valid()) return;
      selected = value === 'current' ? null : details?.screens[Number(value)] || null;
    }
    async function fullscreen(element) {
      if (!valid()) return false;
      const epoch = generation;
      try {
        if (!available()) throw Error('screen disconnected');
        if (!element?.requestFullscreen) throw Error('fullscreen unavailable');
        await element.requestFullscreen(selected ? { screen: selected } : undefined);
        if (epoch !== generation || !valid()) {
          const doc = element.ownerDocument;
          if (doc?.fullscreenElement === element) await doc.exitFullscreen?.().catch(() => {});
          return false;
        }
        return true;
      } catch {
        if (epoch === generation && valid())
          report(
            !available()
              ? 'The selected screen disconnected. Choose an available screen and try again.'
              : 'Fullscreen was not allowed. Use Full screen in the audience window, or maximise that window on your shared display.'
          );
        return false;
      }
    }
    function features() {
      if (!selected || !available()) return 'popup,width=1280,height=800';
      return `popup,left=${selected.availLeft},top=${selected.availTop},width=${selected.availWidth},height=${selected.availHeight}`;
    }
    function place(window) {
      if (!valid() || !selected || !available()) return;
      try {
        window.moveTo?.(selected.availLeft, selected.availTop);
        window.resizeTo?.(selected.availWidth, selected.availHeight);
      } catch {}
    }
    return { markup, discover, choose, fullscreen, features, place, clear };
  }
  root.WorkHubPresentationScreen = { create };
})(window);
