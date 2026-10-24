# My Day: a little intention, a useful dashboard

My Day combines the existing dashboard with an interactive planning shelf, a focus orb,
optional visual effects, a break terrarium and a private thinking canvas. All calculations
use maintained records and rules; no AI service is called.

## A living landscape

The welcome scene is drawn locally with SVG: mountains, a river, a small cabin and a sky
that follows the local time of day. Clouds drift, water catches the light, and the night
scene has a crescent moon and stars. The landscape responds gently to scrolling and pointer
movement. Glass panels, pointer lighting, animated counters/charts and completion ripples
coordinate with the same Calm/Ambient/Playful settings in **Effects & hours**.

Sunbeams sweep across the daytime scene, butterflies flutter above the valley, and the night
sky adds aurora ribbons and occasional shooting stars. Widgets reveal as they enter view,
the focus orb has orbiting lights, and buttons respond with a ripple. Playful adds bounded
pointer sparkles. The particle switch also controls butterflies, shooting stars and trails.
Completing a priority creates a brief burst near the task, with expanding rings and a small
win message. Switching Privacy or motion settings, hiding the page or changing accounts
clears transient feedback immediately. These effects do not save account records.

**Your whole day**, **Make a plan**, **Find your flow** and **Pause & reflect** filter the
visible widgets without saving or reordering them. Choose Your whole day to see everything
again. These views reset for a different account. The welcome scene's activity and task
summaries jump to the relevant widget; Arrange dashboard is offered if that widget is hidden.

Dragging lifts a preview, moves the surrounding cards aside and highlights the destination.
A cancelled drag restores the original layout; a released drop saves once. Expand/collapse
and resizing animate between positions while retaining the existing saved sizes and order.
Decorative effects pause offscreen or when the page is hidden, and respect reduced motion,
motion off, Privacy and Present modes. The scene and its effects add no database records,
image uploads, external requests or recurring cloud saves.

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
  tasks leave the active list and priority picker immediately. Their records, daily progress
  and growing-scene blooms remain intact. Today’s intention shows the remaining count. Once
  everything is complete, a quiet success state replaces the list. Completed choices still
  count toward the existing three-priority daily limit when choosing remaining priorities.
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
- `my-day-visuals.js` and `my-day-visuals.css`: the local landscape, chapter views, glass
  panels, layout transitions, counters, chart entrances and guarded decorative effects.
- `studio.js`: existing layout and timer integration. `app.js`: standard Schedule editor adapters.
- `tests/my-day.test.mjs`: pure calculations and bounded records. My Day tests in
  `tests/app.test.mjs` cover persistence, recovery, dragging, stale forms, planning and local clocks.
  `tests/database.test.mjs` checks that the account document round-trips through existing RLS/RPC.
