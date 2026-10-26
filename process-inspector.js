/** Progressive disclosure for both private step editors. Fields remain in the same form. */
(function (root) {
  'use strict';
  function enhance(form) {
    if (!form) return;
    const doc = form.ownerDocument;
    if (!form.dataset.inspectorReady) {
      const groups = new Map(),
        nav = doc.createElement('div'),
        body = doc.createElement('div'),
        footer = doc.createElement('div');
      nav.className = 'ph-inspector-tabs';
      nav.setAttribute('role', 'tablist');
      nav.setAttribute('aria-label', 'Step settings');
      body.className = 'ph-inspector-pages';
      footer.className = 'ph-inspector-footer';
      for (const [id, title] of [
        ['step', 'Step'],
        ['flow', 'Flow'],
        ['details', 'Details'],
        ['references', 'References'],
      ]) {
        const button = doc.createElement('button'),
          page = doc.createElement('section');
        button.type = 'button';
        button.dataset.inspectorTab = id;
        button.textContent = title;
        button.id = form.id + '-tab-' + id;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-controls', form.id + '-page-' + id);
        page.id = form.id + '-page-' + id;
        page.dataset.inspectorPage = id;
        page.setAttribute('role', 'tabpanel');
        page.setAttribute('aria-labelledby', button.id);
        nav.append(button);
        body.append(page);
        groups.set(id, page);
      }
      for (const details of form.querySelectorAll(':scope > details')) {
        if (details.querySelector('summary')?.textContent.trim() === 'More information') {
          details.querySelector('summary').remove();
          details.replaceWith(...details.children);
        }
      }
      let previous = 'step';
      for (const child of [...form.children]) {
        if (child.matches('.hub-kicker')) {
          child.remove();
          continue;
        }
        if (
          child.matches(
            '.actions,.pc-editor-actions,[data-rehearsal="delete-step"],[data-pc-error]'
          )
        ) {
          footer.append(child);
          continue;
        }
        const name = child.matches('[name]')
          ? child.name
          : child.querySelector('[name]')?.name || '';
        let group = ['title', 'type', 'owner', 'instruction', 'expected', 'isStart'].includes(name)
          ? 'step'
          : /^(next|failNext|alternatives|decision|answer|defaultAnswer|changes|duration)/.test(
                name
              )
            ? 'flow'
            : /^(projectId|ticketId|itemId|noteId|link|image)$/.test(name) ||
                child.querySelector('#rehearsalImageInput') ||
                child.id === 'rehearsalImagePreview' ||
                child.matches('[data-rehearsal="remove-image"]')
              ? 'references'
              : name
                ? 'details'
                : previous;
        if (child.matches('datalist')) group = 'details';
        groups.get(group).append(child);
        previous = group;
      }
      const help = doc.createElement('p');
      help.className = 'ph-inspector-summary';
      help.textContent =
        'Edit at your pace. The process keeps playing. Changes are saved when you choose Save step.';
      form.prepend(help, nav, body);
      form.append(footer);
      for (const textarea of form.querySelectorAll('textarea')) textarea.rows = 3;
      form.dataset.inspectorReady = 'true';
    }
    function choose(id, focus = false) {
      for (const button of form.querySelectorAll('[data-inspector-tab]')) {
        const active = button.dataset.inspectorTab === id;
        button.setAttribute('aria-selected', String(active));
        button.tabIndex = active ? 0 : -1;
        if (active && focus) button.focus({ preventScroll: true });
      }
      for (const page of form.querySelectorAll('[data-inspector-page]'))
        page.hidden = page.dataset.inspectorPage !== id;
      form.dataset.inspectorSection = id;
    }
    if (!form._inspectorBound) {
      form._inspectorBound = true;
      form.addEventListener('click', event => {
        const button = event.target.closest('[data-inspector-tab]');
        if (button) {
          event.preventDefault();
          choose(button.dataset.inspectorTab, true);
        }
      });
      form.addEventListener('keydown', event => {
        const button = event.target.closest('[data-inspector-tab]');
        if (!button || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...form.querySelectorAll('[data-inspector-tab]')],
          i = buttons.indexOf(button),
          index =
            event.key === 'Home'
              ? 0
              : event.key === 'End'
                ? buttons.length - 1
                : (i + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
        choose(buttons[index].dataset.inspectorTab, true);
      });
      // A required field in another tab must be visible before the browser tries to focus it.
      form.addEventListener(
        'invalid',
        event => {
          const page = event.target.closest('[data-inspector-page]');
          if (page) choose(page.dataset.inspectorPage);
        },
        true
      );
    }
    choose(form.dataset.inspectorSection || 'step');
  }
  root.WorkHubProcessInspector = { enhance };
})(window);
