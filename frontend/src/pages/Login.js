import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Login.css';

// ADD THIS LINE - Missing API_URL constant
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

  // Send OTP
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
      const response = await axios.post(`${API_URL}/auth/send-otp`, {
        email: resetEmail
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.status === 200 || response.status === 201) {
        if (response.data && response.data.success !== false) {
          setResetMessage('OTP sent successfully to your registered email');
          setOtpSent(true);
          setResetStep(2);
        } else {
          setResetError(response.data?.error || 'Failed to send OTP');
        }
      } else {
        setResetError('Unexpected response from server');
      }
      
    } catch (error) {
      console.error('Error sending OTP:', error);
      
      if (error.code === 'ECONNABORTED') {
        setResetError('Request timeout. Please try again.');
      } else if (error.response) {
        setResetError(error.response.data?.error || 'Failed to send OTP');
      } else {
        setResetError('Network error. Please check your connection.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  // Reset Password
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
        setResetMessage('Password reset successful! Redirecting to login...');
        
        setTimeout(() => {
          setShowForgotPassword(false);
          setResetStep(1);
          setResetEmail('');
          setOtp(['', '', '', '', '', '']);
          setNewPassword('');
          setConfirmPassword('');
          setResetMessage('');
          setOtpSent(false);
        }, 2000);
      } else {
        setResetError(response.data?.error || 'Failed to reset password');
      }
      
    } catch (error) {
      console.error('Error resetting password:', error);
      if (error.response) {
        setResetError(error.response.data?.error || 'Invalid OTP or failed to reset password');
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
        setResetMessage('New OTP sent successfully');
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
      setResetError('Failed to resend OTP. Please try again.');
    } finally {
      setResetLoading(false);
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
    <div 
      className="login-container"
      style={{
        backgroundImage: `url('/assets/images/AgBackground.jpg')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="login-overlay"></div>
      <div className="login-grid">
        {/* Left Side - Brand Area */}
        <div className="login-brand">
          <div className="brand-content">
            <div className="brand-logo">
              <h1 className="brand-name">AGRIVEND</h1>
            </div>
            <p className="brand-tagline">Solar Powered Grain Vending Machine</p>
            <div className="brand-features">
              <div className="feature-item">
                <span className="feature-check">✓</span>
                <span>Automated Vending Machine</span>
              </div>
              <div className="feature-item">
                <span className="feature-check">✓</span>
                <span>Real-time Inventory Tracking</span>
              </div>
              <div className="feature-item">
                <span className="feature-check">✓</span>
                <span>Secure Payment Processing</span>
              </div>
              <div className="feature-item">
                <span className="feature-check">✓</span>
                <span>Enterprise Management Dashboard</span>
              </div>
            </div>
            <div className="brand-footer">
              <p className="authorized-text">Authorized Personnel Only</p>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="login-form-container">
          <div className="form-wrapper">
            <div className="form-header">
              <h2 className="form-title">Welcome Back</h2>
              <p className="form-subtitle">Sign in to your administrator account</p>
            </div>
            
            {displayError && !showForgotPassword && (
              <div className="alert-message error">
                <span>{displayError}</span>
              </div>
            )}
            
            {!showForgotPassword ? (
              <form className="login-form" onSubmit={handleSubmit}>
                <div className="input-group">
                  <label className="input-label">Email Address</label>
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
                
                <div className="input-group">
                  <label className="input-label">Password</label>
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
                  className={`submit-button ${loading ? 'loading' : ''}`}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            ) : (
              <div className="reset-form">
                {resetStep === 1 ? (
                  <form onSubmit={handleSendOTP}>
                    <h3 className="reset-title">Reset Password</h3>
                    <p className="reset-description">
                      Enter your email address and we'll send you a verification code
                    </p>
                    
                    <div className="input-group">
                      <label className="input-label">Email Address</label>
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="admin@agrivend.com"
                        className="form-input"
                        disabled={resetLoading}
                      />
                    </div>

                    {resetError && (
                      <div className="alert-message error">
                        <span>{resetError}</span>
                      </div>
                    )}

                    {resetMessage && (
                      <div className="alert-message success">
                        <span>{resetMessage}</span>
                      </div>
                    )}

                    <div className="form-actions">
                      <button
                        type="submit"
                        disabled={resetLoading}
                        className={`submit-button ${resetLoading ? 'loading' : ''}`}
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
                        className="secondary-button"
                      >
                        Back to Login
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword}>
                    <h3 className="reset-title">Verify & Reset</h3>
                    <p className="reset-description">
                      Enter the OTP sent to <strong>{resetEmail}</strong>
                    </p>
                    
                    <div className="otp-section">
                      <label className="input-label">Verification Code</label>
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

                    <div className="resend-section">
                      <button
                        type="button"
                        onClick={handleResendOTP}
                        className="resend-link"
                        disabled={resetLoading}
                      >
                        Resend Code
                      </button>
                    </div>

                    <div className="input-group">
                      <label className="input-label">New Password</label>
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={handleNewPasswordChange}
                        placeholder="Create new password"
                        className="form-input"
                        disabled={resetLoading}
                      />
                    </div>

                    <div className="input-group">
                      <label className="input-label">Confirm Password</label>
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
                          <span className="strength-weak">Password must contain:</span>
                        )}
                      </div>
                      {!passwordStrength.isStrong && (
                        <ul className="strength-requirements">
                          {!passwordStrength.requirements.minLength && <li>• At least 8 characters</li>}
                          {!passwordStrength.requirements.hasUpperCase && <li>• At least one uppercase letter</li>}
                          {!passwordStrength.requirements.hasLowerCase && <li>• At least one lowercase letter</li>}
                          {!passwordStrength.requirements.hasNumbers && <li>• At least one number</li>}
                          {!passwordStrength.requirements.hasSpecialChar && <li>• At least one special character</li>}
                        </ul>
                      )}
                    </div>

                    {resetError && (
                      <div className="alert-message error">
                        <span>{resetError}</span>
                      </div>
                    )}

                    {resetMessage && (
                      <div className="alert-message success">
                        <span>{resetMessage}</span>
                      </div>
                    )}

                    <div className="form-actions">
                      <button
                        type="submit"
                        disabled={resetLoading || getOtpValue().length !== 6 || !passwordStrength.isStrong}
                        className={`submit-button ${resetLoading ? 'loading' : ''}`}
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
                        className="secondary-button"
                      >
                        Back
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;