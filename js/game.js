/* Game flow, built around one explicit state machine.

   idle ──▶ loading ──▶ asking ──▶ between ──▶ loading ...        (right answer, next question)
                           │
                           └──▶ revealing ──▶ over               (lost: show the answer, then game over)
                                    └──▶ study ──▶ over          (flag mode with Study Mode on)

   Anything can fall back to `idle` (back to the menu) or restart at `loading` (new game).
   Rules that used to be scattered flags are now one question: "what state are we in?"
     - answers are only accepted in `asking`
     - the clock only runs in `asking`
     - every delayed callback is cancelled whenever a run ends, and every await re-checks `stale(rid)`
*/

const DIFFICULTY_SECONDS = { easy: 20, normal: 10, hard: 5, extreme: 3 };
// Free Play has no clock: no countdown, no time penalty. A wrong flag still ends the run.
const isFreePlay = () => difficulty === 'free';
// Share of the clock left (1 = all of it). Free Play counts as a middling answer for reactions and sounds.
const timeLeft = () => isFreePlay() ? .5 : Clock.ratio();
// After a Flag-mode loss, how long the marked answer tiles stay visible before the overlay covers them.
const FLAG_REVEAL_MS = 1000;

// A state may only be entered from the listed states ('*' = from anywhere).
const ALLOWED_FROM = {
  idle: '*',
  loading: '*',
  asking: ['loading'],
  between: ['asking'],
  revealing: ['asking'],
  study: ['revealing'],
  over: ['revealing', 'study']
};

let state = 'idle';
let mode = null, difficulty = 'normal', expertise = 'intermediate';
let duration = 10, maxTime = 10, score = 0;
let target = null, questionSpec = null;
let runId = 0, flagRetries = 0, recentTargets = [];
let selectedIds = new Set();
let pendingLoss = null;

function setState(next) {
  const allowed = ALLOWED_FROM[next];
  if (allowed !== '*' && !allowed?.includes(state)) {
    console.warn(`Ignored invalid state change: ${state} -> ${next}`);
    return false;
  }
  state = next;
  document.body.dataset.state = next;
  return true;
}
const stale = rid => rid !== runId;

/* ---------- delayed callbacks that die with the run ---------- */
const timers = new Set();
function later(fn, ms) {
  const h = setTimeout(() => { timers.delete(h); fn(); }, ms);
  timers.add(h);
  return h;
}
function cancelTimers() { timers.forEach(clearTimeout); timers.clear(); }

/* ---------- the countdown ---------- */
const Clock = (() => {
  let raf = 0, startAt = 0, max = 10, running = false, pausedAt = 0, onExpire = () => {};
  const now = () => performance.now();
  const ref = () => pausedAt || now();
  const ratio = () => Math.max(0, 1 - (ref() - startAt) / (max * 1000));
  // Timer colours step from calm to urgent; read from the CSS tokens once, not every frame.
  let steps = null;
  function paint(r) {
    steps ||= { calm: token('accent'), warn: token('hot'), urgent: token('bad') };
    const c = r > .5 ? steps.calm : r > .25 ? steps.warn : steps.urgent;
    $('timerBar').style.transform = `scaleX(${r})`;
    $('timerBar').style.background = c;
    $('time').style.color = c;
    $('time').textContent = Math.ceil(r * max) + 's';
  }
  function tick() {
    if (!running) return;
    const r = ratio();
    paint(r);
    if (r > 0 && r <= .25) Sound.tick(Math.ceil(r * max)); // red zone: one tick per shown second
    if (r <= 0) { running = false; onExpire(); return; }
    raf = requestAnimationFrame(tick);
  }
  return {
    start(seconds, cb) {
      max = seconds; onExpire = cb; running = true; pausedAt = 0; startAt = now();
      Sound.resetTick();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    },
    stop() { running = false; pausedAt = 0; cancelAnimationFrame(raf); Sound.resetTick(); },
    pause() { if (running && !pausedAt) { pausedAt = now(); cancelAnimationFrame(raf); } },
    resume() { if (running && pausedAt) { startAt += now() - pausedAt; pausedAt = 0; raf = requestAnimationFrame(tick); } },
    ratio,
    // Remove time. Returns the seconds left; at 0 the clock stops (the caller ends the round).
    penalize(seconds) {
      const left = Math.max(0, max - (ref() - startAt) / 1000 - seconds);
      if (left <= 0) { running = false; cancelAnimationFrame(raf); paint(0); return 0; }
      startAt = ref() - (max - left) * 1000;
      return left;
    }
  };
})();

