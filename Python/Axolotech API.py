import time
import requests
import math
import random
import json
from arduino.app_bricks.dbstorage_tsstore import TimeSeriesStore
from arduino.app_bricks.video_objectdetection import VideoObjectDetection
from arduino.app_utils import *

print("Hello world!")

# --- Global variables mapped specifically to your Var1-Var7 payload ---
get_ph = 0.0           # Var2
get_voltage_fz = 0.0   # Var6
get_oxygen = 0.0       # Var3
get_turbidity = 0.0    # Var4
get_current = 0.0      # Var7
get_temperature = 0.0  # Var1 (External Temp)
get_humidity = 0.0     # Var5

# --- Vision System State Variables ---
axolotl_present = False
max_confidence = 0.0
axolotl_counter = 0      
was_present = False      
last_detection_time = 0  

# --- Define your REST API configuration ---
API_ENDPOINT = "https://rbk7ljo1b0.execute-api.us-east-1.amazonaws.com/prod/vars"
API_HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json"
}

# --- Initialize DB Storage ---
db = TimeSeriesStore()
db.start()

# --- Vision Callback ---
def on_all_detections(detections: dict):
    global axolotl_present, max_confidence, axolotl_counter, was_present, last_detection_time
    
    if "Ajolote" in detections and len(detections["Ajolote"]) > 0:
        axolotl_present = True
        last_detection_time = time.time() 
        
        # Extract the highest confidence score from the bounding boxes
        confidences = [box['confidence'] for box in detections["Ajolote"]]
        max_confidence = max(confidences)
        
        # 🎯 REAL-TIME CONFIDENCE PRINT 
        print(f"🎯 [VISION LIVE] Axolotl Tracked! Confidence: {max_confidence:.2f}")
        
        if not was_present:
            axolotl_counter += 1
            print(f"✨ Axolotl arrival detected! Total: {axolotl_counter}")
        
        was_present = True
    else:
        axolotl_present = False
        max_confidence = 0.0
        was_present = False

# --- Initialize Vision Brick ---
# Sets threshold to 0.84 model confidence mapping
video_detector = VideoObjectDetection(None, 0.6, 0.1, False)
video_detector.on_detect_all(on_all_detections)

# --- Helper function to sanitize float values ---
def sanitize(val):
    try:
        num = float(val)
        # Reject NaN and Infinity values
        if math.isnan(num) or math.isinf(num):
            return 0.0
        return round(num, 2)
    except:
        return 0.0

def loop():
    # Bring variables into local scope for updating
    global get_ph, get_voltage_fz, get_oxygen, get_turbidity
    global get_current, get_temperature, get_humidity
    global axolotl_present, max_confidence, axolotl_counter, was_present, last_detection_time
    
    print("prueba")
    
    # Vision Safety Filter Window Timeout Reset (3 Seconds)
    if time.time() - last_detection_time > 3.0:
        axolotl_present = False
        max_confidence = 0.0
        was_present = False
        
    try:
        # EXACT MATCHES to your C++ Bridge.provide definitions
        get_ph = Bridge.call("get_ph")
        get_voltage_fz = Bridge.call("get_voltage")
        get_oxygen = Bridge.call("get_oxygen")
        get_turbidity = Bridge.call("get_turbidity")
        get_current = Bridge.call("get_current")
        get_temperature = Bridge.call("get_ext_temp")
        get_humidity = Bridge.call("get_int_hum")
        
        # --- Log Data to Time Series DB ---
        db.write_sample("temperature", sanitize(get_temperature))
        db.write_sample("ph_level", sanitize(get_ph))
        db.write_sample("voltage", sanitize(get_voltage_fz))
        db.write_sample("oxygen", sanitize(get_oxygen))
        db.write_sample("turbidity", sanitize(get_turbidity))
        db.write_sample("current", sanitize(get_current))
        db.write_sample("humidity", sanitize(get_humidity))
        db.write_sample("axolotl_visible", 1 if axolotl_present else 0)
        db.write_sample("total_sightings", axolotl_counter)
        
        # Build layout dictionary structure
        payload = {
            "var2": sanitize(get_ph),
            "var6": sanitize(get_voltage_fz),
            "var3": sanitize(get_oxygen),
            "var4": sanitize(get_turbidity),
            "var7": sanitize(get_current),
            "var1": sanitize(get_temperature),
            "var5": sanitize(get_humidity),
            "var9": axolotl_present,
            "var10": round(max_confidence, 2),
        }
        
        print(f"Sending data payload to REST API via PUT: {payload}")
        
        # 🔄 UPDATED: Performs an HTTP PUT request instead of a POST
        response = requests.put(
            API_ENDPOINT,
            json=payload,
            headers=API_HEADERS,
            timeout=10
        )
        
        print(f"Response Status: {response.status_code}")
        print(f"Response Body: {response.text}")
        
        # 🔄 UPDATED: Check for standard successful HTTP response ranges (e.g., 200, 201, 204)
        if 200 <= response.status_code < 300:
            print("Data uploaded successfully via PUT!")
        else:
            print("Upload failed.")
            
    except Exception as e:
        print(f"Error handling data loop cycle: {e}")
        
    print("Leyendo todos los sensores desde Arduino vía Bridge...")
    time.sleep(5)

# Start application execution
try:
    App.run(user_loop=loop)
finally:
    # Ensure DB closes safely if execution terminates
    print("Stopping Time Series Engine...")
    db.stop()
