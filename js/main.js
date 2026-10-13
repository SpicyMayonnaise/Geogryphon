/* Wiring: connects the page's buttons and keys to the game, and starts loading data.
   Loaded last. Nothing else touches the page's event listeners. */

MapView.init({
  onPick: selectMapCountry,
  isSelected: id => selectedIds.has(id),
  showNames: () => $('showNames').checked,
  showFlags: () => $('showFlags').checked,
  onData: ids => { mapCountryIds = ids; updateCountryStatus(); }
});

/* ---------- menu ---------- */
document.querySelectorAll('[data-mode]').forEach(btn =>
  btn.addEventListener('click', () => startGame(btn.dataset.mode)));
document.querySelectorAll('[name=expertise]').forEach(r =>
  r.addEventListener('change', () => { expertise = r.value; updateCountryStatus(); }));

/* ---------- in game ---------- */
$('backBtn').addEventListener('click', showMenu);
$('confirmSelection').addEventListener('click', confirmMapSelection);
$('zoomInBtn').addEventListener('click', () => MapView.zoomIn());
$('zoomOutBtn').addEventListener('click', () => MapView.zoomOut());
$('zoomResetBtn').addEventListener('click', () => MapView.resetView());

/* ---------- study card and game over ---------- */
$('studyContinue').addEventListener('click', continueFromStudy);
$('saveBtn').addEventListener('click', saveScore);
$('againBtn').addEventListener('click', () => startGame(mode));
$('name').addEventListener('keydown', e => { if (e.key === 'Enter') saveScore(); });

/* ---------- keyboard ---------- */
document.addEventListener('keydown', e => {
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
  if ($('game').classList.contains('hidden') || !$('modal').classList.contains('hidden') || !$('studyCard').classList.contains('hidden')) return;
  const active = document.activeElement;
  const typing = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
  if (typing) return;

  if (mode === 'flag' && state === 'asking') {
    const i = '1234'.indexOf(e.key);
    if (i >= 0) $('answers').children[i]?.click();
    return;
  }
  if (e.code !== 'Space') return;
  if (mode !== 'flag' && state === 'asking' && !$('confirmSelection').disabled) {
    e.preventDefault();
    confirmMapSelection();
  } else if (state === 'revealing') {
    e.preventDefault();
    MapView.skipReveal(); // skip the 5-second answer reveal
  }
});

/* ---------- pause the clock while the tab is hidden ---------- */
document.addEventListener('visibilitychange', () => {
  if (state !== 'asking') return;
  if (document.hidden) Clock.pause(); else Clock.resume();
});

/* ---------- data ---------- */
$('liveRefresh').checked = liveRefreshEnabled();
$('liveRefresh').addEventListener('change', e => {
  setLiveRefreshEnabled(e.target.checked);
  refreshCountryData(); // turning it on fetches now; turning it off takes effect on the next page load
});
updateCountryStatus();
refreshCountryData();
