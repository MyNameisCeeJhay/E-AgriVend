import express from 'express';
import Transaction from '../models/Transaction.js';
import { protect, admin } from '../middleware/auth.js';

const router = express.Router();

// Helper function to generate transaction ID
const generateTransactionId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `TXN-${year}${month}${day}-${timestamp}-${random}`;
};

// ===== GET ALL TRANSACTIONS (Admin only - for admin panel) =====
router.get('/all', protect, admin, async (req, res) => {
  try {
    const { page = 1, limit = 15, startDate, endDate, productName, paymentMethod, search } = req.query;
    
    let query = {};
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (productName && productName !== 'all') {
      query.productName = productName;
    }
    
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod;
    }
    
    if (search) {
      query.transactionId = { $regex: search, $options: 'i' };
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const transactions = await Transaction.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    const total = await Transaction.countDocuments(query);
    
    const allTransactions = await Transaction.find(query);
    const totalQuantity = allTransactions.reduce((sum, t) => sum + t.quantityKg, 0);
    const totalRevenue = allTransactions.reduce((sum, t) => sum + t.amountPaid, 0);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      summary: {
        totalTransactions: total,
        totalQuantity,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching all transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== GET TRANSACTIONS (For staff - shows all, for customers - shows only theirs) =====
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 15, startDate, endDate, productName, search } = req.query;
    
    let query = {};
    
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      query.user = req.user._id;
    }
    
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    if (productName && productName !== 'all') {
      query.productName = productName;
    }
    
    if (search) {
      query.transactionId = { $regex: search, $options: 'i' };
    }
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    const transactions = await Transaction.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    const total = await Transaction.countDocuments(query);
    
    const allTransactions = await Transaction.find(query);
    const totalQuantity = allTransactions.reduce((sum, t) => sum + t.quantityKg, 0);
    const totalRevenue = allTransactions.reduce((sum, t) => sum + t.amountPaid, 0);
    
    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      summary: {
        totalTransactions: total,
        totalQuantity,
        totalRevenue
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== CREATE NEW TRANSACTION (Accepts both riceType and productName) =====
router.post('/', protect, async (req, res) => {
  try {
    const { riceType, productName, quantityKg, amountPaid, paymentMethod } = req.body;
    
    console.log('📝 Creating transaction - Request body:', req.body);
    console.log('👤 User:', req.user?.email, 'Role:', req.user?.role);
    
    // Support both field names (backward compatible)
    const finalProductName = productName || riceType;
    
    // Validate required fields
    if (!finalProductName) {
      console.log('❌ Missing product name');
      return res.status(400).json({ 
        success: false, 
        error: 'Product name is required' 
      });
    }
    
    if (!quantityKg) {
      console.log('❌ Missing quantity');
      return res.status(400).json({ 
        success: false, 
        error: 'Quantity is required' 
      });
    }
    
    if (!amountPaid) {
      console.log('❌ Missing amount');
      return res.status(400).json({ 
        success: false, 
        error: 'Amount is required' 
      });
    }
    
    const quantityNum = parseFloat(quantityKg);
    if (isNaN(quantityNum) || quantityNum <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Quantity must be a positive number' 
      });
    }
    
    if (quantityNum > 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Maximum quantity per transaction is 5kg' 
      });
    }
    
    const amountNum = parseFloat(amountPaid);
    if (isNaN(amountNum) || amountNum <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Amount must be a positive number' 
      });
    }
    
    // Calculate price per kg
    const pricePerKg = amountNum / quantityNum;
    
    const newTransaction = new Transaction({
      transactionId: generateTransactionId(),
      user: req.user._id,
      productName: finalProductName,
      quantityKg: quantityNum,
      pricePerKg: parseFloat(pricePerKg.toFixed(2)),
      amountPaid: amountNum,
      paymentMethod: paymentMethod || 'CASH',
      status: 'COMPLETED',
      recordedBy: req.user._id,
      notes: `Transaction recorded by ${req.user.firstName} ${req.user.lastName}`
    });
    
    await newTransaction.save();
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('new_transaction', {
        transactionId: newTransaction.transactionId,
        productName: newTransaction.productName,
        quantityKg: newTransaction.quantityKg,
        amountPaid: newTransaction.amountPaid
      });
    }
    
    console.log(`✅ New transaction created: ${newTransaction.transactionId} by ${req.user.email}`);
    
    res.status(201).json({
      success: true,
      message: 'Transaction added successfully',
      data: newTransaction
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== GET TRANSACTION STATISTICS =====
router.get('/admin/stats', protect, admin, async (req, res) => {
  try {
    const transactions = await Transaction.find();
    
    const totalTransactions = transactions.length;
    const totalQuantity = transactions.reduce((sum, t) => sum + t.quantityKg, 0);
    const totalRevenue = transactions.reduce((sum, t) => sum + t.amountPaid, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayTransactions = await Transaction.find({
      createdAt: { $gte: today, $lt: tomorrow }
    });
    
    const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const todayQuantity = todayTransactions.reduce((sum, t) => sum + t.quantityKg, 0);
    
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekTransactions = await Transaction.find({
      createdAt: { $gte: weekStart }
    });
    
    const weekRevenue = weekTransactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const weekQuantity = weekTransactions.reduce((sum, t) => sum + t.quantityKg, 0);
    
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    
    const monthTransactions = await Transaction.find({
      createdAt: { $gte: monthStart }
    });
    
    const monthRevenue = monthTransactions.reduce((sum, t) => sum + t.amountPaid, 0);
    const monthQuantity = monthTransactions.reduce((sum, t) => sum + t.quantityKg, 0);
    
    res.json({
      success: true,
      data: {
        totalTransactions,
        totalQuantity,
        totalRevenue,
        today: { revenue: todayRevenue, quantity: todayQuantity, count: todayTransactions.length },
        week: { revenue: weekRevenue, quantity: weekQuantity, count: weekTransactions.length },
        month: { revenue: monthRevenue, quantity: monthQuantity, count: monthTransactions.length }
      }
    });
  } catch (error) {
    console.error('Error fetching transaction stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== GET SINGLE TRANSACTION =====
router.get('/:id', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('user', 'firstName lastName email')
      .populate('recordedBy', 'firstName lastName email');
    
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    if (req.user.role !== 'admin' && req.user.role !== 'staff' && 
        transaction.user && transaction.user._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }
    
    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;