import mongoose from 'mongoose';

const refundRequestSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  transactionNumber: { type: String, required: true, unique: true },
  transactionDate: { type: String, required: true },
  transactionTime: { type: String, required: true },
  grainType: { type: String, required: true },
  selectedQuantity: { type: Number, required: true },
  amountInserted: { type: Number, required: true },
  refundReason: { type: String, required: true },
  description: { type: String, required: true },
  receiptImage: { type: String },
  receiptFilename: { type: String },
  status: { 
    type: String, 
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'], 
    default: 'PENDING' 
  },
  adminNotes: { type: String, default: '' },
  processedBy: { type: String, default: '' },
  processedByName: { type: String, default: '' },
  processedAt: { type: Date },
  isRead: { type: Boolean, default: false },
  readAt: { type: Date }
}, { timestamps: true });

// Indexes for faster queries
refundRequestSchema.index({ transactionNumber: 1 });
refundRequestSchema.index({ email: 1 });
refundRequestSchema.index({ status: 1 });
refundRequestSchema.index({ createdAt: -1 });
refundRequestSchema.index({ isRead: 1 });

const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);

export default RefundRequest;