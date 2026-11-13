// ── File layout (index.html sits beside the maps/ folder) ──
//   maps/small_maps/<day>_small_<theme>.svg   -> what the page displays
//   maps/poster_maps/<day>_small_<theme>.pdf  -> what the download button serves
const MAP_DIR = "maps/small_maps/";
const PDF_DIR = "maps/poster_maps/";
const DAYS = { weekday: "Weekday", sat: "Saturday", sun: "Sunday" };

// Hide shapes that are outside the visible area (plus a margin) so the browser has less to
// process per frame. Set to false to switch it off. Margin is a fraction of the view size.
const CULL_OFFSCREEN = true;
const CULL_MARGIN = 0.30;
let currentDay = "weekday";

const mapName = () => `${currentDay}_small_${isDark ? "dark" : "light"}`;
const svgUrl = () => `${MAP_DIR}${mapName()}.svg`;
const pdfUrl = () => `${PDF_DIR}${mapName()}.pdf`;

// Point the download button at the PDF matching the current day + theme
function updateDownloadLink() {
  const dl = document.getElementById("downloadPdf");
  const label = `${DAYS[currentDay]} ${isDark ? "dark" : "light"}`;
  dl.href = pdfUrl();
  dl.setAttribute(
    "download",
    `Melbourne-PT-Frequency-Map-${currentDay}-${isDark ? "dark" : "light"}.pdf`,
  );
  dl.title = `Download PDF (${label})`;
}

// ── Efficient loading: fetch each SVG once, keep the text, prefetch when idle ──
const svgCache = new Map(); // url -> Promise<string>

function fetchSVG(url) {
  if (!svgCache.has(url)) {
    const p = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return res.text();
    });
    p.catch(() => svgCache.delete(url)); // allow retry after a failure
    svgCache.set(url, p);
  }
  return svgCache.get(url);
}

const whenIdle = window.requestIdleCallback
  ? (fn) => window.requestIdleCallback(fn, { timeout: 4000 })
  : (fn) => setTimeout(fn, 1500);

function prefetchCounterpart() {
  if (navigator.connection && navigator.connection.saveData) return;
  const other = `${MAP_DIR}${currentDay}_small_${isDark ? "light" : "dark"}.svg`;
  whenIdle(() => fetchSVG(other).catch(() => {}));
}

// --- Light Dark Buttons
const SUN_SVG = `<svg width="15" height="15" viewBox="2 2 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
  <line x1="7.5" y1="1" x2="7.5" y2="3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="7.5" y1="12" x2="7.5" y2="14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="1" y1="7.5" x2="3" y2="7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="12" y1="7.5" x2="14" y2="7.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="2.93" y1="2.93" x2="4.34" y2="4.34" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="10.66" y1="10.66" x2="12.07" y2="12.07" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="2.93" y1="12.07" x2="4.34" y2="10.66" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
  <line x1="10.66" y1="4.34" x2="12.07" y2="2.93" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;

const MOON_SVG = `<svg width="14" height="14" viewBox="0 1 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M12.5 9A6 6 0 0 1 5 1.5a6 6 0 1 0 7.5 7.5z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

// Legend swatch colours per mode
const SWATCH_LIGHT = {
  "freq-10": "#671415",
  "freq-15": "#a62624",
  "freq-20": "#642d91",
  "freq-30": "#2c8ab8",
  "freq-60": "#5d9a9d",
  "freq-ltd": "#8d6f32",
  "flexiride-swatch": "#fae8ce",
};

const SWATCH_DARK = {
  "freq-10": "#ffffff",
  "freq-15": "#FFE030",
  "freq-20": "#20d090",
  "freq-30": "#3d9ae8",
  "freq-60": "#CF5DBF",
  "freq-ltd": "#c07830",
  "flexiride-swatch": "#301F13",
};
let isDark = false;

const darkToggleBtn = document.getElementById("darkToggle");
darkToggleBtn.innerHTML = SUN_SVG;

darkToggleBtn.addEventListener("click", () => {
  isDark = !isDark;
  document.body.classList.toggle("dark", isDark);
  darkToggleBtn.innerHTML = isDark ? MOON_SVG : SUN_SVG;

  // Update legend swatches
  const swatchMap = isDark ? SWATCH_DARK : SWATCH_LIGHT;
  Object.entries(swatchMap).forEach(([cls, colour]) => {
    document.querySelectorAll("." + cls).forEach((el) => {
      el.style.background = colour;
    });
  });

  // Swap SVG — preserve current viewBox so zoom/pan position is kept
  updateDownloadLink();
  loadSVG(svgUrl(), currentViewBox());
  if (compareOn) loadCompare();
});