/* ---------- selection (map and trivia) ---------- */
function clearSelections() {
  selectedIds.forEach(id => MapView.select(id, false));
  selectedIds.clear();
  updateSelectionUI();
}
function updateSelectionUI() {
  const required = questionSpec?.required || 1, count = selectedIds.size;
  setText('selectionProgress', `Selected: ${count} / ${required}`);
  $('confirmSelection').disabled = count !== required || state !== 'asking';
}
function selectMapCountry(id) {
  if (state !== 'asking' || mode === 'flag' || !questionSpec) return;
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    MapView.select(id, false);
    Sound.play('unpick');
    updateSelectionUI();
    return;
  }
  const required = questionSpec.required || 1;
  if (required === 1) {
    selectedIds.forEach(old => MapView.select(old, false));
    selectedIds.clear();
  } else if (selectedIds.size >= required) {
    showReaction('Selection full', token('text-2'), 'selectionFull');
    Sound.play('full');
    return;
  }
  selectedIds.add(id);
  MapView.select(id, true);
  Sound.play('pick');
  updateSelectionUI();
}
function confirmMapSelection() {
  if (state !== 'asking' || !questionSpec || selectedIds.size !== (questionSpec.required || 1)) return;
  const correct = [...selectedIds].every(id => questionSpec.eligible.includes(id));
  if (!correct) { applyPenalty(); return; }
  onCorrect(questionSpec.multi ? questionSpec.required : 1, 700);
}

/* ---------- outcomes ---------- */
function onCorrect(points, delayMs) {
  const r = timeLeft();
  if (!setState('between')) return;
  Clock.stop();
  score += points;
  setText('score', score);
  const word = isFreePlay() ? 'Correct!' : r > .7 ? 'Damn!' : r > .35 ? 'Nice!' : 'Close!';
  showReaction(points > 1 ? `Correct! +${points} points` : word, token('good'), '');
  Sound.play('correct', r); // faster answers sound bigger
  clearSelections();
  const rid = runId;
  later(() => askNext(rid), delayMs);
}

function applyPenalty() {
  if (isFreePlay()) {
    showReaction('Wrong! Try again');
    clearSelections();
    Sound.play('wrong', .5);
    return;
  }
  const r = Clock.ratio(); // before the penalty: how much time the player had used
  const seconds = Math.max(1, Math.floor(maxTime * .33));
  const left = Clock.penalize(seconds);
  const track = $('timerBar').parentElement;
  track.classList.remove('penalty');
  void track.offsetWidth;
  track.classList.add('penalty');
  later(() => track.classList.remove('penalty'), 520);
  showReaction(`Wrong! −${seconds} second${seconds === 1 ? '' : 's'}`);
  clearSelections();
  Sound.play('wrong', left <= 0 ? 1 : 1 - r);
  if (left <= 0) { Sound.play('timesUp', 0, 0.5); lose('The time penalty ran out the clock!'); } // buzzer after the wrong sound
}

async function lose(reason, pickedCode = null) {
  if (state !== 'asking') return;
  const rid = runId;
  setState('revealing');
  Clock.stop();
  clearSelections();
  const eligible = mode === 'flag' ? [target.code] : (questionSpec?.eligible || [target.code]);
  if (mode === 'flag') {
    // Show the player's pick (red) and the right answer (green) before the modal or Study card covers them.
    markAnswers(pickedCode, target.code);
    await new Promise(resolve => later(resolve, FLAG_REVEAL_MS));
    if (stale(rid) || state !== 'revealing') return;
  } else {
    const names = eligible.map(id => countryByCode(id)?.name).filter(Boolean);
    const completed = await MapView.highlight(eligible, {
      duration: 5000,
      label: eligible.length > 1 ? `Eligible answers: ${names.join(', ')}` : `Correct answer: ${names[0]}`
    });
    if (stale(rid) || state !== 'revealing' || !completed) return;
  }
  const countries = eligible.map(id => countryByCode(id)).filter(Boolean);
  if (mode === 'flag' && $('studyMode').checked && countries[0]) { openStudyCard(countries[0], reason); return; }
  showGameOver(reason, countries);
}

