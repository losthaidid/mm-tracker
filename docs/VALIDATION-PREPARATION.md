# Prepare uploaded data in Validation Studio

Open your template → **Validate** → upload or paste your records. Confirm the column mapping, then use the **Prepare before you check** buttons above it.

## Excel worksheets with introductory rows

Validate initially reads worksheet row 1 as the header. If your file has instructions above the data, choose the correct **Worksheet** and **Header row** in the mapping panel; for example, enter 4 when your actual column names are on row 4. Blank cells before or between populated headers retain their Excel column positions and show **(blank header)** in the dropdown. They do not shift material numbers, descriptions or other fields to another column. Choose a nonblank, unique header row before running validation.

Failed uploads stop the **Making sense of your data…** banner and show an error so you can retry. If reading the new file fails, the previous successfully loaded session remains available. If the workbook loads but the chosen header row is empty, old results are cleared and the worksheet/header controls remain available to correct the selection. A late failure from an older upload or another account cannot stop a newer upload or replace its status.

## Apply SAP formatting

Use a **SAP** template with the correct SAP types and lengths maintained in Columns. Select the template version you want to validate against.

1. Choose **Apply SAP formatting**.
2. Leave fields on **SAP type format** for automatic NUMC/CLNT zero-padding, ISO date conversion to YYYYMMDD and colon-separated time conversion to HHMMSS.
3. For a numeric code stored in a CHAR field, select **Zero-pad code** explicitly. Example: Availability Check with SAP type CHAR and length 2 changes `2` into `02`.
4. Choose **Preview changes**, review Before/After values and retained-value warnings, then **Apply to working data**.

