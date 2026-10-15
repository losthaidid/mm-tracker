# MM Tracker

Tickets, tasks, projects, scheduling, reporting, and private cloud saving.

## Publish using GitHub Pages

1. Create a repository named `mm-tracker`. GitHub Pages on a free personal account requires a public repository.
2. Upload `index.html`, `supabase-client.js`, `THIRD-PARTY-LICENSES.txt`, and `.nojekyll` to its root. Commit the files.
3. Open Settings → Pages. Choose Deploy from a branch, main, and /(root). Save.
4. Use the published website address displayed by GitHub Pages.

No terminal or build tools are needed to use the tracker.

## Cloud login

The website is configured for the Supabase project identified in `index.html`. Create a tracker login in the website and confirm your email, then sign in. The database must have the compatible private-record schema described below. Signing in to the Supabase dashboard does not create a tracker login.

In Supabase Authentication → URL Configuration, set Site URL to the published website address and add that address to Redirect URLs. This makes confirmation emails return to the website. If a default confirmation redirect cannot open, return to the tracker and sign in after confirming the email.

Changes save automatically to Supabase. The header and Settings show **Saving to Supabase…**, **Saved to Supabase**, or a warning. Wait for **Saved to Supabase** before closing. The same tracker login on another device opens the same records. Each browser keeps a private recovery copy and pending uploads. Clearing browser storage before an upload finishes can lose unsaved changes.

Settings also contains Account, Charge codes, Project management, editable built-in lists, screen visibility, Backup, Restore, Retry/refresh, Reload cloud records, and Sign out. Restore and Reload cloud records require the current account email and password. Activity deletion requires the current password; credentials are verified by Supabase Auth and are not stored in tracker data.

Tasks can be linked to a project, ticket, or custom reference. Scheduling supports 00:00–24:00 entry with minute precision, status colours, configurable work locations, and automatic weekend TOIL identification. Project governance includes editable phase-specific acceptance criteria, gate skipping, Go-Live countdowns, project health, and planned-versus-actual confirmation.

Use **Companies & processes → Upload company / process Excel** to import Organization Structure, Master Data, Inventory Management, and Procurement mappings. The preview can add companies, departments, organization/master-data items, BPML processes, and decision states together. Re-importing the same code or item creates a new proposal version. The workbook stays in the browser; only normalized rows and source metadata are saved online. Project items can select an imported company and record expected and due dates.

## Bring in existing records once

If earlier records remain under this website’s browser storage key, signing in shows an **Earlier records are still in this browser** notice. For an empty cloud account, choose **Import browser records**, review the destination account, and confirm the import. The original browser records are retained. An existing cloud account is never replaced automatically.

If the records came from a different website address or browser, click Backup in your previous tracker. Sign in here and use Restore to select that JSON backup. Future visits open your cloud records automatically.

Do not upload backups, Excel reports, or the original record-filled HTML to GitHub. This package starts empty and contains no original work records, including inside its report template.

## Storage

Row Level Security restricts records to their owner. The website contains only a publishable key. Revision checks and idempotent retries prevent overwriting newer records from another device. If records conflict, download a backup before choosing Reload cloud records.

If a Free plan project pauses after inactivity, restore it in your Supabase dashboard. Hosting limits and costs follow your GitHub and Supabase account plans. Supabase’s Free plan currently includes a 500 MB database and can pause after one week of inactivity: https://supabase.com/pricing. This change does not require enabling paid features.

## Update an existing installation

1. In the existing Supabase project’s SQL Editor, run `supabase/migrations/20261015140424_workspace_studio_records.sql` once. This only broadens the document-format constraint; it preserves all rows, ownership policies, revisions, and the save function. It can be reapplied safely.
2. Deploy the updated `index.html` alongside the existing `supabase-client.js`, Excel template and `.nojekyll` through the repository’s current GitHub Pages deployment.
3. Sign in to the tracker. Make an edit, wait for **Saved to Supabase**, and reopen it using the same tracker account on another device.

