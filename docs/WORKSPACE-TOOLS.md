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

**Daily Schedule execution is separate from record progress.** Bookings automatically move Planned → Active → Actual according to their daily time range. Without tracked changes, Actual is labelled **From plan**: it assumes the plan was followed and does not create tracked hours. Completing or reopening a task, ticket, or project does not rewrite daily execution. Leave retains its maintained approval status.

Use **Start / switch work** in Schedule or **Switch work** on the floating timer when the day changes. An active interruption pauses the original booking; stopping it records Actual and resumes the remaining planned slot. A partial interruption produces Partial after the planned range; a replacement covering the whole range produces Changed. A matching running timer stays Active beyond the planned end. Pauses are excluded from tracked work. Start timer also opens the switch flow when another timer exists. Moving or deleting a planned activity retains a Moved/Cancelled history snapshot.

For unmaintained tickets/projects, choose **Record source → Unlisted work · maintain later**. Enter an activity title, plus optional project/ticket name, company and reference. Stop & save records the session alongside the original plan without requiring a parent record. Later use **Link / maintain** in Actual work to attach it to an existing record or create one from the captured details. Project company choices belong to the chosen project; linking sets its maintained charge code. Linking preserves timestamps, duration and original execution identity and does not complete the parent record or duplicate time.

**I switched earlier** captures a past work interval and recalculates affected bookings. Overlap with other actual work or a running timer is rejected; plans may overlap actuals because they are separate layers. Actual cards appear in month/agenda, weekly time grid and the related project calendar; project Work history totals tracked sessions. Archived sessions remain included. Deleting a modern session retains its Schedule history and allows later linking; undo restores the latest retained references.

Project navigation now says **Current project / Set current**. It selects the project being viewed, not its delivery status. Multiple projects can be ongoing; only one personal work timer runs at a time in the current browser account.

See [DAY-SCHEDULE.md](DAY-SCHEDULE.md) for examples and verification notes.

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

### Schedule selection and validation review

Schedule's Task picker excludes Done and archived tasks from new choices while retaining earlier bookings. Company supports multiple selections with search, Select all and Clear; a project booking stays within its project's active companies, and project item choices follow the selected companies. Each booking keeps one duration and one visit regardless of company count. Office hides/disables on-site claims immediately and saving Office removes hidden mileage values.

Validation Studio supports selecting individual issues or a page of issues and choosing **Ignore selected**, with an optional reason. Ignored issues are counted separately, can be restored, and are documented in issue and accepted-row Excel exports. Uploaded cell values and issue details remain in browser memory; only review counts are added to the saved run summary. Editing a row restores its checks, and a new upload, run, mapping, company, version or account starts fresh.

For SAP templates, **Column groups** maintains related fields and named value sets. **Duplicate as new set** keeps the old values. In Conditions, choose **Value source → Saved column group**, then the group and value set. Each condition chooses its own set; shared column checks and company scope still apply. Group values follow the maintained SAP field types and preserve leading zeros. Published versions stay frozen; JSON definition/backup and template copies retain all groups, while condition copies bring independent groups and value sets. Downloaded data templates include a readable Column groups sheet. See [Validation groups and issue review](VALIDATION-GROUPS-REVIEW.md).

Validation Studio editors now update in place across Columns, Conditions, Column groups, References, Validate and copy options. Changing SAP types, applying edits or saving a draft preserves the current controls, open panels, focus and scroll. Unapplied reference/paste text survives ordinary redraws, and selecting another template/account resets the workspace. Existing Apply, Save draft and Publish version actions keep their normal save behavior.
