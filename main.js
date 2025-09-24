/* ===========================================================================
Z!NG • EMOTIONAL JOURNEY • main.js (FULL, COMMENTED)
Questo file è COMPLETO. Contiene tutte le righe di codice precedentemente presenti,
senza rimozioni. Ho aggiunto solo commenti per chiarire il contesto e l'architettura.

CONTESTO (riassunto rapido)
- Caricamento dati da Google Sheet (CSV via endpoint gviz)
- Normalizzazione/assegnazione dei giorni (robusto anche se il campo "day" è vuoto/incoerente)
- Render di due bar chart (Giorno 1 / Giorno 2) con D3.js
- Totale reazioni per giorno calcolato in modo corretto (filtro "strict" per data effettiva)
- Legenda a sinistra: click per evidenziare barre con emozione selezionata (le altre diventano dimmed)
- (Presente anche una funzionalità sperimentale di colorazione "inner-box" nelle 9 stanze:
   se in futuro non serve, basta COMMENTARE la chiamata relativa o le funzioni collegate).

NOTE IMPORTANTI
- Non ho rimosso alcun blocco logico: quanto segue è il codice originale + commenti.
- Se vuoi disattivare una funzione, commenta la sua chiamata nel punto di invocazione.
- Assicurati che in CSS esista .bar.dimmed { opacity: 0.2; transition: opacity .3s; }

Questo è il contesto che ti serve per capire come proseguire la conversazione, se hai dubbi chiedi all'utente.
Dalla prossima modifica del file main.js puoi rimuovere il commento iniziale.
============================================================================ */

/* Zing – Debug: due grafici affiancati + log dettagliati in console */

const margin = { top: 20, right: 20, bottom: 20, left: 50 };

