# Mixed-format explode and Original vs Recombined

In **Validate**, upload the original file, confirm its mapping, and choose **Explode & map rows**. Select **Parent + dependent · grouped or plain per row** under **How to combine the values**, choose Plant as the column to explode, and check Storage Location as the one dependent column. Preview and apply, then run validation.

The existing **Pair lists by position** mode remains the default. Dependent mode detects the supported syntax separately for each row in the same upload:

| Plants | Storage Location | Output |
| --- | --- | --- |
| `FF01, FF02, FF03` | `(FF01) QA00, QA01, (FF02,FF03) QA00` | FF01/QA00, FF01/QA01, FF02/QA00, FF03/QA00 |
| `FF01, FF02` | `QA00, QA01` | FF01/QA00, FF02/QA01 |
| `FF01` | `(FF01) QA00, QA01` | FF01/QA00, FF01/QA01 |

Plain lists pair by position, as selected by the user. Unequal lengths block Apply unless **Repeat a single mapped value** was explicitly checked. A single plant with two plain storage locations also needs explicit groups rather than an inferred rule. Grouped mappings require distinct, nonblank parent codes and a group for every parent. Parent names match exactly after the chosen trimming policy. Unknown parents, missing groups, malformed parentheses, empty grouped values and bracket/brace formats identify the source row and block the whole preview. Only the supported formats are interpreted; further formats are deferred to a later batch.

Multiple parent names inside one marker receive that group's storage list. Repeated child values and repeated groups retain their occurrences. Output follows parent-list order and each parent's child order. Capacity limits apply before output is accepted: 25,000 rows, 200 fields, 5,000,000 cells and 50 million text characters. Material, Description and all other copied fields come from the same parent row. Preparation, undo and queued sessions retain source row and split-part links.

## Original vs Recombined

After validation, choose **Original vs Recombined** beside Validate. This tab uses the original and current working records from that validation session. It produces one line for **each original worksheet row**, including separate rows with the same Material number. It does not join by Material number.

- Copied fields are compared as exact text, including spaces, zeros, case and blanks.
- Exploded fields are compared as complete combinations with occurrence counts. Changing Plant/Storage pairings is a difference even if the independent column lists still contain the same values. Combination order and equivalent grouping notation alone do not cause a discrepancy.
- For one dependent explosion, the recombined Plant list contains each current plant and Storage Location uses explicit `(plant) values` notation. Positional and successive explosions retain the validated list entries; **Review row** also shows complete combinations and exact current children.
- Missing and extra combinations are listed with counts. If descriptions, material identifiers or other copied values disagree among children of the same original row, the field is a **Conflict**; no child is silently selected as the correct value.
- Amber highlights differences; red highlights conflicting copied fields. Matching original data is separate from passing validation checks.

Use **Review row** to inspect field comparisons and missing/extra combinations, then **Open these records in Validate** to return to the original row's first current child. The row's original source and split-part labels remain available for every working child. Live checks must finish before comparison or export refreshes. Filters and paging affect only the view.

**Download comparison report** includes Summary, Recombined data, Field comparison, Combination differences and Validated records. All values are literal Excel text, with field highlights, source row links and complete current child values. A recombined value longer than Excel's 32,000-character cell allowance is represented by a preview and a locator; every individual value remains in Validated records. Large sheets continue with numbered sheets and repeated headers. The existing issue export still contains exactly Validated data and Issues.

Expected combinations are reconstructed from the original lists and the applied explode options, independently of current corrected values. If an original list cannot be parsed using those options (for example, it was malformed and edited before exploding), the tab explains that it cannot reconstruct that original instead of declaring a match. Run/Export permissions and account-change, replacement-file and stale-export checks continue to apply. No uploaded rows or report content are saved to the account.

## Material values and file switching

Validation XLSX imports keep literal text intact. For mapped text/code fields and Material identifiers, numeric cells use an explicit simple decimal/zero format when available, and redundant numeric encoding digits may be shortened only to the equivalent number. For example, numeric `6.000069999998` with Excel format `0.00000` is read as `6.00007`; numeric `6.0000699999999996` in General format encodes the same value as `6.00007`. Text containing `6.000069999998` stays that exact text. Long numeric identifiers that cannot be represented safely are retained as stored. No general-purpose rounding is applied to measures, CSV text or the separate Excel-to-CSV tool. Already incorrect unformatted source text cannot be recovered by guessing its intended digits.

Identifier display metadata is isolated per workbook, applied through the actual field mapping, and restored with that file's queue session. Material exports remain literal text even if a General template classified Material as numeric. Measures keep their existing numeric export behavior. Result editors receive a new context when files, queued sessions or preparations are replaced, so a reused input cannot carry a prior file's description into the next material row.

## Verification

`tests/validator-recombined.test.mjs` covers mixed per-row syntax, the exact four-record example, positional defaults, invalid/incomplete groups, duplicate counts, capacity preflight, repeated material identifiers with different descriptions, copied-field conflicts, crossed pairs, successive explosions, source row identity, live checks, account cleanup, queue switching, stale inputs, exact identifier import/export, complete report exports and 12,000 originals expanded to 24,000 records.

![Original vs Recombined example with a description conflict and a changed storage location](images/validation-recombined.jpg)

Final local verification: 264 validator/source checks and 25 focused application integration checks passed (289 total). A 12,000-original / 24,000-validated-record report generated in 1.89 seconds (2,341,134 bytes) in the local synthetic check; Python's independent ZIP/XML reader verified all sheets, exact final identifiers, discrepancy values, row counts and absence of executable formulas. This is a local check rather than a performance guarantee for every browser.

Browser QA confirmed mixed-row preview counts, all seven validated children, one recombined line per source row, correct repeated-Material descriptions, conflict/missing/extra highlights and the compact layout. The browser's download-event confirmation timed out; generated workbook bytes and every report row were verified independently instead.
