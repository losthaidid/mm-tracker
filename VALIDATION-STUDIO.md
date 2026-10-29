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
8. Validate, inspect field-level issues, then correct values. Corrections recheck automatically.
9. Export the issue workbook or the rows without errors.

## Choose checks for a validation run

In **Validate → Validation setup**, expand **Conditions · choose individually** or
**References · choose individually**. Both panels have a searchable checklist and
**Select applicable / Deselect all** controls. Reference choices reuse field mappings
from the template's conditions and saved profiles. Use **Map another reference check**
when a reference needs a new uploaded-field/reference-column mapping; the new check
then appears in the checklist and can be switched off and on.

References needed by selected conditions are checked automatically and marked
**Required by …**. Single-field reference checkboxes remain usable: unticking one
shows a confirmation naming every active dependent condition that will also be
deselected for this run. Cancel keeps the setup and results unchanged. **Deselect all**
uses the same confirmation for single-field references. Template definitions and saved
profiles stay unchanged until you explicitly save or update them. Combined-field
references remain controlled by their conditions.
Independent reference checks validate the mapped field on every row; the original
condition's IF/company restrictions still apply only to that condition. Combined-field
reference dependencies keep their full tuple behavior.

Save selections with **Save as new profile**, or explicitly **Update profile**.
Changing a selection keeps the upload, column mapping and corrections, clears old
results, and requires **Run validation** again. Searches and selection changes do not
save workspace data; saved profiles contain check definitions rather than uploaded rows.

## Live corrections

Use **Run validation** for the initial file check. After that, editing a result cell
rechecks the entire upload after a short typing pause (250 ms), or immediately when
you leave the cell. Selecting a suggested value rechecks immediately. Duplicate
and unique-combination issues on other rows, cross-field conditions, company rules,
reference checks, accepted-row decisions and exports all refresh together.

Corrections update the results in place: the surrounding workspace, focused input,
selection, page, filter and table scroll are preserved. Corrected rows remain visible
in a filtered list while you work; changing the filter or page refreshes that list.
Exports are disabled while a typing check is pending. If the company becomes inactive
or validation cannot finish, exports stay disabled until a valid check completes.

Live corrections stay in browser memory and do not create a cloud write or a new run
summary for every edit. Saved run history keeps the original check; **Run validation**
can record a fresh summary when you want one. Changing the file, mapping, version,
company or template settings still requires a new initial run. Pending corrections
are cancelled on context/account changes. The original uploaded file is unchanged.

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

## Projects and company-specific conditions

In **Columns → Linked project**, choose a maintained project, then **Save draft**.
In **Conditions → Company scope**, keep **All companies in this project** for shared
rules, or choose **Selected companies only** and tick one or more companies. Apply
the condition and save the draft. Only active companies from that project are
available for new assignments. Maintain them in **Projects → Companies & processes**.

Example: one company can require Distribution Channel to be in `60,50` when Sales
Org equals `FPSO`; another company can use `10,20` in its own condition. These
company scopes are additional to the rule's IF conditions. Shared column checks
(including length, required fields, allowed values and SAP formats) and shared
conditions still apply. Avoid putting company-specific allowed values on a shared
column; maintain them as company-specific conditions instead.

In **Validate → Company for this validation**, choose the company whose file you
are checking. Each run checks one company; split mixed-company files before running.
A linked template cannot run without an active company from its project. Changing
the company or version invalidates previous results and exports until validation
runs again. Suggestions and reference descriptions use the same company scope.
Run summaries and exported reports retain the project/company names used at the time;
uploaded rows still stay in memory. Template Excel field guides include rule scopes,
and definition JSON exports retain links. Existing setup workbooks remain unchanged:
import columns first, then maintain project and company assignments inside Studio.

Published versions freeze the project link and company conditions. Changing a draft's
project prompts to clear company assignments and pause those conditions; reassign
and enable them deliberately in Conditions. Inactive/deleted assignments remain
visible in existing conditions, but cannot be chosen for new validation runs.
If a linked project was removed, relink the draft or choose another version.
Existing standalone templates and old published versions retain their behavior.

### Reuse templates and conditions

Use **Template options (•••) → Copy to project / companies…** to create an
independent draft in another project (or for another company in the same project).
Choose the new name, destination project and destination company scope. Columns,
conditions and references are copied; published versions and run history are not.
The source is kept. Review the new draft and **Save draft**.

Use **Conditions → Copy conditions…** to bring selected conditions from another
saved template or the current draft. Filter the source by company, tick the rules
to copy, then assign them to the destination companies or all destination companies.
Every copied condition uses that chosen destination scope, and paused conditions
remain paused. Referenced lists travel with the copied conditions as independent
copies. Matching technical field names must exist in the destination; missing fields
or incompatible checks stop the copy without partially adding rules. Existing
destination conditions are kept. Copies do not stay synchronized with their source.

### Open an issue's value

After validation, click an entry in **What needs attention**. Studio switches to
the row's page, scrolls to the exact column and selects the editable value. A
**Current value** panel shows the full value and message (including blank values).
The issue list also previews each value. Correct the cell; errors, warnings and exports update automatically. Uploaded values
remain in memory.

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
