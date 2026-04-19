/**
 * AgriVend - ESP32 Sensor Monitoring System WITH MEGA COMMUNICATION
 * Sends sensor data to backend + communicates with Arduino Mega
 * NO LOAD CELLS - All sensors on ESP32, dispensing controlled by Mega
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// ============================================
// CONFIGURATION - CHANGE THESE VALUES
// ============================================

// WiFi Credentials
const char* WIFI_SSID = "SKYW_0A48_2G";
const char* WIFI_PASSWORD = "M49wP9pr";

// Backend Server URL
const char* SERVER_URL = "http://192.168.1.33:5000/api/esp32";

// Device ID
const char* DEVICE_ID = "AGRIVEND_001";

// ============================================
// PIN DEFINITIONS
// ============================================

// DHT Temperature/Humidity Sensor
const int DHT_PIN = 4;
#define DHTTYPE DHT22
DHT dht(DHT_PIN, DHTTYPE);

// Security
const int DOOR_SENSOR_PIN = 34;
const int VIBRATION_SENSOR_PIN = 35;

// Battery Monitoring (voltage divider)
const int BATTERY_PIN = 36;

// LED Indicators
const int LED_GREEN = 2;
const int LED_RED = 5;

// Buzzer for security alerts
const int BUZZER_PIN = 33;

// ========== UART Communication with Mega ==========
// Using GPIO16 (RX) and GPIO17 (TX) - These are FREE now
#define MEGA_RX_PIN 16  // ESP32 RX - connect to Mega TX (USE LEVEL SHIFTER!)
#define MEGA_TX_PIN 17  // ESP32 TX - connect to Mega RX

// ============================================
// VARIABLES
// ============================================

// Stock levels (updated from Mega or manual input)
float sinandomengStock = 20.0;  // Default stock in kg
float dinoradoStock = 20.0;     // Default stock in kg

// Battery monitoring
float batteryVoltage = 0;
float batteryPercentage = 0;

// Environmental monitoring
float temperature = 0;
float humidity = 0;

// Security monitoring
bool doorOpen = false;
bool vibrationDetected = false;
String machineStatus = "ACTIVE";

// Transaction tracking
float lastTransactionAmount = 0;
float lastTransactionWeight = 0;
String lastTransactionStatus = "";
int selectedRiceType = 0;  // 1=Sinandomeng, 2=Dinorado

// Timing
unsigned long lastSensorSend = 0;
const unsigned long SENSOR_INTERVAL = 5000;
unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 30000;

// ============================================
// SETUP
// ============================================
void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, MEGA_RX_PIN, MEGA_TX_PIN);
  delay(1000);
  
  Serial.println("\n=================================");
  Serial.println("🌾 AgriVend ESP32 + Mega System");
  Serial.println("=================================");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.println("UART with Mega initialized on GPIO16(RX)/GPIO17(TX)");
  
  // Initialize pins
  pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(VIBRATION_SENSOR_PIN, INPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Initialize DHT sensor
  dht.begin();
  
  // Connect to WiFi
  connectToWiFi();
  
  // Blink green LED to indicate ready
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_GREEN, HIGH);
    delay(200);
    digitalWrite(LED_GREEN, LOW);
    delay(200);
  }
  
  Serial.println("✅ System ready! Communicating with Mega...");
  Serial2.println("ESP32:READY");
}

// ============================================
// WIFI FUNCTIONS
// ============================================
void connectToWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n✅ WiFi Connected!");
    Serial.print("📡 IP Address: ");
    Serial.println(WiFi.localIP());
    digitalWrite(LED_GREEN, HIGH);
  } else {
    Serial.println("\n❌ WiFi Connection Failed!");
    digitalWrite(LED_RED, HIGH);
  }
}

void checkWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi disconnected! Reconnecting...");
    connectToWiFi();
  }
}

// ============================================
// SENSOR READINGS
// ============================================

void readBattery() {
  int batteryRaw = analogRead(BATTERY_PIN);
  batteryVoltage = (batteryRaw / 4095.0) * 3.3 * 2;
  
  // Calculate battery percentage for 12V lead-acid battery
  if (batteryVoltage >= 12.7) batteryPercentage = 100;
  else if (batteryVoltage >= 12.5) batteryPercentage = 90;
  else if (batteryVoltage >= 12.3) batteryPercentage = 75;
  else if (batteryVoltage >= 12.1) batteryPercentage = 50;
  else if (batteryVoltage >= 11.9) batteryPercentage = 25;
  else if (batteryVoltage >= 11.7) batteryPercentage = 10;
  else batteryPercentage = 0;
}

void readEnvironment() {
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  
  if (isnan(temperature) || isnan(humidity)) {
    temperature = 25.0;
    humidity = 50.0;
  }
}

void readSecurity() {
  bool currentDoorState = (digitalRead(DOOR_SENSOR_PIN) == LOW);
  
  if (currentDoorState != doorOpen) {
    doorOpen = currentDoorState;
    if (doorOpen) {
      Serial.println("🚪 DOOR OPENED - Security alert!");
      sendSecurityAlert("DOOR_OPENED");
      Serial2.println("ALERT:DOOR_OPEN");
    } else {
      Serial.println("🔒 Door closed");
      Serial2.println("STATUS:DOOR_CLOSED");
    }
  }
  
  int vibrationValue = analogRead(VIBRATION_SENSOR_PIN);
  static unsigned long lastVibrationTime = 0;
  
  if (vibrationValue > 2000 && (millis() - lastVibrationTime) > 30000) {
    vibrationDetected = true;
    lastVibrationTime = millis();
    Serial.println("⚠️ VIBRATION DETECTED!");
    sendSecurityAlert("VIBRATION_DETECTED");
    Serial2.println("ALERT:VIBRATION");
  } else {
    vibrationDetected = false;
  }
}

// ============================================
// MEGA COMMUNICATION
// ============================================
void processMegaCommands() {
  if (Serial2.available()) {
    String command = Serial2.readStringUntil('\n');
    command.trim();
    Serial.print("[MEGA → ESP32] ");
    Serial.println(command);
    
    if (command.startsWith("DISPENSE:")) {
      // Format: DISPENSE:1.5:1 (1.5 kg, rice type 1)
      int firstColon = command.indexOf(':');
      int secondColon = command.indexOf(':', firstColon + 1);
      
      float kgToDispense = command.substring(firstColon + 1, secondColon).toFloat();
      int riceType = command.substring(secondColon + 1).toInt();
      selectedRiceType = riceType;
      
      Serial.print("Dispense request: ");
      Serial.print(kgToDispense, 3);
      Serial.print(" kg of rice type ");
      Serial.println(riceType);
      
      // Check stock
      float currentStock = (riceType == 1) ? sinandomengStock : dinoradoStock;
      
      if (currentStock >= kgToDispense) {
        // Sufficient stock
        Serial2.println("STATUS:OK");
        
        // Update stock locally
        if (riceType == 1) {
          sinandomengStock -= kgToDispense;
        } else {
          dinoradoStock -= kgToDispense;
        }
        
        // Send transaction to backend
        float pricePerKg = (riceType == 1) ? 65.0 : 52.0;
        float amount = kgToDispense * pricePerKg;
        sendTransaction(kgToDispense, amount, 
                       (riceType == 1) ? "Sinandomeng" : "Dinorado", 
                       "COMPLETED");
        
        Serial.print("✅ Dispense approved! New stock: ");
        Serial.print(currentStock - kgToDispense, 2);
        Serial.println(" kg");
      } else {
        // Insufficient stock
        Serial2.println("STATUS:INSUFFICIENT_STOCK");
        Serial.print("❌ Dispense denied! Only ");
        Serial.print(currentStock, 2);
        Serial.println(" kg available");
      }
    }
    else if (command == "STATUS") {
      // Send full status to Mega
      Serial2.print("STOCK:");
      Serial2.print(sinandomengStock);
      Serial2.print(",");
      Serial2.println(dinoradoStock);
      
      Serial2.print("BATTERY:");
      Serial2.print(batteryPercentage);
      Serial2.print(",");
      Serial2.println(batteryVoltage);
      
      Serial2.print("ENV:");
      Serial2.print(temperature);
      Serial2.print(",");
      Serial2.println(humidity);
      
      Serial2.print("SECURITY:");
      Serial2.print(doorOpen ? "OPEN" : "CLOSED");
      Serial2.print(",");
      Serial2.println(vibrationDetected ? "VIBRATION" : "OK");
      
      Serial2.print("STATUS:");
      Serial2.println(machineStatus);
      
      Serial.println("✅ Sent STATUS response to Mega");
    }
    else if (command == "PING") {
      Serial2.println("PONG");
      Serial.println("✅ Sent PONG response to Mega");
    }
  }
}

// ============================================
// SERVER FUNCTIONS
// ============================================
void sendSensorData() {
  checkWiFi();
  
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/sensors/update";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["container1Level"] = sinandomengStock;
  doc["container2Level"] = dinoradoStock;
  doc["batteryVoltage"] = batteryVoltage;
  doc["batteryPercentage"] = batteryPercentage;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["doorStatus"] = doorOpen ? "OPEN" : "CLOSED";
  doc["vibrationDetected"] = vibrationDetected;
  
  // Update machine status
  if (sinandomengStock < 0.5 && dinoradoStock < 0.5) {
    machineStatus = "EMPTY";
  } else if (batteryPercentage < 15) {
    machineStatus = "LOW_BATTERY";
  } else if (doorOpen) {
    machineStatus = "DOOR_OPEN";
  } else {
    machineStatus = "ACTIVE";
  }
  doc["machineStatus"] = machineStatus;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.print("📤 Sensor data sent. Response: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("❌ Error sending sensor data: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void sendTransaction(float quantityKg, float amount, String riceType, String status) {
  checkWiFi();
  
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/transaction/confirm";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["transactionId"] = "TXN-" + String(millis());
  doc["riceType"] = riceType;
  doc["quantityKg"] = quantityKg;
  doc["amountPaid"] = amount;
  doc["status"] = status;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.println("💰 Transaction recorded successfully!");
  } else {
    Serial.print("❌ Failed to record transaction: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void sendSecurityAlert(String alertType) {
  checkWiFi();
  
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/security/alert";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["alertType"] = alertType;
  doc["timestamp"] = millis();
  doc["doorStatus"] = doorOpen ? "OPEN" : "CLOSED";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.print("🚨 Security alert sent: ");
    Serial.println(alertType);
  } else {
    Serial.print("❌ Failed to send security alert: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

// ============================================
// PRINT STATUS
// ============================================
void printStatus() {
  Serial.println("\n=== AGRIVEND STATUS ===");
  Serial.print("🍚 Sinandomeng: ");
  Serial.print(sinandomengStock, 2);
  Serial.println(" kg");
  Serial.print("🍚 Dinorado: ");
  Serial.print(dinoradoStock, 2);
  Serial.println(" kg");
  Serial.print("🔋 Battery: ");
  Serial.print(batteryVoltage, 1);
  Serial.print("V (");
  Serial.print(batteryPercentage, 0);
  Serial.println("%)");
  Serial.print("🌡️ Temperature: ");
  Serial.print(temperature, 1);
  Serial.println("°C");
  Serial.print("💧 Humidity: ");
  Serial.print(humidity, 0);
  Serial.println("%");
  Serial.print("🚪 Door: ");
  Serial.println(doorOpen ? "OPEN" : "CLOSED");
  Serial.print("⚠️ Vibration: ");
  Serial.println(vibrationDetected ? "DETECTED" : "Normal");
  Serial.print("📡 WiFi: ");
  Serial.println(WiFi.status() == WL_CONNECTED ? "Connected ✅" : "Disconnected ❌");
  Serial.print("📊 Machine Status: ");
  Serial.println(machineStatus);
  Serial.println("========================");
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
  readBattery();
  readEnvironment();
  readSecurity();
  
  // Process commands from Mega
  processMegaCommands();
  
  // Send sensor data to backend periodically
  if (millis() - lastSensorSend >= SENSOR_INTERVAL) {
    sendSensorData();
    printStatus();
    lastSensorSend = millis();
  }
  
  // Check WiFi periodically
  if (millis() - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
    checkWiFi();
    lastWiFiCheck = millis();
  }
  
  // LED indicators
  bool hasIssue = (sinandomengStock < 5.0 || 
                   dinoradoStock < 5.0 || 
                   batteryPercentage < 20 || 
                   doorOpen || 
                   vibrationDetected);
  
  if (hasIssue) {
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 1000) {
      digitalWrite(LED_RED, !digitalRead(LED_RED));
      lastBlink = millis();
    }
    digitalWrite(LED_GREEN, LOW);
  } else if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_RED, LOW);
  }
  
  delay(100);
}