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
// === Overlay gate: pausa refresh quando l’overlay stanza è aperto ===
window.__isOverlayOpen =
  window.__isOverlayOpen ||
  function () {
    try {
      // Segnale di stato app (viene impostato quando entri in una stanza)
      if (window.ZING && window.ZING.currentArea) return true;
      // Segnale DOM (overlay/pannello visibile)
      const el = document.querySelector(
        "#room-overlay.active, .room-panel.active, .area-overlay.active"
      );
      return !!(el && el.offsetParent !== null);
    } catch (e) {
      return false;
    }
  };

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

// --- Room title/icon loader (SVG preferred, PNG fallback) ---
const ROOM_ICON_CACHE = new Map(); // slug -> {type:'svg'|'img', content:Node}
function slugifyRoom(name) {
  return (name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, "e")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Carica l'icona della stanza.
 * 1) prova /assets/rooms/<slug>.svg e inietta inline
 * 2) se fallisce, usa /assets/rooms/<slug>.png come <img>
 * Cache: evita richieste ripetute.
 */
async function loadRoomIcon(slug) {
  if (!slug) return null;
  if (ROOM_ICON_CACHE.has(slug)) return ROOM_ICON_CACHE.get(slug);

  // tenta SVG
  try {
    const res = await fetch(`./assets/rooms/${slug}.svg`, {
      cache: "force-cache",
    });
    if (res.ok) {
      const svgText = await res.text();
      const wrapper = document.createElement("div");
      wrapper.innerHTML = svgText.trim();
      const svg = wrapper.querySelector("svg");
      if (svg) {
        svg.classList.add("icon-svg", `icon-${slug}`);
        const record = { type: "svg", content: svg };
        ROOM_ICON_CACHE.set(slug, record);
        return record;
      }
    }
  } catch (e) {}

  // fallback PNG
  const img = document.createElement("img");
  img.src = `./assets/rooms/${slug}.png`;
  img.alt = "";
  img.decoding = "async";
  img.loading = "lazy";
  img.className = `icon-img icon-${slug}`;
  const record = { type: "img", content: img };
  ROOM_ICON_CACHE.set(slug, record);
  return record;
}

async function renderRoomTitle(areaName) {
  const iconHost = document.getElementById("room-title-icon");
  const textHost = document.getElementById("room-title-text");
  if (!iconHost || !textHost) return;

  // testo
  // set testo provvisorio (verrà nascosto se l\'icona include già il titolo)
  textHost.textContent = areaName || "";

  // pulisci icona precedente
  iconHost.innerHTML = "";

  if (!areaName) return;

  const slug = slugifyRoom(areaName);
  const rec = await loadRoomIcon(slug);
  if (rec && rec.content) {
    iconHost.appendChild(rec.content.cloneNode(true));
    // Se abbiamo un'icona (SVG o PNG), nascondi il testo duplicato
    // poiché spesso il file grafico contiene già il nome della stanza
    textHost.textContent = "";
  }
  // Normalizza l’SVG iniettato: niente width/height fissi, mantieni aspect ratio
  const svgEl = iconHost.querySelector("svg");
  if (svgEl) {
    svgEl.removeAttribute("width");
    svgEl.removeAttribute("height");
    svgEl.setAttribute("preserveAspectRatio", "xMidYMid meet");
  }
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

/* Conta per slot (10') quante reazioni per emozione, per calcolare lo "stacked" */
/* Conta per ORA (60') quante reazioni per emozione: serve allo "stacked" orario */
function computeHourCounts(rows) {
  // Map( Number(+hourStartDate) -> Map(emozione -> count) )
  const byHour = new Map();

  for (const r of rows) {
    // ricava ora e data
    const dateStr =
      r.date ||
      r.Date ||
      r.data ||
      r.Data ||
      r.timestamp_iso_local?.slice(0, 10) ||
      "";
    const t = parseTimeHHMM(r.time_local ?? r.time ?? r.Time ?? "");
    if (!dateStr || !t) continue;

    const h = t.hour; // 0..23
    if (h < 9 || h >= 18) continue; // fuori dal range visuale

    // "snap" all'inizio ora
    const hourStart = new Date(
      `${dateStr}T${String(h).padStart(2, "0")}:00:00`
    );
    const keyNum = +hourStart;

    const emo = (r.emotion ?? r.Emotion ?? r.emozione ?? r.Emozione ?? "")
      .toString()
      .trim();
    if (!emo) continue;

    let map = byHour.get(keyNum);
    if (!map) {
      map = new Map();
      byHour.set(keyNum, map);
    }
    map.set(emo, (map.get(emo) || 0) + 1);
  }

  return byHour;
}

/* ---------- Chart factory ---------- */
function createChart({
  svgId,
  totalId,
  dayKey,
  drawBarsWhenNoData = false,
  allowStacked = true,
}) {
  const svg = d3.select(`#${svgId}`);
  const svgNode = svg.node();
  if (!svgNode) {
  }
  // wrapper = il .chart-wrapper che contiene questo svg
  const wrapperEl = svgNode?.closest(".chart-wrapper") || null;
  if (!wrapperEl) {
  } else {
  }

  const cfg = { svgId, allowStacked };

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
      .tickSize(10);
    g.append("g").attr("class", "axis").call(axis);
    g.select(".axis .domain").remove();

    const hasData = Array.from(state.slotDominants.values()).some(
      (v) => v !== "—"
    );
    if (!hasData && !drawBarsWhenNoData) {
      return;
    }

    const gap = 2,
      leftPad = 12,
      rightPad = 10;
    const padPx = margin.right + rightPad + "px";

    // 1) sottotitoli sopra i due grafici
    if (svgId === "chart-day1") {
      const t1 = document.getElementById("day1-subtitle");
      if (t1) t1.style.paddingRight = padPx;
    } else if (svgId === "chart-day2") {
      const t2 = document.getElementById("day2-subtitle");
      if (t2) t2.style.paddingRight = padPx;

      // 2) footer colonna destra: usa la stessa fine-barre del grafico di destra
      const totalNum = document.getElementById("total-reactions-all");
      if (totalNum) {
        const totalWrap = totalNum.parentElement; // il div che contiene numero + label
        if (totalWrap) totalWrap.style.paddingRight = padPx;
      }

      const common = document.getElementById("common-emotion-tag");
      if (common) common.style.paddingRight = padPx;
    }
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

    // selezione attuale dalla legenda (se presente, attivo "stacked")
    const SELECTED_LABEL = window.__SELECTED_EMOTION_LABEL || null;
    const SELECTED_COLOR =
      window.__SELECTED_EMOTION_COLOR ||
      (SELECTED_LABEL ? getEmotionColor(SELECTED_LABEL) : null);

    if (cfg.allowStacked && SELECTED_LABEL && state.hourCounts) {
      // ============ MODALITÀ STACKED (affluenza ORARIA) ============
      const groups = gBars
        .selectAll("g.bar")
        .data(barsData, (d) => d.key)
        .join((enter) => {
          const gEnter = enter
            .append("g")
            .attr(
              "class",
              (d) =>
                `bar ${d.empty ? "empty" : ""} emo-${String(
                  d.emo || ""
                ).replace(/\s+/g, "_")}`
            );
          gEnter.append("rect").attr("class", "bar-bg");
          gEnter.append("rect").attr("class", "bar-fill");
          gEnter.append("title");
          return gEnter;
        });

      groups.attr(
        "transform",
        (d) => `translate(${leftPad}, ${y(d.s) + gap / 2})`
      );

      const barH = (d) => Math.max(1, y(d.next) - y(d.s) - gap);

      // Fondo bianco: tutta l'ora
      groups
        .select("rect.bar-bg")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", barW)
        .attr("height", barH)
        .attr("fill", "#FFFFFF");

      // Porzione colorata = quota dell'emozione selezionata nell'ora
      groups
        .select("rect.bar-fill")
        .each(function (d) {
          // === Pause gate: overlay detection ===
          (function () {
            if (!window.__isOverlayOpen) {
              window.__isOverlayOpen = function () {
                try {
                  if (window.ZING && window.ZING.currentArea) return true; // app state says overlay open
                  const el = document.querySelector(
                    ".room-overlay, .room-panel, .area-overlay, .room-metrics"
                  );
                  if (el && el.offsetParent !== null) return true; // visible
                } catch (e) {}
                return false;
              };
            }
          })();

          const keyNum = +d.s; // inizio ora come number
          const counts =
            (state.hourCounts && state.hourCounts.get(keyNum)) || new Map();
          const totalN = Array.from(counts.values()).reduce((a, b) => a + b, 0);
          const emoN = counts.get(SELECTED_LABEL) || 0;
          const p = totalN > 0 ? emoN / totalN : 0;

          d.__stack_totalN = totalN;
          d.__stack_emoN = emoN;
          d.__stack_p = p;
        })
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", (d) => Math.round(barW * (d.__stack_p || 0)))
        .attr("height", barH)
        .attr("fill", SELECTED_COLOR || "#000000");

      // Tooltip: breakdown per ora
      groups.select("title").text((d) => {
        const keyNum = +d.s;
        const counts =
          (state.hourCounts && state.hourCounts.get(keyNum)) || new Map();
        const bits = EMO_ORDER.map((emo) => `${emo}: ${counts.get(emo) || 0}`);
        const h0 = String(d.s.getHours()).padStart(2, "0");
        const h1 = String(d.next.getHours()).padStart(2, "0");
        return `${h0}:00–${h1}:00
${bits.join(" · ")}
${SELECTED_LABEL}: ${d.__stack_emoN || 0} / ${d.__stack_totalN || 0}`;
      });
    } else {
      // ============ MODALITÀ STANDARD (dominante piena) ============
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
            `${String(d.s.getHours()).padStart(2, "0")}:00–${String(
              d.next.getHours()
            ).padStart(2, "0")}:00\nEmozione dominante: ${d.emo || "—"}`
        );
    }
    // --- FINO A QUI ---
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
      if (state.totalEl) {
        const realCount = rowsForDay.filter(__isRealFeedRow).length;
        state.totalEl.textContent = String(realCount);
      }

      state.slotDominants = computeSlotDominants(rowsForDay);
      state.hourCounts = computeHourCounts(rowsForDay);
      measureAndDraw();
    },
    redraw: measureAndDraw,
  };
}
// "2025-10-01" -> "mercoledì 01"
function formatDaySubhead(dateStr) {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return new Intl.DateTimeFormat("it-IT", {
      weekday: "long",
      day: "2-digit",
    }).format(d);
  } catch {
    return "—";
  }
}
// ——— Area helpers (match robusto per id / slug / name) ———
function detectAreaField(rows) {
  // se già esiste nel tuo file, puoi saltare questa funzione
  const candidates = [
    "area_id",
    "areaId",
    "AreaID",
    "area_slug",
    "areaSlug",
    "AreaSlug",
    "area",
    "AreaName",
    "area_name",
    "Room",
    "room",
    "Zona",
    "zona",
    "Postazione",
    "postazione",
  ];
  for (const k of candidates) if (rows.length && k in rows[0]) return k;
  return null;
}
function rowMatchesArea(r, areaKey, areaField) {
  if (!r || !areaKey) return false;
  const norm = (v) =>
    typeof __normArea === "function"
      ? __normArea(v)
      : (v ?? "").toString().trim();
  const key = norm(areaKey);

  // usa il campo rilevato se disponibile
  if (areaField && r[areaField] != null) return norm(r[areaField]) === key;

  // fallback su una lista ampia di possibili chiavi
  const vals = [
    r.area_id,
    r.AreaID,
    r.areaId,
    r.area_slug,
    r.AreaSlug,
    r.areaSlug,
    r.area,
    r.area_name,
    r.AreaName,
    r.Room,
    r.room,
    r.Zona,
    r.zona,
    r.Postazione,
    r.postazione,
  ].map(norm);
  return vals.includes(key);
}

