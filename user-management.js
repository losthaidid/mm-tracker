/* Owner-only administration. All mutations are verified again by the backend. */
(function (root) {
  'use strict';
  const C = root.WorkHubAccessCatalog,
    esc = v =>
      String(v ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      );
  const button = (op, label, extra = '', cls = '') =>
    `<button type="button" class="um-button ${cls}" data-um="${op}" ${extra}>${label}</button>`;
  function install(a) {
    let data = null,
      tab = 'requests',
      query = '',
      selected = null,
      permissions = null,
      preview = null,
      mode = '',
      busy = false,
      version = 0,
      account = '',
      error = '';
    const owner = () =>
      a.access()?.snapshot()?.role === 'owner' && a.access()?.snapshot()?.status === 'active';
    const date = v => (v ? new Date(v).toLocaleString() : 'Not yet');
    function clear() {
      version++;
      data = permissions = selected = preview = null;
      query = error = mode = '';
      busy = false;
      account = '';
      if (document.querySelector('.um-room')) {
        document.querySelector('.um-room').replaceChildren();
        a.closeModal();
      }
    }
    function alive(token) {
      return (
        token === version &&
        account === a.cloud().user?.id &&
        owner() &&
        !!document.querySelector('.um-room')
      );
    }
    async function call(action, target = null, payload = {}, password = '') {
      if (!owner()) throw Error('Owner access required.');
      const { data: session, error: sessionError } = await a.cloud().client.auth.getSession();
      if (sessionError || !session?.session?.access_token)
        throw Error('Sign in again to manage users.');
      const response = await root.fetch(a.url() + '/functions/v1/workhub-admin', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + session.session.access_token,
          apikey: a.key(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, target, payload, ...(password ? { password } : {}) }),
      });
      const body = await response.json();
      if (!response.ok || body.error)
        throw Error(body.error || 'The action could not be completed.');
      return body.data ?? body;
    }
    function shell() {
      return `<section class="um-room"><header class="um-hero"><div><span class="um-eyebrow">YOUR WORKSPACE. YOUR INVITATION.</span><h2>A place for the right people.</h2><p>Review requests, shape access and keep your workspace in good hands.</p></div><span class="um-owner-mark" aria-hidden="true">✧</span></header><div id="umStats" class="um-stats"></div><div class="um-toolbar"><nav aria-label="User management views">${[
        ['requests', 'Access requests'],
        ['users', 'User accounts'],
        ['history', 'Activity history'],
      ]
        .map(([id, n]) => button('tab', n, `data-um-tab="${id}" aria-pressed="${tab === id}"`))
        .join(
          ''
        )}</nav><label class="um-search">Find a person<input id="umSearch" type="search" maxlength="150" placeholder="Name or email…" value="${esc(query)}"></label>${button('refresh', '↻ Refresh')}</div><p id="umNotice" role="status" aria-live="polite"></p><div class="um-layout"><div id="umList"></div><aside id="umInspector"></aside></div></section>`;
    }
    async function open() {
      if (!owner()) throw Error('Owner access required.');
      clear();
      account = a.cloud().user.id;
      a.openModal('User management', shell());
      await refresh();
    }
    async function refresh() {
      const token = version;
      busy = true;
      notice('Opening user management…');
      try {
        const next = await call('list');
        if (!alive(token)) return;
        data = next;
        selected = permissions = preview = null;
        error = '';
        paint();
      } catch (e) {
        if (alive(token)) notice(e.message, true);
      } finally {
        if (alive(token)) {
          busy = false;
          setBusy();
        }
      }
    }
    function notice(text, problem = false) {
      const e = document.getElementById('umNotice');
      if (e) {
        e.textContent = text;
        e.classList.toggle('um-error', problem);
      }
      error = problem ? text : '';
    }
    function setBusy() {
      for (const b of document.querySelectorAll('.um-room button')) b.disabled = busy;
    }
    function paint() {
      if (!data) return;
      document.getElementById('umStats').innerHTML = [
        ['Pending requests', data.requests.filter(r => r.status === 'pending').length],
        ['Active accounts', data.users.filter(u => u.status === 'active').length],
        ['Suspended', data.users.filter(u => u.status === 'suspended').length],
      ]
        .map(([n, v]) => `<article><span>${n}</span><strong>${v}</strong></article>`)
        .join('');
      for (const b of document.querySelectorAll('.um-room [data-um="tab"]'))
        b.setAttribute('aria-pressed', String(b.dataset.umTab === tab));
      paintList();
      paintInspector();
      setBusy();
      notice(error || 'Only the Owner can approve accounts or change access.', !!error);
    }
    function paintList() {
      if (!data) return;
      const q = query.toLowerCase();
      let rows = tab === 'requests' ? data.requests : tab === 'users' ? data.users : data.history;
      rows = rows.filter(r =>
        [r.name, r.email, r.action, r.details?.email].join(' ').toLowerCase().includes(q)
      );
      document.getElementById('umList').innerHTML =
        rows
          .map(r =>
            tab === 'history'
              ? `<article class="um-history"><span class="um-status">${esc(r.action)}</span><strong>${esc(r.details?.email || r.target_id || 'Account administration')}</strong><small>${esc(date(r.created_at))}</small></article>`
              : `<button type="button" class="um-person${selected?.id === r.id ? ' is-selected' : ''}" data-um="select" data-id="${r.id}"><span class="um-avatar" aria-hidden="true">${esc((r.name || r.email || '?').slice(0, 1).toUpperCase())}</span><span><strong>${esc(r.name || r.email)}</strong><small>${esc(r.email)}</small></span><span class="um-status">${esc(tab === 'users' ? (r.role === 'owner' ? 'Owner' : r.status) : r.status)}</span></button>`
          )
          .join('') ||
        `<div class="um-empty"><span aria-hidden="true">✧</span><h3>${query ? 'No matching people' : 'A quiet inbox.'}</h3><p>${tab === 'requests' ? 'New account requests will appear here for your review.' : 'Your account activity will appear here.'}</p></div>`;
    }
    function permissionsForm() {
      return `<div class="um-presets"><label>Start with a preset<select id="umPreset"><option value="">Choose…</option><option value="use">Full workspace</option><option value="view">Read only</option><option value="validation">Validation tools</option></select></label></div><p class="um-help">Hidden removes a feature. Disabled shows it locked. View only blocks edits. Enabled uses the action switches below. Parent restrictions apply to their tools.</p><div class="um-permissions">${[
        ...new Set(C.features.map(f => f.group)),
      ]
        .map(
          group =>
            `<details open><summary>${esc(group)}</summary>${C.features
              .filter(f => f.group === group)
              .map(f => {
                const p = permissions[f.id];
                return `<div class="um-permission" data-permission="${f.id}"><label><strong>${esc(f.name)}</strong><select data-permission-mode="${f.id}" aria-label="Access to ${esc(f.name)}">${[
                  ['hidden', 'Hidden'],
                  ['disabled', 'Disabled'],
                  ['view', 'View only'],
                  ['use', 'Enabled'],
                ]
                  .map(
                    ([v, n]) =>
                      `<option value="${v}"${p.mode === v ? ' selected' : ''}>${n}</option>`
                  )
                  .join(
                    ''
                  )}</select></label><div class="um-action-switches">${C.actions.map(k => `<label><input type="checkbox" data-permission-action="${f.id}" data-key="${k}"${p[k] ? ' checked' : ''}${p.mode !== 'use' ? ' disabled' : ''}>${k === 'run' ? 'Run / use' : k[0].toUpperCase() + k.slice(1)}</label>`).join('')}</div></div>`;
              })
              .join('')}</details>`
        )
        .join('')}</div>`;
    }
    function paintInspector() {
      const el = document.getElementById('umInspector');
      if (!el) return;
      if (!selected || tab === 'history') {
        el.innerHTML =
          '<div class="um-inspector-empty"><span aria-hidden="true">↖</span><h3>Choose a person.</h3><p>Review their request or tailor their workspace access here.</p></div>';
        return;
      }
      const request = tab === 'requests';
      el.innerHTML = `<div class="um-profile-heading"><span class="um-eyebrow">${request ? 'ACCESS REQUEST' : 'USER ACCOUNT'}</span><h3>${esc(selected.name || selected.email)}</h3><p>${esc(selected.email)}</p><span class="um-status">${esc(selected.role === 'owner' ? 'Protected Owner' : selected.status)}</span></div>${request ? `<p class="um-reason">${esc(selected.reason || 'No reason supplied.')}</p><small class="um-help">Requested ${esc(date(selected.created_at))}</small>${selected.note ? '<p class="um-note">' + esc(selected.note) + '</p>' : ''}` : `<div class="um-account-dates"><span>Joined ${esc(date(selected.createdAt))}</span><span>Last sign-in ${esc(date(selected.lastSignIn))}</span></div>`}${selected.role === 'owner' ? '<p class="um-note">Your Owner account keeps full access and cannot be suspended or deleted here.</p>' : preview ? `<form id="umDeleteForm"><div class="um-delete-warning"><h4>Delete this account permanently?</h4><p>The login and its saved workspace will be removed. This cannot be undone.</p><p>${preview.counts.tickets} tickets · ${preview.counts.tasks} tasks · ${preview.counts.projects} projects</p><p>Workspace size: ${(preview.bytes / 1024).toFixed(1)} KB. Ask the user to download their backup before proceeding.</p></div><label>Type ${esc(preview.email)}<input name="confirmEmail" type="email" autocomplete="off" required></label><label>Your Owner password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label><div class="um-actions">${button('cancel-delete', 'Cancel')}<button class="um-button um-danger" type="submit">Delete account permanently</button></div></form>` : request && selected.user_id ? '<p class="um-note">An account has been created for this approved request. Manage its access under User accounts.</p>' + button('invite', 'Resend invitation') : `${permissionsForm()}<div class="um-actions">${request ? button('approve', selected.status === 'approved' ? 'Save permissions & send invite' : 'Approve & send invite', '', 'um-primary') + button('reject', 'Reject request', '', 'um-danger') : button('save', 'Save permissions', '', 'um-primary') + button(selected.status === 'active' ? 'suspend' : 'activate', selected.status === 'active' ? 'Suspend access' : 'Reactivate access') + button('preview-delete', selected.status === 'deleting' ? 'Review pending deletion' : 'Delete account', '', 'um-danger')}</div>${request && selected.status === 'approved' ? button('invite', 'Retry invitation') : ''}`}`;
    }
    function choose(id) {
      preview = null;
      selected = (tab === 'requests' ? data.requests : data.users).find(r => r.id === id);
      permissions = C.normalize(selected?.permissions || C.preset());
      if (tab === 'requests' && selected && selected.status === 'pending') permissions = C.preset();
      paintList();
      paintInspector();
    }
    async function run(action, password = '', payload = {}) {
      if (busy || !selected) return;
      busy = true;
      setBusy();
      const token = version,
        target = selected.id;
      try {
        const result = await call(
          action,
          target,
          {
            version: selected.version,
            permissions: permissions && JSON.parse(JSON.stringify(permissions)),
            ...payload,
          },
          password
        );
        if (!alive(token)) return;
        if (action === 'preview-delete') {
          preview = result;
          paintInspector();
          notice('Review the records and confirm your Owner password before deleting.');
        } else {
          preview = selected = permissions = null;
          const fresh = await call('list');
          if (!alive(token)) return;
          data = fresh;
          paint();
          notice(
            action === 'delete'
              ? 'Account and saved workspace deleted.'
              : action === 'approve' || action === 'invite'
                ? 'Invitation sent. The user can confirm their email and set a password.'
                : 'Account access updated.'
          );
        }
      } catch (e) {
        if (alive(token)) notice(e.message, true);
      } finally {
        if (alive(token)) {
          busy = false;
          setBusy();
        }
      }
    }
    document.addEventListener('click', event => {
      const b = event.target.closest?.('[data-um]');
      if (!b || !b.closest('.um-room')) return;
      event.preventDefault();
      if (busy) return;
      if (!owner()) {
        clear();
        return;
      }
      const op = b.dataset.um;
      if (op === 'tab') {
        tab = b.dataset.umTab;
        selected = preview = null;
        paint();
      } else if (op === 'select') choose(b.dataset.id);
      else if (op === 'refresh') void refresh();
      else if (op === 'cancel-delete') {
        preview = null;
        paintInspector();
      } else if (op === 'reject') {
        void run('reject', '', { note: 'Request rejected by the Owner.' });
      } else void run(op === 'save' ? 'permissions' : op);
    });
    document.addEventListener('input', event => {
      if (event.target.id === 'umSearch') {
        query = event.target.value;
        paintList();
      }
    });
    document.addEventListener('change', event => {
      const el = event.target;
      if (!el.closest?.('.um-room') || !permissions) return;
      if (el.id === 'umPreset') {
        permissions = C.preset(el.value === 'validation' ? 'hidden' : el.value || 'use');
        if (el.value === 'validation') {
          for (const id of ['home', 'validator', 'studio', 'studio.reader', 'workspace'])
            permissions[id] = C.preset()[id];
        }
        paintInspector();
      } else if (el.dataset.permissionMode) {
        const p = permissions[el.dataset.permissionMode];
        p.mode = el.value;
        for (const key of C.actions) p[key] = el.value === 'use';
        for (const input of el
          .closest('.um-permission')
          .querySelectorAll('[data-permission-action]')) {
          input.disabled = el.value !== 'use';
          input.checked = p[input.dataset.key];
        }
      } else if (el.dataset.permissionAction)
        permissions[el.dataset.permissionAction][el.dataset.key] = el.checked;
    });
    document.addEventListener('submit', event => {
      if (event.target.id !== 'umDeleteForm') return;
      event.preventDefault();
      if (!preview) return;
      const form = event.target,
        password = form.elements.password.value,
        email = form.elements.confirmEmail.value.trim();
      form.elements.password.value = '';
      if (email.toLowerCase() !== preview.email.toLowerCase()) {
        notice('Type the account email exactly to confirm.', true);
        return;
      }
      void run('delete', password, { email, revision: preview.revision, version: preview.version });
    });
    root.addEventListener('pagehide', clear);
    return {
      open,
      clear,
      sync() {
        if (account && account !== a.cloud().user?.id) clear();
      },
      snapshot: () => ({ tab, selected: selected?.id || '', busy }),
    };
  }
  root.WorkHubUserManagement = { install };
})(window);
