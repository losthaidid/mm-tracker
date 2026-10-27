/** Shared, focus-scoped keyboard commands for Process Hub and its private presenter. */
(function (root) {
  'use strict';
  const commands = [
    ['v', 'select', 'V', 'Select / move', 'edit'],
    ['h', 'explore', 'H', 'Explore / pan', 'edit'],
    ['l', 'connect', 'L', 'Link steps', 'edit'],
    ['i', 'insert', 'I', 'Open step types', 'edit'],
    ['e', 'edit', 'E', 'Edit selected step or link', 'edit'],
    ['p', 'play', 'P', 'Play / pause', 'playback'],
    ['[', 'back', '[', 'Previous step', 'playback'],
    [']', 'next', ']', 'Next step', 'playback'],
    ['r', 'restart', 'R', 'Restart playback', 'playback'],
    ['m', 'sound', 'M', 'Toggle sound', 'playback'],
    ['f', 'fit', 'F / 0', 'Fit canvas', 'view'],
    ['=', 'zoom-in', '+ / =', 'Zoom in', 'view'],
    ['-', 'zoom-out', '−', 'Zoom out', 'view'],
    ['mod+s', 'save', 'Ctrl / ⌘ S', 'Save open details or process draft', 'edit'],
    ['mod+z', 'undo', 'Ctrl / ⌘ Z', 'Undo canvas edit', 'edit'],
    ['mod+a', 'select-all', 'Ctrl / ⌘ A', 'Select all steps', 'edit'],
    [
      'delete',
      'delete',
      'Delete / Backspace',
      'Delete selection (with confirmation for steps / links)',
      'edit',
    ],
    ['?', 'help', '? / F1', 'Keyboard shortcuts', 'view'],
    ['b', 'pen', 'B', 'Pen', 'presenter'],
    ['a', 'arrow', 'A', 'Arrow', 'presenter'],
    ['t', 'text', 'T', 'Text', 'presenter'],
    ['g', 'laser', 'G', 'Laser pointer', 'presenter'],
  ];
  function match(event, options = {}) {
    if (event.isComposing || event.keyCode === 229 || event.altKey) return null;
    let key = event.key.toLowerCase();
    if (event.ctrlKey || event.metaKey) {
      if (event.shiftKey) return null;
      key = 'mod+' + key;
    } else {
      key = { 0: 'f', '+': '=', backspace: 'delete', f1: '?' }[key] || key;
      if (event.shiftKey && !['?', '='].includes(key)) return null;
    }
    const entry = commands.find(row => row[0] === key);
    if (!entry || (entry[4] === 'presenter' && !options.presenter)) return null;
    if (options.readOnly && !['playback', 'view'].includes(entry[4])) return null;
    const typing = event.target?.closest?.(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'
    );
    // Keep native typing, selection, undo and editing keys. Saving is explicit.
    return typing && entry[1] !== 'save' ? null : entry[1];
  }
  function dispatch(event, options) {
    if (event.defaultPrevented || !options.surface?.contains(event.target)) return false;
    const command = match(event, options);
    if (!command || options.skip?.(command)) return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!event.repeat) options.run(command);
    return true;
  }
  function guide(surface, options = {}) {
    const doc = surface.ownerDocument;
    if (doc.querySelector('.process-shortcut-guide[open]')) return;
    const focus = doc.activeElement;
    const dialog = doc.createElement('dialog');
    dialog.className = 'process-shortcut-guide';
    dialog.setAttribute('aria-label', 'Process Hub keyboard shortcuts');
    const available = commands.filter(
      row =>
        (row[4] !== 'presenter' || options.presenter) &&
        (!options.readOnly || ['playback', 'view'].includes(row[4]))
    );
    dialog.innerHTML =
      '<header><div><span>PROCESS HUB</span><h2>Keyboard shortcuts</h2></div><button type="button" aria-label="Close keyboard shortcuts">✕</button></header>' +
      '<p>Click the canvas or a Process Hub control first. Shortcuts leave normal typing, text selection and undo available in fields.</p>' +
      '<table><thead><tr><th>Shortcut</th><th>Action</th></tr></thead><tbody>' +
      available
        .map(row => '<tr><td><kbd>' + row[2] + '</kbd></td><td>' + row[3] + '</td></tr>')
        .join('') +
      (!options.presenter
        ? '<tr><td><kbd>Space + drag</kbd></td><td>Temporarily pan the canvas</td></tr><tr><td><kbd>Arrow keys</kbd></td><td>Pan the focused canvas or move a focused step handle; Shift moves farther</td></tr>'
        : '<tr><td><kbd>Arrow keys</kbd></td><td>Move a selected annotation or focused link handle; Shift moves farther</td></tr>') +
      '<tr><td><kbd>Esc</kbd></td><td>Cancel a gesture or clear selection; close this guide</td></tr></tbody></table>' +
      '<p>Canvas edits save automatically. Ctrl / ⌘ S saves the open editor or process draft. Playback continues while you edit.</p>';
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.addEventListener(
      'close',
      () => {
        dialog.remove();
        if (focus?.isConnected) focus.focus({ preventScroll: true });
      },
      { once: true }
    );
    (doc.fullscreenElement || doc.body).append(dialog);
    dialog.showModal();
  }
  root.WorkHubProcessShortcuts = Object.freeze({ match, dispatch, guide });
})(window);
