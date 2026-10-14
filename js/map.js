/* MapView: everything that touches amCharts lives here.
   The game logic (game.js) only talks to this object, so the map library can be
   swapped or stubbed without touching game rules. */

// The free amCharts licence shows a small amCharts logo in the corner of the map.
// Removing it requires a paid amCharts licence, so the logo stays on.
const KEEP_AMCHARTS_LOGO = true;

/* ---------- reveal circles: a dashed ring drawn around each revealed country ----------
   Lives in an SVG layer over the map (#revealLayer) and knows nothing about amCharts: MapView passes a
   projector per country that returns the country's outline in layer pixels for the current pan/zoom. */
const CIRCLE_MIN_R = 24;          // tiny countries still get a visible ring
const CIRCLE_PAD = 12;            // breathing room between the outline and the ring
const CIRCLE_DRAW_MS = 700;       // time for the ring to draw itself once around
const CIRCLE_MARCH_PX_PER_MS = 0.03;
const MAX_REVEAL_CIRCLES = 5;

// Circle around projected points: centred on their bounding box, radius half its diagonal plus padding.
function circleAround(points, { minR = CIRCLE_MIN_R, maxR = Infinity, pad = CIRCLE_PAD } = {}) {
  if (!points || !points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const r = Math.min(maxR, Math.max(minR, Math.hypot(maxX - minX, maxY - minY) / 2 + pad));
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, r };
}

// An outline spanning more than 180° of longitude crosses the antimeridian (Russia's Chukotka, Fiji).
// Its far-side points project to the other edge of the map, so keep only the side with most points.
function trimAntimeridian(ring) {
  if (!ring || !ring.length) return ring;
  let min = Infinity, max = -Infinity;
  for (const [lon] of ring) { if (lon < min) min = lon; if (lon > max) max = lon; }
  if (max - min <= 180) return ring;
  const east = ring.filter(([lon]) => lon >= 0), west = ring.filter(([lon]) => lon < 0);
  return east.length >= west.length ? east : west;
}

const RevealCircles = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  let layer = null, rings = [], frame = 0, startedAt = 0, maxR = Infinity, maskSeq = 0;

  const el = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };

  // Each ring is a dashed circle revealed by a mask whose solid stroke grows around it ("drawing" it).
  function makeRing(project) {
    const id = `revealMask${++maskSeq}`;
    const group = el('g');
    const mask = el('mask', { id, maskUnits: 'userSpaceOnUse' });
    const reveal = el('circle', { class: 'revealCircleMask' });
    mask.appendChild(reveal);
    const ring = el('circle', { class: 'revealCircle', mask: `url(#${id})` });
    group.append(mask, ring);
    layer.appendChild(group);
    return { project, group, ring, reveal };
  }

  function tick(now) {
    const t = now - startedAt;
    const drawn = Math.min(1, t / CIRCLE_DRAW_MS);
    for (const r of rings) {
      const c = circleAround(r.project(), { maxR });
      if (!c) { r.group.setAttribute('visibility', 'hidden'); continue; }
      r.group.setAttribute('visibility', 'visible');
      const length = 2 * Math.PI * c.r;
      for (const circle of [r.ring, r.reveal]) {
        circle.setAttribute('cx', c.cx);
        circle.setAttribute('cy', c.cy);
        circle.setAttribute('r', c.r);
      }
      // Start drawing at 12 o'clock, clockwise.
      r.reveal.setAttribute('transform', `rotate(-90 ${c.cx} ${c.cy})`);
      r.reveal.setAttribute('stroke-dasharray', `${length} ${length}`);
      r.reveal.setAttribute('stroke-dashoffset', length * (1 - drawn));
      // Once drawn, the dashes keep marching around the country.
      r.ring.setAttribute('stroke-dashoffset', -t * CIRCLE_MARCH_PX_PER_MS);
    }
    frame = requestAnimationFrame(tick);
  }

  function start(svg, projectors, opts = {}) {
    stop();
    layer = svg;
    maxR = opts.maxR ?? Infinity;
    startedAt = performance.now();
    rings = projectors.slice(0, MAX_REVEAL_CIRCLES).map(makeRing);
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    rings = [];
    layer?.replaceChildren();
  }

  return { start, stop };
})();

