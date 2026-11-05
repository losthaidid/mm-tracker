/* Shared, asynchronous website confirmations. The browser's native confirm/alert APIs are never replaced. */
(function (root) {
  'use strict';
  let adapter = {},
    active = null;
  const context = () => adapter.context?.() || [];
  const same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  function settle(value) {
    if (!active) return;
    const request = active;
    active = null;
    const valid = same(request.context, context());
    request.dialog.close();
    request.dialog.remove();
    if (request.focus?.isConnected) request.focus.focus?.({ preventScroll: true });
    if (value && !valid)
      adapter.tell?.('Your records or account changed. Review this action again.', true);
    request.resolve(!!value && valid);
  }
  function sync() {
    if (active && (!active.dialog.isConnected || !same(active.context, context()))) settle(false);
  }
  function confirm(message, options = {}) {
    // Repeated clicks never queue a second destructive action behind the first.
    if (active) {
      active.dialog.focus();
      return Promise.resolve(false);
    }
    const captured = context();
    if (captured[0] === false) return Promise.resolve(false);
    const text = String(message || ''),
      destructive = options.danger ?? /\b(delete|remove|discard|replace|clear)\b/i.test(text);
    const verb = /delete/i.test(text)
      ? 'Delete'
      : /discard/i.test(text)
        ? 'Discard changes'
        : /^remove/i.test(text)
          ? 'Remove'
          : /^replace/i.test(text)
            ? 'Replace'
            : 'Continue';
    const dialog = document.createElement('dialog');
    dialog.id = 'workhubConfirm';
    dialog.className = 'wh-confirm';
    dialog.setAttribute('aria-labelledby', 'whConfirmTitle');
    dialog.setAttribute('aria-describedby', 'whConfirmMessage');
    dialog.setAttribute('data-website-dialog', '');
    dialog.innerHTML =
      '<form method="dialog"><div class="wh-confirm-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 8v5m0 3h.01M10.2 4.5l-7.5 13A1.7 1.7 0 004.2 20h15.6a1.7 1.7 0 001.5-2.5l-7.5-13a2.1 2.1 0 00-3.6 0Z"/></svg></div><span class="wh-confirm-kicker">TAKE A MOMENT TO REVIEW</span><h2 id="whConfirmTitle"></h2><p id="whConfirmMessage"></p><div class="wh-confirm-actions"><button type="button" data-wh-choice="cancel">Cancel</button><button type="submit" data-wh-choice="confirm"></button></div></form>';
    dialog.querySelector('h2').textContent =
      options.title || (destructive ? 'Confirm this change' : 'Before you continue');
    dialog.querySelector('p').textContent = text;
    const submit = dialog.querySelector('[type=submit]');
    submit.textContent = options.confirmLabel || verb;
    submit.className = destructive ? 'danger' : 'primary';
    if (options.cancelLabel)
      dialog.querySelector('[type=button]').textContent = options.cancelLabel;
    const focus = document.activeElement;
    const ownerFeature = root.WorkHubCurrentAccess?.feature?.(focus);
    if (ownerFeature) dialog.dataset.accessFeature = ownerFeature;
    (document.fullscreenElement || document.body).append(dialog);
    return new Promise(resolve => {
      active = { dialog, resolve, context: captured, focus };
      dialog.addEventListener('cancel', e => {
        e.preventDefault();
        settle(false);
      });
      dialog.addEventListener('keydown', e => e.stopPropagation());
      dialog.addEventListener('close', () => {
        if (active?.dialog === dialog) settle(false);
      });
      dialog.querySelector('[type=button]').addEventListener('click', () => settle(false));
      dialog.querySelector('form').addEventListener('submit', e => {
        e.preventDefault();
        settle(true);
      });
      dialog.showModal();
      dialog
        .querySelector(destructive ? '[type=button]' : '[type=submit]')
        .focus({ preventScroll: true });
    });
  }
  root.addEventListener('pagehide', () => settle(false));
  root.WorkHubDialogs = {
    confirm,
    sync,
    cancel: () => settle(false),
    configure(value) {
      settle(false);
      adapter = value || {};
    },
  };
})(globalThis);
