import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables based on environment
const isProduction = process.env.NODE_ENV === 'production';

if (!isProduction) {
  const envPath = path.resolve(__dirname, '../.env');
  console.log('🔍 Loading .env from:', envPath);

  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.error('❌ Error loading .env:', result.error.message);
      process.exit(1);
    }
    console.log('✅ .env loaded successfully');
  } else {
    console.error('❌ .env file not found at:', envPath);
    console.log('💡 Make sure .env file exists in the project root');
    process.exit(1);
  }
} else {
  console.log('🚀 Running in production mode on Render');
  console.log('📋 Using environment variables from Render dashboard');
}

// Check required variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  if (!isProduction) process.exit(1);
}

if (!process.env.PORT && isProduction) {
  process.env.PORT = 10000;
  console.log('⚠️  PORT not set, using default:', process.env.PORT);
}

if (!process.env.FRONTEND_URL && isProduction) {
  console.warn('⚠️  FRONTEND_URL not set. CORS might not work correctly.');
  console.warn('   Make sure to set FRONTEND_URL in Render environment variables');
}

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  Email configuration not found. Email notifications will not work.');
  console.warn('   To enable email notifications, add EMAIL_USER and EMAIL_PASS to .env file');
  console.warn('   For Gmail: Use App Password (https://myaccount.google.com/apppasswords)');
} else {
  console.log('✅ Email configuration found - Email notifications enabled');
}

console.log('✅ Environment check completed\n');

// ===== IMPORT ALL ROUTES =====
import authRoutes from './routes/authRoutes.js';
import termsRoutes from './routes/termsRoutes.js';
import sensorRoutes from './routes/sensorRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import machineRatingRoutes from './routes/machineRatingRoutes.js';
import esp32Routes from './routes/esp32Routes.js';
import refundRoutes from './routes/refundRoutes.js';
import machineRoutes from './routes/machineRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import User from './models/User.js';
import productRoutes from './routes/productRoutes.js';

// Initialize express
const app = express();
const server = http.createServer(app);

// ===== CORS CONFIGURATION =====
const allowedOrigins = [
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];

