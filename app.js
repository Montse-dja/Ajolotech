// app.js — MQTT connection, data handling, UI updates
// Depends on: thresholds.js, config.js (both loaded first), Chart.js, mqtt.js (CDN)

const App = (() => {

  // ── State ──────────────────────────────────────────────────
  // Chartable variables — each has a rolling data array for the time-series graph
  const chartSeries = {
    temp_c:    [],
    ph:        [],
    turbidity: [],
    humidity:  [],
    voltage:   [],
    current:   [],
  };

  const state = {
    count:        0,
    detections:   0,
    alerts: {
      temp_c:    0,
      ph:        0,
      turbidity: 0,
      humidity:  0,
      voltage:   0,
      current:   0,
    },
    activeChart: "temp_c",   // which series the single chart is showing
  };

  let client = null;

  // ── DOM refs ───────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const ui = {
    // Topbar
    dot:          $("status-dot"),
    label:        $("status-label"),
    lastSeen:     $("last-seen"),
    // Temp card
    valTemp:      $("val-temp"),
    badgeTemp:    $("badge-temp"),
    rangeTemp:    $("range-temp"),
    // pH card
    valPh:        $("val-ph"),
    badgePh:      $("badge-ph"),
    rangePh:      $("range-ph"),
    // Turbidity card
    valTurb:      $("val-turbidity"),
    badgeTurb:    $("badge-turbidity"),
    rangeTurb:    $("range-turbidity"),
    // Humidity card
    valHumidity:  $("val-humidity"),
    badgeHumidity:$("badge-humidity"),
    rangeHumidity:$("range-humidity"),
    // Energy card
    valVoltage:   $("val-voltage"),
    badgeVoltage: $("badge-voltage"),
    valCurrent:   $("val-current"),
    badgeCurrent: $("badge-current"),
    solarStatus:  $("solar-status"),
    solarDot:     $("solar-dot"),
    // Axolotl card
    valPresence:  $("val-presence"),
    valConf:      $("val-confidence"),
    axolotlIcon:  $("axolotl-icon"),
    // Stats card
    statCount:    $("stat-count"),
    statDet:      $("stat-detections"),
    // Single chart
    chartTitle:   $("chart-title-label"),
    chartRange:   $("chart-range-label"),
    chartBtns:    document.querySelectorAll(".chart-btn"),
    // Log
    log:          $("log"),
  };

  // ── Chart labels ───────────────────────────────────────────
  const CHART_META = {
    temp_c:    { label: "Temperatura",  unit: "°C",   color: "#e8a838", min: 5,   max: 35  },
    ph:        { label: "pH",           unit: "pH",   color: "#3ecfb2", min: 5,   max: 10  },
    turbidity: { label: "Turbidez",     unit: "NTU",  color: "#a87bff", min: 0,   max: 100 },
    humidity:  { label: "Humedad",      unit: "%",    color: "#5bb8ff", min: 0,   max: 100 },
    voltage:   { label: "Voltaje",      unit: "V",    color: "#FF63A1", min: 0,   max: 20  },
    current:   { label: "Corriente",    unit: "A",    color: "#ff9a5c", min: 0,   max: 10  },
  };

  // ── Chart setup ────────────────────────────────────────────
  const chartDefaults = {
    type: "line",
    options: {
      animation: false,
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "nearest", intersect: false },
      plugins: {
        legend: { display: false },
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
          time: {
            tooltipFormat: "HH:mm:ss",
            displayFormats: { second: "HH:mm:ss", minute: "HH:mm" },
          },
          ticks: { color: "#3f433f", font: { family: "IBM Plex Mono", size: 10 }, maxTicksLimit: 6 },
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

  const activeKey = () => state.activeChart;
  const activeMeta = () => CHART_META[activeKey()];

  const mainChart = new Chart($("chart-main"), {
    ...chartDefaults,
    data: {
      datasets: [{
        data: chartSeries[state.activeChart],
        borderColor: activeMeta().color,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: { target: "origin", above: activeMeta().color + "0a" },
      }],
    },
    options: {
      ...chartDefaults.options,
      scales: {
        ...chartDefaults.options.scales,
        y: {
          ...chartDefaults.options.scales.y,
          min: activeMeta().min,
          max: activeMeta().max,
        },
      },
    },
  });

  // ── Helpers ────────────────────────────────────────────────
  function setStatus(type, text) {
    ui.dot.className     = "status-dot " + type;
    ui.label.textContent = text;
  }

  function isInRange(val, key) {
    const t = THRESHOLDS[key];
    if (!t) return true;
    const okMin = t.min === null || val >= t.min;
    const okMax = t.max === null || val <= t.max;
    return okMin && okMax;
  }

  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString("en-GB", { hour12: false });
  }

  function addLog(msg, type = "msg") {
    const ts  = fmtTime(Date.now());
    const div = document.createElement("div");
    div.className = "log-entry " + (type === "error" ? "error" : type === "info" ? "info" : "");
    div.innerHTML = `<span class="ts">${ts}</span><span class="msg">${msg}</span>`;
    ui.log.prepend(div);
    while (ui.log.children.length > 100) ui.log.removeChild(ui.log.lastChild);
  }

  function trimData(arr) {
    while (arr.length > CONFIG.chart.maxPoints) arr.shift();
  }

  // Remap incoming JSON keys using CONFIG.keyMap
  function remapPayload(raw) {
    const out = {};
    for (const [mqttKey, internalKey] of Object.entries(CONFIG.keyMap)) {
      if (raw[mqttKey] !== undefined) out[internalKey] = raw[mqttKey];
    }
    // Also allow direct internal key names (e.g. from mock.js)
    for (const internalKey of Object.values(CONFIG.keyMap)) {
      if (raw[internalKey] !== undefined && out[internalKey] === undefined) {
        out[internalKey] = raw[internalKey];
      }
    }
    return out;
  }

  // Update a small sensor card (temp, ph, turbidity, humidity)
  function updateSensorCard(valEl, badgeEl, rangeEl, value, key, unit, decimals) {
    const ok = isInRange(value, key);
    const t  = THRESHOLDS[key];
    valEl.textContent  = value.toFixed(decimals);
    valEl.className    = "card-value " + (ok ? "ok" : "alert");
    badgeEl.textContent = ok ? "Normal" : "Alerta";
    badgeEl.className  = "card-badge " + (ok ? "ok" : "alert");
    if (rangeEl && t) {
      const lo = t.min !== null ? t.min : "—";
      const hi = t.max !== null ? t.max : "—";
      rangeEl.textContent = `Rango ${lo}–${hi} ${unit}`;
    }
    if (!ok) state.alerts[key]++;
  }

  // ── Switch chart variable ──────────────────────────────────
  function switchChart(key) {
    state.activeChart = key;
    const meta = CHART_META[key];

    mainChart.data.datasets[0].data        = chartSeries[key];
    mainChart.data.datasets[0].borderColor = meta.color;
    mainChart.data.datasets[0].fill        = { target: "origin", above: meta.color + "0a" };
    mainChart.options.scales.y.min         = meta.min;
    mainChart.options.scales.y.max         = meta.max;

    ui.chartTitle.textContent = meta.label + " — histórico";
    updateChartRange(key);
    mainChart.update("none");

    ui.chartBtns.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.key === key);
    });
  }

  function updateChartRange(key) {
    const data = chartSeries[key];
    if (data.length > 1) {
      const vals = data.map(d => d.y);
      const meta = CHART_META[key];
      ui.chartRange.textContent =
        `min ${Math.min(...vals).toFixed(2)}  max ${Math.max(...vals).toFixed(2)} ${meta.unit}`;
    }
  }

  // ── Message handling ───────────────────────────────────────
  function handleMessage(payload) {
    let raw;
    try {
      raw = JSON.parse(payload);
    } catch {
      addLog("JSON inválido: " + payload, "error");
      return;
    }

    const data = remapPayload(raw);

    // Required: temp_c and ph
    if (data.temp_c === undefined || data.ph === undefined) {
      addLog("Faltan campos obligatorios (temp_c, ph)", "error");
      return;
    }

    const ts = Date.now();

    // ── Push time-series data ──────────────────────────────
    function pushSeries(key, val, decimals) {
      if (val === undefined) return;
      chartSeries[key].push({ x: ts, y: parseFloat(val.toFixed(decimals)) });
      trimData(chartSeries[key]);
    }

    pushSeries("temp_c",    data.temp_c,    1);
    pushSeries("ph",        data.ph,        2);
    pushSeries("turbidity", data.turbidity, 1);
    pushSeries("humidity",  data.humidity,  1);
    pushSeries("voltage",   data.voltage,   2);
    pushSeries("current",   data.current,   3);

    // ── Sensor cards ──────────────────────────────────────
    updateSensorCard(ui.valTemp,     ui.badgeTemp,     ui.rangeTemp,     data.temp_c,    "temp_c",    "°C",  1);
    updateSensorCard(ui.valPh,       ui.badgePh,       ui.rangePh,       data.ph,        "ph",        "pH",  2);

    if (data.turbidity !== undefined) {
      updateSensorCard(ui.valTurb,   ui.badgeTurb,     ui.rangeTurb,     data.turbidity, "turbidity", "NTU", 1);
    }
    if (data.humidity !== undefined) {
      updateSensorCard(ui.valHumidity, ui.badgeHumidity, ui.rangeHumidity, data.humidity, "humidity",  "%",   1);
    }

    // ── Energy card ───────────────────────────────────────
    if (data.voltage !== undefined) {
      const vOk = isInRange(data.voltage, "voltage");
      ui.valVoltage.textContent  = data.voltage.toFixed(2);
      ui.valVoltage.className    = "energy-value " + (vOk ? "ok" : "alert");
      ui.badgeVoltage.textContent = vOk ? "Normal" : "Alerta";
      ui.badgeVoltage.className  = "energy-badge " + (vOk ? "ok" : "alert");
      if (!vOk) state.alerts.voltage++;
    }
    if (data.current !== undefined) {
      const iOk = isInRange(data.current, "current");
      ui.valCurrent.textContent  = data.current.toFixed(3);
      ui.valCurrent.className    = "energy-value " + (iOk ? "ok" : "alert");
      ui.badgeCurrent.textContent = iOk ? "Normal" : "Alerta";
      ui.badgeCurrent.className  = "energy-badge " + (iOk ? "ok" : "alert");
      if (!iOk) state.alerts.current++;
    }

    // Solar panel — accept boolean, or strings "activo"/"apagado"
    if (data.solar_active !== undefined) {
      const isOn = data.solar_active === true
                || data.solar_active === 1
                || String(data.solar_active).toLowerCase() === "activo";
      ui.solarStatus.textContent = isOn ? "Panel solar: ACTIVO" : "Panel solar: APAGADO";
      ui.solarDot.className      = "solar-dot " + (isOn ? "on" : "off");
    }

    // ── Axolotl card ──────────────────────────────────────
    const axolotl_present = data.axolotl_present !== undefined ? data.axolotl_present : null;
    // confidence may arrive as 0–1 float OR 0–100 int — normalise to 0–1
    let confidence = null;
    if (data.confidence !== undefined && data.confidence !== null) {
      confidence = data.confidence > 1 ? data.confidence / 100 : data.confidence;
    }

    state.count++;
    if (axolotl_present === true) state.detections++;

    if (axolotl_present === null) {
      ui.valPresence.textContent = "PENDIENTE";
      ui.valPresence.className   = "card-presence not-detected";
      ui.valConf.textContent     = "Módulo CV no conectado";
      ui.axolotlIcon.classList.add("hidden");
    } else {
      ui.valPresence.textContent = axolotl_present ? "DETECTADO" : "NO DETECTADO";
      ui.valPresence.className   = "card-presence " + (axolotl_present ? "detected" : "not-detected");
      ui.valConf.textContent     = confidence !== null
        ? `Confianza IA: ${(confidence * 100).toFixed(0)}%`
        : "";
      ui.axolotlIcon.classList.toggle("hidden", !axolotl_present);
    }

    // ── Stats ─────────────────────────────────────────────
    ui.statCount.textContent = state.count;
    ui.statDet.textContent   = state.detections;
    ui.lastSeen.textContent  = "Última: " + fmtTime(ts);

    // ── Chart ─────────────────────────────────────────────
    updateChartRange(state.activeChart);
    mainChart.update("none");

    const tag = axolotl_present === true ? " [AJOLOTE]" : "";
    addLog(`pH ${data.ph.toFixed(2)}  temp ${data.temp_c.toFixed(1)}°C${tag}`);
  }

  // ── MQTT connection ────────────────────────────────────────
  function connect() {
    const url = `${CONFIG.broker.host}:${CONFIG.broker.port}`;
    setStatus("connecting", "Conectando...");
    addLog(`Conectando a ${url}`, "info");

    client = mqtt.connect(url, {
      clientId:        CONFIG.broker.clientId,
      clean:           true,
      reconnectPeriod: 3000,
    });

    client.on("connect", () => {
      setStatus("connected", "Conectado");
      addLog(`Conectado — suscrito a ${CONFIG.broker.topic}`, "info");
      client.subscribe(CONFIG.broker.topic, { qos: 1 }, (err) => {
        if (err) addLog("Error al suscribir: " + err.message, "error");
      });
    });

    client.on("message", (_topic, message) => {
      handleMessage(message.toString());
    });

    client.on("reconnect", () => {
      setStatus("connecting", "Reconectando...");
      addLog("Reconectando...");
    });

    client.on("close", () => {
      setStatus("disconnected", "Desconectado");
      addLog("Conexión cerrada", "error");
    });

    client.on("error", (err) => {
      addLog("Error MQTT: " + err.message, "error");
    });
  }

  // ── Chart button listeners ─────────────────────────────────
  ui.chartBtns.forEach(btn => {
    btn.addEventListener("click", () => switchChart(btn.dataset.key));
  });

  // Init chart title
  ui.chartTitle.textContent = CHART_META[state.activeChart].label + " — histórico";
  ui.chartBtns.forEach(btn => {
    btn.classList.toggle("active", btn.dataset.key === state.activeChart);
  });

  // ── Public API ─────────────────────────────────────────────
  function clearLog() { ui.log.innerHTML = ""; }

  connect();

  return { clearLog, switchChart };

})();
