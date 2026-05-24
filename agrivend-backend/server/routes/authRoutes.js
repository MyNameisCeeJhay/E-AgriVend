import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import nodemailer from 'nodemailer';
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

// Send email function
const sendEmailOTP = async (email, otp, userName) => {
  console.log(`📧 Attempting to send OTP to ${email}...`);
  
  // Check if running in development mode without email
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
    console.log('⚠️ Development mode: Email not configured. Console logging OTP instead.');
    return { messageId: 'dev-mode-no-email' };
  }
  
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

  // Verify connection
  await transporter.verify();
  console.log('✅ Email transporter verified');

  const mailOptions = {
    from: `"AgriVend Support" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset OTP - AgriVend',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #f5f7fa; border-radius: 10px;">
        <h2 style="color: #2d6a4f;">🌾 AgriVend Password Reset</h2>
        <p>Hello <strong>${userName}</strong>,</p>
        <p>You requested to reset your password. Use the OTP below:</p>
        <div style="background: white; padding: 15px; font-size: 32px; font-weight: bold; text-align: center; letter-spacing: 5px; border-radius: 8px; margin: 20px 0;">
          ${otp}
        </div>
        <p>This OTP expires in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p style="font-size: 12px; color: #666;">AgriVend - Solar Powered Grain Vending Machine</p>
      </div>
    `,
    text: `AgriVend Password Reset\n\nHello ${userName},\n\nYour OTP is: ${otp}\n\nThis OTP expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ Email sent to ${email}, Message ID: ${info.messageId}`);
  return info;
};

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

// ===== SEND OTP =====
router.post('/send-otp', async (req, res) => {
  console.log('\n📧 ===== SEND OTP =====');
  console.log('Request body:', req.body);
  
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'Email not found in our system' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 10 * 60 * 1000;
    
    // Store OTP
    otpStore.set(email, { otp, expiresAt, attempts: 0 });
    
    console.log(`✅ OTP generated: ${otp} for ${email}`);
    console.log(`⏰ Expires at: ${new Date(expiresAt).toLocaleString()}`);
    
    // Try to send email
    try {
      await sendEmailOTP(email, otp, `${user.firstName} ${user.lastName}`);
      console.log('✅ Email sent successfully');
      
      res.json({ 
        success: true, 
        message: 'OTP sent to your email address'
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError.message);
      
      // In development, return OTP in response for testing
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️ Development mode: Returning OTP in response');
        return res.json({ 
          success: true, 
          message: 'OTP generated (development mode - check response)',
          devOtp: otp,
          note: 'In production, OTP would be sent to your email'
        });
      }
      
      throw emailError;
    }
    
  } catch (error) {
    console.error('❌ Error in send-otp:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send OTP. Please try again.' 
    });
  }
});

// ===== RESEND OTP =====
router.post('/resend-otp', async (req, res) => {
  console.log('\n🔄 ===== RESEND OTP =====');
  
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
    
    console.log(`✅ New OTP generated: ${otp} for ${email}`);
    
    try {
      await sendEmailOTP(email, otp, `${user.firstName} ${user.lastName}`);
      res.json({ success: true, message: 'New OTP sent to your email address' });
    } catch (emailError) {
      if (process.env.NODE_ENV === 'development') {
        res.json({ success: true, message: 'OTP generated', devOtp: otp });
      } else {
        throw emailError;
      }
    }
    
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to resend OTP' });
  }
});

// ===== RESET PASSWORD =====
router.post('/reset-password', async (req, res) => {
  console.log('\n🔑 ===== RESET PASSWORD =====');
  console.log('Request body:', { ...req.body, newPassword: '***HIDDEN***' });
  
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
    
    // Get stored OTP
    const storedData = otpStore.get(email);
    if (!storedData) {
      return res.status(400).json({ success: false, error: 'No OTP found. Please request a new OTP.' });
    }
    
    console.log(`Stored OTP: ${storedData.otp}, Received OTP: ${otp}`);
    console.log(`OTP matches: ${storedData.otp === otp}`);
    
    // Check expiration
    if (Date.now() > storedData.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, error: 'OTP has expired. Please request a new one.' });
    }
    
    // Check attempts
    if (storedData.attempts >= 5) {
      otpStore.delete(email);
      return res.status(400).json({ success: false, error: 'Too many failed attempts. Please request a new OTP.' });
    }
    
    // Verify OTP
    if (storedData.otp !== otp) {
      storedData.attempts++;
      otpStore.set(email, storedData);
      console.log(`❌ Invalid OTP. Attempt ${storedData.attempts}/5`);
      return res.status(400).json({ success: false, error: 'Invalid OTP. Please try again.' });
    }
    
    // Find user and update password
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Clear OTP
    otpStore.delete(email);
    
    console.log(`✅ Password reset successful for ${email}`);
    
    res.json({ 
      success: true, 
      message: 'Password reset successfully. You can now login with your new password.' 
    });
    
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

// Clean up expired OTPs every minute
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(email);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`🧹 Cleaned up ${cleaned} expired OTPs`);
  }
}, 60000);

export default router;