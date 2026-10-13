# Arcade Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin Geogryphon in the "Arcade" direction with a token-based design system that exists both as a Figma library and as `:root` tokens + components in `css/style.css`.

**Architecture:** Tokens are defined once per medium: Figma variables, and CSS custom properties in `:root`. Everything else in `style.css` references tokens only, enforced by a Node check script. JS never hardcodes colours: a `token()` helper in `util.js` reads the CSS custom properties at runtime (amCharts gets them as numbers via `tokenHex()`).

**Tech Stack:** Plain HTML/CSS/JS (classic scripts, no build), amCharts 5 (CDN), Google Fonts (Fredoka, Nunito), Node (check scripts and preview server only), Figma MCP (`use_figma`).

**Spec:** `docs/superpowers/specs/2026-10-13-arcade-design-system-design.md`

## Global Constraints

- Dark theme only. No light mode.
- Colour tokens (exact): bg `#1b1446`, surface-1 `#261d5e`, surface-2 `#3b2f8f`, edge `#120d33`, text `#ffffff`, text-2 `#b9b0ff`, accent `#ffd23f`, accent-edge `#c99c00`, on-accent `#1b1446`, hot `#ff5d73`, good `#3ee08f`, bad `#ff4d6d`, map-land `#4a3fb0`, map-sea `#140f38`.
- Fonts: Fredoka (headings, buttons, numbers), Nunito (body, labels); fallback `system-ui, sans-serif`.
- Font sizes: 12, 14, 18, 28, 44px. Weights: 500, 600, 700. Radius: 8, 14, 24, 999px. Spacing: 4, 8, 12, 16, 24, 32px.
- Press motion: translateY(2px), edge 4px→2px, 120ms. Keep the `prefers-reduced-motion` rule.
- Contrast: WCAG AA (4.5:1 normal text, 3:1 large text).
- Step 1 must hold: during a run, nothing needed is below the fold at 1280x800, 1366x600, 375x812.
- Project rules from `CLAUDE.md`: classic scripts (no modules), DOM via `textContent`/`createElement`, no minified one-liners, `later()` for delayed game callbacks, amCharts logo stays, `geogryphon_single.html` is generated (do not hand-edit).
- CSS blocks in this plan are compacted to save space. Write them into `style.css` one declaration per line, matching the existing file.
- Game logic is out of scope. The only JS changes are colour sourcing and adding/removing presentational classes.

## Review Focus

1. Fonts fail to load (offline or blocked): text must still render in the fallback stack with no layout breakage. Pinned in Task 6 (offline check).
2. Flag answer tiles after a wrong pick: the wrong tile and the correct tile must be visibly marked before the modal or Study card covers them, and the marks must clear on the next question. Pinned in Task 5.
3. `token()` called before the stylesheet applies (scripts run at end of body, so CSS is parsed; but a missing token name returns `''`): `tokenHex('missing')` must throw a clear error instead of passing `NaN` to amCharts. Pinned in Task 4.
4. Map colours on re-entering Map mode after Flag mode (the chart is built once and reused): land, hover, selection and reveal colours must stay the Arcade ones. Pinned in Task 6.
5. Long trivia questions and long country names on answer tiles at 375px: no overflow out of tiles or the header. Pinned in Task 6.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `tools/check-tokens.js` | Create | Fails if `style.css` (outside `:root`) or game JS hardcodes colours, radii, font sizes/weights or spacing |
| `tools/contrast.js` | Create | Reads `:root` tokens from `style.css`, fails if any listed text/background pair is below AA |
| `css/style.css` | Modify (rewrite) | Tokens in `:root`, then base, components, screens, media queries |
| `index.html` | Modify | Google Fonts `<link>`; bump title to V14.0 |
| `js/util.js` | Modify | `token(name)`, `tokenHex(name)`; `showReaction` default colour from tokens |
| `js/game.js` | Modify | Timer, reactions, reveal colour from tokens; answer tile `is-correct` / `is-wrong` classes |
| `js/map.js` | Modify | All amCharts colours from `tokenHex()` |
| `CLAUDE.md` | Modify | Document tokens, the check scripts, and the Figma file |
| Figma "Geogryphon Arcade" | Create | Variables, text styles, components, 3 reference screens |

---

### Task 1: Token check scripts + `:root` tokens

**Files:**
- Create: `tools/check-tokens.js`, `tools/contrast.js`
- Modify: `css/style.css:2-7` (the `:root` block)

**Interfaces:**
- Produces: CSS custom properties used by every later task:
  `--bg --surface-1 --surface-2 --edge --text --text-2 --accent --accent-edge --on-accent --hot --good --bad --map-land --map-sea`,
  `--font-display --font-body`, `--fs-12 --fs-14 --fs-18 --fs-28 --fs-44`, `--fw-500 --fw-600 --fw-700`,
  `--r-8 --r-14 --r-24 --r-pill`, `--s-4 --s-8 --s-12 --s-16 --s-24 --s-32`, `--press 120ms`, `--pad` (kept from step 1, = `var(--s-16)` desktop / `var(--s-8)` phone).
