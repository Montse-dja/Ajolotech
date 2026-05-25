// thresholds.js — Alert ranges for all sensor variables
// Edit this file to update critical values without touching app logic.
//
// Internal name → { min, max }  (null means "no lower/upper bound")
//
// var1  = temp_c          Temperatura (°C)
// var2  = ph              pH
// var3  = dissolved_o2    Oxígeno disuelto (mg/L)  — reserved, not displayed yet
// var4  = turbidity       Turbidez (NTU)
// var5  = humidity        Humedad módulo (%)
// var6  = voltage         Voltaje (V)
// var7  = current         Corriente (A)

const THRESHOLDS = {
  temp_c:       { min: 14,   max: 20   },   // °C — axolotl comfort range
  ph:           { min: 6.5,  max: 8.0  },   // pH
  dissolved_o2: { min: 5.0,  max: null },   // mg/L — reserved
  turbidity:    { min: null, max: 10   },   // NTU — clear water
  humidity:     { min: 30,   max: 80   },   // % — module enclosure
  voltage:      { min: 11.0, max: 15.0 },   // V  — solar panel / battery
  current:      { min: null, max: 5.0  },   // A  — overcurrent guard
};
