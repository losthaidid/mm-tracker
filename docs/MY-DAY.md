# My Day: a little intention, a useful dashboard

My Day combines the existing dashboard with an interactive planning shelf, a focus orb,
optional visual effects, a break terrarium and a private thinking canvas. All calculations
use maintained records and rules; no AI service is called.

## Keep your layout

The upgrade retains existing widget order and normal/wide sizes. The Day journey,
Today’s three priorities, Focus orb, Break terrarium and Thinking canvas are appended once.
Use **Arrange dashboard** or **Choose widgets** to show or hide any old or new widget.

Drag each widget’s dotted header handle with a mouse or touch. Its arrow moves it upward;
arrow keys on the handle move it up/down. Resize toggles normal/wide. Expand opens it across
the dashboard temporarily, and Collapse returns it to its saved size and position.

## Plan, work and review

- **Start my day / Review my plan:** choose up to three real tasks and an energy level.
  Capture the current schedule as a baseline; replacing an existing baseline is explicit.
- **Day journey:** open activities from the agenda. Drag an activity’s own time handle onto
  the hour rail to open the standard Schedule editor with a proposed time. Saving uses
  existing overlap, company, leave, project and record validation. Clicking the time handle
  also opens that editor. The dashboard itself is not rearranged by an activity drag.
- **Today’s three priorities:** complete a task through the existing task workflow. Completed
  priorities remain visible for the day and contribute to the growing scene.
- **Workload balance:** explore scheduled tasks, projects, other activities, unavailable time
  and free time. Select a category for the underlying activities. Working hours are maintained
  in Effects & hours; overlapping legacy intervals are counted once.
- **Up next:** browse remaining scheduled activities, open them or review a new time.
- **Match your energy:** maintain a task’s estimated remaining minutes and effort. The picker
  filters open, unsnoozed tasks by those values. An unmaintained task defaults to 25 minutes
  and Steady effort, clearly labelled as an estimate.
- **Find a little room:** choose available minutes and review matching tasks. Fit into my day
  opens the normal Schedule editor for the earliest remaining opening. It never silently
  creates a booking, and the editor rechecks overlaps before saving.
- **Plan & reality:** compare the captured plan with saved work sessions. Replay the day with
  the time slider; select a bar for details. Recorded intervals retain their pause gaps.
  Recorded totals use active time, including archived sessions, and are clipped at local
  midnight. Older sessions without interval details show their overall start/end span.
- **Close my day:** keep a short reflection and optionally change selected unfinished priority
  tasks’ due dates. Calendar bookings retain their existing dates.

## Focus, breaks and effects

The Focus orb uses the existing focus countdown, including adjustable duration and pause/resume.
A focus countdown does not itself create a work session. Use **Track work** to record work time
for the existing session history and Plan & reality.

The Break terrarium offers Rest your eyes, Stretch and Step away. Starting it pauses a running
work timer and active focus countdown. Resume those separately when ready. Breaks can be paused,
resumed or ended; their clocks stay in memory on the current device and reset on reload/account
change. Clock ticks do not save cloud records.

Effects & hours maintains Calm/Ambient/Playful styles, particle and priority-celebration switches,
working hours and a 1–60 minute break length. Preview controls before saving. Sound is off by
default and also requires the website’s sound preference. Effects respect reduced motion, the
website’s motion-off setting, Privacy and Present modes. The growing scene links its plants to
selected priorities.

## Thinking canvas

1. Add an idea with a title, notes, colour and optional group.
2. Move cards using their own dotted handles, or arrow keys (Shift moves farther).
   Positions save once on pointer release; cancelled drags do not write records.
3. Connect two ideas, and manage or remove their connections. Filter by a maintained group.
4. Select one or more ideas, then choose Create tasks and review the list. Each idea creates
   one normal editable task containing its notes, while retaining the source idea and link.
   Already-linked tasks are skipped, so repeating conversion does not create duplicates.
5. Open a linked task from its idea. Removing an idea keeps its task. Canvas removals offer
   one-step undo; removing a group leaves its ideas ungrouped.

Canvas groups, ideas, connections, daily plans, estimates and effect preferences save in the
existing account document and backup. Forms reject an earlier account/day or a changed source
record. The existing conservative cloud-conflict merge remains in use.

To keep account documents bounded, My Day supports 120 ideas, 30 groups, 240 unique connections,
730 saved daily plans and 5,000 task estimates, within 1 MB of My Day records. Idea notes and daily
reflections support 4,000 characters each. No image/file bytes are stored on the canvas. Existing
Postgres tables, permissions and document version 9 are unchanged.

## Source and checks

- `my-day-engine.js`: upgrades, validation, agenda/gaps, workload, recorded intervals and idea conversion.
- `my-day.js`: widgets, forms, pointer/keyboard interactions and local clock/effect lifecycle.
- `my-day.css`: scoped visual design, responsive layouts and reduced-motion rules.
- `studio.js`: existing layout and timer integration. `app.js`: standard Schedule editor adapters.
- `tests/my-day.test.mjs`: pure calculations and bounded records. My Day tests in
  `tests/app.test.mjs` cover persistence, recovery, dragging, stale forms, planning and local clocks.
  `tests/database.test.mjs` checks that the account document round-trips through existing RLS/RPC.
