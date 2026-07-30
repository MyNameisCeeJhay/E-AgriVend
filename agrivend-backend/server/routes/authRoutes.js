import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// ===== TEST ROUTE =====
router.get('/test', (req, res) => {
  console.log('✅ TEST ROUTE HIT!');
  res.json({ 
    success: true, 
    message: 'Auth is working!',
    timestamp: new Date().toISOString()
  });
});

// ===== LOGIN ROUTE =====
router.post('/login', async (req, res) => {
  console.log('🔑 LOGIN ATTEMPT:', req.body.email);
  
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password required' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Password mismatch');
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid credentials' 
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

// ===== REGISTER ROUTE =====
router.post('/register', async (req, res) => {
  console.log('📝 REGISTER ATTEMPT');
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields required' 
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
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
        role: user.role
      }
    });

  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error' 
    });
  }
});

export default router;