# Workspace layout and widgets

The 2026-11-07 layout renewal covers the signed-in workspace across all fifteen sections and all seven website designs. It retains the selected account theme, real navigation controls, record editors and data engines.

## Shared layout

- Individual website-name letters have a staggered floating animation. Renaming the website rebuilds the animated letters from the saved name, preserving combined emoji and accented characters; ordinary renders keep existing letter nodes. The shorter, sticky brand header combines the saved site name and animated identity with the save indicator and Settings. Export Excel report is searchable in Settings → Backups & sync and closes Settings before opening the original report options. The left sidebar stays below the measured header; it scrolls independently when its controls exceed the viewport.
- The command bar keeps Search, Quick add, Reminders, Focus mode and Break Terrarium directly accessible. Workspace tools groups secondary commands without cloning them or changing their handlers. Undo actions stay directly accessible. Escape closes the menu and restores focus to its summary.
- Page introductions, summary tiles, task/ticket cards, tables, calendars, notes, file panels, validation cards and Studio tools share spacing, surface and heading rules. Compact density and navigation identities remain available.
- My Day uses a responsive twelve-track widget grid: normal widgets occupy half the workspace, three columns on very wide displays, and one column on phones. Wide/expanded widgets retain full width. Saved order, sizes, visibility, drag handles and existing actions are unchanged.
- My Day's landscape artwork, scenery palette and animation implementation are unchanged. The garden, orb and terrarium retain their illustrated content. The screenshot builder's controls follow the website theme; its document colour and header choices remain independent.

## Process Hub

The canvas, stage bars, inspector, step palette, playback controls and private presentation tool bubbles use theme tokens. The former dark-green local override no longer replaces the website's saved palette. The grid, selected-step glow, branch colours, connector motion and futuristic control arrangement remain.

Theme changes update CSS without replacing process nodes, draft forms, canvas coordinates or playback state. User-maintained annotation colours and public presentation/export palettes remain owned by their renderers.

## World window

The original `hubAtmosphereCard` is back in the left sidebar, after navigation and before the Small steps note. The same SVG, live caption, local clock, weather/scenery metadata, visitors and settings action are retained. No enlarged header scene or floating copy is created.

- Click the original scene to open Atmosphere & visitors, as before.
- Each website design retains its existing scenery visibility rules, including compact/mobile alternatives.
- Atmosphere Off, sign-out and the existing privacy/focus/presentation modes keep their established behavior.

The header height is measured on layout changes and resizing, so wrapped titles and responsive layouts cannot leave the sticky sidebar under the header. There is no scroll event handler.

No new timers, rendering loops, dependencies, database fields or network calls are added.

## Source and verification

`workspace-redesign.css` loads after feature/design sheets and before `custom.css`. `world-window.js` loads before `website-designs.js`; the design adapter restores the sidebar scene, measures the header and groups commands while retaining their original DOM nodes. `process-workspace.css` defines the Process Hub palette through existing theme tokens.

The focused module and application checks cover the restored scene placement, retained artwork/clock/listeners, Atmosphere Off and sign-out, Excel export from Settings, all website designs, theme changes, and unfinished editors. Browser QA uses an isolated account fixture with no real records or network saves; header and sidebar positions are checked before and after scrolling.
