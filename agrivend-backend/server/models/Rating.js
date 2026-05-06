import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },  // Changed to false
  transaction: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: false },
  transactionId: { type: String },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '' },
  commentType: { type: String, enum: ['product', 'suggestion', 'issue'], default: 'product' },
  adminReply: { type: String, default: null },
  repliedAt: { type: Date },
  repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isVisible: { type: Boolean, default: true }
}, { timestamps: true });

const Rating = mongoose.model('Rating', ratingSchema);
export default Rating;