// ——— API per aggiornare SOLO la colonna destra ———
let __RIGHT_BASE_DAY1 = [];
let __RIGHT_BASE_DAY2 = [];

// (ri)applica dati ai due grafici e aggiorna il box sotto
function setRightColumnData(day1Rows, day2Rows) {
  if (chartDay1 && chartDay1.clear) chartDay1.clear();
  if (chartDay2 && chartDay2.clear) chartDay2.clear();
  if (chartDay1) chartDay1.setData(day1Rows || []);
  if (chartDay2) chartDay2.setData(day2Rows || []);

  // ----- Totale combinato -----
  const totalAll = (day1Rows?.length || 0) + (day2Rows?.length || 0);
  const elTotalAll = document.getElementById("total-reactions-all");
  if (elTotalAll) elTotalAll.textContent = totalAll.toLocaleString("it-IT");

  // ----- Emozione più comune sui due insiemi -----
  const allRows = [...(day1Rows || []), ...(day2Rows || [])];
  const counts = d3.rollup(
    allRows,
    (v) => v.length,
    (r) => (r.emotion || r.Emozione || r.emozione || "").toString().trim()
  );
  let topEmotion = null,
    maxCount = -1;
  for (const [emo, n] of counts.entries()) {
    if (!emo) continue;
    if (n > maxCount) {
      maxCount = n;
      topEmotion = emo;
    }
  }
  const tag = document.getElementById("common-emotion-tag");
  if (tag) {
    const dot = tag.querySelector(".dot");
    const name = tag.querySelector(".name");
    if (dot) {
      const col =
        typeof resolveEmotionColor === "function"
          ? resolveEmotionColor(topEmotion)
          : typeof getEmotionColor === "function"
          ? getEmotionColor(topEmotion)
          : null;
      dot.style.background = col || "var(--text)";
    }
    if (name) name.textContent = topEmotion || "—";
  }
}

// filtra i dati della colonna destra per area corrente
function updateRightColumnForArea(areaKey) {
  if (!areaKey) return;
  const areaField =
    window.ZING?.areaField ||
    detectAreaField(__RIGHT_BASE_DAY1.concat(__RIGHT_BASE_DAY2));
  const f1 = (__RIGHT_BASE_DAY1 || []).filter((r) =>
    rowMatchesArea(r, areaKey, areaField)
  );
  const f2 = (__RIGHT_BASE_DAY2 || []).filter((r) =>
    rowMatchesArea(r, areaKey, areaField)
  );
  setRightColumnData(f1, f2);
}

// rimuove il filtro (torna alla vista aggregata)
function clearRightColumnFilter() {
  setRightColumnData(__RIGHT_BASE_DAY1, __RIGHT_BASE_DAY2);
}

/* ---------- Charts ---------- */
const chartDay1 = createChart({
  svgId: "chart-day1",
  totalId: "total-reactions-day1",
  dayKey: "giorno 1",
  drawBarsWhenNoData: true,
  allowStacked: false,
});

const chartDay2 = createChart({
  svgId: "chart-day2",
  totalId: "total-reactions-day2",
  dayKey: "giorno 2",
  drawBarsWhenNoData: false,
  allowStacked: false,
});

/* ---------- Fetch & render ---------- */
/* ---------- Fetch & render ---------- */

