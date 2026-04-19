/**
 * AgriVend - ESP32 Sensor Monitoring System
 * Sends sensor data to backend for:
 * - Rice stock levels (Sinandomeng & Dinorado)
 * - Battery monitoring
 * - Security (door sensor)
 * - Transaction recording
 * 
 * Required Libraries (install via Arduino Library Manager):
 * - WiFi (built-in)
 * - HTTPClient (built-in)
 * - ArduinoJson by Benoit Blanchon (version 6.21.3)
 * - HX711 by Bogdan Necula (for load cells)
 * - DHT sensor library by Adafruit (for temperature/humidity)
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <HX711.h>
#include <DHT.h>

// ============================================
// CONFIGURATION - CHANGE THESE VALUES
// ============================================

// WiFi Credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";        // CHANGE THIS
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // CHANGE THIS

// Backend Server URL
// For local testing: http://192.168.1.100:5000/api/esp32
// Replace with your computer's IP address (find it using ipconfig)
const char* SERVER_URL = "http://192.168.1.100:5000/api/esp32";

// Device ID (unique identifier for this machine)
const char* DEVICE_ID = "AGRIVEND_001";

// ============================================
// PIN DEFINITIONS
// ============================================

// Load Cells (HX711) for rice stock monitoring
const int LOADCELL_DOUT_PIN1 = 16;  // Container 1 (Sinandomeng)
const int LOADCELL_SCK_PIN1 = 17;
const int LOADCELL_DOUT_PIN2 = 18;  // Container 2 (Dinorado)
const int LOADCELL_SCK_PIN2 = 19;
const int LOADCELL_DOUT_PIN3 = 21;  // Collection bin (for transaction weight)
const int LOADCELL_SCK_PIN3 = 22;

// DHT Temperature/Humidity Sensor
const int DHT_PIN = 4;
#define DHTTYPE DHT22
DHT dht(DHT_PIN, DHTTYPE);

// Security - Door Sensor (reed switch)
const int DOOR_SENSOR_PIN = 34;

// Security - Vibration/Tilt Sensor (for tamper detection)
const int VIBRATION_SENSOR_PIN = 35;

// Battery Monitoring (voltage divider)
const int BATTERY_PIN = 36;

// LED Indicators
const int LED_GREEN = 2;
const int LED_RED = 5;

// Buzzer for security alerts
const int BUZZER_PIN = 33;

// ============================================
// HX711 Objects
// ============================================
HX711 scaleContainer1;
HX711 scaleContainer2;
HX711 scaleCollectionBin;

// ============================================
// CALIBRATION FACTORS (ADJUST THESE AFTER CALIBRATION!)
// ============================================
const float CALIBRATION_FACTOR_1 = 420.0;  // Container 1 (Sinandomeng)
const float CALIBRATION_FACTOR_2 = 420.0;  // Container 2 (Dinorado)
const float CALIBRATION_FACTOR_3 = 420.0;  // Collection bin

// Container max capacities (kg)
const float MAX_CAPACITY_1 = 20.0;
const float MAX_CAPACITY_2 = 20.0;
const float LOW_STOCK_THRESHOLD = 5.0;

// ============================================
// VARIABLES
// ============================================

// Stock monitoring
float sinandomengStock = 0;      // Container 1 (Sinandomeng rice)
float dinoradoStock = 0;         // Container 2 (Dinorado rice)
float dispensedWeight = 0;       // Collection bin weight

// Battery monitoring
float batteryVoltage = 0;
float batteryPercentage = 0;

// Environmental monitoring
float temperature = 0;
float humidity = 0;

// Security monitoring
bool doorOpen = false;
bool vibrationDetected = false;
unsigned long lastVibrationTime = 0;
String machineStatus = "ACTIVE";

// Transaction tracking
float lastTransactionAmount = 0;
float lastTransactionWeight = 0;
String lastTransactionStatus = "";

// Timing variables
unsigned long lastSensorSend = 0;
const unsigned long SENSOR_INTERVAL = 5000; // Send every 5 seconds
unsigned long lastVibrationCheck = 0;
const unsigned long VIBRATION_COOLDOWN = 30000; // 30 seconds cooldown

// ============================================
// SETUP FUNCTION
// ============================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n=================================");
  Serial.println("🌾 AgriVend ESP32 Monitoring System");
  Serial.println("=================================");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("Server URL: ");
  Serial.println(SERVER_URL);
  
  // Initialize pins
  pinMode(DOOR_SENSOR_PIN, INPUT_PULLUP);
  pinMode(VIBRATION_SENSOR_PIN, INPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Initialize load cells
  initLoadCells();
  
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
  
  Serial.println("✅ System ready!");
  Serial.println("Monitoring:");
  Serial.println("   - Rice stock levels (Sinandomeng & Dinorado)");
  Serial.println("   - Battery percentage");
  Serial.println("   - Door security");
  Serial.println("   - Vibration/tamper detection");
  Serial.println("   - Temperature & humidity");
  Serial.println("=================================\n");
}

// ============================================
// LOAD CELL INITIALIZATION
// ============================================
void initLoadCells() {
  Serial.println("Initializing load cells...");
  
  scaleContainer1.begin(LOADCELL_DOUT_PIN1, LOADCELL_SCK_PIN1);
  scaleContainer2.begin(LOADCELL_DOUT_PIN2, LOADCELL_SCK_PIN2);
  scaleCollectionBin.begin(LOADCELL_DOUT_PIN3, LOADCELL_SCK_PIN3);
  
  scaleContainer1.set_scale(CALIBRATION_FACTOR_1);
  scaleContainer2.set_scale(CALIBRATION_FACTOR_2);
  scaleCollectionBin.set_scale(CALIBRATION_FACTOR_3);
  
  scaleContainer1.tare();
  scaleContainer2.tare();
  scaleCollectionBin.tare();
  
  Serial.println("✅ Load cells initialized");
}

// ============================================
// WIFI CONNECTION
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
  } else {
    Serial.println("\n❌ WiFi Connection Failed!");
    digitalWrite(LED_RED, HIGH);
  }
}

// ============================================
// STOCK MONITORING (Load Cells)
// ============================================
void readStockLevels() {
  // Read load cells (average of 10 readings for stability)
  sinandomengStock = scaleContainer1.get_units(10);
  dinoradoStock = scaleContainer2.get_units(10);
  dispensedWeight = scaleCollectionBin.get_units(10);
  
  // Ensure non-negative values
  sinandomengStock = max(sinandomengStock, 0.0);
  dinoradoStock = max(dinoradoStock, 0.0);
  dispensedWeight = max(dispensedWeight, 0.0);
  
  // Cap at max capacity
  sinandomengStock = min(sinandomengStock, MAX_CAPACITY_1);
  dinoradoStock = min(dinoradoStock, MAX_CAPACITY_2);
}

// ============================================
// BATTERY MONITORING
// ============================================
void readBattery() {
  // Read battery voltage (voltage divider: 2x 10k resistors)
  int batteryRaw = analogRead(BATTERY_PIN);
  batteryVoltage = (batteryRaw / 4095.0) * 3.3 * 2; // 3.3V reference * divider ratio (2)
  
  // Calculate battery percentage for 12V lead-acid battery
  if (batteryVoltage >= 12.7) batteryPercentage = 100;
  else if (batteryVoltage >= 12.5) batteryPercentage = 90;
  else if (batteryVoltage >= 12.3) batteryPercentage = 75;
  else if (batteryVoltage >= 12.1) batteryPercentage = 50;
  else if (batteryVoltage >= 11.9) batteryPercentage = 25;
  else if (batteryVoltage >= 11.7) batteryPercentage = 10;
  else batteryPercentage = 0;
}

// ============================================
// ENVIRONMENTAL MONITORING
// ============================================
void readEnvironment() {
  temperature = dht.readTemperature();
  humidity = dht.readHumidity();
  
  // Check for reading errors
  if (isnan(temperature) || isnan(humidity)) {
    temperature = 25.0;
    humidity = 50.0;
  }
}

// ============================================
// SECURITY MONITORING
// ============================================
void readSecurity() {
  // Door sensor (LOW when open due to pull-up)
  bool currentDoorState = (digitalRead(DOOR_SENSOR_PIN) == LOW);
  
  // Detect door state change
  if (currentDoorState != doorOpen) {
    doorOpen = currentDoorState;
    if (doorOpen) {
      Serial.println("🚪 DOOR OPENED - Security alert!");
      triggerSecurityAlert("DOOR_OPENED");
    } else {
      Serial.println("🔒 Door closed");
    }
  }
  
  // Vibration/tamper detection
  int vibrationValue = analogRead(VIBRATION_SENSOR_PIN);
  
  // Vibration detected (adjust threshold as needed)
  if (vibrationValue > 2000 && (millis() - lastVibrationTime) > VIBRATION_COOLDOWN) {
    vibrationDetected = true;
    lastVibrationTime = millis();
    Serial.printf("⚠️ VIBRATION DETECTED! Value: %d\n", vibrationValue);
    triggerSecurityAlert("VIBRATION_DETECTED");
  } else {
    vibrationDetected = false;
  }
}

void triggerSecurityAlert(String alertType) {
  // Sound buzzer
  digitalWrite(BUZZER_PIN, HIGH);
  delay(1000);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Send alert to server
  sendSecurityAlert(alertType);
}

// ============================================
// TRANSACTION DETECTION
// ============================================
void checkTransaction() {
  // Static variables to track weight changes
  static float previousWeight = 0;
  static unsigned long transactionStartTime = 0;
  static bool transactionInProgress = false;
  
  float currentWeight = dispensedWeight;
  
  // Detect start of transaction (weight increase)
  if (!transactionInProgress && currentWeight > previousWeight + 0.05) {
    transactionInProgress = true;
    transactionStartTime = millis();
    Serial.println("💰 Transaction started - weight increasing");
  }
  
  // Detect end of transaction (weight stable for 3 seconds)
  if (transactionInProgress && (millis() - transactionStartTime) > 3000) {
    float finalWeight = currentWeight;
    float weightDifference = finalWeight - previousWeight;
    
    if (weightDifference > 0.05) {
      // Calculate amount based on price per kg (adjust as needed)
      float pricePerKg = 54.0; // ₱54 per kg
      float amount = weightDifference * pricePerKg;
      
      Serial.printf("✅ Transaction completed!\n");
      Serial.printf("   Weight: %.2f kg\n", weightDifference);
      Serial.printf("   Amount: ₱%.2f\n", amount);
      
      // Send transaction to server
      sendTransaction(weightDifference, amount, "Sinandomeng", "COMPLETED");
      
      lastTransactionWeight = weightDifference;
      lastTransactionAmount = amount;
      lastTransactionStatus = "COMPLETED";
    }
    
    transactionInProgress = false;
    previousWeight = currentWeight;
  }
  
  // Update previous weight if no transaction
  if (!transactionInProgress) {
    previousWeight = currentWeight;
  }
}

// ============================================
// LED INDICATORS
// ============================================
void updateLEDs() {
  // Check for any issues
  bool hasIssue = false;
  
  if (sinandomengStock < LOW_STOCK_THRESHOLD || dinoradoStock < LOW_STOCK_THRESHOLD) {
    hasIssue = true;
  }
  
  if (batteryPercentage < 20) {
    hasIssue = true;
  }
  
  if (doorOpen || vibrationDetected) {
    hasIssue = true;
  }
  
  if (hasIssue) {
    // Blink red LED
    static unsigned long lastBlink = 0;
    if (millis() - lastBlink > 1000) {
      digitalWrite(LED_RED, !digitalRead(LED_RED));
      lastBlink = millis();
    }
    digitalWrite(LED_GREEN, LOW);
  } else {
    // Solid green LED for normal operation
    digitalWrite(LED_GREEN, HIGH);
    digitalWrite(LED_RED, LOW);
  }
}

// ============================================
// SERVER COMMUNICATION
// ============================================

// Send sensor data to backend
void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    connectToWiFi();
    return;
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/sensors/update";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;
  
  // Stock levels
  doc["container1Level"] = sinandomengStock;
  doc["container2Level"] = dinoradoStock;
  doc["collectionBinWeight"] = dispensedWeight;
  
  // Stock status
  doc["container1Stock"] = (sinandomengStock >= 5) ? "OK" : ((sinandomengStock > 0) ? "LOW" : "EMPTY");
  doc["container2Stock"] = (dinoradoStock >= 5) ? "OK" : ((dinoradoStock > 0) ? "LOW" : "EMPTY");
  
  // Battery
  doc["batteryVoltage"] = batteryVoltage;
  doc["batteryPercentage"] = batteryPercentage;
  
  // Environment
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  
  // Security
  doc["doorStatus"] = doorOpen ? "OPEN" : "CLOSED";
  doc["vibrationDetected"] = vibrationDetected;
  
  // Machine status
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
    
    // Blink green LED briefly to indicate successful send
    digitalWrite(LED_GREEN, LOW);
    delay(50);
    if (!hasIssues()) digitalWrite(LED_GREEN, HIGH);
  } else {
    Serial.print("❌ Error sending sensor data: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

// Send transaction data to backend
void sendTransaction(float quantityKg, float amount, String riceType, String status) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/transaction/confirm";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
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
    Serial.printf("❌ Failed to record transaction: %d\n", httpResponseCode);
  }
  
  http.end();
}

// Send security alert to backend
void sendSecurityAlert(String alertType) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/security/alert";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["alertType"] = alertType;
  doc["timestamp"] = millis();
  doc["doorStatus"] = doorOpen ? "OPEN" : "CLOSED";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.printf("🚨 Security alert sent: %s\n", alertType.c_str());
  } else {
    Serial.printf("❌ Failed to send security alert: %d\n", httpResponseCode);
  }
  
  http.end();
}

bool hasIssues() {
  return (sinandomengStock < LOW_STOCK_THRESHOLD || 
          dinoradoStock < LOW_STOCK_THRESHOLD || 
          batteryPercentage < 20 || 
          doorOpen || 
          vibrationDetected);
}

// ============================================
// PRINT STATUS TO SERIAL MONITOR
// ============================================
void printStatus() {
  Serial.println("\n=== AGRIVEND STATUS ===");
  Serial.printf("🍚 Sinandomeng: %.1f kg (%s)\n", sinandomengStock, 
                (sinandomengStock >= 5) ? "OK" : ((sinandomengStock > 0) ? "LOW" : "EMPTY"));
  Serial.printf("🍚 Dinorado: %.1f kg (%s)\n", dinoradoStock,
                (dinoradoStock >= 5) ? "OK" : ((dinoradoStock > 0) ? "LOW" : "EMPTY"));
  Serial.printf("🔋 Battery: %.1fV (%.0f%%)\n", batteryVoltage, batteryPercentage);
  Serial.printf("🌡️ Temperature: %.1f°C\n", temperature);
  Serial.printf("💧 Humidity: %.0f%%\n", humidity);
  Serial.printf("🚪 Door: %s\n", doorOpen ? "OPEN" : "CLOSED");
  Serial.printf("⚠️ Vibration: %s\n", vibrationDetected ? "DETECTED" : "Normal");
  Serial.printf("📊 Machine Status: %s\n", machineStatus);
  Serial.println("========================");
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
  // Read all sensors
  readStockLevels();
  readBattery();
  readEnvironment();
  readSecurity();
  checkTransaction();
  
  // Send sensor data to server periodically
  if (millis() - lastSensorSend >= SENSOR_INTERVAL) {
    sendSensorData();
    printStatus();
    lastSensorSend = millis();
  }
  
  // Update LED indicators
  updateLEDs();
  
  delay(100);
}