const transactionSchema = new mongoose.Schema({
  transactionId: { type: String, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Change to false
  productName: { type: String, required: true },
  quantityKg: { type: Number, required: true },
  pricePerKg: { type: Number, required: true },
  amountPaid: { type: Number, required: true },
  paymentMethod: { type: String, default: 'CASH' },
  status: { type: String, default: 'COMPLETED' },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }, // Change to false
  notes: { type: String },
  source: { type: String, enum: ['walkin', 'machine'], default: 'walkin' }, // Add this to distinguish
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});