const localhostRegex = /^http:\/\/localhost(:\d+)?$/;

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (localhostRegex.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
    return callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin || localhostRegex.test(origin) || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed`));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('🟢 New client connected:', socket.id);

  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected successfully');
    createDefaultStaffAccounts();
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ===== MIDDLEWARE =====
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// ============================================
// CREATE UPLOADS DIRECTORIES
// ============================================
const uploadsDir = path.join(__dirname, 'uploads');
const refundReceiptsDir = path.join(__dirname, 'uploads/refund-receipts');
const returnsDir = path.join(__dirname, 'uploads/returns');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}
if (!fs.existsSync(refundReceiptsDir)) {
  fs.mkdirSync(refundReceiptsDir, { recursive: true });
  console.log('📁 Created refund-receipts directory');
}
if (!fs.existsSync(returnsDir)) {
  fs.mkdirSync(returnsDir, { recursive: true });
  console.log('📁 Created returns directory');
}

app.use('/uploads', express.static(uploadsDir));

console.log('📁 Upload directories ready:');
console.log(`   - ${uploadsDir}`);
console.log(`   - ${refundReceiptsDir}`);
console.log(`   - ${returnsDir}`);

// ===== REGISTER ALL ROUTES =====
console.log('\n📌 Registering routes:');
console.log('   /api/auth → authRoutes');
console.log('   /api/terms → termsRoutes');
console.log('   /api/sensors → sensorRoutes');
console.log('   /api/transactions → transactionRoutes');
console.log('   /api/returns → returnRoutes');
console.log('   /api/ratings → ratingRoutes');
console.log('   /api/ratings/machine → machineRatingRoutes');
console.log('   /api/messages → messageRoutes');
console.log('   /api/admin → adminRoutes');
console.log('   /api/esp32 → esp32Routes');
console.log('   /api/refund → refundRoutes');
console.log('   /api/machine → machineRoutes');
console.log('   /api/staff → staffRoutes');
console.log('   /api/products → productRoutes');

app.use('/api/auth', authRoutes);
app.use('/api/terms', termsRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/ratings/machine', machineRatingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/esp32', esp32Routes);
app.use('/api/refund', refundRoutes);
app.use('/api/machine', machineRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/products', productRoutes);

// ============================================
// DIRECT EMAIL TEST ENDPOINT (NO DEPENDENCIES)
// ============================================
app.post('/api/test-email-direct', async (req, res) => {
  console.log('\n🔧 ===== DIRECT EMAIL TEST =====');
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ success: false, error: 'Email address required' });
  }
  
  console.log(`   Sending to: ${email}`);
  console.log(`   From: ${process.env.EMAIL_USER}`);
  
  try {
    // Create transporter directly
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    const mailOptions = {
      from: `"AgriVend" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Test Email from AgriVend',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <div style="background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px;">
            <h1 style="margin: 0;">Test Email</h1>
          </div>
          <p>Dear Customer,</p>
          <p>If you receive this email, your email system is working correctly!</p>
          <p><strong>Time sent:</strong> ${new Date().toLocaleString()}</p>
          <p>This is a test email from AgriVend Smart Vending System.</p>
          <hr style="margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">This is an automated test message.</p>
        </div>
      `,
      text: `Test Email from AgriVend\n\nIf you receive this email, your email system is working correctly!\n\nTime sent: ${new Date().toLocaleString()}\n\nThis is a test email from AgriVend Smart Vending System.`
    };
    
    console.log('📧 Sending test email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Test email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    console.log(`   Response: ${info.response}`);
    
    res.json({ 
      success: true, 
      message: 'Test email sent successfully! Please check your inbox/spam folder.',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('❌ Test email failed:', error.message);
    console.error('   Error code:', error.code);
    res.status(500).json({ 
      success: false, 
      error: error.message,
      code: error.code
    });
  }
});

// ============================================
// SIMPLE REFUND EMAIL TEST
// ============================================
app.post('/api/test-refund-email', async (req, res) => {
  console.log('\n🔧 ===== TEST REFUND EMAIL =====');
  const { email, name } = req.body;
  
  const testEmail = email || 'test@example.com';
  const testName = name || 'Test Customer';
  
  console.log(`   Sending to: ${testEmail}`);
  console.log(`   Name: ${testName}`);
  
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
    
    const isApproved = true;
    const statusText = 'APPROVED';
    
    const mailOptions = {
      from: `"AgriVend Support" <${process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: `Refund Request ${statusText} - TEST-001`,
      html: `
        <div style="font-family: Arial; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <div style="background: ${isApproved ? '#4CAF50' : '#f44336'}; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; margin: -20px -20px 20px -20px;">
            <h1 style="margin: 0;">Refund ${statusText}</h1>
          </div>
          <p>Dear <strong>${testName}</strong>,</p>
          <p>Your refund request has been <strong>${statusText}</strong>.</p>
          <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p><strong>Refund ID:</strong> TEST-001</p>
            <p><strong>Transaction ID:</strong> TXN-TEST-123</p>
            <p><strong>Product:</strong> Premium Rice</p>
            <p><strong>Quantity:</strong> 2 kg</p>
            <p><strong>Amount:</strong> ₱150.00</p>
          </div>
          <p>This is a test email to verify refund notifications are working.</p>
          <p>Thank you,<br>AgriVend Team</p>
        </div>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Test refund email sent successfully!');
    console.log(`   Message ID: ${info.messageId}`);
    
    res.json({ 
      success: true, 
      message: 'Test refund email sent successfully!',
      messageId: info.messageId
    });
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== CREATE DEFAULT STAFF ACCOUNTS =====
const createDefaultStaffAccounts = async () => {
  try {
    console.log('\n👥 Checking for staff accounts...');
    
    const staffAccounts = [
      {
        email: 'staff@agrivend.com',
        password: 'staff123',
        firstName: 'John',
        lastName: 'Doe',
        phone: '09123456789',
        address: 'Staff Office, Marilao, Bulacan'
      },
      {
        email: 'maria@agrivend.com',
        password: 'staff123',
        firstName: 'Maria',
        lastName: 'Santos',
        phone: '09123456780',
        address: 'Staff Office 2, Marilao, Bulacan'
      }
    ];
    
    for (const staffData of staffAccounts) {
      const existingStaff = await User.findOne({ email: staffData.email });
      
      if (!existingStaff) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(staffData.password, salt);
        
        const staff = new User({
          ...staffData,
          password: hashedPassword,
          role: 'staff',
          termsAccepted: true,
          isActive: true
        });
        
        await staff.save();
        console.log(`✅ Staff account created: ${staffData.email} / ${staffData.password}`);
      } else if (existingStaff.role !== 'staff') {
        existingStaff.role = 'staff';
        existingStaff.isActive = true;
        await existingStaff.save();
        console.log(`✅ User updated to staff: ${staffData.email}`);
      } else {
        console.log(`⚠️ Staff account already exists: ${staffData.email}`);
      }
    }
  } catch (error) {
    console.error('❌ Error creating staff accounts:', error.message);
  }
};

// ===== STAFF ACCOUNT CREATION ENDPOINT =====
app.post('/api/auth/create-staff', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, address } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User already exists' });
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const staff = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || '',
      address: address || '',
      role: 'staff',
      termsAccepted: true,
      isActive: true
    });
    
    await staff.save();
    
    console.log(`✅ Staff account created via API: ${email}`);
    
    res.json({ 
      success: true, 
      message: 'Staff account created successfully',
      user: {
        email: staff.email,
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: staff.role
      }
    });
  } catch (error) {
    console.error('❌ Error creating staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== STORE MANAGEMENT API =====
app.get('/api/store/settings', async (req, res) => {
  try {
    const StoreSettings = mongoose.model('StoreSettings');
    let settings = await StoreSettings.findOne();
    if (!settings) {
      settings = { name: 'AgriVend', address: 'Loma De Gato, Marilao, Bulacan', phone: '09123456789', email: 'support@agrivend.com' };
    }
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.put('/api/store/settings', async (req, res) => {
  try {
    const StoreSettings = mongoose.model('StoreSettings');
    const settings = await StoreSettings.findOneAndUpdate(
      {},
      req.body,
      { upsert: true, new: true }
    );
    res.json({ success: true, data: settings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===== REFUND ADMIN ROUTES =====
app.get('/api/admin/refunds', async (req, res) => {
  try {
    const RefundRequest = mongoose.model('RefundRequest');
    const refunds = await RefundRequest.find().sort({ createdAt: -1 });
    
    const stats = {
      total: refunds.length,
      pending: refunds.filter(r => r.status === 'PENDING').length,
      approved: refunds.filter(r => r.status === 'APPROVED').length,
      rejected: refunds.filter(r => r.status === 'REJECTED').length
    };
    
    res.json({ success: true, refunds, stats });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/admin/refunds/:id', async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;
  
  try {
    const RefundRequest = mongoose.model('RefundRequest');
    const refund = await RefundRequest.findById(id);
    
    if (!refund) {
      return res.status(404).json({ success: false, error: 'Refund not found' });
    }
    
    refund.status = status;
    refund.adminNotes = adminNotes || '';
    refund.processedAt = new Date();
    refund.processedBy = req.headers['x-user-email'] || 'admin';
    
    await refund.save();
    
    res.json({ success: true, message: `Refund ${status} successfully` });
  } catch (error) {
    console.error('Error updating refund:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/refunds/stats', async (req, res) => {
  try {
    const RefundRequest = mongoose.model('RefundRequest');
    const refunds = await RefundRequest.find();
    
    const stats = {
      total: refunds.length,
      pending: refunds.filter(r => r.status === 'PENDING').length,
      approved: refunds.filter(r => r.status === 'APPROVED').length,
      rejected: refunds.filter(r => r.status === 'REJECTED').length
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching refund stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== TEST ROUTES =====
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS)
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AgriVend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    emailUser: process.env.EMAIL_USER ? process.env.EMAIL_USER.split('@')[0] + '@***' : 'not set',
    frontendUrl: process.env.FRONTEND_URL || 'not set',
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('\n=================================');
  console.log(`✅ SERVER STARTED SUCCESSFULLY!`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV}`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL || 'Not set'}`);
  console.log(`📦 MongoDB: Connected`);
  console.log(`🔒 CORS: All localhost ports allowed + Flutter mobile`);
  console.log(`📧 Email Service: ${process.env.EMAIL_USER ? 'Configured ✅' : 'Not Configured ⚠️'}`);
  if (process.env.EMAIL_USER) {
    console.log(`   Email Account: ${process.env.EMAIL_USER}`);
    console.log(`   Test Endpoints:`);
    console.log(`     POST /api/test-email-direct`);
    console.log(`     POST /api/test-refund-email`);
  }
  console.log('=================================\n');
  console.log('📝 Login Credentials:');
  console.log('   Admin: admin@agrivend.com / admin123');
  console.log('   Staff: staff@agrivend.com / staff123');
  console.log('   Staff: maria@agrivend.com / staff123');
  console.log('   Customer: customer@test.com / customer123');
  console.log('=================================\n');
});

export default app;