# Process Hub decisions, presenter controls and loading scenes

Batch D selections **4, 42, 97 and 209** are implemented. The other Batch D selections remain pending.

## Maintain decision paths

Open **Process Hub → Edit process**, select a decision step and choose **Edit this step**. Select **Enable named answers**, enter the question, maintain 2–6 answer labels and choose a destination for each. An empty destination ends the route. Labels and destinations must be distinct. Choose one maintained answer as **Default**, save the step and then save the process if working in the full-screen draft editor.

**Decisions → Automatic · default routes** preserves looping playback. Scenario-specific routes can override the default. **Interactive · ask me** waits at decision steps until an answer is selected. The selected route continues from the current step, without restarting earlier steps or applying sample changes twice. Repeat visits can receive different answers; the existing loop guard still bounds cyclic processes. Playback choices are temporary, reset on restart/selection/loop and do not save records. Existing unlabelled decision steps can use their connected routes without a migration. Normal/fullscreen views, step types, drag/drop editing, screenshots, sample values, scenarios and audio remain available.

PDF guides include the question, answer labels, destinations and automatic default. Diagram exports key connected paths to a readable answer legend (up to 24 answers, with an explicit notice for larger maps; the PDF includes every answer); an answer ending the route is listed in the PDF rather than drawn to a nonexistent node. Older Process Hub records are maintained in their existing collection.

## Present in a separate audience window

Open **Process Hub → Presenter controls**. Allow the audience pop-up if the browser blocks it. Move the separate audience window to the screen you are sharing and select **Full screen** in that window. Share only that audience window in your meeting app. The website cannot determine which monitor the meeting app is sharing.

Your private control panel contains saved process/scenario selectors, playback controls, an interactive-decision switch and answer buttons, process-level presenter notes, a live audience preview, text-size and whole-diagram controls. The audience sees process titles, step titles, connections and labels, current-step audience explanation (or instructions), expected result and responsible role. Private presenter notes, technical setup, linked records, account data and editing controls are not sent. Audience text is displayed literally, never executed as markup.

**Hold screen** freezes the current audience frame and pauses process playback. **Hide content** replaces it with a neutral cover and pauses the process. Release the hold/cover to continue. Hold is unavailable while a break or cover is showing.

Use **A break for your audience** to enter a message, whole-minute duration (1–180), scenery and completion text. The silent countdown is separate from personal rest/focus timers. Pause/resume the countdown if needed. At zero it stays on the completion view until **Return to process**. Process playback is paused during the presentation break.

Closing the controls keeps the audience session open; reopen Presenter controls to continue. **End presentation & close audience** closes both. Leaving Process Hub, changing/signing out of the account or leaving the page ends the presenter session. If the presenter stops responding, the audience page covers its content after six seconds; background timer throttling can also cause this protective cover. A heartbeat reconnects automatically while the original session remains valid. Some browsers suspend background tabs; keep the control window visible for the smoothest playback.

## Live annotations

Choose **Pen** or **Arrow** below the private preview, select colour/width and drag on the preview. The audience sees the same mark. **View** returns to normal preview interaction; **Undo mark** removes the last annotation and **Clear marks** removes all. Touch drawing is supported.

Marks are temporary, limited to 100 per scene and 300 points per mark. They clear when the active step or scene changes. They are never saved to the process, account document, PDF or image export. The preview and audience share a 16:9 stage, letterboxed on other screen proportions to keep marks aligned.

The audience page has no Supabase client, account storage or network data requests. It accepts presentation messages only from its opening window at the exact same origin with the current random session token. The token identifies a temporary local-window session, not a downloadable or public sharing link.

## Loading scene

Startup uses the maintained account workspace name when its matching device recovery copy is available, otherwise **Your workspace** until the account name is verified. The illustrated desk has lightweight leaf/steam motion and an indeterminate progress bar. Workspace, Account and Records indicators follow actual startup stages; no percentage or artificial minimum delay is added. The existing immediate reveal, reduced-motion support, slow-connection recovery and failed-file recovery remain in place. Aurora stays removed.

## Source and verification

`rehearsal-engine.js` validates decision definitions and builds bounded routes. `rehearsal.js` maintains them and publishes an explicit audience-only snapshot. `presenter.js` owns private controls, the audience connection, breaks and temporary annotations. `audience-view.js` / `audience.css` render the same scene in both windows; `audience.html` / `audience.js` are the isolated audience page. Startup remains in critical `index.html` styles and `startup.js`.

Tests cover default/interactive routes, repeat visits, legacy save/reload, account-document round trips, export scope, message-origin/source/token checks, stale-window covers, annotation bounds, temporary state, pop-up failure and startup phases/recovery. Browser QA uses fictional local records, including a phone-width simulation; no physical iPhone or multi-monitor meeting app is available in this environment.

`npm test` runs the application suite in five disjoint name groups to avoid accumulating all JSDOM fixtures in one process. Module/database tests run first. This test-runner change does not change browser memory limits.
