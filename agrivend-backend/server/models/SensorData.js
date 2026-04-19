import mongoose from 'mongoose';

const sensorDataSchema = new mongoose.Schema({
  container1Level: {
    type: Number,
    default: 0,
    min: 0,
    max: 20
  },
  container2Level: {
    type: Number,
    default: 0,
    min: 0,
    max: 20
  },
  collectionBinWeight: {
    type: Number,
    default: 0
  },
  container1Stock: {
    type: String,
    enum: ['OK', 'LOW', 'EMPTY'],
    default: 'OK'
  },
  container2Stock: {
    type: String,
    enum: ['OK', 'LOW', 'EMPTY'],
    default: 'OK'
  },
  batteryVoltage: {
    type: Number,
    default: 12.5
  },
  batteryPercentage: {
    type: Number,
    default: 100,
    min: 0,
    max: 100
  },
  temperature: {
    type: Number,
    default: 25
  },
  humidity: {
    type: Number,
    default: 50
  },
  doorStatus: {
    type: String,
    enum: ['OPEN', 'CLOSED'],
    default: 'CLOSED'
  },
  machineStatus: {
    type: String,
    enum: ['ACTIVE', 'ERROR', 'MAINTENANCE', 'EMPTY', 'LOW_BATTERY'],
    default: 'ACTIVE'
  }
}, {
  timestamps: true
});

// Create index for efficient queries
sensorDataSchema.index({ createdAt: -1 });

const SensorData = mongoose.model('SensorData', sensorDataSchema);
export default SensorData;