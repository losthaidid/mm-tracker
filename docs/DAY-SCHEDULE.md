# Automatic daily Schedule

A scheduled booking describes a work allocation, not the lifecycle of its task, ticket or project. Existing booking IDs, daily ranges, claims, leave and reference data are preserved. This release replaces execution status dropdowns with derived badges.

| Daily state | Trigger |
| --- | --- |
| Planned | Before that day's start. |
| Active | During the planned range, or while a matching timer continues beyond its end. |
| Paused | The matching timer is paused or a different work timer is interrupting the range. |
| Actual | The daily session ended, or an explicitly stopped matching session finished early. |
| Partial | Recorded interruptions or pauses consumed part of the planned allocation. |
| Changed | Another recorded activity covered the entire planned allocation. |
| Moved / Cancelled | A booking's range was moved or it was explicitly removed; its original daily snapshot remains in history. |

Task completion, ticket closure and project phase are not inputs to these badges. Legacy saved activity statuses remain in the document for compatibility but no longer control daily execution. Leave retains its maintained approval status. Clock-driven project completion prompts are removed.

## Plan-following and tracked time

With no recorded deviation, the clock follows the plan: Planned → Active → Actual. **From plan** is shown in the badge tooltip and booking details. It is an assumption, not a recorded timer or billable duration. Tracked work is stored separately, keeps real intervals, and is labelled Tracked. The calendar retains the original plan and adds dashed actual-work cards. Actual work panels total tracked time only.

For a 09:00–12:00 booking A and an unexpected 10:00–11:00 activity B:

- B starts: A becomes Paused; B is Active.
- B stops: B is Actual; A resumes Active while its remaining planned window is open.
- At 12:00 A becomes Partial, with one hour of recorded interruption and two hours of plan-following time.
- If A's matching tracked work makes up the lost hour afterward, the final outcome can be Actual. A matching running timer remains Active during the overrun.

The work timer resumes only through its normal Resume action; automatic return to a planned slot is a Schedule inference and does not fabricate tracked intervals. Stop and switch use timestamp boundaries so no two recorded sessions count the same time. A failed save leaves the original timer paused and recoverable. A zero-time switch discards only an empty draft.

## Unlisted work and later maintenance

In Start / switch work, select Ticket or Project, then Unlisted work. A short work title is enough; optional name, company and reference remain available for later maintenance. The account's device recovery copy preserves a running timer across refresh. Stop & save persists the actual session through the existing private record document.

Link / maintain allows selecting an existing ticket/project or creating one with prefilled captured details. New projects created from this path do not take over Current project. Choose a company maintained for the selected project; another project's company is rejected. The project charge code is attached when linked. Creating/linking does not complete the parent record or move the recorded work to today's date.

The captured execution identity is preserved separately from later reporting links, so linking an unexpected session to a project cannot rewrite a prior Partial outcome. Record forms and linking are account-scoped and reject stale sessions/forms.

## Earlier work, history and compatibility

I switched earlier accepts an actual past start/end and work description. It recalculates the timeline without editing status badges. Overlapping actual sessions, future end times and reversed ranges are rejected. Existing plans can overlap actual intervals intentionally. Calendar minute ranges remain minute-precise; timer durations retain seconds and exclude pauses.

New actual sessions are not inserted into the reservation grid or duplicated into project plans. Related project Work history and calendar cards derive from the same actual records. Legacy stopwatch reservations continue to render as Actual and are not duplicated by the new actual layer.

Archiving keeps tracked time in reports. Deleting a modern session retains a bounded Schedule snapshot; its actuals and historical outcomes remain available. Undo restores the session without double-counting it. Moved/cancelled snapshots are bounded and included in backups. The existing account reset clears the new collections too.

No network request, record mutation, new animation loop or per-tick database write is needed to change a clock-derived badge. Existing Schedule refresh runs update the visible badges; timer events refresh actual cards immediately. The existing private document save/RPC, version 9 backup, conflict handling, authentication and ownership policies remain unchanged.

## Verification

Focused application checks cover automatic progression, independent parent statuses, switching, empty and retrospective switches, unlisted ticket/project creation, scoped companies, cloud/backup reopening, calendar/grid/project projections, safe retained history, and stale account/form guards. Pure tests cover interval unions, pauses, overtime, day boundaries and preserved execution identity. Existing leave, claims, minute scheduling and account-reset checks are retained.

## Booking selections and claims

New Task selections list unfinished, unarchived tasks. An existing booking for a task that was completed later retains a read-only saved-task summary; its notes and dates can still be edited, or Choose another unfinished task replaces the link. Completing a task never removes the historical booking. A task completed while a new booking is open cannot be newly scheduled by submitting the old form.

The Company picker supports searchable checkboxes, Select all and Clear. For project bookings it uses the chosen project's active companies. Select all snapshots the currently available companies; a company added afterward does not rewrite earlier bookings. Saved inactive/deleted company names remain available in historical bookings. Project item choices are the union of the selected companies. All selections remain one booking and one duration, with one mileage visit per date. Project calendar edits, backup and cloud reopening retain the company selections.

Choosing Office immediately hides and disables claim type, destination, one-off destination and route inputs. Switching back before saving restores the visit draft. Saving Office clears the booking's mileage and one-off claim destination; separate saved receipts remain in their existing ledger.