function showGameOver(reason, countries) {
  if (!setState('over')) return;
  setText('final', score);
  setText('correct', countries.map(c => c.name).join(', '));
  setText('reason', reason);
  $('saveBtn').disabled = false;
  show('modal');
  Sound.play('runOver');
}

function openStudyCard(country, reason) {
  if (!setState('study')) return;
  const entry = flagStudyEntry(country);
  pendingLoss = { reason, country };
  setText('studyTitle', `About ${country.name}’s flag`);
  $('studySummary').classList.remove('loading');
  setText('studySummary', entry.summary);
  $('studyReadMore').href = entry.source;
  $('studyReadMore').title = `Open a detailed flag explanation for ${country.name}`;
  $('studyReadMore').classList.toggle('hidden', !entry.source);
  loadFlag($('studyFlag'), country.code, { alt: `${country.name} flag`, timeout: 2500 });
  show('studyCard');
}
function continueFromStudy() {
  if (state !== 'study' || !pendingLoss) return;
  const { reason, country } = pendingLoss;
  pendingLoss = null;
  hide('studyCard');
  showGameOver(reason, [country]);
}

/* ---------- asking questions ---------- */
function pickTarget(pool) {
  const keep = Math.max(1, Math.min(10, Math.floor(pool.length / 2)));
  let opts = pool.filter(c => !recentTargets.includes(c.code));
  if (!opts.length) opts = pool;
  const c = opts[Math.floor(Math.random() * opts.length)];
  recentTargets.push(c.code);
  recentTargets = recentTargets.slice(-keep);
  return c;
}

function beginAsking(seconds, rid) {
  if (stale(rid) || !setState('asking')) return;
  if (isFreePlay()) { setText('time', '∞'); $('time').style.color = ''; }
  else Clock.start(seconds, () => { Sound.play('timesUp'); lose('Time’s up!'); });
  updateSelectionUI();
}

async function askNext(rid) {
  if (stale(rid)) return;
  MapView.clearHighlight();
  clearSelections();
  if (!setState('loading')) return;

  if (mode === 'flag') {
    hide('questionActions');
    target = pickTarget(flagPool());
    setText('question', 'Which country is this?');
    show('flagArea'); hide('mapWrap');
    const options = shuffle([target, ...shuffle(flagPool().filter(x => x.code !== target.code)).slice(0, 3)]);
    $('answers').classList.add('fresh'); // no hover ring until the mouse moves (main.js)
    $('answers').replaceChildren(...options.map((x, i) => {
      const b = document.createElement('button');
      b.className = 'answer';
      b.dataset.code = x.code;
      b.textContent = `${i + 1}. ${x.name}`;
      b.addEventListener('click', () => onFlagAnswer(x.code));
      return b;
    }));
    const res = await loadFlag($('flag'), target.code, { alt: 'Mystery country flag', timeout: 3500 });
    if (stale(rid)) return;
    // The emoji fallback can leak the answer (two letters on Windows), so re-roll a few times first.
    if (!res.ok && flagRetries < 5) { flagRetries++; return askNext(rid); }
    flagRetries = 0;
    maxTime = duration;
    beginAsking(maxTime, rid);
    return;
  }

  show('questionActions'); hide('flagArea'); show('mapWrap');
  $('answers').replaceChildren();
  if (mode === 'map') {
    target = pickTarget(mapPool());
    questionSpec = { category: 'map', multi: false, required: 1, eligible: [target.code], text: `Find ${target.name}` };
  } else {
    questionSpec = nextTriviaQuestion();
    target = countryByCode(questionSpec.eligible[0]);
  }
  setText('question', questionSpec.text);
  maxTime = duration + (questionSpec.multi ? questionSpec.required * Math.max(2, Math.round(duration / 2)) : 0);
  MapView.resizeAndReset();
  beginAsking(maxTime, rid);
}

