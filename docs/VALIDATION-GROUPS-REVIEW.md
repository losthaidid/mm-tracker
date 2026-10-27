# Column groups and issue review

## SAP column groups

1. Choose a SAP template (or choose SAP in Columns). Define its technical columns and SAP types first.
2. Open Column groups → New column group, name it, and select related fields such as VKORG, VTWEG and SPART.
3. Name the first value set (for example FPSO setup). Enter FPSO for VKORG, 60,50 for VTWEG and 00 for SPART. Apply group changes.
4. Choose Duplicate as new set to preserve that setup. Rename the copy and change only its grouped values. Apply group changes.
5. Open Conditions. For equality/comparison or list checks, choose Value source → Saved column group, then select its group and value set. The selected condition field must belong to the group.
6. For example: WHEN VKORG equals the FPSO setup value, THEN VTWEG is in the FPSO setup list. A separate condition can choose a different saved set. Save draft, or Publish version when ready.

Use this set in a condition creates an unconditional list check for the first grouped field; finish its WHEN and THEN fields in the normal condition builder. Conditions use one grouped field's values at a time. A group is not a joined reference-row lookup: use References → combination matching when allowed values depend on a specific multi-column tuple.

The shared column Allowed values list and all other checks still apply. Leave a conflicting global allowed list blank if company/set-specific values differ. Company scope remains independent: only applicable company conditions run. Each saved set supports a comma/newline list, retains leading zeros, and is checked against the field's configured SAP data type. Up to 40 groups, 30 sets per group and 200 existing fields per group are supported within the workspace's existing 6 MB definition limit.

Removing a group/set or grouped field used by a condition is blocked until that condition is updated. Renaming a column rewires its group keys. Published definitions remain immutable; editing a draft does not change older releases. Condition/template copies keep independent definitions. JSON definition export/import and normal backups retain groups; the data-upload Excel template includes a readable group/value-set guide. Existing simple/advanced Excel setup imports continue unchanged.

## Ignore selected issues

After validation, select issue checkboxes in What needs attention, optionally enter a reason, and choose Ignore selected. Select this page selects up to 100 listed issues; paging preserves selections. All issues shown by the engine remain selectable up to its existing 15,000-issue display cap. Unlisted/truncated errors still count and cannot be silently ignored.

Ignored issues move to Ignored issues and stop contributing to unresolved error/warning totals. Restore an individual issue or Restore all to undo the review. An otherwise acceptable row with ignored issues is labelled Accepted · ignored issues rather than Passed. Accepted Excel exports include those rows plus a separate Ignored issues sheet with their reason; issue reports retain both unresolved and ignored issues. Source values and rule definitions never change when ignoring.

Reviews apply only to this in-memory validation run. Editing any field restores ignored checks on that row, because its context changed. A new upload/run, remapping, different company/version/template, changed definition or account switch clears decisions. Only numeric review counts and review timestamp are saved on the existing run summary. Uploaded values, row snapshots and ignore reasons are not stored in the database. Normal live corrections remain local and do not add per-keystroke cloud writes.

## Editing without resetting the workspace

Columns, Conditions, Column groups, References and Validate update their existing controls in place. SAP type/format changes, adding clauses, switching value sets, mapping changes, Apply and Save preserve unaffected fields, caret/focus, open panels and scroll positions. Copy-dialog filters also update inside the existing dialog. Reference imports keep their review inputs; file selectors reset after reading so the same file can be chosen again. New reference still explicitly clears a new-reference draft.

The main application's ordinary save render uses the same Studio update path. Switching to a different template or account creates a fresh workspace, and invalid/stale saves remain guarded by the existing schema, company, published-version and account checks. Draft values are preserved locally rather than written on every keystroke.
