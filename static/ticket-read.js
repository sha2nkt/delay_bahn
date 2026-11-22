"use strict";
/* Reading a Deutsche Bahn ticket in the browser, shared by the compensation
   check (app.js) and the claim form (claim.js). A PDF is read on the device;
   a photo is only scaled down here and read by the server on the visitor's
   say-so. The check hands the uploaded file on to the claim form through this
   browser's own database, so it is asked for once. */
window.TicketRead = (() => {

// what DB takes as an attachment; anything else is turned away at the picker
const ACCEPTED = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const MAX_FILE = 10 * 1024 * 1024;

function fileKind(file) {
  const kind = ACCEPTED[file.type];
  if (kind) return kind;
  // some systems hand over files without a type: fall back to the name
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  return { pdf: "pdf", jpg: "jpg", jpeg: "jpg", png: "png" }[ext] || null;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("script " + src));
    document.head.append(s);
  });
}

// the PDF reader is only fetched once a file is actually in play
let reader = null;
function loadPdfjs() {
  reader = reader || loadScript("/claim/pdf.min.js?v=1").then(() => {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "/claim/pdf.worker.min.js?v=1";
    return window.pdfjsLib;
  }).catch((e) => { reader = null; throw e; });
  return reader;
}

/* The text of a DB online ticket, as rows of positioned words. The journey
   table is read by its column headers, since a row has no platform when the
   leg is a bus and words alone cannot tell "14 ICE 990" from "Bus 5". */
async function pdfRows(bytes) {
  const pdfjs = await loadPdfjs();
  const doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const rows = [];
  for (let p = 1; p <= Math.min(doc.numPages, 4); p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const byY = new Map();
    for (const item of content.items) {
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push({ x: item.transform[4], text: item.str.trim() });
    }
    [...byY.entries()].sort((a, b) => b[0] - a[0]).forEach(([y, items]) => {
      items.sort((a, b) => a.x - b.x);
      rows.push({ page: p, y, items, text: items.map((i) => i.text).join(" ") });
    });
  }
  return rows;
}

const NOT_RAIL = /^(bus|str|tram|u\s?\d|u-bahn|fuß|fussweg|schiff|ast|rufbus|sev)/i;

// the rail part of one direction's table, or null when it names no train
function sectionJourney(section) {
  if (!section.cols) return null;
  const { cols } = section;
  const edge = (name, fallback) => (cols[name] != null ? cols[name] - 4 : fallback);
  const xDate = edge("Datum", 200), xTime = edge("Zeit", 270);
  const xProd = edge("Produkte", 370), xRes = edge("Reservierung", 450);
  const cell = (row, from, to) => row.items.filter((i) => i.x >= from && i.x < to).map((i) => i.text).join(" ");
  const stops = [];
  for (const row of section.rows) {
    const time = cell(row, xTime, xProd).match(/\b(ab|an)\s+(\d{1,2}:\d{2})/);
    const product = cell(row, xProd, xRes).trim();
    if (!time) continue;
    stops.push({ station: cell(row, 0, xDate).trim(), kind: time[1], time: time[2].padStart(5, "0"), product });
  }
  // a departure row and the arrival row under it make one leg; the train
  // number in brackets sits on the arrival row and belongs to the same train
  const legs = [];
  for (let i = 0; i + 1 < stops.length; i++) {
    const a = stops[i], b = stops[i + 1];
    if (a.kind !== "ab" || b.kind !== "an") continue;
    const product = [a.product, /^\(\d+\)$/.test(b.product) ? b.product : ""].join(" ").trim();
    legs.push({ from: a.station, to: b.station, dep: a.time, arr: b.time, product });
  }
  const rail = legs.filter((l) => l.product && !NOT_RAIL.test(l.product));
  if (!rail.length) return null;
  return {
    date: section.date, from: rail[0].from, to: rail[rail.length - 1].to,
    dep: rail[0].dep, arr: rail[rail.length - 1].arr,
    trains: rail.map((l) => l.product).join(", "),
  };
}

/* What the ticket says: order number, price and name, and one journey per
   direction (null for a direction whose table could not be read). */
