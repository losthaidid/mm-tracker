# Which file does what?

This is the source map for **SAP MM WorkHub** in `losthaidid/mm-tracker`.
The website is published by GitHub Pages. Supabase stores private account records and handles login.
There is no build step for ordinary website changes.

Personal process rehearsal: `rehearsal-engine.js` validates saved graphs, scenarios and sample-value changes; `rehearsal.js` supplies the animated canvas, editors, audio and journal; `rehearsal.css` styles both rehearsal and the T-code desk. `sap-tcodes-data.js` contains the SAP-sourced starter references, `sap-tcodes-engine.js` validates and filters the private library, and `sap-tcodes.js` handles maintenance. See [PROCESS-REHEARSAL.md](PROCESS-REHEARSAL.md).

Project reporting: [project-standup-engine.js](../project-standup-engine.js) handles progress totals, recorded update times and Action/task links; [project-standup.js](../project-standup.js) supplies the Overview card, expanded report and Actions forms; [project-standup.css](../project-standup.css) controls its responsive layout. See [PROJECT-STANDUP.md](PROJECT-STANDUP.md) for usage and storage notes.

Product/process solutioning: [solution-engine.js](../solution-engine.js) owns blueprint relationships, decisions, kept-run inputs, delivery links and the pure SAP MM model. [solution-demo.js](../solution-demo.js) supplies the fictional business; [solution-studio.js](../solution-studio.js) builds the discovery/design/review screens; [solution-simulation.js](../solution-simulation.js) manages local trial inputs and playback; [solution-studio.css](../solution-studio.css) controls the appearance and effects. Start with [SOLUTION-STUDIO.md](SOLUTION-STUDIO.md) for workflow, SAP sources and the explicit transaction coverage. [solution-materials.js](../solution-materials.js) contains editable type references and attribute logic; [solution-theatre.js](../solution-theatre.js) renders accounting/documents/warehouse views; [solution-experience.js](../solution-experience.js) owns the material, discovery, workshop and report tools, styled by [solution-experience.css](../solution-experience.css). See [MATERIAL-EXPLORER.md](MATERIAL-EXPLORER.md) for the new workflow.

**Start with [Editing guide](EDITING-GUIDE.md).** For appearance changes, use [custom.css](../custom.css).
For feature-specific changes, find the matching file below. JavaScript (`.js`) controls behaviour;
CSS (`.css`) controls appearance; HTML supplies the initial page structure.

## Main page and coordination

| File | Responsibility | Useful starting point |
| --- | --- | --- |
| [index.html](../index.html) | Page metadata, initial header/login/dialog markup, empty starter data and asset load order. | Browser title, initial wording, stylesheet/script references. |
| [startup.js](../startup.js) | Covers the original HTML until the current workspace or sign-in screen is ready; handles slow/interrupted loading. Critical loading-screen styles and markup are in `index.html`. | `message`, `finish`, the 12-second recovery message. No record writes. |
| [app.js](../app.js) | Core records, Tickets/Tasks editors, Projects/governance, Schedule, workbook utilities, login and autosave. Extracted from the old inline script. | `FIELDS`, `render`, `mutate`, `saveEdit`, `saveCloud`. Numbered section comments explain the major areas. |
| [base.css](../base.css) | Original shared styles for pages, forms, dialogs, tables, Projects and Schedule. Extracted from the old inline style. | Shared selectors; later feature sheets can override these rules. |
| [custom.css](../custom.css) | Your own style overrides, loaded last. Contains commented examples. | Start here for simple appearance changes. |
| [studio.js](../studio.js) | Workspace shell; My day, Knowledge, Process Hub, Waiting on, Studio, theme preferences, focus/work timers; installs the feature modules. | `DEFAULTS`, `WIDGETS`, `install`, `prepare`, `afterRender`. |
| [studio.css](../studio.css) | Sidebar, dashboard, workspace screens, theme controls and work timer. | Shared WorkHub layouts and theme variables. |
| [settings-panel.js](../settings-panel.js), [settings-panel.css](../settings-panel.css) | Searchable Settings categories and action descriptions. | `GROUPS` for category labels; `ITEMS` for descriptions/search words. |
| [built-in-lists.js](../built-in-lists.js), [built-in-lists.css](../built-in-lists.css) | Grouped list library, search, one editor at a time, live counts and dropdown previews. Existing list validation and saving stay in `app.js`. | `fields`, `render`, `mount`. |
| [dramatic-motion.css](../dramatic-motion.css), [dramatic-motion.js](../dramatic-motion.js) | Expressive arrivals, interactions, character motion, scenery and Lab result effects. Pauses decorative motion on hidden pages and respects Animations Off/reduced motion. | Keyframe groups and the accessibility rules at the end. |
| [workspace-upgrades.js](../workspace-upgrades.js), [workspace-upgrades.css](../workspace-upgrades.css) | Theme/background choices and explicit project status dates. | `THEMES`, `BACKGROUNDS`, project-date hooks. |
| [workspace-features.js](../workspace-features.js), [workspace-features.css](../workspace-features.css) | Annual/medical leave, Process Hub presentations and header/menu interactions. | `LEAVE`, `PORTIONS`, and the exported adapters at the bottom. |

