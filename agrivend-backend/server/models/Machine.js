import mongoose from 'mongoose';

const machineSchema = new mongoose.Schema({
  // Storage 1 (20kg Load Cell)
  storage1: {
    name: { type: String, default: 'Storage 1 - Sinandomeng' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    pricePerKg: { type: Number, default: 54 },
    currentWeight: { type: Number, default: 0 },
    maxCapacity: { type: Number, default: 20 },
    percentage: { type: Number, default: 0 },
    status: { type: String, enum: ['Critical', 'Low', 'Normal'], default: 'Normal' },
    isLow: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Storage 2 (20kg Load Cell)
  storage2: {
    name: { type: String, default: 'Storage 2 - Dinorado' },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    pricePerKg: { type: Number, default: 65 },
    currentWeight: { type: Number, default: 0 },
    maxCapacity: { type: Number, default: 20 },
    percentage: { type: Number, default: 0 },
    status: { type: String, enum: ['Critical', 'Low', 'Normal'], default: 'Normal' },
    isLow: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Battery Monitoring
  battery: {
    percentage: { type: Number, default: 100, min: 0, max: 100 },
    voltage: { type: Number, default: 12.6 },
    status: { type: String, default: 'Charged' },
    isCharging: { type: Boolean, default: true },
    health: { type: String, default: 'Good' },
    lastUpdated: { type: Date, default: Date.now }
  },
  
  // Machine Status
  machineStatus: {
    isOnline: { type: Boolean, default: true },
    temperature: { type: Number, default: 25 },
    doorStatus: { type: String, enum: ['Open', 'Closed'], default: 'Closed' },
    securityStatus: { type: String, enum: ['Safe', 'Alert'], default: 'Safe' },
    lastUpdate: { type: Date, default: Date.now }
  },
  
  // Sensor Readings History
  sensorHistory: [{
    storage1Weight: Number,
    storage2Weight: Number,
    batteryPercentage: Number,
    temperature: Number,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

// Index for faster queries
machineSchema.index({ 'machineStatus.lastUpdate': -1 });
machineSchema.index({ createdAt: -1 });

const Machine = mongoose.model('Machine', machineSchema);

export default Machine;