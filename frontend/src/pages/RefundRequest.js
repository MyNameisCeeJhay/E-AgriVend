const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './RefundRequest.css';

// Helper function to format transaction ID for display/validation
const formatTransactionId = (transactionNumber) => {
  return transactionNumber.trim().toUpperCase();
};

// Helper function to validate transaction ID format
const isValidTransactionFormat = (transactionNumber) => {
  if (!transactionNumber || !transactionNumber.startsWith('TXN-')) {
    return false;
  }
  return transactionNumber.length > 4;
};

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
  
  // State for dynamic products
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const DEFAULT_PRODUCTS = [
    { id: 1, name: 'Sinandomeng Rice', price: 54.00 },
    { id: 2, name: 'Dinorado Rice', price: 65.00 },
    { id: 3, name: 'Jasmine Rice', price: 70.00 },
    { id: 4, name: 'Premium Rice', price: 85.00 },
    { id: 5, name: 'Brown Rice', price: 60.00 },
    { id: 6, name: 'Glutinous Rice', price: 75.00 },
    { id: 7, name: 'Organic Rice', price: 90.00 },
    { id: 8, name: 'Malagkit Rice', price: 65.00 }
  ];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      const token = localStorage.getItem('token');
      
      try {
        const response = await axios.get(`${API_URL}/staff/products`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        if (response.data && response.data.success) {
          const activeProducts = response.data.data.filter(product => !product.isArchived);
          const formattedProducts = activeProducts.map(product => ({
            id: product.id || product._id,
            name: product.name,
            price: product.price
          }));
          
          const allProductNames = new Set(formattedProducts.map(p => p.name));
          const mergedProducts = [...formattedProducts];
          
          DEFAULT_PRODUCTS.forEach(defaultProduct => {
            if (!allProductNames.has(defaultProduct.name)) {
              mergedProducts.push(defaultProduct);
            }
          });
          
          setProducts(mergedProducts);
        } else {
          setProducts(DEFAULT_PRODUCTS);
        }
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts(DEFAULT_PRODUCTS);
      }
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleValidateTransaction = async () => {
    const formattedTransactionNumber = formatTransactionId(formData.transactionNumber);
    
    if (!formattedTransactionNumber) {
      setError('Please enter a transaction number');
      return;
    }
    
    if (!isValidTransactionFormat(formattedTransactionNumber)) {
      setError('Invalid transaction number format');
      return;
    }
    
    setValidating(true);
    setError('');
    
    try {
      console.log('Validating transaction:', formattedTransactionNumber);
      const response = await axios.get(`${API_URL}/refund/validate/${formattedTransactionNumber}`);
      
      console.log('Validation response:', response.data);
      
      if (response.data.success) {
        const transaction = response.data.data;
        
        console.log('Transaction data:', transaction);
        
        // Get the product name from transaction
        const transactionProduct = transaction.productName || transaction.riceType;
        console.log('Product name:', transactionProduct);
        console.log('Quantity:', transaction.quantityKg);
        console.log('Amount:', transaction.amountPaid);
        
        // Store transaction data and mark as valid
        setTransactionData(transaction);
        setTransactionValid(true);
        
        // Auto-fill the product details from transaction
        setFormData(prev => ({
          ...prev,
          transactionNumber: formattedTransactionNumber,
          transactionDate: new Date(transaction.createdAt).toLocaleDateString('en-US'),
          transactionTime: new Date(transaction.createdAt).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
          }),
          grainType: transactionProduct || '',
          selectedQuantity: transaction.quantityKg?.toString() || '',
          amountInserted: transaction.amountPaid?.toString() || ''
        }));
        
        // Check 4-hour time limit
        const transactionTime = new Date(transaction.createdAt);
        const now = new Date();
        const hoursDiff = (now - transactionTime) / (1000 * 60 * 60);
        
        if (hoursDiff > 4) {
          setIsWithinTimeLimit(false);
          setError('This transaction is outside the 4-hour refund window.');
          setTransactionValid(false);
        } else {
          setIsWithinTimeLimit(true);
          startCountdown(transactionTime);
          setError('');
        }
      } else {
        setError('Transaction validation failed');
      }
    } catch (error) {
      console.error('Error validating transaction:', error);
      if (error.response?.status === 404) {
        setError('Transaction not found. Please check your transaction number.');
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
        setSuccess('Your refund request has been submitted successfully!');
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

  const getTransactionFormatExample = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `TXN-${year}${month}${day}-${hours}${minutes}${seconds}-XXX`;
  };

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
            This form is intended only for customers who experienced an actual problem with their 
            product or transaction. Please provide complete and accurate details.
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
            <div className="countdown-label">Time remaining:</div>
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
                    placeholder={`Format: ${getTransactionFormatExample()}`}
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
                <small className="format-hint">
                  Format: TXN-YYYYMMDD-HHMMSS-XXX
                </small>
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

          {/* Product Details - AUTO-FILLED (Read Only) */}
          <div className="form-section">
            <h3>Product Details <span className="auto-badge">(Auto-filled from transaction)</span></h3>
            <div className="form-row">
              <div className="form-group">
                <label>Grain Type *</label>
                <input
                  type="text"
                  name="grainType"
                  value={formData.grainType}
                  readOnly
                  className="readonly-field"
                  placeholder={transactionValid ? "Loading..." : "Validate transaction first"}
                />
                {transactionValid && formData.grainType && (
                  <small className="auto-filled-note">✓ Loaded: {formData.grainType}</small>
                )}
              </div>
              <div className="form-group">
                <label>Selected Quantity (kg) *</label>
                <input
                  type="text"
                  name="selectedQuantity"
                  value={formData.selectedQuantity}
                  readOnly
                  className="readonly-field"
                  placeholder={transactionValid ? "Loading..." : "Validate transaction first"}
                />
                {transactionValid && formData.selectedQuantity && (
                  <small className="auto-filled-note">✓ Loaded: {formData.selectedQuantity} kg</small>
                )}
              </div>
              <div className="form-group">
                <label>Amount Inserted (₱) *</label>
                <input
                  type="text"
                  name="amountInserted"
                  value={formData.amountInserted}
                  readOnly
                  className="readonly-field"
                  placeholder={transactionValid ? "Loading..." : "Validate transaction first"}
                />
                {transactionValid && formData.amountInserted && (
                  <small className="auto-filled-note">✓ Loaded: ₱{formData.amountInserted}</small>
                )}
              </div>
            </div>
            {!transactionValid && (
              <div className="info-message">
                ℹ️ Please click "Validate" to auto-fill product details from your transaction
              </div>
            )}
          </div>

          {/* Refund Request Details - MANUAL INPUT */}
          <div className="form-section">
            <h3>Refund Request Details <span className="manual-badge">(Please fill manually)</span></h3>
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
              {!transactionValid && (
                <small className="info-note">Validate transaction first to enable</small>
              )}
            </div>
            <div className="form-group">
              <label>Description / Comment *</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Please explain in detail what problem you encountered during the transaction..."
                rows="4"
                required
                disabled={!transactionValid || !isWithinTimeLimit}
              />
              {!transactionValid && (
                <small className="info-note">Validate transaction first to enable</small>
              )}
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
              {!transactionValid && (
                <small className="info-note">Validate transaction first to enable upload</small>
              )}
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="terms-section">
            <h3>Terms and Conditions</h3>
            <ul>
              <li>This form is intended only for actual product or transaction issues.</li>
              <li>The administrator will use recorded transaction data for evaluation.</li>
              <li>Only requests submitted within four (4) hours after the transaction will be accepted.</li>
              <li>Refunds will only be considered if the product is proven defective.</li>
            </ul>
          </div>

          {/* Form Actions */}
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