const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CustomerPages.css';



const RateTransaction = () => {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API_URL}/ratings`, {
        transactionId,
        rating,
        comment
      });
      navigate('/customer/transactions');
    } catch (error) {
      console.error('Error submitting rating:', error);
      alert('Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="form-container">
        {/* Page Header */}
        <div className="page-header text-center">
          <h1 className="page-title">Rate Your Purchase</h1>
          <p className="page-description">Share your experience with this transaction</p>
        </div>

        {/* Rating Card */}
        <div className="rating-card">
          <div className="transaction-info">
            <span className="transaction-id-label">Transaction ID:</span>
            <span className="transaction-id-value">{transactionId}</span>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Star Rating */}
            <div className="rating-stars-container">
              <label className="rating-label">Your Rating</label>
              <div className="stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHover(star)}
                    onMouseLeave={() => setHover(0)}
                    className={`star-btn ${(hover || rating) >= star ? 'active' : ''}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div className="rating-text">
                {rating === 1 && 'Poor'}
                {rating === 2 && 'Fair'}
                {rating === 3 && 'Good'}
                {rating === 4 && 'Very Good'}
                {rating === 5 && 'Excellent'}
              </div>
            </div>

            {/* Comment */}
            <div className="form-group">
              <label className="form-label">Review (Optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows="4"
                className="form-textarea"
                placeholder="Tell us about your experience with this product..."
              />
            </div>

            {/* Action Buttons */}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => navigate('/customer/transactions')}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rating === 0 || loading}
                className="btn-primary"
              >
                {loading ? 'Submitting...' : 'Submit Rating'}
              </button>
            </div>
          </form>
        </div>

        {/* Rating Guidelines */}
        <div className="guidelines-card">
          <h4>Rating Guidelines</h4>
          <ul>
            <li>⭐ - Poor: Product was not as expected</li>
            <li>⭐⭐ - Fair: Average experience</li>
            <li>⭐⭐⭐ - Good: Met expectations</li>
            <li>⭐⭐⭐⭐ - Very Good: Above expectations</li>
            <li>⭐⭐⭐⭐⭐ - Excellent: Outstanding experience</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RateTransaction;
