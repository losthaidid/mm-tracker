/**
 * recipients.js
 * Company recipient directory: forms, search, undo and copy controls.
 * Uses recipients-engine.js for rules and a.mutate() for account saves.
 * esc() protects record text inserted into HTML; owner guards reject stale account forms.
 * File map: docs/FILE-MAP.md
 */
/* An account-owned address book, with copy controls for each company. */
(function (root) {
  'use strict';
  const E = root.WorkHubRecipientsEngine,
    esc = value =>
      String(value ?? '').replace(
        /[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
      );
  const uid = () =>
    root.crypto?.randomUUID?.() ||
    'recipient-' + Date.now().toString(36) + Math.random().toString(36).slice(2);
  const icon =
    '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>';
  const button = (action, label, extra = '', cls = '') =>
    '<button type="button" class="' +
    cls +
    '" data-recipient="' +
    action +
    '" ' +
    extra +
    '>' +
    label +
    '</button>';
  const input = (name, label, value = '', extra = '') =>
    '<div><label for="recipient-' +
    name +
    '">' +
    label +
    '</label><input id="recipient-' +
    name +
    '" name="' +
    name +
    '" value="' +
    esc(value) +
    '" ' +
    extra +
    '></div>';
  const roleOptions = value =>
    Object.entries(E.ROLES)
      .map(
        ([id, label]) =>
          '<option value="' +
          id +
          '"' +
          (id === value ? ' selected' : '') +
          '>' +
          label +
          '</option>'
      )
      .join('');
  function install(a) {
    const $ = id => document.getElementById(id),
      data = () => a.state().workhub.recipients;
    let owner = '',
      selected = '',
      companyQuery = '',
      contactQuery = '',
      role = 'all',
      separator = 'semicolon',
      undo = null;
    const company = () => data().companies.find(c => c.id === selected);
    function sync() {
      const next = a.ready() ? a.owner() : '';
      if (next !== owner) {
        if (document.querySelector('[data-recipient-screen]')) a.closeModal();
        owner = next;
        selected = companyQuery = contactQuery = '';
        role = 'all';
        separator = 'semicolon';
        undo = null;
      }
    }
    function ready() {
      sync();
      if (!a.ready() || !owner) throw Error('Sign in to open your company email lists.');
    }
    function show(title, html, screen) {
      ready();
      if ($('settingsMenu')) $('settingsMenu').open = false;
      a.openModal(
        title,
        '<section class="recipient-root" data-recipient-screen="' +
          screen +
          '" data-recipient-owner="' +
          esc(owner) +
          '">' +
          html +
          '</section>'
      );
      $('modal').classList.remove('hub-drawer');
    }
    /** Reject forms left open across a sign-out, account switch or record removal. */
    function checkedForm(form, id) {
      ready();
      if (form?.id !== id || !form.isConnected || !$('modal').open || form.dataset.owner !== owner)
        throw Error('Reopen this recipient editor before saving.');
    }
    function save(fn, message) {
      ready();
      const ok = a.mutate(fn);
      if (ok && message) a.tell(message);
      return ok;
    }
    function report(error, form) {
      const host =
        form?.querySelector('[data-recipient-error]') ||
        document.querySelector('[data-recipient-screen] [data-recipient-error]');
      if (host) {
        host.textContent = error.message;
        host.hidden = false;
      }
      a.tell(error.message, true);
    }
    function companyRows() {
      const rows = data()
        .companies.filter(c =>
          E.key(
            c.name + ' ' + c.notes + ' ' + c.contacts.map(r => r.email + ' ' + r.name).join(' ')
          ).includes(E.key(companyQuery))
        )
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name));
      return (
        rows
          .map(c => {
            const count = E.recipients(c).length;
            return (
              '<div class="recipient-company-row' +
              (c.id === selected ? ' is-selected' : '') +
              '">' +
              button(
                'choose-company',
                '<span class="recipient-company-avatar" aria-hidden="true">' +
                  esc(c.name.trim().slice(0, 1).toUpperCase()) +
                  '</span><span><strong class="hub-sensitive">' +
                  esc(c.name) +
                  '</strong><small>' +
                  count +
                  ' enabled · ' +
                  c.contacts.length +
                  ' saved</small></span>',
                'data-id="' + esc(c.id) + '"' + (c.id === selected ? ' aria-current="true"' : '')
              ) +
              button(
                'quick-copy',
                'Copy',
                'data-id="' +
                  esc(c.id) +
                  '" aria-label="Copy all enabled addresses for ' +
                  esc(c.name) +
                  '"' +
                  (count ? '' : ' disabled'),
                'recipient-quick-copy'
              ) +
              '</div>'
            );
          })
          .join('') ||
        '<p class="recipient-empty-small">' +
          (data().companies.length
            ? 'No matching companies.'
            : 'Your company lists will appear here.') +
          '</p>'
      );
    }
    function contactRows() {
      const c = company();
      if (!c) return '';
      const query = E.key(contactQuery),
        shown = c.contacts.filter(r =>
          E.key(r.name + ' ' + r.email + ' ' + E.ROLES[r.role]).includes(query)
        );
      return (
        shown
          .map(
            r =>
              '<article class="recipient-contact' +
              (r.enabled ? '' : ' is-excluded') +
              '"><label class="recipient-include"><input type="checkbox" data-recipient-toggle="' +
              esc(r.id) +
              '"' +
              (r.enabled ? ' checked' : '') +
              ' aria-label="Include ' +
              esc(r.email) +
              ' when copying"></label><span class="recipient-role recipient-role-' +
              r.role +
              '">' +
              E.ROLES[r.role] +
              '</span><div class="recipient-contact-text hub-sensitive"><strong>' +
              esc(r.name || r.email) +
              '</strong>' +
              (r.name ? '<span>' + esc(r.email) + '</span>' : '') +
              '<small>' +
              (r.enabled ? 'Included when copying' : 'Excluded from copying') +
              '</small></div><div class="recipient-row-actions">' +
              button(
                'edit-contact',
                'Edit',
                'data-id="' + esc(r.id) + '" aria-label="Edit ' + esc(r.name || r.email) + '"'
              ) +
              button(
                'delete-contact',
                'Remove',
                'data-id="' + esc(r.id) + '" aria-label="Remove ' + esc(r.name || r.email) + '"'
              ) +
              '</div></article>'
          )
          .join('') ||
        '<div class="recipient-empty"><span aria-hidden="true">' +
          icon +
          '</span><strong>' +
          (c.contacts.length
            ? 'No matching recipients.'
            : 'An empty list, ready for familiar names.') +
          '</strong><p>' +
          (c.contacts.length
            ? 'Try another name, address or group.'
            : 'Add one recipient, or paste a whole list to get started.') +
          '</p></div>'
      );
    }
    function undoHTML() {
      return undo
        ? '<div class="recipient-undo" role="status"><span>' +
            esc(undo.type === 'company' ? 'Company list removed.' : 'Recipient removed.') +
            '</span>' +
            button('undo', 'Undo removal') +
            '</div>'
        : '';
    }
    function open(id = selected) {
      ready();
      selected = data().companies.some(c => c.id === id) ? id : data().companies[0]?.id || '';
      const c = company();
      show(
        'Company email recipients',
        '<div id="recipientDirectory"><header class="recipient-hero"><span class="recipient-hero-icon" aria-hidden="true">' +
          icon +
          '</span><div><span class="hub-kicker">YOUR COMPANY ADDRESS BOOK</span><h3>The right people, ready to copy.</h3><p>Maintain a list for each company and reuse its addresses whenever you need them.</p></div>' +
          button('new-company', '＋ Add company', '', 'primary') +
          '</header>' +
          undoHTML() +
          '<p class="recipient-error" data-recipient-error role="alert" hidden></p><div class="recipient-layout"><aside class="recipient-sidebar"><label for="recipientCompanySearch">Find a company</label><input id="recipientCompanySearch" type="search" value="' +
          esc(companyQuery) +
          '" placeholder="Company, person or email"><div id="recipientCompanies" class="recipient-company-list">' +
          companyRows() +
          '</div><p class="recipient-sidebar-note">' +
          data().companies.length +
          ' company list' +
          (data().companies.length === 1 ? '' : 's') +
          ' · saved with your account</p></aside><div class="recipient-main">' +
          (c
            ? '<div class="recipient-company-heading"><div><span class="hub-kicker">COMPANY RECIPIENTS</span><h3 class="hub-sensitive">' +
              esc(c.name) +
              '</h3>' +
              (c.notes ? '<p class="hub-sensitive">' + esc(c.notes) + '</p>' : '') +
              '</div><div class="recipient-row-actions">' +
              button('edit-company', 'Edit company', 'data-id="' + esc(c.id) + '"') +
              button('delete-company', 'Remove list', 'data-id="' + esc(c.id) + '"') +
              '</div></div><section class="recipient-copy-card" aria-label="Copy company email addresses"><div class="recipient-copy-heading"><div><strong>Ready for your next email</strong><p>Choose a group, then copy its enabled addresses.</p></div><label>Separate addresses with<select id="recipientSeparator"><option value="semicolon"' +
              (separator === 'semicolon' ? ' selected' : '') +
              '>Semicolons · Outlook</option><option value="comma"' +
              (separator === 'comma' ? ' selected' : '') +
              '>Commas</option><option value="lines"' +
              (separator === 'lines' ? ' selected' : '') +
              '>One per line</option></select></label></div><div class="recipient-copy-groups" id="recipientCopyGroups" aria-label="Recipient group"></div><label for="recipientCopyPreview" class="sr-only">Addresses to copy</label><textarea id="recipientCopyPreview" class="hub-sensitive" rows="3" readonly spellcheck="false"></textarea><div class="recipient-copy-footer"><span id="recipientCopyCount"></span><div>' +
              button('select-copy', 'Select addresses') +
              button('copy', 'Copy addresses', 'id="recipientCopyButton"', 'primary') +
              '</div></div><p id="recipientCopyStatus" class="recipient-copy-status" role="status" aria-live="polite"></p><small>All combines To, Cc and Bcc into one list. Copy each group separately to keep those email fields separate.</small></section><div class="recipient-contacts-heading"><div><h4>People & addresses <span id="recipientSavedCount">' +
              c.contacts.length +
              '</span></h4><p>Turn off a recipient’s switch to leave them out of copies.</p></div><div class="recipient-row-actions">' +
              button('bulk', 'Paste a list') +
              button('new-contact', '＋ Add recipient', '', 'primary') +
              '</div></div><label class="sr-only" for="recipientContactSearch">Find a recipient</label><input id="recipientContactSearch" type="search" value="' +
              esc(contactQuery) +
              '" placeholder="Find a name, address or To / Cc / Bcc"><div class="recipient-contact-list" id="recipientContacts">' +
              contactRows() +
              '</div><p class="recipient-copy-scope">Search filters the displayed rows. Copying uses every enabled address in the chosen group.</p>'
            : '<div class="recipient-empty recipient-first-list"><span aria-hidden="true">' +
              icon +
              '</span><strong>A little less typing, every time.</strong><p>Create your first company list, then add the people you contact most.</p>' +
              button('new-company', '＋ Create a company list', '', 'primary') +
              '</div>') +
          '</div></div></div>',
        'directory'
      );
      updateCopy();
    }
    function updateCopy() {
      const c = company();
      if (!c || !$('recipientCopyPreview')) return;
      const rows = E.recipients(c, role),
        text = E.copyText(c, role, separator);
      $('recipientCopyGroups').innerHTML = Object.entries({ all: 'All', ...E.ROLES })
        .map(([id, label]) =>
          button(
            'choose-role',
            label + ' <span>' + E.recipients(c, id).length + '</span>',
            'data-role="' + id + '" aria-pressed="' + (role === id) + '"',
            role === id ? 'is-active' : ''
          )
        )
        .join('');
      $('recipientCopyPreview').value = text;
      $('recipientCopyButton').disabled = !rows.length;
      $('recipientCopyButton').textContent =
        'Copy ' + rows.length + ' address' + (rows.length === 1 ? '' : 'es');
      $('recipientCopyCount').textContent =
        (role === 'all' ? 'All groups' : E.ROLES[role]) + ' · ' + rows.length + ' enabled';
      document.querySelector('[data-recipient="select-copy"]').disabled = !rows.length;
      $('recipientCopyStatus').textContent = '';
    }
    /** Copy only after checking the current account; show a selectable fallback if Clipboard is unavailable. */
    async function copyAddresses() {
      ready();
      const c = company(),
        view = $('recipientDirectory');
      if (!c || !view) return;
      const text = E.copyText(c, role, separator),
        account = owner;
      if (!text) throw Error('Enable at least one address in this group before copying.');
      const stillHere = () =>
        a.ready() &&
        account === a.owner() &&
        $('modal').open &&
        view === $('recipientDirectory') &&
        $('recipientCopyPreview')?.value === text;
      try {
        if (!root.navigator.clipboard?.writeText) throw Error('Clipboard unavailable');
        await root.navigator.clipboard.writeText(text);
        if (stillHere()) {
          $('recipientCopyStatus').textContent =
            'Copied. Paste these addresses into your email recipient field.';
          a.tell('Email addresses copied.');
        }
      } catch {
        if (!stillHere()) return;
        $('recipientCopyPreview').focus();
        $('recipientCopyPreview').select();
        $('recipientCopyStatus').textContent =
          'Automatic copying is unavailable. The addresses are selected; press Ctrl+C or ⌘C, or use your device’s Copy command.';
        a.tell('Addresses selected for manual copying.');
      }
    }
    function companyForm(id = '', name = '') {
      ready();
      const c = id ? data().companies.find(c => c.id === id) : null;
      if (id && !c) throw Error('This company list no longer exists.');
      const suggestions = [...new Set((a.state().projectCompanies || []).map(c => c.name))];
      show(
        c ? 'Edit company email list' : 'New company email list',
        '<form id="recipientCompanyForm" data-owner="' +
          esc(owner) +
          '" data-id="' +
          esc(id) +
          '" novalidate><div class="recipient-form-intro"><span class="hub-kicker">A HOME FOR YOUR RECIPIENTS</span><h3>' +
          (c ? 'Keep the company details current.' : 'Start with a company name.') +
          '</h3><p>This email list can be reused across projects.</p></div>' +
          input(
            'companyName',
            'Company name',
            c?.name || name,
            'required maxlength="200" list="recipientKnownCompanies" autocomplete="organization" placeholder="e.g. Client company"'
          ) +
          '<datalist id="recipientKnownCompanies">' +
          suggestions.map(n => '<option value="' + esc(n) + '"></option>').join('') +
          '</datalist><label for="recipient-companyNotes">Notes (optional)</label><textarea id="recipient-companyNotes" name="companyNotes" maxlength="2000" rows="3" placeholder="e.g. Project team or department">' +
          esc(c?.notes || '') +
          '</textarea><p class="recipient-error" data-recipient-error role="alert" hidden></p><div class="modal-actions">' +
          button('back', 'Back to directory') +
          '<button type="submit" class="primary">' +
          (c ? 'Save company' : 'Create company list') +
          '</button></div></form>',
        'company'
      );
    }
    function saveCompany(form) {
      checkedForm(form, 'recipientCompanyForm');
      const id = form.dataset.id || uid(),
        old = data().companies.find(c => c.id === id);
      if (form.dataset.id && !old) throw Error('This company list no longer exists.');
      const row = {
        id,
        name: form.elements.namedItem('companyName').value.trim(),
        notes: form.elements.namedItem('companyNotes').value.trim(),
        contacts: old?.contacts || [],
      };
      E.validateCompany(row);
      if (
        save(d => {
          const list = d.workhub.recipients.companies,
            index = list.findIndex(c => c.id === id);
          if (index < 0) list.push(row);
          else list[index] = row;
        }, 'Company email list saved.')
      ) {
        selected = id;
        companyQuery = contactQuery = '';
        open(id);
      }
    }
    function contactForm(id = '') {
      ready();
      const c = company();
      if (!c) throw Error('Choose a company first.');
      const r = id ? c.contacts.find(r => r.id === id) : null;
      if (id && !r) throw Error('This recipient no longer exists.');
      show(
        r ? 'Edit email recipient' : 'Add email recipient',
        '<form id="recipientContactForm" data-owner="' +
          esc(owner) +
          '" data-company="' +
          esc(c.id) +
          '" data-id="' +
          esc(id) +
          '" novalidate><div class="recipient-form-intro"><span class="hub-kicker">' +
          esc(c.name) +
          '</span><h3>' +
          (r ? 'A familiar contact, kept up to date.' : 'Add someone to the list.') +
          '</h3></div><div class="form-grid">' +
          input(
            'contactName',
            'Name / team (optional)',
            r?.name || '',
            'maxlength="120" autocomplete="name"'
          ) +
          input(
            'email',
            'Email address',
            r?.email || '',
            'type="email" required maxlength="254" autocomplete="email" placeholder="name@company.com"'
          ) +
          '<div><label for="recipient-role">Email field</label><select id="recipient-role" name="role">' +
          roleOptions(r?.role || (role === 'all' ? 'to' : role)) +
          '</select></div></div><label class="recipient-form-check"><input type="checkbox" name="enabled"' +
          (!r || r.enabled ? ' checked' : '') +
          '>Include this address when copying</label><p class="hint">An address can appear once per company. The same address may be used in another company’s list.</p><p class="recipient-error" data-recipient-error role="alert" hidden></p><div class="modal-actions">' +
          button('back', 'Back to directory') +
          '<button type="submit" class="primary">Save recipient</button></div></form>',
        'contact'
      );
    }
    function saveContact(form) {
      checkedForm(form, 'recipientContactForm');
      const c = data().companies.find(c => c.id === form.dataset.company);
      if (!c) throw Error('This company list no longer exists.');
      const id = form.dataset.id || uid(),
        old = c.contacts.find(r => r.id === id),
        value = k => form.elements.namedItem(k).value.trim();
      if (form.dataset.id && !old) throw Error('This recipient no longer exists.');
      if (!E.email(value('email')))
        throw Error('Enter a valid email address, such as name@company.com.');
      const row = {
        id,
        name: value('contactName'),
        email: value('email'),
        role: value('role'),
        enabled: form.elements.namedItem('enabled').checked,
      };
      if (
        save(d => {
          const contacts = d.workhub.recipients.companies.find(x => x.id === c.id).contacts,
            index = contacts.findIndex(r => r.id === id);
          if (index < 0) contacts.push(row);
          else contacts[index] = row;
        }, 'Email recipient saved.')
      ) {
        selected = c.id;
        contactQuery = '';
        open(c.id);
      }
    }
    function bulkForm() {
      ready();
      const c = company();
      if (!c) throw Error('Choose a company first.');
      show(
        'Paste email recipients',
        '<form id="recipientBulkForm" data-owner="' +
          esc(owner) +
          '" data-company="' +
          esc(c.id) +
          '" novalidate><div class="recipient-form-intro"><span class="hub-kicker">' +
          esc(c.name) +
          '</span><h3>A whole list, in one little step.</h3><p>Separate addresses with semicolons, commas or new lines. Names such as Alex &lt;alex@company.com&gt; are welcome too.</p></div><label for="recipient-bulkRole">Add these addresses to</label><select id="recipient-bulkRole" name="role">' +
          roleOptions(role === 'all' ? 'to' : role) +
          '</select><label for="recipient-bulkEmails">Email addresses</label><textarea id="recipient-bulkEmails" name="emails" rows="9" maxlength="160000" spellcheck="false" required placeholder="Alex &lt;alex@company.com&gt;&#10;team@company.com"></textarea><p id="recipientBulkPreview" role="status" class="recipient-bulk-preview">Paste up to 500 addresses. Duplicates will be skipped.</p><p class="recipient-error" data-recipient-error role="alert" hidden></p><div class="modal-actions">' +
          button('back', 'Back to directory') +
          '<button type="submit" class="primary">Add recipients</button></div></form>',
        'bulk'
      );
    }
    function bulkResult(form) {
      const c = data().companies.find(c => c.id === form.dataset.company);
      if (!c) throw Error('This company list no longer exists.');
      return E.addition(
        c,
        form.elements.namedItem('emails').value,
        form.elements.namedItem('role').value,
        uid
      );
    }
    /** Commit reviewed parsed contacts through the shared save adapter. */
    function saveBulk(form) {
      checkedForm(form, 'recipientBulkForm');
      const result = bulkResult(form);
      if (!result.contacts.length)
        throw Error(
          'All of these addresses are already in this company’s list. Existing groups and switches were kept.'
        );
      if (
        save(
          d =>
            d.workhub.recipients.companies
              .find(c => c.id === form.dataset.company)
              .contacts.push(...result.contacts),
          result.contacts.length +
            ' recipient' +
            (result.contacts.length === 1 ? '' : 's') +
            ' added' +
            (result.skipped
              ? ' · ' +
                result.skipped +
                ' duplicate' +
                (result.skipped === 1 ? '' : 's') +
                ' skipped.'
              : '.')
        )
      ) {
        selected = form.dataset.company;
        contactQuery = '';
        open(selected);
      }
    }
    function shortcut(name) {
      ready();
      const c = data().companies.find(c => E.key(c.name) === E.key(name));
      if (c) {
        contactQuery = '';
        open(c.id);
      } else companyForm('', name);
    }
    function removeCompany(id) {
      const row = data().companies.find(c => c.id === id),
        index = data().companies.findIndex(c => c.id === id);
      if (!row) throw Error('This company list no longer exists.');
      if (
        !root.confirm(
          'Remove the email list for "' +
            row.name +
            '" and its ' +
            row.contacts.length +
            ' saved recipients? This affects the email directory only.'
        )
      )
        return;
      if (
        save(d => {
          d.workhub.recipients.companies = d.workhub.recipients.companies.filter(c => c.id !== id);
        }, 'Company email list removed. Undo is available in the directory.')
      ) {
        undo = { type: 'company', row: JSON.parse(JSON.stringify(row)), index, owner };
        selected = '';
        open();
      }
    }
    function removeContact(id) {
      const c = company(),
        row = c?.contacts.find(r => r.id === id),
        index = c?.contacts.findIndex(r => r.id === id);
      if (!row) throw Error('This recipient no longer exists.');
      if (
        save(d => {
          const c = d.workhub.recipients.companies.find(c => c.id === selected);
          c.contacts = c.contacts.filter(r => r.id !== id);
        }, 'Recipient removed. Undo is available in the directory.')
      ) {
        undo = {
          type: 'contact',
          companyId: c.id,
          row: JSON.parse(JSON.stringify(row)),
          index,
          owner,
        };
        open();
      }
    }
    function restore() {
      if (!undo || undo.owner !== owner) return;
      const removed = undo;
      if (
        save(d => {
          const list =
            removed.type === 'company'
              ? d.workhub.recipients.companies
              : d.workhub.recipients.companies.find(c => c.id === removed.companyId)?.contacts;
          if (!list) throw Error('Restore the company list before restoring this recipient.');
          if (list.some(r => r.id === removed.row.id))
            throw Error('This record is already present.');
          list.splice(removed.index, 0, removed.row);
        }, 'Removed record restored.')
      ) {
        undo = null;
        open(removed.type === 'company' ? removed.row.id : removed.companyId);
      }
    }
    function mount(tab) {
      sync();
      const settingsHost =
        $('hubSettingsAppearance') || document.querySelector('#settingsMenu .settings-panel');
      if (settingsHost && !$('recipientSettingsButton')) {
        const b = document.createElement('button');
        b.type = 'button';
        b.id = 'recipientSettingsButton';
        b.dataset.recipient = 'open';
        b.textContent = 'Company email recipients';
        settingsHost.append(b);
      }
      if ($('recipientSettingsButton')) $('recipientSettingsButton').hidden = !a.ready();
      if (!a.ready()) return;
      const host = document.querySelector('#view .governance-shell > .flex-title > .actions');
      if (host && !host.querySelector('[data-recipient]'))
        host.insertAdjacentHTML(
          'afterbegin',
          button('open', 'Email recipients', '', 'hub-private-only')
        );
      if (tab === 'specs') {
        const focus = document.querySelector('#view .company-focus'),
          edit = focus?.querySelector('[data-action="edit-company"]'),
          c = a.state().projectCompanies.find(c => c.id === edit?.dataset.id);
        if (c && !focus.querySelector('[data-recipient]'))
          focus.insertAdjacentHTML(
            'beforeend',
            button(
              'company-shortcut',
              icon + ' Email recipients',
              'data-name="' + esc(c.name) + '"',
              'small hub-private-only recipient-company-shortcut'
            )
          );
      }
      const snippets = document.querySelector('#view .wl-hero .wl-actions');
      if (snippets && !snippets.querySelector('[data-recipient]'))
        snippets.insertAdjacentHTML(
          'afterbegin',
          button('open', 'Email recipients', '', 'hub-private-only')
        );
    }
    async function handle(b) {
      ready();
      const action = b.dataset.recipient,
        id = b.dataset.id;
      if (action === 'open' || action === 'back') open();
      else if (action === 'choose-company') {
        if (!data().companies.some(c => c.id === id))
          throw Error('This company list no longer exists.');
        contactQuery = '';
        role = 'all';
        open(id);
      } else if (action === 'quick-copy') {
        if (!data().companies.some(c => c.id === id))
          throw Error('This company list no longer exists.');
        role = 'all';
        contactQuery = '';
        open(id);
        await copyAddresses();
      } else if (action === 'new-company') companyForm();
      else if (action === 'edit-company') companyForm(id);
      else if (action === 'company-shortcut') shortcut(b.dataset.name);
      else if (action === 'new-contact') contactForm();
      else if (action === 'edit-contact') contactForm(id);
      else if (action === 'bulk') bulkForm();
      else if (action === 'choose-role') {
        role = b.dataset.role;
        updateCopy();
        [...document.querySelectorAll('[data-recipient="choose-role"]')]
          .find(el => el.dataset.role === role)
          ?.focus();
      } else if (action === 'copy') await copyAddresses();
      else if (action === 'select-copy') {
        $('recipientCopyPreview').focus();
        $('recipientCopyPreview').select();
        $('recipientCopyStatus').textContent =
          'Addresses selected. Use your device’s Copy command.';
      } else if (action === 'delete-company') removeCompany(id);
      else if (action === 'delete-contact') removeContact(id);
      else if (action === 'undo') restore();
    }
    document.addEventListener(
      'click',
      event => {
        const b = event.target.closest?.('[data-recipient]');
        if (!b) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        void handle(b).catch(error => report(error));
      },
      true
    );
    document.addEventListener(
      'submit',
      event => {
        if (
          !['recipientCompanyForm', 'recipientContactForm', 'recipientBulkForm'].includes(
            event.target.id
          )
        )
          return;
        event.preventDefault();
        event.stopImmediatePropagation();
        try {
          if (event.target.id === 'recipientCompanyForm') saveCompany(event.target);
          else if (event.target.id === 'recipientContactForm') saveContact(event.target);
          else saveBulk(event.target);
        } catch (error) {
          report(error, event.target);
        }
      },
      true
    );
    document.addEventListener('input', event => {
      const el = event.target;
      if (el.id === 'recipientCompanySearch') {
        companyQuery = el.value;
        $('recipientCompanies').innerHTML = companyRows();
      } else if (el.id === 'recipientContactSearch') {
        contactQuery = el.value;
        $('recipientContacts').innerHTML = contactRows();
      } else if (el.form?.id === 'recipientBulkForm' && el.name === 'emails') {
        try {
          const result = bulkResult(el.form);
          $('recipientBulkPreview').textContent =
            result.contacts.length +
            ' new · ' +
            result.skipped +
            ' duplicate' +
            (result.skipped === 1 ? '' : 's') +
            ' skipped.';
        } catch (error) {
          $('recipientBulkPreview').textContent = error.message;
        }
      }
    });
    document.addEventListener('change', event => {
      const el = event.target;
      try {
        if (el.id === 'recipientSeparator') {
          separator = el.value;
          updateCopy();
        } else if (el.dataset.recipientToggle) {
          const id = el.dataset.recipientToggle,
            c = company();
          if (!c) throw Error('This company list no longer exists.');
          if (
            save(
              d => {
                const r = d.workhub.recipients.companies
                  .find(x => x.id === c.id)
                  ?.contacts.find(r => r.id === id);
                if (!r) throw Error('This recipient no longer exists.');
                r.enabled = el.checked;
              },
              el.checked ? 'Recipient included in copies.' : 'Recipient excluded from copies.'
            )
          ) {
            const focusId = id;
            $('recipientContacts').innerHTML = contactRows();
            $('recipientCompanies').innerHTML = companyRows();
            updateCopy();
            [...document.querySelectorAll('[data-recipient-toggle]')]
              .find(el => el.dataset.recipientToggle === focusId)
              ?.focus();
          }
        }
      } catch (error) {
        el.checked = !el.checked;
        report(error);
      }
    });
    return {
      mount,
      sync,
      open,
      shortcut,
      companyForm,
      contactForm,
      bulkForm,
      saveCompany,
      saveContact,
      saveBulk,
      copyAddresses,
      handle,
    };
  }
  root.WorkHubRecipients = { install };
})(window);
