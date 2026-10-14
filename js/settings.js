/* Settings: volume (stored by Sound), language (i18n.js) and colour blind mode.
   This file holds the state and applies it; main.js wires the settings window to it. */

const COLOR_BLIND_KEY = 'geogryphon.colorBlind';

const Settings = {
  colorBlind: () => document.documentElement.classList.contains('cb'),

  // Colour blind mode: html.cb swaps the right/wrong colour tokens to blue/orange and filters flag images
  // (css/style.css). Code that cached token colours is told to read them again.
  setColorBlind(on) {
    document.documentElement.classList.toggle('cb', !!on);
    LS.setItem(COLOR_BLIND_KEY, on ? '1' : '0');
    if (typeof MapView !== 'undefined') MapView.refreshPalette();
  },

  // Applies everything that was stored, once at start-up.
  load() {
    document.documentElement.classList.toggle('cb', LS.getItem(COLOR_BLIND_KEY) === '1');
    if (!setLanguage(LS.getItem(LANG_KEY) || 'en')) setLanguage('en');
  }
};

Settings.load();