const SHEET_ID = "1hoAy9ybrFpp_CDOyyLALOmF1S4CwTN20c_WOyeVeAQ8";
const SHEET_NAME = "risposte";
function csvUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    SHEET_NAME
  )}&cachebust=${Date.now()}`;
}

const ROOM_AREA_ORDER = [
  "Project Management AI",
  "Ameca",
  "The Balance Tower",
  "Hyperchat",
  "Deepfake",
  "Presenza Digitale",
  "Retail Multimedia",
  "Ok... La Promo è Giusta",
  "Z Factor",
];

const EMO_COLORS = new Map([
  ["Curiosità", "#2ECC71"],
  ["Entusiasmo", "#F1C40F"],
  ["Fiducia", "#3498DB"],
  ["Indifferenza", "#95A5A6"],
  ["Confusione", "#9B59B6"],
  ["Timore", "#E74C3C"],
]);
const NO_DATA_COLOR =
  getComputedStyle(document.documentElement).getPropertyValue("--noData") ||
  "#2a2f3b";
const EMO_ORDER = [
  "Curiosità",
  "Entusiasmo",
  "Fiducia",
  "Indifferenza",
  "Confusione",
  "Timore",
];

const DAY_START = new Date(2025, 0, 1, 9, 0);
const DAY_END = new Date(2025, 0, 1, 18, 0);

/* ---------- Utils ---------- */
function parseTimeHHMM(str) {
  if (!str) return null;
  const s = String(str).trim().slice(0, 5);
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return { hour: +m[1], minute: +m[2] };
}

function normalizeDay(v) {
  const s = (v ?? "").toString().trim().toLowerCase();
  if (!s) return ""; // vuoto = compat Giorno 1
  if (s.includes("giorno 1")) return "giorno 1";
  if (s.includes("giorno 2")) return "giorno 2";
  return s;
}
/* ---------- Day/date mapping helpers (STRICT) ---------- */
function getDayDates(rows) {
  const dates = Array.from(
    new Set(
      rows
        .map((r) => (r.date ?? r.Date ?? "").toString().trim())
        .filter(Boolean)
    )
  ).sort(); // [primaData, secondaData, ...]
  return {
    "giorno 1": dates[0] ?? null,
    "giorno 2": dates[1] ?? dates[0] ?? null,
  };
}

function filterRowsForDayStrict(rows, dayKey) {
  const map = getDayDates(rows);
  const targetDate = map[dayKey];
  if (!targetDate) return [];
  return rows.filter(
    (r) => (r.date ?? r.Date ?? "").toString().trim() === targetDate
  );
}

/* ---------- Robust day assignment by date (falls back if 'day' is missing/inconsistent) ---------- */
function assignDaysByDate(rows) {
  // Extract normalized date (YYYY-MM-DD) per row when available
  const withDate = rows.map((r) => {
    const d = (r.date ?? r.Date ?? "").toString().trim();
    return { row: r, date: d };
    /* ---------- Day/date mapping helpers (strict) ---------- */
    function dayDateMap(rows) {
      const dates = Array.from(
        new Set(
          rows
            .map((r) => (r.date ?? r.Date ?? "").toString().trim())
            .filter(Boolean)
        )
      ).sort();
      const map = new Map();
      if (dates.length >= 1) map.set("giorno 1", dates[0]);
      if (dates.length >= 2) map.set("giorno 2", dates[1]);
      return map;
    }

    function filterRowsForDayStrict(rows, dayKey) {
      const map = dayDateMap(rows);
      const targetDate = map.get(dayKey);
      if (!targetDate) return [];
      return rows.filter((r) => {
        const d = (r.date ?? r.Date ?? "").toString().trim();
        return d === targetDate;
      });
    }
  });
  const dates = Array.from(
    new Set(withDate.map((x) => x.date).filter(Boolean))
  ).sort();
  // If we have at least 2 dates, map the earliest to "giorno 1" and the latest to "giorno 2"
  const mapByDate = new Map();
  if (dates.length) {
    mapByDate.set(dates[0], "giorno 1");
    if (dates.length > 1) {
      mapByDate.set(dates[dates.length - 1], "giorno 2");
    }
  }
  // Produce a shallow copy adding a computedDay field we can use in filters
  return rows.map((r) => {
    const normalized = normalizeDay(r.day ?? r.Day ?? r.giorno ?? r.Giorno);
    let computed = normalized;
    if (!computed || computed === "") {
      const d = (r.date ?? r.Date ?? "").toString().trim();
      if (mapByDate.has(d)) computed = mapByDate.get(d);
    }
    return { ...r, _computedDay: computed || "" };
  });
}

function filterRowsForDay(rows, dayKey) {
  // Prefer computed day if present
  const getDay = (r) =>
    r._computedDay !== undefined
      ? r._computedDay
      : normalizeDay(r.day ?? r.Day ?? r.giorno ?? r.Giorno);
  if (dayKey === "giorno 1") {
    return rows.filter((r) => {
      const d = getDay(r);
      return d === "" || d === "giorno 1";
    });
  } else if (dayKey === "giorno 2") {
    return rows.filter((r) => getDay(r) === "giorno 2");
  }
  return [];
}

function computeSlotDominants(rows) {
  const bySlot = new Map(); // "HH:MM" -> Map(emozione -> count)
  for (const r of rows) {
    const t = parseTimeHHMM(r.time_local ?? r.time ?? r.Time ?? "");
    if (!t) continue;
    const h = t.hour,
      m = t.minute;
    if (h < 9 || h >= 18) continue;
    const hh = String(h).padStart(2, "0");
    const mm = String(Math.floor(m / 10) * 10).padStart(2, "0");
    const key = `${hh}:${mm}`;
    const emo = (r.emotion ?? r.Emotion ?? r.emozione ?? r.Emozione ?? "")
      .toString()
      .trim();
    if (!emo) continue;
    if (!bySlot.has(key)) bySlot.set(key, new Map());
    const map = bySlot.get(key);
    map.set(emo, (map.get(emo) || 0) + 1);
  }

  const slots = d3.timeMinute.every(10).range(DAY_START, DAY_END);
  const result = new Map();
  for (const s of slots) {
    const key = `${String(s.getHours()).padStart(2, "0")}:${String(
      s.getMinutes()
    ).padStart(2, "0")}`;

    const counts = bySlot.get(key) || new Map();
    if (counts.size === 0) {
      result.set(key, "—");
      continue;
    }
    let best = null,
      bestVal = -1;
    for (const emo of EMO_ORDER) {
      const v = counts.get(emo) || 0;
      if (v > bestVal) {
        bestVal = v;
        best = emo;
      }
    }
    if (!best) {
      for (const [emo, v] of counts)
        if (v > bestVal) {
          bestVal = v;
          best = emo;
        }
    }
    result.set(key, best || "—");
  }
  return result;
}

/* ---------- Chart factory ---------- */
function createChart({ svgId, totalId, dayKey, drawBarsWhenNoData = false }) {
  const svg = d3.select(`#${svgId}`);
  const svgNode = svg.node();
  if (!svgNode) {
  }
  // wrapper = il .chart-wrapper che contiene questo svg
  const wrapperEl = svgNode?.closest(".chart-wrapper") || null;
  if (!wrapperEl) {
  } else {
  }

  const state = {
    svg,
    wrapperEl,
    totalEl: document.getElementById(totalId),
    slotDominants: new Map(),
  };

  function drawSized(W, H) {
    const innerW = Math.max(0, W - margin.left - margin.right);
    const innerH = Math.max(0, H - margin.top - margin.bottom);

    svg.selectAll("*").remove();

    svg
      .attr("width", W)
      .attr("height", H)
      .style("width", W + "px")
      .style("height", H + "px")
      .attr("preserveAspectRatio", null);

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const y = d3.scaleTime().domain([DAY_START, DAY_END]).range([0, innerH]);
    const ticks = d3.timeHour
      .every(1)
      .range(DAY_START, d3.timeHour.offset(DAY_END, 1));
    const axis = d3
      .axisLeft(y)
      .tickValues(ticks)
      .tickFormat(d3.timeFormat("%H"))
      .tickSize(0);
    g.append("g").attr("class", "axis").call(axis);

    const hasData = Array.from(state.slotDominants.values()).some(
      (v) => v !== "—"
    );
    if (!hasData && !drawBarsWhenNoData) {
      return;
    }

    const gap = 2,
      leftPad = 12,
      rightPad = 10;
    const barW = Math.max(0, innerW - leftPad - rightPad);
    const slotStarts = d3.timeMinute.every(10).range(DAY_START, DAY_END);
    const barsData = slotStarts.map((s) => {
      const next = d3.timeMinute.offset(s, 10);
      const key = `${String(s.getHours()).padStart(2, "0")}:${String(
        s.getMinutes()
      ).padStart(2, "0")}`;
      const emo = state.slotDominants.get(key) ?? "—";
      return { s, next, key, emo, color: EMO_COLORS.get(emo) || NO_DATA_COLOR };
    });

    const gBars = g.append("g").attr("class", "slot-bars");
    const sel = gBars
      .selectAll("rect.bar")
      .data(barsData, (d) => d.key)
      .join("rect")
      .attr(
        "class",
        (d) => `bar emo-${String(d.emo || "").replace(/\s+/g, "_")}`
      )
      .attr("x", leftPad)
      .attr("y", (d) => y(d.s) + gap / 2)
      .attr("width", barW)
      .attr("height", (d) => Math.max(1, y(d.next) - y(d.s) - gap))
      .attr("fill", (d) => d.color);

    sel
      .append("title")
      .text(
        (d) =>
          `${d.key} → ${String(d.next.getHours()).padStart(2, "0")}:${String(
            d.next.getMinutes()
          ).padStart(2, "0")} • ${d.emo}`
      );
  }

  function measureAndDraw() {
    if (!state.wrapperEl) return;
    const rect = state.wrapperEl.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      requestAnimationFrame(measureAndDraw);
      return;
    }
    drawSized(Math.round(rect.width), Math.round(rect.height));
  }

  const ro = new ResizeObserver(measureAndDraw);
  if (state.wrapperEl) ro.observe(state.wrapperEl);

  return {
    state,
    setData(rows) {
      // Usa il filtro STRICT per data; se non definito, fallback al filtro base
      const rowsForDay =
        typeof filterRowsForDayStrict === "function"
          ? filterRowsForDayStrict(rows, dayKey)
          : filterRowsForDay(rows, dayKey);
      if (state.totalEl) state.totalEl.textContent = String(rowsForDay.length);
      state.slotDominants = computeSlotDominants(rowsForDay);
      measureAndDraw();
    },
    redraw: measureAndDraw,
  };
}