function parseJourneys(rows) {
  const out = {};
  const all = rows.map((r) => r.text).join("\n");
  out.booking = (all.match(/Auftragsnummer:?\s*(\d{6,14})/) || [])[1] || "";
  out.price = (all.match(/Gesamtpreis:?\s*([\d.,]+)\s*€/) || [])[1] || "";

  // the traveller's name is printed right above the order number, in the same column
  const orderRow = rows.find((r) => /Auftragsnummer/.test(r.text));
  if (orderRow) {
    const anchor = orderRow.items.find((i) => /Auftragsnummer/.test(i.text));
    const above = rows.filter((r) => r.page === orderRow.page && r.y > orderRow.y)
      .filter((r) => r.items.some((i) => Math.abs(i.x - anchor.x) < 12))
      .sort((a, b) => a.y - b.y)[0];
    const name = above ? above.items.filter((i) => i.x > anchor.x - 12).map((i) => i.text).join(" ") : "";
    if (/^[\p{L} .'-]{3,60}$/u.test(name)) out.name = name;
  }

  // one table per direction, each under its own "… am 07.07.2026" heading
  const sections = [];
  let cur = null;
  for (const row of rows) {
    const head = row.text.match(/Reiseverbindung.*?am\s+(\d{2})\.(\d{2})\.(\d{4})/);
    if (head) { cur = { date: `${head[3]}-${head[2]}-${head[1]}`, cols: null, rows: [] }; sections.push(cur); continue; }
    if (!cur) continue;
    if (!cur.cols && /Halt/.test(row.text) && /Zeit/.test(row.text)) {
      cur.cols = {};
      for (const item of row.items) {
        const key = item.text.split(/\s/)[0];
        if (["Halt", "Datum", "Zeit", "Gleis", "Produkte", "Reservierung"].includes(key)) cur.cols[key] = item.x;
      }
      continue;
    }
    if (cur.cols) {
      if (/^Wichtige|^Ihre Reiseverbindung/.test(row.text)) { cur = null; continue; }
      cur.rows.push(row);
    }
  }
  out.sections = sections.map((s) => ({ date: s.date, journey: sectionJourney(s) }));
  return out;
}

// the claim form's view: the direction travelled on `wantDate`, else the first
function parseTicket(rows, wantDate) {
  const { sections, ...out } = parseJourneys(rows);
  const section = sections.find((s) => s.date === wantDate) || sections[0];
  return section && section.journey ? { ...out, ...section.journey } : out;
}

// what every DB online ticket prints somewhere on its first pages
const DB_MARK = /Deutsche Bahn|DB AG|DB Fernverkehr|DB Regio|DB Vertrieb|bahn\.de/i;
const INVOICE_MARK = /Rechnungsnummer|Dieses Dokument berechtigt nicht zur Fahrt/;

// a phone photo is several megabytes; the reader needs far less than that
async function photoDataUrl(file) {
  let source;
  if (fileKind(file) === "pdf") {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    source = document.createElement("canvas");
    source.width = viewport.width;
    source.height = viewport.height;
    await page.render({ canvasContext: source.getContext("2d"), viewport }).promise;
  } else {
    source = await createImageBitmap(file);
  }
  const scale = Math.min(1, 1800 / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * scale);
  canvas.height = Math.round(source.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/* The hand-over from the check to the claim form: the uploaded file with what
   was read from it, in the claim's own database under a key of its own. It
   never leaves the device. A flag in sessionStorage ties it to the tab it was
   uploaded in; the service worker (sweepClaimDraft in sw.js) deletes one that
   was left behind. */
const KEPT_FLAG = "claimTicket";
const KEPT_MAX_AGE = 2 * 60 * 60 * 1000;

function store(mode, work) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("delaybahn-claim", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("draft");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction("draft", mode);
      const request = work(tx.objectStore("draft"));
      tx.oncomplete = () => { db.close(); resolve(request.result); };
      tx.onerror = tx.onabort = () => { db.close(); reject(tx.error); };
    };
  });
}

// { file, fields, date, pending }: `fields` is what a photo read gave, `date` the journey searched for
async function keep(entry) {
  const at = Date.now();
  await store("readwrite", (s) => s.put({ ...entry, at }, "ticket"));
  sessionStorage.setItem(KEPT_FLAG, String(at));
}

// the ticket this tab uploaded, or null
async function kept() {
  try {
    const flag = sessionStorage.getItem(KEPT_FLAG);
    if (!flag) return null;
    const entry = await store("readonly", (s) => s.get("ticket"));
    if (!entry || String(entry.at) !== flag || Date.now() - entry.at > KEPT_MAX_AGE) return null;
    return entry;
  } catch (e) { return null; }
}

async function forget() {
  try {
    if (!sessionStorage.getItem(KEPT_FLAG)) return;
    sessionStorage.removeItem(KEPT_FLAG);
    await store("readwrite", (s) => s.delete("ticket"));
  } catch (e) { /* nothing was kept */ }
}

return {
  ACCEPTED, MAX_FILE, DB_MARK, INVOICE_MARK, KEPT_FLAG,
  fileKind, loadScript, loadPdfjs, pdfRows, parseJourneys, parseTicket, photoDataUrl, keep, kept, forget,
};
})();
