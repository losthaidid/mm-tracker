# Batch A

The 12 selected enhancements are integrated with the existing WorkHub. The proposed Project Health Dashboard is outside this batch.

| Enhancement | Where and how |
| --- | --- |
| Task dependencies and dependency types | Tasks → Work context → Dependencies. Link a prerequisite task, or name an approval, document or external event. Task prerequisites follow completion live; other types are explicitly marked ready. Loops and duplicate task prerequisites are rejected. A removed unfinished prerequisite stays blocked for review. |
| Work-session wrap-up | Stopwatch → Stop & save. Capture completed work or learning, the next step and remarks before saving active time. The existing overlap review and calendar options remain available. |
| Stale-work alerts | My day → Review work. Open tasks and tickets are flagged after the configured period without an update, initially 14 days. Set 0 in Work context settings to disable. Older records with no update date appear separately; their age is not guessed. Mark reviewed records the check without changing status or deadlines. |
| Pause reasons | Stopwatch → Pause, or a record's Edit context. Choose approval, missing information, blocker, break or other; keep notes and a next step. Pauses stay excluded from stopwatch time. |
| Personal glossary | Knowledge → Personal glossary. Search and maintain SAP terms, aliases, client abbreviations, meanings and optional project context. Removing a term offers Undo until another glossary removal, page closure or account change. |
| Resume work card | My day. A paused stopwatch and up to three recent open-work threads show the last wrap-up, pause context and next step. Continue opens the existing timer-start workflow; starting/resuming clears the active pause and carries the prior next step into the timer. |
| Task splitting | Tasks → Work context → Split into smaller tasks. Create 2–20 independent main tasks. Copy remarks, feedback, custom/project/ticket links, dates, priority, labels, environment and prerequisites. Retain the original and its existing subtasks; copied tasks start open without duplicated subtasks. |
| Cross-project labels | Record editors and Work context. Apply shared labels to tasks, tickets, project items, projects and Knowledge notes. Filter workspaces or browse a label's records across all projects from Work context settings. |
| Work-location overview | Schedule → Work locations. Choose a period to see location days and exact booked hours from Schedule, including stopwatch bookings. A mixed-location day can count under multiple locations; total days count once. Leave is excluded; unassigned bookings remain explicit. This reports scheduled work, not attendance or GPS location. |
| Environment labels | Optional DEV/QAS/PRD badges, system IDs and clients in record editors. Maintain the environment list in Settings → Work context & labels; use environment filters on the workspaces. |
| Task outcome types | A task editor or Edit context offers Implemented, Resolved by workaround, Duplicate and No longer needed, with notes. Completed cards show the chosen outcome or Set closure outcome. Completion and outcome are separate so historical work is not assigned an inferred result. |
| Reading mode | Read-only record drawers → Reading mode. Wider, quieter layout and larger text for descriptions, remarks and Knowledge notes; Exit reading mode restores the normal drawer. |

## Storage and compatibility

Definitions, record context, glossary terms and finished session wrap-ups use the existing account-owned JSON document and existing autosave, revision checks, merge rules, backups and RLS. No database migration, service, tracking, GPS permission or notification subscription is added.

Running stopwatch recovery remains local and account-scoped. Pause context for linked work is saved explicitly; clock ticks and UI filtering do not write to the cloud. Old backups upgrade deterministically with empty context and the three default environment names. Labels and environment details live alongside the base records so editing a task or ticket cannot discard them.

## Validation

Automated tests cover dependency graphs, missing prerequisites, independent task splitting, dated and undated stale work, exact location minutes, invalid context, record editor persistence, account changes, cloud reopen, backup restore, filters, glossary undo, reading mode, pause/wrap-up/resume, and the existing database save/RLS contract.

The public tests/batch-a-preview.html is a memory-only example of the production module, with the same Content Security Policy as the main page. It does not connect to an account and resets on reload.
