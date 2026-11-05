# Handover packs

Choose **Handover packs** in navigation. Give the pack a title, optional From/To names and a handover note. Filter and select Tasks, Tickets, Project items and Waiting-on records. Completed work is excluded initially; **Include completed** makes it available. Archived records are excluded. Each source requires export permission.

Main records and sub-items are separate selections. Each child captures its own title, notes, feedback, owner, due date and recorded time. Its real parent identifier/title stays alongside it. It never inherits a sibling's information or the parent's notes. Selecting a child alone shows the parent label for identification without exporting unselected parent content. **Select all filtered** covers all matching pages, up to 500 records, while retaining existing selections. Oversized selections are rejected rather than partly selected.

## Pack contents

The preview and PDF use the same sections and fields:

- **At a glance:** selected record counts, open/finished counts, status breakdown, overdue count, From/To and the handover note.
- **Needs attention:** recorded overdue dates, blocked/on-hold work, High/Critical/Urgent priority and unresolved prerequisites. A record can have several reasons but appears once.
- **Next actions:** recorded actions, owners/PICs and due dates. Missing owners are reported; the pack recipient is not assigned as an owner.
- **Work records:** parent/sub-item groups, status, priority, owner, project/company, related work, dates, source sub-item progress, notes, full feedback, full ticket update history, project status history, record-specific fields, prerequisites and references.
- **Recorded work:** saved sessions matched to the exact parent or child, active duration, dates and each session's own notes/wrap-up. Parent totals exclude child sessions. Running timers and unrelated project sessions are excluded.

Summary counts describe selected records. A parent's progress explicitly describes all of that parent's source sub-items, including sub-items not selected for the pack. Values are not inferred or shortened. Identifiers such as 001 and 6.00007 remain text.

Choose **Detailed** for more spacing and section separation or **Compact** for a denser layout. Both retain all included content. Checkboxes control record notes, full feedback/update history, record details/dates/progress, saved sessions, next steps/blockers and references. Saved sessions include their own wrap-up notes; deselect Saved work sessions to exclude them. Optional field exclusions apply equally to preview and PDF.

Project/company context, linked ticket details, workflow context and saved sessions are included only when the corresponding sources may be exported. Those permissions are checked again before export; revoking access invalidates the captured preview.

## Preview and export

**Preview Handover pack** creates a detached snapshot. The redesigned object-page preview includes a section navigator and up to 10 complete parent groups per preview page. Groups are kept together, with main records before their selected children. The PDF contains every selected group regardless of the preview page.

**Prepare PDF** generates a Fiori-inspired cover, summary, attention/action lists and grouped record sections. Download appears as an explicit **Download PDF** link when preparation succeeds. Unicode text wraps across pages. There is a 1,000,000-character snapshot bound and 240-page PDF bound; exceeding either produces an error without a partial export or shortened fields. Pages are rendered locally as images, preserving visual text; the PDF is not searchable or tagged.

Editing pack fields, layout, checkboxes or selection requires a fresh preview. Later edits to source work do not alter the captured snapshot. Selecting, previewing and exporting never change source statuses, owners, notes or feedback. Sign-out or account/permission changes cancel pending work.

**Save to Drive & QR** uses the same generated PDF. If Drive is not connected, setup opens and local download remains available; connect and save again. Recent saved packs appear in the side panel and Files. Each PDF is a separate dated snapshot; existing files and QR links are not rewritten. Pack contents are stored in Drive or downloaded locally, not duplicated in the workspace database.
