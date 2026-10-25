# Wishlist and ticket workspace

## Latest wishlist batch

The two prioritised items are implemented: **TNG PDF extraction and cropped evidence downloads**, and **continuous Troubleshooting Lab result animations with saved-result autoplay**. See [the usage guide](docs/TNG-AND-LAB.md).

The Momo behaviour enhancements in [Batch B](BATCH-B.md) are implemented, including the later weather consequences, visitor friendships and click-reaction selections. [Batch C](BATCH-C.md) is implemented: 25 · Ticket twin finder, 26 · Sensitive screenshot brush, and 30 · Screenshot guide builder. See its usage and local-file notes before sharing an editable guide.

[Batch D](BATCH-D.md) was kept on 25 October 2026: **4 · Interactive process decisions**, **7 · Personal reminder rules**, **10 · Sync health centre**, **42 · Presentation control panel**, **97 · Private presentation annotations**, **193 · Day-to-night atmosphere**, **196 · Companion habitat**, and **198 · Expressive completion moments**. These are wishlist selections; implementation has not been requested.

[Batch E](BATCH-E.md) was kept on 25 October 2026: **51 · Work handover mode**. These are wishlist selections; implementation has not been requested.

[Batch X](BATCH-X.md) remains saved for later: each user connects their own Supabase project, and QR downloads for Process Hub PDF / image exports. QR downloads were kept on 25 October 2026; implementation has not been requested.

On 20 October 2026, Request inbox, End-of-day ritual, Personal learning roadmap and Show-me-how walkthroughs were removed from the wishlist at the user's request.

## Pending stand-up enhancement

Kept on 21 October 2026: **2 · Waiting on** — add a field beside project items and sub-items in the Daily stand-up summary to record who needs to respond, such as the business team, ABAP, BASIS or a named person. This is a wishlist selection; implementation has not been requested yet. No batch assigned.

## Pending reporting enhancement

Kept on 21 October 2026: **1 · Stand-up Briefing Builder** — prepare a ready-to-copy report from project updates, grouped into completed yesterday, working on today, blockers and decisions needed. Preview and edit the report before copying it to Teams or email. This is a wishlist selection only; implementation has not been requested. No batch assigned.

## Pending go-live enhancement

Kept on 21 October 2026: **42 · Go-live support cockpit** — a focused command centre for go-live days, bringing together critical issues, business contacts, upcoming checkpoints and the latest updates, with prominent alerts for urgent work. This is a wishlist selection only; implementation has not been requested. No batch assigned.

## Material Explorer and solution workshops · implemented

Approved on 21 October 2026, including the final **41 · Physical flow vs document flow** selection. All 14 selected enhancements from this discussion are implemented in Solution Studio; see [the usage guide](docs/MATERIAL-EXPLORER.md).

| Selection | Where to use it |
| --- | --- |
| 1 · Help me choose wizard | Material explorer → Help me choose. |
| 2 · Interactive behaviour cards | Material explorer → Attributes & behaviour. |
| 3 · Change-and-compare sandbox | Apply a reference to a trial or change simulator inputs; Before & after uses the same sequence. |
| 4 · Configuration dependencies | Material explorer → What controls this? |
| 5 · Material-master preparation checklist | Material explorer → Preparation. |
| 16 · Business discovery interview | Discovery interview → preview answers → Create draft process. |
| 17 · Visual warehouse sandbox | Simulator → drag stock or use Transfer to move between the two locations. |
| 18 · Unexpected-event scenarios | Simulator → Introduce a complication. |
| 23 · Explain at three levels | Design tools → Business user / SAP consultant / Finance. |
| 25 · Animated accounting companion | Simulator → inventory, consumption, GR/IR and price-difference panels. |
| 28 · Business-rule cards | Design tools → Business rules; links appear on current-process steps. |
| 29 · Consultant handover pack | Design tools → Preview handover → Download printable HTML. |
| 38 · Workshop presentation board | Present workshop → five stages with live simulation and private notes. |
| 41 · Physical flow vs document flow | Simulator → Physical flow / Document flow / Both together. |

