// #include <Arduino_RouterBridge.h>
// #include <OneWire.h>
// #include <DallasTemperature.h>

// #define ONE_WIRE_BUS 2
// OneWire oneWire(ONE_WIRE_BUS);
// DallasTemperature sensors(&oneWire);

// void setup() {
//   // Use the standard Bridge setup
//   Bridge.begin(115200);
  
//   // Link the name Python uses to the function that returns the data
//   Bridge.provide("get_temperature", read_sensor);

//   sensors.begin();
// }

// void loop() {
//   // Bridge.update() handles the communication in the background
//   Bridge.update();
// }

// // --- This MUST return a float for the Bridge to send it to Python ---
// float read_sensor() {
//   sensors.requestTemperatures();
//   float interiorFloat = sensors.getTempCByIndex(0);
  
//   // This allows you to still see it in the Monitor while sending to Python
//   Monitor.print("Lectura local: ");
//   Monitor.println(interiorFloat);
  
//   return interiorFloat; // This sends the value to the Python 'Bridge.call'
// }
