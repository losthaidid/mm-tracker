# MM Tracker

Tickets, tasks, projects, scheduling, reporting, and private cloud saving.

## Edit and learn

Start with the [beginner editing guide](docs/EDITING-GUIDE.md) and [complete file map](docs/FILE-MAP.md). The page shell is `index.html`, the core application is `app.js`, the original shared styles are `base.css`, and `custom.css` is your space for personal style changes. Each handwritten source file now explains its purpose in a header comment. See [source cleanup notes](docs/SOURCE-CLEANUP.md) for the removed duplicates and retained compatibility helpers.

Developer commands: `npm ci`, `npm test`, `npm run format:check`. Use `npm run format` to apply formatting.

The selected Batch A workflow enhancements are documented in [BATCH-A.md](BATCH-A.md), including dependencies, wrap-ups, resume context, labels, environment badges, glossary, reading mode and work-location totals.

The seven selected wishlist items and refreshed ticket screens are documented in [WISHLIST.md](WISHLIST.md), including snippets, bundles, timelines, reusable fields, reference combinations, reference descriptions and copy formats.

Ticket **History tracker** automatically appends an entry when progress remarks are added or changed: `Awaiting user confirmation [20-10-2026 08:38]`. Entries contain the remark, local date and time, without a label or bullet prefix. Status/milestone changes alone do not append history or refresh its timestamp, and unchanged remarks are not repeated. Manual updates use the same format. Previously saved history remains available; status changes are still recorded separately in the Work timeline.

The TNG statement extractor and automatically looping Troubleshooting Lab results are documented in [the TNG and playback guide](docs/TNG-AND-LAB.md). The next Momo behaviour improvements are kept separately in [Batch B](BATCH-B.md); they are not included in this release.

## Publish using GitHub Pages

1. Create a repository named `mm-tracker`. GitHub Pages on a free personal account requires a public repository.
2. Upload the repository's root HTML, JavaScript and CSS files, the `vendor/` and `assets/` folders, the Excel template, `THIRD-PARTY-LICENSES.txt`, and `.nojekyll`. Keep their relative filenames and commit the files.
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

Do not upload backups, Excel reports, or the original record-filled HTML to GitHub. This package starts empty and contains no original work records, including inside generated reports.

## Storage

Row Level Security restricts records to their owner. The website contains only a publishable key. Revision checks and idempotent retries prevent overwriting newer records from another device. If records conflict, download a backup before choosing Reload cloud records.

If a Free plan project pauses after inactivity, restore it in your Supabase dashboard. Hosting limits and costs follow your GitHub and Supabase account plans. Supabase’s Free plan currently includes a 500 MB database and can pause after one week of inactivity: https://supabase.com/pricing. This change does not require enabling paid features.

## Update an existing installation

