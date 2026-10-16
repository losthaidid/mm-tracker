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
2. Deploy `index.html` with all referenced local JavaScript/CSS assets, the existing `supabase-client.js`, Excel template and `.nojekyll` through the repository’s current GitHub Pages deployment.
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

## Playful layouts, moving controls and your header

All tabs share the same warm, colourful visual system. A laptop uses a workspace sidebar; a phone uses compact scrolling navigation, stacked panels and touch-sized controls. Existing forms, reports and private records use the same workflows.

Choose **Settings → Edit header** to maintain the title and subtitle. The title also names the browser tab. These small settings save with the existing private account and are included in JSON backups. **Settings → Appearance & motion** opens Theme Studio, with palette swatches, a live preview and an explicit Save theme action. Changing the custom colour selects the Custom palette automatically.

Momo floats above the visible page and gently wanders around it. Movement pauses during typing, dialogs, dragging, presentation mode and when the page is hidden. Disable wandering in Appearance & motion, choose Animations Off, or use the device’s reduced-motion preference. Drag the companion anywhere on a phone or laptop; its chosen position is remembered on that device. It remains within the visible screen after resizing, rotation or a phone keyboard opening. A focused companion can also move using arrow keys. Its position and animation never trigger cloud uploads.

Privacy has a visible **Privacy is on** indicator and a **Show details** control. It blurs marked record titles, notes and descriptions; it is a visual screen-sharing aid, not a change to record permissions. Present removes navigation, editing controls and floating decorations from the current view. **Exit presentation** or Escape restores the normal workspace. These modes are local and do not change saved records.

Dashboard widgets and task-board cards have dotted drag handles. Hold and move a handle with a finger, mouse or pen; highlighted drop targets show where the item will go. Drop a widget over another widget to reorder it, or drop a task into a status column. Reordering saves once at the end of the gesture. Cancelling leaves records unchanged. Keyboard users can focus a handle and use up/down for widgets or left/right for task columns. The existing Move to selectors and widget buttons remain available.

## Work stopwatch

