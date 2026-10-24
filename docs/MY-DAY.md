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
sky adds occasional shooting stars. Widgets reveal as they enter view,
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
The duplicate My Day Focus timer widget is retired: an old saved timer widget becomes the
Focus orb, or is removed if an orb already exists. An existing orb keeps its position and size.
The shared countdown engine, floating Focus mode and Studio’s Focus room remain available.
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

The Break terrarium opens a full-viewport animated glass garden with Rest your eyes, Stretch
and Step away modes. Starting it pauses a running work timer and active focus countdown and
pauses the work Soundscape. The garden has a countdown, progress, pause/resume, an explicit
End break early control, rest music and music volume. The alarm is always enabled.

Rest has three original, locally synthesized soundscapes: Cloud garden, Moonlit tide and
Rain on leaves. These use pads, bells and gentle nature textures, with no focus beat. Rest
music begins with the break button; its track, volume and music preferences stay on
the device separately from the work Soundscape. Playback failure leaves the timer usable
and offers Retry sound. No audio files, cloud uploads or AI service are used.

At zero, rest music stops and a continuous looping alarm rings while the completion view
remains open. There is no silence or dismiss control: **Resume work** stops the alarm, closes
the view and resumes only matching work/focus timers that
were running before this break, plus a previously playing work Soundscape. The alarm has an
independent gain, so rest music volume zero, music off and older chime-off preferences do not
mute it. Its audio source loops independently of JavaScript timer ticks. Previously paused
or replaced timers stay paused. Ending early or pressing Escape leads to the same explicit
resume step without an alarm. Timers exclude the break and pause gaps.

Breaks stay in memory while the website is open, with no recurring cloud saves. Deadline
checks also run on visibility changes; account changes and leaving the page stop rest audio
and clear the view without resuming another account’s work. Animation follows Calm, motion
off and reduced-motion preferences. The rest view’s sound controls are separate from My Day
priority celebration sounds.

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
- `rest-room.js` and `rest-room.css`: immersive break lifecycle, accessible full-screen view
  and explicit work resumption. `rest-audio.js`: original rest-only soundscapes and chimes.
- `studio.js`: existing layout and timer integration. `app.js`: standard Schedule editor adapters.
- `tests/my-day.test.mjs`: pure calculations and bounded records. My Day tests in
  `tests/app.test.mjs` cover persistence, recovery, dragging, stale forms, planning and local clocks.
  `tests/database.test.mjs` checks that the account document round-trips through existing RLS/RPC.


## Site-wide spectacle

The default motion experience includes orbiting lights, drifting
particles, comets, illuminated moving panel borders, page arrivals, pointer trails and click
shockwaves across all twelve primary sections. Forms and saved drag coordinates remain stable.
My Day adds independently swaying trees, racing river currents, expanding water rings, windblown
leaves and stronger clouds, wildlife, sunlight and smoke. The rest garden adds orbiting lights,
moon drift, water rings and stronger plant and firefly movement.

Effects are local decorations. Feedback is capped, offscreen panel borders pause, disconnected
panels are unobserved, and hidden pages release interaction effects. Motion Off, device reduced
motion, Privacy and Present suppress the spectacle. My Day Calm still stops its scenery. No
animation writes records or changes the existing drag, resize, timer or form actions.


Aurora layers have been removed from the global overlay, My Day night sky, rest garden and
storybook window on every device. Their markup, blur styles and animation loops are removed.
The weather selector offers seven choices; old saved aurora choices fall back to random weather
locally. Trees, water, wildlife, particles and the other existing animations remain.

## iPhone rendering budget

`render-profile.js` runs in the head before feature styles. Only an iPhone user-agent or
`navigator.platform === 'iPhone'` selects the lighter path; iPad, Android and desktop browsers
retain the full effects even at narrow window widths. The selection is local and does not
rewrite account preferences. `iphone-motion.css` is gated by that early profile.

On iPhone, global decoration creates one orbit, twelve particles
and two comets. Click feedback is capped at 28 nodes and panel glints at six intersecting panels.
Small travelling glints replace oversized masked rotors. Whole-page filter/arrival animations,
3D widget tilt, animated panel shadows and backdrop blurs are removed from this profile. Moving
trees, river currents, ripples, wildlife and terrarium plants/lights remain. Privacy text blur,
motion-off/reduced-motion controls, drag coordinates, records and the break alarm are preserved.

The profile and computed styles can be tested in a simulated iPhone browser path; this does not
measure real iPhone GPU memory or establish that a particular device crash is resolved.

Music playback gain is higher for both focus tracks and all three rest tracks at the same slider
positions. Focus music keeps the existing output compressor; rest music retains full-volume
signal headroom. Volume zero, mute, pause, separate focus/rest preferences, and the alarm's
independent gain and explicit Resume work behavior are retained.


## Break shortcut

The shared toolbar has **Break Terrarium** immediately after **Focus mode** on every section.
It starts the same full-screen rest session using the saved break length in **Effects & hours**.
An existing break opens again without resetting it. The shared work/focus pause, rest music,
repeating alarm and explicit **Resume work** behavior remain in the same rest controller.
The shortcut returns focus to itself after resuming and is hidden when signed out.

## Rendering performance

Decorative panel discovery scans the document once when motion starts or resumes. Later DOM
updates inspect only added branches and release observers for removed cards. Small text updates,
feedback particles and unrelated body state no longer rescan every panel. Newly opened dialogs
are included. Existing feedback counts, navigation, motion guards and account data are preserved.

Animated panel borders use a sliding gradient at twice the card width and one card height,
instead of a rotating texture at 4.6 times both dimensions. Their breathing effect animates the
border opacity instead of repeatedly repainting card shadows. Section arrivals animate headers
without a full-page blur. My Day glass cards retain gradients and lighting while avoiding live
backdrop sampling; only the hovered card uses 3D tilt. Soft page colours use radial gradients
without blur, and river shimmer uses opacity alongside the moving currents and ripples.

Offscreen scenery pauses its own animation and decorative pseudo-elements. The break dialog
pauses the covered workspace while its visible plants, water and lights continue to move.
Pointer lighting reads geometry before writes, updates the current card, and scopes parallax
variables to the landscape header. Clocks and unchanged labels avoid redundant DOM writes.

In a fictional-account browser preview, 20 small content updates caused 20 document scans and
720 panel matches before these changes, and zero document scans or panel matches afterward.
This measures decoration work, not a frame-rate guarantee or physical iPhone performance.
