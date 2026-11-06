/** Batch C UI. Ticket reads use the current account; images, drafts and downloads stay local. */
(function (root) {
  'use strict';
  const E = root.WorkHubBatchCEngine,
    F = root.WorkHubBatchCFiles;
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const uid = () =>
    root.crypto?.randomUUID?.() ||
    's' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const blank = () => ({
    kind: 'workhub-screenshot-guide',
    version: 1,
    title: '',
    layout: 'walkthrough',
    exportHeading: E.DEFAULT_GUIDE_HEADING,
    footer: E.footer(),
    colours: E.colours(),
    numbering: E.numbering(),
    styles: [],
    linkedInstructions: false,
    steps: [],
  });
  const button = (action, label, extra = '') =>
    '<button type="button" data-bc="' + action + '" ' + extra + '>' + label + '</button>';
  function install(a) {
    let owner = '',
      room = null,
      mode = 'privacy',
      selected = '',
      image = null,
      drag = null,
      pan = null,
      original = false,
      busy = false,
      revision = 0,
      paintFrame = 0,
      loadId = 0,
      removed = null,
      index = null,
      indexed = null,
      ticketForm = null,
      twinTimer = 0,
      trigger = null;
    let guidePreviewTimer = 0,
      guidePreviewJob = 0,
      guidePreviewPage = null,
      guidePreviewRunning = false,
      guidePreviewPending = false,
      guidePreviewView = 'page';
    let projects = { privacy: blank(), guide: blank() },
      histories = new Map(),
      redo = new Map(),
      urls = [],
      tool = 'cover',
      zoom = 1;
    let objectIndex = -1,
      objectRef = null,
      objectListKey = '',
      clipboard = [];
    const project = () => projects[mode],
      step = () => project().steps.find(s => s.id === selected),
      $ = selector => room?.querySelector(selector);
    const nextNumber = () => E.nextNumber(project(), selected),
      clone = value => JSON.parse(JSON.stringify(value)),
      activeObject = () => step()?.marks[objectIndex];
    function objectFields() {
      return (
        '<section class="bc-objects" aria-label="Screenshot objects"><h3>Objects &amp; instructions</h3><label>Object<select data-bc-object><option value="-1">Choose an object</option></select></label><p class="bc-guide-heading-help">Use Select objects, drag to move, or drag a corner to resize. Locked objects can be selected from this list.</p>' +
        '<div class="bc-object-actions">' +
        [
          ['delete-object', 'Delete'],
          ['duplicate-object', 'Duplicate'],
          ['front-object', 'Bring to front'],
          ['back-object', 'Send to back'],
          ['lock-object', 'Lock object'],
          ['copy-object', 'Copy selected'],
          ['copy-all', 'Copy all'],
          ['paste-objects', 'Paste objects'],
        ]
          .map(([id, label]) => button(id, label))
          .join('') +
        '</div>' +
        '<div data-bc-object-properties hidden><div class="bc-object-grid">' +
        [
          ['x', 'Left (%)'],
          ['y', 'Top (%)'],
          ['w', 'Width (%)'],
          ['h', 'Height (%)'],
        ]
          .map(
            ([id, label]) =>
              '<label>' +
              label +
              '<input type="number" min="0" max="100" step="0.1" data-bc-object-' +
              id +
              '></label>'
          )
          .join('') +
        '</div>' +
        '<label>Object colour<input type="color" data-bc-object-color></label><label data-bc-object-size-label>Size / stroke (pixels)<input type="number" min="0.1" step="0.1" data-bc-object-size></label>' +
        '<label data-bc-object-text-label hidden>Text<textarea maxlength="500" rows="3" data-bc-object-text></textarea><small>Resize the box or reduce its text size until the label fits.</small></label><label data-bc-object-number-label hidden>Number<input type="number" min="1" max="999" data-bc-object-number></label><label data-bc-object-instruction-label hidden>Linked instruction<textarea maxlength="300" rows="3" data-bc-object-instruction placeholder="What should the reader do at this marker?"></textarea></label>' +
        '<label data-bc-object-opacity-label hidden>Dim opacity<input type="range" min="10" max="85" data-bc-object-opacity></label>' +
        button('apply-object', 'Apply object changes') +
        '</div>' +
        (mode === 'guide'
          ? '<label class="bc-object-check"><input type="checkbox" data-bc-linked>Include numbered instructions in exports</label><div data-bc-linked-list></div>'
          : '') +
        '<details><summary>Numbering options</summary><label>Sequence<select data-bc-number-mode><option value="screenshot">Restart for each screenshot</option><option value="guide">Continue across screenshots</option></select></label><label>Start at<input type="number" min="1" max="999" data-bc-number-start></label>' +
        button('renumber', 'Renumber existing markers') +
        '</details>' +
        '<details><summary>Saved annotation styles</summary><label>Style<select data-bc-style><option value="">Choose a style</option></select></label><div class="bc-object-actions">' +
        button('apply-style', 'Apply style') +
        button('delete-style', 'Delete style') +
        '</div><label>Style name<input maxlength="40" data-bc-style-name placeholder="e.g. Review highlights"></label>' +
        button('save-style', 'Save current style') +
        '<p class="bc-guide-heading-help">Styles are saved in your editable guide. Applying a style updates the current tool and the selected unlocked object.</p></details></section>'
      );
    }
    function updateObjects() {
      const s = step(),
        marks = s?.marks || [],
        m = activeObject(),
        select = $('[data-bc-object]');
      if (!select) return;
      const key = JSON.stringify(
        marks.map(o => [o.type, o.number, o.text?.slice(0, 28), o.locked])
      );
      if (key !== objectListKey) {
        select.innerHTML =
          '<option value="-1">Choose an object</option>' +
          marks
            .map((o, i) => ({ o, i }))
            .reverse()
            .map(
              ({ o, i }) =>
                '<option value="' +
                i +
                '">' +
                esc(
                  i +
                    1 +
                    '. ' +
                    o.type +
                    (o.type === 'number' ? ' ' + o.number : '') +
                    (o.text ? ' · ' + o.text.slice(0, 28) : '') +
                    (o.locked ? ' · locked' : '')
                ) +
                '</option>'
            )
            .join('');
        objectListKey = key;
      }
      select.value = m ? String(objectIndex) : '-1';
      $('[data-bc-object-properties]').hidden = !m;
      for (const action of [
        'delete-object',
        'duplicate-object',
        'front-object',
        'back-object',
        'apply-object',
      ])
        $('[data-bc="' + action + '"]').disabled = busy || !m || !!m.locked;
      for (const action of ['lock-object', 'copy-object'])
        $('[data-bc="' + action + '"]').disabled = busy || !m;
      $('[data-bc="copy-all"]').disabled = busy || !marks.length;
      $('[data-bc="paste-objects"]').disabled = busy || !s || !clipboard.length;
      $('[data-bc="lock-object"]').textContent = m?.locked ? 'Unlock object' : 'Lock object';
      for (const el of $('[data-bc-object-properties]').querySelectorAll('input,textarea'))
        el.disabled = busy || !m || !!m.locked;
      if (m && objectRef !== m) {
        const b = E.markBounds(m, s.image);
        for (const k of ['x', 'y', 'w', 'h'])
          $('[data-bc-object-' + k + ']').value = (b[k] * 100).toFixed(2);
        $('[data-bc-object-color]').value = m.color;
        $('[data-bc-object-size]').max = s.image.width * 0.2;
        $('[data-bc-object-size]').value = (m.size * s.image.width).toFixed(2);
        $('[data-bc-object-text]').value = m.text || '';
        $('[data-bc-object-number]').value = m.number || 1;
        $('[data-bc-object-instruction]').value = m.instruction || '';
        $('[data-bc-object-opacity]').value = Math.round((m.opacity || 0.55) * 100);
        for (const input of $('[data-bc-object-properties]').querySelectorAll('input,textarea'))
          input.dataset.current = input.value;
      }
      objectRef = m || null;
      for (const [part, show] of [
        ['text', ['text', 'callout'].includes(m?.type)],
        ['number', m?.type === 'number'],
        ['instruction', m?.type === 'number'],
        ['opacity', m?.type === 'spotlight'],
      ])
        $('[data-bc-object-' + part + '-label]').hidden = !show;
      $('[data-bc-object-size-label]').hidden = m?.type === 'spotlight';
      if (mode === 'guide') {
        $('[data-bc-linked]').checked = project().linkedInstructions;
        const list = $('[data-bc-linked-list]'),
          key = String(project().linkedInstructions) + '|' + revision + '|' + selected;
        if (list.dataset.key !== key) {
          list.dataset.key = key;
          $('[data-bc-linked-list]').innerHTML = project().linkedInstructions
            ? marks
                .map((o, i) => ({ o, i }))
                .filter(x => x.o.type === 'number' && x.o.instruction?.trim())
                .sort((a, b) => a.o.number - b.o.number)
                .map(
                  ({ o, i }) =>
                    '<p>' +
                    button(
                      'choose-object',
                      esc(o.number + '. ' + o.instruction),
                      'data-index="' + i + '"'
                    ) +
                    '</p>'
                )
                .join('')
            : '';
        }
      }
      $('[data-bc-number-mode]').value = project().numbering.mode;
      if (document.activeElement !== $('[data-bc-number-start]'))
        $('[data-bc-number-start]').value = project().numbering.start;
      const styles = $('[data-bc-style]'),
        styleKey = JSON.stringify(project().styles);
      if (styles.dataset.key !== styleKey) {
        const value = styles.value;
        styles.innerHTML =
          '<option value="">Choose a style</option>' +
          project()
            .styles.map((s, i) => '<option value="' + i + '">' + esc(s.name) + '</option>')
            .join('');
        styles.dataset.key = styleKey;
        styles.value = value;
      }
    }
    function commitMarks(marks, index = objectIndex) {
      const s = step();
      if (!s) return;
      const checked = E.guide({
        ...project(),
        steps: project().steps.map(t => (t === s ? { ...t, marks } : t)),
      }).steps.find(t => t.id === s.id);
      remember();
      s.marks = checked.marks;
      objectIndex = index;
      objectRef = null;
      original = false;
      changed();
      paint();
    }
    function chooseObject(index) {
      objectIndex = step()?.marks[index] ? index : -1;
      objectRef = null;
      tool = 'object';
      original = false;
      drag = null;
      paint();
    }
    function applyObject() {
      const m = activeObject(),
        s = step();
      if (!m || m.locked) return;
      const b = Object.fromEntries(
        ['x', 'y', 'w', 'h'].map(k => [k, +$('[data-bc-object-' + k + ']').value / 100])
      );
      const edited = key => {
        const input = $('[data-bc-object-' + key + ']');
        return input.value !== input.dataset.current;
      };
      let next = ['x', 'y', 'w', 'h'].some(edited) ? E.transformMark(m, s.image, b) : { ...m };
      next.color = $('[data-bc-object-color]').value;
      if (edited('size')) next.size = +$('[data-bc-object-size]').value / s.image.width;
      if (['text', 'callout'].includes(m.type)) next.text = $('[data-bc-object-text]').value;
      if (m.type === 'number') {
        next.number = +$('[data-bc-object-number]').value;
        next.instruction = $('[data-bc-object-instruction]').value;
      }
      if (m.type === 'spotlight' && edited('opacity'))
        next.opacity = +$('[data-bc-object-opacity]').value / 100;
      commitMarks(s.marks.map((o, i) => (i === objectIndex ? next : o)));
    }
    function editObject(action) {
      const s = step(),
        m = activeObject();
      if (!s) return;
      if (action === 'copy-all' || action === 'copy-object') {
        clipboard = clone(action === 'copy-all' ? s.marks : m ? [m] : []);
        controls();
        status(
          clipboard.length + ' objects copied. Select another screenshot and choose Paste objects.'
        );
        return;
      }
      if (action === 'paste-objects') {
        let number = nextNumber();
        const additions = clipboard.map(o => ({
          ...clone(o),
          locked: false,
          ...(o.type === 'number' ? { number: number++ } : {}),
        }));
        commitMarks([...s.marks, ...additions], s.marks.length);
        return;
      }
      if (!m) return;
      if (action === 'lock-object') {
        commitMarks(s.marks.map((o, i) => (i === objectIndex ? { ...o, locked: !o.locked } : o)));
        return;
      }
      if (m.locked) throw Error('Unlock this object before changing it.');
      if (action === 'delete-object') {
        commitMarks(
          s.marks.filter((_, i) => i !== objectIndex),
          -1
        );
        return;
      }
      if (action === 'duplicate-object') {
        const copy = E.moveMark(clone(m), s.image, 0.02, 0.02);
        if (copy.type === 'number') copy.number = nextNumber();
        commitMarks([...s.marks, copy], s.marks.length);
        return;
      }
      if (['front-object', 'back-object'].includes(action)) {
        const list = s.marks.filter((_, i) => i !== objectIndex);
        if (action === 'front-object') list.push(m);
        else list.unshift(m);
        commitMarks(list, action === 'front-object' ? list.length - 1 : 0);
      }
    }
    function saveStyle() {
      const style = {
          name: $('[data-bc-style-name]').value.trim(),
          color: $('[data-bc-color]').value,
          stroke: +$('[data-bc-size]').value,
          marker: +$('[data-bc-marker-size]').value,
          text: +$('[data-bc-text-size]').value,
          opacity: +$('[data-bc-dim-opacity]').value / 100,
        },
        existing = project().styles.filter(s => s.name !== style.name);
      project().styles = E.styles([...existing, style]);
      changed();
      controls();
      status('Annotation style saved with this editable guide.');
    }
    function applyStyle() {
      const style = project().styles[+$('[data-bc-style]').value];
      if (!style || $('[data-bc-style]').value === '') return;
      for (const [key, value] of [
        ['color', style.color],
        ['size', style.stroke],
        ['marker-size', style.marker],
        ['text-size', style.text],
        ['dim-opacity', style.opacity * 100],
      ])
        $('[data-bc-' + key + ']').value = value;
      const m = activeObject(),
        s = step();
      if (m && !m.locked) {
        const size =
          (m.type === 'number'
            ? style.marker
            : ['text', 'callout'].includes(m.type)
              ? style.text
              : ['rectangle', 'ellipse', 'arrow', 'inset'].includes(m.type)
                ? style.stroke / 4
                : style.stroke) / s.image.width;
        commitMarks(
          s.marks.map((o, i) =>
            i === objectIndex
              ? {
                  ...o,
                  color: style.color,
                  size: Math.min(0.2, size),
                  ...(o.type === 'spotlight' ? { opacity: style.opacity } : {}),
                }
              : o
          )
        );
      }
      status(
        'Style applied to the current tool' + (m && !m.locked ? ' and selected object.' : '.')
      );
    }
    function brandingFields() {
      const f = project().footer,
        c = project().colours;
      return (
        '<details class="bc-branding"><summary>Live preview, export colours, footer logo &amp; watermark</summary>' +
        '<div class="bc-branding-content"><div class="bc-branding-grid"><fieldset><legend>Export colours</legend>' +
        '<label>Colour preset<select data-bc-palette>' +
        Object.entries(E.GUIDE_PALETTES)
          .map(([id, p]) => '<option value="' + id + '">' + esc(p.label) + '</option>')
          .join('') +
        '<option value="custom">Custom</option></select></label><div class="bc-colour-fields">' +
        '<label>Accent colour<input type="color" data-bc-accent value="' +
        esc(c.accent) +
        '"></label>' +
        '<label>Page background<input type="color" data-bc-paper value="' +
        esc(c.paper) +
        '"></label></div>' +
        '<p class="bc-guide-heading-help">Applied to every PDF, JPG and PNG guide page. Text adjusts for readability; logo colours stay unchanged.</p></fieldset>' +
        '<fieldset><legend>Footer logo &amp; watermark</legend><div class="bc-logo-controls">' +
        '<label class="bc-file-label secondary">Choose transparent logo<input type="file" data-bc-logo accept="image/png,image/webp"></label>' +
        button('remove-logo', 'Remove logo', f.logo ? '' : 'hidden') +
        '</div>' +
        '<div class="bc-logo-preview" data-bc-footer-preview-box hidden><img data-bc-footer-preview alt="Footer logo transparency preview"></div>' +
        '<p class="bc-guide-heading-help">Transparent PNG or WebP, up to 2 MB. Transparency is preserved; existing image backgrounds are kept.</p>' +
        '<label>Footer text<input data-bc-footer-text maxlength="120" placeholder="Optional team, company or document note" value="' +
        esc(f.text) +
        '"></label>' +
        '<div class="bc-footer-options"><label>Footer alignment<select data-bc-footer-align>' +
        ['left', 'center', 'right']
          .map(
            x =>
              '<option value="' +
              x +
              '"' +
              (f.align === x ? ' selected' : '') +
              '>' +
              x[0].toUpperCase() +
              x.slice(1) +
              '</option>'
          )
          .join('') +
        '</select></label><label>Size preset<select data-bc-footer-size>' +
        [
          [100, 'Small'],
          [180, 'Medium'],
          [260, 'Large'],
        ]
          .map(
            ([v, name]) =>
              '<option value="' +
              v +
              '"' +
              (f.size === v ? ' selected' : '') +
              '>' +
              name +
              '</option>'
          )
          .join('') +
        '<option value="custom">Custom width</option></select></label></div>' +
        '<div class="bc-logo-placement">' +
        [
          ['width', 'Logo width'],
          ['x', 'Horizontal position'],
          ['y', 'Vertical position'],
        ]
          .map(
            ([key, label]) =>
              '<label>' +
              label +
              ' <span data-bc-logo-' +
              key +
              '-value></span><input type="range" data-needs-logo data-bc-logo-' +
              key +
              ' min="' +
              (key === 'width' ? '0.1' : '0') +
              '" max="100" step="0.1"></label>'
          )
          .join('') +
        '<p class="bc-guide-heading-help" data-bc-logo-dimensions></p>' +
        button('reset-logo-layout', 'Reset logo placement', 'data-needs-logo') +
        '<p class="bc-guide-heading-help">Move left/right or up/down within the footer. Aspect ratio is preserved; captions stay clear of the logo.</p></div>' +
        '<label>Footer opacity <span data-bc-footer-opacity-value></span>' +
        '<input type="range" data-bc-footer-opacity min="5" max="100" value="' +
        Math.round(f.opacity * 100) +
        '"></label>' +
        '<p class="bc-guide-heading-help">Lower opacity creates a faint footer watermark. No background box is added. Footer space is reserved above page numbering.</p>' +
        '</fieldset></div><section class="bc-guide-preview" aria-label="Live export preview"><div class="bc-guide-preview-head"><div><h3>Live export preview</h3>' +
        '<p class="bc-guide-heading-help">First exported page. Changes update automatically.</p></div><div class="bc-preview-views" role="group" aria-label="Preview view">' +
        button('preview-page', 'Full page', 'aria-pressed="true"') +
        button('preview-footer', 'Footer close-up', 'aria-pressed="false"') +
        button('refresh-preview', 'Refresh preview', 'data-needs-steps') +
        '</div></div>' +
        '<p data-bc-preview-status role="status" aria-live="polite">Add a screenshot to preview your guide.</p>' +
        '<div class="bc-page-sheet" data-bc-page-sheet hidden><canvas data-bc-page-preview role="img" aria-label="Preview of the first exported guide page"></canvas></div></section></div></details>'
      );
    }
    function updateBranding() {
      if (mode !== 'guide' || !room) return;
      const f = project().footer,
        c = project().colours,
        preview = $('[data-bc-footer-preview]');
      const preset = Object.entries(E.GUIDE_PALETTES).find(
        ([, p]) => p.accent === c.accent && p.paper === c.paper
      );
      $('[data-bc-layout]').value = project().layout;
      $('[data-bc-layout-help]').textContent =
        E.GUIDE_LAYOUTS[project().layout]?.description ||
        'Original one-step-per-page layout. Choose a new layout to redesign this guide.';
      $('[data-bc-palette]').value = preset?.[0] || 'custom';
      $('[data-bc-accent]').value = c.accent;
      $('[data-bc-paper]').value = c.paper;
      $('[data-bc-footer-opacity-value]').textContent = Math.round(f.opacity * 100) + '%';
      $('[data-bc="remove-logo"]').hidden = !f.logo;
      $('[data-bc-footer-preview-box]').hidden = !f.logo;
      if (f.logo) {
        if (preview.getAttribute('src') !== f.logo.src) preview.src = f.logo.src;
        preview.style.opacity = f.opacity;
      } else preview.removeAttribute('src');
      const layout = E.logoLayout(f);
      $('[data-bc-footer-size]').value = f.widthPct === undefined ? String(f.size) : 'custom';
      $('[data-bc-footer-align]').value = f.align;
      for (const [key, value] of [
        ['width', layout?.widthPct || 0],
        ['x', layout?.xPct || 0],
        ['y', layout?.yPct || 0],
      ]) {
        const input = $('[data-bc-logo-' + key + ']');
        if (key === 'width') {
          input.max = layout?.maxWidthPct || 100;
          input.min = Math.min(0.1, layout?.maxWidthPct || 0.1);
        }
        input.value = value;
        $('[data-bc-logo-' + key + '-value]').textContent = value.toFixed(1) + '%';
        input.disabled = busy || !f.logo;
      }
      $('[data-bc-logo-dimensions]').textContent = layout
        ? 'Printed logo: ' +
          ((layout.width * 210) / 1240).toFixed(1) +
          ' × ' +
          ((layout.height * 210) / 1240).toFixed(1) +
          ' mm at A4 page width.'
        : 'Add a logo to adjust its size and position.';
    }
    function cancelGuidePreview() {
      clearTimeout(guidePreviewTimer);
      guidePreviewTimer = 0;
      guidePreviewJob++;
      guidePreviewPending = false;
      if (guidePreviewPage) F.release(guidePreviewPage);
      guidePreviewPage = null;
    }
    function paintGuidePreview() {
      const canvas = $('[data-bc-page-preview]'),
        sheet = $('[data-bc-page-sheet]');
      if (!canvas || !sheet) return;
      $('[data-bc="preview-page"]').setAttribute(
        'aria-pressed',
        String(guidePreviewView === 'page')
      );
      $('[data-bc="preview-footer"]').setAttribute(
        'aria-pressed',
        String(guidePreviewView === 'footer')
      );
      if (!guidePreviewPage) return;
      const top = guidePreviewView === 'footer' ? Math.max(0, guidePreviewPage.height - 414) : 0,
        height = guidePreviewPage.height - top;
      canvas.width = 620;
      canvas.height = Math.round(height / 2);
      canvas
        .getContext('2d')
        .drawImage(
          guidePreviewPage,
          0,
          top,
          guidePreviewPage.width,
          height,
          0,
          0,
          canvas.width,
          canvas.height
        );
      sheet.hidden = false;
      sheet.dataset.view = guidePreviewView;
      canvas.setAttribute(
        'aria-label',
        guidePreviewView === 'footer'
          ? 'Footer close-up of the first exported page'
          : 'First exported guide page'
      );
      $('[data-bc="preview-page"]').setAttribute(
        'aria-pressed',
        String(guidePreviewView === 'page')
      );
      $('[data-bc="preview-footer"]').setAttribute(
        'aria-pressed',
        String(guidePreviewView === 'footer')
      );
    }
    function scheduleGuidePreview(delay = 200) {
      clearTimeout(guidePreviewTimer);
      guidePreviewJob++;
      if (mode !== 'guide' || !room?.querySelector('.bc-branding')?.open) return;
      if (project().steps.length) {
        $('[data-bc-preview-status]').textContent = 'Updating preview…';
        guidePreviewTimer = setTimeout(() => {
          void renderGuidePreview();
        }, delay);
      } else {
        if (guidePreviewPage) F.release(guidePreviewPage);
        guidePreviewPage = null;
        $('[data-bc-page-sheet]').hidden = true;
        $('[data-bc-preview-status]').textContent = 'Add a screenshot to preview your guide.';
      }
    }
    async function renderGuidePreview() {
      clearTimeout(guidePreviewTimer);
      guidePreviewTimer = 0;
      if (guidePreviewRunning) {
        guidePreviewPending = true;
        return;
      }
      if (mode !== 'guide' || !room?.querySelector('.bc-branding')?.open || !project().steps.length)
        return;
      const dialog = room,
        current = owner,
        version = revision,
        job = guidePreviewJob,
        alive = () =>
          room === dialog &&
          a.ready() &&
          a.owner() === current &&
          mode === 'guide' &&
          revision === version &&
          guidePreviewJob === job;
      let page;
      guidePreviewRunning = true;
      try {
        const snapshot = E.guide(project());
        page = await F.preview(snapshot, alive);
        if (!alive()) return;
        if (guidePreviewPage) F.release(guidePreviewPage);
        guidePreviewPage = page;
        page = null;
        paintGuidePreview();
        $('[data-bc-preview-status]').textContent =
          (E.GUIDE_LAYOUTS[snapshot.layout]?.label || 'Original layout') +
          ' preview ready. Full exports include all steps and continuation pages.';
      } catch (err) {
        if (alive())
          $('[data-bc-preview-status]').textContent = 'Preview unavailable: ' + err.message;
      } finally {
        if (page) F.release(page);
        guidePreviewRunning = false;
        if (guidePreviewPending) {
          guidePreviewPending = false;
          scheduleGuidePreview(0);
        }
      }
    }
    async function addLogo(file) {
      guard();
      if (busy || mode !== 'guide' || !file) return;
      const dialog = room,
        current = owner,
        version = revision,
        job = ++loadId,
        alive = () =>
          room === dialog &&
          a.ready() &&
          a.owner() === current &&
          mode === 'guide' &&
          version === revision &&
          job === loadId;
      setBusy(true);
      status('Preparing your logo locally…');
      try {
        const logo = await F.logoFromFile(file, alive);
        if (!alive()) return;
        projects.guide = E.guide({ ...project(), footer: { ...project().footer, logo } });
        changed();
        updateBranding();
        status('Logo ready. Prepare the guide to include your footer.');
      } catch (err) {
        if (alive()) throw err;
      } finally {
        if (room === dialog) setBusy(false);
      }
    }
    function clearUrls() {
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
      $('[data-bc-ready]')?.replaceChildren();
    }
    function changed() {
      revision++;
      clearUrls();
      scheduleGuidePreview();
    }
    function close() {
      if (paintFrame) root.cancelAnimationFrame(paintFrame);
      paintFrame = 0;
      loadId++;
      changed();
      cancelGuidePreview();
      drag = null;
      pan = null;
      image = null;
      busy = false;
      if (room) {
        room.close();
        room.remove();
        room = null;
      }
      document.body.classList.remove('bc-room-open');
      trigger?.isConnected && trigger.focus({ preventScroll: true });
    }
    function sync() {
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        close();
        owner = next;
        projects = { privacy: blank(), guide: blank() };
        histories.clear();
        redo.clear();
        clipboard = [];
        objectIndex = -1;
        objectRef = null;
        objectListKey = '';
        removed = null;
        index = indexed = ticketForm = null;
        clearTimeout(twinTimer);
        document.querySelectorAll('.bc-twins').forEach(el => el.remove());
      }
    }
    function guard() {
      sync();
      if (!owner) throw Error('Sign in to use your workspace tools.');
    }
    function status(text, error = false) {
      const el = $('[data-bc-status]');
      if (el) {
        el.textContent = text;
        el.classList.toggle('is-error', error);
      }
    }
    function setBusy(value) {
      busy = value;
      if (!room) return;
      room.setAttribute('aria-busy', String(value));
      for (const el of room.querySelectorAll('input,textarea,select,button'))
        el.disabled = value && el.dataset.bc !== 'close';
      if (!value) controls();
    }
    function cards() {
      return (
        '<section class="bc-launch"><div><span class="bc-eyebrow">MAKE IT CLEAR. MAKE IT SHAREABLE.</span><h3>A little studio for your screenshots.</h3><p>Prepare a clean image or turn a collection into a useful walkthrough. Files stay on your device.</p></div><div class="bc-launch-grid"><article><span class="bc-launch-icon" aria-hidden="true">▧</span><h3>Screenshot privacy</h3><p>Cover private details, crop the frame and add an arrow. Download a flattened PNG.</p>' +
        button('privacy', 'Open privacy editor ↗') +
        '</article><article><span class="bc-launch-icon" aria-hidden="true">▤</span><h3>Screenshot guide builder</h3><p>Arrange numbered steps, write captions, customise the export heading and prepare a PDF, JPG or PNG page collection.</p>' +
        button('guide', 'Build a screenshot guide ↗') +
        '</article></div><p class="bc-local-note">Local editing · No AI · No image uploads or database storage. Save an editable guide file to continue on another day.</p></section>'
      );
    }
    function preview(t) {
      return (
        '<div class="bc-twin-meta"><span>' +
        esc(t.status || 'No status') +
        '</span><span>Owner · ' +
        esc(t.pic || 'Unassigned') +
        '</span></div><p class="bc-twin-description hub-sensitive">' +
        esc(t.description) +
        '</p><details><summary>Read saved update & details</summary><dl><dt>Latest update</dt><dd class="hub-sensitive">' +
        esc(a.latestHistory?.(t) || t.history || 'No recorded update.') +
        '</dd><dt>Recorded history / solution notes</dt><dd class="hub-sensitive">' +
        esc(t.history || 'No recorded solution yet.') +
        '</dd><dt>Reference</dt><dd class="hub-sensitive">' +
        esc(
          [t.jira, t.object, t.action, t.transport].filter(Boolean).join(' · ') ||
            'No reference recorded'
        ) +
        '</dd></dl></details>'
      );
    }
    function paintTwins(form) {
      sync();
      const panel = form.querySelector('.bc-twins');
      if (
        !owner ||
        !form.isConnected ||
        form !== ticketForm ||
        form.dataset.bcOwner !== owner ||
        !panel
      )
        return;
      panel.hidden = document.body.matches('.hub-private,.hub-present');
      if (panel.hidden) return;
      const tickets = a.state().tickets;
      if (indexed !== tickets) {
        indexed = tickets;
        index = E.ticketIndex(tickets);
      }
      const description = form.elements.namedItem('description').value,
        ticket = form.elements.namedItem('ticket').value,
        rows = E.twins(index, { id: form.dataset.id, description, ticket });
      panel.querySelector('[data-bc-twin-results]').innerHTML = rows
        .map(
          r =>
            '<article><h4 class="hub-sensitive">' +
            esc(r.ticket.ticket) +
            '</h4>' +
            preview(r.ticket) +
            '<p class="bc-match-reason">' +
            esc(
              r.sameId
                ? 'Same ticket identifier'
                : r.sameDescription
                  ? 'Same description'
                  : 'Shared terms: ' + r.shared.join(', ')
            ) +
            '</p></article>'
        )
        .join('');
      panel.querySelector('[data-bc-twin-count]').textContent = rows.length
        ? rows.length + ' possible match' + (rows.length === 1 ? '' : 'es')
        : E.tokens(description).length
          ? 'No similar saved tickets found. Try more specific error text or codes.'
          : 'Enter a description or ticket identifier to look for earlier cases.';
    }
    function decorateModal() {
      sync();
      if (!owner) return;
      const form = document.querySelector('#editForm[data-group="tickets"]');
      if (form && !form.querySelector('.bc-twins')) {
        ticketForm = form;
        form.dataset.bcOwner = owner;
        const panel = document.createElement('aside');
        panel.className = 'bc-twins';
        panel.innerHTML =
          '<span class="bc-eyebrow">BEFORE YOU INVESTIGATE AGAIN</span><h3>Similar past tickets</h3><p>Matches use saved descriptions and history. Read the earlier case to decide whether it is related.</p><p data-bc-twin-count role="status" aria-live="polite"></p><div data-bc-twin-results></div>';
        form.querySelector('.ticket-editor-section')?.after(panel);
        if (!panel.isConnected) form.append(panel);
        form.addEventListener('input', event => {
          if (!['description', 'ticket'].includes(event.target.name)) return;
          clearTimeout(twinTimer);
          twinTimer = setTimeout(() => paintTwins(form), 180);
        });
        paintTwins(form);
      } else if (form) {
        ticketForm = form;
        paintTwins(form);
      }
      const target = document.querySelector('.ticket-detail-tools');
      if (target && !target.querySelector('[data-bc]'))
        target.insertAdjacentHTML(
          'beforeend',
          button('privacy', '▧ Prepare screenshot for sharing', 'class="small"')
        );
    }
    function controls() {
      const s = step();
      if (!room) return;
      for (const el of room.querySelectorAll('[data-needs-logo]'))
        el.disabled = busy || !project().footer.logo;
      for (const el of room.querySelectorAll('[data-needs-steps]'))
        el.disabled = busy || !project().steps.length;
      $('[data-bc="undo"]').disabled = !s || !histories.get(s.id)?.length;
      $('[data-bc="redo"]').disabled = !s || !redo.get(s.id)?.length;
      for (const el of room.querySelectorAll('[data-needs-image]')) el.disabled = !s || !image;
      const restore = $('[data-bc="undo-remove"]'),
        up = $('[data-bc="up"]'),
        down = $('[data-bc="down"]');
      if (restore) restore.hidden = !removed || mode !== 'guide';
      if (up) up.disabled = !s || project().steps.indexOf(s) === 0;
      if (down) down.disabled = !s || project().steps.indexOf(s) === project().steps.length - 1;
      $('[data-bc-count]').textContent =
        project().steps.length + (mode === 'privacy' ? ' screenshot' : ' / 24 steps');
      $('[data-bc-empty]').hidden = !!s;
      $('[data-bc-canvas]').hidden = !s;
      $('[data-bc="compare"]').setAttribute('aria-pressed', String(original));
      $('[data-bc="compare"]').textContent = original
        ? 'Return to edited image'
        : 'Compare original';
      for (const el of room.querySelectorAll('[data-bc-tool]'))
        el.setAttribute('aria-pressed', String(el.dataset.bcTool === tool));
      $('[data-bc-brush-control]').hidden = [
        'number',
        'object',
        'text',
        'callout',
        'spotlight',
      ].includes(tool);
      $('[data-bc-number-control]').hidden = tool !== 'number';
      $('[data-bc-next-number]').hidden = tool !== 'number';
      $('[data-bc-next-number]').textContent = 'Next number: ' + nextNumber();
      $('[data-bc-size-label]').textContent = ['rectangle', 'ellipse', 'inset'].includes(tool)
        ? 'Border thickness'
        : 'Brush size';
      $('[data-bc-new-text-control]').hidden = !['text', 'callout'].includes(tool);
      $('[data-bc-text-size-control]').hidden = !['text', 'callout'].includes(tool);
      $('[data-bc-dim-control]').hidden = tool !== 'spotlight';
      $('[data-bc-canvas]').style.touchAction = tool === 'move' ? 'auto' : 'none';
      $('[data-bc-canvas]').style.cursor =
        tool === 'move' ? 'grab' : tool === 'object' ? 'move' : 'crosshair';
      updateObjects();
    }
    function thumbs() {
      $('[data-bc-steps]').innerHTML = project()
        .steps.map(
          (s, i) =>
            '<button type="button" data-bc="select" data-id="' +
            esc(s.id) +
            '" draggable="true" aria-pressed="' +
            (s.id === selected) +
            '"><span>' +
            String(i + 1).padStart(2, '0') +
            '</span><strong>' +
            esc(s.title || 'Untitled step') +
            '</strong></button>'
        )
        .join('');
    }
    function paint() {
      const s = step(),
        c = $('[data-bc-canvas]');
      if (!s || !image || !c) {
        controls();
        return;
      }
      const preview =
        drag?.kind === 'object'
          ? { ...s, marks: s.marks.map((m, i) => (i === drag.index ? drag.mark : m)) }
          : drag && drag.kind !== 'crop'
            ? {
                ...s,
                marks: [
                  ...s.marks,
                  drag.kind === 'inset' ? { ...drag.mark, type: 'rectangle' } : drag.mark,
                ],
              }
            : s;
      F.draw(c, preview, image, original);
      const crop = drag?.kind === 'crop' ? E.bounds(drag.mark.points) : s.crop;
      if (crop && !original) {
        const ctx = c.getContext('2d'),
          x = crop.x * c.width,
          y = crop.y * c.height,
          w = crop.w * c.width,
          h = crop.h * c.height;
        ctx.fillStyle = '#102c3680';
        ctx.fillRect(0, 0, c.width, y);
        ctx.fillRect(0, y + h, c.width, c.height - y - h);
        ctx.fillRect(0, y, x, h);
        ctx.fillRect(x + w, y, c.width - x - w, h);
        ctx.strokeStyle = '#e4b54f';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, w, h);
      }
      if (tool === 'object' && !original && preview.marks[objectIndex]) {
        const b = E.markBounds(preview.marks[objectIndex], s.image),
          ctx = c.getContext('2d'),
          size = 6 / Math.max(0.1, zoom);
        ctx.save();
        ctx.strokeStyle = '#245e9a';
        ctx.fillStyle = '#ffffff';
        ctx.lineWidth = 2 / Math.max(0.1, zoom);
        ctx.setLineDash?.([6 / zoom, 4 / zoom]);
        ctx.strokeRect(b.x * c.width, b.y * c.height, b.w * c.width, b.h * c.height);
        ctx.setLineDash?.([]);
        if (!preview.marks[objectIndex].locked)
          for (const [x, y] of [
            [b.x, b.y],
            [b.x + b.w, b.y],
            [b.x, b.y + b.h],
            [b.x + b.w, b.y + b.h],
          ]) {
            ctx.fillRect(x * c.width - size / 2, y * c.height - size / 2, size, size);
            ctx.strokeRect(x * c.width - size / 2, y * c.height - size / 2, size, size);
          }
        ctx.restore();
      }
      c.style.width = Math.round(s.image.width * zoom) + 'px';
      c.style.height = 'auto';
      controls();
    }
    function fit() {
      const s = step();
      if (!s) return;
      const viewport = $('[data-bc-viewport]');
      zoom = Math.min(
        1,
        Math.max(
          0.1,
          Math.min(
            ((viewport.clientWidth || root.innerWidth - 360) - 48) / s.image.width,
            ((viewport.clientHeight || root.innerHeight * 0.52) - 48) / s.image.height
          )
        )
      );
      $('[data-bc-zoom]').value = Math.round(zoom * 100);
      paint();
    }
    async function select(id) {
      selected = id;
      objectIndex = -1;
      objectRef = null;
      objectListKey = '';
      original = false;
      image = null;
      drag = null;
      const s = step(),
        job = ++loadId,
        current = owner;
      thumbs();
      controls();
      if (!s) return;
      $('[data-bc-step-title]').value = s.title;
      $('[data-bc-caption]').value = s.caption;
      const alive = () => !!room && job === loadId && a.ready() && current === a.owner();
      status('Opening screenshot…');
      try {
        const img = await F.loadImage(s.image, alive);
        if (!alive()) return;
        image = img;
        fit();
        status('Solid cover replaces pixels in the exported image. Blur softens details.');
      } catch (err) {
        if (alive()) status(err.message, true);
      }
    }
    function remember() {
      const s = step();
      if (!s) return;
      const history = histories.get(s.id) || [];
      history.push({ marks: s.marks, crop: s.crop });
      histories.set(s.id, history.slice(-30));
      redo.set(s.id, []);
    }
    function undoEdit(forward) {
      const s = step();
      if (!s) return;
      const from = forward ? redo : histories,
        to = forward ? histories : redo,
        list = from.get(s.id) || [],
        state = list.pop();
      if (!state) return;
      const target = to.get(s.id) || [];
      target.push({ marks: s.marks, crop: s.crop });
      to.set(s.id, target);
      s.marks = state.marks;
      s.crop = state.crop;
      changed();
      paint();
    }
    async function add(files) {
      guard();
      if (busy) return;
      const list = [...files];
      if (!list.length) return;
      if (
        (mode === 'privacy' && list.length !== 1) ||
        (mode === 'guide' && project().steps.length + list.length > 24)
      )
        throw Error(
          mode === 'privacy'
            ? 'Choose one screenshot for the privacy editor.'
            : 'A guide can contain up to 24 steps.'
        );
      const current = owner,
        currentMode = mode,
        target = project(),
        job = ++loadId,
        alive = () =>
          !!room && a.ready() && current === a.owner() && currentMode === mode && job === loadId;
      setBusy(true);
      status('Preparing screenshots locally…');
      try {
        const additions = [];
        for (const file of list) {
          const img = await F.imageFromFile(file, alive);
          if (!alive()) return;
          additions.push({
            id: uid(),
            title: file.name.replace(/\.[^.]+$/, '').slice(0, 180),
            caption: '',
            image: img,
            marks: [],
            crop: null,
          });
        }
        const next = E.guide({
          ...target,
          steps: mode === 'privacy' ? additions : [...target.steps, ...additions],
        });
        projects[mode] = next;
        if (mode === 'privacy') {
          histories.clear();
          redo.clear();
        }
        changed();
        await select(additions[0].id);
      } finally {
        if (alive()) setBusy(false);
        else if (room && current === owner) setBusy(false);
      }
    }
    function link(file, filename, label) {
      const url = URL.createObjectURL(file);
      urls.push(url);
      const el = document.createElement('a');
      el.href = url;
      el.download = filename;
      el.className = 'bc-download';
      el.textContent = label;
      $('[data-bc-ready]').append(el);
    }
    async function prepare(format) {
      guard();
      if (busy) return;
      const snapshot = E.guide(project()),
        current = owner,
        version = revision,
        dialog = room;
      if (!snapshot.steps.length) throw Error('Add a screenshot first.');
      const alive = () =>
        room === dialog && a.ready() && a.owner() === current && version === revision;
      clearUrls();
      setBusy(true);
      status(format === 'editable' ? 'Preparing editable file…' : 'Preparing your clean export…');
      try {
        if (format === 'editable')
          link(
            new Blob([JSON.stringify(snapshot)], { type: 'application/json' }),
            E.filename(snapshot.title) + '.workhub-guide.json',
            'Download editable guide'
          );
        else {
          const kind = mode === 'privacy' ? 'png' : format,
            file = await F.export(snapshot, kind, alive);
          if (!alive()) return;
          link(
            file,
            E.filename(snapshot.title || snapshot.steps[0].title) +
              (kind === 'images' || kind === 'jpg-images'
                ? '-pages.zip'
                : kind === 'pdf-zip'
                  ? '.pdf.zip'
                  : '.' + kind),
            kind === 'jpg-images'
              ? 'Download JPG pages ZIP'
              : kind === 'images'
                ? 'Download PNG pages ZIP'
                : kind === 'pdf-zip'
                  ? 'Download PDF ZIP'
                  : kind === 'png'
                    ? 'Download edited PNG'
                    : 'Download guide PDF'
          );
        }
        status(
          format === 'editable'
            ? 'Editable files include original screenshots and annotations. Use PDF / JPG / PNG for sharing.'
            : 'Ready. Select the download link to save your exported file.'
        );
      } finally {
        if (room === dialog) setBusy(false);
      }
    }
    async function importGuide(file) {
      guard();
      if (busy || !file) return;
      if (file.size > 24 * 1024 * 1024) throw Error('Choose a WorkHub guide file up to 24 MB.');
      const current = owner,
        job = ++loadId,
        dialog = room,
        alive = () => room === dialog && a.ready() && current === a.owner() && job === loadId;
      setBusy(true);
      status('Checking the editable guide…');
      try {
        const text = await file.text();
        if (!alive()) return;
        let data;
        try {
          data = E.guide(JSON.parse(text));
        } catch (err) {
          throw Error('Guide could not be opened: ' + err.message);
        }
        for (const s of data.steps) {
          await F.loadImage(s.image, alive);
          if (!alive()) return;
        }
        if (data.footer.logo) {
          await F.loadImage(data.footer.logo, alive, 1600, 600);
          if (!alive()) return;
        }
        projects.guide = data;
        mode = 'guide';
        histories.clear();
        redo.clear();
        removed = null;
        changed();
        close();
        open('guide');
      } finally {
        if (room === dialog) setBusy(false);
      }
    }
    function move(id, next) {
      const rows = project().steps,
        i = rows.findIndex(s => s.id === id);
      if (i < 0 || next < 0 || next >= rows.length || i === next) return;
      rows.splice(next, 0, rows.splice(i, 1)[0]);
      changed();
      thumbs();
      controls();
    }
    function open(value) {
      guard();
      if (room) close();
      trigger = document.activeElement;
      mode = value === 'guide' ? 'guide' : 'privacy';
      tool = 'cover';
      original = false;
      removed = null;
      room = document.createElement('dialog');
      room.id = 'batchCRoom';
      room.className = 'bc-room';
      room.dataset.owner = owner;
      room.setAttribute('aria-labelledby', 'bcRoomTitle');
      const guideMode = mode === 'guide';
      room.innerHTML =
        '<div class="bc-shell"><header class="bc-header"><div><span class="bc-eyebrow">WORKHUB / SCREENSHOT STUDIO</span><h2 id="bcRoomTitle">' +
        (guideMode ? 'Show it. Step by step.' : 'A clear image. Ready to share.') +
        '</h2><p>' +
        (guideMode
          ? 'Arrange your screenshots, explain each step and prepare a guide.'
          : 'Cover private details and keep the useful part in view.') +
        '</p></div>' +
        button('close', 'Close editor ✕') +
        '</header><div class="bc-file-bar"><label class="bc-file-label">' +
        (guideMode ? '+ Add screenshots' : 'Open / replace screenshot') +
        '<input type="file" data-bc-files accept="image/png,image/jpeg,image/webp"' +
        (guideMode ? ' multiple' : '') +
        '></label>' +
        (guideMode
          ? '<label class="bc-file-label secondary">Open editable guide<input type="file" data-bc-project accept=".json,application/json"></label>'
          : '') +
        '<span data-bc-count></span><span class="bc-local-badge">LOCAL FILES · NO UPLOADS</span></div>' +
        (guideMode
          ? '<div class="bc-guide-fields"><label class="bc-guide-name">Guide title<input data-bc-title maxlength="180" placeholder="e.g. How to submit a support request" value="' +
            esc(project().title) +
            '"></label><div><label class="bc-guide-name">Export heading<input data-bc-export-heading maxlength="180" aria-describedby="bcExportHeadingHelp" placeholder="e.g. MY COMPANY / USER GUIDE" value="' +
            esc(project().exportHeading) +
            '"></label><p id="bcExportHeadingHelp" class="bc-guide-heading-help">Shown at the top of every PDF, JPG and PNG page. Leave blank to hide. Saved with your editable guide.</p></div></div>' +
            '<div class="bc-guide-layout"><label class="bc-guide-name">Export layout<select data-bc-layout aria-describedby="bcLayoutHelp">' +
            (project().layout === 'classic'
              ? '<option value="classic">Original layout (saved guide)</option>'
              : '') +
            Object.entries(E.GUIDE_LAYOUTS)
              .map(
                ([id, layout]) => '<option value="' + id + '">' + esc(layout.label) + '</option>'
              )
              .join('') +
            '</select></label><p id="bcLayoutHelp" data-bc-layout-help class="bc-guide-heading-help"></p></div>' +
            brandingFields()
          : '') +
        '<nav class="bc-step-strip" data-bc-steps aria-label="Guide steps"' +
        (guideMode ? '' : ' hidden') +
        '></nav><div class="bc-layout"><main class="bc-editor"><div class="bc-toolbar" role="group" aria-label="Screenshot editing tools">' +
        [
          ['cover', '▰ Solid cover'],
          ['brush', '✎ Cover brush'],
          ['blur', '▧ Blur'],
          ['arrow', '↗ Arrow'],
          ['number', '① Numbers'],
          ['rectangle', '□ Rectangle outline'],
          ['crop', '⌗ Crop'],
          ['move', '✥ Move'],
          ['object', 'Select objects'],
          ['ellipse', '○ Oval outline'],
          ['text', 'Text label'],
          ['callout', 'Callout bubble'],
          ['spotlight', 'Spotlight'],
          ['inset', 'Zoom detail'],
        ]
          .map(
            ([id, name]) =>
              '<button type="button" data-bc-tool="' +
              id +
              '" aria-pressed="' +
              (id === tool) +
              '">' +
              name +
              '</button>'
          )
          .join('') +
        '</div><div class="bc-tool-options"><label>Colour<input type="color" data-bc-color value="#183b35"></label><label data-bc-brush-control><span data-bc-size-label>Brush size</span><input type="range" data-bc-size min="2" max="80" value="24" aria-label="Brush or border thickness"></label>' +
        '<label data-bc-number-control hidden>Marker size<input type="range" data-bc-marker-size min="16" max="160" value="60" aria-label="Number marker size"></label><span data-bc-next-number hidden></span>' +
        '<label data-bc-new-text-control hidden>Label text<input data-bc-new-text maxlength="500" placeholder="Type your label before drawing"></label><label data-bc-text-size-control hidden>Text size<input type="range" data-bc-text-size min="10" max="120" value="24"></label><label data-bc-dim-control hidden>Dim opacity<input type="range" data-bc-dim-opacity min="10" max="85" value="55"></label>' +
        button('undo', 'Undo') +
        button('redo', 'Redo') +
        button('reset', 'Reset edits', 'data-needs-image') +
        '</div><div class="bc-viewport" data-bc-viewport><div class="bc-empty" data-bc-empty><span aria-hidden="true">▧</span><h3>Drop a screenshot here.</h3><p>Or choose a file above. On desktop, you can paste an image.</p><small>PNG, JPEG or WebP · 8 MB / 12 MP per image</small></div><canvas data-bc-canvas tabindex="0" aria-label="Screenshot editing canvas. Choose a tool, then drag to edit." hidden></canvas></div><div class="bc-view-options">' +
        button('compare', 'Compare original', 'data-needs-image aria-pressed="false"') +
        button('fit', 'Fit image', 'data-needs-image') +
        '<label>Zoom<input type="range" data-bc-zoom min="10" max="200" value="100" aria-label="Image zoom"></label></div></main><aside class="bc-step-details"><span class="bc-eyebrow">' +
        (guideMode ? 'THE WORDS THAT HELP' : 'YOUR SHARING CHECK') +
        '</span><h3>' +
        (guideMode ? 'Explain this step.' : 'Keep the detail you need.') +
        '</h3><label>Step title<input data-bc-step-title maxlength="180" placeholder="Give this step a clear name" data-needs-image></label><label>Caption<textarea data-bc-caption maxlength="8000" rows="6" placeholder="What should the reader do or notice?" data-needs-image></textarea></label>' +
        objectFields() +
        (guideMode
          ? '<div class="bc-step-actions">' +
            button('up', '↑ Move step up') +
            button('down', '↓ Move step down') +
            button('remove', 'Remove step', 'data-needs-image') +
            button('undo-remove', 'Undo remove', 'hidden') +
            '</div>'
          : '<p>Solid cover replaces selected pixels in the exported PNG. Use Compare original to review what changed.</p>' +
            button('to-guide', 'Add edited image to a guide ↗', 'data-needs-image')) +
        '<p class="bc-draft-note">Drafts stay in this tab while signed in. Save an editable guide file to continue later. Editable files retain original images; exported PDF / JPG / PNG files contain your finished edits.</p></aside></div><footer class="bc-footer"><div class="bc-export-actions">' +
        (guideMode
          ? '<label>Export format<select data-bc-format><option value="pdf">PDF guide</option><option value="jpg-images">JPG pages in ZIP</option><option value="images">PNG pages in ZIP</option><option value="pdf-zip">PDF in ZIP</option></select></label>'
          : '') +
        button('export', guideMode ? 'Prepare guide' : 'Prepare edited PNG', 'class="bc-primary"') +
        button('editable', 'Save editable guide') +
        '</div><div data-bc-ready class="bc-ready"></div><p data-bc-status role="status" aria-live="polite">Images and edits stay local to this browser. No records are changed.</p></footer></div>';
      room.addEventListener('cancel', event => {
        event.preventDefault();
        close();
      });
      room.addEventListener('dragover', event => {
        event.preventDefault();
      });
      room.addEventListener('drop', event => {
        event.preventDefault();
        if (busy) return;
        const dragged = event.dataTransfer.getData('application/x-workhub-guide-step');
        if (dragged) {
          let data;
          try {
            data = JSON.parse(dragged);
          } catch {
            return;
          }
          const target = event.target.closest('[data-bc="select"]');
          if (data.owner === owner && data.mode === mode && target)
            move(
              data.id,
              project().steps.findIndex(s => s.id === target.dataset.id)
            );
        } else if (event.dataTransfer.files.length)
          void add(event.dataTransfer.files).catch(err => status(err.message, true));
      });
      room.addEventListener('dragstart', event => {
        const el = event.target.closest('[data-bc="select"]');
        if (el && !busy)
          event.dataTransfer.setData(
            'application/x-workhub-guide-step',
            JSON.stringify({ owner, mode, id: el.dataset.id })
          );
      });
      room.addEventListener('paste', event => {
        if (busy || event.target.matches('input,textarea')) return;
        const files = [...(event.clipboardData?.items || [])]
          .filter(i => i.kind === 'file')
          .map(i => i.getAsFile())
          .filter(Boolean);
        if (files.length) {
          event.preventDefault();
          void add(files).catch(err => status(err.message, true));
        }
      });
      room.addEventListener('change', event => {
        if (busy) return;
        const el = event.target;
        if (el.matches('[data-bc-object]')) chooseObject(+el.value);
        if (el.matches('[data-bc-number-mode],[data-bc-number-start]')) {
          try {
            project().numbering = E.numbering({
              mode: $('[data-bc-number-mode]').value,
              start: +$('[data-bc-number-start]').value,
            });
            changed();
            controls();
          } catch (err) {
            status(err.message, true);
            controls();
          }
        }
        if (el.matches('[data-bc-linked]')) {
          project().linkedInstructions = el.checked;
          changed();
          controls();
        }
        if (el.matches('[data-bc-layout]')) {
          project().layout = el.value;
          guidePreviewView = 'page';
          room.querySelector('.bc-branding').open = true;
          changed();
          updateBranding();
          paintGuidePreview();
        }
        if (el.matches('[data-bc-logo]')) {
          void addLogo(el.files[0]).catch(err => status(err.message, true));
          el.value = '';
        }
        if (el.matches('[data-bc-palette]') && E.GUIDE_PALETTES[el.value]) {
          project().colours = E.colours(E.GUIDE_PALETTES[el.value]);
          changed();
          updateBranding();
        }
        if (el.matches('[data-bc-footer-align],[data-bc-footer-size]')) {
          const f = project().footer;
          if (el.matches('[data-bc-footer-align]')) {
            f.align = el.value;
            delete f.xPct;
          } else if (el.value === 'custom') f.widthPct = E.logoLayout(f)?.widthPct || 10;
          else {
            f.size = +el.value;
            delete f.widthPct;
          }
          changed();
          updateBranding();
        }
        if (event.target.matches('[data-bc-files]')) {
          void add(event.target.files).catch(err => status(err.message, true));
          event.target.value = '';
        }
        if (event.target.matches('[data-bc-project]')) {
          void importGuide(event.target.files[0]).catch(err => status(err.message, true));
          event.target.value = '';
        }
      });
      room.addEventListener('input', event => {
        if (busy) return;
        const el = event.target,
          s = step();
        if (el.matches('[data-bc-title]')) {
          project().title = el.value;
          changed();
        }
        if (el.matches('[data-bc-export-heading]')) {
          project().exportHeading = el.value;
          changed();
        }
        if (el.matches('[data-bc-footer-text],[data-bc-footer-opacity]')) {
          project().footer[el.matches('[data-bc-footer-text]') ? 'text' : 'opacity'] = el.matches(
            '[data-bc-footer-opacity]'
          )
            ? +el.value / 100
            : el.value;
          changed();
          updateBranding();
        }
        for (const [key, field] of [
          ['width', 'widthPct'],
          ['x', 'xPct'],
          ['y', 'yPct'],
        ])
          if (el.matches('[data-bc-logo-' + key + ']')) {
            project().footer[field] = +el.value;
            changed();
            updateBranding();
          }
        if (el.matches('[data-bc-accent],[data-bc-paper]')) {
          project().colours[el.matches('[data-bc-accent]') ? 'accent' : 'paper'] = el.value;
          changed();
          updateBranding();
        }
        if (s && el.matches('[data-bc-step-title],[data-bc-caption]')) {
          s[el.matches('[data-bc-caption]') ? 'caption' : 'title'] = el.value;
          changed();
          thumbs();
        }
        if (el.matches('[data-bc-zoom]')) {
          zoom = +el.value / 100;
          paint();
        }
      });
      const c = $('[data-bc-canvas]'),
        point = event => {
          const r = c.getBoundingClientRect();
          return [
            Math.max(0, Math.min(1, (event.clientX - r.left) / r.width)),
            Math.max(0, Math.min(1, (event.clientY - r.top) / r.height)),
          ];
        };
      function moveObjectGesture(p) {
        if (drag?.kind !== 'object') return;
        const { base, origin, box, handle } = drag,
          s = step();
        if (!handle) drag.mark = E.moveMark(base, s.image, p[0] - origin[0], p[1] - origin[1]);
        else {
          let left = box.x,
            top = box.y,
            right = box.x + box.w,
            bottom = box.y + box.h;
          if (handle.includes('w')) left = Math.max(0, Math.min(right - 1 / s.image.width, p[0]));
          if (handle.includes('e')) right = Math.min(1, Math.max(left + 1 / s.image.width, p[0]));
          if (handle.includes('n')) top = Math.max(0, Math.min(bottom - 1 / s.image.height, p[1]));
          if (handle.includes('s')) bottom = Math.min(1, Math.max(top + 1 / s.image.height, p[1]));
          drag.mark = E.transformMark(base, s.image, {
            x: left,
            y: top,
            w: right - left,
            h: bottom - top,
          });
        }
      }
      c.addEventListener('pointerdown', event => {
        if (
          !busy &&
          image &&
          tool === 'move' &&
          event.button === 0 &&
          event.isPrimary &&
          event.pointerType !== 'touch'
        ) {
          const view = $('[data-bc-viewport]');
          pan = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            left: view.scrollLeft,
            top: view.scrollTop,
          };
          event.preventDefault();
          c.setPointerCapture(event.pointerId);
          return;
        }
        if (busy || !step() || !image || tool === 'move' || event.button !== 0 || !event.isPrimary)
          return;
        event.preventDefault();
        original = false;
        const p = point(event);
        if (tool === 'object') {
          const s = step(),
            m = activeObject(),
            r = c.getBoundingClientRect(),
            tolerance = event.pointerType === 'touch' ? 14 : 8;
          let handle = '';
          if (m && !m.locked) {
            const b = E.markBounds(m, s.image);
            for (const [name, x, y] of [
              ['nw', b.x, b.y],
              ['ne', b.x + b.w, b.y],
              ['sw', b.x, b.y + b.h],
              ['se', b.x + b.w, b.y + b.h],
            ])
              if (
                Math.abs(p[0] - x) <= tolerance / r.width &&
                Math.abs(p[1] - y) <= tolerance / r.height
              ) {
                handle = name;
                break;
              }
          }
          if (!handle)
            objectIndex =
              s.marks
                .map((o, i) => ({ o, i }))
                .reverse()
                .find(({ o }) => !o.locked && E.hitMark(o, s.image, p, 4 / r.width))?.i ?? -1;
          objectRef = null;
          const target = activeObject();
          if (target && !target.locked) {
            drag = {
              kind: 'object',
              pointerId: event.pointerId,
              index: objectIndex,
              base: target,
              mark: clone(target),
              origin: p,
              box: E.markBounds(target, s.image),
              handle,
            };
            c.setPointerCapture(event.pointerId);
          }
          paint();
          return;
        }
        if (['text', 'callout'].includes(tool) && !$('[data-bc-new-text]').value.trim()) {
          status('Type your label text, then draw a box for it.', true);
          return;
        }
        if (tool === 'number' && nextNumber() > 999) {
          status(
            'This screenshot has reached number 999. Undo or reset markers to continue.',
            true
          );
          return;
        }
        drag = {
          pointerId: event.pointerId,
          kind: tool,
          mark: {
            type: tool,
            color: $('[data-bc-color]').value,
            size: Math.min(
              0.2,
              +$(
                tool === 'number'
                  ? '[data-bc-marker-size]'
                  : ['text', 'callout'].includes(tool)
                    ? '[data-bc-text-size]'
                    : '[data-bc-size]'
              ).value /
                (['arrow', 'rectangle', 'ellipse', 'inset'].includes(tool) ? 4 : 1) /
                step().image.width
            ),
            points: [p, p],
            ...(tool === 'number' ? { number: nextNumber() } : {}),
            ...(['text', 'callout'].includes(tool)
              ? { text: $('[data-bc-new-text]').value.trim() }
              : {}),
            ...(tool === 'spotlight' ? { opacity: +$('[data-bc-dim-opacity]').value / 100 } : {}),
          },
        };
        c.setPointerCapture(event.pointerId);
        paint();
      });
      c.addEventListener('pointermove', event => {
        if (pan && pan.id === event.pointerId) {
          const view = $('[data-bc-viewport]');
          view.scrollLeft = pan.left + pan.x - event.clientX;
          view.scrollTop = pan.top + pan.y - event.clientY;
          return;
        }
        if (!drag || drag.pointerId !== event.pointerId) return;
        const p = point(event);
        if (drag.kind === 'object') moveObjectGesture(p);
        else if (drag.kind === 'number') drag.mark.points = [p, p];
        else if (drag.kind === 'brush') {
          if (drag.mark.points.length < E.LIMITS.points) drag.mark.points.push(p);
        } else drag.mark.points[1] = p;
        if (!paintFrame)
          paintFrame = root.requestAnimationFrame(() => {
            paintFrame = 0;
            if (room) paint();
          });
      });
      c.addEventListener('pointerup', event => {
        if (pan && pan.id === event.pointerId) {
          pan = null;
          return;
        }
        if (!drag || drag.pointerId !== event.pointerId) return;
        if (drag.kind === 'object') {
          moveObjectGesture(point(event));
          const gesture = drag;
          drag = null;
          if (
            step()?.marks[gesture.index] === gesture.base &&
            JSON.stringify(gesture.mark) !== JSON.stringify(gesture.base)
          ) {
            try {
              commitMarks(
                step().marks.map((m, i) => (i === gesture.index ? gesture.mark : m)),
                gesture.index
              );
            } catch (err) {
              status(err.message, true);
            }
          }
          paint();
          return;
        }
        if (drag.kind === 'number') drag.mark.points = [point(event), point(event)];
        else if (drag.kind === 'brush')
          drag.mark.points[drag.mark.points.length - 1] = point(event);
        else drag.mark.points[1] = point(event);
        const gesture = drag,
          area = E.bounds(gesture.mark.points),
          s = step();
        drag = null;
        if (s && ['text', 'callout'].includes(gesture.kind) && (!area.w || !area.h)) {
          const x = Math.min(0.65, gesture.mark.points[0][0]),
            y = Math.min(0.78, gesture.mark.points[0][1]);
          gesture.mark.points = [
            [x, y],
            [x + 0.35, y + 0.2],
          ];
        }
        if (s && gesture.kind === 'inset' && area.w && area.h) {
          const scale = Math.min(2, 0.45 / area.w, 0.4 / area.h);
          if (scale <= 1) {
            status(
              'Choose a smaller area for a zoom detail (less than 45% width and 40% height).',
              true
            );
            paint();
            return;
          }
          const w = area.w * scale,
            h = area.h * scale,
            x = area.x < 0.5 ? 1 - w - 0.02 : 0.02,
            y = area.y < 0.5 ? 1 - h - 0.02 : 0.02;
          gesture.mark.source = area;
          gesture.mark.points = [
            [x, y],
            [x + w, y + h],
          ];
        }
        if (
          s &&
          (['brush', 'number', 'text', 'callout'].includes(gesture.kind) ||
            area.w * s.image.width >= 3 ||
            area.h * s.image.height >= 3)
        ) {
          if (
            ['crop', 'rectangle', 'ellipse', 'spotlight', 'inset'].includes(gesture.kind) &&
            (!area.w || !area.h)
          ) {
            paint();
            return;
          }
          if (s.marks.length >= E.LIMITS.marks) {
            status(
              'This screenshot has 200 annotations. Reset some edits or start from the exported PNG.',
              true
            );
            paint();
            return;
          }
          if (gesture.kind === 'crop') {
            remember();
            s.crop = area;
            changed();
          } else
            try {
              commitMarks([...s.marks, gesture.mark], s.marks.length);
            } catch (err) {
              status(err.message, true);
            }
        }
        paint();
      });
      c.addEventListener('pointercancel', () => {
        pan = null;
        drag = null;
        paint();
      });
      room.addEventListener('keydown', event => {
        if (
          !busy &&
          activeObject() &&
          !event.target.matches('input,textarea,select') &&
          !event.target.isContentEditable
        ) {
          if (['Delete', 'Backspace'].includes(event.key)) {
            event.preventDefault();
            try {
              editObject('delete-object');
            } catch (err) {
              status(err.message, true);
            }
            return;
          }
          if (
            ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) &&
            !activeObject().locked
          ) {
            event.preventDefault();
            const amount = event.shiftKey ? 10 : 1,
              s = step(),
              dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0,
              dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
            commitMarks(
              s.marks.map((m, i) =>
                i === objectIndex
                  ? E.moveMark(m, s.image, dx / s.image.width, dy / s.image.height)
                  : m
              )
            );
            return;
          }
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 'z' &&
          !event.target.matches('input,textarea,select') &&
          !busy
        ) {
          event.preventDefault();
          undoEdit(event.shiftKey);
        }
      });
      document.body.append(room);
      room.querySelector('.bc-branding')?.addEventListener('toggle', event => {
        if (event.target.open) scheduleGuidePreview(0);
        else cancelGuidePreview();
      });
      document.body.classList.add('bc-room-open');
      room.showModal();
      updateBranding();
      thumbs();
      controls();
      void select(project().steps[0]?.id || '');
    }
    async function handle(el) {
      guard();
      const action = el.dataset.bc;
      if (action === 'privacy' || action === 'guide') {
        open(action);
        return;
      }
      if (!room) return;
      if (action === 'close') {
        close();
        return;
      }
      if (busy) return;
      const s = step();
      if (action === 'choose-object') {
        chooseObject(+el.dataset.index);
        return;
      }
      if (action === 'apply-object') {
        applyObject();
        return;
      }
      if (
        [
          'delete-object',
          'duplicate-object',
          'front-object',
          'back-object',
          'lock-object',
          'copy-object',
          'copy-all',
          'paste-objects',
        ].includes(action)
      ) {
        editObject(action);
        return;
      }
      if (action === 'save-style') {
        saveStyle();
        return;
      }
      if (action === 'apply-style') {
        applyStyle();
        return;
      }
      if (action === 'delete-style') {
        const value = $('[data-bc-style]').value;
        if (value !== '') {
          project().styles = project().styles.filter((_, i) => i !== +value);
          changed();
          controls();
        }
        return;
      }
      if (action === 'renumber') {
        const next = E.renumber(project(), selected);
        for (const old of project().steps) {
          const changedStep = next.steps.find(t => t.id === old.id);
          if (JSON.stringify(old.marks) !== JSON.stringify(changedStep.marks)) {
            const history = histories.get(old.id) || [];
            history.push({ marks: old.marks, crop: old.crop });
            histories.set(old.id, history.slice(-30));
            redo.set(old.id, []);
          }
        }
        projects[mode] = next;
        objectRef = null;
        changed();
        paint();
        status('Markers renumbered. Undo is available on each affected screenshot.');
        return;
      }
      if (action === 'refresh-preview') {
        scheduleGuidePreview(0);
        return;
      }
      if (action === 'preview-page' || action === 'preview-footer') {
        guidePreviewView = action === 'preview-page' ? 'page' : 'footer';
        paintGuidePreview();
        return;
      }
      if (action === 'reset-logo-layout') {
        const f = project().footer;
        f.size = 180;
        f.align = 'center';
        delete f.widthPct;
        delete f.xPct;
        delete f.yPct;
        changed();
        updateBranding();
      }
      if (action === 'remove-logo') {
        project().footer.logo = null;
        changed();
        updateBranding();
      }
      if (action === 'select') await select(el.dataset.id);
      if (action === 'undo' || action === 'redo') undoEdit(action === 'redo');
      if (action === 'compare') {
        original = !original;
        paint();
      }
      if (action === 'fit') fit();
      if (action === 'reset' && s) {
        remember();
        s.marks = [];
        s.crop = null;
        changed();
        paint();
      }
      if (action === 'up' || action === 'down')
        move(selected, project().steps.indexOf(s) + (action === 'up' ? -1 : 1));
      if (action === 'remove' && s) {
        removed = { step: s, index: project().steps.indexOf(s) };
        project().steps = project().steps.filter(x => x !== s);
        changed();
        await select(
          project().steps[Math.min(removed.index, project().steps.length - 1)]?.id || ''
        );
      }
      if (action === 'undo-remove' && removed) {
        if (project().steps.length >= 24) throw Error('Remove a step before restoring this one.');
        project().steps.splice(removed.index, 0, removed.step);
        const id = removed.step.id;
        removed = null;
        changed();
        await select(id);
      }
      if (action === 'export')
        await prepare(mode === 'privacy' ? 'png' : $('[data-bc-format]').value);
      if (action === 'editable') await prepare('editable');
      if (action === 'to-guide' && s) {
        const current = owner,
          dialog = room,
          alive = () => room === dialog && a.ready() && a.owner() === current;
        setBusy(true);
        try {
          const c = await F.raster(s, alive);
          try {
            if (!alive()) return;
            const item = {
              id: uid(),
              title: s.title,
              caption: s.caption,
              image: { src: c.toDataURL('image/png'), width: c.width, height: c.height },
              marks: [],
              crop: null,
            };
            const next = E.guide({ ...projects.guide, steps: [...projects.guide.steps, item] });
            projects.guide = next;
            close();
            open('guide');
            void select(item.id);
          } finally {
            F.release(c);
          }
        } finally {
          if (room === dialog) setBusy(false);
        }
      }
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-bc],[data-bc-tool]');
      if (!el) return;
      event.preventDefault();
      if (el.hasAttribute('data-bc-tool')) {
        if (!busy) {
          tool = el.dataset.bcTool;
          drag = null;
          pan = null;
          original = false;
          paint();
          controls();
          if (tool === 'number')
            status(
              'Click to place numbered markers. Use Numbering options for the starting number and sequence. Add a linked instruction in Objects & instructions.'
            );
          if (tool === 'rectangle')
            status(
              'Drag a rectangle around the area to highlight. Colour and Border thickness control its outline; the centre stays transparent.'
            );
          if (tool === 'object')
            status(
              'Select an object to move it, drag a corner to resize, or edit its properties. Arrow keys nudge; Delete removes an unlocked selection.'
            );
          if (tool === 'inset')
            status(
              'Drag a small area to magnify. A zoom detail box is created opposite it; use Select objects to move or resize the box. Privacy covers and blur remain applied.'
            );
          if (['text', 'callout'].includes(tool))
            status(
              'Type Label text, then draw a box or click to place it. Use Select objects to edit its text and size.'
            );
        }
      } else
        void handle(el).catch(err => {
          if (room) status(err.message, true);
          else a.tell(err.message, true);
        });
    });
    root.addEventListener('pagehide', () => {
      close();
      projects = { privacy: blank(), guide: blank() };
      histories.clear();
      redo.clear();
      clipboard = [];
    });
    return {
      cards,
      decorateModal,
      sync,
      open,
      close,
      add,
      addLogo,
      preview: renderGuidePreview,
      select,
      prepare,
      importGuide,
      handle,
    };
  }
  root.WorkHubBatchC = { install };
})(window);
