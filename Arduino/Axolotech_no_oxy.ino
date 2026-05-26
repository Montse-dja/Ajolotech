#include <Arduino_RouterBridge.h>
#include <Arduino_RPClite.h>
#include <Wire.h>
#include <Adafruit_INA219.h>
#include <DHT.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// --- Pin Definitions ---
#define DHTPIN 4          // AM2302 (DHT22) moved to D4 to avoid conflicts
#define ONE_WIRE_BUS 2    // DS18B20 external temp on D2
#define PH_PIN A0         // pH Sensor on A0
#define OXYGEN_PIN A2     // Oxygen Sensor on A2
#define PHOTO1_PIN A3     // Photoresistor 1 on A3
#define PHOTO2_PIN A4     // Photoresistor 2 on A4
#define TURBIDITY_PIN A5  // Turbidity Sensor on A5
#define VOLTAGE_PIN A1    // FZ0430 Voltage Sensor on A6

// --- Sensor Objects ---
Adafruit_INA219 ina219;
DHT dht(DHTPIN, DHT22);
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

// --- Global Variables (Maintained for Bridge Safety) ---
float ph_value = 0.0;
float current_mA = 0.0;
float int_temp = 0.0;
float int_hum = 0.0;
float turbidity_value = 0.0;
float voltage_value = 0.0;
float ext_temp = 0.0;
float oxygen_value = 0.0;
float light_intensity = 0.0;

void setup() {
  Serial.begin(115200); // Baud rate alignment for clear MPU communication
  
  // Initialize Hardwares
  Wire.begin();
  if (!ina219.begin()) {
    // INA219 initialization fallback if needed
  }
  dht.begin();
  sensors.begin();

  // --- Fixed RouterBridge Identifiers ---
  // Using Lambda Functions [](){ return var; } wraps your global variables 
  // into callables, eliminating the ArxTypeTraits 'operator()' compiler error.
  Bridge.provide("get_ph", []() { return ph_value; });
  Bridge.provide("get_current", []() { return current_mA; });
  Bridge.provide("get_int_temp", []() { return int_temp; });
  Bridge.provide("get_int_hum", []() { return int_hum; });
  Bridge.provide("get_turbidity", []() { return turbidity_value; });
  Bridge.provide("get_voltage", []() { return voltage_value; });
  Bridge.provide("get_ext_temp", []() { return ext_temp; });
  Bridge.provide("get_oxygen", []() { return oxygen_value; });
  Bridge.provide("get_light", []() { return light_intensity; });

  Bridge.begin();
}

void loop() {
  // Update all global memory buffers sequentially
  read_ph();
  read_current();
  read_dht();
  read_turbidity();
  read_voltage();
  read_ext_temp();
  read_oxygen_and_light();

  // Keep the Bridge alive to process requests from the MPU Python script
  Bridge.update();
  delay(10); 
}

// --- Sensor Reading Void Functions ---

void read_ph() {
  // Faster, non-blocking average
  float avg_analog = 0;
  int validReads = 0;

  for (int i = 0; i < 20; i++) {
    int reading = analogRead(PH_PIN);

    // Only count valid readings
    if (reading > 0) {
      avg_analog += reading;
      validReads++;
    }
  }

  // If nothing was read, send 0
  if (validReads == 0) {
    ph_value = 0;
    return;
  }

  avg_analog /= validReads;

  float voltage = avg_analog * (5.0 / 1023.0);
  ph_value = 3.5 * voltage;
}

void read_current() {
  current_mA = ina219.getCurrent_mA();
}

void read_dht() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  if (!isnan(h) && !isnan(t)) {
    int_hum = h;
    int_temp = t;
  } else {
    int_hum = 0.0; // Reset on failure
    int_temp = 0.0;
  }
}

void read_turbidity() {
  int analog_val = analogRead(TURBIDITY_PIN);
  turbidity_value = analog_val * (5.0 / 1023.0); 
}

void read_voltage() {
  int analog_val = analogRead(VOLTAGE_PIN);
  // FZ0430 voltage divider factor adjustment (5:1 ratio conversion)
  voltage_value = (analog_val * (5.0 / 1023.0)) * 5.0; 
}

void read_ext_temp() {
  sensors.requestTemperatures();
  float t = sensors.getTempCByIndex(0);
  if (t != DEVICE_DISCONNECTED_C) {
    ext_temp = t;
  }
}

void read_oxygen_and_light() {
  // High-precision floating point calculations
  int ox_analog = analogRead(OXYGEN_PIN);
  oxygen_value = ox_analog * (5.0 / 1023.0);

  int p1 = analogRead(PHOTO1_PIN);
  int p2 = analogRead(PHOTO2_PIN);
  light_intensity = ((p1 + p2) / 2.0) * (5.0 / 1023.0);
}
