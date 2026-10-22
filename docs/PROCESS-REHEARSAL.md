# Personal Process Rehearsal and SAP T-code library

Open **Studio → Process Rehearsal**. It replaces the former numeric Document Simulator. Existing saved numeric inputs remain in backups for compatibility; the old calculator form is removed.

## Start and maintain a process

The initial procure-to-pay example is a local preview and creates no saved process. **Save this example** creates your editable copy. **New process** can use the example or a blank two-step flow. Save as many as 100 personal processes, with up to 80 steps per process and 2,000 steps across the account. Processes remain within the existing private account; there is no team login or shared editing.

A step can be a task, document, decision, approval or result. Maintain its title, responsible person/role, transaction code, prerequisites, instructions, expected result, failure explanation, reference URL and optimized screenshot. Choose its normal next step and optional failure next step. Delete removes incoming links to that step and adjusts the starting step when necessary.

Drag a step by its dotted handle, or focus the handle and use arrow keys (Shift moves farther). **Auto arrange** lays out the graph. Zoom and scroll let you inspect larger processes. Camera movement follows playback in normal motion modes.

Opening the step editor pauses the scene. Save resumes playback; Cancel retains a paused reading view. Preferences can change while a draft is open without dropping the draft. Saved-process changes are checked before committing a stale editor.

## Automatic playback and special effects

A saved process automatically plays on opening and loops after its route ends. Document tokens move between steps; document, approval, decision and result steps have distinct appearances. Active edges light up, approvals receive stamps, successful value updates flash, and exception steps shake and follow the defined failure edge.

Choose **Cosy desk**, **Blueprint** or **Control room** scenery; **quiet**, **balanced** or **expressive** effects; and 0.5×, 1×, 1.5× or 2× speed. Playback pauses for open dialogs, editing, hidden pages, Focus, privacy and presentation modes. Global motion Off and system reduced-motion settings stop automatic advancement and special effects; manual Next/Previous remain available.

Sound is enabled in the saved preferences, but waits for a browser gesture. Click **Enable sound** to hear an immediate preview; the button then becomes **Mute sound**. Playback and manual Next/Previous or journal selections use short locally generated tones, with no external audio downloads. Reduced-motion and Animations Off still allow explicitly requested step sounds. The volume slider is independent; at zero, the status explains why the scene is silent. The status also reports unavailable or blocked audio and lets you retry. Leaving the scene, hiding the page or changing account stops current tones; a pending audio start cannot block playback controls or reactivate muted sound.

## Scenarios, failure injection and rewind

Each process has named scenarios with initial sample values and a saved success/failure choice for every step. Enable **Explore scenarios automatically** to cycle through them at the end of each route.

**Follow success** or **What if this fails?** temporarily overrides the selected step's outcome for the current rehearsal. It does not change the saved scenario. A failure with no failure edge ends that route. Repeated graph cycles stop after four visits to a step or 160 entries, show a loop-limit result and restart the presentation; a malformed graph cannot create an unbounded trace.

Click a step to pause and inspect it, including steps outside the current route. Click a journal event to revisit that point. Previous/Next and Restart change only temporary playback. The journal and changing sample values are rebuilt from the scenario; rewinding does not post, reverse or change real SAP documents.

Initial values use one `Field = value` per line. Numbers remain numeric; other values are plain text. Step changes use `Field = value` or `Field += number`. A reference such as `Received quantity += @Delivery quantity` reads another sample field. Missing fields or invalid numeric additions pause the scenario with an explanation. These are data operations, not executable expressions. At most 30 sample fields and 30 changes per step are accepted.

Routes follow your definitions. The canvas does not infer actual SAP release, posting, authorization, tolerance or business rules.

## Screenshots and persistence

Choose PNG, JPEG or WebP up to 5 MB. The browser downsizes the screenshot to at most 1,000 pixels on its longer side, flattens it onto white and saves a compact JPEG. Each encoded screenshot is capped at 180,000 characters, with a 2 MB combined encoded-image budget across saved rehearsals. Reduce/crop images that exceed the limits. The original upload is not retained.

Saved steps, scenarios, images and positions are in `workhub.rehearsal`. Playback, its journal, active route, viewport and temporary overrides remain local. The existing private document, backup/restore and conflict handling are used; no database schema or authentication change is required. Account changes close old editors and reject stale form/file operations.

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

## Verification

The branch workflow runs the existing full application/database suite plus dedicated graph, scenario, library, account, playback, editor and audio checks. Browser visual QA is unavailable in the current session. Source files have comments and appear in the file map for later personal changes.
