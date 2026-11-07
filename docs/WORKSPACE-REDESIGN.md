# Workspace layout and widgets

The 2026-11-07 layout renewal covers the signed-in workspace across all fifteen sections and all seven website designs. It retains the selected account theme, real navigation controls, record editors and data engines.

## Shared layout

- A compact brand header retains the saved site name, animated identity, save indicator, Excel report action and Settings.
- The command bar keeps Search, Quick add, Reminders, Focus mode and Break Terrarium directly accessible. Workspace tools groups secondary commands without cloning them or changing their handlers. Undo actions stay directly accessible. Escape closes the menu and restores focus to its summary.
- Page introductions, summary tiles, task/ticket cards, tables, calendars, notes, file panels, validation cards and Studio tools share spacing, surface and heading rules. Compact density and navigation identities remain available.
- My Day uses a responsive twelve-track widget grid: normal widgets occupy half the workspace, three columns on very wide displays, and one column on phones. Wide/expanded widgets retain full width. Saved order, sizes, visibility, drag handles and existing actions are unchanged.
- My Day's landscape artwork, scenery palette and animation implementation are unchanged. The garden, orb and terrarium retain their illustrated content. The screenshot builder's controls follow the website theme; its document colour and header choices remain independent.

## Process Hub

The canvas, stage bars, inspector, step palette, playback controls and private presentation tool bubbles use theme tokens. The former dark-green local override no longer replaces the website's saved palette. The grid, selected-step glow, branch colours, connector motion and futuristic control arrangement remain.

Theme changes update CSS without replacing process nodes, draft forms, canvas coordinates or playback state. User-maintained annotation colours and public presentation/export palettes remain owned by their renderers.

## World window

The existing `hubAtmosphereCard` is moved into a larger floating World window. The same scene SVG, time label, weather/scenery metadata, visitors and settings action are retained.

- Drag the dotted title handle or use arrow keys to move it. Shift moves farther.
- Home or Reset position restores its starting placement. Escape/pointer cancellation restores the previous position during a drag.
- Minimise leaves a small title bar; Expand reveals the same scene.
- The panel is clamped inside the viewport after movement or resizing. Position/minimisation are session UI state and reset for a different account. Phone sessions start minimised.
- Atmosphere Off, sign-out and the existing privacy/focus/presentation modes hide it. Turning atmosphere back on reveals the same window.

No new timers, rendering loops, dependencies, database fields or network calls are added.

## Source and verification

`workspace-redesign.css` loads after feature/design sheets and before `custom.css`. `world-window.js` loads before `website-designs.js`; the design adapter mounts the local window and groups commands while retaining their original DOM nodes. `process-workspace.css` defines the Process Hub palette through existing theme tokens.

Verification passed: 132 focused module/source-layout checks and 32 application integrations. These cover real control identity, menu access and keyboard behaviour, retained scene/widget DOM, every section in every design, world-window movement/cancellation/account reset, theme changes with an unfinished process, Process Hub flows, My Day sorting and screenshot-builder integration. World-window bounds were checked again after the small-viewport adjustment. Browser visual QA remains unavailable due to the existing browser access restriction; DOM, computed-style, engine and application checks provide the available verification.