1. In the existing Supabase project’s SQL Editor, run `supabase/migrations/20261015140424_workspace_studio_records.sql` once. This only broadens the document-format constraint; it preserves all rows, ownership policies, revisions, and the save function. It can be reapplied safely.
2. Deploy `index.html`, `app.js`, `base.css`, `custom.css`, `vendor/` and all referenced local JavaScript/CSS assets, the existing `supabase-client.js`, Excel template and `.nojekyll` through the repository’s current GitHub Pages deployment.
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
- **Tasks → Board view:** To do, In progress, Blocked and Done columns. Drag cards on a laptop or use **Move to** on a phone. Main titles, links, subtasks, remarks and feedback are retained. Use **Complete** beside a subtask in the list or board Details to finish it directly. Marking the main task Completed, including moving its card to Done, completes all its subtasks in the same save. Reopening a main task keeps completed subtasks completed; individual subtask statuses can still be changed with Edit.
- **Knowledge:** maintain searchable issue/cause/solution notes, T-codes, tags, configuration paths, common errors and testing checklists. Link a note to a project, ticket or project item. Details open in a drawer; notes can be copied. Deleted notes, processes and follow-ups support Undo until the next deletion or account change.
- **Process Hub:** create, edit, archive and reorder processes and their steps. Each step supports T-codes, prerequisites, usage/configuration notes, errors, tests and links to knowledge or existing records. Select multiple next steps for a branch. **Walk through** follows connections, pauses at a branch, and stops at a cycle. An optional procurement example is editable; confirm it against your own SAP version and company rules.
- **Waiting on:** record a person/team, follow-up date, related project and notes. Mark something Received, reopen it later, or delete and Undo. Due follow-ups appear on My day.
- **Studio → Theme studio:** live-preview palettes, custom accent, fonts, card corners, backgrounds, density and animation intensity. Save to sync your compact settings, or export/import a small theme JSON. Optional sound is off initially; reduced-motion device preferences are respected. The local SVG companion Momo has glasses, helmet and party accessories.
- **Studio → Document simulator:** enter sample PO, receipt and invoice quantities/prices. The browser calculates values, quantity differences and illustrative price-tolerance results. Only saved numeric inputs go to Supabase. This is an explainer, not SAP posting or a substitute for configured matching/blocking rules.
- **Studio:** a focus timer with a custom 1–1,440 minute duration, editable milestone scrapbook, project journey, daily wrap-up and recorded work sessions. Project phase changes add small scrapbook keepsakes. Decorations grow with completed tasks without streak penalties. Celebrations can be replayed.
- **Search & commands:** find loaded records and navigate quickly; Ctrl/Cmd+K opens it. Quick add opens common creation flows. Privacy blurs marked descriptions; presentation mode hides decorative controls, with an explicit exit button or Escape.

## Playful layouts, moving controls and your header

All tabs share the same warm, colourful visual system. A laptop uses a workspace sidebar; a phone uses compact scrolling navigation, stacked panels and touch-sized controls. Existing forms, reports and private records use the same workflows.

Choose **Settings → Edit header** to maintain the title and subtitle. The title also names the browser tab. These small settings save with the existing private account and are included in JSON backups. **Settings → Appearance & motion** opens Theme Studio, with palette swatches, a live preview and an explicit Save theme action. Changing the custom colour selects the Custom palette automatically.

Momo floats above the visible page and gently wanders around it. Movement pauses during typing, dialogs, dragging, presentation mode and when the page is hidden. Disable wandering in Appearance & motion, choose Animations Off, or use the device’s reduced-motion preference. Drag the companion anywhere on a phone or laptop; its chosen position is remembered on that device. It remains within the visible screen after resizing, rotation or a phone keyboard opening. A focused companion can also move using arrow keys. Its position and animation never trigger cloud uploads.

Privacy has a visible **Privacy is on** indicator and a **Show details** control. It blurs marked record titles, notes and descriptions; it is a visual screen-sharing aid, not a change to record permissions. Present removes navigation, editing controls and floating decorations from the current view. **Exit presentation** or Escape restores the normal workspace. These modes are local and do not change saved records.

Dashboard widgets and task-board cards have dotted drag handles. Hold and move a handle with a finger, mouse or pen; highlighted drop targets show where the item will go. Drop a widget over another widget to reorder it, or drop a task into a status column. Reordering saves once at the end of the gesture. Cancelling leaves records unchanged. Keyboard users can focus a handle and use up/down for widgets or left/right for task columns. The existing Move to selectors and widget buttons remain available.

## Atmosphere and tiny visitors

Open **Settings → Atmosphere & visitors**. By default the scenery follows the device's local clock: morning light from 05:00, afternoon glow from 11:00, evening warmth from 17:00, and starlight from 20:00 until 05:00. Choose a fixed scene or turn the atmosphere off. Soft colour in the page margins and header preserves the chosen theme, readable record cards, and the existing My day background image. A small illustrated window appears in the laptop sidebar; phones show a compact atmosphere label in the header instead. Optional rain is visual only, without sound, location access or a weather service.

