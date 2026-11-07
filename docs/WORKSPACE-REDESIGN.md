# Workspace layout and widgets

The 2026-11-07 layout renewal covers the signed-in workspace across all fifteen sections and all seven website designs. It retains the selected account theme, real navigation controls, record editors and data engines.

## Shared layout

- The brand header combines the saved site name, animated identity and live scenery with the existing save indicator, Excel report action and Settings.
- The command bar keeps Search, Quick add, Reminders, Focus mode and Break Terrarium directly accessible. Workspace tools groups secondary commands without cloning them or changing their handlers. Undo actions stay directly accessible. Escape closes the menu and restores focus to its summary.
- Page introductions, summary tiles, task/ticket cards, tables, calendars, notes, file panels, validation cards and Studio tools share spacing, surface and heading rules. Compact density and navigation identities remain available.
- My Day uses a responsive twelve-track widget grid: normal widgets occupy half the workspace, three columns on very wide displays, and one column on phones. Wide/expanded widgets retain full width. Saved order, sizes, visibility, drag handles and existing actions are unchanged.
- My Day's landscape artwork, scenery palette and animation implementation are unchanged. The garden, orb and terrarium retain their illustrated content. The screenshot builder's controls follow the website theme; its document colour and header choices remain independent.

## Process Hub

The canvas, stage bars, inspector, step palette, playback controls and private presentation tool bubbles use theme tokens. The former dark-green local override no longer replaces the website's saved palette. The grid, selected-step glow, branch colours, connector motion and futuristic control arrangement remain.

Theme changes update CSS without replacing process nodes, draft forms, canvas coordinates or playback state. User-maintained annotation colours and public presentation/export palettes remain owned by their renderers.

## World window

The existing `hubAtmosphereCard` is integrated into the brand header between the site identity and Export/Settings. A panoramic scene sits beside the live phase caption and local clock, with a subtle theme-coloured frame. The same scene SVG, labels, weather/scenery metadata, visitors and settings action are retained.

- The window stays in the header; floating positioning, drag handles and movement controls have been removed.
- Click the original scene to open Atmosphere & visitors, as before.
- Wide view enlarges the same scene in a full-width row within the header. Compact view or Escape restores the smaller header card. It never overlays the workspace.
- Tablet/phone layouts place the scene below the brand/actions and retain the complete SVG. The view resets for another account.
- Atmosphere Off, sign-out and the existing privacy/focus/presentation modes hide it. Turning atmosphere back on reveals the same window.

No new timers, rendering loops, dependencies, database fields or network calls are added.

## Source and verification

`workspace-redesign.css` loads after feature/design sheets and before `custom.css`. `world-window.js` loads before `website-designs.js`; the design adapter docks the window in the header and groups commands while retaining their original DOM nodes. `process-workspace.css` defines the Process Hub palette through existing theme tokens.

Header-window revision verification passed: 24 focused module/source-layout checks and 16 application integrations. Coverage includes docking the original scene between the brand and existing header actions, retained SVG/clock/metadata/listeners, inline wide view and keyboard return, Atmosphere Off and account isolation, all fifteen sections in all seven designs, retained My Day scenery/widgets, live weather/visitors and theme changes with unfinished work. Browser visual QA remains unavailable due to the existing browser access restriction; DOM, computed-style, engine and application checks provide the available verification.
