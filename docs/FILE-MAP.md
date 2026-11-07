# Which file does what?

This is the source map for **SAP MM WorkHub** in `losthaidid/mm-tracker`.
The website is published by GitHub Pages. Supabase stores private account records and handles login.
There is no build step for ordinary website changes.

Google Drive & Handover packs: `drive-files-engine.js` validates metadata; `drive-files-api.js` keeps GIS tokens in memory and handles scoped Drive requests; `files-library.js` supplies Files, setup and reviewed QR sharing. `handover-engine.js` captures source-safe snapshots, complete updates, exact parent/child time attribution, summaries and shared report sections; `handover-files.js` renders full paginated Fiori-inspired PDFs; `handover.js` supplies selection, Detailed/Compact layout, grouped preview and export. Shared layout: `files-handover.css`; local QR encoder: `vendor/qrcode/` (2.0.4, MIT). `rehearsal.js` adds Save to Drive alongside prepared Process Hub downloads. Registry DML: `supabase/drive-handover-access.sql`. Guides: [GOOGLE-DRIVE.md](GOOGLE-DRIVE.md), [HANDOVER-PACKS.md](HANDOVER-PACKS.md); public Google data policy: `privacy.html`. No Google tokens or file contents are saved in workspace data.

File previews and gallery: `file-previews.js` / `file-previews.css` provide local PDF/image viewing, bounded page rendering and opt-in thumbnails. `files-library.js` supplies per-account Table/Gallery layout, filtering, pagination and preview routing. `drive-files-api.js` supplies bounded, abortable media reads under the existing Google grant. See [GOOGLE-DRIVE.md](GOOGLE-DRIVE.md#file-previews-and-gallery).

Website confirmations: `website-dialogs.js` / `website-dialogs.css` provide awaited themed decisions shared across app modules. `app.js` supplies account/data/access context; `rehearsal.js` preserves the fullscreen stage and sibling dialogs during repaint. See [WEBSITE-DIALOGS.md](WEBSITE-DIALOGS.md).

Website designs: `website-designs.js`, `website-designs.css`, `website-designs-extra.css` and `website-fiori.css` provide Current, Clear Desk, Modern Hub, Editorial, Canvas, Compact Pro and Fiori Workspace, the preview chooser, responsive navigation grouping and scoped surfaces. `workspace-redesign.css` supplies the shared compact header, page/card/widget layouts and presentation-control styling; `world-window.js` keeps the original atmosphere card in the sidebar; the header and sidebar stay pinned while the workspace scrolls. `process-workspace.css` derives its futuristic canvas/HUD palette from the selected website theme. `studio.js` installs the account preference adapter; `app.js` keeps working editors and validation sessions mounted during a design-only save. `settings-panel.js` places the launcher in Workspace. See [WEBSITE-DESIGNS.md](WEBSITE-DESIGNS.md) and [workspace layout renewal](WORKSPACE-REDESIGN.md).

Shared visual refinement: `visual-refinement.js` / `visual-refinement.css` provide section marks and accents, finite page arrivals, a moving navigation indicator, coordinated surfaces, typography, badges, forms, empty states and dashboard grouping. The layer keeps the original controls, saved layout, theme and motion preferences. See [VISUAL-REFINEMENT.md](VISUAL-REFINEMENT.md).

Storage & cleanup: [storage-engine.js](../storage-engine.js) measures visible record data, creates lossless ZIP archives, protects live references and plans missing-only restores; [storage-manager.js](../storage-manager.js) supplies the three-tab Settings dialog and password-checked, revision-locked cloud saves; [storage.css](../storage.css) scopes the responsive design. `settings-panel.js` places the launcher in Backups & sync. The read-only `20261104043659_storage_usage_summary.sql` migration adds account-scoped metrics and Owner-only database totals. See [STORAGE-CLEANUP.md](STORAGE-CLEANUP.md).

User administration: `access-catalog.js` defines the shared 31-feature registry; `access-control.js` loads the authoritative profile, guards interface actions and applies personal visibility; `user-management.js` / `user-management.css` provide the Owner settings dialog. `supabase/user-management.sql` enforces approval, private projected reads, checked writes and account protection; `supabase/access-catalog.sql` mirrors the registry; `supabase/bootstrap-owner.sql` initializes the existing sole confirmed account. `supabase/functions/workhub-admin/index.ts` authenticates Owner actions and performs private Auth administration. See [USER-MANAGEMENT.md](USER-MANAGEMENT.md).

Permission-aware shortcuts: `shortcut-access.js` shares Settings, Quick add, command and form requirements using the existing feature registry. `settings-panel.js` filters rows/search/counts; `access-control.js` guards shortcuts before document handlers; `studio.js` filters and rechecks launch actions. `batch-a.js` leaves work context unchanged when personal setup is read-only. See [USER-MANAGEMENT.md](USER-MANAGEMENT.md).

Unified Process Hub: `rehearsal-engine.js` validates saved graphs, adapts both existing process collections in place, plans scenarios/sample-value changes and resumes live edits without replaying completed changes; `rehearsal.js` supplies full-screen draft editing, drag/drop types, animated playback, audience/reference views, audio and journal; `process-hub-files.js` creates local PDF/PNG exports; `process-inspector.js` groups both private step forms into accessible tabs; `process-canvas-art.js` shares connection anchors, curve/right-angle/straight geometry, bend handles and token paths across the editor, audience and exports; `rehearsal.css` styles the hub and T-code desk. `sap-tcodes-data.js` contains the SAP-sourced starter references, `sap-tcodes-engine.js` validates and filters the private library, and `sap-tcodes.js` handles maintenance. See [PROCESS-REHEARSAL.md](PROCESS-REHEARSAL.md).

Project reporting: [project-standup-engine.js](../project-standup-engine.js) handles progress totals, recorded update times and Action/task links; [project-standup.js](../project-standup.js) supplies the Overview card, expanded report and Actions forms; [project-standup.css](../project-standup.css) controls its responsive layout. See [PROJECT-STANDUP.md](PROJECT-STANDUP.md) for usage and storage notes.

Project item workspace: [project-items-engine.js](../project-items-engine.js) orders rows and creates immutable bulk/field previews with selected-record snapshots; [project-items.js](../project-items.js) supplies cards/table controls, bounded pages, column resizing, field editors, expandable children and reviewed bulk changes; [project-items.css](../project-items.css) scopes the responsive layout. `app.js` supplies the existing filters, full editors and shared mutation path. See [Project cards, table and bulk editing](WORKSPACE-TOOLS.md#project-cards-table-and-bulk-editing).

Product/process solutioning: [solution-engine.js](../solution-engine.js) owns blueprint relationships, decisions, kept-run inputs, delivery links and the pure SAP MM model. [solution-demo.js](../solution-demo.js) supplies the fictional business; [solution-studio.js](../solution-studio.js) builds the discovery/design/review screens; [solution-simulation.js](../solution-simulation.js) manages local trial inputs and playback; [solution-studio.css](../solution-studio.css) controls the appearance and effects. Start with [SOLUTION-STUDIO.md](SOLUTION-STUDIO.md) for workflow, SAP sources and the explicit transaction coverage. [solution-materials.js](../solution-materials.js) contains editable type references and attribute logic; [solution-theatre.js](../solution-theatre.js) renders accounting/documents/warehouse views; [solution-experience.js](../solution-experience.js) owns the material, discovery, workshop and report tools, styled by [solution-experience.css](../solution-experience.css). See [MATERIAL-EXPLORER.md](MATERIAL-EXPLORER.md) for the new workflow.

**Start with [Editing guide](EDITING-GUIDE.md).** For appearance changes, use [custom.css](../custom.css).

Solution Studio learning: [solution-guide.js](../solution-guide.js) contains the Start here journey, six lessons, screen help, editor examples, glossary and transaction explanations. Edit `HELP`, `LESSONS` or `TERMS` for wording; `narration` reads engine events without changing results. [solution-guide.css](../solution-guide.css) controls the learning layouts, readable text, before/after cards and their scoped effects. Navigation and lesson actions remain in `solution-studio.js`; playback pace remains in `solution-simulation.js`.
For feature-specific changes, find the matching file below. JavaScript (`.js`) controls behaviour;
CSS (`.css`) controls appearance; HTML supplies the initial page structure.

Current work-session filters, completed Schedule recordings, password-verified cloud reset, process marquee selection, three-period wardrobe and interactive header are documented in [WORKSPACE-TOOLS.md](WORKSPACE-TOOLS.md). `workspace-reset.js` owns the guarded review and isolated password session; its core adapter is in `app.js`. `brand-motion.js` / `brand-motion.css` provide the bounded, interactive header identity.

## Main page and coordination

| File | Responsibility | Useful starting point |
| --- | --- | --- |
| [index.html](../index.html) | Page metadata, initial header/login/dialog markup, empty starter data and asset load order. | Browser title, initial wording, stylesheet/script references. |
| [startup.js](../startup.js) / [startup-brand.js](../startup-brand.js) | Covers the original HTML until the current workspace or sign-in screen is ready; handles slow/interrupted loading. Uses the matching account's saved website title from its existing recovery copy, then the loaded cloud preference. The small brand hook runs as soon as the cover markup is parsed. Critical loading-screen styles, inline SVG and preset palette snapshots are in `index.html`; `startup.js` restores the matching account’s saved Studio theme/custom colours before the cover is painted and `studio.js` supplies verified saved preferences while opening; rotating trails, floating work cards and a finite tap-to-spark effect are scoped to the cover. Startup reuses the matching account’s motion preference, pauses hidden animation and removes its interaction listeners on finish. | `account`, `name`, `brand`, `message`, `finish`, the 12-second recovery message. No record writes. |
| [app.js](../app.js) | Core records, Tickets/Tasks editors, Projects/governance, Schedule, workbook utilities, login and autosave. Extracted from the old inline script. | `FIELDS`, `render`, `mutate`, `saveEdit`, `saveCloud`. Numbered section comments explain the major areas. |
| [base.css](../base.css) | Original shared styles for pages, forms, dialogs, tables, Projects and Schedule. Extracted from the old inline style. | Shared selectors; later feature sheets can override these rules. |
| [custom.css](../custom.css) | Your own style overrides, loaded last. Contains commented examples. | Start here for simple appearance changes. |
| [theme-surfaces.css](../theme-surfaces.css) | Shared theme colours for feature surfaces, controls, text and semantic states. Loaded before personal overrides. | Feature palette aliases, separate scenic/orb foregrounds and readable labels; no layout or scene-art changes. |
| [studio.js](../studio.js) | Workspace shell; My day, Knowledge, Process Hub, Waiting on, Studio, theme preferences, focus/work timers; installs the feature modules. | `DEFAULTS`, `WIDGETS`, `install`, `prepare`, `afterRender`. |
| [studio.css](../studio.css) | Sidebar, dashboard, workspace screens, theme controls and work timer. | Shared WorkHub layouts and theme variables. |
| [settings-panel.js](../settings-panel.js), [settings-panel.css](../settings-panel.css) | Searchable Settings categories and action descriptions. | `GROUPS` for category labels; `ITEMS` for descriptions/search words. |
| [built-in-lists.js](../built-in-lists.js), [built-in-lists.css](../built-in-lists.css) | Grouped list library, search, one editor at a time, live counts and dropdown previews. Existing list validation and saving stay in `app.js`. | `fields`, `render`, `mount`. |
| [render-profile.js](../render-profile.js), [iphone-motion.css](../iphone-motion.css), [large-display.css](../large-display.css) | Local Automatic/Smooth/Full rendering budgets, bounded frame sampling, iPhone/display limits and lightweight scene/glint styles. See [animation performance](ANIMATION-PERFORMANCE.md). | Device detection, resize hysteresis, live effect budget and gated CSS; no functional timer or account-data changes. |
| [dramatic-motion.css](../dramatic-motion.css), [dramatic-motion.js](../dramatic-motion.js) | Site-wide orbiting lights, particles, comets, animated panel borders, navigation/click shockwaves and pointer trails; also arrivals, character motion and Lab effects. Discovers added branches incrementally, uses bounded border gradients, pauses hidden/offscreen/covered work, respects Animations Off/reduced motion, and keeps input/drag coordinates stable. | Keyframe groups and the accessibility rules at the end. |
| [workspace-upgrades.js](../workspace-upgrades.js), [workspace-upgrades.css](../workspace-upgrades.css) | Theme/background choices, explicit project status dates and parent/sub-item completion rules. | `THEMES`, `BACKGROUNDS`, contrast-safe foreground tokens, project-date hooks. See [Project item completion](WORKSPACE-TOOLS.md#project-item-completion). |
| [workspace-features.js](../workspace-features.js), [workspace-features.css](../workspace-features.css) | Annual/medical leave, Process Hub presentations and header/menu interactions. | `LEAVE`, `PORTIONS`, and the exported adapters at the bottom. |

## Tickets, tasks and workflow

| Files | What they control |
| --- | --- |
| [ticket-workspace.js](../ticket-workspace.js), [ticket-workspace.css](../ticket-workspace.css) | Ticket cards, Latest update, details, milestones/history, Object bookmarks and grouped editor sections including Work Context. Object fields/filters appear for Pending; maintained values come from Settings → Built-in lists → Ticket objects. Uses existing core save handlers. |
| [task-completion.js](../task-completion.js) | Shared main-task rollup and reviewed completion of older fully completed subtask groups. Used by the Studio save preparation and Tasks screen. |
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
| [schedule-engine.js](../schedule-engine.js) | Pure daily execution, plan/actual identities, bounded history, interval unions and overlap validation. Parent lifecycle statuses are not execution inputs. |
| [work-schedule.js](../work-schedule.js), [work-schedule.css](../work-schedule.css) | Actual-work panels/cards, interruption capture, retrospective intervals, later record/company linking and project work history. Studio owns the recoverable single timer. |
| [leave-balance-engine.js](../leave-balance-engine.js) | Maintained leave types, yearly allowances, earlier usage, half-day counting, weekday/public holiday policies and reservation limits. |
| [leave-balances.js](../leave-balances.js), [leave-balances.css](../leave-balances.css) | Settings → Leave types / Leave allowances & balances, maintained public holiday calendar, Schedule cards and live after-save previews. See [LEAVE-BALANCES.md](LEAVE-BALANCES.md). |
| [claims-engine.js](../claims-engine.js) | Location/rate rules, booking travel snapshots, client/special claim types, integer-sen calculations, monthly totals, recorded submission/payment snapshots and CSV output. |
| [claims.js](../claims.js), [claims.css](../claims.css) | Maintainable mileage locations, claim type and one-off destinations, travel fields, monthly summary, claims status/history tracker and other-expense ledger. |
| [tng-wallet.js](../tng-wallet.js) | Separate eWallet history reader: dynamic columns, wrapped references, continuation pages, payment exclusions and source header-page coordinates. |
| [tng-engine.js](../tng-engine.js) | Original offline/online card parsing plus eWallet dispatch, integer-sen amounts, on-site suggestions, duplicate identities and confirmed expense/source validation. No PDF library or account writes. |
| [tng-files.js](../tng-files.js) | Lazy local PDF.js loading, source-page rendering, faithful row crops and PNG/PDF/ZIP evidence generation. Client PDFs combine dated To/Return crops with editable captions; special claims keep individual crops. PDF bytes stay in memory. |
| [tng.js](../tng.js), [tng.css](../tng.css) | Schedule's TNG review desk, date filters, manual drafts, visit allocation, bounded crop controls and explicit expense saves. |
| [recipients-engine.js](../recipients-engine.js) | Email validation, bulk parsing, duplicates, To/Cc/Bcc grouping and plain address output. |
| [recipients.js](../recipients.js), [recipients.css](../recipients.css) | Company/contact forms, list search, undo, copy preview and clipboard fallback. |
| [company-process-template.xlsx](../company-process-template.xlsx) | Downloadable company/process import template. Import parsing is in `app.js`. |

My Day: [my-day-engine.js](../my-day-engine.js) handles bounded daily plans, estimates, canvas records and time calculations; [my-day.js](../my-day.js) supplies the interactive widgets and local break clocks; [my-day.css](../my-day.css) styles those widgets. [my-day-visuals.js](../my-day-visuals.js) and [my-day-visuals.css](../my-day-visuals.css) provide the local SVG landscape, chapter views, glass panels and guarded layout/chart/pointer effects without saving records. [rest-room.js](../rest-room.js) and [rest-room.css](../rest-room.css) provide the full-screen break and explicit timer resumption; [rest-audio.js](../rest-audio.js) supplies separate, locally synthesized rest soundscapes. Existing widget sorting and the shared focus engine stay in `studio.js`. See [MY-DAY.md](MY-DAY.md).

## Investigation and validation tools

Batch C: [batch-c-engine.js](../batch-c-engine.js) handles deterministic ticket matching and bounded local guide documents. [batch-c-files.js](../batch-c-files.js) decodes raster images, flattens annotations and exports paginated guides. [batch-c.js](../batch-c.js) supplies ticket previews, Studio launchers, local editors and account cleanup; [batch-c.css](../batch-c.css) styles their responsive layouts. See [BATCH-C.md](../BATCH-C.md). Images and editable drafts are local, with explicit file save/reopen.

| Files | What they control |
| --- | --- |
| [workbench.js](../workbench.js), [workbench.css](../workbench.css) | Quick status actions, record previews and troubleshooting case records. |
| [lab-workshop.js](../lab-workshop.js), [lab-workshop.css](../lab-workshop.css) | Visual investigation board, experiments, gestures and reactions; automatic saved-result loops and local Pause/Stop/speed controls. |
| [validator-engine.js](../validator-engine.js) | General/SAP template/field/rule definitions (200 columns), DDIC format/precision checks, project/company-scoped row validation, lookup checks, context-aware correction suggestions and CSV helpers. |
| [validator-reference-data.js](../validator-reference-data.js) | Independent Unit of Measurement reference factory with the 291 supplied codes, exact case and readable descriptions. See [References and published versions](VALIDATION-REFERENCES-VERSIONS.md). |
| [validator-files.js](../validator-files.js) | Local CSV/TSV/XLSX reading and template/results workbook exports. `issueReport` writes exactly Validated data / Issues, using bounded batches for wide single-sheet output. See [Issue workbook](VALIDATION-ISSUE-EXPORT.md). |
| [validator-csv.js](../validator-csv.js), [validator-csv.css](../validator-csv.css) | Independent Excel-to-CSV workspace beside Compare two files: displayed-value previews, worksheet selection, cell-by-cell byte verification, separate CSVs in a ZIP and reusable downloads. See [Excel to CSV](VALIDATION-CSV.md). |
| [validator-xls.js](../validator-xls.js), [validator-xls-worker.js](../validator-xls-worker.js), [validator-xls-engine.js](../validator-xls-engine.js) | On-demand local XLS reader in a cancellable worker: validates binary source records and cached values. Excel to CSV uses displayed values; independent file comparison and its queues use the existing XLSX saved-value rules. |
| [validator-compare-engine.js](../validator-compare-engine.js), [validator-compare.js](../validator-compare.js) | Independent A/B file comparison and reviewed pair queues: skip columns by count or checkboxes, data-only matching, saved formula values, two-section Summary / Field Comparison reports and ZIP downloads of completed pairs. Inactive pairs are compressed locally. See [Compare two files](VALIDATION-FILE-COMPARISON.md). |
| [data-reader-engine.js](../data-reader-engine.js), [data-reader.js](../data-reader.js), [data-reader.css](../data-reader.css), [data-reader-files.js](../data-reader-files.js) | Studio's dynamic, in-memory JSON / IDoc XML reader, segment explorer, theme-aware reports and local Excel/CSV/PDF exports. See [DATA-READER.md](DATA-READER.md). |
| [validator-runner.js](../validator-runner.js), [validator-worker.js](../validator-worker.js) | Short-lived same-origin workers run the existing validation engine for uploads with at least 20,000 mapped cells. Small jobs and unavailable workers use the same local engine. Context changes cancel pending jobs; uploaded rows are never persisted by the worker. |
| [validator-corrections.js](../validator-corrections.js), [validator-corrections-worker.js](../validator-corrections-worker.js) | Whole-file error scan beyond the stored issue cap, contextual correction plans, combined-row safety and cancellable worker/local execution. Studio supplies review, atomic full-file revalidation, apply and latest-batch undo. See [whole-file corrections](VALIDATION-CORRECTIONS.md). |
| [validator-setup.js](../validator-setup.js), [validation-setup-simple.xlsx](../validation-setup-simple.xlsx), [validation-setup-sap.xlsx](../validation-setup-sap.xlsx), [validation-setup-template.xlsx](../validation-setup-template.xlsx) | One-sheet General/SAP column setup and backward-compatible advanced Excel setup with conditions, references and unique combinations. Previewed as a new draft before saving. |
| [validator-studio.js](../validator-studio.js), [validator-studio.css](../validator-studio.css) | Template designer with project links and company condition scopes, multiple THEN requirements, per-company validation, upload mapping, correction picker and in-place live rechecks (no cloud write per edit). Uploaded rows remain in memory. |
| Validation profiles | Run-only check selections and saved profiles are compiled by `validator-engine.js`, maintained by `validator-studio.js`, and audited in Excel by `validator-files.js`. See [validation profiles](VALIDATION-PROFILES.md). The feature registry protects `workhub.validator.profiles`. |
| [validator-transform.js](../validator-transform.js) | Pure SAP formatting and positional delimiter expansion, with preview samples, strict pairing and bounded output. The Studio keeps working rows, original-row links and undo in browser memory. See [upload preparation](VALIDATION-PREPARATION.md). |

Exploded Excel download: `validator-studio.js` exports the active file's current source rows and original upload headers directly through `validator-files.js`'s bounded, literal-text writer. It does not require validation or filter out unresolved rows. See [download exploded Excel](VALIDATION-PREPARATION.md#download-exploded-excel-without-validation) and `tests/validator-exploded-export.test.mjs` for exact-value, lineage, wide-file, permission and stale-export checks.

## Momo, scenery, focus and sound

| Files | What they control |
| --- | --- |
| [momo-art.js](../momo-art.js), [momo-anime.css](../momo-anime.css) | Momo's rendered character, rig layers, expressions and poses. |
| [momo-wardrobe.js](../momo-wardrobe.js), [momo-wardrobe.css](../momo-wardrobe.css) | Stable daily garment/palette/accessory choices, matching sleeves, single-body umbrella rig and finite in-place hobbies. See [COMPANION-WARDROBE.md](COMPANION-WARDROBE.md). |
| [photo-background.js](../photo-background.js) | Account-scoped device-only picture gallery, bounded raster resizing and page/My Day welcome backgrounds. Picture/theme changes apply before the device save completes, roll back on failure and reject older account sessions. Use theme background restores the active palette/pattern, closes the gallery and retains pictures. Page restoration rebuilds active picture URLs. Styles share `momo-wardrobe.css`; a welcome-only photo keeps the page pattern; pictures never enter the cloud document. |
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
| [vendor/ssf.js](../vendor/ssf.js), [vendor/ssf.LICENSE](../vendor/ssf.LICENSE) | Unmodified SheetJS SSF 0.11.2, Apache 2.0. Locally formats Excel numeric/date values only for the CSV reader; loaded before validator-files.js. |
| [vendor/sheetjs/xlsx.full.min.js](../vendor/sheetjs/xlsx.full.min.js), [vendor/sheetjs/LICENSE](../vendor/sheetjs/LICENSE) | Unmodified SheetJS CE 0.20.3 full browser build, Apache 2.0. Includes BIFF/codepage decoding; loaded only inside the XLS worker. |
| [vendor/pdfjs/](../vendor/pdfjs/), [vendor/pdf-lib/](../vendor/pdf-lib/) | Unmodified PDF.js 6.4.299 legacy reader/worker and pdf-lib 1.17.1 export module with their licences. Loaded only when needed; keep each reader and its worker on the same version. |
| [cloud-schema.sql](../cloud-schema.sql) | Initial database setup for a fresh installation, including private-record policies and revision-based saves. |
| [supabase/migrations/](../supabase/migrations/) | Existing database format updates: version 5–7 support; precise schedules/subtask notes; workspace document version support. Ordinary wording/CSS edits need no SQL migration. |
| [THIRD-PARTY-LICENSES.txt](../THIRD-PARTY-LICENSES.txt) | Supplied library licence notices. JSZip also retains its original licence header. |

## Validation Studio performance checks

Validation indexes allowed values and field metadata once per run. SAP base checks avoid constructing unused comparison values. Comparison paging reuses a bounded count index for the current result and filters; edits and context changes build a fresh index. Unchanged editor markup is retained during updates, and Excel export reuses column addresses while keeping the same worksheet XML.

`tests/validator-performance.test.mjs` compares complete validation results with hashes captured from deployment `e33b54c`, including General/SAP checks, allowed-value boundaries, every operator, nested WHEN groups, multiple THEN requirements, company scope, duplicates and truncation. It also compares every XML member in seven exported workbooks and checks comparison filters/pages against the cell-level comparison results. Fixed synthetic inputs and expected outputs are under `tests/fixtures/`.

Use `node scripts/benchmark-validator.mjs` for the synthetic 12,000-record / 100-column validation benchmark. An optional first argument selects an earlier engine source file; an optional second argument selects `general`, `sap` or `sap-plain`. Compare result hashes as well as timings. Each case warms up on 100 records and reports the median of three full runs. Timings depend on the device, data and rules; this benchmark is not a minimum-speed guarantee.

## Tests, documentation and project support

| Files | Responsibility |
| --- | --- |
| [tests/app.test.mjs](../tests/app.test.mjs) | Runs the production page/modules in a simulated browser, with fake account/network state. Checks editors, cloud saving, integrations and selected computed styles. |
| [tests/database.test.mjs](../tests/database.test.mjs) | Database/schema/migration checks using an isolated test database. |
| [tests/batch-a.test.mjs](../tests/batch-a.test.mjs), [tests/claims.test.mjs](../tests/claims.test.mjs), [tests/recipients.test.mjs](../tests/recipients.test.mjs) | Focused workflow, expense and recipient rule tests. |
| [tests/tng.test.mjs](../tests/tng.test.mjs) | Synthetic offline/online statement parsing, amount/date rules, Schedule matching, duplicate prevention and bounded evidence provenance. No private statement fixture. |
| [tests/tng-pdf.test.mjs](../tests/tng-pdf.test.mjs) | Actual evidence PDF generation and reading: crop counts, continuation pages, captions, noon split, special format and cancellation, using synthetic source crops. |
| [tests/reminders.test.mjs](../tests/reminders.test.mjs) | Exact due boundaries, local-time conversion, legacy snoozes, restored-record validation and escaped UTF-8 calendar alarms. Timed reminder interactions are also covered in `tests/app.test.mjs`. |
| [tests/validator.test.mjs](../tests/validator.test.mjs), [tests/validator-queue.test.mjs](../tests/validator-queue.test.mjs), [tests/validator-capacity.test.mjs](../tests/validator-capacity.test.mjs), [tests/work-library.test.mjs](../tests/work-library.test.mjs) | Validation, isolated multi-file queues, large-file imports/exports and reusable-library tests. |
| [tests/source-layout.test.mjs](../tests/source-layout.test.mjs) | Checks production asset paths/order and the protected vendor/empty-seed layout after extraction. |
| `tests/*-preview.html` | Manual feature preview pages for Momo, Batch A, Validation Studio and wishlist tools. These are development previews, not extra live application pages. |
| [README.md](../README.md) | Setup, deployment, cloud saving and feature usage. |
| [BATCH-A.md](../BATCH-A.md), [WISHLIST.md](../WISHLIST.md), [VALIDATION-STUDIO.md](../VALIDATION-STUDIO.md) | Implemented feature instructions. |
| [BATCH-B.md](../BATCH-B.md), [BATCH-C.md](../BATCH-C.md), [docs/TNG-AND-LAB.md](TNG-AND-LAB.md), [BATCH-X.md](../BATCH-X.md) | Implemented Momo, ticket discovery, screenshot privacy/guide tools, TNG review/export and Lab playback; Batch X stores deferred ideas. |
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

- `solution-valuation.js`: pure S/V price, batch and split-valuation rules; historical run compatibility.
- `solution-valuation-ui.js` / `solution-valuation.css`: valuation controls, class context, stock ledgers and worked-example entry points.

Presentation breaks: [presentation-break.js](../presentation-break.js) owns custom audience messages, timestamp countdowns, screen selection and fullscreen fallback; [presentation-break.css](../presentation-break.css) supplies three lightweight landscape scenes. The shared Focus toolbar creates the launch button and supplies its existing tick and owner guard. No database writes or personal timer actions.

## Batch D presentation modules

- `presenter.js` / `presenter.css`: main-window private canvas, selected-display audience pop-up, verified audience handshake and native fullscreen status, transient laser, playback, hold/cover and presentation breaks.
- `presenter-window.html` / `presenter-window.js`: legacy private control shell retained for compatibility; new launches use the isolated audience page.
- `process-canvas.js` / `process-canvas.css`: private in-canvas tool bubbles, staged step forms, live multi-destination ports, magnetic groups, annotation attachment and guarded saved edits while playback continues.
- `process-workspace.css`: futuristic full-width Process Hub, floating inspector/step/connection drawers, enlarged draggable workspace and translucent playback dock; no audience-window or screen-placement changes.
- `process-canvas-art.js`: shared graph-space annotation SVG, geometry, resize/attachment and canvas export drawing; freehand pen strokes render as inert ink with no object handles.
- `process-shortcuts.js`: shared focus-scoped keyboard command matching and private shortcut guide for Process Hub and presenter controls; preserves typing/native text undo, bounds repeat handling and never controls presentation display placement.
- `presentation-screen.js`: explicitly selected display discovery/placement and fullscreen requests with current-account and disconnection guards.
- `audience-view.js` / `audience.css`: shared 16:9 public scene and preview renderer.
- `audience.html` / `audience.js`: isolated audience window; no account client or record storage.
- `rehearsal-engine.js` / `rehearsal.js`: named decision definitions, automatic defaults and interactive playback.
- `startup.js` and critical `index.html` styles: maintained branding, lightweight loading illustration, theme-matched drifting geometric patterns around the card, and actual startup stages. The surrounding patterns use two inline SVG layers, respect Smooth/mobile/motion-off preferences, and share the cover's hidden/error/finish lifecycle.
- `docs/BATCH-D-PRESENTING.md`: usage and verification notes for selections 4, 42, 97 and 209.

- `docs/VALIDATION-GROUPS-REVIEW.md` — SAP column groups, saved value sets and reversible per-run issue review.
- `tests/validator-groups.test.mjs` — group bindings, SAP values, copy/version isolation, ignored counts and Excel review exports.


Personal Notes: [notes-engine.js](../notes-engine.js) owns the bounded `workhub.notebook` document, notebook validation, stale-edit guards, text version history, search and escaped Markdown rendering. [notes.js](../notes.js) supplies the library, stable editor, save status, My Day Quick note action, project/company context, recoverable Trash and Markdown exports. [notes.css](../notes.css) provides theme-aware surfaces, responsive writing/focus views and reduced-motion-aware notebook/card animation. Load the engine before the UI and both before Studio. See [WORKSPACE-TOOLS.md](WORKSPACE-TOOLS.md#personal-notes).

Validation combinations: [validator-transform.js](../validator-transform.js) parses per-row grouped dependencies and positional lists. Independent Original vs Recombined: [validator-reconcile-engine.js](../validator-reconcile-engine.js) groups exploded File B by exact matching keys, compares comma values with original File A and produces the two-sheet report; [validator-reconcile.js](../validator-reconcile.js) owns the independent uploads, mapping, comparison and export UI. [validator-studio.js](../validator-studio.js) integrates the tab and keeps dataset-specific validation editor context. [validator-files.js](../validator-files.js) supplies local value readers, identifier preservation and workbook writing. See [VALIDATION-RECOMBINED.md](VALIDATION-RECOMBINED.md).

## Website experience additions

| File | Responsibility |
| --- | --- |
| `experience-appearance.js` | Validated account icon/loading preferences, bounded local image palette extraction, icon/favicon previews and finite navigation icon reactions. |
| `command-palette.js` | Grouped, escaped search results, record previews and keyboard selection; existing Studio handlers execute actions. |
| `file-launcher.js` | Compatible, permission-filtered local file destinations, file-drop handling and draft/ownership checks. |
| `summary-cards.js` | Explicit record selection, permission-aware snapshot model, canvas image preview/export and invalidation. |
| `kept-experience.css` | Theme-aware controls/dialogs, responsive previews and reduced-motion overrides. |

See [the usage guide](KEPT-EXPERIENCE.md). Integration remains in `studio.js`; startup styles are critical CSS in `index.html` with account-cache preference handling in `startup.js`. Existing tool APIs handle the actual imports.