Tiny visitors arrive occasionally: a butterfly in the morning, a bird in the afternoon, or a firefly in the evening and at night. Choose **Save & meet a visitor** to invite one immediately. Tap a visitor for a little hello from Momo; Escape lets it fly away. Only one appears at a time, landing away from visible controls and floating tools. If there is no room, it waits. A keyboard-focused visitor stays still until you greet it or leave it.

Visitors and moving weather pause during typing, dialogs, Focus, Privacy, presentation, dragging and hidden pages. The device's reduced-motion setting and Theme Studio's Animations Off keep scenery still and disable visitors. Choices are remembered separately on each device, shared with other tracker tabs in that browser, and excluded from Supabase records, theme exports and backups. Scenery, visitor movement and greetings make no network requests or cloud writes. Existing tracker and YouTube behavior is unchanged.

## Custom Focus timer

Open **Studio → Focus room** or add the **Focus timer** widget to My day. Set **Duration (minutes)** before starting; the last used length is remembered on that device. While running, edit **Total length (minutes)** and choose **Update length**. This changes the total session length while keeping elapsed time; if the new total has already elapsed, the session finishes immediately. **End focus** ends it early. The countdown and its duration setting are local and do not save a work session or write to Supabase.

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

Tickets, main tasks and the selected project have a **Remind me in…** button. Choose a precise **Date** and **Time**, or use **In 15 minutes**, **In 1 hour**, **In 2 hours**, **End of day** or **Tomorrow · 09:00**. Set **My end-of-day time** to suit your day; that preference stays on the current device. If today's end-of-day time has passed, the preset selects tomorrow. The preview shows the exact date/time before saving. The original day presets and custom number of days remain under **Choose a number of days instead**.

Write what you want to do in the reminder note. The item stays visible by default. Select **Hide this item until the reminder is due** to set it aside; hidden tickets/tasks leave the active list and board but remain in **Snoozed**. Existing date-only reminders keep their original date and snooze behaviour. A project reminder remains independent of its tasks and tickets. The reminder's fixed instant and note sync through the existing account and JSON backups; other devices show the same moment in their local timezone. Original statuses and deadlines stay unchanged.

When due, a small **Your reminder is due** panel shows the item and your note. Open it, snooze **15 minutes** or **1 hour**, or **Dismiss reminder**. Dismissing clears the reminder, not the task. **Hide alert** quiets that alert on the current device while the reminder stays in the inbox; opening the inbox also acknowledges the visible alert. Due reminders remain in **My Day** and the toolbar's **Reminders** inbox. Missed reminders appear when you return. The alert waits during editing/dialogs, Privacy, presentation and hidden pages, and does not steal focus. Visible-page checks run every five seconds without cloud writes; browser/phone suspension can delay them.

WorkHub does not send push notifications while closed. For an upcoming timed reminder, choose **Reminders → Add to calendar**. Open the downloaded `.ics` file in your calendar and confirm its alert settings. It contains the selected instant and a display alarm, but delivery depends on that calendar and your device settings. This is a separate calendar copy: rescheduling or dismissing in WorkHub does not automatically update or remove it. Calendar files are generated locally; no calendar account connection or external message is created by the website.

## A more expressive Momo

Momo is a local vector character with soft dimensional shading and glossy eyes that look toward the pointer. Dragging picks him up; placing him down gives a small landing bounce. Tap him to open play controls: give a pat, toss or put away a ball, invite him to an empty part of the workspace, find a visible card to perch on, rest at home, wake up, place his home, or show a little umbrella. He moves away when the perched card is used.

Drag the ball with a finger or mouse to toss it again. Escape closes play controls and puts the ball away; the menu also offers **Put ball away** on phones. Home position is remembered on that device. Expressions, gaze, play and home placement do not trigger cloud saves. Animations Off and reduced-motion settings stop animated travel and gaze movement; normal tracker controls remain usable.

