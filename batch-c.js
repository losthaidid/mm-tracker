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
  const blank = () => ({ kind: 'workhub-screenshot-guide', version: 1, title: '', steps: [] });
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
    let projects = { privacy: blank(), guide: blank() },
      histories = new Map(),
      redo = new Map(),
      urls = [],
      tool = 'cover',
      zoom = 1;
    const project = () => projects[mode],
      step = () => project().steps.find(s => s.id === selected),
      $ = selector => room?.querySelector(selector);
    function clearUrls() {
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
      $('[data-bc-ready]')?.replaceChildren();
    }
    function changed() {
      revision++;
      clearUrls();
    }
    function close() {
      if (paintFrame) root.cancelAnimationFrame(paintFrame);
      paintFrame = 0;
      loadId++;
      changed();
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
        '</article><article><span class="bc-launch-icon" aria-hidden="true">▤</span><h3>Screenshot guide builder</h3><p>Arrange numbered steps, write captions and export a polished PDF or PNG page collection.</p>' +
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
      $('[data-bc-canvas]').style.touchAction = tool === 'move' ? 'auto' : 'none';
      $('[data-bc-canvas]').style.cursor = tool === 'move' ? 'grab' : 'crosshair';
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
      F.draw(
        c,
        drag && drag.kind !== 'crop' ? { ...s, marks: [...s.marks, drag.mark] } : s,
        image,
        original
      );
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
              (kind === 'images' ? '-pages.zip' : kind === 'pdf-zip' ? '.pdf.zip' : '.' + kind),
            kind === 'images'
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
            ? 'Editable files include original screenshots and annotations. Use PDF / PNG for sharing.'
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
          ? '<label class="bc-guide-name">Guide title<input data-bc-title maxlength="180" placeholder="e.g. How to submit a support request" value="' +
            esc(project().title) +
            '"></label>'
          : '') +
        '<nav class="bc-step-strip" data-bc-steps aria-label="Guide steps"' +
        (guideMode ? '' : ' hidden') +
        '></nav><div class="bc-layout"><main class="bc-editor"><div class="bc-toolbar" role="group" aria-label="Screenshot editing tools">' +
        [
          ['cover', '▰ Solid cover'],
          ['brush', '✎ Cover brush'],
          ['blur', '▧ Blur'],
          ['arrow', '↗ Arrow'],
          ['crop', '⌗ Crop'],
          ['move', '✥ Move'],
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
        '</div><div class="bc-tool-options"><label>Colour<input type="color" data-bc-color value="#183b35"></label><label>Brush size<input type="range" data-bc-size min="2" max="80" value="24" aria-label="Brush size"></label>' +
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
        (guideMode
          ? '<div class="bc-step-actions">' +
            button('up', '↑ Move step up') +
            button('down', '↓ Move step down') +
            button('remove', 'Remove step', 'data-needs-image') +
            button('undo-remove', 'Undo remove', 'hidden') +
            '</div>'
          : '<p>Solid cover replaces selected pixels in the exported PNG. Use Compare original to review what changed.</p>' +
            button('to-guide', 'Add edited image to a guide ↗', 'data-needs-image')) +
        '<p class="bc-draft-note">Drafts stay in this tab while signed in. Save an editable guide file to continue later. Editable files retain original images; exported PDF / PNG files contain your finished edits.</p></aside></div><footer class="bc-footer"><div class="bc-export-actions">' +
        (guideMode
          ? '<label>Export format<select data-bc-format><option value="pdf">PDF guide</option><option value="images">PNG pages in ZIP</option><option value="pdf-zip">PDF in ZIP</option></select></label>'
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
        drag = {
          pointerId: event.pointerId,
          kind: tool,
          mark: {
            type: tool,
            color: $('[data-bc-color]').value,
            size: Math.min(
              0.2,
              +$('[data-bc-size]').value / (tool === 'arrow' ? 4 : 1) / step().image.width
            ),
            points: [p, p],
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
        if (tool === 'brush') {
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
        if (drag.kind === 'brush') drag.mark.points[drag.mark.points.length - 1] = point(event);
        else drag.mark.points[1] = point(event);
        const gesture = drag,
          area = E.bounds(gesture.mark.points),
          s = step();
        drag = null;
        if (
          s &&
          (gesture.kind === 'brush' || area.w * s.image.width >= 3 || area.h * s.image.height >= 3)
        ) {
          if (gesture.kind === 'crop' && (!area.w || !area.h)) {
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
          remember();
          if (gesture.kind === 'crop') s.crop = area;
          else s.marks = [...s.marks, gesture.mark];
          changed();
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
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 'z' &&
          !event.target.matches('input,textarea') &&
          !busy
        ) {
          event.preventDefault();
          undoEdit(event.shiftKey);
        }
      });
      document.body.append(room);
      document.body.classList.add('bc-room-open');
      room.showModal();
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
          original = false;
          paint();
          controls();
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
    });
    return { cards, decorateModal, sync, open, close, add, select, prepare, importGuide, handle };
  }
  root.WorkHubBatchC = { install };
})(window);