The previous checked-in SQL accepted only document versions 1–4, while the previous website wrote version 6. The current migration accepts versions 1–9. The updated app writes version 9 so older pages cannot discard workspace features, sub-task details or precise schedule times. It can restore older backups, including versions 6, 7 and 8. Do not run `cloud-schema.sql` on an initialized database; that file is for a fresh installation.

## Maintain SAP MM areas

Open **SAP Projects → Companies & processes → Manage SAP MM areas**, or **Settings → SAP MM areas**. Area settings belong to the active project and apply to all its companies.

- Add and rename areas, use the arrows to change order, and select **Show** to control sidebar visibility.
- Hiding an area keeps its mappings in cloud records, backups, imports, and reports. All areas can be hidden and shown again later.
- Renaming an area updates its process mappings and matching implementation decisions. Previous names remain accepted in Excel imports.
- Remove is available for unused areas. An area with process mappings must be hidden instead, preserving the records.
- The Add/Edit process dropdown and Excel import preview use the maintained areas, including custom areas such as Invoice Verification.

Click **Save areas** to apply changes. They use the same Supabase autosave and revision protection as the rest of the tracker.

## Sub-items and sub-tasks

Project sub-items have their own Remarks field under **Sub-items → Add/Edit sub-item**. Existing sub-items start with blank remarks.

The Tasks tab displays each main title with its own sub-tasks. Use **Add sub-task** to maintain an individual title, status, remarks, and feedback. Updates belong only to that sub-task. Editing or archiving a main task preserves its children. Main-task completion remains a separate control. Search includes sub-task titles and notes. The formatted Excel report includes individual child rows with the main title and each child’s notes.

## Schedule viewing and precise times

Select a booking to view its dates, exact times, duration, linked task/project and notes. Choose **Edit activity** to make changes. Go-Live milestones in Schedule also open in display mode before editing. Empty grid cells and **Plan this day** create a new booking.

Enter start and end times to the minute, such as **09:15–10:45**. Quick-duration buttons offer 15, 30, 45, 60 and 90 minutes. For an end at midnight, select **End at midnight (24:00)**. A date range repeats the same daily time range. Adjacent bookings are allowed; overlapping intervals are blocked. Durations, weekend TOIL, project calendar syncing and Excel times retain minute precision. The time-grid view shows one week from 00:00–24:00.

Tickets have a new card layout with a Table option, and Tasks use a main-task/sub-task layout. These styles are scoped to Tickets, Tasks and Schedule; the Projects layout is retained.

## Your refreshed workspace

The existing Tickets, Tasks, Schedule and Projects remain available alongside **My day**, **Knowledge**, **Process Hub**, **Waiting on** and **Studio**. The visual refresh covers all tabs and adapts to phone screens. Existing project, task, ticket and schedule records are preserved.

- **My day:** personal greeting, today's schedule, next actions, follow-ups, daily achievements, project journey and a decorative growing workspace. Use **Arrange dashboard** to add/remove widgets; drag widgets or use their arrow buttons to reorder them. The size control switches a widget between one and two columns. Phone layouts use one column.
- **Tasks → Board view:** To do, In progress, Blocked and Done columns. Drag cards on a laptop or use **Move to** on a phone. Main titles, links, subtasks, remarks and feedback are retained. Completing the main card remains separate from completing its subtasks.
- **Knowledge:** maintain searchable issue/cause/solution notes, T-codes, tags, configuration paths, common errors and testing checklists. Link a note to a project, ticket or project item. Details open in a drawer; notes can be copied. Deleted notes, processes and follow-ups support Undo until the next deletion or account change.
- **Process Hub:** create, edit, archive and reorder processes and their steps. Each step supports T-codes, prerequisites, usage/configuration notes, errors, tests and links to knowledge or existing records. Select multiple next steps for a branch. **Walk through** follows connections, pauses at a branch, and stops at a cycle. An optional procurement example is editable; confirm it against your own SAP version and company rules.
- **Waiting on:** record a person/team, follow-up date, related project and notes. Mark something Received, reopen it later, or delete and Undo. Due follow-ups appear on My day.
- **Studio → Theme studio:** live-preview palettes, custom accent, fonts, card corners, backgrounds, density and animation intensity. Save to sync your compact settings, or export/import a small theme JSON. Optional sound is off initially; reduced-motion device preferences are respected. The local SVG companion Momo has glasses, helmet and party accessories.
- **Studio → Document simulator:** enter sample PO, receipt and invoice quantities/prices. The browser calculates values, quantity differences and illustrative price-tolerance results. Only saved numeric inputs go to Supabase. This is an explainer, not SAP posting or a substitute for configured matching/blocking rules.
- **Studio:** focus timer, editable milestone scrapbook, project journey, daily wrap-up and recorded work sessions. Project phase changes add small scrapbook keepsakes. Decorations grow with completed tasks without streak penalties. Celebrations can be replayed.
- **Search & commands:** find loaded records and navigate quickly; Ctrl/Cmd+K opens it. Quick add opens common creation flows. Privacy blurs marked descriptions; presentation mode hides decorative controls, with an explicit exit button or Escape.

