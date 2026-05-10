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
    required: false
  },
  riceType: {
    type: String,
    enum: ['Sinandomeng', 'Dinorado'],
    required: true
  },
  quantityKg: {
    type: Number,
    required: true,
    min: 0.1
  },
  amountPaid: {
    type: Number,
    required: true,
    min: 0
  },
  returnReason: {
    type: String,
    required: true,
    maxlength: 500
  },
  receiptFilename: {
    type: String
  },
  receiptPath: {
    type: String
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
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Create indexes
returnSchema.index({ transactionId: 1 });
returnSchema.index({ status: 1 });
returnSchema.index({ createdAt: -1 });

export default mongoose.model('Return', returnSchema);