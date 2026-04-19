import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './Transactions.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminTransactions = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today: 0,
    week: 0,
    month: 0,
    total: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1,
    limit: 20
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    riceType: 'all',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchTransactions();
    fetchStats();

    if (socket) {
      socket.on('new_transaction', () => {
        fetchTransactions();
        fetchStats();
      });

      return () => {
        socket.off('new_transaction');
      };
    }
  }, [socket, pagination.page, filters]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...filters
      };
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.riceType !== 'all') params.riceType = filters.riceType;
      if (filters.search) params.search = filters.search;

      const response = await axios.get(`${API_URL}/admin/transactions`, { params });
      setTransactions(response.data.data || []);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showNotification('error', 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/transactions/stats`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, page: 1 });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPagination({ ...pagination, page: 1 });
    fetchTransactions();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatShortDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="admin-page-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Transaction History</h1>
          <p className="page-description">
            View and manage all vending machine transactions
          </p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-secondary"
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Today's Sales</div>
            <div className="stat-value success">{formatCurrency(stats.today)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">This Week</div>
            <div className="stat-value">{formatCurrency(stats.week)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">This Month</div>
            <div className="stat-value">{formatCurrency(stats.month)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Total Sales</div>
            <div className="stat-value">{formatCurrency(stats.total)}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="filters-card">
          <form onSubmit={handleSearch} className="filters-form">
            <div className="filter-row">
              <div className="filter-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="filter-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="filter-group">
                <label>Rice Type</label>
                <select
                  value={filters.riceType}
                  onChange={(e) => handleFilterChange('riceType', e.target.value)}
                  className="form-select"
                >
                  <option value="all">All Types</option>
                  <option value="Sinandomeng">Sinandomeng</option>
                  <option value="Dinorado">Dinorado</option>
                  <option value="Jasmine">Jasmine</option>
                  <option value="Premium">Premium</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Search</label>
                <input
                  type="text"
                  placeholder="Transaction ID or Customer"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="form-input"
                />
              </div>
            </div>
            <div className="filter-actions">
              <button type="submit" className="btn-primary">Apply Filters</button>
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => {
                  setFilters({
                    startDate: '',
                    endDate: '',
                    riceType: 'all',
                    search: ''
                  });
                  setPagination({ ...pagination, page: 1 });
                }}
              >
                Clear Filters
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Transactions Table */}
      {loading ? (
        <div className="loading-state">Loading transactions...</div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">
          <h3>No Transactions Found</h3>
          <p>No transactions match your search criteria.</p>
        </div>
      ) : (
        <div className="table-card">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Unit Price</th>
                  <th>Total Amount</th>
                  <th>Payment Method</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction._id}>
                    <td>
                      <span className="transaction-id">
                        {transaction.transactionId || transaction._id.slice(-8).toUpperCase()}
                      </span>
                    </td>
                    <td>{formatDate(transaction.createdAt)}</td>
                    <td>{transaction.riceType}</td>
                    <td>{transaction.quantityKg} kg</td>
                    <td>{formatCurrency(transaction.unitPrice || transaction.totalAmount / transaction.quantityKg)}</td>
                    <td className="amount-cell">{formatCurrency(transaction.totalAmount)}</td>
                    <td>
                      <span className="payment-badge">
                        {transaction.paymentMethod || 'Cash'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            disabled={pagination.page === 1}
            className="pagination-btn"
          >
            Previous
          </button>
          <span className="page-info">
            Page {pagination.page} of {pagination.pages} ({pagination.total} transactions)
          </span>
          <button
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            disabled={pagination.page === pagination.pages}
            className="pagination-btn"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminTransactions;