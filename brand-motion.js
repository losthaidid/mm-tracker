/** Small, continuously animated SVG identity; no images, timers or account writes. */
(function (root) {
  'use strict';
  let activate = () => {};
  function mount(brand, title, home) {
    if (!brand || !title) return;
    activate = home;
    const mark = brand.querySelector('.hub-brand-mark');
    if (mark && !mark.dataset.epicBrand) {
      mark.dataset.epicBrand = 'true';
      mark.setAttribute('role', 'button');
      mark.tabIndex = 0;
      mark.setAttribute('aria-label', 'Go to My day');
      mark.title = 'My day · touch a little starlight';
      mark.innerHTML =
        '<svg class="brand-cosmos" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle class="brand-halo" cx="32" cy="32" r="27"/><g class="brand-orbit brand-orbit-one"><ellipse cx="32" cy="32" rx="28" ry="14" transform="rotate(-35 32 32)"/><circle class="brand-satellite" cx="55" cy="18" r="3"/></g><g class="brand-orbit brand-orbit-two"><ellipse cx="32" cy="32" rx="26" ry="20" transform="rotate(40 32 32)"/><circle class="brand-satellite brand-satellite-gold" cx="13" cy="14" r="2"/></g><g class="brand-star-core"><path d="M32 14 37 27 50 32 37 37 32 50 27 37 14 32 27 27Z"/><path class="brand-star-heart" d="m32 23 2.5 6.5L41 32l-6.5 2.5L32 41l-2.5-6.5L23 32l6.5-2.5Z"/></g><g class="brand-twinkles"><path d="M11 33v6m-3-3h6m37 6v7m-3.5-3.5h7M45 8v5m-2.5-2.5h5"/></g></svg><span class="brand-click-ring"></span>';
    }
    const name = title.dataset.brandTitle || title.textContent;
    if (!title.querySelector('[data-brand-home]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.brandHome = '';
      button.setAttribute('aria-label', name + ' · Go to My day');
      button.title = 'Go to My day';
      const letters = document.createElement('span');
      letters.className = 'brand-title-letters';
      letters.setAttribute('aria-hidden', 'true');
      for (const [i, c] of Array.from(name).entries()) {
        const span = document.createElement('span');
        span.textContent = c;
        span.style.setProperty('--brand-letter', String(i % 24));
        letters.append(span);
      }
      button.append(letters);
      title.replaceChildren(button);
    }
  }
  function energise(target) {
    const brand = target.closest('.hub-header-brand');
    if (!brand) return;
    brand.classList.remove('brand-energised');
    // Restart a finite CSS burst without rebuilding the header or changing its layout.
    void brand.offsetWidth;
    brand.classList.add('brand-energised');
    activate();
  }
  document.addEventListener('click', e => {
    const target = e.target.closest?.('[data-epic-brand],[data-brand-home]');
    if (target) energise(target);
  });
  document.addEventListener('keydown', e => {
    const target = e.target.closest?.('[data-epic-brand]');
    if (target && ['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      energise(target);
    }
  });
  document.addEventListener('animationend', e => {
    if (e.animationName === 'brand-click-burst')
      e.target.closest('.hub-header-brand')?.classList.remove('brand-energised');
  });
  document.addEventListener('visibilitychange', () =>
    document.documentElement.classList.toggle('brand-page-hidden', document.hidden)
  );
  root.WorkHubBrandMotion = { mount };
})(window);
