/* Local, explicitly selected record snapshots. The preview and download use the same rendered bytes. */
(function (root) {
  'use strict';
  const esc = v =>
    String(v ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const clean = value =>
    String(value ?? '')
      .replace(/[\u0000-\u001f]+/g, ' ')
      .trim();
  function records(state, can) {
    const available = f => can(f, 'view') && can(f, 'export');
    return [
      ...(available('tickets')
        ? state.tickets.map(r => ({
            key: 'tickets:' + r.id,
            feature: 'tickets',
            kind: 'Ticket',
            title: clean(r.ticket || r.description),
            detail: clean(r.description),
            status: clean(r.status),
            owner: clean(r.pic),
            date: clean(r.dueDate || r.deadline),
          }))
        : []),
      ...(available('tasks')
        ? state.tasks.map(r => ({
            key: 'tasks:' + r.id,
            feature: 'tasks',
            kind: 'Task',
            title: clean(r.task),
            detail: clean(r.remarks || r.notes || r.description || r.customLink),
            status: r.done
              ? 'Completed'
              : clean(
                  { todo: 'To do', doing: 'In progress', blocked: 'Blocked', done: 'Done' }[
                    r.boardStatus
                  ] ||
                    r.status ||
                    'To do'
                ),
            owner: clean(r.pic),
            date: clean(r.dueDate || r.deadline || r.date),
          }))
        : []),
      ...(available('specs')
        ? state.projects.map(r => ({
            key: 'specs:' + r.id,
            feature: 'specs',
            kind: 'Project',
            title: clean(r.name),
            detail: clean(r.nextMilestone || r.description),
            status: clean(r.phase),
            owner: clean(r.pic),
            date: clean(r.goLiveDate || r.goLive),
          }))
        : []),
    ];
  }
  function model(rows, options) {
    if (!rows.length || rows.length > 6)
      throw Error('Choose between 1 and 6 records for each card.');
    return {
      title: clean(options.title).slice(0, 90) || 'A moment of progress',
      website: clean(options.website).slice(0, 100),
      date: clean(options.date),
      portrait: !!options.portrait,
      dark: options.dark !== false,
      accent: /^#[0-9a-f]{6}$/i.test(options.accent) ? options.accent : '#86d9c0',
      details: options.details !== false,
      owners: !!options.owners,
      rows: rows.map(r => ({ ...r })),
    };
  }
  function wrap(c, text, width, lines) {
    const chars = Array.from(clean(text)),
      result = [];
    let line = '',
      truncated = false;
    for (const ch of chars) {
      if (line && c.measureText(line + ch).width > width) {
        const at = line.lastIndexOf(' ');
        if (at > 0) {
          result.push(line.slice(0, at).trim());
          line = line.slice(at + 1) + ch;
        } else {
          result.push(line.trim());
          line = ch.trimStart();
        }
        if (result.length === lines) {
          truncated = true;
          break;
        }
      } else line += ch;
    }
    if (line && result.length < lines) result.push(line.trim());
    if (truncated) {
      let last = result.at(-1);
      while (last && c.measureText(last + '…').width > width) last = last.slice(0, -1);
      result[result.length - 1] = last.trim() + '…';
    }
    return result;
  }
  function draw(canvas, m) {
    canvas.width = m.portrait ? 1200 : 1920;
    canvas.height = m.portrait ? 1600 : m.rows.length <= 3 ? 900 : 1200;
    const c = canvas.getContext('2d');
    if (!c) throw Error('Image export needs canvas support in your browser.');
    const W = canvas.width,
      H = canvas.height,
      pad = m.portrait ? 65 : 90,
      bg = m.dark ? '#101f2d' : '#f5f4ef',
      surface = m.dark ? '#1b3040' : '#ffffff',
      ink = m.dark ? '#f6f9fc' : '#172a3a',
      muted = m.dark ? '#b7cbd5' : '#506777',
      accent = m.accent;
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    c.fillStyle = accent;
    c.fillRect(0, 0, W, 12);
    c.strokeStyle = m.dark ? '#2a4352' : '#e0e6e5';
    c.lineWidth = 1;
    for (let x = W * 0.66; x < W + 200; x += 70) {
      c.beginPath();
      c.moveTo(x, 15);
      c.lineTo(x - 220, 300);
      c.stroke();
    }
    c.font = '600 20px system-ui, sans-serif';
    c.fillStyle = muted;
    c.fillText('WORKSPACE SNAPSHOT', pad, 74);
    c.font = '600 20px system-ui, sans-serif';
    c.textAlign = 'right';
    c.fillText(m.date, W - pad, 74);
    c.textAlign = 'left';
    c.font = '700 ' + (m.portrait ? 54 : 66) + 'px system-ui, sans-serif';
    c.fillStyle = ink;
    wrap(c, m.title, W - pad * 2, 2).forEach((line, i) => c.fillText(line, pad, 158 + i * 76));
    c.font = '400 24px system-ui, sans-serif';
    c.fillStyle = muted;
    c.fillText(
      `${m.rows.length} selected ${m.rows.length === 1 ? 'record' : 'records'} · A clear view of what matters`,
      pad,
      285
    );
    const columns = m.portrait ? Math.min(2, m.rows.length) : Math.min(3, m.rows.length),
      rowCount = Math.ceil(m.rows.length / columns),
      gap = 26,
      cardW = (W - pad * 2 - gap * (columns - 1)) / columns,
      top = 340,
      cardH = Math.min(m.portrait ? 355 : 340, (H - top - 140 - gap * (rowCount - 1)) / rowCount);
    m.rows.forEach((r, i) => {
      const x = pad + (i % columns) * (cardW + gap),
        y = top + Math.floor(i / columns) * (cardH + gap),
        inner = cardW - 60;
      c.fillStyle = surface;
      c.beginPath();
      c.roundRect(x, y, cardW, cardH, 24);
      c.fill();
      c.fillStyle = accent;
      c.fillRect(x + 30, y + 30, 24, 4);
      c.font = '600 18px system-ui, sans-serif';
      c.fillStyle = muted;
      c.fillText(r.kind.toUpperCase() + '  /  ' + String(i + 1).padStart(2, '0'), x + 30, y + 70);
      c.fillStyle = ink;
      c.font = '700 30px system-ui, sans-serif';
      wrap(c, r.title, inner, 2).forEach((line, n) => c.fillText(line, x + 30, y + 116 + n * 38));
      if (m.details && r.detail && r.detail !== r.title) {
        c.fillStyle = muted;
        c.font = '400 21px system-ui, sans-serif';
        wrap(c, r.detail, inner, 3).forEach((line, n) =>
          c.fillText(line, x + 30, y + 199 + n * 29)
        );
      }
      c.fillStyle = ink;
      c.font = '600 19px system-ui, sans-serif';
      wrap(c, r.status || 'No status set', inner, 1).forEach(line =>
        c.fillText(line, x + 30, y + cardH - 53)
      );
      c.fillStyle = muted;
      c.font = '400 17px system-ui, sans-serif';
      const detail = [m.owners ? r.owner : '', r.date].filter(Boolean).join(' · ');
      wrap(c, detail, inner, 1).forEach(line => c.fillText(line, x + 30, y + cardH - 25));
    });
    c.strokeStyle = m.dark ? '#344b59' : '#ced8d9';
    c.beginPath();
    c.moveTo(pad, H - 95);
    c.lineTo(W - pad, H - 95);
    c.stroke();
    c.font = '600 22px system-ui, sans-serif';
    c.fillStyle = ink;
    wrap(c, m.website, W - pad * 2 - 480, 1).forEach(line => c.fillText(line, pad, H - 47));
    c.textAlign = 'right';
    c.font = '400 18px system-ui, sans-serif';
    c.fillStyle = muted;
    c.fillText('Selected snapshot · Long text excerpted', W - pad, H - 47);
    c.textAlign = 'left';
    return canvas;
  }
  function install(a) {
    let owner = '',
      selected = new Set(),
      query = '',
      type = '',
      generation = 0,
      generated = null,
      busy = false,
      source = '';
    const ready = () => a.cloud().ready && !!a.cloud().user?.id;
    const privateMode = () => document.body.classList.contains('hub-private');
    const all = () => records(a.state(), a.can);
    const chosen = () => all().filter(r => selected.has(r.key));
    function revoke() {
      generation++;
      if (generated) URL.revokeObjectURL(generated.url);
      generated = null;
      busy = false;
      const preview = document.getElementById('scPreview');
      if (preview)
        preview.innerHTML = '<p>Preview your card to see the exact image before downloading.</p>';
      const b = document.querySelector('[data-sc="download"]');
      if (b) b.disabled = true;
    }
    function valid() {
      return (
        ready() &&
        owner === a.cloud().user?.id &&
        !!document.querySelector('#modal[open] #scWorkspace') &&
        !privateMode() &&
        selected.size === chosen().length
      );
    }
    function paintList() {
      const list = document.getElementById('scRecords');
      if (!list) return;
      const rows = all().filter(
        r =>
          (!type || r.feature === type) &&
          [r.title, r.detail, r.status].join(' ').toLowerCase().includes(query.toLowerCase())
      );
      list.innerHTML =
        rows
          .slice(0, 100)
          .map(
            r =>
              `<label class="sc-record"><input type="checkbox" value="${esc(r.key)}" data-sc-select${selected.has(r.key) ? ' checked' : ''}><span><small>${r.kind} · ${esc(r.status)}</small><strong>${esc(r.title)}</strong></span></label>`
          )
          .join('') || '<p>No matching records available for export.</p>';
      const count = document.getElementById('scCount');
      if (count)
        count.textContent =
          selected.size +
          ' / 6 selected' +
          (rows.length > 100 ? ' · Refine search to see more than the first 100 results' : '');
      const prepare = document.querySelector('[data-sc="preview"]');
      if (prepare) prepare.disabled = !selected.size || busy;
    }
    async function open() {
      sync();
      const account = owner;
      if (
        a.unfinished?.() &&
        !(await root.WorkHubDialogs.confirm(
          'Leave this editor to create a summary card? Save your changes first, or Cancel to keep editing.'
        ))
      )
        return;
      if (account !== owner || account !== a.cloud().user?.id) return;
      if (!ready() || privateMode())
        return a.tell('Turn off Privacy mode before preparing a shareable card.', true);
      revoke();
      selected = new Set();
      query = type = '';
      source = JSON.stringify(all());
      a.openModal(
        'Shareable summary card',
        `<section id="scWorkspace"><header class="sc-intro"><span class="hub-kicker">A SMALL STORY OF YOUR WORK</span><h3>Make progress worth sharing.</h3><p>Choose up to six records. Review the image, then download it. Nothing is sent automatically.</p></header><div class="sc-layout"><div class="sc-controls"><label>Card title<input id="scTitle" maxlength="90" value="A moment of progress"></label><div class="form-grid"><label>Layout<select id="scLayout"><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label><label>Style<select id="scStyle"><option value="dark">Evening</option><option value="light">Daylight</option></select></label><label>Image format<select id="scFormat"><option value="png">PNG · crisp text</option><option value="jpg">JPG · smaller file</option></select></label></div><label class="check-label"><input type="checkbox" id="scDetails" checked>Include descriptions / next milestone</label><label class="check-label"><input type="checkbox" id="scOwners">Include PIC / owner</label><label>Find records<input id="scSearch" type="search" placeholder="Title, status or description"></label><label>Record type<select id="scType"><option value="">All available types</option>${[
          ['tickets', 'Tickets'],
          ['tasks', 'Tasks'],
          ['specs', 'Projects'],
        ]
          .filter(([f]) => a.can(f, 'view') && a.can(f, 'export'))
          .map(([f, l]) => `<option value="${f}">${l}</option>`)
          .join(
            ''
          )}</select></label><div class="flex-title"><span id="scCount" role="status"></span><button type="button" data-sc="clear">Uncheck all</button></div><div id="scRecords"></div></div><div class="sc-preview-panel"><div id="scPreview"><p>Your selected records will appear here.</p></div><p id="scStatus" role="status">Only selected records are exported. Long text is excerpted on the image.</p><div class="actions"><button type="button" class="primary" data-sc="preview">Generate preview</button><button type="button" data-sc="download" disabled>Download image</button></div></div></div></section>`
      );
      const dialog = document.getElementById('scWorkspace')?.closest('dialog');
      if (dialog) dialog.classList.add('sc-dialog');
      paintList();
    }
    async function preview() {
      if (!valid() || !document.getElementById('scWorkspace'))
        throw Error('Reopen this card after the account, permissions or Privacy mode changed.');
      revoke();
      const token = generation,
        account = owner,
        rows = chosen(),
        fingerprint = JSON.stringify(rows),
        el = id => document.getElementById(id),
        p = a.state().workhub.preferences,
        format = el('scFormat').value;
      const m = model(rows, {
        title: el('scTitle').value,
        website: p.workspace,
        date: new Date().toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }),
        portrait: el('scLayout').value === 'portrait',
        dark: el('scStyle').value === 'dark',
        details: el('scDetails').checked,
        owners: el('scOwners').checked,
        accent: root.WorkHubAppearance.palette(p, '').accent,
      });
      busy = true;
      paintList();
      el('scStatus').textContent = 'Drawing your card…';
      try {
        const canvas = draw(document.createElement('canvas'), m),
          blob = await new Promise((resolve, reject) =>
            canvas.toBlob(
              b => (b ? resolve(b) : reject(Error('The image could not be generated.'))),
              format === 'jpg' ? 'image/jpeg' : 'image/png',
              0.94
            )
          );
        if (
          token !== generation ||
          account !== owner ||
          !valid() ||
          !el('scWorkspace') ||
          fingerprint !== JSON.stringify(chosen())
        )
          return;
        const url = URL.createObjectURL(blob);
        generated = { blob, url, format, fingerprint };
        el('scPreview').innerHTML = '';
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Export preview: ' + m.title;
        el('scPreview').append(img);
        el('scStatus').textContent =
          `${rows.length} selected ${rows.length === 1 ? 'record' : 'records'} · ${canvas.width} × ${canvas.height} · Ready to download`;
        document.querySelector('[data-sc="download"]').disabled = false;
      } finally {
        if (token === generation) {
          busy = false;
          paintList();
        }
      }
    }
    function download() {
      if (!valid() || !generated || generated.fingerprint !== JSON.stringify(chosen())) {
        revoke();
        throw Error('Your records or permissions changed. Generate a fresh preview.');
      }
      const link = document.createElement('a');
      link.href = generated.url;
      link.download =
        'workhub-summary-' + new Date().toISOString().slice(0, 10) + '.' + generated.format;
      link.click();
    }
    function sync() {
      const next = ready() ? a.cloud().user?.id || '' : '';
      if (next !== owner || privateMode()) {
        revoke();
        selected.clear();
        if (document.getElementById('scWorkspace')) {
          a.closeModal();
          document.getElementById('scWorkspace')?.remove();
          document.getElementById('modal')?.classList.remove('sc-dialog');
        }
        owner = next;
      }
      if (document.getElementById('scWorkspace') && source !== JSON.stringify(all())) {
        revoke();
        selected = new Set([...selected].filter(k => all().some(r => r.key === k)));
        source = JSON.stringify(all());
        paintList();
      }
      const bar = document.getElementById('hubToolbar');
      if (bar && !document.getElementById('scOpen')) {
        const b = document.createElement('button');
        b.id = 'scOpen';
        b.type = 'button';
        b.dataset.sc = 'open';
        b.textContent = '▧ Summary card';
        bar.append(b);
      }
      const button = document.getElementById('scOpen');
      if (button)
        button.hidden =
          !ready() ||
          ![
            ['tickets', a.state().tickets],
            ['tasks', a.state().tasks],
            ['specs', a.state().projects],
          ].some(([f, rows]) => rows.length && a.can(f, 'view') && a.can(f, 'export'));
      if (!document.getElementById('scWorkspace') && generated) revoke();
    }
    document.addEventListener('click', e => {
      const b = e.target.closest?.('[data-sc]');
      if (!b) return;
      e.preventDefault();
      const actions = {
        open,
        preview,
        download,
        clear: () => {
          selected.clear();
          revoke();
          paintList();
        },
      };
      try {
        void Promise.resolve(actions[b.dataset.sc]?.()).catch(error => a.tell(error.message, true));
      } catch (error) {
        a.tell(error.message, true);
      }
    });
    document.addEventListener('input', e => {
      if (!e.target.closest?.('#scWorkspace')) return;
      if (e.target.id === 'scSearch') {
        query = e.target.value;
        paintList();
      } else if (e.target.id === 'scTitle') revoke();
    });
    document.addEventListener('change', e => {
      if (!e.target.closest?.('#scWorkspace')) return;
      if (e.target.matches('[data-sc-select]')) {
        if (e.target.checked && selected.size >= 6) {
          e.target.checked = false;
          return a.tell('Use up to six records per image to keep it readable.', true);
        }
        if (e.target.checked) selected.add(e.target.value);
        else selected.delete(e.target.value);
        revoke();
        paintList();
      } else if (e.target.id === 'scType') {
        type = e.target.value;
        paintList();
      } else if (e.target.id !== 'scSearch') revoke();
    });
    document.addEventListener(
      'close',
      e => {
        if (e.target.querySelector?.('#scWorkspace')) {
          revoke();
          e.target.classList.remove('sc-dialog');
        }
      },
      true
    );
    root.addEventListener('pagehide', revoke);
    return {
      open,
      preview,
      download,
      sync,
      snapshot: () => ({ owner, selected: [...selected], prepared: !!generated, busy }),
    };
  }
  root.WorkHubSummaryCards = { records, model, wrap, draw, install };
})(window);
