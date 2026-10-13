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
for (const f of ['util.js', 'sound.js', 'game.js', 'map.js', 'main.js', 'scores.js']) {
  fs.readFileSync(path.join(root, 'js', f), 'utf8').split('\n').forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, '');
    if (/['"`]#[0-9a-fA-F]{3,8}['"`]|0x[0-9a-fA-F]{6}\b|hsla?\(/.test(code)) problems.push(`js/${f}:${i + 1} raw colour: ${code.trim()}`);
  });
}

problems.forEach(p => console.log(p));
console.log(problems.length ? `${problems.length} hardcoded value(s)` : 'tokens OK');
process.exit(problems.length ? 1 : 0);
