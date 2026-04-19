import Message from '../models/Message.js';

// @desc    Get messages
// @route   GET /api/messages
// @access  Private
export const getMessages = async (req, res) => {
  try {
    let query = {};
    
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }

    const messages = await Message.find(query)
      .populate('user', 'firstName lastName email')
      .populate('repliedBy', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: messages
    });

  } catch (error) {
    console.error('Get Messages Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Create message
// @route   POST /api/messages
// @access  Private
export const createMessage = async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.status(400).json({ 
        success: false,
        error: 'Subject and message are required' 
      });
    }

    const newMessage = await Message.create({
      user: req.user._id,
      subject,
      message,
      status: 'UNREAD'
    });

    await newMessage.populate('user', 'firstName lastName email');

    // Emit socket event for admin
    const io = req.app.get('io');
    if (io) {
      io.emit('new_message', newMessage);
    }

    res.status(201).json({
      success: true,
      data: newMessage
    });

  } catch (error) {
    console.error('Create Message Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Reply to message
// @route   PUT /api/messages/:messageId/reply
// @access  Private (Admin only)
export const replyToMessage = async (req, res) => {
  try {
    const { adminReply } = req.body;

    if (!adminReply) {
      return res.status(400).json({ 
        success: false,
        error: 'Reply message is required' 
      });
    }

    const message = await Message.findById(req.params.messageId);

    if (!message) {
      return res.status(404).json({ 
        success: false,
        error: 'Message not found' 
      });
    }

    message.adminReply = adminReply;
    message.status = 'REPLIED';
    message.repliedAt = new Date();
    message.repliedBy = req.user._id;

    await message.save();
    await message.populate('user', 'firstName lastName email');
    await message.populate('repliedBy', 'firstName lastName');

    // Emit socket event for customer
    const io = req.app.get('io');
    if (io) {
      io.emit('message_reply', message);
    }

    res.json({
      success: true,
      data: message
    });

  } catch (error) {
    console.error('Reply to Message Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};