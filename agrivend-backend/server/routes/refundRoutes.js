import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Return from '../models/Return.js';
import Transaction from '../models/Transaction.js';
import { protect, admin } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/returns/');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'return-' + uniqueSuffix + path.extname(file.originalname));
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

// Helper function to generate return ID
const generateReturnId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RET-${timestamp}-${random}`;
};

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
    
    const existingReturn = await Return.findOne({ 
      transactionId: transactionId 
    });
    
    if (existingReturn) {
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

// Submit refund request - SAVES TO RETURNS COLLECTION
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
    
    // Validate required fields
    const missingFields = [];
    if (!fullName) missingFields.push('fullName');
    if (!email) missingFields.push('email');
    if (!transactionNumber) missingFields.push('transactionNumber');
    if (!refundReason) missingFields.push('refundReason');
    if (!description) missingFields.push('description');
    if (!req.file) missingFields.push('receiptImage');
    
    if (missingFields.length > 0) {
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
    
    // Check if return already exists
    const existingReturn = await Return.findOne({ 
      transactionId: transactionNumber 
    });
    
    if (existingReturn) {
      return res.status(400).json({ 
        success: false, 
        error: 'A refund request has already been submitted for this transaction.' 
      });
    }
    
    // Create return request
    const returnRequest = new Return({
      returnId: generateReturnId(),
      transactionId: transactionNumber,
      user: null,
      fullName: fullName,
      email: email,
      riceType: grainType || transaction.productName,
      quantityKg: Number(selectedQuantity) || transaction.quantityKg,
      amountPaid: Number(amountInserted) || transaction.amountPaid,
      returnReason: refundReason,
      description: description,
      receiptFilename: req.file.filename,
      receiptPath: `/uploads/returns/${req.file.filename}`,
      status: 'PENDING',
      isRead: false,
      seenByCustomer: false
    });
    
    await returnRequest.save();
    
    console.log('✅ Refund request saved to RETURNS collection!');
    
    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.emit('new_return_notification', {
        returnId: returnRequest.returnId,
        transactionId: returnRequest.transactionId,
        fullName: returnRequest.fullName,
        email: returnRequest.email,
        riceType: returnRequest.riceType,
        quantityKg: returnRequest.quantityKg,
        amountPaid: returnRequest.amountPaid,
        status: returnRequest.status,
        createdAt: returnRequest.createdAt
      });
    }
    
    res.json({
      success: true,
      message: 'Refund request submitted successfully!',
      data: {
        returnId: returnRequest.returnId,
        status: returnRequest.status,
        transactionNumber: returnRequest.transactionId
      }
    });
  } catch (error) {
    console.error('❌ Error submitting refund request:', error);
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
    
    const returnRequest = await Return.findOne({ 
      transactionId: transactionId 
    });
    
    if (!returnRequest) {
      return res.status(404).json({ 
        success: false, 
        error: 'No refund request found for this transaction.' 
      });
    }
    
    res.json({
      success: true,
      data: {
        id: returnRequest._id,
        returnId: returnRequest.returnId,
        status: returnRequest.status,
        fullName: returnRequest.fullName,
        transactionNumber: returnRequest.transactionId,
        amountPaid: returnRequest.amountPaid,
        riceType: returnRequest.riceType,
        quantityKg: returnRequest.quantityKg,
        returnReason: returnRequest.returnReason,
        description: returnRequest.description,
        receiptPath: returnRequest.receiptPath,
        adminNotes: returnRequest.adminNotes,
        submittedAt: returnRequest.createdAt,
        processedAt: returnRequest.processedAt,
        processedByName: returnRequest.processedByName
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

// Get all return requests (admin)
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const returns = await Return.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Return.countDocuments(query);
    
    res.json({
      success: true,
      data: returns,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch return requests' 
    });
  }
});

// Get single return request by ID
router.get('/admin/:returnId', protect, admin, async (req, res) => {
  try {
    const { returnId } = req.params;
    
    const returnRequest = await Return.findOne({ returnId: returnId });
    
    if (!returnRequest) {
      return res.status(404).json({ 
        success: false, 
        error: 'Return request not found' 
      });
    }
    
    res.json({
      success: true,
      data: returnRequest
    });
  } catch (error) {
    console.error('Error fetching return:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch return request' 
    });
  }
});

// Get pending count
router.get('/admin/pending/count', protect, admin, async (req, res) => {
  try {
    const count = await Return.countDocuments({ status: 'PENDING' });
    res.json({ success: true, data: { pending: count } });
  } catch (error) {
    console.error('Error fetching pending count:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch count' });
  }
});

// Get return statistics
router.get('/admin/stats/summary', protect, admin, async (req, res) => {
  try {
    const total = await Return.countDocuments();
    const pending = await Return.countDocuments({ status: 'PENDING' });
    const approved = await Return.countDocuments({ status: 'APPROVED' });
    const rejected = await Return.countDocuments({ status: 'REJECTED' });
    
    const totalAmount = await Return.aggregate([
      { $match: { status: 'APPROVED' } },
      { $group: { _id: null, total: { $sum: '$amountPaid' } } }
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

// Process return request (approve/reject)
router.put('/admin/:returnId/process', protect, admin, async (req, res) => {
  try {
    const { returnId } = req.params;
    const { status, adminNotes, processedBy, processedByName } = req.body;
    
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid status (APPROVED or REJECTED) is required.' 
      });
    }
    
    const returnRequest = await Return.findOne({ returnId: returnId });
    
    if (!returnRequest) {
      return res.status(404).json({ 
        success: false, 
        error: 'Return request not found.' 
      });
    }
    
    returnRequest.status = status;
    returnRequest.adminNotes = adminNotes || '';
    returnRequest.processedAt = new Date();
    returnRequest.processedBy = processedBy;
    returnRequest.processedByName = processedByName;
    
    await returnRequest.save();
    
    if (status === 'APPROVED') {
      await Transaction.findOneAndUpdate(
        { transactionId: returnRequest.transactionId },
        { status: 'REFUNDED' }
      );
    }
    
    const io = req.app.get('io');
    if (io) {
      io.emit('return_processed', {
        id: returnRequest._id,
        returnId: returnRequest.returnId,
        status: returnRequest.status,
        transactionId: returnRequest.transactionId
      });
    }
    
    res.json({
      success: true,
      message: `Refund ${status.toLowerCase()}`,
      data: returnRequest
    });
  } catch (error) {
    console.error('Error processing return:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process return request' 
    });
  }
});

// Download receipt (admin)
router.get('/admin/:returnId/receipt', protect, admin, async (req, res) => {
  try {
    const { returnId } = req.params;
    
    const returnRequest = await Return.findOne({ returnId: returnId });
    
    if (!returnRequest || !returnRequest.receiptPath) {
      return res.status(404).json({ 
        success: false, 
        error: 'Receipt not found' 
      });
    }
    
    const fullPath = path.join(__dirname, '..', returnRequest.receiptPath);
    
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Receipt file not found' 
      });
    }
    
    res.sendFile(fullPath);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== RECEIPT IMAGE ENDPOINT (FIXED) ====================
// Serve receipt image directly - FIXED VERSION
router.get('/receipt-image/:filename', protect, admin, async (req, res) => {
  try {
    const { filename } = req.params;
    
    // Try multiple possible locations
    const possiblePaths = [
      path.join(__dirname, '../uploads/returns/', filename),
      path.join(__dirname, '../uploads/refund-receipts/', filename),
      path.join(__dirname, '../uploads/', filename)
    ];
    
    let filePath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        filePath = testPath;
        break;
      }
    }
    
    if (!filePath) {
      console.error('Receipt file not found:', filename);
      return res.status(404).json({ 
        success: false, 
        error: 'Receipt not found' 
      });
    }
    
    // Get file extension to set correct content type
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.pdf') contentType = 'application/pdf';
    
    // Set headers and send file
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving receipt:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load receipt' 
    });
  }
});

export default router;