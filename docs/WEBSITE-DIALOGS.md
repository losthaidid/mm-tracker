# Website confirmations

WorkHub uses its own themed confirmation dialog for app-owned actions such as deleting a task or process, clearing a selection, replacing a draft, undoing preparation and removing an unused validation version. These actions no longer call native `confirm`, `alert` or `prompt`.

`website-dialogs.js` supplies `await WorkHubDialogs.confirm(message, options)`. Options can set a title, confirm/cancel labels and destructive styling. Callers must await the result before changing data. The component never overrides browser APIs or replays an action. Existing mutation, validation and permission checks remain in the calling feature.

The shared dialog uses the active theme, safe text nodes, a native HTML modal focus boundary, initial Cancel focus for destructive changes and focus restoration. Escape cancels the website dialog; the browser may separately handle Escape to leave native fullscreen. Background keyboard shortcuts cannot act through the dialog. Repeated requests are rejected while one is open. A changed account, saved-data object, access version or detached dialog cancels the pending action.

In native fullscreen the dialog is appended inside the existing fullscreen element. Process Hub replaces only its own content during repaint and preserves sibling dialogs and the fullscreen stage. Confirming or cancelling process deletion does not request an exit from fullscreen. Tests cover confirmation, cancellation, repaint and deleting the final saved process.

Browser-controlled prompts for tab closing with unsaved edits, permissions, sign-in and browser security remain under the browser's control. They cannot be replaced by website HTML. Existing beforeunload safeguards are retained.

## Checking the change

- `tests/website-dialogs.test.mjs` checks deferred decisions, cancellation, focus, stale contexts, fullscreen placement and a parser-based audit of shipped app modules for native popup calls.
- `tests/process-hub.test.mjs` checks the real shared dialog inside a retained fullscreen stage.
- Application and validation tests await the new decisions while preserving their existing data, permission and undo assertions.
