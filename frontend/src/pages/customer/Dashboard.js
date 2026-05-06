const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './CustomerDashboard.css';



const CustomerDashboard = () => {
  const { user } = useAuth();
  const { sensorData } = useSocket();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalSpent: 0,
    totalKg: 0,
    transactionCount: 0
  });

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API_URL}/transactions`);
      const data = response.data.data || response.data;
      setTransactions(data.slice(0, 5));
      
      const totalSpent = data.reduce((sum, t) => sum + (t.amountPaid || 0), 0);
      const totalKg = data.reduce((sum, t) => sum + (t.quantityKg || 0), 0);
      
      setStats({
        totalSpent,
        totalKg,
        transactionCount: data.length
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="customer-dashboard">
      {/* Welcome Section */}
      <div className="welcome-section">
        <h1 className="welcome-title">
          Welcome back, <span>{user?.firstName || 'User'}</span>
        </h1>
        <p className="welcome-subtitle">Here's what's happening with your account</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-label">Total Transactions</div>
            <div className="stat-value">{stats.transactionCount}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-label">Total Spent</div>
            <div className="stat-value green">₱{stats.totalSpent.toFixed(2)}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🌾</div>
          <div className="stat-content">
            <div className="stat-label">Total Rice</div>
            <div className="stat-value">
              {stats.totalKg.toFixed(2)} <span className="stat-unit">kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Status */}
      {sensorData && (
        <div className="machine-status-card">
          <h2 className="section-title">Machine Status</h2>
          <div className="machine-status-grid">
            <div className="status-item">
              <span className="status-label">Sinandomeng</span>
              <div className="status-value-row">
                <span className="status-number">{sensorData.container1Level?.toFixed(1)} kg</span>
                <span className={`status-badge ${sensorData.container1Stock?.toLowerCase()}`}>
                  {sensorData.container1Stock}
                </span>
              </div>
            </div>
            <div className="status-item">
              <span className="status-label">Dinorado</span>
              <div className="status-value-row">
                <span className="status-number">{sensorData.container2Level?.toFixed(1)} kg</span>
                <span className={`status-badge ${sensorData.container2Stock?.toLowerCase()}`}>
                  {sensorData.container2Stock}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="transactions-card">
        <div className="card-header">
          <h2 className="section-title">Recent Transactions</h2>
          <Link to="/customer/transactions" className="view-all-link">
            View All →
          </Link>
        </div>

        {loading ? (
          <div className="loading-state">Loading...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">No transactions yet</div>
        ) : (
          <div className="transactions-list">
            {transactions.map((transaction) => (
              <div key={transaction._id} className="transaction-item">
                <div className="transaction-info">
                  <div className="transaction-type">{transaction.riceType}</div>
                  <div className="transaction-meta">
                    <span className="transaction-quantity">{transaction.quantityKg} kg</span>
                    <span className="transaction-date">{formatDate(transaction.createdAt)}</span>
                  </div>
                </div>
                <div className="transaction-amount">₱{transaction.amountPaid}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-grid">
        <Link to="/customer/ratings" className="action-card">
          <h3>My Ratings</h3>
          <p>View and manage your reviews</p>
        </Link>
        <Link to="/customer/returns/create" className="action-card">
          <h3>Request Return</h3>
          <p>Return a product if you're not satisfied</p>
        </Link>
        <Link to="/customer/messages" className="action-card">
          <h3>Contact Support</h3>
          <p>Send us a message or ask for help</p>
        </Link>
      </div>
    </div>
  );
};

export default CustomerDashboard;
