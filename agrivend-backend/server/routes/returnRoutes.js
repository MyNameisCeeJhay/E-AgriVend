import express from 'express';
import Return from '../models/Return.js';
import { protect, admin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// ===== PUBLIC TEST ROUTES =====
router.get('/ping', (req, res) => {
  console.log('✅ PING ROUTE HIT - /api/returns/ping');
  res.json({ 
    success: true, 
    message: 'Return routes are active',
    timestamp: new Date().toISOString()
  });
});

router.get('/test', (req, res) => {
  console.log('✅ TEST ROUTE HIT - /api/returns/test');
  res.json({ 
    success: true, 
    message: 'Return test route is working',
    timestamp: new Date().toISOString()
  });
});

// ===== ADMIN ROUTES =====
// IMPORTANT: These must be in the correct order - static routes before dynamic ones

// Admin stats route
router.get('/admin/stats', protect, admin, async (req, res) => {
  console.log('📊 ADMIN STATS ROUTE HIT - by:', req.user?.email);
  try {
    const pending = await Return.countDocuments({ status: 'PENDING' });
    const approved = await Return.countDocuments({ status: 'APPROVED' });
    const rejected = await Return.countDocuments({ status: 'REJECTED' });
    const total = await Return.countDocuments();

    res.json({
      success: true,
      data: { pending, approved, rejected, total }
    });
  } catch (error) {
    console.error('Error in admin/stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin all returns route with pagination
router.get('/admin/all', protect, admin, async (req, res) => {
  console.log('📋 ADMIN ALL ROUTE HIT - by:', req.user?.email);
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status && status !== 'all' ? { status } : {};
    
    const returns = await Return.find(query)
      .populate('user', 'firstName lastName email phone')
      .populate('processedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Return.countDocuments(query);

    res.json({
      success: true,
      data: returns,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error in admin/all:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single return by returnId (admin only)
router.get('/admin/:returnId', protect, admin, async (req, res) => {
  console.log('🔍 ADMIN SINGLE RETURN ROUTE HIT - returnId:', req.params.returnId);
  try {
    const returnRequest = await Return.findOne({ returnId: req.params.returnId })
      .populate('user', 'firstName lastName email phone address')
      .populate('processedBy', 'firstName lastName');

    if (!returnRequest) {
      return res.status(404).json({ 
        success: false, 
        error: 'Return not found' 
      });
    }

    res.json({
      success: true,
      data: returnRequest
    });
  } catch (error) {
    console.error('Error in admin/:returnId:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Process return (approve/reject) - admin only
router.put('/admin/:returnId/process', protect, admin, async (req, res) => {
  console.log('⚙️ PROCESS RETURN ROUTE HIT - returnId:', req.params.returnId);
  console.log('Request body:', req.body);
  
  try {
    const { status, adminNotes } = req.body;
    const { returnId } = req.params;

    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Valid status (APPROVED or REJECTED) is required' 
      });
    }

    const returnRequest = await Return.findOne({ returnId });

    if (!returnRequest) {
      return res.status(404).json({ 
        success: false, 
        error: 'Return not found' 
      });
    }

    returnRequest.status = status;
    returnRequest.adminNotes = adminNotes || '';
    returnRequest.processedBy = req.user._id;
    returnRequest.processedAt = new Date();

    await returnRequest.save();

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('return_status_update', {
        returnId: returnRequest.returnId,
        status: returnRequest.status,
        processedAt: returnRequest.processedAt
      });
    }

    console.log(`✅ Return ${returnId} ${status} successfully`);

    res.json({
      success: true,
      data: returnRequest
    });
  } catch (error) {
    console.error('Error in process return:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download receipt (admin only)
router.get('/admin/:returnId/receipt', protect, admin, async (req, res) => {
  console.log('📎 DOWNLOAD RECEIPT ROUTE HIT - returnId:', req.params.returnId);
  
  try {
    const returnRequest = await Return.findOne({ returnId: req.params.returnId });

    if (!returnRequest || !returnRequest.receiptPath) {
      return res.status(404).json({ 
        success: false, 
        error: 'Receipt not found' 
      });
    }

    if (!fs.existsSync(returnRequest.receiptPath)) {
      return res.status(404).json({ 
        success: false, 
        error: 'Receipt file not found' 
      });
    }

    res.sendFile(path.resolve(returnRequest.receiptPath));
  } catch (error) {
    console.error('Error downloading receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== CUSTOMER ROUTES =====
router.get('/my-returns', protect, async (req, res) => {
  console.log('📋 MY RETURNS ROUTE HIT - by:', req.user?.email);
  try {
    const returns = await Return.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: returns });
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create return request (customer)
router.post('/', protect, upload.single('receipt'), async (req, res) => {
  console.log('📝 CREATE RETURN ROUTE HIT - by:', req.user?.email);
  try {
    const { transactionId, riceType, quantityKg, amountPaid, returnReason } = req.body;

    // Validation
    if (!transactionId || !riceType || !quantityKg || !amountPaid || !returnReason) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: 'Receipt image is required' 
      });
    }

    const newReturn = new Return({
      returnId: 'RET-' + Date.now().toString(36).toUpperCase(),
      transactionId,
      user: req.user._id,
      riceType,
      quantityKg: parseFloat(quantityKg),
      amountPaid: parseFloat(amountPaid),
      returnReason,
      receiptFilename: req.file.filename,
      receiptPath: req.file.path,
      status: 'PENDING'
    });

    await newReturn.save();

    // Emit socket event for admin notification
    const io = req.app.get('io');
    if (io) {
      io.emit('new_return_notification', {
        returnId: newReturn.returnId,
        user: {
          id: req.user._id,
          name: `${req.user.firstName} ${req.user.lastName}`,
          email: req.user.email
        },
        riceType: newReturn.riceType,
        quantity: newReturn.quantityKg,
        amount: newReturn.amountPaid
      });
    }

    res.status(201).json({ 
      success: true, 
      data: newReturn,
      message: 'Return request created successfully' 
    });
  } catch (error) {
    console.error('Error creating return:', error);
    res.status(500).json({ success: false, error: error.message });
  }
  
});
// Get unread return updates count
router.get('/unread-updates', protect, async (req, res) => {
  console.log('🔔 GET /api/returns/unread-updates - by:', req.user?.email);
  try {
    const count = await Return.countDocuments({
      user: req.user._id,
      status: { $ne: 'PENDING' },
      seenByCustomer: false
    });

    res.json({
      success: true,
      count
    });
  } catch (error) {
    console.error('Error fetching unread updates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// Mark return update as seen
router.put('/:returnId/mark-seen', protect, async (req, res) => {
  console.log('👁️ PUT /api/returns/:returnId/mark-seen - by:', req.user?.email);
  try {
    const returnReq = await Return.findOne({
      returnId: req.params.returnId,
      user: req.user._id
    });

    if (!returnReq) {
      return res.status(404).json({ 
        success: false, 
        error: 'Return not found' 
      });
    }

    returnReq.seenByCustomer = true;
    await returnReq.save();

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error marking return as seen:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

export default router;