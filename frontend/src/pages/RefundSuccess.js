import React from 'react';
import { Link } from 'react-router-dom';
import './RefundRequest.css';

const RefundSuccess = () => {
  return (
    <div className="refund-container">
      <div className="refund-card">
        <div className="refund-header">
          <h1>🌾 AgriVend</h1>
          <h2>Request Submitted Successfully!</h2>
        </div>
        
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
          <h3>Your refund request has been received</h3>
          <p style={{ marginTop: '1rem', color: '#6b7280' }}>
            The administrator will review your request and contact you via email within 3-5 business days.
          </p>
          <Link to="/" className="btn-submit" style={{ display: 'inline-block', marginTop: '2rem', textDecoration: 'none' }}>
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default RefundSuccess;