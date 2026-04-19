import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  riceType: {
    type: String,
    enum: ['Sinandomeng', 'Dinorado'],
    required: true
  },
  quantityKg: {
    type: Number,
    required: true,
    min: 0.1,
    max: 5
  },
  pricePerKg: {
    type: Number,
    required: true,
    min: 0
  },
  amountPaid: {
    type: Number,
    required: true,
    min: 0
  },
  paymentMethod: {
    type: String,
    enum: ['CASH', 'CARD', 'QR'],
    default: 'CASH'
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED', 'REFUNDED'],
    default: 'COMPLETED'
  }
}, {
  timestamps: true
});

// Index for efficient queries
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ createdAt: -1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;