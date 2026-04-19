import express from 'express';
import MachineRating from '../models/MachineRating.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// ===== PUBLIC ROUTES =====
// Get all machine ratings
router.get('/', async (req, res) => {
  console.log('📊 GET /api/ratings/machine - Fetching all machine ratings');
  try {
    const ratings = await MachineRating.find()
      .populate('user', 'firstName lastName')
      .populate('repliedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: ratings
    });
  } catch (error) {
    console.error('❌ Error fetching machine ratings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get machine rating statistics
router.get('/stats', async (req, res) => {
  console.log('📊 GET /api/ratings/machine/stats');
  try {
    const ratings = await MachineRating.find();
    
    if (ratings.length === 0) {
      return res.json({
        success: true,
        data: {
          average: 0,
          total: 0,
          suggestions: 0,
          issues: 0
        }
      });
    }

    const total = ratings.length;
    const average = ratings.reduce((sum, r) => sum + r.rating, 0) / total;
    const suggestions = ratings.filter(r => r.commentType === 'suggestion').length;
    const issues = ratings.filter(r => r.commentType === 'issue').length;

    res.json({
      success: true,
      data: {
        average: Math.round(average * 10) / 10,
        total,
        suggestions,
        issues
      }
    });
  } catch (error) {
    console.error('❌ Error fetching machine rating stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== CUSTOMER ROUTES =====
// Get user's own machine ratings
router.get('/my-ratings', protect, async (req, res) => {
  console.log('📋 GET /api/ratings/machine/my-ratings - by:', req.user?.email);
  try {
    const ratings = await MachineRating.find({ user: req.user._id })
      .populate('repliedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: ratings
    });
  } catch (error) {
    console.error('❌ Error fetching user machine ratings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get unread reply count for customer
router.get('/unread-replies', protect, async (req, res) => {
  console.log('🔔 GET /api/ratings/machine/unread-replies - by:', req.user?.email);
  try {
    const count = await MachineRating.countDocuments({
      user: req.user._id,
      adminReply: { $ne: null },
      replySeenByCustomer: false
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('❌ Error fetching unread replies:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Mark reply as seen
router.put('/:ratingId/mark-seen', protect, async (req, res) => {
  console.log('👁️ PUT /api/ratings/machine/:ratingId/mark-seen - by:', req.user?.email);
  try {
    const rating = await MachineRating.findOne({
      _id: req.params.ratingId,
      user: req.user._id
    });

    if (!rating) {
      return res.status(404).json({ 
        success: false, 
        error: 'Rating not found' 
      });
    }

    rating.replySeenByCustomer = true;
    await rating.save();

    res.json({
      success: true
    });
  } catch (error) {
    console.error('❌ Error marking reply as seen:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create machine rating
router.post('/', protect, async (req, res) => {
  console.log('📝 POST /api/ratings/machine - Creating new machine rating by:', req.user?.email);
  try {
    const { rating, comment, commentType } = req.body;

    if (!rating || !comment || !commentType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rating, comment, and comment type are required' 
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rating must be between 1 and 5' 
      });
    }

    if (!['suggestion', 'issue'].includes(commentType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Comment type must be either suggestion or issue' 
      });
    }

    const newRating = new MachineRating({
      user: req.user._id,
      rating,
      comment,
      commentType,
      replySeenByCustomer: false
    });

    await newRating.save();
    await newRating.populate('user', 'firstName lastName');

    // Emit socket event for admin notification
    const io = req.app.get('io');
    if (io) {
      io.emit('new_machine_rating', {
        ratingId: newRating._id,
        user: {
          id: req.user._id,
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email
        },
        rating: newRating.rating,
        type: newRating.commentType,
        comment: newRating.comment
      });
    }

    console.log('✅ Machine rating created successfully');

    res.status(201).json({
      success: true,
      data: newRating
    });
  } catch (error) {
    console.error('❌ Error creating machine rating:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ADMIN ROUTES =====
// Get all machine ratings (admin only)
router.get('/admin/all', protect, admin, async (req, res) => {
  console.log('👑 GET /api/ratings/machine/admin/all - by:', req.user?.email);
  try {
    const { type, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (type && type !== 'all') {
      query.commentType = type;
    }

    const ratings = await MachineRating.find(query)
      .populate('user', 'firstName lastName email')
      .populate('repliedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await MachineRating.countDocuments(query);

    res.json({
      success: true,
      data: ratings,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('❌ Error fetching admin machine ratings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reply to machine rating (admin only)
router.post('/:ratingId/reply', protect, admin, async (req, res) => {
  console.log('💬 POST /api/ratings/machine/:ratingId/reply - by:', req.user?.email);
  try {
    const { reply } = req.body;
    const { ratingId } = req.params;

    if (!reply) {
      return res.status(400).json({ 
        success: false, 
        error: 'Reply is required' 
      });
    }

    const rating = await MachineRating.findById(ratingId).populate('user', 'firstName lastName email');

    if (!rating) {
      return res.status(404).json({ 
        success: false, 
        error: 'Rating not found' 
      });
    }

    rating.adminReply = reply;
    rating.repliedAt = new Date();
    rating.repliedBy = req.user._id;
    rating.replySeenByCustomer = false;

    await rating.save();

    // Emit socket event for user notification
    const io = req.app.get('io');
    if (io) {
      // Emit to user's specific room
      io.to(`user_${rating.user._id}`).emit('rating_reply_notification', {
        ratingId: rating._id,
        userId: rating.user._id,
        message: reply,
        type: rating.commentType,
        repliedAt: rating.repliedAt
      });
    }

    console.log('✅ Reply sent successfully');

    res.json({
      success: true,
      data: rating
    });
  } catch (error) {
    console.error('❌ Error replying to machine rating:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;