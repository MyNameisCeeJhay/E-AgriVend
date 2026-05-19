const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
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
        
        console.log('✅ Transaction data:', {
          productName: transaction.riceType || transaction.productName,
          quantity: transaction.quantityKg,
          amount: transaction.amountPaid
        });
        
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
          grainType: transaction.riceType || transaction.productName || '',
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

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'transactionNumber') {
      setTransactionValid(false);
      setError('');
      setTransactionData(null);
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
    submitData.append('returnReason', formData.refundReason);
    submitData.append('description', formData.description);
    submitData.append('receiptImage', formData.receiptImage);

    try {
      const response = await axios.post(`${API_URL}/refund/request`, submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        setSuccess('✅ Your refund request has been submitted successfully!');
        // Reset form after successful submission
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
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                  required
                  disabled={!transactionValid || !isWithinTimeLimit}
                />
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
                {transactionValid && formData.grainType && (
                  <small className="auto-filled-note">✓ {formData.grainType}</small>
                )}
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
                {transactionValid && formData.selectedQuantity && (
                  <small className="auto-filled-note">✓ {formData.selectedQuantity} kg</small>
                )}
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
                {transactionValid && formData.amountInserted && (
                  <small className="auto-filled-note">✓ ₱{formData.amountInserted}</small>
                )}
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
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handleFileChange}
                  required
                  disabled={!transactionValid || !isWithinTimeLimit}
                  className="file-input"
                  id="receipt-upload"
                />
                <label htmlFor="receipt-upload" className="upload-label">
                  <div className="upload-icon">📁</div>
                  <p className="upload-text">Click or drag to upload receipt image</p>
                  <p className="upload-hint">JPG, JPEG, PNG (Max 5MB)</p>
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
              disabled={loading || !isWithinTimeLimit || !transactionValid}
            >
              {loading ? 'Submitting...' : 'Submit Refund Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RefundRequest;