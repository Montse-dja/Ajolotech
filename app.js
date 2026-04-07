// app.js — MQTT connection, data handling, UI updates
// Depends on: config.js (loaded first), Chart.js, mqtt.js (loaded from CDN)

const App = (() => {

  // ── State ──────────────────────────────────────────────────
  const state = {
    phData:      [],   // { x: timestamp (ms), y: float }
    tempData:    [],
    count:       0,
    detections:  0,
    phAlerts:    0,
    tempAlerts:  0,
  };

  let client = null;

  // ── DOM refs ───────────────────────────────────────────────
  const $ = id => document.getElementById(id);

  const ui = {
    dot:          $("status-dot"),
    label:        $("status-label"),
    lastSeen:     $("last-seen"),
    valPh:        $("val-ph"),
    valTemp:      $("val-temp"),
    valPresence:  $("val-presence"),
    valConf:      $("val-confidence"),
    badgePh:      $("badge-ph"),
    badgeTemp:    $("badge-temp"),
    rangePh:      $("range-ph"),
    rangeTemp:    $("range-temp"),
    statCount:    $("stat-count"),
    statDet:      $("stat-detections"),
    statPhA:      $("stat-ph-alerts"),
    statTempA:    $("stat-temp-alerts"),
    chartPhRange: $("chart-ph-range"),
    chartTRange:  $("chart-temp-range"),
    log:          $("log"),
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
          time: { tooltipFormat: "HH:mm:ss", displayFormats: { second: "HH:mm:ss", minute: "HH:mm" } },
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

  // Chart.js requires the date adapter for time scale.
  // We use a minimal built-in approach: Chart.js 4 bundles a basic adapter.

  const phChart = new Chart($("chart-ph"), {
    ...chartDefaults,
    data: {
      datasets: [{
        data: state.phData,
        borderColor: "#3ecfb2",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: { target: "origin", above: "rgba(62,207,178,0.04)" },
      }],
    },
    options: {
      ...chartDefaults.options,
      scales: {
        ...chartDefaults.options.scales,
        y: {
          ...chartDefaults.options.scales.y,
          min: 5,
          max: 10,
          ticks: { ...chartDefaults.options.scales.y.ticks, stepSize: 0.5 },
        },
      },
    },
  });

  const tempChart = new Chart($("chart-temp"), {
    ...chartDefaults,
    data: {
      datasets: [{
        data: state.tempData,
        borderColor: "#e8a838",
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.3,
        fill: { target: "origin", above: "rgba(232,168,56,0.04)" },
      }],
    },
    options: {
      ...chartDefaults.options,
      scales: {
        ...chartDefaults.options.scales,
        y: {
          ...chartDefaults.options.scales.y,
          min: 10,
          max: 30,
          ticks: { ...chartDefaults.options.scales.y.ticks, stepSize: 2 },
        },
      },
    },
  });

  // ── Helpers ────────────────────────────────────────────────
  function setStatus(type, text) {
    ui.dot.className   = "status-dot " + type;
    ui.label.textContent = text;
  }

  function isInRange(val, range) {
    return val >= range.min && val <= range.max;
  }

  function fmtTime(ms) {
    return new Date(ms).toLocaleTimeString("en-GB", { hour12: false });
  }

  function addLog(msg, type = "msg") {
    const ts   = fmtTime(Date.now());
    const div  = document.createElement("div");
    div.className = "log-entry " + (type === "error" ? "error" : type === "info" ? "info" : "");
    div.innerHTML = `<span class="ts">${ts}</span><span class="msg">${msg}</span>`;
    ui.log.prepend(div);
    // Keep log from growing unbounded in the DOM
    while (ui.log.children.length > 100) {
      ui.log.removeChild(ui.log.lastChild);
    }
  }

  function trimData(arr) {
    while (arr.length > CONFIG.chart.maxPoints) arr.shift();
  }

  // ── Message handling ───────────────────────────────────────
  function handleMessage(payload) {
    let data;
    try {
      data = JSON.parse(payload);
    } catch {
      addLog("Malformed JSON: " + payload, "error");
      return;
    }

    const { ph, temp_c, axolotl_present, confidence = null, timestamp } = data;

    // Validate required fields
    if (ph === undefined || temp_c === undefined || axolotl_present === undefined) {
      addLog("Missing required fields in payload", "error");
      return;
    }

    const ts = timestamp ? new Date(timestamp).getTime() : Date.now();

    // Update rolling chart data
    state.phData.push({ x: ts, y: parseFloat(ph.toFixed(2)) });
    state.tempData.push({ x: ts, y: parseFloat(temp_c.toFixed(1)) });
    trimData(state.phData);
    trimData(state.tempData);

    // Update counters
    state.count++;
    if (axolotl_present) state.detections++;

    const phOk   = isInRange(ph, CONFIG.thresholds.ph);
    const tempOk = isInRange(temp_c, CONFIG.thresholds.temp);
    if (!phOk)   state.phAlerts++;
    if (!tempOk) state.tempAlerts++;

    // ── Update UI ──────────────────────────────────────────
    // pH card
    ui.valPh.textContent  = ph.toFixed(2);
    ui.valPh.className    = "card-value " + (phOk ? "ok" : "alert");
    ui.badgePh.textContent  = phOk ? "Normal" : "Alert";
    ui.badgePh.className    = "card-badge " + (phOk ? "ok" : "alert");
    ui.rangePh.textContent  = `Range ${CONFIG.thresholds.ph.min}–${CONFIG.thresholds.ph.max}`;

    // Temp card
    ui.valTemp.textContent = temp_c.toFixed(1);
    ui.valTemp.className   = "card-value " + (tempOk ? "ok" : "alert");
    ui.badgeTemp.textContent = tempOk ? "Normal" : "Alert";
    ui.badgeTemp.className   = "card-badge " + (tempOk ? "ok" : "alert");
    ui.rangeTemp.textContent = `Range ${CONFIG.thresholds.temp.min}–${CONFIG.thresholds.temp.max} °C`;

    // Presence card
    ui.valPresence.textContent = axolotl_present ? "DETECTED" : "NOT DETECTED";
    ui.valPresence.className   = "card-presence " + (axolotl_present ? "detected" : "not-detected");
    ui.valConf.textContent     = confidence !== null ? `Confidence: ${(confidence * 100).toFixed(0)}%` : "";

    // Stats
    ui.statCount.textContent = state.count;
    ui.statDet.textContent   = state.detections;
    ui.statPhA.textContent   = state.phAlerts;
    ui.statTempA.textContent = state.tempAlerts;

    // Chart range labels
    if (state.phData.length > 1) {
      const phVals = state.phData.map(d => d.y);
      ui.chartPhRange.textContent =
        `min ${Math.min(...phVals).toFixed(2)}  max ${Math.max(...phVals).toFixed(2)}`;
    }
    if (state.tempData.length > 1) {
      const tVals = state.tempData.map(d => d.y);
      ui.chartTRange.textContent =
        `min ${Math.min(...tVals).toFixed(1)}  max ${Math.max(...tVals).toFixed(1)} °C`;
    }

    // Last seen
    ui.lastSeen.textContent = "Last: " + fmtTime(ts);

    // Charts
    phChart.update("none");
    tempChart.update("none");

    // Log entry
    const presenceTag = axolotl_present ? " [AXOLOTL]" : "";
    addLog(`pH ${ph.toFixed(2)}  temp ${temp_c.toFixed(1)}°C${presenceTag}`);
  }

  // ── MQTT connection ────────────────────────────────────────
  function connect() {
    const url = `${CONFIG.broker.host}:${CONFIG.broker.port}`;
    setStatus("connecting", "Connecting...");
    addLog(`Connecting to ${url}`, "info");

    client = mqtt.connect(url, {
      clientId: CONFIG.broker.clientId,
      clean:    true,
      reconnectPeriod: 3000,
    });

    client.on("connect", () => {
      setStatus("connected", "Connected");
      addLog(`Connected — subscribing to ${CONFIG.broker.topic}`, "info");
      client.subscribe(CONFIG.broker.topic, { qos: 1 }, (err) => {
        if (err) addLog("Subscribe error: " + err.message, "error");
      });
    });

    client.on("message", (_topic, message) => {
      handleMessage(message.toString());
    });

    client.on("reconnect", () => {
      setStatus("connecting", "Reconnecting...");
      addLog("Reconnecting...");
    });

    client.on("close", () => {
      setStatus("disconnected", "Disconnected");
      addLog("Connection closed", "error");
    });

    client.on("error", (err) => {
      addLog("MQTT error: " + err.message, "error");
    });
  }

  // ── Public API ─────────────────────────────────────────────
  function clearLog() {
    ui.log.innerHTML = "";
  }

  // ── Init ───────────────────────────────────────────────────
  connect();

  return { clearLog };

})();
