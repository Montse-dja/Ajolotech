// mock.js — Simulation mode. Sends fake sensor data via fake MQTT client.
// Mimics the exact JSON keys the real hardware will send (left side of CONFIG.keyMap).
// Remove this <script> tag from index.html when real sensors are connected.

(function () {
  const INTERVAL_MS = 2000;

  // Starting values
  let temperatura = 17.0;
  let ph          = 7.2;
  let turbidez    = 5.0;
  let humedad     = 55.0;
  let voltaje     = 12.6;
  let corriente   = 1.2;

  function drift(v, step, min, max) {
    return Math.min(max, Math.max(min, v + (Math.random() - 0.5) * step));
  }

  function makePayload() {
    temperatura = drift(temperatura, 1.0,  10,  26);
    ph          = drift(ph,          0.15,  5.5,  9.5);
    turbidez    = drift(turbidez,    1.5,   0,   30);
    humedad     = drift(humedad,     2.0,  20,   95);
    voltaje     = drift(voltaje,     0.3,   9,   16);
    corriente   = drift(corriente,   0.2,   0,    6);

    const present    = Math.random() < 0.30;
    const confianza  = present
      ? 0.70 + Math.random() * 0.29
      : Math.random() * 0.25;
    const panel      = Math.random() < 0.80;  // 80% chance solar is active

    return JSON.stringify({
      timestamp:          new Date().toISOString(),
      temperatura:        parseFloat(temperatura.toFixed(1)),
      ph:                 parseFloat(ph.toFixed(2)),
      turbidez:           parseFloat(turbidez.toFixed(1)),
      humedad:            parseFloat(humedad.toFixed(1)),
      voltaje:            parseFloat(voltaje.toFixed(2)),
      corriente:          parseFloat(corriente.toFixed(3)),
      panel_solar:        panel,
      presencia_ajolote:  present,
      confianza_ia:       parseFloat(confianza.toFixed(2)),
    });
  }

  const fakeClient = {
    _handlers: {},
    on(event, fn) { this._handlers[event] = fn; return this; },
    subscribe(_t, _o, cb) { if (cb) cb(null); return this; },
    end() {},
    _emit(event, ...args) { if (this._handlers[event]) this._handlers[event](...args); },
  };

  window.mqtt = {
    connect(_url, _opts) {
      setTimeout(() => {
        fakeClient._emit("connect");
        setInterval(() => {
          fakeClient._emit("message", CONFIG.broker.topic, makePayload());
        }, INTERVAL_MS);
      }, 600);
      return fakeClient;
    },
  };

  // Simulation banner
  const banner = document.createElement("div");
  banner.style.cssText = [
    "position:fixed",
    "bottom:16px",
    "right:16px",
    "background:#5c3f10",
    "color:#e8a838",
    "font-family:monospace",
    "font-size:11px",
    "padding:6px 14px",
    "border-radius:4px",
    "border:1px solid #e8a838",
    "z-index:9999",
  ].join(";");
  banner.textContent = "MODO SIMULACIÓN — sin hardware real";
  document.body.appendChild(banner);
})();