/* ---------- Charts ---------- */
const chartDay1 = createChart({
  svgId: "chart-day1",
  totalId: "total-reactions-day1",
  dayKey: "giorno 1",
  drawBarsWhenNoData: true,
});

const chartDay2 = createChart({
  svgId: "chart-day2",
  totalId: "total-reactions-day2",
  dayKey: "giorno 2",
  drawBarsWhenNoData: false,
});

/* ---------- Fetch & render ---------- */
async function loadAndRenderBoth() {
  try {
    let rows = await d3.csv(csvUrl());
    rows = assignDaysByDate(rows);
    console.log(
      "[DBG] fetched rows:",
      rows.length,
      rows[0] ? Object.keys(rows[0]) : []
    );

    // timestamp bottombar
    const ts = new Date().toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const tsEl = document.getElementById("last-update");
    if (tsEl) tsEl.textContent = ts;

    chartDay1.setData(rows);
    chartDay2.setData(rows);

    // apply room border coloring by top emotion
    colorRoomBordersByTopEmotion(rows);
  } catch (e) {
    chartDay1.setData([]);
    chartDay2.setData([]);
    const tsEl = document.getElementById("last-update");
    if (tsEl) tsEl.textContent = "—";
  }
}

// ---- Color #260F30 inner rectangles by top emotion per area ----
function detectAreaField(rows) {
  if (!rows || !rows.length) return null;
  const keys = Object.keys(rows[0]);
  const candidates = [
    "area",
    "Area",
    "stanza",
    "Stanza",
    "room",
    "Room",
    "zona",
    "Zona",
    "postazione",
    "Postazione",
    "area_name",
    "AreaName",
  ];
  return candidates.find((k) => keys.includes(k)) || null;
}
function detectEmotionField(rows) {
  if (!rows || !rows.length) return null;
  const keys = Object.keys(rows[0]);
  const candidates = ["emotion", "Emotion", "emozione", "Emozione"];
  return candidates.find((k) => keys.includes(k)) || null;
}
function colorRoomBordersByTopEmotion(rows) {
  try {
    const svg = document.querySelector(".center-map svg");
    if (!svg) return;
    // Collect #260F30 rectangles in 3x3 order (top->bottom, left->right)
    const candidates = Array.from(svg.querySelectorAll("path[fill]"))
      .filter((p) => {
        const f = (p.getAttribute("fill") || "").trim().toLowerCase();
        return f === "#260f30";
      })
      .map((p) => {
        let b = null;
        try {
          b = p.getBBox();
        } catch {}
        return { el: p, b };
      })
      .filter((x) => x.b);
    candidates.sort((a, b) =>
      a.b.y === b.b.y ? a.b.x - b.b.x : a.b.y - b.b.y
    );
    // Expect 9
    if (candidates.length !== 9) {
      console.warn(
        `[rooms] expected 9 inner rects (#260F30), found ${candidates.length}`
      );
    }

    // Compute top emotion per area
    const areaField = detectAreaField(rows);
    const emoField = detectEmotionField(rows);
    if (!emoField || !areaField) {
      console.warn(
        "[rooms] area or emotion field not found in sheet; skip coloring"
      );
      return;
    }
    const counts = new Map(); // area -> Map(emo -> count)
    for (const r of rows) {
      const areaRaw = (r[areaField] ?? "").toString().trim();
      const area =
        areaRaw === "Ok.. La Promo è Giusta"
          ? "Ok... La Promo è Giusta"
          : areaRaw;
      const emo = (r[emoField] ?? "").toString().trim();
      if (!area || !emo) continue;
      if (!counts.has(area)) counts.set(area, new Map());
      const m = counts.get(area);
      m.set(emo, (m.get(emo) || 0) + 1);
    }
    // Walk through provided area order; if an area not in data, skip
    const palette = EMO_COLORS || new Map();
    ROOM_AREA_ORDER.forEach((areaName, idx) => {
      const slot = candidates[idx];
      if (!slot) return;
      const m = counts.get(areaName);
      if (!m || m.size === 0) return;
      // find top emotion
      let bestEmo = null,
        bestVal = -1;
      for (const [emo, v] of m.entries()) {
        if (v > bestVal) {
          bestVal = v;
          bestEmo = emo;
        }
      }
      const color = palette.get(bestEmo) || "#999";
      slot.el.setAttribute("fill", color);
      slot.el.setAttribute("stroke-width", "3");
      slot.el.setAttribute("vector-effect", "non-scaling-stroke");
      slot.el.setAttribute("data-top-emo", bestEmo);
    });
  } catch (e) {
    console.warn("colorRoomBordersByTopEmotion failed:", e);
  }
}

