# Process Hub and the SAP T-code library

Open **Process Hub** in the main navigation. Process Rehearsal is now part of this workspace and no longer appears in Studio. Existing rehearsal and Process Hub libraries appear together in the Saved process dropdown. Opening them does not copy or rewrite saved records.

## Create a process

Choose **New process** to open a blank, full-screen canvas. Expand **Process information** to maintain its name, intended outcome, owner, revision, audience, description and private presenter notes. The draft starts with a first task and a result; rename, replace or extend them.

Drag a **Task**, **Document**, **Decision**, **Approval**, **Result**, **Organization level**, **Company code**, **Plant**, **Storage location**, **Material**, **Batch**, **Valuation** or **Step group** from the step-type tray onto the canvas. On a touch screen, drag a type or tap it to add. Its detail editor opens alongside the canvas. Maintain the title, owner, instructions, prerequisites, inputs, outputs, expected result, system/tool, typical working time, user-facing explanation, configuration, common errors and testing checklist. Reference codes, URLs, optimized screenshots and links to projects, tickets, project items and knowledge notes are retained.

Set the starting step, normal successor, additional normal routes and optional exception successor in step details. Save the step to continue building. **Save process** also saves an open step editor, then commits the entire process in one account-document update. Changes in the full editor remain a tab-local draft until that action. **Discard changes** confirms before discarding. Reloading or closing a tab with an open draft triggers the browser's unsaved-work warning. Drafts are not recoverable after closing the page and never transfer between accounts.

**Edit process** opens a full-screen draft of a saved process. A stale-process check prevents overwriting a process that changed while its full editor was open. In normal reference mode, **Edit this step** supports the existing direct Save step workflow. Save/cancel an open step editor before changing steps, scenarios or processes.

Move cards using their dotted handles, or focus a handle and use arrow keys (Shift moves farther). **Auto arrange**, **Fit**, zoom and canvas scrolling help with larger flows. Deleting a step removes its incoming routes and scenario references and updates the starting step if necessary. Archive/restore and duplicate are available for saved processes. Process information also contains permanent deletion, with confirmation.

## Reference and presentation views

Use **View** to switch between Normal, Full screen and Presentation. Saved processes automatically play and loop in all three views. Full-screen creation uses the browser's fullscreen API when permitted, with a full-viewport dialog fallback. Choose Normal view to return to the workspace. Escape follows the browser’s fullscreen/dialog behaviour.

Presentation shows the same animated graph and current-step explanation, responsibility, prerequisites, inputs, outputs, expected result and screenshot. An optional user-facing explanation replaces internal instructions. Configuration, internal failure details, testing, linked account records and private presenter notes stay in the reference view. Presentation still supports process/scenario selection, pause, restart, manual steps and sound. It does not identify or move to a monitor being shared by a meeting application.

### Audience fullscreen and the private presenter canvas

Choose **Presenter controls**. As with Presentation Break, the click requests native fullscreen on an audience-only stage in the current website window. The private canvas then opens in a separate presenter window. Share the **Audience** window in your meeting app and keep the private presenter window unshared. When screen selection is supported, choose your shared display before launching; the website cannot identify your meeting app's shared screen.

The audience contains the process, saved canvas annotations, optional explanations and the transient laser. It contains no toolbars, buttons, editing handles or private notes. There are no Full screen / Stay windowed prompts or extra audience-launch buttons. Native fullscreen is reported only when the document confirms it. A browser can refuse fullscreen or block the private pop-up: allow this site's pop-ups if needed and launch Presenter controls again. Without native fullscreen the audience fills its browser window. Escape or ending the private presentation closes the public stage. Physical multi-monitor placement depends on browser support and the selected display.

All private controls live in translucent bubbles **inside** the canvas:

- **Tools** contains Explore, Select / move, Pen, Arrow, Text, the laser, colour, width, note text and text size. Choosing a tool collapses the bubble.
- **Steps** contains all step types, Edit selected step, Connect ports, annotation attachment/detachment, process project/knowledge links, guarded Undo, Save editable copy and End presentation.
- **Playback** contains process/scenario selection, previous/next/restart, pause/play, interactive decision answers, diagram zoom, Fit, Follow current step and Show step details. It also retains the audience-break countdown and custom messages.
- **View & notes** contains hold, hide content, display status, text scale, whole-diagram view and private presenter notes.

