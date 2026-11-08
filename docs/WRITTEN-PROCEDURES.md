# Written procedures in Process Hub

Open **Process Hub → Written procedures** to keep ordinary instructions such as handling a CR Form. **Animated processes** keeps the existing canvas, playback and saved graphs.

## Create and read

1. Choose **New procedure**, or **Start with a CR Form example**.
2. Fill in the name, purpose, category, responsible role, version label and prerequisites.
3. Maintain ordered steps. Each step can include instructions, a responsible role, an expected outcome, a checklist and an HTTP(S) reference link. Expand **Role, outcome, checklist & reference** for these optional fields.
4. Use the up/down buttons to reorder steps, then choose **Save procedure**. The normal account save/sync indicator applies.
5. Search the library by name, purpose, category, responsible role or step title. A category selector narrows it further. Saved procedures also appear in Search & commands.

The CR Form example is editable guidance, not an organisation-specific approval policy. Adapt it before use. Starting an example creates an unsaved draft; it does not add a procedure until saved.

In a guide, use the numbered index to jump to a step. Checklist ticks and **I have reviewed this step** update a personal reading-progress bar for this visit only. They do not edit the saved instructions or serve as approval/audit records. Reset clears them; signing out or changing accounts also clears them.

## Maintain the library

**Edit procedure** changes the saved instructions. **Duplicate** creates an independent copy with new record and step IDs. **Archive** hides a guide from the active library; choose **Archived procedures** to open and restore it. Archived guides can be deleted with confirmation. **Undo deletion** restores the most recently deleted guide during the current visit. **Download Markdown** exports the guide's maintained instructions and unchecked checklists.

A draft is retained in memory while changing sections. Explicit discard actions ask before losing changed text, and closing the page warns about unsaved edits. Drafts are not persisted until Save; account changes clear them. A conflicting saved version blocks replacement and keeps the local draft for review.

## Compatibility and access

Records use the existing private account document at `workhub.processes`, distinguished by `kind: 'procedure'`. They participate in the existing save, conflict handling, JSON backup and restore paths. There is no database migration, new service, dependency or automatic document upload. Written records are excluded from animated playback and graph exports; full-account backups retain them.

Existing Process Hub View, Create, Edit, Delete and Export permissions apply separately. Restricted users do not receive broader access from the new sub-tab. Account/permission checks run again when an action occurs and after awaited confirmations.

The new styles use the current theme tokens. Effects are a brief entrance, small card lift, step accents and progress transitions. No continuous animation loop is introduced. Animations Off and reduced motion suppress these effects. The reader and editor adapt to narrower screens.

Limits: 200 written procedures, 100 steps each, 30 checklist items per step, with a bounded total text budget of 2 MB. Existing animated-process limits remain separate.

## Validation

`tests/procedures.test.mjs` checks record bounds, links, example independence, Markdown and separation from legacy animated processes. The `Written procedures:` integration cases in `tests/app.test.mjs` check real form submission, account saves/reopen/backup, reordering, unchanged animated records, permission splits, stale drafts, account switches, reading progress, library operations and downloads. Desktop and 390 px browser checks use an isolated synthetic account. Proof images are in `docs/screenshots/written-procedures*.jpg`.