function onFlagAnswer(code) {
  if (state !== 'asking' || mode !== 'flag') return;
  if (code === target.code) { markAnswers(code, code); onCorrect(1, 650); return; }
  Sound.play('wrong', 1 - timeLeft());
  lose('Wrong answer.', code);
}

// Marks the picked and the correct flag answer. markAnswers(null, null) clears the marks.
function markAnswers(pickedCode, correctCode) {
  $('answers').querySelectorAll('.answer').forEach(b => {
    b.classList.toggle('is-correct', b.dataset.code === correctCode);
    b.classList.toggle('is-wrong', b.dataset.code === pickedCode && pickedCode !== correctCode);
  });
}

/* ---------- trivia readiness ---------- */
function triviaReadiness() {
  const mapped = mapCountryIds.size, trivia = mapPool().filter(c => c.capital).length;
  return { mapped, trivia, ready: mapped >= 20 && trivia >= 20 };
}
async function waitForTriviaReady() {
  setText('question', 'Preparing the expanded trivia database…');
  hide('questionActions');
  await MapView.waitReady(8000);
  const st = triviaReadiness();
  if (!st.ready && mapPool().filter(c => c.capital).length < 10) throw new Error('Trivia data could not be prepared.');
  resetQuestions();
  const candidates = candidateQuestions();
  const multi = candidates.filter(q => q.multi).length;
  const cats = [...new Set(candidates.map(q => q.category))];
  const counts = cats.map(c =>
    `${c} ${candidates.filter(q => q.category === c && !q.multi).length}/${candidates.filter(q => q.category === c && q.multi).length}`).join(' · ');
  console.info('Trivia question pool (single/multi):', counts);
  setText('countryDataStatus', `Trivia ready: ${triviaPool().length} countries · ${candidates.length} questions · ${multi} multi-select · single/multi: ${counts}`);
  return candidates.length;
}

/* ---------- starting, restarting, leaving ---------- */
// Stop everything belonging to the current run. Callers bump runId first.
function resetRun() {
  cancelTimers();
  Clock.stop();
  MapView.clearHighlight();
  clearSelections();
  pendingLoss = null;
  hide('studyCard');
  hide('modal');
}

async function startGame(m) {
  if (m !== 'flag' && !MapView.available()) {
    setText('countryDataStatus', 'The map library failed to load. Check your connection and reload. Flag mode still works.');
    return;
  }
  runId++;
  const rid = runId;
  resetRun();
  setState('loading');

  mode = m;
  difficulty = document.querySelector('[name=difficulty]:checked').value;
  expertise = document.querySelector('[name=expertise]:checked').value;
  duration = DIFFICULTY_SECONDS[difficulty] ?? 10;
  document.body.classList.toggle('freePlay', isFreePlay());
  score = 0; target = null; questionSpec = null; recentTargets = []; flagRetries = 0;
  resetQuestions();
  resetScoreSaved();
  setText('score', 0);

  document.body.dataset.gameMode = m;
  hide('menu'); show('game');
  const label = m === 'flag' ? 'Flag' : m === 'map' ? 'Map' : 'Trivia';
  const diffLabel = isFreePlay() ? 'Free Play' : difficulty[0].toUpperCase() + difficulty.slice(1);
  setText('modeLabel', `${label.toUpperCase()} · ${diffLabel.toUpperCase()} · ${expertise.toUpperCase()}`);
  setText('boardTitle', `🏆 ${label} · ${diffLabel} · ${expertiseLabel()} Top 10`);
  renderBoard();

  if (m !== 'flag') { MapView.ensure(); MapView.setTooltips($('showNames').checked); }
  if (m === 'flag') preloadFlags();
  if (m === 'map') { await MapView.waitReady(8000); if (stale(rid)) return; }
  if (m === 'trivia') {
    try { await waitForTriviaReady(); }
    catch (error) {
      if (stale(rid)) return;
      setText('question', error.message);
      showReaction('Trivia data unavailable', token('bad'), 'penaltyBurst');
      return;
    }
    if (stale(rid)) return;
  }
  askNext(rid);
}

function showMenu() {
  runId++;
  setBoardOpen(false);
  resetRun();
  setState('idle');
  hide('game'); show('menu');
}
