import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Return from '../models/Return.js';
import Transaction from '../models/Transaction.js';
import { protect, admin } from '../middleware/auth.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

const router = express.Router();

// Email OTP Store (temporary - use database in production)
const emailOtpStore = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send verification email using Resend
const sendVerificationEmail = async (email, otp, fullName) => {
  console.log(`📧 Sending verification email to ${email} via Resend...`);
  
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [email],
      subject: 'Email Verification - AgriVend Refund Request',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 500px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); border-radius: 12px; }
            .logo { font-size: 24px; font-weight: bold; color: #2d6a4f; text-align: center; margin-bottom: 20px; }
            .otp-code { font-size: 36px; font-weight: bold; color: #2d6a4f; background: #ffffff; padding: 15px; border-radius: 8px; text-align: center; letter-spacing: 5px; margin: 20px 0; border: 1px solid #e2e8f0; }
            .footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">🌾 AgriVend</div>
            <h2>Email Verification</h2>
            <p>Hello <strong>${fullName}</strong>,</p>
            <p>Please use the verification code below to complete your refund request:</p>
            <div class="otp-code">${otp}</div>
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <div class="footer">
              <p>AgriVend - Solar Powered Grain Vending Machine</p>
              <p>Loma De Gato, Marilao, Bulacan</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `AgriVend Email Verification\n\nHello ${fullName},\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
    });
    
    if (error) {
      console.error('Resend error:', error);
      throw new Error(error.message);
    }
    
    console.log(`✅ Verification email sent via Resend, ID: ${data?.id}`);
    return data;
  } catch (error) {
    console.error('Failed to send email:', error.message);
    throw error;
  }
};

// Send refund status email using Resend
const sendRefundStatusEmail = async (email, fullName, returnId, transactionId, riceType, quantityKg, amountPaid, status, adminNotes) => {
  console.log(`📧 Sending refund ${status} email to ${email} via Resend...`);
  
  const isApproved = status === 'APPROVED';
  const statusText = isApproved ? 'APPROVED' : 'REJECTED';
  const statusColor = isApproved ? '#4CAF50' : '#f44336';
  
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [email],
      subject: `Refund Request ${statusText} - ${returnId}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
            .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
            .content { padding: 20px; }
            .details { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; font-size: 12px; color: #999; border-top: 1px solid #ddd; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Refund Request ${statusText}</h1>
            </div>
            <div class="content">
              <p>Dear <strong>${fullName}</strong>,</p>
              <p>Your refund request has been <strong>${statusText}</strong>.</p>
              <div class="details">
                <p><strong>Refund ID:</strong> ${returnId}</p>
                <p><strong>Transaction ID:</strong> ${transactionId}</p>
                <p><strong>Product:</strong> ${riceType}</p>
                <p><strong>Quantity:</strong> ${quantityKg} kg</p>
                <p><strong>Amount:</strong> ₱${amountPaid.toFixed(2)}</p>
              </div>
              ${adminNotes ? `<p><strong>Admin Note:</strong> ${adminNotes}</p>` : ''}
              <p>${isApproved ? 'Your refund will be processed within 3-5 business days.' : 'If you have questions, please contact support.'}</p>
              <p>Thank you,<br>AgriVend Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from AgriVend.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `AgriVend Refund ${statusText}\n\nDear ${fullName},\n\nYour refund request has been ${statusText}.\n\nRefund ID: ${returnId}\nTransaction ID: ${transactionId}\nProduct: ${riceType}\nQuantity: ${quantityKg} kg\nAmount: ₱${amountPaid.toFixed(2)}\n\n${adminNotes ? `Admin Note: ${adminNotes}\n\n` : ''}${isApproved ? 'Your refund will be processed within 3-5 business days.' : 'If you have questions, please contact support.'}\n\nThank you,\nAgriVend Team`
    });
    
    if (error) {
      console.error('Resend error:', error);
      throw new Error(error.message);
    }
    
    console.log(`✅ Refund status email sent via Resend, ID: ${data?.id}`);
    return data;
  } catch (error) {
    console.error('Failed to send email:', error.message);
    throw error;
  }
};

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

// ==================== EMAIL OTP ROUTES ====================

// Send OTP for email verification
router.post('/send-email-otp', async (req, res) => {
  console.log('\n📧 ===== SEND EMAIL OTP =====');
  console.log('Email:', req.body.email);
  
  try {
    const { email, fullName } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    emailOtpStore.set(email, { otp, expiresAt, attempts: 0 });
    
    console.log(`✅ OTP generated: ${otp} for ${email}`);
    
    try {
      await sendVerificationEmail(email, otp, fullName || 'Customer');
      
      res.json({ 
        success: true, 
        message: 'Verification code sent to your email'
      });
    } catch (emailError) {
      console.error('Email error:', emailError);
      // In development, return OTP for testing
      if (process.env.NODE_ENV === 'development') {
        return res.json({ 
          success: true, 
          message: 'Development mode - Check console for OTP',
          devOtp: otp
        });
      }
      throw emailError;
    }
    
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to send verification code' });
  }
});

// Resend OTP
router.post('/resend-email-otp', async (req, res) => {
  console.log('\n🔄 ===== RESEND EMAIL OTP =====');
  
  try {
    const { email, fullName } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    
    emailOtpStore.set(email, { otp, expiresAt, attempts: 0 });
    
    console.log(`✅ New OTP generated: ${otp} for ${email}`);
    
    try {
      await sendVerificationEmail(email, otp, fullName || 'Customer');
      res.json({ success: true, message: 'New verification code sent' });
    } catch (emailError) {
      if (process.env.NODE_ENV === 'development') {
        res.json({ success: true, message: 'Development mode', devOtp: otp });
      } else {
        throw emailError;
      }
    }
    
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to resend code' });
  }
});

