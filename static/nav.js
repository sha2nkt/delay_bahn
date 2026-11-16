/* The tab bar. A tapped tab lights up at once and a thin bar runs along the top
   until the next page replaces this one, so a tap shows even while that page
   loads (the installed app has no loading bar of its own). In the installed
   app the other tabs are also fetched into the service worker's cache once
   this page has loaded, so switching opens them from there. */
(function () {
  const TABS = ".site-nav-link, #trips-nav";

  const style = document.createElement("style");
  style.textContent =
    ".nav-progress{position:fixed;top:env(safe-area-inset-top,0px);left:0;right:0;height:3px;" +
    "background:var(--brand-red,#fd1c17);transform:scaleX(0);transform-origin:0 50%;" +
    "z-index:10000;pointer-events:none}" +
    ".nav-progress.run{transform:scaleX(.9);transition:transform 6s cubic-bezier(.08,.8,.2,1)}";
  document.head.appendChild(style);

  let bar = null;
  const wasActive = [...document.querySelectorAll(".site-nav-link.active")];

  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest(TABS);
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    document.querySelectorAll(".site-nav-link.active").forEach((l) => l.classList.remove("active"));
    if (a.classList.contains("site-nav-link")) a.classList.add("active");
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "nav-progress";
      document.body.appendChild(bar);
    }
    bar.classList.remove("run");
    bar.getBoundingClientRect();
    bar.classList.add("run");
  });
  // iOS applies :active only on elements with a touch listener above them
  document.addEventListener("touchstart", () => {}, { passive: true });

  // Back from the next page can show this one from memory, bar still running
  addEventListener("pageshow", (e) => {
    if (!e.persisted) return;
    if (bar) bar.classList.remove("run");
    document.querySelectorAll(".site-nav-link.active").forEach((l) => l.classList.remove("active"));
    wasActive.forEach((l) => l.classList.add("active"));
  });

  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const conn = navigator.connection;
  if (!standalone || !("serviceWorker" in navigator) || (conn && (conn.saveData || /2g/.test(conn.effectiveType || "")))) return;
  const warm = () => navigator.serviceWorker.ready.then((reg) => {
    const paths = [...document.querySelectorAll(TABS)]
      .map((a) => new URL(a.href, location.href))
      .filter((u) => u.origin === location.origin && u.pathname !== location.pathname)
      .map((u) => u.pathname);
    if (reg.active) reg.active.postMessage({ warm: paths });
  });
  // after this page's own requests have had their turn
  const later = () => setTimeout(warm, 2000);
  if (document.readyState === "complete") later();
  else addEventListener("load", later);
})();
