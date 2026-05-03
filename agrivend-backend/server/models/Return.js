import mongoose from 'mongoose';

const returnSchema = new mongoose.Schema({
  returnId: {
    type: String,
    required: true,
    unique: true
  },
  transactionId: {
    type: String,
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  fullName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  riceType: {
    type: String,
    required: true
  },
  quantityKg: {
    type: Number,
    required: true
  },
  amountPaid: {
    type: Number,
    required: true
  },
  returnReason: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  receiptFilename: {
    type: String,
    required: true
  },
  receiptPath: {
    type: String,
    required: true
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
  processedAt: {
    type: Date
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedByName: {
    type: String
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

// Create indexes
returnSchema.index({ transactionId: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ createdAt: -1 });

export default mongoose.model('Return', returnSchema);