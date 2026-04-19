import mongoose from 'mongoose';

const machineRatingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    required: true,
    maxlength: 1000
  },
  commentType: {
    type: String,
    enum: ['suggestion', 'issue'],
    required: true
  },
  adminReply: {
    type: String,
    default: null
  },
  repliedAt: {
    type: Date
  },
  repliedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Notification fields
  replySeenByCustomer: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

const MachineRating = mongoose.model('MachineRating', machineRatingSchema);
export default MachineRating;