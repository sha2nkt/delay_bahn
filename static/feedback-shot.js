/* Page screenshot for the feedback boxes, shared by every page through
   import("/feedback-shot.js?v=4"). The page is redrawn from the DOM (no browser
   prompt), from the top of the page down to the feedback box: the box sits at
   the foot of its page, so that is everything the visitor scrolled through to
   reach it; the footer below is left out. The box itself is left out and the
   account name is blanked. The 55 KB renderer is only fetched for a capture. */

// the server refuses anything bigger (feedback.SHOT_MAX_BYTES is 512 KiB)
const MAX_BYTES = 500 * 1024;
// a long page stays a tall strip at a readable width rather than shrinking whole
const MAX_W = 1200;
const MAX_H = 12000;
const MAX_AREA = 16_000_000; // Safari's canvas ceiling
// a capture older than this is retaken when the visitor comes back to the box
const STALE_MS = 30_000;
const PRIVATE = ".auth-name-text, [data-shot-private]";

const dataUrlBytes = (url) => ((url.length - url.indexOf(",") - 1) * 3) / 4;

// A WebGL map clears its drawing buffer after every frame, so its canvas reads
// back blank. Its pixels are taken inside a render event instead and laid over
// the canvas as an <img> for the length of the capture.
async function freezeMap(map) {
  const canvas = map.getCanvas();
  if (!canvas.clientWidth || !canvas.clientHeight) return null;
  const url = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 1500);
    map.once("render", () => {
      clearTimeout(timer);
      try { resolve(canvas.toDataURL("image/jpeg", 0.9)); } catch { resolve(null); }
    });
    map.triggerRepaint();
  });
  if (!url) return null;
  const img = new Image();
  img.src = url;
  await img.decode();
  Object.assign(img.style, {
    position: "absolute", left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`,
    width: `${canvas.clientWidth}px`, height: `${canvas.clientHeight}px`, pointerEvents: "none",
  });
  canvas.after(img);
  return img;
}

// JPEG quality gives way before size does: small text survives compression
// better than downscaling
function toJpeg(src, sx, sy, sw, sh) {
  let scale = Math.min(1, MAX_W / sw, MAX_H / sh);
  for (let step = 0; step < 5; step++, scale *= 0.8) {
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    out.getContext("2d").drawImage(src, sx, sy, sw, sh, 0, 0, out.width, out.height);
    for (const quality of [0.75, 0.6, 0.45]) {
      const url = out.toDataURL("image/jpeg", quality);
      if (dataUrlBytes(url) <= MAX_BYTES) return url;
    }
  }
  throw new Error("screenshot still too large after shrinking");
}

// -> JPEG data URL of the page from its top down to `box`
export async function capturePage(box, { maps = [] } = {}) {
  const body = document.body;
  const bodyRect = body.getBoundingClientRect();
  const boxTop = box.getBoundingClientRect().top - bodyRect.top;
  let y0 = 0;
  let h = boxTop;
  // a box near the top of the page has little above it: take the screen instead
  if (h < 200) { y0 = Math.max(0, -bodyRect.top); h = window.innerHeight; }

  // blanked rather than dropped, at the width they had, so the line keeps its layout
  const hidden = [...document.querySelectorAll(PRIVATE)];
  hidden.forEach((el) => { el.dataset.shotW = Math.ceil(el.getBoundingClientRect().width); });
  const overlays = (await Promise.all(maps.filter(Boolean).map((m) => freezeMap(m).catch(() => null))))
    .filter(Boolean);
  try {
    const { domToCanvas } = await import("/modern-screenshot.js?v=1");
    const canvas = await domToCanvas(body, {
      // no sharper than the output keeps, and inside the canvas ceiling on long pages
      scale: Math.min(window.devicePixelRatio || 1, 2, MAX_W / bodyRect.width,
        Math.sqrt(MAX_AREA / (bodyRect.width * bodyRect.height))),
      backgroundColor: getComputedStyle(body).backgroundColor || "#fff",
      font: false,
      timeout: 8000,
      filter: (node) => {
        if (node === box) return false;
        if (node.nodeType === Node.TEXT_NODE) return !node.parentElement?.closest(PRIVATE);
        // frozen maps are drawn from their overlay
        return !(node.tagName === "CANVAS" && node.classList.contains("maplibregl-canvas") &&
          overlays.some((img) => img.previousElementSibling === node));
      },
      onCloneEachNode: (clone) => {
        if (clone.nodeType !== Node.ELEMENT_NODE || !clone.dataset?.shotW) return;
        Object.assign(clone.style, {
          display: "inline-block", width: `${clone.dataset.shotW}px`, height: "0.9em",
          verticalAlign: "middle", background: "#c9c9c9", borderRadius: "3px", filter: "blur(2px)",
        });
      },
    });
    // the library may scale down past maximumCanvasSize: crop by the real ratio
    const r = canvas.width / bodyRect.width;
    const sh = Math.min(h, bodyRect.height - y0);
    return toJpeg(canvas, 0, y0 * r, canvas.width, sh * r);
  } finally {
    overlays.forEach((img) => img.remove());
    hidden.forEach((el) => { delete el.dataset.shotW; });
  }
}

/* The "send a screenshot of this page" tick with its thumbnail, mounted at the
   start of `row`. Ticked by default; the visitor's own attached image replaces
   it (hide(true) while one is attached). refresh() starts a capture unless a
   fresh one exists or is under way; take() waits for it and returns the data
   URL, or null when unticked, hidden, or the capture failed. */
export function mountAutoShot({ box, row, label, i18n, maps = () => [], track = () => {} }) {
  const wrap = document.createElement("label");
  wrap.className = "feedback-auto";
  const tick = document.createElement("input");
  tick.type = "checkbox";
  tick.checked = true;
  const text = document.createElement("span");
  text.textContent = label;
  if (i18n) text.dataset.i18n = i18n; // the page's language switch relabels it
  const thumb = document.createElement("img");
  thumb.className = "feedback-shot-thumb feedback-auto-thumb";
  thumb.alt = "";
  thumb.hidden = true;
  wrap.append(tick, text, thumb);
  row.prepend(wrap);

  let pending = null;
  let url = null;
  let at = 0;
  let own = false;
  let gen = 0; // a reset orphans a capture still under way

  function show() {
    thumb.src = url || "";
    thumb.hidden = !url || !tick.checked;
  }
  function refresh() {
    if (pending || (url && Date.now() - at < STALE_MS)) return pending;
    const g = gen;
    pending = capturePage(box, { maps: maps() })
      .then((u) => { if (g === gen) { url = u; at = Date.now(); } })
      .catch(() => { if (g === gen) url = null; })
      .finally(() => { if (g === gen) pending = null; show(); });
    return pending;
  }
  tick.addEventListener("change", () => {
    track(tick.checked ? "feedback-autoshot-on" : "feedback-autoshot-off");
    show();
    if (tick.checked) refresh();
  });
  return {
    refresh,
    async take() {
      if (own || !tick.checked) return null;
      await (pending || refresh());
      return tick.checked && !own ? url : null;
    },
    hide(on) { own = on; wrap.hidden = on; },
    reset() { gen++; pending = null; url = null; at = 0; tick.checked = true; show(); },
  };
}

/* Full-size view of a screenshot thumbnail, so the visitor can check what will be
   sent. Delegated, so the page's own attachment chip is covered as well; a tap
   anywhere or Esc closes it. Styled here rather than in style.css so every page
   that loads this module gets it without a stylesheet buster. A long page shows
   at full width and scrolls, so its text stays readable. */
let viewer = null;
function openViewer(src) {
  if (!viewer) {
    const style = document.createElement("style");
    style.textContent = `
      .feedback-shot-thumb { cursor: zoom-in; }
      .shot-viewer {
        margin: 0; inset: 0; width: 100vw; height: 100vh; height: 100dvh; max-width: none; max-height: none;
        /* a strip above the shot for the ✕, so it never covers the picture */
        box-sizing: border-box; padding: calc(max(12px, env(safe-area-inset-top)) + 52px) 2vw 2vh;
        border: none; background: transparent; overflow: hidden; cursor: zoom-out;
      }
      .shot-viewer[open] { display: flex; align-items: flex-start; justify-content: center; }
      .shot-viewer::backdrop { background: rgba(0, 0, 0, .75); }
      .shot-viewer-scroll { max-width: 100%; max-height: 100%; overflow: auto; -webkit-overflow-scrolling: touch; }
      .shot-viewer img { display: block; max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 6px 30px rgba(0, 0, 0, .4); }
      .shot-viewer-close {
        position: absolute; z-index: 1; top: max(12px, env(safe-area-inset-top)); right: max(12px, env(safe-area-inset-right));
        width: 40px; height: 40px;
        display: flex; align-items: center; justify-content: center; padding: 0;
        border: 1px solid rgba(255, 255, 255, .35); border-radius: 50%;
        background: rgba(0, 0, 0, .65); color: #fff; font: 20px/1 system-ui, sans-serif; cursor: pointer;
      }
      .shot-viewer-close:hover { background: rgba(0, 0, 0, .85); }
      .shot-viewer-close:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }`;
    document.head.append(style);
    viewer = document.createElement("dialog");
    viewer.className = "shot-viewer";
    // The dialog covers the whole screen and only the inner box scrolls, so the ✕
    // sits in the screen's corner over a scrolling shot. A fixed ✕ inside a
    // scrolling dialog was pinned to the dialog's edge and clipped in iOS Safari.
    const close = Object.assign(document.createElement("button"), {
      type: "button", className: "shot-viewer-close", textContent: "✕",
    });
    close.setAttribute("aria-label", document.documentElement.lang === "en" ? "Close" : "Schließen");
    const scroll = Object.assign(document.createElement("div"), { className: "shot-viewer-scroll" });
    scroll.append(Object.assign(document.createElement("img"), { alt: "" }));
    viewer.append(close, scroll);
    viewer.addEventListener("click", () => viewer.close());
    document.body.append(viewer);
  }
  viewer.querySelector("img").src = src;
  viewer.querySelector(".shot-viewer-scroll").scrollTop = 0;
  viewer.showModal();
}
document.addEventListener("click", (e) => {
  const thumb = e.target.closest?.(".feedback-shot-thumb");
  if (!thumb?.getAttribute("src")) return;
  e.preventDefault(); // the auto thumbnail sits in the tick's <label>: a tap on it must not untick
  openViewer(thumb.src);
});