Start from the toolbar or a linked task, ticket or project item. Choose the linked activity (optionally a task's subtask), session title, charge code and remarks. A floating stopwatch stays visible as you navigate. Drag its dotted handle with a mouse or finger, or focus the handle and use arrow keys. Minimise it to a small clock and expand it when needed; its position and size preference are remembered on the device. The panel stays within the screen when the phone keyboard opens or the screen rotates. Pause/resume excludes breaks, and Notes lets you update remarks during work.

The running timer is stored locally per tracker account using timestamps, not second-by-second cloud uploads. Refreshing/reopening that browser recovers it. A running timer is local to that browser; completed session records sync to your other devices. Starting a second timer in the same browser is blocked until the first is stopped.

**Stop & save** records active intervals and creates minute-precision Schedule entries. Project sessions, including project-linked tasks, also create linked completed project-calendar activities in the same save. Exact seconds remain in the session record; calendar boundaries round outwards to minutes. Pauses produce separate intervals, and midnight crossings use the correct local dates. Stopping does not complete a linked task automatically.

If recorded time overlaps an existing booking, the timer stays paused and preserved. Adjust the finishing time or save the session for calendar review; existing bookings are never overwritten. **Studio → Work sessions** can schedule a review session after the conflict is resolved. Session IDs protect against duplicate saves.

Work sessions opens on **Active**, with **Archived** and **All** views. Archive a finished session to tidy the active list, or restore it whenever needed. Archive state syncs between devices. **Delete** asks for confirmation and offers **Undo deletion** until the next deletion or account change. Archiving or deleting a session preserves its existing Schedule and Project activities. Archived sessions remain in Excel's time history, marked in the **Record** column; deleted sessions leave that history.

The Tickets tab starts with **Pending** selected. Choose **All statuses** or another status whenever needed; the selected filter remains while navigating within the current page.

## Automatic device syncing

Opening the tracker reads the latest cloud record. Returning to the page, reconnecting and visible-page checks (every 20 seconds) refresh clean copies automatically. Background checks read only revision metadata unless records have changed. Read-only details close when newer records replace them; editable modal drafts defer the refresh until the editor closes. Project/month navigation does not create record uploads.

A saved baseline allows independent edits to combine conservatively. Same-field edits, delete-versus-edit conflicts, invalid merged schedules and unknown older pending queues remain protected for review. An acknowledged queue identical to cloud records is cleared automatically. Another browser tab's pending recovery queue is not overwritten. Backup and explicit Reload cloud records remain available for genuine conflicts.

All animations, sounds, countdowns, theme previews, simulator calculations and growing-workspace decorations run in the browser. Supabase stores the compact text, numbers, layout settings, reminder dates and finished session records inside the existing private document. There are no media uploads or additional paid services. Full JSON Backup/Restore includes workspace records. Excel reports provide readable summaries and detail sheets, including stopwatch-created Schedule activities and completed work sessions.

## Remind me in

Tickets, main tasks and the selected project have a **Remind me in…** button. Choose 1, 3, 7, 14 or 30 days, enter a custom number, or select a date. An optional note explains what to revisit. The date and note sync with the private tracker account and are included in JSON backups; original statuses, deadlines and child records are preserved.

Future-snoozed tickets and tasks leave the active list and board and remain accessible in a collapsible **Snoozed** section. Use **Open**, **Change date**, or **Bring back now** there. Snoozing a project sets its reminder independently; the project remains selectable, and its tasks and tickets keep their own reminders.

On the selected local calendar date, the item returns to its normal view with **Time to revisit**. **My Day** lists due reminders, the toolbar opens the reminder inbox, and Momo gives a small notification. Dismiss a reminder or set another date. Day changes are checked while WorkHub is visible and when returning to it; editable dialogs defer the refresh. This is an in-website reminder feature, with no WhatsApp, email, push service or closed-browser notification.

## A more expressive Momo

Momo is a local vector character with soft dimensional shading and glossy eyes that look toward the pointer. Dragging picks him up; placing him down gives a small landing bounce. Tap him to open play controls: give a pat, toss or put away a ball, invite him to an empty part of the workspace, find a visible card to perch on, rest at home, wake up, place his home, or show a little umbrella. He moves away when the perched card is used.

Drag the ball with a finger or mouse to toss it again. Escape closes play controls and puts the ball away; the menu also offers **Put ball away** on phones. Home position is remembered on that device. Expressions, gaze, play and home placement do not trigger cloud saves. Animations Off and reduced-motion settings stop animated travel and gaze movement; normal tracker controls remain usable.

Momo also grins, winks, blushes, sticks out his tongue, sneezes and occasionally trips over an imaginary pixel before recovering. Little funny speech bubbles appear occasionally (normally 2–5 minutes apart) while the page is visible and you are not typing, editing, playing or focusing. They are text bubbles, without audio or network calls. Tap Momo for **Tell me something silly** or **Quiet time**; the quiet preference stays on that device. Reduced motion and Animations Off disable automatic antics and chatter.

## Readable Excel reports

**Export Excel report** opens options for an activity period, a recent-closure window (30 days by default), and an optional archive of older closed tickets. Current statuses are a snapshot of the saved records; the activity period filters Schedule, work sessions and dated project activities. This is a report, not a full JSON backup.

The Dashboard uses formula-linked figures and native charts. Its ticket workload and main Tickets sheet exclude older dated closures. Closed tickets without any usable date remain visible. New closures record a stable closing date automatically; reopening clears it. Older records use their last-update date when no closing date exists, so that date is an approximation. Including the archive adds **Closed archive** and **Archive updates**, without changing the main ticket figures.

Detail sheets use plain labels and names, frozen headings, filters, status colours, typed dates and numeric Excel durations. Long ticket history lives in **Ticket updates**; milestone names and states live in **Ticket milestones**. **Tasks** groups subtasks under main tasks, with their remarks and feedback in **Task notes**. **Projects**, **Project items** and **Project notes** explain project progress, sub-item remarks, companies, processes and decisions. **Schedule**, **Work sessions**, **Follow-ups** and **Reminders** cover time and outstanding actions.

Adjacent hourly pieces from one booking are combined into a readable activity row while breaks and dates remain separate. Exact work-session seconds remain available. Duration totals and Dashboard figures recalculate in Excel. Long notes continue onto additional rows rather than being truncated or duplicating time totals. Landscape print areas, repeated headings, links back to Dashboard and collapsible child rows support review and printing.

The export uses the required OOXML worksheet-property order (`tabColor`, `outlinePr`, `pageSetUpPr`), correcting an Excel repair/corruption warning. Export a new copy to get the corrected file; previously downloaded files are unchanged. Export checks cover the actual download form, ZIP contents, worksheet ordering and package relationships.

## Floating YouTube corner

Choose **♫ Music corner** in the workspace toolbar, **Open my music corner** in Momo's menu, or the music command in Search & commands. The default floating view contains only the video screen, approximately 200 pixels tall, plus a small external drag/menu/close pill. The title banner, empty stage, search results and favourites no longer occupy the floating window. Choose **⋯** for search, favourites, settings and Minimise. These controls open separately and return to the video after a selection. The video stays open as you change tracker tabs. Drag its dotted handle or use arrow keys on the focused handle. Phone layouts fit the visible screen and keep the separate search dialog usable with a keyboard. Minimise or close pauses and unloads the player; expanding cues the selection without autoplay. Hidden pages, Privacy, presentation and editing dialogs also pause playback.

Paste an official YouTube, YouTube Music, Shorts, live-video or playlist link to play without a search key. The player uses YouTube's own visible controls, with a minimum 200 × 200 video area. An **Open YouTube** link is available for videos that disallow embedding, sign-in requirements or playback problems. WorkHub does not connect a Premium account; account benefits and availability are controlled by YouTube.

Song/video results inside the panel use the official YouTube Data API. In **Settings → YouTube search settings**, add your own browser API key after enabling **YouTube Data API v3** in Google Cloud. Restrict the key to **Websites**, allowing `https://losthaidid.github.io` and `https://losthaidid.github.io/*`, and restrict its API access to YouTube Data API v3. Browser referrer policies can omit the path, so use the GitHub Pages origin restrictions rather than only `/mm-tracker/`. Without a key, the search box offers an explicitly labelled **Search on YouTube** link; paste your chosen link back to play. No scraping or third-party search proxy is used. Google controls the daily API quota. Search is submitted explicitly; results are cached in memory for five minutes, with no requests on each keystroke.

Save and name up to 60 video/playlist shortcuts under **Your favourites**. Favourites, the search key and player position stay on the current browser/device, independently of tracker records. They do not sync through Supabase, enter JSON backups, or get committed to GitHub. Search keys are sent only to Google's official API. Remove the key through Search settings. Result metadata is kept only in memory; favourite labels are user-maintained shortcut names.

Momo sits beside the compact video with little headphones; on narrow phones, the seat moves above or below when there is room. While playback is active, Momo randomly switches between watching and a short dance. Pausing or finishing a video ends the dance. Typing, Focus, reduced motion, disabled wandering and hidden/present modes suppress automatic dancing or docking as appropriate. Drag Momo away to give him space; he waits before returning. Music interactions and animation never upload to Supabase. The seat stays outside the video, and Momo’s speech bubble is hidden there so the screen remains clear.

References: [IFrame Player API](https://developers.google.com/youtube/iframe_api_reference), [search.list](https://developers.google.com/youtube/v3/docs/search/list), [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies), [browser API-key restrictions](https://docs.cloud.google.com/docs/authentication/api-keys).

## Development checks

Run `npm ci` followed by `npm test`. The tests exercise the app in a DOM environment and execute the original schema plus compatibility migration in a local PostgreSQL runtime. They cover area maintenance, imports, browser recovery, offline retries, cross-device and cross-tab conflicts, form drafts, knowledge and process editing, follow-ups, task board state, dashboard/theme settings, stopwatch recovery and timezone boundaries, exports, preserved records, idempotent saves, and owner-only access. No production records are used by these tests.

## Dependencies

The client is @supabase/supabase-js 2.117.2, bundled with esbuild 0.28.2. Exact package versions and lockfile are included. Rebuild the vendor bundle with `npm ci` and `npx esbuild cloud-entry.js --bundle --minify --platform=browser --target=es2020 --outfile=supabase-client.js`.

The browser bundle also includes JSZip 3.10.1 under the MIT license to read selected `.xlsx` and `.xlsm` mapping files locally. `cloud-schema.sql` defines the private-record schema for a fresh project; existing projects use the compatibility migration above.

GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
Supabase redirect URLs: https://supabase.com/docs/guides/auth/redirect-urls
