import Rating from '../models/Rating.js';

// @desc    Get ratings
// @route   GET /api/ratings
// @access  Public
export const getRatings = async (req, res) => {
  try {
    const ratings = await Rating.find()
      .populate('user', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      data: ratings
    });

  } catch (error) {
    console.error('Get Ratings Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Create rating
// @route   POST /api/ratings
// @access  Private
export const createRating = async (req, res) => {
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
        error: 'Already rated this transaction' 
      });
    }

    const newRating = await Rating.create({
      user: req.user._id,
      transactionId,
      rating,
      comment: comment || ''
    });

    await newRating.populate('user', 'firstName lastName');

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('new_rating', newRating);
    }

    res.status(201).json({
      success: true,
      data: newRating
    });

  } catch (error) {
    console.error('Create Rating Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Get rating summary
// @route   GET /api/ratings/summary
// @access  Public
export const getRatingSummary = async (req, res) => {
  try {
    const ratings = await Rating.find();

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
    console.error('Get Rating Summary Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};