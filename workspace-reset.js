/** Explicit, password-verified account reset. A revision conflict never merges a wipe. */
(function (root) {
  'use strict';
  const esc = s =>
    String(s ?? '').replace(
      /[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const records = value => JSON.stringify(JSON.parse(value).data);
  function unfinished(d) {
    return {
      tickets: d.tickets.filter(
        t => !['closed', 'completed'].includes(String(t.status).trim().toLowerCase())
      ),
      projects: d.projects.filter(
        p => !['closed', 'completed'].includes(String(p.phase).trim().toLowerCase())
      ),
    };
  }
  function install(a) {
    let review = null,
      busy = false;
    const sameAccount = r =>
      a.cloud().ready && a.cloud().user?.id === r.owner && a.cloud().generation === r.generation;
    const valid = r =>
      review === r &&
      sameAccount(r) &&
      document.getElementById('modal')?.open &&
      !!document.getElementById('workspaceResetForm');
    function available() {
      const c = a.cloud();
      if (!c.ready || !c.user) throw Error('Sign in and open your records first.');
      if (c.busy || c.pending || c.inFlight || c.refreshing || c.loading || c.conflict || c.error)
        throw Error('Finish syncing or reload your cloud records before clearing.');
      if (a.timer()) throw Error('Stop and save your active work session before clearing records.');
      a.checkCache?.();
    }
    function open() {
      if (busy) return;
      available();
      const c = a.cloud(),
        d = a.state(),
        open = unfinished(d);
      review = {
        owner: c.user.id,
        generation: c.generation,
        revision: c.revision,
        raw: a.payload(d),
        downloaded: false,
      };
      a.openModal(
        'Back up & clear all records',
        `<form id="workspaceResetForm"><p>Download a complete JSON backup of your cloud records, then verify your account password to start a fresh workspace.</p><div class="view-details"><div><strong>${d.tickets.length}</strong> tickets</div><div><strong>${d.projects.length}</strong> projects</div><div><strong>${d.tasks.length}</strong> tasks</div><div><strong>${d.schedule.length}</strong> schedule entries</div></div><p>All cloud records, including knowledge, processes, sessions, expenses, leave records, templates and saved settings, will be cleared. Your login stays. Default lists and one empty starter project are recreated. Device-only background pictures and files you downloaded stay on your device.</p><button type="button" data-workspace-reset="backup">1. Download all records</button><p data-reset-backup role="status">Save the backup somewhere you can find it.</p><label class="check-label"><input type="checkbox" name="backupSaved" required> I have saved my backup file.</label>${open.tickets.length || open.projects.length ? `<section class="workspace-reset-warning"><strong>${open.tickets.length} unfinished tickets · ${open.projects.length} unfinished projects</strong><p>Complete or close these first, or explicitly confirm that you want to clear unfinished work.</p><details><summary>Review unfinished work</summary><ul>${open.tickets.map(t => `<li>Ticket: ${esc(t.ticket)} · ${esc(t.status)}</li>`).join('')}${open.projects.map(p => `<li>Project: ${esc(p.name)} · ${esc(p.phase)}</li>`).join('')}</ul></details><label class="check-label"><input type="checkbox" name="unfinishedConfirmed" required> Clear these unfinished tickets and projects too.</label></section>` : '<p>All tickets and projects are completed or closed.</p>'}<label>Type CLEAR to confirm<input name="confirmation" autocomplete="off" required pattern="CLEAR"></label><label>Current account password<input name="password" type="password" autocomplete="current-password" required></label><p data-reset-error role="status" aria-live="polite"></p><div class="modal-actions"><button type="button" data-action="cancel">Cancel</button><button type="submit" class="danger">Verify password & clear records</button></div></form>`
      );
    }
    function backup() {
      const r = review;
      if (!r || !valid(r) || busy) return;
      available();
      r.raw = a.payload(a.state());
      r.revision = a.cloud().revision;
      a.validate(JSON.parse(r.raw).data);
      a.download(r.raw, 'WorkHub-before-clear-' + a.today() + '.json', 'application/json');
      r.downloaded = true;
      const message = document.querySelector('[data-reset-backup]');
      if (message)
        message.textContent =
          'Backup download started. Confirm the file is saved before continuing.';
    }
    async function submit(form) {
      if (busy) return;
      const r = review,
        c = a.cloud(),
        message = form.querySelector('[data-reset-error]'),
        button = form.querySelector('[type="submit"]');
      let verifier = null,
        sent = false,
        applied = false;
      try {
        if (!r || !valid(r)) throw Error('The account changed. Open this review again.');
        available();
        if (!r.downloaded || !form.elements.backupSaved.checked)
          throw Error('Download and save the complete backup first.');
        if (records(a.payload(a.state())) !== records(r.raw) || c.revision !== r.revision)
          throw Error('Your records changed. Open this review again and download a new backup.');
        const open = unfinished(a.state());
        if (
          (open.tickets.length || open.projects.length) &&
          !form.elements.unfinishedConfirmed?.checked
        )
          throw Error(
            'Complete or close your tickets and projects, or confirm clearing unfinished work.'
          );
        if (form.elements.confirmation.value !== 'CLEAR') throw Error('Type CLEAR to confirm.');
        if (!form.elements.password.value) throw Error('Enter your current account password.');
        busy = true;
        c.resetting = r;
        for (const b of form.querySelectorAll('button')) b.disabled = true;
        const close = document.getElementById('closeModal');
        if (close) close.disabled = true;
        message.textContent = 'Verifying your password…';
        // An isolated in-memory session cannot switch or sign out the main account.
        verifier = a.createClient();
        const auth = await verifier.auth.signInWithPassword({
          email: c.user.email,
          password: form.elements.password.value,
        });
        form.elements.password.value = '';
        if (auth.error)
          throw Error('Password verification failed. Check your password and try again.');
        if (auth.data?.user?.id !== r.owner)
          throw Error('The password must match the current account.');
        if (!valid(r)) throw Error('The account changed. Nothing further was cleared.');
        const remote = await verifier
          .from('mm_tracker_documents')
          .select('revision')
          .eq('user_id', r.owner)
          .maybeSingle();
        if (remote.error) throw remote.error;
        if (Number(remote.data?.revision || 0) !== r.revision)
          throw Error(
            'Another device changed your records. Reload and make a new backup before clearing.'
          );
        a.checkCache?.();
        if (!valid(r) || records(a.payload(a.state())) !== records(r.raw))
          throw Error('Your records changed. Open this review again.');
        const next = a.empty();
        a.validate(next);
        const freshDocument = JSON.parse(a.payload(next));
        message.textContent = 'Clearing this account’s records…';
        sent = true;
        const result = await verifier.rpc('save_mm_tracker', {
          p_document: freshDocument,
          p_expected_revision: r.revision,
          p_mutation_id: root.crypto.randomUUID(),
        });
        if (result.error) throw result.error;
        const saved = result.data?.[0];
        if (!saved || !Number.isSafeInteger(Number(saved.revision)))
          throw Error('The server did not confirm the clear request.');
        if (!valid(r)) {
          if (sameAccount(r)) a.uncertain();
          return;
        }
        a.apply(freshDocument, Number(saved.revision));
        applied = true;
        review = null;
        a.closeModal();
        a.tell(
          'All account records cleared. A fresh workspace is ready; keep your backup to restore them.'
        );
      } catch (err) {
        if (r && valid(r)) {
          if (sent && !applied) a.uncertain();
          message.textContent = sent
            ? 'The clear request was not confirmed. Reload cloud records before editing or retrying. Your downloaded backup is unchanged.'
            : err.message;
          a.tell(message.textContent, true);
        }
      } finally {
        form.elements.password.value = '';
        if (c.resetting === r) c.resetting = null;
        busy = false;
        button.disabled = false;
        for (const b of form.querySelectorAll('button')) b.disabled = false;
        const close = document.getElementById('closeModal');
        if (close) close.disabled = false;
        try {
          await verifier?.auth.signOut({ scope: 'local' });
        } catch {}
      }
    }
    document.getElementById('workspaceResetButton')?.addEventListener('click', () => {
      try {
        open();
      } catch (e) {
        a.tell(e.message, true);
      }
    });
    document.addEventListener('click', e => {
      if (e.target.closest?.('[data-workspace-reset="backup"]')) {
        try {
          backup();
        } catch (err) {
          a.tell(err.message, true);
        }
      }
    });
    document.addEventListener('submit', e => {
      if (e.target.id === 'workspaceResetForm') {
        e.preventDefault();
        void submit(e.target);
      }
    });
    document.getElementById('modal')?.addEventListener('cancel', e => {
      if (busy) e.preventDefault();
    });
    document.addEventListener(
      'keydown',
      e => {
        if (busy && document.getElementById('workspaceResetForm') && e.key === 'Escape') {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      },
      true
    );
    return { open, backup, submit, unfinished };
  }
  root.WorkHubWorkspaceReset = { install, unfinished };
})(window);
