import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },  // Changed to false
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: false },
  productName: { type: String, required: true },
  quantityKg: { type: Number, required: true },
  pricePerKg: { type: Number, required: true },
  amountPaid: { type: Number, required: true },
  paymentMethod: { type: String, enum: ['CASH', 'CARD', 'QR'], default: 'CASH' },
  status: { type: String, enum: ['COMPLETED', 'FAILED', 'REFUNDED'], default: 'COMPLETED' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  notes: { type: String, default: '' }
}, { timestamps: true });

transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ product: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);
export default Transaction;