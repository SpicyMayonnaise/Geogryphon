/* Local leaderboard: top 10 per mode + difficulty + expertise, kept in localStorage. */

let scoreSaved = false;

const scoreKey = () => `geoScores_${mode}_${difficulty}_${expertise}`;

function readScores() {
  try {
    const a = JSON.parse(LS.getItem(scoreKey()) || '[]');
    return Array.isArray(a) ? a.filter(x => x && typeof x.name === 'string' && Number.isFinite(x.score)) : [];
  } catch { return []; }
}

function renderBoard() {
  const rows = readScores().sort((a, b) => b.score - a.score).slice(0, 10);
  const el = $('board');
  el.replaceChildren();
  if (!rows.length) {
    const p = document.createElement('p');
    p.textContent = 'No scores yet.';
    el.append(p);
    return;
  }
  rows.forEach((x, i) => {
    const row = document.createElement('div');
    row.className = 'row';
    const rank = document.createElement('b'); rank.className = 'rank'; rank.textContent = i + 1;
    const name = document.createElement('span'); name.className = 'player'; name.textContent = x.name;
    const pts = document.createElement('b'); pts.className = 'pts'; pts.textContent = x.score;
    row.append(rank, name, pts);
    el.append(row);
  });
}

function saveScore() {
  if (scoreSaved) return;
  const name = $('name').value.trim();
  if (!name) return;
  const all = readScores();
  all.push({ name, score });
  LS.setItem(scoreKey(), JSON.stringify(all.sort((a, b) => b.score - a.score).slice(0, 10)));
  scoreSaved = true;
  $('saveBtn').disabled = true;
  renderBoard();
}

// A new run (or leaving the menu) makes the next game-over save-able again.
function resetScoreSaved() { scoreSaved = false; }
