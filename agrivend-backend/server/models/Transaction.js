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
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  quantityKg: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative']
    // NO MAXIMUM LIMIT - Staff can enter any quantity
  },
  pricePerKg: {
    type: Number,
    required: [true, 'Price per kg is required'],
    min: [0, 'Price cannot be negative']
  },
  amountPaid: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  paymentMethod: {
    type: String,
    enum: ['CASH', 'CARD', 'QR'],
    default: 'CASH'
  },
  status: {
    type: String,
    enum: ['COMPLETED', 'FAILED', 'REFUNDED', 'PENDING'],
    default: 'COMPLETED'
  },
  // For manual entries by admin/staff
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ productName: 1 });
transactionSchema.index({ recordedBy: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;