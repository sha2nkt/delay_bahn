"use strict";
/* Country leaderboard: the countries in the delay table ranked by punctuality
   over the last day / 7 days / 30 days, on a choropleth of Europe. Data comes
   from /api/leaderboard and is re-fetched while the page stays open, so a tab
   left open picks up the morning's rebuild by itself. */
(function () {

const I18N = {
  de: {
    docTitle: "Europas Bahn-Rangliste – welches Land fährt am pünktlichsten? | DelayBahn",
    headerTitle: "Länder-Rangliste",
    tagline: "Welches Land bringt seine Züge pünktlich ans Ziel?",
    navLogin: "Anmelden",
    navLogout: "Abmelden",
    navTrips: "Meine Fahrten",
    logoSrc: "/leaderboard-logo-de.png",
    logoAlt: "Europas Verspätungs-Rangliste",
    heroTitle1: "Wer fährt pünktlich,",
    heroTitle2: "wer lässt warten?",
    heroLead: "Sechs Bahnländer, ein Maßstab: der Anteil der Halte, an denen ein Fernzug weniger als 6 Minuten verspätet ankam. Jeden Morgen aus den Verspätungsdaten des Vortags neu berechnet.",
    periodDay: "Tag",
    periodWeek: "Woche",
    periodMonth: "Monat",
    periodGroup: "Zeitraum",
    winnerNone: "Kein Land gewertet – zu wenig Daten in diesem Zeitraum.",
    legendTitle: "Anteil verspäteter Halte",
    legendLow: "0 %",
    legendHigh: "50 %+",
    asOf: "Stand: {date} · jeden Morgen automatisch aktualisiert",
    podiumHeading: "Das Podium",
    tableHeading: "Die ganze Tabelle",
    tableLead: "Nur Fernzüge (Strecken über 100 km): ICE, IC, EC, Railjet, Nightjet, TGV, Ouigo, Intercity und ihre Pendants. Regional-, S-Bahn- und InterRegio-Züge bleiben außen vor.",
    tableHeadingAll: "Alle Züge",
    tableLeadAll: "Dieselbe Rangliste über alle Züge, also auch Regional-, S-Bahn- und InterRegio-Züge.",
    colCountry: "Land",
    colPunctuality: "Pünktlich (< 6 min)",
    colAvgDelay: "Ø Verspätung",
    colCancelled: "Ausfälle",
    colStops: "Halte",
    colTrend: "Letzte 30 Tage",
    colTrendTitle: "Anteil pünktlicher Halte pro Tag in den letzten 30 Tagen, links der älteste Tag, der Punkt ist der neueste. Jede Linie hat ihre eigene Skala.",
    tipRank: "Platz {n}",
    tipUnranked: "nicht gewertet",
    tipPunctual: "pünktlich",
    tipAvg: "Ø Verspätung",
    tipCancelled: "ausgefallen",
    tipStops: "Halte",
    tipSource: "Quelle: {src}",
    thinNote: "zu wenig Daten: {n} Halte, gewertet ab {min}",
    noDataNote: "keine Daten in diesem Zeitraum",
    partialNote: "{n} von {total} Tagen mit Daten",
    tipDays: "Tage mit Daten",
    rankLabel: "Platz",
    unrankedLabel: "nicht gewertet",
    noData: "Für diesen Zeitraum liegen noch keine Daten vor.",
    loadError: "Die Rangliste konnte nicht geladen werden – bitte später noch einmal versuchen.",
    updated: "Neue Zahlen: Die Rangliste wurde gerade aktualisiert.",
    podiumSub: "Ø {delay} Verspätung · {cancelled} Ausfälle",
    sparkTitle: "Pünktlichkeit der letzten 30 Tage: {min} bis {max}",
    methodHeading: "So wird gezählt",
    methodText: "Für jedes Land zählen alle aufgezeichneten Halte von Fernzügen (ICE, IC, EC, Railjet, Nightjet, TGV, Ouigo, Intercity und Entsprechungen) mit Echtzeit-Ankunft. Pünktlich ist ein Halt nach der Definition der Deutschen Bahn, wenn der Zug weniger als 6 Minuten nach Plan ankommt, derselbe Maßstab für alle Länder. Ø Verspätung ist die mittlere Ankunftsverspätung über alle nicht ausgefallenen Halte, zu früh zählt als 0. Die Rangfolge richtet sich nach dem Pünktlichkeitsanteil; bei Gleichstand entscheidet die geringere Ø Verspätung. Länder mit zu wenigen Halten im Zeitraum werden gezeigt, aber nicht gewertet. Die Daten stammen aus den offenen Echtzeit-Quellen der Bahnen (DB IRIS, ÖBB Scotty, opentransportdata.swiss, SNCF GTFS-RT, OVapi, ViaggiaTreno); ihre Abdeckung unterscheidet sich, zum Beispiel erfasst die österreichische Quelle nur die 200 größten Bahnhöfe. Die Tabelle „Alle Züge“ zählt nach denselben Regeln zusätzlich Regional-, S-Bahn- und InterRegio-Züge.",
    mapLabel: "Karte Europas: Länder nach Anteil verspäteter Halte eingefärbt, das pünktlichste Land hervorgehoben",
    requestHeading: "Mehr Daten oder Auswertungen gewünscht?",
    requestLead: "Hier anfragen.",
    requestPlaceholder: "Zum Beispiel: Wie pünktlich ist der ICE zwischen Berlin und München am Freitagabend?",
    requestLoginNote: "Zum Senden bitte kurz anmelden – dein Text bleibt erhalten.",
    requestLoginLink: "Anmelden",
    requestSend: "Anfrage senden",
    requestSending: "Wird gesendet …",
    requestThanks: "Danke! Deine Anfrage ist angekommen. Sobald es die Daten oder die Auswertung gibt, schicken wir sie dir per E-Mail.",
    requestError: "Das hat gerade nicht geklappt – bitte später noch einmal versuchen oder an kontakt@delaybahn.com schreiben.",
    requestTooMany: "Danke, das reicht für heute – wir haben deine Anfragen.",
    footerBack: "← Zur Verbindungssuche",
    footerStories: "Delay Geschichten",
    footerLegal: "Impressum & Datenschutz",
    footerContact: "Kontakt",
    footerData: "Verspätungsdaten:",
    footerMap: "Karte: Natural Earth",
    footerDisclaimer: "DelayBahn ist ein unabhängiges Projekt und steht in keiner Verbindung zur Deutsche Bahn AG. „DB“ und „Deutsche Bahn“ sind Marken der Deutsche Bahn AG.",
    minutes: "min",
  },
  en: {
    docTitle: "Europe's rail leaderboard – which country runs the most punctual trains? | DelayBahn",
    headerTitle: "Country leaderboard",
    tagline: "Which country gets its trains there on time?",
    navLogin: "Login",
    navLogout: "Logout",
    navTrips: "My trips",
    logoSrc: "/leaderboard-logo-en.png",
    logoAlt: "Europe's Delay Leaderboard",
    heroTitle1: "Who runs on time,",
    heroTitle2: "and who keeps you waiting?",
    heroLead: "Six rail countries, one yardstick: the share of stops where the long-distance train arrived less than 6 minutes late. Recomputed every morning from the previous day's delay data.",
    periodDay: "Day",
    periodWeek: "Week",
    periodMonth: "Month",
    periodGroup: "Period",
    winnerNone: "No country ranked – too little data in this period.",
    legendTitle: "Share of delayed stops",
    legendLow: "0%",
    legendHigh: "50%+",
    asOf: "Data as of {date} · refreshed automatically every morning",
    podiumHeading: "The podium",
    tableHeading: "The full table",
    tableLead: "Long-distance trains only (routes over 100 km): ICE, IC, EC, Railjet, Nightjet, TGV, Ouigo, Intercity and their equivalents. Regional, suburban and InterRegio trains are left out.",
    tableHeadingAll: "All trains",
    tableLeadAll: "The same ranking over every train, regional, suburban and InterRegio services included.",
    colCountry: "Country",
    colPunctuality: "On time (< 6 min)",
    colAvgDelay: "Avg. delay",
    colCancelled: "Cancelled",
    colStops: "Stops",
    colTrend: "Last 30 days",
    colTrendTitle: "Share of on-time stops per day over the last 30 days, oldest day on the left, the dot is the latest. Each line has its own scale.",
    tipRank: "Rank {n}",
    tipUnranked: "not ranked",
    tipPunctual: "on time",
    tipAvg: "avg. delay",
    tipCancelled: "cancelled",
    tipStops: "stops",
    tipSource: "Source: {src}",
    thinNote: "too little data: {n} stops, ranked from {min}",
    noDataNote: "no data in this period",
    partialNote: "{n} of {total} days with data",
    tipDays: "days with data",
    rankLabel: "Rank",
    unrankedLabel: "not ranked",
    noData: "No data for this period yet.",
    loadError: "The leaderboard could not be loaded – please try again later.",
    updated: "Fresh numbers: the leaderboard has just been updated.",
    podiumSub: "{delay} avg. delay · {cancelled} cancelled",
    sparkTitle: "Punctuality over the last 30 days: {min} to {max}",
    methodHeading: "How we count",
    methodText: "For every country we count all recorded stops of long-distance trains (ICE, IC, EC, Railjet, Nightjet, TGV, Ouigo, Intercity and equivalents) with a real-time arrival. A stop is on time by Deutsche Bahn's own definition when the train arrives less than 6 minutes after schedule, the same yardstick for every country. Avg. delay is the mean arrival delay over all non-cancelled stops, early arrivals count as 0. Countries rank by their on-time share; ties go to the lower average delay. Countries with too few stops in the period are shown but not ranked. The data comes from the railways' open real-time sources (DB IRIS, ÖBB Scotty, opentransportdata.swiss, SNCF GTFS-RT, OVapi, ViaggiaTreno); their coverage differs, for instance the Austrian source only covers the 200 largest stations. The \"All trains\" table adds regional, suburban and InterRegio services by the same rules.",
    mapLabel: "Map of Europe, countries shaded by their share of delayed stops, the most punctual one outlined in gold",
    requestHeading: "Need more data or analysis?",
    requestLead: "Request it here.",
    requestPlaceholder: "For example: How punctual is the ICE between Berlin and Munich on Friday evenings?",
    requestLoginNote: "Please log in to send – your text will be kept.",
    requestLoginLink: "Log in",
    requestSend: "Send request",
    requestSending: "Sending …",
    requestThanks: "Thanks! Your request has arrived. Once the data or analysis exists we will share it with you over email.",
    requestError: "That did not work just now – please try again later or write to kontakt@delaybahn.com.",
    requestTooMany: "Thanks, that is plenty for today – we have your requests.",
    footerBack: "← Back to the connection search",
    footerStories: "Delay Stories",
    footerLegal: "Legal notice & privacy",
    footerContact: "Contact",
    footerData: "Delay data:",
    footerMap: "Map: Natural Earth",
    footerDisclaimer: "DelayBahn is an independent project and is not affiliated with Deutsche Bahn AG. \"DB\" and \"Deutsche Bahn\" are trademarks of Deutsche Bahn AG.",
    minutes: "min",
  },
};

const COUNTRIES = {
  DE: { flag: "🇩🇪", de: "Deutschland", en: "Germany", src: "DB (IRIS)" },
  AT: { flag: "🇦🇹", de: "Österreich", en: "Austria", src: "ÖBB (Scotty)" },
  CH: { flag: "🇨🇭", de: "Schweiz", en: "Switzerland", src: "opentransportdata.swiss" },
  FR: { flag: "🇫🇷", de: "Frankreich", en: "France", src: "SNCF (GTFS-RT)" },
  NL: { flag: "🇳🇱", de: "Niederlande", en: "Netherlands", src: "NS (OVapi)" },
  IT: { flag: "🇮🇹", de: "Italien", en: "Italy", src: "RFI/Trenitalia (ViaggiaTreno)" },
};

// small SVG flags (3:2) so the page does not depend on the platform's emoji set
const FLAGS = {
  DE: '<rect width="3" height="2" fill="#000"/><rect y=".667" width="3" height=".667" fill="#d00"/><rect y="1.333" width="3" height=".667" fill="#ffce00"/>',
  AT: '<rect width="3" height="2" fill="#ed2939"/><rect y=".667" width="3" height=".667" fill="#fff"/>',
  CH: '<rect width="3" height="2" fill="#d52b1e"/><rect x="1.3" y=".4" width=".4" height="1.2" fill="#fff"/><rect x=".9" y=".8" width="1.2" height=".4" fill="#fff"/>',
  FR: '<rect width="3" height="2" fill="#0055a4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ef4135"/>',
  NL: '<rect width="3" height="2" fill="#ae1c28"/><rect y=".667" width="3" height=".667" fill="#fff"/><rect y="1.333" width="3" height=".667" fill="#21468b"/>',
  IT: '<rect width="3" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/>',
};
// parchment to burnt orange: the share of delayed stops, 0 % at the lightest
// step and 50 %+ at the darkest (long-distance shares run up to about half),
// fixed so a colour means the same in every period
const RAMP = ["#f3ead4", "#f2dcb3", "#f1c98f", "#efa964", "#ea8140", "#d85f22", "#ad3f12"];
// the window of the projected map that is shown: the six countries plus room
// for their labels, so the rest of Europe is only a margin around them
const MAP_VIEW = { x: 55, y: 270, w: 900, h: 600 };  // 3:2
// where each country's label sits (left edge, name baseline; map units). The
// small ones are pushed off the land and a dotted leader runs back to `lead`.
const LABELS = {
  DE: { x: 452, y: 395 },
  FR: { x: 292, y: 583 },
  IT: { x: 580, y: 708 },
  NL: { x: 372, y: 328, lead: [418, 372] },
  CH: { x: 392, y: 662, lead: [440, 640] },
  AT: { x: 652, y: 512, lead: [648, 520] },
};
const DELAYED_MAX = 50;
const PERIODS = ["day", "week", "month"];
const REFRESH_MS = 5 * 60 * 1000;

const LANG = document.documentElement.lang === "en" ? "en" : "de";
const LOCALE = LANG === "en" ? "en-GB" : "de-DE";
const S = I18N[LANG];
const NF = new Intl.NumberFormat(LOCALE);
const NF1 = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const REDUCED_MOTION = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const $ = (id) => document.getElementById(id);

function t(key, vars) {
  let s = S[key] || I18N.de[key] || key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace("{" + k + "}", vars[k]);
  return s;
}
function pct(v) { return v == null ? "–" : NF1.format(v) + (LANG === "de" ? " %" : "%"); }
function mins(v) { return v == null ? "–" : NF1.format(v) + " " + t("minutes"); }
function countryName(code) { const c = COUNTRIES[code]; return c ? c[LANG] : code; }
function flag(code) { return (COUNTRIES[code] || {}).flag || code; }
function flagEl(code) {
  const span = document.createElement("span");
  span.className = "lb-flag";
  span.setAttribute("aria-hidden", "true");
  if (FLAGS[code]) span.innerHTML = '<svg viewBox="0 0 3 2">' + FLAGS[code] + "</svg>";
  return span;
}
function rankBadge(rank) {
  const b = document.createElement("span");
  b.className = "lb-rank-badge";
  b.textContent = rank;
  b.setAttribute("aria-label", t("rankLabel") + " " + rank);
  return b;
}
function parseDay(iso) { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }
function fmtDay(iso, opts) { return parseDay(iso).toLocaleDateString(LOCALE, opts); }

function hexToRgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); }
function rampColor(delayedPct) {
  const pos = Math.max(0, Math.min(1, delayedPct / DELAYED_MAX)) * (RAMP.length - 1);
  const i = Math.min(Math.floor(pos), RAMP.length - 2);
  const f = pos - i;
  const a = hexToRgb(RAMP[i]), b = hexToRgb(RAMP[i + 1]);
  return "rgb(" + a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",") + ")";
}

