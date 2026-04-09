const CONFIG = {
  broker: {
    host:     "wss://teams-shortly-ministries-belief.trycloudflare.com",   // broker machine IP — change to wss:// for prod
    port:     443,                    // WebSocket port on Mosquitto
    topic:    "arduino/sensors/data",  // must match exactly what Arduino publishes to
    clientId: "dashboard-" + Math.random().toString(16).slice(2),
  },
  chart: { maxPoints: 50 },
  thresholds: {
    ph:   { min: 6.5, max: 8 },
    temp: { min: 20,  max: 22  },
  },
};
