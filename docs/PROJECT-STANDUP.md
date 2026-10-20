# Project stand-up summary

Open **Projects → Overview → Daily stand-up**. Each project has its own card. The report shows all of that project's items and sub-items, their actual statuses and their complete remarks, grouped by their parent item. All groups start expanded; use **Expand all / Collapse all** to change the reading view.

The progress strip shows item/sub-item totals and combined status counts. Completion percentages are separate for project items and sub-items, so a completed child does not automatically mark its parent complete. Testing, Development, UAT and Pending Review count as in progress; blocked/on-hold statuses remain visibly separate.

## Actions

Use **Add action** on either a main item or a sub-item. Enter the instruction, optionally choose a due date, and save. The same document mutation creates both the Action and one ordinary Project task in **To do**. Task remarks and feedback remain available for task-specific notes. Multiple Actions can belong to the same item.

- **Edit** changes the same task title and due date, preserving its status, completion, archive state, remarks, feedback and sub-tasks.
- **Open task** opens its normal task details. **Open in project summary** returns to the source item.
- Task title edits also update the saved Action text. Status, due date and completion badges read directly from the task.
- Completing a task does not complete the project item or sub-item.
- Cancelling a draft creates nothing. Concurrent task title/due-date edits are checked before saving.
- Deleting a task retains its instruction as **Task removed**; **Recreate task** explicitly creates a new linked task. A task removed while its Action editor is open is not silently recreated.
- Removing the originating item/project preserves ordinary tasks through the existing deletion flow. Missing source links are labelled rather than pointing at another record.

## Update times

Times display in **Asia/Kuala_Lumpur (MYT)**. New item/sub-item status, title and remark changes are recorded through the existing save preparation hook. Remark update times are retained separately if a later status change occurs. Previously recorded sub-item update times remain readable; older records without a known time say **Update time not recorded**. Updates over 14 days old have a subtle age label. Opening or collapsing the report does not create timestamps or save records.

## Source and persistence

- `project-standup-engine.js`: validation, totals, update tracking and atomic Action/task creation.
- `project-standup.js`: Overview card, report, Actions forms and task source links.
- `project-standup.css`: report/card layout, phone view and reduced-motion rules.
- `workhub.projectStandup`: version 1, `actions` and `updates` arrays in the existing private document. Linked tasks remain in the ordinary `tasks` array. Backup/restore and conflict merging preserve both.

No database schema, authentication, dependency or hosting change is required. At most 5,000 Actions and 10,000 tracked item/sub-item update records are accepted, within the existing document size limit. Report drafts stay in the open form, and account changes close the report and reject stale forms.