## Tickets, tasks and workflow

| Files | What they control |
| --- | --- |
| [ticket-workspace.js](../ticket-workspace.js), [ticket-workspace.css](../ticket-workspace.css) | Ticket cards, Latest update, details, milestones/history and grouped editor sections including Work Context. Uses the existing core save handlers. |
| [task-workspace.css](../task-workspace.css) | Task action/status toolbar and main-task/sub-task styling. Task editors and saved fields are in `app.js`; board and timer interactions also use `studio.js`. |
| [batch-a-engine.js](../batch-a-engine.js) | Rules/calculations for dependencies, labels, environments, outcomes, glossary, stale-work review and resume context. |
| [batch-a.js](../batch-a.js), [batch-a.css](../batch-a.css) | Interfaces for those workflow tools: Work Context, splitting, wrap-ups, glossary and reading mode. |
| [reminders.js](../reminders.js), [reminders.css](../reminders.css) | Exact reminder dates/times, quick scheduling, optional snoozing, due-alert panel, account isolation, calendar copies and inbox. Older date-only reminders remain compatible. |
| [work-library-engine.js](../work-library-engine.js) | Snippet placeholders, reusable fields and timeline change calculations. |
| [work-library.js](../work-library.js), [work-library.css](../work-library.css) | Snippet/bundle editors, message composer, reusable field interface and timeline view. |
| [reports.js](../reports.js) | Current report options and formatted Excel report generation. The shared ZIP writer remains in `app.js`. |

## Schedule, expenses and company contacts

| Files | What they control |
| --- | --- |
| [app.js](../app.js), [base.css](../base.css) | Schedule views, exact minute intervals, bookings, project-calendar links and the original form layouts. |
| [claims-engine.js](../claims-engine.js) | Location/rate rules, booking travel snapshots, client/special claim types, integer-sen calculations, monthly totals and CSV output. |
| [claims.js](../claims.js), [claims.css](../claims.css) | Maintainable mileage locations, claim type and one-off destinations, travel fields, monthly summary and other-expense ledger. |
| [tng-engine.js](../tng-engine.js) | Positioned statement-table parsing, integer-sen amounts, on-site suggestions, duplicate identities and confirmed expense/source validation. No PDF library or account writes. |
| [tng-files.js](../tng-files.js) | Lazy local PDF.js loading, source-page rendering, faithful row crops and PNG/PDF/ZIP evidence generation. Client PDFs combine dated To/Return crops with editable captions; special claims keep individual crops. PDF bytes stay in memory. |
| [tng.js](../tng.js), [tng.css](../tng.css) | Schedule's TNG review desk, date filters, manual drafts, visit allocation, bounded crop controls and explicit expense saves. |
| [recipients-engine.js](../recipients-engine.js) | Email validation, bulk parsing, duplicates, To/Cc/Bcc grouping and plain address output. |
| [recipients.js](../recipients.js), [recipients.css](../recipients.css) | Company/contact forms, list search, undo, copy preview and clipboard fallback. |
| [company-process-template.xlsx](../company-process-template.xlsx) | Downloadable company/process import template. Import parsing is in `app.js`. |

## Investigation and validation tools

