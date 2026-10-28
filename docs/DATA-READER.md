# JSON & IDoc Reader

Open **Studio → JSON & IDoc Reader**. Paste a document or upload a JSON / XML file. The built-in examples use fictional records.

- **Report** creates a readable overview and field / record tables. Choose the title, friendly labels, empty-field visibility and included sections in **Report options & field labels**.
- The report starts with document totals and, for IDocs with control fields, an animated **Message journey** from sender to receiver. Single-value sections use readable field cards; repeated records use tables. Technical status codes are displayed without assigning a universal success / failure meaning.
- **Contents** jumps to a report section inside the reader. Open or collapse individual sections, or use **Expand all / Collapse all**. Folding a section only changes your view; use **Customize → Include report sections** to leave it out of exports.
- **Expand reader** creates a spacious reading view in the current browser tab. Report view hides the outline; Explore keeps it available. **Exit expanded view** or **Escape** restores the normal layout. It does not change the Process Hub or break presentation windows.
- **Customize** opens report options. **Export** groups the PDF, Excel, CSV and original file downloads in one menu. The import panel remains available for replacing the file or pasting another document.
- **Explore** opens sections and nested values. Repeated XML siblings and JSON arrays become tables; fields are discovered across every row. Tables page through 30 records and 25 fields at a time. **Report this section** narrows the report and exports; **Use whole document** restores the scope.
- **Source** retains the original text, including whitespace and CDATA. Original file downloads retain the uploaded bytes and encoding.
- **Search** filters the document navigation and explorer. It does not silently remove data from report exports.
- **Excel** exports one worksheet per selected report section with values stored as text. **CSV** exports section/path/record/field/value rows and neutralises spreadsheet formula prefixes; spreadsheet applications can still reinterpret CSV identifiers, so prefer Excel for leading-zero codes. **PDF** downloads the visual report with wrapping, pagination, repeated table headings and column continuations for wide tables. A prepared download link remains visible for browsers requiring a fresh user gesture.

## Dynamic IDoc XML

The reader discovers XML wrappers, namespaces, custom segment names, nested sections, repeated records, and multiple `IDOC` elements. It does not require a hardcoded IDoc type. Repeated segments are grouped only at their actual parent path. Known control and status fields supply optional overview information; missing fields do not prevent reading.

Technical control status and custom business-segment statuses remain separate. Status text is taken from the supplied file; custom codes are not interpreted as universal success / failure meanings. Status entries remain in source order. Readable source dates do not imply a time zone. Repeated values, leading zeros and CDATA content are preserved. Friendly labels change presentation only.

Fixed-width IDoc text is not decoded without segment definitions. Export IDoc XML to use this reader. XML DTD / entity declarations are rejected. The file is never sent to SAP or an external conversion service.

## JSON fidelity and limits

Number tokens are retained as strings in the reading model rather than rounded through JavaScript numbers. Duplicate object keys remain separate occurrences. Missing values, empty strings, `null`, booleans and empty containers remain distinct. No input is evaluated as HTML or executable code.

Files are limited to 2 MB, 30,000 nodes and 64 nested levels, with field names up to 512 characters and an 8 MB cumulative path budget. Report data supports at most 60,000 cells / 500 sections, plus overview metadata; narrow the scope for larger documents. CSV output is bounded to 20 MB. PDF exports have a 100-page limit and reject headings too long for the layout. Excel rejects values exceeding its cell-length limit or unsupported control characters instead of silently truncating them.

Content, pasted drafts, field labels, report choices, original file bytes and prepared download URLs remain in browser memory. They are not saved in the account document, Supabase or device storage. They clear on account changes, **Clear reader**, page exit and reload. Pending reads / exports cannot restore an earlier account's content. Navigating to another section in the same account retains the open reader until the page closes.
