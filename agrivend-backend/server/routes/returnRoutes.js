import express from 'express';
import Return from '../models/Return.js';
import { protect, admin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Create email transporter
const getTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Function to send email
const sendEmail = async (to, subject, html, text) => {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"AgriVend Support" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '')
    });
    console.log(`✅ Email sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

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

// Process return (approve/reject) - WITH EMAIL NOTIFICATION
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

    console.log(`📋 Processing refund for: ${returnRequest.fullName} (${returnRequest.email})`);
    console.log(`   Status: ${status}`);

    // Update return request
    returnRequest.status = status;
    returnRequest.adminNotes = adminNotes || (status === 'APPROVED' ? 'Refund approved by administrator.' : 'Refund rejected by administrator.');
    returnRequest.processedBy = req.user._id;
    returnRequest.processedByName = `${req.user.firstName} ${req.user.lastName}`;
    returnRequest.processedAt = new Date();

    await returnRequest.save();
    console.log(`✅ Return ${returnId} ${status} successfully`);

    // SEND EMAIL NOTIFICATION (do not await - fire and forget)
    const isApproved = status === 'APPROVED';
    const statusText = isApproved ? 'APPROVED' : 'REJECTED';
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <div style="background: ${isApproved ? '#4CAF50' : '#f44336'}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px;">
          <h1 style="margin: 0;">Refund ${statusText}</h1>
        </div>
        
        <p>Dear <strong>${returnRequest.fullName}</strong>,</p>
        
        <p>Your refund request has been <strong>${statusText}</strong>.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Refund Details:</h3>
          <p><strong>Refund ID:</strong> ${returnRequest.returnId}</p>
          <p><strong>Transaction ID:</strong> ${returnRequest.transactionId}</p>
          <p><strong>Product:</strong> ${returnRequest.riceType}</p>
          <p><strong>Quantity:</strong> ${returnRequest.quantityKg} kg</p>
          <p><strong>Amount:</strong> ₱${returnRequest.amountPaid.toFixed(2)}</p>
        </div>
        
        ${returnRequest.adminNotes ? `<p><strong>Admin Note:</strong> ${returnRequest.adminNotes}</p>` : ''}
        
        <p>${isApproved ? 'Your refund will be processed within 3-5 business days.' : 'If you have questions, please contact our support team.'}</p>
        
        <p>Thank you for choosing AgriVend.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        
        <p style="color: #999; font-size: 12px;">This is an automated message from AgriVend. Please do not reply to this email.</p>
      </div>
    `;
    
    const emailText = `Refund ${statusText}\n\nDear ${returnRequest.fullName},\n\nYour refund request (${returnRequest.returnId}) has been ${statusText}.\n\nTransaction ID: ${returnRequest.transactionId}\nProduct: ${returnRequest.riceType}\nQuantity: ${returnRequest.quantityKg} kg\nAmount: ₱${returnRequest.amountPaid.toFixed(2)}\n\n${returnRequest.adminNotes ? `Admin Note: ${returnRequest.adminNotes}\n\n` : ''}${isApproved ? 'Your refund will be processed within 3-5 business days.' : 'If you have questions, please contact support.'}\n\nThank you,\nAgriVend Team`;
    
    // Send email in background (don't await)
    sendEmail(
      returnRequest.email,
      `Refund ${statusText} - ${returnRequest.returnId}`,
      emailHtml,
      emailText
    ).catch(err => console.log('Email error (non-blocking):', err.message));

    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('return_status_update', {
        returnId: returnRequest.returnId,
        status: returnRequest.status,
        processedAt: returnRequest.processedAt
      });
    }

    // Send response immediately
    res.json({
      success: true,
      message: `Refund ${status.toLowerCase()} successfully`,
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
    const { transactionId, riceType, quantityKg, amountPaid, returnReason, description } = req.body;

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
      returnId: 'RET-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      transactionId,
      user: req.user._id,
      fullName: `${req.user.firstName} ${req.user.lastName}`,
      email: req.user.email,
      riceType,
      quantityKg: parseFloat(quantityKg),
      amountPaid: parseFloat(amountPaid),
      returnReason,
      description: description || '',
      receiptFilename: req.file.filename,
      receiptPath: req.file.path,
      status: 'PENDING'
    });

    await newReturn.save();

    // Send confirmation email in background
    const confirmationHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <div style="background: #FFC107; color: #333; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px;">
          <h1 style="margin: 0;">Refund Request Received</h1>
        </div>
        
        <p>Dear <strong>${newReturn.fullName}</strong>,</p>
        
        <p>Thank you for submitting your refund request. We have received it and will review it shortly.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Request Details:</h3>
          <p><strong>Refund ID:</strong> ${newReturn.returnId}</p>
          <p><strong>Transaction ID:</strong> ${newReturn.transactionId}</p>
          <p><strong>Product:</strong> ${newReturn.riceType}</p>
          <p><strong>Quantity:</strong> ${newReturn.quantityKg} kg</p>
          <p><strong>Amount:</strong> ₱${newReturn.amountPaid.toFixed(2)}</p>
        </div>
        
        <p>We will notify you once your request has been processed (typically within 1-2 business days).</p>
        
        <p>Thank you for your patience.</p>
        
        <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
        
        <p style="color: #999; font-size: 12px;">This is an automated message from AgriVend. Please do not reply to this email.</p>
      </div>
    `;
    
    sendEmail(
      newReturn.email,
      `Refund Request Received - ${newReturn.returnId}`,
      confirmationHtml
    ).catch(err => console.log('Confirmation email error:', err.message));

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
      message: 'Return request created successfully.'
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