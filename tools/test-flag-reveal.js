// Flag mode: after a loss the marked answer tiles must stay visible for a moment before the
// run-over modal or Study card covers them, and a timeout must still show the right answer.
// Usage: node tools/test-flag-reveal.js
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'game.js'), 'utf8');
const fn = src.match(/async function lose\([\s\S]*?\n}\n/);
assert.ok(fn, 'lose() not found in game.js');
const flush = () => new Promise(r => setImmediate(r));
const revealMs = Number((src.match(/const FLAG_REVEAL_MS = (\d+);/) || [])[1]);
assert.ok(revealMs > 0, 'FLAG_REVEAL_MS not found in game.js');

function run(lossArgs) {
  const calls = { gameOver: 0, study: 0, marks: [] };
  const pending = [];
  const ctx = {
    FLAG_REVEAL_MS: revealMs, state: 'asking', runId: 1, mode: 'flag', target: { code: 'KW' }, questionSpec: null,
    setState(s) { ctx.state = s; return true; },
    stale: rid => rid !== ctx.runId,
    Clock: { stop() {} },
    clearSelections() {},
    countryByCode: code => ({ code, name: code }),
    later: (cb, ms) => { pending.push({ cb, ms }); },
    markAnswers: (picked, correct) => calls.marks.push([picked, correct]),
    $: () => ({ checked: false }),
    openStudyCard() { calls.study++; },
    showGameOver() { calls.gameOver++; },
    MapView: { highlight: async () => true }, tokenHex: () => 0
  };
  vm.createContext(ctx);
  vm.runInContext(fn[0] + ';this.lose=lose;', ctx);
  return { ctx, calls, pending, done: ctx.lose(...lossArgs) };
}

(async () => {
  // Wrong pick: tiles were already marked by onFlagAnswer; the modal must wait.
  const wrong = run(['Wrong answer.', 'SD']);
  await flush();
  assert.strictEqual(wrong.calls.gameOver, 0, 'modal opened in the same tick, hiding the marked tiles');
  assert.strictEqual(wrong.pending.length, 1, 'expected one delayed callback via later()');
  assert.ok(wrong.pending[0].ms >= 800, `reveal pause too short: ${wrong.pending[0].ms}ms`);
  assert.deepStrictEqual(wrong.calls.marks.at(-1), ['SD', 'KW'], 'wrong and correct tiles marked');
  wrong.pending[0].cb();
  await flush();
  assert.strictEqual(wrong.calls.gameOver, 1, 'modal opens after the pause');

  // Timeout: nothing picked, the correct tile is still revealed.
  const timeout = run(['Time is up!']);
  await flush();
  assert.deepStrictEqual(timeout.calls.marks.at(-1), [null, 'KW'], 'correct tile marked on timeout');

  // A new run (menu / play again) during the pause cancels the modal.
  const stale = run(['Wrong answer.', 'SD']);
  await flush();
  stale.ctx.runId = 2;
  stale.pending[0].cb();
  await flush();
  assert.strictEqual(stale.calls.gameOver, 0, 'stale run must not open the modal');

  await wrong.done;
  console.log('flag reveal OK');
})().catch(e => { console.error(e.message); process.exit(1); });