**Keep unchanged** skips a field. Unmapped fields are skipped. Blank cells stay blank. Formatting does not guess domain values or conversion exits, translate units/languages, truncate values, remove significant digits or round amounts. Invalid or unsupported values remain available for validation. A CHAR field does not automatically require leading zeros; its maintained conversion choice determines that action. SAP NUMC and conversion behavior are described in [SAP's domain/data-element guide](https://learning.sap.com/courses/building-data-models-with-the-abap-dictionary-and-abap-core-data-services/defining-domains-and-data-elements_b65b511a-4ad1-4437-80f5-5ad689cab833).

## Explode & map rows

This works with General and SAP templates.

1. Choose **Explode & map rows**.
2. Choose the primary **Column to explode**, e.g. Plant.
3. Select the columns to **map in the same sequence**, e.g. Storage Location.
4. Choose the literal delimiter: comma, semicolon, pipe, tab, or a custom delimiter of up to five characters.
5. Preview the pairings and apply.

| Original Plant   | Original Storage Location |
| ---------------- | ------------------------- |
| FF01, FF02, FF03 | ST00, WH00, WH01          |

| Result | Plant | Storage Location |
| ------ | ----- | ---------------- |
| 1      | FF01  | ST00             |
| 2      | FF02  | WH00             |
| 3      | FF03  | WH01             |

All unselected columns, including upload columns not mapped to the template, are copied into each new record. Several mapped columns can follow the primary one. The primary list determines the number of records.

Unequal list lengths block the entire Apply operation. **Repeat a single mapped value** is an optional, explicit exception: Plant `FF01,FF02` and Storage `ST00` can become FF01/ST00 and FF02/ST00. It also repeats blank mapped cells. It does not expand a longer secondary list against a shorter primary list.

Empty positions are retained: `FF01,,FF03` has three positions and the second Plant remains blank. Trim removes surrounding spaces from split values only. Quotes inside a cell are ordinary characters; this tool uses literal delimiters rather than a second CSV parser inside each cell.

## Download exploded Excel without validation

After **Preview changes → Apply to working data**, choose **Download exploded Excel** beside **Explode & map rows**. No validation run or completed template mapping is required. The button becomes available only after an explosion has been applied; a preview or SAP formatting alone does not enable it.

The download is named after the uploaded file, ending in `-exploded.xlsx`, with exactly one **Exploded data** sheet. It includes every current working record and all upload columns in their loaded order, including unmapped columns. Current SAP formatting and later corrections are included. Filters, pages, unresolved errors and accepted-row decisions do not restrict these records. In a validation queue, it downloads only the currently open file.

All values are written as literal Excel text, retaining leading zeros, exact material strings such as `6.00007`, descriptions, blank cells, long identifiers and parent/dependent assignments. Formula-like text remains text. Existing Validate upload requirements still apply. No validation-status columns or additional report sheets are added. Original and prepared snapshots, source-row links, validation results and account records are unchanged by the download.

For example, Plant `FF01, FF02, FF03` with Storage `(FF01) QA00, QA01, (FF02,FF03) QA00` exports four records: FF01/QA00, FF01/QA01, FF02/QA00 and FF03/QA00, each with the same material and description from its own parent row.

![Download exploded Excel beside Explode & map rows, before validation](images/validation-exploded-download.jpg)

The writer uses bounded batches and keeps wide files on one sheet within the existing 25,000-record/200-column limits. It stops rather than shorten a cell exceeding Excel's 32,767-character limit. While the file is being prepared, duplicate download requests are blocked and progress text is shown. Changing the working values, replacing the upload, opening another queued file or changing account discards a pending export. Export permission is checked before generation and again before delivery. Run/edit permission is not required to download an already prepared working file.

Undoing the only remaining explosion, restoring the original upload or replacing the file disables this download until another explosion is applied. Undoing a later SAP preparation leaves it available if an earlier explosion remains applied.

## Validate, correct and export

Recommended order: **Upload → Explode & map → Apply SAP formatting → Run validation → Export**.

Applying or undoing a transformation clears old issue counts and ignore decisions. Run validation again before exporting validated reports; **Download exploded Excel** remains independent of that check. Normal cell corrections and suggested-value selection continue to recheck automatically. Existing conditions, references, company scope and duplicate checks apply to the resulting records. If a material appears in several plants, use the appropriate unique combination rather than making Material alone unique.

SAP exports store internal values as literal Excel text, including codes whose General data type was previously numeric. The main **Validated data** or **Accepted data** sheet uses the template's mapped fields. When preparations have been applied, **Prepared upload** retains every original upload column and its current working values. Accepted exports include only accepted records in both sheets. **Row origins** links each working record to the original worksheet, Excel row and split part. Issues use the working row number shown in Studio; split records show their source row and part below it. All these sheets use values, not executable formulas.

### Compare the complete record after exploding

After **Run validation**, use **Original vs validated** to check each record's
original, prepared and validated values. Every output row carries its own original
worksheet row and split part, including nested parts after successive explosions.
Copied fields (such as Material, Description or extra unmapped upload columns) come
from that row's parent; selected Plant/Storage lists remain paired by position, or by explicit parent groups in Parent + dependent mode. See [Mixed formats and recombined comparison](VALIDATION-RECOMBINED.md).
Blank positions do not move the following values to a different record.

Preparation changes appear in blue; later corrections and differences from the
original appear in amber. Unresolved field errors appear in red. Use **All fields**
to include unchanged copied information, or filter by an upload column and working
row number. Unmapped upload columns are compared but labelled **Not checked**.

Choose **Export comparison report** for complete row and field comparisons plus
full original, prepared-baseline and validated-upload sheets. **Export issue workbook**
contains only **Validated data** and **Issues**, retaining all validated records and
their issue highlights, including exploded rows. See [Issue workbook](VALIDATION-ISSUE-EXPORT.md).
Screen filters never restrict either exported report.
Long original cells are retained in full in **Original upload**, with a cell locator
beside their preview in the field comparison. The prepared baseline is the snapshot
after the latest preparation and includes earlier corrections. Correcting a value
rechecks the upload and refreshes comparison results; downloads wait for that check.

## Undo and privacy

**Undo last change** retains the last three transformation snapshots. **Restore original upload** returns to the uploaded values, even after several transformations. Both actions clear validation results and later cell corrections after confirmation. Changing worksheet, header row or template version also restores that source; Studio asks before discarding applied preparations.

The file on your device is unchanged. Uploaded values, transformation previews, row origins and undo snapshots remain in browser memory. Only the existing validation count/history summary is saved to your account. A new upload, clearing the file, switching templates or changing accounts clears preparations. Close/reload does not retain this working upload.

The limits apply after expansion: 200 columns, 25,000 records and 5,000,000 cells per file, with a 50 MB original file and 50 million text characters. An explosion that exceeds the limit is blocked before changing the working data. Large comparison reports use side-by-side groups of Original / Prepared / Validated / Change / Field check columns. Numbered continuation worksheets repeat the headers and retain every record. Split larger files before preparing. Preparing data requires Validation Studio's **Run/use** permission; changing the saved template requires **Edit**, and downloading needs **Export**. Preparation does not require template-edit permission when using an existing saved template.


## Validate multiple files (N158)

Open **Validate → File validation queue → Add files**. Add up to 10 XLSX, CSV or TSV files for the current template. Each file has its own worksheet/header row, mapping, company, selected conditions/references, preparation history and corrections.

1. Open the first file, choose its company when the template is linked to a project, and check its worksheet, header row and mapping.
2. Apply any **Explode & map rows** or SAP formatting required for this file. Review the parent rows and paired fields in the preview.
3. Choose **Confirm file setup**. Configure and confirm each remaining file. Company choices are explicit for every file.
4. Choose **Start queue**. Studio processes the files sequentially; duplicate checks cover the whole current file and never mix separate files. A failed validation is marked for review while the remaining files continue.
5. Open a completed file to use grouped attention, edit records, compare with the original or download its individual report. **Download completed reports** creates a ZIP with each completed file's full comparison/issue workbook and a queue summary.

Changing a file's company, worksheet, header row, mapping, preparation or check selection requires confirming its setup again. Changing the template/version requires reviewing the queued setups. A stopped queue retains completed results and confirmed setups; start it again to process the remaining ready files. A failed file must be reviewed and confirmed before retrying.

Queue uploads total up to 150 MB. Inactive working sessions are compressed in browser memory with a 100 MB combined limit, so only the open file has live editing arrays. Download and remove completed files to free capacity. Nothing resumes after reload: queue files, original/prepared rows, corrections, ignore reasons and undo history clear when the page closes/reloads, the template changes or the account changes. Ordinary saved templates and numeric run summaries keep their existing behavior. Each file retains the existing first-15,000 listed-issue limit; all errors still count, and comparisons include every row and field. Reference-list limits remain 2,000 rows per list.
