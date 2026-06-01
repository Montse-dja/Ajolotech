// config.js — broker settings, chart options, and MQTT→internal key map
//
// MQTT payload key map (what the Arduino/Python sends → internal name used in app.js)
// Only edit the LEFT side (mqtt keys) if the hardware team changes field names.
// Never rename the RIGHT side — internal names match variable comments in thresholds.js.

const CONFIG = {
  api: {
    endpoint:        "https://rbk7ljo1b0.execute-api.us-east-1.amazonaws.com/prod/vars",
    historyEndpoint: "https://rbk7ljo1b0.execute-api.us-east-1.amazonaws.com/prod/history",
    solarEndpoint:   "https://rbk7ljo1b0.execute-api.us-east-1.amazonaws.com/prod/vars", 
    pollInterval:    5000, //ms
  },

  chart: { maxPoints: 50 },

  // Image prefix — prepended to raw base64 string from var11
  // Change "jpeg" to "png" here if camera format changes
  imagePrefix: "data:image/jpeg;base64,",

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
    "var11": "camera_frame",    // raw base64 image string from underwater camera
    "var12": "solar_manual",    // boolean — written by dashboard, read by Arduino
  }
};
