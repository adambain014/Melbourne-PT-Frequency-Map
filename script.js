
// ── Dark mode toggle ──
const LIGHT_SVG = "recent_map.svg";
const DARK_SVG = "dark_map.svg";

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
  "flexiride-swatch": "#291A10",
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
  loadSVG(isDark ? DARK_SVG : LIGHT_SVG, currentViewBox());
});

// ── SVG loading ──
let svgEl = null;

function currentViewBox() {
  return svgEl ? svgEl.getAttribute("viewBox") : null;
}

async function loadSVG(src, preserveViewBox) {
  const wrapper = document.getElementById("map-svg-wrapper");

  // ── Capture hidden layers before swap ──
  const hiddenLayers = new Set();
  if (svgEl) {
    document.querySelectorAll(".legend-row[data-layers]").forEach((row) => {
      const cb = row.querySelector('input[type="checkbox"]');
      if (cb && !cb.checked) {
        row.dataset.layers
          .split(",")
          .forEach((id) => hiddenLayers.add(id.trim()));
      }
    });
  }

  try {
    const res = await fetch(src);
    const text = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "image/svg+xml");
    const svg = doc.querySelector("svg");

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
  } catch (e) {
    wrapper.innerHTML =
      '<p style="padding:2rem;text-align:center;color:#888;font-size:13px;">Could not load <code>' +
      src +
      "</code> — make sure it is in the same folder.</p>";
  }
}

// Initial load
(async () => {
  await loadSVG(LIGHT_SVG, null);
})();

function initZoom(svg, preserveViewBox) {
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
    setViewBox();
  } else {
    const initialScale = 2;

    vb.w = origVB.w / initialScale;
    vb.h = origVB.h / initialScale;
    vb.x = origVB.x + (origVB.w - vb.w) / 2;
    vb.y = origVB.y + (origVB.h - vb.h) / 2 - 250;
    setViewBox();

  }

  const MIN_SCALE = 1,
    MAX_SCALE = 20,
    ZOOM_STEP = 1.35;

  function setViewBox() {
    svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
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
    { passive: false },
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
  });
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
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
    container.classList.remove("panning");
  });

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
    { passive: false },
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
    { passive: false },
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
    { passive: true },
  );
  wrapper.addEventListener(
    "touchmove",
    () => {
      touchMoved = true;
    },
    { passive: true },
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
    { passive: false },
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
      const layer = document.getElementById(id.trim());
      if (layer) layer.style.display = hidden ? "none" : "";
    });
  };
  checkbox.addEventListener("change", toggle);
  row.addEventListener("click", (e) => {
    if (e.target === checkbox) return;
    checkbox.checked = !checkbox.checked;
    toggle();
  });
});