Momo also grins, winks, blushes, sticks out his tongue, sneezes and occasionally trips over an imaginary pixel before recovering. Little funny speech bubbles appear occasionally (normally 2–5 minutes apart) while the page is visible and you are not typing, editing, playing or focusing. They are text bubbles, without audio or network calls. Tap Momo for **Tell me something silly** or **Quiet time**; the quiet preference stays on that device. Reduced motion and Animations Off disable automatic antics and chatter.

## Quick status updates, previews and Schedule colours

Tap a status badge on a ticket, task, project item or child item to change its status without opening the full editor. Completing a main task completes its subtasks in the same save; reopening it keeps the children's existing statuses. Ticket filters and closure dates follow the updated status.

Hover over an underlined record title on a laptop, or hold it briefly on a phone, for a compact preview with the latest notes and context. Keyboard users can focus an underlined title and press Enter. Open the record or change its status from the preview. Escape, scrolling or Privacy closes the preview. Holding a title does not also open it when released, and moving a finger to scroll cancels the hold.

Project bookings now show the maintained **activity title** in Schedule. The month, agenda and time grid use the same colours: tasks are amber, tickets and ticket-linked tasks are rose, and project work uses a separate colour for each maintained work location. The colour legend names each location. Other activities have their own colour; existing status labels remain visible. Ticket stopwatch entries retain their ticket colour after deleting the finished session record.

## SAP troubleshooting lab

The **Troubleshooting lab** is now a magnetic investigation workshop. The illustrated paper-and-copper workspace includes a draggable circuit board, an experiment notebook and a **What we ruled out** shelf. **Board / Notes** switches between the canvas and a stacked reading view. Each case maintains its business process, symptoms, expected and actual results, system, T-codes/message IDs and optional project/ticket links.

Drag cards by **Move**, scroll to pan and use the zoom controls or **Start** to return to the issue. Keyboard users press Enter on Move, use arrows (Shift for larger steps), then Enter to place or Escape to cancel. Only the final placement saves; moving, panning, zooming and animation frames do not upload records. Phones also have **Details** and **Connect to…** controls and the Notes view. View and zoom choices stay on the current device.

Add an experiment with an action and expected result. **Record result** requires an observed result/evidence. Successful experiments snap into an available space and connect to the issue or another successful source; a short electric pulse follows powered paths. Branches are allowed and loops are rejected. An inconclusive result has a dotted connection and cannot power downstream work. Failed attempts remain movable on the board and are also listed on the ruled-out shelf with their observations intact, disconnecting their outgoing links. **Try another approach** creates a separate experiment while keeping the failed evidence.

Brief local sparks and smoke accompany a failure; Momo startles, covers his eyes and peeks out again. Success brings a little celebration, inconclusive results a magnifying glass, and resolution a Verified stamp. Device reduced motion, Animations Off, Privacy and presentation are respected; there is no rapid flashing or extra sound. These effects use CSS/SVG, without downloaded videos or cloud animation writes.

Successful and failed experiment cards now keep repeating their gentle result animations, with current travelling along powered connections. Saved results, including resolved cases, start automatically when their investigation opens. **Live results** provides Pause/Resume, Stop and 0.5×–2× speed. Reopening the investigation starts playback again. These loops never rerun experiments or save records. They pause for dialogs, dragging, hidden pages, Privacy/presentation and motion preferences; Momo's brief reaction to a newly recorded result remains separate.

**Resolve & save** opens an evidence review with connected successful steps and the failed-attempt count. Maintain the confirmed cause, verified fix and verification, then confirm the review. Saving resolves the case and creates or updates its single linked Knowledge note in the same private save. The note includes the process, expected/actual behaviour, resolution, verification and investigation trail, and has a **Return to investigation board** link. Editing a case to Solved also saves its Knowledge note. Reopen a solved case before running more experiments; the previously published Knowledge snapshot remains available until republishing.

