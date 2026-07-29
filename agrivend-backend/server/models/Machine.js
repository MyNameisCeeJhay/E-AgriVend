import mongoose from 'mongoose';

const storageSchema = new mongoose.Schema({
  name: { type: String, default: 'Sinandomeng Rice' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  pricePerKg: { type: Number, default: 0 },
  currentWeight: { type: Number, default: 0 },
  maxCapacity: { type: Number, default: 20 },
  percentage: { type: Number, default: 0 },
  status: { type: String, enum: ['Normal', 'Low', 'Critical', 'Empty'], default: 'Normal' },
  isLow: { type: Boolean, default: false },
  isEmpty: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now }
});

const batterySchema = new mongoose.Schema({
  percentage: { type: Number, default: 100 },
  voltage: { type: Number, default: 12.6 },
  status: { type: String, enum: ['Good', 'Warning', 'Critical'], default: 'Good' },
  isCharging: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
});

const machineStatusSchema = new mongoose.Schema({
  isOnline: { type: Boolean, default: true },
  temperature: { type: Number, default: 25 },
  doorStatus: { type: String, enum: ['Open', 'Closed'], default: 'Closed' },
  securityStatus: { type: String, enum: ['Safe', 'Alert'], default: 'Safe' },
  loadCellStatus: { type: String, enum: ['OK', 'ERROR', 'LOW'], default: 'OK' },
  transactionCount: { type: Number, default: 0 },
  lastUpdate: { type: Date, default: Date.now }
});

// ============================================
// CASH MONITORING SCHEMA (NEW)
// ============================================
const cashCoinSchema = new mongoose.Schema({
  onePeso: { type: Number, default: 0 },
  fivePeso: { type: Number, default: 0 },
  tenPeso: { type: Number, default: 0 },
  twentyPeso: { type: Number, default: 0 }
}, { _id: false });

const cashBillSchema = new mongoose.Schema({
  twenty: { type: Number, default: 0 },
  fifty: { type: Number, default: 0 },
  hundred: { type: Number, default: 0 },
  twoHundred: { type: Number, default: 0 }
}, { _id: false });

const cashCollectionSchema = new mongoose.Schema({
  collectedBy: { type: String, default: 'Staff' },
  amount: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  notes: { type: String, default: '' }
});

const cashMonitoringSchema = new mongoose.Schema({
  coins: { type: cashCoinSchema, default: () => ({}) },
  bills: { type: cashBillSchema, default: () => ({}) },
  total: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  history: { type: [cashCollectionSchema], default: [] }
}, { _id: false });

// ============================================
// CALIBRATION SCHEMA (NEW)
// ============================================
const calibrationSchema = new mongoose.Schema({
  rawValue: { type: Number, default: 0 },
  calibratedValue: { type: Number, default: 0 },
  unit: { type: String, default: 'kg' },
  status: { 
    type: String, 
    enum: ['Stable', 'Active', 'Calibrated', 'Zeroed', 'Error'], 
    default: 'Stable' 
  },
  lastCalibrated: { type: Date },
  lastZeroed: { type: Date }
}, { _id: false });

