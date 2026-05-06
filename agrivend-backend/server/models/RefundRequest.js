import mongoose from 'mongoose';

const refundRequestSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  transactionNumber: { type: String, required: true, unique: true },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // Not required
  transactionDate: { type: String, required: true },
  transactionTime: { type: String, required: true },
  grainType: { type: String, required: true },
  selectedQuantity: { type: Number, required: true },
  amountInserted: { type: Number, required: true },
  refundReason: { type: String, required: true },
  description: { type: String, required: true },
  receiptImage: { type: String },
  receiptFilename: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  adminNotes: { type: String, default: '' },
  processedBy: { type: String, default: '' },
  processedByName: { type: String, default: '' },
  processedAt: { type: Date },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

refundRequestSchema.index({ transactionNumber: 1 });

const RefundRequest = mongoose.model('RefundRequest', refundRequestSchema);
export default RefundRequest;