// For first bar: in dark -> fill white, background = var(--bg). In light -> fill var(--text), background white.
// For second bar when emotion selected: in dark -> background = var(--bg), fill = emotion color. In light -> default styles.
// --- Risoluzione colore emozione coerente con la legenda ---
function resolveEmotionColor(label) {
  if (!label) return null;
  const key = String(label).trim();

  // (a) prova a leggere dalla legenda (var(--c) del "dot")
  //    - match by data-emotion o testo normalizzato
  const allLis = document.querySelectorAll(".emotions li");
  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase();
  let dotEl = null;

  for (const li of allLis) {
    const liLabel = li.dataset?.emotion || li.textContent;
    if (norm(liLabel) === norm(key)) {
      dotEl = li.querySelector(".dot,[style*='--c']") || li;
      break;
    }
  }
  if (dotEl) {
    const cssColor = getComputedStyle(dotEl).getPropertyValue("--c").trim();
    if (cssColor) return cssColor;
  }

  // (b) fallback a EMO_COLORS (Map o Object) se esiste
  if (window.EMO_COLORS) {
    // Map
    if (typeof window.EMO_COLORS.get === "function") {
      for (const [emo, col] of window.EMO_COLORS.entries()) {
        if (norm(emo) === norm(key)) return col;
      }
    } else {
      // plain object
      for (const emo in window.EMO_COLORS) {
        if (norm(emo) === norm(key)) return window.EMO_COLORS[emo];
      }
    }
  }

  // (c) palette di riserva (se proprio serve)
  const FALLBACK = {
    curiosità: "#2ECC71",
    entusiasmo: "#F1C40F",
    fiducia: "#3498DB",
    indifferenza: "#95A5A6",
    confusione: "#9B59B6",
    timore: "#E74C3C",
  };
  return FALLBACK[norm(key)] || "var(--text)";
}

async function loadAndRenderBoth() {
  // Skip refresh while overlay is open
  try {
    if (window.__isOverlayOpen && window.__isOverlayOpen()) {
      return;
    }
  } catch (e) {}

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
    rows = rows.filter(__isRealFeedRow);
    // 3) aggiungi _computedDay se serve (usa 'date' appena calcolata)
    rows = assignDaysByDate(rows);

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
    // ----- aggiorna i sottotitoli sopra i due grafici (se presenti in HTML) -----
    const el1 = document.getElementById("day1-subtitle");
    if (el1) el1.textContent = day1Date ? formatDaySubhead(day1Date) : "—";

    const el2 = document.getElementById("day2-subtitle");
    if (el2) el2.textContent = day2Date ? formatDaySubhead(day2Date) : "—";

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

    // >>> Color overview lanterns by top emotion per room
    try {
      if (typeof window.colorOverviewLanternsByTopEmotion === "function") {
        window.colorOverviewLanternsByTopEmotion(rows);
      }
    } catch (e) {
      console.warn("[Lanterns] apply failed", e);
    }
    // console.debug("[DBG] day1:", rowsDay1.length, "day2:", rowsDay2.length);

    // (opzionale) svuota prima, se i componenti non rimuovono da soli
    if (chartDay1.clear) chartDay1.clear();
    if (chartDay2.clear) chartDay2.clear();
    // salva le basi (non filtrate) per poter ripristinare
    __RIGHT_BASE_DAY1 = rowsDay1;
    __RIGHT_BASE_DAY2 = rowsDay2;

    // primo render della colonna destra (non filtrata)
    setRightColumnData(__RIGHT_BASE_DAY1, __RIGHT_BASE_DAY2);
    // ----- Totale combinato (somma reazioni giorno1 + giorno2) -----
    const totalAll = rowsDay1.length + rowsDay2.length;
    const elTotalAll = document.getElementById("total-reactions-all");
    if (elTotalAll) elTotalAll.textContent = totalAll.toLocaleString("it-IT");

    // ----- Emozione più comune sui due giorni -----
    const allRows = [...rowsDay1, ...rowsDay2];
    const counts = d3.rollup(
      allRows,
      (v) => v.length,
      (r) => (r.emotion || r.Emozione || r.emozione || "").trim()
    );
    // -- keep a global reference for per-room opacity logic
    window.__ALL_ROWS = rows;

    // trova quella con massimo valore
    let topEmotion = null;
    let maxCount = -1;
    for (const [emo, count] of counts.entries()) {
      if (!emo) continue;
      if (count > maxCount) {
        maxCount = count;
        topEmotion = emo;
      }
    }

    // aggiorna UI del box "Emozione più comune"
    const tag = document.getElementById("common-emotion-tag");
    if (tag) {
      const dot = tag.querySelector(".dot");
      const name = tag.querySelector(".name");
      if (dot) {
        const col = resolveEmotionColor(topEmotion);
        dot.style.background = col || "var(--text)";
      }

      if (name) name.textContent = topEmotion || "—";
    }

    // (eventuale) colorazione riquadri interni
    colorRoomBordersByTopEmotion(rows);

    // Recolor + filter timelines after fresh render
    if (typeof ensureTimelineColorsAndFilter === "function")
      ensureTimelineColorsAndFilter();
  } catch (e) {
    console.error("loadAndRenderBoth failed:", e);
    chartDay1.setData([]);
    chartDay2.setData([]);
    const tsEl = document.getElementById("last-update");
    if (tsEl) tsEl.textContent = "—";
  }

  applyPerRoomEmotionOpacity(window.__SELECTED_EMOTION_LABEL || null);
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
// Una riga del FEED è “reale” se ha un orario valido (le righe placeholder hanno time_local vuoto)
function __isRealFeedRow(r) {
  const t = (r.time_local ?? r.time ?? r.Time ?? "").toString().trim();
  if (!t) return false;
  // opzionale: scarta anche se l'ora non è parsabile
  const m = t.match(/^(\d{1,2})[:.](\d{2})/);
  return !!m;
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
    // Percentuali sulla stanza
    const pct = {};
    Object.keys(obj).forEach((k) => {
      pct[k] = totalArea ? ((obj[k] / totalArea) * 100).toFixed(1) + "%" : "0%";
    });
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
setInterval(function () {
  try {
    if (!(window.__isOverlayOpen && window.__isOverlayOpen()))
      loadAndRenderBoth();
  } catch (e) {}
}, 60 * 1000);

// setInterval(function(){ try{ if (!(window.__isOverlayOpen && window.__isOverlayOpen())) loadAndRenderBoth(); }catch(e){} }, 10 * 1000); // test rapido

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

  // Save selection color globally for theme changes
  window.__SELECTED_EMOTION_COLOR = emoColor || null;

  // >>> [P3] salva anche la LABEL in globale (serve ai grafici Giorno1/2)
  window.__SELECTED_EMOTION_LABEL = emotion; // <-- AGGIUNGI QUESTA
  (function () {
    window.__APPLY_OPACITY_TOKEN++;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        applyPerRoomEmotionOpacity(window.__SELECTED_EMOTION_LABEL);
      })
    );
  })();

  // Update overlay metrics if inside a room
  if (window.ZING && window.ZING.currentArea) {
    updateEmotionMetrics(window.ZING.currentArea, emotion);
    updateStackedBarColors(window.__SELECTED_EMOTION_COLOR);
    // optional layout function
    if (
      document.getElementById("hourly-block") &&
      window.ZING &&
      window.ZING.currentArea
    ) {
      requestAnimationFrame(() => renderHourlyChart(window.ZING.currentArea));
    }

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
    // se stai deselezionando, azzera anche la label globale
    window.__SELECTED_EMOTION_LABEL = null;
    (function () {
      window.__APPLY_OPACITY_TOKEN++;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          applyPerRoomEmotionOpacity(null);
        })
      );
    })(); // <-- [P3] opzionale ma consigliato
    const blk = document.querySelector(".room-metrics-emotion");
    if (blk) blk.style.display = "none";
  }
  (function () {
    window.__APPLY_OPACITY_TOKEN++;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        applyPerRoomEmotionOpacity(null);
      })
    );
  })();

  // >>> [P3] riapplica l’highlight alle timeline Giorno1/Giorno2
  if (typeof ensureTimelineColorsAndFilter === "function")
    ensureTimelineColorsAndFilter();
  applyLegendHighlightToTimelineCharts();
});

