import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  controlNumber: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'custom'],
    required: true
  },
  dateRange: {
    start: { type: Date, required: true },
    end: { type: Date, required: true }
  },
  transactionSource: {
    type: String,
    enum: ['all', 'manual', 'machine'],
    default: 'all'
  },
  summary: {
    totalTransactions: { type: Number, default: 0 },
    totalQuantity: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 }
  },
  transactions: [
    {
      transactionId: String,
      createdAt: Date,
      riceType: String,
      productName: String,
      quantityKg: Number,
      amountPaid: Number,
      totalAmount: Number,
      source: String,
      paymentMethod: String
    }
  ],
  productRanking: [
    {
      name: String,
      quantity: Number,
      revenue: Number,
      count: Number,
      avgPrice: Number
    }
  ],
  generatedBy: {
    name: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  filePath: {
    type: String
  },
  status: {
    type: String,
    enum: ['generated', 'archived', 'deleted'],
    default: 'generated'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
reportSchema.index({ controlNumber: 1 });
reportSchema.index({ generatedAt: -1 });
reportSchema.index({ type: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ 'generatedBy.userId': 1 });

const Report = mongoose.model('Report', reportSchema);
export default Report;