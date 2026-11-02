# Original vs Recombined · two independent files

Open **Validation Studio → Original vs Recombined**. This workspace compares an original file with a separate exploded or validated file. It works without a saved template or a validation run. The files uploaded in Validate, Compare two files and Excel to CSV have separate working sessions.

## Use the comparison

1. Upload **Original file A** — normally one line per original record.
2. Upload **Exploded file B** — the separate file containing its expanded records.
3. Choose the worksheet and header row independently for each file.
4. Review **Columns and matching keys**. Map each File A field to the corresponding File B field. Check the unchanged columns that identify a record, such as Material or Material + Original Record ID. A recognised, uniquely mapped Material/ID field is selected initially when there is exactly one clear candidate.
5. Choose **Recombine & compare**. File B is grouped by those exact keys, and distinct field values are joined with commas. There is no prerequisite to run validation.
6. Review the highlighted fields or choose **Review record** for assignment details and source File B rows. **Download comparison report** exports the whole comparison, regardless of the current screen filter or page.

Matching key fields stay included and compare as exact text. Uncheck a key before excluding its field. Use keys that do not change when the record is exploded. If the same Material appears on two different original lines, choose an additional unchanged identifier; otherwise both original records show **Ambiguous key**, and their File B values remain unassigned. The program does not choose one description or merge two original rows by guessing.

Blank keys, missing File B records and extra File B keys are displayed separately. Matching uses keys rather than worksheet order. Changes to uploads, worksheets, mappings or comparison settings clear the old result and require another comparison. Headers are labels rather than discrepancies. An unmapped File A field is reported as a missing File B column unless its Compare checkbox is unchecked. File B columns not mapped for comparison are listed in the setup.

## Comma values and exact text

| Setting | Behavior |
| --- | --- |
| Matching key | Literal text, including case, spaces and leading zeros |
| Comma-separated values | Distinct comma-delimited items; ignores item order and spaces around each item |
| Exact text | The complete File A text must equal the comma-joined, distinct File B text |

For example, File B values `FF01`, `FF01`, `FF02` become `FF01, FF02`. Storage values `QA00`, `QA01`, `QA00` become `QA00, QA01`. Repeated exploded rows do not add new distinct values. Descriptions default to Exact text so punctuation and spaces in ordinary prose retain their meaning; choose Comma-separated values if an original field is maintained as a list.

If File A says `Water Pump` and File B contains both `Water Pump` and `Water Pump Updated`, its recombined description is `Water Pump, Water Pump Updated` and is highlighted as **Not match**. A data discrepancy is a comparison result, not a Validation Studio condition or validation error.

## Parent / dependent assignments

The optional assignment check compares distinct relationships as well as the individual field values. It is initially selected when Plant/WERKS and Storage Location/LGORT are clearly mapped. You can select other mapped parent/dependent fields, or switch the check off. Excluding or unmapping one of the assignment fields switches that check off; recognised grouped values can still be compared as lists.

File A supports the current grouped notation and positional lists, detected per row:

| File A plants | File A storage locations | Expected pairs |
| --- | --- | --- |
| `FF01, FF02, FF03` | `(FF01) QA00, QA01, (FF02,FF03) QA00` | FF01/QA00, FF01/QA01, FF02/QA00, FF03/QA00 |
| `FF01, FF02` | `QA00, QA01` | FF01/QA00, FF02/QA01 |

File B should have one parent/dependent value per expanded row for assignment checking. Wrong pairings are highlighted even if the two independent comma lists contain the same codes. Review record shows the actual missing and extra pairs. Different group notation alone is not a discrepancy for comma-list comparisons. Exact text remains literal when explicitly selected.

Malformed groups, unknown parents or unsupported formats are flagged as **Review assignments** rather than guessed. A single parent with multiple plain dependent values requires explicit grouping; plain lists continue to pair by position. Additional source formats are deferred to a later batch.

## Exported report

The workbook contains exactly two sheets:

| Sheet | Contents |
| --- | --- |
| **Summary** | Overall counts and every non-matching/review record, with original and recombined field values, source row references, and missing/extra assignment details |
| **Field Comparison** | Every comparison record and mapped field, showing File A, recombined File B, and the field result side by side |

Values are literal Excel text, including identifiers and formula-like strings. Formula source is not executed or exported as an Excel formula. A recombined value longer than 32,000 characters continues on additional rows in the same two sheets, labelled with the comparison record and Part number. Joining those parts reconstructs the full value. Unicode characters, including surrogate pairs at continuation boundaries, remain intact. Screen previews shorten long values; the report retains the complete contents. Repeated downloads reuse the generated workbook until inputs or settings change.

## Input values, limits and privacy

XLS, XLSX, CSV and TSV are supported using the existing local readers. Excel formulas, including XLOOKUP, use their saved results. Recalculate and save the workbook in Excel first; a missing saved result stops the upload rather than becoming a blank match. XLS retains its existing saved-value comparison rules. XLSX numeric identifier display metadata is used for matching keys and Material fields; literal text, leading zeros, long identifiers and normal measure values retain the existing saved-value rules. Already incorrect source text cannot be repaired by guessing intended digits.

Each input supports 50 MB, 25,000 data records, 200 columns and 5,000,000 cells, subject to the existing text limits. Recombination does not expand these input files. Large comparisons yield between batches and can be cancelled. Uploaded data, mapping, results and generated workbooks remain in this browser session. No upload or report contents are saved to account records. Account changes and reloads clear the working session; late reads/runs/exports are discarded. Run/use permission enables the tool, and Export permission separately controls downloads.

## Existing explode preparation

**Validate → Explode & map rows** continues to provide the existing positional mode and **Parent + dependent · grouped or plain per row**. The grouped example above still produces four expanded records. Every unselected field, including Material and Description, is copied from that same source row. Invalid or incomplete groups block Apply. Undo, original row/part lineage, validation queues and numeric identifier preservation continue to apply to validation uploads. See [Validation preparation](VALIDATION-PREPARATION.md).

![Two independent files compared after comma recombination, with description and storage differences highlighted](images/validation-recombined.jpg)

## Verification

`tests/validator-reconcile.test.mjs` covers operation without a template or validation run; separate file uploads; distinct comma lists; literal text and identifiers; crossed parent/dependent pairs; repeated and blank keys; missing/extra records; mapping exclusions; source row order; independent worksheets/headers; cached formulas; XLS worker routing; cancellation; account isolation; complete two-sheet exports; long/Unicode continuation values; and 12,000 originals compared with 24,000 separate exploded records. The existing validation session is checked for unchanged upload, mapping, results and history.

Final local checks: 280 validator/source checks and 25 focused application integration checks passed (305 total). A synthetic 12,000-original / 24,000-exploded-record comparison and its two-sheet workbook completed in 1.48 seconds (1,252,804 bytes) locally. An independent Python ZIP/XML reader verified exactly Summary and Field Comparison, every record, the final literal material ID, discrepancy values, highlights, Unicode and absence of formulas. This is a local check, not a timing guarantee for every browser or workbook.

Browser QA used two separately uploaded CSV files with no saved template and no validation run. It confirmed six exploded rows recombined into two records, one Match and one Not match, comma-joined descriptions/storage values, correct material IDs, and missing/extra plant/storage details. Browser download-event confirmation timed out; generated workbook bytes and all report rows were verified independently.