// ── Day selector (weekday / Saturday / Sunday) ──
document.getElementById("daySelect").addEventListener("change", (e) => {
  currentDay = e.target.value;
  document.getElementById("dayLabel").textContent = DAYS[currentDay];
  updateDownloadLink();
  loadSVG(svgUrl(), currentViewBox());
  if (compareOn) {
    const before = compareDay;
    if (compareDay === currentDay) {
      compareDay = Object.keys(DAYS).find((d) => d !== currentDay);
      compareDaySelect.value = compareDay;
    }
    updateCompareLabels();
    if (compareDay !== before) loadCompare();
  }
});

// ── SVG loading ──
let svgEl = null;
let loadToken = 0; // ignore stale responses if the user switches quickly

// Compare-mode state (second map lives in its own shadow root so its ids/styles can't clash)
let compareOn = false;
let compareDay = "sat";
let compareSvg = null;
let compareRoot = null;

// Layers the user has switched off in the legend (shared by both maps)
function getHiddenLayers() {
  const hidden = new Set();
  document.querySelectorAll(".legend-row[data-layers]").forEach((row) => {
    const cb = row.querySelector('input[type="checkbox"]');
    if (cb && !cb.checked) {
      row.dataset.layers.split(",").forEach((id) => hidden.add(id.trim()));
    }
  });
  return hidden;
}

function currentViewBox() {
  return svgEl ? svgEl.getAttribute("viewBox") : null;
}

async function loadSVG(src, preserveViewBox) {
  const wrapper = document.getElementById("map-svg-wrapper");

  // ── Capture hidden layers before swap ──
  const hiddenLayers = svgEl ? getHiddenLayers() : new Set();

  const token = ++loadToken;

  try {
    const text = await fetchSVG(src);
    if (token !== loadToken) return; // a newer load has superseded this one
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg || doc.querySelector("parsererror")) throw new Error("bad SVG");
    svg.setAttribute("data-artboard", svg.getAttribute("viewBox"));

    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";

    wrapper.innerHTML = "";
    wrapper.appendChild(svg);
    svgEl = svg;

    // ── Reapply hidden layers after swap ──
    hiddenLayers.forEach((id) => {
      const layer = svg.getElementById(id);
      if (layer) layer.style.display = "none";
    });

    initZoom(svg, preserveViewBox);
    prefetchCounterpart();

    cullIndexes.main = null;
    if (CULL_OFFSCREEN) {
      buildCullIndex(svg).then((idx) => {
        if (idx && svgEl === svg) {
          cullIndexes.main = idx;
          applyCull(idx, svg);
        }
      });
    }
  } catch (e) {
    wrapper.innerHTML =
      '<p style="padding:2rem;text-align:center;color:#888;font-size:13px;">Could not load <code>' +
      src +
      "</code> — make sure it is in the same folder.</p>";
  }
}

// ── Compare mode (swipe) ──
// Left of the divider = main map (day selector). Right = comparison map (second selector).
// Same theme on both sides; pan/zoom is shared because both viewBoxes are kept identical.
const compareBtn = document.getElementById("compareBtn");
const compareDaySelect = document.getElementById("compareDaySelect");
const compareLayer = document.getElementById("compareLayer");
const compareDivider = document.getElementById("compareDivider");
const mapContainer = document.querySelector(".map-container");
compareRoot = compareLayer.attachShadow({ mode: "open" });

let compareToken = 0;

function updateCompareLabels() {
  document.getElementById("compareLabelA").textContent = DAYS[currentDay];
  document.getElementById("compareLabelB").textContent = DAYS[compareDay];
}

async function loadCompare() {
  const token = ++compareToken;
  const url = `${MAP_DIR}${compareDay}_small_${isDark ? "dark" : "light"}.svg`;
  try {
    const text = await fetchSVG(url);
    if (token !== compareToken || !compareOn) return;
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const svg = doc.querySelector("svg");
    if (!svg || doc.querySelector("parsererror")) throw new Error("bad SVG");
    svg.setAttribute("data-artboard", svg.getAttribute("viewBox"));
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";

    compareRoot.replaceChildren(svg);
    compareSvg = svg;

    // Match the main map's current view, and the legend's hidden layers
    if (svgEl) svg.setAttribute("viewBox", svgEl.getAttribute("viewBox"));
    getHiddenLayers().forEach((id) => {
      const layer = compareRoot.getElementById(id);
      if (layer) layer.style.display = "none";
    });

    cullIndexes.compare = null;
    if (CULL_OFFSCREEN) {
      buildCullIndex(svg).then((idx) => {
        if (idx && compareSvg === svg) {
          cullIndexes.compare = idx;
          applyCull(idx, svg);
        }
      });
    }
  } catch (e) {
    compareSvg = null;
    const msg = document.createElement("p");
    msg.style.cssText = "padding:2rem;text-align:center;color:#888;font:13px Arial,sans-serif;";
    msg.textContent = "Could not load " + url;
    compareRoot.replaceChildren(msg);
  }
}

