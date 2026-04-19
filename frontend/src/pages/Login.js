import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');
  const { login, error: authError } = useAuth();

  // Forgot Password States
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetStep, setResetStep] = useState(1);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    isStrong: false,
    requirements: {
      minLength: false,
      hasUpperCase: false,
      hasLowerCase: false,
      hasNumbers: false,
      hasSpecialChar: false
    }
  });

  // OTP input refs
  const otpInputs = useRef([]);

  // Add Admin States
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: ''
  });
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminMessage, setAdminMessage] = useState('');
  const [adminError, setAdminError] = useState('');

  // Auto reload after successful admin creation
  useEffect(() => {
    let reloadTimer;
    if (adminMessage && adminMessage.includes('successfully')) {
      reloadTimer = setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, [adminMessage]);

  // Auto reload after successful password reset
  useEffect(() => {
    let reloadTimer;
    if (resetMessage && resetMessage.includes('successfully')) {
      reloadTimer = setTimeout(() => {
        window.location.reload();
      }, 2000);
    }
    return () => {
      if (reloadTimer) clearTimeout(reloadTimer);
    };
  }, [resetMessage]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLocalError('');
    
    if (!email || !password) {
      setLocalError('Please enter both email and password');
      setLoading(false);
      return;
    }
    
    const result = await login(email, password);
    
    if (!result.success) {
      setLocalError(result.error);
    }
    
    setLoading(false);
  };

  // Handle OTP input change
  const handleOtpChange = (index, value) => {
    if (value && !/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    
    if (value && index < 5) {
      otpInputs.current[index + 1].focus();
    }
  };

  // Handle OTP key down
  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpInputs.current[index - 1].focus();
    }
  };

  // Handle OTP paste
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const pastedNumbers = pastedData.replace(/\D/g, '').slice(0, 6);
    
    if (pastedNumbers) {
      const newOtp = [...otp];
      for (let i = 0; i < pastedNumbers.length; i++) {
        newOtp[i] = pastedNumbers[i];
      }
      setOtp(newOtp);
      
      const lastFilledIndex = Math.min(pastedNumbers.length - 1, 5);
      if (lastFilledIndex >= 0 && lastFilledIndex < 6) {
        otpInputs.current[lastFilledIndex].focus();
      }
    }
  };

  // Get combined OTP value
  const getOtpValue = () => {
    return otp.join('');
  };

  // Send OTP - FIXED: Better error handling
  const handleSendOTP = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      setResetError('Please enter your email address');
      return;
    }

    setResetLoading(true);
    setResetError('');
    setResetMessage('');
    setOtp(['', '', '', '', '', '']);

    try {
      console.log('📧 Sending OTP to:', resetEmail);
      
      // Increase timeout to 30 seconds for email sending
      const response = await axios.post(`${API_URL}/auth/send-otp`, {
        email: resetEmail
      }, {
        timeout: 30000, // 30 seconds timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📧 Response:', response.data);
      
      // Check if the request was successful
      if (response.status === 200 || response.status === 201) {
        if (response.data && response.data.success !== false) {
          setResetMessage(response.data.message || 'OTP sent to your email! Please check your inbox.');
          setOtpSent(true);
          setResetStep(2);
        } else {
          setResetError(response.data?.error || 'Failed to send OTP');
        }
      } else {
        setResetError('Unexpected response from server');
      }
      
    } catch (error) {
      console.error('❌ Error sending OTP:', error);
      
      // Handle different error scenarios
      if (error.code === 'ECONNABORTED') {
        setResetError('Request timeout. The email might still be sending. Please check your email inbox.');
      } else if (error.message === 'Network Error') {
        // Check if the email might have been sent despite network error
        setResetError('Network issue detected. Please check your email inbox - the OTP may have been sent successfully.');
      } else if (error.response) {
        // Server responded with error
        const errorMsg = error.response.data?.error || 'Failed to send OTP';
        setResetError(errorMsg);
      } else if (error.request) {
        // Request was made but no response
        setResetError('No response from server. Please check your email - the OTP might have been sent.');
      } else {
        setResetError(error.message || 'An error occurred. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  // Reset Password (One Step - Verifies and Resets)
  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    const otpValue = getOtpValue();
    if (otpValue.length !== 6) {
      setResetError('Please enter the complete 6-digit OTP');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }
    
    if (!passwordStrength.isStrong) {
      setResetError('Please ensure your password meets all requirements');
      return;
    }
    
    setResetLoading(true);
    setResetError('');
    setResetMessage('');

    try {
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        email: resetEmail,
        otp: otpValue,
        newPassword: newPassword
      }, {
        timeout: 30000
      });
      
      if (response.data && response.data.success) {
        setResetMessage(response.data.message || 'Password reset successfully! Page will reload in 2 seconds...');
        
        setTimeout(() => {
          setShowForgotPassword(false);
          setResetStep(1);
          setResetEmail('');
          setOtp(['', '', '', '', '', '']);
          setNewPassword('');
          setConfirmPassword('');
          setResetMessage('');
          setOtpSent(false);
          window.location.reload();
        }, 2000);
      } else {
        setResetError(response.data?.error || 'Failed to reset password');
      }
      
    } catch (error) {
      console.error('Error resetting password:', error);
      if (error.response) {
        setResetError(error.response.data?.error || 'Invalid OTP or failed to reset password');
      } else if (error.request) {
        setResetError('No response from server. Please try again.');
      } else {
        setResetError('An error occurred. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    setResetLoading(true);
    setResetError('');
    setResetMessage('');

    try {
      const response = await axios.post(`${API_URL}/auth/resend-otp`, {
        email: resetEmail
      }, {
        timeout: 30000
      });
      
      if (response.data && response.data.success) {
        setResetMessage(response.data.message || 'New OTP sent to your email!');
        setOtp(['', '', '', '', '', '']);
        
        setTimeout(() => {
          if (otpInputs.current[0]) {
            otpInputs.current[0].focus();
          }
        }, 100);
      } else {
        setResetError(response.data?.error || 'Failed to resend OTP');
      }
      
    } catch (error) {
      console.error('Error resending OTP:', error);
      setResetError('Failed to resend OTP. Please check your email or try again.');
    } finally {
      setResetLoading(false);
    }
  };

  // Create Admin Account
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    
    if (!adminFormData.email || !adminFormData.password || !adminFormData.firstName || !adminFormData.lastName) {
      setAdminError('Please fill in all required fields');
      return;
    }
    
    setAdminLoading(true);
    setAdminError('');
    setAdminMessage('');

    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        email: adminFormData.email,
        password: adminFormData.password,
        firstName: adminFormData.firstName,
        lastName: adminFormData.lastName,
        phone: adminFormData.phone || '',
        role: 'admin'
      }, {
        timeout: 30000
      });
      
      setAdminMessage('Admin account created successfully! Page will reload in 2 seconds...');
      
      setAdminFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        phone: ''
      });
      
      setTimeout(() => {
        setShowAddAdmin(false);
        setAdminMessage('');
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error creating admin:', error);
      setAdminError(error.response?.data?.error || 'Failed to create admin account');
    } finally {
      setAdminLoading(false);
    }
  };

  // Check password strength
  const checkPasswordStrength = (pwd) => {
    const requirements = {
      minLength: pwd.length >= 8,
      hasUpperCase: /[A-Z]/.test(pwd),
      hasLowerCase: /[a-z]/.test(pwd),
      hasNumbers: /\d/.test(pwd),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(pwd)
    };
    
    const isStrong = Object.values(requirements).every(Boolean);
    
    setPasswordStrength({
      isStrong,
      requirements
    });
  };

  const handleNewPasswordChange = (e) => {
    const pwd = e.target.value;
    setNewPassword(pwd);
    checkPasswordStrength(pwd);
  };

  const displayError = localError || authError;

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">
            AgriVend
          </h1>
          <p className="login-subtitle">
            Administrator Portal
          </p>
        </div>
        
        {displayError && !showForgotPassword && !showAddAdmin && (
          <div className="login-error">
            {displayError}
          </div>
        )}
        
        {!showForgotPassword && !showAddAdmin ? (
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@agrivend.com"
                className="form-input"
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="form-input"
                disabled={loading}
              />
            </div>

            <div className="form-options">
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="forgot-password-link"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`login-button ${loading ? 'loading' : ''}`}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <div className="form-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              onClick={() => setShowAddAdmin(true)}
              className="add-admin-button"
            >
              Create New Admin Account
            </button>
          </form>
        ) : showForgotPassword ? (
          <div className="reset-form">
            {resetStep === 1 ? (
              // Step 1: Enter Email
              <form onSubmit={handleSendOTP}>
                <h3 className="reset-title">Reset Password</h3>
                <p className="reset-description">
                  Enter your email address and we'll send you an OTP to reset your password.
                </p>
                
                <div className="form-group">
                  <label className="form-label">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your registered email"
                    className="form-input"
                    disabled={resetLoading}
                  />
                </div>

                {resetError && (
                  <div className="reset-error">
                    {resetError}
                  </div>
                )}

                {resetMessage && (
                  <div className="reset-success">
                    {resetMessage}
                  </div>
                )}

                <div className="form-actions">
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className={`login-button ${resetLoading ? 'loading' : ''}`}
                  >
                    {resetLoading ? 'Sending...' : 'Send OTP'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetError('');
                      setResetMessage('');
                      setResetEmail('');
                      setResetStep(1);
                    }}
                    className="back-to-login"
                  >
                    Back to Login
                  </button>
                </div>
              </form>
            ) : (
              // Step 2: Enter OTP and New Password
              <form onSubmit={handleResetPassword}>
                <h3 className="reset-title">Reset Password</h3>
                <p className="reset-description">
                  Enter the OTP sent to <strong>{resetEmail}</strong> and create a new strong password.
                </p>
                
                {/* OTP Input Bar */}
                <div className="otp-input-container">
                  <label className="form-label">OTP Code</label>
                  <div className="otp-input-group">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        type="text"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={index === 0 ? handleOtpPaste : undefined}
                        ref={(el) => (otpInputs.current[index] = el)}
                        className="otp-input"
                        autoFocus={index === 0}
                        disabled={resetLoading}
                      />
                    ))}
                  </div>
                </div>

                {/* Resend OTP Link */}
                <div className="resend-otp-container">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    className="resend-otp-link"
                    disabled={resetLoading}
                  >
                    Didn't receive the code? Resend OTP
                  </button>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={handleNewPasswordChange}
                    placeholder="Enter new password"
                    className="form-input"
                    disabled={resetLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="form-input"
                    disabled={resetLoading}
                  />
                </div>

                {/* Password Strength Indicator */}
                <div className="password-strength">
                  <div className="strength-bars">
                    <div className={`strength-bar ${passwordStrength.requirements.minLength ? 'strong' : ''}`}></div>
                    <div className={`strength-bar ${passwordStrength.requirements.hasUpperCase ? 'strong' : ''}`}></div>
                    <div className={`strength-bar ${passwordStrength.requirements.hasLowerCase ? 'strong' : ''}`}></div>
                    <div className={`strength-bar ${passwordStrength.requirements.hasNumbers ? 'strong' : ''}`}></div>
                    <div className={`strength-bar ${passwordStrength.requirements.hasSpecialChar ? 'strong' : ''}`}></div>
                  </div>
                  <div className="strength-text">
                    {passwordStrength.isStrong ? (
                      <span className="strength-strong">✓ Strong password</span>
                    ) : (
                      <span className="strength-weak">Password requirements:</span>
                    )}
                  </div>
                  <ul className="strength-requirements">
                    {!passwordStrength.requirements.minLength && <li>• At least 8 characters</li>}
                    {!passwordStrength.requirements.hasUpperCase && <li>• At least one uppercase letter</li>}
                    {!passwordStrength.requirements.hasLowerCase && <li>• At least one lowercase letter</li>}
                    {!passwordStrength.requirements.hasNumbers && <li>• At least one number</li>}
                    {!passwordStrength.requirements.hasSpecialChar && <li>• At least one special character (!@#$%^&*)</li>}
                  </ul>
                </div>

                {resetError && (
                  <div className="reset-error">
                    {resetError}
                  </div>
                )}

                {resetMessage && (
                  <div className="reset-success">
                    {resetMessage}
                  </div>
                )}

                <div className="form-actions">
                  <button
                    type="submit"
                    disabled={resetLoading || getOtpValue().length !== 6 || !passwordStrength.isStrong}
                    className={`login-button ${resetLoading ? 'loading' : ''}`}
                  >
                    {resetLoading ? 'Resetting...' : 'Reset Password'}
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setResetStep(1);
                      setOtp(['', '', '', '', '', '']);
                      setNewPassword('');
                      setConfirmPassword('');
                      setResetError('');
                    }}
                    className="back-to-login"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="add-admin-form">
            <h3 className="reset-title">Create Admin Account</h3>
            <p className="reset-description">
              Create a new administrator account to access the system.
            </p>
            
            <form onSubmit={handleCreateAdmin}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    required
                    value={adminFormData.firstName}
                    onChange={(e) => setAdminFormData({...adminFormData, firstName: e.target.value})}
                    placeholder="Enter first name"
                    className="form-input"
                  />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={adminFormData.lastName}
                    onChange={(e) => setAdminFormData({...adminFormData, lastName: e.target.value})}
                    placeholder="Enter last name"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Email Address *</label>
                <input
                  type="email"
                  required
                  value={adminFormData.email}
                  onChange={(e) => setAdminFormData({...adminFormData, email: e.target.value})}
                  placeholder="admin@agrivend.com"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password *</label>
                <input
                  type="password"
                  required
                  value={adminFormData.password}
                  onChange={(e) => setAdminFormData({...adminFormData, password: e.target.value})}
                  placeholder="Enter strong password"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  value={adminFormData.phone}
                  onChange={(e) => setAdminFormData({...adminFormData, phone: e.target.value})}
                  placeholder="Optional"
                  className="form-input"
                />
              </div>

              {adminError && (
                <div className="reset-error">
                  {adminError}
                </div>
              )}

              {adminMessage && (
                <div className="reset-success">
                  {adminMessage}
                </div>
              )}

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={adminLoading}
                  className={`login-button ${adminLoading ? 'loading' : ''}`}
                >
                  {adminLoading ? 'Creating...' : 'Create Admin Account'}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setShowAddAdmin(false);
                    setAdminError('');
                    setAdminMessage('');
                    setAdminFormData({
                      email: '',
                      password: '',
                      firstName: '',
                      lastName: '',
                      phone: ''
                    });
                  }}
                  className="back-to-login"
                >
                  Back to Login
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Admin Demo Credentials Only */}
        <div className="demo-credentials">
          <div className="demo-badge">Admin Demo Credentials</div>
          <div className="demo-info">
            <div className="demo-row">
              <span className="demo-label">Admin Email:</span>
              <span className="demo-value">admin@agrivend.com</span>
            </div>
            <div className="demo-row">
              <span className="demo-label">Password:</span>
              <span className="demo-value">Admin@123</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;