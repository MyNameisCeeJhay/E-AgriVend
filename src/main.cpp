/**
 * ESP32 CODE - WiFi Bridge for Rice Vending Machine
 * Fixed to match backend routes
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============================================
// FUNCTION DECLARATIONS
// ============================================
void connectToWiFi();
void checkWiFi();
void processMegaData();
void parseStatusData(String data);
void parseTransactionData(String data);
void parseStockData(String data);
void parseStateData(String data);
void parseErrorData(String data);
void sendSensorDataToBackend();
void sendTransactionToBackend(float kg, float amount, String riceType, String status);
void sendSecurityAlertToBackend(String alertType, String doorStatus);
void checkMegaConnection();
void printStatus();
void testBackendConnection();  // ← ADDED THIS

// ============================================
// WiFi CONFIGURATION
// ============================================
const char* WIFI_SSID = "SKYW_0A48_2G";
const char* WIFI_PASSWORD = "M49wP9pr";

// Backend Server URL - Your Render backend
const char* BACKEND_URL = "https://e-agrivend.onrender.com";

// ESP32 specific endpoints (matching your esp32Routes.js)
const char* ENDPOINT_SENSORS = "/api/esp32/sensors/update";
const char* ENDPOINT_TRANSACTION = "/api/esp32/transaction/confirm";
const char* ENDPOINT_SECURITY = "/api/esp32/security/alert";

// Device ID
const char* DEVICE_ID = "AGRIVEND_001";

// ============================================
// UART PINS for Arduino Mega 2560 Communication
// ============================================
#define MEGA_RX_PIN 16  // ESP32 RX - connect to Mega TX2 (Pin 17)
#define MEGA_TX_PIN 17  // ESP32 TX - connect to Mega RX2 (Pin 16)

// ============================================
// LED PINS
// ============================================
#define LED_WIFI 2      // Built-in LED - WiFi status
#define LED_DATA 4      // External LED - Data activity

// ============================================
// VARIABLES (Received from Arduino Mega)
// ============================================
float container1Level = 20.0;     // Premium rice stock (kg)
float container2Level = 20.0;     // Regular rice stock (kg)
float collectionBinWeight = 0;     // Collection bin weight
float batteryVoltage = 12.5;
int batteryPercentage = 100;
float temperature = 25;
float humidity = 60;
String doorStatus = "CLOSED";
bool vibrationDetected = false;
String machineStatus = "ACTIVE";

// Machine state
int machineState = 0;
float insertedAmount = 0;
float lastDispenseKg = 0;
int selectedGrain = 0;
int targetQuantity = 1;
int errorCode = 0;
uint32_t transactionCount = 0;

bool megaConnected = false;
unsigned long lastMegaData = 0;
const unsigned long MEGA_TIMEOUT = 10000;

unsigned long lastSendToBackend = 0;
const unsigned long BACKEND_INTERVAL = 5000;
unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 30000;
unsigned long lastStatusPrint = 0;
const unsigned long STATUS_PRINT_INTERVAL = 30000;

// ============================================
// Helper Functions
// ============================================
String getContainer1StockStatus() {
  if (container1Level <= 0) return "EMPTY";
  if (container1Level < 5) return "LOW";
  return "OK";
}

String getContainer2StockStatus() {
  if (container2Level <= 0) return "EMPTY";
  if (container2Level < 5) return "LOW";
  return "OK";
}

// ============================================
// SETUP
// ============================================
void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, MEGA_RX_PIN, MEGA_TX_PIN);
  
  pinMode(LED_WIFI, OUTPUT);
  pinMode(LED_DATA, OUTPUT);
  
  digitalWrite(LED_WIFI, LOW);
  digitalWrite(LED_DATA, LOW);
  
  Serial.println("\n╔═══════════════════════════════════════╗");
  Serial.println("║   ESP32 - Arduino Mega 2560 Bridge   ║");
  Serial.println("║         E-AgriVend System            ║");
  Serial.println("╚═══════════════════════════════════════╝\n");
  Serial.println("=================================");
  Serial.println("🌾 ESP32 - WiFi Bridge");
  Serial.println("Receives data from Arduino Mega 2560");
  Serial.println("=================================");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("Backend URL: ");
  Serial.println(BACKEND_URL);
  Serial.println("=================================\n");
  
  connectToWiFi();
  testBackendConnection();
  
  Serial.println("\n✅ ESP32 Ready - Waiting for Mega data...\n");
}

// Test backend connection function
void testBackendConnection() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/health";
  http.begin(url);
  http.setTimeout(5000);
  
  Serial.print("Testing backend connection... ");
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    Serial.println("✅ Backend reachable!");
  } else {
    Serial.printf("❌ Backend error: %d\n", httpCode);
  }
  http.end();
}

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
    digitalWrite(LED_WIFI, HIGH);
  } else {
    Serial.println("\n❌ WiFi Connection Failed!");
    digitalWrite(LED_WIFI, LOW);
  }
}

void checkWiFi() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ WiFi disconnected! Reconnecting...");
    connectToWiFi();
  }
}

// ============================================
// SEND DATA TO BACKEND (UPDATED FOR YOUR ROUTES)
// ============================================
void sendSensorDataToBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ No WiFi - Sensor data not sent");
    return;
  }
  
  HTTPClient http;
  String url = String(BACKEND_URL) + ENDPOINT_SENSORS;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  // Create JSON document matching your SensorData schema
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["container1Level"] = container1Level;
  doc["container2Level"] = container2Level;
  doc["collectionBinWeight"] = collectionBinWeight;
  doc["batteryVoltage"] = batteryVoltage;
  doc["batteryPercentage"] = batteryPercentage;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  doc["doorStatus"] = doorStatus;
  doc["vibrationDetected"] = vibrationDetected;
  doc["machineStatus"] = machineStatus;
  doc["container1Stock"] = getContainer1StockStatus();
  doc["container2Stock"] = getContainer2StockStatus();
  
  // Add machine state info
  doc["machineState"] = machineState;
  doc["transactionCount"] = transactionCount;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("Sending sensor data to: ");
  Serial.println(url);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    if (httpResponseCode == 200) {
      Serial.println("✅ Sensor data sent to backend successfully!");
    } else {
      Serial.printf("📤 Response code: %d\n", httpResponseCode);
    }
  } else {
    Serial.printf("❌ Error sending sensor data: %d\n", httpResponseCode);
  }
  
  http.end();
}

void sendTransactionToBackend(float kg, float amount, String riceType, String status) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ No WiFi - Transaction not sent");
    return;
  }
  
  HTTPClient http;
  String url = String(BACKEND_URL) + ENDPOINT_TRANSACTION;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["transactionId"] = "TXN-" + String(millis());
  doc["riceType"] = riceType;
  doc["quantityKg"] = kg;
  doc["amountPaid"] = amount;
  doc["status"] = status;
  doc["paymentMethod"] = "CASH";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    if (httpResponseCode == 200) {
      Serial.println("💰 Transaction confirmed to backend!");
    } else {
      Serial.printf("💰 Transaction response: %d\n", httpResponseCode);
    }
  } else {
    Serial.printf("❌ Failed to send transaction: %d\n", httpResponseCode);
  }
  
  http.end();
}

void sendSecurityAlertToBackend(String alertType, String doorStatus) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + ENDPOINT_SECURITY;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["alertType"] = alertType;
  doc["doorStatus"] = doorStatus;
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode == 200) {
    Serial.printf("🚨 Security alert sent: %s\n", alertType.c_str());
  }
  
  http.end();
}

// ============================================
// PROCESS DATA FROM ARDUINO MEGA
// ============================================
void processMegaData() {
  if (Serial2.available()) {
    String data = Serial2.readStringUntil('\n');
    data.trim();
    
    if (data.length() > 0) {
      digitalWrite(LED_DATA, HIGH);
      delay(50);
      digitalWrite(LED_DATA, LOW);
      
      Serial.print("[MEGA → ESP32] ");
      Serial.println(data);
      
      lastMegaData = millis();
      megaConnected = true;
      
      if (data.startsWith("MEGA:READY")) {
        Serial.println("✅ Mega 2560 is ready!");
        Serial2.println("ESP32:READY");
      }
      else if (data.startsWith("DATA|")) {
        parseStatusData(data);
        sendSensorDataToBackend();  // Send to your /sensors/update endpoint
      }
      else if (data.startsWith("TXN|")) {
        parseTransactionData(data);
      }
      else if (data.startsWith("STOCK|")) {
        parseStockData(data);
      }
      else if (data.startsWith("STATE|")) {
        parseStateData(data);
      }
      else if (data.startsWith("ERROR|")) {
        parseErrorData(data);
      }
      else if (data == "PONG") {
        Serial.println("✅ Mega responded to ping");
      }
    }
  }
}

void parseStatusData(String data) {
  data = data.substring(5);
  
  int parts[10];
  int partIndex = 0;
  
  for (int i = 0; i < data.length() && partIndex < 10; i++) {
    if (data[i] == '|') {
      parts[partIndex++] = i;
    }
  }
  
  if (partIndex >= 9) {
    int start = 0;
    machineState = data.substring(start, parts[0]).toInt();
    container1Level = data.substring(parts[0] + 1, parts[1]).toFloat();
    container2Level = data.substring(parts[1] + 1, parts[2]).toFloat();
    insertedAmount = data.substring(parts[2] + 1, parts[3]).toFloat();
    lastDispenseKg = data.substring(parts[3] + 1, parts[4]).toFloat();
    selectedGrain = data.substring(parts[4] + 1, parts[5]).toInt();
    targetQuantity = data.substring(parts[5] + 1, parts[6]).toInt();
    errorCode = data.substring(parts[6] + 1, parts[7]).toInt();
    transactionCount = data.substring(parts[7] + 1, parts[8]).toInt();
    
    // Update machine status based on error code
    if (errorCode != 0) {
      machineStatus = "ERROR";
    } else if (container1Level < 2 && container2Level < 2) {
      machineStatus = "MAINTENANCE";
    } else {
      machineStatus = "ACTIVE";
    }
    
    const char* stateNames[] = {"IDLE", "GRAIN_SELECTED", "QUANTITY_SELECTED", "PAYMENT", "DISPENSING", "COMPLETE"};
    Serial.print("📊 Status: State=");
    Serial.print(stateNames[machineState]);
    Serial.print(", Stock(P/R)=");
    Serial.print(container1Level);
    Serial.print("/");
    Serial.print(container2Level);
    Serial.println(" kg");
    
    // Check for security alerts
    if (doorStatus == "OPEN" && machineState != 0) {
      sendSecurityAlertToBackend("DOOR_OPEN", doorStatus);
    }
  }
}

void parseTransactionData(String data) {
  data = data.substring(4);
  
  int firstBar = data.indexOf('|');
  int secondBar = data.indexOf('|', firstBar + 1);
  int thirdBar = data.indexOf('|', secondBar + 1);
  
  if (firstBar > 0 && secondBar > 0 && thirdBar > 0) {
    float kg = data.substring(0, firstBar).toFloat();
    float amount = data.substring(firstBar + 1, secondBar).toFloat();
    String riceType = data.substring(secondBar + 1, thirdBar);
    String status = data.substring(thirdBar + 1);
    
    Serial.printf("💰 Transaction: %.3fkg %s - ₱%.2f [%s]\n", kg, riceType.c_str(), amount, status.c_str());
    sendTransactionToBackend(kg, amount, riceType, status);
  }
}

void parseStockData(String data) {
  data = data.substring(6);
  int barPos = data.indexOf('|');
  if (barPos > 0) {
    container1Level = data.substring(0, barPos).toFloat();
    container2Level = data.substring(barPos + 1).toFloat();
  }
}

void parseStateData(String data) {
  machineState = data.substring(6).toInt();
  const char* states[] = {"IDLE", "GRAIN_SELECTED", "QUANTITY_SELECTED", "PAYMENT", "DISPENSING", "COMPLETE"};
  Serial.printf("📊 State: %s\n", states[machineState]);
}

void parseErrorData(String data) {
  String errorType = data.substring(6);
  Serial.printf("❌ Error: %s\n", errorType.c_str());
  sendSecurityAlertToBackend(errorType, doorStatus);
}

void checkMegaConnection() {
  if (millis() - lastMegaData > MEGA_TIMEOUT) {
    if (megaConnected) {
      megaConnected = false;
      Serial.println("⚠️ Mega connection lost!");
      sendSecurityAlertToBackend("MEGA_DISCONNECTED", doorStatus);
      Serial2.println("PING");
    }
  } else if (!megaConnected && (millis() - lastMegaData) < MEGA_TIMEOUT) {
    megaConnected = true;
    Serial.println("✅ Mega reconnected!");
  }
}

// ============================================
// PRINT STATUS
// ============================================
void printStatus() {
  const char* stateNames[] = {"IDLE", "GRAIN_SELECTED", "QUANTITY_SELECTED", "PAYMENT", "DISPENSING", "COMPLETE"};
  
  Serial.println("\n╔═══════════════════════════════════════╗");
  Serial.println("║         ESP32 STATUS REPORT           ║");
  Serial.println("╠═══════════════════════════════════════╣");
  Serial.printf("║ 🔗 Mega: %-25s ║\n", megaConnected ? "Connected ✅" : "Disconnected ❌");
  Serial.printf("║ 📡 WiFi: %-25s ║\n", WiFi.status() == WL_CONNECTED ? "Connected ✅" : "Disconnected ❌");
  Serial.printf("║ 📊 State: %-25s ║\n", stateNames[machineState]);
  Serial.printf("║ 🍚 Premium: %.1f kg (%-5s)     ║\n", container1Level, getContainer1StockStatus().c_str());
  Serial.printf("║ 🍚 Regular: %.1f kg (%-5s)     ║\n", container2Level, getContainer2StockStatus().c_str());
  Serial.printf("║ 🔋 Battery: %d%%                 ║\n", batteryPercentage);
  Serial.printf("║ 🚪 Door: %-25s ║\n", doorStatus.c_str());
  Serial.printf("║ 📈 Transactions: %-16d ║\n", transactionCount);
  Serial.printf("║ 🟢 Status: %-24s ║\n", machineStatus.c_str());
  Serial.println("╚═══════════════════════════════════════╝\n");
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
  processMegaData();
  checkMegaConnection();
  
  if (millis() - lastSendToBackend >= BACKEND_INTERVAL) {
    if (megaConnected && WiFi.status() == WL_CONNECTED) {
      sendSensorDataToBackend();
    }
    lastSendToBackend = millis();
  }
  
  if (millis() - lastStatusPrint >= STATUS_PRINT_INTERVAL) {
    printStatus();
    lastStatusPrint = millis();
  }
  
  if (millis() - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
    checkWiFi();
    lastWiFiCheck = millis();
  }
  
  delay(50);
}