| Files | What they control |
| --- | --- |
| [workbench.js](../workbench.js), [workbench.css](../workbench.css) | Quick status actions, record previews and troubleshooting case records. |
| [lab-workshop.js](../lab-workshop.js), [lab-workshop.css](../lab-workshop.css) | Visual investigation board, experiments, gestures and reactions; automatic saved-result loops and local Pause/Stop/speed controls. |
| [validator-engine.js](../validator-engine.js) | Template/field/rule definitions, schema checks, row validation, lookup checks and CSV helpers. |
| [validator-files.js](../validator-files.js) | Local CSV/TSV/XLSX reading and template/results workbook exports. |
| [validator-studio.js](../validator-studio.js), [validator-studio.css](../validator-studio.css) | Template designer, upload mapping and results screens. Uploaded rows remain in memory. |

## Momo, scenery, focus and sound

| Files | What they control |
| --- | --- |
| [momo-art.js](../momo-art.js), [momo-anime.css](../momo-anime.css) | Momo's rendered character, rig layers, expressions and poses. |
| [assets/momo/anime-rig.webp](../assets/momo/anime-rig.webp), [assets/momo/README.md](../assets/momo/README.md) | Character image asset and its artwork notes. |
| [momo-life.js](../momo-life.js) | Basic expressions, dragging, home and simple play. |
| [momo-behaviour-engine.js](../momo-behaviour-engine.js), [momo-behaviour.css](../momo-behaviour.css) | Pure activity phases, shared ball/kick calculations, visitor roles and safe resting positions; staged poses and temporary weather/friend props. |
| [momo-moments.js](../momo-moments.js), [momo-moments.css](../momo-moments.css) | Small performances and discoveries. |
| [momo-adventures.js](../momo-adventures.js), [momo-world.css](../momo-world.css) | Name/greetings/dialogue, chase/sprint/umbrella/mischief and soccer tricks/surprises. |
| [momo-world-art.js](../momo-world-art.js) | Vector visitors and illustrated window scenes. |
| [tests/momo-behaviour.test.mjs](../tests/momo-behaviour.test.mjs) | Soccer contact/count invariants, staged chase/tug phases, bounded paths and phone-sized control avoidance. |
| [atmosphere.js](../atmosphere.js), [atmosphere.css](../atmosphere.css) | Daylight, weather, scenery, visitor lifecycle and local atmosphere settings. |
| [focus-panel.js](../focus-panel.js), [focus-panel.css](../focus-panel.css) | Draggable mini focus timer with Soundscape controls. |
| [soundscape.js](../soundscape.js), [soundscape.css](../soundscape.css) | Ambient mixer, presets and floating audio controls. |
| [lofi-engine.js](../lofi-engine.js) | Locally synthesized keyboard, bass and drum loops used by Soundscape. |

## Cloud and supplied libraries

| Files | Responsibility |
| --- | --- |
| [sync-merge.js](../sync-merge.js) | Conservative three-way merge of local and remote record documents. |
| [cloud-entry.js](../cloud-entry.js) | Small source entry used to generate the Supabase browser bundle. |
| [supabase-client.js](../supabase-client.js) | Generated Supabase library. Rebuild from `cloud-entry.js`; do not manually reformat/edit this bundle. |
| [vendor/jszip.min.js](../vendor/jszip.min.js) | Supplied JSZip 3.10.1 library, moved unchanged out of the page. Reads compressed Excel uploads. Production and preview tests now share one copy. |
| [vendor/pdfjs/](../vendor/pdfjs/), [vendor/pdf-lib/](../vendor/pdf-lib/) | Unmodified PDF.js 6.4.299 legacy reader/worker and pdf-lib 1.17.1 export module with their licences. Loaded only when needed; keep each reader and its worker on the same version. |
| [cloud-schema.sql](../cloud-schema.sql) | Initial database setup for a fresh installation, including private-record policies and revision-based saves. |
| [supabase/migrations/](../supabase/migrations/) | Existing database format updates: version 5–7 support; precise schedules/subtask notes; workspace document version support. Ordinary wording/CSS edits need no SQL migration. |
| [THIRD-PARTY-LICENSES.txt](../THIRD-PARTY-LICENSES.txt) | Supplied library licence notices. JSZip also retains its original licence header. |

## Tests, documentation and project support

