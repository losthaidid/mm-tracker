# Source organization and cleanup

This change makes the existing code easier to read and edit while retaining the current website
behaviour and record format.

## Changes

- Extracted the original inline application script to `app.js` and the original style block to
  `base.css`. `index.html` now shows the page shell, starter settings and grouped asset references.
- Moved the existing JSZip 3.10.1 library into `vendor/jszip.min.js` with its licence header. Test
  previews use that same copy; the redundant `tests/validator-zip.js` copy was removed.
- Removed **107 superseded top-level function declarations**. These were earlier declarations of
  names declared again later in the same script. JavaScript already selected the last declaration
  before running the script, so the retained implementation is the one the application used.
- Removed the unused embedded Excel report template, its private cell/chart patch helpers and its
  replaced report implementation. The active implementation is `reports.js`, called by the shared
  `exportReport` function. Raw workbook/model compatibility utilities remain in `app.js`.
- Formatted handwritten root JavaScript and CSS, keeping supplied library bundles intact. During
  formatting, parsed JavaScript was compared before/after to verify that formatting did not change
  its syntax tree. Added repeatable Prettier commands/configuration.
- Added file-purpose comments, save-flow explanations and section headings, plus the editing guide
  and complete file map. Added `custom.css` as a final, initially inactive space for personal styling.
- Updated the simulated-browser tests to read the production script and stylesheet order, so the
  extracted code and actual module order are exercised together.

## Why some older names and wrappers remain

A name such as `workhubActionV9Base` or `scheduleRenderV10` captures a function before a later assignment
extends it. The wrapper still calls that captured implementation. This differs from two same-name
function declarations where the earlier declaration was unreachable from the outset. Removing
wrappers merely because their names look old would remove current behaviour.

Document upgrades, old backup readers, cross-device revision checks, record ownership checks,
spreadsheet text handling, precise time checks and integer-sen money rules also serve current users.
They remain in place. Larger extraction of the Projects/governance code into further independent
modules can be done later with focused tests; the current `app.js` sections make it navigable now.

The regression suite covers stored-record upgrades, editors, linked details, cloud saving/conflicts,
imports/exports, expenses, recipients, Settings and other features. A real browser visual review
remains a separate check from the simulated-browser tests.
