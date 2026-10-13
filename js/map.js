/* MapView: everything that touches amCharts lives here.
   The game logic (game.js) only talks to this object, so the map library can be
   swapped or stubbed without touching game rules. */

// The free amCharts licence shows a small amCharts logo in the corner of the map.
// Removing it requires a paid amCharts licence, so the logo stays on.
const KEEP_AMCHARTS_LOGO = true;

const MapView = (() => {
  const BASE_FILL = 0x17365f;
  const SELECT_COLOR = 0xa855f7;
  const ZOOM_STEP = 1.5;
  // One mouse-wheel notch (100px) zooms one ZOOM_STEP; smaller touchpad scrolls zoom proportionally less.
  const WHEEL_ZOOM_PER_PX = Math.log(ZOOM_STEP) / 100;

  let root = null, chart = null, series = null, markers = null;
  let fittedSize = '';
  let wheelTarget = 0, lastWheel = 0, lastPageScroll = 0;
  let arrowSprites = [], arrowItems = [], arrowFrame = 0;
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

  /* ---------- arrows that point at the answer ---------- */
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
  function arrowPoint(polygon) {
    const ring = largestRing(polygon?.dataItem?.get('geometry'));
    if (!ring) return null;
    const pts = ring.length > 1 ? ring.slice(0, -1) : ring;
    const sum = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1]], [0, 0]);
    return { longitude: sum[0] / pts.length, latitude: sum[1] / pts.length };
  }
  function clearArrows() {
    cancelAnimationFrame(arrowFrame);
    arrowFrame = 0;
    arrowSprites.forEach(s => { try { s?.animations?.stop(); } catch {} try { s?.dispose(); } catch {} });
    arrowSprites = [];
    arrowItems.forEach(i => { try { i?.dispose(); } catch {} });
    arrowItems = [];
    if (markers) {
      try { markers.data.clear(); } catch {}
      arrowFrame = requestAnimationFrame(() => {
        arrowFrame = 0;
        try { markers?.data?.clear(); } catch {}
      });
    }
  }
  function showArrows(polygons, max = 5) {
    clearArrows();
    if (!markers) return;
    polygons.slice(0, max).forEach(polygon => {
      const pt = arrowPoint(polygon);
      if (!pt) return;
      const item = markers.data.push({ geometry: { type: 'Point', coordinates: [pt.longitude, pt.latitude] } });
      if (item) arrowItems.push(item);
    });
  }

  /* ---------- polygon painting ---------- */
  function resetPolygon(p) {
    p.set('forceInactive', false);
    p.states.apply('default');
    p.setAll({ fill: am5.color(BASE_FILL), stroke: am5.color(0xffffff), strokeWidth: .8 });
  }
  function paintSelection(p, on) {
    p.set('active', !!on);
    if (on) {
      p.states.apply('active');
      p.setAll({ stroke: am5.color(0xffffff), strokeWidth: 2.2 });
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
    clearArrows();
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
  function highlight(ids, { duration = 5000, color = 0xffd54f, label = '', arrows = false, maxArrows = 5 } = {}) {
    clearHighlight();
    const token = ++revealToken;
    highlightedIds = new Set(ids);
    const polys = polygonsFor(ids);
    polys.forEach(p => {
      p.states.apply('default');
      p.set('forceInactive', true);
      p.setAll({ fill: am5.color(color), stroke: am5.color(0xffffff), strokeWidth: 2.5 });
    });
    if (arrows) showArrows(polys, maxArrows);
    if (label) { setText('revealNotice', label); show('revealNotice'); }
    return new Promise(resolve => {
      revealResolve = resolve;
      revealTimer = setTimeout(() => { if (token === revealToken) skipReveal(); }, duration);
    });
  }

  /* ---------- view controls ---------- */
  const zoomIn = () => chart?.zoomIn();
  const zoomOut = () => chart?.zoomOut();
  function resetView(immediate = false) {
    chart?.zoomToGeoPoint({ longitude: 0, latitude: 12 }, 1, true, immediate ? 0 : 500);
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
    const min = chart.get('minZoomLevel', 1), max = chart.get('maxZoomLevel', 24);
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
      zoomStep: ZOOM_STEP, minZoomLevel: 1, maxZoomLevel: 24, projection: am5map.geoNaturalEarth1()
    }));
    $('mapArea').addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('scroll', () => { lastPageScroll = performance.now(); }, { passive: true });
    // Window resized mid-game: re-fit so dragging stays correct.
    new ResizeObserver(() => {
      if (refitIfResized()) root.events.once('frameended', () => resetView(true));
    }).observe($('mapArea'));
    series = chart.series.push(am5map.MapPolygonSeries.new(root, { geoJSON: am5geodata_worldLow, exclude: ['AQ'] }));
    markers = chart.series.push(am5map.MapPointSeries.new(root, { autoScale: false }));
    markers.bullets.push(() => {
      const label = am5.Label.new(root, {
        text: '▼', fontSize: 46, fill: am5.color(0xff1744), stroke: am5.color(0xffffff), strokeWidth: 2.4,
        centerX: am5.p50, centerY: am5.p100, dy: -25, className: 'answerArrowText'
      });
      arrowSprites.push(label);
      label.events.on('disposed', () => { arrowSprites = arrowSprites.filter(s => s !== label); });
      label.animate({ key: 'dy', from: -25, to: -52, duration: 620, easing: am5.ease.inOut(am5.ease.cubic), loops: Infinity, alternate: true });
      return am5.Bullet.new(root, { sprite: label });
    });

    series.events.on('datavalidated', () => {
      const ids = new Set();
      series.mapPolygons.each(p => { const id = idOf(p); if (id && countryByCode(id)) ids.add(id); });
      hooks.onData(ids);
      if (resolveReady) { resolveReady(); resolveReady = null; }
    });

    const tpl = series.mapPolygons.template;
    tpl.setAll({
      tooltipText: hooks.showNames() ? '{name}' : '', interactive: true,
      fill: am5.color(BASE_FILL), stroke: am5.color(0xffffff), strokeWidth: .8
    });
    tpl.states.create('hover', { fill: am5.color(0x22d3ee) });
    tpl.states.create('active', { fill: am5.color(SELECT_COLOR), stroke: am5.color(0xffffff), strokeWidth: 2.2 });

    tpl.events.on('pointerover', e => {
      const polygon = e.target, id = idOf(polygon);
      if (hooks.isSelected(id)) requestAnimationFrame(() => polygon.states.apply('active'));
      else if (!highlightedIds.has(id)) { polygon.states.apply('default'); polygon.set('fill', am5.color(BASE_FILL)); }
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
