// --- Helpers for theme and colors ---
function getCssVar(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v && v.trim() ? v.trim() : null;
}
function getEmotionColor(emotionLabel) {
  try {
    // try to read from legend item
    const li = Array.from(document.querySelectorAll(".emotions li")).find(
      (n) => {
        const lab = (n.dataset.emotion || n.textContent || "")
          .toString()
          .trim();
        return lab === emotionLabel;
      }
    );
    if (li) {
      const cs = getComputedStyle(li);
      // try background-color, else color
      const bg = cs.getPropertyValue("background-color");
      const col = cs.getPropertyValue("color");
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
      if (col) return col;
    }
  } catch (e) {}
  // fallback to text color var
  return getCssVar("--text") || "#000";
}

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

//const SHEET_ID = "1hoAy9ybrFpp_CDOyyLALOmF1S4CwTN20c_WOyeVeAQ8";
const SHEET_ID = "1pDjRrWJLUwri0MbmjztUIIkhnmo6DDm0mpv5sDhFOWc";
const SHEET_NAME = "FEED";
function csvUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    SHEET_NAME
  )}&cachebust=${Date.now()}`;
}

const ROOM_AREA_ORDER = [
  "Agenti AI Back Office",
  "Synergy Map",
  "The Balance Tower",
  "Agenti AI Su Misura",
  "Deepfake",
  "Presenza Digitale",
  "Retail Multimedia",
  "Ok... La promo è giusta",
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
      const empty = !emo || emo === "—";
      return {
        s,
        next,
        key,
        emo,
        empty,
        color: empty ? null : EMO_COLORS.get(emo) || NO_DATA_COLOR,
      };
    });

    const gBars = g.append("g").attr("class", "slot-bars");
    const sel = gBars
      .selectAll("rect.bar")
      .data(barsData, (d) => d.key)
      .join("rect")
      .attr(
        "class",
        (d) =>
          `bar ${d.empty ? "empty" : ""} emo-${String(d.emo || "").replace(
            /\s+/g,
            "_"
          )}`
      )
      .attr("x", leftPad)
      .attr("y", (d) => y(d.s) + gap / 2)
      .attr("width", barW)
      .attr("height", (d) => Math.max(1, y(d.next) - y(d.s) - gap))
      .attr("fill", (d) => (d.empty ? null : d.color))
      .style("fill", (d) => (d.empty ? "var(--bg)" : null));

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
/* ---------- Fetch & render ---------- */

// For first bar: in dark -> fill white, background = var(--bg). In light -> fill var(--text), background white.
// For second bar when emotion selected: in dark -> background = var(--bg), fill = emotion color. In light -> default styles.

async function loadAndRenderBoth() {
  try {
    // 1) fetch grezzo
    // 1) fetch grezzo
    let raw = await d3.csv(csvUrl());

    // 2) normalizza: usa direttamente FEED (date/time_local), con fallback da timestamp se servisse
    let rows = raw.map((r) => {
      // campi già pronti dal tab FEED
      let d = (r.date || r.Date || "").trim();
      let t = (r.time_local || r.time || r.Time || "").trim();

      // fallback: se manca qualcosa, prova a derivarlo da "timestamp"
      if (!d || !t) {
        const ts = (r.timestamp || r.Timestamp || "").trim();
        if (ts) {
          const [dd, tt = ""] = ts.split(" ");
          if (!d) d = dd || "";
          if (!t) t = tt.slice(0, 5) || "";
        }
      }

      return {
        ...r,
        date: d, // YYYY-MM-DD (usato dai filtri STRICT)
        time: t, // HH:MM
        time_local: t, // usato da computeSlotDominants()
      };
    });

    // 3) aggiungi _computedDay se serve (usa 'date' appena calcolata)
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

    // 4) render
    // ---- split per giorno (o, se 'giorno' manca, per data distinta) ----
    const dates = Array.from(
      new Set(rows.map((r) => r.date).filter(Boolean))
    ).sort();
    const day1Date = dates[0] || null;
    const day2Date = dates[1] || null;

    const rowsDay1 = rows.filter(
      (r) => String(r.giorno) === "1" || (day1Date && r.date === day1Date)
    );

    const rowsDay2 = rows.filter(
      (r) => String(r.giorno) === "2" || (day2Date && r.date === day2Date)
    );

    // Expose rows & fields for overlay/logging
    try {
      window.ZING = window.ZING || {};
      window.ZING.rows = rows;
      window.ZING.areaField = detectAreaField(rows);
      window.ZING.emoField = detectEmotionField(rows);
      window.ZING.totalCount = rows.length;
    } catch (e) {
      console.warn("ZING expose failed", e);
    }
    // console.debug("[DBG] day1:", rowsDay1.length, "day2:", rowsDay2.length);

    // (opzionale) svuota prima, se i componenti non rimuovono da soli
    if (chartDay1.clear) chartDay1.clear();
    if (chartDay2.clear) chartDay2.clear();

    chartDay1.setData(rowsDay1);
    chartDay2.setData(rowsDay2);
    // (eventuale) colorazione riquadri interni
    colorRoomBordersByTopEmotion(rows);
  } catch (e) {
    console.error("loadAndRenderBoth failed:", e);
    chartDay1.setData([]);
    chartDay2.setData([]);
    const tsEl = document.getElementById("last-update");
    if (tsEl) tsEl.textContent = "—";
  }
}

// ---- Color #260F30 inner rectangles by top emotion per area ----

// === Normalizers ===
function __normArea(v) {
  const s = (v ?? "").toString().trim();
  return s === "Ok.. La Promo è Giusta" ? "Ok... La promo è giusta" : s;
}
function __normEmo(v) {
  return (v ?? "").toString().trim();
}

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
// === Log emotions distribution for a given area (using real feed rows) ===
function logEmotionsForArea(areaName) {
  try {
    const rows = window.ZING && window.ZING.rows ? window.ZING.rows : [];
    if (!rows.length) {
      console.warn(
        "[ROOM] No rows loaded yet; cannot compute emotions for",
        areaName
      );
      return;
    }
    const areaField =
      window.ZING && window.ZING.areaField
        ? window.ZING.areaField
        : detectAreaField(rows);
    const emoField =
      window.ZING && window.ZING.emoField
        ? window.ZING.emoField
        : detectEmotionField(rows);
    if (!areaField || !emoField) {
      console.warn("[ROOM] Missing area/emotion field; abort.", {
        areaField,
        emoField,
      });
      return;
    }
    const normArea = (v) => {
      const s = (v ?? "").toString().trim();
      return s === "Ok.. La Promo è Giusta" ? "Ok... La promo è giusta" : s;
    };
    const normEmo = (v) => (v ?? "").toString().trim();

    const rowsInArea = rows.filter((r) => normArea(r[areaField]) === areaName);
    const totalAll = rows.length;
    const totalArea = rowsInArea.length;

    const emoCounts = new Map();
    for (const r of rowsInArea) {
      const e = normEmo(r[emoField]);
      emoCounts.set(e, (emoCounts.get(e) || 0) + 1);
    }

    const obj = {};
    emoCounts.forEach((v, k) => (obj[k] = v));
    console.group(`[ROOM] ${areaName}`);
    console.log("Reazioni stanza:", totalArea, "/ Totale:", totalAll);
    console.table(obj);
    // Percentuali sulla stanza
    const pct = {};
    Object.keys(obj).forEach((k) => {
      pct[k] = totalArea ? ((obj[k] / totalArea) * 100).toFixed(1) + "%" : "0%";
    });
    console.log("Percentuali sulla stanza:");
    console.table(pct);
    console.groupEnd();
  } catch (e) {
    console.warn("logEmotionsForArea failed:", e);
  }
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
        return f === "#260f30" || f === "#d7d7d7";
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
          ? "Ok... La promo è giusta"
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
setInterval(loadAndRenderBoth, 60 * 1000);
// setInterval(loadAndRenderBoth, 10 * 1000); // test rapido

// ------- Legend interaction: highlight bars by emotion -------

d3.selectAll(".emotions li").on("click", function () {
  const li = d3.select(this);
  const emotion = (li.attr("data-emotion") || li.text()).trim();

  // Determine color from legend (CSS var --c) with fallback to EMO_COLORS
  const liNode = li.node();
  let emoColor = getEmotionColorFromLegendLi(liNode);
  if (!emoColor && typeof EMO_COLORS !== "undefined" && EMO_COLORS.get) {
    const canon =
      emotion.charAt(0).toUpperCase() + emotion.slice(1).toLowerCase();
    emoColor = EMO_COLORS.get(canon) || null;
  }

  // Minimal debug for this test
  console.log("[Legend click]", { emotion, emoColor });

  // Save selection color globally for theme changes
  window.__SELECTED_EMOTION_COLOR = emoColor || null;

  // Update overlay metrics if inside a room
  if (window.ZING && window.ZING.currentArea) {
    updateEmotionMetrics(window.ZING.currentArea, emotion);
    updateStackedBarColors(window.__SELECTED_EMOTION_COLOR);
    // optional layout function
    function positionRoomMetrics() {}
    requestAnimationFrame(() => positionRoomMetrics());
  }

  const wasActive = li.classed("active");
  d3.selectAll(".emotions li").classed("active", false);
  d3.selectAll(".bar").classed("dimmed", false);
  if (!wasActive) {
    li.classed("active", true);
    d3.selectAll(".bar").classed("dimmed", (d) => (d.emo || "—") !== emotion);
  } else {
    const blk = document.querySelector(".room-metrics-emotion");
    if (blk) blk.style.display = "none";
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

    const TARGET_HEXES = new Set(["#260f30", "#d7d7d7"]); // selezioniamo SOLO questi

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
      const isTargetFill = TARGET_HEXES.has(fill);

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

    try {
      if (Array.isArray(ROOM_AREA_ORDER) && INNER_NODES.length === 9) {
        INNER_NODES.forEach((n, i) => {
          n.dataset.areaName = ROOM_AREA_ORDER[i] || "";
        });
      }
    } catch (e) {}

    INNER_NODES.forEach((n) => {
      n.addEventListener(
        "click",
        () => {
          const areaName = n.dataset.areaName || "";
          const cm = document.querySelector(".center-map");
          if (cm) cm.style.display = "none";
          const overlay = document.getElementById("room-overlay");
          if (overlay) overlay.classList.add("active");
          if (window.updateSvgColors)
            window.updateSvgColors(
              document.body.getAttribute("data-theme") === "dark"
            );
          if (areaName) {
            try {
              updateOverlayMetrics(areaName);
              (function () {
                const active = document.querySelector(".emotions li.active");
                let c = null;
                if (active) {
                  let v = getComputedStyle(active)
                    .getPropertyValue("--c")
                    .trim();
                  if (!v) {
                    const dot = active.querySelector('i,[style*="--c"]');
                    if (dot)
                      v = getComputedStyle(active)
                        .getPropertyValue("--c")
                        .trim();
                  }
                  c = v || null;
                }
                window.__SELECTED_EMOTION_COLOR = c || null;
                updateStackedBarColors(window.__SELECTED_EMOTION_COLOR);
              })();
              requestAnimationFrame(() => positionRoomMetrics());

              window.ZING = window.ZING || {};
              window.ZING.currentArea = areaName;
              var __blk = document.querySelector(".room-metrics-emotion");
              if (__blk) __blk.style.display = "none";
              window.ZING.currentArea = areaName;
            } catch (e) {}
          }
        },
        true
      );
    });
    // Map inner rooms (TL->BR) to area names
    try {
      if (Array.isArray(ROOM_AREA_ORDER) && INNER_NODES.length === 9) {
        INNER_NODES.forEach((n, i) => {
          n.dataset.areaName = ROOM_AREA_ORDER[i] || "";
        });
      }
    } catch (e) {}

    // Click => show overlay, update header+bar, and log
    INNER_NODES.forEach((n) => {
      n.addEventListener(
        "click",
        () => {
          const areaName = n.dataset.areaName || "";
          // show overlay
          const cm = document.querySelector(".center-map");
          if (cm) cm.style.display = "none";
          const overlay = document.getElementById("room-overlay");
          if (overlay) overlay.classList.add("active");
          if (window.updateSvgColors)
            window.updateSvgColors(
              document.body.getAttribute("data-theme") === "dark"
            );
          // update metrics
          if (areaName) {
            updateOverlayMetrics(areaName);
            (function () {
              const active = document.querySelector(".emotions li.active");
              let c = null;
              if (active) {
                let v = getComputedStyle(active).getPropertyValue("--c").trim();
                if (!v) {
                  const dot = active.querySelector('i,[style*="--c"]');
                  if (dot)
                    v = getComputedStyle(active).getPropertyValue("--c").trim();
                }
                c = v || null;
              }
              window.__SELECTED_EMOTION_COLOR = c || null;
              updateStackedBarColors(window.__SELECTED_EMOTION_COLOR);
            })();
            requestAnimationFrame(() => positionRoomMetrics());

            try {
              logEmotionsForArea && logEmotionsForArea(areaName);
            } catch (e) {}
          }
        },
        true
      );
    });
    // Map 9 inner nodes to area names using ROOM_AREA_ORDER (top-left to bottom-right)
    try {
      if (Array.isArray(ROOM_AREA_ORDER) && INNER_NODES.length === 9) {
        INNER_NODES.forEach((n, i) => {
          n.dataset.areaName = ROOM_AREA_ORDER[i] || "";
        });
      }
    } catch (e) {}

    // Click: log emotions for clicked room (console)
    INNER_NODES.forEach((n) => {
      n.addEventListener(
        "click",
        () => {
          const areaName = n.dataset.areaName || "";
          if (areaName) logEmotionsForArea(areaName);
        },
        true
      );
    });
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

  // === Global SVG recolor (center + overlay) ===
  (function () {
    // maps must be lower-case for lookups
    const DARK_MAP = {
      "#c7c7c7": "#21082b",
      "#f3f3f3": "#281636",
    };
    const LIGHT_MAP = {
      "#21082b": "#c7c7c7",
      "#281636": "#f3f3f3",
    };

    function lower(s) {
      return (s || "").trim().toLowerCase();
    }

    function recolorRootSvg(root, toDark) {
      if (!root) return;
      const map = toDark ? DARK_MAP : LIGHT_MAP;

      const nodes = root.querySelectorAll("[fill], [stroke], [style]");
      nodes.forEach((el) => {
        const f = el.getAttribute("fill");
        if (f) {
          const key = lower(f);
          if (map[key]) el.setAttribute("fill", map[key]);
        }
        const s = el.getAttribute("stroke");
        if (s) {
          const key = lower(s);
          if (map[key]) el.setAttribute("stroke", map[key]);
        }
        const st = el.getAttribute("style");
        if (st) {
          let replaced = st.replace(/#([0-9a-f]{3}|[0-9a-f]{6})/gi, (m) => {
            const key = m.toLowerCase();
            return map[key] || m;
          });
          if (replaced !== st) el.setAttribute("style", replaced);
        }
      });
    }

    function updateSvgColors(toDark) {
      const roots = [
        document.querySelector(".col-center svg"),
        document.querySelector("#room-overlay svg"),
      ].filter(Boolean);
      roots.forEach((r) => recolorRootSvg(r, !!toDark));
    }

    // expose
    window.updateSvgColors = updateSvgColors;
  })();

  if (legendRoot) {
    // === SVG color swap helpers for theme toggle ===
    function updateSvgColors(toDark) {
      const DARK_MAP = {
        "#c7c7c7": "#21082b",
        "#f3f3f3": "#281636",
      };
      const LIGHT_MAP = {
        "#21082b": "#c7c7c7",
        "#281636": "#f3f3f3",
      };
      const map = toDark ? DARK_MAP : LIGHT_MAP;
      const center = document.querySelector(".col-center");
      if (!center) return;
      const svg = center.querySelector("svg");
      if (!svg) return;

      const nodes = svg.querySelectorAll("[fill], [stroke], [style]");
      nodes.forEach((el) => {
        // direct fill
        const f = el.getAttribute("fill");
        if (f) {
          const key = f.trim().toLowerCase();
          if (map[key]) el.setAttribute("fill", map[key]);
        }
        // direct stroke
        const s = el.getAttribute("stroke");
        if (s) {
          const key = s.trim().toLowerCase();
          if (map[key]) el.setAttribute("stroke", map[key]);
        }
        // inline style (fill/stroke inside style attr)
        const st = el.getAttribute("style");
        if (st) {
          let newSt = st
            .replace(/(#C7C7C7)/gi, (m) => map["#C7C7C7"] || m)
            .replace(/(#f3f3f3)/gi, (m) => map["#f3f3f3"] || m)
            .replace(/(#21082B)/gi, (m) => map["#21082B"] || m)
            .replace(/(#230E2C)/gi, (m) => map["#281636"] || m);
          if (newSt !== st) el.setAttribute("style", newSt);
        }
      });
    }

    function applyThemeToggle(active) {
      try {
        const b = document.body;
        if (active) {
          b.setAttribute("data-theme", "dark");
        } else {
          b.removeAttribute("data-theme");
        }
        window.updateSvgColors && window.updateSvgColors(!!active);
      } catch (e) {}
    }

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
          applyThemeToggle(false);
        } else {
          selectedEmotionForRooms = emotionLabel;
          colorInnerRooms(color);
          applyThemeToggle(true);
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

// === Update overlay header (counts) and stacked bar fill ===
function updateOverlayMetrics(areaName) {
  try {
    const rows = window.ZING && window.ZING.rows ? window.ZING.rows : [];
    const areaField =
      window.ZING && window.ZING.areaField
        ? window.ZING.areaField
        : detectAreaField(rows);
    const emoField =
      window.ZING && window.ZING.emoField
        ? window.ZING.emoField
        : detectEmotionField(rows);
    const totalAll =
      window.ZING && window.ZING.totalCount
        ? window.ZING.totalCount
        : rows.length;
    if (!rows.length || !areaField || !emoField) {
      console.warn("[OVERLAY] Missing rows/fields", {
        len: rows.length,
        areaField,
        emoField,
      });
      return;
    }
    const inArea = rows.filter((r) => __normArea(r[areaField]) === areaName);
    const roomCount = inArea.length;

    // Header numbers (top-right)
    const roomEl = document.getElementById("room-count");
    const totalEl = document.getElementById("total-count");
    if (roomEl) roomEl.textContent = String(roomCount);
    if (totalEl) totalEl.textContent = String(totalAll);

    // Bar fill (% of total)
    const perc = totalAll ? (roomCount / totalAll) * 100 : 0;
    const barFill = document.getElementById("room-bar-fill");
    if (barFill) barFill.style.width = perc.toFixed(2) + "%";
  } catch (e) {
    console.warn("updateOverlayMetrics failed:", e);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const closeBtn = document.getElementById("close-overlay");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      const overlay = document.getElementById("room-overlay");
      if (overlay) overlay.classList.remove("active");
      const cm = document.querySelector(".center-map");
      if (cm) cm.style.display = "flex";
    });
  }
});
function updateEmotionMetrics(areaName, emotion) {
  const rows = window.ZING && window.ZING.rows ? window.ZING.rows : [];
  const areaField =
    window.ZING && window.ZING.areaField
      ? window.ZING.areaField
      : detectAreaField(rows);
  const emoField =
    window.ZING && window.ZING.emoField
      ? window.ZING.emoField
      : detectEmotionField(rows);
  if (!rows.length || !areaField || !emoField) return;

  const inArea = rows.filter((r) => __normArea(r[areaField]) === areaName);
  const roomTotal = inArea.length;

  const emoCount = inArea.filter(
    (r) => (r[emoField] || "").trim() === emotion
  ).length;

  // Aggiorna numeri
  document.getElementById("emo-count").textContent = String(emoCount);
  document.getElementById("emo-room-total").textContent = String(roomTotal);

  // Aggiorna barra %
  const perc = roomTotal ? (emoCount / roomTotal) * 100 : 0;
  document.getElementById("emo-bar-fill").style.width = perc.toFixed(2) + "%";

  // Mostra il blocco
  document.querySelector(".room-metrics-emotion").style.display = "block";
}

/* overlayEmotionClickHook disabled to avoid duplicate legend listeners */

/* =========================================================
   main.js — gestione colori stacked bar (overlay stanza)
   Adattato alla struttura di index.html:
   - Primo stacked (totale):   #room-bar-fill  dentro .room-metrics
   - Secondo stacked (emo):    #emo-bar-fill   dentro .room-metrics-emotion
   - Legenda: <aside.col-left> .emotions ul li  con --c sul <i>
   - Tema: body[data-theme="light" | "dark"]
   - L’overlay contiene i due blocchi metriche:
       .room-metrics               (totale)           — sempre presente
       .room-metrics-emotion       (solo con emo)     — mostrato solo in dark
   ========================================================= */

/* -----------------------------
   UTILITIES
------------------------------*/

/** Legge una CSS custom property da :root */
function cssVar(name, fallback = null) {
  try {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return v || fallback;
  } catch {
    return fallback;
  }
}

/** Ricava il colore emozione da un <li> della legenda (var --c sul <i> o sul li) */
function getEmotionColorFromLegendLi(li) {
  if (!li) return null;
  // 1) CSS var --c sul <li>
  let c = getComputedStyle(li).getPropertyValue("--c")?.trim();
  // 2) CSS var --c su eventuale figlio (es. icona puntino)
  if (!c) {
    const dot = li.querySelector('i,[style*="--c"]');
    if (dot) c = getComputedStyle(dot).getPropertyValue("--c")?.trim();
  }
  if (c) return c;
  // 3) Fallback: usa mappa EMO_COLORS in base all'etichetta
  const label = (li.dataset?.emotion || li.textContent || "").toString().trim();
  if (label) {
    // normalizza: Prima maiuscola, resto minuscolo
    const canon = label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
    const m = typeof EMO_COLORS !== "undefined" ? EMO_COLORS : null;
    if (m && typeof m.get === "function") {
      const hex = m.get(canon);
      if (hex) return hex;
    }
  }
  return null;
}

/** Ritorna 'light' o 'dark' in base al data-theme sul body */
function getTheme() {
  const t = document.body.getAttribute("data-theme");
  return t === "dark" ? "dark" : "light";
}

/* -----------------------------
   STACKED BARS COLORING
------------------------------*/

/**
 * Aggiorna i colori dei due stacked bar secondo le regole richieste:
 *  - Primo stacked (totale)
 *      Light: full=#000000 ; empty=#FFFFFF
 *      Dark : full=#FFFFFF ; empty=#260F30
 *  - Secondo stacked (emo, visibile solo quando c'è selezione ED in dark)
 *      full = colore emozione selezionata ; empty = #FFFFFF
 *
 * Nota: gli stacked sono costruiti come <div class="room-bar"><div id="...-fill"></div></div>
 * per cui la "parte vuota" è il background del contenitore .room-bar,
 * mentre la "parte piena" è il background del #...-fill.
 */
function updateStackedBarColors(selectedEmotionColor = null) {
  const theme =
    document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";

  // DOM refs
  const roomMetricsTotal = document.querySelector(".room-metrics");
  const roomMetricsEmotion = document.querySelector(".room-metrics-emotion");
  const roomBar = roomMetricsTotal
    ? roomMetricsTotal.querySelector(".room-bar")
    : null;
  const roomFill = document.getElementById("room-bar-fill");
  const emoBar = roomMetricsEmotion
    ? roomMetricsEmotion.querySelector(".room-bar")
    : null;
  const emoFill = document.getElementById("emo-bar-fill");

  // Apply colors
  if (roomBar)
    roomBar.style.backgroundColor = theme === "dark" ? "#260F30" : "#FFFFFF";
  if (roomFill)
    roomFill.style.backgroundColor = theme === "dark" ? "#FFFFFF" : "#000000";

  if (emoBar) emoBar.style.backgroundColor = "#FFFFFF";
  if (emoFill && selectedEmotionColor)
    emoFill.style.backgroundColor = selectedEmotionColor;

  // Visibility of second stacked
  if (roomMetricsEmotion) {
    const show = theme === "dark" && !!selectedEmotionColor;
    roomMetricsEmotion.style.display = show ? "" : "none";
  }

  // Minimal debug for this test only
  if (emoBar && emoFill) {
    try {
      console.log("[Stack2]", {
        selectedEmotionColor,
        domEmpty: getComputedStyle(emoBar).backgroundColor,
        domFull: getComputedStyle(emoFill).backgroundColor,
      });
    } catch {}
  }
}

/* -----------------------------
   LEGENDA: CLICK HANDLER
------------------------------*/

/* -----------------------------
   THEME CHANGES: osserva data-theme
------------------------------*/

(function observeTheme() {
  const mo = new MutationObserver(() => {
    updateStackedBarColors(window.__SELECTED_EMOTION_COLOR || null);
    if (window.updateSvgColors)
      window.updateSvgColors(
        document.body.getAttribute("data-theme") === "dark"
      );
  });
  mo.observe(document.body, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
})();

/* -----------------------------
   INIT (al primo load)
------------------------------*/

(function initOnReady() {
  const run = () => {
    updateStackedBarColors(window.__SELECTED_EMOTION_COLOR || null);
    if (window.updateSvgColors)
      window.updateSvgColors(
        document.body.getAttribute("data-theme") === "dark"
      );
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();

/* =========================================================
   NOTE
   - Questo file non tocca il calcolo delle percentuali/width dei fill;
     ci pensa la tua logica esistente (imposta width di #room-bar-fill e #emo-bar-fill).
   - Qui gestiamo solo i COLORI e la visibilità del secondo stacked.
   - Struttura DOM presa direttamente dal tuo index.html. :contentReference[oaicite:1]{index=1}
   ========================================================= */
// === Utils: prendi tutte le righe dal dataset già caricato ===
function _getAllRows() {
  const z = window.ZING || {};
  return z.rows || z.data || z.ALL || z.DATA || z._rows || [];
}

// Parsing ora "robusto" (accetta "HH:MM", "H.MM", numeri, ecc.)
function _toHour(v) {
  if (v == null) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[:.\-]?/);
  if (m) {
    const h = parseInt(m[1], 10);
    return isNaN(h) ? null : Math.max(0, Math.min(23, h));
  }
  const n = parseInt(s, 10);
  return isNaN(n) ? null : Math.max(0, Math.min(23, n));
}

// Raccogli le due date disponibili (stringhe così come arrivano dal foglio)
function _collectTwoDatesForArea(area) {
  const rows = _getAllRows();
  const set = new Set(
    rows
      .filter((r) => (r.room || r.stanza || r.area) === area)
      .map((r) => r.date || r.data || r.giorno || r.Day || r.day)
      .filter(Boolean)
  );
  const arr = Array.from(set);
  // tieni massimo 2 (ordinamento stringa; se hai _computedDay numerico, puoi usarlo qui)
  return arr.slice(0, 2);
}

// Aggrega per ora le reazioni per area + data
function _groupByHour(area, dateStr) {
  const rows = _getAllRows().filter((r) => {
    const a = r.room || r.stanza || r.area;
    const d = r.date || r.data || r.giorno || r.Day || r.day;
    return a === area && d === dateStr;
  });

  const counts = new Map(); // hour -> count
  rows.forEach((r) => {
    const h = _toHour(r.time_Local || r.time || r.ora || r.hour || r.Hour);
    if (h == null) return;
    counts.set(h, (counts.get(h) || 0) + 1);
  });

  // Costruisci dataset ordinato per ora
  const data = Array.from(counts.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, value]) => ({ hour, value }));
  return data;
}

// Stato per lo switch data nell’overlay
window.__HOURLY_STATE__ = { dates: [], idx: 0 };

// Render del grafico a barre orarie (usa D3 se già incluso nel progetto)
function renderHourlyChart(area) {
  const block = document.getElementById("hourly-block");
  if (!block) return;

  // === stato date (due date max), solo per filtrare i dati mostrati ===
  const state = (window.__HOURLY_STATE__ = window.__HOURLY_STATE__ || {
    dates: [],
    idx: 0,
  });
  state.dates = _collectTwoDatesForArea(area);
  if (state.idx >= state.dates.length) state.idx = 0;

  const dateNow = state.dates[state.idx] || null;
  const label = document.getElementById("hour-date-label");
  if (label) label.textContent = dateNow || "—";

  block.hidden = !dateNow;
  if (!dateNow) return;

  // ========== INPUTS TEMA & EMOZIONE ==========
  const theme =
    document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";

  // emozione attiva + colore (dal li .active con --c)
  let selectedEmotionLabel = null;
  let selectedEmotionColor = null;
  const activeLi = document.querySelector(".emotions li.active");
  if (activeLi) {
    selectedEmotionLabel = (
      activeLi.dataset.emotion ||
      activeLi.textContent ||
      ""
    ).trim();
    // prova da CSS var --c sul <li> o sull'icona interna
    selectedEmotionColor = getComputedStyle(activeLi)
      .getPropertyValue("--c")
      .trim();
    if (!selectedEmotionColor) {
      const dot = activeLi.querySelector('i,[style*="--c"]');
      if (dot)
        selectedEmotionColor = getComputedStyle(dot)
          .getPropertyValue("--c")
          .trim();
    }
  }

  const hasSplitBars =
    theme === "dark" && !!selectedEmotionLabel && !!selectedEmotionColor;

  // ========== DATI ==========
  // Totale per ora (stanza+data correnti)
  const rowsAll = _getAllRows().filter((r) => {
    const a = r.room || r.stanza || r.area;
    const d = r.date || r.data || r.giorno || r.Day || r.day;
    return a === area && d === dateNow;
  });

  const totalMap = new Map(); // hour -> count (tutte le emozioni)
  rowsAll.forEach((r) => {
    const h = _toHour(r.time_Local || r.time || r.ora || r.hour || r.Hour);
    if (h == null) return;
    totalMap.set(h, (totalMap.get(h) || 0) + 1);
  });

  // Conteggio per emozione selezionata (ora -> count) SOLO se split attivo
  const emoMap = new Map();
  if (hasSplitBars) {
    rowsAll.forEach((r) => {
      const lbl = (
        r.emotion ||
        r.emo ||
        r.Emozione ||
        r.emozione ||
        r.Emotion ||
        ""
      )
        .toString()
        .trim();
      if (!lbl || lbl !== selectedEmotionLabel) return;
      const h = _toHour(r.time_Local || r.time || r.ora || r.hour || r.Hour);
      if (h == null) return;
      emoMap.set(h, (emoMap.get(h) || 0) + 1);
    });
  }

  // === MASSIMO GLOBALE (ASSE X FISSO per sempre: tutte stanze + tutte date) ===
  const globalMax = (function () {
    const rows = _getAllRows();
    let maxV = 0;
    const counts = new Map(); // (date|room|hour) -> count
    for (const r of rows) {
      const d = r.date || r.data || r.giorno || r.Day || r.day;
      const room = r.room || r.stanza || r.area;
      const h = _toHour(r.time_Local || r.time || r.ora || r.hour || r.Hour);
      if (!d || !room || h == null) continue;
      const key = `${d}||${room}||${h}`;
      const v = (counts.get(key) || 0) + 1;
      counts.set(key, v);
      if (v > maxV) maxV = v;
    }
    return maxV;
  })();

  // ========== RENDER ==========
  const svg = d3.select("#hourly-chart");
  svg.selectAll("*").remove();

  const wrapEl = document.querySelector("#hourly-block .hourly-chart-wrap");
  const W = wrapEl?.clientWidth || 320;
  const H = wrapEl?.clientHeight || 420;
  // top più ampio per non tagliare l’asse X
  const M = { top: 36, right: 32, bottom: 28, left: 34 };

  svg.attr("viewBox", `0 0 ${W} ${H}`);

  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;

  const g = svg.append("g").attr("transform", `translate(${M.left},${M.top})`);

  // Ore fisse 9..18 (righe vuote se 0)
  const hours = d3.range(9, 19);

  // Scala X condivisa e fissa
  const x = d3
    .scaleLinear()
    .domain([0, Math.max(5, globalMax)]) // almeno 5 per aria
    .range([0, innerW]);

  // Y a bande
  const y = d3.scaleBand().domain(hours).range([0, innerH]).padding(0.25);

  // Assi con soli tick
  const gx = g
    .append("g")
    .attr("class", "axis x")
    .call(d3.axisTop(x).ticks(5).tickSizeInner(6).tickSizeOuter(0));
  gx.select(".domain").remove();

  const gy = g
    .append("g")
    .attr("class", "axis y")
    .call(d3.axisLeft(y).tickValues(hours).tickSizeInner(6).tickSizeOuter(0));
  gy.select(".domain").remove();

  // Barre per ogni ora
  // Se split attivo (dark+emozione) → base bianca (totale) + overlay colore emo
  // Altrimenti → singola barra neutra (var(--text))
  const bars = g.append("g");

  hours.forEach((h) => {
    const total = totalMap.get(h) || 0;
    const emo = hasSplitBars ? emoMap.get(h) || 0 : 0;

    const yPos = y(h);
    const barH = y.bandwidth();

    if (hasSplitBars) {
      // base "vuota" (totale) → bianco
      bars
        .append("rect")
        .attr("x", x(0))
        .attr("y", yPos)
        .attr("width", x(total))
        .attr("height", barH)
        .attr("fill", "#FFFFFF");

      // overlay "pieno" (emozione) → colore emozione
      if (emo > 0) {
        bars
          .append("rect")
          .attr("x", x(0))
          .attr("y", yPos)
          .attr("width", x(emo))
          .attr("height", barH)
          .attr("fill", selectedEmotionColor);
      }
    } else {
      // barra unica (totale) → neutra (usa var(--text) via CSS di default)
      bars
        .append("rect")
        .attr("class", "bar")
        .attr("x", x(0))
        .attr("y", yPos)
        .attr("width", x(total))
        .attr("height", barH);
    }
  });
}

// wiring bottoni prev/next
(function wireHourlySwitch() {
  const prev = document.getElementById("hour-prev");
  const next = document.getElementById("hour-next");
  if (!prev || !next) return;

  prev.addEventListener("click", () => {
    const s = window.__HOURLY_STATE__;
    if (!s.dates.length) return;
    s.idx = (s.idx - 1 + s.dates.length) % s.dates.length;
    if (window.ZING && window.ZING.currentArea) {
      renderHourlyChart(window.ZING.currentArea);
    }
  });
  next.addEventListener("click", () => {
    const s = window.__HOURLY_STATE__;
    if (!s.dates.length) return;
    s.idx = (s.idx + 1) % s.dates.length;
    if (window.ZING && window.ZING.currentArea) {
      renderHourlyChart(window.ZING.currentArea);
    }
  });
})();

// Richiama il render quando apri l’overlay o quando cambi stanza
// (aggancia dove già gestisci overlay/apertura stanza)
(function hookHourlyOnOverlay() {
  const overlay = document.getElementById("room-overlay");
  if (!overlay) return;

  const mo = new MutationObserver(() => {
    if (!overlay.hidden && overlay.classList.contains("active")) {
      const area = (window.ZING && window.ZING.currentArea) || null;
      if (area) renderHourlyChart(area);
    }
  });
  mo.observe(overlay, {
    attributes: true,
    attributeFilter: ["hidden", "class"],
  });
})();

// Selezione emozione o cambio tema non influiscono sui conteggi orari;
// ma se per te cambiano il dataset filtrato, richiama renderHourlyChart(area) anche lì.
