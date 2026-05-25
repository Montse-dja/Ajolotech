// config.js — broker settings, chart options, and MQTT→internal key map
//
// MQTT payload key map (what the Arduino/Python sends → internal name used in app.js)
// Only edit the LEFT side (mqtt keys) if the hardware team changes field names.
// Never rename the RIGHT side — internal names match variable comments in thresholds.js.

const CONFIG = {
  broker: {
    host:     "wss://teams-shortly-ministries-belief.trycloudflare.com",
    port:     443,
    topic:    "arduino/sensors/data",
    clientId: "dashboard-" + Math.random().toString(16).slice(2),
  },

  chart: { maxPoints: 50 },

  // Maps incoming JSON keys → internal variable names used throughout app.js
  // Left  = exact key the hardware sends in JSON
  // Right = internal name (do not change the right side)
  keyMap: {
    "temperatura":        "temp_c",
    "ph":                 "ph",
    "oxigeno_disuelto":   "dissolved_o2",   // reserved — not yet displayed
    "turbidez":           "turbidity",
    "humedad":            "humidity",
    "voltaje":            "voltage",
    "corriente":          "current",
    "panel_solar":        "solar_active",   // boolean or "activo"/"apagado"
    "presencia_ajolote":  "axolotl_present",// boolean
    "confianza_ia":       "confidence",     // 0–1 float  OR  0–100 int (both handled)
  },
};
