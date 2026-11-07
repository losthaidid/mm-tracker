# Website experience additions

The seven kept selections from the November design discussion are implemented. They use the existing account document and feature permissions; no database migration or new service is required.

| Selection | Where to use it |
| --- | --- |
| 10 · Search & commands | Use the toolbar search. Results are grouped into Pages, Records and Actions. Search several words across titles, descriptions and status; use ↑ / ↓ and Enter, or Tab and click. A desktop preview shows the selected result. |
| 19 · Animated navigation icons | Sidebar icons make a brief movement on hover and when selecting a section. Motion off and device reduced motion stop these effects. |
| 20 · Custom website icon | Settings → Appearance & motion → Website icon & arrival. Choose Original artwork, My initials or My logo. The header and browser favicon preview together. Save theme to keep the choice. |
| 31 · File launcher | Drop one file outside an existing tool's drop zone, or choose Workspace tools → Open file. Review its name/type and choose an available compatible destination. |
| 34 · Shareable summary cards | Workspace tools → Summary card. Search and select up to six tickets, tasks or projects; edit the title, layout, colours and included information. Generate preview, then Download image. |
| 40 · Loading-screen styles | Appearance & motion → Website icon & arrival → Loading screen. Choose Minimal, Illustrated or Animated, then Save theme. The next real startup uses the saved style and theme. |
| 59 · Theme from image | Appearance & motion → Create theme from image. Choose a picture, review Daylight / Evening suggestions, then Preview this palette. Adjust the usual colour controls and Save theme. |

## Appearance

Logos accept PNG, JPG and WebP up to 10 MB and 40 megapixels. The app creates a bounded 96 × 96 PNG icon (up to about 48 KB). Original pictures are processed locally. Only the icon and chosen colours sync with your appearance preferences. Palette-source pictures are discarded after extraction. Theme export/import and backups include the selected icon and loading style. Theme imports are limited to 150 KB and all saved preferences are validated.

Initials contain one to three characters. The original artwork remains available. Older accounts use the original icon and animated loading without inserting new preference fields; those fields are written only when appearance is explicitly saved. The website's editable name and moving letter animation are preserved. Changing the icon still leaves the home button accessible by keyboard.

Minimal removes the scene, Illustrated keeps still artwork, and Animated uses the existing startup artwork. All preserve actual asset, account and record-loading status and the recovery controls. They do not add a fake progress delay. The on-page appearance sample is a labelled style preview.

## Files

| File | Compatible destinations |
| --- | --- |
| XLSX | Excel Report; validation with an already selected template; Go-Live issue import for the active project. |
| XLS | Excel Report; Go-Live issue import for the active project. |
| JSON, XML, TXT, IDoc | JSON & IDoc Reader where supported by the reader's parser. TXT also supports Go-Live import. |
| CSV / TSV | Go-Live issue import. |
| PNG / JPG / WebP | Screenshot guide. |
| PDF | TNG statement extractor for supported statements. |
| Any original file | Google Drive upload form, when Drive is already connected. |

The launcher shows only destinations permitted for the account. Setup requirements and per-tool size limits disable unavailable choices with a reason. It passes the original File to the existing reader; imports and issue mappings keep their normal review steps. Analysis does not upload the source to Supabase. The Drive option fills the existing upload form; its Upload button is still required.

The launcher asks before leaving open editors or unsaved theme, note, validation and Go-Live drafts. Existing dedicated drop zones keep their behavior, and dragging tasks/dashboard widgets does not activate it. Account changes clear pending file references and dialogs.

## Summary cards

Cards are local snapshots of explicitly selected records. Each selected feature needs both View and Export permissions. Tickets use the identifier, description and status; tasks use the task, remarks/reference and actual completion/board status; projects use the name, current phase and next milestone. PIC and dates are included where maintained and selected. Ticket history and other unselected fields are not exported.

Choose Landscape or Portrait, Evening or Daylight, and PNG or JPG. The image has a date, workspace name, distinct record panels and a footer. Text wraps at words, with a visible ellipsis and excerpt notice for long text. Selection is limited to six per image to keep the result readable; the full records stay unchanged. Landscape images are 1920 × 900 for up to three records or 1920 × 1200 for four to six; portraits are 1200 × 1600.

The preview and download use the same image bytes. Changes to options, selected records, permissions, account or Privacy mode invalidate the prepared export. Privacy mode prevents card generation/download. Nothing is sent automatically and card generation does not write records to the database.

## Verification

- Module/database suite: 933 tests passed.
- Focused application checks cover branding save/backup/account reset, theme preview/import, settings and Quick add permissions, startup appearance, grouped command navigation, draft-safe file routing, revoked destinations, selected card exports and stale asynchronous rendering.
- Browser checks use an isolated sample account: actual logo and palette image selection, theme save, Excel workbook handoff, keyboard command execution, and generated image download. No real account records or Drive uploads are used for QA.
