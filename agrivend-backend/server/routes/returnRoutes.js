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
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('❌ Email credentials not configured');
    return null;
  }
  
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
  console.log(`📧 Attempting to send email to: ${to}`);
  
  if (!to) {
    console.error('❌ No recipient email address provided');
    return { success: false, error: 'No recipient email' };
  }
  
  try {
    const transporter = getTransporter();
    if (!transporter) {
      return { success: false, error: 'Email service not configured' };
    }
    
    const info = await transporter.sendMail({
      from: `"AgriVend Support" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '')
    });
    console.log(`✅ Email sent successfully to ${to}`);
    console.log(`   Message ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
};

// Function to find receipt file in multiple locations
const findReceiptFile = (filename) => {
  // Clean the filename (remove any path parts)
  const cleanFilename = filename.split('/').pop();
  console.log('🔍 Searching for file:', cleanFilename);
  
  const possiblePaths = [
    // Correct path: server/uploads/receipts/
    path.join(__dirname, '..', 'uploads', 'receipts', cleanFilename),
    // Server/uploads/returns/
    path.join(__dirname, '..', 'uploads', 'returns', cleanFilename),
    // Server/uploads/
    path.join(__dirname, '..', 'uploads', cleanFilename),
    // Routes/uploads/receipts/ (wrong path from before)
    path.join(__dirname, 'uploads', 'receipts', cleanFilename),
    path.join(__dirname, 'uploads', 'returns', cleanFilename),
    path.join(__dirname, 'uploads', cleanFilename),
  ];
  
  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      console.log('✅ Found receipt at:', filePath);
      return filePath;
    }
  }
  
  console.log('❌ Receipt not found. Searched paths:');
  possiblePaths.forEach(p => console.log(`   - ${p}`));
  return null;
};

// ===== PUBLIC TEST ROUTES =====
router.get('/ping', (req, res) => {
  console.log('✅ PING ROUTE HIT');
  res.json({ success: true, message: 'Return routes are active' });
});

router.get('/test', (req, res) => {
  console.log('✅ TEST ROUTE HIT');
  res.json({ success: true, message: 'Return test route is working' });
});

