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
  temp_c:       { min: 14,   max: 19   },   // °C — axolotl comfort range
  ph:           { min: 6.5,  max: 8.0  },   // pH
  dissolved_o2: { min: 5.0,  max: null },   // mg/L — reserved
  turbidity:    { min: 800, max: 1024   },   // NTU — clear water
  humidity:     { min: 0,   max: 70   },   // % — module enclosure
  voltage:      { min: 11.2, max: 12.8 },   // V  — solar panel / battery
  current:      { min: null, max: 3.0  },   // A  — overcurrent guard
};
