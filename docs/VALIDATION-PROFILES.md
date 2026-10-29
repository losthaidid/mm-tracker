# Choose checks for a validation run

Open an existing template → **Validate → Validation setup**. Your template still provides columns, SAP/general formats, required fields, lengths, allowed values and duplicate checks. Those base checks always run. Profiles choose the additional business conditions and reference checks.

## First setup

1. Upload or paste the records and confirm column mapping.
2. Expand **Conditions · choose individually**. Search and select the maintained conditions you need. **Select applicable** selects enabled conditions for the current company; **Deselect all** clears condition selections only.
3. Expand **References · required and additional checks**. References used in selected conditions are automatically included with those conditions; they are not separate duplicate validations. To switch one of these references, deselect its condition and select the corresponding condition using the other reference, or add an additional reference check.
4. For an additional reference check, choose **Uploaded field → Reference → Reference column**, then **Add reference check**. This creates a run-only existence check. The field means a maintained template field connected to the upload by the normal mapping. Several distinct field/reference mappings can be added. Existing conditional and combination-reference checks are preserved when their conditions are selected.
5. Review the active/skipped counts and choose **Run validation**. Each selected condition retains its WHEN, THEN, severity and existing company restrictions. Paused conditions cannot be forced on. Blank values keep the existing reference-check behaviour; use Required or an explicit condition if a value must be filled.

## Save a profile

Choose **Save as new profile**, enter a name such as Company A — Material Master, and save. A project-linked template can remember the currently selected active company. Otherwise choose the company before running. An Excel Company Code column is not required: the maintained company selection covers the whole run.

Next time: **Upload → choose Validation profile → Run validation**. The profile loads its check identifiers, additional reference mappings and remembered company. Project links are optional for standalone profiles; existing project/company restrictions continue to apply to linked templates.

Selections can be adjusted temporarily. The panel marks a modified profile; the saved profile changes only through **Update profile**. Profiles reference the definitions in the template version currently chosen under **Validate against**. They do not clone the template, reference rows or published release. Save template changes first if you are working against an unsaved draft. Switching profiles keeps uploaded values, corrections, mapping and data preparations. It clears old results and ignore decisions, cancels queued checks and requires another Run validation.

Unavailable condition IDs or reference mappings block running until reviewed, rather than silently omitting checks. Conditions belonging to another company or paused in the template are explicitly skipped. Changing the template version resets the current selection; you can select a saved profile again and review its compatibility with that version. An inactive remembered company or a changed linked project requires a valid current choice or another profile.

## Results and export

**Checks used** lists active conditions, reference mappings and skipped conditions with reasons. Skipped means not evaluated, never passed. Cell edits and suggested-value corrections automatically recheck the same effective schema; unselected references cannot supply correction suggestions or reference details.

Both accepted-data and issue workbooks include a **Validation setup** sheet with the setup name, active checks and skipped reasons. Existing source-row tracking, prepared-data exports and literal SAP codes remain available. Recent checks retain the setup name and numeric counts alongside the existing template version/company context. They do not save uploaded values or full result details.

## Storage, permissions and limits

Profiles are private saved workspace settings, included in normal workspace backups. They contain only names, check identifiers and field/reference mappings. Uploaded records, live corrections, preparation history, ignore reasons and full run results remain in browser memory. Template-definition-only exports do not include profiles stored in the wider workspace.

Run permission allows temporary selection, additional run-only reference checks and using saved profiles. Create saves a new profile; Edit updates a profile; Delete removes one; Export controls workbook downloads. These boundaries are enforced by the normal client and database feature registry. Account changes clear current selections and profile dialogs. Deleting a profile keeps the template and uploaded file; deleting a template also removes its saved profiles.

Limits: 30 profiles per template, 120 per workspace, 20 additional reference checks per selection, and 100 active conditions/additional checks combined. Existing column, upload, reference and 6 MB definition limits still apply. Profile selection and checkbox/search edits do not write to the database; saving a profile and the existing validation summary do.
