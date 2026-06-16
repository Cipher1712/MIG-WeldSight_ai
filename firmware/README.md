# MIG-WeldSight AI - ESP32 Firmware

`esp32_weldsight/esp32_weldsight.ino` is an Arduino sketch for ESP32 +
ADS1115 that streams arc voltage, distance and arc-on state to the FastAPI
backend at `/ws/stream`.

## Wiring

- ESP32 I2C: SDA -> ADS1115 SDA, SCL -> ADS1115 SCL, 3V3 + GND.
- Arc voltage divider: source -> Rtop (100k) -> ADS1115 A0 -> Rbot (10k) -> GND.
  Update `DIVIDER_RATIO` in the sketch.
- Distance sensor: analog out -> ESP32 GPIO34 (or change `DISTANCE_PIN`).

## Configure

Edit at the top of the sketch:

- `WIFI_SSID`, `WIFI_PASSWORD`
- `WS_HOST` -> your Railway hostname, e.g. `weldsight-api.up.railway.app`
- `WS_SSL`  -> `true` for Railway (TLS)
- `MATERIAL`, `THICKNESS_MM`

## Build

Arduino IDE -> Board: "ESP32 Dev Module" -> Upload.
Install libraries: **Adafruit ADS1X15**, **ArduinoJson**, **WebSockets** (Markus Sattler).
*** Add File: .env.example
# Copy to .env.local for local dev (Vite will pick these up at build time).
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/live