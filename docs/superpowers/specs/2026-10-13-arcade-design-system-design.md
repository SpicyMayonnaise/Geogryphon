# Arcade design system (UI redesign, step 2)

Date: 2026-10-13. Branch: `design-system`.

## Goal

Give Geogryphon one consistent visual language in a new "Arcade" direction, defined once in Figma and mirrored
in `css/style.css`, so later redesign steps compose shared pieces instead of hardcoded values.

Success:
- Every colour, radius, spacing step, font size and weight in `style.css` comes from a token in `:root`.
- The Figma file has matching variables, text styles and components, and 3 reference screens.
- All three modes, Study Mode and the run-over modal look like the Arcade direction and still fit one viewport
  (step 1) at 1280x800, 1366x600 and 375x812.
- All text/background pairs pass WCAG AA (4.5:1 body, 3:1 for text 24px+ or 18.66px+ bold).

Out of scope: menu restructure (critique priority 3), game logic, copy changes, light mode.

## Personality

Chunky, bouncy, bright game show. Controls look pressable (a darker bottom edge that squashes on press),
feedback is loud, the world map is the hero.

## Tokens

Colour (dark only):

| Token | Value | Use |
|---|---|---|
| `--bg` | `#1b1446` | Page |
| `--surface-1` | `#261d5e` | Cards, panels |
| `--surface-2` | `#3b2f8f` | Buttons, answer tiles, inputs |
| `--edge` | `#120d33` | Pressable bottom edge, hairlines |
| `--text` | `#ffffff` | Primary text |
| `--text-2` | `#b9b0ff` | Secondary text, labels |
| `--accent` | `#ffd23f` | Primary action, selection, timer |
| `--accent-edge` | `#c99c00` | Bottom edge of accent controls |
| `--on-accent` | `#1b1446` | Text on accent |
| `--hot` | `#ff5d73` | Mode tags, emphasis |
| `--good` | `#3ee08f` | Correct answer |
| `--bad` | `#ff4d6d` | Wrong answer, penalty |
| `--map-land` | `#4a3fb0` | Map country fill |
| `--map-sea` | `#140f38` | Map background |

Exact values may be nudged during the contrast check; any change is made in Figma and CSS together.

Type: Fredoka (headings, buttons, numbers) and Nunito (body, labels) from Google Fonts, falling back to
`system-ui` offline. Sizes: 12, 14, 18, 28, 44px (headings may use `clamp()` between scale steps). Weights:
500, 600, 700.

Shape: radius 8, 14, 24px and pill (999px). Spacing on a 4px grid: 4, 8, 12, 16, 24, 32.

Motion: press = translateY(2px) with the edge shrinking from 4px to 2px, 120ms. Existing `prefers-reduced-motion`
rule stays.

## Components

| Component | Variants / states | Replaces in current CSS |
|---|---|---|
| Button | primary, secondary, ghost x rest, hover, pressed, focus, disabled | `.btn`, `.primary`, `.again`, `#backBtn`, `.confirmSelection`, `.studyLink`, `.studyContinue` |
| Answer tile | rest, hover, correct, wrong | `.answer` |
| Chip / tag | hot, accent, neutral | `.kicker` in game header |
| Stat | default | `.stat` |
| Segmented control | option rest, hover, selected, focus | `.difficulty` |
| Card | surface-1 panel | `.card`, `.settings`, `.modalin`, `.studyInner`, `.mode` |
| Map control | rest, hover, pressed | `.mapControl` |

## Delivery

1. Figma: new file "Geogryphon Arcade" containing a variables collection (colour, radius, spacing), text
   styles, the components above, and reference screens for menu, Flag mode and Map mode. First check that the
   account (Starter plan, View seat) can create and edit files; if not, stop and report.
2. CSS: add the tokens to `:root`, replace every hardcoded value in `style.css`, apply components to existing
   HTML class names (keep HTML changes to the minimum, such as the Google Fonts link). Update `BASE_FILL` and
   related map colours in `js/map.js` and timer colours in `js/game.js` to read the token values.
3. Verify: play each mode in the browser pane at the three sizes, check contrast of every text/background pair,
   `node --check` each changed JS file, no console errors.

## Risks

- Google Fonts need internet; the fallback stack keeps the game usable offline (amCharts already needs internet).
- amCharts takes colours as hex numbers, not CSS variables: read them from `getComputedStyle` once at chart
  creation so the tokens stay the single source.
- A View seat may block Figma editing.
