const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RefundRequest.css';

const RefundRequest = () => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    transactionNumber: '',
    transactionDate: '',
    transactionTime: '',
    grainType: '',
    selectedQuantity: '',
    amountInserted: '',
    refundReason: '',
    description: '',
    receiptImage: null
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [transactionValid, setTransactionValid] = useState(false);
  const [isWithinTimeLimit, setIsWithinTimeLimit] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [validating, setValidating] = useState(false);
  const [transactionData, setTransactionData] = useState(null);

  // Email OTP Validation States
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState(['', '', '', '', '', '']);
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState('');
  const [emailOtpMessage, setEmailOtpMessage] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailToVerify, setEmailToVerify] = useState('');
  const emailOtpInputs = useRef([]);

  const handleValidateTransaction = async () => {
    const transactionNumber = formData.transactionNumber.trim().toUpperCase();
    
    if (!transactionNumber) {
      setError('Please enter a transaction number');
      return;
    }
    
    setValidating(true);
    setError('');
    
    try {
      console.log('🔄 Validating transaction:', transactionNumber);
      const response = await axios.get(`${API_URL}/refund/validate/${transactionNumber}`);
      
      console.log('📦 Response:', response.data);
      
      if (response.data.success) {
        const transaction = response.data.data;
        setTransactionData(transaction);
        
        // Format date
        const transactionDate = new Date(transaction.createdAt);
        const formattedDate = transactionDate.toLocaleDateString('en-US');
        const formattedTime = transactionDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        
        // Auto-fill form with transaction data
        setFormData(prev => ({
          ...prev,
          transactionNumber: transactionNumber,
          transactionDate: formattedDate,
          transactionTime: formattedTime,
          grainType: transaction.productName || transaction.riceType || '',
          selectedQuantity: transaction.quantityKg?.toString() || '',
          amountInserted: transaction.amountPaid?.toString() || ''
        }));
        
        setTransactionValid(true);
        
        // Check 4-hour time limit
        const now = new Date();
        const hoursDiff = (now - transactionDate) / (1000 * 60 * 60);
        
        if (hoursDiff > 4) {
          setIsWithinTimeLimit(false);
          setError('⚠️ This transaction is outside the 4-hour refund window.');
        } else {
          setIsWithinTimeLimit(true);
          startCountdown(transactionDate);
        }
      }
    } catch (error) {
      console.error('❌ Error:', error);
      if (error.response?.status === 404) {
        setError('❌ Transaction not found. Please check your transaction number.');
      } else if (error.response?.status === 400) {
        setError(error.response.data?.error || 'A refund request already exists for this transaction.');
      } else {
        setError('Unable to validate transaction. Please try again.');
      }
      setTransactionValid(false);
      setTransactionData(null);
    } finally {
      setValidating(false);
    }
  };
  
  const startCountdown = (transactionTime) => {
    const endTime = new Date(transactionTime.getTime() + 4 * 60 * 60 * 1000);
    
    const interval = setInterval(() => {
      const now = new Date();
      const diff = endTime - now;
      
      if (diff <= 0) {
        clearInterval(interval);
        setIsWithinTimeLimit(false);
        setTimeRemaining(null);
        setError('Refund window has expired.');
        setTransactionValid(false);
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (3600000)) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining({ hours, minutes, seconds });
      }
    }, 1000);
    
    return () => clearInterval(interval);
  };

  // Email OTP Functions
  const handleSendEmailOtp = async () => {
    const email = formData.email.trim();
    
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    
    // Email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setEmailOtpLoading(true);
    setEmailOtpError('');
    setEmailOtpMessage('');
    setEmailOtpSent(false);
    setEmailToVerify(email);
    
    try {
      console.log('📧 Sending OTP to:', email);
      const response = await axios.post(`${API_URL}/refund/send-email-otp`, {
        email: email,
        fullName: formData.fullName
      });
      
      if (response.data.success) {
        setEmailOtpMessage('Verification code sent to your email! Please check your inbox.');
        setEmailOtpSent(true);
        setShowEmailOtpModal(true);
        // Reset OTP inputs
        setEmailOtp(['', '', '', '', '', '']);
      } else {
        setEmailOtpError(response.data?.error || 'Failed to send verification code');
      }
    } catch (error) {
      console.error('Error sending OTP:', error);
      setEmailOtpError(error.response?.data?.error || 'Failed to send verification code. Please try again.');
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleEmailOtpChange = (index, value) => {
    if (value && !/^\d*$/.test(value)) return;
    
    const newOtp = [...emailOtp];
    newOtp[index] = value.slice(-1);
    setEmailOtp(newOtp);
    
    if (value && index < 5) {
      emailOtpInputs.current[index + 1].focus();
    }
  };

  const handleEmailOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !emailOtp[index] && index > 0) {
      emailOtpInputs.current[index - 1].focus();
    }
  };

  const handleEmailOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const pastedNumbers = pastedData.replace(/\D/g, '').slice(0, 6);
    
    if (pastedNumbers) {
      const newOtp = [...emailOtp];
      for (let i = 0; i < pastedNumbers.length; i++) {
        newOtp[i] = pastedNumbers[i];
      }
      setEmailOtp(newOtp);
      
      const lastFilledIndex = Math.min(pastedNumbers.length - 1, 5);
      if (lastFilledIndex >= 0 && lastFilledIndex < 6) {
        emailOtpInputs.current[lastFilledIndex].focus();
      }
    }
  };

  const getEmailOtpValue = () => {
    return emailOtp.join('');
  };

  const handleVerifyEmailOtp = async () => {
    const otpValue = getEmailOtpValue();
    
    if (otpValue.length !== 6) {
      setEmailOtpError('Please enter the complete 6-digit verification code');
      return;
    }
    
    setEmailOtpLoading(true);
    setEmailOtpError('');
    
    try {
      const response = await axios.post(`${API_URL}/refund/verify-email-otp`, {
        email: emailToVerify,
        otp: otpValue
      });
      
      if (response.data.success) {
        setEmailVerified(true);
        setShowEmailOtpModal(false);
        setEmailOtpMessage('');
        setSuccess('Email verified successfully! You can now submit your refund request.');
        
        // Clear OTP after 5 seconds
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      } else {
        setEmailOtpError(response.data?.error || 'Invalid verification code');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      setEmailOtpError(error.response?.data?.error || 'Failed to verify code. Please try again.');
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleResendEmailOtp = async () => {
    setEmailOtpLoading(true);
    setEmailOtpError('');
    setEmailOtpMessage('');
    
    try {
      const response = await axios.post(`${API_URL}/refund/resend-email-otp`, {
        email: emailToVerify,
        fullName: formData.fullName
      });
      
      if (response.data.success) {
        setEmailOtpMessage('New verification code sent to your email!');
        setEmailOtp(['', '', '', '', '', '']);
        setTimeout(() => {
          if (emailOtpInputs.current[0]) {
            emailOtpInputs.current[0].focus();
          }
        }, 100);
      } else {
        setEmailOtpError(response.data?.error || 'Failed to resend code');
      }
    } catch (error) {
      setEmailOtpError('Failed to resend verification code');
    } finally {
      setEmailOtpLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === 'transactionNumber') {
      setTransactionValid(false);
      setError('');
      setTransactionData(null);
    }
    
    // Reset email verification if email changes
    if (name === 'email') {
      setEmailVerified(false);
      setEmailOtpSent(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        setError('Only JPG, JPEG, PNG, and PDF files are allowed');
        return;
      }
      
      setFormData(prev => ({ ...prev, receiptImage: file }));
      setPreviewUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!transactionValid) {
      setError('Please validate your transaction number first.');
      setLoading(false);
      return;
    }

    if (!isWithinTimeLimit) {
      setError('Refund requests are only accepted within 4 hours of the transaction.');
      setLoading(false);
      return;
    }

    if (!emailVerified) {
      setError('Please verify your email address first. Click "Verify Email" button.');
      setLoading(false);
      return;
    }

    if (!formData.fullName || !formData.email || !formData.refundReason || !formData.description || !formData.receiptImage) {
      setError('Please fill in all required fields and upload your receipt.');
      setLoading(false);
      return;
    }

    const submitData = new FormData();
    submitData.append('fullName', formData.fullName);
    submitData.append('email', formData.email);
    submitData.append('transactionNumber', formData.transactionNumber);
    submitData.append('riceType', formData.grainType);
    submitData.append('quantityKg', formData.selectedQuantity);
    submitData.append('amountPaid', formData.amountInserted);
    submitData.append('refundReason', formData.refundReason);
    submitData.append('returnReason', formData.refundReason);
    submitData.append('description', formData.description);
    submitData.append('receiptImage', formData.receiptImage);
    submitData.append('emailVerified', 'true');

    try {
      console.log('📤 Submitting refund request...');
      
      const response = await axios.post(`${API_URL}/refund/request`, submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        setSuccess('✅ Your refund request has been submitted successfully!');
        setTimeout(() => {
          handleReset();
          navigate('/refund/success');
        }, 3000);
      }
    } catch (error) {
      console.error('Error submitting refund:', error);
      setError(error.response?.data?.error || 'Failed to submit refund request.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      fullName: '',
      email: '',
      transactionNumber: '',
      transactionDate: '',
      transactionTime: '',
      grainType: '',
      selectedQuantity: '',
      amountInserted: '',
      refundReason: '',
      description: '',
      receiptImage: null
    });
    setPreviewUrl(null);
    setError('');
    setSuccess('');
    setTransactionValid(false);
    setIsWithinTimeLimit(true);
    setTimeRemaining(null);
    setTransactionData(null);
    setEmailVerified(false);
    setEmailOtpSent(false);
  };

  const refundReasons = [
    'Machine malfunction - No product dispensed',
    'Incorrect product dispensed',
    'Product quality issue (spoiled/damaged)',
    'Incorrect quantity dispensed',
    'Payment error - Charged but no product',
    'Other issue'
  ];

  return (
    <div className="refund-container">
      <div className="refund-card">
        <div className="refund-header">
          <h1>AgriVend</h1>
          <h2>Customer Refund Request Portal</h2>
        </div>

        <div className="refund-intro">
          <h3>Submit a Refund Request</h3>
          <p>
            Enter your transaction number to auto-fill your purchase details, then complete the refund request form.
          </p>
        </div>

        <div className="important-notice">
          <h3>⚠️ Important Notice</h3>
          <p>
            Refund requests are accepted only within <strong>four (4) hours</strong> after the transaction.
          </p>
        </div>

        {transactionValid && isWithinTimeLimit && timeRemaining && (
          <div className="countdown-timer">
            <div className="countdown-label">Time remaining to submit refund:</div>
            <div className="countdown">
              {timeRemaining.hours}h {timeRemaining.minutes}m {timeRemaining.seconds}s
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="refund-form">
          {/* Personal Information */}
          <div className="form-section">
            <h3>Personal Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  required
                  disabled={!transactionValid || !isWithinTimeLimit}
                />
              </div>
              <div className="form-group">
                <label>Email Address *</label>
                <div className="email-input-group">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Enter your email address"
                    required
                    disabled={!transactionValid || !isWithinTimeLimit || emailVerified}
                    className={emailVerified ? 'email-verified' : ''}
                  />
                  {transactionValid && isWithinTimeLimit && !emailVerified && (
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={emailOtpLoading || !formData.email}
                      className="verify-email-btn"
                    >
                      {emailOtpLoading ? 'Sending...' : 'Verify Email'}
                    </button>
                  )}
                  {emailVerified && (
                    <div className="verified-badge">
                      ✓ Email Verified
                    </div>
                  )}
                </div>
                {emailVerified && (
                  <small className="verified-note">Your email has been verified ✓</small>
                )}
              </div>
            </div>
          </div>

          {/* Transaction Details */}
          <div className="form-section">
            <h3>Transaction Details</h3>
            <div className="form-row">
              <div className="form-group transaction-group">
                <label>Transaction Number *</label>
                <div className="transaction-input-group">
                  <input
                    type="text"
                    name="transactionNumber"
                    value={formData.transactionNumber}
                    onChange={handleChange}
                    placeholder="Example: TXN-260430-MOL5YQ21-2FBD0Q"
                    required
                    className="transaction-input"
                    disabled={transactionValid}
                  />
                  {!transactionValid && (
                    <button 
                      type="button" 
                      onClick={handleValidateTransaction}
                      className={`validate-btn ${validating ? 'validating' : ''}`}
                      disabled={!formData.transactionNumber || validating}
                    >
                      {validating ? 'Validating...' : 'Validate'}
                    </button>
                  )}
                </div>
                {transactionValid && (
                  <div className="validation-success">
                    ✓ Transaction validated successfully!
                  </div>
                )}
              </div>
            </div>
            
            {transactionValid && (
              <div className="transaction-summary">
                <div className="summary-row">
                  <span className="summary-label">Transaction Date:</span>
                  <span className="summary-value">{formData.transactionDate}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Transaction Time:</span>
                  <span className="summary-value">{formData.transactionTime}</span>
                </div>
                <div className="summary-row">
                  <span className="summary-label">Transaction ID:</span>
                  <span className="summary-value transaction-id">{formData.transactionNumber}</span>
                </div>
              </div>
            )}
          </div>

          {/* Product Details - AUTO-FILLED */}
          <div className="form-section">
            <h3>Product Details <span className="auto-badge">(Auto-filled from transaction)</span></h3>
            <div className="form-row">
              <div className="form-group">
                <label>Rice Type *</label>
                <input
                  type="text"
                  value={formData.grainType}
                  readOnly
                  className="readonly-field"
                  placeholder={transactionValid ? "Loading..." : "Validate transaction first"}
                />
              </div>
              <div className="form-group">
                <label>Quantity (kg) *</label>
                <input
                  type="text"
                  value={formData.selectedQuantity}
                  readOnly
                  className="readonly-field"
                  placeholder={transactionValid ? "Loading..." : "Validate transaction first"}
                />
              </div>
              <div className="form-group">
                <label>Amount Paid (₱) *</label>
                <input
                  type="text"
                  value={formData.amountInserted}
                  readOnly
                  className="readonly-field"
                  placeholder={transactionValid ? "Loading..." : "Validate transaction first"}
                />
              </div>
            </div>
            {!transactionValid && (
              <div className="info-message">
                ℹ️ Click "Validate" to auto-fill your transaction details
              </div>
            )}
          </div>

          {/* Refund Request Details - MANUAL */}
          <div className="form-section">
            <h3>Refund Request Details <span className="manual-badge">(Please fill manually)</span></h3>
            <div className="form-group">
              <label>Reason for Refund *</label>
              <select
                name="refundReason"
                value={formData.refundReason}
                onChange={handleChange}
                required
                disabled={!transactionValid || !isWithinTimeLimit}
              >
                <option value="">Select refund reason</option>
                {refundReasons.map(reason => (
                  <option key={reason} value={reason}>{reason}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Description / Comment *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Please explain in detail what problem you encountered..."
                rows="4"
                required
                disabled={!transactionValid || !isWithinTimeLimit}
              />
            </div>
          </div>

          {/* Proof of Transaction */}
          <div className="form-section">
            <h3>Proof of Transaction</h3>
            <div className="form-group">
              <label>Upload Receipt Image *</label>
              <div className="file-upload-area">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,application/pdf"
                  onChange={handleFileChange}
                  required
                  disabled={!transactionValid || !isWithinTimeLimit}
                  className="file-input"
                  id="receipt-upload"
                />
                <label htmlFor="receipt-upload" className="upload-label">
                  <div className="upload-icon">📁</div>
                  <p className="upload-text">Click or drag to upload receipt image</p>
                  <p className="upload-hint">JPG, JPEG, PNG, PDF (Max 5MB)</p>
                </label>
              </div>
              {previewUrl && (
                <div className="image-preview">
                  <img src={previewUrl} alt="Receipt preview" />
                  <button 
                    type="button" 
                    className="remove-btn"
                    onClick={() => {
                      setPreviewUrl(null);
                      setFormData(prev => ({ ...prev, receiptImage: null }));
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Terms */}
          <div className="terms-section">
            <h3>Terms and Conditions</h3>
            <ul>
              <li>This form is for actual product or transaction issues only.</li>
              <li>Requests submitted within 4 hours of transaction will be processed.</li>
              <li>Administrator will review using recorded transaction data.</li>
              <li>Refunds approved only if product is proven defective.</li>
              <li>Approved refunds will be processed within 3-5 business days.</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="form-actions">
            <button type="button" onClick={handleReset} className="btn-reset">
              Reset Form
            </button>
            <button 
              type="submit" 
              className="btn-submit" 
              disabled={loading || !isWithinTimeLimit || !transactionValid || !emailVerified}
            >
              {loading ? 'Submitting...' : 'Submit Refund Request'}
            </button>
          </div>
        </form>
      </div>

      {/* Email OTP Modal */}
      {showEmailOtpModal && (
        <div className="modal-overlay" onClick={() => !emailOtpLoading && setShowEmailOtpModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Email Verification</h3>
              <button 
                className="modal-close" 
                onClick={() => !emailOtpLoading && setShowEmailOtpModal(false)}
                disabled={emailOtpLoading}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>We've sent a verification code to:</p>
              <p className="email-highlight">{emailToVerify}</p>
              
              <div className="otp-section">
                <label className="input-label">Verification Code</label>
                <div className="otp-input-group">
                  {emailOtp.map((digit, index) => (
                    <input
                      key={index}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleEmailOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleEmailOtpKeyDown(index, e)}
                      onPaste={index === 0 ? handleEmailOtpPaste : undefined}
                      ref={(el) => (emailOtpInputs.current[index] = el)}
                      className="otp-input"
                      autoFocus={index === 0}
                      disabled={emailOtpLoading}
                    />
                  ))}
                </div>
              </div>

              {emailOtpError && (
                <div className="error-message small">{emailOtpError}</div>
              )}
              
              {emailOtpMessage && (
                <div className="success-message small">{emailOtpMessage}</div>
              )}

              <div className="resend-section">
                <button
                  type="button"
                  onClick={handleResendEmailOtp}
                  className="resend-link"
                  disabled={emailOtpLoading}
                >
                  Resend Code
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setShowEmailOtpModal(false)}
                className="btn-secondary"
                disabled={emailOtpLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyEmailOtp}
                className="btn-primary"
                disabled={emailOtpLoading || getEmailOtpValue().length !== 6}
              >
                {emailOtpLoading ? 'Verifying...' : 'Verify'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RefundRequest;