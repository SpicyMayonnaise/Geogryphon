/* Language packs: t('key', { vars }) returns the current language's text, falling back to English.
   Static page text is marked in index.html and filled by applyI18n():
     data-i18n="key"        -> textContent
     data-i18n-ph="key"     -> placeholder
     data-i18n-title="key"  -> title
     data-i18n-aria="key"   -> aria-label
   A new language is one file in js/lang/ that adds LANG_PACKS.<code>, plus its entry in LANGUAGES. */

// Every language the settings menu offers. `ready: false` shows it greyed out as "Coming soon".
const LANGUAGES = [
  { code: 'en', label: 'English', ready: true },
  { code: 'he', label: 'עברית', ready: false }
];
const LANG_KEY = 'geogryphon.lang';
const LANG_PACKS = {}; // filled by js/lang/*.js

let currentLang = 'en';

function t(key, vars = {}) {
  const text = LANG_PACKS[currentLang]?.[key] ?? LANG_PACKS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
}

const languageReady = code => !!LANG_PACKS[code] && !!LANGUAGES.find(l => l.code === code)?.ready;

// Switches the language, stores it and re-renders static text. Returns false for a language that is not ready.
function setLanguage(code) {
  if (!languageReady(code)) return false;
  currentLang = code;
  LS.setItem(LANG_KEY, code);
  document.documentElement.lang = code;
  document.documentElement.dir = LANG_PACKS[code].meta?.dir || 'ltr';
  applyI18n();
  return true;
}
