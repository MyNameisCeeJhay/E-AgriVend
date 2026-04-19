import mongoose from 'mongoose';

const dispenseCommandSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    index: true
  },
  commandId: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  riceType: {
    type: String,
    enum: ['Sinandomeng', 'Dinorado'],
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'EXPIRED'],
    default: 'PENDING'
  },
  processedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30000) // 30 seconds expiry
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
dispenseCommandSchema.index({ deviceId: 1, status: 1 });
dispenseCommandSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const DispenseCommand = mongoose.model('DispenseCommand', dispenseCommandSchema);
export default DispenseCommand;