// Verify Email OTP
router.post('/verify-email-otp', async (req, res) => {
  console.log('\n✅ ===== VERIFY EMAIL OTP =====');
  console.log('Email:', req.body.email);
  console.log('OTP:', req.body.otp);
  
  try {
    const { email, otp } = req.body;
    
    if (!email || !otp) {
      return res.status(400).json({ success: false, error: 'Email and OTP are required' });
    }
    
    const storedData = emailOtpStore.get(email);
    
    if (!storedData) {
      return res.status(400).json({ success: false, error: 'No verification code found. Please request a new one.' });
    }
    
    if (Date.now() > storedData.expiresAt) {
      emailOtpStore.delete(email);
      return res.status(400).json({ success: false, error: 'Verification code has expired. Please request a new one.' });
    }
    
    if (storedData.attempts >= 5) {
      emailOtpStore.delete(email);
      return res.status(400).json({ success: false, error: 'Too many failed attempts. Please request a new code.' });
    }
    
    if (storedData.otp !== otp) {
      storedData.attempts++;
      emailOtpStore.set(email, storedData);
      console.log(`❌ Invalid OTP. Attempt ${storedData.attempts}/5`);
      return res.status(400).json({ success: false, error: 'Invalid verification code. Please try again.' });
    }
    
    // OTP is valid
    emailOtpStore.delete(email);
    console.log(`✅ Email verified successfully: ${email}`);
    
    res.json({ success: true, message: 'Email verified successfully' });
    
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to verify code' });
  }
});

// ==================== REFUND REQUEST ROUTES ====================

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
      description,
      emailVerified
    } = req.body;
    
    console.log('Extracted data:', {
      fullName,
      email,
      transactionNumber,
      riceType,
      quantityKg,
      amountPaid,
      returnReason,
      description,
      emailVerified
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
    
    // Validate email verification
    if (emailVerified !== 'true') {
      return res.status(400).json({ success: false, error: 'Please verify your email address first' });
    }
    
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

// Get all returns
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
      console.log(`   ID: ${r.returnId}, Name: ${r.fullName}, Email: ${r.email}`);
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

// Process return (approve/reject) - WITH EMAIL NOTIFICATION USING RESEND
router.put('/admin/:returnId/process', protect, admin, async (req, res) => {
  console.log('⚙️ PROCESS RETURN ROUTE HIT - returnId:', req.params.returnId);
  console.log('Request body:', req.body);
  
  try {
    const { returnId } = req.params;
    const { status, adminNotes, processedBy, processedByName } = req.body;
    
    if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Valid status (APPROVED or REJECTED) is required' });
    }
    
    const returnRequest = await Return.findOne({ returnId: returnId });
    
    if (!returnRequest) {
      return res.status(404).json({ success: false, error: 'Return not found' });
    }
    
    console.log(`📋 Processing refund for: ${returnRequest.fullName}`);
    console.log(`   Email: ${returnRequest.email}`);
    console.log(`   Status: ${status}`);
    
    // Update return request
    returnRequest.status = status;
    returnRequest.adminNotes = adminNotes || (status === 'APPROVED' ? 'Refund approved by administrator.' : 'Refund rejected by administrator.');
    returnRequest.processedBy = processedBy || req.user._id;
    returnRequest.processedByName = processedByName || `${req.user.firstName} ${req.user.lastName}`;
    returnRequest.processedAt = new Date();
    
    await returnRequest.save();
    console.log(`✅ Return ${returnId} ${status} successfully`);
    
    // SEND EMAIL USING RESEND
    const customerEmail = returnRequest.email;
    let emailSent = false;
    
    if (customerEmail) {
      try {
        await sendRefundStatusEmail(
          customerEmail,
          returnRequest.fullName,
          returnRequest.returnId,
          returnRequest.transactionId,
          returnRequest.riceType,
          returnRequest.quantityKg,
          returnRequest.amountPaid,
          status,
          returnRequest.adminNotes
        );
        emailSent = true;
        console.log(`✅ ${status} email sent to ${customerEmail}`);
      } catch (emailError) {
        console.error(`❌ Failed to send email to ${customerEmail}:`, emailError.message);
      }
    } else {
      console.error(`❌ No email address found for return ${returnId}`);
    }
    
    if (status === 'APPROVED') {
      await Transaction.findOneAndUpdate(
        { transactionId: returnRequest.transactionId },
        { status: 'REFUNDED' }
      );
    }
    
    // Emit socket event for real-time update
    const io = req.app.get('io');
    if (io) {
      io.emit('return_status_update', {
        returnId: returnRequest.returnId,
        status: returnRequest.status,
        processedAt: returnRequest.processedAt
      });
    }
    
    res.json({
      success: true,
      message: `Refund ${status.toLowerCase()} successfully`,
      data: {
        returnId: returnRequest.returnId,
        status: returnRequest.status,
        emailSent: emailSent,
        emailTo: customerEmail || 'No email on file'
      }
    });
    
  } catch (error) {
    console.error('Error in process return:', error);
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

// Clean up expired OTPs every minute
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [email, data] of emailOtpStore.entries()) {
    if (now > data.expiresAt) {
      emailOtpStore.delete(email);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired email OTPs`);
  }
}, 60000);

export default router;