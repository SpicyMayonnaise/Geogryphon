# Geogryphon (Endless Geography Trivia)

A browser geography game with three modes: **Flag** (identify flags), **Map** (find a country on the map) and
**Country Trivia** (capital, language and population questions answered on the map). Plain HTML/CSS/JS:
no framework, no bundler, no server. The only external code is amCharts (map) loaded from a CDN.

## Running and building

- Run: open `index.html` in a browser. Map and trivia modes need internet for amCharts; flags need it for images.
  Fonts (Fredoka, Nunito) come from Google Fonts; offline the game falls back to `system-ui`.
- Preview server: `node .claude/serve.js` serves the folder on http://localhost:8765 (`.claude/launch.json`).
- There is no one-file build any more (`build_single.py` and `geogryphon_single.html` were removed on purpose).
- There is no test runner. Checks are plain Node scripts in `tools/` (exit 1 on failure):
  - after CSS edits: `node tools/check-tokens.js` (no hardcoded design values) and `node tools/contrast.js` (WCAG AA)
  - after JS edits: `node --check <file>`, `node tools/test-tokens-js.js`, `node tools/test-answer-states.js`,
    `node tools/test-flag-reveal.js`, `node tools/test-reveal-circle.js`, `node tools/test-sound.js`,
    `node tools/test-sound-wiring.js`
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
| `js/sound.js` | `Sound`: generated sound effects (Web Audio), mute; the only file that touches audio |
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

- Loss reveal (`MapView.highlight`): each answer country flashes green ↔ land colour (`FLASH_MS`, amCharts
  `animate` with a yoyo ease) and gets a dashed white ring drawn around it in the `#revealLayer` SVG over the map
  (`RevealCircles`, `circleAround`). The ring is re-projected every frame from the country's main landmass
  (`largestRing` + `trimAntimeridian`) via `chart.convert`, so it follows pan/zoom; min radius 24px, max 5 rings.
  `cleanup()` stops the flash animations and empties the layer. There is no arrow any more (removed on purpose).
- No reduced-motion handling for these animations until the game has a settings menu (user decision).

- Tiny countries: Italy's shape has no hole for Vatican City. Tiny countries get their real outline scaled up
  around its centre and are raised to the top layer (`mapGeoJSON`, `onTop`). Desktop: VA and MC to 0.2°, max
  zoom 64. Phones (`isPhone()`): every playable country under 0.35° to 0.35°, max zoom 128 (~40px at max zoom).
  No markers or circles (user rejected them).
- Portrait maps (phones) start zoomed so the inhabited world fills the height (`homeZoom`, max 4x).
- The amCharts logo stays visible (`KEEP_AMCHARTS_LOGO = true`): the free licence requires it.
- amCharts' own wheel zoom is off (`wheelY: 'none'`). `onWheel` zooms in proportion to the scroll distance
  (one 100px notch = one `ZOOM_STEP`) and ignores non-cancelable wheel events, which are page-scroll momentum.
- The chart is built while the map is hidden, so amCharts skips fitting the map and its drag limits end up
  centred on (0, 0). `refitIfResized()` re-fits once the map has a real size and on every resize. Without it,
  dragging down or right gets blocked when zoomed in.
- When testing in a hidden browser pane, frames are throttled (~2 fps), so amCharts animations and re-fits
  land late. Wait longer or take a screenshot before reading chart state.

## Difficulty and phone layout

- Free Play (`difficulty === 'free'`, `isFreePlay()`): no clock, no time penalty (a wrong map pick only says
  "Wrong! Try again"); a wrong flag still ends the run. It has its own Top 10 (score key includes difficulty).
- At 1200px and below, the page never scrolls during a run (`html/body:has(#game:not(.hidden))`), and the
  leaderboard is a bottom sheet opened by the 🏆 `#boardBtn` (`setBoardOpen` in main.js).
- Flag answer tiles: the hover ring only shows for real mouse hover, and not until the mouse moves after a new
  round (`.answers.fresh`), so it never carries over to the next round's tile.

## Sound (js/sound.js)

- All sounds are generated in code (`SOUND_RECIPES`: intensity 0..1 → notes); no audio files.
- `Sound` is silent until the first pointerdown/keydown (`Sound.unlock`, wired in `main.js`), when muted, or
  when Web Audio is missing or fails. It never throws.
- Correct uses the share of time left as intensity, wrong uses the share used (1 at a penalty that empties the
  clock). `Clock` calls `Sound.tick` every frame in the red zone (last 25%); `Sound` plays once per new second.
- Hover/click come from delegated listeners in `main.js` on `button, .difficulty label, .answer, .mapControl`;
  touch never plays hover. New buttons get sounds automatically.
- Mute: `.muteBtn` buttons and the `M` key; stored in `LS` key `geogryphon.muted`. A volume slider waits for the
  settings menu.
- Tuning by ear: `tools/soundboard.html` (local only, not committed) plays every recipe at 0, 0.5 and 1.

## Data and question rules

- Country rows: `code | ISO3 | name | capital | continent | languages;separated | population in thousands | playable 1/0`.
  Edit them in `js/data/countries.js`.
- `playable` = the 193 UN members plus Vatican City and Taiwan. Palestine was removed on purpose (does not fit the game). Territories appear in Flag mode only.
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