## Work stopwatch

Start from the toolbar or a linked task, ticket or project item. Choose the linked activity (optionally a task's subtask), session title, charge code and remarks. A floating stopwatch stays visible as you navigate. Pause/resume excludes breaks, and Notes lets you update remarks during work.

The running timer is stored locally per tracker account using timestamps, not second-by-second cloud uploads. Refreshing/reopening that browser recovers it. A running timer is local to that browser; completed session records sync to your other devices. Starting a second timer in the same browser is blocked until the first is stopped.

**Stop & save** records active intervals and creates minute-precision Schedule entries. Project sessions, including project-linked tasks, also create linked completed project-calendar activities in the same save. Exact seconds remain in the session record; calendar boundaries round outwards to minutes. Pauses produce separate intervals, and midnight crossings use the correct local dates. Stopping does not complete a linked task automatically.

If recorded time overlaps an existing booking, the timer stays paused and preserved. Adjust the finishing time or save the session for calendar review; existing bookings are never overwritten. **Studio → Work sessions** can schedule a review session after the conflict is resolved. Session IDs protect against duplicate saves.

## Automatic device syncing

Opening the tracker reads the latest cloud record. Returning to the page, reconnecting and visible-page checks (every 20 seconds) refresh clean copies automatically. Background checks read only revision metadata unless records have changed. Read-only details close when newer records replace them; editable modal drafts defer the refresh until the editor closes. Project/month navigation does not create record uploads.

A saved baseline allows independent edits to combine conservatively. Same-field edits, delete-versus-edit conflicts, invalid merged schedules and unknown older pending queues remain protected for review. An acknowledged queue identical to cloud records is cleared automatically. Another browser tab's pending recovery queue is not overwritten. Backup and explicit Reload cloud records remain available for genuine conflicts.

All animations, sounds, countdowns, theme previews, simulator calculations and growing-workspace decorations run in the browser. Supabase stores the compact text, numbers, layout settings and finished session records inside the existing private document. There are no media uploads or additional paid services. Full JSON Backup/Restore includes the new workspace records; the existing Excel report retains its original sheets, including stopwatch-created Schedule and project-calendar activities.

## Development checks

Run `npm ci` followed by `npm test`. The tests exercise the app in a DOM environment and execute the original schema plus compatibility migration in a local PostgreSQL runtime. They cover area maintenance, imports, browser recovery, offline retries, cross-device and cross-tab conflicts, form drafts, knowledge and process editing, follow-ups, task board state, dashboard/theme settings, stopwatch recovery and timezone boundaries, exports, preserved records, idempotent saves, and owner-only access. No production records are used by these tests.

## Dependencies

The client is @supabase/supabase-js 2.117.2, bundled with esbuild 0.28.2. Exact package versions and lockfile are included. Rebuild the vendor bundle with `npm ci` and `npx esbuild cloud-entry.js --bundle --minify --platform=browser --target=es2020 --outfile=supabase-client.js`.

The browser bundle also includes JSZip 3.10.1 under the MIT license to read selected `.xlsx` and `.xlsm` mapping files locally. `cloud-schema.sql` defines the private-record schema for a fresh project; existing projects use the compatibility migration above.

GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
