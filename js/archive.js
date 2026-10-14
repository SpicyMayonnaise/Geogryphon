/* Archive: a browsable card for every flag in the game (countries and territories).
   Idle card: flag with the name below. Hovered (mouse) or tapped/clicked: the card pops out with the
   country's details from the data set. A search box and continent chips narrow the grid.
   Built once, the first time the Archive opens; flags load as their cards scroll into view. */

const Archive = (() => {
  let builtLang = null, continent = '', observer = null;
  const cards = []; // { el, country, text } where text is the lowercased search haystack

  function formatPopulation(p) {
    if (!(p > 0)) return t('archive.unknown');
    if (p >= 1e6) return t('archive.millions', { value: (p / 1e6).toFixed(p < 1e7 ? 1 : 0) });
    return t('archive.thousands', { value: Math.round(p / 1e3) });
  }

  function infoRow(labelKey, value) {
    const row = document.createElement('div');
    row.className = 'archiveInfoRow';
    const label = document.createElement('span');
    label.className = 'archiveInfoLabel';
    label.textContent = `${t(labelKey)}:`;
    const val = document.createElement('span');
    val.textContent = value || t('archive.unknown');
    row.append(label, ' ', val);
    return row;
  }

  // The popped-out details, rebuilt on open so they follow the current language.
  function fillPop(pop, c) {
    const flag = document.createElement('img');
    flag.className = 'archiveFlag';
    flag.alt = '';
    const card = pop.parentElement;
    flag.src = card.querySelector('.archiveFace img').src;
    const name = document.createElement('h3');
    name.textContent = countryName(c);
    const rows = [
      infoRow('archive.capital', c.capital),
      infoRow('archive.continent', c.continent),
      infoRow('archive.languages', c.languages.join(' / ')),
      infoRow('archive.population', formatPopulation(c.population))
    ];
    pop.replaceChildren(flag, name, ...rows);
    if (!c.playable) {
      const tag = document.createElement('span');
      tag.className = 'archiveTag';
      tag.textContent = t('archive.territory');
      pop.append(tag);
    }
  }

  function makeCard(c) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'archiveCard';
    el.dataset.code = c.code;
    const face = document.createElement('span');
    face.className = 'archiveFace';
    const img = document.createElement('img');
    img.alt = '';
    img.className = 'loading';
    const name = document.createElement('span');
    name.className = 'archiveName';
    name.textContent = countryName(c);
    face.append(img, name);
    const pop = document.createElement('span');
    pop.className = 'archivePop';
    pop.setAttribute('aria-hidden', 'true');
    el.append(face, pop);
    el.setAttribute('aria-label', countryName(c));
    return el;
  }

  // Keep a popped-out card on screen: near the left or right edge it grows inwards instead of centred.
  function place(el) {
    const pop = el.querySelector('.archivePop');
    const c = cards.find(x => x.el === el)?.country;
    if (c) fillPop(pop, c);
    el.classList.remove('edgeL', 'edgeR');
    const r = el.getBoundingClientRect(), half = pop.offsetWidth / 2, mid = r.left + r.width / 2;
    if (mid - half < 8) el.classList.add('edgeL');
    else if (mid + half > document.documentElement.clientWidth - 8) el.classList.add('edgeR');
  }

  function closeAll(except = null) {
    cards.forEach(({ el }) => {
      if (el === except) return;
      el.classList.remove('open');
      el.querySelector('.archivePop').setAttribute('aria-hidden', 'true');
    });
  }

  function toggle(el) {
    const opening = !el.classList.contains('open');
    closeAll(el);
    if (opening) place(el);
    el.classList.toggle('open', opening);
    el.querySelector('.archivePop').setAttribute('aria-hidden', String(!opening));
  }

  function filter() {
    const q = $('archiveSearch').value.trim().toLowerCase();
    let shown = 0;
    cards.forEach(({ el, country, text }) => {
      const ok = (!continent || country.continent === continent) && (!q || text.includes(q));
      el.classList.toggle('hidden', !ok);
      if (ok) shown++;
    });
    setText('archiveCount', shown ? t('archive.count', { count: shown }) : t('archive.none'));
  }

  function renderFilters() {
    const names = [...new Set(DATA.map(c => c.continent).filter(Boolean))].sort();
    $('archiveFilters').replaceChildren(...['', ...names].map(name => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'archiveChip';
      chip.textContent = name || t('archive.all');
      chip.setAttribute('aria-pressed', String(name === continent));
      chip.addEventListener('click', () => { continent = name; renderFilters(); filter(); });
      return chip;
    }));
  }

  // Built per language: names and their sort order change with it.
  function build() {
    builtLang = currentLang;
    cards.length = 0;
    observer?.disconnect();
    observer = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      observer.unobserve(e.target);
      const c = cards.find(x => x.el === e.target)?.country;
      if (c) loadFlag(e.target.querySelector('.archiveFace img'), c.code, { alt: '', timeout: 2500 });
    }), { rootMargin: '300px' });
    const sorted = [...DATA].sort((a, b) => countryName(a).localeCompare(countryName(b), currentLang));
    for (const c of sorted) {
      const el = makeCard(c);
      cards.push({ el, country: c, text: [c.name, countryName(c), c.capital, c.continent, ...c.languages].join(' ').toLowerCase() });
      el.addEventListener('click', () => toggle(el));
      el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') place(el); });
      el.addEventListener('focus', () => place(el));
      observer.observe(el);
    }
    $('archiveGrid').replaceChildren(...cards.map(c => c.el));
  }
  $('archiveSearch').addEventListener('input', () => { closeAll(); filter(); });
  // A tap anywhere outside a card closes the open one.
  document.addEventListener('click', e => { if (!e.target.closest?.('.archiveCard')) closeAll(); });

  return {
    open() {
      if (builtLang !== currentLang) build();
      renderFilters();
      filter();
      hide('menu'); show('archive');
      window.scrollTo(0, 0);
    },
    close() {
      closeAll();
      hide('archive'); show('menu');
    },
    isOpen: () => !$('archive').classList.contains('hidden'),
    closeAll
  };
})();
