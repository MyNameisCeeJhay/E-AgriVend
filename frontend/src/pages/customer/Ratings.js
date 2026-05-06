const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import './CustomerPages.css';



const CustomerRatings = () => {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [commentType, setCommentType] = useState('suggestion');
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({
    average: 0,
    total: 0,
    suggestions: 0,
    issues: 0
  });
  const [notification, setNotification] = useState(null);
  
  const { user } = useAuth();
  const { socket } = useSocket();

  // Fetch ratings and stats on mount
  useEffect(() => {
    if (user) {
      fetchRatings();
      fetchStats();
    }
  }, [user]);

  // Socket listener for new replies
  useEffect(() => {
    if (!socket || !user) return;

    console.log('🔌 Setting up rating reply listener');

    const handleRatingReply = (data) => {
      console.log('📩 Rating reply received:', data);
      if (data.userId === user._id) {
        setNotification({
          type: 'reply',
          message: 'Admin replied to your feedback'
        });
        fetchRatings(); // Refresh to show the reply
        
        // Show browser notification
        if (Notification.permission === 'granted') {
          new Notification('New Reply', {
            body: 'Admin replied to your feedback',
            icon: '/logo192.png'
          });
        }
      }
    };

    socket.on('rating_reply_notification', handleRatingReply);

    return () => {
      socket.off('rating_reply_notification', handleRatingReply);
    };
  }, [socket, user]);

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Request notification permission
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/ratings/machine`);
      setRatings(response.data.data || []);
      setError('');
    } catch (error) {
      console.error('Error fetching ratings:', error);
      setError('Failed to load ratings');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/ratings/machine/stats`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    
    if (!comment.trim()) {
      setError('Please enter your feedback');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      await axios.post(`${API_URL}/ratings/machine`, {
        rating,
        comment,
        commentType
      });
      
      // Reset form
      setShowRatingForm(false);
      setRating(0);
      setComment('');
      setCommentType('suggestion');
      
      // Refresh data
      await fetchRatings();
      await fetchStats();
      
      setNotification({
        type: 'success',
        message: 'Thank you for your feedback!'
      });
      
    } catch (error) {
      console.error('Error submitting rating:', error);
      setError(error.response?.data?.error || 'Failed to submit rating');
    } finally {
      setSubmitting(false);
    }
  };

  const markReplyAsSeen = async (ratingId) => {
    try {
      await axios.put(`${API_URL}/ratings/machine/${ratingId}/mark-seen`);
    } catch (error) {
      console.error('Error marking reply as seen:', error);
    }
  };

  const getStarDisplay = (rating) => {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTypeIcon = (type) => {
    return type === 'suggestion' ? '💡' : '⚠️';
  };

  if (!user) {
    return (
      <div className="customer-dashboard">
        <div className="empty-state">
          <div className="empty-icon">⭐</div>
          <h3>Please Log In</h3>
          <p>You need to be logged in to rate the machine.</p>
          <Link to="/login" className="btn-primary">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-dashboard">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-icon">
            {notification.type === 'reply' ? '💬' : '✅'}
          </span>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Machine Feedback</h1>
          <p className="page-description">Rate our vending machine and share your suggestions</p>
        </div>
        {!showRatingForm && (
          <button 
            className="btn-primary"
            onClick={() => setShowRatingForm(true)}
          >
            + Rate Machine
          </button>
        )}
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {/* Rating Form */}
      {showRatingForm && (
        <div className="rating-form-card">
          <div className="form-header">
            <h3>Share Your Feedback</h3>
            <button className="close-btn" onClick={() => setShowRatingForm(false)}>×</button>
          </div>
          
          <form onSubmit={handleRatingSubmit}>
            {/* Star Rating */}
            <div className="rating-stars-container">
              <label className="rating-label">Rate Your Experience</label>
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
                {rating === 1 && 'Poor - Needs improvement'}
                {rating === 2 && 'Fair - Could be better'}
                {rating === 3 && 'Good - Meets expectations'}
                {rating === 4 && 'Very Good - Satisfied'}
                {rating === 5 && 'Excellent - Love it!'}
              </div>
            </div>

            {/* Comment Type */}
            <div className="form-group">
              <label className="form-label">Feedback Type</label>
              <div className="comment-type-buttons">
                <button
                  type="button"
                  className={`type-btn ${commentType === 'suggestion' ? 'active' : ''}`}
                  onClick={() => setCommentType('suggestion')}
                >
                  💡 Suggestion
                </button>
                <button
                  type="button"
                  className={`type-btn ${commentType === 'issue' ? 'active' : ''}`}
                  onClick={() => setCommentType('issue')}
                >
                  ⚠️ Report Issue
                </button>
              </div>
            </div>

            {/* Comment */}
            <div className="form-group">
              <label className="form-label">
                {commentType === 'suggestion' ? 'Your Suggestion' : 'Describe the Issue'}
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows="4"
                className="form-textarea"
                placeholder={commentType === 'suggestion' 
                  ? "Share your ideas to improve our machine..." 
                  : "Tell us what problem you experienced..."}
                required
              />
            </div>

            {/* Action Buttons */}
            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setShowRatingForm(false);
                  setRating(0);
                  setComment('');
                  setError('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={rating === 0 || !comment.trim() || submitting}
                className="btn-primary"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Machine Stats */}
      {!loading && ratings.length > 0 && (
        <div className="machine-stats-card">
          <h3>Machine Rating Overview</h3>
          <div className="stats-row">
            <div className="stat-item large">
              <span className="stat-label">Average Rating</span>
              <div className="average-rating">
                <span className="average-number">{stats.average}</span>
                <span className="average-stars">
                  {getStarDisplay(Math.round(stats.average))}
                </span>
              </div>
            </div>
            <div className="stat-item">
              <span className="stat-label">Total Ratings</span>
              <span className="stat-number">{stats.total}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Suggestions</span>
              <span className="stat-number success">{stats.suggestions}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Issues</span>
              <span className="stat-number warning">{stats.issues}</span>
            </div>
          </div>
        </div>
      )}

      {/* Ratings List */}
      {loading ? (
        <div className="loading-state">Loading feedback...</div>
      ) : ratings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">💭</div>
          <h3>No Feedback Yet</h3>
          <p>Be the first to rate our machine and share your suggestions!</p>
          <button 
            onClick={() => setShowRatingForm(true)} 
            className="btn-primary"
          >
            Rate Machine
          </button>
        </div>
      ) : (
        <div className="ratings-grid">
          {ratings.map((item) => (
            <div 
              key={item._id} 
              className={`rating-card ${item.commentType} ${!item.replySeenByCustomer && item.adminReply ? 'has-new-reply' : ''}`}
              onClick={() => {
                if (!item.replySeenByCustomer && item.adminReply) {
                  markReplyAsSeen(item._id);
                }
              }}
            >
              {/* New Reply Indicator */}
              {!item.replySeenByCustomer && item.adminReply && (
                <div className="new-reply-badge">
                  <span className="new-dot">●</span>
                  <span>New reply</span>
                </div>
              )}

              <div className="rating-header">
                <div className="rating-stars">
                  <span className="stars-display">{getStarDisplay(item.rating)}</span>
                  <span className="rating-value">{item.rating}/5</span>
                </div>
                <span className="rating-date">{formatDate(item.createdAt)}</span>
              </div>
              
              <div className="rating-type">
                <span className={`type-badge ${item.commentType}`}>
                  {getTypeIcon(item.commentType)} {item.commentType === 'suggestion' ? 'Suggestion' : 'Issue Report'}
                </span>
              </div>
              
              <div className="rating-comment">
                <p>{item.comment}</p>
              </div>

              {/* Admin Reply Section */}
              {item.adminReply && (
                <div className="admin-reply">
                  <div className="reply-header">
                    <span className="reply-label">Admin Response</span>
                    <span className="reply-date">{formatDate(item.repliedAt)}</span>
                  </div>
                  <p className="reply-content">{item.adminReply}</p>
                </div>
              )}

              <div className="rating-footer">
                <span className="rating-user">
                  By: {item.user?.firstName || 'You'} {item.user?.lastName || ''}
                </span>
                {item.adminReply && !item.replySeenByCustomer && (
                  <span className="new-indicator">New</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomerRatings;
