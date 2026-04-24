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
    totalQuantity: 0
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
    riceType: 'all',
    search: '',
    paymentMethod: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Sample data for demonstration
  const sampleTransactions = [
    { _id: '1', transactionId: 'TXN-0001', createdAt: '2026-04-22T10:15:00', riceType: 'Sinandomeng', quantityKg: 2.5, totalAmount: 135, paymentMethod: 'Cash' },
    { _id: '2', transactionId: 'TXN-0002', createdAt: '2026-04-22T10:32:00', riceType: 'Dinorado', quantityKg: 1.5, totalAmount: 97.5, paymentMethod: 'Cash' },
    { _id: '3', transactionId: 'TXN-0003', createdAt: '2026-04-22T11:05:00', riceType: 'Jasmine', quantityKg: 3, totalAmount: 180, paymentMethod: 'Cash' },
    { _id: '4', transactionId: 'TXN-0004', createdAt: '2026-04-22T11:40:00', riceType: 'Premium', quantityKg: 1, totalAmount: 85, paymentMethod: 'Cash' },
    { _id: '5', transactionId: 'TXN-0005', createdAt: '2026-04-22T12:10:00', riceType: 'Sinandomeng', quantityKg: 4, totalAmount: 216, paymentMethod: 'Cash' },
    { _id: '6', transactionId: 'TXN-0006', createdAt: '2026-04-22T13:20:00', riceType: 'Dinorado', quantityKg: 2, totalAmount: 130, paymentMethod: 'Cash' },
    { _id: '7', transactionId: 'TXN-0007', createdAt: '2026-04-22T14:45:00', riceType: 'Jasmine', quantityKg: 1.5, totalAmount: 90, paymentMethod: 'Cash' },
    { _id: '8', transactionId: 'TXN-0008', createdAt: '2026-04-22T15:30:00', riceType: 'Premium', quantityKg: 2, totalAmount: 170, paymentMethod: 'Cash' },
    { _id: '9', transactionId: 'TXN-0009', createdAt: '2026-04-22T16:15:00', riceType: 'Sinandomeng', quantityKg: 3, totalAmount: 162, paymentMethod: 'Cash' },
    { _id: '10', transactionId: 'TXN-0010', createdAt: '2026-04-22T17:00:00', riceType: 'Dinorado', quantityKg: 2.5, totalAmount: 162.5, paymentMethod: 'Cash' },
  ];

  useEffect(() => {
    fetchTransactions();
    calculateSummary();

    if (socket) {
      socket.on('new_transaction', () => {
        fetchTransactions();
        calculateSummary();
      });

      return () => {
        socket.off('new_transaction');
      };
    }
  }, [socket, pagination.page, filters, sortBy, sortOrder]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      // Simulate API call
      setTimeout(() => {
        let filtered = [...sampleTransactions];
        
        // Apply filters
        if (filters.riceType !== 'all') {
          filtered = filtered.filter(t => t.riceType === filters.riceType);
        }
        if (filters.paymentMethod !== 'all') {
          filtered = filtered.filter(t => t.paymentMethod === filters.paymentMethod);
        }
        if (filters.search) {
          filtered = filtered.filter(t => 
            t.transactionId.toLowerCase().includes(filters.search.toLowerCase())
          );
        }
        
        // Apply sorting
        filtered.sort((a, b) => {
          let aVal = a[sortBy];
          let bVal = b[sortBy];
          if (sortBy === 'createdAt') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
          }
          if (sortOrder === 'desc') {
            return aVal > bVal ? -1 : 1;
          } else {
            return aVal < bVal ? -1 : 1;
          }
        });
        
        const total = filtered.length;
        const start = (pagination.page - 1) * pagination.limit;
        const paginated = filtered.slice(start, start + pagination.limit);
        
        setTransactions(paginated);
        setPagination(prev => ({
          ...prev,
          total,
          pages: Math.ceil(total / prev.limit)
        }));
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showNotification('error', 'Failed to load transactions');
      setLoading(false);
    }
  };

  const calculateSummary = () => {
    const totalTransactions = sampleTransactions.length;
    const totalQuantity = sampleTransactions.reduce((sum, t) => sum + t.quantityKg, 0);
    
    setSummary({
      totalTransactions,
      totalQuantity
    });
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
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
    setPagination({ ...pagination, page: 1 });
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

  return (
    <div className="transactions-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`transaction-toast ${notification.type}`}>
          <div className="toast-content">
            <span className="toast-icon">{notification.type === 'success' ? '✓' : '⚠'}</span>
            <span>{notification.message}</span>
          </div>
          <button className="toast-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Header Section */}
      <div className="transactions-header">
        <div className="header-title-section">
          <h1 className="page-title">Transaction History</h1>
          <p className="page-subtitle">View and manage all vending machine transactions</p>
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

      {/* Summary Cards */}
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
            <div className="card-value">{summary.totalQuantity.toFixed(1)} kg</div>
            <div className="card-trend">Rice dispensed</div>
          </div>
        </div>
      </div>

      {/* Filters Section */}
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
              <label>Rice Type</label>
              <select
                value={filters.riceType}
                onChange={(e) => handleFilterChange('riceType', e.target.value)}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="Sinandomeng">Sinandomeng</option>
                <option value="Dinorado">Dinorado</option>
                <option value="Jasmine">Jasmine</option>
                <option value="Premium">Premium</option>
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
                setFilters({ startDate: '', endDate: '', riceType: 'all', search: '', paymentMethod: 'all' });
                setPagination({ ...pagination, page: 1 });
                fetchTransactions();
              }}>
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transactions Table */}
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
                    <th onClick={() => handleSort('riceType')}>
                      Product Type <SortIcon column="riceType" />
                    </th>
                    <th onClick={() => handleSort('quantityKg')}>
                      Quantity <SortIcon column="quantityKg" />
                    </th>
                    <th onClick={() => handleSort('totalAmount')}>
                      Amount <SortIcon column="totalAmount" />
                    </th>
                    <th>Payment Method</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction._id} className="transaction-row">
                      <td className="tx-id">{transaction.transactionId}</td>
                      <td className="date-cell">{formatDate(transaction.createdAt)}</td>
                      <td className="product-cell">{transaction.riceType}</td>
                      <td className="quantity-cell">{transaction.quantityKg} kg</td>
                      <td className="amount-cell">{formatCurrency(transaction.totalAmount)}</td>
                      <td className="payment-cell">{transaction.paymentMethod}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
                  <span className="page-info">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <span className="total-info">
                    ({pagination.total} transactions)
                  </span>
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