// ===== ADMIN ROUTES =====
router.get('/admin/stats', protect, admin, async (req, res) => {
  console.log('📊 ADMIN STATS ROUTE HIT');
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
  console.log('📋 ADMIN ALL ROUTE HIT');
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = status && status !== 'all' ? { status } : {};
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const returns = await Return.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Return.countDocuments(query);

    console.log(`✅ Found ${returns.length} returns (total: ${total})`);
    
    res.json({
      success: true,
      data: returns,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
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
    const returnRequest = await Return.findOne({ returnId: req.params.returnId });

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
    const { status, adminNotes, processedBy, processedByName } = req.body;
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

    console.log(`📋 Processing refund for: ${returnRequest.fullName}`);
    console.log(`   Email from DB: ${returnRequest.email}`);
    console.log(`   Status: ${status}`);

    // Update return request
    returnRequest.status = status;
    returnRequest.adminNotes = adminNotes || (status === 'APPROVED' ? 'Refund approved by administrator.' : 'Refund rejected by administrator.');
    returnRequest.processedBy = processedBy || req.user._id;
    returnRequest.processedByName = processedByName || `${req.user.firstName} ${req.user.lastName}`;
    returnRequest.processedAt = new Date();

    await returnRequest.save();
    console.log(`✅ Return ${returnId} ${status} successfully`);

    // SEND EMAIL TO THE EMAIL FROM DATABASE
    const customerEmail = returnRequest.email;
    
    if (customerEmail) {
      const isApproved = status === 'APPROVED';
      const statusText = isApproved ? 'APPROVED' : 'REJECTED';
      
      console.log(`📧 Preparing to send ${status} email to: ${customerEmail}`);
      
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Refund Request ${statusText}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; }
            .header { background: ${isApproved ? '#4CAF50' : '#f44336'}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px; }
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
              <p>Dear <strong>${returnRequest.fullName}</strong>,</p>
              <p>Your refund request has been <strong>${statusText}</strong>.</p>
              <div class="details">
                <p><strong>Refund ID:</strong> ${returnRequest.returnId}</p>
                <p><strong>Transaction ID:</strong> ${returnRequest.transactionId}</p>
                <p><strong>Product:</strong> ${returnRequest.riceType}</p>
                <p><strong>Quantity:</strong> ${returnRequest.quantityKg} kg</p>
                <p><strong>Amount:</strong> ₱${returnRequest.amountPaid.toFixed(2)}</p>
              </div>
              ${returnRequest.adminNotes ? `<p><strong>Admin Note:</strong> ${returnRequest.adminNotes}</p>` : ''}
              <p>${isApproved ? 'Your refund will be processed within 3-5 business days.' : 'If you have questions, please contact support.'}</p>
              <p>Thank you,<br>AgriVend Team</p>
            </div>
            <div class="footer">
              <p>This is an automated message from AgriVend.</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      // Send email (don't await - fire and forget)
      sendEmail(customerEmail, `Refund ${statusText} - ${returnRequest.returnId}`, emailHtml)
        .then(result => {
          if (result.success) {
            console.log(`✅ ${status} email sent to ${customerEmail}`);
          } else {
            console.error(`❌ Failed to send email to ${customerEmail}: ${result.error}`);
          }
        })
        .catch(err => console.error(`❌ Email error: ${err.message}`));
    } else {
      console.error(`❌ No email address found for return ${returnId}`);
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
        emailSentTo: customerEmail || 'No email on file'
      }
    });
    
  } catch (error) {
    console.error('Error in process return:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== SERVE RECEIPT IMAGE - FIXED =====
router.get('/receipt-image/:filename', protect, admin, async (req, res) => {
  try {
    let { filename } = req.params;
    console.log('📎 Serving receipt from returnRoutes:', filename);
    
    // Clean the filename (remove any path parts)
    filename = filename.split('/').pop();
    
    // Find the file in multiple locations
    const filePath = findReceiptFile(filename);
    
    if (!filePath) {
      return res.status(404).json({ 
        success: false, 
        error: 'Receipt not found. Please check if the file exists.' 
      });
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

    // Try to find the file using the receipt filename
    const filePath = findReceiptFile(returnRequest.receiptFilename);
    
    if (!filePath) {
      return res.status(404).json({ 
        success: false, 
        error: 'Receipt file not found' 
      });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== CUSTOMER ROUTES =====
router.get('/my-returns', protect, async (req, res) => {
  console.log('📋 MY RETURNS ROUTE HIT');
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
  console.log('📝 CREATE RETURN ROUTE HIT');
  try {
    const { transactionId, riceType, quantityKg, amountPaid, returnReason, description } = req.body;

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
    
    console.log(`✅ Return request created for: ${newReturn.fullName} (${newReturn.email})`);
    console.log(`   Receipt filename: ${newReturn.receiptFilename}`);
    console.log(`   Receipt path: ${newReturn.receiptPath}`);

    // Send confirmation email (fire and forget)
    const confirmationHtml = `
      <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
        <div style="background: #FFC107; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px;">
          <h1>Refund Request Received</h1>
        </div>
        <p>Dear <strong>${newReturn.fullName}</strong>,</p>
        <p>Thank you for submitting your refund request.</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Refund ID:</strong> ${newReturn.returnId}</p>
          <p><strong>Transaction ID:</strong> ${newReturn.transactionId}</p>
          <p><strong>Product:</strong> ${newReturn.riceType}</p>
          <p><strong>Quantity:</strong> ${newReturn.quantityKg} kg</p>
          <p><strong>Amount:</strong> ₱${newReturn.amountPaid.toFixed(2)}</p>
        </div>
        <p>We will review your request within 1-2 business days.</p>
        <p>Thank you,<br>AgriVend Team</p>
      </div>
    `;
    
    sendEmail(newReturn.email, `Refund Request Received - ${newReturn.returnId}`, confirmationHtml)
      .catch(err => console.log('Confirmation email error:', err.message));

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
  console.log('🔔 GET /api/returns/unread-updates');
  try {
    const count = await Return.countDocuments({
      user: req.user._id,
      status: { $ne: 'PENDING' },
      seenByCustomer: false
    });

    res.json({ success: true, count });
  } catch (error) {
    console.error('Error fetching unread updates:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Mark return update as seen
router.put('/:returnId/mark-seen', protect, async (req, res) => {
  console.log('👁️ PUT /api/returns/:returnId/mark-seen');
  try {
    const returnReq = await Return.findOne({
      returnId: req.params.returnId,
      user: req.user._id
    });

    if (!returnReq) {
      return res.status(404).json({ success: false, error: 'Return not found' });
    }

    returnReq.seenByCustomer = true;
    await returnReq.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking return as seen:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;