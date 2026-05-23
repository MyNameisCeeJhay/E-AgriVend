import mongoose from 'mongoose';

const returnSchema = new mongoose.Schema({
  returnId: {
    type: String,
    required: [true, 'Return ID is required'],
    unique: true,
    trim: true
  },
  transactionId: {
    type: String,
    required: [true, 'Transaction ID is required'],
    index: true,
    trim: true
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
  riceType: {
    type: String,
    required: [true, 'Rice type is required'],
    trim: true
  },
  quantityKg: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0.1, 'Quantity must be at least 0.1 kg']
  },
  amountPaid: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  returnReason: {
    type: String,
    required: [true, 'Return reason is required'],
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  receiptFilename: {
    type: String,
    trim: true
  },
  receiptPath: {
    type: String,
    trim: true
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
  },
  seenByCustomer: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
returnSchema.index({ transactionId: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ createdAt: -1 });
returnSchema.index({ email: 1 });
returnSchema.index({ returnId: 1 });
returnSchema.index({ fullName: 1 });

const Return = mongoose.model('Return', returnSchema);
export default Return;