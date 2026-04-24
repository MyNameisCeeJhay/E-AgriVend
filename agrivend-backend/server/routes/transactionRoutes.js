// Add this to your server/routes/transactionRoutes.js
import express from 'express';
import Transaction from '../models/Transaction.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Get user transactions
router.get('/', protect, async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// ===== ADD THIS NEW ENDPOINT =====
// Get recent transactions (for admin dashboard)
router.get('/recent', protect, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const transactions = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('transactionId riceType quantityKg amountPaid createdAt');
    
    // Format the response
    const formattedTransactions = transactions.map(t => ({
      _id: t._id,
      transactionId: t.transactionId,
      riceType: t.riceType,
      quantityKg: t.quantityKg,
      totalAmount: t.amountPaid,
      createdAt: t.createdAt
    }));
    
    res.json({
      success: true,
      data: formattedTransactions
    });
  } catch (error) {
    console.error('Error fetching recent transactions:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;