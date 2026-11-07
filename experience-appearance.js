/* Account appearance additions. Image pixels stay local; only the chosen colours/icon sync. */
(function (root) {
  'use strict';
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const hex = rgb => '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  const rgb = h =>
    h
      .slice(1)
      .match(/../g)
      .map(v => parseInt(v, 16));
  const mix = (a, b, n) => hex(rgb(a).map((v, i) => v * (1 - n) + rgb(b)[i] * n));
  const luminance = h =>
    rgb(h)
      .map(v => v / 255)
      .map(v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((n, v, i) => n + v * [0.2126, 0.7152, 0.0722][i], 0);
  const contrast = (a, b) =>
    (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
  const ink = bg => (contrast('#172536', bg) >= 4.5 ? '#172536' : '#ffffff');
  const validImage = s =>
    typeof s === 'string' &&
    (s === '' || (s.length <= 65000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(s)));
  function upgrade(p) {
    if (p.loadingStyle === undefined) p.loadingStyle = 'animated';
    if (p.branding === undefined) p.branding = { mode: 'default', initials: 'WH', image: '' };
  }
  function validate(p) {
    const b = p.branding;
    if (
      !['minimal', 'illustrated', 'animated'].includes(p.loadingStyle) ||
      !b ||
      !['default', 'initials', 'logo'].includes(b.mode) ||
      typeof b.initials !== 'string' ||
      !b.initials.trim() ||
      Array.from(b.initials).length > 3 ||
      /[\u0000-\u001f<>]/.test(b.initials) ||
      !validImage(b.image) ||
      (b.mode === 'logo' && !b.image)
    )
      throw Error(
        'Check your website icon and loading style. Initials can contain 1–3 characters.'
      );
  }
  function fields(p) {
    const b = p.branding;
    return `<section class="hub-theme-section ea-section"><span class="hub-kicker">YOUR SIGNATURE</span><h4>Website icon & arrival</h4><p class="hub-meta">Your icon appears in the header and browser tab. Your website name keeps its existing motion.</p><div class="form-grid"><label>Icon style<select name="brandMode">${[
      ['default', 'Original artwork'],
      ['initials', 'My initials'],
      ['logo', 'My logo'],
    ]
      .map(([v, l]) => `<option value="${v}"${v === b.mode ? ' selected' : ''}>${l}</option>`)
      .join(
        ''
      )}</select></label><label>Initials · 1–3 characters<input name="brandInitials" maxlength="6" value="${esc(b.initials)}"></label></div><input type="hidden" name="brandImage" value="${esc(b.image)}"><div class="actions"><button type="button" data-ea="logo">Choose logo</button><button type="button" data-ea="remove-logo">Remove logo</button></div><p class="hub-meta">PNG, JPG or WebP · up to 10 MB. A small square copy is saved; the original stays on your device.</p><input hidden type="file" id="eaLogoFile" accept="image/png,image/jpeg,image/webp"><label>Loading screen<select name="loadingStyle">${[
      ['minimal', 'Minimal · clean and quiet'],
      ['illustrated', 'Illustrated · still artwork'],
      ['animated', 'Animated · moving artwork'],
    ]
      .map(
        ([v, l]) => `<option value="${v}"${v === p.loadingStyle ? ' selected' : ''}>${l}</option>`
      )
      .join(
        ''
      )}</select></label><div class="ea-loading-preview" data-ea-loading="${p.loadingStyle}" aria-label="Loading screen style preview"><span class="ea-loading-art" aria-hidden="true">✧</span><span><small>YOUR WORKSPACE</small><strong data-ea-name>${esc(p.workspace)}</strong><span>Loading your records…</span></span><i aria-hidden="true"></i></div><p class="hub-meta">This is a style preview. The actual loading screen shows real sign-in and record-loading progress.</p></section>`;
  }
  function values(form, p) {
    return {
      loadingStyle: form.elements.loadingStyle?.value || p.loadingStyle,
      branding: {
        mode: form.elements.brandMode?.value || p.branding.mode,
        initials: (form.elements.brandInitials?.value ?? p.branding.initials).trim(),
        image: form.elements.brandImage?.value ?? p.branding.image,
      },
    };
  }
  // Small deterministic histogram: ignore transparent pixels, prefer a distinct chromatic accent.
  function extract(pixels) {
    const bins = new Map();
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 160) continue;
      const r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2],
        k = (r >> 4) * 256 + (g >> 4) * 16 + (b >> 4),
        row = bins.get(k) || [0, 0, 0, 0];
      row[0] += r;
      row[1] += g;
      row[2] += b;
      row[3]++;
      bins.set(k, row);
    }
    if (!bins.size)
      throw Error('This image is transparent. Choose a picture with visible colours.');
    const ranked = [...bins.values()]
        .map(([r, g, b, n]) => ({ rgb: [r / n, g / n, b / n], n }))
        .sort((a, b) => b.n - a.n),
      picks = [];
    for (const row of ranked) {
      if (picks.every(p => p.rgb.reduce((d, v, i) => d + (v - row.rgb[i]) ** 2, 0) > 2200))
        picks.push(row);
      if (picks.length === 6) break;
    }
    const colorful = picks.find(
        p =>
          Math.max(...p.rgb) - Math.min(...p.rgb) > 45 &&
          Math.max(...p.rgb) > 55 &&
          Math.min(...p.rgb) < 220
      ),
      accent = hex((colorful || picks[0]).rgb),
      secondary = hex((picks.find(p => p !== colorful && hex(p.rgb) !== accent) || picks[0]).rgb);
    return {
      swatches: picks.map(p => hex(p.rgb)),
      options: [false, true].map(dark => ({
        name: dark ? 'Evening palette' : 'Daylight palette',
        accent,
        colors: {
          page: mix(accent, dark ? '#111923' : '#ffffff', dark ? 0.88 : 0.96),
          surface: mix(accent, dark ? '#182431' : '#ffffff', dark ? 0.9 : 0.99),
          text: dark ? '#f6f8fc' : '#172536',
          secondary,
        },
      })),
    };
  }
  async function raster(file, size) {
    if (
      !file ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
      file.size > 10000000
    )
      throw Error('Choose a PNG, JPG or WebP below 10 MB.');
    const url = URL.createObjectURL(file),
      image = new Image();
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(Error('This picture could not be read.'));
        image.src = url;
      });
      if (!image.naturalWidth || image.naturalWidth * image.naturalHeight > 40000000)
        throw Error('Choose an image below 40 megapixels.');
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const c = canvas.getContext('2d');
      if (!c) throw Error('Your browser could not read the image. Try another browser.');
      const ratio = Math.min(size / image.naturalWidth, size / image.naturalHeight),
        w = image.naturalWidth * ratio,
        h = image.naturalHeight * ratio;
      c.drawImage(image, (size - w) / 2, (size - h) / 2, w, h);
      return canvas;
    } finally {
      image.src = '';
      URL.revokeObjectURL(url);
    }
  }
  function install(a) {
    let epoch = 0,
      owner = '',
      suggestions = null,
      paletteForm = null,
      signature = '',
      lastTab = '',
      favicon = null,
      original = null;
    const allowed = () =>
      a.cloud().ready && a.can('workspace', 'edit') && a.can('studio.theme', 'edit');
    function valid(token, account, form) {
      return (
        token === epoch &&
        owner === account &&
        a.cloud().ready &&
        a.cloud().user?.id === account &&
        form?.isConnected &&
        allowed()
      );
    }
    function apply(p) {
      const account = a.cloud().ready ? a.cloud().user?.id || '' : '';
      if (owner !== account) {
        epoch++;
        owner = account;
        suggestions = null;
        paletteForm = null;
        signature = '';
      }
      const b = account ? p.branding : { mode: 'default' },
        palette = root.WorkHubAppearance.palette(p, ''),
        accent = palette.accent;
      const next = JSON.stringify([account, b, accent]),
        mark = document.querySelector('.hub-brand-mark');
      if (
        signature !== next ||
        (b.mode !== 'default' && mark && !mark.querySelector('[data-ea-icon]'))
      ) {
        signature = next;
        mark?.querySelector('[data-ea-icon]')?.remove();
        if (mark) {
          mark.classList.toggle('ea-custom-brand', b.mode !== 'default');
          if (b.mode !== 'default') {
            const span = document.createElement('span');
            span.dataset.eaIcon = '';
            span.style.background = accent;
            span.style.color = ink(accent);
            if (b.mode === 'logo' && validImage(b.image)) {
              const img = document.createElement('img');
              img.src = b.image;
              img.alt = '';
              span.append(img);
            } else span.textContent = b.initials;
            mark.append(span);
          }
        }
        if (!favicon) {
          favicon = document.querySelector('link[rel~="icon"]') || document.createElement('link');
          original = favicon.getAttribute('href');
          favicon.rel = 'icon';
          if (!favicon.isConnected) document.head.append(favicon);
        }
        if (b.mode === 'default') {
          if (original) favicon.href = original;
          else favicon.removeAttribute('href');
        } else {
          const initials = esc(b.initials),
            svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="${accent}"/><text x="32" y="34" dominant-baseline="middle" text-anchor="middle" fill="${ink(accent)}" font-family="sans-serif" font-size="${Array.from(b.initials).length > 2 ? 24 : 30}" font-weight="700">${initials}</text></svg>`;
          favicon.href =
            b.mode === 'logo' ? b.image : 'data:image/svg+xml,' + encodeURIComponent(svg);
        }
      }
      const preview = document.querySelector('[data-ea-loading]');
      if (preview) preview.dataset.eaLoading = p.loadingStyle;
      const name = document.querySelector('[data-ea-name]');
      if (name) name.textContent = p.workspace;
    }
    function mount(p) {
      apply(p);
      const active = document.querySelector('#tabs button.active');
      if (active && active.dataset.tab !== lastTab) {
        document
          .querySelectorAll('[data-nav-pop]')
          .forEach(el => el.removeAttribute('data-nav-pop'));
        active.dataset.navPop = '';
        lastTab = active.dataset.tab;
      }
      const form = document.getElementById('hubTheme');
      if (form && !document.getElementById('eaImagePalette')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = 'eaImagePalette';
        button.dataset.ea = 'palette';
        button.textContent = 'Create theme from image';
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/webp';
        input.id = 'eaPaletteFile';
        input.hidden = true;
        form.querySelector('.hub-palette-options')?.after(button, input);
      }
    }
    function change(form) {
      form.elements.brandMode.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-ea]');
      if (!el) return;
      e.preventDefault();
      if (!allowed()) return a.tell('Your account cannot edit appearance.', true);
      const form = document.getElementById('hubTheme');
      if (!form) return;
      if (el.dataset.ea === 'logo') document.getElementById('eaLogoFile')?.click();
      if (el.dataset.ea === 'palette') document.getElementById('eaPaletteFile')?.click();
      if (el.dataset.ea === 'remove-logo') {
        form.elements.brandImage.value = '';
        form.elements.brandMode.value = 'default';
        change(form);
      }
      if (el.dataset.ea === 'use-palette') {
        if (
          paletteForm !== form ||
          !suggestions ||
          !valid(suggestions.token, suggestions.account, form)
        )
          return;
        const p = suggestions.options[Number(el.dataset.index)];
        if (!p) return;
        form.elements.theme.value = 'custom';
        form.elements.accent.value = p.accent;
        for (const [k, v] of Object.entries(p.colors))
          form.elements.namedItem('color-' + k).value = v;
        a.closeModal();
        change(form);
        suggestions = null;
      }
    });
    document.addEventListener('change', e => {
      if (!['eaLogoFile', 'eaPaletteFile'].includes(e.target.id)) return;
      const file = e.target.files?.[0],
        form = document.getElementById('hubTheme'),
        token = ++epoch,
        account = owner,
        logo = e.target.id === 'eaLogoFile';
      e.target.value = '';
      if (!file || !form || !allowed()) return;
      a.tell(logo ? 'Preparing a small website icon…' : 'Finding colours in your picture…');
      void raster(file, logo ? 96 : 96)
        .then(canvas => {
          if (!valid(token, account, form)) return;
          if (logo) {
            const url = canvas.toDataURL('image/png');
            if (!validImage(url)) throw Error('Try a simpler logo. The icon must be below 48 KB.');
            form.elements.brandImage.value = url;
            form.elements.brandMode.value = 'logo';
            change(form);
            a.tell('Icon preview ready. Save theme to keep it.');
          } else {
            suggestions = {
              ...extract(canvas.getContext('2d').getImageData(0, 0, 96, 96).data),
              token,
              account,
            };
            paletteForm = form;
            a.openModal(
              'Colours from your picture',
              `<div class="ea-palette-review"><span class="hub-kicker">LOCAL COLOUR STUDY</span><h3>Make this palette yours.</h3><p>Choose a starting point, preview it across the website, then Save theme. Your image is not uploaded.</p><div class="ea-swatches">${suggestions.swatches.map(c => `<span style="background:${c}" title="${c}"></span>`).join('')}</div><div class="ea-palette-options">${suggestions.options.map((p, i) => `<article style="--ea-page:${p.colors.page};--ea-surface:${p.colors.surface};--ea-ink:${p.colors.text};--ea-accent:${p.accent};--ea-on:${ink(p.accent)}"><small>YOUR WORKSPACE</small><h3>${p.name}</h3><div><strong>A little clarity.</strong><p>One clear task. A little progress.</p><span style="background:${p.accent};color:${ink(p.accent)}">Ready to begin</span></div><button type="button" data-ea="use-palette" data-index="${i}">Preview this palette</button></article>`).join('')}</div></div>`
            );
          }
        })
        .catch(error => {
          if (valid(token, account, form)) a.tell(error.message, true);
        });
    });
    return { mount, apply };
  }
  root.WorkHubExperienceAppearance = {
    upgrade,
    validate,
    fields,
    values,
    extract,
    contrast,
    ink,
    install,
  };
})(window);
