/* Account-bound icon editor. Drafts stay in memory; Apply saves one small PNG through shared autosave. */
(function (root) {
  'use strict';
  const E = root.WorkHubIconEngine;
  const button = (action, label, attrs = '') =>
    `<button type="button" data-ic="${action}" ${attrs}>${label}</button>`;
  const range = (name, label, min, max, step) =>
    `<label>${label}<input type="range" data-ic-field="${name}" min="${min}" max="${max}" step="${step}"><output data-ic-output="${name}"></output></label>`;
  function install(a) {
    const $ = id => document.getElementById(id);
    let room = null,
      owner = '',
      generation = 0,
      snapshot = '',
      design = null,
      undo = [],
      redo = [],
      pending = null,
      gesture = null,
      tool = 'move',
      brush = 10,
      busy = false,
      epoch = 0,
      assets = new WeakMap(),
      outline = '',
      traceKey = '',
      content = null,
      frame = null,
      paintError = '';
    const branding = () => a.prefs().branding || { mode: 'default', initials: 'WH', image: '' };
    const allowed = () =>
      a.ready() &&
      a.can('workspace', 'edit') &&
      a.can('studio.theme', 'edit') &&
      !document.body.classList.contains('hub-private');
    function guard() {
      if (!allowed() || !room?.open || owner !== a.owner() || generation !== a.generation())
        throw Error('Reopen Icon Creator after signing in or changing appearance permissions.');
    }
    function status(text, error = false) {
      const el = $('icStatus');
      if (el) {
        el.textContent = text;
        el.dataset.error = String(error);
      }
    }
    function commit(before) {
      if (
        before &&
        (before.source !== design.source ||
          JSON.stringify({ ...before, source: null }) !==
            JSON.stringify({ ...design, source: null }))
      ) {
        undo.push(before);
        if (undo.length > 24) undo.shift();
        redo = [];
        status('Draft updated. Apply website icon to save it.');
      }
    }
    function stopFrame() {
      if (frame !== null) root.cancelAnimationFrame(frame);
      frame = null;
    }
    function close(discard = false) {
      if (gesture) design = gesture.before;
      if (pending) commit(pending);
      epoch++;
      busy = false;
      gesture = pending = null;
      stopFrame();
      room?.close();
      if (discard) {
        design = null;
        undo = [];
        redo = [];
        assets = new WeakMap();
        content = null;
        outline = traceKey = '';
        tracing.source = null;
        room?.remove();
        room = null;
      }
    }
    function sync() {
      if (owner && (!a.ready() || owner !== a.owner() || generation !== a.generation())) {
        close(true);
        owner = '';
      }
      if (document.body.classList.contains('hub-private') && room?.open) close();
      document.querySelectorAll('[data-ic="open"]').forEach(el => {
        el.disabled = !allowed();
      });
    }
    function controls() {
      room.querySelectorAll('[data-ic-field]').forEach(el => {
        const key = el.dataset.icField,
          value = key in design.fit ? design.fit[key] : design[key];
        if (key === 'background' && ![...el.options].some(o => o.value === value)) {
          el.querySelectorAll('[data-custom-colour]').forEach(option => option.remove());
          const option = document.createElement('option');
          option.value = value;
          option.textContent = 'Custom colour';
          option.dataset.customColour = '';
          el.append(option);
        }
        el.value = value;
        const out = room.querySelector(`[data-ic-output="${key}"]`);
        if (out) out.textContent = key === 'zoom' ? Math.round(value * 100) + '%' : String(value);
      });
      room
        .querySelectorAll('[data-ic-tool]')
        .forEach(el => el.setAttribute('aria-pressed', String(el.dataset.icTool === tool)));
      room.querySelector('[data-ic="undo"]').disabled = !undo.length;
      room.querySelector('[data-ic="redo"]').disabled = !redo.length;
      room.querySelectorAll('[data-ic="apply"],[data-ic="png"],[data-ic="svg"]').forEach(el => {
        el.disabled = busy || !allowed();
      });
      $('icCanvas').dataset.tool = tool;
    }
    function makeCanvas(size) {
      const el = document.createElement('canvas');
      el.width = el.height = size;
      if (!el.getContext('2d')) throw Error('This browser cannot open the drawing canvas.');
      return el;
    }
    function clip(ctx) {
      ctx.beginPath();
      if (design.shape === 'circle') ctx.arc(128, 128, 128, 0, Math.PI * 2);
      else if (design.shape === 'rounded') {
        ctx.moveTo(48, 0);
        ctx.lineTo(208, 0);
        ctx.quadraticCurveTo(256, 0, 256, 48);
        ctx.lineTo(256, 208);
        ctx.quadraticCurveTo(256, 256, 208, 256);
        ctx.lineTo(48, 256);
        ctx.quadraticCurveTo(0, 256, 0, 208);
        ctx.lineTo(0, 48);
        ctx.quadraticCurveTo(0, 0, 48, 0);
      } else ctx.rect(0, 0, 256, 256);
      ctx.clip();
    }
    function paintSource(ctx) {
      if (!design.source || !assets.has(design.source)) return;
      const box = E.fit(design);
      ctx.save();
      ctx.translate(box.x, box.y);
      ctx.rotate((box.rotation * Math.PI) / 180);
      ctx.drawImage(
        assets.get(design.source),
        -box.width / 2,
        -box.height / 2,
        box.width,
        box.height
      );
      ctx.restore();
    }
    function tracing() {
      if (!design.source || design.mode === 'image') {
        outline = '';
        traceKey = '';
        tracing.source = null;
        return;
      }
      const key = JSON.stringify([design.fit, design.detail, design.threshold, design.traceTarget]);
      if (traceKey === key && tracing.source === design.source) return;
      const raster = makeCanvas(design.detail),
        ctx = raster.getContext('2d');
      ctx.scale(design.detail / 256, design.detail / 256);
      paintSource(ctx);
      outline = E.trace(
        ctx.getImageData(0, 0, design.detail, design.detail).data,
        design.detail,
        design.detail,
        design.threshold,
        design.traceTarget
      );
      traceKey = key;
      tracing.source = design.source;
    }
    function paint() {
      if (!room?.open || !design || busy) return;
      paintError = '';
      try {
        tracing();
        if (!content) content = makeCanvas(512);
        const ink = content.getContext('2d');
        ink.clearRect(0, 0, 512, 512);
        ink.save();
        ink.scale(2, 2);
        if (design.mode === 'image') paintSource(ink);
        else if (outline) {
          const path = new root.Path2D(outline);
          ink.fillStyle = ink.strokeStyle = design.ink;
          ink.lineWidth = design.lineWidth;
          ink.lineJoin = 'round';
          if (design.mode === 'silhouette') ink.fill(path, 'evenodd');
          else ink.stroke(path);
        }
        if (design.text.trim()) {
          ink.font = '700 ' + design.textSize + 'px ' + design.textFont;
          ink.fillStyle = design.ink;
          ink.textAlign = 'center';
          ink.textBaseline = 'middle';
          ink.fillText(design.text, 128, 128);
        }
        for (const s of design.strokes) {
          ink.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
          ink.strokeStyle = ink.fillStyle = s.color;
          ink.lineWidth = s.size;
          ink.lineCap = ink.lineJoin = 'round';
          ink.beginPath();
          if (s.points.length === 1) {
            ink.arc(s.points[0][0], s.points[0][1], s.size / 2, 0, Math.PI * 2);
            ink.fill();
          } else {
            ink.moveTo(...s.points[0]);
            for (const point of s.points.slice(1)) ink.lineTo(...point);
            ink.stroke();
          }
        }
        ink.restore();
        ink.globalCompositeOperation = 'source-over';
        const canvas = $('icCanvas'),
          ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 512, 512);
        ctx.save();
        ctx.scale(2, 2);
        clip(ctx);
        if (design.background !== 'transparent') {
          ctx.fillStyle = design.background;
          ctx.fillRect(0, 0, 256, 256);
        }
        ctx.drawImage(content, 0, 0, 256, 256);
        ctx.restore();
        for (const id of ['icHeaderPreview', 'icTabPreview', 'icSmallPreview']) {
          const el = $(id),
            c = el.getContext('2d');
          c.clearRect(0, 0, el.width, el.height);
          c.drawImage(canvas, 0, 0, el.width, el.height);
        }
        controls();
      } catch (err) {
        paintError = err.message;
        status(err.message, true);
      }
    }
    function schedule() {
      if (frame !== null) return;
      frame = root.requestAnimationFrame(() => {
        frame = null;
        paint();
      });
    }
    async function loadData(source) {
      if (assets.has(source)) return;
      const token = epoch,
        image = new root.Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(Error('This image could not be opened.'));
        image.src = source.data;
      });
      if (token !== epoch || !room?.open) return;
      assets.set(source, image);
    }
    function createRoom() {
      room = document.createElement('dialog');
      room.id = 'iconCreatorRoom';
      room.className = 'ic-room';
      room.setAttribute('aria-labelledby', 'icTitle');
      room.innerHTML = `<header class="ic-header"><div><span class="hub-kicker">YOUR WEBSITE, YOUR MARK</span><h2 id="icTitle">Icon Creator</h2><p>Fit an image, trace an outline, or draw your own.</p></div>${button('close', 'Close')}</header><div class="ic-layout"><form id="icControls" class="ic-controls"><label>Upload an image<input id="icFile" type="file" accept="image/png,image/jpeg,image/webp"></label><p class="ic-hint">PNG, JPG or WebP, up to 10 MB. Editing stays on this device.</p><label>Frame shape<select data-ic-field="shape"><option value="rounded">Rounded square</option><option value="circle">Circle</option><option value="square">Square</option></select></label><label>Background<select data-ic-field="background"><option value="transparent">Transparent</option><option value="#ffffff">White</option><option value="#172536">Midnight</option></select></label><label>Custom background<input type="color" data-ic-background value="#ffffff"></label><details open><summary>Image fitting</summary>${range('zoom', 'Zoom', 0.25, 3, 0.05)}${range('padding', 'Padding', 0, 40, 1)}${range('rotation', 'Rotation', -180, 180, 5)}${range('x', 'Horizontal position', -128, 128, 1)}${range('y', 'Vertical position', -128, 128, 1)}${button('center', 'Centre image')}</details><details open><summary>Image conversion</summary><label>Conversion<select data-ic-field="mode"><option value="image">Original image</option><option value="outline">Editable outline</option><option value="silhouette">Silhouette</option></select></label><label>Trace target<select data-ic-field="traceTarget"><option value="dark">Dark details / light background</option><option value="alpha">Existing transparency</option></select></label>${range('threshold', 'Detail threshold', 1, 255, 1)}<label>Tracing detail<select data-ic-field="detail"><option value="64">Simple</option><option value="96">Balanced</option><option value="128">Fine</option></select></label>${range('lineWidth', 'Outline thickness', 1, 24, 1)}</details><label>Ink colour<input type="color" data-ic-field="ink"></label><details><summary>Text / initials</summary><label>Up to three characters<input data-ic-field="text" maxlength="6"></label><label>Letter style<select data-ic-field="textFont"><option value="sans-serif">Modern</option><option value="serif">Classic</option><option value="monospace">Monospace</option></select></label>${range('textSize', 'Letter size', 24, 160, 2)}</details></form><section class="ic-work"><div class="ic-tools" role="group" aria-label="Drawing tools">${['move', 'draw', 'erase'].map(v => button('tool', { move: 'Move image', draw: 'Draw', erase: 'Erase' }[v], `data-ic-tool="${v}" aria-pressed="${v === tool}"`)).join('')}<label>Brush<input id="icBrush" type="range" min="1" max="32" value="10" aria-label="Brush size"></label>${button('undo', 'Undo')}${button('redo', 'Redo')}</div><div class="ic-canvas-wrap"><canvas id="icCanvas" width="512" height="512" aria-label="Icon drawing canvas. Use Move image to drag the uploaded image, Draw to add strokes, or Erase to remove details."></canvas></div><div class="ic-actions">${button('blank', 'Start a blank icon')}${button('clear', 'Clear drawing')}${button('png', 'Download PNG')}${button('svg', 'Download SVG')}</div><p class="ic-hint">Simple logos trace best. Refine the edges with Draw and Erase; SVG export keeps traced paths and drawing strokes.</p></section><aside class="ic-previews"><h3>Live previews</h3><div class="ic-site-preview"><canvas id="icHeaderPreview" width="64" height="64"></canvas><strong>Website header</strong></div><div class="ic-tab-preview"><canvas id="icTabPreview" width="32" height="32"></canvas><span>Browser tab</span></div><div class="ic-tiny-preview"><canvas id="icSmallPreview" width="16" height="16"></canvas><span>16 px preview</span></div><p>Apply saves a small icon to your account and updates the header and browser tab.</p>${button('apply', 'Apply website icon', 'class="primary"')}<p id="icStatus" role="status">Your draft is local until you apply it.</p></aside></div>`;
      document.body.append(room);
      room.addEventListener('cancel', event => {
        event.preventDefault();
        close();
      });
      room.addEventListener('submit', e => e.preventDefault());
    }
    async function open() {
      sync();
      if (!allowed()) throw Error('Your account cannot edit website appearance.');
      if (owner !== a.owner()) {
        design = null;
        undo = [];
        redo = [];
      }
      owner = a.owner();
      generation = a.generation();
      snapshot = JSON.stringify(branding());
      const fresh = !design,
        initial = a.previewBranding?.() || branding();
      if (fresh) design = E.create(initial.initials || 'WH');
      if (!room) createRoom();
      if (!room.open) room.showModal();
      if (fresh && initial.mode === 'logo') {
        design.source = { data: initial.image, width: 96, height: 96 };
        design.text = '';
        design.fit.padding = 0;
      }
      const token = epoch;
      if (design.source) {
        busy = true;
        controls();
        try {
          await loadData(design.source);
        } finally {
          if (token === epoch) busy = false;
        }
      }
      if (token !== epoch) return;
      if (!room?.open) return;
      guard();
      controls();
      paint();
    }
    async function upload(file) {
      guard();
      if (
        !file ||
        !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
        file.size > 10000000
      )
        throw Error('Choose a PNG, JPG or WebP below 10 MB.');
      const token = ++epoch,
        url = URL.createObjectURL(file),
        img = new root.Image();
      busy = true;
      controls();
      status('Opening your image…');
      try {
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = () => reject(Error('This picture could not be read.'));
          img.src = url;
        });
        guard();
        if (token !== epoch || !room?.open) return;
        if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > 40000000)
          throw Error('Choose an image below 40 megapixels.');
        const ratio = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight)),
          canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw Error('This browser cannot read the image.');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const source = {
            data: canvas.toDataURL('image/png'),
            width: canvas.width,
            height: canvas.height,
          },
          before = E.copy(design);
        design.source = source;
        design.text = '';
        design.fit = E.create().fit;
        design.mode = 'image';
        E.validate(design);
        assets.set(source, canvas);
        commit(before);
        traceKey = '';
        status('Image ready. Drag to position it or choose an outline conversion.');
      } finally {
        URL.revokeObjectURL(url);
        img.src = '';
        if (token === epoch) {
          busy = false;
          controls();
          paint();
        }
      }
    }
    function png(size) {
      paint();
      if (paintError) throw Error(paintError);
      const canvas = makeCanvas(size);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage($('icCanvas'), 0, 0, size, size);
      return canvas.toDataURL('image/png');
    }
    function hasArt() {
      return (
        design.text.trim() ||
        design.strokes.some(s => !s.erase) ||
        (design.source && (design.mode === 'image' || outline))
      );
    }
    function apply() {
      guard();
      if (busy) throw Error('Wait for the image to finish opening.');
      E.validate(design);
      paint();
      if (paintError) throw Error(paintError);
      if (!hasArt())
        throw Error(
          'Add an image, initials or drawing first. For an outline, try a different tracing threshold.'
        );
      const image = png(96);
      if (image.length > 65000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))
        throw Error('Try a simpler icon so the saved copy stays small.');
      let next;
      const ok = a.mutate(d => {
        if (
          JSON.stringify(
            d.workhub.preferences.branding || { mode: 'default', initials: 'WH', image: '' }
          ) !== snapshot
        )
          throw Error(
            'Your website icon changed elsewhere. Reopen Icon Creator before applying this draft.'
          );
        next = { ...(d.workhub.preferences.branding || { initials: 'WH' }), mode: 'logo', image };
        d.workhub.preferences.branding = next;
      });
      if (ok) {
        snapshot = JSON.stringify(next);
        a.applied(next);
        status('Applied. Your website header and browser tab now use this icon.');
      }
      return ok;
    }
    function exportFile(type) {
      guard();
      if (busy || !a.can('studio.theme', 'export'))
        throw Error('Your account cannot export this icon right now.');
      E.validate(design);
      paint();
      if (paintError) throw Error(paintError);
      if (type === 'svg')
        a.download(E.svg(design, outline), 'my-website-icon.svg', 'image/svg+xml', 'studio.theme');
      else {
        const data = root.atob(png(512).split(',')[1]),
          bytes = Uint8Array.from(data, c => c.charCodeAt(0));
        a.download(
          new Blob([bytes], { type: 'image/png' }),
          'my-website-icon.png',
          'image/png',
          'studio.theme'
        );
      }
      status('Download prepared. Your editable draft stays open.');
    }
    document.addEventListener('click', event => {
      const el = event.target.closest?.('[data-ic]');
      if (!el) return;
      event.preventDefault();
      if (el.dataset.ic === 'open') {
        void open().catch(e => a.tell(e.message, true));
        return;
      }
      if (!room?.contains(el)) return;
      try {
        const action = el.dataset.ic;
        if (action === 'close') {
          close();
          return;
        }
        guard();
        if (busy) return;
        if (pending) {
          commit(pending);
          pending = null;
        }
        if (action === 'tool') tool = el.dataset.icTool;
        else if (action === 'apply') apply();
        else if (action === 'png' || action === 'svg') exportFile(action);
        else if (action === 'undo' || action === 'redo') {
          const from = action === 'undo' ? undo : redo,
            to = action === 'undo' ? redo : undo;
          if (from.length) {
            to.push(E.copy(design));
            design = from.pop();
            status('Draft updated. Apply website icon to save it.');
            traceKey = '';
            if (design.source && !assets.has(design.source))
              void loadData(design.source)
                .then(paint)
                .catch(e => status(e.message, true));
          }
        } else {
          const before = E.copy(design);
          if (action === 'blank') design = E.create('');
          else if (action === 'clear') design.strokes = [];
          else if (action === 'center') Object.assign(design.fit, { x: 0, y: 0 });
          commit(before);
        }
        controls();
        paint();
      } catch (err) {
        status(err.message, true);
      }
    });
    function field(event) {
      const el = event.target;
      if (!room?.contains(el)) return;
      if (el.id === 'icFile' && event.type === 'change') {
        const file = el.files?.[0];
        el.value = '';
        if (file) void upload(file).catch(e => status(e.message, true));
        return;
      }
      try {
        guard();
        if (busy) return;
        if (el.id === 'icBrush') {
          brush = Number(el.value);
          return;
        }
        const key = el.dataset.icField;
        if (!key && !el.hasAttribute('data-ic-background')) return;
        if (!pending) pending = E.copy(design);
        if (el.hasAttribute('data-ic-background')) design.background = el.value;
        else if (key in design.fit) design.fit[key] = Number(el.value);
        else
          design[key] = ['threshold', 'detail', 'lineWidth', 'textSize'].includes(key)
            ? Number(el.value)
            : key === 'text'
              ? Array.from(el.value).slice(0, 3).join('')
              : el.value;
        E.validate(design);
        if (event.type === 'change') {
          commit(pending);
          pending = null;
        }
        controls();
        paint();
      } catch (err) {
        if (pending) {
          design = pending;
          pending = null;
        }
        status(err.message, true);
      }
    }
    document.addEventListener('input', field);
    document.addEventListener('change', field);
    const point = event => {
      const box = $('icCanvas').getBoundingClientRect();
      return [
        Math.round(
          Math.max(0, Math.min(256, ((event.clientX - box.left) * 256) / box.width)) * 10
        ) / 10,
        Math.round(
          Math.max(0, Math.min(256, ((event.clientY - box.top) * 256) / box.height)) * 10
        ) / 10,
      ];
    };
    document.addEventListener('pointerdown', event => {
      if (event.target.id !== 'icCanvas' || event.button !== 0) return;
      try {
        guard();
        if (busy) return;
        if (pending) {
          commit(pending);
          pending = null;
        }
        const start = point(event);
        gesture = { id: event.pointerId, start, before: E.copy(design), tool };
        if (tool !== 'move') {
          if (
            design.strokes.length >= 250 ||
            design.strokes.reduce((sum, s) => sum + s.points.length, 0) >= 48000
          )
            throw Error('Export your drawing before adding more strokes.');
          design.strokes.push({
            points: [start],
            size: brush,
            color: design.ink,
            erase: tool === 'erase',
          });
        }
        event.target.setPointerCapture?.(event.pointerId);
        event.preventDefault();
        paint();
      } catch (err) {
        gesture = null;
        status(err.message, true);
      }
    });
    document.addEventListener('pointermove', event => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const p = point(event);
      if (gesture.tool === 'move') {
        design.fit.x = Math.max(
          -128,
          Math.min(128, gesture.before.fit.x + p[0] - gesture.start[0])
        );
        design.fit.y = Math.max(
          -128,
          Math.min(128, gesture.before.fit.y + p[1] - gesture.start[1])
        );
      } else {
        const s = design.strokes.at(-1),
          last = s.points.at(-1);
        if (s.points.length < 2000 && Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1)
          s.points.push(p);
      }
      event.preventDefault();
      schedule();
    });
    function end(event) {
      if (!gesture || event.pointerId !== gesture.id) return;
      if (event.type === 'pointercancel') design = gesture.before;
      else commit(gesture.before);
      gesture = null;
      stopFrame();
      controls();
      paint();
    }
    document.addEventListener('pointerup', end);
    document.addEventListener('pointercancel', end);
    return {
      open,
      close,
      sync,
      upload,
      apply,
      exportFile,
      snapshot: () => (design ? E.copy(design) : null),
    };
  }
  root.WorkHubIconCreator = Object.freeze({ install });
})(window);
