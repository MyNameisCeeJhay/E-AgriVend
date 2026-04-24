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

// Load environment variables based on environment
const isProduction = process.env.NODE_ENV === 'production';


// ✅ CORS must come FIRST before routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// your routes below...
app.use('/admin', adminRoutes);

if (!isProduction) {
  // Development: Load .env from parent directory (since server.js is in /server folder)
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

// Check required variables (PORT is optional in production - Render provides it)
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '));
  if (!isProduction) process.exit(1);
}

// Set default PORT for production if not set
if (!process.env.PORT && isProduction) {
  process.env.PORT = 10000;
  console.log('⚠️  PORT not set, using default:', process.env.PORT);
}

// Check optional configurations
if (!process.env.FRONTEND_URL && isProduction) {
  console.warn('⚠️  FRONTEND_URL not set. CORS might not work correctly.');
  console.warn('   Make sure to set FRONTEND_URL in Render environment variables');
}

if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn('⚠️  Email configuration not found. Password reset functionality will not work.');
  if (!isProduction) {
    console.warn('   To enable password reset, add EMAIL_USER and EMAIL_PASS to .env file');
  }
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

// Initialize express
const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL ? [process.env.FRONTEND_URL, 'http://localhost:3000'] : '*',
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],  // Allow both
  allowEIO3: true
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
  .then(() => console.log('✅ MongoDB Connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Configure CORS
const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL, 'http://localhost:3000']
  : ['http://localhost:3000'];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Create uploads directory if it doesn't exist (for production)
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('📁 Created uploads directory');
}

// Serve static files
app.use('/uploads', express.static(uploadsDir));

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

// Test route
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'API is working',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'AgriVend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    emailConfigured: !!(process.env.EMAIL_USER && process.env.EMAIL_PASS),
    frontendUrl: process.env.FRONTEND_URL || 'not set'
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

// Get all refund requests (Admin only - add auth middleware)
app.get('/api/admin/refunds', async (req, res) => {
  try {
    const refunds = await db.collection('refunds')
      .orderBy('createdAt', 'desc')
      .get();
    
    const refundList = [];
    refunds.forEach(doc => {
      refundList.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    const stats = {
      total: refundList.length,
      pending: refundList.filter(r => r.status === 'pending').length,
      approved: refundList.filter(r => r.status === 'approved').length,
      rejected: refundList.filter(r => r.status === 'rejected').length
    };
    
    res.json({ success: true, refunds: refundList, stats });
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update refund status (Approve/Reject)
app.put('/api/admin/refunds/:id', async (req, res) => {
  const { id } = req.params;
  const { status, adminNotes } = req.body;
  
  try {
    await db.collection('refunds').doc(id).update({
      status: status, // 'approved' or 'rejected'
      adminNotes: adminNotes || '',
      processedAt: new Date(),
      processedBy: req.user?.email || 'admin'
    });
    
    res.json({ success: true, message: `Refund ${status} successfully` });
  } catch (error) {
    console.error('Error updating refund:', error);
    res.status(500).json({ error: error.message });
  }
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
  console.log(`📧 Email Service: ${process.env.EMAIL_USER ? 'Configured ✅' : 'Not Configured ⚠️'}`);
  console.log('=================================\n');
});