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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
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
  process.exit(1);
}

// Check required variables
const requiredEnvVars = ['PORT', 'MONGODB_URI', 'JWT_SECRET', 'FRONTEND_URL'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Check email configuration (optional but recommended)
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  Email configuration not found. Password reset functionality will not work.');
  console.warn('   To enable password reset, add EMAIL_USER and EMAIL_PASS to .env file');
}

console.log('✅ All required environment variables found\n');

// ===== IMPORT ALL ROUTES =====
import authRoutes from './routes/authRoutes.js';
import termsRoutes from './routes/termsRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import returnRoutes from './routes/returnRoutes.js';
import ratingRoutes from './routes/ratingRoutes.js';
import messageRoutes from './routes/messageRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import machineRatingRoutes from './routes/machineRatingRoutes.js';
import esp32Routes from './routes/esp32Routes.js';
import refundRoutes from './routes/refundRoutes.js';
import machineRoutes from './routes/machineRoutes.js';


// Initialize express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: [process.env.FRONTEND_URL, 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true
  }
});

app.set('io', io);

io.on('connection', (socket) => {
  console.log('🟢 New client connected:', socket.id);
  
  // Join user-specific room for private notifications
  socket.on('join_user_room', (userId) => {
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  // Handle refund submission
  socket.on('refund_submitted', (data) => {
    io.emit('new_refund_notification', data);
  });

  socket.on('disconnect', () => {
    console.log('🔴 Client disconnected:', socket.id);
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:3000'],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ===== REGISTER ALL ROUTES =====
console.log('\n📌 Registering routes:');
console.log('   /api/auth → authRoutes (includes password reset endpoints)');
console.log('   /api/terms → termsRoutes');
console.log('   /api/transactions → transactionRoutes');
console.log('   /api/returns → returnRoutes');
console.log('   /api/ratings → ratingRoutes');
console.log('   /api/ratings/machine → machineRatingRoutes');
console.log('   /api/messages → messageRoutes');
console.log('   /api/admin → adminRoutes');
console.log('   /api/esp32 → esp32Routes (ESP32 Monitoring)');
console.log('   /api/refund → refundRoutes (Refund Request System)');
console.log('   /api/machine → machineRoutes (Machine Monitoring)');


app.use('/api/auth', authRoutes);
app.use('/api/terms', termsRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/ratings', ratingRoutes);
app.use('/api/ratings/machine', machineRatingRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/esp32', esp32Routes);
app.use('/api/refund', refundRoutes);
app.use('/api/machine', machineRoutes);


// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is working',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AgriVend API is running',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    routes: {
      auth: '/api/auth',
      terms: '/api/terms',
      transactions: '/api/transactions',
      returns: '/api/returns',
      ratings: '/api/ratings',
      machineRatings: '/api/ratings/machine',
      messages: '/api/messages',
      admin: '/api/admin',
      esp32: '/api/esp32',
      refund: '/api/refund',
      machine: '/api/machine',
      passwordReset: {
        sendOTP: '/api/auth/send-otp',
        verifyOTP: '/api/auth/verify-otp',
        resetPassword: '/api/auth/reset-password',
        resendOTP: '/api/auth/resend-otp'
      }
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.originalUrl}`);
  res.status(404).json({ 
    success: false,
    error: `Route ${req.originalUrl} not found` 
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ 
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log('\n=================================');
  console.log(`✅ SERVER STARTED SUCCESSFULLY!`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`🌐 Frontend: ${process.env.FRONTEND_URL}`);
  console.log(`📦 MongoDB: Connected`);
  console.log(`📧 Email Service: ${process.env.EMAIL_USER ? 'Configured ✅' : 'Not Configured ⚠️'}`);
  console.log('=================================\n');
  console.log('📡 Available endpoints:');
  console.log(`   GET  /api/health - Health check with system status`);
  console.log(`   GET  /api/test - Test endpoint`);
  console.log(`\n🔐 Authentication: /api/auth`);
  console.log(`   POST /api/auth/register - Register new user`);
  console.log(`   POST /api/auth/login - Login user`);
  console.log(`   GET  /api/auth/me - Get current user`);
  console.log(`   POST /api/auth/send-otp - Send OTP for password reset`);
  console.log(`   POST /api/auth/verify-otp - Verify OTP`);
  console.log(`   POST /api/auth/reset-password - Reset password with OTP`);
  console.log(`   POST /api/auth/resend-otp - Resend OTP`);
  console.log(`\n📄 Terms: /api/terms`);
  console.log(`   GET /api/terms/current - Get current terms`);
  console.log(`\n💰 Transactions: /api/transactions`);
  console.log(`   GET /api/transactions - Get user transactions`);
  console.log(`   POST /api/transactions - Create transaction`);
  console.log(`\n↩️ Returns: /api/returns`);
  console.log(`   GET /api/returns - Get user returns`);
  console.log(`   POST /api/returns - Create return request`);
  console.log(`\n⭐ Ratings: /api/ratings`);
  console.log(`   GET /api/ratings - Get user ratings`);
  console.log(`   POST /api/ratings - Create rating`);
  console.log(`\n🤖 Machine Ratings: /api/ratings/machine`);
  console.log(`   GET /api/ratings/machine - Get machine ratings`);
  console.log(`   POST /api/ratings/machine - Create machine rating`);
  console.log(`   POST /api/ratings/machine/:id/reply - Reply to rating (admin)`);
  console.log(`\n💬 Messages: /api/messages`);
  console.log(`   GET /api/messages/my-messages - Get user messages`);
  console.log(`   POST /api/messages - Create message`);
  console.log(`   POST /api/messages/:id/reply - Reply to message (admin)`);
  console.log(`\n👑 Admin: /api/admin`);
  console.log(`   GET /api/admin/dashboard - Admin dashboard stats`);
  console.log(`   GET /api/admin/users - Get all users (with pagination)`);
  console.log(`   POST /api/admin/users - Create new admin user`);
  console.log(`   GET /api/admin/users/:userId - Get single user details`);
  console.log(`   PUT /api/admin/users/:userId - Update user`);
  console.log(`   DELETE /api/admin/users/:userId - Delete user`);
  console.log(`   PATCH /api/admin/users/:userId/toggle-status - Activate/deactivate user`);
  console.log(`   POST /api/admin/users/:userId/reset-password - Reset user password`);
  console.log(`   POST /api/admin/users/bulk/delete - Bulk delete users`);
  console.log(`   POST /api/admin/users/bulk/status - Bulk update user status`);
  console.log(`   GET /api/admin/transactions - Get all transactions`);
  console.log(`   GET /api/admin/returns - Get all return requests`);
  console.log(`   PUT /api/admin/returns/:id/process - Process return request`);
  console.log(`   GET /api/admin/messages - Get all support messages`);
  console.log(`   GET /api/admin/ratings - Get all ratings`);
  console.log(`\n🤖 ESP32 MONITORING: /api/esp32`);
  console.log(`   POST /api/esp32/sensors/update - ESP32 sends sensor data`);
  console.log(`   POST /api/esp32/transaction/confirm - ESP32 confirms transaction`);
  console.log(`   POST /api/esp32/security/alert - ESP32 sends security alert`);
  console.log(`   GET  /api/esp32/machine/status - Get machine status (admin)`);
  console.log(`   GET  /api/esp32/sensors/history - Get sensor history (admin)`);
  console.log(`\n💰 REFUND SYSTEM: /api/refund`);
  console.log(`   GET  /api/refund/validate/:transactionId - Validate transaction`);
  console.log(`   POST /api/refund/request - Submit refund request`);
  console.log(`   GET  /api/refund/status/:transactionId - Check refund status`);
  console.log(`   GET  /api/refund/:refundId - Get refund by ID`);
  console.log(`   GET  /api/refund/admin/all - Get all refunds (admin)`);
  console.log(`   GET  /api/refund/admin/pending - Get pending refunds (admin)`);
  console.log(`   PUT  /api/refund/admin/:refundId/process - Process refund (admin)`);
  console.log(`   GET  /api/refund/admin/stats/summary - Get refund stats (admin)`);
  console.log(`\n🤖 MACHINE MONITORING: /api/machine`);
  console.log(`   GET  /api/machine/data - Get current machine data`);
  console.log(`   POST /api/machine/update - Update machine data`);
  console.log(`   POST /api/machine/refill - Refill storage (admin)`);
  console.log(`   PUT  /api/machine/product/:storageId - Update product price`);
  console.log(`   GET  /api/machine/history - Get sensor history`);
  console.log(`   GET  /api/machine/stats - Get machine statistics`);
  console.log(`\n📦 PRODUCT MANAGEMENT: /api/products`);
  console.log(`   GET  /api/products - Get all products`);
  console.log(`   GET  /api/products/:id - Get single product`);
  console.log(`   POST /api/products - Create product`);
  console.log(`   PUT  /api/products/:id - Update product`);
  console.log(`   DELETE /api/products/:id - Delete product`);
  console.log(`   PATCH /api/products/:id/archive - Archive product`);
  console.log(`   PATCH /api/products/:id/restore - Restore product`);
  console.log(`   GET  /api/products/categories/list - Get categories`);
  console.log('=================================\n');
  console.log('💡 Password Reset Flow:');
  console.log('   1. POST /api/auth/send-otp → Send OTP to email');
  console.log('   2. POST /api/auth/verify-otp → Verify OTP');
  console.log('   3. POST /api/auth/reset-password → Reset password with verified OTP');
  console.log('=================================\n');
  console.log('🤖 MACHINE MONITORING SUMMARY:');
  console.log('   ✅ 2 Storage Units (20kg each with Load Cell)');
  console.log('   ✅ Real-time Weight Monitoring');
  console.log('   ✅ Battery Percentage & Voltage');
  console.log('   ✅ Product Price Management');
  console.log('   ✅ Refill Storage Functionality');
  console.log('   ✅ Socket.io Real-time Updates');
  console.log('=================================\n');
  console.log('💰 REFUND SYSTEM SUMMARY:');
  console.log('   ✅ QR Code Scanning Support');
  console.log('   ✅ Transaction Validation');
  console.log('   ✅ 4-Hour Refund Window');
  console.log('   ✅ Receipt Image Upload');
  console.log('   ✅ Admin Approval/Rejection');
  console.log('   ✅ Real-time Notifications');
  console.log('=================================\n');
});