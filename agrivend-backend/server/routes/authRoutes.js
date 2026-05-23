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

console.log('\n📧 Email Configuration:');
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
  
  return { isStrong, requirements, requirementsList };
};

// Send email function
const sendEmailOTP = async (email, otp, userName) => {
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
    from: `"AgriVend Support" <${process.env.EMAIL_USER}>`,
    to: email,
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
          <p>You requested to reset your password. Use the OTP below to proceed:</p>
          <div class="otp-code">${otp}</div>
          <p>This OTP will expire in <strong>10 minutes</strong>.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <div class="footer">
            <p>AgriVend - Solar Powered Grain Vending Machine</p>
            <p>Loma De Gato, Marilao, Bulacan</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
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

// ===== SEND OTP VIA EMAIL =====
router.post('/send-otp', async (req, res) => {
  console.log('📧 Sending OTP to:', req.body.email);
  
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
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    
    // Store OTP
    otpStore.set(email, { otp, expiresAt, attempts: 0 });
    
    console.log(`✅ OTP generated for ${email}: ${otp}`);
    
    // Send email with OTP
    await sendEmailOTP(email, otp, `${user.firstName} ${user.lastName}`);
    console.log(`✅ Email sent to ${email}`);
    
    // Return success WITHOUT OTP in response
    res.json({ 
      success: true, 
      message: 'OTP sent to your email address'
    });
    
  } catch (error) {
    console.error('❌ Error sending OTP:', error.message);
    
    if (error.message.includes('Invalid login') || error.message.includes('Username and Password not accepted')) {
      res.status(503).json({ 
        success: false, 
        error: 'Email authentication failed. Please contact support.' 
      });
    } else {
      res.status(500).json({ success: false, error: 'Failed to send OTP. Please try again.' });
    }
  }
});

// ===== RESEND OTP VIA EMAIL (NO OTP IN RESPONSE) =====
router.post('/resend-otp', async (req, res) => {
  console.log('🔄 Resending OTP to:', req.body.email);
  
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
    
    console.log(`✅ New OTP generated for ${email}: ${otp}`);
    
    // Send email with new OTP
    await sendEmailOTP(email, otp, `${user.firstName} ${user.lastName}`);
    console.log(`✅ New OTP email sent to ${email}`);
    
    // Return success WITHOUT OTP in response
    res.json({ 
      success: true, 
      message: 'New OTP sent to your email address'
    });
    
  } catch (error) {
    console.error('❌ Error resending OTP:', error);
    res.status(500).json({ success: false, error: 'Failed to resend OTP. Please try again.' });
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