// on-time bars: red at the table's floor and below, yellow halfway, green from
// 97 % up. Each table has its own floor (TABLES[].meterFloor), the span its six
// countries actually cover, fixed so a colour means the same in every period
const METER_STOPS = ["#c50014", "#e0a800", "#2a7230"];
function meterColor(punctuality, floor) {
  const pos = Math.max(0, Math.min(1, (punctuality - floor) / (97 - floor))) * (METER_STOPS.length - 1);
  const i = Math.min(Math.floor(pos), METER_STOPS.length - 2);
  const f = pos - i;
  const a = hexToRgb(METER_STOPS[i]), b = hexToRgb(METER_STOPS[i + 1]);
  return "rgb(" + a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",") + ")";
}

function applyI18n() {
  document.title = t("docTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (S[key] != null) el.textContent = S[key];
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelector(".lb-periods").setAttribute("aria-label", t("periodGroup"));
  const logo = document.getElementById("lb-logo");
  logo.src = t("logoSrc");
  logo.alt = t("logoAlt");
}

/* ---------- state ---------- */
let data = null;
let period = PERIODS.includes(new URLSearchParams(location.search).get("period"))
  ? new URLSearchParams(location.search).get("period") : "month";
let paths = {};       // code -> <path>
let svg = null;
let leaders = null;   // <g> with the dotted lines from displaced labels
let labels = null;    // <g> with name + figure per country
let pinned = null;    // code whose tooltip a tap pinned open
// table order: which column, and the numeric direction; each metric's default
// is its best-first direction, a second click on the same header flips it
const SORT_DEFAULT = { punctuality: "desc", avgDelay: "asc", cancelled: "asc", stops: "desc" };
// the two tables: long-distance trains only, and every train. Each sorts on its
// own; the map and podium follow the long-distance ranking.
const TABLES = [
  { name: "long", rows: "lb-rows", status: "lb-status", view: () => data.longDistance, meterFloor: 50, sort: { key: "punctuality", dir: "desc" } },
  { name: "all", rows: "lb-rows-all", status: "lb-status-all", view: () => data, meterFloor: 80, sort: { key: "punctuality", dir: "desc" } },
];
TABLES.forEach((tbl) => { tbl.section = $(tbl.rows).closest(".lb-table-section"); });

function current() { return data.longDistance.periods[period]; }
function entry(code) { return current().countries.find((c) => c.code === code) || null; }

/* ---------- map ---------- */
const SVG_NS = "http://www.w3.org/2000/svg";
function svgEl(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k of Object.keys(attrs || {})) el.setAttribute(k, attrs[k]);
  return el;
}

