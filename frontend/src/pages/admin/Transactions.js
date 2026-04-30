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
  const [summary, setSummary] = useState({
    totalTransactions: 0,
    totalQuantity: 0,
    totalRevenue: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1,
    limit: 15
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    productName: 'all',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchTransactions();
    fetchSummary();

    if (socket) {
      socket.on('new_transaction', () => {
        fetchTransactions();
        fetchSummary();
        showNotification('success', 'New transaction added');
      });

      return () => {
        socket.off('new_transaction');
      };
    }
  }, [socket, pagination.page, filters]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_URL}/transactions/all`, {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          startDate: filters.startDate,
          endDate: filters.endDate,
          productName: filters.productName,
          search: filters.search
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        let data = response.data.data || [];
        
        data.sort((a, b) => {
          let aVal = a[sortBy];
          let bVal = b[sortBy];
          if (sortBy === 'createdAt') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
          }
          if (sortBy === 'productName') {
            aVal = a.productName || a.riceType;
            bVal = b.productName || b.riceType;
          }
          if (sortOrder === 'desc') {
            return aVal > bVal ? -1 : 1;
          } else {
            return aVal < bVal ? -1 : 1;
          }
        });
        
        setTransactions(data);
        setPagination(response.data.pagination || {
          page: 1,
          total: data.length,
          pages: Math.ceil(data.length / pagination.limit)
        });
        setSummary(response.data.summary || {
          totalTransactions: data.length,
          totalQuantity: data.reduce((s, t) => s + (t.quantityKg || 0), 0),
          totalRevenue: data.reduce((s, t) => s + (t.amountPaid || 0), 0)
        });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showNotification('error', error.response?.data?.error || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/transactions/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSummary(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
    setPagination({ ...pagination, page: 1 });
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
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
      hour12: true
    });
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span className="sort-icon">↕</span>;
    return sortOrder === 'desc' ? <span className="sort-icon">↓</span> : <span className="sort-icon">↑</span>;
  };

  const productNames = ['Sinandomeng', 'Dinorado', 'Jasmine', 'Premium', 'Brown Rice', 'Glutinous Rice', 'Organic Rice'];

  const getDisplayProductName = (transaction) => {
    return transaction.productName || transaction.riceType || 'Unknown';
  };

  return (
    <div className="transactions-container">
      {notification && (
        <div className={`transaction-toast ${notification.type}`}>
          <div className="toast-content">
            <span className="toast-icon">{notification.type === 'success' ? '✓' : '⚠'}</span>
            <span>{notification.message}</span>
          </div>
          <button className="toast-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      <div className="transactions-header">
        <div className="header-title-section">
          <h1>Transaction History</h1>
          <p>View all vending machine transactions</p>
        </div>
        <div className="header-actions">
          <button 
            className={`btn-filter ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="card-content">
            <div className="card-label">Total Transactions</div>
            <div className="card-value">{summary.totalTransactions}</div>
            <div className="card-trend">Completed sales</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-content">
            <div className="card-label">Total Quantity</div>
            <div className="card-value">{summary.totalQuantity} kg</div>
            <div className="card-trend">Rice dispensed</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="card-content">
            <div className="card-label">Total Revenue</div>
            <div className="card-value">{formatCurrency(summary.totalRevenue)}</div>
            <div className="card-trend">Total sales</div>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="filters-panel">
          <div className="filters-grid">
            <div className="filter-group">
              <label>Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group">
              <label>Product Name</label>
              <select
                value={filters.productName}
                onChange={(e) => handleFilterChange('productName', e.target.value)}
                className="filter-select"
              >
                <option value="all">All Products</option>
                {productNames.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div className="filter-group search-group">
              <label>Search</label>
              <input
                type="text"
                placeholder="Transaction ID..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                className="filter-input"
              />
            </div>
            <div className="filter-group filter-actions">
              <label>&nbsp;</label>
              <button className="btn-apply" onClick={fetchTransactions}>
                Apply Filters
              </button>
              <button className="btn-clear" onClick={() => {
                setFilters({ startDate: '', endDate: '', productName: 'all', search: '' });
                setPagination({ ...pagination, page: 1 });
                fetchTransactions();
              }}>
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="transactions-table-container">
        {loading ? (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No Transactions Found</h3>
            <p>No transactions match your search criteria.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="business-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('transactionId')}>
                      Transaction ID <SortIcon column="transactionId" />
                    </th>
                    <th onClick={() => handleSort('createdAt')}>
                      Date & Time <SortIcon column="createdAt" />
                    </th>
                    <th onClick={() => handleSort('productName')}>
                      Product Name <SortIcon column="productName" />
                    </th>
                    <th onClick={() => handleSort('quantityKg')}>
                      Quantity <SortIcon column="quantityKg" />
                    </th>
                    <th onClick={() => handleSort('amountPaid')}>
                      Amount <SortIcon column="amountPaid" />
                    </th>
                    <th>Payment Method</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction._id} className="transaction-row">
                      <td className="tx-id">{transaction.transactionId}</td>
                      <td className="date-cell">{formatDate(transaction.createdAt)}</td>
                      <td className="product-cell">{getDisplayProductName(transaction)}</td>
                      <td className="quantity-cell">{transaction.quantityKg} kg</td>
                      <td className="amount-cell">{formatCurrency(transaction.amountPaid)}</td>
                      <td className="payment-cell">{transaction.paymentMethod || 'CASH'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pagination.pages > 1 && (
              <div className="pagination-container">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="pagination-btn"
                >
                  Previous
                </button>
                <div className="pagination-info">
                  <span className="page-info">Page {pagination.page} of {pagination.pages}</span>
                  <span className="total-info">({pagination.total} transactions)</span>
                </div>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="pagination-btn"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AdminTransactions;