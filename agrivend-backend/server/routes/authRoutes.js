import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { Resend } from 'resend';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

console.log('\n📧 Email Configuration:');
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✓ Set' : '✗ Not set');
console.log('RESEND_FROM_EMAIL:', process.env.RESEND_FROM_EMAIL || '✗ Not set');

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
  if (!requirements.hasSpecialChar) requirementsList.push('At least one special character');
  
  return { isStrong, requirementsList };
};

// Send email using Resend API
const sendEmailOTP = async (email, otp, userName) => {
  console.log(`📧 Sending OTP to ${email} via Resend...`);
  
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
      to: [email],
      subject: 'Password Reset OTP - AgriVend',
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
            <h2>Password Reset Request</h2>
            <p>Hello <strong>${userName}</strong>,</p>
            <p>You requested to reset your password. Use the OTP below:</p>
            <div class="otp-code">${otp}</div>
            <p>This OTP expires in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <div class="footer">
              <p>AgriVend - Solar Powered Grain Vending Machine</p>
              <p>Loma De Gato, Marilao, Bulacan</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `AgriVend Password Reset\n\nHello ${userName},\n\nYour OTP is: ${otp}\n\nThis OTP expires in 10 minutes.\n\nIf you didn't request this, please ignore this email.`
    });
    
    if (error) {
      console.error('Resend error:', error);
      throw new Error(error.message);
    }
    
    console.log(`✅ Email sent via Resend, ID: ${data?.id}`);
    return data;
  } catch (error) {
    console.error('Failed to send email:', error.message);
    throw error;
  }
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

// ===== SEND OTP ROUTE =====
router.post('/send-otp', async (req, res) => {
  console.log('\n📧 ===== SEND OTP =====');
  console.log('Email:', req.body.email);
  
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
    
    // Send email via Resend
    await sendEmailOTP(email, otp, `${user.firstName} ${user.lastName}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent to your email address. Please check your inbox and spam folder.'
    });
    
  } catch (error) {
    console.error('❌ Error sending OTP:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send OTP. Please try again.' 
    });
  }
});

// ===== RESEND OTP ROUTE =====
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
    
    await sendEmailOTP(email, otp, `${user.firstName} ${user.lastName}`);
    
    res.json({ success: true, message: 'New OTP sent to your email address' });
    
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to resend OTP' });
  }
});

// ===== RESET PASSWORD ROUTE =====
router.post('/reset-password', async (req, res) => {
  console.log('\n🔑 ===== RESET PASSWORD =====');
  
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
    
    console.log(`✅ Password reset successful for ${email}`);
    
    res.json({ success: true, message: 'Password reset successfully!' });
    
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
  for (const [email, data] of otpStore.entries()) {
    if (now > data.expiresAt) {
      otpStore.delete(email);
      console.log(`🗑️ Cleaned up expired OTP for ${email}`);
    }
  }
}, 60000);

export default router;