function buildMap() {
  const host = $("lb-map");
  const map = window.EUROPE_MAP;
  if (!map) {
    host.innerHTML = '<p class="lb-map-empty">' + t("loadError") + "</p>";
    return;
  }
  const v = MAP_VIEW;
  const sea = 'x="' + v.x + '" y="' + v.y + '" width="' + v.w + '" height="' + v.h + '"';
  svg = svgEl("svg", { viewBox: [v.x, v.y, v.w, v.h].join(" "), role: "img", "aria-label": t("mapLabel") });
  svg.innerHTML =
    "<defs>" +
    '<linearGradient id="lb-sea" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="#8fa9ad"/><stop offset="1" stop-color="#627e88"/></linearGradient>' +
    '<radialGradient id="lb-vignette" cx="50%" cy="45%" r="72%">' +
    '<stop offset=".5" stop-color="#0b1a22" stop-opacity="0"/><stop offset="1" stop-color="#0b1a22" stop-opacity=".4"/></radialGradient>' +
    // film grain over the sea
    '<filter id="lb-grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="2" seed="11"/>' +
    '<feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .22 0"/></filter>' +
    // the featured countries: mottled paper, one soft shadow under the whole group
    '<filter id="lb-paper" x="-8%" y="-8%" width="116%" height="120%" color-interpolation-filters="sRGB">' +
    '<feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3" result="noise"/>' +
    '<feColorMatrix in="noise" type="matrix" values="0 0 0 0 .32  0 0 0 0 .22  0 0 0 0 .1  0 0 0 .3 0" result="tint"/>' +
    '<feComposite in="tint" in2="SourceGraphic" operator="in" result="grain"/>' +
    '<feBlend in="grain" in2="SourceGraphic" mode="multiply" result="paper"/>' +
    '<feDropShadow in="paper" dx="0" dy="5" stdDeviation="6" flood-color="#10222b" flood-opacity=".42"/></filter>' +
    '<pattern id="lb-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">' +
    '<rect width="6" height="6" fill="#f1e8d3"/><line class="lb-hatch-line" x1="0" y1="0" x2="0" y2="6"/></pattern>' +
    "</defs>" +
    '<g class="lb-sea"><rect ' + sea + ' fill="url(#lb-sea)"/>' +
    '<rect ' + sea + ' fill="#fff" filter="url(#lb-grain)"/>' +
    '<rect ' + sea + ' fill="url(#lb-vignette)"/></g>';
  // draw order: the rest of Europe, the six featured countries (filtered as one
  // sheet of paper), their stitched seams on top so a neighbour cannot cover them
  const base = svgEl("g", { class: "lb-base" });
  const featured = svgEl("g", { class: "lb-featured", filter: "url(#lb-paper)" });
  const stitches = svgEl("g", { class: "lb-stitches" });
  paths = {};
  for (const code of Object.keys(map.countries)) {
    const d = map.countries[code].d;
    const p = svgEl("path", { d, class: "lb-country", "fill-rule": "evenodd" });
    p.dataset.code = code;
    if (COUNTRIES[code]) {
      p.appendChild(svgEl("title"));
      featured.appendChild(p);
      stitches.appendChild(svgEl("path", { d, class: "lb-stitch", "fill-rule": "evenodd" }));
    } else {
      base.appendChild(p);
    }
    paths[code] = p;
  }
  svg.appendChild(base);
  svg.appendChild(featured);
  svg.appendChild(stitches);
  leaders = svgEl("g", { class: "lb-leaders" });
  svg.appendChild(leaders);
  labels = svgEl("g", { class: "lb-labels", "aria-hidden": "true" });
  svg.appendChild(labels);
  host.innerHTML = "";
  host.appendChild(svg);

  svg.addEventListener("mousemove", (e) => {
    if (pinned) return;
    const code = e.target.dataset && e.target.dataset.code;
    if (code && entry(code)) showTip(code, e); else hideTip();
  });
  svg.addEventListener("mouseleave", () => { if (!pinned) hideTip(); });
  svg.addEventListener("click", (e) => {
    const code = e.target.dataset && e.target.dataset.code;
    if (code && entry(code) && pinned !== code) {
      pinned = code;
      showTip(code, e);
    } else {
      pinned = null;
      hideTip();
    }
  });
}

