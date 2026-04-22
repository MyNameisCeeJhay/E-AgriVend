import express from 'express';
import RefundRequest from '../models/RefundRequest.js';
import Transaction from '../models/Transaction.js';
import { protect, admin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// Public Routes
router.get('/validate/:transactionId', async (req, res) => {
  try {
    const transaction = await Transaction.findOne({ transactionId: req.params.transactionId });
    if (!transaction) return res.status(404).json({ success: false, error: 'Transaction not found' });
    
    const existingRefund = await RefundRequest.findOne({ transactionNumber: req.params.transactionId });
    if (existingRefund) return res.status(400).json({ success: false, error: 'Refund already submitted' });
    
    res.json({ success: true, data: transaction });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/request', upload.single('receiptImage'), async (req, res) => {
  try {
    const { fullName, email, transactionNumber, transactionDate, transactionTime, grainType, selectedQuantity, amountInserted, refundReason, description } = req.body;
    
    const transaction = await Transaction.findOne({ transactionId: transactionNumber });
    if (!transaction) return res.status(404).json({ success: false, error: 'Transaction not found' });
    
    const hoursDiff = (new Date() - new Date(transaction.createdAt)) / (1000 * 60 * 60);
    if (hoursDiff > 4) return res.status(400).json({ success: false, error: 'Refund window expired' });
    
    const existingRefund = await RefundRequest.findOne({ transactionNumber });
    if (existingRefund) return res.status(400).json({ success: false, error: 'Refund already submitted' });
    
    const refundRequest = new RefundRequest({
      requestId: 'REF-' + Date.now().toString(36).toUpperCase(),
      fullName, email, transactionNumber, transactionDate, transactionTime,
      grainType, selectedQuantity: parseFloat(selectedQuantity), amountInserted: parseFloat(amountInserted),
      refundReason, description, receiptFilename: req.file?.filename, receiptPath: req.file?.path, status: 'PENDING'
    });
    
    await refundRequest.save();
    res.status(201).json({ success: true, data: refundRequest, message: 'Refund submitted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Admin Routes
router.get('/admin/all', protect, admin, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status && status !== 'all' ? { status } : {};
    const refunds = await RefundRequest.find(query).sort({ createdAt: -1 }).limit(parseInt(limit)).skip((parseInt(page) - 1) * parseInt(limit));
    const total = await RefundRequest.countDocuments(query);
    res.json({ success: true, data: refunds, pagination: { total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)) } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/stats', protect, admin, async (req, res) => {
  try {
    const pending = await RefundRequest.countDocuments({ status: 'PENDING' });
    const approved = await RefundRequest.countDocuments({ status: 'APPROVED' });
    const rejected = await RefundRequest.countDocuments({ status: 'REJECTED' });
    res.json({ success: true, data: { pending, approved, rejected, total: pending + approved + rejected } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/admin/:requestId/process', protect, admin, async (req, res) => {
  try {
    const { status, adminNotes } = req.body;
    const refundRequest = await RefundRequest.findOne({ requestId: req.params.requestId });
    if (!refundRequest) return res.status(404).json({ success: false, error: 'Refund not found' });
    
    refundRequest.status = status;
    refundRequest.adminNotes = adminNotes || '';
    refundRequest.processedBy = req.user._id;
    refundRequest.processedAt = new Date();
    await refundRequest.save();
    
    res.json({ success: true, data: refundRequest });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/admin/:requestId/receipt', protect, admin, async (req, res) => {
  try {
    const refundRequest = await RefundRequest.findOne({ requestId: req.params.requestId });
    if (!refundRequest || !refundRequest.receiptPath) return res.status(404).json({ success: false, error: 'Receipt not found' });
    if (!fs.existsSync(refundRequest.receiptPath)) return res.status(404).json({ success: false, error: 'File not found' });
    res.sendFile(path.resolve(refundRequest.receiptPath));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check if refund already exists for a transaction
router.get('/check/:transactionNumber', async (req, res) => {
  try {
    const existingRefund = await RefundRequest.findOne({ 
      transactionNumber: req.params.transactionNumber 
    });
    
    res.json({
      success: true,
      exists: !!existingRefund
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;