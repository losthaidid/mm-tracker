/* File library and reviewed, per-file QR sharing. All writes use the application's normal save path. */
(function (root) {
  'use strict';
  const E = root.WorkHubDriveFilesEngine;
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const button = (op, label, extra = '') =>
    `<button type="button" data-df="${op}" ${extra}>${label}</button>`;
  const link = (url, label) =>
    `<a href="${esc(E.url(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`;
  function matrix(value) {
    if (!E.url(value)) throw Error('Use a valid Google Drive file link.');
    const qr = root.qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    return qr;
  }
  function drawQR(canvas, value) {
    const qr = matrix(value),
      n = qr.getModuleCount(),
      scale = Math.max(4, Math.floor(700 / (n + 8))),
      size = (n + 8) * scale;
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx)
      throw Error('QR drawing is unavailable in this browser. Copy the download link instead.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#102a31';
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (qr.isDark(r, c)) ctx.fillRect((c + 4) * scale, (r + 4) * scale, scale, scale);
    return canvas;
  }
  function install(a) {
    const api = root.WorkHubDriveAPI.create(a);
    let account = '',
      generation = 0,
      busy = false,
      query = '',
      type = '',
      page = 0,
      message = '',
      messageError = false,
      modal = 0,
      qrFile = '',
      qrLink = '',
      qrUrl = '',
      configuredClient = '',
      layout = 'table',
      galleryEpoch = 0;
    const previewContext = () => [a.owner(), a.generation(), api.identity()?.id || ''].join('|');
    const previews = root.WorkHubFilePreviews.create({
      context: previewContext,
      valid: () => a.ready() && can('export') && api.connected(),
      tell: e => a.tell(e.message || String(e), true),
    });
    function releaseQR() {
      if (qrUrl) URL.revokeObjectURL(qrUrl);
      qrUrl = '';
    }
    function open(title, body) {
      releaseQR();
      a.openModal(title, body);
      const form = document.querySelector('#modalBody form');
      if (form) {
        form.dataset.dfOwner = account;
        form.dataset.dfGeneration = String(generation);
        form.dataset.dfModal = String(modal);
      }
      for (const id of ['modal', 'modalBody']) {
        const el = document.getElementById(id);
        if (el) el.scrollTop = 0;
      }
    }
    const data = () => a.state().workhub.driveFiles;
    const can = (action = 'view') => a.can('files', action);
    function guard(action = 'view') {
      sync();
      if (!a.ready() || !account || !can(action))
        throw Error('Your account does not allow this Files action.');
    }
    function sync() {
      api.sync();
      const next = a.ready() ? a.owner() : '';
      if (account !== next || generation !== a.generation()) {
        if (
          document.querySelector(
            '#modal[open] #dfSetup,#modal[open] #dfUpload,#modal[open] #dfFile,#modal[open] #dfUnshare'
          )
        )
          a.closeModal();
        previews.clear();
        account = next;
        try {
          layout =
            localStorage.getItem('workhub.files.layout.v1:' + account) === 'gallery'
              ? 'gallery'
              : 'table';
        } catch {
          layout = 'table';
        }
        generation = a.generation();
        api.clear();
        releaseQR();
        modal++;
        busy = false;
        message = '';
        query = type = '';
        page = 0;
        qrFile = qrLink = '';
      }
      previews.sync();
      const b = document.getElementById('driveSettingsButton');
      if (b) b.hidden = !a.ready() || !can();
      const client = data()?.clientId || '';
      if (configuredClient !== client) {
        configuredClient = client;
        api.clear();
      }
    }
    function stamp() {
      return { account, generation, modal };
    }
    function alive(s, action = 'view', dialog = false) {
      sync();
      return (
        s.account === account &&
        s.generation === generation &&
        (!dialog || (s.modal === modal && document.getElementById('modal')?.open)) &&
        a.ready() &&
        can(action)
      );
    }
    function requireAlive(s, action, dialog = false) {
      if (!alive(s, action, dialog))
        throw Error('The account, dialog or permissions changed. Start this action again.');
    }
    function sourceAllowed(source) {
      return !source || a.can(source.kind, 'export');
    }
    function busyPaint() {
      document.querySelectorAll('[data-df-busy]').forEach(el => {
        if (busy) {
          if (!el.hasAttribute('data-df-was-disabled'))
            el.dataset.dfWasDisabled = String(el.disabled);
          el.disabled = true;
        } else if (el.hasAttribute('data-df-was-disabled')) {
          el.disabled = el.dataset.dfWasDisabled === 'true';
          delete el.dataset.dfWasDisabled;
        }
      });
      const status = document.getElementById('dfStatus');
      if (status) {
        status.textContent = message;
        status.classList.toggle('df-error', messageError);
      }
    }
    async function run(fn) {
      if (busy) return;
      busy = true;
      message = '';
      messageError = false;
      busyPaint();
      const s = stamp();
      try {
        await fn(s);
      } catch (e) {
        if (alive(s)) {
          message = e.message;
          messageError = true;
          a.tell(e.message, true);
        }
      } finally {
        if (s.account === account && s.generation === generation) {
          busy = false;
          busyPaint();
        }
      }
    }
    function register(incoming) {
      guard('create');
      const merged = E.merge(data(), incoming);
      a.mutate(d => {
        d.workhub.driveFiles = merged;
      });
    }
    const perPage = () => (layout === 'gallery' ? 12 : 50);
    const sortedFiles = () =>
      data()
        .files.filter(
          f =>
            (!type || f.sourceType === type) &&
            [f.name, f.sourceType, f.scope, f.source?.id]
              .join(' ')
              .toLowerCase()
              .includes(query.toLowerCase())
        )
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    const fileTag = f =>
      f.mimeType === 'application/pdf'
        ? 'PDF'
        : f.mimeType.startsWith('image/')
          ? 'IMAGE'
          : /sheet|excel|csv/.test(f.mimeType)
            ? 'SHEET'
            : /zip/.test(f.mimeType)
              ? 'ZIP'
              : 'FILE';
    function previewButton(f) {
      return can('export') && root.WorkHubFilePreviews.supported(f)
        ? button('preview', 'Preview', `data-id="${esc(f.id)}" aria-label="Preview ${esc(f.name)}"`)
        : '';
    }
    function card(f) {
      const preview = can('export') && root.WorkHubFilePreviews.supported(f);
      return `<article class="df-card"><div class="df-card-top"><span class="df-badge">${fileTag(f)}</span><span>${E.size(f.size)}</span></div>${preview ? `<button type="button" class="df-card-cover" data-df="preview" data-id="${esc(f.id)}" aria-label="Preview ${esc(f.name)}">` : `<a class="df-card-cover" href="${esc(E.url(f.webViewLink))}" target="_blank" rel="noopener noreferrer" aria-label="Open ${esc(f.name)} in Drive">`}<span data-df-thumb="${esc(f.id)}" class="df-thumb-slot"><svg viewBox="0 0 64 76" fill="none" aria-hidden="true"><path d="M10 2h29l15 16v54H10z" fill="currentColor" opacity=".08"/><path d="M10 2h29l15 16v54H10zM39 2v17h15M19 34h27M19 44h27M19 54h18" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg><span>${fileTag(f)}</span></span>${preview ? '</button>' : '</a>'}<div class="df-card-body"><h4 title="${esc(f.name)}">${esc(f.name)}</h4><p>${esc(f.sourceType === 'process' ? 'Process Hub · ' + f.scope : f.sourceType === 'handover' ? 'Handover snapshot' : 'Original upload')}</p><small>${f.source ? esc(sourceLabel(f.source)) : 'No linked record'}</small><small>${esc(new Date(f.createdAt).toLocaleDateString())}</small><div class="actions">${previewButton(f)}${can('export') ? button('file', 'Download / QR', `data-id="${esc(f.id)}"`) : ''}${link(f.webViewLink, 'Drive ↗')}</div></div></article>`;
    }
    function render() {
      sync();
      galleryEpoch++;
      previews.clearThumbnails();
      const all = data().files,
        rows = sortedFiles(),
        limit = perPage();
      page = Math.max(0, Math.min(page, Math.ceil(rows.length / limit) - 1));
      const visible = rows.slice(page * limit, page * limit + limit);
      return `<section class="df-room"><header class="df-hero"><div><span class="hub-kicker">YOUR FILES, WITH YOUR WORK</span><h2>A home for every handoff.</h2><p>Keep original files and dated exports in Google Drive. Preview, find and share the file you need.</p></div><div class="df-hero-symbol" aria-hidden="true">▤<span>↗</span></div></header><div class="df-stats"><div><small>Files in your library</small><strong>${all.length}</strong></div><div><small>Stored in Google Drive</small><strong>${E.size(all.reduce((n, f) => n + f.size, 0))}</strong></div><div><small>Connection on this device</small><strong class="df-connection">${api.connected() ? 'Connected' : 'Not connected'}</strong><small>${esc(api.identity()?.email || 'Connect to preview, upload or change sharing.')}</small></div></div><section class="df-panel"><div class="df-bar"><div><h3>File library</h3><p class="muted">File contents stay in Drive. Previews and thumbnails are kept only for this session.</p></div><div class="actions">${button('settings', api.connected() ? 'Drive settings' : 'Set up / connect Google Drive')}${can('create') ? button('upload-dialog', '＋ Upload file', 'class="primary" data-df-busy') + button('refresh', 'Refresh Drive', 'data-df-busy') : ''}</div></div><div class="df-view-bar"><div role="group" aria-label="File library view">${button('table', 'Table', `aria-pressed="${layout === 'table'}"`)}${button('gallery', 'Gallery', `aria-pressed="${layout === 'gallery'}"`)}</div>${layout === 'gallery' && can('export') ? button('thumbnails', 'Load thumbnails', `data-df-busy ${!api.connected() || !visible.some(f => root.WorkHubFilePreviews.supported(f) && f.size <= 8 * 1024 * 1024) ? 'disabled' : ''}`) : ''}</div><div class="df-filters"><label>Find a file<input type="search" data-df-filter="query" value="${esc(query)}" placeholder="Search file name or source"></label><label>Source<select data-df-filter="type"><option value="">All files</option>${[
        ['upload', 'Uploads'],
        ['process', 'Process Hub'],
        ['handover', 'Handover packs'],
      ]
        .map(([k, v]) => `<option value="${k}"${type === k ? ' selected' : ''}>${v}</option>`)
        .join(
          ''
        )}</select></label><span>${rows.length} file${rows.length === 1 ? '' : 's'}</span></div>${layout === 'gallery' ? '<p class="hub-meta">Load thumbnails for the 12 cards on this page when connected. Supported files up to 8 MB get a thumbnail; Preview opens supported files up to 25 MB.</p>' : ''}<p id="dfStatus" role="status" class="${messageError ? 'df-error' : ''}">${esc(message)}</p>${rows.length ? (layout === 'gallery' ? `<div class="df-gallery">${visible.map(card).join('')}</div>` : `<div class="df-table"><table><thead><tr><th>File</th><th>Linked work</th><th>Size / saved</th><th>Actions</th></tr></thead><tbody>${visible.map(f => `<tr><td><strong>${esc(f.name)}</strong><small>${esc(f.mimeType)}</small></td><td>${f.source ? esc(sourceLabel(f.source)) : '—'}${f.projectId ? `<small>${esc(a.state().projects.find(p => p.id === f.projectId)?.name || 'Project reference')}</small>` : ''}</td><td>${E.size(f.size)}<small>${esc(new Date(f.createdAt).toLocaleDateString())}</small></td><td><div class="actions">${previewButton(f)}${link(f.webViewLink, 'Open in Drive')}${can('export') ? button('file', 'Download / QR', `data-id="${esc(f.id)}"`) : ''}</div></td></tr>`).join('')}</tbody></table></div>`) + `<div class="df-pagination">${button('prev', 'Previous', page === 0 ? 'disabled' : '')}<span>Page ${page + 1} of ${Math.ceil(rows.length / limit)}</span>${button('next', 'Next', (page + 1) * limit >= rows.length ? 'disabled' : '')}</div>` : '<div class="df-empty"><span aria-hidden="true">▤</span><h3>Bring a file along.</h3><p>Upload a document here, or save an export from Process Hub or Handover packs.</p></div>'}</section></section>`;
    }
    function setup() {
      guard();
      modal++;
      const s = stamp(),
        connected = api.identity();
      open(
        'Google Drive setup',
        `<form id="dfSetup" class="df-modal"><div class="df-setup-lead"><span class="df-badge">GOOGLE DRIVE</span><h3>Your files. Your Google account.</h3><p>Original files, Process Hub exports and Handover packs go into a dedicated <strong>My WorkHub files</strong> folder. New files are private by default.</p></div><label>Google Web client ID<input name="clientId" value="${esc(data().clientId)}" placeholder="123456789-…apps.googleusercontent.com" maxlength="250" ${can('edit') ? '' : 'readonly'}></label><p class="hub-meta">This public ID identifies your Google application. No password or client secret belongs here. Save setup before connecting.</p><div class="actions">${can('edit') ? '<button type="submit" data-df-busy>Save setup</button>' : ''}${button('prepare-connect', connected ? 'Choose / reconnect Google account' : 'Connect Google Drive', `data-df-busy ${!data().clientId ? 'disabled' : ''}`)}${connected ? button('disconnect', 'Disconnect Google Drive', 'data-df-busy') : ''}</div><p id="dfConnection" role="status">${connected ? 'Connected to ' + esc(connected.email || connected.name) : 'Not connected on this device.'}</p><p id="dfStatus" role="status"></p><details class="df-guide" ${data().clientId ? '' : 'open'}><summary>One-time Google setup · step-by-step</summary><ol><li>Open ${external('https://console.cloud.google.com/projectcreate', 'Google Cloud Console')} and create or choose a project.</li><li>Enable the ${external('https://console.cloud.google.com/apis/library/drive.googleapis.com', 'Google Drive API')} for that project.</li><li>Open ${external('https://console.cloud.google.com/auth/overview', 'Google Auth Platform')}. Add the app name, your support email and contact email under Branding.</li><li>For a personal setup, choose <strong>External</strong> audience and keep it in <strong>Testing</strong>. Add your own Google email as a test user. Workspace users may use Internal if their organization allows it.</li><li>Under Data access, add only <code>https://www.googleapis.com/auth/drive.file</code>. This lets WorkHub manage files it creates, rather than your whole Drive.</li><li>Under Clients, create an OAuth client for <strong>Web application</strong>. Add this Authorized JavaScript origin: <code>https://losthaidid.github.io</code>. Use the origin only, without <code>/mm-tracker</code>. No redirect URI is needed for this popup connection.</li><li>Copy its <strong>Client ID</strong> into the box above, then Save setup. Select Connect Google Drive, then Choose Google account.</li><li>Approve access with your test-user account. Upload a small file and use Refresh Drive to confirm it appears. Try a private QR on your own phone before enabling sharing.</li></ol><p>For public use, complete Google’s branding and publishing requirements. Google may require domain ownership verification; a personal test-user setup can be used first. Workspace administrators may restrict Drive sharing.</p><p>App homepage: ${external('https://losthaidid.github.io/mm-tracker/', 'WorkHub')} · ${external('https://losthaidid.github.io/mm-tracker/privacy.html', 'Privacy policy')} · ${external('https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid', 'Google setup documentation')}</p></details><p class="hub-meta">The connection expires periodically. Reconnect when prompted. Tokens stay in this tab’s memory and are cleared on sign-out or account changes. Disconnect revokes this app’s Google grant; files remain in Drive. To remove access elsewhere, visit ${external('https://myaccount.google.com/connections', 'Google account connections')}. Existing files are not moved or deleted.</p><div class="modal-actions">${button('close', 'Done')}</div></form>`
      );
      return s;
    }
    function external(url, label) {
      return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    }
    function sourceRows(kind) {
      if (!a.can(kind, 'export')) return [];
      return kind === 'processhub'
        ? a.state().workhub.processes
        : kind === 'waiting'
          ? a.state().workhub.waiting
          : a.state()[kind] || [];
    }
    function sourceLabel(source) {
      if (!a.can(source.kind)) return 'Restricted work reference';
      const r = sourceRows(source.kind).find(r => r.id === source.id);
      return r
        ? [r.ticket || r.number || r.itemId, r.task || r.description || r.name || r.title]
            .filter(Boolean)
            .join(' · ')
        : source.kind + ' · ' + source.id;
    }
    function sourceOptions(kind) {
      return (
        '<option value="">Choose a record</option>' +
        sourceRows(kind)
          .map(
            r =>
              `<option value="${esc(r.id)}">${esc([r.ticket || r.number || r.itemId, r.task || r.description || r.name || r.title].filter(Boolean).join(' · ').slice(0, 240))}</option>`
          )
          .join('')
      );
    }
    function uploadDialog(file) {
      guard('create');
      if (!api.connected()) return setup();
      modal++;
      open(
        'Upload to Google Drive',
        `<form id="dfUpload" class="df-modal"><p>Upload the original file without conversion. Up to 50 MB per file. Files start private in your WorkHub folder.</p><label>File<input type="file" name="file" required></label><label>Link to work (optional)<select name="kind"><option value="">No linked record</option>${E.sourceKinds
          .filter(k => a.can(k, 'export'))
          .map(
            k =>
              `<option value="${k}">${{ tasks: 'Task', tickets: 'Ticket', specs: 'Project item', processhub: 'Process', waiting: 'Waiting on' }[k]}</option>`
          )
          .join(
            ''
          )}</select></label><label id="dfRecordLabel" hidden>Record<select name="recordId"><option value="">Choose a record</option></select></label><p id="dfStatus" role="status"></p><div class="modal-actions">${button('close', 'Cancel')}<button class="primary" type="submit" data-df-busy>Upload original file</button></div></form>`
      );
      if (file) {
        const transfer = new DataTransfer();
        transfer.items.add(file);
        document.querySelector('#dfUpload [name=file]').files = transfer.files;
      }
    }
    async function saveGenerated(
      { blob, name, sourceType, source = null, projectId = '', scope = '', allowed = () => true },
      s = stamp()
    ) {
      guard('create');
      if (!can('export') || !sourceAllowed(source) || !allowed())
        throw Error('Export is disabled for this source.');
      if (!api.connected()) {
        setup();
        throw Error(
          'Connect Google Drive, then select Save to Drive again. Your local download remains available.'
        );
      }
      if (data().files.length >= E.MAX_FILES)
        throw Error('The file library supports up to 2,000 files.');
      message = 'Saving the original file to Google Drive…';
      busyPaint();
      const result = await api.upload(blob, name, { sourceType, source, projectId, scope });
      requireAlive(s, 'create');
      if (!sourceAllowed(source) || !allowed() || !can('export'))
        throw Error('Export access changed. The file may be in Drive; review it there.');
      const file = E.metadata(result, api.identity().id);
      try {
        register([file]);
      } catch (e) {
        throw Error(
          'The file was saved in Google Drive, but its workspace listing could not be saved. Use Refresh Drive after resolving sync: ' +
            e.message
        );
      }
      message = 'Saved in Google Drive. The file listing follows your workspace sync status.';
      fileDialog(file.id);
      return file;
    }
    function fileDialog(id) {
      guard('export');
      const f = data().files.find(f => f.id === id);
      if (!f) throw Error('File no longer listed. Refresh Drive.');
      modal++;
      qrFile = id;
      qrLink = f.webContentLink || f.webViewLink;
      open(
        'Download & QR',
        `<form id="dfFile" data-id="${esc(id)}" class="df-modal"><div class="df-file-heading"><span class="df-badge">${esc(f.sourceType.toUpperCase())}</span><h3>${esc(f.name)}</h3><p>${E.size(f.size)} · Saved ${esc(new Date(f.createdAt).toLocaleString())}</p></div><div class="df-qr-layout"><div><canvas id="dfQR" role="img" aria-label="QR code for ${esc(f.name)}"></canvas><p class="hub-meta">Scan to download or open this exact saved file.</p></div><div><h4>Personal QR · current Drive access</h4><p>This QR uses the file’s existing permissions. If the file is private, sign in to the same Google account on your phone. The QR itself does not grant access.</p><div class="actions">${link(qrLink, f.webContentLink ? 'Download file' : 'Open file in Drive')}${button('copy', 'Copy download link')}${button('qr-png', 'Prepare QR image')}</div><p class="hub-meta">Google may show a preview, sign-in or download confirmation. Use Open in Drive if a direct download is unavailable.</p><p>${link(f.webViewLink, 'Review file and access in Drive')}</p></div></div><section class="df-sharing"><h4>Sharing QR · anyone with the link</h4><p>Enable this only for a file you intend to share. Anyone who receives its link or QR can download it without your WorkHub login. Other files and the folder keep their permissions.</p><label class="df-check"><input type="checkbox" name="shareReview"> I have reviewed this file and want anyone with its link to be able to read and download it.</label><div class="actions">${can('edit') ? button('share', 'Enable sharing QR', 'data-df-busy') : ''}${f.managedShareId && can('edit') ? button('unshare-review', 'Disable sharing added here', 'data-df-busy') : ''}</div><p class="hub-meta">Disabling sharing removes only the link permission added here. It does not remove other people’s access or copies already downloaded. Drive and Workspace policies may prevent public sharing.</p></section><p id="dfStatus" role="status"></p><div class="modal-actions">${button('close', 'Done')}</div></form>`
      );
      try {
        drawQR(document.getElementById('dfQR'), qrLink);
      } catch (e) {
        message = e.message;
        messageError = true;
        busyPaint();
      }
    }
    function mustConnect() {
      if (!api.connected())
        throw Error('Connect Google Drive in Settings before changing or refreshing files.');
    }
    async function handle(el) {
      const op = el.dataset.df;
      if (op === 'table' || op === 'gallery') {
        guard();
        layout = op;
        page = 0;
        try {
          localStorage.setItem('workhub.files.layout.v1:' + account, layout);
        } catch {}
        a.render();
        return;
      }
      if (op === 'preview') {
        guard('export');
        mustConnect();
        const f = data().files.find(f => f.id === el.dataset.id);
        if (!f) throw Error('Refresh Drive and open the file again.');
        if (f.googleUserId !== api.identity().id)
          throw Error('Connect the Google account that owns this file.');
        await previews.open(f, (signal, maxBytes) => api.readMedia(f.id, { signal, maxBytes }));
        return;
      }
      if (op === 'thumbnails')
        return run(async s => {
          guard('export');
          mustConnect();
          const token = galleryEpoch,
            visible = sortedFiles()
              .slice(page * perPage(), page * perPage() + perPage())
              .filter(f => f.googleUserId === api.identity().id);
          message = 'Loading thumbnails from Drive…';
          busyPaint();
          await previews.thumbnails(
            visible,
            (f, signal, maxBytes) => api.readMedia(f.id, { signal, maxBytes }),
            (id, url, error) => {
              if (token !== galleryEpoch || !alive(s, 'export')) return;
              const slot = [...document.querySelectorAll('[data-df-thumb]')].find(
                el => el.dataset.dfThumb === id
              );
              if (!slot) return;
              if (url) {
                const image = document.createElement('img');
                image.src = url;
                image.alt = data().files.find(f => f.id === id)?.name || 'File thumbnail';
                slot.replaceChildren(image);
              } else {
                slot.setAttribute('title', error);
              }
            }
          );
          if (token === galleryEpoch && alive(s, 'export'))
            message =
              'Thumbnails loaded for supported files on this page. Use Preview or Drive for other files.';
        });
      if (op === 'close') {
        releaseQR();
        modal++;
        a.closeModal();
        return;
      }
      if (op === 'settings') return setup();
      if (op === 'upload-dialog') return uploadDialog();
      if (op === 'file') return fileDialog(el.dataset.id);
      if (op === 'prev' || op === 'next') {
        page += op === 'next' ? 1 : -1;
        a.render();
        return;
      }
      if (op === 'prepare-connect')
        return run(async s => {
          guard();
          if (!data().clientId) throw Error('Save your Google Web client ID first.');
          await root.WorkHubDriveAPI.load();
          requireAlive(s, 'view', true);
          const status = document.getElementById('dfConnection');
          status.replaceChildren();
          const b = document.createElement('button');
          b.type = 'button';
          b.dataset.df = 'connect';
          b.textContent = 'Choose Google account';
          b.className = 'primary';
          status.append(b);
          message = 'Google is ready. Choose your Google account to approve access.';
        });
      if (op === 'connect')
        return run(async s => {
          guard();
          const who = await api.connect(data().clientId);
          requireAlive(s, 'view', true);
          setup();
          message =
            'Connected to ' +
            (who.email || who.name) +
            '. You can now upload files and save exports.';
          a.render();
        });
      if (op === 'disconnect')
        return run(async s => {
          guard();
          await api.disconnect();
          requireAlive(s, 'view', true);
          setup();
          a.render();
          message = 'Disconnected. Your Drive files remain available.';
        });
      if (op === 'refresh')
        return run(async s => {
          guard('create');
          mustConnect();
          message = 'Reading your WorkHub files from Drive…';
          busyPaint();
          const rows = await api.list();
          requireAlive(s, 'create');
          register(rows.map(f => E.metadata(f, api.identity().id)));
          message =
            'Drive refreshed. Files missing from Drive remain listed so their record references are preserved.';
          a.render();
        });
      const form = el.closest('#dfFile'),
        id = form?.dataset.id;
      if (!form || !form.isConnected || !form.closest('dialog')?.open || id !== qrFile)
        throw Error('Open a file first.');
      guard('export');
      if (op === 'copy') {
        if (!navigator.clipboard?.writeText) {
          message = qrLink;
          busyPaint();
          return;
        }
        await navigator.clipboard.writeText(qrLink);
        message = 'Download link copied.';
        busyPaint();
        return;
      }
      if (op === 'qr-png') {
        const s = stamp(),
          canvas = document.getElementById('dfQR'),
          blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        requireAlive(s, 'export', true);
        if (!blob) throw Error('Could not create the QR image. Copy the link instead.');
        releaseQR();
        qrUrl = URL.createObjectURL(blob);
        const download = document.createElement('a');
        download.href = qrUrl;
        download.download = 'WorkHub-' + id + '-QR.png';
        download.dataset.dfDownload = '';
        download.textContent = 'Download QR image';
        el.replaceWith(download);
        message = 'QR image ready. Select Download QR image to save it.';
        busyPaint();
        return;
      }
      if (op === 'share')
        return run(async s => {
          guard('edit');
          mustConnect();
          if (!form.elements.shareReview.checked)
            throw Error('Review the file and tick the sharing checkbox first.');
          const f = data().files.find(f => f.id === id);
          if (f.googleUserId !== api.identity().id)
            throw Error('Connect the Google account that owns this file.');
          const shared = await api.share(id);
          requireAlive(s, 'edit', true);
          const next = E.metadata(shared.file, api.identity().id);
          a.mutate(d => {
            const i = d.workhub.driveFiles.files.findIndex(f => f.id === id);
            if (i < 0) throw Error('File listing changed. Review access in Drive.');
            d.workhub.driveFiles.files[i] = {
              ...next,
              managedShareId: shared.managedShareId || f.managedShareId,
            };
          });
          fileDialog(id);
          message = shared.existing
            ? 'This file already allows anyone with its link to read it. The QR uses that existing permission.'
            : 'Sharing enabled for this file. Its download link and QR are ready for recipients.';
        });
      if (op === 'unshare-review') {
        guard('edit');
        const f = data().files.find(f => f.id === id);
        modal++;
        open(
          'Disable sharing for this file?',
          `<form id="dfUnshare" data-id="${esc(id)}"><p>Remove the public reader link added here for <strong>${esc(f.name)}</strong>? Other permissions and downloaded copies remain.</p><p id="dfStatus" role="status"></p><div class="modal-actions">${button('file', 'Keep sharing', `data-id="${esc(id)}"`)}<button class="danger" type="submit" data-df-busy>Disable link sharing</button></div></form>`
        );
      }
    }
    async function submit(form) {
      guard();
      if (
        !form.isConnected ||
        !form.closest('dialog')?.open ||
        form.dataset.dfOwner !== account ||
        form.dataset.dfGeneration !== String(generation) ||
        form.dataset.dfModal !== String(modal)
      )
        throw Error('This file dialog is no longer current. Open it again.');
      if (form.id === 'dfSetup') {
        guard('edit');
        const value = form.elements.clientId.value.trim();
        if (!E.clientId(value))
          throw Error('Use the public Web client ID ending in .apps.googleusercontent.com.');
        if (value !== data().clientId) {
          api.clear();
          a.mutate(d => {
            d.workhub.driveFiles.clientId = value;
          });
        }
        setup();
        message = 'Setup saved. Select Connect Google Drive to continue.';
        busyPaint();
        return;
      }
      if (form.id === 'dfUpload')
        return run(async s => {
          guard('create');
          const file = form.elements.file.files?.[0],
            kind = form.elements.kind.value,
            id = form.elements.recordId.value;
          const source = kind ? { kind, id } : null;
          const record = source ? sourceRows(kind).find(r => r.id === id) : null;
          if (source && !record)
            throw Error('Choose the record for this file, or choose No linked record.');
          await saveGenerated(
            {
              blob: file,
              name: file?.name,
              sourceType: 'upload',
              source,
              projectId: record?.projectId || '',
            },
            s
          );
        });
      if (form.id === 'dfUnshare')
        return run(async s => {
          guard('edit');
          mustConnect();
          const id = form.dataset.id,
            f = data().files.find(f => f.id === id);
          if (!f || f.googleUserId !== api.identity().id)
            throw Error('Connect the Google account that owns this file.');
          const result = await api.unshare(id, f.managedShareId);
          requireAlive(s, 'edit', true);
          const next = E.metadata(result, api.identity().id);
          a.mutate(d => {
            const i = d.workhub.driveFiles.files.findIndex(f => f.id === id);
            if (i < 0) throw Error('File listing changed.');
            d.workhub.driveFiles.files[i] = next;
          });
          fileDialog(id);
          message =
            'The public reader link added here has been removed. Current Drive permissions apply.';
        });
    }
    document.addEventListener('click', e => {
      if (e.target.closest('[data-df-download]')) {
        try {
          guard('export');
          if (!qrUrl || !document.getElementById('dfFile'))
            throw Error('Open the file and prepare its QR image again.');
        } catch (err) {
          e.preventDefault();
          a.tell(err.message, true);
        }
        return;
      }
      const el = e.target.closest('[data-df]');
      if (!el || el.disabled) return;
      e.preventDefault();
      void Promise.resolve()
        .then(() => handle(el))
        .catch(e => a.tell(e.message, true));
    });
    document.addEventListener('submit', e => {
      if (!['dfSetup', 'dfUpload', 'dfUnshare'].includes(e.target.id)) return;
      e.preventDefault();
      void Promise.resolve()
        .then(() => submit(e.target))
        .catch(e => a.tell(e.message, true));
    });
    document.addEventListener('change', e => {
      if (e.target.matches('[data-df-filter]')) {
        if (e.target.dataset.dfFilter === 'query') query = e.target.value;
        else type = e.target.value;
        page = 0;
        a.render();
      }
      const form = e.target.closest('#dfUpload');
      if (form && e.target.name === 'kind') {
        const kind = e.target.value;
        form.elements.recordId.innerHTML = sourceOptions(kind);
        document.getElementById('dfRecordLabel').hidden = !kind;
      }
    });
    document.getElementById('driveSettingsButton')?.addEventListener('click', () => {
      try {
        setup();
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    return {
      render,
      sync,
      setup,
      handle,
      submit,
      saveGenerated,
      fileDialog,
      uploadDialog,
      api,
      previews,
    };
  }
  root.WorkHubFilesLibrary = { install, matrix, drawQR };
})(globalThis);
