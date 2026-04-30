import mongoose from 'mongoose';

const storageSchema = new mongoose.Schema({
  name: { type: String, default: 'Sinandomeng Rice' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  pricePerKg: { type: Number, default: 54 },
  currentWeight: { type: Number, default: 0 },
  maxCapacity: { type: Number, default: 20 },
  percentage: { type: Number, default: 0 },
  status: { type: String, enum: ['Normal', 'Low', 'Critical', 'Good', 'Warning'], default: 'Normal' },
  isLow: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now }
});

const batterySchema = new mongoose.Schema({
  percentage: { type: Number, default: 100 },
  voltage: { type: Number, default: 12.6 },
  status: { type: String, enum: ['Good', 'Warning', 'Critical', 'Charged', 'Discharging'], default: 'Good' },
  health: { type: String, enum: ['Good', 'Warning', 'Critical'], default: 'Good' },
  isCharging: { type: Boolean, default: true },
  lastUpdated: { type: Date, default: Date.now }
});

const machineStatusSchema = new mongoose.Schema({
  isOnline: { type: Boolean, default: true },
  temperature: { type: Number, default: 25 },
  doorStatus: { type: String, enum: ['Open', 'Closed'], default: 'Closed' },
  securityStatus: { type: String, enum: ['Safe', 'Alert'], default: 'Safe' },
  lastUpdate: { type: Date, default: Date.now }
});

const sensorHistorySchema = new mongoose.Schema({
  storage1Weight: { type: Number },
  storage2Weight: { type: Number },
  batteryPercentage: { type: Number },
  temperature: { type: Number },
  timestamp: { type: Date, default: Date.now }
});

const machineSchema = new mongoose.Schema({
  storage1: { type: storageSchema, default: () => ({}) },
  storage2: { type: storageSchema, default: () => ({}) },
  battery: { type: batterySchema, default: () => ({}) },
  machineStatus: { type: machineStatusSchema, default: () => ({}) },
  sensorHistory: { type: [sensorHistorySchema], default: [] }
}, {
  timestamps: true
});

const Machine = mongoose.model('Machine', machineSchema);
export default Machine;