- Produces: `node tools/check-tokens.js` and `node tools/contrast.js` exit 0 on pass, 1 on fail with one line per problem.

- [ ] **Step 1: Write `tools/contrast.js`** (the test for token values)

```js
// Fails if any text/background token pair in css/style.css is below WCAG AA.
// Usage: node tools/contrast.js
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'style.css'), 'utf8');
const rootBlock = (css.match(/:root\s*\{([^}]*)\}/) || [])[1] || '';
const tokens = {};
for (const m of rootBlock.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2];

const lum = hex => {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

// [foreground, background, minimum]
const PAIRS = [
  ['text', 'bg', 4.5], ['text', 'surface-1', 4.5], ['text', 'surface-2', 4.5],
  ['text-2', 'bg', 4.5], ['text-2', 'surface-1', 4.5], ['text-2', 'surface-2', 4.5],
  ['on-accent', 'accent', 4.5], ['accent', 'bg', 4.5], ['accent', 'surface-1', 4.5], ['accent', 'surface-2', 4.5],
  ['on-accent', 'hot', 4.5], ['hot', 'bg', 4.5],
  ['good', 'bg', 4.5], ['good', 'surface-1', 4.5], ['on-accent', 'good', 4.5],
  ['bad', 'bg', 4.5], ['bad', 'surface-1', 4.5], ['on-accent', 'bad', 4.5],
  ['text', 'map-land', 4.5], ['text', 'map-sea', 4.5]
];

let failed = 0;
for (const [fg, bg, min] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) { console.log(`MISSING token --${!tokens[fg] ? fg : bg}`); failed++; continue; }
  const r = ratio(tokens[fg], tokens[bg]);
  if (r < min) { console.log(`FAIL --${fg} on --${bg}: ${r.toFixed(2)} < ${min}`); failed++; }
}
console.log(failed ? `${failed} contrast problem(s)` : `contrast OK (${PAIRS.length} pairs)`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 2: Run it, expect FAIL**

Run: `node tools/contrast.js`
Expected: exit 1, `MISSING token --text` (and others) because `:root` still has the old tokens.

- [ ] **Step 3: Write `tools/check-tokens.js`** (the test for "everything comes from a token")

```js
// Fails if style.css (outside :root) or the game's JS hardcodes design values.
// Usage: node tools/check-tokens.js
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const problems = [];

