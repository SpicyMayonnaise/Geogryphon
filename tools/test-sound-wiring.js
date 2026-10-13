// Gameplay sounds: game and score code send the right sound with the right intensity.
// Usage: node tools/test-sound-wiring.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');
const game = read('game.js'), scores = read('scores.js');
const grab = (src, re, what) => { const m = src.match(re); assert.ok(m, `${what} not found`); return m[0]; };
const fn = (src, name) => grab(src, new RegExp(`function ${name}\\([\\s\\S]*?\\n}\\n`), name);
const names = ['onCorrect', 'applyPenalty', 'onFlagAnswer', 'showGameOver', 'beginAsking', 'selectMapCountry'];
const code = names.map(n => fn(game, n)).join('\n') + fn(scores, 'saveScore');
const clockCode = grab(game, /const Clock = \(\(\) => \{[\s\S]*?\n\}\)\(\);\n/, 'Clock');

function setup(over = {}) {
  const played = [];
  const el = () => ({
    value: 'Ana', disabled: false, style: {},
    classList: { add() {}, remove() {} },
    parentElement: { classList: { add() {}, remove() {} }, offsetWidth: 0 }
  });
  const ctx = {
    played, state: 'asking', mode: 'map', runId: 1, score: 0, maxTime: 10, scoreSaved: false,
    target: { code: 'KW' }, questionSpec: { required: 2 }, selectedIds: new Set(),
    Sound: { play: (name, i) => played.push(i === undefined ? [name] : [name, i]) },
    Clock: { r: 0.8, ratio() { return this.r; }, stop() {}, penalize: () => 5, start(s, cb) { ctx.expire = cb; } },
    setState: s => { ctx.state = s; return true; },
    stale: rid => rid !== ctx.runId,
    lose: (...a) => { ctx.lost = a; },
    $: el, setText() {}, show() {}, token: () => '', showReaction() {}, clearSelections() {}, later() {},
    askNext() {}, markAnswers() {}, updateSelectionUI() {}, MapView: { select() {} },
    readScores: () => [], scoreKey: () => 'k', LS: { setItem() {} }, renderBoard() {},
    ...over
  };
  vm.createContext(ctx);
  vm.runInContext(code + `;Object.assign(this,{${names.join(',')},saveScore});`, ctx);
  return ctx;
}
const sounds = c => c.played.map(p => p[0]);

// Correct: intensity = share of time left.
{ const c = setup(); c.Clock.r = 0.8; c.onCorrect(1, 700); assert.deepStrictEqual(c.played, [['correct', 0.8]]); }

// Map/Trivia wrong: intensity = share of time used, read before the penalty.
{
  const c = setup();
  c.Clock.r = 0.3;
  c.Clock.penalize = () => { c.Clock.r = 0.1; return 2; };
  c.applyPenalty();
  assert.deepStrictEqual(c.played, [['wrong', 0.7]]);
}

// A penalty that empties the clock: wrong at full intensity, then the buzzer, then the loss.
{
  const c = setup();
  c.Clock.r = 0.2;
  c.Clock.penalize = () => 0;
  c.applyPenalty();
  assert.deepStrictEqual(c.played, [['wrong', 1], ['timesUp']]);
  assert.ok(c.lost, 'run is lost');
}

// Flag mode: wrong pick plays wrong (time used) and loses; right pick plays correct (time left).
{
  const c = setup({ mode: 'flag' });
  c.Clock.r = 0.25;
  c.onFlagAnswer('SD');
  assert.deepStrictEqual(c.played, [['wrong', 0.75]]);
  assert.ok(c.lost);
  const d = setup({ mode: 'flag' });
  d.Clock.r = 0.9;
  d.onFlagAnswer('KW');
  assert.deepStrictEqual(d.played, [['correct', 0.9]]);
  const e = setup({ mode: 'flag', state: 'between' });
  e.onFlagAnswer('SD');
  assert.strictEqual(e.played.length, 0, 'answers outside asking are silent');
}

// Time's up: the clock's expire callback buzzes, then loses.
{
  const c = setup({ state: 'loading' });
  c.beginAsking(10, 1);
  c.expire();
  assert.deepStrictEqual(sounds(c), ['timesUp']);
  assert.ok(c.lost);
}

// Run over: plays when the modal opens, not when the state change is refused.
{
  const c = setup({ state: 'revealing' });
  c.showGameOver('x', []);
  assert.deepStrictEqual(sounds(c), ['runOver']);
  const d = setup({ setState: () => false });
  d.showGameOver('x', []);
  assert.strictEqual(d.played.length, 0);
}

// Map pick: pick, pick, full (2 required), then unpick.
{
  const c = setup();
  ['FR', 'DE', 'IT', 'FR'].forEach(id => c.selectMapCountry(id));
  assert.deepStrictEqual(sounds(c), ['pick', 'pick', 'full', 'unpick']);
}

// Score saved: once on success, never for an empty name.
{
  const c = setup();
  c.saveScore(); c.saveScore();
  assert.deepStrictEqual(sounds(c), ['saved']);
  const d = setup({ $: () => ({ value: '   ', disabled: false }) });
  d.saveScore();
  assert.strictEqual(d.played.length, 0);
}

// Clock: resets ticks on start; ticks every frame in the red zone (Sound de-duplicates), never at 0.
{
  const calls = [];
  let now = 0, frame = null;
  const ctx = {
    performance: { now: () => now },
    requestAnimationFrame: cb => { frame = cb; return 1; },
    cancelAnimationFrame() {},
    $: () => ({ style: {}, textContent: '' }),
    token: () => '',
    Sound: { tick: s => calls.push(s), resetTick: () => calls.push('reset') }
  };
  vm.createContext(ctx);
  vm.runInContext(clockCode + ';this.Clock=Clock;', ctx);
  const step = ms => { now = ms; const f = frame; frame = null; if (f) f(); };
  ctx.Clock.start(10, () => calls.push('expired'));
  [5000, 7600, 7700, 8100, 9100, 10000].forEach(step);
  assert.deepStrictEqual(calls, ['reset', 3, 3, 2, 1, 'expired']);
}

console.log('sound wiring OK');
