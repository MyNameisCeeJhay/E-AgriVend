import mongoose from 'mongoose';

const storageSchema = new mongoose.Schema({
  name: { type: String, default: 'Sinandomeng Rice' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // FK to Product
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

const machineSchema = new mongoose.Schema({
  deviceId: { type: String, default: 'AGRIVEND_001', unique: true },
  storage1: storageSchema,
  storage2: storageSchema,
  battery: batterySchema,
  machineStatus: machineStatusSchema
}, { timestamps: true });

// ============================================
// PRE-SAVE MIDDLEWARE - Auto-calculate fields
// ============================================

machineSchema.pre('save', function(next) {
  const now = new Date();
  
  // === STORAGE 1 (Sinandomeng/Regular - LEFT load cell) ===
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
  
  // === STORAGE 2 (Dinorado/Premium - RIGHT load cell) ===
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
  if (this.battery.percentage <= 20) {
    this.battery.status = 'Critical';
  } else if (this.battery.percentage <= 50) {
    this.battery.status = 'Warning';
  } else {
    this.battery.status = 'Good';
  }
  this.battery.lastUpdated = now;
  
  // === MACHINE STATUS ===
  // Update load cell status based on storage
  if (this.storage1.status === 'Empty' && this.storage2.status === 'Empty') {
    this.machineStatus.loadCellStatus = 'LOW';
  } else if (this.storage1.status === 'Error' || this.storage2.status === 'Error') {
    this.machineStatus.loadCellStatus = 'ERROR';
  } else {
    this.machineStatus.loadCellStatus = 'OK';
  }
  
  // Update security status based on door
  if (this.machineStatus.doorStatus === 'Open') {
    this.machineStatus.securityStatus = 'Alert';
  } else {
    this.machineStatus.securityStatus = 'Safe';
  }
  
  this.machineStatus.lastUpdate = now;
  
  next();
});

// ============================================
// METHOD: Update from load cell readings
// ============================================
machineSchema.methods.updateFromLoadCells = function(leftKg, rightKg) {
  // LEFT load cell = Sinandomeng (Regular) - Storage 1
  this.storage1.currentWeight = leftKg;
  
  // RIGHT load cell = Dinorado (Premium) - Storage 2
  this.storage2.currentWeight = rightKg;
  
  this.machineStatus.lastUpdate = new Date();
  this.machineStatus.isOnline = true;
  
  return this;
};

// ============================================
// METHOD: Update battery status
// ============================================
machineSchema.methods.updateBattery = function(percentage, voltage, isCharging) {
  this.battery.percentage = percentage;
  this.battery.voltage = voltage;
  this.battery.isCharging = isCharging;
  this.battery.lastUpdated = new Date();
  return this;
};

// ============================================
// METHOD: Update machine status
// ============================================
machineSchema.methods.updateMachineStatus = function(temperature, doorStatus) {
  this.machineStatus.temperature = temperature;
  this.machineStatus.doorStatus = doorStatus;
  this.machineStatus.lastUpdate = new Date();
  this.machineStatus.isOnline = true;
  return this;
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
  return this.storage1.currentWeight + this.storage2.currentWeight;
});

// ============================================
// VIRTUAL: Average temperature
// ============================================
machineSchema.virtual('avgTemperature').get(function() {
  return this.machineStatus.temperature;
});

// Ensure virtuals are included in JSON output
machineSchema.set('toJSON', { virtuals: true });
machineSchema.set('toObject', { virtuals: true });

const Machine = mongoose.model('Machine', machineSchema);
export default Machine;