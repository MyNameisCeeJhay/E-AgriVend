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
    const ext = path.extname(file.originalname);
    cb(null, 'return-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

const generateReturnId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RET-${timestamp}-${random}`;
};

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
    
    // Format date and time
    const transactionDate = new Date(transaction.createdAt);
    const formattedDate = transactionDate.toLocaleDateString('en-US');
    const formattedTime = transactionDate.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    
    res.json({
      success: true,
      data: {
        createdAt: transaction.createdAt,
        transactionDate: formattedDate,
        transactionTime: formattedTime,
        productName: transaction.productName,
        grainType: transaction.productName,
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

// Submit refund request - SAVES TO RETURN COLLECTION
router.post('/request', upload.single('receiptImage'), async (req, res) => {
  try {
    console.log('📝 Processing refund request...');
    console.log('Request body:', req.body);
    console.log('File:', req.file);
    
    const {
      fullName,
      email,
      transactionNumber,
      riceType,
      quantityKg,
      amountPaid,
      returnReason,
      description
    } = req.body;
    
    console.log('Extracted data:', {
      fullName,
      email,
      transactionNumber,
      riceType,
      quantityKg,
      amountPaid,
      returnReason,
      description
    });
    
    // Validate required fields
    if (!fullName) return res.status(400).json({ success: false, error: 'Full name required' });
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });
    if (!transactionNumber) return res.status(400).json({ success: false, error: 'Transaction number required' });
    if (!riceType) return res.status(400).json({ success: false, error: 'Rice type required' });
    if (!quantityKg) return res.status(400).json({ success: false, error: 'Quantity required' });
    if (!amountPaid) return res.status(400).json({ success: false, error: 'Amount required' });
    if (!returnReason) return res.status(400).json({ success: false, error: 'Refund reason required' });
    if (!description) return res.status(400).json({ success: false, error: 'Description required' });
    if (!req.file) return res.status(400).json({ success: false, error: 'Receipt required' });
    
    // Verify transaction exists
    const transaction = await Transaction.findOne({ 
      transactionId: transactionNumber,
      status: 'COMPLETED'
    });
    
    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }
    
    // Check 4-hour window
    const hoursDiff = (new Date() - new Date(transaction.createdAt)) / (1000 * 60 * 60);
    if (hoursDiff > 4) {
      return res.status(400).json({ success: false, error: 'Refund window is 4 hours only' });
    }
    
    // Check duplicate
    const existing = await Return.findOne({ transactionId: transactionNumber });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Refund already submitted' });
    }
    
    // Create return request
    const returnRequest = new Return({
      returnId: generateReturnId(),
      transactionId: transactionNumber,
      fullName: fullName,
      email: email,
      riceType: riceType,
      quantityKg: Number(quantityKg),
      amountPaid: Number(amountPaid),
      returnReason: returnReason,
      description: description,
      receiptFilename: req.file.filename,
      receiptPath: `/uploads/returns/${req.file.filename}`,
      status: 'PENDING'
    });
    
    await returnRequest.save();
    
    console.log('✅ Refund saved to Return collection!');
    console.log('   Return ID:', returnRequest.returnId);
    console.log('   Name:', returnRequest.fullName);
    console.log('   Email:', returnRequest.email);
    console.log('   Description:', returnRequest.description);
    
    res.json({ 
      success: true, 
      message: 'Refund request submitted successfully!',
      data: { 
        returnId: returnRequest.returnId, 
        status: returnRequest.status 
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get refund status
router.get('/status/:transactionId', async (req, res) => {
  try {
    const { transactionId } = req.params;
    const returnRequest = await Return.findOne({ transactionId: transactionId });
    
    if (!returnRequest) {
      return res.status(404).json({ success: false, error: 'No refund found' });
    }
    
    res.json({ success: true, data: returnRequest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all returns - THIS IS WHAT YOUR ADMIN PANEL CALLS
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    let query = {};
    if (status && status !== 'all') query.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const returns = await Return.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Return.countDocuments(query);
    
    console.log(`📋 Found ${returns.length} returns`);
    returns.forEach(r => {
      console.log(`   ID: ${r.returnId}, Name: ${r.fullName}, Email: ${r.email}, Desc: ${r.description?.substring(0, 30)}`);
    });
    
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single return by returnId
router.get('/admin/:returnId', protect, admin, async (req, res) => {
  try {
    const returnRequest = await Return.findOne({ returnId: req.params.returnId });
    if (!returnRequest) {
      return res.status(404).json({ success: false, error: 'Return not found' });
    }
    res.json({ success: true, data: returnRequest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get stats summary
router.get('/admin/stats/summary', protect, admin, async (req, res) => {
  try {
    const total = await Return.countDocuments();
    const pending = await Return.countDocuments({ status: 'PENDING' });
    const approved = await Return.countDocuments({ status: 'APPROVED' });
    const rejected = await Return.countDocuments({ status: 'REJECTED' });
    
    res.json({
      success: true,
      data: { total, pending, approved, rejected }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process return (approve/reject)
router.put('/admin/:returnId/process', protect, admin, async (req, res) => {
  try {
    const { returnId } = req.params;
    const { status, adminNotes, processedBy, processedByName } = req.body;
    
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid status required' });
    }
    
    const returnRequest = await Return.findOne({ returnId: returnId });
    
    if (!returnRequest) {
      return res.status(404).json({ success: false, error: 'Return not found' });
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
    
    res.json({ success: true, message: `Refund ${status.toLowerCase()}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get pending count
router.get('/admin/pending/count', protect, admin, async (req, res) => {
  try {
    const count = await Return.countDocuments({ status: 'PENDING' });
    res.json({ success: true, data: { pending: count } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve receipt image
router.get('/receipt-image/:filename', protect, admin, async (req, res) => {
  try {
    const { filename } = req.params;
    console.log('📎 Serving receipt:', filename);
    
    const filePath = path.join(__dirname, '../uploads/returns/', filename);
    
    if (!fs.existsSync(filePath)) {
      console.error('❌ Receipt not found:', filePath);
      return res.status(404).json({ success: false, error: 'Receipt not found' });
    }
    
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'image/jpeg';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.pdf') contentType = 'application/pdf';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;