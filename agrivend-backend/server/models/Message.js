import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },  // Changed to false
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['unread', 'read', 'replied'], default: 'unread' },
  adminReply: { type: String, default: null },
  repliedAt: { type: Date },
  repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isAdminRead: { type: Boolean, default: false },
  isCustomerRead: { type: Boolean, default: true }
}, { timestamps: true });

messageSchema.index({ user: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;