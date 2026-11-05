# Handover packs

Choose **Handover packs** in navigation. Give the pack a title, optional From/To names and a handover note. Filter and select Tasks, Tickets, Project items and Waiting-on records. Completed work is excluded initially; Include completed makes it available. Archived records are excluded. Source sections require export permission.

Main records and sub-items are separate selectable records. Each child captures its own title, feedback, owner and due date and retains its actual parent ID/title/identifier; it never inherits another child's values. Select all filtered selects every matching row across pages, up to 500 records, and preserves existing selections. It rejects an oversized selection instead of taking only part of it.

Optional fields: notes, feedback/latest ticket update, next steps/blockers and references. Next steps and active blockers come from the existing record context; the app does not invent or write back actions. Ticket history uses the latest parsed existing update. Other feedback is preserved in full. Dates and text identifiers are not converted to numbers.

**Preview Handover pack** creates a detached snapshot. Review 25 records at a time. Prepare PDF generates all selected records and reveals an explicit Download PDF link with wrapped, paginated Unicode text. There is a 1,000,000-character snapshot bound and 240-page PDF bound; exceeding either produces a clear error without a partial export or shortened fields. PDF pages are rendered locally as images; the result preserves visual text but is not a searchable or tagged text PDF.

Editing pack fields or selection requires a new preview. Editing live source work after preview does not change the frozen snapshot. No status, feedback or source data changes when selecting, previewing, downloading or saving a pack. Source access is checked again before exporting and saving to Drive; sign-out or account changes cancel pending work.

**Save to Drive & QR** uses the same generated PDF. If Google Drive is not connected, setup opens and the local download remains available; connect and save again. Recent saved packs appear in the side panel and Files. Every saved PDF is a new file/snapshot; existing links do not silently switch to newer work. Pack contents are stored only in Drive (or downloaded locally), not duplicated as a report in the workspace database.
