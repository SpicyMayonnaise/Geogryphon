# Endless Geography Trivia (V13.1)

Open `index.html` in a browser. No install and no server needed.

The map needs internet for the amCharts scripts (Flag mode needs it for flag images). Country data is bundled.

## Layout

| File | What it does |
|---|---|
| `index.html`, `css/style.css` | Page markup and styles |
| `js/util.js` | Small helpers (`$`, `shuffle`, safe `LS` storage, reaction text) |
| `js/data/countries.js` | **Bundled country data** (one row per country) and the expertise tiers |
| `js/data/flag-study.js` | Study Mode flag-meaning text |
| `js/countries.js` | Builds `DATA` from the rows, the pools per mode, optional online refresh |
| `js/flags.js` | Loading flag images with fallbacks, Study Mode helpers |
| `js/questions.js` | Trivia question generator (`QUESTION_TYPES` table) and the category-weighted picker |
| `js/map.js` | `MapView`: everything that touches amCharts |
| `js/scores.js` | Local top-10 leaderboard |
| `js/game.js` | The game state machine, clock, answering, win/lose flow |
| `js/main.js` | Wires buttons and keys to the game, starts the optional refresh |

Scripts are classic `<script>` tags (not ES modules) so the game also works when opened straight from disk.
Order matters; it is set in `index.html`.

## Game states

`idle -> loading -> asking -> between -> loading ...` (right answer)
`asking -> revealing -> over` (lost), or `revealing -> study -> over` (Flag mode with Study Mode on).
Invalid jumps are ignored and logged to the console.

## Common changes

- **Fix or add a country**: edit its row in `js/data/countries.js`
  (`code | ISO3 | name | capital | continent | languages;separated | population in thousands | playable 1/0`).
- **Add a trivia category**: add a row to `QUESTION_TYPES` in `js/questions.js`, and a weight in `CATEGORY_WEIGHTS`.
- **Change the capital/language/population mix**: `CATEGORY_WEIGHTS` in `js/questions.js`.
- **amCharts logo**: hidden by default. Set `KEEP_AMCHARTS_LOGO = true` in `js/map.js` to keep it.
  The free amCharts licence shows the logo; removing it needs a paid licence.
- **Online refresh**: the menu checkbox. It only updates populations (World Bank, then restcountries as a fallback),
  ignores values that differ from the bundled number by more than 2x, and never changes anything else.

## Data notes

- Populations are rounded estimates (about 2024). Population questions skip countries within 6% of a band edge.
- "Playable" = the 193 UN members plus Vatican City and Taiwan. Territories appear in Flag mode only.
- Language lists are official/co-official languages, trimmed to avoid obscure or disputed entries.
