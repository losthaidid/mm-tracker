/** Settings storage room. File verification is separate from permission-checked, revision-locked cloud writes. */
(function (root) {
  'use strict';
  const E = root.WorkHubStorageEngine;
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const size = n =>
    n == null
      ? 'Unavailable'
      : n < 1024
        ? n + ' B'
        : n < 1048576
          ? (n / 1024).toFixed(1) + ' KiB'
          : (n / 1048576).toFixed(2) + ' MiB';
  const button = (op, label, extra = '') =>
    `<button type="button" data-storage="${op}" ${extra}>${label}</button>`;
  function install(a) {
    let dialog = null,
      session = 0,
      owner = '',
      busy = false,
      view = 'overview',
      usage = null,
      browser = null,
      status = '',
      error = false;
    let rows = [],
      picked = new Set(),
      page = 0,
      review = null,
      archive = null,
      restorePlan = null;
    const cloud = () => a.cloud();
    const identity = () => cloud().user?.id || '';
    const can = (feature, action) => a.access()?.can(feature, action) ?? true;
    function available() {
      const c = cloud();
      if (!c.ready || !c.user) throw Error('Sign in and open your records first.');
      if (!can('workspace', 'view'))
        throw Error('Storage settings are unavailable for this account.');
    }
    function settled() {
      available();
      const c = cloud();
      if (
        c.busy ||
        c.pending ||
        c.inFlight ||
        c.refreshing ||
        c.loading ||
        c.conflict ||
        c.error ||
        c.resetting
      )
        throw Error('Finish syncing or reload cloud records before continuing.');
      if (a.timer())
        throw Error('Stop and save the active work session before changing stored records.');
      a.checkCache();
    }
    function context() {
      settled();
      return {
        owner: identity(),
        generation: cloud().generation,
        revision: cloud().revision,
        raw: JSON.stringify(a.state()),
        session,
      };
    }
    function valid(c) {
      return (
        dialog?.open &&
        owner === identity() &&
        c.owner === identity() &&
        c.generation === cloud().generation &&
        c.session === session
      );
    }
    function unchanged(c) {
      if (!valid(c) || c.revision !== cloud().revision || c.raw !== JSON.stringify(a.state()))
        throw Error('Your account or records changed. Start a fresh review.');
      a.checkCache();
    }
    function notice(text, failed = false) {
      status = text;
      error = failed;
      const n = dialog?.querySelector('[data-storage-status]');
      if (n) {
        n.textContent = text;
        n.classList.toggle('is-error', failed);
      }
    }
    function setBusy(value) {
      busy = value;
      if (dialog) {
        dialog.setAttribute('aria-busy', String(value));
        for (const n of dialog.querySelectorAll('button,input,select')) {
          if (value) {
            n.dataset.storageDisabled = String(n.disabled);
            n.disabled = true;
          } else if (n.dataset.storageDisabled !== undefined) {
            n.disabled = n.dataset.storageDisabled === 'true';
            delete n.dataset.storageDisabled;
          }
        }
      }
    }
    function sync() {
      if (dialog?.open && (owner !== identity() || !cloud().ready || !can('workspace', 'view'))) {
        session++;
        busy = false;
        dialog.close();
      }
    }
    function close() {
      if (!busy) dialog.close();
    }
    function shell() {
      if (dialog) return;
      dialog = document.createElement('dialog');
      dialog.id = 'workhubStorage';
      dialog.className = 'storage-room';
      dialog.setAttribute('aria-labelledby', 'storageRoomTitle');
      dialog.dataset.accessFeature = 'workspace';
      document.body.append(dialog);
      dialog.addEventListener('cancel', e => {
        if (busy) e.preventDefault();
      });
      dialog.addEventListener('close', () => {
        session++;
        review = archive = restorePlan = null;
        picked.clear();
        rows = [];
        usage = browser = null;
        status = '';
      });
      dialog.addEventListener('click', e => {
        const b = e.target.closest('[data-storage]');
        if (b && !busy)
          void action(b.dataset.storage, b).catch(err =>
            notice(err.message || 'The operation failed.', true)
          );
      });
      dialog.addEventListener('change', e => {
        if (busy) return;
        const n = e.target;
        if (n.matches('[data-storage-pick]')) {
          n.checked ? picked.add(n.dataset.storagePick) : picked.delete(n.dataset.storagePick);
          review = restorePlan = null;
          updateCount();
        }
        if (n.matches('[data-storage-filter]')) {
          picked.clear();
          review = null;
          page = 0;
          loadCandidates();
          render();
        }
        if (n.matches('[data-storage-file]')) {
          const file = n.files?.[0];
          n.value = '';
          if (file)
            void readFile(file, n.dataset.storageFile === 'verify').catch(err =>
              notice(err.message || 'The file could not be opened.', true)
            );
        }
      });
      dialog.addEventListener('submit', e => {
        if (e.target.matches('[data-storage-confirm]')) {
          e.preventDefault();
          void commit(e.target);
        }
      });
    }
    function updateCount() {
      const n = dialog.querySelector('[data-storage-count]');
      if (n) n.textContent = picked.size + ' selected';
      dialog.querySelector('[data-storage-review]')?.remove();
    }
    function loadCandidates() {
      const path =
        dialog.querySelector('[name="storageCollection"]')?.value || E.collections[0].path;
      const before = dialog.querySelector('[name="storageBefore"]')?.value || '';
      rows = E.candidates(a.state(), { path, before, today: a.today() }).filter(r =>
        can(r.feature, 'view')
      );
      dialog.dataset.collection = path;
      dialog.dataset.before = before;
    }
    async function open() {
      available();
      shell();
      if (busy) return;
      session++;
      owner = identity();
      view = 'overview';
      usage = browser = null;
      review = archive = restorePlan = null;
      picked.clear();
      page = 0;
      status = '';
      error = false;
      a.closeSettings();
      dialog.showModal();
      render();
      await refresh();
    }
    async function refresh() {
      available();
      const token = session,
        account = identity();
      notice('Checking storage…');
      const results = await Promise.allSettled([
        cloud().client.rpc('workhub_storage_usage'),
        root.navigator.storage?.estimate?.() ?? Promise.resolve(null),
      ]);
      if (!dialog.open || token !== session || account !== identity()) return;
      const r = results[0];
      usage = r.status === 'fulfilled' && !r.value.error ? r.value.data : null;
      browser = results[1].status === 'fulfilled' ? results[1].value : null;
      status = usage
        ? 'Storage checked just now. Section sizes are estimates of visible record data.'
        : 'Live database metrics are unavailable. Your visible record estimates and archive tools still work.';
      error = false;
      render();
    }
    function metrics() {
      const estimated = E.overview(a.state(), root.WorkHubAccessCatalog?.features || []);
      return `<div class="storage-metrics"><article><span>YOUR CLOUD RECORDS</span><strong>${size(usage?.recordBytes)}</strong><small>${usage ? 'Server-measured record JSON · revision ' + esc(usage.revision) : 'Live measurement unavailable'}</small></article><article><span>VISIBLE WORKSPACE</span><strong>${size(estimated.bytes)}</strong><small>Estimated record data in this view</small></article><article><span>THIS BROWSER</span><strong>${size(browser?.usage)}</strong><small>${browser?.quota ? 'Origin storage · ' + size(browser.quota) + ' estimated capacity' : 'Browser estimate unavailable'}</small></article></div>`;
    }
    function overview() {
      const o = E.overview(a.state(), root.WorkHubAccessCatalog?.features || []),
        total = o.parts.reduce((n, p) => n + p.bytes, 0);
      const list = o.parts.filter(p => p.bytes > 2);
      return `${metrics()}<div class="storage-columns"><section class="storage-card"><div class="storage-section-title"><div><span class="storage-kicker">WHERE IT GOES</span><h3>Your workspace, by section</h3></div><span class="storage-pill">${list.length} sections</span></div><p class="storage-muted">Estimated JSON sizes, before database compression and indexes. Bars show each section’s share—not a plan quota.</p><div class="storage-breakdown">${list.map((p, i) => `<div class="storage-section"><div><strong>${esc(p.name)}</strong><span>${size(p.bytes)}${p.count !== null ? ' · ' + p.count + ' records' : ''}</span></div><div class="storage-bar" style="--storage-tone:var(--storage-tone-${i % 4})"><i style="width:${Math.max(0.5, (100 * p.bytes) / Math.max(1, total)).toFixed(2)}%"></i></div></div>`).join('')}</div></section><aside class="storage-aside"><section class="storage-card storage-next"><span class="storage-kicker">MAKE A LITTLE ROOM</span><h3>Keep what matters.<br>Archive the rest.</h3><p>Review older records, save a compressed safety archive, then verify the actual file before removing anything online.</p>${button('cleanup', 'Review archive candidates', 'class="primary"')}</section><section class="storage-card"><span class="storage-kicker">DATABASE VIEW</span><h3>${usage?.project ? size(usage.project.databaseBytes) : 'Your account’s data'}</h3><p class="storage-muted">${usage?.project ? 'Owner-only total Postgres database size. Includes other accounts, system data and indexes; excludes Storage bucket files and allocated disk/WAL.' : 'Project-wide database totals are available only to the active Owner.'}</p>${usage?.storedDocumentBytes != null ? `<p>Stored document: <strong>${size(usage.storedDocumentBytes)}</strong><br><small>Postgres column storage; not a per-account bill.</small></p>` : ''}<p class="storage-muted">Removing records makes space reusable. Supabase’s database size may take longer to decrease.</p></section><section class="storage-card"><strong>Files stay separate</strong><p class="storage-muted">Validation uploads and downloaded archives are not automatically stored in your cloud record document. Local-only photos and browser caches are separate from these record estimates.</p></section></aside></div>`;
    }
    function picker(local = false) {
      const visible = rows.slice(page * 25, page * 25 + 25);
      return `<div class="storage-list-heading"><label><input type="checkbox" data-storage="page-all" ${visible.length && visible.every(r => picked.has(r.key)) ? 'checked' : ''}> Select this page</label><span data-storage-count>${picked.size} selected</span></div><div class="storage-records">${
        visible
          .map(
            r =>
              `<label class="storage-record"><input type="checkbox" data-storage-pick="${esc(r.key)}" ${picked.has(r.key) ? 'checked' : ''}><span><strong>${esc(r.title)}</strong><small>${esc(local ? E.collections.find(c => c.path === r.path)?.name || r.path : r.date || 'No saved date')}${r.bytes ? ' · ' + size(r.bytes) : ''}</small></span>${
                local
                  ? `<details><summary>Values</summary><pre>${esc(
                      JSON.stringify(
                        E.get(archive.data, r.path).find(x => x.id === r.id),
                        null,
                        2
                      ).slice(0, 50000)
                    )}</pre></details>`
                  : ''
              }</label>`
          )
          .join('') ||
        '<div class="storage-empty"><span>◇</span><h3>Nothing to tidy here</h3><p>Try another section or change the date filter. Active records are kept online.</p></div>'
      }</div><div class="storage-pagination">${button('prev', '← Previous', page ? '' : 'disabled')}<span>${rows.length ? page * 25 + 1 : 0}–${Math.min(rows.length, (page + 1) * 25)} of ${rows.length}</span>${button('next', 'Next →', (page + 1) * 25 < rows.length ? '' : 'disabled')}</div>`;
    }
    function cleanup() {
      return `<section class="storage-flow"><div><b>01</b><span>Choose records</span></div><div><b>02</b><span>Save ZIP archive</span></div><div><b>03</b><span>Reopen & verify</span></div><div><b>04</b><span>Confirm cloud removal</span></div></section><div class="storage-columns"><section class="storage-card"><span class="storage-kicker">START WITH FINISHED WORK</span><h3>Choose what to archive</h3><div class="storage-filters"><label>Section<select name="storageCollection" data-storage-filter>${E.collections
        .filter(c => can(c.feature, 'view'))
        .map(
          c =>
            `<option value="${c.path}" ${dialog.dataset.collection === c.path ? 'selected' : ''}>${esc(c.name)}</option>`
        )
        .join(
          ''
        )}</select></label><label>Before date (optional)<input name="storageBefore" data-storage-filter type="date" value="${esc(dialog.dataset.before || '')}"></label></div>${picker()}${button('review', 'Review selection', 'class="primary"')}</section><aside class="storage-aside"><section class="storage-card"><span class="storage-kicker">YOU STAY IN CONTROL</span><h3>Backup first.<br>Clear with confidence.</h3><p>A ZIP archive contains a complete workspace safety snapshot plus your selection. Downloading alone never deletes records.</p><p class="storage-muted">Linked records are kept online. You’ll see the estimated savings and protected records before continuing.</p><p class="storage-muted">Keep the archive somewhere safe. It contains private data and is not encrypted. Records removed online disappear from your other devices too.</p></section></aside></div>${review ? reviewHtml() : ''}`;
    }
    function confirmation(kind) {
      return `<form data-storage-confirm="${kind}" class="storage-confirm"><label>Type ${kind === 'cleanup' ? 'REMOVE' : 'RESTORE'}<input name="confirmation" autocomplete="off" required></label><label>Current account password<input name="password" type="password" autocomplete="current-password" required></label><button type="submit" class="${kind === 'cleanup' ? 'danger' : 'primary'}">${kind === 'cleanup' ? 'Verify password & remove selected cloud records' : 'Verify password & restore missing records'}</button><p>Existing live records are never overwritten. This action applies only to the review shown above.</p></form>`;
    }
    function reviewHtml() {
      const p = review.plan;
      return `<section class="storage-card storage-review" data-storage-review><span class="storage-kicker">YOUR CLEANUP REVIEW</span><h3>${p.removable.length} can move off the cloud <span class="storage-pill">${size(Math.max(0, p.savings))} estimated savings</span></h3><p>${p.protected.length} selected records will stay online because they are linked or no longer eligible.</p>${p.ownedCount ? `<p>${p.ownedCount} record-owned workflow/context entries will move with their parent records. Timeline history stays online.</p>` : ''}${p.protected.length ? `<details><summary>Why records are protected</summary><ul>${p.protected.map(r => `<li><strong>${esc(r.title)}</strong> — ${esc(r.reason)}</li>`).join('')}</ul></details>` : ''}<div class="storage-archive-step">${button('download', 'Download compressed archive', 'class="primary"')}<span>${review.pack ? size(review.pack.buffer.byteLength) + ' ZIP · ' + size(review.pack.rawBytes) + ' safety snapshot' : 'Includes every field and linked context in a full safety snapshot.'}</span></div><label class="storage-file">${review.verified ? '✓ Archive verified' : 'Reopen your downloaded ZIP to verify it'}<input type="file" accept=".zip,application/zip" data-storage-file="verify"></label>${review.verified && p.removable.length ? confirmation('cleanup') : '<p class="storage-muted">Cloud removal becomes available after the downloaded archive passes verification.</p>'}</section>`;
    }
    function local() {
      return `<section class="storage-card"><span class="storage-kicker">YOUR LOCAL LIBRARY</span><h3>Open an archive. Bring back only what you need.</h3><p class="storage-muted">Archives are read on this device. Opening a file does not upload it or replace your workspace.</p><label class="storage-file">Choose a WorkHub archive<input type="file" accept=".zip,application/zip" data-storage-file="local"></label>${archive ? `<p class="storage-pill">Verified contents · ${esc(archive.manifest.createdAt.slice(0, 10))} · ${size(archive.rawBytes)} safety snapshot</p>${picker(true)}${button('restore-review', 'Preview selective restore', 'class="primary"')}` : '<div class="storage-empty"><span>↗</span><p>Your archives stay wherever you saved them. Choose one to inspect its selected records.</p></div>'}</section>${restorePlan ? `<section class="storage-card storage-review" data-storage-review><h3>${restorePlan.additions.length} missing records ready to restore</h3><p>${restorePlan.additions.filter(r => r.dependency).length} required linked records are included. ${restorePlan.conflicts.length} changed live records and ${restorePlan.unchanged.length} identical records will be kept as they are.</p><details><summary>Review records and linked context</summary><ul>${restorePlan.additions.map(r => `<li>${esc(r.title)}${r.dependency ? ' · linked dependency' : ''}</li>`).join('')}${restorePlan.conflicts.map(r => `<li>${esc(r.title)} · conflict: keeping current live record</li>`).join('')}</ul></details>${restorePlan.additions.length ? confirmation('restore') : ''}</section>` : ''}`;
    }
    function render() {
      if (!dialog?.open) return;
      dialog.innerHTML = `<header class="storage-header"><div><span class="storage-kicker">SETTINGS / STORAGE</span><h2 id="storageRoomTitle">A little room to grow.</h2><p>Understand your space. Keep your records within reach.</p></div>${button('close', 'Close', 'aria-label="Close storage settings"')}</header><nav class="storage-tabs" aria-label="Storage sections">${[
        ['overview', 'Storage overview'],
        ['cleanup', 'Archive & cleanup'],
        ['local', 'Local archives'],
      ]
        .map(([k, label]) => button(k, label, `aria-current="${view === k ? 'page' : 'false'}"`))
        .join(
          ''
        )}${button('refresh', '↻ Refresh usage', 'class="storage-refresh"')}</nav><p class="storage-status ${error ? 'is-error' : ''}" data-storage-status role="status" aria-live="polite">${esc(status)}</p><div class="storage-content">${view === 'overview' ? overview() : view === 'cleanup' ? cleanup() : local()}</div>`;
    }
    async function readFile(file, verification) {
      available();
      if (file.size > 24 * 1024 * 1024) throw Error('Choose a WorkHub ZIP below 24 MiB.');
      const token = session,
        account = identity();
      setBusy(true);
      notice('Checking archive contents and checksum…');
      try {
        const data = await file.arrayBuffer(),
          opened = await E.unpack(data, root.JSZip, a.validate);
        if (token !== session || account !== identity() || !dialog.open) return;
        if (verification) {
          if (!review?.pack) throw Error('Download this review’s archive before verifying it.');
          unchanged(review.context);
          if (opened.hash !== review.pack.hash || opened.manifest.owner !== account)
            throw Error('This is not the archive downloaded for the current review.');
          review.verified = true;
          status = 'The downloaded archive matches this review. Cloud records are still unchanged.';
        } else {
          archive = opened;
          review = restorePlan = null;
          picked.clear();
          page = 0;
          rows = opened.manifest.selected.map(k => {
            const [path, id] = JSON.parse(k),
              r = E.get(opened.data, path).find(x => x.id === id);
            return { key: k, path, id, title: E.label(r), bytes: E.bytes(r) };
          });
          status = 'Archive opened locally. Select records to inspect or restore.';
        }
        error = false;
        render();
      } finally {
        setBusy(false);
      }
    }
    async function action(op, element) {
      available();
      if (op === 'close') return close();
      if (op === 'refresh') return refresh();
      if (['overview', 'cleanup', 'local'].includes(op)) {
        view = op;
        picked.clear();
        review = restorePlan = null;
        page = 0;
        if (op === 'cleanup') loadCandidates();
        if (op === 'local')
          rows = archive
            ? archive.manifest.selected.map(k => {
                const [path, id] = JSON.parse(k),
                  r = E.get(archive.data, path).find(x => x.id === id);
                return { key: k, path, id, title: E.label(r), bytes: E.bytes(r) };
              })
            : [];
        render();
        return;
      }
      if (op === 'page-all') {
        const visible = rows.slice(page * 25, page * 25 + 25);
        for (const r of visible) element.checked ? picked.add(r.key) : picked.delete(r.key);
        review = restorePlan = null;
        render();
        return;
      }
      if (op === 'next' || op === 'prev') {
        page = Math.max(
          0,
          Math.min(Math.ceil(rows.length / 25) - 1, page + (op === 'next' ? 1 : -1))
        );
        render();
        return;
      }
      if (op === 'review') {
        if (!picked.size) throw Error('Select at least one record.');
        const c = context();
        a.exportCheck();
        const plan = E.cleanup(a.state(), [...picked], a.today());
        for (const r of plan.removable)
          if (!can(E.collections.find(x => x.path === r.path).feature, 'delete'))
            throw Error('Delete permission is required for ' + r.title + '.');
        a.prepare(plan.next);
        review = { context: c, plan, selection: [...picked], pack: null, verified: false };
        status = 'Review what can be removed and what must stay online.';
        error = false;
        render();
        return;
      }
      if (op === 'download') {
        if (!review) throw Error('Review a selection first.');
        settled();
        unchanged(review.context);
        a.exportCheck();
        const r = review;
        setBusy(true);
        notice('Compressing your safety archive…');
        try {
          const pack = await E.pack(
            JSON.parse(r.context.raw),
            r.selection,
            r.context.owner,
            root.JSZip
          );
          unchanged(r.context);
          a.exportCheck();
          a.download(pack.buffer, 'WorkHub-archive-' + a.today() + '.zip', 'application/zip');
          r.pack = pack;
          r.verified = false;
          status = 'Download started. Locate the saved ZIP and reopen it below to verify.';
          error = false;
          render();
        } finally {
          setBusy(false);
        }
        return;
      }
      if (op === 'restore-review') {
        if (!archive || !picked.size) throw Error('Open an archive and choose records to restore.');
        if (archive.manifest.owner !== identity())
          throw Error(
            'This archive belongs to a different account. You can inspect it locally, but cannot restore it into this account.'
          );
        const c = context(),
          p = E.restore(a.state(), archive.data, [...picked]);
        a.prepare(p.next);
        a.authorize(p.next);
        restorePlan = { ...p, context: c };
        status = 'Review missing records and dependencies. Existing records will stay unchanged.';
        error = false;
        render();
      }
    }
    async function commit(form) {
      if (busy) return;
      const removing = form.dataset.storageConfirm === 'cleanup',
        r = removing ? review : restorePlan,
        c = r?.context;
      let verifier = null,
        sent = false,
        applied = false;
      const currentCloud = cloud();
      try {
        settled();
        if (!r || !c) throw Error('Start a fresh review.');
        unchanged(c);
        if (removing && !r.verified) throw Error('Verify the downloaded archive first.');
        if (form.elements.confirmation.value !== (removing ? 'REMOVE' : 'RESTORE'))
          throw Error('Type ' + (removing ? 'REMOVE' : 'RESTORE') + ' to confirm.');
        if (!form.elements.password.value) throw Error('Enter your current account password.');
        const next = removing ? r.plan.next : r.next;
        a.validate(next);
        a.authorize(next);
        if (removing) a.exportCheck();
        const document = JSON.parse(a.payload(next));
        if (E.bytes(document) > 16777216)
          throw Error('The resulting workspace exceeds its 16 MiB cloud-document limit.');
        setBusy(true);
        currentCloud.resetting = c;
        notice('Verifying your identity…');
        verifier = a.createClient();
        const auth = await verifier.auth.signInWithPassword({
          email: currentCloud.user.email,
          password: form.elements.password.value,
        });
        form.elements.password.value = '';
        if (auth.error || auth.data?.user?.id !== c.owner)
          throw Error('Password verification failed for the current account.');
        unchanged(c);
        const meta = await verifier.rpc('workhub_storage_usage');
        if (meta.error) throw meta.error;
        if (Number(meta.data?.revision) !== c.revision)
          throw Error('Another device changed your records. Reload and make a fresh review.');
        await a.access()?.refresh();
        unchanged(c);
        a.authorize(next);
        if (removing) a.exportCheck();
        notice(removing ? 'Removing only the reviewed records…' : 'Restoring missing records…');
        sent = true;
        const saved = await verifier.rpc('save_mm_tracker', {
          p_document: document,
          p_expected_revision: c.revision,
          p_mutation_id: root.crypto.randomUUID(),
        });
        if (saved.error) throw saved.error;
        const revision = Number(saved.data?.[0]?.revision);
        if (!Number.isSafeInteger(revision) || revision !== c.revision + 1)
          throw Error('The server did not confirm this change.');
        if (!valid(c)) {
          if (identity() === c.owner) a.uncertain();
          return;
        }
        a.apply(document, revision);
        applied = true;
        review = restorePlan = null;
        picked.clear();
        view = 'overview';
        status = removing
          ? 'Reviewed records removed from the cloud. Keep your verified ZIP to restore them later.'
          : 'Missing records restored. Existing live records were preserved.';
        error = false;
        render();
        a.tell(status);
      } catch (err) {
        if (sent && !applied && identity() === c?.owner) a.uncertain();
        if (dialog?.open)
          notice(
            sent
              ? 'The save could not be confirmed. Reload cloud records before retrying; your local archive is unchanged.'
              : err.message,
            true
          );
      } finally {
        form.elements.password.value = '';
        if (currentCloud.resetting === c) currentCloud.resetting = null;
        setBusy(false);
        try {
          await verifier?.auth.signOut({ scope: 'local' });
        } catch {}
        if (applied) void refresh();
      }
    }
    document
      .getElementById('storageManagerButton')
      ?.addEventListener('click', () => void open().catch(err => a.tell(err.message, true)));
    return { open, sync, close, refresh, action, readFile, commit };
  }
  root.WorkHubStorage = { install, size };
})(window);
