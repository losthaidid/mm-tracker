# Annual leave and MC balances

## Earned and utilized TOIL

Open **Settings → Work setup → TOIL earned & utilized**, or use **TOIL earned & utilized** in Schedule's leave-balance panel. Select a year and an existing custom TOIL/replacement leave type, or create a new TOIL type with your first saved entry. AL and MC cannot be converted to TOIL. Opening the ledger and editing previews do not save account records.

Add **Earned TOIL** entries with a date, amount and optional reference/notes. Enter days directly, or choose hours and specify the working hours in a day: 3 hours ÷ 8 = 0.375 day. Fractions retain six decimal places. Add **Utilized outside Schedule** only for time not already recorded as a TOIL leave booking. Entries can be edited and deleted. The earlier leave-type **Date earned** field remains informational and does not create a credit.

TOIL cards show **Earned**, **Utilized**, **Reserved**, and **days available**. The calculation is **earned − utilized − reserved = available**. Approved TOIL bookings dated today or earlier count as utilized. Other bookings reserve days, including future approved leave and requests awaiting approval. Editing or deleting a booking recalculates usage; time fragments count once. Future-dated earned entries become available on their date, while future-dated outside-Schedule usage remains reserved until its date. Scheduled weekend work is still highlighted separately and does not automatically create earned credits.

Existing allowance and earlier-usage figures on a linked custom type become its **opening earned** and **opening utilized** totals. Manage those in Leave allowances & balances; keep dated ledger entries and Schedule usage out of the opening totals to avoid double counting. Each year remains separate. Carry over days explicitly as an opening balance or earned entry. Correcting historical credits can show a negative balance without deleting bookings; new or increased leave reservations cannot exceed the available earned TOIL.

TOIL uses the existing account document: custom types have `toil: true`, and dated `{id, date, kind, days, note}` entries are kept in each yearly policy's `toilEntries` array. No new database tables or permissions are required. Account saves, JSON backups, reloads and conservative conflict merging preserve the history. Independent dated entries merge by ID; stale editors and wrong-account saves are rejected. TOIL follows the same per-type weekdays, public holidays and hourly leave rules as other leave.

## Yearly leave allowances

Open **Settings → Work setup → Leave allowances & balances** (or search Settings for “leave”). Choose a calendar year, then maintain the allowance and **Already taken outside Schedule** for AL and MC separately. Leave the allowance blank until it is known; **0** means no allowance. Half-day steps are supported.

For a tracker started in October, enter the days already taken in earlier months in **Already taken outside Schedule**. For example, an AL allowance of 12 and earlier usage of 10 leaves 2 days before scheduled leave. Do not include days already represented in Schedule. You can revise this total later without creating historical bookings. Save each year before using **Open year** to switch years. Settings do not copy entitlements into a new year automatically.

The balance is **allowance − already taken outside Schedule − scheduled leave**. Planned, Requested and Approved leave all reserve days, including future bookings. The Schedule page, **Schedule date and time range**, and project **Plan activity** display the balances for their selected year. A leave range also previews the amount charged and the remaining balance after saving. A range crossing New Year shows each year separately.

Full days charge 1; morning and afternoon charge 0.5. Custom hours have an explicit 0.5 or 1 day charge per date. Old custom-hour bookings without that field count as a full day. Hourly fragments are grouped by booking/date, and the total per date/type is capped at 1 day. No duration is inferred from lunch breaks or elapsed hours.

Choose which weekdays count for each type/year. Initial choices are Mon–Fri for AL and every day for MC; maintain these to match your employer’s policy. Dates outside the selected weekdays are uncharged, though the chosen hours remain reserved in Schedule. Public holidays are not detected automatically. The app is a personal planner; approval and MC submission details remain in the existing leave form.

New or increased leave reservations cannot exceed a configured allowance. Editing replaces the original booking, deleting restores its reserved days, and switching leave type releases the old type. Existing overdrawn history remains readable and can be reduced or corrected. Lowering an allowance or correcting earlier usage can show a negative balance without deleting old bookings. Combined changes from different devices that exceed the allowance follow the existing conflict-review path.

Data is stored under `workhub.leaveBalances`, one stable `id` per year, in the existing private account document. It uses the existing revision-based save, recovery, backup and restore flow; there are no new tables, dependencies or login permissions. Old documents gain only an empty settings list. Opening forms and changing previews do not write records.

`leave-balance-engine.js` owns pure validation/counting/limit rules. `leave-balances.js` owns Settings and balance displays. `workspace-features.js` retains leave/MC details. `app.js` guards Schedule saves and merged pending documents. Regression checks cover entitlement arithmetic, fragments, half-days, custom leave, weekdays, year boundaries, edits, account isolation, cloud/backup reopening, invalid settings and concurrent reservations.

## Maintained leave types

Use **Settings → Work setup → Leave types** or **Schedule → Manage leave types** to add, rename, archive or restore leave types. Names and short codes must be unique. Up to 30 types are supported, including the original AL and MC identities. Archiving hides a type from new bookings; past bookings remain viewable and editable. The original medical type retains its MC-submission fields.

Each active type appears in Schedule’s type dropdown and balance panel as soon as it is saved. Open **Leave allowances & balances** to set its yearly allowance, earlier usage and counting weekdays. New types default to an unset allowance, zero earlier usage and Mon–Fri counting, all maintainable per year. Existing AL/MC balances retain their values and identities. Rename changes the type label; saved calendar titles and times remain unchanged. Backups and account saves include `workhub.leaveTypes` and the corresponding policies. There are no new database tables or permissions.

The Schedule panel shows status, remaining days, allowance, taken-earlier totals and scheduled reservations for each type. Usage bars have text descriptions, overdrawn values remain explicit, and setup buttons focus the matching allowance. Its spacing and card layout adapt to phone widths and the selected theme. Archived types with saved allowances or historical usage remain visible in the balance panel.
