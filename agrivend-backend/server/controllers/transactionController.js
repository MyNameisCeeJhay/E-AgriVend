import Transaction from '../models/Transaction.js';
import { generateTransactionId } from '../utils/generateId.js';

// @desc    Get user transactions
// @route   GET /api/transactions
// @access  Private
export const getTransactions = async (req, res) => {
  try {
    let query = {};
    
    // If not admin, only show user's transactions
    if (req.user.role !== 'admin') {
      query.user = req.user._id;
    }

    const transactions = await Transaction.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      data: transactions
    });

  } catch (error) {
    console.error('Get Transactions Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Get transaction by ID
// @route   GET /api/transactions/:transactionId
// @access  Private
export const getTransactionById = async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ 
      transactionId: req.params.transactionId 
    }).populate('user', 'firstName lastName email');

    if (!transaction) {
      return res.status(404).json({ 
        success: false,
        error: 'Transaction not found' 
      });
    }

    // Check authorization
    if (req.user.role !== 'admin' && 
        transaction.user && 
        transaction.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ 
        success: false,
        error: 'Not authorized' 
      });
    }

    res.json({
      success: true,
      data: transaction
    });

  } catch (error) {
    console.error('Get Transaction Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};

// @desc    Get transaction report
// @route   GET /api/transactions/report
// @access  Private (Admin only)
export const getTransactionReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const transactions = await Transaction.find(query);

    // Calculate totals
    const totalSales = transactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const totalKg = transactions.reduce((sum, t) => sum + t.quantityKg, 0);
    const sinandomengKg = transactions
      .filter(t => t.riceType === 'Sinandomeng')
      .reduce((sum, t) => sum + t.quantityKg, 0);
    const dinoradoKg = transactions
      .filter(t => t.riceType === 'Dinorado')
      .reduce((sum, t) => sum + t.quantityKg, 0);

    // Group by day
    const dailyData = {};
    transactions.forEach(t => {
      const day = t.createdAt.toISOString().split('T')[0];
      if (!dailyData[day]) {
        dailyData[day] = { sales: 0, kg: 0, count: 0 };
      }
      dailyData[day].sales += t.amountPaid;
      dailyData[day].kg += t.quantityKg;
      dailyData[day].count++;
    });

    res.json({
      success: true,
      data: {
        totalSales,
        totalKg,
        sinandomengKg,
        dinoradoKg,
        transactionCount: transactions.length,
        dailyData,
        recentTransactions: transactions.slice(-50)
      }
    });

  } catch (error) {
    console.error('Get Transaction Report Error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Server error' 
    });
  }
};