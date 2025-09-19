/* Zing – Debug: due grafici affiancati + log dettagliati in console */

const margin = { top: 20, right: 20, bottom: 20, left: 50 };

const SHEET_ID = "1hoAy9ybrFpp_CDOyyLALOmF1S4CwTN20c_WOyeVeAQ8";
const SHEET_NAME = "risposte";
function csvUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    SHEET_NAME
  )}&cachebust=${Date.now()}`;
}

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
        .map(r => (r.date ?? r.Date ?? '').toString().trim())
        .filter(Boolean)
    )
  ).sort(); // [primaData, secondaData, ...]
  return {
    'giorno 1': dates[0] ?? null,
    'giorno 2': dates[1] ?? (dates[0] ?? null)
  };
}

function filterRowsForDayStrict(rows, dayKey) {
  const map = getDayDates(rows);
  const targetDate = map[dayKey];
  if (!targetDate) return [];
  return rows.filter(r => (r.date ?? r.Date ?? '').toString().trim() === targetDate);
}


/* ---------- Robust day assignment by date (falls back if 'day' is missing/inconsistent) ---------- */
function assignDaysByDate(rows) {
  // Extract normalized date (YYYY-MM-DD) per row when available
  const withDate = rows.map(r => {
    const d = (r.date ?? r.Date ?? "").toString().trim();
    return {row: r, date: d};
/* ---------- Day/date mapping helpers (strict) ---------- */
function dayDateMap(rows) {
  const dates = Array.from(
    new Set(
      rows
        .map(r => (r.date ?? r.Date ?? "").toString().trim())
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
  return rows.filter(r => {
    const d = (r.date ?? r.Date ?? "").toString().trim();
    return d === targetDate;
  });
}

  });
  const dates = Array.from(new Set(withDate.map(x => x.date).filter(Boolean))).sort();
  // If we have at least 2 dates, map the earliest to "giorno 1" and the latest to "giorno 2"
  const mapByDate = new Map();
  if (dates.length) {
    mapByDate.set(dates[0], "giorno 1");
    if (dates.length > 1) {
      mapByDate.set(dates[dates.length - 1], "giorno 2");
    }
  }
  // Produce a shallow copy adding a computedDay field we can use in filters
  return rows.map(r => {
    const normalized = normalizeDay(r.day ?? r.Day ?? r.giorno ?? r.Giorno);
    let computed = normalized;
    if (!computed || computed === "") {
      const d = (r.date ?? r.Date ?? "").toString().trim();
      if (mapByDate.has(d)) computed = mapByDate.get(d);
    }
    return {...r, _computedDay: computed || ""};
  });
}


function filterRowsForDay(rows, dayKey) {
  // Prefer computed day if present
  const getDay = (r) => (r._computedDay !== undefined ? r._computedDay : normalizeDay(r.day ?? r.Day ?? r.giorno ?? r.Giorno));
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
      .attr("class", "bar")
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
      const rowsForDay = (typeof filterRowsForDayStrict === 'function')
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
  } catch (e) {
    chartDay1.setData([]);
    chartDay2.setData([]);
    const tsEl = document.getElementById("last-update");
    if (tsEl) tsEl.textContent = "—";
  }
}

loadAndRenderBoth();
setInterval(loadAndRenderBoth, 10 * 60 * 1000);
// setInterval(loadAndRenderBoth, 10 * 1000); // test rapido