function showTip(code, e) {
  const tip = $("lb-tip");
  const c = entry(code);
  const card = tip.parentElement.getBoundingClientRect();
  tip.innerHTML =
    '<div class="lb-tip-head"><span class="lb-tip-name"></span><span class="lb-tip-rank"></span></div>' +
    "<dl></dl>" +
    '<div class="lb-tip-src"></div>';
  const head = tip.querySelector(".lb-tip-head");
  head.insertBefore(flagEl(code), head.firstChild);
  tip.querySelector(".lb-tip-name").textContent = countryName(code);
  tip.querySelector(".lb-tip-rank").textContent = c.rank ? t("tipRank", { n: c.rank })
    : (c.observed ? t("tipUnranked") : t("noDataNote"));
  const rows = [[t("tipPunctual"), pct(c.punctuality)], [t("tipAvg"), mins(c.avgDelay)],
    [t("tipCancelled"), pct(c.cancelled)], [t("tipStops"), NF.format(c.stops)]];
  const total = current().days;
  if (c.days < total) rows.push([t("tipDays"), c.days + "/" + total]);
  const dl = tip.querySelector("dl");
  dl.innerHTML = "";
  rows.forEach(([k, v]) => {
    const dt = document.createElement("dt"), dd = document.createElement("dd");
    dt.textContent = k;
    dd.textContent = v;
    dl.appendChild(dt);
    dl.appendChild(dd);
  });
  tip.querySelector(".lb-tip-src").textContent = t("tipSource", { src: COUNTRIES[code].src });
  tip.classList.remove("hidden");
  let x = e.clientX - card.left + 14, y = e.clientY - card.top + 14;
  if (x + tip.offsetWidth > card.width - 8) x = e.clientX - card.left - tip.offsetWidth - 14;
  if (y + tip.offsetHeight > card.height - 8) y = e.clientY - card.top - tip.offsetHeight - 14;
  tip.style.left = Math.max(4, x) + "px";
  tip.style.top = Math.max(4, y) + "px";
  Object.values(paths).forEach((p) => p.classList.toggle("active", p.dataset.code === code));
}