Delete a whole investigation from its header or an individual experiment from its Details drawer (failed cards also offer Delete on the shelf). Confirmation names the item and explains the effect. Deleting an experiment removes its connections; deleting one from a solved case reopens the case for review. Linked Knowledge notes are kept. **Undo Lab deletion** in the workspace toolbar restores the last deleted Lab item until the next Lab deletion, page closure or account change. Undo preserves existing later edits and restores connections only when they remain valid. Archiving/restoring cases is still available.

Existing case IDs, outcomes, timestamps, notes and Knowledge links are retained when upgrading. Historical attempts receive positions but no inferred connections. Cards, positions, links and results save in the existing private Supabase document and JSON Backup/Restore; no new schema or service is required.

Search cases by process, symptoms or T-code, filter Investigating/Testing/Solved, or archive and restore older investigations. The lab records your investigation and observed results; it does not connect to SAP or automatically diagnose errors.

## Your local soundscape

Choose **Settings → Your soundscape** to mix synthesized rain, café murmur, forest breeze and fireplace textures. Use a preset or adjust each channel, overall volume and mute. **Play soundscape** starts audio explicitly. A small floating control can pause it or reopen the mixer; changing tracker tabs does not restart it. There are no audio downloads, API keys or cloud uploads. The mix and volume are remembered on the current device; reopening the website waits for Play. Playback stops on sign-out and page closure. The tracker does not pause these sounds when hidden, though the browser or operating system can suspend background audio.

## Momo’s little moments

Tap Momo for **Tiny theatre**, **Desk discoveries** or **Little moment settings**. Settings also contains **Momo’s little moments**, with switches for each automatic behaviour and a choice of three performances to try immediately.

- **Tiny theatre:** a paperclip knight, a plant interview and a lunchbox mystery, each with original SVG props and a short three-part performance. Occasional automatic shows wait until you are not editing, focusing, presenting or playing with Momo. Quiet time pauses automatic shows. Reduced motion offers a still performance when requested.
- **Desk discoveries:** Momo occasionally leaves a little envelope linking a task or ticket to its related Knowledge note, matching a lab case's T-code/message ID to your notes, or pointing out a blocked task. Suggestions explain the record link and open the actual source. Snoozed work is excluded. With no matching records, Momo does not invent a discovery or change any records.
- **Visitor meetings:** a butterfly can tickle Momo’s nose, a bird can become a very chirpy hat, and a firefly can meet a tiny lantern. These replace normal wandering briefly and keep clear of visible controls. Visitors can also continue to land elsewhere in the workspace.

Scenes, props, matching, timing and preferences run locally without AI services, media uploads or Supabase animation writes. Automatic moments pause during typing, dialogs, Focus, Privacy, presentation, hidden pages and reduced motion. Their switches are remembered on each device.

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

## Living workspace update

Card drops preserve the existing Lab canvas and scroll position rather than replaying the page entrance. Successful and inconclusive cards pull toward eligible successful sources; failed or incompatible magnets visibly repel. Final placements avoid overlaps. **Arrange** lays out existing cards beside one another. Sparks and three smoke puffs render above the viewport, outside clipped cards, then clean themselves up. Reduced motion and privacy settings still apply.

The little window has independent cloud layers, sun rays, a moon halo, twinkling stars, glass reflections and a swaying tree. Automatic sun/moon positions follow the device clock; manual atmosphere scenes keep an appropriate position. A compact window also appears in the phone header. Everything is SVG/CSS, with no weather service or cloud writes.

Momo can sit on a little cushion, cover a yawn, wave, look around, tap a foot and stretch. The face, hands and feet animate independently. Short gestures happen occasionally while the workspace is idle; tap Momo for **Show me a little move** or **Sit with me**. Typing, dialogs, Lab dragging, Focus, Privacy, hidden pages and reduced motion pause these gestures. Quiet time pauses speech, while Momo can still move.

