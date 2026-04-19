import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './CustomerPages.css';

const CustomerProfile = () => {
  const { user } = useAuth();

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">My Profile</h1>
        <p className="page-description">View and manage your account information</p>
      </div>

      <div className="profile-grid">
        {/* Personal Information Card */}
        <div className="profile-card main-card">
          <div className="card-header">
            <h2>Personal Information</h2>
          </div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-row">
                <div className="info-label">First Name</div>
                <div className="info-value">{user?.firstName || '—'}</div>
              </div>
              <div className="info-row">
                <div className="info-label">Last Name</div>
                <div className="info-value">{user?.lastName || '—'}</div>
              </div>
              <div className="info-row full-width">
                <div className="info-label">Email Address</div>
                <div className="info-value email">{user?.email || '—'}</div>
              </div>
              <div className="info-row full-width">
                <div className="info-label">Phone Number</div>
                <div className="info-value">{user?.phone || 'Not provided'}</div>
              </div>
              <div className="info-row full-width">
                <div className="info-label">Delivery Address</div>
                <div className="info-value address">{user?.address || 'Not provided'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Account Information Card */}
        <div className="profile-card sidebar-card">
          <div className="card-header">
            <h2>Account Details</h2>
          </div>
          <div className="card-body">
            <div className="account-stats">
              <div className="stat-item">
                <div className="stat-icon">📊</div>
                <div className="stat-details">
                  <span className="stat-label">Account Type</span>
                  <span className="stat-value capitalize">{user?.role || 'Customer'}</span>
                </div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">✅</div>
                <div className="stat-details">
                  <span className="stat-label">Terms Accepted</span>
                  <span className={`stat-value ${user?.termsAccepted ? 'text-green' : 'text-gray'}`}>
                    {user?.termsAccepted ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">📅</div>
                <div className="stat-details">
                  <span className="stat-label">Member Since</span>
                  <span className="stat-value">{formatDate(user?.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Card */}
        <div className="profile-card actions-card">
          <div className="card-header">
            <h2>Quick Actions</h2>
          </div>
          <div className="card-body">
            <div className="actions-grid">
              <button className="action-btn" onClick={() => window.location.href = '/customer/returns/create'}>
                <span className="action-icon">↩️</span>
                <span>Request Return</span>
              </button>
              <button className="action-btn" onClick={() => window.location.href = '/customer/messages'}>
                <span className="action-icon">💬</span>
                <span>Contact Support</span>
              </button>
              <button className="action-btn" onClick={() => window.location.href = '/customer/transactions'}>
                <span className="action-icon">📝</span>
                <span>View Transactions</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerProfile;