// The dashed reveal circle: its size follows the country, it is capped, and it is fully removed on stop.
// Usage: node tools/test-reveal-circle.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'map.js'), 'utf8');
const start = src.indexOf('/* ---------- reveal circles');
const end = src.indexOf('const MapView');
assert.ok(start >= 0 && end > start, 'reveal circle code not found in map.js (expected before MapView)');

// Minimal SVG DOM stub.
function node(tag) {
  return {
    tag, attrs: {}, children: [],
    setAttribute(k, v) { this.attrs[k] = String(v); },
    appendChild(c) { this.children.push(c); return c; },
    append(...cs) { cs.forEach(c => this.children.push(c)); },
    replaceChildren(...cs) { this.children = cs; }
  };
}
let frames = new Map(), nextFrame = 1, now = 0;
const ctx = {
  Math, Infinity,
  document: { createElementNS: (ns, tag) => node(tag) },
  performance: { now: () => now },
  requestAnimationFrame: cb => { const id = nextFrame++; frames.set(id, cb); return id; },
  cancelAnimationFrame: id => { frames.delete(id); }
};
vm.createContext(ctx);
vm.runInContext(src.slice(start, end) + ';this.circleAround=circleAround;this.RevealCircles=RevealCircles;this.trimAntimeridian=trimAntimeridian;', ctx);
const { circleAround, RevealCircles, trimAntimeridian } = ctx;
const runFrame = t => { now = t; const pending = [...frames.values()]; frames.clear(); pending.forEach(cb => cb(t)); };
const near = (a, b) => Math.abs(a - b) < 1e-6;

// --- sizing ---
assert.strictEqual(circleAround([]), null, 'no points, no circle');
const box = [[200, 200], [300, 200], [300, 300], [200, 300]].map(([x, y]) => ({ x, y }));
const c = circleAround(box, { pad: 10 });
assert.ok(near(c.cx, 250) && near(c.cy, 250), 'centred on the country');
assert.ok(near(c.r, Math.hypot(100, 100) / 2 + 10), `encloses the bounding box (r=${c.r})`);
const tiny = circleAround([{ x: 50, y: 50 }, { x: 52, y: 51 }], { minR: 24 });
assert.strictEqual(tiny.r, 24, 'tiny countries get the minimum radius');
const huge = circleAround([{ x: 0, y: 0 }, { x: 4000, y: 3000 }], { maxR: 300 });
assert.strictEqual(huge.r, 300, 'huge countries are capped');

// --- outlines crossing the 180° line (Russia's Chukotka) keep only their main side ---
const russiaLike = [[30, 60], [100, 70], [170, 65], [179, 66], [-179, 66], [-172, 65], [140, 50], [30, 60]];
const trimmed = trimAntimeridian(russiaLike);
assert.ok(trimmed.every(([lon]) => lon >= 0), 'west-of-180 points dropped from a mostly-eastern outline');
assert.strictEqual(trimmed.length, 6, 'eastern points kept');
const normal = [[0, 0], [10, 0], [10, 10], [0, 0]];
assert.strictEqual(trimAntimeridian(normal), normal, 'ordinary outlines unchanged');
const fijiLike = [[-179, -16], [-178, -17], [-179.5, -18], [178, -17], [-179, -16]];
assert.ok(trimAntimeridian(fijiLike).every(([lon]) => lon < 0), 'mostly-western outline keeps its western side');

// --- layer lifecycle ---
const layer = node('svg');
const square = () => box;
RevealCircles.start(layer, [square, square], { maxR: 500 });
assert.strictEqual(layer.children.length, 2, 'one circle group per revealed country');
runFrame(16);
const ring = layer.children[0].children.find(n => n.tag === 'circle');
assert.ok(ring, 'group has a visible ring circle');
assert.ok(near(Number(ring.attrs.r), circleAround(box, { maxR: 500 }).r), 'ring sized to the country on the first frame');
assert.ok(frames.size === 1, 'keeps animating while shown');

// Follows the map: the projector returns new pixels after a pan/zoom.
let moved = box.map(p => ({ x: p.x + 40, y: p.y + 10 }));
RevealCircles.start(layer, [() => moved], {});
runFrame(32);
const ring2 = layer.children[0].children.find(n => n.tag === 'circle');
assert.ok(near(Number(ring2.attrs.cx), 290) && near(Number(ring2.attrs.cy), 260), 'restart replaces old circles and tracks the new position');
assert.strictEqual(layer.children.length, 1, 'previous circles were removed on restart');

// Cap at 5 countries.
RevealCircles.start(layer, Array(8).fill(square), {});
assert.strictEqual(layer.children.length, 5, 'at most 5 circles');

// Stop clears everything and stops the frame loop.
RevealCircles.stop();
assert.strictEqual(layer.children.length, 0, 'layer empty after stop');
assert.strictEqual(frames.size, 0, 'no animation frame left running');
RevealCircles.stop(); // safe to call twice

console.log('reveal circle OK');
