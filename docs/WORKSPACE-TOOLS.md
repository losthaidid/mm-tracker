# Work sessions, account reset and interactive workspace

## Task companies and website references

In **Tasks → Add task / Edit main task**, choose **Task type → Project**, then a **Linked project**. The optional **Company** dropdown contains active companies maintained for that linked project, even when another project is active in navigation. Leave it blank for project-wide work. Changing project or switching to Ticket/Custom clears the company selection. Existing inactive assignments remain visible and may be retained when editing; they cannot be assigned to a different task.

Maintain company availability through **Projects → Companies & processes → Edit company → Active for new task assignments**. Existing companies start active. Deactivating preserves the company, its history and existing task links. Deleting a company clears task company links; deleting a project preserves its tasks as Custom and clears their company selection.

Every task type supports **Website references**. Enter an optional label and a full `https://` or `http://` link, use **+ Add link** for more, and **Save record**. Up to 20 references are supported. Empty rows are ignored; labels without URLs and non-web URLs are rejected. Links appear on task cards and details and open in a separate tab. Companies and references participate in task search, backups, cloud reopening, and the Tasks sheet of Excel exports.

## Theme consistency

The saved or previewed palette controls interface surfaces, text, borders, inputs, cards, tables, dialogs and controls across Tickets, Tasks, Projects, Schedule, Knowledge, Waiting on, Studio, Lab, Validation Studio and Snippets. Shared feature palette aliases are in `theme-surfaces.css`, loaded after feature sheets and before `custom.css`. Primary-button and link foregrounds adjust for contrast, including custom dark palettes. Success, warning and error colours retain their meaning. Illustrated scenery, companion artwork, process diagram palettes and annotation/export colours remain intentional content colours.

## Start a work session

Use **Start timer** in the workspace toolbar. Completed/archived tasks, completed subtasks, and Closed/Completed tickets are excluded from new session choices. Starting a session also checks the current record, so a record completed after opening the form cannot be used accidentally.

Only **Project** sessions display **Charge code**. The dropdown uses unique nonempty codes from maintained projects and initially selects the linked project's code. Maintain codes through Settings → Project management → Edit project. Task, Ticket and Custom sessions hide the field and save no charge code. Historical sessions keep their original values.

**Stop & save** records completed work. Its Schedule booking shows **Completed** for all activity types. This remains true if the parent task is unfinished or the session history is later deleted. A manually planned task booking is Planned before its scheduled start, then stays In Progress while the linked task is unfinished—even after the time range ends or on later days. Completing the task updates its bookings to Completed; reopening it restores In Progress for started bookings. The calendar, agenda, time grid and activity details share this rule. These are display statuses: the clock does not change tasks, booking dates, durations or recorded work. Project and custom activities use the same Planned → In Progress rule and stay active after the scheduled end. Set Completed or On Hold through Edit activity; custom status is saved for every segment of that booking and retained in backups. Project calendar cards and project activity details use the same computed status as Schedule. The Review due count and planned-versus-actual review remain separate reminders for unfinished project plans. Leave retains its maintained approval status.

## Back up & clear all records

Settings → **Backups & sync** → **Back up & clear all records** opens the review. This feature never clears records just by opening it.

1. Stop and save an active work timer; finish synchronising any pending changes.
2. Download the complete JSON backup and confirm that the file is saved.
3. Review unfinished tickets and projects. Complete/close them first, or explicitly tick the additional confirmation to clear unfinished work too.
4. Type `CLEAR`, enter the current account password, and choose **Verify password & clear records**.

The backup uses the existing version 9 format and includes every cloud collection and saved cloud setting. The reset creates a fresh account document using the existing defaults: default lists and one empty starter project are regenerated. The login remains. Downloaded files and the device-only background-picture gallery are outside this cloud-record reset and remain on the device; the review explicitly states this.

