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
      console.log('❌ Transaction not found:', transactionId);
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
        productName: transaction.productName,
        quantityKg: transaction.quantityKg,
        amountPaid: transaction.amountPaid,
        transactionId: transaction.transactionId,
        pricePerKg: transaction.pricePerKg,
        paymentMethod: transaction.paymentMethod
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

// Submit refund request - FIXED VERSION
router.post('/request', upload.single('receiptImage'), async (req, res) => {
  try {
    console.log('📝 Processing refund request...');
    console.log('Request body:', req.body);
    console.log('File:', req.file);
    
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
    
    // Validate required fields
    const missingFields = [];
    if (!fullName) missingFields.push('fullName');
    if (!email) missingFields.push('email');
    if (!transactionNumber) missingFields.push('transactionNumber');
    if (!refundReason) missingFields.push('refundReason');
    if (!description) missingFields.push('description');
    if (!req.file) missingFields.push('receiptImage');
    
    if (missingFields.length > 0) {
      console.log('❌ Missing fields:', missingFields);
      return res.status(400).json({ 
        success: false, 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    // Verify transaction exists
    const transaction = await Transaction.findOne({ 
      transactionId: transactionNumber,
      status: 'COMPLETED'
    });
    
    if (!transaction) {
      console.log('❌ Transaction not found:', transactionNumber);
      return res.status(404).json({ 
        success: false, 
        error: 'Transaction not found' 
      });
    }
    
    // Check 4-hour window
    const transactionTimeDate = new Date(transaction.createdAt);
    const now = new Date();
    const hoursDiff = (now - transactionTimeDate) / (1000 * 60 * 60);
    
    console.log(`⏰ Time difference: ${hoursDiff.toFixed(2)} hours`);
    
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
      console.log('❌ Refund already exists for this transaction');
      return res.status(400).json({ 
        success: false, 
        error: 'A refund request has already been submitted for this transaction.' 
      });
    }
    
    // Create refund request - NO requestId field
    const refundRequest = new RefundRequest({
      fullName,
      email,
      transactionNumber,
      transactionDate: transactionDate || new Date(transaction.createdAt).toLocaleDateString('en-US'),
      transactionTime: transactionTime || new Date(transaction.createdAt).toLocaleTimeString('en-US'),
      grainType: grainType || transaction.productName,
      selectedQuantity: Number(selectedQuantity) || transaction.quantityKg,
      amountInserted: Number(amountInserted) || transaction.amountPaid,
      refundReason,
      description,
      receiptFilename: req.file.filename,
      receiptImage: `/uploads/refunds/${req.file.filename}`,
      status: 'PENDING',
      isRead: false
    });
    
    await refundRequest.save();
    
    console.log('✅ Refund request saved successfully!');
    console.log('Refund ID:', refundRequest._id);
    console.log('Transaction Number:', refundRequest.transactionNumber);
    console.log('Status:', refundRequest.status);
    
    // Emit socket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      io.emit('new_refund_notification', {
        id: refundRequest._id,
        transactionNumber: refundRequest.transactionNumber,
        fullName: refundRequest.fullName,
        amountInserted: refundRequest.amountInserted,
        status: refundRequest.status,
        createdAt: refundRequest.createdAt
      });
      console.log('📡 Socket event emitted: new_refund_notification');
    }
    
    res.json({
      success: true,
      message: 'Refund request submitted successfully!',
      data: {
        refundId: refundRequest._id,
        status: refundRequest.status,
        transactionNumber: refundRequest.transactionNumber
      }
    });
  } catch (error) {
    console.error('❌ Error submitting refund request:', error);
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        error: 'A refund request has already been submitted for this transaction.' 
      });
    }
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
        grainType: refundRequest.grainType,
        selectedQuantity: refundRequest.selectedQuantity,
        refundReason: refundRequest.refundReason,
        description: refundRequest.description,
        receiptImage: refundRequest.receiptImage,
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

// Get all refund requests - FIXED to return complete data
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
    
    console.log(`📋 Found ${refunds.length} refund requests (Total: ${total})`);
    
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

// Get single refund request by ID
router.get('/admin/:refundId', protect, admin, async (req, res) => {
  try {
    const { refundId } = req.params;
    
    const refundRequest = await RefundRequest.findById(refundId);
    
    if (!refundRequest) {
      return res.status(404).json({ 
        success: false, 
        error: 'Refund request not found' 
      });
    }
    
    res.json({
      success: true,
      data: refundRequest
    });
  } catch (error) {
    console.error('Error fetching refund:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch refund request' 
    });
  }
});

// Get pending count
router.get('/admin/pending/count', protect, admin, async (req, res) => {
  try {
    const count = await RefundRequest.countDocuments({ status: 'PENDING' });
    console.log(`📊 Pending refund count: ${count}`);
    res.json({ success: true, data: { pending: count } });
  } catch (error) {
    console.error('Error fetching pending count:', error);
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

// DEBUG: List recent refunds
router.get('/debug/refunds', protect, admin, async (req, res) => {
  try {
    const refunds = await RefundRequest.find({})
      .sort({ createdAt: -1 })
      .limit(10);
    
    res.json({
      success: true,
      data: refunds
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;