// ---- CSS ----
const cssFile = path.join(root, 'css', 'style.css');
const css = fs.readFileSync(cssFile, 'utf8');
const rootEnd = css.search(/:root\s*\{/) >= 0 ? css.indexOf('}', css.search(/:root\s*\{/)) + 1 : 0;
const lines = css.split('\n');
let offset = 0;
lines.forEach((line, i) => {
  const start = offset;
  offset += line.length + 1;
  if (start < rootEnd) return; // inside the :root token block
  const code = line.replace(/\/\*.*?\*\//g, '');
  const where = `style.css:${i + 1}`;
  if (/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/.test(code)) problems.push(`${where} raw colour: ${code.trim()}`);
  // A line may hold a selector and several declarations: check each declaration.
  const body = code.includes('{') ? code.slice(code.indexOf('{') + 1) : code;
  for (const d of body.replace('}', '').split(';')) {
    const decl = d.match(/^\s*([\w-]+)\s*:\s*(.+?)\s*$/);
    if (!decl) continue;
    const [, prop, value] = decl;
    const stripped = value.replace(/var\([^)]*\)/g, '').replace(/!important/, '');
    const hasLength = /\d*\.?\d+(px|rem|em)\b/.test(stripped);
    if (prop === 'font') problems.push(`${where} font shorthand (use font-family/size/weight): ${value}`);
    if (prop === 'border-radius' && hasLength) problems.push(`${where} raw radius: ${value}`);
    if (prop === 'font-size' && hasLength) problems.push(`${where} raw font-size: ${value}`);
    if (prop === 'font-weight' && !/var\(/.test(value)) problems.push(`${where} raw font-weight: ${value}`);
    if (/^(padding|margin|gap|row-gap|column-gap)(-\w+)?$/.test(prop) && hasLength) problems.push(`${where} raw spacing: ${value}`);
  }
});

// ---- JS (game code only; data files are excluded) ----
for (const f of ['util.js', 'game.js', 'map.js', 'main.js', 'scores.js']) {
  fs.readFileSync(path.join(root, 'js', f), 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (/['"`]#[0-9a-fA-F]{3,8}['"`]|0x[0-9a-fA-F]{6}\b|hsla?\(/.test(code)) problems.push(`js/${f}:${i + 1} raw colour: ${code.trim()}`);
  });
}

problems.forEach(p => console.log(p));
console.log(problems.length ? `${problems.length} hardcoded value(s)` : 'tokens OK');
process.exit(problems.length ? 1 : 0);
```

Note: `font` shorthand is not allowed outside `:root` (it would hide size/weight); use `font-family`, `font-size`, `font-weight` separately. Exempt: `0`, `auto`, borders/outlines widths (1px, 2px), layout sizes (width/height/top/etc.) and media-query breakpoints.

- [ ] **Step 4: Replace the `:root` block in `css/style.css` with the Arcade tokens**

```css
:root {
  /* colour */
  --bg:#1b1446;
  --surface-1:#261d5e;
  --surface-2:#3b2f8f;
  --edge:#120d33;
  --text:#ffffff;
  --text-2:#b9b0ff;
  --accent:#ffd23f;
  --accent-edge:#c99c00;
  --on-accent:#1b1446;
  --hot:#ff5d73;
  --good:#3ee08f;
  --bad:#ff4d6d;
  --map-land:#4a3fb0;
  --map-sea:#140f38;
  --scrim:#0d0a26e6;
  --line:#ffffff1f;
  --flag-frame:#d5dde8;
  /* type */
  --font-display:'Fredoka',system-ui,sans-serif;
  --font-body:'Nunito',system-ui,sans-serif;
  --fs-12:.75rem;
  --fs-14:.875rem;
  --fs-18:1.125rem;
  --fs-28:1.75rem;
  --fs-44:2.75rem;
  /* fluid headline sizes: grow from a scale step with the viewport */
  --fs-hero:clamp(2.75rem,7vw,5rem);
  --fs-question:clamp(1.75rem,3vw,2.5rem);
  --fs-reaction:clamp(1.75rem,6vw,4.5rem);
  --fw-500:500;
  --fw-600:600;
  --fw-700:700;
  /* shape and space */
  --r-8:8px;
  --r-14:14px;
  --r-24:24px;
  --r-pill:999px;
  --s-4:4px;
  --s-8:8px;
  --s-12:12px;
  --s-16:16px;
  --s-24:24px;
  --s-32:32px;
  --pad:var(--s-16);
  /* motion */
  --press:120ms;
}
```

(`--scrim`, `--line`, `--flag-frame` are alpha/utility colours the components need; `contrast.js` ignores them because they are not 6-digit hex text pairs.)

- [ ] **Step 5: Run contrast, expect PASS**

Run: `node tools/contrast.js`
Expected: `contrast OK (20 pairs)`, exit 0.

- [ ] **Step 6: Run check-tokens, expect FAIL (baseline of what Tasks 5–6 must remove)**

Run: `node tools/check-tokens.js`
Expected: exit 1 with many `raw colour` / `raw radius` / `raw spacing` lines from the old CSS and the JS colour literals.

- [ ] **Step 7: Commit**

```bash
git add tools css/style.css
git commit -m "Add Arcade tokens and token/contrast check scripts"
```

---

### Task 2: Figma file, variables and text styles

**Files:** Figma only. Load skills `figma:figma-use` and `figma:figma-generate-library` before any `use_figma` call.

**Interfaces:**
- Consumes: token values from Task 1 (Global Constraints).
- Produces: Figma file "Geogryphon Arcade" (record its URL/key in `CLAUDE.md` in Task 7). Variable collection `Arcade` with groups `color/*`, `radius/*`, `space/*` named exactly like the CSS tokens without `--` (e.g. `color/surface-1`, `radius/r-14`, `space/s-16`). Text styles `Display/44`, `Display/28`, `Display/18`, `Body/18`, `Body/14`, `Label/12`.

- [ ] **Step 1: Check access.** Call `whoami`. Create the file with `create_new_file` (load `figma:figma-create-new-file` first) in the user's drafts. If creation or the first write fails with a permission error, STOP and report to the user (spec risk: View seat).
- [ ] **Step 2: Create the variable collection** with every colour, radius and spacing token from Task 1 (single mode "Dark"). Set scopes: colours → fills/strokes/text, radius → corner radius, spacing → gap/padding.
- [ ] **Step 3: Create text styles** using Fredoka (Display) and Nunito (Body/Label) at the sizes and weights above. If the fonts are unavailable in the file, report and fall back to the closest available rounded/sans font, noting it in the file.
- [ ] **Step 4: Verify.** `get_variable_defs` lists all 17 colours, 4 radii, 6 spacing values with the exact hex values from Task 1. Screenshot a "Foundations" frame showing swatches and type ramp with `get_screenshot`.

---

### Task 3: Figma components and reference screens

**Files:** Figma only (same file).

**Interfaces:**
- Consumes: variables and text styles from Task 2 (bind every fill, stroke, radius, gap and padding to a variable; no raw values).
- Produces: component sets `Button` (variant `type=primary|secondary|ghost`, `state=rest|hover|pressed|focus|disabled`), `AnswerTile` (`state=rest|hover|correct|wrong`), `Chip` (`tone=hot|accent|neutral`), `Stat`, `Segment` (`state=rest|hover|selected|focus`), `Card`, `MapControl` (`state=rest|hover|pressed`). Frames `Screen/Menu`, `Screen/Flag`, `Screen/Map` at 1280x800 built from instances.

- [ ] **Step 1: Build components** with auto-layout. Pressable components (Button primary/secondary, AnswerTile, Segment, MapControl) have a 4px bottom edge (`edge` or `accent-edge` stroke-bottom or an underlay); `pressed` state shifts content down 2px and uses a 2px edge.
- [ ] **Step 2: Build the 3 reference screens** mirroring the current layouts after step 1 (menu: kicker, title, difficulty + expertise segments, 3 mode cards; Flag: header with chip + question + stats, timer, flag, 4 answer tiles, Top 10 panel; Map: same header with Confirm button, map placeholder in `map-sea`/`map-land`).
- [ ] **Step 3: Verify** each component set and screen with `get_screenshot`; check no layer uses an unbound colour (`use_figma` read script listing fills without `boundVariables`). Show the user the 3 screenshots.

---

### Task 4: JS colour sourcing (`token`, `tokenHex`)

**Files:**
- Modify: `js/util.js` (add helpers; `showReaction` default)
- Modify: `js/game.js:63-69` (timer paint), `:121`, `:142`, `:171`, `:345`
- Modify: `js/map.js:10-11`, `:95`, `:101`, `:138`, `:146`, `:233`, `:252-255`, `:260`

**Interfaces:**
- Produces: `token(name: string) => string` (trimmed CSS value of `--name`), `tokenHex(name: string) => number` (for `am5.color`; throws `Error('Unknown colour token --name')` if the value is not `#rrggbb`).
- Consumes: tokens from Task 1.

- [ ] **Step 1: Write the failing test** `tools/test-tokens-js.js` (stubs the DOM; runs `util.js` in a VM):

```js
// Usage: node tools/test-tokens-js.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const vars = { '--accent': ' #ffd23f', '--bad': '#ff4d6d', '--font-body': "'Nunito',system-ui" };
const ctx = {
  document: { documentElement: {}, getElementById: () => null },
  getComputedStyle: () => ({ getPropertyValue: n => vars[n] || '' }),
  localStorage: { getItem() {}, setItem() {}, removeItem() {} }
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', 'util.js'), 'utf8') + '\n;this.token=token;this.tokenHex=tokenHex;', ctx);

assert.strictEqual(ctx.token('accent'), '#ffd23f');
assert.strictEqual(ctx.tokenHex('accent'), 0xffd23f);
assert.strictEqual(ctx.tokenHex('bad'), 0xff4d6d);
assert.throws(() => ctx.tokenHex('missing'), /Unknown colour token --missing/);
assert.throws(() => ctx.tokenHex('font-body'), /Unknown colour token --font-body/);
console.log('token helpers OK');
```

- [ ] **Step 2: Run, expect FAIL**: `node tools/test-tokens-js.js` → `ReferenceError: token is not defined`.
- [ ] **Step 3: Implement in `js/util.js`** (after `LS`):

```js
// Design tokens live in css/style.css (:root). JS reads them instead of hardcoding colours.
const token = name => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

// amCharts wants colours as numbers (0xrrggbb).
function tokenHex(name) {
  const v = token(name);
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`Unknown colour token --${name}`);
  return parseInt(v.slice(1), 16);
}
```

and change `showReaction(text, color = '#991b1b', extra = 'penaltyBurst')` to `showReaction(text, color = token('bad'), extra = 'penaltyBurst')`.

- [ ] **Step 4: Run, expect PASS**: `node tools/test-tokens-js.js` → `token helpers OK`.
- [ ] **Step 5: Replace the game.js colours.**

Timer (`paint`), stepped instead of an hsl sweep:
```js
  function paint(r) {
    const c = token(r > .5 ? 'accent' : r > .25 ? 'hot' : 'bad');
    $('timerBar').style.transform = `scaleX(${r})`;
    $('timerBar').style.background = c;
    $('time').style.color = c;
    $('time').textContent = Math.ceil(r * max) + 's';
  }
```
Reactions: `'#c084fc'` → `token('text-2')`; `'#57f287'` → `token('good')`; `'#fb7185'` → `token('bad')`. Reveal: `color: 0xffd54f` → `color: tokenHex('good')`.

- [ ] **Step 6: Replace the map.js colours.** Remove the `BASE_FILL` / `SELECT_COLOR` constants; add inside `MapView` a lazily built palette (tokens are read when the chart is built, never at script load):

```js
  // Colours come from the CSS tokens (css/style.css :root), read once when the chart is built.
  let C = null;
  const palette = () => (C ||= {
    land: tokenHex('map-land'), line: tokenHex('bg'), hover: tokenHex('text-2'),
    select: tokenHex('accent'), reveal: tokenHex('good'), arrow: tokenHex('hot'), outline: tokenHex('text')
  });
```
Then: `am5.color(BASE_FILL)` → `am5.color(palette().land)`; `am5.color(0xffffff)` strokes on default polygons → `am5.color(palette().line)`; strokes on active/highlighted polygons and the arrow outline → `am5.color(palette().outline)`; hover `0x22d3ee` → `palette().hover`; `SELECT_COLOR` → `palette().select`; `highlight()` default `color = 0xffd54f` → `color = palette().reveal`; arrow fill `0xff1744` → `palette().arrow`. `#mapArea` background comes from CSS (`--map-sea`, Task 6).

- [ ] **Step 7: Verify**: `node --check js/util.js js/game.js js/map.js` (one file per call), `node tools/test-tokens-js.js`, and `node tools/check-tokens.js` shows no `js/` lines.
- [ ] **Step 8: Commit** `git add js tools && git commit -m "Read colours from design tokens in JS"`

---

### Task 5: Base, buttons, cards, menu and overlays

**Files:**
- Modify: `index.html:3` (title V14.0, Google Fonts link), `css/style.css` (base, `.btn` family, `.card`/`.settings`/`.mode`, segmented control, modal, study card, `#backBtn`, `.confirmSelection`)
- Modify: `js/game.js` (answer tile classes, Review Focus 2)

**Interfaces:**
- Consumes: tokens (Task 1), `token()` (Task 4).
- Produces CSS classes used by Task 6: `.btn` + modifiers `.btn-primary`, `.btn-secondary`, `.btn-ghost`; `.answer.is-correct`, `.answer.is-wrong`. Existing ids/classes stay so `game.js`/`main.js` keep working: `#saveBtn` gets `btn btn-secondary`, `#againBtn` gets `btn btn-primary`, `#studyContinue` `btn btn-primary`, `#studyReadMore` `btn btn-ghost`, `#backBtn` `btn btn-ghost`, `#confirmSelection` `btn btn-primary`.

- [ ] **Step 1: Write the failing test for answer tile states** `tools/test-answer-states.js`. Loading all of `game.js` needs too many stubs, so the test extracts and runs only the new `markAnswers()` helper:

```js
// Usage: node tools/test-answer-states.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
const fn = src.match(/function markAnswers\([\s\S]*?\n}\n/);
assert.ok(fn, 'markAnswers() not found in game.js');
const mk = code => ({ dataset: { code }, classList: { s: new Set(), toggle(c, on) { on ? this.s.add(c) : this.s.delete(c); } } });
const tiles = [mk('KW'), mk('SD'), mk('MC')];
const ctx = { $: () => ({ querySelectorAll: () => tiles }) };
vm.createContext(ctx);
vm.runInContext(fn[0] + ';this.markAnswers=markAnswers;', ctx);
ctx.markAnswers('SD', 'KW');
assert.deepStrictEqual([...tiles[0].classList.s], ['is-correct']);
assert.deepStrictEqual([...tiles[1].classList.s], ['is-wrong']);
assert.deepStrictEqual([...tiles[2].classList.s], []);
ctx.markAnswers(null, null);
assert.ok(tiles.every(t => t.classList.s.size === 0), 'marks clear');
console.log('answer states OK');
```

- [ ] **Step 2: Run, expect FAIL**: `markAnswers() not found in game.js`.
- [ ] **Step 3: Implement in `js/game.js`**: set `b.dataset.code = x.code;` where answer buttons are created, add

```js
// Marks the picked and the correct flag answer. markAnswers(null, null) clears the marks.
function markAnswers(pickedCode, correctCode) {
  $('answers').querySelectorAll('.answer').forEach(b => {
    b.classList.toggle('is-correct', b.dataset.code === correctCode);
    b.classList.toggle('is-wrong', b.dataset.code === pickedCode && pickedCode !== correctCode);
  });
}
```

and in `onFlagAnswer`: on a correct pick call `markAnswers(code, code)` before `onCorrect`; on a wrong pick call `markAnswers(code, target.code)` before `lose('Wrong answer.')`. New questions rebuild the tiles, so marks clear naturally.
- [ ] **Step 4: Run, expect PASS**: `node tools/test-answer-states.js` → `answer states OK`; `node --check js/game.js`.
- [ ] **Step 5: Fonts + title in `index.html`** (inside `<head>`, before `css/style.css`):

```html
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@500;600;700&display=swap">
```
Title → `Geogryphon V14.0`. Add the button classes listed in Interfaces to the existing elements (class attributes only).

- [ ] **Step 6: Base and button CSS** (replace `body`, `button,input`, `.btn`, `.primary`, `.again`, `#backBtn`, `.confirmSelection*`, `.studyLink`, `.studyContinue`, `button:focus-visible`):

```css
body {
  margin:0;
  font-family:var(--font-body);
  font-size:var(--fs-18);
  font-weight:var(--fw-500);
  color:var(--text);
  background:var(--bg);
}

h1,h2,.stat b,.mode b {
  font-family:var(--font-display);
  font-weight:var(--fw-700);
}

/* Button: pressable, with a darker bottom edge that squashes on press. */
.btn {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:var(--s-8);
  padding:var(--s-12) var(--s-16);
  border:0;
  border-radius:var(--r-14);
  font-family:var(--font-display);
  font-size:var(--fs-18);
  font-weight:var(--fw-600);
  text-decoration:none;
  cursor:pointer;
  transition:transform var(--press),box-shadow var(--press),background var(--press);
}
.btn-primary { background:var(--accent); color:var(--on-accent); box-shadow:0 4px 0 var(--accent-edge); }
.btn-secondary { background:var(--surface-2); color:var(--text); box-shadow:0 4px 0 var(--edge); }
.btn-ghost { background:transparent; color:var(--text-2); box-shadow:inset 0 0 0 2px var(--surface-2); }
.btn-primary:hover { filter:brightness(1.06); }
.btn-secondary:hover,.btn-ghost:hover { color:var(--accent); }
.btn-primary:active { transform:translateY(2px); box-shadow:0 2px 0 var(--accent-edge); }
.btn-secondary:active { transform:translateY(2px); box-shadow:0 2px 0 var(--edge); }
.btn:disabled { background:var(--surface-1); color:var(--text-2); box-shadow:none; cursor:not-allowed; transform:none; }

button:focus-visible,a:focus-visible,input:focus-visible,.difficulty input:focus-visible+label {
  outline:3px solid var(--accent);
  outline-offset:3px;
}
```
`#backBtn` keeps only `margin-bottom:var(--s-8); padding:var(--s-4) var(--s-12); font-size:var(--fs-14);`. `.confirmSelection` rules are deleted (it is now `.btn.btn-primary`; disabled state comes from `.btn:disabled`).

- [ ] **Step 7: Cards, menu, segmented control, modal, study card.** Replace `.settings`, `.difficulty*`, `.mode*`, `.option*`, `.kicker`, `.menu h1`, `.muted`, `.modal`, `.modalin`, `.save*`, `.studyCard`, `.studyInner*`, `.studyFlag`:

```css
.card,.settings,.mode,.modalin,.studyInner {
  background:var(--surface-1);
  border:0;
  border-radius:var(--r-24);
  color:var(--text);
}
.settings { margin:var(--s-16) 0; padding:var(--s-16) var(--s-24); }
.settings h2 { margin:0 0 var(--s-12); font-size:var(--fs-18); color:var(--text-2); }

.kicker { color:var(--hot); font-family:var(--font-display); font-weight:var(--fw-700); font-size:var(--fs-14); letter-spacing:.14em; text-transform:uppercase; }
.menu h1 { font-size:var(--fs-hero); line-height:1; margin:var(--s-12) 0; }
.muted { color:var(--text-2); }

/* Segmented control */
.difficulty { display:grid; grid-template-columns:repeat(4,1fr); gap:var(--s-8); }
.difficulty input { position:absolute; opacity:0; }
.difficulty label {
  padding:var(--s-12);
  text-align:center;
  border-radius:var(--r-14);
  background:var(--surface-2);
  box-shadow:0 4px 0 var(--edge);
  font-family:var(--font-display);
  font-weight:var(--fw-600);
  cursor:pointer;
  transition:transform var(--press),box-shadow var(--press);
}
.difficulty label small { display:block; color:var(--text-2); font-family:var(--font-body); font-size:var(--fs-14); }
.difficulty label:hover { color:var(--accent); }
.difficulty input:checked+label { background:var(--accent); color:var(--on-accent); box-shadow:0 2px 0 var(--accent-edge); transform:translateY(2px); }
.difficulty input:checked+label small { color:var(--on-accent); }

/* Mode cards */
.modes { display:grid; grid-template-columns:repeat(3,1fr); gap:var(--s-16); }
.mode { width:100%; padding:var(--s-24); text-align:left; cursor:pointer; box-shadow:0 4px 0 var(--edge); transition:transform var(--press),box-shadow var(--press); font-size:var(--fs-28); }
.mode:hover { box-shadow:0 4px 0 var(--edge),inset 0 0 0 2px var(--accent); }
.mode:active { transform:translateY(2px); box-shadow:0 2px 0 var(--edge); }
.mode b { display:block; font-size:var(--fs-28); margin:var(--s-12) 0 var(--s-4); }
.mode .muted { font-size:var(--fs-14); }
.option { display:flex; gap:var(--s-8); margin:var(--s-12) var(--s-12); color:var(--text-2); font-weight:var(--fw-600); font-size:var(--fs-14); }
.option input { width:18px; accent-color:var(--accent); }
.option.refreshOption { margin:0 0 var(--s-8); }

/* Overlays */
.modal,.studyCard { position:fixed; inset:0; display:grid; place-items:center; padding:var(--s-16); background:var(--scrim); }
.modal { z-index:30; }
.studyCard { z-index:45; }
.modalin { width:min(430px,100%); padding:var(--s-32) var(--s-24); }
.modalin .kicker { color:var(--bad); }
.save { display:flex; gap:var(--s-8); }
.save input { flex:1; min-width:0; padding:var(--s-12); border-radius:var(--r-14); background:var(--bg); color:var(--text); border:2px solid var(--surface-2); }
.again { width:100%; margin-top:var(--s-12); }
.studyInner { width:min(620px,100%); padding:var(--s-24); }
.studyFlag { display:block; width:min(330px,80%); height:175px; object-fit:contain; margin:0 auto var(--s-16); padding:var(--s-8); border-radius:var(--r-14); background:var(--flag-frame); }
.studyInner h2 { margin:0 0 var(--s-8); font-size:var(--fs-28); }
.studyInner p { color:var(--text-2); line-height:1.55; margin:0 0 var(--s-24); }
.studyInner p.loading { font-style:italic; }
.studyActions { display:flex; gap:var(--s-12); justify-content:flex-end; flex-wrap:wrap; }
```
The inline `style="color:#fb7185"` on the modal kicker in `index.html` is removed (handled by `.modalin .kicker`).

- [ ] **Step 8: Verify in the browser pane** (preview server `geogryphon`, see `.claude/launch.json`; if `preview_start` picks the wrong config, run `node .claude/serve.js` and navigate to `http://localhost:8765`): menu at 1280x800 and 375x812, the run-over modal, and Study Mode (tick Study Mode, answer wrong). Screenshot each. No console errors.
- [ ] **Step 9: Commit** `git add index.html css js tools && git commit -m "Arcade base, buttons, menu and overlays"`

---

### Task 6: Game screen components and map

**Files:**
- Modify: `css/style.css` (header, chip, stats, timer, play card, flag box, answers, map, map controls, hint, hover flag, reaction, reveal notice, leaderboard rows, media queries)

**Interfaces:**
- Consumes: everything above. Must keep step 1's layout rules (`.gamegrid main` height, flex column, `flex:1; min-height:0` on `.play`, `.flagbox`, `.mapWrap`).

- [ ] **Step 1: Replace the remaining component rules:**

```css
.head h1 { margin:var(--s-4) 0 0; font-size:var(--fs-question); line-height:1.1; overflow-wrap:anywhere; }
.head .kicker { display:inline-block; padding:var(--s-4) var(--s-12); border-radius:var(--r-pill); background:var(--hot); color:var(--on-accent); font-size:var(--fs-12); letter-spacing:.1em; }
.selectionProgress { min-width:120px; color:var(--text-2); font-weight:var(--fw-700); font-size:var(--fs-14); }
.questionActions { display:flex; align-items:center; gap:var(--s-12); flex-wrap:wrap; margin-top:var(--s-12); }

.stats { display:flex; gap:var(--s-8); }
.stat { min-width:88px; padding:var(--s-8) var(--s-12); background:var(--surface-1); border-radius:var(--r-14); }
.stat small { display:block; color:var(--text-2); font-size:var(--fs-12); font-weight:var(--fw-700); text-transform:uppercase; letter-spacing:.08em; }
.stat b { font-size:var(--fs-28); color:var(--good); }

.timerTrack { height:12px; background:var(--surface-1); border-radius:var(--r-pill); overflow:hidden; margin-bottom:var(--s-12); flex:none; }
.timerBar { height:100%; border-radius:var(--r-pill); transform-origin:left; }
.timerTrack.penalty { animation:timerPenalty .48s ease; background:var(--bad); }

.play { padding:var(--s-8); gap:var(--s-12); }
.flagbox { padding:var(--s-8); }
.flagbox img { max-width:min(720px,100%); max-height:100%; object-fit:contain; background:var(--flag-frame); padding:var(--s-12); border-radius:var(--r-14); box-shadow:0 6px 0 var(--edge); transition:opacity .18s; }

.answers { gap:var(--s-12); }
.answer {
  min-height:64px;
  padding:var(--s-12) var(--s-16);
  text-align:left;
  border:0;
  border-radius:var(--r-14);
  background:var(--surface-2);
  color:var(--text);
  box-shadow:0 4px 0 var(--edge);
  font-family:var(--font-display);
  font-size:var(--fs-18);
  font-weight:var(--fw-600);
  overflow-wrap:anywhere;
  cursor:pointer;
  transition:transform var(--press),box-shadow var(--press);
}
.answer:hover { box-shadow:0 4px 0 var(--edge),inset 0 0 0 2px var(--accent); }
.answer:active { transform:translateY(2px); box-shadow:0 2px 0 var(--edge); }
.answer.is-correct { background:var(--good); color:var(--on-accent); }
.answer.is-wrong { background:var(--bad); color:var(--on-accent); }

.map { position:absolute; inset:0; background:var(--map-sea); border-radius:var(--r-14); overflow:hidden; }
.mapControls { position:absolute; left:var(--s-16); top:var(--s-16); z-index:8; display:grid; gap:var(--s-8); }
.mapControl { width:44px; height:44px; border:0; border-radius:var(--r-14); background:var(--surface-2); color:var(--text); box-shadow:0 4px 0 var(--edge); font-family:var(--font-display); font-size:var(--fs-28); font-weight:var(--fw-700); cursor:pointer; transition:transform var(--press),box-shadow var(--press); }
.mapControl:hover { color:var(--accent); }
.mapControl:active { transform:translateY(2px); box-shadow:0 2px 0 var(--edge); }
.mapControl.reset { font-size:var(--fs-18); }
.mapHint { position:absolute; z-index:7; left:50%; bottom:var(--s-12); transform:translateX(-50%); padding:var(--s-4) var(--s-12); border-radius:var(--r-pill); background:var(--scrim); color:var(--text-2); font-size:var(--fs-12); pointer-events:none; white-space:nowrap; }
.hoverFlag { position:absolute; right:var(--s-16); top:var(--s-16); z-index:5; width:155px; padding:var(--s-8); border-radius:var(--r-14); background:var(--surface-1); pointer-events:none; opacity:0; transition:.18s; }
.hoverFlag img { width:100%; height:85px; object-fit:contain; background:var(--flag-frame); border-radius:var(--r-8); }
.hoverFlag span { display:block; text-align:center; font-weight:var(--fw-700); }

.reaction,.revealNotice { position:absolute; z-index:15; left:50%; pointer-events:none; font-family:var(--font-display); font-weight:var(--fw-700); text-align:center; }
.reaction { top:20%; font-size:var(--fs-reaction); opacity:0; -webkit-text-stroke:2px var(--edge); paint-order:stroke fill; }
.revealNotice { top:var(--s-16); transform:translateX(-50%); padding:var(--s-12) var(--s-16); border-radius:var(--r-14); background:var(--surface-1); color:var(--good); font-size:var(--fs-18); }
.penaltyBurst,.selectionFull { -webkit-text-stroke:2px var(--edge); }
.answerArrowText { font-weight:var(--fw-700); pointer-events:none; }

.side { padding:var(--s-16); }
.side h2 { margin:0 0 var(--s-8); font-size:var(--fs-18); }
.row { display:flex; gap:var(--s-8); padding:var(--s-8) var(--s-12); background:var(--surface-2); border-radius:var(--r-8); margin-top:var(--s-8); font-size:var(--fs-14); }
.rank { color:var(--accent); }
.pts { color:var(--good); }
```
Delete `.penaltyBurst` / `.selectionFull` colour overrides (colour now comes from `token()` in JS). In the `max-width:620px` media query keep step 1's phone rules, converted to tokens (`--pad:var(--s-8)`, `.stat` padding `var(--s-4) var(--s-12)`, `.stat b` `var(--fs-18)`, `.answer` `min-height:52px; padding:var(--s-12)`, `.head .kicker` `var(--fs-12)`).

Also convert the layout rules this plan does not rewrite to tokens: `.gamegrid` gap → `var(--s-12)`, `.head` gap/margin → `var(--s-16)` / `var(--s-12)`, `.menuin`, `.modes`, `.wrap`, and anything else the checker reports.

- [ ] **Step 2: Run the checks, expect PASS**: `node tools/check-tokens.js` → `tokens OK`; `node tools/contrast.js` → `contrast OK`.
- [ ] **Step 3: Browser verification at 1280x800, 1366x600, 375x812** for Flag, Map and Trivia. For each: page height = viewport (`document.documentElement.scrollHeight === innerHeight` on desktop; on phone `main` bottom ≤ viewport), screenshot.
- [ ] **Step 4: Review Focus checks:**
  - Wrong flag pick: the picked tile is red, the right one green, visible under the modal scrim; next run starts with unmarked tiles.
  - Flag → menu → Map: land is `#4a3fb0`, hover lavender, selection yellow, reveal green (`MapView` reused chart).
  - 375px Trivia with the longest question (force via console: `setText('question', 'Pick 3 countries in Africa where French is an official language and the population is over 10 million')`) and a long answer name (`$('answers').firstChild.textContent = '1. Saint Vincent and the Grenadines'`): nothing overflows its box.
  - Offline fonts: block `fonts.googleapis.com` (DevTools-equivalent: remove the link element via console and reload styles) and confirm text renders in the fallback with no overlap.
- [ ] **Step 5: Commit** `git add css && git commit -m "Arcade game screen components and map styling"`

---

### Task 7: Docs and wrap-up

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `CLAUDE.md`**: add a "Design system" section (tokens live in `css/style.css :root`; JS reads them via `token()`/`tokenHex()`; never hardcode colours; run `node tools/check-tokens.js` and `node tools/contrast.js` after CSS edits; `node tools/test-tokens-js.js` and `node tools/test-answer-states.js` after JS edits; Figma file URL from Task 2). Update the Running section with the preview server (`node .claude/serve.js`, port 8765) and note that `build_single.py` needs Python (not installed on this machine), so `geogryphon_single.html` is stale until rebuilt. Update the map colour note (hover is now lavender `--text-2`).
- [ ] **Step 2: Run all checks** (all four `tools/*.js`, `node --check` on each changed JS file) and confirm all pass.
- [ ] **Step 3: Commit** `git add CLAUDE.md && git commit -m "Document the Arcade design system"`
- [ ] **Step 4:** Use superpowers:finishing-a-development-branch to decide how to merge `design-system` into `main`.
