import express from 'express';
import Rating from '../models/Rating.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// ===== PUBLIC ROUTES =====
// Get all approved ratings (for public display)
router.get('/public', async (req, res) => {
  try {
    const ratings = await Rating.find({ isVisible: true })
      .populate('user', 'firstName lastName')
      .populate('repliedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50);
    
    res.json({
      success: true,
      data: ratings
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get rating summary/stats
router.get('/summary', async (req, res) => {
  try {
    const ratings = await Rating.find({ isVisible: true });
    
    if (ratings.length === 0) {
      return res.json({
        success: true,
        data: {
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
      });
    }

    const total = ratings.length;
    const average = ratings.reduce((sum, r) => sum + r.rating, 0) / total;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    
    ratings.forEach(r => {
      distribution[r.rating]++;
    });

    res.json({
      success: true,
      data: {
        average: Math.round(average * 10) / 10,
        total,
        distribution
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== CUSTOMER ROUTES =====
// Get customer's own ratings
router.get('/my-ratings', protect, async (req, res) => {
  try {
    const ratings = await Rating.find({ user: req.user._id })
      .populate('repliedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: ratings
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create rating
router.post('/', protect, async (req, res) => {
  try {
    const { transactionId, rating, comment } = req.body;

    if (!transactionId || !rating) {
      return res.status(400).json({ 
        success: false, 
        error: 'Transaction ID and rating are required' 
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rating must be between 1 and 5' 
      });
    }

    // Check if already rated
    const existingRating = await Rating.findOne({
      user: req.user._id,
      transactionId
    });

    if (existingRating) {
      return res.status(400).json({ 
        success: false, 
        error: 'You have already rated this transaction' 
      });
    }

    const newRating = new Rating({
      user: req.user._id,
      transactionId,
      rating,
      comment: comment || '',
      isVisible: true
    });

    await newRating.save();
    await newRating.populate('user', 'firstName lastName');

    // Emit socket event for admin notification
    const io = req.app.get('io');
    if (io) {
      io.emit('new_rating_notification', {
        ratingId: newRating._id,
        user: {
          id: req.user._id,
          name: `${req.user.firstName} ${req.user.lastName}`
        },
        rating: newRating.rating,
        transactionId: newRating.transactionId
      });
    }

    res.status(201).json({
      success: true,
      data: newRating
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== ADMIN ROUTES =====
// Get all ratings (admin only)
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    let query = {};
    if (status === 'pending') {
      query.adminReply = null;
    } else if (status === 'replied') {
      query.adminReply = { $ne: null };
    }

    const ratings = await Rating.find(query)
      .populate('user', 'firstName lastName email')
      .populate('repliedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Rating.countDocuments(query);

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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get rating statistics (admin only)
router.get('/admin/stats', protect, admin, async (req, res) => {
  try {
    const total = await Rating.countDocuments();
    const pendingReplies = await Rating.countDocuments({ adminReply: null });
    
    const avgResult = await Rating.aggregate([
      { $group: { _id: null, avg: { $avg: "$rating" } } }
    ]);

    const distribution = await Rating.aggregate([
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const distObj = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach(d => {
      distObj[d._id] = d.count;
    });

    res.json({
      success: true,
      data: {
        total,
        pendingReplies,
        average: avgResult.length > 0 ? Math.round(avgResult[0].avg * 10) / 10 : 0,
        distribution: distObj
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reply to rating (admin only)
router.post('/admin/:ratingId/reply', protect, admin, async (req, res) => {
  try {
    const { reply } = req.body;
    const { ratingId } = req.params;

    if (!reply) {
      return res.status(400).json({ 
        success: false, 
        error: 'Reply is required' 
      });
    }

    const rating = await Rating.findById(ratingId).populate('user', 'firstName lastName email');

    if (!rating) {
      return res.status(404).json({ 
        success: false, 
        error: 'Rating not found' 
      });
    }

    rating.adminReply = reply;
    rating.repliedAt = new Date();
    rating.repliedBy = req.user._id;

    await rating.save();

    // Emit socket event for customer notification
    const io = req.app.get('io');
    if (io) {
      io.emit('rating_reply_notification', {
        ratingId: rating._id,
        userId: rating.user._id,
        reply: rating.adminReply
      });
    }

    res.json({
      success: true,
      data: rating
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle rating visibility (admin only)
router.put('/admin/:ratingId/toggle', protect, admin, async (req, res) => {
  try {
    const rating = await Rating.findById(req.params.ratingId);
    
    if (!rating) {
      return res.status(404).json({ 
        success: false, 
        error: 'Rating not found' 
      });
    }

    rating.isVisible = !rating.isVisible;
    await rating.save();

    res.json({
      success: true,
      data: rating
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;