function setCompare(on) {
  compareOn = on;
  compareBtn.classList.toggle("active", on);
  compareBtn.setAttribute("aria-pressed", on);
  compareDaySelect.hidden = !on;
  compareLayer.classList.toggle("on", on);
  compareDivider.classList.toggle("on", on);
  if (on) {
    if (compareDay === currentDay) {
      compareDay = Object.keys(DAYS).find((d) => d !== currentDay);
    }
    compareDaySelect.value = compareDay;
    updateCompareLabels();
    loadCompare();
  } else {
    compareToken++; // cancel any in-flight load
    compareRoot.replaceChildren(); // free the second SVG's DOM
    compareSvg = null;
    cullIndexes.compare = null;
  }
}

compareBtn.addEventListener("click", () => setCompare(!compareOn));
compareDaySelect.addEventListener("change", (e) => {
  compareDay = e.target.value;
  updateCompareLabels();
  loadCompare();
});

// Divider: drag (mouse/touch/pen) or use the arrow keys
let split = 50;
function setSplit(pct) {
  split = Math.min(95, Math.max(5, pct));
  mapContainer.style.setProperty("--split", split + "%");
  compareDivider.setAttribute("aria-valuenow", Math.round(split));
}

let draggingDivider = false;
compareDivider.addEventListener("pointerdown", (e) => {
  draggingDivider = true;
  compareDivider.setPointerCapture(e.pointerId);
  e.preventDefault();
});
compareDivider.addEventListener("pointermove", (e) => {
  if (!draggingDivider) return;
  const r = mapContainer.getBoundingClientRect();
  setSplit(((e.clientX - r.left) / r.width) * 100);
});
["pointerup", "pointercancel"].forEach((evt) =>
  compareDivider.addEventListener(evt, () => {
    draggingDivider = false;
  }),
);
compareDivider.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") setSplit(split - 2);
  else if (e.key === "ArrowRight") setSplit(split + 2);
  else return;
  e.preventDefault();
});

// ── Off-screen culling ──
// Each drawable shape's bounding box (in the map's own coordinates) is measured once, in
// small idle-time slices. While the user pans/zooms, shapes well outside the view get
// display:none and come back as they approach. Shapes that couldn't be measured (e.g. in a
// layer hidden at the time) are simply never culled.
const CULL_SELECTOR = "path, text, rect, circle, ellipse, polygon, polyline, line, image, use";
const CULL_SKIP_PARENTS = "defs, clipPath, mask, pattern, symbol, marker";
const cullIndexes = { main: null, compare: null };