function hideTip() {
  $("lb-tip").classList.add("hidden");
  Object.values(paths).forEach((p) => p.classList.remove("active"));
}

function addLabel(code, c, cx, cy) {
  const pos = LABELS[code] || { x: cx - 40, y: cy + 26 };
  if (pos.lead) {
    leaders.appendChild(svgEl("path", { class: "lb-leader", d: "M" + cx + " " + cy + "L" + pos.lead[0] + " " + pos.lead[1] }));
    leaders.appendChild(svgEl("circle", { class: "lb-leader-dot", cx, cy, r: 3.5 }));
  }
  const g = svgEl("g", { class: "lb-label lb-label-" + code + (c.rank ? "" : " unranked") });
  const name = svgEl("text", { class: "lb-label-name", x: pos.x, y: pos.y });
  name.textContent = countryName(code).toUpperCase();
  g.appendChild(name);
  let vx = pos.x - 1;
  if (c.rank) {
    const badge = svgEl("g", { class: "lb-rank" });
    badge.appendChild(svgEl("circle", { cx: pos.x + 11, cy: pos.y + 23, r: 11 }));
    const n = svgEl("text", { x: pos.x + 11, y: pos.y + 23 });
    n.textContent = c.rank;
    badge.appendChild(n);
    g.appendChild(badge);
    vx = pos.x + 27;
  }
  const value = svgEl("text", { class: "lb-label-value", x: vx, y: pos.y + 35 });
  value.textContent = c.punctuality == null ? "–" : pct(c.punctuality);
  g.appendChild(value);
  if (!c.rank) {
    const note = svgEl("text", { class: "lb-label-note", x: pos.x, y: pos.y + 50 });
    note.textContent = c.observed ? t("tipUnranked") : t("noDataNote");
    g.appendChild(note);
  }
  labels.appendChild(g);
}