**Studio → Theme studio** adds Lavender, Rose garden, Lagoon and Honey palettes, eight new patterns, and custom page/card/text/secondary colours alongside the accent. Save up to 12 named combinations, apply or delete them, or use theme export/import. Colours and patterns save in the existing private account document and follow the account across devices. A same-named combination replaces its earlier version. Custom card text is adjusted to maintain contrast with its surface.

Project items and their sub-items capture the local date when their status changes. Full editors and quick status updates allow another date. The **Status date** button shows the transition history and corrects the current date without adding a false transition. Older records retain unknown dates until maintained; importing or restoring a backup does not invent historical changes.

Project sub-items now offer **Track time** next to Edit and Delete. The start form preselects the project, main item and sub-item; the floating timer shows their context. Pause, Resume, remarks, recovery and Stop & save work as for other work sessions. Saved sessions keep stable item/sub-item links and title snapshots in the recorded-session list, Schedule and project calendar. Item and sub-item cards show total recorded time and session count, including archived sessions. Conflicting calendar entries still open a review rather than overwriting existing bookings. This uses the existing private JSON document, without a database migration.

## Leave, presentations and a quieter workspace

**Schedule → Add date / time range → Schedule type** includes **Annual Leave** and **Medical Leave**. Choose a full day (09:00–18:00), morning (09:00–13:00), afternoon (14:00–18:00), or custom hours; adjust them for your own workday. Maintain a calendar title, Planned/Requested/Approved status, covering colleague, request reference and handover notes. Multi-day bookings repeat the daily hours and retain overlap protection. Leave has distinct Schedule colours and stays separate from project work and TOIL. It is included as leave in the Excel Schedule sheet.

Medical Leave asks **Have you submitted the MC to HR?** Selecting Yes requires its submission date. The booking’s display view shows either the date submitted or Not yet submitted. This stores a status and date, without uploading the certificate. Changes save in the existing private account document, and JSON backups preserve the fields. Older non-leave bookings are unchanged.

**Process Hub → Walk through** opens a presentation window. The outline, previous/next controls and arrow/Page Up/Page Down keys move through maintained steps. T-codes, prerequisites, configuration, notes, common errors and testing details appear on the slides. Branches offer an explicit choice; unlinked steps continue in maintained order. Optional auto-play supports 5/8/12/20-second slides, pauses at branches and loops, and stops on hidden pages or when the presentation closes. Escape exits. Presentation state stays local and does not change process records.

Settings opens on pointer hover and closes with a short animation after leaving. Touch uses tap, and keyboard navigation and Escape remain available. The header now uses a compact cloud icon: green tick for saved, a pulsing upload arrow for saving, and distinct warning/offline states. Hover or focus reveals the status. Screen readers and Settings retain a readable label; recovery banners and actions remain visible when needed.

Drag Momo’s house with a mouse or finger, or focus it and use arrow keys (Shift for larger moves). Tap still sends Momo home or wakes Momo. Cancelled drags return to their earlier position. The house stays inside the visible viewport and remembers its position on that device; the previous home placement is migrated locally.

**Your soundscape → Lo-fi study → Play soundscape** blends original mellow keys, warm bass and soft drums with the ambient channels. **Paper lanterns** (72 BPM) and **Blue hour** (66 BPM) are synthesized as short stereo loops after Play, with a separate music volume slider. Track and mix choices stay on the device; reloading never starts playback automatically. A single audio buffer loops independently of animation timers and is released on Pause/sign-out. No YouTube integration, subscription, API key, media downloads or Supabase audio storage is used.

The scenery now hides the entire inactive sun/moon group, so animated opacity cannot reveal both. Sun and moon gently bob, and the sun rays rotate. Animations Off, reduced motion and hidden-page pausing still apply.


## Floating Focus mode

