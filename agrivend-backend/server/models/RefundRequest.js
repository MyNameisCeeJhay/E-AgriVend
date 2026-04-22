import mongoose from 'mongoose';

const refundRequestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, unique: true },
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  transactionNumber: { type: String, required: true },
  transactionDate: { type: String, required: true },
  transactionTime: { type: String, required: true },
  grainType: { type: String, required: true },
  selectedQuantity: { type: Number, required: true },
  amountInserted: { type: Number, required: true },
  refundReason: { type: String, required: true },
  description: { type: String, required: true },
  receiptFilename: { type: String },
  receiptPath: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  adminNotes: { type: String, default: '' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('RefundRequest', refundRequestSchema);