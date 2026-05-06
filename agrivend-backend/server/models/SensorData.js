// models/SensorData.js
import mongoose from 'mongoose';

const sensorDataSchema = new mongoose.Schema({
  // ===== LOAD CELL DATA (FROM HX711 SENSORS) =====
  loadCellLeft: { type: Number, default: 0 },        // Raw left load cell reading (kg) - Premium/Dinorado
  loadCellRight: { type: Number, default: 0 },       // Raw right load cell reading (kg) - Regular/Sinandomeng
  loadCellTotal: { type: Number, default: 0 },       // Total weight from both load cells (kg)
  loadCellStatus: { type: String, default: 'OK' },   // Status: 'OK', 'LOW', 'ERROR', 'NO_DATA'
  
  // ===== STOCK LEVELS (FROM LOAD CELLS) =====
  container1Level: { type: Number, default: 0 },     // Premium/Dinorado actual weight (kg)
  container2Level: { type: Number, default: 0 },     // Regular/Sinandomeng actual weight (kg)
  
  // ===== OTHER SENSORS =====
  collectionBinWeight: { type: Number, default: 0 },
  batteryVoltage: { type: Number, default: 12.5 },
  batteryPercentage: { type: Number, default: 100 },
  temperature: { type: Number, default: 25 },
  humidity: { type: Number, default: 60 },
  doorStatus: { type: String, enum: ['OPEN', 'CLOSED'], default: 'CLOSED' },
  vibrationDetected: { type: Boolean, default: false },
  
  // ===== MACHINE STATUS =====
  machineStatus: { type: String, enum: ['ACTIVE', 'ERROR', 'MAINTENANCE'], default: 'ACTIVE' },
  machineState: { type: Number, default: 0 },        // 0=IDLE, 1=PRODUCT_SELECTED, etc.
  transactionCount: { type: Number, default: 0 },
  
  // ===== STOCK STATUS TEXT (Auto-calculated from load cells) =====
  container1Stock: { type: String, enum: ['OK', 'LOW', 'EMPTY', 'NO_DATA'], default: 'NO_DATA' },
  container2Stock: { type: String, enum: ['OK', 'LOW', 'EMPTY', 'NO_DATA'], default: 'NO_DATA' },
  
  // ===== DEVICE ID =====
  deviceId: { type: String, default: 'AGRIVEND_001' }
  
}, { timestamps: true });

// Pre-save middleware to auto-calculate stock status based on load cell readings
sensorDataSchema.pre('save', function(next) {
  // Auto-calculate container1Stock based on container1Level
  if (this.container1Level <= 0.05) {
    this.container1Stock = 'EMPTY';
    this.loadCellStatus = 'LOW';
  } else if (this.container1Level < 5) {
    this.container1Stock = 'LOW';
    this.loadCellStatus = 'OK';
  } else {
    this.container1Stock = 'OK';
    this.loadCellStatus = 'OK';
  }
  
  // Auto-calculate container2Stock based on container2Level
  if (this.container2Level <= 0.05) {
    this.container2Stock = 'EMPTY';
  } else if (this.container2Level < 5) {
    this.container2Stock = 'LOW';
  } else {
    this.container2Stock = 'OK';
  }
  
  // Auto-calculate total load cell weight
  this.loadCellTotal = this.loadCellLeft + this.loadCellRight;
  
  // If no load cell data, mark as NO_DATA
  if (this.loadCellLeft === 0 && this.loadCellRight === 0 && this.container1Level === 0 && this.container2Level === 0) {
    this.loadCellStatus = 'NO_DATA';
    this.container1Stock = 'NO_DATA';
    this.container2Stock = 'NO_DATA';
  }
  
  next();
});

// Method to update stock from load cell readings
sensorDataSchema.methods.updateFromLoadCells = function(leftKg, rightKg) {
  this.loadCellLeft = leftKg;
  this.loadCellRight = rightKg;
  this.container1Level = leftKg;
  this.container2Level = rightKg;
  this.loadCellTotal = leftKg + rightKg;
  
  // Update statuses
  if (leftKg <= 0.05) {
    this.container1Stock = 'EMPTY';
  } else if (leftKg < 5) {
    this.container1Stock = 'LOW';
  } else {
    this.container1Stock = 'OK';
  }
  
  if (rightKg <= 0.05) {
    this.container2Stock = 'EMPTY';
  } else if (rightKg < 5) {
    this.container2Stock = 'LOW';
  } else {
    this.container2Stock = 'OK';
  }
  
  if (leftKg === 0 && rightKg === 0) {
    this.loadCellStatus = 'NO_DATA';
  } else {
    this.loadCellStatus = 'OK';
  }
  
  return this;
};

const SensorData = mongoose.model('SensorData', sensorDataSchema);
export default SensorData;