Use **Focus mode** beside **Reminders** to open a small floating panel while continuing to work on the page underneath. Choose a task or focus freely, set 1–1,440 minutes and start. It shares the timer with **Studio → Focus room**, including duration updates. Pause/resume preserves elapsed time; **End** finishes the timer. Drag the header or use arrow keys while the move handle is focused. Position is clamped to the visible screen and remembered on this device. Minimise or hide the panel to clear space; the timer continues and the toolbar opens it again. The panel hides during dialogs, privacy/presentation mode and when the page is hidden. Signing out or changing accounts clears the active Focus session.

Choose **Soundscape** for a saved mix or Rainy desk, Café corner, Forest walk, By the fire and Lo-fi study. Press Play to listen, adjust volume or mute, and use **Fine-tune your mix** for full settings. Choose **Music Corner** to play a saved favourite or paste a YouTube video/playlist link; **Search & favourites** opens the existing music controls. The video stays in the visible Music Corner and requires pressing Play there. Switching sources stops the other source; **Stop audio** stops both. Opening Focus mode starts neither the timer nor audio automatically. Timer and media controls do not save tracker records or replace the current page's unsaved forms.

## Momo’s world and adventures

Tap Momo for **Soccer surprise**, **A speedy lap**, **Look out the window**, **A tiny tug**, **Meet a visitor**, **A work nudge**, **Change my name**, and **Adventure settings**. Naming saves in the existing account preferences and JSON backup. The greeting uses your Theme studio name, with Haidid as the default, and waits for a clear workspace before waving once each page opening. Forty varied little chats and eighteen finite idle gestures add small moments between work.

Momo can chase a visitor across the viewport, sprint, watch the window, or tug an inert visual copy of a visible section. Stretching changes neither the live section’s controls nor its records. Scrolling preserves the visitor and any chase; using a form, Focus, privacy/presentation mode, Escape or a hidden page stops active adventures. Pointer interaction yields immediately. The umbrella reserves room above and beside Momo, holds its canopy steady and uses slower steps inside the visible viewport.

**Atmosphere & visitors** offers eight landscapes (valley, coast, town, mountains, forest, lake, garden and snowy village) and eight storybook weathers (sunshine, clouds, rain, snow, mist, breeze, rainbow and aurora). Choose a favourite or leave scenery and weather on random rotation. This is imaginary scenery, with no weather API. Fourteen new original vector visitors join the butterfly, bird and firefly: bee, ladybird, dragonfly, moth, hummingbird, owl, bat, duck, sparrow, squirrel, rabbit, fox, turtle and cat. The visitor selector lets you meet a specific one.

**Soccer surprise** asks for 1–50 kicks, counts each one, then reveals a balloon parade, paper wishes, rainbow, trophy, flowers, moon, duck referees or bubble galaxy. The eight finales use a shuffled bag, with no repeat until all have appeared, plus varying colours. Momo may offer a trick in a bubble; the count form opens only when chosen. Escape or the stage close button stops the show.

Work nudges use loaded open tasks, tickets, project items and projects, with a button to open the source record. Completed, archived and snoozed work is skipped, including work under a snoozed or completed project. These are on-page nudges while the website is open. Adventure switches, scenery/weather, visitor choices and surprise order stay on the device; only an explicit name change saves account data. Quiet time pauses automatic speech and invitations. Animations Off and reduced motion keep moving adventures still; the opening greeting can remain as text.

## On-site mileage and monthly expenses

**Settings → On-site locations & mileage** maintains each site’s name, optional route/address, one-way kilometres, RM rate per kilometre, and default one-way/return journey. Add, edit, archive or restore locations. Archive hides a location from new visits while preserving historical bookings. Names are unique; distances support two decimal places and rates support four.

In **Schedule → Add date / time range**, choose an on-site location in **Location & mileage**. Its mapping fills the distance, rate and journey. Adjust these for the booking, set visits per date, or exclude mileage from the claim. The preview shows the daily calculation and the selected date-range estimate. Mileage is counted once per booking/date, independently of hourly segments. Cross-month ranges contribute to each date’s month. A warning identifies another mileage booking for the same site and date; exclude it if both bookings represent the same visit.

