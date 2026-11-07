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
    page: E.pageOptions(),
    quality: 'balanced',
    contents: false,
    exportHeading: E.DEFAULT_GUIDE_HEADING,
    footer: E.footer(),
    cover: E.cover(),
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
      guidePreviewView = 'page',
      guidePreviewPages = [],
      guidePreviewIndex = 0,
      guidePreviewRevision = -1,
      guidePreviewZoom = 1;
    const store = root.WorkHubGuideStore;
    let draftTimer = 0,
      draftJob = 0,
      storageLoaded = false,
      autoSave = true,
      recoveryDraft = null,
      brandTemplates = [],
      storageEpoch = 0;
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
    let layerImages = new Map(),
      layerLoadJob = 0,
      layerLoadKey = '',
      coverImageRefs = [];
    let workspace = 'edit';
    const project = () => projects[mode],
      step = () => project().steps.find(s => s.id === selected),
      $ = selector => room?.querySelector(selector);
    const nextNumber = () => E.nextNumber(project(), selected),
      clone = value => JSON.parse(JSON.stringify(value)),
      activeObject = () => step()?.marks[objectIndex];
    function previewVisible() {
      return (
        mode === 'guide' &&
        !!room &&
        (workspace !== 'edit' || !!room.querySelector('.bc-branding')?.open)
      );
    }
    function pauseGuidePreview() {
      clearTimeout(guidePreviewTimer);
      guidePreviewTimer = 0;
      guidePreviewJob++;
      guidePreviewPending = false;
    }
    function setWorkspace(value, focus = false) {
      if (mode !== 'guide' || !room || !['edit', 'design', 'preview'].includes(value)) return;
      workspace = value;
      room.dataset.bcWorkspace = value;
      const menu = room.querySelector('.bc-more-tools');
      if (menu && value !== 'edit') menu.open = false;
      for (const pane of room.querySelectorAll('[data-bc-pane]'))
        pane.hidden = pane.dataset.bcPane !== value;
      for (const tab of room.querySelectorAll('[data-bc-workspace-tab]')) {
        const active = tab.dataset.workspace === value;
        tab.setAttribute('aria-selected', String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active && focus) tab.focus();
      }
      const preview = room.querySelector('.bc-guide-preview'),
        host = $('[data-bc-preview-host="' + (value === 'preview' ? 'preview' : 'design') + '"]');
      if (preview && host && preview.parentElement !== host) host.append(preview);
      if (value === 'edit') {
        room.querySelector('.bc-branding').open = false;
        pauseGuidePreview();
      } else if (guidePreviewPage && guidePreviewRevision === revision) paintGuidePreview();
      else scheduleGuidePreview(0);
    }
    function revealGuidePreview() {
      if (mode === 'guide' && workspace === 'edit') setWorkspace('design');
    }
    function mountGuideLayout() {
      room.dataset.bcMode = mode;
      if (mode !== 'guide') return;
      room.classList.add('bc-guide-studio');
      const shell = room.querySelector('.bc-shell'),
        footer = room.querySelector('.bc-footer'),
        tabs = document.createElement('nav'),
        statusRow = document.createElement('div');
      tabs.className = 'bc-workspace-tabs';
      tabs.setAttribute('role', 'tablist');
      tabs.setAttribute('aria-label', 'Guide workspace');
      tabs.innerHTML = [
        ['edit', '01', 'Edit screenshots'],
        ['design', '02', 'Design & layout'],
        ['preview', '03', 'Preview & export'],
      ]
        .map(([id, number, label]) =>
          button(
            'workspace',
            '<span aria-hidden="true">' + number + '</span>' + esc(label),
            'id="bcTab-' +
              id +
              '" role="tab" aria-controls="bcPane-' +
              id +
              '" data-bc-workspace-tab data-workspace="' +
              id +
              '"'
          )
        )
        .join('');
      shell.querySelector('.bc-file-bar').after(tabs);
      statusRow.className = 'bc-studio-status';
      const saving = $('[data-bc-save-status]'),
        recovery = document.createElement('details');
      recovery.className = 'bc-recovery-options';
      recovery.innerHTML = '<summary>Recovery options</summary>';
      recovery.append(room.querySelector('.bc-recovery'));
      statusRow.append(saving, recovery);
      tabs.after(statusRow);
      const makePane = (id, label) => {
        const pane = document.createElement('section');
        pane.id = 'bcPane-' + id;
        pane.dataset.bcPane = id;
        pane.setAttribute('role', 'tabpanel');
        pane.setAttribute('aria-labelledby', 'bcTab-' + id);
        pane.setAttribute('aria-label', label);
        shell.insertBefore(pane, footer);
        return pane;
      };
      const edit = makePane('edit', 'Edit screenshots'),
        design = makePane('design', 'Document design'),
        preview = makePane('preview', 'Document preview'),
        editGrid = document.createElement('div'),
        designControls = document.createElement('div'),
        designPreview = document.createElement('div'),
        fullPreview = document.createElement('div');
      editGrid.className = 'bc-edit-workspace';
      editGrid.append(room.querySelector('.bc-step-strip'), room.querySelector('.bc-layout'));
      edit.append(editGrid);
      design.className = 'bc-design-workspace';
      designControls.className = 'bc-design-controls';
      designPreview.className = 'bc-design-preview';
      designPreview.dataset.bcPreviewHost = 'design';
      fullPreview.dataset.bcPreviewHost = 'preview';
      for (const selector of [
        '.bc-guide-fields',
        '.bc-guide-layout',
        '.bc-workspace-options',
        '.bc-cover',
        '.bc-branding',
      ])
        designControls.append(room.querySelector(selector));
      design.append(designControls, designPreview);
      preview.append(fullPreview);
      room.querySelector('.bc-workspace-options').open = true;
      const brandSummary = room.querySelector('.bc-branding > summary');
      brandSummary.textContent = 'Colours, footer logo & watermark';
      const title = room.querySelector('.bc-header h2'),
        description = room.querySelector('.bc-header p');
      title.textContent = 'Step-by-step guide';
      description.dataset.bcDocumentName = '';
      const toolbar = room.querySelector('.bc-toolbar'),
        quick = document.createElement('div'),
        more = document.createElement('details');
      quick.className = 'bc-quick-tools';
      more.className = 'bc-more-tools';
      more.innerHTML =
        '<summary>More tools <span aria-hidden="true">⌄</span></summary><div role="group" aria-label="More annotation tools"></div>';
      const primary = new Set(['object', 'move', 'number', 'arrow', 'rectangle', 'crop']);
      for (const item of [...toolbar.querySelectorAll('[data-bc-tool]')])
        if (!primary.has(item.dataset.bcTool)) more.querySelector('div').append(item);
      for (const key of ['object', 'move', 'number', 'arrow', 'rectangle', 'crop'])
        quick.append(toolbar.querySelector('[data-bc-tool="' + key + '"]'));
      const addImage = toolbar.querySelector('.bc-file-label'),
        remove = toolbar.querySelector('[data-bc="delete-object"]');
      toolbar.replaceChildren(quick, more, addImage);
      more.addEventListener('toggle', () => {
        if (!more.open) return;
        const panel = more.querySelector('div');
        panel.style.left = '0';
        panel.style.right = 'auto';
        if (panel.getBoundingClientRect().right > root.innerWidth - 12) {
          panel.style.left = 'auto';
          panel.style.right = '0';
        }
      });
      const selection = $('[data-bc-selection-status]'),
        selectionBar = document.createElement('div');
      selectionBar.className = 'bc-selection-bar';
      selection.before(selectionBar);
      selectionBar.append(selection, remove);
      tabs.addEventListener('keydown', event => {
        if (busy) return;
        const items = [...tabs.querySelectorAll('[role="tab"]')],
          index = items.indexOf(event.target);
        if (index < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        event.stopPropagation();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : (index + (event.key === 'ArrowLeft' ? -1 : 1) + items.length) % items.length;
        setWorkspace(items[next].dataset.workspace, true);
      });
      setWorkspace('edit');
    }
    function objectFields() {
      return (
        '<section class="bc-objects" aria-label="Screenshot objects"><h3>Objects &amp; instructions</h3><label>Object<select data-bc-object><option value="-1">Choose an object</option></select></label><p class="bc-guide-heading-help">Choose an object here or use Select objects on the canvas. Drag to move or resize; Delete selected object removes it. Unlock a locked object first.</p>' +
        '<div class="bc-object-actions">' +
        [
          ['delete-object', 'Delete selected object'],
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
        '<label data-bc-object-color-label>Object colour<input type="color" data-bc-object-color></label><label data-bc-object-size-label>Size / stroke (pixels)<input type="number" min="0.1" step="0.1" data-bc-object-size></label>' +
        '<label data-bc-object-name-label hidden>Image name<input maxlength="120" data-bc-object-name></label><p class="bc-guide-heading-help" data-bc-image-help hidden>Images fit inside the selected box without stretching. Transparent backgrounds are preserved. Bring to front / Send to back changes the stacking order.</p>' +
        '<label data-bc-object-text-label hidden>Text<textarea maxlength="500" rows="3" data-bc-object-text></textarea><small>Resize the box or reduce its text size until the label fits.</small></label><label data-bc-object-number-label hidden>Number<input type="number" min="1" max="999" data-bc-object-number></label><label data-bc-object-instruction-label hidden>Linked instruction<textarea maxlength="300" rows="3" data-bc-object-instruction placeholder="What should the reader do at this marker?"></textarea></label>' +
        '<label data-bc-object-opacity-label hidden><span data-bc-opacity-label>Dim opacity</span><input type="range" min="10" max="85" data-bc-object-opacity></label>' +
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
        marks.map(o => [o.type, o.number, o.text?.slice(0, 28), o.name, o.locked])
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
                    (o.type === 'image' ? 'Image · ' + o.name : o.type) +
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
        for (const el of room.querySelectorAll('[data-bc="' + action + '"]'))
          el.disabled = busy || !m || !!m.locked;
      for (const action of ['lock-object', 'copy-object'])
        $('[data-bc="' + action + '"]').disabled = busy || !m;
      $('[data-bc="copy-all"]').disabled = busy || !marks.length;
      $('[data-bc="paste-objects"]').disabled = busy || !s || !clipboard.length;
      $('[data-bc="lock-object"]').textContent = m?.locked ? 'Unlock object' : 'Lock object';
      for (const el of $('[data-bc-object-properties]').querySelectorAll('input,textarea'))
        el.disabled = busy || !m || !!m.locked;
      $('[data-bc-object-opacity]').min = m?.type === 'image' ? 5 : 10;
      $('[data-bc-object-opacity]').max = m?.type === 'image' ? 100 : 85;
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
        $('[data-bc-object-name]').value = m.name || '';
        $('[data-bc-object-opacity]').value = Math.round((m.opacity || 0.55) * 100);
        for (const input of $('[data-bc-object-properties]').querySelectorAll('input,textarea'))
          input.dataset.current = input.value;
      }
      objectRef = m || null;
      for (const [part, show] of [
        ['text', ['text', 'callout'].includes(m?.type)],
        ['number', m?.type === 'number'],
        ['instruction', m?.type === 'number'],
        ['opacity', ['spotlight', 'image'].includes(m?.type)],
        ['name', m?.type === 'image'],
      ])
        $('[data-bc-object-' + part + '-label]').hidden = !show;
      $('[data-bc-object-size-label]').hidden = ['spotlight', 'image'].includes(m?.type);
      $('[data-bc-object-color-label]').hidden = m?.type === 'image';
      $('[data-bc-image-help]').hidden = m?.type !== 'image';
      $('[data-bc-opacity-label]').textContent =
        m?.type === 'image' ? 'Image opacity' : 'Dim opacity';
      const selection = $('[data-bc-selection-status]');
      if (selection)
        selection.textContent = m
          ? (m.type === 'image' ? m.name || 'Image layer' : m.type) +
            (m.locked
              ? ' · Locked: unlock in Objects & instructions to delete.'
              : ' selected · Delete removes this object. Undo restores it.')
          : 'Choose Select objects, then click an object to move, resize or delete it.';
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
      if (m.type === 'image') next.name = $('[data-bc-object-name]').value;
      if (['spotlight', 'image'].includes(m.type) && edited('opacity'))
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
        status('Object deleted. Use Undo to restore it.');
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
      if (m && !m.locked && m.type !== 'image') {
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
        'Style applied to the current tool' +
          (m && !m.locked && m.type !== 'image' ? ' and selected object.' : '.')
      );
    }
    function workspaceFields() {
      return (
        '<section class="bc-recovery"><div><label class="bc-object-check"><input type="checkbox" data-bc-autosave checked>Automatically save a recovery draft on this device</label><p data-bc-save-status role="status" aria-live="polite">Checking saved drafts…</p></div>' +
        button('clear-recovery', 'Clear saved recovery copy') +
        '<div data-bc-recovery hidden><p data-bc-recovery-message></p>' +
        button('restore-recovery', 'Restore saved draft') +
        button('keep-current', 'Keep current guide') +
        '</div></section>' +
        '<details class="bc-workspace-options"><summary>Page layout, contents &amp; brand templates</summary><div class="bc-workspace-grid"><fieldset><legend>Page layout</legend>' +
        [
          ['headerHeight', 'Header height (%)', 60, 110],
          ['margin', 'Side margins (px)', 40, 120],
          ['imageWidth', 'Screenshot width (%)', 40, 100],
          ['spacing', 'Space between steps (px)', 8, 48],
        ]
          .map(
            ([key, label, min, max]) =>
              '<label>' +
              label +
              ' <output data-bc-page-value="' +
              key +
              '"></output><input type="range" min="' +
              min +
              '" max="' +
              max +
              '" step="1" data-bc-page="' +
              key +
              '"></label>'
          )
          .join('') +
        '<p class="bc-guide-heading-help">Header appearance above lets you keep plain text or hide the header. Changes apply to the live preview and every export.</p>' +
        button('reset-page', 'Reset page layout') +
        '</fieldset><fieldset><legend>Contents &amp; navigation</legend><label class="bc-object-check"><input type="checkbox" data-bc-contents>Include an automatic contents page</label><p class="bc-guide-heading-help">PDF contents entries are clickable and steps appear as PDF bookmarks. JPG/PNG pages include the printed contents. Guide page numbering starts after the cover and contents.</p></fieldset>' +
        '<fieldset><legend>Brand templates</legend><label>Saved template<select data-bc-template><option value="">Choose a template</option></select></label><div class="bc-object-actions">' +
        button('apply-template', 'Apply template') +
        button('delete-template', 'Delete template') +
        '</div><label>Template name<input maxlength="40" data-bc-template-name placeholder="e.g. My company guide"></label>' +
        button('save-template', 'Save current branding') +
        '<p class="bc-guide-heading-help">Save up to twelve sets of headings, colours, footer logo, fonts, cover design and page settings for your account on this device. Screenshot steps and cover text/images are kept when applying a template.</p></fieldset></div></details>'
      );
    }
    function updateWorkspace() {
      if (mode !== 'guide' || !room) return;
      const g = project();
      $('[data-bc-header-style]').value = g.page.headerStyle;
      $('[data-bc-header-help]').textContent = E.GUIDE_HEADERS[g.page.headerStyle].description;
      $('[data-bc-export-heading]').disabled = busy || g.page.headerStyle === 'none';
      for (const el of room.querySelectorAll('[data-bc-page]')) {
        el.value = g.page[el.dataset.bcPage];
        if (el.dataset.bcPage === 'headerHeight')
          el.disabled = busy || g.page.headerStyle === 'none';
        $('[data-bc-page-value="' + el.dataset.bcPage + '"]').textContent = String(el.value);
      }
      $('[data-bc-contents]').checked = g.contents;
      $('[data-bc-quality]').value = g.quality;
      $('[data-bc-autosave]').checked = autoSave;
      $('[data-bc-autosave]').disabled = !store || !storageLoaded || busy;
      $('[data-bc-recovery]').hidden = !recoveryDraft;
      const recoveryOptions = room.querySelector('.bc-recovery-options');
      if (recoveryDraft && recoveryOptions) recoveryOptions.open = true;
      const select = $('[data-bc-template]'),
        value = select.value;
      select.innerHTML =
        '<option value="">Choose a template</option>' +
        brandTemplates
          .map(t => '<option value="' + esc(t.name) + '">' + esc(t.name) + '</option>')
          .join('');
      select.value = value;
      for (const action of ['apply-template', 'delete-template', 'save-template', 'clear-recovery'])
        $('[data-bc="' + action + '"]').disabled = busy || !store || !storageLoaded;
      for (const action of ['apply-template', 'delete-template'])
        $('[data-bc="' + action + '"]').disabled ||= !select.value;
    }
    function saveMessage(message) {
      const el = $('[data-bc-save-status]');
      if (el && mode === 'guide') el.textContent = message;
    }
    function scheduleDraft() {
      clearTimeout(draftTimer);
      if (
        !store ||
        !storageLoaded ||
        !autoSave ||
        recoveryDraft ||
        mode !== 'guide' ||
        !owner ||
        !a.ready() ||
        a.owner() !== owner
      )
        return;
      saveMessage('Saving recovery draft…');
      draftTimer = setTimeout(() => {
        void flushDraft();
      }, 400);
    }
    async function flushDraft() {
      clearTimeout(draftTimer);
      draftTimer = 0;
      if (
        !store ||
        !storageLoaded ||
        !autoSave ||
        recoveryDraft ||
        !owner ||
        !a.ready() ||
        a.owner() !== owner
      )
        return;
      const current = owner,
        job = ++draftJob,
        epoch = storageEpoch,
        version = revision;
      try {
        const snapshot = E.guide(projects.guide);
        if (!snapshot.steps.length && !snapshot.title.trim() && !snapshot.cover.enabled) return;
        await store.saveDraft(current, snapshot);
        if (owner === current && epoch === storageEpoch && job === draftJob && version === revision)
          saveMessage(
            'Recovery draft saved on this device at ' +
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
              '.'
          );
      } catch (err) {
        if (owner === current && epoch === storageEpoch && job === draftJob)
          saveMessage('Recovery draft not saved: ' + err.message);
      }
    }
    async function checkStored() {
      if (!store || mode !== 'guide') {
        saveMessage('Save an editable guide to keep an external copy.');
        return;
      }
      const dialog = room,
        current = owner,
        epoch = storageEpoch,
        version = revision,
        alive = () =>
          room === dialog &&
          a.ready() &&
          a.owner() === current &&
          epoch === storageEpoch &&
          mode === 'guide';
      try {
        const saved = await store.read(current);
        if (!alive()) return;
        brandTemplates = [];
        for (const template of (Array.isArray(saved.templates) ? saved.templates : []).slice(
          0,
          12
        )) {
          try {
            brandTemplates.push(E.brandTemplate(template.name, template.settings));
          } catch {
            /* A broken template must not block draft recovery. */
          }
        }
        autoSave = saved.autoSave !== false;
        storageLoaded = true;
        if (saved.draft && (!projects.guide.steps.length || revision !== version)) {
          recoveryDraft = saved.draft;
          $('[data-bc-recovery-message]').textContent =
            'A recovery copy from ' +
            new Date(saved.draft.savedAt).toLocaleString() +
            ' is available.';
          updateWorkspace();
          if (
            !projects.guide.steps.length &&
            !projects.guide.title &&
            !projects.guide.cover.enabled &&
            revision === version &&
            !busy
          ) {
            await restoreRecovery();
            return;
          }
          saveMessage(
            'Restore the recovery copy or keep the current guide to resume automatic saving.'
          );
        } else {
          recoveryDraft = null;
          saveMessage(
            autoSave
              ? 'Recovery saving is on for this account and device.'
              : 'Recovery saving is off. Save an editable guide to keep your work.'
          );
          scheduleDraft();
        }
        updateWorkspace();
      } catch (err) {
        if (alive()) {
          storageLoaded = true;
          saveMessage(err.message);
          updateWorkspace();
        }
      }
    }
    async function validateImages(data, alive) {
      for (const s of data.steps) {
        await F.loadImage(s.image, alive);
        await F.loadLayers(s, alive);
        if (s.comparison) await F.loadImage(s.comparison.image, alive);
        if (!alive()) return;
      }
      for (const img of data.cover.images) {
        await F.loadImage(img, alive);
        if (!alive()) return;
      }
      if (data.footer.logo) await F.loadImage(data.footer.logo, alive, 1600, 600);
    }
    async function restoreRecovery() {
      if (!recoveryDraft || busy || mode !== 'guide') return;
      const dialog = room,
        current = owner,
        version = revision,
        epoch = storageEpoch,
        alive = () =>
          room === dialog &&
          a.ready() &&
          a.owner() === current &&
          revision === version &&
          epoch === storageEpoch;
      setBusy(true);
      saveMessage('Restoring your saved guide…');
      try {
        const data = E.guide(recoveryDraft.guide);
        if (!data.steps.length && !data.title.trim() && !data.cover.enabled)
          throw Error('This recovery copy is empty.');
        await validateImages(data, alive);
        if (!alive()) return;
        recoveryDraft = null;
        projects.guide = data;
        histories.clear();
        redo.clear();
        removed = null;
        changed();
        close();
        open('guide');
        saveMessage('Your saved guide has been recovered.');
      } catch (err) {
        if (alive()) saveMessage('Recovery copy could not be opened: ' + err.message);
      } finally {
        if (room === dialog) setBusy(false);
      }
    }
    async function templateAction(action) {
      if (!store || !storageLoaded || mode !== 'guide') return;
      const current = owner,
        dialog = room,
        epoch = storageEpoch,
        version = revision,
        alive = () =>
          room === dialog && a.ready() && a.owner() === current && epoch === storageEpoch;
      const name =
        action === 'save-template'
          ? $('[data-bc-template-name]').value.trim()
          : $('[data-bc-template]').value;
      if (action === 'apply-template') {
        const template = brandTemplates.find(t => t.name === name);
        if (!template) return;
        const cover = project().cover,
          settings = E.brandTemplate(name, template.settings).settings,
          next = E.guide({
            ...project(),
            ...settings,
            cover: {
              ...settings.cover,
              title: cover.title,
              subtitle: cover.subtitle,
              details: cover.details,
              images: cover.images,
            },
          });
        setBusy(true);
        try {
          if (next.footer.logo)
            await F.loadImage(next.footer.logo, () => alive() && version === revision, 1600, 600);
          if (!alive() || version !== revision) return;
          projects.guide = next;
          drag = null;
          changed();
          $('[data-bc-export-heading]').value = next.exportHeading;
          $('[data-bc-footer-text]').value = next.footer.text;
          $('[data-bc-footer-opacity]').value = Math.round(next.footer.opacity * 100);
          updateBranding();
          updateWorkspace();
          updateCover();
          paint();
          status('Brand template applied. Your screenshots and maintained cover content are kept.');
        } finally {
          if (room === dialog) setBusy(false);
        }
        return;
      }
      let result;
      try {
        result =
          action === 'save-template'
            ? await store.saveTemplate(current, name, project())
            : await store.deleteTemplate(current, name);
      } catch (err) {
        if (alive()) throw err;
        return;
      }
      if (!alive()) return;
      brandTemplates = (result.templates || []).map(t => E.brandTemplate(t.name, t.settings));
      updateWorkspace();
      $('[data-bc-template]').value = action === 'save-template' ? name : '';
      updateWorkspace();
      status(
        action === 'save-template'
          ? 'Brand template saved for future guides.'
          : 'Brand template deleted.'
      );
    }
    function coverFields() {
      return (
        '<details class="bc-cover"><summary>Front cover · text, fonts &amp; images</summary>' +
        '<div class="bc-cover-inner"><label class="bc-object-check"><input type="checkbox" data-bc-cover="enabled">Include a front cover</label>' +
        '<p class="bc-guide-heading-help">An optional opening page before your screenshot steps. Uses your export colours, header appearance and footer. Cover text sizes are in page pixels; images keep their proportions.</p>' +
        '<div data-bc-cover-content hidden><div class="bc-cover-design"><label>Cover design<select data-bc-cover="design">' +
        Object.entries(E.COVER_DESIGNS)
          .map(([id, item]) => '<option value="' + id + '">' + esc(item.label) + '</option>')
          .join('') +
        '</select></label><label>Text alignment<select data-bc-cover="align"><option value="left">Left</option><option value="center">Center</option></select></label></div><p data-bc-cover-description class="bc-guide-heading-help"></p>' +
        '<div class="bc-cover-text-grid">' +
        [
          ['title', 'Cover title', 180, 24, 100],
          ['subtitle', 'Subtitle', 500, 14, 44],
          ['details', 'Details / author / version', 800, 12, 32],
        ]
          .map(
            ([key, label, length, min, max]) =>
              '<fieldset><legend>' +
              label +
              '</legend><label>Text<textarea rows="' +
              (key === 'title' ? 2 : 3) +
              '" maxlength="' +
              length +
              '" data-bc-cover="' +
              key +
              '"' +
              (key === 'title' ? ' placeholder="Uses the guide title when blank"' : '') +
              '></textarea></label>' +
              '<div class="bc-cover-design"><label>Font<select data-bc-cover="' +
              key +
              'Font">' +
              Object.entries(E.GUIDE_FONTS)
                .map(([id, font]) => '<option value="' + id + '">' + esc(font.label) + '</option>')
                .join('') +
              '</select></label><label>Size<input type="number" min="' +
              min +
              '" max="' +
              max +
              '" step="1" data-bc-cover="' +
              key +
              'Size"></label></div></fieldset>'
          )
          .join('') +
        '</div><section class="bc-cover-images"><h3>Cover images <span data-bc-cover-count></span></h3><label class="bc-file-label secondary">+ Add cover images<input type="file" data-bc-cover-files accept="image/png,image/jpeg,image/webp" multiple></label>' +
        '<p class="bc-guide-heading-help">Up to three borderless images. The first image leads the gallery. Transparent PNG and WebP backgrounds sit directly on the page without a frame.</p><div data-bc-cover-images></div></section>' +
        button('preview-cover', 'Preview front cover') +
        '</div></div></details>'
      );
    }
    function stepFields() {
      return (
        '<label class="bc-object-check"><input type="checkbox" data-bc-page-break data-needs-image>Start this step on a new page</label><details class="bc-structured"><summary>Expected result, notes, tips &amp; cautions</summary>' +
        [
          ['expected', 'Expected result', 2000],
          ['notes', 'Notes / prerequisites', 2000],
          ['tip', 'Tip', 1500],
          ['warning', 'Caution', 1500],
        ]
          .map(
            ([key, label, max]) =>
              '<label>' +
              label +
              '<textarea data-bc-step="' +
              key +
              '" maxlength="' +
              max +
              '" rows="3" data-needs-image></textarea></label>'
          )
          .join('') +
        '</details><details class="bc-comparison"><summary>Before-and-after comparison</summary><p class="bc-guide-heading-help">The selected screenshot is Before. Add an After image to display both together in the guide preview and exports. The canvas edits the Before image.</p><label class="bc-file-label secondary">Choose / replace After image<input type="file" data-bc-comparison-file accept="image/png,image/jpeg,image/webp" data-needs-image></label>' +
        '<div data-bc-comparison-content hidden><img data-bc-comparison-preview alt="After screenshot preview"><label>Before label<input maxlength="80" data-bc-comparison="before"></label><label>After label<input maxlength="80" data-bc-comparison="after"></label><label>Arrangement<select data-bc-comparison="orientation"><option value="side">Side by side</option><option value="stack">Stacked vertically</option></select></label>' +
        button('remove-comparison', 'Remove After image') +
        '</div></details>'
      );
    }
    function updateStepFields() {
      if (mode !== 'guide' || !room) return;
      const s = step();
      for (const el of room.querySelectorAll('[data-bc-step]'))
        if (document.activeElement !== el) el.value = s?.[el.dataset.bcStep] || '';
      $('[data-bc-page-break]').checked = !!s?.pageBreakBefore;
      $('[data-bc-comparison-content]').hidden = !s?.comparison;
      const img = $('[data-bc-comparison-preview]');
      if (s?.comparison) {
        if (img.getAttribute('src') !== s.comparison.image.src) img.src = s.comparison.image.src;
        for (const el of room.querySelectorAll('[data-bc-comparison]'))
          if (document.activeElement !== el) el.value = s.comparison[el.dataset.bcComparison];
      } else img.removeAttribute('src');
    }
    async function addComparison(file) {
      guard();
      const s = step();
      if (!file || busy || !s || mode !== 'guide') return;
      const dialog = room,
        current = owner,
        version = revision,
        job = loadId,
        alive = () =>
          room === dialog &&
          a.ready() &&
          a.owner() === current &&
          version === revision &&
          job === loadId &&
          step() === s;
      setBusy(true);
      status('Preparing the After image locally…');
      try {
        const img = await F.imageFromFile(file, alive);
        if (!alive()) return;
        const comparison = E.comparison({ ...(s.comparison || {}), image: img }),
          checked = E.guide({
            ...project(),
            steps: project().steps.map(t => (t === s ? { ...t, comparison } : t)),
          }).steps.find(t => t.id === s.id);
        remember();
        s.comparison = checked.comparison;
        changed();
        updateStepFields();
        status('Before-and-after comparison added. Open the live preview to see both images.');
      } catch (err) {
        if (alive()) throw err;
      } finally {
        if (room === dialog) setBusy(false);
      }
    }
    function updateCover() {
      if (mode !== 'guide' || !room) return;
      const cover = project().cover;
      for (const el of room.querySelectorAll('[data-bc-cover]')) {
        const value = cover[el.dataset.bcCover];
        if (el.type === 'checkbox') el.checked = value;
        else if (document.activeElement !== el) el.value = value;
      }
      $('[data-bc-cover-content]').hidden = !cover.enabled;
      $('[data-bc-cover-description]').textContent = E.COVER_DESIGNS[cover.design].description;
      $('[data-bc-cover-count]').textContent = cover.images.length + ' / 3';
      $('[data-bc-cover-files]').disabled = busy || cover.images.length >= 3;
      const list = $('[data-bc-cover-images]');
      if (
        cover.images.length !== coverImageRefs.length ||
        cover.images.some((img, i) => img.src !== coverImageRefs[i]) ||
        (cover.images.length && !list.children.length)
      ) {
        coverImageRefs = cover.images.map(img => img.src);
        list.innerHTML = cover.images
          .map(
            (img, i) =>
              '<article><img src="' +
              img.src +
              '" alt="Cover image ' +
              (i + 1) +
              '"><div><strong>Image ' +
              (i + 1) +
              '</strong><div class="bc-object-actions">' +
              button(
                'cover-up',
                'Move earlier',
                'data-index="' + i + '"' + (i === 0 ? ' disabled' : '')
              ) +
              button(
                'cover-down',
                'Move later',
                'data-index="' + i + '"' + (i === cover.images.length - 1 ? ' disabled' : '')
              ) +
              button('cover-remove', 'Remove image', 'data-index="' + i + '"') +
              '</div></div></article>'
          )
          .join('');
      }
      for (const el of list.querySelectorAll('button'))
        el.disabled =
          busy ||
          (el.dataset.bc === 'cover-up' && +el.dataset.index === 0) ||
          (el.dataset.bc === 'cover-down' && +el.dataset.index === cover.images.length - 1);
      $('[data-bc="preview-steps"]').hidden = !cover.enabled;
      $('[data-bc="preview-steps"]').disabled = busy || !project().steps.length;
      $('[data-bc="preview-page"]').textContent = cover.enabled ? 'Front cover' : 'Full page';
      $('[data-bc="refresh-preview"]').disabled =
        busy || (!project().steps.length && !cover.enabled);
    }
    function editCover(el) {
      const key = el.dataset.bcCover,
        value = el.type === 'checkbox' ? el.checked : el.type === 'number' ? +el.value : el.value;
      try {
        project().cover = E.cover({ ...project().cover, [key]: value });
        if (key === 'enabled') {
          guidePreviewView = 'page';
          revealGuidePreview();
        }
        changed();
        updateCover();
      } catch (err) {
        status(err.message, true);
      }
    }
    async function addCoverImages(files) {
      guard();
      if (busy || mode !== 'guide') return;
      const list = [...files];
      if (!list.length) return;
      if (project().cover.images.length + list.length > 3)
        throw Error(
          'A cover can contain up to three images. Remove an image before adding another.'
        );
      const dialog = room,
        current = owner,
        version = revision,
        job = loadId,
        alive = () =>
          room === dialog &&
          a.ready() &&
          a.owner() === current &&
          revision === version &&
          job === loadId;
      setBusy(true);
      status('Preparing cover images locally…');
      try {
        const additions = [];
        for (const file of list) {
          additions.push(await F.imageFromFile(file, alive));
          if (!alive()) return;
        }
        const cover = E.guide({
          ...project(),
          cover: { ...project().cover, images: [...project().cover.images, ...additions] },
        }).cover;
        if (!alive()) return;
        project().cover = cover;
        changed();
        updateCover();
        status('Cover images added. Preview front cover to review the design.');
      } catch (err) {
        if (alive()) throw err;
      } finally {
        if (room === dialog) setBusy(false);
      }
    }
    async function addLayers(files) {
      guard();
      const s = step(),
        list = [...files];
      if (busy || !s || !image || !list.length) return;
      if (s.marks.length + list.length > E.LIMITS.marks)
        throw Error(
          'This screenshot has too many objects. Delete some before adding image layers.'
        );
      const dialog = room,
        current = owner,
        version = revision,
        job = loadId,
        alive = () =>
          room === dialog &&
          a.ready() &&
          a.owner() === current &&
          revision === version &&
          job === loadId &&
          step() === s;
      setBusy(true);
      status('Preparing image layers locally…');
      try {
        const additions = [],
          area = s.crop || { x: 0, y: 0, w: 1, h: 1 };
        for (const [i, file] of list.entries()) {
          const img = await F.imageFromFile(file, alive);
          if (!alive()) return;
          const scale = Math.min(
              (area.w * s.image.width * 0.6) / img.width,
              (area.h * s.image.height * 0.6) / img.height
            ),
            w = (img.width * scale) / s.image.width,
            h = (img.height * scale) / s.image.height,
            x = Math.min(area.x + area.w - w, area.x + (area.w - w) / 2 + i * 0.025),
            y = Math.min(area.y + area.h - h, area.y + (area.h - h) / 2 + i * 0.025);
          additions.push({
            type: 'image',
            image: img,
            name: String(file.name || 'Image layer').slice(0, 120),
            opacity: 1,
            color: '#183b35',
            size: 0.01,
            points: [
              [x, y],
              [x + w, y + h],
            ],
          });
        }
        E.guide({
          ...project(),
          steps: project().steps.map(t =>
            t === s ? { ...t, marks: [...s.marks, ...additions] } : t
          ),
        });
        const decoded = await F.loadLayers({ marks: additions }, alive);
        if (!alive()) return;
        for (const [src, img] of decoded) layerImages.set(src, img);
        tool = 'object';
        commitMarks([...s.marks, ...additions], s.marks.length + additions.length - 1);
        status(
          'Image layer added. Drag to move, drag a corner to resize, and use Bring to front / Send to back to stack it.'
        );
      } catch (err) {
        if (alive()) throw err;
      } finally {
        if (room === dialog) setBusy(false);
      }
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
        '<p class="bc-guide-heading-help">Every exported page, including the cover, contents and continued instructions. Changes update automatically.</p></div><div class="bc-preview-views" role="group" aria-label="Preview view">' +
        button('preview-page', 'Full page', 'aria-pressed="true"') +
        button('preview-steps', 'First guide page', 'aria-pressed="false" hidden') +
        button('preview-footer', 'Footer close-up', 'aria-pressed="false"') +
        button('refresh-preview', 'Refresh preview', 'data-needs-steps') +
        '</div></div>' +
        '<p data-bc-preview-status role="status" aria-live="polite">Add a screenshot to preview your guide.</p>' +
        '<div class="bc-preview-nav" data-bc-preview-nav hidden>' +
        button('preview-prev', '← Previous page') +
        '<label>Page<select data-bc-preview-select></select></label>' +
        button('preview-next', 'Next page →') +
        '<span data-bc-preview-total></span><label>Zoom<input type="range" min="40" max="200" value="100" data-bc-preview-zoom><output data-bc-preview-zoom-value>100%</output></label>' +
        button('preview-fit', 'Fit preview') +
        '</div>' +
        '<div class="bc-document-preview"><nav data-bc-preview-thumbs aria-label="Document page thumbnails" hidden></nav><div class="bc-preview-reader" data-bc-preview-reader><div class="bc-page-sheet" data-bc-page-sheet hidden><canvas data-bc-page-preview role="img" aria-label="Preview of the exported guide page"></canvas></div></div></div></section></div></details>'
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
      const layoutSelect = $('[data-bc-layout]');
      if (project().layout === 'classic' && !layoutSelect.querySelector('[value="classic"]')) {
        const option = document.createElement('option');
        option.value = 'classic';
        option.textContent = 'Original layout (minimal)';
        layoutSelect.prepend(option);
      }
      layoutSelect.value = project().layout;
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
      guidePreviewPages = [];
      guidePreviewRevision = -1;
      guidePreviewIndex = 0;
    }
    function updatePreviewNavigation() {
      if (mode !== 'guide' || !room) return;
      const nav = $('[data-bc-preview-nav]'),
        thumbs = $('[data-bc-preview-thumbs]'),
        select = $('[data-bc-preview-select]'),
        stale = guidePreviewRevision !== revision;
      nav.hidden = thumbs.hidden = !guidePreviewPages.length;
      if (!guidePreviewPages.length) return;
      if (thumbs.dataset.revision !== String(guidePreviewRevision)) {
        thumbs.dataset.revision = String(guidePreviewRevision);
        const label = p =>
          p.index +
          1 +
          ' · ' +
          (p.kind === 'cover' ? 'Cover' : p.kind === 'contents' ? 'Contents' : 'Guide page');
        thumbs.innerHTML = guidePreviewPages
          .map(p =>
            button(
              'preview-go',
              '<img alt="" src="' + p.thumbnail + '"><span>' + esc(label(p)) + '</span>',
              'data-index="' + p.index + '" aria-label="' + esc(label(p)) + '"'
            )
          )
          .join('');
        select.innerHTML = guidePreviewPages
          .map(p => '<option value="' + p.index + '">' + esc(label(p)) + '</option>')
          .join('');
      }
      select.value = String(guidePreviewIndex);
      select.disabled = stale || busy;
      $('[data-bc="preview-prev"]').disabled = stale || busy || guidePreviewIndex <= 0;
      $('[data-bc="preview-next"]').disabled =
        stale || busy || guidePreviewIndex >= guidePreviewPages.length - 1;
      for (const el of thumbs.querySelectorAll('button')) {
        el.disabled = stale || busy;
        if (+el.dataset.index === guidePreviewIndex) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
      }
      $('[data-bc-preview-total]').textContent =
        'Page ' + (guidePreviewIndex + 1) + ' of ' + guidePreviewPages.length;
      $('[data-bc-preview-zoom]').value = Math.round(guidePreviewZoom * 100);
      $('[data-bc-preview-zoom-value]').textContent = Math.round(guidePreviewZoom * 100) + '%';
    }
    function paintGuidePreview() {
      const canvas = $('[data-bc-page-preview]'),
        sheet = $('[data-bc-page-sheet]');
      if (!canvas || !sheet) return;
      $('[data-bc="preview-page"]').setAttribute(
        'aria-pressed',
        String(guidePreviewView === 'page')
      );
      $('[data-bc="preview-steps"]').setAttribute(
        'aria-pressed',
        String(guidePreviewView === 'steps')
      );
      $('[data-bc="preview-footer"]').setAttribute(
        'aria-pressed',
        String(guidePreviewView === 'footer')
      );
      if (!guidePreviewPage) return;
      const top =
          guidePreviewView === 'footer'
            ? Math.max(0, guidePreviewPage.height - 414 * (guidePreviewPage.pageScale || 1))
            : 0,
        height = guidePreviewPage.height - top;
      canvas.width = Math.min(guidePreviewPage.width, Math.round(620 * guidePreviewZoom));
      canvas.height = Math.round((height * canvas.width) / guidePreviewPage.width);
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
      sheet.style.width = Math.round(620 * guidePreviewZoom) + 'px';
      sheet.style.maxWidth = 'none';
      canvas.setAttribute(
        'aria-label',
        guidePreviewPages.length
          ? (guidePreviewView === 'footer' ? 'Footer close-up · ' : '') +
              (guidePreviewPages[guidePreviewIndex]?.kind === 'cover'
                ? 'Front cover'
                : 'Document page ' + (guidePreviewIndex + 1))
          : guidePreviewView === 'footer'
            ? 'Footer close-up of the first exported page'
            : guidePreviewView === 'steps'
              ? 'First guide page after the cover'
              : project().cover.enabled
                ? 'Front cover preview'
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
      updatePreviewNavigation();
    }
    function scheduleGuidePreview(delay = 200) {
      clearTimeout(guidePreviewTimer);
      guidePreviewJob++;
      updatePreviewNavigation();
      if (!previewVisible()) return;
      if (project().steps.length || project().cover.enabled) {
        $('[data-bc-preview-status]').textContent = 'Updating preview…';
        guidePreviewTimer = setTimeout(() => {
          void renderGuidePreview();
        }, delay);
      } else {
        if (guidePreviewPage) F.release(guidePreviewPage);
        guidePreviewPage = null;
        guidePreviewPages = [];
        guidePreviewRevision = -1;
        updatePreviewNavigation();
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
      if (!previewVisible() || (!project().steps.length && !project().cover.enabled)) return;
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
        if (F.documentPreview && F.previewPage) {
          if (guidePreviewRevision !== version) {
            const result = await F.documentPreview(snapshot, alive, n => {
              if (alive())
                $('[data-bc-preview-status]').textContent =
                  'Preparing document preview · ' + n + ' pages…';
            });
            page = result.firstPage;
            if (!alive()) return;
            guidePreviewPages = result.pages;
            guidePreviewIndex = Math.min(
              guidePreviewIndex,
              Math.max(0, guidePreviewPages.length - 1)
            );
            if (guidePreviewView === 'steps')
              guidePreviewIndex = Math.max(
                0,
                guidePreviewPages.findIndex(p => p.kind === 'steps')
              );
            guidePreviewRevision = version;
            if (guidePreviewIndex !== 0) {
              F.release(page);
              page = null;
              page = await F.previewPage(snapshot, guidePreviewIndex, alive);
            }
          } else page = await F.previewPage(snapshot, guidePreviewIndex, alive);
        } else page = await F.preview(snapshot, alive, guidePreviewView === 'steps');
        if (!alive()) return;
        if (guidePreviewPage) F.release(guidePreviewPage);
        guidePreviewPage = page;
        page = null;
        paintGuidePreview();
        $('[data-bc-preview-status]').textContent = guidePreviewPages.length
          ? (E.GUIDE_LAYOUTS[snapshot.layout]?.label || 'Original layout') +
            ' · ' +
            guidePreviewPages.length +
            ' pages · ' +
            E.EXPORT_QUALITY[snapshot.quality].label +
            ' preview ready.'
          : (snapshot.cover.enabled && guidePreviewView !== 'steps'
              ? 'Front cover'
              : E.GUIDE_LAYOUTS[snapshot.layout]?.label || 'Original layout') +
            ' preview ready. Full exports include all steps and continuation pages.';
      } catch (err) {
        if (alive()) {
          if (guidePreviewPage) F.release(guidePreviewPage);
          guidePreviewPage = null;
          guidePreviewPages = [];
          guidePreviewRevision = -1;
          updatePreviewNavigation();
          $('[data-bc-page-sheet]').hidden = true;
          $('[data-bc-preview-status]').textContent = 'Preview unavailable: ' + err.message;
        }
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
      if (mode === 'guide') {
        guidePreviewRevision = -1;
        scheduleDraft();
      }
    }
    function close() {
      if (mode === 'guide') void flushDraft();
      if (paintFrame) root.cancelAnimationFrame(paintFrame);
      paintFrame = 0;
      loadId++;
      changed();
      cancelGuidePreview();
      clearTimeout(draftTimer);
      draftTimer = 0;
      drag = null;
      pan = null;
      image = null;
      layerImages.clear();
      layerLoadJob++;
      layerLoadKey = '';
      coverImageRefs = [];
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
        brandTemplates = [];
        recoveryDraft = null;
        storageLoaded = false;
        autoSave = true;
        storageEpoch++;
        draftJob++;
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
        '</article></div><p class="bc-local-note">Local editing · No AI · No image uploads. Guide recovery drafts and brand templates can be saved on this device for your account. Save an editable file for an external copy.</p></section>'
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
      $('[data-bc="undo"]').disabled = busy || !s || !histories.get(s.id)?.length;
      $('[data-bc="redo"]').disabled = busy || !s || !redo.get(s.id)?.length;
      for (const el of room.querySelectorAll('[data-needs-image]'))
        el.disabled = busy || !s || !image;
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
      updateCover();
      updateWorkspace();
      const name = $('[data-bc-document-name]');
      if (name) name.textContent = project().title || 'Untitled guide';
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
      const sources = new Set(s.marks.filter(m => m.type === 'image').map(m => m.image.src));
      for (const src of layerImages.keys()) if (!sources.has(src)) layerImages.delete(src);
      if ([...sources].some(src => !layerImages.has(src))) {
        const key = selected + '|' + revision + '|' + loadId;
        if (layerLoadKey !== key) {
          layerLoadKey = key;
          const dialog = room,
            current = owner,
            version = revision,
            job = ++layerLoadJob,
            alive = () =>
              room === dialog &&
              a.ready() &&
              a.owner() === current &&
              revision === version &&
              step() === s &&
              job === layerLoadJob;
          void F.loadLayers(s, alive)
            .then(layers => {
              if (alive()) {
                layerImages = layers;
                layerLoadKey = '';
                paint();
              }
            })
            .catch(err => {
              if (alive()) status(err.message, true);
            });
        }
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
      F.draw(c, preview, image, original, layerImages);
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
      layerImages.clear();
      layerLoadJob++;
      layerLoadKey = '';
      drag = null;
      const s = step(),
        job = ++loadId,
        current = owner;
      thumbs();
      controls();
      updateStepFields();
      if (!s) return;
      $('[data-bc-step-title]').value = s.title;
      $('[data-bc-caption]').value = s.caption;
      updateStepFields();
      const alive = () => !!room && job === loadId && a.ready() && current === a.owner();
      status('Opening screenshot…');
      try {
        const img = await F.loadImage(s.image, alive),
          layers = await F.loadLayers(s, alive);
        if (!alive()) return;
        image = img;
        layerImages = layers;
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
      history.push({ marks: s.marks, crop: s.crop, comparison: s.comparison || null });
      histories.set(s.id, history.slice(-30));
      redo.set(s.id, []);
    }
    function undoEdit(forward) {
      const s = step();
      if (!s) return;
      const from = forward ? redo : histories,
        to = forward ? histories : redo,
        list = from.get(s.id) || [],
        state = list.at(-1);
      if (!state) return;
      let checked;
      try {
        checked = E.guide({
          ...project(),
          steps: project().steps.map(t => (t === s ? { ...t, ...state } : t)),
        }).steps.find(t => t.id === s.id);
      } catch (err) {
        status(err.message, true);
        return;
      }
      list.pop();
      const target = to.get(s.id) || [];
      target.push({ marks: s.marks, crop: s.crop, comparison: s.comparison || null });
      to.set(s.id, target);
      s.marks = checked.marks;
      s.crop = checked.crop;
      s.comparison = checked.comparison;
      changed();
      updateStepFields();
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
        if (mode === 'guide') setWorkspace('edit');
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
      if (!snapshot.steps.length && !(format === 'editable' && snapshot.cover.enabled))
        throw Error('Add a screenshot first.');
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
        await validateImages(data, alive);
        if (!alive()) return;
        projects.guide = data;
        recoveryDraft = null;
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
      tool = value === 'guide' ? 'object' : 'cover';
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
            '"></label><div><label class="bc-guide-name">Header appearance<select data-bc-header-style aria-describedby="bcHeaderHelp">' +
            Object.entries(E.GUIDE_HEADERS)
              .map(
                ([id, header]) => '<option value="' + id + '">' + esc(header.label) + '</option>'
              )
              .join('') +
            '</select></label><p id="bcHeaderHelp" data-bc-header-help class="bc-guide-heading-help"></p></div><div><label class="bc-guide-name">Export heading<input data-bc-export-heading maxlength="180" aria-describedby="bcExportHeadingHelp" placeholder="e.g. MY COMPANY / USER GUIDE" value="' +
            esc(project().exportHeading) +
            '"></label><p id="bcExportHeadingHelp" class="bc-guide-heading-help">Shown when a header is enabled. Leave blank to hide this text; Header appearance controls the band and guide title. Saved with your editable guide.</p></div></div>' +
            '<div class="bc-guide-layout"><label class="bc-guide-name">Export layout<select data-bc-layout aria-describedby="bcLayoutHelp">' +
            (project().layout === 'classic'
              ? '<option value="classic">Original layout (minimal)</option>'
              : '') +
            Object.entries(E.GUIDE_LAYOUTS)
              .map(
                ([id, layout]) => '<option value="' + id + '">' + esc(layout.label) + '</option>'
              )
              .join('') +
            '</select></label><p id="bcLayoutHelp" data-bc-layout-help class="bc-guide-heading-help"></p></div>' +
            workspaceFields() +
            coverFields() +
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
        '<label class="bc-file-label secondary">+ Add image layer<input type="file" data-bc-layer-files accept="image/png,image/jpeg,image/webp" multiple data-needs-image></label>' +
        button('delete-object', 'Delete selected object', 'class="bc-delete-object" disabled') +
        '</div><p class="bc-selection-help" data-bc-selection-status></p><div class="bc-tool-options"><label>Colour<input type="color" data-bc-color value="#183b35"></label><label data-bc-brush-control><span data-bc-size-label>Brush size</span><input type="range" data-bc-size min="2" max="80" value="24" aria-label="Brush or border thickness"></label>' +
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
        '</h3><label>Step title<input data-bc-step-title maxlength="180" placeholder="Give this step a clear name" data-needs-image></label><label>' +
        (guideMode ? 'Action / instructions' : 'Caption') +
        '<textarea data-bc-caption maxlength="8000" rows="6" placeholder="What should the reader do or notice?" data-needs-image></textarea></label>' +
        (guideMode ? stepFields() : '') +
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
        '<p class="bc-draft-note">Guide recovery copies can be saved on this device for your account. Save an editable guide for an external copy. Editable files retain original images; PDF / JPG / PNG exports contain your finished edits.</p></aside></div><footer class="bc-footer"><div class="bc-export-actions">' +
        (guideMode
          ? '<label>Export format<select data-bc-format><option value="pdf">PDF guide</option><option value="jpg-images">JPG pages in ZIP</option><option value="images">PNG pages in ZIP</option><option value="pdf-zip">PDF in ZIP</option></select></label><label>Export quality<select data-bc-quality>' +
            Object.entries(E.EXPORT_QUALITY)
              .map(([key, value]) => '<option value="' + key + '">' + value.label + '</option>')
              .join('') +
            '</select><small>Small for sharing; print quality for sharper pages and larger files.</small></label>'
          : '') +
        button('export', guideMode ? 'Prepare guide' : 'Prepare edited PNG', 'class="bc-primary"') +
        button('editable', 'Save editable guide') +
        '</div><div data-bc-ready class="bc-ready"></div><p data-bc-status role="status" aria-live="polite">Images and edits stay local to this browser. No records are changed.</p></footer></div>';
      mountGuideLayout();
      room.addEventListener('cancel', event => {
        if (event.target !== event.currentTarget) return;
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
        if (el.matches('[data-bc-header-style]')) {
          project().page = E.pageOptions({ ...project().page, headerStyle: el.value });
          revealGuidePreview();
          changed();
          updateWorkspace();
        }
        if (el.matches('[data-bc-quality],[data-bc-contents]')) {
          if (el.matches('[data-bc-quality]')) project().quality = el.value;
          else project().contents = el.checked;
          revealGuidePreview();
          changed();
          updateWorkspace();
        }
        if (el.matches('[data-bc-template]')) updateWorkspace();
        if (el.matches('[data-bc-preview-select]')) {
          guidePreviewIndex = +el.value;
          guidePreviewView = 'page';
          scheduleGuidePreview(0);
        }
        if (el.matches('[data-bc-autosave]') && store) {
          autoSave = el.checked;
          clearTimeout(draftTimer);
          draftJob++;
          const current = owner,
            epoch = storageEpoch,
            enabled = autoSave;
          void store
            .setAutoSave(current, enabled)
            .then(() => {
              if (owner !== current || epoch !== storageEpoch || autoSave !== enabled) return;
              if (enabled) scheduleDraft();
              else saveMessage('Recovery saving is off. Save an editable guide to keep your work.');
            })
            .catch(err => {
              if (owner === current && epoch === storageEpoch) saveMessage(err.message);
            });
        }
        if (el.matches('[data-bc-comparison-file]')) {
          void addComparison(el.files[0]).catch(err => status(err.message, true));
          el.value = '';
        }
        if (el.matches('[data-bc-page-break]') && step()) {
          step().pageBreakBefore = el.checked;
          changed();
        }
        if (el.matches('[data-bc-comparison="orientation"]') && step()?.comparison) {
          step().comparison = E.comparison({ ...step().comparison, orientation: el.value });
          changed();
        }
        if (el.matches('[data-bc-cover]') && (el.tagName === 'SELECT' || el.type === 'checkbox'))
          editCover(el);
        if (el.matches('[data-bc-cover-files]')) {
          void addCoverImages(el.files).catch(err => status(err.message, true));
          el.value = '';
        }
        if (el.matches('[data-bc-layer-files]')) {
          void addLayers(el.files).catch(err => status(err.message, true));
          el.value = '';
        }
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
          revealGuidePreview();
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
        if (el.matches('[data-bc-page]')) {
          project().page = E.pageOptions({ ...project().page, [el.dataset.bcPage]: +el.value });
          revealGuidePreview();
          changed();
          updateWorkspace();
        }
        if (el.matches('[data-bc-preview-zoom]')) {
          guidePreviewZoom = +el.value / 100;
          paintGuidePreview();
        }
        if (el.matches('[data-bc-step]') && s) {
          s[el.dataset.bcStep] = el.value;
          changed();
        }
        if (el.matches('[data-bc-comparison]') && el.tagName !== 'SELECT' && s?.comparison) {
          s.comparison = E.comparison({ ...s.comparison, [el.dataset.bcComparison]: el.value });
          changed();
        }
        if (el.matches('[data-bc-cover]') && el.tagName !== 'SELECT' && el.type !== 'checkbox')
          editCover(el);
        if (el.matches('[data-bc-title]')) {
          project().title = el.value;
          const name = $('[data-bc-document-name]');
          if (name) name.textContent = el.value || 'Untitled guide';
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
        const menu = event.target.closest?.('.bc-more-tools');
        if (event.key === 'Escape' && menu?.open) {
          event.preventDefault();
          event.stopPropagation();
          menu.open = false;
          menu.querySelector('summary').focus();
          return;
        }
        if (menu?.open && event.key.startsWith('Arrow')) return;
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
        if (event.target.open && workspace === 'edit') setWorkspace('design');
        if (!previewVisible()) pauseGuidePreview();
        else if (guidePreviewPage && guidePreviewRevision === revision) paintGuidePreview();
        else scheduleGuidePreview(0);
      });
      document.body.classList.add('bc-room-open');
      room.showModal();
      updateBranding();
      thumbs();
      controls();
      void select(project().steps[0]?.id || '');
      if (guideMode) void checkStored();
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
      if (action === 'workspace') {
        setWorkspace(el.dataset.workspace);
        return;
      }
      const s = step();
      if (['save-template', 'delete-template', 'apply-template'].includes(action)) {
        await templateAction(action);
        return;
      }
      if (action === 'restore-recovery') {
        await restoreRecovery();
        return;
      }
      if (action === 'keep-current') {
        recoveryDraft = null;
        updateWorkspace();
        scheduleDraft();
        return;
      }
      if (action === 'clear-recovery' && store) {
        const current = owner,
          epoch = storageEpoch,
          previous = autoSave;
        autoSave = false;
        clearTimeout(draftTimer);
        draftJob++;
        try {
          await store.clearDraft(current);
          if (owner !== current || epoch !== storageEpoch) return;
          recoveryDraft = null;
          updateWorkspace();
          saveMessage(
            'Recovery copy cleared. Your open guide is kept; automatic recovery saving is now off.'
          );
        } catch (err) {
          if (owner === current && epoch === storageEpoch) {
            autoSave = previous;
            updateWorkspace();
            saveMessage(err.message);
          }
        }
        return;
      }
      if (action === 'reset-page') {
        project().page = E.pageOptions();
        changed();
        updateWorkspace();
        return;
      }
      if (action === 'remove-comparison' && s?.comparison) {
        remember();
        s.comparison = null;
        changed();
        updateStepFields();
        return;
      }
      if (['preview-prev', 'preview-next', 'preview-go'].includes(action)) {
        if (guidePreviewRevision !== revision) return;
        const index =
          action === 'preview-go'
            ? +el.dataset.index
            : guidePreviewIndex + (action === 'preview-prev' ? -1 : 1);
        if (!Number.isInteger(index) || index < 0 || index >= guidePreviewPages.length) return;
        guidePreviewIndex = index;
        guidePreviewView = 'page';
        scheduleGuidePreview(0);
        return;
      }
      if (action === 'preview-fit') {
        guidePreviewZoom = Math.max(
          0.4,
          Math.min(2, (($('[data-bc-preview-reader]').clientWidth || 640) - 24) / 620)
        );
        paintGuidePreview();
        return;
      }
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
      if (['preview-page', 'preview-footer', 'preview-steps'].includes(action)) {
        if (guidePreviewPages.length && F.documentPreview) {
          guidePreviewView =
            action === 'preview-footer' ? 'footer' : action === 'preview-steps' ? 'steps' : 'page';
          if (action === 'preview-footer') paintGuidePreview();
          else {
            guidePreviewIndex =
              action === 'preview-steps'
                ? Math.max(
                    0,
                    guidePreviewPages.findIndex(p => p.kind === 'steps')
                  )
                : 0;
            scheduleGuidePreview(0);
          }
          return;
        }
        const previous = guidePreviewView;
        guidePreviewView =
          action === 'preview-page' ? 'page' : action === 'preview-steps' ? 'steps' : 'footer';
        if ((previous === 'steps') !== (guidePreviewView === 'steps')) {
          scheduleGuidePreview(0);
          return;
        }
        paintGuidePreview();
        return;
      }
      if (action === 'preview-cover') {
        guidePreviewView = 'page';
        guidePreviewIndex = 0;
        revealGuidePreview();
        scheduleGuidePreview(0);
        return;
      }
      if (['cover-remove', 'cover-up', 'cover-down'].includes(action) && mode === 'guide') {
        const images = [...project().cover.images],
          i = +el.dataset.index;
        if (!Number.isInteger(i) || i < 0 || i >= images.length) return;
        if (action === 'cover-remove') images.splice(i, 1);
        else {
          const next = i + (action === 'cover-up' ? -1 : 1);
          if (next < 0 || next >= images.length) return;
          [images[i], images[next]] = [images[next], images[i]];
        }
        project().cover = E.cover({ ...project().cover, images });
        changed();
        updateCover();
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
        const steps = [...project().steps];
        steps.splice(removed.index, 0, removed.step);
        project().steps = E.guide({ ...project(), steps }).steps;
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
      const menu = room?.querySelector('.bc-more-tools');
      if (menu?.open && !menu.contains(event.target)) menu.open = false;
      const el = event.target.closest?.('[data-bc],[data-bc-tool]');
      if (!el) return;
      event.preventDefault();
      if (el.hasAttribute('data-bc-tool')) {
        if (!busy) {
          const menu = el.closest('.bc-more-tools');
          if (menu) menu.open = false;
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
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && mode === 'guide') void flushDraft();
    });
    return {
      cards,
      decorateModal,
      sync,
      open,
      close,
      add,
      addLogo,
      addLayers,
      addCoverImages,
      addComparison,
      flushDraft,
      preview: async () => {
        if (mode === 'guide' && workspace === 'edit') setWorkspace('preview');
        return renderGuidePreview();
      },
      workspace: setWorkspace,
      select,
      prepare,
      importGuide,
      handle,
    };
  }
  root.WorkHubBatchC = { install };
})(window);
