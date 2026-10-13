/* Shared helpers.
   Every file in js/ is a classic <script>, so they all share one global scope and
   load order matters (see index.html). No build step is needed, and it works from file://. */

const $ = id => document.getElementById(id);
const setText = (id, text) => { $(id).textContent = text; };
const show = id => $(id).classList.remove('hidden');
const hide = id => $(id).classList.add('hidden');

// Fisher-Yates, in place.
const shuffle = a => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// localStorage that never throws (private mode, sandboxed iframes, blocked storage).
const LS = {
  getItem(k) { try { return localStorage.getItem(k); } catch { return null; } },
  setItem(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
  removeItem(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};

// Design tokens live in css/style.css (:root). JS reads them instead of hardcoding colours.
const token = name => getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();

// amCharts wants colours as numbers (0xrrggbb).
function tokenHex(name) {
  const v = token(name);
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`Unknown colour token --${name}`);
  return parseInt(v.slice(1), 16);
}

// The big floating reaction text ("Nice!", "Wrong! -3 seconds", ...).
function showReaction(text, color = token('bad'), extra = 'penaltyBurst') {
  const e = $('reaction');
  e.textContent = text;
  e.style.color = color;
  e.className = 'reaction';
  void e.offsetWidth; // restart the CSS animation
  e.className = `reaction show ${extra}`;
}