Saved bookings retain a snapshot of their location name, distance and rate. Editing a mapping does not reprice existing claims. **Use latest mapping** explicitly replaces the draft’s saved mapping before saving. Project-calendar date/time edits preserve mileage on the same work location; changing the work location clears it. Leave bookings have no mileage.

Schedule’s monthly header shows the **claimable estimate**, split into mileage, TnG/tolls and other expenses, for the selected month in both calendar and time-grid views. Future scheduled mileage is included as planned travel. **Tolls & other expenses** records date, category, amount, description, payment method, optional site, receipt/TnG reference, notes and claimable status. Categories include tolls, parking, public transport, meals, accommodation and other costs. Add a receipt directly from an on-site booking’s display view to retain its visit link. Receipts remain recorded if that activity is deleted. Expense deletion has an Undo action; excluded costs remain visible and do not contribute to the claimable total.

**Review / export** opens daily mileage and expense details. **Download monthly CSV** exports all entries and the claimable total for that month, with numeric RM amounts and formula-like text neutralised for spreadsheet use. The currency is MYR (RM). Amounts total in integer sen, with mileage rounded per booking/date. Routes, mileage snapshots and expenses use the existing private account document, autosave through the normal workflow and are included in JSON backups; no database migration, mapping API or new service is required.

## Company email recipients

Open **Settings → Company email recipients**, or use **Email recipients** in **Projects → Companies & processes** or **Snippets**. Each company has a reusable address list with optional notes. The selected project company’s shortcut opens the matching list by name or prefills a new one; email lists remain independent of project company records and are shared across projects in your account.

Add or edit recipients with an optional person/team name, email address, To/Cc/Bcc group and inclusion switch. **Paste a list** accepts semicolons, commas or new lines, including `Name <email@company.com>` and quoted names containing commas. Duplicate addresses within the same company are skipped during bulk entry without changing their saved groups or switches. A malformed bulk entry prevents the entire addition, preserving the draft for correction. Addresses may be reused in different companies. Limits are 200 companies, 500 recipients per company and 5,000 recipients overall.

Choose **All**, **To**, **Cc** or **Bcc**, then copy the enabled addresses with semicolons (Outlook), commas or one per line. Each company row also has a direct **Copy** button for all its enabled addresses. Copies contain plain email addresses; **All** combines all groups, so copy groups separately when populating distinct email fields. Search filters the displayed records without changing the copy scope. If clipboard access is unavailable or denied, the preview selects the addresses for manual copying. No email is sent.

Company lists and recipients can be removed and restored with **Undo removal**. Removing a company list asks for confirmation and leaves its project company records untouched. The directory uses the existing account autosave, conflict handling and JSON backups; no database migration or new service is required. Sign-out closes the directory and invalidates an open editor. Browsing, searching and copying create no account writes. The layout adapts to smaller screens and the existing theme, privacy and reduced-motion settings.

## Grouped Settings

**Settings** now shows one section at a time: **Workspace** (header, appearance and screen visibility), **Work setup** (projects, SAP MM areas, built-in lists, charge codes, mileage locations and company email recipients), **Companion & sound** (companion adventures, moments, scenery, soundscape and Music Corner), **Backups & sync**, and **Account**. Each action has a short description. The saved/sync status stays visible above the sections.

**Find a setting** searches all sections, including aliases such as “email”, “KM”, “theme” and “backup”. Clearing search returns to the selected section. The sections appear beside the options on larger screens and as a scrollable horizontal row on phones. Arrow keys, Home and End navigate sections; Escape closes Settings and returns focus to its launcher. Changing sections and clearing search keep the menu open. Existing action buttons and their handlers are retained, including account/recovery visibility, hover/touch opening and automatic closing when an action is selected. Grouping, searching and navigation do not save account records.
