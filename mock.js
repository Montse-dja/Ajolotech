(function () {
  const INTERVAL_MS = 2000;
  let ph = 7.2, temp = 17.0;
  function drift(v, step, min, max) {
    return Math.min(max, Math.max(min, v + (Math.random() - 0.5) * step));
  }
  function makePayload() {
    ph   = drift(ph,   0.15, 5.5, 9.5);
    temp = drift(temp, 0.4,  10,  28);
    const present = Math.random() < 0.30;
    const confidence = present ? 0.70 + Math.random() * 0.29 : Math.random() * 0.25;
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      ph: parseFloat(ph.toFixed(2)),
      temp_c: parseFloat(temp.toFixed(1)),
      axolotl_present: present,
      confidence: parseFloat(confidence.toFixed(2)),
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
  const banner = document.createElement("div");
  banner.style.cssText = "position:fixed;bottom:16px;right:16px;background:#5c3f10;color:#e8a838;font-family:monospace;font-size:11px;padding:6px 14px;border-radius:4px;border:1px solid #e8a838;z-index:9999;";
  banner.textContent = "SIMULATION MODE — not connected to real hardware";
  document.body.appendChild(banner);
})();
