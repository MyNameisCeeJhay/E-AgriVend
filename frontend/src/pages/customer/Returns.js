const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import './CustomerDashboard.css';



const CustomerReturns = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchReturns();
    }
  }, [user]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/returns/my-returns`);
      setReturns(response.data.data || []);
      setError('');
    } catch (error) {
      console.error('Error fetching returns:', error);
      if (error.response?.status === 401) {
        setError('Please log in to view your returns');
      } else {
        setError('Failed to load returns. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status) => {
    switch(status) {
      case 'PENDING': return 'status-pending';
      case 'APPROVED': return 'status-approved';
      case 'REJECTED': return 'status-rejected';
      default: return '';
    }
  };

  const getStatusText = (status) => {
    switch(status) {
      case 'PENDING': return '⏳ Pending';
      case 'APPROVED': return '✅ Approved';
      case 'REJECTED': return '❌ Rejected';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (!user) {
    return (
      <div className="customer-dashboard">
        <div className="empty-state">
          <div className="empty-icon">🔒</div>
          <h3>Please Log In</h3>
          <p>You need to be logged in to view your returns.</p>
          <Link to="/login" className="btn-primary">Go to Login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="customer-dashboard">
      <div className="page-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <div>
          <h1 className="page-title">My Returns</h1>
          <p className="page-description">Track your return requests</p>
        </div>
        <Link to="/customer/returns/create" className="btn-primary">
          + Request Return
        </Link>
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading returns...</div>
      ) : returns.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>No Return Requests</h3>
          <p>You haven't submitted any return requests yet.</p>
          <Link to="/customer/returns/create" className="btn-primary">
            Request a Return
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((returnReq) => (
                  <tr key={returnReq._id}>
                    <td>
                      <span className="return-id">{returnReq.returnId}</span>
                    </td>
                    <td>{formatDate(returnReq.createdAt)}</td>
                    <td>{returnReq.riceType}</td>
                    <td>{returnReq.quantityKg} kg</td>
                    <td className="amount-cell">₱{returnReq.amountPaid}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(returnReq.status)}`}>
                        {getStatusText(returnReq.status)}
                      </span>
                    </td>
                    <td>
                      <div className="reason-cell" title={returnReq.returnReason}>
                        {returnReq.returnReason?.length > 30 
                          ? returnReq.returnReason.substring(0, 30) + '...' 
                          : returnReq.returnReason}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerReturns;
