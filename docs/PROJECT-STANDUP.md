# Project stand-up summary

Open **Projects → Overview → Daily stand-up**. Each project has its own card. The report shows all of that project's items and sub-items, their actual statuses and their complete remarks, grouped by their parent item. All groups start expanded; use **Expand all / Collapse all** to change the reading view.

The progress strip shows item/sub-item totals and combined status counts. Completion percentages are separate for project items and sub-items, so a completed child does not automatically mark its parent complete. Testing, Development, UAT and Pending Review count as in progress; blocked/on-hold statuses remain visibly separate.

## Search

Use **Find an item or update** to filter as you type. Search matches item IDs, names, types, statuses and remarks, plus linked Action text, task status and due dates. Matching ignores case, treats punctuation literally and requires every word to occur in the same item or sub-item context; a parent's ID/name also supplies context for its sub-items. Actions use the current linked task text; a removed task retains its saved instruction.

Matching item groups open automatically, with their complete remarks and sub-items retained for context. Matching text is highlighted, matching sub-items are tinted, and a live count shows the matching groups and sub-items. Progress totals always describe the whole project. **Clear** restores the full report and the groups you had collapsed before searching. Expand/collapse controls affect the currently visible groups.

Search does not save records or create database requests. The query survives report refreshes and Action saves, then resets when you open a report again or switch accounts/projects. Filtering leaves unsaved Action forms in place; clear the search to return to a draft hidden by the filter.

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
