# Validation Studio

A general-purpose file validator in the existing WorkHub. Batch A remains
separate from this enhancement.

## Workflow

1. Open **Validation Studio** and create a template, or explore **Project intake**.
2. Define column labels, technical fields, order, types and basic checks.
3. Build conditions with nested ALL/ANY groups and a required assertion.
4. Maintain reference lists by pasting CSV/TSV or importing an XLSX worksheet.
5. Save the draft. Publish a version to freeze its columns, rules and references.
6. Download an Excel template or upload an existing XLSX, CSV or TSV.
7. Choose a worksheet and header row, then confirm each column mapping.
8. Validate, inspect field-level issues, correct values and validate again.
9. Export the issue workbook or the rows without errors.

## Supported checks

- Text, whole numbers, decimal numbers, ISO dates and booleans.
- Required fields; unique values and combinations of two to ten fields.
- Character lengths, numeric limits and maintained allowed values.
- Optional trimming and case-sensitive comparison.
- Digits, alphanumeric, identifier, email and HTTP(S) URL formats.
- Literal equality, inequality, ordering, contains, starts/ends with and lists.
- Field-to-field equality and ordering.
- Reference existence against a selected reference-list column.
- Nested AND/OR groups, with up to four levels.
- Error or warning severity and custom messages.

No arbitrary JavaScript or formulas are executed. A conditional ELSE can be
expressed as a second rule with the opposite condition.

## Definitions and versions

Drafts save through the existing account-owned cloud-document path.
Published versions are immutable. Copy an earlier version into the draft to
revise it. JSON definition export/import supports reuse without sharing account
data. Imported definitions receive a new template ID.

Run summaries record template/version, time, file name and counts. They do not
contain uploaded rows. Draft run summaries are labelled Draft; use a published
version when a reproducible rules snapshot is needed.

Uploaded working files and corrected rows stay in memory, are excluded from
backups and cloud saves, and are cleared when the account changes. Reference
lists are part of the saved template. Switching templates discards working
upload data; unsaved definition changes prompt before being discarded.

## File behavior

- XLSX supports worksheet selection, shared and inline strings, boolean cells,
  Excel date styles and zero-padded number formats.
- Formula/error cells are rejected with their worksheet and cell reference.
  Paste formulas as values before uploading.
- CSV/TSV supports BOM, quoted delimiters, escaped quotes and multiline cells.
- Nonblank unique headers are required. Ambiguous aliases need manual mapping.
- An input column cannot be assigned to more than one technical field.
- Text identifiers preserve leading zeros. Use text for long numeric IDs.
- Excel exports store formula-looking text literally.
- The issue workbook includes data, cell-level highlights, an issue list and
  run details. Accepted exports exclude errors but include warning rows.
- Editing a cell, changing mapping or changing the selected version invalidates
  prior results. Revalidate before exporting.

## Practical limits

Per file: 10 MB, 5,000 rows, 80 columns and 200,000 cells. Expanded XLSX archives
are capped at 40 MB. Per template: 100 rules, 400 condition clauses, 20 reference
lists with 2,000 rows each and 15 published versions. The workspace retains
150 run summaries. Saved validator definitions are capped at 6 MB within the
existing 16 MB account document.

Up to 15,000 issues are listed per run; all issues still count toward errors,
warnings and accepted-row decisions. Split a very noisy file for a full issue
listing. This validates configured rules and supplied references; it does not
query or submit data to SAP.

## Browser QA

The tests/validator-preview.html page uses the production engine, file adapters,
workspace and security policy with memory-only example data. It does not
connect to an account. Its ZIP dependency is an exact copy of the JSZip 3.10.1
library already bundled in the app.
