import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import RefundRequest from '../models/RefundRequest.js';
import Transaction from '../models/Transaction.js';
import { protect, admin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/refunds/');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'refund-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and PDF are allowed.'), false);
  }
};

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

// ==================== CUSTOMER ROUTES ====================

// Validate transaction
router.get('/validate/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    console.log('🔍 Validating transaction:', transactionId);
    
    const transaction = await Transaction.findOne({ 
      transactionId: transactionId,
      status: 'COMPLETED'
    });
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found. Please check your transaction number.' 
      });
    }
    
    // Check if refund already requested
    const existingRefund = await RefundRequest.findOne({ 
      transactionNumber: transactionId 
    });
    
    if (existingRefund) {
      return res.status(400).json({ 
        success: false, 
        error: 'A refund request has already been submitted for this transaction.' 
      });
    }
    
    res.json({
      success: true,
      data: {
        createdAt: transaction.createdAt,
        riceType: transaction.riceType,
        quantityKg: transaction.quantityKg,
        amountPaid: transaction.amountPaid,
        transactionId: transaction.transactionId
      }
    });
  } catch (error) {
    console.error('Error validating transaction:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to validate transaction' 
    });
  }
});

// Submit refund request
router.post('/request', upload.single('receiptImage'), async (req, res) => {
  try {
    console.log('📝 Processing refund request...');
    
    const {
      fullName,
      email,
      transactionNumber,
      transactionDate,
      transactionTime,
      grainType,
      selectedQuantity,
      amountInserted,
      refundReason,
      description
    } = req.body;
    
    if (!fullName || !email || !transactionNumber || !refundReason || !description) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please fill in all required fields' 
      });
    }
    
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Receipt image is required' 
      });
    }
    
    // Verify transaction exists
    const transaction = await Transaction.findOne({ 
      transactionId: transactionNumber,
      status: 'COMPLETED'
    });
    
    if (!transaction) {
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    // Check 4-hour window
    const transactionTimeDate = new Date(transaction.createdAt);
    const now = new Date();
    const hoursDiff = (now - transactionTimeDate) / (1000 * 60 * 60);
    
    if (hoursDiff > 4) {
      return res.status(400).json({ 
        success: false, 
        error: 'Refund requests are only accepted within 4 hours of the transaction.' 
      });
    }
    
    // Check if refund already exists
    const existingRefund = await RefundRequest.findOne({ 
      transactionNumber: transactionNumber 
    });
    
    if (existingRefund) {
      return res.status(400).json({ 
        success: false, 
        error: 'A refund request has already been submitted for this transaction.' 
      });
    }
    
    // Create refund request
    const refundRequest = new RefundRequest({
      fullName,
      email,
      transactionNumber,
      transactionDate,
      transactionTime,
      grainType,
      selectedQuantity: Number(selectedQuantity),
      amountInserted: Number(amountInserted),
      refundReason,
      description,
      receiptFilename: req.file.filename,
      receiptImage: `/uploads/refunds/${req.file.filename}`,
      status: 'PENDING',
      isRead: false
    });
    
    await refundRequest.save();
    
    console.log('✅ Refund request saved:', refundRequest._id);
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('new_refund_notification', {
        id: refundRequest._id,
        transactionId: refundRequest.transactionNumber,
        fullName: refundRequest.fullName,
        amountInserted: refundRequest.amountInserted,
        createdAt: refundRequest.createdAt
      });
    }
    
    res.json({
      success: true,
      message: 'Refund request submitted successfully!',
      data: {
        refundId: refundRequest._id,
        status: refundRequest.status
      }
    });
  } catch (error) {
    console.error('Error submitting refund request:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to submit refund request' 
    });
  }
});

// Get refund status
router.get('/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    const refundRequest = await RefundRequest.findOne({ 
      transactionNumber: transactionId 
    });
    
    if (!refundRequest) {
      return res.status(404).json({ 
        success: false, 
        error: 'No refund request found for this transaction.' 
      });
    }
    
    res.json({
      success: true,
      data: {
        id: refundRequest._id,
        status: refundRequest.status,
        fullName: refundRequest.fullName,
        transactionNumber: refundRequest.transactionNumber,
        amountInserted: refundRequest.amountInserted,
        refundReason: refundRequest.refundReason,
        description: refundRequest.description,
        adminNotes: refundRequest.adminNotes,
        submittedAt: refundRequest.createdAt,
        processedAt: refundRequest.processedAt,
        processedByName: refundRequest.processedByName
      }
    });
  } catch (error) {
    console.error('Error checking refund status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check refund status' 
    });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all refund requests
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const refunds = await RefundRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await RefundRequest.countDocuments(query);
    
    res.json({
      success: true,
      data: refunds,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch refund requests' 
    });
  }
});

// Get pending count
router.get('/admin/pending/count', protect, admin, async (req, res) => {
  try {
    const count = await RefundRequest.countDocuments({ status: 'PENDING' });
    res.json({ success: true, data: { pending: count } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch count' });
  }
});

// Process refund request
router.put('/admin/:refundId/process', protect, admin, async (req, res) => {
  try {
    const { refundId } = req.params;
    const { status, adminNotes, processedBy, processedByName } = req.body;
    
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid status (APPROVED or REJECTED) is required.' 
      });
    }
    
    const refundRequest = await RefundRequest.findById(refundId);
    
    if (!refundRequest) {
      return res.status(404).json({ 
        success: false, 
        error: 'Refund request not found.' 
      });
    }
    
    refundRequest.status = status;
    refundRequest.adminNotes = adminNotes || '';
    refundRequest.processedAt = new Date();
    refundRequest.processedBy = processedBy;
    refundRequest.processedByName = processedByName;
    
    await refundRequest.save();
    
    // Update transaction status if approved
    if (status === 'APPROVED') {
      await Transaction.findOneAndUpdate(
        { transactionId: refundRequest.transactionNumber },
        { status: 'REFUNDED' }
      );
    }
    
    const io = req.app.get('io');
    if (io) {
      io.emit('refund_processed', {
        id: refundRequest._id,
        status: refundRequest.status,
        transactionNumber: refundRequest.transactionNumber
      });
    }
    
    res.json({
      success: true,
      message: `Refund ${status.toLowerCase()}`,
      data: refundRequest
    });
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process refund request' 
    });
  }
});

// Get refund statistics
router.get('/admin/stats/summary', protect, admin, async (req, res) => {
  try {
    const total = await RefundRequest.countDocuments();
    const pending = await RefundRequest.countDocuments({ status: 'PENDING' });
    const approved = await RefundRequest.countDocuments({ status: 'APPROVED' });
    const rejected = await RefundRequest.countDocuments({ status: 'REJECTED' });
    
    const totalAmount = await RefundRequest.aggregate([
      { $match: { status: 'APPROVED' } },
      { $group: { _id: null, total: { $sum: '$amountInserted' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        rejected,
        totalApprovedAmount: totalAmount[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// DEBUG: List recent transactions (admin only)
router.get('/debug/transactions', protect, admin, async (req, res) => {
  try {
    const transactions = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select('transactionId status amountPaid createdAt');
    
    console.log('📊 Recent transactions:', transactions.map(t => t.transactionId));
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;