// Countries too small to tap even at full zoom (Vatican City is ~1px, and Italy's shape has no hole for it).
// Their real outline is scaled up around its own centre until its longest side spans the size below, and they
// are raised to the top layer so a neighbour never covers them. Exaggerated, not moved; no markers.
// Desktop: only Vatican City and Monaco. Phones (fingers are bigger): every country smaller than the phone size.
const ENLARGED_COUNTRIES = ['VA', 'MC'];
const ENLARGED_SPAN_DEG = 0.2;
const PHONE_ENLARGED_SPAN_DEG = 0.35;
const MAX_ZOOM = 64, PHONE_MAX_ZOOM = 128;
const isPhone = () => matchMedia('(max-width: 620px), (pointer: coarse) and (max-width: 900px)').matches;

// Longest side of a GeoJSON geometry's bounding box, in degrees.
function geometrySpan(geometry) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const pts = polys.flat(2);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

// A copy of a GeoJSON geometry scaled around its bounding-box centre so its longest side is spanDeg degrees.
function enlargeGeometry(geometry, spanDeg) {
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  const pts = polys.flat(2);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const k = spanDeg / Math.max(maxX - minX, maxY - minY, 1e-9);
  if (k <= 1) return geometry;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const scaled = polys.map(poly => poly.map(ring => ring.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k])));
  return { type: geometry.type, coordinates: geometry.type === 'Polygon' ? scaled[0] : scaled };
}
// The map's GeoJSON with tiny countries enlarged. Returns the ids it enlarged, to raise them to the top layer.
function mapGeoJSON(phone) {
  const geo = am5geodata_worldLow, span = phone ? PHONE_ENLARGED_SPAN_DEG : ENLARGED_SPAN_DEG;
  const grow = f => phone
    ? countryByCode(f.id)?.playable && geometrySpan(f.geometry) < span
    : ENLARGED_COUNTRIES.includes(f.id);
  const enlarged = [];
  const features = geo.features.map(f => {
    if (!grow(f)) return f;
    enlarged.push(f.id);
    return { ...f, geometry: enlargeGeometry(f.geometry, span) };
  });
  return { geoJSON: { ...geo, features }, enlarged };
}

