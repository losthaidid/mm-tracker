# Process Hub decisions, presenter controls and loading scenes

This guide covers Batch D selections **4, 42, 97 and 209**. All Batch D selections are implemented; see [Workspace experience](WORKSPACE-EXPERIENCE.md) for the remaining six.

## Maintain decision paths

Open **Process Hub → Edit process**, select a decision step and choose **Edit this step**. Select **Enable named answers**, enter the question, maintain 2–6 answer labels and choose a destination for each. An empty destination ends the route. Labels and destinations must be distinct. Choose one maintained answer as **Default**, save the step and then save the process if working in the full-screen draft editor.

**Decisions → Automatic · default routes** preserves looping playback. Scenario-specific routes can override the default. **Interactive · ask me** waits at decision steps until an answer is selected. The selected route continues from the current step, without restarting earlier steps or applying sample changes twice. Repeat visits can receive different answers; the existing loop guard still bounds cyclic processes. Playback choices are temporary, reset on restart/selection/loop and do not save records. Existing unlabelled decision steps can use their connected routes without a migration. Normal/fullscreen views, step types, drag/drop editing, screenshots, sample values, scenarios and audio remain available.

PDF guides include the question, answer labels, destinations and automatic default. Diagram exports key connected paths to a readable answer legend (up to 24 answers, with an explicit notice for larger maps; the PDF includes every answer); an answer ending the route is listed in the PDF rather than drawn to a nonexistent node. Older Process Hub records are maintained in their existing collection.

## Present in a separate audience window

Open **Process Hub → Presenter controls**. Your private canvas stays in the main website window; the separate audience window opens on the selected display and requests native fullscreen there. Choose the display shared in your meeting app before launching, or change it in View & notes. If the browser requires an audience gesture, click anywhere in that window or press Enter; no audience buttons are shown. A blocked pop-up leaves usable private controls with Retry audience. Browsers without screen selection retain manual audience-window placement. The website cannot determine which monitor the meeting app is sharing.

Your private control panel contains saved process/scenario selectors, playback controls, an interactive-decision switch and answer buttons, process-level presenter notes, a live audience preview, text-size and whole-diagram controls. The audience sees process titles, step titles, connections and labels, current-step audience explanation (or instructions), expected result and responsible role. Private presenter notes, technical setup, linked records, account data and editing controls are not sent. Audience text is displayed literally, never executed as markup.

**Hold screen** freezes the current audience frame and pauses process playback. **Hide content** replaces it with a neutral cover and pauses the process. Release the hold/cover to continue. Hold is unavailable while a break or cover is showing.

Use **A break for your audience** to enter a message, whole-minute duration (1–180), scenery and completion text. The silent countdown is separate from personal rest/focus timers. Pause/resume the countdown if needed. At zero it stays on the completion view until **Return to process**. Process playback is paused during the presentation break.

**End presentation** or closing the audience ends the session. Starting Break Terrarium or standalone Presentation Break closes this presenter session; both breaks keep their own single-window fullscreen flow. An active terrarium must be explicitly resumed before another presentation starts. Leaving Process Hub, changing/signing out of the account or leaving the page ends the presenter session. If the presenter stops responding, the audience page covers its content after six seconds; background timer throttling can also cause this protective cover. A heartbeat reconnects automatically while the original session remains valid. Some browsers suspend background tabs; keep the control window visible for the smoothest playback.

## Live annotations

Use the in-canvas Tools bubble for Pen, Arrow, Text and the transient laser. Text, arrows and pen marks are saved with the process in diagram coordinates, up to 100 annotations. Notes support up to 1,000 characters, editable boxes, corner/edge resizing and step attachments. Saved annotations appear in PDF/PNG diagrams and stay with the process while panning, zooming or playing steps. The laser remains temporary. See [the Process Hub canvas guide](PROCESS-REHEARSAL.md#audience-fullscreen-and-the-private-presenter-canvas) for the current controls and shortcuts.

## Loading scene

Startup uses the maintained account workspace name when its matching device recovery copy is available, otherwise **Your workspace** until the account name is verified. The illustrated desk has lightweight leaf/steam motion and an indeterminate progress bar. Workspace, Account and Records indicators follow actual startup stages; no percentage or artificial minimum delay is added. The existing immediate reveal, reduced-motion support, slow-connection recovery and failed-file recovery remain in place. Aurora stays removed.

## Source and verification

`rehearsal-engine.js` validates decision definitions and builds bounded routes. `rehearsal.js` maintains them and publishes an explicit audience-only snapshot. `presentation-screen.js` handles explicitly selected displays, permission failure, disconnected screens and late owner changes. `presenter.js` owns private controls, the audience connection, breaks and temporary annotations. `audience-view.js` / `audience.css` render the same scene in both windows; `audience.html` / `audience.js` are the isolated audience page. Startup remains in critical `index.html` styles and `startup.js`.

Tests cover default/interactive routes, repeat visits, legacy save/reload, account-document round trips, export scope, message-origin/source/token checks, stale-window covers, annotation bounds, temporary state, pop-up failure and startup phases/recovery. Browser QA uses fictional local records, including a phone-width simulation; no physical iPhone or multi-monitor meeting app is available in this environment.

`npm test` runs the application suite in five disjoint name groups to avoid accumulating all JSDOM fixtures in one process. Module/database tests run first. This test-runner change does not change browser memory limits.

The 25 October feedback fixes, including observatory motion, opaque Process Hub panels, heading outlines, rain pause behavior and companion placement, are described in [FEEDBACK-FIXES.md](FEEDBACK-FIXES.md).
