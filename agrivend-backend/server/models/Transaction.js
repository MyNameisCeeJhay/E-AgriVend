// server/models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  transactionId: { type: String, required: true, unique: true },
  riceType: { type: String, required: true },
  quantityKg: { type: Number, required: true },
  amountPaid: { type: Number, required: true },
  status: { type: String, enum: ['PENDING', 'COMPLETED', 'FAILED'], default: 'COMPLETED' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Transaction', transactionSchema);