**Explore** drags the diagram to pan, scrolls or uses **+ / −** to zoom, and lets you click a step (or focus it and press Enter) to start a paused temporary walkthrough there. Camera movements appear in both windows. **Fit diagram** restores the whole process; **Follow current step** follows playback.

**Select / move** drags steps, notes and arrows. Select a text box and drag a corner handle to resize its font and shape together; right/bottom handles change the box shape while keeping font size. Arrow endpoints resize and redirect the arrow. Arrow keys nudge the selection; Shift moves farther. Delete/Backspace removes a selected annotation. Escape cancels a drag.

**Text**, **Arrow** and **Pen** now create **saved process annotations in diagram coordinates**. They pan and zoom with the diagram, remain in place during playback and appear in normal Process Hub views and PDF/PNG diagrams. Placing an annotation over a step anchors it to that step. **Attach note / arrow to step** can change the anchor while preserving its current position; **Detach selected** returns it to the canvas. Moving a step carries its annotations. Deleting the step detaches its annotations in place. Up to 100 annotations per process are supported. The laser stays temporary and is never saved or exported.

Drag a step type onto the diagram to open its in-canvas editor. Tap a type to place it without dragging. Maintain its instructions, user-facing explanation, responsibilities, sample changes, normal/alternative/exception routes, named decision answers, project/knowledge links and organization/material fields: company code, plant, storage location, material code/type, batch, valuation class/type and unit. **Save step** commits one saved edit; Cancel discards that insertion or edit. Choose **Save editable copy** before modifying the demonstration process.

Drop a new or existing step onto another card to stack it magnetically; it snaps below its parent and adds a connection without replacing an existing normal route. Moving the parent carries its magnetic descendants. **Detach selected** detaches a selected child. To create another route, drag a step's outgoing dot to another step's incoming dot. Existing defaults remain intact and duplicate connections are ignored; additional named decision routes remain bounded to six. Arrival and flowing-connector effects show the change.

Presenter canvas edits use the existing account document and backup/restore path. Guarded Undo refuses to overwrite a later external edit, and stale open editors cannot overwrite a changed saved process. Changing accounts closes both views. Hold, hide-content and audience breaks temporarily lock canvas editing; playback, the laser, camera and presentation state do not create record writes.

## Animation, audio and scenarios

Document tokens move between steps, active edges flow, approvals receive stamps, successful value updates flash, exceptions shake and rewind retraces a connector. These are the existing rehearsal effects. Choose Cosy desk, Blueprint or Control room, quiet/balanced/expressive effects, and 0.5x/1x/1.5x/2x speed. Large background effects pause while the full-screen canvas covers the workspace. Library adapters are cached between edits rather than copied every animation frame.

Sound waits for a browser gesture. **Enable sound** plays a preview; **Mute sound** and Volume control the locally generated step tones. Sound status explains zero volume, browser blocking and unavailable audio. Pending activation cannot block playback or reactivate muted sound. Leaving, hiding the page or changing accounts stops tones.

Global Animations Off and system reduced-motion settings stop automatic advancement and special effects; manual steps and explicitly requested sound still work. Editing, other open dialogs, hidden pages, Focus, privacy and the global presentation switch pause playback. The Process Hub's own full-screen dialog permits playback.

Scenarios define initial sample values, success/exception outcomes and choices among additional normal routes. Explore scenarios automatically cycles through scenarios after a route finishes. **Follow success**, **What if this fails?** and alternative-route buttons change the current playback only. Clicking a graph card pauses for inspection; the journal revisits a reached step. Previous/Next/Restart and temporary outcomes do not write records. Cycles stop after four visits per step or 160 trace entries, show a loop-limit result, then restart the presentation.

Initial sample values use one `Field = value` per line. Step changes use `Field = value` or `Field += number`; `@Other field` reads a sample value. Invalid additions or missing values pause the scenario with an explanation. At most 30 sample fields and 30 changes per step are allowed. These operations do not execute code or post to SAP.

## PDF and PNG exports