function renderMap() {
  if (!svg) return;
  const map = window.EUROPE_MAP;
  const cur = current();
  const byCode = {};
  cur.countries.forEach((c) => { byCode[c.code] = c; });
  leaders.innerHTML = "";
  labels.innerHTML = "";
  for (const code of Object.keys(paths)) {
    const p = paths[code];
    const c = byCode[code];
    p.classList.toggle("has-data", !!c);
    p.classList.toggle("thin", !!c && c.rank == null);
    p.classList.toggle("winner", !!c && c.rank === 1);
    const title = p.querySelector("title");
    if (c) {
      p.style.fill = c.rank == null ? "" : rampColor(100 - c.punctuality);
      if (title) {
        title.textContent = countryName(code) + " – " +
          (c.rank ? t("tipRank", { n: c.rank }) : (c.observed ? t("tipUnranked") : t("noDataNote"))) + ": " +
          pct(c.punctuality) + " " + t("tipPunctual") + ", " + mins(c.avgDelay) + " " + t("tipAvg");
      }
      addLabel(code, c, map.countries[code].c[0], map.countries[code].c[1]);
    } else {
      p.style.fill = "";
      if (title) title.textContent = countryName(code);
    }
  }
  if (pinned) { pinned = null; hideTip(); }
}

/* ---------- hero ---------- */
function renderRange() {
  const cur = current();
  const el = $("lb-range");
  if (!cur.from) { el.textContent = ""; return; }
  if (period === "day") {
    el.textContent = fmtDay(cur.to, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  } else {
    el.textContent = fmtDay(cur.from, { day: "numeric", month: "long" }) + " – " +
      fmtDay(cur.to, { day: "numeric", month: "long", year: "numeric" });
  }
}

function renderAsOf() {
  const el = $("lb-asof");
  el.textContent = data.asOf
    ? t("asOf", { date: fmtDay(data.asOf, { day: "numeric", month: "long", year: "numeric" }) })
    : "";
}

/* ---------- podium ---------- */
function countUp(el, value, format) {
  if (REDUCED_MOTION) { el.textContent = format(value); return; }
  const start = performance.now(), dur = 900;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = format(value * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderPodium() {
  const ol = $("lb-podium");
  ol.innerHTML = "";
  const cur = current();
  const top = cur.countries.filter((c) => c.rank && c.rank <= 3);
  if (!top.length) {
    if (cur.countries.length) {
      const li = document.createElement("li");
      li.className = "lb-podium-empty";
      li.textContent = t("winnerNone");
      ol.appendChild(li);
    }
    return;
  }
  for (const c of top) {
    const li = document.createElement("li");
    li.className = "lb-step p" + c.rank;
    if (c.rank === 1) {
      const tr = document.createElement("div");
      tr.className = "lb-step-trophy";
      tr.setAttribute("aria-hidden", "true");
      tr.textContent = "🏆";
      li.appendChild(tr);
    }
    const add = (cls, text) => {
      const d = document.createElement("div");
      d.className = cls;
      d.textContent = text;
      li.appendChild(d);
      return d;
    };
    add("lb-step-flag", flag(c.code)).setAttribute("aria-hidden", "true");
    add("lb-step-name", countryName(c.code));
    countUp(add("lb-step-value", ""), c.punctuality, pct);
    add("lb-step-sub", t("podiumSub", { delay: mins(c.avgDelay), cancelled: pct(c.cancelled) }));
    add("lb-step-base", String(c.rank)).setAttribute("aria-label", t("rankLabel") + " " + c.rank);
    ol.appendChild(li);
  }
}

/* ---------- table ---------- */
function sparkline(code, view, cur) {
  const series = (view.series[code] || []).filter((d) => d.punctuality != null);
  if (series.length < 2) return null;
  const W = 100, H = 28, PAD = 3;
  const vals = series.map((d) => d.punctuality);
  const lo = Math.min(...vals) - 0.5, hi = Math.max(...vals) + 0.5;
  const x = (i) => PAD + (i / (series.length - 1)) * (W - 2 * PAD);
  const y = (v) => H - PAD - ((v - lo) / (hi - lo)) * (H - 2 * PAD);
  const s = svgEl("svg", { class: "lb-spark", viewBox: "0 0 " + W + " " + H, width: W, height: H });
  const title = svgEl("title");
  title.textContent = t("sparkTitle", { min: pct(Math.min(...vals)), max: pct(Math.max(...vals)) });
  s.appendChild(title);
  const from = series.findIndex((d) => d.day >= cur.from);
  if (from >= 0 && period !== "month") {
    s.appendChild(svgEl("rect", {
      class: "lb-spark-window", x: x(from) - 2, y: 0, width: x(series.length - 1) - x(from) + 4, height: H, rx: 2,
    }));
  }
  s.appendChild(svgEl("polyline", {
    class: "lb-spark-line", points: series.map((d, i) => x(i).toFixed(1) + "," + y(d.punctuality).toFixed(1)).join(" "),
  }));
  const last = series[series.length - 1];
  s.appendChild(svgEl("circle", { class: "lb-spark-dot", cx: x(series.length - 1), cy: y(last.punctuality), r: 2.5 }));
  return s;
}

/* the ranked countries in the chosen order, each with its position under
   that column's best-first ordering (the official rank for the default sort);
   countries without a rank always trail in their API order */
function sortedRows(countries, sort) {
  const ranked = countries.filter((c) => c.rank);
  const unranked = countries.filter((c) => !c.rank);
  const key = sort.key;
  const best = SORT_DEFAULT[key] === "asc" ? 1 : -1;
  const val = (c) => (c[key] == null ? Infinity * best : c[key]);
  ranked.sort((a, b) => (val(a) - val(b)) * best || a.rank - b.rank);
  const rows = ranked.map((c, i) => ({ c, pos: i + 1 }));
  if (sort.dir !== SORT_DEFAULT[key]) rows.reverse();
  return rows.concat(unranked.map((c) => ({ c, pos: null })));
}

function renderSortHeaders(tbl) {
  const sort = tbl.sort;
  tbl.section.querySelectorAll(".lb-sort").forEach((b) => {
    const active = b.dataset.sort === sort.key;
    b.classList.toggle("active", active);
    b.classList.toggle("asc", active && sort.dir === "asc");
    b.closest("th").setAttribute("aria-sort", active ? (sort.dir === "asc" ? "ascending" : "descending") : "none");
  });
}

function setSort(tbl, key) {
  const sort = tbl.sort;
  tbl.sort = { key, dir: sort.key === key ? (sort.dir === "asc" ? "desc" : "asc") : SORT_DEFAULT[key] };
  if (window.umami) window.umami.track("leaderboard-sort", { key, dir: tbl.sort.dir, table: tbl.name });
  if (data) renderTable(tbl);
}

function renderTable(tbl) {
  const tbody = $(tbl.rows);
  tbody.innerHTML = "";
  const view = tbl.view();
  const cur = view && view.periods ? view.periods[period] : null;
  $(tbl.status).textContent = cur && cur.countries.length ? "" : t("noData");
  renderSortHeaders(tbl);
  if (!cur) return;
  for (const { c, pos } of sortedRows(cur.countries, tbl.sort)) {
    const tr = document.createElement("tr");
    tr.className = c.rank ? "r" + c.rank : "unranked";
    const td = (cls) => { const d = document.createElement("td"); if (cls) d.className = cls; tr.appendChild(d); return d; };
    const rankTd = td("lb-rank");
    if (pos) rankTd.appendChild(rankBadge(pos)); else rankTd.textContent = "–";

    const cell = document.createElement("span");
    cell.className = "lb-country-cell";
    cell.appendChild(flagEl(c.code));
    cell.appendChild(document.createTextNode(countryName(c.code)));
    const nameTd = td();
    nameTd.appendChild(cell);
    // honest coverage, like the "n/7 Tage" badges on the search page: say when a
    // country's source was silent for the whole period or part of it
    let note = null;
    if (!c.observed) note = t("noDataNote");
    else if (!c.rank) note = t("thinNote", { n: NF.format(c.observed), min: NF.format(cur.minStops) });
    else if (c.days < cur.days) note = t("partialNote", { n: c.days, total: cur.days });
    if (note) {
      const div = document.createElement("div");
      div.className = "lb-thin-note";
      div.textContent = note;
      nameTd.appendChild(div);
    }

    const meter = document.createElement("div");
    meter.className = "lb-meter";
    const track = document.createElement("div");
    track.className = "lb-meter-track";
    const fill = document.createElement("div");
    fill.className = "lb-meter-fill";
    fill.style.width = "0%";
    if (c.punctuality != null) fill.style.background = meterColor(c.punctuality, tbl.meterFloor);
    track.appendChild(fill);
    const val = document.createElement("span");
    val.className = "lb-meter-value";
    val.textContent = pct(c.punctuality);
    meter.appendChild(track);
    meter.appendChild(val);
    td().appendChild(meter);
    requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = (c.punctuality || 0) + "%"; }));

    td("lb-num").textContent = mins(c.avgDelay);
    td("lb-num").textContent = pct(c.cancelled);
    td("lb-num lb-stops").textContent = NF.format(c.stops);
    const spark = sparkline(c.code, view, cur);
    const trendTd = td("lb-trend");
    if (spark) trendTd.appendChild(spark);
    tbody.appendChild(tr);
  }
}