function buildCullIndex(svg) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const els = Array.from(svg.querySelectorAll(CULL_SELECTOR));
    const items = [];
    const mats = new Map();
    const IDENT = new DOMMatrix();
    const PAD = 10; // allowance for stroke width, in map units
    // Original artboard, so shapes entirely outside it can be hidden permanently
    const ab = (svg.getAttribute("data-artboard") || "").split(/[\s,]+/).map(Number);
    const hasAB = ab.length === 4 && !ab.some(isNaN);
    const ax0 = ab[0], ay0 = ab[1], ax1 = ab[0] + ab[2], ay1 = ab[1] + ab[3];
    let i = 0;

    // Combined transform of a node and all its ancestors up to the <svg>
    function accMatrix(node) {
      if (!node || node === svg) return IDENT;
      let m = mats.get(node);
      if (!m) {
        const parentM = accMatrix(node.parentNode);
        const list = node.transform && node.transform.baseVal;
        const c = list && list.numberOfItems ? list.consolidate() : null;
        m = c ? parentM.multiply(c.matrix) : parentM;
        mats.set(node, m);
      }
      return m;
    }

    function step() {
      if (!svg.isConnected) return resolve(null); // map was swapped out meanwhile
      const end = performance.now() + 8;
      while (i < els.length && performance.now() < end) {
        const el = els[i++];
        if (el.closest(CULL_SKIP_PARENTS) || el.style.display === "none") continue;
        let b;
        try {
          b = el.getBBox();
        } catch (e) {
          continue;
        }
        if (!b.width && !b.height) continue; // not rendered right now: leave it alone
        const m = accMatrix(el);
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [px, py] of [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x, b.y + b.height],
          [b.x + b.width, b.y + b.height],
        ]) {
          const X = m.a * px + m.c * py + m.e;
          const Y = m.b * px + m.d * py + m.f;
          if (X < x0) x0 = X;
          if (X > x1) x1 = X;
          if (Y < y0) y0 = Y;
          if (Y > y1) y1 = Y;
        }
        items.push({
          el,
          prev: el.style.display,
          visible: true,
          outside: hasAB && (x1 < ax0 || x0 > ax1 || y1 < ay0 || y0 > ay1),
          x0: x0 - PAD, y0: y0 - PAD, x1: x1 + PAD, y1: y1 + PAD,
        });
      }
      if (i < els.length) return whenIdle(step);
      console.info(
        `[cull] indexed ${items.length} of ${els.length} shapes in ${Math.round(performance.now() - t0)} ms`,
      );
      resolve({ items });
    }
    whenIdle(step);
  });
}

function applyCull(index, svg) {
  const r = document.getElementById("map-svg-wrapper").getBoundingClientRect();
  const vb = svg.viewBox.baseVal;
  if (!r.width || !r.height || !vb.width || !vb.height) return;
  // With "meet" scaling the visible area can be larger than the viewBox on one axis
  const k = Math.min(r.width / vb.width, r.height / vb.height);
  const vw = r.width / k, vh = r.height / k;
  const cx = vb.x + vb.width / 2, cy = vb.y + vb.height / 2;
  const x0 = cx - vw / 2 - vw * CULL_MARGIN, x1 = cx + vw / 2 + vw * CULL_MARGIN;
  const y0 = cy - vh / 2 - vh * CULL_MARGIN, y1 = cy + vh / 2 + vh * CULL_MARGIN;
  for (const it of index.items) {
    const vis = !it.outside && it.x1 >= x0 && it.x0 <= x1 && it.y1 >= y0 && it.y0 <= y1;
    if (vis !== it.visible) {
      it.visible = vis;
      it.el.style.display = vis ? it.prev : "none";
    }
  }
}

// Re-cull at most every 120 ms while the view changes; the last change always gets one
let cullTimer = 0;
let cullLast = 0;
function scheduleCull() {
  if (!CULL_OFFSCREEN || cullTimer) return;
  const wait = Math.max(0, 120 - (performance.now() - cullLast));
  cullTimer = setTimeout(() => {
    cullTimer = 0;
    cullLast = performance.now();
    if (svgEl && cullIndexes.main) applyCull(cullIndexes.main, svgEl);
    if (compareSvg && cullIndexes.compare) applyCull(cullIndexes.compare, compareSvg);
  }, wait);
}

// Initial load
updateDownloadLink();
loadSVG(svgUrl(), null);

let zoomAbort = null;

