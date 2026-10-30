# Two-sheet issue workbook

After validation, choose **Export issue workbook** beside the records table.
The Excel file contains exactly two worksheets, in this order:

| Worksheet | Contents |
| --- | --- |
| **Validated data** | Every validated working record and template field, plus Validation status, Errors, Warnings and Ignored issues. Existing error/warning highlights, value types, leading-zero codes and literal text are retained. |
| **Issues** | Working Excel row, column label, technical field, severity, rule, value, message, review status and ignore reason. Ignored decisions stay beside their issues. An Issues sheet is included even when no issues were found. |

View filters, selected error groups and table pages never restrict the exported
records. Exploded records keep their respective copied and mapped field values
and working row order. Source files and in-memory original/prepared data are not
modified by export. SAP values remain literal text as in the existing Validated
data sheet; long identifiers and formula-like text are not converted to executable
formulas.

This action skips creation of setup, reference-match, comparison and upload
snapshot sheets. Wide exports retain exactly two tabs, including the supported
25,000 records and 200 template fields. The single Validated data sheet is written
in bounded XML batches. Browsers with native raw DEFLATE compress those batches
incrementally; other browsers use the existing ZIP library as a compatibility
fallback. Header formatting, freeze panes, filters and validation highlights
remain available. No records are dropped to meet the tab count.

The existing validation-engine limit of 15,000 listed issues is unchanged. If that
limit was reached, an informational row in **Issues** discloses the limit. The
Validated data sheet still includes every validated record and its complete
status/error/warning counts.

For original/prepared/validated snapshots and source-row/split lineage, choose
**Original vs validated → Export comparison report**. **Export accepted rows**,
**Download completed reports** in the validation queue and the independent
**Compare two files** reports retain their existing scope. Template definitions,
validation checks, permissions and saved records are unchanged by this export
layout change.
