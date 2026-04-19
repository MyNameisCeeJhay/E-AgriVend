import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import './Auth.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Register = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    phone: '',
    address: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTerms, setShowTerms] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsContent, setTermsContent] = useState('');
  const [loadingTerms, setLoadingTerms] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    setLoadingTerms(true);
    try {
      const response = await axios.get(`${API_URL}/terms/current`);
      setTermsContent(response.data.terms?.content || response.data.content || defaultTerms());
    } catch (error) {
      console.error('Error fetching terms:', error);
      setTermsContent(defaultTerms());
    } finally {
      setLoadingTerms(false);
    }
  };

  const defaultTerms = () => {
    return `TERMS AND CONDITIONS

1. ACCEPTANCE OF TERMS
By accessing and using the AgriVend rice vending machine and associated services, you accept and agree to be bound by these Terms and Conditions.

2. MACHINE USAGE
- The vending machine accepts both coins and bills as payment.
- All transactions are final unless there is a machine malfunction.
- The machine dispenses rice based on the exact value of payment inserted.
- Maximum transaction limit is 5kg per customer.

3. RETURNS AND REFUNDS
- Returns are accepted only for machine malfunctions or incorrect dispensing.
- Return requests must be submitted within 24 hours of purchase.
- Valid receipt or proof of purchase is required for all returns.
- Refunds will be processed within 3-5 business days upon approval.

4. USER ACCOUNTS
- You are responsible for maintaining the confidentiality of your account.
- You must provide accurate and complete information when registering.
- We reserve the right to suspend or terminate accounts for violations.

5. PRIVACY POLICY
- We collect personal information necessary for transaction processing.
- Your data will not be shared with third parties without consent.
- Transaction records are stored for reporting and analysis purposes.

6. LIMITATION OF LIABILITY
- AgriVend is not liable for any indirect or consequential damages.
- Our maximum liability shall not exceed the amount paid for the product.

7. CHANGES TO TERMS
- We reserve the right to modify these terms at any time.
- Continued use of the service constitutes acceptance of new terms.

8. CONTACT INFORMATION
For questions or concerns, please contact:
Email: support@agrivend.com
Store: GC Rice & Trading Store, Loma De Gato, Marilao, Bulacan`;
  };

  const handleAcceptTerms = () => {
    if (!termsAccepted) {
      setError('Please accept the terms and conditions to continue');
      return;
    }
    setShowTerms(false);
    setError('');
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    const { confirmPassword, ...userData } = formData;
    
    try {
      const result = await register(userData);
      if (result.success) {
        navigate('/login');
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  if (showTerms) {
    return (
      <div className="auth-container">
        <div className="terms-fullpage">
          <div className="terms-container">
            <div className="terms-header">
              <h1>Terms and Conditions</h1>
              <p>Please read and accept the terms to continue</p>
            </div>
            
            <div className="terms-body">
              {loadingTerms ? (
                <div className="loading-spinner">Loading terms...</div>
              ) : (
                <>
                  <div className="terms-content-full">
                    {termsContent.split('\n').map((paragraph, index) => {
                      if (paragraph.trim() === '') return <br key={index} />;
                      if (paragraph.match(/^\d+\./)) {
                        return <h3 key={index}>{paragraph}</h3>;
                      }
                      if (paragraph.startsWith('-')) {
                        return <li key={index}>{paragraph.substring(1)}</li>;
                      }
                      return <p key={index}>{paragraph}</p>;
                    })}
                  </div>
                  
                  <div className="terms-acceptance-full">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(e) => setTermsAccepted(e.target.checked)}
                      />
                      <span>I have read and agree to the Terms and Conditions</span>
                    </label>
                  </div>
                </>
              )}
            </div>
            
            <div className="terms-footer">
              <button 
                className="btn-secondary" 
                onClick={() => navigate('/login')}
              >
                Cancel
              </button>
              <button 
                className="btn-primary" 
                onClick={handleAcceptTerms}
                disabled={!termsAccepted || loadingTerms}
              >
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card large">
        <div className="auth-header">
          <div className="auth-logo">
            <span className="auth-logo-icon">🌾</span>
          </div>
          <h1 className="auth-title">
            <span>Create</span> Account
          </h1>
          <p className="auth-subtitle">
            Join AgriVend today! Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
        
        {error && (
          <div className="auth-error">
            {error}
          </div>
        )}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">
                First Name <span className="required-star">*</span>
              </label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter first name"
                disabled={loading}
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">
                Last Name <span className="required-star">*</span>
              </label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter last name"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Email Address <span className="required-star">*</span>
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon">📧</span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Enter your email"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Phone Number
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon">📞</span>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="form-input"
                placeholder="Enter your phone number (optional)"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Address
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon">📍</span>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="2"
                className="form-textarea"
                placeholder="Enter your address (optional)"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Password <span className="required-star">*</span>
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon">🔒</span>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Create a password (min. 6 characters)"
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">
              Confirm Password <span className="required-star">*</span>
            </label>
            <div className="input-icon-wrapper">
              <span className="input-icon">✓</span>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                className="form-input"
                placeholder="Confirm your password"
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`auth-button ${loading ? 'loading' : ''}`}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;