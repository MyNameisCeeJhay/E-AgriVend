import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RefundRequest.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const RefundRequest = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    transactionNumber: transactionId || '',
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

  useEffect(() => {
    if (transactionId) {
      validateTransaction();
    }
  }, [transactionId]);

  useEffect(() => {
    if (transactionValid && formData.transactionDate && formData.transactionTime) {
      startCountdown();
    }
  }, [transactionValid, formData.transactionDate, formData.transactionTime]);

  const validateTransaction = async () => {
  try {
    console.log('🔍 Validating transaction:', transactionId);
    const response = await axios.get(`${API_URL}/refund/validate/${transactionId}`);
    
    console.log('📦 API Response:', response.data);
    
    if (response.data.success) {
      const transaction = response.data.data;
      console.log('✅ Transaction found:', transaction);
      
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
      setTransactionValid(true);
      setError('');
      
      const transactionTime = new Date(transaction.createdAt);
      const now = new Date();
      const hoursDiff = (now - transactionTime) / (1000 * 60 * 60);
      if (hoursDiff > 4) {
        setIsWithinTimeLimit(false);
        setError('This transaction is outside the 4-hour refund window.');
      }
    } else {
      setError('Transaction not found');
    }
  } catch (error) {
    console.error('❌ Error validating transaction:', error);
    setError('Invalid transaction number. Please check and try again.');
  }
};

  const startCountdown = () => {
    const transactionDateTime = new Date(`${formData.transactionDate} ${formData.transactionTime}`);
    const endTime = new Date(transactionDateTime.getTime() + 4 * 60 * 60 * 1000);
    
    const interval = setInterval(() => {
      const now = new Date();
      const diff = endTime - now;
      
      if (diff <= 0) {
        clearInterval(interval);
        setIsWithinTimeLimit(false);
        setTimeRemaining(null);
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

    if (!isWithinTimeLimit) {
      setError('Refund requests are only accepted within 4 hours of the transaction.');
      setLoading(false);
      return;
    }

    if (!formData.fullName || !formData.email || !formData.transactionNumber || 
        !formData.refundReason || !formData.description || !formData.receiptImage) {
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
      transactionNumber: transactionId || '',
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
        <div className="refund-header">
          <h1>🌾 AgriVend</h1>
          <h2>Customer Refund Request Portal</h2>
          <p>Please provide complete and accurate details for review.</p>
        </div>

        {transactionValid && isWithinTimeLimit && timeRemaining && (
          <div className="time-warning warning">
            <span className="time-icon">⏰</span>
            <div>
              <strong>Time remaining to submit refund:</strong>
              <div className="countdown">
                {timeRemaining.hours}h {timeRemaining.minutes}m {timeRemaining.seconds}s
              </div>
            </div>
          </div>
        )}

        {transactionValid && !isWithinTimeLimit && (
          <div className="time-warning error">
            <span className="time-icon">❌</span>
            <div>
              <strong>Refund window expired!</strong>
              <p>This transaction is outside the 4-hour refund window.</p>
            </div>
          </div>
        )}

        <div className="important-notice">
          <h3>⚠️ Important Notice</h3>
          <p>Refund requests are accepted only within <strong>four (4) hours</strong> after the transaction.</p>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form onSubmit={handleSubmit} className="refund-form">
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

          <div className="form-section">
            <h3>Transaction Details</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Transaction Number *</label>
                <input
                  type="text"
                  name="transactionNumber"
                  value={formData.transactionNumber}
                  disabled
                  className="readonly"
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Transaction Date</label>
                <input type="text" value={formData.transactionDate} disabled className="readonly" />
              </div>
              <div className="form-group">
                <label>Transaction Time</label>
                <input type="text" value={formData.transactionTime} disabled className="readonly" />
              </div>
            </div>
          </div>

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
                  disabled={!isWithinTimeLimit}
                >
                  <option value="">Select grain type</option>
                  {grainTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Selected Quantity (kg) *</label>
                <input
                  type="number"
                  name="selectedQuantity"
                  value={formData.selectedQuantity}
                  onChange={handleChange}
                  required
                  disabled={!isWithinTimeLimit}
                />
              </div>
              <div className="form-group">
                <label>Amount Inserted (₱) *</label>
                <input
                  type="number"
                  name="amountInserted"
                  value={formData.amountInserted}
                  onChange={handleChange}
                  required
                  disabled={!isWithinTimeLimit}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>Refund Request Details</h3>
            <div className="form-group">
              <label>Reason for Refund Request *</label>
              <select
                name="refundReason"
                value={formData.refundReason}
                onChange={handleChange}
                required
                disabled={!isWithinTimeLimit}
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
                placeholder="Briefly explain the problem..."
                rows="4"
                required
                disabled={!isWithinTimeLimit}
              />
            </div>
          </div>

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
                  disabled={!isWithinTimeLimit}
                  className="file-input"
                />
                <p className="upload-hint">
                  Upload your receipt image or PDF file as proof of transaction.
                  <br />
                  <small>Accepted formats: JPG, JPEG, PNG, PDF (Max 5MB)</small>
                </p>
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

          <div className="terms-section">
            <h3>Terms and Conditions</h3>
            <ul>
              <li>This refund form is intended only for actual product or transaction issues.</li>
              <li>The administrator will use recorded transaction data as the primary reference.</li>
              <li>Only requests submitted within four (4) hours after the transaction will be accepted.</li>
              <li>Refunds will only be considered if the dispensed product is proven defective.</li>
              <li>The staff may inspect the grain vending machine for validation.</li>
            </ul>
          </div>

          <div className="form-actions">
            <button type="button" onClick={handleReset} className="btn-reset" disabled={!isWithinTimeLimit}>
              Reset Form
            </button>
            <button type="submit" className="btn-submit" disabled={loading || !isWithinTimeLimit}>
              {loading ? 'Submitting...' : 'Submit Refund Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RefundRequest;