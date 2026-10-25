# Batch C — Ticket discovery, screenshot privacy and guides

Items 25 and 26 were kept on 20 October 2026; item 30 was added on 25 October 2026. All three were implemented on 25 October 2026.

| No. | Enhancement | Where and how |
| --- | --- | --- |
| 25 | Ticket twin finder | Add/Edit ticket → Similar past tickets. Matching identifiers, descriptions, codes and distinctive words surface up to six earlier cases with owner, status, match reasons and expandable history. Your ticket draft stays in place. |
| 26 | Sensitive screenshot brush | Studio → Screenshot tools → Screenshot privacy; also Ticket details → Prepare screenshot for sharing. Open, drop or paste an image; apply solid rectangle covers, a cover brush, blur, arrows and crop. Review the original, undo/redo, fit/zoom and prepare an edited PNG. |
| 30 | Screenshot guide builder | Studio → Screenshot tools → Screenshot guide builder. Add screenshots, drag steps into order or use Move step up/down, maintain the guide title and each step's title/caption. Export a paginated PDF, PNG pages ZIP or PDF ZIP. Save/Open editable guide files to continue later. |

## Ticket matching

Matching uses deterministic text rules on the signed-in account's current tickets, without AI, network requests or record changes. Searches are briefly debounced and the bounded index is rebuilt after records change. Exact descriptions and ticket identifiers rank highly; shared meaningful words/codes also match. Results explain the shared terms, rather than presenting a confidence percentage. They are suggestions for the user to assess, not proof of duplicate issues. Editing excludes the current ticket. History and user text stay escaped; the existing ticket save, status, milestone and history flows remain in charge.

## Screenshot workflow

The editor fills the browser window. Choose a tool and drag on the screenshot. **Move** permits scrolling/panning, including touch scrolling on phones. Brush size and colour apply to marks; arrow strokes use a finer width. **Crop** chooses the exported area. **Compare original** is only an editing view: exports always contain the current edits and crop. Solid covers replace pixels in the exported image; blur softens detail. Originals remain available in the draft. **Add edited image to a guide** transfers a flattened image with its title/caption.

PNG exports contain the edited image. Guide PDF/PNG pages also contain step numbers, titles and captions. Long captions continue onto extra numbered pages. PDF text is rasterized for Unicode font compatibility and is not selectable. Prepare the file, then select its explicit download link. PDF ZIP is available for browsers that intercept a direct PDF download.

Images and guide drafts stay in this tab while signed in; they do not sync to Supabase or appear in account backups. Closing the editor keeps the current local draft. **Save editable guide** downloads a `.workhub-guide.json` file; **Open editable guide** restores its steps and edits atomically after validation. Editable files contain original images as well as annotations: use the exported PDF/PNG for sharing. Replacing a local draft never changes cloud records. Account changes and leaving the page clear local images, drafts and ready links; pending file operations are cancelled.

## Limits and verification

Inputs: PNG, JPEG or WebP, at most 8 MB and 12 megapixels each, normalized to a maximum edge of 1,800 pixels. Guides: up to 24 steps, 12 million combined normalized pixels, 18 million image-data characters, 200 annotations per screenshot and 120 export pages. Editable imports are limited to 24 MB and accept only embedded raster images, bounded coordinates and plain text. Unsupported/corrupt inputs are rejected before replacing the current draft. Image dimensions are checked before decoding. No new dependency, database migration or authentication change is added.

`batch-c-engine.js` owns matching and document limits; `batch-c-files.js` owns local decoding, flattening and exports; `batch-c.js` owns Studio/editor integration and account cleanup; `batch-c.css` owns the responsive layout. Automated tests cover matching, draft preservation, escaping, local save/reopen, sorting, remove/restore, cover/crop/undo, export pagination and account changes. Native canvas checks verify replaced cover pixels and actual PDF/PNG/ZIP bytes.
