import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the backend root (not server folder)
const envPath = path.resolve(__dirname, '../../.env');
console.log('🔍 Loading .env for authRoutes from:', envPath);
dotenv.config({ path: envPath });

// Debug: Check if email variables are loaded
console.log('\n📧 Email Configuration Check:');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? '✓ Set to: ' + process.env.EMAIL_USER : '✗ Not set');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '✓ Set (length: ' + process.env.EMAIL_PASS.length + ')' : '✗ Not set');
console.log('');

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
  
  return {
    isStrong,
    requirements,
    requirementsList
  };
};

console.log('✅ authRoutes loaded\n');

// ===== REGISTER ROUTE =====
router.post('/register', async (req, res) => {
  console.log('📝 POST /api/auth/register - Request received');
  console.log('Request body:', req.body);
  
  try {
    const { email, password, firstName, lastName, phone, address } = req.body;

    if (!email || !password || !firstName || !lastName) {
      console.log('❌ Missing required fields');
      return res.status(400).json({ 
        success: false, 
        error: 'Please provide all required fields' 
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ Email already registered:', email);
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
      role: 'admin'
    });

    await user.save();
    console.log('✅ User saved to database:', user._id);

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    console.log('✅ Registration successful for:', email);

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
    console.error('❌ Registration error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during registration' 
    });
  }
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
        error: 'Invalid email or password' 
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
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
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
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

// ===== SEND OTP FOR PASSWORD RESET =====
router.post('/send-otp', async (req, res) => {
  console.log('📧 POST /api/auth/send-otp - Request received');
  console.log('Email:', req.body.email);
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    // Check email configuration
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.error('❌ Email credentials missing in .env');
      return res.status(503).json({ error: 'Email service not configured. Please contact administrator.' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    
    // Store OTP
    otpStore.set(email, {
      otp,
      expiresAt,
      attempts: 0
    });
    
    console.log(`✅ OTP generated for ${email}: ${otp}`);
    
    // Create transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    // Verify transporter
    await transporter.verify();
    console.log('✅ Email transporter verified');
    
    // Send email
    const mailOptions = {
      from: `"AgriVend" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset OTP - AgriVend',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background: #f8fafc; border-radius: 12px; padding: 30px; text-align: center; }
            .logo { font-size: 24px; font-weight: bold; color: #2d6a4f; margin-bottom: 20px; }
            .otp-code { font-size: 32px; font-weight: bold; color: #2d6a4f; background: #ffffff; padding: 15px; border-radius: 8px; letter-spacing: 5px; margin: 20px 0; border: 1px solid #e2e8f0; }
            .warning { font-size: 12px; color: #64748b; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="logo">AgriVend</div>
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Use the OTP below to proceed:</p>
            <div class="otp-code">${otp}</div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <div class="warning">For security reasons, do not share this OTP with anyone.</div>
          </div>
        </body>
        </html>
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${email}`);
    console.log('Message ID:', info.messageId);
    
    res.json({ 
      success: true, 
      message: 'OTP sent to your email',
      email: email
    });
    
  } catch (error) {
    console.error('❌ Error sending OTP:', error);
    console.error('Error details:', error.message);
    
    let errorMessage = 'Failed to send OTP. ';
    if (error.message.includes('Invalid login') || error.message.includes('Missing credentials')) {
      errorMessage += 'Invalid email credentials. Please check your email configuration.';
    } else if (error.message.includes('getaddrinfo')) {
      errorMessage += 'Network error. Please check your internet connection.';
    } else {
      errorMessage += error.message;
    }
    
    res.status(500).json({ error: errorMessage });
  }
});

// ===== RESET PASSWORD (Combined - Verifies OTP and Resets in One Call) =====
router.post('/reset-password', async (req, res) => {
  console.log('🔑 POST /api/auth/reset-password - Request received');
  console.log('Email:', req.body.email);
  console.log('OTP provided:', req.body.otp);
  
  try {
    const { email, newPassword, otp } = req.body;
    
    if (!email || !newPassword || !otp) {
      console.log('❌ Missing fields');
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Check password strength
    const passwordStrength = checkPasswordStrength(newPassword);
    
    if (!passwordStrength.isStrong) {
      console.log('❌ Password not strong enough');
      return res.status(400).json({ 
        error: 'Password is not strong enough',
        requirements: passwordStrength.requirementsList
      });
    }
    
    // Get stored OTP data
    const storedData = otpStore.get(email);
    
    if (!storedData) {
      console.log('❌ No OTP found for email');
      return res.status(400).json({ error: 'No OTP found. Please request a new OTP.' });
    }
    
    // Check if OTP is expired
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email);
      console.log('❌ OTP expired');
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }
    
    // Check if too many attempts
    if (storedData.attempts >= 5) {
      otpStore.delete(email);
      console.log('❌ Too many attempts');
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }
    
    // Verify OTP
    if (storedData.otp !== otp) {
      storedData.attempts++;
      otpStore.set(email, storedData);
      console.log(`❌ Invalid OTP. Attempts: ${storedData.attempts}`);
      return res.status(400).json({ error: 'Invalid OTP. Please try again.' });
    }
    
    // OTP is valid - find user and update password
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Clear OTP after successful reset
    otpStore.delete(email);
    
    console.log(`✅ Password reset successfully for ${email}`);
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully. You can now login with your new password.'
    });
    
  } catch (error) {
    console.error('❌ Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ===== RESEND OTP =====
router.post('/resend-otp', async (req, res) => {
  console.log('🔄 POST /api/auth/resend-otp - Request received');
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: 'Email not found' });
    }
    
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    
    otpStore.set(email, {
      otp,
      expiresAt,
      attempts: 0
    });
    
    console.log(`✅ New OTP generated for ${email}: ${otp}`);
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });
    
    const mailOptions = {
      from: `"AgriVend" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'New Password Reset OTP - AgriVend',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2d6a4f;">Password Reset OTP</h2>
          <p>Your new OTP for password reset is:</p>
          <div style="font-size: 32px; font-weight: bold; color: #2d6a4f; padding: 20px; background: #f0fdf4; border-radius: 8px; text-align: center; letter-spacing: 5px;">
            ${otp}
          </div>
          <p>This OTP will expire in 10 minutes.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ New OTP email sent to ${email}`);
    
    res.json({ 
      success: true, 
      message: 'New OTP sent to your email'
    });
    
  } catch (error) {
    console.error('❌ Error resending OTP:', error);
    res.status(500).json({ error: 'Failed to resend OTP' });
  }
});

// ===== GET CURRENT USER =====
router.get('/me', async (req, res) => {
  console.log('👤 GET /api/auth/me - Request received');
  
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('✅ User found:', user.email);

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
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;