| Files | Responsibility |
| --- | --- |
| [tests/app.test.mjs](../tests/app.test.mjs) | Runs the production page/modules in a simulated browser, with fake account/network state. Checks editors, cloud saving, integrations and selected computed styles. |
| [tests/database.test.mjs](../tests/database.test.mjs) | Database/schema/migration checks using an isolated test database. |
| [tests/batch-a.test.mjs](../tests/batch-a.test.mjs), [tests/claims.test.mjs](../tests/claims.test.mjs), [tests/recipients.test.mjs](../tests/recipients.test.mjs) | Focused workflow, expense and recipient rule tests. |
| [tests/tng.test.mjs](../tests/tng.test.mjs) | Synthetic offline/online statement parsing, amount/date rules, Schedule matching, duplicate prevention and bounded evidence provenance. No private statement fixture. |
| [tests/tng-pdf.test.mjs](../tests/tng-pdf.test.mjs) | Actual evidence PDF generation and reading: crop counts, continuation pages, captions, noon split, special format and cancellation, using synthetic source crops. |
| [tests/reminders.test.mjs](../tests/reminders.test.mjs) | Exact due boundaries, local-time conversion, legacy snoozes, restored-record validation and escaped UTF-8 calendar alarms. Timed reminder interactions are also covered in `tests/app.test.mjs`. |
| [tests/validator.test.mjs](../tests/validator.test.mjs), [tests/work-library.test.mjs](../tests/work-library.test.mjs) | Validation and reusable-library tests. |
| [tests/source-layout.test.mjs](../tests/source-layout.test.mjs) | Checks production asset paths/order and the protected vendor/empty-seed layout after extraction. |
| `tests/*-preview.html` | Manual feature preview pages for Momo, Batch A, Validation Studio and wishlist tools. These are development previews, not extra live application pages. |
| [README.md](../README.md) | Setup, deployment, cloud saving and feature usage. |
| [BATCH-A.md](../BATCH-A.md), [WISHLIST.md](../WISHLIST.md), [VALIDATION-STUDIO.md](../VALIDATION-STUDIO.md) | Implemented feature instructions. |
| [BATCH-B.md](../BATCH-B.md), [BATCH-C.md](../BATCH-C.md), [docs/TNG-AND-LAB.md](TNG-AND-LAB.md) | Implemented Momo behaviour guide, pending ticket discovery/screenshot privacy ideas, TNG review/export and saved Lab playback instructions. |
| [docs/EDITING-GUIDE.md](EDITING-GUIDE.md) | Beginner editing steps, examples and explanation of the application flow. |
| [docs/SOURCE-CLEANUP.md](SOURCE-CLEANUP.md) | What this cleanup changed and why some compatibility code remains. |
| [package.json](../package.json), [package-lock.json](../package-lock.json) | Developer commands and pinned tool/library versions. Not needed to run the published site. |
| [.prettierrc.json](../.prettierrc.json), [.prettierignore](../.prettierignore) | Formatting rules; supplied libraries and test fixtures are excluded from bulk formatting. |
| [.gitignore](../.gitignore), [.nojekyll](../.nojekyll) | Exclude local dependency folders; serve the root files directly on GitHub Pages. |

## How the files work together

`index.html` loads the foundation CSS, feature CSS and finally `custom.css`. It loads the supplied
libraries, feature engines/interfaces and `studio.js`, then runs `app.js` after the empty starter data.
Preserve that order: interfaces can use engines defined earlier.

`app.js` gives `studio.js` an adapter containing functions such as `state`, `mutate`, `render` and
`openModal`. Studio passes suitable adapters to the feature modules. This keeps one account/save
pipeline while allowing each feature to own its forms and appearance.

An `*-engine.js` file usually contains rules and calculations. Its matching `.js` file usually
contains forms and interaction. Its matching `.css` file styles those forms.

Project people: [project-people-engine.js](../project-people-engine.js) validates contacts, hierarchy and responsibilities; [project-people.js](../project-people.js) supplies the workspace and forms; [project-people-files.js](../project-people-files.js) exports PNG/Excel; [project-people.css](../project-people.css) styles the chart and mobile list. See [PROJECT-PEOPLE.md](PROJECT-PEOPLE.md).