function initZoom(svg, preserveViewBox) {
  // Remove the previous SVG's listeners so they (and the old SVG DOM) can be freed
  if (zoomAbort) zoomAbort.abort();
  zoomAbort = new AbortController();
  const { signal } = zoomAbort;

  const container = document.querySelector(".map-container");
  const wrapper = document.getElementById("map-svg-wrapper");

  const vbParts = svg
    .getAttribute("viewBox")
    .split(/[\s,]+/)
    .map(Number);
  const origVB = { x: vbParts[0], y: vbParts[1], w: vbParts[2], h: vbParts[3] };
  let vb = { ...origVB };

  // Restore previous pan/zoom if swapping SVGs, otherwise start at 2x zoom
  if (preserveViewBox) {
    const parts = preserveViewBox.split(/[\s,]+/).map(Number);
    vb = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
    applyViewBox();
  } else {
    const initialScale = 2;

    vb.w = origVB.w / initialScale;
    vb.h = origVB.h / initialScale;
    vb.x = origVB.x + (origVB.w - vb.w) / 2;
    vb.y = origVB.y + (origVB.h - vb.h) / 2 - 250;
    applyViewBox();

  }

  const MIN_SCALE = 1,
    MAX_SCALE = 20,
    ZOOM_STEP = 1.35;

  function applyViewBox() {
    const v = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`;
    svg.setAttribute("viewBox", v);
    if (compareSvg) compareSvg.setAttribute("viewBox", v);
    scheduleCull();
  }

  // Batch pan/zoom updates to one DOM write per frame
  let raf = 0;
  function setViewBox() {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      applyViewBox();
    });
  }

  function toSVG(px, py) {
    const rect = wrapper.getBoundingClientRect();
    return {
      x: vb.x + px * (vb.w / rect.width),
      y: vb.y + py * (vb.h / rect.height),
    };
  }

  function currentScale() {
    return origVB.w / vb.w;
  }

  function zoomAt(px, py, factor) {
    const newScale = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, currentScale() * factor),
    );
    const targetW = origVB.w / newScale;
    const targetH = origVB.h / newScale;
    const pt = toSVG(px, py);
    const rx = (pt.x - vb.x) / vb.w;
    const ry = (pt.y - vb.y) / vb.h;
    vb.w = targetW;
    vb.h = targetH;
    vb.x = pt.x - rx * vb.w;
    vb.y = pt.y - ry * vb.h;
    clamp();
    setViewBox();
  }

  function clamp() {
    vb.x = Math.min(origVB.x + origVB.w - vb.w, Math.max(origVB.x, vb.x));
    vb.y = Math.min(origVB.y + origVB.h - vb.h, Math.max(origVB.y, vb.y));
  }

  document.getElementById("zoomIn").onclick = () => {
    const r = wrapper.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, ZOOM_STEP);
  };
  document.getElementById("zoomOut").onclick = () => {
    const r = wrapper.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, 1 / ZOOM_STEP);
  };
  document.getElementById("zoomReset").onclick = () => {
    vb = { ...origVB };
    setViewBox();
  };

  wrapper.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = wrapper.getBoundingClientRect();
      zoomAt(
        e.clientX - r.left,
        e.clientY - r.top,
        e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
      );
    },
    { passive: false, signal },
  );


  let dragging = false,
    dragStartPt = null,
    dragStartVB = null;

  wrapper.addEventListener("mousedown", (e) => {
    e.preventDefault();
    if (currentScale() <= MIN_SCALE) return;
    dragging = true;
    const r = wrapper.getBoundingClientRect();
    dragStartPt = toSVG(e.clientX - r.left, e.clientY - r.top);
    dragStartVB = { ...vb };
    container.classList.add("panning");
  }, { signal });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const r = wrapper.getBoundingClientRect();
    const ratioX = vb.w / r.width;
    const ratioY = vb.h / r.height;
    vb.x =
      dragStartVB.x -
      (e.clientX - r.left - (dragStartPt.x - dragStartVB.x) / ratioX) * ratioX;
    vb.y =
      dragStartVB.y -
      (e.clientY - r.top - (dragStartPt.y - dragStartVB.y) / ratioY) * ratioY;
    clamp();
    setViewBox();
  }, { signal });
  window.addEventListener("mouseup", () => {
    dragging = false;
    container.classList.remove("panning");
  }, { signal });

  let lastTouches = null;

  wrapper.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
      lastTouches = Array.from(e.touches).map((t) => ({
        x: t.clientX - wrapper.getBoundingClientRect().left,
        y: t.clientY - wrapper.getBoundingClientRect().top,
      }));
    },
    { passive: false, signal },
  );

  wrapper.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const r = wrapper.getBoundingClientRect();
      const touches = Array.from(e.touches).map((t) => ({
        x: t.clientX - r.left,
        y: t.clientY - r.top,
      }));
      if (touches.length === 2 && lastTouches && lastTouches.length === 2) {
        const prev = lastTouches,
          cur = touches;
        const prevDist = Math.hypot(
          prev[1].x - prev[0].x,
          prev[1].y - prev[0].y,
        );
        const curDist = Math.hypot(cur[1].x - cur[0].x, cur[1].y - cur[0].y);
        const midX = (cur[0].x + cur[1].x) / 2;
        const midY = (cur[0].y + cur[1].y) / 2;
        if (prevDist > 0) zoomAt(midX, midY, curDist / prevDist);
      } else if (
        touches.length === 1 &&
        lastTouches &&
        lastTouches.length === 1 &&
        currentScale() > MIN_SCALE
      ) {
        const dx = ((touches[0].x - lastTouches[0].x) * vb.w) / r.width;
        const dy = ((touches[0].y - lastTouches[0].y) * vb.h) / r.height;
        vb.x -= dx;
        vb.y -= dy;
        clamp();
        setViewBox();
      }
      lastTouches = touches;
    },
    { passive: false, signal },
  );

  let lastTapTime = 0,
    lastTapPos = null,
    touchMoved = false;
  const DOUBLE_TAP_DELAY = 300,
    DOUBLE_TAP_DISTANCE = 30;

  wrapper.addEventListener(
    "touchstart",
    () => {
      touchMoved = false;
    },
    { passive: true, signal },
  );
  wrapper.addEventListener(
    "touchmove",
    () => {
      touchMoved = true;
    },
    { passive: true, signal },
  );

  wrapper.addEventListener(
    "touchend",
    (e) => {
      if (touchMoved) {
        lastTouches = null;
        return;
      }
      if (e.changedTouches.length !== 1) return;
      const now = Date.now();
      const touch = e.changedTouches[0];
      const r = wrapper.getBoundingClientRect();
      const tapX = touch.clientX - r.left;
      const tapY = touch.clientY - r.top;
      const isDoubleTap =
        lastTapPos &&
        now - lastTapTime < DOUBLE_TAP_DELAY &&
        Math.hypot(tapX - lastTapPos.x, tapY - lastTapPos.y) <
          DOUBLE_TAP_DISTANCE;
      if (isDoubleTap) {
        e.preventDefault();
        zoomAt(tapX, tapY, ZOOM_STEP);
        lastTapTime = 0;
        lastTapPos = null;
      } else {
        lastTapTime = now;
        lastTapPos = { x: tapX, y: tapY };
      }
      lastTouches = null;
    },
    { passive: false, signal },
  );
  const teleportEl = svg.getElementById("path3295");
  if (teleportEl) {
    teleportEl.style.cursor = "pointer";
    teleportEl.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      const modal = document.getElementById("teleportModal");
      modal.classList.add("open");

      document.getElementById("teleportYes").onclick = () => {
        modal.classList.remove("open");
        vb.x = 100; 
        vb.y = 1200;  
        vb.w = origVB.w / 3.6;
        vb.h = origVB.h / 3.6;
        clamp();
        setViewBox();
      };
      document.getElementById("teleportNo").onclick = () => {
        modal.classList.remove("open");
      };
    });
  }

}

// ── Panel toggle logic ──
const backdrop = document.getElementById("mapBackdrop");
const panels = [
  {
    btn: document.getElementById("legendBtn"),
    panel: document.getElementById("legendPanel"),
  },
  {
    btn: document.getElementById("infoBtn"),
    panel: document.getElementById("infoPanel"),
  },
];

function closeAll() {
  panels.forEach(({ btn, panel }) => {
    panel.classList.remove("open");
    btn.classList.remove("open");
    btn.setAttribute("aria-expanded", false);
  });
  backdrop.classList.remove("open");
}

panels.forEach(({ btn, panel }) => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.contains("open");
    closeAll();
    if (!isOpen) {
      panel.classList.add("open");
      btn.classList.add("open");
      btn.setAttribute("aria-expanded", true);
    }
  });
});

let mouseMove = false;
document.addEventListener("mousedown", function (e) {
  mouseMove = false; // Reset mouseMove on each mousedown
});
document.addEventListener("mousemove", function (e) {
  mouseMove = true;
});

document.addEventListener("mouseup", (e) => {
  if (
    !panels.some(
      ({ btn, panel }) => btn.contains(e.target) || panel.contains(e.target),
    )
  ) {
    // If mouse moved, don't close panels (user was dragging, not clicking)
    if (mouseMove) {
      mouseMove = false;
      return;
    }
    closeAll();
  }
});
panels.forEach(({ panel }) => {
  panel.addEventListener("click", (e) => e.stopPropagation());
});

// ── Layer toggles ──
document.querySelectorAll(".legend-row[data-layers]").forEach((row) => {
  const checkbox = row.querySelector('input[type="checkbox"]');
  if (!checkbox) return;
  const toggle = () => {
    const layerIds = row.dataset.layers.split(",");
    const hidden = !checkbox.checked;
    row.classList.toggle("hidden", hidden);
    layerIds.forEach((id) => {
      const key = id.trim();
      [document.getElementById(key), compareRoot && compareRoot.getElementById(key)]
        .forEach((layer) => {
          if (layer) layer.style.display = hidden ? "none" : "";
        });
    });
  };
  checkbox.addEventListener("change", toggle);
  row.addEventListener("click", (e) => {
    if (e.target === checkbox) return;
    checkbox.checked = !checkbox.checked;
    toggle();
  });
});