Password verification uses a separate, nonpersistent Supabase client. It does not switch or sign out the main account. Passwords are cleared from the form and never enter records, backups, storage or logs. The operation requires an unchanged backup snapshot, matching account/generation, clean browser cache and matching remote revision. The existing revision-checked `save_mm_tracker` RPC replaces only the authenticated account's document. A failed/unconfirmed write requires Reload cloud records; the reset never auto-merges or queues a destructive retry. Cancel and Escape wait while the authorised request is running. No schema change or elevated key is used.

## Select multiple process steps

In the normal or full editor canvas, choose **Select steps**, then drag across empty canvas to draw a blue rectangle. Any intersecting step is selected. Use Shift, Ctrl or Command to add/toggle steps. **Select all**, or Ctrl/Command+A while the canvas is focused, selects the entire process. Escape clears selection. Drag a selected step or its handle to move the group while preserving spacing and connections. New-process drafts remain unsaved until **Save process**.

In Presenter controls, choose **Tools → Select / move** and drag across empty canvas. **Steps → Select all steps / Clear selection** are also available. Selected steps move as one saved canvas edit, with **Undo canvas edit** available. The blue box and selection outlines stay private; audience content and exports contain only the saved process.

## Presentation break controls

Pause/resume, fullscreen and return remain available as small, translucent circular controls in the bottom-left corner. Hover or keyboard focus makes them clearer. Each retains a descriptive accessible label and tooltip; touch targets remain 44 pixels on small screens. Countdown, scenery and window/fullscreen behaviour are unchanged.

## Companion wardrobe

Appearance → **Wardrobe → Automatic · morning, afternoon & night** changes clothes at 06:00, 12:00 and 19:00 using device local time. Morning and afternoon use different daytime outfits. Night rotates eight pajama designs and twelve colours, with a different design each night. The same night outfit continues after midnight until 06:00. Daily-surprise accessories are removed at night; explicitly chosen accessories remain. Fixed wardrobe and colour choices remain available. Outfit changes do not wake a requested nap, move the companion or write timer-driven cloud updates.

## Animated header

The logo contains an orbiting star, satellites, twinkles and a breathing halo. The maintained website title has a continuous letter wave and travelling light. Hover changes the motion; click or keyboard activation triggers a short burst and opens My day. Custom titles remain literal text and are preserved across renders. Motion uses bounded SVG/CSS layers, respects Animations Off and reduced motion, and pauses while the page is hidden or covered by a break/presentation.


## Process Hub keyboard controls and pen

Click the canvas or a Process Hub control, then press **?** (or **F1**) to open the shortcut guide. The canvas also has a **Shortcuts** button. In the private presenter, use the keyboard button in the playback dock or the Steps bubble. The audience view receives no controls.

- **V** selects; **H** explores/pans; **L** links steps; **I** opens step types; **E** edits a selected step or connection.
- **P** plays/pauses; **[ / ]** goes back/next; **R** restarts; **M** toggles sound.
- **F / 0** fits the canvas; **+ / =** zooms in; **−** zooms out.
- **Ctrl / ⌘ S** saves an open editor or full process draft; ordinary canvas edits continue to save automatically. **Ctrl / ⌘ Z** undoes a canvas edit. **Ctrl / ⌘ A** selects all steps. **Delete / Backspace** removes the selection with the existing step/link confirmation.
- Private presenter only: **B** pen, **A** arrow, **T** text, **G** laser.

Letter shortcuts do not run while typing in fields, and text selection/undo keep their native behavior. Shortcuts run only inside the active Process Hub or private presenter; they do not open windows, select a display or request fullscreen. Existing Space-drag panning, arrow-key movement, Escape cancellation, account guards and edit conflict checks remain in place.

The pen stays active across consecutive strokes. Ink has no selection box, resize handles, magnetic attachment or object dragging, and no entrance animation on redraw. Closed loops are retained. **Clear pen ink** removes only pen strokes, keeps arrows/text/steps, and can be undone. Ink remains visible to the audience and is retained in the saved process and PDF/image exports. Existing saved strokes remain compatible.
