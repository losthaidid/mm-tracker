/* One local file, explicit destination. Existing module drop zones and task sorting keep ownership. */
(function (root) {
  'use strict';
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const kind = file =>
    /\.xlsx?$/i.test(file.name)
      ? 'excel'
      : /\.(json|xml|txt|idoc|csv|tsv)$/i.test(file.name)
        ? 'text'
        : /\.(png|jpe?g|webp)$/i.test(file.name)
          ? 'image'
          : /\.pdf$/i.test(file.name)
            ? 'pdf'
            : 'other';
  function choices(file, a) {
    const type = kind(file),
      can = (f, op = 'view') => a.can(f, 'view') && a.can(f, op),
      rows = [];
    const add = (id, title, note, max, permission, extra = '') => {
      if (permission)
        rows.push({
          id,
          title,
          note,
          disabled:
            file.size > max
              ? 'This tool accepts files below ' + Math.round(max / 1000000) + ' MB.'
              : extra,
        });
    };
    if (type === 'excel') {
      add(
        'excel-report',
        'Excel report',
        'Choose columns, search live and check a pasted list. Local processing.',
        50000000,
        can('validator', 'run')
      );
      if (/\.xlsx$/i.test(file.name))
        add(
          'validator',
          'Validate with a template',
          'Use your selected validation template. Local processing.',
          50000000,
          can('validator', 'run'),
          !a.templateReady() ? 'Choose a validation template first in Validation Studio.' : ''
        );
    }
    if (type === 'text' && /\.(json|xml|txt|idoc)$/i.test(file.name))
      add(
        'reader',
        'JSON & IDoc reader',
        'Explore and search the source locally.',
        2000000,
        can('studio') && can('studio.reader', 'run')
      );
    if (type === 'excel' || /\.(txt|csv|tsv)$/i.test(file.name))
      add(
        'issues',
        'Go-Live issue import',
        'Review and map columns before adding issues to the active project.',
        50000000,
        can('specs', 'edit'),
        !a.activeProject() ? 'Choose an active project first.' : ''
      );
    if (type === 'image')
      add(
        'guide',
        'Screenshot guide',
        'Add this file to your local guide editor.',
        8388608,
        can('studio') && can('studio.screenshots', 'run')
      );
    if (type === 'pdf')
      add(
        'statement',
        'TNG statement extractor',
        'Review extracted statement entries before saving.',
        20000000,
        can('schedule', 'create')
      );
    add(
      'drive',
      'Upload original to Google Drive',
      'Review the upload form. Nothing uploads until you confirm Upload.',
      50000000,
      can('files', 'create') && can('files', 'export'),
      a.driveReady() ? '' : 'Connect Google Drive in Files first.'
    );
    return rows;
  }
  function install(a) {
    let file = null,
      owner = '',
      serial = 0,
      busy = false,
      depth = 0;
    const ready = () => a.cloud().ready && !!a.cloud().user?.id,
      current = () => a.cloud().user?.id || '';
    const native = target =>
      !!target.closest?.(
        '#dataReader,#valDropzone,[data-column-id],#batchCRoom,#tngStudio,[data-excel-drop],input,textarea,[contenteditable="true"]'
      );
    function hideDrop() {
      depth = 0;
      document.getElementById('flDropHint')?.remove();
    }
    function sync() {
      if (!ready() || owner !== current()) {
        serial++;
        file = null;
        busy = false;
        hideDrop();
        if (document.getElementById('flChooser')) {
          a.closeModal();
          document.getElementById('flChooser')?.remove();
        }
        owner = ready() ? current() : '';
      }
      const toolbar = document.getElementById('hubToolbar');
      if (toolbar && !document.getElementById('flOpen')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'flOpen';
        b.dataset.fl = 'open';
        b.textContent = '↥ Open file';
        toolbar.append(b);
      }
      if (!document.getElementById('flInput')) {
        const input = document.createElement('input');
        input.id = 'flInput';
        input.type = 'file';
        input.hidden = true;
        document.body.append(input);
      }
    }
    async function open(next) {
      sync();
      if (!ready() || !next) return;
      const token = ++serial,
        account = current();
      if (
        a.unfinished() &&
        !(await root.WorkHubDialogs.confirm(
          'Open this file in another tool? Leave the current editor only if your changes are saved. Cancel to keep working.'
        ))
      )
        return;
      if (!ready() || account !== current() || token !== serial) return;
      file = next;
      const rows = choices(file, a);
      a.openModal(
        'Open file · choose a tool',
        `<section id="flChooser"><span class="hub-kicker">ONE FILE, THE RIGHT TOOL</span><h3>${esc(file.name)}</h3><p class="hub-meta">${esc(kind(file))} · ${(file.size / 1000000).toFixed(2)} MB · ${esc(file.type || 'Type inferred from extension')}</p><p>Choose where to open this file. Analysis stays on this device; Google Drive uses its separate upload form.</p><div class="fl-tools">${rows.map(r => `<button type="button" data-fl="target" data-target="${r.id}"${r.disabled ? ' disabled' : ''}><span><strong>${esc(r.title)}</strong><small>${esc(r.disabled || r.note)}</small></span><span aria-hidden="true">↗</span></button>`).join('') || '<p>No compatible tools are available to this account for this file type.</p>'}</div><p id="flStatus" role="status"></p><div class="actions"><button type="button" data-fl="cancel">Cancel</button><button type="button" data-fl="open">Choose another file</button></div></section>`
      );
    }
    async function launch(id) {
      if (busy || !file || !ready() || owner !== current()) return;
      const choice = choices(file, a).find(c => c.id === id);
      if (!choice || choice.disabled) throw Error('This destination is no longer available.');
      const next = file,
        account = owner,
        token = ++serial;
      busy = true;
      try {
        a.closeModal();
        await a.launch(id, next);
        if (token === serial && current() === account) file = null;
      } finally {
        if (token === serial) busy = false;
      }
    }
    document.addEventListener('click', e => {
      const b = e.target.closest?.('[data-fl]');
      if (!b) return;
      e.preventDefault();
      if (b.dataset.fl === 'open') document.getElementById('flInput')?.click();
      if (b.dataset.fl === 'cancel') {
        serial++;
        file = null;
        a.closeModal();
      }
      if (b.dataset.fl === 'target')
        void launch(b.dataset.target).catch(error => a.tell(error.message, true));
    });
    document.addEventListener('change', e => {
      if (e.target.id === 'flInput') {
        const next = e.target.files?.[0];
        e.target.value = '';
        void open(next).catch(error => a.tell(error.message, true));
      }
    });
    const isFile = e => [...(e.dataTransfer?.types || [])].includes('Files');
    document.addEventListener('dragenter', e => {
      if (!ready() || !isFile(e) || native(e.target)) return;
      depth++;
      if (!document.getElementById('flDropHint')) {
        const hint = document.createElement('div');
        hint.id = 'flDropHint';
        hint.innerHTML =
          '<div><strong>Drop to open a file</strong><span>Choose a compatible tool next</span></div>';
        document.body.append(hint);
      }
    });
    document.addEventListener('dragover', e => {
      if (ready() && isFile(e) && !native(e.target)) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    document.addEventListener('dragleave', () => {
      if (--depth <= 0) hideDrop();
    });
    document.addEventListener('drop', e => {
      hideDrop();
      if (!ready() || !isFile(e) || native(e.target) || e.defaultPrevented) return;
      e.preventDefault();
      if (e.dataTransfer.files.length !== 1)
        return a.tell('Choose one file at a time so each file goes to the right tool.', true);
      void open(e.dataTransfer.files[0]).catch(error => a.tell(error.message, true));
    });
    root.addEventListener('pagehide', () => {
      serial++;
      file = null;
      hideDrop();
    });
    return { sync, open, launch, snapshot: () => ({ name: file?.name || '', busy, owner }) };
  }
  root.WorkHubFileLauncher = { choices, kind, install };
})(window);
