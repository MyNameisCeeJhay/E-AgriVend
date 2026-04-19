import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'replied'],
    default: 'unread'
  },
  adminReply: {
    type: String,
    trim: true,
    maxlength: 2000,
    default: null
  },
  repliedAt: {
    type: Date
  },
  repliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isAdminRead: {
    type: Boolean,
    default: false
  },
  isCustomerRead: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
messageSchema.index({ user: 1, createdAt: -1 });
messageSchema.index({ status: 1 });
messageSchema.index({ isAdminRead: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;