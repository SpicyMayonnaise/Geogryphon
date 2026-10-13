# Geogryphon (Endless Geography Trivia)

A browser geography game with three modes: **Flag** (identify flags), **Map** (find a country on the map) and
**Country Trivia** (capital, language and population questions answered on the map). Plain HTML/CSS/JS:
no framework, no bundler, no server. The only external code is amCharts (map) loaded from a CDN.

## Running and building

- Run: open `index.html` in a browser. Map and trivia modes need internet for amCharts; flags need it for images.
  Fonts (Fredoka, Nunito) come from Google Fonts; offline the game falls back to `system-ui`.
- Preview server: `node .claude/serve.js` serves the folder on http://localhost:8765 (`.claude/launch.json`).
- One-file build: `python3 build_single.py` writes `geogryphon_single.html`. It is generated, so never edit it by hand.
  Python is not installed on the main dev machine, so `geogryphon_single.html` is stale (pre-V14) until rebuilt.
- There is no test runner. Checks are plain Node scripts in `tools/` (exit 1 on failure):
  - after CSS edits: `node tools/check-tokens.js` (no hardcoded design values) and `node tools/contrast.js` (WCAG AA)
  - after JS edits: `node --check <file>`, `node tools/test-tokens-js.js`, `node tools/test-answer-states.js`
  Then play each mode once in the browser. For logic changes, test with a stubbed DOM and stubbed `MapView`
  rather than loading amCharts.

## Design system ("Arcade", V14)

- Tokens live only in `css/style.css` `:root`: colours, `--font-*`, `--fs-*`, `--fw-*`, `--r-*`, `--s-*`, `--press`.
  Everything else in the CSS references them; `tools/check-tokens.js` enforces it (no hex/rgb/hsl, no raw
  radius, font size, weight or padding/margin/gap outside `:root`, no `font` shorthand).
- JS never hardcodes colours: use `token('name')` (CSS value) or `tokenHex('name')` (number, for amCharts) from
  `js/util.js`. `MapView` reads its palette once when the chart is built.
- Components and their CSS: Button `.btn` + `.btn-primary|-secondary|-ghost` (one primary per view), Answer tile
  `.answer` + `.is-correct|.is-wrong`, Chip `.head .kicker`, Stat `.stat`, Segment `.difficulty label`,
  Card `.card/.settings/.mode/.modalin/.studyInner`, Map control `.mapControl`. Pressable things have a 4px bottom
  edge (`box-shadow: 0 4px 0 var(--edge)`) that squashes to 2px on press.
- Figma source of truth: "Geogryphon Arcade" https://www.figma.com/design/Ia8PpWANBjPKIOeq7qjSBe (variables
  collection `Arcade`, text styles, components, reference screens). Change a token in Figma and CSS together.
- Spec and plan: `docs/superpowers/specs/2026-10-13-arcade-design-system-design.md`,
  `docs/superpowers/plans/2026-10-13-arcade-design-system.md`.

## Layout

Scripts are classic `<script>` tags, not ES modules, so the game works from `file://`. They share one global
scope, and **load order in `index.html` matters**.

| File | Purpose |
|---|---|
| `js/util.js` | `$`, `setText`, `show`/`hide`, `shuffle`, safe storage `LS`, `showReaction` |
| `js/data/countries.js` | Bundled country rows and the expertise tiers (the data source of truth) |
| `js/data/flag-study.js` | Study Mode flag-meaning text. Large, data only: do not read it whole |
| `js/countries.js` | Builds `DATA` from the rows, the pools per mode, optional population refresh |
| `js/flags.js` | Flag image loading with fallback sources; Study Mode helpers |
| `js/questions.js` | Trivia generator (`QUESTION_TYPES`) and the category-weighted picker |
| `js/map.js` | `MapView`: the only file that touches amCharts |
| `js/scores.js` | Local top-10 leaderboard in localStorage |
| `js/game.js` | State machine, clock, answering, win/lose flow |
| `js/main.js` | Wires buttons and keys to the game; starts the optional refresh |

## Game state machine (js/game.js)

`idle -> loading -> asking -> between -> loading ...` (right answer)
`asking -> revealing -> over` (lost); `revealing -> study -> over` (Flag mode with Study Mode on).
Anything can fall back to `idle` (menu) or restart at `loading`. Invalid jumps are ignored and logged.

Rules to keep:
- Change state only with `setState()`. Accept answers only while `state === 'asking'`.
- Use `later(fn, ms)` for delayed game callbacks, never bare `setTimeout`, so they are cancelled when a run ends.
- Every `await` in game flow must re-check `stale(rid)` before touching the game.
- Game code talks to the map only through `MapView`, so it can be stubbed in tests.

## Map controls (js/map.js)

- The amCharts logo stays visible (`KEEP_AMCHARTS_LOGO = true`): the free licence requires it.
- amCharts' own wheel zoom is off (`wheelY: 'none'`). `onWheel` zooms in proportion to the scroll distance
  (one 100px notch = one `ZOOM_STEP`) and ignores non-cancelable wheel events, which are page-scroll momentum.
- The chart is built while the map is hidden, so amCharts skips fitting the map and its drag limits end up
  centred on (0, 0). `refitIfResized()` re-fits once the map has a real size and on every resize. Without it,
  dragging down or right gets blocked when zoomed in.
- When testing in a hidden browser pane, frames are throttled (~2 fps), so amCharts animations and re-fits
  land late. Wait longer or take a screenshot before reading chart state.

## Data and question rules

- Country rows: `code | ISO3 | name | capital | continent | languages;separated | population in thousands | playable 1/0`.
  Edit them in `js/data/countries.js`.
- `playable` = the 193 UN members plus Vatican City, Palestine and Taiwan. Territories appear in Flag mode only.
- Populations are rounded estimates. Population questions skip countries within 6% of a band edge.
- Online refresh only updates populations. It must never change names, capitals, languages or `playable`.
- Trivia mix is set by `CATEGORY_WEIGHTS` in `js/questions.js` (capital 40%, language 30%, population 30%).
  New categories are a new row in `QUESTION_TYPES`.
- The "ruling method" category was removed on purpose (contested, unsourced data). Do not re-add it without a
  cited dataset.

## Code conventions

- Build DOM with `textContent` and `createElement`; avoid `innerHTML` with any data.
- All storage goes through `LS`, which never throws.
- Keep files readable: no minified one-liners.

## Known open items

- amCharts CDN scripts are unpinned (no version or integrity hash).
- Flag distractors are intentionally random (smarter look-alike choices were declined).
- Unverified: the map's `pointerover` handler resets the fill, so the hover colour (`--text-2` lavender) may never show.
- The menu layout itself (critique priority 3: mode cards as the main action, options inside cards) is not done yet.
- "Show names on hover" is on by default, which makes "Find X" easy. Left as a design choice.
