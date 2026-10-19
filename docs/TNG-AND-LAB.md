# TNG statement desk and saved Lab playback

## TNG: review first, save when ready

1. Open **Schedule → TNG PDF extractor** beside the monthly claims summary.
2. Choose or drop a text-based TNG **Customer Transactions Statement** PDF. The supported offline and online card tables are read on your device.
3. Choose a date range or one or more date chips. **Journey / exit date** is the default; **Posted date** is available when required. Filters change the view, not your previous selections.
4. Use **Match on-site dates** to suggest tolls on your scheduled client/site visits. Review personal trips yourself. If there are several visits that day, choose the correct allocation; the app does not guess the company or client.
5. Select the expenses you want. Reloads and refunds remain separate and cannot enter expense totals. **Edit** corrects an extracted draft; it never changes the source PDF image. **Manual entry** creates a draft without invented PDF evidence.
6. Choose **Save selected expenses**. This adds the confirmed records to the existing expense ledger in one save and updates Schedule's monthly claim totals. Wait for **Saved to Supabase** before leaving.

Opening, parsing, filtering, matching and cropping never save an expense automatically. Saved PDF transactions remain selected for evidence; they are no longer counted as new expenses. The same card/section/transaction reference is blocked from being imported again, including in overlapping statements. Without a readable card serial, duplicate checks cover the exact file only; a warning asks you to check existing expenses.

### Crop and download the relevant records

Choose **Crop** beside a PDF transaction. Move the frame, drag a corner, or edit Left/Top/Width/Height. Arrow keys move the frame; Shift + arrows resize; Alt increases the step. **Reset crop** restores the detected row boundary.

- **Download PNG:** the current record's crop.
- **Evidence PDF:** the selected PDF records in one A4 evidence pack.
- **Crop images ZIP:** one PNG per selected PDF record.

The optional table-heading strip is copied separately from the source. It does not include the statement's personal account heading. Crops are source images, not retyped evidence. Always check that the selected area contains all relevant fields and no neighbouring private records. Downloads do not add or change expenses, and manual entries do not have PDF crops.

The original PDF and unselected rows stay in memory on the current device; they are not uploaded, stored in the account or included in backups. Confirmed expenses save a compact source reference and the crop coordinates. **PDF evidence** beside a saved expense can reopen the source review. Reattach the same statement after reloading, switching devices or signing out. Keep your original PDF safely if you need evidence later.

### Limits and privacy

This first version supports the supplied upright, text-based TNG card-statement layout, not arbitrary PDF layouts, scanned images, password-protected files or OCR. Limits: 20 MB, 60 pages, 3,000 transactions per import, 200 crops per export and the existing 5,000-entry expense ledger. Unknown tables/invalid rows are reported for review. No tax or employer-claim eligibility is inferred.

Dates are preserved as calendar dates; amounts use integer sen. Statement bytes, card serials and account numbers are not saved. A card fingerprint supports duplicate checks. Signing out or switching accounts clears the temporary review and invalidates pending reads/exports and manual forms. Do not commit a real statement or extracted private fixture to the public repository.

## Troubleshooting Lab: automatic live results

Open any investigation containing successful/failed experiments, or a solved case. **Live results** starts automatically, including for previously saved cases. Success cards glow, failed cards gently recoil with small smoke particles, and powered connections repeat their travelling current.

Use **Pause / Resume**, **Stop**, and **Speed** (0.5×, 1×, 1.5× or 2×). Leaving and reopening the investigation starts playback automatically again. These controls are local; they do not rerun experiments, change outcomes, republish Knowledge notes or trigger cloud saves.

Playback pauses when the page is hidden, while dragging/editing in dialogs, and during Privacy or presentation. Reduced-motion preferences and Animations Off keep the results still. Momo's short reaction to a newly recorded result remains a separate one-off effect.

## Source and verification

`tng-engine.js` owns table/rule calculations; `tng-files.js` owns local PDF reading and exports; `tng.js` owns review interactions; `tng.css` owns layout. `studio.js` installs the module, and confirmed entries use the existing claims validation/save pipeline. No SQL migration or new service is required.

The vendored reader is PDF.js 6.4.299's legacy build (reader and worker copied together); exports use pdf-lib 1.17.1 and the existing JSZip 3.10.1. Versions are pinned in `package.json`. Keep licence files when updating these libraries; never hand-edit or reformat their minified code.

Run `npm test`. The synthetic [preview page](../tests/tng-lab-preview.html) exercises production modules without connecting to a private account. It uses made-up records only. The TNG tests use synthetic positioned text, and application tests check confirmed saves, backup provenance, account isolation, bounded crops and automatic Lab playback. A real statement can be checked locally without adding it to Git.
