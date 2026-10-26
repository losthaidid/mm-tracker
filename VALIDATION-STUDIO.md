# Validation Studio

A General/SAP file validator in the existing WorkHub. All checks are deterministic.

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

## Easy Excel setup (one sheet)

Download **simple General setup** or **simple SAP setup** in Validation Studio.
Each contains one `Setup` worksheet with dropdowns, instructions and example fields.

1. Fill the template name in **B2**. **B3** contains General or SAP; use the download
   matching your mode so the data-type dropdown contains the appropriate choices.
2. Replace/delete the example rows starting at **row 9**. One row defines one data
   upload column, up to 200. Keep the **row 8 headers**.
3. Choose **Import Excel setup → Create new draft → Save draft**. Use **Validate**
   to upload the actual data records afterward.

`Field` is a unique technical key (e.g. VENDOR_CODE); `Label` is the upload header
and defaults to Field. Select a Data type. Required defaults to No. Allowed values
use commas or newlines. To allow **X or blank**, enter `X` and leave Required as No;
`X,` also works, but the trailing comma is unnecessary.

General Length is an optional maximum character count. General Format is optional:
digits, alphanumeric, email, url or identifier. Leave Decimals and Reference field
blank. SAP Length and Decimals use the actual DDIC definition, with type defaults
when blank. SAP Format is automatic (blank or `standard`). CURR may reference a
CUKY field; QUAN may reference a UNIT field, using the technical Field key.
Notes are optional. **How to fill the setup** in Studio explains every column.

The existing **advanced setup** workbook still supports Excel-maintained Conditions,
References, reference-data worksheets and Unique combinations. Old multi-sheet
files remain supported. Missing Template type means General. The advanced Template
sheet now accepts Template type; Columns has additional SAP type, SAP length,
SAP decimals and SAP reference field headers. No new sheets are required by old files.
You can also import the simple setup and maintain Conditions/References in Studio.

## SAP mode

Choose **Template type → SAP** in the column editor. General settings are preserved
when switching modes. SAP mode uses its own automatic type/format checks and keeps
Required, Allowed values, uniqueness, Conditions and References available.

Supported DDIC types: **CHAR, NUMC, DATS, TIMS, CLNT, LANG, CUKY, UNIT, DEC, CURR,
QUAN, INT1, INT2, INT4, INT8, SSTRING, STRING and RAW**. Type changes suggest the
corresponding default length/scale; use the actual field definition in SE11.

- DATS accepts real YYYYMMDD dates and the SAP initial value 00000000. Required
  rejects blanks; use a Condition if you also want to disallow initial values.
- TIMS uses HHMMSS. NUMC and CLNT require their fixed digits, including leading zeros.
- Packed decimal types enforce total digits and decimal places without rounding.
  Use signed plain numbers with a dot, without grouping or scientific notation.
- INT8 comparisons, reference matching and uniqueness preserve all 64-bit digits.
  Keep long integers as Excel **Text** to avoid precision loss before uploading.
- RAW uses two hexadecimal characters per byte. LANG uses an internal one-character
  key; currency and unit keys are internal codes. Maintain valid codes in References.
- If a CURR/QUAN reference field is configured, a nonblank amount/quantity needs a
  nonblank currency/unit value in the same row.

These are the supported DDIC field formats based on the
[official ABAP 7.54 built-in DDIC catalog](https://help.sap.com/doc/abapdocu_754_index_htm/7.54/en-US/abenddic_builtin_types.htm).
This is not an SAP connection or a complete DDIC/domain validation service. Domain
values, conversion exits, release-specific customizing and currency display scaling
(including TCURX behavior) require your own Conditions/References. No automatic
padding, rounding, conversion or currency scaling is performed. Workspace profiles
limit STRING to 32,000 characters and RAW to 255 bytes; CHAR allows 30,000 characters
but a particular SAP table field may have a smaller limit.

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

Per file: 10 MB, 5,000 rows, 200 columns and 200,000 cells. At 200 columns, split
data into batches of at most 1,000 rows. Expanded XLSX archives
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
