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
    "var1":  "temp_c",
    "var2":  "ph",
    "var3":  "dissolved_o2",
    "var4":  "turbidity",
    "var5":  "humidity",
    "var6":  "voltage",
    "var7":  "current",
    "var8":  "solar_active",
    "var9":  "axolotl_present",
    "var10": "confidence",
  }
};
