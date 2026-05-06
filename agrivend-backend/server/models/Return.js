import mongoose from 'mongoose';

const returnSchema = new mongoose.Schema({
  returnId: { type: String, required: true, unique: true },
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true },
  transactionId: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },  // Changed to false
  riceType: { type: String, enum: ['Sinandomeng', 'Dinorado'], required: true },
  quantityKg: { type: Number, required: true, min: 0.1 },
  amountPaid: { type: Number, required: true, min: 0 },
  returnReason: { type: String, required: true },
  receiptFilename: { type: String },
  receiptPath: { type: String },
  status: { type: String, enum: ['PENDING', 'APPROVED', 'REJECTED'], default: 'PENDING' },
  adminNotes: { type: String, default: '' },
  processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  processedAt: { type: Date }
}, { timestamps: true });

returnSchema.index({ user: 1, createdAt: -1 });
returnSchema.index({ transaction: 1 });
returnSchema.index({ status: 1 });

const Return = mongoose.model('Return', returnSchema);
export default Return;