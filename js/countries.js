/* Country database: built from the bundled rows (data/countries.js), so everything works offline.
   An optional online refresh can update populations. It never touches names, capitals, languages or
   which countries are playable. */

const ISO_CODES = COUNTRY_ROWS.trim().split('\n').map(line => line.split('|')[0]);

let DATA = COUNTRY_ROWS.trim().split('\n').map(line => {
  const [code, cca3, name, capital, continent, languages, thousands, playable] = line.split('|');
  return {
    code, cca3, name, capital,
    continent: CONTINENT_NAMES[continent] || '',
    languages: languages ? languages.split(';') : [],
    population: Number(thousands) * 1000,
    playable: playable === '1',
    independent: playable === '1' // used by Study Mode to pick the Wikipedia link
  };
});
const BY_CODE = new Map(DATA.map(c => [c.code, c]));
const BY_CCA3 = new Map(DATA.map(c => [c.cca3, c]));
const countryByCode = code => BY_CODE.get(code);

// Most familiar first, then everything else. Codes with no data row (e.g. XK) are dropped so tier sizes are exact.
const FAMILIARITY_RANKING = [...FAMILIARITY_CORE, ...ISO_CODES.filter(code => !FAMILIARITY_CORE.includes(code))].filter(code => BY_CODE.has(code));

let mapCountryIds = new Set(); // countries that have a clickable shape on the map (set by main.js)

/* ---------- expertise tiers ---------- */
const _expCache = {};
function expertiseCodes(level = expertise) {
  return _expCache[level] ??= buildExpertiseCodes(level);
}
function buildExpertiseCodes(level) {
  const limit = EXPERTISE_LIMITS[level] ?? 120;
  return new Set(Number.isFinite(limit) ? FAMILIARITY_RANKING.slice(0, limit) : FAMILIARITY_RANKING);
}
function expertiseLabel(level = expertise) {
  return t(`exp.${level || 'intermediate'}`);
}

/* ---------- pools used by the game modes ---------- */
// Flag mode uses every country and territory in the chosen tier.
function flagPool() {
  const allowed = expertiseCodes();
  return DATA.filter(c => allowed.has(c.code));
}
// Map mode uses sovereign states that have a shape on the map.
function mapPool() {
  const allowed = expertiseCodes();
  const pool = DATA.filter(c => allowed.has(c.code) && c.playable && mapCountryIds.has(c.code));
  return pool.length ? pool : DATA.filter(c => allowed.has(c.code) && c.playable);
}
function triviaPool() {
  return mapPool().filter(c => c.capital || c.languages.length);
}

/* ---------- optional online refresh (populations only) ---------- */
const REFRESH_PREF_KEY = 'geoLiveRefreshV1';
const POP_CACHE_KEY = 'geoPopulationV3', POP_CACHE_AGE = 86400000; // one day
let refreshState = 'off'; // off | pending | done | failed

const liveRefreshEnabled = () => LS.getItem(REFRESH_PREF_KEY) !== '0';
function setLiveRefreshEnabled(on) { LS.setItem(REFRESH_PREF_KEY, on ? '1' : '0'); }

// Ignore anything that disagrees wildly with the bundled number (bad API data).
function acceptPopulation(c, value) {
  const v = Number(value);
  if (!(v > 0)) return false;
  return !(c.population > 0 && (v / c.population > 2 || v / c.population < .5));
}
function applyPopulations(pairs) {
  let applied = 0;
  for (const [cca3, value, year] of pairs) {
    const c = BY_CCA3.get(cca3);
    if (c && c.playable && acceptPopulation(c, value)) { c.population = Number(value); c.populationYear = year; applied++; }
  }
  return applied;
}
async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(r.status);
  return r.json();
}
async function worldBankPopulations() {
  try {
    const cached = JSON.parse(LS.getItem(POP_CACHE_KEY) || 'null');
    if (cached?.pairs && Date.now() - cached.savedAt < POP_CACHE_AGE) return cached.pairs;
  } catch { /* ignore */ }
  const j = await fetchJson('https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&mrv=1&per_page=400');
  const pairs = (j?.[1] || []).filter(x => x.value && x.countryiso3code).map(x => [x.countryiso3code, x.value, x.date]);
  LS.setItem(POP_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), pairs }));
  return pairs;
}
async function restCountriesPopulations() {
  const rows = await fetchJson('https://restcountries.com/v3.1/all?fields=cca3,population');
  return rows.map(r => [r.cca3, r.population, '']);
}
async function refreshCountryData() {
  if (!liveRefreshEnabled()) { refreshState = 'off'; updateCountryStatus(); return; }
  refreshState = 'pending';
  updateCountryStatus();
  for (const source of [worldBankPopulations, restCountriesPopulations]) {
    try {
      if (applyPopulations(await source()) >= 100) { refreshState = 'done'; updateCountryStatus(); return; }
    } catch { /* try the next source */ }
  }
  refreshState = 'failed';
  updateCountryStatus();
}

/* ---------- menu status line ---------- */
function updateCountryStatus() {
  const e = $('countryDataStatus');
  if (!e) return;
  const playable = DATA.filter(c => c.playable).length;
  const mapped = mapCountryIds.size ? DATA.filter(c => c.playable && mapCountryIds.has(c.code)).length : t('status.pending');
  const source = t({ off: 'status.off', pending: 'status.checking', done: 'status.done', failed: 'status.failed' }[refreshState]);
  e.textContent = t('status.line', { flags: DATA.length, countries: playable, mapped, source });
}
