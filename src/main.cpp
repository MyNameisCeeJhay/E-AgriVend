/**
 * ESP32 CODE - WiFi Bridge for Rice Vending Machine
 * PlatformIO Version
 * Receives data from Arduino Mega via UART
 * Sends data to backend website for admin monitoring
 * 
 * CONNECTIONS:
 * - ESP32 RX2 (Pin 16) -> Mega TX2 (Pin 17) with LEVEL SHIFTER
 * - ESP32 TX2 (Pin 17) -> Mega RX2 (Pin 16) with LEVEL SHIFTER
 * - GND -> GND
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
void sendStatusToBackend();
void sendTransactionToBackend(float kg, float amount, String riceType, String status);
void sendErrorToBackend(String errorType);
void checkMegaConnection();
void printStatus();

// ============================================
// WiFi CONFIGURATION - CHANGE THESE
// ============================================
const char* WIFI_SSID = "SKYW_0A48_2G";
const char* WIFI_PASSWORD = "M49wP9pr";

// Backend Server URL - CHANGE THIS TO YOUR COMPUTER'S IP
// Find your IP: Windows: ipconfig, Mac/Linux: ifconfig
const char* SERVER_URL = "http://192.168.1.33:5000/api/esp32";

// Device ID
const char* DEVICE_ID = "AGRIVEND_001";

// ============================================
// UART PINS for Mega Communication
// ============================================
#define MEGA_RX_PIN 16  // ESP32 RX - connect to Mega TX (with level shifter)
#define MEGA_TX_PIN 17  // ESP32 TX - connect to Mega RX

// ============================================
// LED PINS
// ============================================
#define LED_WIFI 2      // Built-in LED - WiFi status
#define LED_DATA 4      // External LED - Data activity (connect to pin 4)

// ============================================
// VARIABLES (Received from Mega)
// ============================================
// Stock levels
float stockPremium = 20.0;
float stockRegular = 20.0;

// Machine status
int machineState = 0;        // 0=IDLE, 1=GRAIN_SELECTED, 2=QUANTITY_SELECTED, 3=PAYMENT, 4=DISPENSING, 5=COMPLETE
float insertedAmount = 0;
float lastDispenseKg = 0;
int selectedGrain = 0;
int targetQuantity = 1;
int errorCode = 0;
uint32_t transactionCount = 0;

// Communication status
bool megaConnected = false;
unsigned long lastMegaData = 0;
const unsigned long MEGA_TIMEOUT = 10000;  // 10 seconds timeout

// Timing
unsigned long lastSendToBackend = 0;
const unsigned long BACKEND_INTERVAL = 5000;  // Send every 5 seconds
unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 30000;
unsigned long lastStatusPrint = 0;
const unsigned long STATUS_PRINT_INTERVAL = 30000;  // Print status every 30 seconds

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
  
  Serial.println("\n=================================");
  Serial.println("🌾 ESP32 - WiFi Bridge");
  Serial.println("Receives data from Arduino Mega");
  Serial.println("=================================");
  Serial.print("Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.print("UART pins: RX=");
  Serial.print(MEGA_RX_PIN);
  Serial.print(", TX=");
  Serial.println(MEGA_TX_PIN);
  Serial.print("Backend URL: ");
  Serial.println(SERVER_URL);
  Serial.println("=================================\n");
  
  // Connect to WiFi
  connectToWiFi();
  
  Serial.println("✅ ESP32 Ready - Waiting for Mega data...");
  Serial.println("Waiting for MEGA:READY signal...\n");
}

// ============================================
// WiFi FUNCTIONS
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
    digitalWrite(LED_WIFI, HIGH);
  } else {
    Serial.println("\n❌ WiFi Connection Failed!");
    Serial.println("Check SSID and password");
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
// PROCESS DATA FROM ARDUINO MEGA
// ============================================
void processMegaData() {
  if (Serial2.available()) {
    String data = Serial2.readStringUntil('\n');
    data.trim();
    
    if (data.length() > 0) {
      // Blink LED to show data activity
      digitalWrite(LED_DATA, HIGH);
      delay(50);
      digitalWrite(LED_DATA, LOW);
      
      Serial.print("[MEGA → ESP32] ");
      Serial.println(data);
      
      lastMegaData = millis();
      megaConnected = true;
      
      // Parse different message types
      if (data.startsWith("MEGA:READY")) {
        Serial.println("✅ Mega is ready and connected!");
        Serial2.println("ESP32:READY");
      }
      else if (data.startsWith("DATA|")) {
        parseStatusData(data);
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
  // Format: DATA|state|stockPremium|stockRegular|insertedAmount|lastDispenseKg|selectedGrain|targetQty|errorCode|transactionCount
  data = data.substring(5);  // Remove "DATA|"
  
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
    stockPremium = data.substring(parts[0] + 1, parts[1]).toFloat();
    stockRegular = data.substring(parts[1] + 1, parts[2]).toFloat();
    insertedAmount = data.substring(parts[2] + 1, parts[3]).toFloat();
    lastDispenseKg = data.substring(parts[3] + 1, parts[4]).toFloat();
    selectedGrain = data.substring(parts[4] + 1, parts[5]).toInt();
    targetQuantity = data.substring(parts[5] + 1, parts[6]).toInt();
    errorCode = data.substring(parts[6] + 1, parts[7]).toInt();
    transactionCount = data.substring(parts[7] + 1, parts[8]).toInt();
    
    const char* stateNames[] = {"IDLE", "GRAIN_SELECTED", "QUANTITY_SELECTED", "PAYMENT", "DISPENSING", "COMPLETE"};
    Serial.print("📊 Status: State=");
    Serial.print(stateNames[machineState]);
    Serial.print(", Stock(P/R)=");
    Serial.print(stockPremium);
    Serial.print("/");
    Serial.print(stockRegular);
    Serial.println(" kg");
  }
}

void parseTransactionData(String data) {
  // Format: TXN|kg|amount|riceType|status
  data = data.substring(4);  // Remove "TXN|"
  
  int firstBar = data.indexOf('|');
  int secondBar = data.indexOf('|', firstBar + 1);
  int thirdBar = data.indexOf('|', secondBar + 1);
  
  if (firstBar > 0 && secondBar > 0 && thirdBar > 0) {
    float kg = data.substring(0, firstBar).toFloat();
    float amount = data.substring(firstBar + 1, secondBar).toFloat();
    String riceType = data.substring(secondBar + 1, thirdBar);
    String status = data.substring(thirdBar + 1);
    
    Serial.print("💰 Transaction: ");
    Serial.print(kg, 3);
    Serial.print("kg ");
    Serial.print(riceType);
    Serial.print(" - ₱");
    Serial.print(amount, 2);
    Serial.print(" [");
    Serial.print(status);
    Serial.println("]");
    
    // Immediately send transaction to backend
    sendTransactionToBackend(kg, amount, riceType, status);
  }
}

void parseStockData(String data) {
  // Format: STOCK|premium|regular
  data = data.substring(6);  // Remove "STOCK|"
  
  int barPos = data.indexOf('|');
  if (barPos > 0) {
    stockPremium = data.substring(0, barPos).toFloat();
    stockRegular = data.substring(barPos + 1).toFloat();
    
    Serial.print("📦 Stock updated: Premium=");
    Serial.print(stockPremium, 2);
    Serial.print("kg, Regular=");
    Serial.print(stockRegular, 2);
    Serial.println("kg");
  }
}

void parseStateData(String data) {
  // Format: STATE|stateValue
  machineState = data.substring(6).toInt();
  
  const char* stateNames[] = {"IDLE", "GRAIN_SELECTED", "QUANTITY_SELECTED", "PAYMENT", "DISPENSING", "COMPLETE"};
  Serial.print("📊 Machine State: ");
  Serial.println(stateNames[machineState]);
}

void parseErrorData(String data) {
  // Format: ERROR|errorType
  String errorType = data.substring(6);
  Serial.print("❌ Error from Mega: ");
  Serial.println(errorType);
  
  // Send error to backend
  sendErrorToBackend(errorType);
}

// ============================================
// CHECK MEGA CONNECTION
// ============================================
void checkMegaConnection() {
  if (millis() - lastMegaData > MEGA_TIMEOUT) {
    if (megaConnected) {
      megaConnected = false;
      Serial.println("⚠️ WARNING: Mega connection lost!");
      
      // Send heartbeat to check
      Serial2.println("PING");
    }
  } else {
    if (!megaConnected && (millis() - lastMegaData) < MEGA_TIMEOUT) {
      megaConnected = true;
      Serial.println("✅ Mega reconnected!");
    }
  }
}

// ============================================
// SEND DATA TO BACKEND WEBSITE
// ============================================
void sendStatusToBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/status";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  // Create JSON document
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["state"] = machineState;
  doc["stockPremium"] = stockPremium;
  doc["stockRegular"] = stockRegular;
  doc["insertedAmount"] = insertedAmount;
  doc["lastDispenseKg"] = lastDispenseKg;
  doc["selectedGrain"] = selectedGrain;
  doc["targetQuantity"] = targetQuantity;
  doc["errorCode"] = errorCode;
  doc["transactionCount"] = transactionCount;
  doc["megaConnected"] = megaConnected;
  
  // Determine machine status
  String machineStatus = "ACTIVE";
  if (stockPremium < 0.5 && stockRegular < 0.5) {
    machineStatus = "EMPTY";
  } else if (errorCode == 1) {
    machineStatus = "LOW_STOCK";
  } else if (!megaConnected) {
    machineStatus = "MEGA_DISCONNECTED";
  } else if (machineState == 4) {
    machineStatus = "DISPENSING";
  } else if (machineState == 3) {
    machineStatus = "PAYMENT_MODE";
  }
  doc["machineStatus"] = machineStatus;
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    if (httpResponseCode == 200) {
      Serial.println("📤 Status sent to backend successfully");
    } else {
      Serial.print("📤 Status sent. Response: ");
      Serial.println(httpResponseCode);
    }
  } else {
    Serial.print("❌ Error sending status: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void sendTransactionToBackend(float kg, float amount, String riceType, String status) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ No WiFi - Transaction will be sent when WiFi reconnects");
    return;
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/transaction";
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
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.println("💰 Transaction sent to backend successfully!");
  } else {
    Serial.print("❌ Failed to send transaction: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void sendErrorToBackend(String errorType) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  HTTPClient http;
  String url = String(SERVER_URL) + "/error";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(5000);
  
  JsonDocument doc;
  doc["deviceId"] = DEVICE_ID;
  doc["errorType"] = errorType;
  doc["timestamp"] = millis();
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    Serial.print("🚨 Error sent to backend: ");
    Serial.println(errorType);
  } else {
    Serial.print("❌ Failed to send error: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

// ============================================
// PRINT STATUS TO SERIAL MONITOR
// ============================================
void printStatus() {
  const char* stateNames[] = {"IDLE", "GRAIN_SELECTED", "QUANTITY_SELECTED", "PAYMENT", "DISPENSING", "COMPLETE"};
  
  Serial.println("\n╔═══════════════════════════════════════╗");
  Serial.println("║         ESP32 STATUS REPORT           ║");
  Serial.println("╠═══════════════════════════════════════╣");
  Serial.print  ("║ 🔗 Mega Connected: ");
  Serial.print(megaConnected ? "YES ✅            " : "NO ❌             ");
  Serial.println("║");
  Serial.print  ("║ 📡 WiFi: ");
  Serial.print(WiFi.status() == WL_CONNECTED ? "Connected ✅       " : "Disconnected ❌    ");
  Serial.println("║");
  Serial.print  ("║ 📊 Machine State: ");
  Serial.print(stateNames[machineState]);
  for(int i = strlen(stateNames[machineState]); i < 18; i++) Serial.print(" ");
  Serial.println("║");
  Serial.print  ("║ 🍚 Premium Stock: ");
  Serial.print(stockPremium, 1);
  Serial.print(" kg");
  if(stockPremium < 10) Serial.print(" ");
  Serial.println("             ║");
  Serial.print  ("║ 🍚 Regular Stock: ");
  Serial.print(stockRegular, 1);
  Serial.print(" kg");
  if(stockRegular < 10) Serial.print(" ");
  Serial.println("             ║");
  Serial.print  ("║ 💰 Last Amount: ₱");
  Serial.print(insertedAmount, 2);
  if(insertedAmount < 100) Serial.print(" ");
  Serial.println("            ║");
  Serial.print  ("║ 📈 Transactions: ");
  Serial.print(transactionCount);
  for(int i = String(transactionCount).length(); i < 18; i++) Serial.print(" ");
  Serial.println("║");
  Serial.println("╚═══════════════════════════════════════╝\n");
}

// ============================================
// MAIN LOOP
// ============================================
void loop() {
  // Process incoming data from Mega
  processMegaData();
  
  // Check Mega connection
  checkMegaConnection();
  
  // Send status to backend periodically
  if (millis() - lastSendToBackend >= BACKEND_INTERVAL) {
    if (megaConnected && WiFi.status() == WL_CONNECTED) {
      sendStatusToBackend();
    }
    lastSendToBackend = millis();
  }
  
  // Print status to serial monitor periodically
  if (millis() - lastStatusPrint >= STATUS_PRINT_INTERVAL) {
    printStatus();
    lastStatusPrint = millis();
  }
  
  // Check WiFi periodically
  if (millis() - lastWiFiCheck >= WIFI_CHECK_INTERVAL) {
    checkWiFi();
    lastWiFiCheck = millis();
  }
  
  delay(50);
}