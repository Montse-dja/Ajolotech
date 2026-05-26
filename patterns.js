// patterns.js — Pattern analysis page logic
// Depends on: thresholds.js, config.js
//
// When CONFIG.api.historyEndpoint is set and DynamoDB stores per-reading rows,
// this file will fetch real data. Until then it shows a pending state.

const Patterns = (() => {

  const $ = id => document.getElementById(id);

  // ── State ──────────────────────────────────────────────────
  let activeRange = "day";
  let allReadings    = [];   // full history from API
  let axoReadings    = [];   // only readings where axolotl_present = true

  // ── Chart defaults (matches main dashboard style) ─────────
  const chartBase = {
    type: "line",
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: "#6b7068", font: { family: "IBM Plex Mono", size: 11 } } },
        tooltip: {
          backgroundColor: "#1c1f1c",
          borderColor: "#2a2e2a",
          borderWidth: 1,
          titleColor: "#6b7068",
          bodyColor: "#d6dbd6",
          titleFont: { family: "IBM Plex Mono", size: 11 },
          bodyFont:  { family: "IBM Plex Mono", size: 12 },
        },
      },
      scales: {
        x: {
          type: "time",
          time: { tooltipFormat: "dd/MM HH:mm", displayFormats: { hour: "HH:mm", day: "dd/MM" } },
          ticks: { color: "#3f433f", font: { family: "IBM Plex Mono", size: 10 }, maxTicksLimit: 8 },
          grid:  { color: "#1c1f1c" },
          border:{ color: "#2a2e2a" },
        },
        y: {
          ticks: { color: "#6b7068", font: { family: "IBM Plex Mono", size: 11 } },
          grid:  { color: "#1c1f1c" },
          border:{ color: "#2a2e2a" },
        },
      },
    },
  };

  // ── Charts ─────────────────────────────────────────────────
  const lakeChart = new Chart($("chart-lake"), {
    ...chartBase,
    data: {
      datasets: [
        { label: "Temperatura °C", data: [], borderColor: "#c084fc", borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
        { label: "pH",             data: [], borderColor: "#38bdf8", borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
        { label: "Turbidez NTU",   data: [], borderColor: "#818cf8", borderWidth: 1.5, pointRadius: 0, tension: 0.3 },
      ],
    },
  });

  const axolotlChart = new Chart($("chart-axolotl"), {
    ...chartBase,
    data: {
      datasets: [
        { label: "Temp. en detección °C", data: [], borderColor: "#c084fc", borderWidth: 1.5, pointRadius: 3, tension: 0.3 },
        { label: "pH en detección",       data: [], borderColor: "#38bdf8", borderWidth: 1.5, pointRadius: 3, tension: 0.3 },
      ],
    },
  });

  // ── Helpers ────────────────────────────────────────────────
  function avg(arr, key) {
    const vals = arr.map(r => parseFloat(r[key])).filter(v => !isNaN(v));
    if (!vals.length) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  function minMax(arr, key) {
    const vals = arr.map(r => parseFloat(r[key])).filter(v => !isNaN(v));
    if (!vals.length) return null;
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }

  function setVal(id, value, decimals = 2) {
    const el = $(id);
    if (!el) return;
    el.textContent = value !== null ? value.toFixed(decimals) : "—";
  }

  function setRange(id, mm, unit) {
    const el = $(id);
    if (!el || !mm) return;
    el.textContent = `min ${mm.min.toFixed(1)}  max ${mm.max.toFixed(1)} ${unit}`;
  }

  // ── Populate lake stats ────────────────────────────────────
  function populateLake(readings) {
    if (!readings.length) return;

    setVal("lake-temp-avg", avg(readings, "var1"), 1);
    setRange("lake-temp-range", minMax(readings, "var1"), "°C");

    setVal("lake-ph-avg", avg(readings, "var2"), 2);
    setRange("lake-ph-range", minMax(readings, "var2"), "pH");

    setVal("lake-turb-avg", avg(readings, "var4"), 1);
    setRange("lake-turb-range", minMax(readings, "var4"), "NTU");

    setVal("lake-hum-avg", avg(readings, "var5"), 1);
    setRange("lake-hum-range", minMax(readings, "var5"), "%");

    setVal("lake-volt-avg", avg(readings, "var6"), 2);
    setRange("lake-volt-range", minMax(readings, "var6"), "V");

    $("lake-total").textContent = readings.length;
    $("lake-note").textContent  = `${readings.length} lecturas analizadas en el período seleccionado.`;

    // Chart datasets
    lakeChart.data.datasets[0].data = readings.map(r => ({ x: r.timestamp, y: parseFloat(r.var1) }));
    lakeChart.data.datasets[1].data = readings.map(r => ({ x: r.timestamp, y: parseFloat(r.var2) }));
    lakeChart.data.datasets[2].data = readings.map(r => ({ x: r.timestamp, y: parseFloat(r.var4) }));
    lakeChart.update("none");
  }

  // ── Populate axolotl stats ─────────────────────────────────
  function populateAxolotl(all, axo) {
    if (!all.length) return;

    const rate = all.length > 0 ? (axo.length / all.length) * 100 : 0;

    $("axo-detections").textContent = axo.length;
    $("axo-rate").textContent       = rate.toFixed(1);
    $("axo-rate-range").textContent = `de ${all.length} lecturas totales`;

    if (axo.length) {
      setVal("axo-temp-avg", avg(axo, "var1"), 1);
      setRange("axo-temp-range", minMax(axo, "var1"), "°C");

      setVal("axo-ph-avg", avg(axo, "var2"), 2);
      setRange("axo-ph-range", minMax(axo, "var2"), "pH");

      setVal("axo-turb-avg", avg(axo, "var4"), 1);
      setRange("axo-turb-range", minMax(axo, "var4"), "NTU");

      setVal("axo-hum-avg", avg(axo, "var5"), 1);
      setRange("axo-hum-range", minMax(axo, "var5"), "%");

      $("axo-note").textContent =
        `Promedio de condiciones en ${axo.length} detecciones de ajolote.`;

      axolotlChart.data.datasets[0].data = axo.map(r => ({ x: r.timestamp, y: parseFloat(r.var1) }));
      axolotlChart.data.datasets[1].data = axo.map(r => ({ x: r.timestamp, y: parseFloat(r.var2) }));
      axolotlChart.update("none");
    }
  }

  // ── Fetch history from API ─────────────────────────────────
  // CONFIG.api.historyEndpoint should be set once the Lambda/DynamoDB history
  // endpoint is ready. Until then, the page shows the pending notice.
  async function fetchHistory(range) {
    if (!CONFIG.api.historyEndpoint) {
      $("patterns-status").textContent = "Endpoint de historial no configurado aún";
      return;
    }

    $("patterns-status").textContent = "Cargando...";

    try {
      const url = `${CONFIG.api.historyEndpoint}?range=${range}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      // Expected format: array of reading objects with timestamp + var1..var10
      allReadings = json;
      axoReadings = json.filter(r =>
        r.var9 === true || r.var9 === "True" || r.var9 === "true" || r.var9 === 1
      );

      populateLake(allReadings);
      populateAxolotl(allReadings, axoReadings);

      $("patterns-status").textContent =
        `${allReadings.length} lecturas · ${axoReadings.length} detecciones de ajolote`;

    } catch (err) {
      $("patterns-status").textContent = "Error al cargar historial: " + err.message;
    }
  }

  // ── Range buttons ──────────────────────────────────────────
  document.querySelectorAll(".range-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".range-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeRange = btn.dataset.range;
      fetchHistory(activeRange);
    });
  });

  // ── Hamburger ──────────────────────────────────────────────
  const hamburger = $("hamburger");
  const drawer    = $("nav-drawer");
  const overlay   = $("nav-overlay");

  function toggleNav(open) {
    drawer.classList.toggle("open", open);
    overlay.classList.toggle("open", open);
    hamburger.classList.toggle("open", open);
  }

  hamburger.addEventListener("click", () => toggleNav(!drawer.classList.contains("open")));
  overlay.addEventListener("click",   () => toggleNav(false));

  // ── Init ───────────────────────────────────────────────────
  fetchHistory(activeRange);

})();
