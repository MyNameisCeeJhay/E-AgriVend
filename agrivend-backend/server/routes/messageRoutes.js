import express from 'express';
import Message from '../models/Message.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// ===== CUSTOMER ROUTES =====

// Get user's messages
router.get('/my-messages', protect, async (req, res) => {
  console.log('📋 GET /api/messages/my-messages - by:', req.user?.email);
  try {
    const messages = await Message.find({ user: req.user._id })
      .populate('repliedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    // Mark messages as read by customer
    await Message.updateMany(
      { user: req.user._id, isCustomerRead: false },
      { isCustomerRead: true }
    );

    res.json({
      success: true,
      data: messages
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Get unread message replies count
router.get('/unread-replies', protect, async (req, res) => {
  console.log('🔔 GET /api/messages/unread-replies - by:', req.user?.email);
  try {
    const count = await Message.countDocuments({
      user: req.user._id,
      status: 'replied',
      isCustomerRead: false
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error fetching unread replies:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Mark message reply as seen
router.put('/:messageId/mark-seen', protect, async (req, res) => {
  console.log('👁️ PUT /api/messages/:messageId/mark-seen - by:', req.user?.email);
  try {
    const message = await Message.findOne({
      _id: req.params.messageId,
      user: req.user._id
    });

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        error: 'Message not found' 
      });
    }

    message.isCustomerRead = true;
    await message.save();

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error marking message as seen:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Create message
router.post('/', protect, async (req, res) => {
  console.log('📝 POST /api/messages - by:', req.user?.email);
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ 
        success: false, 
        error: 'Subject and message are required' 
      });
    }

    const newMessage = new Message({
      user: req.user._id,
      subject,
      message,
      status: 'unread',
      isCustomerRead: true,
      isAdminRead: false
    });

    await newMessage.save();

    // Emit socket event for admin notification
    const io = req.app.get('io');
    if (io) {
      io.emit('new_message_notification', {
        messageId: newMessage._id,
        user: {
          id: req.user._id,
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email
        },
        subject: newMessage.subject
      });
    }

    res.status(201).json({
      success: true,
      data: newMessage
    });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// ===== ADMIN ROUTES =====

// Get all messages (admin only)
router.get('/admin/all', protect, admin, async (req, res) => {
  console.log('👑 GET /api/messages/admin/all - by:', req.user?.email);
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const messages = await Message.find(query)
      .populate('user', 'firstName lastName email phone')
      .populate('repliedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Message.countDocuments(query);

    // Mark as read by admin
    await Message.updateMany(
      { _id: { $in: messages.map(m => m._id) }, isAdminRead: false },
      { isAdminRead: true }
    );

    res.json({
      success: true,
      data: messages,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching admin messages:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Get unread count for admin
router.get('/admin/unread-count', protect, admin, async (req, res) => {
  console.log('👑 GET /api/messages/admin/unread-count - by:', req.user?.email);
  try {
    const count = await Message.countDocuments({ 
      status: 'unread',
      isAdminRead: false 
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Reply to message (admin only)
router.post('/:messageId/reply', protect, admin, async (req, res) => {
  console.log('💬 POST /api/messages/:messageId/reply - by:', req.user?.email);
  try {
    const { reply } = req.body;
    const { messageId } = req.params;

    if (!reply) {
      return res.status(400).json({ 
        success: false, 
        error: 'Reply is required' 
      });
    }

    const message = await Message.findById(messageId).populate('user', 'firstName lastName email');

    if (!message) {
      return res.status(404).json({ 
        success: false, 
        error: 'Message not found' 
      });
    }

    message.adminReply = reply;
    message.status = 'replied';
    message.repliedAt = new Date();
    message.repliedBy = req.user._id;
    message.isCustomerRead = false;

    await message.save();

    // Emit socket event for customer notification
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${message.user._id}`).emit('message_reply_notification', {
        messageId: message._id,
        userId: message.user._id,
        message: reply,
        subject: message.subject,
        repliedAt: message.repliedAt
      });
    }

    res.json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error replying to message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Mark message as read (admin)
router.put('/:messageId/read', protect, admin, async (req, res) => {
  console.log('👁️ PUT /api/messages/:messageId/read - by:', req.user?.email);
  try {
    await Message.findByIdAndUpdate(req.params.messageId, {
      isAdminRead: true
    });

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Delete message (admin only)
router.delete('/:messageId', protect, admin, async (req, res) => {
  console.log('🗑️ DELETE /api/messages/:messageId - by:', req.user?.email);
  try {
    await Message.findByIdAndDelete(req.params.messageId);

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

export default router;