import mongoose from 'mongoose';

const storageSchema = new mongoose.Schema({
  name: { type: String, default: 'Sinandomeng Rice' },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' }, // FK to Product
  pricePerKg: { type: Number, default: 0 },
  currentWeight: { type: Number, default: 0 },
  maxCapacity: { type: Number, default: 20 },
  percentage: { type: Number, default: 0 },
  status: { type: String, enum: ['Normal', 'Low', 'Critical'], default: 'Normal' },
  isLow: { type: Boolean, default: false },
  lastUpdated: { type: Date, default: Date.now }
});

const machineSchema = new mongoose.Schema({
  storage1: storageSchema,
  storage2: storageSchema,
  battery: {
    percentage: { type: Number, default: 100 },
    voltage: { type: Number, default: 12.6 },
    status: { type: String, enum: ['Good', 'Warning', 'Critical'], default: 'Good' },
    isCharging: { type: Boolean, default: true },
    lastUpdated: { type: Date, default: Date.now }
  },
  machineStatus: {
    isOnline: { type: Boolean, default: true },
    temperature: { type: Number, default: 25 },
    doorStatus: { type: String, enum: ['Open', 'Closed'], default: 'Closed' },
    securityStatus: { type: String, enum: ['Safe', 'Alert'], default: 'Safe' },
    lastUpdate: { type: Date, default: Date.now }
  }
}, { timestamps: true });

const Machine = mongoose.model('Machine', machineSchema);
export default Machine;