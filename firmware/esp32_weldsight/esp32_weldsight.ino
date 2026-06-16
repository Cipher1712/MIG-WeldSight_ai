/*
 * MIG-WeldSight AI - ESP32 + ADS1115 voltage sampler.
 *
 * Streams raw arc voltage, contact-tip-to-work distance and arc-on state
 * to the FastAPI backend via WebSocket. The backend handles all analysis.
 *
 * Dependencies (install via Arduino Library Manager):
 *   - WiFi (built in)
 *   - Adafruit_ADS1X15
 *   - ArduinoJson 7.x
 *   - WebSockets (by Markus Sattler) 2.4+
 */

#include <WiFi.h>
#include <Wire.h>
#include <Adafruit_ADS1X15.h>
#include <ArduinoJson.h>
#include <WebSocketsClient.h>

// ---------------- CONFIG ----------------
const char* WIFI_SSID     = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";

// Railway WSS host (no protocol, no trailing slash).
const char* WS_HOST = "weldsight-api.up.railway.app";
const uint16_t WS_PORT = 443;
const char* WS_PATH = "/ws/stream";
const bool   WS_SSL = true;

const char* MATERIAL       = "mild_steel";
const float THICKNESS_MM   = 6.0f;

// Voltage divider scaling: divider_ratio = (Rtop + Rbot) / Rbot.
const float DIVIDER_RATIO = 11.0f;       // e.g. 100k / 10k

// Distance sensor pin (analog or digital). Replace with your sensor.
const int DISTANCE_PIN = 34;

// Arc-on detection threshold (V at electrode).
const float ARC_ON_VOLTS = 10.0f;
// ----------------------------------------

Adafruit_ADS1115 ads;
WebSocketsClient ws;
bool connected = false;

void onWsEvent(WStype_t type, uint8_t* /*payload*/, size_t /*length*/) {
  switch (type) {
    case WStype_CONNECTED: {
      connected = true;
      Serial.println("[ws] connected");
      // send setup frame
      StaticJsonDocument<128> doc;
      doc["material"] = MATERIAL;
      doc["thickness_mm"] = THICKNESS_MM;
      String out; serializeJson(doc, out);
      ws.sendTXT(out);
      break;
    }
    case WStype_DISCONNECTED:
      connected = false;
      Serial.println("[ws] disconnected");
      break;
    default: break;
  }
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  ads.setGain(GAIN_TWOTHIRDS);  // +/-6.144 V full scale
  if (!ads.begin()) {
    Serial.println("ADS1115 not found");
    while (true) delay(1000);
  }

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("WiFi…");
  while (WiFi.status() != WL_CONNECTED) { delay(300); Serial.print('.'); }
  Serial.println(" ok");

  if (WS_SSL) ws.beginSSL(WS_HOST, WS_PORT, WS_PATH);
  else        ws.begin(WS_HOST, WS_PORT, WS_PATH);
  ws.onEvent(onWsEvent);
  ws.setReconnectInterval(2000);
}

unsigned long lastSample = 0;
const unsigned long SAMPLE_INTERVAL_MS = 5; // ~200 Hz

void loop() {
  ws.loop();

  unsigned long now = millis();
  if (now - lastSample < SAMPLE_INTERVAL_MS) return;
  lastSample = now;

  // Channel 0: arc voltage through divider.
  int16_t raw = ads.readADC_SingleEnded(0);
  float v_adc = ads.computeVolts(raw);
  float voltage = v_adc * DIVIDER_RATIO;

  // Distance: 0..3.3 V -> 0..300 mm linear (replace with your sensor's mapping).
  float v_d = analogRead(DISTANCE_PIN) * (3.3f / 4095.0f);
  float distance_mm = v_d * (300.0f / 3.3f);

  bool arc_on = voltage > ARC_ON_VOLTS;

  if (!connected) return;

  StaticJsonDocument<192> doc;
  doc["voltage"] = voltage;
  doc["distance_mm"] = distance_mm;
  doc["arc_on"] = arc_on;
  doc["timestamp"] = (uint32_t)(now / 1000);
  String out; serializeJson(doc, out);
  ws.sendTXT(out);
}