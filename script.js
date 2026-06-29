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

    const panzoom = Panzoom(svg, {
      maxScale: 50,
      startScale: 2,
      startX: 0,
      startY: 150,
      animate: false,
      duration: 0
    });

    initZoom(panzoom, wrapper)
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

function initZoom(panzoom, wrapper) {
  wrapper.parentElement.addEventListener('wheel', panzoom.zoomWithWheel);

  document.getElementById("zoomIn")
    .addEventListener('click', panzoom.zoomIn);

  document.getElementById("zoomOut")
    .addEventListener('click', panzoom.zoomOut);
  
  document.getElementById("zoomReset")
    .addEventListener('click', () => {
      panzoom.zoom(2, { x: 0, y: 150 })
    })
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