const MapView = (() => {
  // Colours come from the CSS tokens (css/style.css :root), read once when the chart is built.
  let C = null;
  const palette = () => (C ||= {
    land: tokenHex('map-land'), line: tokenHex('bg'), hover: tokenHex('text-2'),
    select: tokenHex('accent'), reveal: tokenHex('good'), outline: tokenHex('text')
  });
  const ZOOM_STEP = 1.5;
  const FLASH_MS = 900; // one fade out-and-back of the revealed country's green
  // One mouse-wheel notch (100px) zooms one ZOOM_STEP; smaller touchpad scrolls zoom proportionally less.
  const WHEEL_ZOOM_PER_PX = Math.log(ZOOM_STEP) / 100;

  let root = null, chart = null, series = null, onTop = [];
  let fittedSize = '';
  let wheelTarget = 0, lastWheel = 0, lastPageScroll = 0;
  let flashes = [];
  let highlightedIds = new Set();
  let revealTimer = 0, revealResolve = null, revealToken = 0;
  let hooks = { onPick() {}, isSelected: () => false, showNames: () => true, showFlags: () => false, onData() {} };
  let resolveReady = null;
  const ready = new Promise(r => { resolveReady = r; });

  const idOf = p => p.dataItem?.get('id');
  const available = () =>
    typeof am5 !== 'undefined' && typeof am5map !== 'undefined' && typeof am5geodata_worldLow !== 'undefined';

  function init(h) { hooks = { ...hooks, ...h }; }

  function polygonsFor(ids) {
    const out = [];
    if (!series) return out;
    series.mapPolygons.each(p => { if (ids.includes(idOf(p))) out.push(p); });
    return out;
  }
  function polygonFor(id) {
    let found = null;
    series?.mapPolygons.each(p => { if (idOf(p) === id) found = p; });
    return found;
  }

  /* ---------- reveal geometry ---------- */
  function largestRing(geometry) {
    if (!geometry?.coordinates) return null;
    const rings = geometry.type === 'Polygon' ? geometry.coordinates
      : geometry.type === 'MultiPolygon' ? geometry.coordinates.flatMap(part => part) : [];
    let best = null, bestArea = -1;
    for (const ring of rings) {
      if (!Array.isArray(ring) || ring.length < 3) continue;
      const xs = ring.map(p => p[0]), ys = ring.map(p => p[1]);
      const area = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys));
      if (area > bestArea) { bestArea = area; best = ring; }
    }
    return best;
  }
  // The country's main landmass in #revealLayer pixels for the current pan/zoom (convert() includes both).
  function outlineProjector(polygon) {
    const ring = trimAntimeridian(largestRing(polygon?.dataItem?.get('geometry')));
    return () => (ring && chart ? ring.map(([longitude, latitude]) => chart.convert({ longitude, latitude })) : []);
  }

  /* ---------- polygon painting ---------- */
  function resetPolygon(p) {
    p.set('forceInactive', false);
    p.states.apply('default');
    p.setAll({ fill: am5.color(palette().land), stroke: am5.color(palette().line), strokeWidth: .8 });
  }  function paintSelection(p, on) {
    p.set('active', !!on);
    if (on) {
      p.states.apply('active');
      p.setAll({ stroke: am5.color(palette().outline), strokeWidth: 2.2 });
    } else resetPolygon(p);
  }
  function select(id, on) {
    const p = polygonFor(id);
    if (p) paintSelection(p, on);
  }

  /* ---------- the "here is the answer" reveal ---------- */
  function cleanup() {
    revealToken++;
    clearTimeout(revealTimer);
    highlightedIds.clear();
    flashes.forEach(anim => { try { anim.stop(); } catch {} });
    flashes = [];
    RevealCircles.stop();
    const token = revealToken;
    if (series) {
      series.mapPolygons.each(resetPolygon);
      // Second pass next frame, unless a new reveal started in the meantime.
      requestAnimationFrame(() => { if (token === revealToken) series?.mapPolygons.each(resetPolygon); });
    }
    hide('revealNotice');
  }
  // Abort a reveal. The pending highlight() promise resolves false.
  function clearHighlight() {
    const done = revealResolve;
    revealResolve = null;
    cleanup();
    done?.(false);
  }
  // Finish a reveal early. The pending highlight() promise resolves true.
  function skipReveal() {
    const done = revealResolve;
    revealResolve = null;
    cleanup();
    done?.(true);
  }
  // Resolves true when the reveal ran its course (or was skipped), false when aborted.
  function highlight(ids, { duration = 5000, color = palette().reveal, label = '' } = {}) {
    clearHighlight();
    const token = ++revealToken;
    highlightedIds = new Set(ids);
    const polys = polygonsFor(ids);
    polys.forEach(p => {
      p.states.apply('default');
      p.set('forceInactive', true);
      p.setAll({ fill: am5.color(color), stroke: am5.color(palette().outline), strokeWidth: 2.5 });
      // Fade to the land colour and back, over and over, until cleanup() stops it.
      flashes.push(p.animate({
        key: 'fill', from: am5.color(color), to: am5.color(palette().land),
        duration: FLASH_MS, loops: Infinity, easing: am5.ease.yoyo(am5.ease.inOut(am5.ease.quad))
      }));
    });
    const layer = $('revealLayer');
    const box = layer.getBoundingClientRect();
    RevealCircles.start(layer, polys.map(outlineProjector), { maxR: 0.6 * Math.max(box.width, box.height) });
    if (label) { setText('revealNotice', label); show('revealNotice'); }
    return new Promise(resolve => {
      revealResolve = resolve;
      revealTimer = setTimeout(() => { if (token === revealToken) skipReveal(); }, duration);
    });
  }

  /* ---------- view controls ---------- */
  const zoomIn = () => chart?.zoomIn();
  const zoomOut = () => chart?.zoomOut();
  // On a tall (portrait) map, zoom 1 shows the world as a thin strip. Start zoomed so the inhabited world
  // (about 56°S to 83°N) fills the height instead; the sides are reached by dragging.
  const PORTRAIT_MAX_ZOOM = 4;
  function homeZoom() {
    const el = $('mapArea'), w = el.clientWidth, h = el.clientHeight;
    if (!chart || !w || h <= w) return 1;
    const level = chart.get('zoomLevel', 1);
    const top = chart.convert({ longitude: 0, latitude: 83 }), bottom = chart.convert({ longitude: 0, latitude: -56 });
    const worldH = Math.abs(bottom.y - top.y) / level; // map height at zoom 1
    if (!(worldH > 0)) return 1;
    return Math.max(1, Math.min(PORTRAIT_MAX_ZOOM, h / worldH));
  }
  function resetView(immediate = false) {
    const z = homeZoom();
    // Zoomed in on a phone, start over Europe and Africa; at zoom 1 the whole world is centred as before.
    chart?.zoomToGeoPoint(z > 1 ? { longitude: 15, latitude: 20 } : { longitude: 0, latitude: 12 }, z, true, immediate ? 0 : 500);
  }
  // amCharts records the map's centre (which the drag limits are measured from) only when it fits the map.
  // The chart is built while the map is hidden (0x0), so that fit is skipped and dragging gets clamped
  // against the wrong centre. Re-fit whenever the visible size changes. Returns true if a re-fit was queued.
  function refitIfResized() {
    const el = $('mapArea');
    const size = `${el.clientWidth}x${el.clientHeight}`;
    if (!chart || el.clientWidth === 0 || el.clientHeight === 0 || size === fittedSize) return false;
    fittedSize = size;
    root.resize();
    chart.markDirtyGeometries();
    return true;
  }
  function resizeAndReset() {
    if (!root) return;
    setTimeout(() => {
      // The re-fit happens on amCharts' next frame and resets the view itself, so reset after it.
      if (refitIfResized()) root.events.once('frameended', () => resetView(true));
      else resetView(true);
    }, 20);
  }

  // amCharts' own wheel zoom jumps a full step for every wheel event, however small. Touchpads send dozens
  // of tiny events per swipe, which sent the map straight to maximum zoom. This zooms by how far you scrolled.
  function onWheel(e) {
    if (!chart) return;
    // A non-cancelable wheel event belongs to a page scroll that is still coasting onto the map. Leave it be.
    if (!e.cancelable || performance.now() - lastPageScroll < 200) return;
    const level = chart.get('zoomLevel', 1);
    const min = chart.get('minZoomLevel', 1), max = chart.get('maxZoomLevel', MAX_ZOOM);
    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 33;                                  // lines
    else if (e.deltaMode === 2) dy *= e.currentTarget.clientHeight;   // pages
    // Fully zoomed out and scrolling down: let the page scroll instead.
    if (dy > 0 && level <= min + 1e-6) return;
    e.preventDefault();
    if (dy === 0) return;
    dy = Math.max(-150, Math.min(150, dy));
    // Keep zooming from where the last wheel event was heading, so quick notches are not lost mid-animation.
    const now = performance.now();
    const from = now - lastWheel < 250 ? wheelTarget : level;
    lastWheel = now;
    wheelTarget = Math.max(min, Math.min(max, from * Math.exp(-dy * WHEEL_ZOOM_PER_PX)));
    if (wheelTarget === level) return;
    chart.zoomToPoint(root.documentPointToRoot({ x: e.clientX, y: e.clientY }), wheelTarget, false, 120);
  }
  function setTooltips(on) {
    series?.mapPolygons.template.set('tooltipText', on ? '{name}' : '');
  }
  function waitReady(timeoutMs = 8000) {
    return Promise.race([ready, new Promise(r => setTimeout(r, timeoutMs))]);
  }

  /* ---------- one-time construction ---------- */
  function ensure() {
    if (root) return;
    root = am5.Root.new('mapArea');
    if (!KEEP_AMCHARTS_LOGO) root._logo?.dispose();
    chart = root.container.children.push(am5map.MapChart.new(root, {
      panX: 'translateX', panY: 'translateY', wheelX: 'none', wheelY: 'none', pinchZoom: true,
      zoomStep: ZOOM_STEP, minZoomLevel: 1, maxZoomLevel: isPhone() ? PHONE_MAX_ZOOM : MAX_ZOOM, projection: am5map.geoNaturalEarth1()
    }));
    $('mapArea').addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', () => { lastPageScroll = performance.now(); }, { passive: true });
    // Window resized mid-game: re-fit so dragging stays correct.
    new ResizeObserver(() => {
      if (refitIfResized()) root.events.once('frameended', () => resetView(true));
    }).observe($('mapArea'));
    const { geoJSON, enlarged } = mapGeoJSON(isPhone());
    onTop = enlarged;
    series = chart.series.push(am5map.MapPolygonSeries.new(root, { geoJSON, exclude: ['AQ'] }));

    series.events.on('datavalidated', () => {
      const ids = new Set();
      series.mapPolygons.each(p => {
        const id = idOf(p);
        if (id && countryByCode(id)) ids.add(id);
        else p.setAll({ tooltipText: '', cursorOverStyle: 'default' }); // not in the game: plain land
      });
      onTop.forEach(id => polygonFor(id)?.toFront());
      hooks.onData(ids);
      if (resolveReady) { resolveReady(); resolveReady = null; }
    });

    const tpl = series.mapPolygons.template;
    tpl.setAll({
      tooltipText: hooks.showNames() ? '{name}' : '', interactive: true,
      fill: am5.color(palette().land), stroke: am5.color(palette().line), strokeWidth: .8
    });
    tpl.states.create('hover', { fill: am5.color(palette().hover) });
    tpl.states.create('active', { fill: am5.color(palette().select), stroke: am5.color(palette().outline), strokeWidth: 2.2 });

    tpl.events.on('pointerover', e => {
      const polygon = e.target, id = idOf(polygon);
      if (hooks.isSelected(id)) requestAnimationFrame(() => polygon.states.apply('active'));
      else if (!highlightedIds.has(id)) { polygon.states.apply('default'); polygon.set('fill', am5.color(palette().land)); }
      if (!hooks.showFlags()) return;
      const c = countryByCode(id);
      if (!c) return;
      const panel = $('hoverFlag'), img = $('hoverFlagImg');
      panel.dataset.code = id;
      setText('hoverFlagName', hooks.showNames() ? c.name : '');
      panel.classList.add('show');
      loadFlag(img, id, { alt: `${c.name} flag`, timeout: 1800 }).then(() => {
        if (panel.dataset.code !== id) panel.classList.remove('show');
      });
    });
    tpl.events.on('pointerout', e => {
      const panel = $('hoverFlag');
      panel.dataset.code = '';
      panel.classList.remove('show');
      const polygon = e.target, id = idOf(polygon);
      if (hooks.isSelected(id)) paintSelection(polygon, true);
      else if (!highlightedIds.has(id)) resetPolygon(polygon);
    });
    tpl.events.on('click', e => {
      const id = e.target.dataItem.get('id');
      if (countryByCode(id)) hooks.onPick(id);
    });
  }

  return {
    available, init, ensure, ready, waitReady, setTooltips,
    select, highlight, clearHighlight, skipReveal,
    zoomIn, zoomOut, resetView, resizeAndReset
  };
})();
