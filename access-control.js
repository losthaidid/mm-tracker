/* Authoritative access comes from Supabase; personal visibility is a separate preference. */
(function (root) {
  'use strict';
  const C = root.WorkHubAccessCatalog;
  function install(a) {
    let profile = null,
      generation = 0,
      refreshing = false;
    const cloud = () => a.cloud(),
      owner = () => cloud().user?.id || '';
    function sync() {
      if (profile?.userId !== owner()) profile = null;
      const b = document.getElementById('workhubUserManagement');
      if (b) {
        const hide = !(profile?.role === 'owner' && profile.status === 'active');
        if (b.hidden !== hide) b.hidden = hide;
      }
    }
    function can(id, action = 'view') {
      sync();
      return C.can(profile, id, action);
    }
    function feature(target) {
      const explicit = target?.closest?.('[data-access-feature]')?.dataset.accessFeature;
      if (explicit) return explicit;
      const tab = target?.closest?.('[data-tab]')?.dataset.tab;
      if (C.byId.has(tab)) return tab;
      const tool = target?.closest?.('[data-hub="tool"],[data-tool]')?.dataset.tool;
      if (tool && C.byId.has('studio.' + tool)) return 'studio.' + tool;
      if (target?.closest?.('[data-ss],[data-sx],.ss-workspace')) return 'projects.solution';
      if (target?.closest?.('[data-pe]')) return 'projects.people';
      if (target?.closest?.('[data-standup]')) return 'projects.standup';
      const projectView = target?.closest?.('[data-action="project-view"]')?.dataset.view;
      if (projectView === 'solution' || projectView === 'people') return 'projects.' + projectView;
      if (target?.closest?.('#dataReader')) return 'studio.reader';
      if (target?.closest?.('.validation-studio,[data-val]')) return 'validator';
      if (target?.closest?.('.nt-workspace,[data-nt]')) return 'notes';
      if (target?.closest?.('#rehearsalRoot,.pc-presenter')) return 'processhub';
      const myDayAction = target?.closest?.('[data-md]')?.dataset.md;
      if (myDayAction?.startsWith('break-') || target?.closest?.('#restRoom')) return 'break';
      if (
        myDayAction?.startsWith('focus-') ||
        target?.closest?.('#mdFocus,#focusPanel,[data-focus],#hubFocusForm')
      )
        return 'focus';
      const group = target?.closest?.('[data-group]')?.dataset.group;
      if (C.byId.has(group)) return group;
      if (target?.closest?.('#focusShortcuts'))
        return target.closest('#breakTerrariumButton') ? 'break' : 'focus';
      if (target?.closest?.('#presentationBreakButton')) return 'presentation-break';
      const action = target?.closest?.('[data-action]')?.dataset.action;
      if (action === 'tab-visibility' || target?.closest?.('#visibilityForm')) return 'workspace';
      return a.feature();
    }
    async function load(user) {
      const token = ++generation;
      if (!user) {
        profile = null;
        sync();
        return null;
      }
      const { data, error } = await cloud().client.rpc('workhub_my_access');
      if (token !== generation || owner() !== user.id)
        throw Object.assign(Error('Account changed. Sign in again.'), { accessDenied: true });
      if (error || !data || data.userId !== user.id || data.status !== 'active') {
        profile = null;
        sync();
        throw Object.assign(
          Error(
            data?.status === 'suspended'
              ? 'Your account is suspended. Contact the website Owner.'
              : data?.status === 'deleting'
                ? 'This account is being deleted.'
                : 'Could not verify account access. Please sign in again.'
          ),
          { accessDenied: true }
        );
      }
      profile = { ...data, permissions: C.normalize(data.permissions) };
      sync();
      return profile;
    }
    async function refresh() {
      if (!owner() || !profile || refreshing) return;
      refreshing = true;
      const previous = profile,
        account = owner();
      try {
        const { data, error } = await cloud().client.rpc('workhub_my_access');
        if (account !== owner()) return;
        if (error) {
          if (['PGRST301', '42501'].includes(error.code))
            throw Error('Your access could not be verified. Sign in again.');
          return;
        }
        if (!data || data.userId !== account || data.status !== 'active')
          throw Error(
            data?.status === 'suspended'
              ? 'Your account has been suspended.'
              : 'Your account no longer has active access.'
          );
        profile = { ...data, permissions: C.normalize(data.permissions) };
        sync();
        if (previous.version !== profile.version) await a.changed();
      } catch (error) {
        if (account === owner()) {
          profile = null;
          sync();
          a.lock(error.message);
        }
      } finally {
        refreshing = false;
      }
    }
    function disable(el, denied) {
      if (denied && !el.disabled) {
        el.dataset.accessDisabled = 'true';
        el.disabled = true;
      } else if (!denied && el.dataset.accessDisabled) {
        delete el.dataset.accessDisabled;
        el.disabled = false;
      }
    }
    function apply() {
      sync();
      for (const b of document.querySelectorAll('#tabs [data-tab]')) {
        const id = b.dataset.tab;
        if (C.hidden(profile, id)) b.hidden = true;
        disable(b, !can(id));
        if (!can(id)) b.title = 'Access disabled by the website Owner';
      }
      for (const b of document.querySelectorAll('[data-hub="tool"],[data-tool]')) {
        const id = 'studio.' + b.dataset.tool;
        if (!C.byId.has(id)) continue;
        if (C.hidden(profile, id) || a.hidden().includes(id)) b.hidden = true;
        disable(b, !can(id));
      }
      for (const [selector, id] of [
        ['[data-action="project-view"][data-view="solution"],[data-ss]', 'projects.solution'],
        ['[data-action="project-view"][data-view="people"],[data-pe]', 'projects.people'],
        ['[data-standup]', 'projects.standup'],
      ]) {
        for (const b of document.querySelectorAll(selector)) {
          if (C.hidden(profile, id) || a.hidden().includes(id)) b.hidden = true;
          if (b.tagName === 'BUTTON') disable(b, !can(id));
        }
      }
      for (const [id, f] of [
        ['focusModeButton', 'focus'],
        ['breakTerrariumButton', 'break'],
        ['presentationBreakButton', 'presentation-break'],
      ]) {
        const b = document.getElementById(id);
        if (b) {
          b.hidden = C.hidden(profile, f) || a.hidden().includes(f);
          disable(b, !can(f, 'run'));
        }
      }
    }
    function guard(event) {
      const t = event.target;
      if (
        !cloud().ready ||
        !t?.closest ||
        t.closest('.um-room,#cloudGate,#settingsMenu,#visibilityForm')
      )
        return;
      const control = t.closest('button,a,input,select,textarea,form');
      if (!control) return;
      const id = feature(t);
      if (!C.byId.has(id)) return;
      let action = 'view';
      const op =
        control.dataset.dr ||
        control.dataset.val ||
        control.dataset.md ||
        control.dataset.focus ||
        control.dataset.action ||
        control.dataset.hub ||
        '';
      const label = (control.textContent || '').trim();
      if (
        /export|download|^pdf$|^xlsx$|^csv$|^original$/.test(op) ||
        /^(Export|Download)\b/i.test(label)
      )
        action = 'export';
      else if (
        (id === 'validator' &&
          (/^(run|validate|prep-.*)$/.test(op) || t.id === 'valPreparationForm')) ||
        (id === 'studio.reader' && ['browse', 'sample-json', 'sample-idoc'].includes(op)) ||
        ['focus', 'break', 'presentation-break'].includes(id)
      )
        action = 'run';
      else if (event.type === 'submit' && t.id === 'drPaste') action = 'run';
      else if (/(?:^|-)(?:new|add|create|duplicate|copy|import)(?:-|$)/.test(op)) action = 'create';
      else if (/(?:^|-)(?:delete|remove)(?:-|$)/.test(op)) action = 'delete';
      else if (/(?:^|-)(?:save|apply|update|rename|publish|edit)(?:-|$)/.test(op)) action = 'edit';
      else if (event.type === 'submit') action = t.dataset.id ? 'edit' : 'create';
      if (!can(id, action)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        a.tell(
          'Your account cannot ' +
            (action === 'view' ? 'open this feature.' : action + ' in this feature.'),
          true
        );
      }
    }
    for (const name of ['click', 'submit', 'change']) document.addEventListener(name, guard, true);
    root.setInterval(() => void refresh(), 30000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) void refresh();
    });
    return {
      load,
      refresh,
      sync,
      apply,
      can,
      hidden: id => {
        sync();
        return C.hidden(profile, id);
      },
      feature,
      snapshot: () => (profile ? JSON.parse(JSON.stringify(profile)) : null),
      assertChange: (before, after) => C.assertChange(profile, before, after),
      restoreDerived: (before, after) => C.restoreDerived(profile, before, after),
      clear() {
        generation++;
        profile = null;
        sync();
      },
    };
  }
  root.WorkHubAccess = { install };
})(window);
