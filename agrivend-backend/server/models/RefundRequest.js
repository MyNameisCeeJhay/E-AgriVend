import mongoose from 'mongoose';

const refundRequestSchema = new mongoose.Schema({
  refundId: {
    type: String,
    required: true,
    unique: true
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  transactionNumber: {
    type: String,
    required: [true, 'Transaction number is required'],
    index: true
  },
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction'
  },
  transactionDate: {
    type: String,
    required: [true, 'Transaction date is required']
  },
  transactionTime: {
    type: String,
    required: [true, 'Transaction time is required']
  },
  grainType: {
    type: String,
    required: [true, 'Rice type is required'],
    trim: true
  },
  selectedQuantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.1, 'Quantity must be at least 0.1 kg']
  },
  amountInserted: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  refundReason: {
    type: String,
    required: [true, 'Refund reason is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  receiptImage: {
    type: String
  },
  receiptFilename: {
    type: String
  },
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  processedBy: {
    type: String,
    default: ''
  },
  processedByName: {
    type: String,
    default: ''
  },
  processedAt: {
    type: Date
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
refundRequestSchema.index({ transactionNumber: 1 });
refundRequestSchema.index({ email: 1 });
refundRequestSchema.index({ status: 1 });
refundRequestSchema.index({ createdAt: -1 });
refundRequestSchema.index({ fullName: 1 });

const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);
export default RefundRequest;