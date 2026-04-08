const CONFIG = {
  broker: {
    host:     "ws://10.48.207.30",
    port:     9001,
    topic:    "axolotech/lake/sensor",
    clientId: "dashboard-" + Math.random().toString(16).slice(2),
  },
  chart: { maxPoints: 50 },
  thresholds: {
    ph:   { min: 6.5, max: 8.5 },
    temp: { min: 14,  max: 20  },
  },
};
