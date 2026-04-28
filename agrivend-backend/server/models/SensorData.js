// models/SensorData.js
import mongoose from 'mongoose';

const sensorDataSchema = new mongoose.Schema({
  container1Level: { type: Number, default: 20 },
  container2Level: { type: Number, default: 20 },
  collectionBinWeight: { type: Number, default: 0 },
  batteryVoltage: { type: Number, default: 12.5 },
  batteryPercentage: { type: Number, default: 100 },
  temperature: { type: Number, default: 25 },
  humidity: { type: Number, default: 60 },
  doorStatus: { type: String, enum: ['OPEN', 'CLOSED'], default: 'CLOSED' },
  vibrationDetected: { type: Boolean, default: false },
  machineStatus: { type: String, enum: ['ACTIVE', 'ERROR', 'MAINTENANCE'], default: 'ACTIVE' },
  container1Stock: { type: String, enum: ['OK', 'LOW', 'EMPTY'], default: 'OK' },
  container2Stock: { type: String, enum: ['OK', 'LOW', 'EMPTY'], default: 'OK' },
  deviceId: { type: String, default: 'AGRIVEND_001' },
  machineState: { type: Number, default: 0 },
  transactionCount: { type: Number, default: 0 }
}, { timestamps: true });

const SensorData = mongoose.model('SensorData', sensorDataSchema);
export default SensorData;