These numbers belong to the Solution Studio discussion and are separate from Batch C. The release also adds the requested material-type reference catalogue, maintained custom profiles and stronger scoped visual effects. Other unselected ideas remain outside this release.

## Earlier completed selections

The seven selected items are now part of the existing account document. The tracker keeps its current sign-in, saving, backup and restore workflows. No database migration is needed.

| Selection | Where to use it |
| --- | --- |
| 11 · Reusable response snippets | Open **Snippets → New snippet**. Save a title, category and reusable wording. Write changing details as `{name}`, `{ticket}` or your own `{placeholder_name}`. |
| 47 · Work timeline | Open **Timeline** on a ticket, task, project item or knowledge card; project context also provides it. Filter status changes, work sessions, pauses, dependencies or other updates, and expand an event to inspect before/after values. |
| 60 · Snippet bundles | Use **Snippets → Manage bundles** to organize messages by workflow. Removing a bundle keeps its messages unbundled; Undo restores the grouping unless a message has since moved. |
| 63 · Reference combination checks | In **Validation Studio → Conditions**, choose **combination exists in reference**. Select a reference and map 2–10 distinct upload fields to reference columns. All mapped values must match the same reference row. Include the highlighted issue field in the mapping. |
| 79 · Reusable field definitions | Open **Field library** from the column designer, or **Reusable field library** in Settings. **Keep this field** saves a selected column's type, limits, values, aliases and instructions. Inserting creates an independent copy with a unique name. Later library edits leave inserted columns and published versions unchanged. |
| 84 · Reference value explanations | Add a reference list, then choose its code column, optional display-name column and up to five description columns. After a check, **Reference details** beside a row shows matched code meanings. Reports include a **Reference matches** sheet when these columns are configured. |
| 141 · Snippet copy formats | Choose **Plain text**, **Email layout (rich text)** or **Ticket comment (Markdown)** in the composer. Fill all placeholders, review the preview, then copy. Rich email copying falls back to plain text when unavailable; if the clipboard is blocked the preview can be copied manually. |

**Use a snippet** from a record fills known ticket/task/project, system, client, transport, status, priority and PIC details where available. Unknown recipients, dates and scenario details remain empty. It never sends a message. Composed values and clipboard previews stay in the browser; only saved snippet definitions sync.

Tickets now feature a distinct latest-update panel, ownership line, delivery progress and clear actions. **View details** separates the latest update, interactive milestones, written history and ticket facts. **Edit Ticket** groups all existing fields into essentials, ownership/progress, delivery/effort, and history/timestamps, followed by **Work Context**. Existing status, milestone, history timestamp and context-save behavior is preserved.

## Timeline scope

The timeline records future record edits, milestone changes, context changes, dependency updates, task prerequisites, saved sessions, and pauses/resumes. It also displays existing dated creation, status and session records. It does not manufacture dates for older undated work or parse arbitrary history prose into purported audit events. It retains up to 12,000 recent recorded events within a 2 MiB timeline size limit; the timeline displays a notice after older events roll off. Long before/after text is shortened with an explicit label; the original record text remains intact. Backups include the retained timeline.

Reference matching follows each upload field's trimming, case and type policy. Keep codes as Text to preserve leading zeros. If several reference rows match, up to five are shown per mapping with the full match count; the app does not choose a preferred meaning. Excel exports cap reference matches at 10,000, with an explicit truncation entry in Run details. Uploaded data remains local and only validation counts are saved, as before.

The [example workspace](https://losthaidid.github.io/mm-tracker/tests/wishlist-preview.html) uses sample records held in memory, resets on reload and has no connection to an account. It exercises the production snippet, field library, timeline, ticket-layout and validation modules. Account saving, restoration and ownership are tested against the main application and database contract.

## Verification

Run `npm test` for the application, engine, Excel and database tests. The command gives the Node test process a 6 GiB maximum heap for the full JSDOM suite; this is a test-runner setting and does not change browser memory limits.