// ============================================
// SENSOR HISTORY SCHEMA (NEW)
// ============================================
const sensorHistorySchema = new mongoose.Schema({
  storage1Weight: { type: Number },
  storage2Weight: { type: Number },
  batteryPercentage: { type: Number },
  temperature: { type: Number },
  doorStatus: { type: String },
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

// ============================================
// MAIN MACHINE SCHEMA (UPDATED)
// ============================================
const machineSchema = new mongoose.Schema({
  storage1: { type: storageSchema, default: () => ({}) },
  storage2: { type: storageSchema, default: () => ({}) },
  battery: { type: batterySchema, default: () => ({}) },
  machineStatus: { type: machineStatusSchema, default: () => ({}) },
  
  // NEW: Cash Monitoring
  cash: { 
    type: cashMonitoringSchema, 
    default: () => ({ 
      coins: { onePeso: 0, fivePeso: 0, tenPeso: 0, twentyPeso: 0 },
      bills: { twenty: 0, fifty: 0, hundred: 0, twoHundred: 0 },
      total: 0,
      history: []
    }) 
  },
  
  // NEW: Calibration
  calibration: {
    storage1: { type: calibrationSchema, default: () => ({ unit: 'kg', status: 'Stable' }) },
    storage2: { type: calibrationSchema, default: () => ({ unit: 'kg', status: 'Stable' }) },
    dispense: { type: calibrationSchema, default: () => ({ unit: 'kg', status: 'Stable' }) }
  },
  
  // NEW: Sensor History
  sensorHistory: { type: [sensorHistorySchema], default: [] },
  
  // Optional: Device ID for ESP32
  deviceId: { type: String, unique: true, sparse: true }
}, { timestamps: true });

// ============================================
// PRE-SAVE MIDDLEWARE - WITH ERROR HANDLING
// ============================================

machineSchema.pre('save', function(next) {
  try {
    const now = new Date();
    
    // Initialize default values if undefined
    if (!this.storage1) this.storage1 = {};
    if (!this.storage2) this.storage2 = {};
    if (!this.battery) this.battery = {};
    if (!this.machineStatus) this.machineStatus = {};
    if (!this.cash) this.cash = { coins: {}, bills: {}, total: 0, history: [] };
    if (!this.calibration) this.calibration = {};
    if (!this.calibration.storage1) this.calibration.storage1 = { unit: 'kg', status: 'Stable' };
    if (!this.calibration.storage2) this.calibration.storage2 = { unit: 'kg', status: 'Stable' };
    if (!this.calibration.dispense) this.calibration.dispense = { unit: 'kg', status: 'Stable' };
    
    // Set defaults for storage1
    if (this.storage1.currentWeight === undefined) this.storage1.currentWeight = 0;
    if (this.storage1.maxCapacity === undefined) this.storage1.maxCapacity = 20;
    if (this.storage1.name === undefined) this.storage1.name = 'Sinandomeng Rice';
    
    // Set defaults for storage2
    if (this.storage2.currentWeight === undefined) this.storage2.currentWeight = 0;
    if (this.storage2.maxCapacity === undefined) this.storage2.maxCapacity = 20;
    if (this.storage2.name === undefined) this.storage2.name = 'Dinorado Rice';
    
    // === STORAGE 1 (Sinandomeng - LEFT load cell) ===
    if (this.storage1.currentWeight <= 0.05) {
      this.storage1.percentage = 0;
      this.storage1.status = 'Empty';
      this.storage1.isEmpty = true;
      this.storage1.isLow = false;
    } else if (this.storage1.currentWeight < 5) {
      this.storage1.percentage = (this.storage1.currentWeight / this.storage1.maxCapacity) * 100;
      this.storage1.status = 'Low';
      this.storage1.isEmpty = false;
      this.storage1.isLow = true;
    } else {
      this.storage1.percentage = (this.storage1.currentWeight / this.storage1.maxCapacity) * 100;
      this.storage1.status = 'Normal';
      this.storage1.isEmpty = false;
      this.storage1.isLow = false;
    }
    this.storage1.lastUpdated = now;
    
    // === STORAGE 2 (Dinorado - RIGHT load cell) ===
    if (this.storage2.currentWeight <= 0.05) {
      this.storage2.percentage = 0;
      this.storage2.status = 'Empty';
      this.storage2.isEmpty = true;
      this.storage2.isLow = false;
    } else if (this.storage2.currentWeight < 5) {
      this.storage2.percentage = (this.storage2.currentWeight / this.storage2.maxCapacity) * 100;
      this.storage2.status = 'Low';
      this.storage2.isEmpty = false;
      this.storage2.isLow = true;
    } else {
      this.storage2.percentage = (this.storage2.currentWeight / this.storage2.maxCapacity) * 100;
      this.storage2.status = 'Normal';
      this.storage2.isEmpty = false;
      this.storage2.isLow = false;
    }
    this.storage2.lastUpdated = now;
    
    // === BATTERY STATUS ===
    if (!this.battery.percentage) this.battery.percentage = 100;
    if (this.battery.percentage <= 20) {
      this.battery.status = 'Critical';
    } else if (this.battery.percentage <= 50) {
      this.battery.status = 'Warning';
    } else {
      this.battery.status = 'Good';
    }
    this.battery.lastUpdated = now;
    
    // === MACHINE STATUS ===
    if (this.storage1.status === 'Empty' && this.storage2.status === 'Empty') {
      this.machineStatus.loadCellStatus = 'LOW';
    } else if (this.storage1.status === 'Error' || this.storage2.status === 'Error') {
      this.machineStatus.loadCellStatus = 'ERROR';
    } else {
      this.machineStatus.loadCellStatus = 'OK';
    }
    
    if (this.machineStatus.doorStatus === 'Open') {
      this.machineStatus.securityStatus = 'Alert';
    } else {
      this.machineStatus.securityStatus = 'Safe';
    }
    
    this.machineStatus.lastUpdate = now;
    this.machineStatus.isOnline = true;
    
    // === CASH TOTAL CALCULATION ===
    if (this.cash) {
      const coinTotal = 
        (this.cash.coins?.onePeso || 0) * 1 +
        (this.cash.coins?.fivePeso || 0) * 5 +
        (this.cash.coins?.tenPeso || 0) * 10 +
        (this.cash.coins?.twentyPeso || 0) * 20;
      
      const billTotal = 
        (this.cash.bills?.twenty || 0) * 20 +
        (this.cash.bills?.fifty || 0) * 50 +
        (this.cash.bills?.hundred || 0) * 100 +
        (this.cash.bills?.twoHundred || 0) * 200;
      
      this.cash.total = coinTotal + billTotal;
      this.cash.lastUpdated = now;
    }
    
    next();
  } catch (error) {
    console.error('Error in pre-save middleware:', error);
    next(error);
  }
});

// ============================================
// METHOD: Update from load cell readings
// ============================================
machineSchema.methods.updateFromLoadCells = function(leftKg, rightKg) {
  this.storage1.currentWeight = leftKg || 0;
  this.storage2.currentWeight = rightKg || 0;
  this.machineStatus.lastUpdate = new Date();
  this.machineStatus.isOnline = true;
  return this;
};

// ============================================
// METHOD: Update battery status
// ============================================
machineSchema.methods.updateBattery = function(percentage, voltage, isCharging) {
  this.battery.percentage = percentage || 100;
  this.battery.voltage = voltage || 12.6;
  this.battery.isCharging = isCharging !== undefined ? isCharging : true;
  this.battery.lastUpdated = new Date();
  return this;
};

// ============================================
// METHOD: Update machine status
// ============================================
machineSchema.methods.updateMachineStatus = function(temperature, doorStatus) {
  this.machineStatus.temperature = temperature || 25;
  this.machineStatus.doorStatus = doorStatus === 'OPEN' ? 'Open' : 'Closed';
  this.machineStatus.lastUpdate = new Date();
  this.machineStatus.isOnline = true;
  return this;
};

// ============================================
// NEW METHOD: Add coin insertion
// ============================================
machineSchema.methods.addCoin = function(value) {
  const coinMap = {
    1: 'onePeso',
    5: 'fivePeso', 
    10: 'tenPeso',
    20: 'twentyPeso'
  };
  const key = coinMap[value];
  if (key && this.cash && this.cash.coins) {
    this.cash.coins[key] = (this.cash.coins[key] || 0) + 1;
    this.cash.lastUpdated = new Date();
    return true;
  }
  return false;
};

// ============================================
// NEW METHOD: Add bill insertion
// ============================================
machineSchema.methods.addBill = function(value) {
  const billMap = {
    20: 'twenty',
    50: 'fifty',
    100: 'hundred',
    200: 'twoHundred'
  };
  const key = billMap[value];
  if (key && this.cash && this.cash.bills) {
    this.cash.bills[key] = (this.cash.bills[key] || 0) + 1;
    this.cash.lastUpdated = new Date();
    return true;
  }
  return false;
};

// ============================================
// NEW METHOD: Collect cash
// ============================================
machineSchema.methods.collectCash = function(collectedBy, notes) {
  if (!this.cash) return null;
  
  const amount = this.cash.total || 0;
  if (amount === 0) return null;
  
  // Record collection
  this.cash.history.push({
    collectedBy: collectedBy || 'Staff',
    amount: amount,
    timestamp: new Date(),
    notes: notes || ''
  });
  
  // Reset counts
  this.cash.coins = { onePeso: 0, fivePeso: 0, tenPeso: 0, twentyPeso: 0 };
  this.cash.bills = { twenty: 0, fifty: 0, hundred: 0, twoHundred: 0 };
  this.cash.total = 0;
  this.cash.lastUpdated = new Date();
  
  return amount;
};

// ============================================
// NEW METHOD: Update calibration
// ============================================
machineSchema.methods.updateCalibration = function(scaleName, rawValue, calibratedValue) {
  const validScales = ['storage1', 'storage2', 'dispense'];
  if (!validScales.includes(scaleName)) return false;
  
  if (!this.calibration) this.calibration = {};
  if (!this.calibration[scaleName]) {
    this.calibration[scaleName] = { unit: 'kg', status: 'Stable' };
  }
  
  this.calibration[scaleName].rawValue = rawValue || 0;
  this.calibration[scaleName].calibratedValue = calibratedValue || 0;
  this.calibration[scaleName].status = 'Calibrated';
  this.calibration[scaleName].lastCalibrated = new Date();
  
  return true;
};

// ============================================
// NEW METHOD: Zero calibration
// ============================================
machineSchema.methods.zeroCalibration = function(scaleName) {
  const validScales = ['storage1', 'storage2', 'dispense'];
  if (!validScales.includes(scaleName)) return false;
  
  if (!this.calibration) this.calibration = {};
  if (!this.calibration[scaleName]) {
    this.calibration[scaleName] = { unit: 'kg', status: 'Stable' };
  }
  
  this.calibration[scaleName].rawValue = 0;
  this.calibration[scaleName].calibratedValue = 0;
  this.calibration[scaleName].status = 'Zeroed';
  this.calibration[scaleName].lastZeroed = new Date();
  
  return true;
};

// ============================================
// NEW METHOD: Add sensor history
// ============================================
machineSchema.methods.addSensorHistory = function(data) {
  if (!this.sensorHistory) this.sensorHistory = [];
  
  this.sensorHistory.push({
    storage1Weight: data.storage1Weight || this.storage1?.currentWeight || 0,
    storage2Weight: data.storage2Weight || this.storage2?.currentWeight || 0,
    batteryPercentage: data.batteryPercentage || this.battery?.percentage || 0,
    temperature: data.temperature || this.machineStatus?.temperature || 25,
    doorStatus: data.doorStatus || this.machineStatus?.doorStatus || 'Closed',
    timestamp: new Date()
  });
  
  // Keep only last 1000 records
  if (this.sensorHistory.length > 1000) {
    this.sensorHistory = this.sensorHistory.slice(-1000);
  }
};

// ============================================
// STATIC METHOD: Find or create machine
// ============================================
machineSchema.statics.findOrCreate = async function(deviceId) {
  let machine = await this.findOne({ deviceId: deviceId });
  if (!machine) {
    machine = new this({ deviceId: deviceId });
    await machine.save();
    console.log(`✅ Created new machine record for ${deviceId}`);
  }
  return machine;
};

// ============================================
// VIRTUAL: Total stock
// ============================================
machineSchema.virtual('totalStock').get(function() {
  return (this.storage1?.currentWeight || 0) + (this.storage2?.currentWeight || 0);
});

// ============================================
// VIRTUAL: Average temperature
// ============================================
machineSchema.virtual('avgTemperature').get(function() {
  return this.machineStatus?.temperature || 25;
});

// ============================================
// VIRTUAL: Total cash
// ============================================
machineSchema.virtual('totalCash').get(function() {
  return this.cash?.total || 0;
});

// Ensure virtuals are included in JSON output
machineSchema.set('toJSON', { virtuals: true });
machineSchema.set('toObject', { virtuals: true });

const Machine = mongoose.model('Machine', machineSchema);
export default Machine;