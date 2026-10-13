// Sound engine: recipes scale with intensity, ticks play once per second, hover is throttled,
// a new wrong sound cuts the old one, mute is remembered, and no Web Audio means silent no-ops.
// Usage: node tools/test-sound.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'sound.js'), 'utf8');

class Param { setValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeNode {
  constructor() { this.gain = new Param(); this.frequency = new Param(); this.stops = []; }
  connect() {}
  start() {}
  stop(t) { this.stops.push(t); }
}
class FakeAudio {
  constructor() {
    this.currentTime = 0; this.state = 'running'; this.sampleRate = 8000; this.destination = {};
    this.sources = []; FakeAudio.last = this;
  }
  createGain() { return new FakeNode(); }
  createOscillator() { const n = new FakeNode(); this.sources.push(n); return n; }
  createBufferSource() { const n = new FakeNode(); this.sources.push(n); return n; }
  createBuffer(ch, len) { const d = new Float32Array(len); return { getChannelData: () => d }; }
  resume() { return Promise.resolve(); }
}

function load({ audio = FakeAudio, store = new Map(), clock = { t: 0 } } = {}) {
  const ctx = {
    AudioContext: audio || undefined,
    LS: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    performance: { now: () => clock.t }
  };
  vm.createContext(ctx);
  vm.runInContext(src + ';this.Sound=Sound;this.SOUND_RECIPES=SOUND_RECIPES;', ctx);
  return { Sound: ctx.Sound, R: ctx.SOUND_RECIPES };
}
const tones = notes => notes.filter(n => !n.noise);
const end = notes => Math.max(...notes.map(n => n.t + n.d));
const peak = notes => Math.max(...notes.map(n => n.v));
const top = notes => Math.max(...tones(notes).map(n => Math.max(n.f, n.f2 || 0)));
const low = notes => Math.min(...tones(notes).map(n => Math.min(n.f, n.f2 || Infinity)));

// Recipes: correct grows with time left, wrong grows with time used.
{
  const { R } = load();
  assert.ok(R.correct(1).length > R.correct(0).length, 'fast correct answer has more notes');
  assert.ok(peak(R.correct(1)) > peak(R.correct(0)), 'fast correct answer is louder');
  assert.ok(top(R.correct(1)) > top(R.correct(0)), 'fast correct answer reaches higher');
  assert.ok(end(R.wrong(1)) > end(R.wrong(0)), 'late wrong answer is longer');
  assert.ok(low(R.wrong(1)) < low(R.wrong(0)), 'late wrong answer goes lower');
  assert.ok(peak(R.wrong(1)) > peak(R.wrong(0)), 'late wrong answer is louder');
  for (const name of ['hover', 'click', 'correct', 'wrong', 'tick', 'tickFinal', 'timesUp', 'runOver', 'pick', 'unpick', 'full', 'saved']) {
    assert.ok(R[name], `missing recipe ${name}`);
    for (const i of [0, 0.5, 1]) for (const n of R[name](i)) {
      assert.ok(n.d > 0.005 && n.v > 0 && n.v <= 1 && n.t >= 0, `${name}(${i}) has a bad note`);
      assert.ok(n.noise || n.f > 0, `${name}(${i}) has a tone without a frequency`);
    }
  }
}

// Intensity outside 0..1 is clamped.
{
  const { Sound, R } = load();
  Sound.unlock();
  Sound.play('correct', 5);
  assert.strictEqual(FakeAudio.last.sources.length, R.correct(1).length, 'intensity above 1 clamps to 1');
  const before = FakeAudio.last.sources.length;
  Sound.play('correct', -3);
  assert.strictEqual(FakeAudio.last.sources.length - before, R.correct(0).length, 'intensity below 0 clamps to 0');
}

// Locked before the first gesture; unknown names are ignored.
{
  const { Sound } = load();
  assert.strictEqual(Sound.play('click'), false, 'silent before unlock');
  Sound.unlock();
  assert.strictEqual(Sound.play('nope'), false, 'unknown sound is ignored');
  assert.strictEqual(Sound.play('click'), true, 'plays after unlock');
}

// Ticks: once per new whole second, the final second adds a tock, resetTick re-arms.
{
  const { Sound } = load();
  Sound.unlock();
  assert.strictEqual(Sound.tick(3), true);
  assert.strictEqual(Sound.tick(3), false, 'same second does not tick twice');
  assert.strictEqual(Sound.tick(2), true);
  const n = FakeAudio.last.sources.length;
  assert.strictEqual(Sound.tick(1), true);
  assert.strictEqual(FakeAudio.last.sources.length - n, 2, 'final second plays tick and tock');
  Sound.resetTick();
  assert.strictEqual(Sound.tick(1), true, 'resetTick re-arms the same second');
}

// Hover: at most one per 40 ms.
{
  const clock = { t: 1000 };
  const { Sound } = load({ clock });
  Sound.unlock();
  assert.strictEqual(Sound.play('hover'), true);
  clock.t += 20;
  assert.strictEqual(Sound.play('hover'), false, 'second hover within 40 ms is dropped');
  clock.t += 30;
  assert.strictEqual(Sound.play('hover'), true);
}

// A new wrong sound stops the one still playing.
{
  const { Sound } = load();
  Sound.unlock();
  Sound.play('wrong', 1);
  const first = [...FakeAudio.last.sources];
  Sound.play('wrong', 0);
  assert.ok(first.every(s => s.stops.length === 2), 'previous wrong sound was stopped early');
}

// Mute: nothing plays, and the choice is remembered.
{
  const store = new Map();
  const a = load({ store });
  a.Sound.unlock();
  a.Sound.setMuted(true);
  assert.strictEqual(a.Sound.play('click'), false, 'muted click is silent');
  assert.strictEqual(a.Sound.tick(1), false, 'muted tick is silent');
  assert.strictEqual(load({ store }).Sound.isMuted(), true, 'mute remembered');
  a.Sound.setMuted(false);
  assert.strictEqual(load({ store }).Sound.isMuted(), false, 'unmute remembered');
  assert.strictEqual(load().Sound.isMuted(), false, 'unmuted by default');
}

// No Web Audio, or a constructor that throws: every call is a silent no-op.
for (const audio of [null, class { constructor() { throw new Error('blocked'); } }]) {
  const { Sound } = load({ audio });
  Sound.unlock();
  assert.strictEqual(Sound.play('correct', 1), false);
  assert.strictEqual(Sound.tick(1), false);
  Sound.resetTick();
  Sound.setMuted(true);
}

console.log('sound OK');