// === [SVG inner rooms: init + legend sync] ===================================
(function () {
  window.__APPLY_OPACITY_TOKEN = window.__APPLY_OPACITY_TOKEN || 0;
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

  // 2) Hook iniziale dopo che l’HTML è pronto
  function initInnerRoomsOnce() {
    if (INNER_NODES.length) return; // già fatto
    INNER_NODES = collectInnerRooms();
    // Build unique parent <g> groups for those inner paths
    let GROUP_NODES = [];
    (function () {
      const seen = new Set();
      INNER_NODES.forEach((el) => {
        const g = el.closest && el.closest("g");
        if (g && !seen.has(g)) {
          seen.add(g);
          // propagate areaName to group if present on path
          if (!g.dataset.areaName && el.dataset.areaName)
            g.dataset.areaName = el.dataset.areaName;
          GROUP_NODES.push(g);
        }
      });
    })();
    try {
      if (Array.isArray(ROOM_AREA_ORDER) && INNER_NODES.length === 9) {
        INNER_NODES.forEach((n, i) => {
          n.dataset.areaName = ROOM_AREA_ORDER[i] || "";
        });
        if (GROUP_NODES && GROUP_NODES.length === 9) {
          GROUP_NODES.forEach((g, i) => {
            if (!g.dataset.areaName)
              g.dataset.areaName = ROOM_AREA_ORDER[i] || "";
          });
        }
      }
    } catch (e) {}

    /* listener moved from paths to parent groups */
    if (GROUP_NODES && GROUP_NODES.length) {
      GROUP_NODES.forEach((n) => {
        n.addEventListener(
          "click",
          () => {
            const path =
              n.querySelector && n.querySelector(".room-inner, .inner-room");
            const areaName =
              (n.dataset && n.dataset.areaName) ||
              (path && path.dataset ? path.dataset.areaName : "") ||
              "";
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
                renderRoomTitle(areaName);
                (function () {
                  window.__APPLY_OPACITY_TOKEN =
                    window.__APPLY_OPACITY_TOKEN || 0;
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
                updateRightColumnForArea(window.ZING.currentArea);
              } catch (e) {}
            }
          },
          true
        );
      });
    }
    // Map inner rooms (TL->BR) to area names
    try {
      if (Array.isArray(ROOM_AREA_ORDER) && INNER_NODES.length === 9) {
        INNER_NODES.forEach((n, i) => {
          n.dataset.areaName = ROOM_AREA_ORDER[i] || "";
        });
        if (GROUP_NODES && GROUP_NODES.length === 9) {
          GROUP_NODES.forEach((g, i) => {
            if (!g.dataset.areaName)
              g.dataset.areaName = ROOM_AREA_ORDER[i] || "";
          });
        }
      }
    } catch (e) {}

    // Click => show overlay, update header+bar, and log
    /* listener moved from paths to parent groups */
    if (GROUP_NODES && GROUP_NODES.length) {
      GROUP_NODES.forEach((n) => {
        n.addEventListener(
          "click",
          () => {
            const path =
              n.querySelector && n.querySelector(".room-inner, .inner-room");
            const areaName =
              (n.dataset && n.dataset.areaName) ||
              (path && path.dataset ? path.dataset.areaName : "") ||
              "";
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
              renderRoomTitle(areaName);
              (function () {
                window.__APPLY_OPACITY_TOKEN =
                  window.__APPLY_OPACITY_TOKEN || 0;
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

              try {
                logEmotionsForArea && logEmotionsForArea(areaName);
              } catch (e) {}
            }
          },
          true
        );
      });
    }
    // Map 9 inner nodes to area names using ROOM_AREA_ORDER (top-left to bottom-right)
    try {
      if (Array.isArray(ROOM_AREA_ORDER) && INNER_NODES.length === 9) {
        INNER_NODES.forEach((n, i) => {
          n.dataset.areaName = ROOM_AREA_ORDER[i] || "";
        });
        if (GROUP_NODES && GROUP_NODES.length === 9) {
          GROUP_NODES.forEach((g, i) => {
            if (!g.dataset.areaName)
              g.dataset.areaName = ROOM_AREA_ORDER[i] || "";
          });
        }
      }
    } catch (e) {}

    // Click: log emotions for clicked room (console)
    /* listener moved from paths to parent groups */
    if (GROUP_NODES && GROUP_NODES.length) {
      GROUP_NODES.forEach((n) => {
        n.addEventListener(
          "click",
          () => {
            const path =
              n.querySelector && n.querySelector(".room-inner, .inner-room");
            const areaName =
              (n.dataset && n.dataset.areaName) ||
              (path && path.dataset ? path.dataset.areaName : "") ||
              "";
            if (areaName) logEmotionsForArea(areaName);
          },
          true
        );
      });
    }
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
    window.__APPLY_OPACITY_TOKEN = window.__APPLY_OPACITY_TOKEN || 0;
    // maps must be lower-case for lookups
    const DARK_MAP = {
      "#c7c7c7": "#21082b",
      "#f3f3f3": "#2b0f33",
      "#e3e3e2": "#260f30",
      "#d7d7d7": "#21082b",
      "#373737": "#ffffff",
    };
    const LIGHT_MAP = {
      "#21082b": "#c7c7c7",
      "#2b0f33": "#f3f3f3",
      "#260f30": "#e3e3e2",
      "#21082B": "#d7d7d7",
      "#ffffff": "#373737",
    };

    function lower(s) {
      return (s || "").trim().toLowerCase();
    }

    function recolorRootSvg(root, toDark) {
      // Skip recoloring for inner room nodes (stanza content)
      function isInner(el) {
        try {
          return !!(
            el.closest &&
            el.closest(
              '[data-area],[data-room],[aria-label],.room-inner,[data-role="inner"]'
            )
          );
        } catch (e) {
          return false;
        }
      }
      if (!root) return;
      const map = toDark ? DARK_MAP : LIGHT_MAP;

      const nodes = root.querySelectorAll("[fill], [stroke], [style]");
      nodes.forEach((el) => {
        if (isInner(el)) {
          return;
        }

        const __cls = (el.getAttribute("class") || "").toLowerCase();
        if (/\broom-\d+\b/.test(__cls)) {
          return;
        }
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
        document.querySelector(".col-left svg"),
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
        "#f3f3f3": "#2b0f33",
        "#e3e3e2": "#260f30",
        "#d7d7d7": "#21082b",
      };
      const LIGHT_MAP = {
        "#21082b": "#c7c7c7",
        "#2b0f33": "#f3f3f3",
        "#260f30": "#e3e3e2",
        "#21082B": "#d7d7d7",
      };
      const map = toDark ? DARK_MAP : LIGHT_MAP;

      // Skip inner room shapes so we don't overwrite per-room opacity
      function isInner(el) {
        try {
          return !!(
            el.closest &&
            el.closest(
              '[data-area],[data-room],[aria-label],.room-inner,[data-role="inner"]'
            )
          );
        } catch (e) {
          return false;
        }
      }
      const center = document.querySelector(".col-center");
      if (!center) return;
      const svg = center.querySelector("svg");
      if (!svg) return;

      const nodes = svg.querySelectorAll("[fill], [stroke], [style]");
      nodes.forEach((el) => {
        if (isInner(el)) {
          return;
        }
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
          applyPerRoomEmotionOpacity(null);
          applyThemeToggle(false);
        } else {
          selectedEmotionForRooms = emotionLabel;
          /* colorInnerRooms disabled: per-room opacity handles fills */
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
      if (window.ZING) {
        window.ZING.currentArea = null;
      }
      clearRightColumnFilter();
      if (typeof ensureTimelineColorsAndFilter === "function")
        ensureTimelineColorsAndFilter();
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

    // 1) prova CSS var --c sul li
    selectedEmotionColor = getComputedStyle(activeLi)
      .getPropertyValue("--c")
      .trim();

    // 2) prova su icona/pallino interno
    if (!selectedEmotionColor) {
      const dot = activeLi.querySelector('i,[style*="--c"]');
      if (dot) {
        selectedEmotionColor = getComputedStyle(dot)
          .getPropertyValue("--c")
          .trim();
      }
    }

    // 3) fallback mappa colori (se hai EMO_COLORS/getEmotionColor)
    if (!selectedEmotionColor && typeof getEmotionColor === "function") {
      selectedEmotionColor = getEmotionColor(selectedEmotionLabel);
    }
  }

  const hasSplitBars = !!selectedEmotionLabel && !!selectedEmotionColor;

  // ========== DATI ==========
  // Totale per ora (stanza+data correnti)
  const rowsAll = _getAllRows().filter((r) => {
    const a = r.room || r.stanza || r.area;
    const d = r.date || r.data || r.giorno || r.Day || r.day;
    return a === area && d === dateNow && __isRealFeedRow(r);
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
    window.__APPLY_OPACITY_TOKEN = window.__APPLY_OPACITY_TOKEN || 0;
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
          .style("fill", selectedEmotionColor);
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
/* ========= PNG overlay aligned to central SVG <rect> anchor ========= */

/** Torna lo <svg> centrale dentro .center-map */
function __getCenterSvg() {
  return document.querySelector(".col-center .center-map svg");
}

function __findAnchorRect(svg) {
  if (!svg) return null;
  const r = svg.querySelector("#illus-anchor");
  if (!r) {
    console.warn(
      'Rect ancora mancante: aggiungi id="illus-anchor" allo <rect> di riferimento.'
    );
  }
  return r || null;
}

/** Posiziona i PNG (.rooms-illustration) esattamente sopra il rect-ancora */
function __positionIllustrations() {
  const wrap = document.querySelector(".col-center .center-map");
  const svg = __getCenterSvg();
  const anchor = __findAnchorRect(svg);
  const imgs = document.querySelectorAll(
    ".col-center .center-map .rooms-illustration"
  );
  if (!wrap || !svg || !anchor || !imgs.length) return;

  // bounding box reali a schermo (considerano viewBox, preserveAspectRatio e scaling)
  const wrapBox = wrap.getBoundingClientRect();
  const anchorBox = anchor.getBoundingClientRect();

  const left = anchorBox.left - wrapBox.left;
  const top = anchorBox.top - wrapBox.top;
  const w = anchorBox.width;
  const h = anchorBox.height;

  imgs.forEach((img) => {
    img.style.left = left + "px";
    img.style.top = top + "px";
    img.style.width = w + "px";
    img.style.height = h + "px";
  });
}

/** Init + listeners (al load, su resize, e quando cambia lo <svg>) */
(function __initIllustrationAnchor() {
  const onReady = () => __positionIllustrations();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady, { once: true });
  } else {
    onReady();
  }

  // Recompute on resize (debounced)
  let t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(__positionIllustrations, 60);
  });

  // Se il nodo SVG viene rimpiazzato/ricaricato, ricalcola
  const wrap = document.querySelector(".col-center .center-map");
  if (wrap) {
    const mo = new MutationObserver(() => __positionIllustrations());
    mo.observe(wrap, { childList: true, subtree: true });
  }
})();

/* === Recolor timeline bars from legend + ensure filter (never white after redraw) === */
function __getLegendColorBySuffix(suffix) {
  const lis = document.querySelectorAll(".emotions li");
  for (const li of lis) {
    const label = (li.getAttribute("data-emotion") || li.textContent || "")
      .trim()
      .replace(/\s+/g, "_");
    if (label === suffix) {
      const c =
        getComputedStyle(li).getPropertyValue("--c").trim() ||
        (li.querySelector('[style*="--c"]')
          ? getComputedStyle(li.querySelector('[style*="--c"]'))
              .getPropertyValue("--c")
              .trim()
          : "");
      return c || null;
    }
  }
  return null;
}
function recolorTimelinesFromLegend() {
  const sel =
    "#chart-day1 .slot-bars rect.bar:not(.empty), #chart-day2 .slot-bars rect.bar:not(.empty)";
  document.querySelectorAll(sel).forEach((b) => {
    const cls = b.getAttribute("class") || "";
    const m = cls.match(/emo-([A-Za-z0-9_]+)/);
    if (!m) return;
    const suffix = m[1];
    const col = __getLegendColorBySuffix(suffix);
    if (col) {
      b.style.removeProperty("fill");
      b.setAttribute("fill", col);
    }
  });
}
function ensureTimelineColorsAndFilter() {
  recolorTimelinesFromLegend();
  if (typeof filterTimelinesToSelectedEmotion === "function") {
    filterTimelinesToSelectedEmotion();
  }
}

/* ===== Re-highlight delle timeline Giorno1/Giorno2 dopo overlay/refresh ===== */
function applyLegendHighlightToTimelineCharts() {
  const label = (window.__SELECTED_EMOTION_LABEL || "").trim();
  const emoClass = label ? "emo-" + label.replace(/\s+/g, "_") : null;

  // per entrambe le timeline
  const containers = document.querySelectorAll(
    "#chart-day1 .slot-bars, #chart-day2 .slot-bars"
  );
  containers.forEach((cont) => {
    const hasStack = cont.querySelector(".bar-fill"); // se è stacked, niente dimming: l'highlight è la porzione colorata
    const bars = cont.querySelectorAll("rect.bar");

    if (!label || hasStack) {
      // nessuna selezione o modalità stacked → rimuovi dim
      cont
        .querySelectorAll(".dimmed")
        .forEach((n) => n.classList.remove("dimmed"));
      return;
    }

    // modalità standard: dimmi i non corrispondenti (e non empty)
    bars.forEach((b) => {
      const cls = b.getAttribute("class") || "";
      const isEmpty = cls.includes(" empty");
      const isMatch = emoClass && cls.includes(emoClass);
      b.classList.toggle("dimmed", !isEmpty && !isMatch);
    });
  });

  // debug utile
  // console.debug('[HL timeline] label:', label, 'containers:', containers.length);
}
// Riapplika highlight quando i nodi dei grafici cambiano (redraw, refresh, ecc.)
(function observeTimelineContainers() {
  const ids = ["#chart-day1", "#chart-day2"];
  ids.forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const mo = new MutationObserver(() =>
      applyLegendHighlightToTimelineCharts()
    );
    mo.observe(el, { childList: true, subtree: true });
  });
})();

/* ==========================================================================
   [ADD] Show-only-selected emotion on right-side Day1/Day2 timelines
   - Hides all bars that don't match the emotion clicked in the left legend
   - Works across redraw/refresh thanks to MutationObservers
   - Non-invasive: no changes inside createChart(); additive only
   ========================================================================== */

/** Normalize label to CSS class suffix used on bars: 'emo-<slug>' */
function __emotionSlug(label) {
  return String(label || "")
    .trim()
    .replace(/\s+/g, "_");
}

/** Apply filter to both timelines (Day 1 & Day 2) */
function filterTimelinesToSelectedEmotion() {
  const label = (window.__SELECTED_EMOTION_LABEL || "").trim();
  const slug = __emotionSlug(label);
  const emoClass = slug ? "emo-" + slug : null;

  const charts = ["#chart-day1", "#chart-day2"];
  charts.forEach((sel) => {
    const root = document.querySelector(sel);
    if (!root) return;

    // If stacked DOM is present for some reason, we fall back to showing everything
    const hasStack = !!root.querySelector(".slot-bars .bar-fill");
    const bars = root.querySelectorAll(".slot-bars rect.bar");

    if (!emoClass || hasStack) {
      // no selection or stacked mode: show everything
      bars.forEach((b) => (b.style.display = ""));
      return;
    }

    bars.forEach((b) => {
      const cls = b.getAttribute("class") || "";
      const isEmpty = cls.includes(" empty");
      const isMatch = cls.includes(emoClass);
      b.style.display = !isEmpty && isMatch ? "" : "none";
    });
  });
}

/** Re-apply after any redraw/refresh affecting the charts */
(function __observeTimelineRedraws() {
  ["#chart-day1", "#chart-day2"].forEach((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    const mo = new MutationObserver(() => {
      setTimeout(() => {
        ensureTimelineColorsAndFilter();
      }, 0);
    });
    mo.observe(el, { childList: true, subtree: true });
  });
})();

/** Wire legend clicks (capture) to always set globals + filter */
(function __wireLegendFilterCapture() {
  const legend = document.querySelector(".emotions");
  if (!legend) return;
  legend.addEventListener(
    "click",
    (ev) => {
      const li = ev.target.closest("li");
      if (!li || !legend.contains(li)) return;
      const label = (li.getAttribute("data-emotion") || li.textContent || "")
        .toString()
        .trim();

      // toggle selection like UI would do
      const alreadyActive = li.classList.contains("active");
      // set globals
      window.__SELECTED_EMOTION_LABEL = alreadyActive ? null : label;

      // apply immediately
      filterTimelinesToSelectedEmotion();
    },
    true // capture to ensure we always run irrespective of other listeners
  );
})();

/** First run on ready */
(function __firstRunFilter() {
  const run = () => filterTimelinesToSelectedEmotion();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
  } else {
    run();
  }
})();
// ---- tiny utils ----
function __hexToRgb(hex) {
  hex = String(hex || "").trim();
  if (/^#/.test(hex)) hex = hex.slice(1);
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((x) => x + x)
      .join("");
  const n = parseInt(hex, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function __getEmotionColorFromLegend(label) {
  const lis = document.querySelectorAll(".emotions li");
  for (const li of lis) {
    const lab = (
      li.getAttribute("data-emotion") ||
      li.textContent ||
      ""
    ).trim();
    if (lab.toLowerCase() === label.toLowerCase()) {
      const c = getComputedStyle(li).getPropertyValue("--c").trim();
      if (c) return c;
      const dot = li.querySelector('[style*="--c"]');
      if (dot) {
        const d = getComputedStyle(dot).getPropertyValue("--c").trim();
        if (d) return d;
      }
    }
  }
  return null;
}
function __getRowRoom(r) {
  return (r.room ?? r.Room ?? r.area ?? r.Area ?? r.stanza ?? r.Stanza ?? "")
    .toString()
    .trim();
}
function __getRowEmotion(r) {
  return (r.emotion ?? r.Emotion ?? r.emozione ?? r.Emozione ?? "")
    .toString()
    .trim();
}

// Trova tutti i "riquadri interni" nello SVG centrale e capisci a quale stanza appartengono.
function __collectInnerNodesByRoom() {
  const map = new Map();
  const centerSvg =
    document.querySelector(".col-center .center-map svg") ||
    document.querySelector(".col-center svg") ||
    document.querySelector("svg");
  if (!centerSvg) return map;

  const inners = centerSvg.querySelectorAll(
    '[data-role="inner"], .inner-box, [fill="#260F30"], [fill="#260f30"]'
  );

  inners.forEach((node) => {
    const g = node.closest("[data-area],[data-room],[aria-label], g");
    let name = (
      g?.getAttribute?.("data-area") ||
      g?.getAttribute?.("data-room") ||
      g?.getAttribute?.("aria-label") ||
      ""
    )
      .toString()
      .trim();

    if (!name) {
      const t = g?.querySelector?.("text")?.textContent?.trim();
      if (t) name = t;
    }
    if (!name) return;

    if (!map.has(name)) map.set(name, []);
    map.get(name).push(node);

    // Save original fill & fill-opacity once
    if (node.__origFill === undefined) {
      node.__origFill = node.getAttribute("fill");
    }
    if (node.__origFillOpacity === undefined) {
      node.__origFillOpacity = node.getAttribute("fill-opacity");
    }
  });

  return map;
}

// Applica il colore dell'emozione selezionata con alpha proporzionale ai voti per stanza
function applyPerRoomEmotionOpacity(selectedLabel) {
  // Guard against stale/racing calls
  try {
    const curr = (window.__SELECTED_EMOTION_LABEL || "")
      .toString()
      .trim()
      .toLowerCase();
    const lab = (selectedLabel || "").toString().trim().toLowerCase();
    if (lab && curr && lab !== curr) return; // stale selection call after a deselect
    if (!lab && curr) return; // stale reset while a selection is active
  } catch (e) {}

  const rows = window.__ALL_ROWS || [];
  const label = (selectedLabel || "").trim();
  const byRoom = new Map();
  let total = 0;

  for (const r of rows) {
    const emo = (__getRowEmotion(r) || "").toLowerCase();
    if (emo === label.toLowerCase()) {
      const room = __getRowRoom(r);
      if (!room) continue;
      byRoom.set(room, (byRoom.get(room) || 0) + 1);
      total++;
    }
  }

  const innerByRoom = __collectInnerNodesByRoom();

  // Reset if nothing selected or total == 0
  if (!label || total === 0) {
    innerByRoom.forEach((nodes) => {
      nodes.forEach((n) => {
        if (n.__origFill !== undefined) n.setAttribute("fill", n.__origFill);
        if (
          n.__origFillOpacity === undefined ||
          n.__origFillOpacity === null ||
          n.__origFillOpacity === "null"
        ) {
          n.removeAttribute("fill-opacity");
        } else {
          n.setAttribute("fill-opacity", n.__origFillOpacity);
        }
      });
    });
    return;
  }

  // Resolve base color
  let base = __getEmotionColorFromLegend(label) || "#000000";
  let rgb;
  if (/^#/.test(base)) {
    rgb = __hexToRgb(base);
  } else {
    const tmp = document.createElement("div");
    tmp.style.setProperty("color", base);
    document.body.appendChild(tmp);
    const c = getComputedStyle(tmp).color;
    document.body.removeChild(tmp);
    const m = c.match(/(\d+),\s*(\d+),\s*(\d+)/);
    rgb = m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 0, g: 0, b: 0 };
  }

  innerByRoom.forEach((nodes, roomName) => {
    const count = byRoom.get(roomName) || 0;
    const alpha = Math.max(0, Math.min(1, count / total)); // [0..1]
    const baseFill = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    nodes.forEach((n) => {
      n.setAttribute("fill", baseFill);
      n.setAttribute("fill-opacity", alpha.toFixed(4));
    });
  });
}

/* === Patch: neutralize solid-fill and debug (appended safely) ================== */
(function () {
  window.__APPLY_OPACITY_TOKEN = window.__APPLY_OPACITY_TOKEN || 0;
  try {
    // Remove solid fill behavior by overriding the function (global scope expected)
    if (typeof window !== "undefined") {
      window.colorInnerRooms = function () {
        /* removed */
      };
    }
    if (typeof colorInnerRooms === "function") {
      try {
        colorInnerRooms = function () {
          /* removed */
        };
      } catch (e) {}
    }

    // Neutralize debug helpers (if referenced anywhere)
    if (typeof window !== "undefined") {
      window.__debugLogPerRoomRGBA = function () {};
      window.__debugLogInnerRoomsCurrent = function () {};
    }
    try {
      __debugLogPerRoomRGBA = function () {};
    } catch (e) {}
    try {
      __debugLogInnerRoomsCurrent = function () {};
    } catch (e) {}

    // Optional: soften console.table/group to avoid noisy logs (comment out if undesired)
    if (typeof console !== "undefined") {
      try {
        if (typeof console.table === "function") console.table = function () {};
      } catch (e) {}
      try {
        if (typeof console.group === "function") console.group = function () {};
      } catch (e) {}
      try {
        if (typeof console.groupCollapsed === "function")
          console.groupCollapsed = function () {};
      } catch (e) {}
      try {
        if (typeof console.groupEnd === "function")
          console.groupEnd = function () {};
      } catch (e) {}
    }
  } catch (e) {
    // swallow
  }
})();
/* === End patch ================================================================ */

/* ==== OVERRIDES: inner-rooms per-room opacity (clean, no ellipses) ==== */

// Helpers
function __hexToRgb(hex) {
  const m = (hex || "")
    .toString()
    .trim()
    .replace("#", "")
    .match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function __getRowEmotion(r) {
  return (r.emotion || r.Emozione || r.emozione || r.Emotion || "")
    .toString()
    .trim();
}
function __getRowRoom(r) {
  const z = window.ZING || {};
  const areaField =
    z.areaField ||
    (function (rows) {
      if (rows && rows.length) {
        const keys = Object.keys(rows[0]);
        const cand = [
          "area",
          "Area",
          "room",
          "Room",
          "stanza",
          "Stanza",
          "zona",
          "Zona",
          "area_name",
          "AreaName",
          "Postazione",
          "postazione",
        ];
        for (const k of cand) if (keys.includes(k)) return k;
      }
      return null;
    })(z.rows || []);
  const val = areaField
    ? r[areaField]
    : r.area ||
      r.Area ||
      r.room ||
      r.Room ||
      r.stanza ||
      r.Stanza ||
      r.zona ||
      r.Zona;
  return (val || "").toString().trim();
}

// Gather inner nodes grouped by room name
function __collectInnerNodesByRoom() {
  const map = new Map();
  const centerSvg =
    document.querySelector(".col-center .center-map svg") ||
    document.querySelector(".col-center svg") ||
    document.querySelector("svg");
  if (!centerSvg) return map;

  const nodes = centerSvg.querySelectorAll(
    ".room-inner, [data-role='inner'], .inner-box, [fill='#260F30'], [fill='#260f30']"
  );
  nodes.forEach((n) => {
    let name = n.getAttribute("data-areaName") || "";
    if (!name) {
      const g = n.closest("[data-area],[data-room],[aria-label]");
      name =
        (g &&
          (g.getAttribute("data-area") ||
            g.getAttribute("data-room") ||
            g.getAttribute("aria-label"))) ||
        "";
    }
    if (!name && typeof ROOM_AREA_ORDER !== "undefined") {
      // fallback by index order
      const arr = Array.from(nodes);
      const idx = arr.indexOf(n);
      name = (ROOM_AREA_ORDER && ROOM_AREA_ORDER[idx]) || "";
    }
    if (!map.has(name)) map.set(name, []);
    map.get(name).push(n);

    if (n.__origFill === undefined) n.__origFill = n.getAttribute("fill");
    if (n.__origFillOpacity === undefined)
      n.__origFillOpacity = n.getAttribute("fill-opacity");
  });
  return map;
}

// Main apply function
function applyPerRoomEmotionOpacity(selectedLabel) {
  const rows = window.__ALL_ROWS || [];
  const label = (selectedLabel || "").toString().trim();
  const innerByRoom = __collectInnerNodesByRoom();

  // Reset if empty label or no selection
  if (!label) {
    innerByRoom.forEach((nodes) => {
      nodes.forEach((n) => {
        if (n.style) {
          n.style.removeProperty("fill");
          n.style.removeProperty("fill-opacity");
          n.style.removeProperty("opacity");
          if (n.getAttribute("style") === "") n.removeAttribute("style");
        }
      });
    });
    return;
  }

  // Count per room
  const byRoom = new Map();
  let total = 0;
  rows.forEach((r) => {
    const emo = __getRowEmotion(r);
    if (emo && emo.toLowerCase() === label.toLowerCase()) {
      const room = __getRowRoom(r);
      if (!room) return;
      byRoom.set(room, (byRoom.get(room) || 0) + 1);
      total++;
    }
  });

  // Base color from legend or palette
  const baseCss =
    (typeof resolveEmotionColor === "function"
      ? resolveEmotionColor(label)
      : null) ||
    (typeof getEmotionColor === "function" ? getEmotionColor(label) : null) ||
    (EMO_COLORS && (EMO_COLORS.get ? EMO_COLORS.get(label) : null)) ||
    "#000";
  let rgb = null;
  if (/^#/.test(baseCss)) rgb = __hexToRgb(baseCss);
  if (!rgb) {
    const tmp = document.createElement("div");
    tmp.style.color = baseCss;
    document.body.appendChild(tmp);
    const c = getComputedStyle(tmp).color;
    document.body.removeChild(tmp);
    const m = c && c.match(/(\d+),\s*(\d+),\s*(\d+)/);
    rgb = m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 0, g: 0, b: 0 };
  }
  const baseFill = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  innerByRoom.forEach((nodes, roomName) => {
    const count = byRoom.get(roomName) || 0;
    const alpha = total > 0 ? Math.max(0, Math.min(1, count / total)) * 3 : 0;
    nodes.forEach((n) => {
      n.setAttribute("fill", baseFill);
      n.setAttribute("fill-opacity", alpha.toFixed(4));
      if (n.style && n.style.setProperty) {
        n.style.setProperty("fill", baseFill, "important");
        n.style.setProperty("fill-opacity", String(alpha));
      }
    });
  });
}

// Make sure theme recolor won't overwrite inner rooms — already patched above.

// Ensure initial apply uses current selection if any (after first render)
document.addEventListener("DOMContentLoaded", function () {
  try {
    applyPerRoomEmotionOpacity(window.__SELECTED_EMOTION_LABEL || null);
  } catch (e) {}
});

/* === [OVERVIEW LANTERNS] Color by top emotion per room ===================== */
(function () {
  // Expose as global for debugging or manual re-apply
  function colorOverviewLanternsByTopEmotion(rows) {
    try {
      const svg =
        document.querySelector(".col.col-center svg") ||
        document.querySelector(".center-map svg") ||
        document.querySelector("main .col-center svg") ||
        document.querySelector("svg");
      if (!svg) return;
      if (!rows || !rows.length) return;

      const normArea =
        typeof __normArea === "function"
          ? __normArea
          : (v) => (v ?? "").toString().trim();
      const normEmo =
        typeof __normEmo === "function"
          ? __normEmo
          : (v) => (v ?? "").toString().trim();

      const areaField =
        window.ZING && window.ZING.areaField
          ? window.ZING.areaField
          : typeof detectAreaField === "function"
          ? detectAreaField(rows)
          : null;
      const emoField =
        window.ZING && window.ZING.emoField
          ? window.ZING.emoField
          : typeof detectEmotionField === "function"
          ? detectEmotionField(rows)
          : null;
      if (!areaField || !emoField) {
        console.warn("[Lanterns] Missing area/emotion field; abort.", {
          areaField,
          emoField,
        });
        return;
      }

      // Build counts: area -> (emotion -> n)
      const byArea = new Map();
      for (const r of rows) {
        // optional: skip placeholder rows
        if (typeof __isRealFeedRow === "function" && !__isRealFeedRow(r))
          continue;
        const a = normArea(r[areaField]);
        const e = normEmo(r[emoField]);
        if (!a || !e) continue;
        let em = byArea.get(a);
        if (!em) {
          em = new Map();
          byArea.set(a, em);
        }
        em.set(e, (em.get(e) || 0) + 1);
      }

      // Determine dominant per area
      const order = Array.isArray(window.ROOM_AREA_ORDER)
        ? window.ROOM_AREA_ORDER.slice()
        : Array.from(byArea.keys());
      const dominant = new Map();
      for (const areaName of order) {
        const key = normArea(areaName);
        const em = byArea.get(key) || byArea.get(areaName) || new Map();
        let best = null,
          max = -1;
        for (const [emo, n] of em.entries()) {
          if (!emo) continue;
          if (n > max) {
            max = n;
            best = emo;
          }
        }
        dominant.set(key, { emotion: best, count: max });
      }

      // Helper to resolve color
      function _resolveColor(emo) {
        if (!emo) return "#C7C7C7";
        try {
          if (typeof resolveEmotionColor === "function") {
            const c = resolveEmotionColor(emo);
            if (c) return c;
          }
        } catch {}
        try {
          if (typeof getEmotionColor === "function") {
            const c = getEmotionColor(emo);
            if (c) return c;
          }
        } catch {}
        try {
          if (
            window.EMO_COLORS &&
            typeof window.EMO_COLORS.get === "function"
          ) {
            const c = window.EMO_COLORS.get(emo);
            if (c) return c;
          }
        } catch {}
        return "#C7C7C7";
      }

      // Apply to .room-1 ... .room-9
      for (let i = 0; i < order.length; i++) {
        const areaName = order[i];
        const info = dominant.get(normArea(areaName)) || dominant.get(areaName);
        const emo = info ? info.emotion : null;
        const col = _resolveColor(emo);
        const sel = `path.room-${i + 1}`;
        const node = svg.querySelector(sel);
        if (!node) continue;

        if (typeof d3 !== "undefined") {
          d3.select(node)
            .transition()
            .duration(400)
            .attr("fill", col)
            .attr("opacity", emo ? 1 : 0.25)
            .attr("data-emo", emo || "none");
        } else {
          node.setAttribute("fill", col);
          node.setAttribute("opacity", emo ? "1" : "0.25");
          node.setAttribute("data-emo", emo || "none");
        }
      }

      // store last state for potential re-apply
      try {
        window.__LAST_LANTERN_ROWS = rows;
      } catch {}
    } catch (e) {
      console.warn("[Lanterns] failed:", e);
    }
  }

  // Expose globally
  window.colorOverviewLanternsByTopEmotion = colorOverviewLanternsByTopEmotion;
})();

/* === Re-apply overview lantern colors when DOM/theme are ready or change === */
function reapplyLanternsSoon() {
  try {
    const rows = (window.ZING && window.ZING.rows) || [];
    if (
      rows.length &&
      typeof window.colorOverviewLanternsByTopEmotion === "function"
    ) {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          window.colorOverviewLanternsByTopEmotion(rows);
        })
      );
    }
  } catch (e) {
    /* noop */
  }
}
// Observe theme changes
(function () {
  try {
    new MutationObserver(() => reapplyLanternsSoon()).observe(document.body, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  } catch (e) {}
})();
// Observe central SVG changes
(function () {
  try {
    const root = document.querySelector(".col-center") || document;
    new MutationObserver(() => reapplyLanternsSoon()).observe(root, {
      childList: true,
      subtree: true,
    });
  } catch (e) {}
})();

/* ================== ZING PATCH: Room Title Icon (No-Text) ==================
   This block overrides any previous renderRoomTitle/loadRoomIcon implementations
   and guarantees ONLY ONE icon node is present in #room-title-icon at all times.
   It also ignores room text (SVGs already include it), normalizes SVG sizing,
   and adds a MutationObserver to dedupe if other scripts append again.
============================================================================= */

(function () {
  // Simple slug, stable across accents & punctuation
  function slugifyRoom(name) {
    return (name || "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/&/g, "e")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  const ROOM_ICON_CACHE = (window.__ZING_ROOM_ICON_CACHE__ =
    window.__ZING_ROOM_ICON_CACHE__ || new Map());

  async function loadRoomIcon(slug) {
    if (!slug) return null;
    if (ROOM_ICON_CACHE.has(slug)) return ROOM_ICON_CACHE.get(slug);

    // Try inline SVG first
    try {
      const res = await fetch(`./assets/rooms/${slug}.svg`, {
        cache: "force-cache",
      });
      if (res.ok) {
        const svgText = await res.text();
        const wrap = document.createElement("div");
        wrap.innerHTML = svgText.trim();
        const svg = wrap.querySelector("svg");
        if (svg) {
          svg.classList.add("icon-svg", `icon-${slug}`);
          const record = { type: "svg", content: svg };
          ROOM_ICON_CACHE.set(slug, record);
          return record;
        }
      }
    } catch (e) {
      /* ignore */
    }

    // Fallback PNG
    const img = document.createElement("img");
    img.src = `./assets/rooms/${slug}.png`;
    img.alt = "";
    img.decoding = "async";
    img.loading = "lazy";
    img.className = `icon-img icon-${slug}`;
    const record = { type: "img", content: img };
    ROOM_ICON_CACHE.set(slug, record);
    return record;
  }

  // Keep ONLY one child inside #room-title-icon, no matter what
  function dedupeRoomIcon() {
    const iconHost = document.getElementById("room-title-icon");
    if (!iconHost) return;
    while (iconHost.childNodes.length > 1) {
      // keep the last added node (more recent)
      iconHost.removeChild(iconHost.firstChild);
    }
  }

  // Override any previous definitions
  window.renderRoomTitle = async function renderRoomTitle(areaName) {
    const iconHost = document.getElementById("room-title-icon");
    if (!iconHost) return;

    // Always clear first
    iconHost.innerHTML = "";
    if (!areaName) return;

    const slug = slugifyRoom(areaName);
    const rec = await loadRoomIcon(slug);
    if (!rec || !rec.content) return;

    const node = rec.content.cloneNode(true);
    if (node.tagName && node.tagName.toLowerCase() === "svg") {
      node.removeAttribute("width");
      node.removeAttribute("height");
      node.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    // If same icon already there, skip append (paranoia)
    const already = iconHost.querySelector(`.icon-${slug}`);
    if (!already) iconHost.appendChild(node);

    // Ensure only ONE child remains
    dedupeRoomIcon();
  };

  // Setup observer once DOM is ready
  (function setupOnce() {
    if (window.__ZING_ROOM_ICON_OBS__) return; // guard
    const init = () => {
      const iconHost = document.getElementById("room-title-icon");
      if (!iconHost) return;
      const obs = new MutationObserver(() => dedupeRoomIcon());
      obs.observe(iconHost, { childList: true });
      window.__ZING_ROOM_ICON_OBS__ = obs;

      // Also hook close button to clear icon
      const closeBtn = document.getElementById("close-overlay");
      if (closeBtn && !closeBtn.__iconClearBound__) {
        closeBtn.addEventListener("click", () => {
          const host = document.getElementById("room-title-icon");
          if (host) host.innerHTML = "";
        });
        closeBtn.__iconClearBound__ = true;
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  })();
})();
/* ================== /ZING PATCH END ================== */
