import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// ===== TEST ROUTE (Add this to verify routes are loading) =====
router.get('/test', (req, res) => {
  console.log('✅ AUTH TEST ROUTE HIT!');
  res.json({ 
    success: true, 
    message: 'Auth routes are working!',
    timestamp: new Date().toISOString()
  });
});

// ===== LOGIN ROUTE =====
router.post('/login', async (req, res) => {
  console.log('🔑 POST /api/auth/login - Request received');
  console.log('Email:', req.body.email);
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide email and password' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Password mismatch for:', email);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ 
        success: false, 
        error: 'Account is deactivated' 
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    console.log('✅ Login successful for:', email);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during login' 
    });
  }
});

// ===== REGISTER ROUTE =====
router.post('/register', async (req, res) => {
  console.log('📝 POST /api/auth/register - Request received');
  
  try {
    const { email, password, firstName, lastName, phone, address } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields are required' 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email already registered' 
      });
    }

    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone: phone || '',
      address: address || '',
      role: 'customer'
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during registration' 
    });
  }
});

// ===== GET CURRENT USER =====
router.get('/me', async (req, res) => {
  console.log('👤 GET /api/auth/me - Request received');
  
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        address: user.address,
        role: user.role,
        termsAccepted: user.termsAccepted,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
});

export default router;  // ← MUST BE AT THE END