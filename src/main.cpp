/**
 * ESP32 CODE - WiFi Bridge for Rice Vending Machine
 * WITH LOAD CELL DATA INTEGRATION & PRICE MANAGEMENT
 * FIXED: Removed deviceId to properly update MACHINES table
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
void parseLoadCellData(String data);
void parsePriceData(String data);
void sendSensorDataToBackend();
void sendTransactionToBackend(float kg, float amount, String riceType, String status, String transactionID);
void sendSecurityAlertToBackend(String alertType, String doorStatus);
void checkMegaConnection();
void printStatus();
void testBackendConnection();
void fetchPricesFromBackend();
void sendPriceToMega();

// ============================================
// WiFi CONFIGURATION
// ============================================
const char* WIFI_SSID = "SKYW_0A48_2G";
const char* WIFI_PASSWORD = "M49wP9pr";

const char* BACKEND_URL = "https://e-agrivend.onrender.com";

const char* ENDPOINT_SENSORS = "/api/esp32/sensors/update";
const char* ENDPOINT_TRANSACTION = "/api/esp32/transaction/confirm";
const char* ENDPOINT_SECURITY = "/api/esp32/security/alert";

const char* DEVICE_ID = "AGRIVEND_001";

// ============================================
// UART PINS
// ============================================
#define MEGA_RX_PIN 16
#define MEGA_TX_PIN 17

// ============================================
// LED PINS
// ============================================
#define LED_WIFI 2
#define LED_DATA 4

// ============================================
// VARIABLES
// ============================================
// Price variables
float dinoradoPrice = 65.0;
float sinandomengPrice = 52.0;
unsigned long lastPriceFetch = 0;
const unsigned long PRICE_FETCH_INTERVAL = 30000; // Check every 30 seconds

// Load cell data (from Arduino Mega)
float storage1Weight = 0.0;      // Sinandomeng (LEFT load cell)
float storage2Weight = 0.0;      // Dinorado (RIGHT load cell)
float loadCellTotal = 0.0;
bool loadCellLeftError = false;
bool loadCellRightError = false;
unsigned long lastLoadCellRead = 0;

float collectionBinWeight = 0;
float batteryVoltage = 12.5;
int batteryPercentage = 100;
float temperature = 25;
float humidity = 60;
String doorStatus = "CLOSED";
bool vibrationDetected = false;
String machineStatus = "ACTIVE";

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

// Rate limiting for backend to prevent overload
unsigned long lastSuccessfulSend = 0;
const unsigned long MIN_SEND_INTERVAL = 2000;

// ============================================
// Helper Functions
// ============================================
String getStorage1Status() {
  if (storage1Weight <= 0) return "EMPTY";
  if (storage1Weight < 5) return "LOW";
  return "OK";
}

String getStorage2Status() {
  if (storage2Weight <= 0) return "EMPTY";
  if (storage2Weight < 5) return "LOW";
  return "OK";
}

String getLoadCellStatus() {
  if (loadCellLeftError || loadCellRightError) return "ERROR";
  if (storage1Weight <= 0.05 && storage2Weight <= 0.05) return "LOW";
  return "OK";
}

// ============================================
// PRICE MANAGEMENT FUNCTIONS
// ============================================
void fetchPricesFromBackend() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + "/api/esp32/prices/current"; // Use current endpoint
  http.begin(url);
  http.setTimeout(5000);
  
  int httpCode = http.GET();
  if (httpCode == 200) {
    String payload = http.getString();
    JsonDocument doc;
    deserializeJson(doc, payload);
    
    if (doc["success"] == true) {
      float newDinorado = doc["prices"]["dinorado"];
      float newSinandomeng = doc["prices"]["sinandomeng"];
      
      if (newDinorado != dinoradoPrice || newSinandomeng != sinandomengPrice) {
        dinoradoPrice = newDinorado;
        sinandomengPrice = newSinandomeng;
        Serial.println("✅ Prices updated from server!");
        Serial.printf("  DINORADO: PHP %.2f\n", dinoradoPrice);
        Serial.printf("  SINANDOMENG: PHP %.2f\n", sinandomengPrice);
        
        // THIS MUST BE CALLED
        sendPriceToMega();
      }
    }
  } else {
    Serial.printf("❌ Failed to fetch prices, HTTP: %d\n", httpCode);
  }
  http.end();
}

void sendPriceToMega() {
  Serial2.print("PRICE|");
  Serial2.print(dinoradoPrice);
  Serial2.print("|");
  Serial2.println(sinandomengPrice);
  Serial.println("📤 Sent new prices to Arduino Mega");
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
  Serial.println("║      E-AgriVend System v2.0          ║");
  Serial.println("║      WITH LOAD CELL MONITORING       ║");
  Serial.println("╚═══════════════════════════════════════╝\n");
  Serial.println("=================================");
  Serial.println("🌾 ESP32 - WiFi Bridge");
  Serial.println("Receives data from Arduino Mega 2560");
  Serial.println("📊 INCLUDES: 2x 20kg Load Cells");
  Serial.println("=================================");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("Backend URL: ");
  Serial.println(BACKEND_URL);
  Serial.println("=================================\n");
  
  connectToWiFi();
  testBackendConnection();
  
  // Fetch initial prices
  fetchPricesFromBackend();
  
  Serial.println("\n✅ ESP32 Ready - Waiting for Mega data...\n");
}

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
// SEND DATA TO BACKEND - FIXED (NO deviceId)
// ============================================
void sendSensorDataToBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ No WiFi - Sensor data not sent");
    return;
  }
  
  // Rate limiting - don't send too frequently
  if (millis() - lastSuccessfulSend < MIN_SEND_INTERVAL) {
    return;
  }
  
  HTTPClient http;
  String url = String(BACKEND_URL) + ENDPOINT_SENSORS;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  // SANITIZE transactionCount - prevent overflow
  uint32_t safeTransactionCount = transactionCount;
  if (safeTransactionCount > 10000 || safeTransactionCount == 0xFFFFFFFF || safeTransactionCount == 0) {
    safeTransactionCount = 0;
    Serial.println("⚠️ Transaction count was invalid, reset to 0");
  }
  
  // SANITIZE other values
  float safeLoadCellLeft = (storage1Weight < 0 || isnan(storage1Weight)) ? 0 : storage1Weight;
  float safeLoadCellRight = (storage2Weight < 0 || isnan(storage2Weight)) ? 0 : storage2Weight;
  float safeLoadCellTotal = (loadCellTotal < 0 || isnan(loadCellTotal)) ? 0 : loadCellTotal;
  int safeBattery = (batteryPercentage < 0 || batteryPercentage > 100) ? 100 : batteryPercentage;
  float safeTemp = (temperature < -10 || temperature > 100) ? 25 : temperature;
  
  // SANITIZE machineStatus - only allow valid values
  String safeMachineStatus = "ACTIVE";
  if (machineStatus == "MAINTENANCE") safeMachineStatus = "MAINTENANCE";
  else if (machineStatus == "ERROR") safeMachineStatus = "ERROR";
  else if (machineStatus == "ACTIVE") safeMachineStatus = "ACTIVE";
  else safeMachineStatus = "ACTIVE";
  
  // Create JSON payload
  JsonDocument doc;
  // ===== IMPORTANT: DO NOT SEND deviceId =====
  // Your MACHINES table does not have a deviceId field
  // REMOVED: doc["deviceId"] = DEVICE_ID;
  
  doc["loadCellLeft"] = safeLoadCellLeft;
  doc["loadCellRight"] = safeLoadCellRight;
  doc["loadCellTotal"] = safeLoadCellTotal;
  doc["loadCellStatus"] = getLoadCellStatus();
  doc["batteryPercentage"] = safeBattery;
  doc["doorStatus"] = doorStatus;
  doc["temperature"] = safeTemp;
  doc["machineState"] = machineState;
  doc["transactionCount"] = safeTransactionCount;
  doc["machineStatus"] = safeMachineStatus;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("📤 Sending to backend: ");
  Serial.println(jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode == 200 || httpResponseCode == 201) {
    Serial.println("✅ Sensor data sent successfully!");
    Serial.print("   Storage - Sinandomeng: ");
    Serial.print(safeLoadCellLeft);
    Serial.print("kg, Dinorado: ");
    Serial.print(safeLoadCellRight);
    Serial.print("kg, Total: ");
    Serial.print(safeLoadCellTotal);
    Serial.println("kg");
    lastSuccessfulSend = millis();
  } else {
    Serial.printf("❌ Error sending sensor data: %d\n", httpResponseCode);
    if (httpResponseCode == -1) {
      Serial.println("   → Connection failed. Check BACKEND_URL");
    } else if (httpResponseCode == -11) {
      Serial.println("   → Connection refused");
    } else if (httpResponseCode == 500) {
      Serial.println("   → Backend error. Check server logs.");
      // Try again without transactionCount
      Serial.println("   → Retrying without transactionCount...");
      
      JsonDocument doc2;
      doc2["loadCellLeft"] = safeLoadCellLeft;
      doc2["loadCellRight"] = safeLoadCellRight;
      doc2["loadCellTotal"] = safeLoadCellTotal;
      doc2["loadCellStatus"] = getLoadCellStatus();
      doc2["batteryPercentage"] = safeBattery;
      doc2["doorStatus"] = doorStatus;
      doc2["temperature"] = safeTemp;
      doc2["machineState"] = machineState;
      doc2["machineStatus"] = safeMachineStatus;
      
      String jsonString2;
      serializeJson(doc2, jsonString2);
      
      http.begin(url);
      http.addHeader("Content-Type", "application/json");
      int retryCode = http.POST(jsonString2);
      
      if (retryCode == 200 || retryCode == 201) {
        Serial.println("✅ Sensor data sent successfully (without transactionCount)!");
        lastSuccessfulSend = millis();
      } else {
        Serial.printf("❌ Still failing: %d\n", retryCode);
      }
    }
  }
  
  http.end();
  
  // Small delay to prevent overwhelming the server
  delay(100);
}

void sendTransactionToBackend(float kg, float amount, String riceType, String status, String transactionID) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ No WiFi - Transaction not sent");
    return;
  }
  
  HTTPClient http;
  String url = String(BACKEND_URL) + ENDPOINT_TRANSACTION;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);
  
  String fullRiceType;
  float pricePerKg;
  
  if (riceType == "DINORADO") {
    fullRiceType = "Dinorado Rice";
    pricePerKg = dinoradoPrice;
  } else if (riceType == "SINANDOMENG") {
    fullRiceType = "Sinandomeng Rice";
    pricePerKg = sinandomengPrice;
  } else {
    fullRiceType = riceType + " Rice";
    pricePerKg = sinandomengPrice;
  }
  
  JsonDocument doc;
  doc["transactionId"] = transactionID;
  doc["riceType"] = fullRiceType;
  doc["quantityKg"] = kg;
  doc["amountPaid"] = amount;
  doc["status"] = "COMPLETED";
  doc["remainingStockPremium"] = storage2Weight;
  doc["remainingStockRegular"] = storage1Weight;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.println("========================================");
  Serial.println("📤 SENDING TRANSACTION TO BACKEND:");
  Serial.print("  Transaction ID: ");
  Serial.println(transactionID);
  Serial.print("  Rice Type: ");
  Serial.println(fullRiceType);
  Serial.print("  Quantity: ");
  Serial.print(kg);
  Serial.println(" kg");
  Serial.print("  Amount: PHP ");
  Serial.println(amount);
  Serial.print("  Remaining Stock: ");
  Serial.print(storage2Weight);
  Serial.print("kg / ");
  Serial.print(storage1Weight);
  Serial.println("kg");
  Serial.println("========================================");
  
  int httpResponseCode = http.POST(jsonString);
  
  Serial.print("HTTP Response Code: ");
  Serial.println(httpResponseCode);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    if (httpResponseCode == 200 || httpResponseCode == 201) {
      Serial.println("✅ TRANSACTION SUCCESSFULLY RECORDED IN DATABASE!");
      Serial.print("Response: ");
      Serial.println(response);
    } else {
      Serial.printf("❌ Transaction failed with code: %d\n", httpResponseCode);
      Serial.print("Error response: ");
      Serial.println(response);
    }
  } else {
    Serial.printf("❌ HTTP Error: %d\n", httpResponseCode);
    if (httpResponseCode == -11) {
      Serial.println("   → Connection refused. Check if backend is running.");
    } else if (httpResponseCode == -1) {
      Serial.println("   → Connection timeout.");
    }
  }
  
  http.end();
  Serial.println("========================================\n");
}

void sendSecurityAlertToBackend(String alertType, String doorStatus) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  String url = String(BACKEND_URL) + ENDPOINT_SECURITY;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  JsonDocument doc;
  doc["alertType"] = alertType;
  doc["doorStatus"] = doorStatus;
  doc["timestamp"] = millis();
  
  if (alertType == "LOAD_CELL_ERROR") {
    doc["loadCellLeftError"] = loadCellLeftError;
    doc["loadCellRightError"] = loadCellRightError;
    doc["loadCellLeftValue"] = storage1Weight;
    doc["loadCellRightValue"] = storage2Weight;
  }
  
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
        sendSensorDataToBackend();
      }
      else if (data.startsWith("TXN|")) {
        parseTransactionData(data);
      }
      else if (data.startsWith("STOCK|")) {
        parseStockData(data);
      }
      else if (data.startsWith("LOADCELL|")) {
        parseLoadCellData(data);
        sendSensorDataToBackend();
      }
      else if (data.startsWith("PRICE|")) {
        parsePriceData(data);
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

void parsePriceData(String data) {
  data = data.substring(6);
  
  int separator = data.indexOf('|');
  if (separator > 0) {
    float newDinorado = data.substring(0, separator).toFloat();
    float newSinandomeng = data.substring(separator + 1).toFloat();
    
    if (newDinorado != dinoradoPrice || newSinandomeng != sinandomengPrice) {
      dinoradoPrice = newDinorado;
      sinandomengPrice = newSinandomeng;
      Serial.printf("💰 Prices updated from Mega - D: %.2f, S: %.2f\n", dinoradoPrice, sinandomengPrice);
    }
  }
}

void parseLoadCellData(String data) {
  // Format: LOADCELL|leftKg|rightKg|totalKg|leftError|rightError
  // LEFT = Sinandomeng, RIGHT = Dinorado
  data = data.substring(9);
  
  int firstBar = data.indexOf('|');
  int secondBar = data.indexOf('|', firstBar + 1);
  int thirdBar = data.indexOf('|', secondBar + 1);
  int fourthBar = data.indexOf('|', thirdBar + 1);
  
  if (firstBar > 0 && secondBar > 0 && thirdBar > 0 && fourthBar > 0) {
    storage1Weight = data.substring(0, firstBar).toFloat();     // Sinandomeng
    storage2Weight = data.substring(firstBar + 1, secondBar).toFloat();  // Dinorado
    loadCellTotal = data.substring(secondBar + 1, thirdBar).toFloat();
    loadCellLeftError = data.substring(thirdBar + 1, fourthBar).toInt() == 1;
    loadCellRightError = data.substring(fourthBar + 1).toInt() == 1;
    
    lastLoadCellRead = millis();
    
    Serial.println("========================================");
    Serial.println("📊 LOAD CELL DATA RECEIVED:");
    Serial.print("  Sinandomeng (Storage1): ");
    Serial.print(storage1Weight);
    Serial.println(" kg");
    Serial.print("  Dinorado (Storage2): ");
    Serial.print(storage2Weight);
    Serial.println(" kg");
    Serial.print("  Total Weight: ");
    Serial.print(loadCellTotal);
    Serial.println(" kg");
    if (loadCellLeftError) Serial.println("  ⚠️ Left load cell ERROR!");
    if (loadCellRightError) Serial.println("  ⚠️ Right load cell ERROR!");
    Serial.println("========================================");
    
    if (loadCellLeftError || loadCellRightError) {
      sendSecurityAlertToBackend("LOAD_CELL_ERROR", doorStatus);
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
    float megaStock1 = data.substring(parts[0] + 1, parts[1]).toFloat();
    float megaStock2 = data.substring(parts[1] + 1, parts[2]).toFloat();
    insertedAmount = data.substring(parts[2] + 1, parts[3]).toFloat();
    lastDispenseKg = data.substring(parts[3] + 1, parts[4]).toFloat();
    selectedGrain = data.substring(parts[4] + 1, parts[5]).toInt();
    targetQuantity = data.substring(parts[5] + 1, parts[6]).toInt();
    errorCode = data.substring(parts[6] + 1, parts[7]).toInt();
    uint32_t rawTransactionCount = data.substring(parts[7] + 1, parts[8]).toInt();
    
    // SANITIZE transactionCount - prevent overflow
    if (rawTransactionCount > 10000 || rawTransactionCount == 0xFFFFFFFF) {
      transactionCount = 0;
      Serial.println("⚠️ Invalid transaction count received, reset to 0");
    } else {
      transactionCount = rawTransactionCount;
    }
    
    // Only use Mega stock if load cells haven't sent data recently
    if (millis() - lastLoadCellRead > 5000) {
      storage1Weight = megaStock1;
      storage2Weight = megaStock2;
    }
    
    if (errorCode != 0) {
      machineStatus = "ERROR";
    } else if (storage1Weight < 2 && storage2Weight < 2) {
      machineStatus = "MAINTENANCE";
    } else {
      machineStatus = "ACTIVE";
    }
    
    const char* stateNames[] = {"IDLE", "GRAIN_SELECTED", "QUANTITY_SELECTED", "PAYMENT", "DISPENSING", "COMPLETE"};
    Serial.print("📊 Status: State=");
    Serial.print(stateNames[machineState]);
    Serial.print(", Stock(S1/S2)=");
    Serial.print(storage1Weight);
    Serial.print("/");
    Serial.print(storage2Weight);
    Serial.println(" kg");
    
    if (doorStatus == "OPEN" && machineState != 0) {
      sendSecurityAlertToBackend("DOOR_OPEN", doorStatus);
    }
  }
}

void parseTransactionData(String data) {
  Serial.println("📦 Parsing transaction data...");
  data = data.substring(4);
  
  int firstBar = data.indexOf('|');
  int secondBar = data.indexOf('|', firstBar + 1);
  int thirdBar = data.indexOf('|', secondBar + 1);
  int fourthBar = data.indexOf('|', thirdBar + 1);
  
  if (firstBar > 0 && secondBar > 0 && thirdBar > 0 && fourthBar > 0) {
    float kg = data.substring(0, firstBar).toFloat();
    float amount = data.substring(firstBar + 1, secondBar).toFloat();
    String riceType = data.substring(secondBar + 1, thirdBar);
    String status = data.substring(thirdBar + 1, fourthBar);
    String transactionID = data.substring(fourthBar + 1);
    
    Serial.println("========================================");
    Serial.println("📋 TRANSACTION RECEIVED FROM MEGA:");
    Serial.printf("  Transaction ID: %s\n", transactionID.c_str());
    Serial.printf("  Product: %s\n", riceType.c_str());
    Serial.printf("  Quantity: %.3f kg\n", kg);
    Serial.printf("  Amount: PHP %.2f\n", amount);
    Serial.printf("  Status: %s\n", status.c_str());
    Serial.println("========================================");
    
    sendTransactionToBackend(kg, amount, riceType, status, transactionID);
  } else {
    Serial.println("❌ Failed to parse transaction data!");
    Serial.print("Raw data: ");
    Serial.println(data);
  }
}

void parseStockData(String data) {
  data = data.substring(6);
  int barPos = data.indexOf('|');
  if (barPos > 0) {
    if (millis() - lastLoadCellRead > 5000) {
      storage1Weight = data.substring(0, barPos).toFloat();
      storage2Weight = data.substring(barPos + 1).toFloat();
    }
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
  Serial.println("╠────────────── STORAGE ────────────────╣");
  Serial.printf("║ 🍚 Storage1 (Sinandomeng): %.1f kg (%s)    ║\n", storage1Weight, getStorage1Status().c_str());
  Serial.printf("║ 🍚 Storage2 (Dinorado): %.1f kg (%s)      ║\n", storage2Weight, getStorage2Status().c_str());
  Serial.printf("║ 💰 Dinorado Price: PHP %.2f               ║\n", dinoradoPrice);
  Serial.printf("║ 💰 Sinandomeng Price: PHP %.2f            ║\n", sinandomengPrice);
  Serial.printf("║ 📐 Load Cell L: %.1f kg                 ║\n", storage1Weight);
  Serial.printf("║ 📐 Load Cell R: %.1f kg                 ║\n", storage2Weight);
  Serial.printf("║ ⚖️ Total: %.1f kg                       ║\n", loadCellTotal);
  Serial.printf("║ 🔧 Load Cell Status: %-17s ║\n", getLoadCellStatus().c_str());
  Serial.println("╠───────────────────────────────────────╣");
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
  
  // Fetch prices periodically
  if (millis() - lastPriceFetch >= PRICE_FETCH_INTERVAL) {
    fetchPricesFromBackend();
    lastPriceFetch = millis();
  }
  
  // Note: sendSensorDataToBackend is already called from parseLoadCellData and parseStatusData
  // The periodic backup is now handled by the rate limiter
  
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