For a saved process, choose **Export PDF / Image**, select a format and PDF detail level, then **Prepare file** and the ready download link. **PDF in ZIP** provides an alternative if a browser intercepts direct PDF downloads. PNG contains the complete diagram, numbered cards, normal/exception routes and saved text, arrows and pen marks. Long card titles may be shortened in the diagram; the PDF contains full titles and step text.

**User handout** includes the diagram, process context, user explanations, responsibilities, prerequisites, inputs, outputs, outcomes, organization/material information and routes. **Full reference** also includes private presenter notes, technical and failure details, reference links, sample changes and all defined scenarios. Exports use a snapshot and never change records. Account changes cancel pending exports and invalidate ready links.

PDF pages are drawn individually using browser fonts, preserving Unicode and avoiding remote font/image services. They are image-based pages, so text is not selectable. Long sections paginate instead of being silently truncated. The exporter limits very large guides to 240 pages and explains how to reduce them. PNG diagrams are scaled to a bounded image size; PDF step descriptions remain readable independently of diagram size. Saved screenshot decoding failures are labelled in the PDF.

## Compatibility, limits and persistence

New processes retain the existing limits: 100 rehearsal processes, 80 steps per process and 2,000 steps across that collection; 20 scenarios per process. Older Process Hub processes retain their previous 200-step allowance and IDs. They save back to their original collection with canvas/scenario extensions; normal branches, notes, configuration, errors, tests and account links are preserved. Existing backups require no manual migration.

PNG/JPEG/WebP uploads accept up to 5 MB, optimize to at most 1,000 pixels on the longer side, and flatten to JPEG. Encoded screenshots are limited to 180,000 characters each and 2 MB combined across both libraries. Original uploads are not retained. All saved data uses the existing account document, backup/restore and conflict handling, without database-schema or authentication changes. Animation state, journals, viewport and temporary outcomes remain local.

## SAP T-codes

Open **Studio → SAP T-codes**. The initial 79 MM-related entries are grouped into **Transactions**, **Reporting**, **Master data**, **Configuration** and **Support**, with functional-area tags.

Search codes, purposes or notes; switch ECC/S/4HANA; filter by group; favourite entries; add or edit codes; and archive/restore them. Archived entries do not reappear during upgrades. Custom group names are supported. The step editor offers these codes as suggestions.

The starter is checked on **21 October 2026**, with linked SAP references in each card. S/4HANA guidance targets on-premise/private edition and depends on release, configuration and authorization. Public Cloud access differs. Classic supplier XK*/MK* entries are catalogued under ECC and point users toward BP for S/4HANA supplier maintenance. Classic release/RFQ entries carry scope notes. These are maintained reference scopes, not a live test of the transactions in your SAP system.

Personal changes are saved in `workhub.tcodes`, up to 2,000 unique codes. Editing a starter entry marks it personalised and retains the reference for review. The site copies codes and opens documentation; it does not connect to an SAP session.

## Main SAP sources

- [ERP purchase orders](https://help.sap.com/docs/SAP_ERP/314543b557664914af50fde2261cea57/8780b65334e6b54ce10000000a174cb4.html)
- [S/4HANA purchasing document transactions](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/9905622a5c1f49ba84e9076fc83a9c2c/028f6754e90d8c4ce10000000a4450e5.html)
- [MM reporting list](https://help.sap.com/docs/PRODUCT_ID/9905622a5c1f49ba84e9076fc83a9c2c/42e8e557f828ef32e10000000a441470.html)
- [Material master transactions](https://help.sap.com/docs/SUPPORT_CONTENT/ldm/3363506423.html)
- [Inventory and integration transactions](https://help.sap.com/docs/SUPPORT_CONTENT/sewm/3900061781.html)
- [Classic release strategies](https://help.sap.com/docs/SUPPORT_CONTENT/spmm/3362168095.html)
- [S/4HANA supplier/BP simplification list](https://help.sap.com/doc/f2591a6901344c97a5e2029cc8f3703e/2021/en-US/SIMPL_OP2021.pdf)
- [On-premise troubleshooting tools](https://help.sap.com/docs/signavio-process-intelligence/onboarding-and-data-integration-guide/troubleshooting-data-collection-sap-on-premise-systems)