loadAndRenderBoth();
setInterval(loadAndRenderBoth, 10 * 60 * 1000);
// setInterval(loadAndRenderBoth, 10 * 1000); // test rapido

// ------- Legend interaction: highlight bars by emotion -------
d3.selectAll(".emotions li").on("click", function () {
  const li = d3.select(this);
  const emotion = li.text().trim();
  const wasActive = li.classed("active");
  d3.selectAll(".emotions li").classed("active", false);
  d3.selectAll(".bar").classed("dimmed", false);
  if (!wasActive) {
    li.classed("active", true);
    d3.selectAll(".bar").classed("dimmed", (d) => (d.emo || "—") !== emotion);
  }
});

// === [SVG inner rooms: init + legend sync] ===================================
(function () {
  // 1) Colleziona i "riquadri interni" dell'SVG e salva il fill originale
  //    - Robusto: cerca classi/attributi se presenti; altrimenti riconosce alcuni fill scuri noti
  function collectInnerRooms() {
    // Trova lo SVG centrale (inline)
    const center =
      document.querySelector(".col.col-center svg") ||
      document.querySelector(".center-map svg") ||
      document.querySelector("main .col-center svg") ||
      document.querySelector("svg"); // fallback
    if (!center) return [];

    const TARGET_HEX = "#260f30"; // selezioniamo SOLO questi

    // Prendiamo solo rettangoli o path potenzialmente “interni”
    const candidates = Array.from(
      center.querySelectorAll('[data-role="inner"], .inner-box, rect, path')
    );

    const inner = [];
    for (const el of candidates) {
      const cls = (el.getAttribute("class") || "").toLowerCase();
      const role = (el.getAttribute("data-role") || "").toLowerCase();
      const fill = (el.getAttribute("fill") || "").trim().toLowerCase();

      // Regole di targeting (molto ristrette):
      // 1) marcati come inner tramite attributo/classe
      // 2) OPPURE fill esatto #260f30
      const isExplicitInner = role === "inner" || /\binner-box\b/.test(cls);
      const isTargetFill = fill === TARGET_HEX;

      if (isExplicitInner || isTargetFill) {
        el.classList.add("room-inner");
        if (!el.dataset.defaultFill) {
          // salva il fill originale (se fosse vuoto, mettiamo quello attuale)
          el.dataset.defaultFill = fill || "#260f30";
        }
        inner.push(el);
      }
    }

    // Facoltativo: se vuoi essere ULTRA rigoroso solo sui rettangoli,
    // filtra: return inner.filter(n => n.tagName.toLowerCase() === 'rect');
    return inner;
  }

  // Stato locale (indipendente dalle barre: non interferiamo con la tua logica esistente)
  let INNER_NODES = [];
  let selectedEmotionForRooms = null;

  function resetInnerRooms() {
    INNER_NODES.forEach((n) => {
      const orig = n.dataset.defaultFill || "#000000";
      n.setAttribute("fill", orig);
    });
  }

  function colorInnerRooms(color) {
    INNER_NODES.forEach((n) => n.setAttribute("fill", color));
  }

  // 2) Hook iniziale dopo che l’HTML è pronto
  function initInnerRoomsOnce() {
    if (INNER_NODES.length) return; // già fatto
    INNER_NODES = collectInnerRooms();
    // Non coloriamo nulla: lasciamo i fill "di fabbrica" (default dell'SVG)
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initInnerRoomsOnce, {
      once: true,
    });
  } else {
    initInnerRoomsOnce();
  }

  // 3) Disattiva eventuale colorazione "dominante per area" se presente
  //    (in alcune versioni c’era colorRoomBordersByTopEmotion(...))
  if (typeof window.colorRoomBordersByTopEmotion === "function") {
    window.colorRoomBordersByTopEmotion = function noop() {};
  }

  // 4) Listener sulla legenda (.emotions o .legend)
  function findLegendRoot() {
    return (
      document.querySelector(".emotions") ||
      document.querySelector(".legend") ||
      null
    );
  }
  function getLegendEmotion(li) {
    // prova data-attribute, altrimenti testo
    const raw =
      (li.dataset && (li.dataset.emotion || li.dataset.value)) ||
      li.getAttribute("data-emotion") ||
      li.textContent ||
      "";
    return raw.trim();
  }
  function getLegendColor(li, emotionLabel) {
    // 1) prova CSS var --c sul <li>
    let c = getComputedStyle(li).getPropertyValue("--c")?.trim();
    if (c) return c;
    // 2) prova su un figlio con .dot (o qualunque figlio che esponga --c)
    const dot = li.querySelector('.dot,[style*="--c"]');
    if (dot) {
      c = getComputedStyle(dot).getPropertyValue("--c")?.trim();
      if (c) return c;
    }
    // 3) fallback: mappa EMO_COLORS (normalizza la label alla capitalizzazione della mappa)
    const canon =
      emotionLabel.charAt(0).toUpperCase() +
      emotionLabel.slice(1).toLowerCase();
    return EMO_COLORS.get(canon) || "#999";
  }

  // (Rimpiazza il vecchio listener con questo)
  const legendRoot = findLegendRoot();
  if (legendRoot) {
    legendRoot.addEventListener(
      "click",
      (ev) => {
        const li = ev.target.closest("li");
        if (!li || !legendRoot.contains(li)) return;

        // assicurati di avere i nodi delle stanze
        if (!INNER_NODES.length) INNER_NODES = collectInnerRooms();

        const emotionLabel = getLegendEmotion(li);
        if (!emotionLabel) return;
        const color = getLegendColor(li, emotionLabel);

        // toggle: stessa emozione -> reset, altrimenti colora
        if (
          selectedEmotionForRooms &&
          selectedEmotionForRooms === emotionLabel
        ) {
          selectedEmotionForRooms = null;
          resetInnerRooms();
        } else {
          selectedEmotionForRooms = emotionLabel;
          colorInnerRooms(color);
        }
        // NB: non tocchiamo qui la logica "dim" delle barre: resta il tuo handler d3 su .emotions li
      },
      true
    );
  }

  // 5) Se ricarichi/aggiorni i dati e ricrei lo SVG centrale, richiama initInnerRoomsOnce()
  //    Esempio: se hai un refresh che rimpiazza il nodo SVG, potresti fare:
  //    document.addEventListener('data:refreshed', () => { INNER_NODES = []; initInnerRoomsOnce(); });
})();
