/* Sound effects, made in code with the Web Audio API: no audio files, works from file:// and offline.
   The only file that touches audio. Every call is safe: with no Web Audio, before the first user
   gesture (browsers block audio until then), or while muted, Sound simply does nothing. */

const SOUND_MUTE_KEY = 'geogryphon.muted';
const HOVER_GAP_MS = 40;

const clamp01 = x => Math.min(1, Math.max(0, Number(x) || 0));
const lerp = (a, b, t) => a + (b - a) * t;

/* Each recipe turns an intensity (0..1) into notes:
   f = start pitch (Hz), f2 = end pitch for a glide, t = start offset (s), d = length (s),
   type = oscillator wave, v = peak volume (0..1), noise = a short noise burst instead of a tone. */
const SOUND_RECIPES = {
  hover: () => [{ f: 1760, t: 0, d: 0.03, type: 'sine', v: 0.04 }],
  click: () => [{ f: 440, f2: 220, t: 0, d: 0.07, type: 'triangle', v: 0.25 }],
  // Rising arpeggio: more notes, higher, brighter and louder the more time was left.
  correct: i => {
    const lift = lerp(1, 1.26, i);
    const step = lerp(0.09, 0.055, i);
    const type = i > 0.5 ? 'square' : 'triangle';
    const v = lerp(0.18, 0.3, i);
    const notes = [523.25, 659.25, 783.99, 1046.5].slice(0, Math.round(lerp(2, 4, i)))
      .map((f, k) => ({ f: f * lift, t: k * step, d: 0.12, type, v }));
    if (i >= 0.6) notes.push({ f: 2093 * lift, f2: 2637 * lift, t: notes.length * step, d: 0.3, type: 'sine', v: v / 2 });
    return notes;
  },
  // Falling "bonk": longer, lower, harsher and louder the more time was used.
  wrong: i => {
    const type = i > 0.5 ? 'sawtooth' : 'square';
    const v = lerp(0.16, 0.28, i);
    return [
      { f: lerp(330, 247, i), t: 0, d: 0.08, type, v },
      { f: lerp(262, 196, i), f2: lerp(220, 82, i), t: 0.09, d: lerp(0.12, 0.45, i), type, v }
    ];
  },
  tick: i => [{ f: lerp(900, 1200, i), t: 0, d: 0.035, type: 'square', v: lerp(0.07, 0.14, i) }],
  tickFinal: () => [
    { f: 1200, t: 0, d: 0.035, type: 'square', v: 0.15 },
    { f: 1500, t: 0.5, d: 0.035, type: 'square', v: 0.15 }
  ],
  timesUp: () => [
    { f: 220, t: 0, d: 0.25, type: 'square', v: 0.25 },
    { f: 165, t: 0.3, d: 0.35, type: 'square', v: 0.25 }
  ],
  runOver: () => [392, 329.63, 261.63, 196]
    .map((f, k) => ({ f, t: k * 0.15, d: k === 3 ? 0.45 : 0.13, type: 'triangle', v: 0.22 })),
  pick: () => [{ f: 660, f2: 990, t: 0, d: 0.07, type: 'sine', v: 0.18 }],
  unpick: () => [{ f: 990, f2: 660, t: 0, d: 0.07, type: 'sine', v: 0.14 }],
  full: () => [
    { f: 140, f2: 80, t: 0, d: 0.14, type: 'sine', v: 0.3 },
    { noise: true, t: 0, d: 0.05, v: 0.1 }
  ],
  saved: () => [
    { f: 783.99, t: 0, d: 0.1, type: 'triangle', v: 0.2 },
    { f: 1174.66, t: 0.1, d: 0.25, type: 'triangle', v: 0.2 }
  ]
};

const Sound = (() => {
  let ctx = null, master = null, noise = null, broken = false;
  let muted = LS.getItem(SOUND_MUTE_KEY) === '1';
  let lastHover = -Infinity, lastTick = null, wrongVoices = [];

  // Runs on every pointerdown/keydown: creates the audio context on the first gesture and wakes it
  // again if the browser suspended it.
  function unlock() {
    if (broken) return;
    try {
      if (!ctx) {
        const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Ctx) { broken = true; return; }
        ctx = new Ctx();
        master = ctx.createGain();
        master.gain.value = 0.6;
        master.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    } catch {
      broken = true;
      ctx = null;
    }
  }

  function noiseBuffer() {
    if (!noise) {
      noise = ctx.createBuffer(1, Math.round(ctx.sampleRate * 0.2), ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    }
    return noise;
  }

  // One note: a tone or noise burst through a quick attack and an exponential release (no clicks).
  function voice(n, at) {
    const start = at + n.t, end = start + n.d;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(n.v, start + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    env.connect(master);
    let src;
    if (n.noise) {
      src = ctx.createBufferSource();
      src.buffer = noiseBuffer();
    } else {
      src = ctx.createOscillator();
      src.type = n.type;
      src.frequency.setValueAtTime(n.f, start);
      if (n.f2) src.frequency.exponentialRampToValueAtTime(n.f2, end);
    }
    src.connect(env);
    src.start(start);
    src.stop(end + 0.02);
    return src;
  }

  const silence = voices => voices.forEach(v => { try { v.stop(); } catch { /* already stopped */ } });

  function play(name, intensity = 0) {
    if (muted || broken || !ctx || !SOUND_RECIPES[name]) return false;
    if (name === 'hover') {
      const now = performance.now();
      if (now - lastHover < HOVER_GAP_MS) return false;
      lastHover = now;
    }
    try {
      if (name === 'wrong') silence(wrongVoices); // repeated misses never stack
      const at = ctx.currentTime + 0.01;
      const voices = SOUND_RECIPES[name](clamp01(intensity)).map(n => voice(n, at));
      if (name === 'wrong') wrongVoices = voices;
      return true;
    } catch {
      broken = true;
      return false;
    }
  }

  // The countdown calls this every frame while the timer is red; only a new whole second plays.
  function tick(secondsLeft) {
    if (secondsLeft === lastTick) return false;
    lastTick = secondsLeft;
    return secondsLeft <= 1 ? play('tickFinal') : play('tick', 1 - (secondsLeft - 1) / 5);
  }

  return {
    unlock,
    play,
    tick,
    resetTick() { lastTick = null; },
    isMuted: () => muted,
    setMuted(on) {
      muted = !!on;
      LS.setItem(SOUND_MUTE_KEY, muted ? '1' : '0');
      if (muted) silence(wrongVoices);
    }
  };
})();
