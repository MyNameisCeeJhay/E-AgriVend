import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RefundRequest.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
  const [transactionData, setTransactionData] = useState(null);
  const [isWithinTimeLimit, setIsWithinTimeLimit] = useState(true);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [validating, setValidating] = useState(false);

  // Validate transaction when user clicks validate button
  const handleValidateTransaction = async () => {
    if (!formData.transactionNumber) {
      setError('Please enter a transaction number');
      return;
    }
    
    setValidating(true);
    setError('');
    setTransactionValid(false);
    setTransactionData(null);
    
    try {
      const response = await axios.get(`${API_URL}/refund/validate/${formData.transactionNumber}`);
      
      if (response.data.success) {
        const transaction = response.data.data;
        
        // Check if refund already exists for this transaction
        const checkRefund = await axios.get(`${API_URL}/refund/check/${formData.transactionNumber}`);
        if (checkRefund.data.exists) {
          setError('A refund request has already been submitted for this transaction.');
          setValidating(false);
          return;
        }
        
        // Store transaction data
        setTransactionData(transaction);
        setTransactionValid(true);
        
        // Auto-fill product details from transaction
        setFormData(prev => ({
          ...prev,
          transactionDate: new Date(transaction.createdAt).toLocaleDateString('en-US'),
          transactionTime: new Date(transaction.createdAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          grainType: transaction.riceType,
          selectedQuantity: transaction.quantityKg,
          amountInserted: transaction.amountPaid
        }));
        
        // Check 4-hour time limit
        const transactionTime = new Date(transaction.createdAt);
        const now = new Date();
        const hoursDiff = (now - transactionTime) / (1000 * 60 * 60);
        
        if (hoursDiff > 4) {
          setIsWithinTimeLimit(false);
          setError('This transaction is outside the 4-hour refund window. Refunds are only accepted within 4 hours of purchase.');
          setTransactionValid(false);
        } else {
          setIsWithinTimeLimit(true);
          startCountdown(transactionTime);
          setError('');
        }
      }
    } catch (error) {
      console.error('Error validating transaction:', error);
      if (error.response?.status === 404) {
        setError('Transaction not found. Please check your transaction number and try again.');
      } else if (error.response?.status === 400) {
        setError(error.response.data?.error || 'A refund request has already been submitted for this transaction.');
      } else {
        setError('Unable to validate transaction. Please try again later.');
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
        setError('Refund window has expired. You can no longer request a refund for this transaction.');
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
    // Clear transaction validation when user changes transaction number
    if (name === 'transactionNumber') {
      setTransactionValid(false);
      setTransactionData(null);
      setError('');
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

    // Validate transaction is valid and within time limit
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

    // Validate all required fields
    if (!formData.fullName || !formData.email || !formData.refundReason || !formData.description || !formData.receiptImage) {
      setError('Please fill in all required fields and upload your receipt.');
      setLoading(false);
      return;
    }

    const submitData = new FormData();
    submitData.append('fullName', formData.fullName);
    submitData.append('email', formData.email);
    submitData.append('transactionNumber', formData.transactionNumber);
    submitData.append('transactionDate', formData.transactionDate);
    submitData.append('transactionTime', formData.transactionTime);
    submitData.append('grainType', formData.grainType);
    submitData.append('selectedQuantity', formData.selectedQuantity);
    submitData.append('amountInserted', formData.amountInserted);
    submitData.append('refundReason', formData.refundReason);
    submitData.append('description', formData.description);
    submitData.append('receiptImage', formData.receiptImage);

    try {
      const response = await axios.post(`${API_URL}/refund/request`, submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (response.data.success) {
        setSuccess('Your refund request has been submitted successfully! The administrator will review it.');
        setTimeout(() => {
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
    setTransactionData(null);
    setIsWithinTimeLimit(true);
    setTimeRemaining(null);
  };

  const refundReasons = [
    'Machine malfunction - No product dispensed',
    'Incorrect product dispensed',
    'Product quality issue (spoiled/damaged)',
    'Incorrect quantity dispensed',
    'Payment error - Charged but no product',
    'Other issue'
  ];

  const grainTypes = ['Sinandomeng', 'Dinorado', 'Jasmine', 'Premium'];

  return (
    <div className="refund-container">
      <div className="refund-card">
        {/* Header */}
        <div className="refund-header">
          <h1>🌾 AgriVend</h1>
          <h2>Customer Refund Request Portal</h2>
        </div>

        {/* Submit a Refund Request Section */}
        <div className="refund-intro">
          <h3>Submit a Refund Request</h3>
          <p>
            This form is intended only for customers who experienced an actual problem with their 
            product or transaction. Please provide complete and accurate details so the administrator 
            can review your request using the recorded transaction data stored in the system.
          </p>
        </div>

        {/* Important Notice */}
        <div className="important-notice">
          <h3>⚠️ Important Notice</h3>
          <p>
            Refund requests are accepted only within <strong>four (4) hours</strong> after the transaction 
            has been processed by the machine. Requests submitted beyond this period will no longer be accepted.
          </p>
        </div>

        {/* Countdown Timer */}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="refund-form">
          {/* Personal Information Section */}
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
                  disabled={!isWithinTimeLimit}
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
                  disabled={!isWithinTimeLimit}
                />
              </div>
            </div>
          </div>

          {/* Transaction Details Section */}
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
                    placeholder="e.g., TXN-MM7UBRUF"
                    required
                    className="transaction-input"
                    disabled={!isWithinTimeLimit}
                  />
                  <button 
                    type="button" 
                    onClick={handleValidateTransaction}
                    className={`validate-btn ${validating ? 'validating' : ''}`}
                    disabled={!formData.transactionNumber || validating || !isWithinTimeLimit}
                  >
                    {validating ? 'Validating...' : 'Validate'}
                  </button>
                </div>
                {transactionValid && (
                  <div className="validation-success">
                    ✓ Transaction validated successfully
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
              </div>
            )}
          </div>

          {/* Product Details Section - Auto-filled after validation */}
          <div className="form-section">
            <h3>Product Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Grain Type *</label>
                <select
                  name="grainType"
                  value={formData.grainType}
                  onChange={handleChange}
                  required
                  disabled={!transactionValid || !isWithinTimeLimit}
                  className={transactionValid ? 'auto-filled' : ''}
                >
                  <option value="">Select grain type</option>
                  {grainTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {transactionValid && <small className="auto-filled-note">Auto-filled from transaction</small>}
              </div>
              <div className="form-group">
                <label>Selected Quantity (kg) *</label>
                <input
                  type="number"
                  name="selectedQuantity"
                  value={formData.selectedQuantity}
                  onChange={handleChange}
                  placeholder="1"
                  required
                  disabled={!transactionValid || !isWithinTimeLimit}
                  className={transactionValid ? 'auto-filled' : ''}
                />
                {transactionValid && <small className="auto-filled-note">Auto-filled from transaction</small>}
              </div>
              <div className="form-group">
                <label>Amount Inserted (₱) *</label>
                <input
                  type="number"
                  name="amountInserted"
                  value={formData.amountInserted}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                  disabled={!transactionValid || !isWithinTimeLimit}
                  className={transactionValid ? 'auto-filled' : ''}
                />
                {transactionValid && <small className="auto-filled-note">Auto-filled from transaction</small>}
              </div>
            </div>
          </div>

          {/* Refund Request Details Section */}
          <div className="form-section">
            <h3>Refund Request Details</h3>
            <div className="form-group">
              <label>Reason for Refund Request *</label>
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
                placeholder="Briefly explain the problem encountered during the transaction..."
                rows="4"
                required
                disabled={!transactionValid || !isWithinTimeLimit}
              />
            </div>
          </div>

          {/* Proof of Transaction Section */}
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
                  <p className="upload-text">Click or drag to upload receipt</p>
                  <p className="upload-hint">JPG, JPEG, PNG, PDF (Max 5MB)</p>
                </label>
              </div>
              {previewUrl && (
                <div className="image-preview">
                  <img src={previewUrl} alt="Receipt preview" />
                  <button type="button" onClick={() => {
                    setPreviewUrl(null);
                    setFormData(prev => ({ ...prev, receiptImage: null }));
                  }}>Remove</button>
                </div>
              )}
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="terms-section">
            <h3>Terms and Conditions</h3>
            <ul>
              <li>This QR code and refund form are intended only for actual product or transaction issues.</li>
              <li>The administrator will use recorded transaction data as the primary reference for evaluation.</li>
              <li>Only requests submitted within four (4) hours after the transaction will be accepted.</li>
              <li>Refunds will only be considered if the dispensed product is proven defective, spoiled, or of poor quality.</li>
              <li>The staff may inspect the grain vending machine and its contents for validation.</li>
            </ul>
            <p className="terms-note">
              Please make sure your <strong>name</strong>, <strong>email address</strong>, <strong>transaction number</strong>, 
              <strong>receipt image</strong>, and <strong>description of the issue</strong> are complete before submitting your request.
            </p>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button type="button" onClick={handleReset} className="btn-reset" disabled={!isWithinTimeLimit}>
              Reset Form
            </button>
            <button type="submit" className="btn-submit" disabled={loading || !isWithinTimeLimit || !transactionValid}>
              {loading ? 'Submitting...' : 'Submit Refund Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RefundRequest;