/* ---------- glue ---------- */
function renderAll() {
  renderRange();
  renderMap();
  renderPodium();
  TABLES.forEach(renderTable);
  renderAsOf();
}

function setPeriod(next, fromUser) {
  period = next;
  document.querySelectorAll(".lb-period").forEach((b) => {
    b.classList.toggle("active", b.dataset.period === next);
    b.setAttribute("aria-pressed", b.dataset.period === next ? "true" : "false");
  });
  if (fromUser) {
    const url = new URL(location.href);
    if (next === "month") url.searchParams.delete("period"); else url.searchParams.set("period", next);
    history.replaceState(null, "", url);
    if (window.umami) window.umami.track("leaderboard-period", { period: next });
  }
  if (data) renderAll();
}

function toast(text) {
  const el = document.createElement("div");
  el.className = "lb-toast";
  el.setAttribute("role", "status");
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

let loading = false;
async function load(initial) {
  if (loading) return;
  loading = true;
  try {
    const r = await fetch("/api/leaderboard", { cache: initial ? "default" : "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const next = await r.json();
    const changed = !data || next.asOf !== data.asOf;
    if (!changed) return;
    data = next;
    renderAll();
    if (!initial) toast(t("updated"));
  } catch (e) {
    if (!data) $("lb-status").textContent = t("loadError");
  } finally {
    loading = false;
  }
}

/* ---------- account ----------
   The header's account corner, the same on every page: the name of the
   signed-in account - a link to its trips - or the link to sign in, which
   brings the visitor back here. The SDK is imported only when the login page
   left its "account" hint behind, so the anonymous majority never downloads
   it; the request box below shares the lookup. */
const SELF = LANG === "en" ? "/leaderboard" : "/rangliste";
const TRIPS = LANG === "en" ? "/en/my-trips" : "/meine-fahrten";
let fb = null;
let me = null;  // { user, name } once signed in, contact proven, username claimed

async function loadMe() {
  let hinted = false;
  try { hinted = localStorage.getItem("account") === "1"; } catch (e) {}
  if (!hinted) return;
  try {
    fb = await import("/firebase.js?v=2");
    if (fb.auth) {
      await fb.auth.authStateReady();
      const user = fb.auth.currentUser;
      if (user) {
        const who = await fb.identity(user);
        if (who.verified && who.name) me = { user, name: who.name };
      }
    }
    if (!me) fb.remember(false);
  } catch (e) {
    me = null;
  }
}

function renderAuth() {
  $("auth-login").classList.toggle("hidden", !!me);
  $("auth-user").classList.toggle("hidden", !me);
  $("auth-name-text").textContent = me ? me.name : "";
}

(function initHeaderAccount() {
  $("auth-login").href = "/login?next=" + encodeURIComponent(SELF);
  const nameEl = $("auth-name");
  nameEl.href = TRIPS;
  nameEl.title = t("navTrips");
  nameEl.setAttribute("aria-label", t("navTrips"));
  $("trips-nav").href = TRIPS;
  $("trips-nav").addEventListener("click", () => {
    if (window.umami) window.umami.track("trips-nav");
  });
  $("auth-logout").addEventListener("click", async () => {
    try {
      await fb.signOut(fb.auth);
    } catch (e) { /* the SDK may still hold the user; the reload sorts it out */ }
    fb.remember(false);
    location.reload();
  });
})();

const meReady = loadMe().then(renderAuth);

/* ---------- data / analysis requests ----------
   The foot of the page asks for more data or analysis. A request goes to the
   same /api/feedback endpoint as the thumbs on the other pages, as a "request"
   vote under the leaderboard context - but only from a signed-in account: the
   server wants a bearer. Everyone sees the text box; a visitor without an
   account gets a quiet line with a login link on Send, no redirect, and the
   typed text is parked in sessionStorage so it is back in the box when the
   login returns here. Unlike the thumbs, a failure
   is shown - the visitor typed something and deserves to know whether it
   arrived. */
(function initRequests() {
  const box = $("lb-request");
  const lead = $("lb-request-lead");
  const form = $("lb-request-form");
  const input = $("lb-request-text");
  const send = form.querySelector(".lb-request-send");
  const note = $("lb-request-note");
  const LOGIN = "/login?next=" + encodeURIComponent(SELF + "#lb-request") + "&reason=request";
  const PARKED = "lb-request-draft";

  $("lb-request-login").href = LOGIN;
  function say(key) { lead.dataset.i18n = key; lead.textContent = t(key); }

  // no account: a quiet line with the way to the login, the text stays in
  // the box and is parked so it survives the round trip
  function askLogin(text) {
    try { sessionStorage.setItem(PARKED, text); } catch (e) { /* the text is lost, the login still works */ }
    if (window.umami) window.umami.track("leaderboard-request-login", { lang: LANG });
    note.classList.remove("hidden");
  }
  // keep the parked copy current while the visitor edits after the nudge
  input.addEventListener("input", () => {
    if (note.classList.contains("hidden")) return;
    try { sessionStorage.setItem(PARKED, input.value); } catch (e) {}
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) form.requestSubmit();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || send.disabled) return;
    if (!me) { askLogin(text); return; }
    send.disabled = true;
    send.textContent = t("requestSending");
    const sid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let status = 0;
    try {
      const token = await me.user.getIdToken();
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ sid, vote: "request", text, lang: LANG, context: "leaderboard" }),
      });
      status = r.status;
    } catch (err) { /* status stays 0: shown as an error below */ }
    if (status === 204) {
      try { sessionStorage.removeItem(PARKED); } catch (e) {}
      if (window.umami) window.umami.track("leaderboard-request", { lang: LANG });
      say("requestThanks");
      form.classList.add("hidden");
      box.classList.add("lb-request-done");
    } else if (status === 429) {
      say("requestTooMany");
      form.classList.add("hidden");
      box.classList.add("lb-request-done");
    } else if (status === 401 || status === 403) {
      // signed out after all, or a step short: the login page knows which
      askLogin(text);
    } else {
      say("requestError");
      box.classList.add("lb-request-failed");
      send.disabled = false;
      send.textContent = t("requestSend");
    }
  });

  // back from the login: the parked text returns to the box, ready to send
  let parked = "";
  try { parked = sessionStorage.getItem(PARKED) || ""; } catch (e) {}
  if (parked && !input.value) input.value = parked;
  meReady.then(() => {
    if (location.hash === "#lb-request") input.focus({ preventScroll: true });
  });
})();

applyI18n();
buildMap();
setPeriod(period, false);
document.querySelectorAll(".lb-period").forEach((b) => {
  b.addEventListener("click", () => setPeriod(b.dataset.period, true));
});
TABLES.forEach((tbl) => {
  tbl.section.querySelectorAll(".lb-sort").forEach((b) => {
    b.addEventListener("click", () => setSort(tbl, b.dataset.sort));
  });
});
load(true);
// a page left open: poll while visible, and once more when the tab comes back
setInterval(() => { if (!document.hidden) load(false); }, REFRESH_MS);
document.addEventListener("visibilitychange", () => { if (!document.hidden) load(false); });

})();
