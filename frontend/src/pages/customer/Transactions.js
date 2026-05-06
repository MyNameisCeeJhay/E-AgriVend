const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './CustomerPages.css';



const CustomerTransactions = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`${API_URL}/transactions`);
      setTransactions(response.data.data || response.data);
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
      minute: '2-digit'
    });
  };

  const getStatusClass = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed': return 'status-completed';
      case 'pending': return 'status-pending';
      case 'failed': return 'status-failed';
      default: return 'status-default';
    }
  };

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Transactions</h1>
          <p className="page-description">View your complete purchase history</p>
        </div>
        <div className="header-stats">
          <div className="header-stat">
            <span className="stat-label">Total Transactions</span>
            <span className="stat-number">{transactions.length}</span>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="loading-state">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Transactions Found</h3>
          <p>Your transactions will appear here once you make a purchase.</p>
          <Link to="/customer/dashboard" className="btn-primary">Go to Dashboard</Link>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Rice Type</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction._id}>
                    <td>
                      <div className="date-cell">{formatDate(transaction.createdAt)}</div>
                    </td>
                    <td>
                      <div className="rice-type">{transaction.riceType}</div>
                    </td>
                    <td>
                      <div className="quantity-cell">{transaction.quantityKg} kg</div>
                    </td>
                    <td>
                      <div className="amount-cell">₱{transaction.amountPaid}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusClass(transaction.status)}`}>
                        {transaction.status}
                      </span>
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

export default CustomerTransactions;
