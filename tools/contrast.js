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
  ['text', 'map-land', 4.5], ['text', 'map-sea', 4.5],
  ['cb-good', 'bg', 4.5], ['cb-good', 'surface-1', 4.5], ['on-accent', 'cb-good', 4.5],
  ['cb-bad', 'bg', 4.5], ['cb-bad', 'surface-1', 4.5], ['on-accent', 'cb-bad', 4.5]
];

let failed = 0;
for (const [fg, bg, min] of PAIRS) {
  if (!tokens[fg] || !tokens[bg]) { console.log(`MISSING token --${!tokens[fg] ? fg : bg}`); failed++; continue; }
  const r = ratio(tokens[fg], tokens[bg]);
  if (r < min) { console.log(`FAIL --${fg} on --${bg}: ${r.toFixed(2)} < ${min}`); failed++; }
}
console.log(failed ? `${failed} contrast problem(s)` : `contrast OK (${PAIRS.length} pairs)`);
process.exit(failed ? 1 : 0);
