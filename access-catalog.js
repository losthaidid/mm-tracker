/* Shared feature registry for personal visibility and owner-assigned access. */
(function (root) {
  'use strict';
  const features = [
    ['home', 'My day', 'Screens', '', ['workhub.myDay', 'workhub.widgets']],
    ['tickets', 'Tickets', 'Screens', '', ['tickets', 'trackers', 'workhub.ticketClosures']],
    ['tasks', 'Tasks', 'Screens', '', ['tasks']],
    [
      'schedule',
      'Schedule',
      'Screens',
      '',
      [
        'schedule',
        'projectPlans',
        'workhub.daySchedule',
        'workhub.publicHolidays',
        'workhub.leaveBalances',
        'workhub.leaveTypes',
        'workhub.claims',
      ],
    ],
    [
      'specs',
      'Projects',
      'Screens',
      '',
      [
        'projects',
        'activeProjectId',
        'specs',
        'projectCompanies',
        'projectDecisions',
        'projectProcessMappings',
        'phaseGates',
        'projectFeedback',
      ],
    ],
    ['knowledge', 'Knowledge', 'Screens', '', ['workhub.notes']],
    ['notes', 'Notes', 'Screens', '', ['workhub.notebook']],
    ['processhub', 'Process Hub', 'Screens', '', ['workhub.processes', 'workhub.rehearsal']],
    ['waiting', 'Waiting on', 'Screens', '', ['workhub.waiting']],
    ['studio', 'Studio', 'Screens', '', []],
    ['lab', 'Troubleshooting lab', 'Screens', '', ['workhub.lab']],
    [
      'validator',
      'Validation Studio',
      'Screens',
      '',
      ['workhub.validator.templates', 'workhub.validator.runs'],
    ],
    ['snippets', 'Snippets', 'Screens', '', ['workhub.workLibrary']],
    ['studio.theme', 'Theme studio', 'Studio tools', 'studio', []],
    ['studio.reader', 'JSON & IDoc Reader', 'Studio tools', 'studio', []],
    ['studio.tcodes', 'SAP T-codes', 'Studio tools', 'studio', ['workhub.tcodes']],
    ['studio.focus', 'Focus room', 'Studio tools', 'studio', []],
    ['studio.journey', 'Project journey', 'Studio tools', 'studio', []],
    ['studio.scrapbook', 'Scrapbook', 'Studio tools', 'studio', ['workhub.scrapbook']],
    ['studio.wrap', 'Daily wrap-up', 'Studio tools', 'studio', []],
    ['studio.sessions', 'Work sessions', 'Studio tools', 'studio', ['workhub.sessions']],
    ['studio.screenshots', 'Screenshot tools', 'Studio tools', 'studio', []],
    [
      'projects.solution',
      'Solution Studio',
      'Project tools',
      'specs',
      ['workhub.solutionStudio', 'workhub.simulator'],
    ],
    [
      'projects.people',
      'Project people',
      'Project tools',
      'specs',
      ['workhub.projectPeople', 'workhub.recipients'],
    ],
    ['projects.standup', 'Project briefings', 'Project tools', 'specs', ['workhub.projectStandup']],
    ['focus', 'Focus mode', 'Workspace tools', '', []],
    ['break', 'Break Terrarium', 'Workspace tools', '', []],
    ['presentation-break', 'Presentation break', 'Workspace tools', '', []],
    [
      'workspace',
      'Personal settings & work setup',
      'Workspace tools',
      '',
      [
        'lists',
        'calendarMonth',
        'source',
        'preferences',
        'workhub.preferences',
        'workhub.experience',
        'workhub.headerSubtitle',
        'workhub.reminders',
        'workhub.batchA',
      ],
    ],
  ].map(([id, name, group, parent, paths]) => ({ id, name, group, parent, paths }));
  const modes = ['hidden', 'disabled', 'view', 'use'],
    actions = ['create', 'edit', 'delete', 'run', 'export'];
  const byId = new Map(features.map(f => [f.id, f]));
  const screens = features.filter(f => f.group === 'Screens');
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  function preset(mode = 'use') {
    return Object.fromEntries(
      features.map(f => [
        f.id,
        { mode, ...Object.fromEntries(actions.map(a => [a, mode === 'use'])) },
      ])
    );
  }
  function normalize(value) {
    const out = preset('hidden');
    for (const f of features) {
      const v = value?.[f.id];
      if (!v || !modes.includes(v.mode)) continue;
      out[f.id] = {
        mode: v.mode,
        ...Object.fromEntries(actions.map(a => [a, v.mode === 'use' && v[a] === true])),
      };
    }
    if (['hidden', 'disabled'].includes(out.workspace.mode))
      out.workspace = { mode: 'view', ...Object.fromEntries(actions.map(a => [a, false])) };
    return out;
  }
  function can(profile, id, action = 'view') {
    if (!profile || profile.status !== 'active' || !byId.has(id)) return false;
    if (profile.role === 'owner') return true;
    const f = byId.get(id),
      p = profile.permissions?.[id];
    if (!p || ['hidden', 'disabled'].includes(p.mode)) return false;
    if (f.parent && !can(profile, f.parent, action)) return false;
    return action === 'view' || (p.mode === 'use' && p[action] === true);
  }
  function hidden(profile, id) {
    const f = byId.get(id);
    return (
      !f ||
      !profile ||
      profile.status !== 'active' ||
      (profile.role !== 'owner' &&
        (profile.permissions?.[id]?.mode === 'hidden' ||
          !profile.permissions?.[id] ||
          (f.parent && hidden(profile, f.parent))))
    );
  }
  function get(data, path) {
    return path.split('.').reduce((v, k) => v?.[k], data);
  }
  function delta(old, next, allow) {
    if (same(old, next)) return true;
    if (
      Array.isArray(old) &&
      Array.isArray(next) &&
      [...old, ...next].every(
        v => v && typeof v === 'object' && !Array.isArray(v) && typeof v.id === 'string'
      )
    ) {
      const a = new Map(old.map(v => [v.id, v])),
        b = new Map(next.map(v => [v.id, v]));
      if (a.size !== old.length || b.size !== next.length) return false;
      for (const [id, v] of a)
        if (!b.has(id) ? !allow('delete') : !same(v, b.get(id)) && !allow('edit')) return false;
      for (const id of b.keys()) if (!a.has(id) && !allow('create')) return false;
      return true;
    }
    if (
      old &&
      next &&
      typeof old === 'object' &&
      typeof next === 'object' &&
      !Array.isArray(old) &&
      !Array.isArray(next)
    ) {
      return [...new Set([...Object.keys(old), ...Object.keys(next)])].every(k =>
        delta(old[k], next[k], allow)
      );
    }
    return allow('edit');
  }
  function assertChange(profile, old, next) {
    if (profile?.role === 'owner' && profile.status === 'active') return;
    if (!profile || profile.status !== 'active')
      throw Error('Your account does not have active access.');
    for (const f of features)
      for (const path of f.paths) {
        const before = get(old, path),
          after = get(next, path);
        if (same(before, after)) continue;
        // A blocked field is restored from the server copy on save; it cannot be overwritten.
        if (!can(profile, f.id)) throw Error('Your account cannot change ' + f.name + '.');
        if (before === undefined && !can(profile, f.id, 'edit')) continue;
        if (
          !delta(
            before,
            after,
            a =>
              can(profile, f.id, a) ||
              (path === 'workhub.validator.runs' && can(profile, f.id, 'run'))
          )
        )
          throw Error('Your permissions do not allow this change in ' + f.name + '.');
      }
  }
  function restoreDerived(profile, old, next) {
    if (profile?.role === 'owner') return;
    for (const f of features)
      for (const path of f.paths) {
        const before = get(old, path),
          after = get(next, path);
        if (same(before, after)) continue;
        const allowed = a =>
          can(profile, f.id, a) || (path === 'workhub.validator.runs' && can(profile, f.id, 'run'));
        if (can(profile, f.id) && delta(before, after, allowed)) continue;
        const parts = path.split('.'),
          key = parts.pop();
        let parent = next;
        for (const k of parts) parent = parent[k] ||= {};
        if (before === undefined) delete parent[key];
        else parent[key] = JSON.parse(JSON.stringify(before));
      }
  }
  root.WorkHubAccessCatalog = {
    restoreDerived,
    features,
    screens,
    modes,
    actions,
    byId,
    preset,
    normalize,
    can,
    hidden,
    get,
    delta,
    assertChange,
  };
})(typeof window === 'undefined' ? globalThis : window);
