/* Shared permission rules for Settings, Quick add and the command palette.
 * These use the existing feature permissions; they never grant access or save records. */
(function (root) {
  'use strict';
  const C = root.WorkHubAccessCatalog;
  const workspace = [['workspace', 'edit']];
  const setup = feature => [...workspace, [feature, 'edit']];
  const settings = {
    hubSettingsHeader: workspace,
    websiteDesignButton: workspace,
    appearance: setup('studio.theme'),
    'tab-visibility': workspace,
    'charge-codes': [...workspace, ['tickets', 'view']],
    'project-management': setup('specs'),
    'manage-mm-areas': setup('specs'),
    'edit-lists': workspace,
    'work-context': workspace,
    'field-library': setup('snippets'),
    claimSettingsButton: setup('schedule'),
    leaveBalanceSettingsButton: setup('schedule'),
    leaveTypeSettingsButton: setup('schedule'),
    recipientSettingsButton: setup('projects.people'),
    momoAdventureSettings: workspace,
    momentsSettings: workspace,
    atmosphereSettings: workspace,
    soundscapeSettings: workspace,
    experienceSettingsButton: workspace,
    driveSettingsButton: setup('files'),
    storageManagerButton: [...workspace, ['workspace', 'export']],
  };
  const account = new Set(['cloudAccountButton', 'cloudSignOut', 'cloudRetry', 'cloudReload']);
  const settingForms = {
    hubHeaderForm: 'hubSettingsHeader',
    hubTheme: 'appearance',
    visibilityForm: 'tab-visibility',
    listsForm: 'edit-lists',
    claimLocationForm: 'claimSettingsButton',
    leaveBalanceForm: 'leaveBalanceSettingsButton',
    leaveHolidayForm: 'leaveBalanceSettingsButton',
    leaveTypeForm: 'leaveTypeSettingsButton',
    recipientCompanyForm: 'recipientSettingsButton',
    recipientContactForm: 'recipientSettingsButton',
    recipientBulkForm: 'recipientSettingsButton',
    momoAdventuresForm: 'momoAdventureSettings',
    momoNameForm: 'momoAdventureSettings',
    momentsSettingsForm: 'momentsSettings',
    atmosphereForm: 'atmosphereSettings',
    experienceSettingsForm: 'experienceSettingsButton',
  };
  const recordForms = {
    hubNote: 'knowledge',
    hubWaiting: 'waiting',
    scheduleForm: 'schedule',
  };
  const quick = Object.freeze([
    ['new-task', '＋ Task', 'tasks'],
    ['new-ticket', '＋ Ticket', 'tickets'],
    ['new-item', '＋ Project item', 'specs'],
    ['new-range', '＋ Schedule activity', 'schedule'],
    ['note-edit', '＋ Knowledge note', 'knowledge'],
    ['waiting-edit', '＋ Follow-up', 'waiting'],
  ]);
  function settingKey(button) {
    return (
      button.id ||
      (button.dataset.batch === 'settings' ? 'work-context' : '') ||
      (button.dataset.wl === 'fields' ? 'field-library' : '') ||
      (button.dataset.hub === 'tool' && button.dataset.tool === 'theme'
        ? 'appearance'
        : button.dataset.action) ||
      ''
    );
  }
  function every(rule, can) {
    return rule.every(([feature, action]) => can(feature, action));
  }
  function allowedSetting(key, can, owner = false) {
    if (account.has(key)) return true;
    if (key === 'workhubUserManagement') return owner;
    if (key === 'backupButton' || key === 'exportButton')
      return (
        can('workspace', 'export') &&
        C.features.every(f => !can(f.id, 'view') || can(f.id, 'export'))
      );
    if (key === 'restoreButton' || key === 'workspaceResetButton') {
      const actions = key === 'restoreButton' ? ['create', 'edit', 'delete'] : ['delete', 'export'];
      return (
        can('workspace', 'edit') &&
        C.features
          .filter(f => f.paths.length)
          .every(f => actions.every(action => can(f.id, action)))
      );
    }
    return every(settings[key] || workspace, can);
  }
  function hubRule(data) {
    const action = data.hub === 'command' ? data.id : data.hub;
    if (!action) return null;
    if (action.startsWith('go:')) return [[action.slice(3), 'view']];
    if (action === 'navigate') return [[data.tab, 'view']];
    if (action === 'tool') return [['studio.' + data.tool, 'view']];
    const item = quick.find(([id]) => id === action);
    if (item)
      return [
        [
          item[2],
          ['note-edit', 'waiting-edit'].includes(action) && data.id && data.hub !== 'command'
            ? 'edit'
            : 'create',
        ],
      ];
    if (action === 'timer-new') return [['studio.sessions', 'create']];
    if (action === 'header-edit') return workspace;
    const feature = {
      'task-detail': 'tasks',
      ticket: 'tickets',
      project: 'specs',
      'note-view': 'knowledge',
      'process-open': 'processhub',
    }[action];
    return feature ? [[feature, 'view']] : null;
  }
  function allowedHub(data, can) {
    const rule = hubRule(data);
    return !rule || every(rule, can);
  }
  root.WorkHubShortcutAccess = {
    quick,
    settingKey,
    allowedSetting,
    allowedHub,
    hubRule,
    settingForms,
    recordForms,
  };
})(window);
