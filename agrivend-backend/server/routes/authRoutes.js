import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

const router = express.Router();

// Store OTPs temporarily
const otpStore = new Map();

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Check password strength
const checkPasswordStrength = (password) => {
  const requirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
  };
  
  const isStrong = Object.values(requirements).every(Boolean);
  const requirementsList = [];
  if (!requirements.minLength) requirementsList.push('At least 8 characters');
  if (!requirements.hasUpperCase) requirementsList.push('At least one uppercase letter');
  if (!requirements.hasLowerCase) requirementsList.push('At least one lowercase letter');
  if (!requirements.hasNumbers) requirementsList.push('At least one number');
  if (!requirements.hasSpecialChar) requirementsList.push('At least one special character (!@#$%^&*)');
  
  return { isStrong, requirements, requirementsList };
};

// ===== REGISTER ROUTE =====
router.post('/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, address, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'Please provide all required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Email already registered' });
    }

    const userRole = role === 'staff' ? 'staff' : 'admin';

    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone: phone || '',
      address: address || '',
      role: userRole
    });

    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
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
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Server error during registration' });
  }
});

// ===== LOGIN ROUTE =====
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please provide email and password' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, error: 'Account is deactivated' });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

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
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Server error during login' });
  }
});

// ===== CREATE STAFF ACCOUNT =====
router.post('/create-staff', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, address } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ success: false, error: 'Please provide all required fields' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      existingUser.role = 'staff';
      existingUser.isActive = true;
      await existingUser.save();
      return res.json({ success: true, message: 'User updated to staff role' });
    }

    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phone: phone || '',
      address: address || '',
      role: 'staff',
      termsAccepted: true,
      isActive: true
    });

    await user.save();

    res.status(201).json({ success: true, message: 'Staff account created successfully' });

  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// SEND OTP - Simplified version
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    
    otpStore.set(email, { otp, expiresAt, attempts: 0 });
    
    console.log(`✅ OTP for ${email}: ${otp}`);
    
    // Return OTP directly
    res.json({ 
      success: true, 
      message: 'OTP generated',
      otp: otp
    });
    
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate OTP' });
  }
});

// ===== RESEND OTP =====
router.post('/resend-otp', async (req, res) => {
  console.log('🔄 Resend OTP request for:', req.body.email);
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Email not found' });
    }
    
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    
    otpStore.set(email, { otp, expiresAt, attempts: 0 });
    
    console.log(`✅ New OTP for ${email}: ${otp}`);
    
    res.json({ success: true, message: 'New OTP generated', otp: otp });
    
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to resend OTP' });
  }
});

// ===== RESET PASSWORD =====
router.post('/reset-password', async (req, res) => {
  console.log('🔑 Reset password request for:', req.body.email);
  
  try {
    const { email, newPassword, otp } = req.body;
    
    if (!email || !newPassword || !otp) {
      return res.status(400).json({ success: false, error: 'All fields are required' });
    }
    
    // Check password strength
    const passwordStrength = checkPasswordStrength(newPassword);
    if (!passwordStrength.isStrong) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password is not strong enough',
        requirements: passwordStrength.requirementsList
      });
    }
    
    const storedData = otpStore.get(email);
    if (!storedData) {
      return res.status(400).json({ success: false, error: 'No OTP found. Please request a new OTP.' });
    }
    
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new one.' });
    }
    
    if (storedData.attempts >= 5) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, error: 'Too many failed attempts. Please request a new OTP.' });
    }
    
    if (storedData.otp !== otp) {
      storedData.attempts++;
      otpStore.set(email, storedData);
      return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    user.password = newPassword;
    await user.save();
    
    otpStore.delete(email);
    
    console.log(`✅ Password reset successfully for ${email}`);
    
    res.json({ success: true, message: 'Password reset successfully. You can now login with your new password.' });
    
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

// ===== GET CURRENT USER =====
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
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
    console.error('Auth error:', error);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

export default router;