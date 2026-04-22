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
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1,
    limit: 10
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    riceType: 'all',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [notification, setNotification] = useState(null);

  // Sample data for demonstration (remove this when connected to actual API)
  const sampleTransactions = [
    { _id: '1', transactionId: 'TXN-0001', createdAt: '2026-04-22T10:15:00', riceType: 'Coco Pandan Rice', quantityKg: 2, totalAmount: 120, paymentMethod: 'Coin' },
    { _id: '2', transactionId: 'TXN-0002', createdAt: '2026-04-22T10:32:00', riceType: 'Jasmine Rice', quantityKg: 1, totalAmount: 60, paymentMethod: 'Coin' },
    { _id: '3', transactionId: 'TXN-0003', createdAt: '2026-04-22T11:05:00', riceType: 'Sticky Rice', quantityKg: 3, totalAmount: 200, paymentMethod: 'Bill' },
    { _id: '4', transactionId: 'TXN-0004', createdAt: '2026-04-22T11:40:00', riceType: 'Dinorado Rice', quantityKg: 4, totalAmount: 250, paymentMethod: 'Bill' },
    { _id: '5', transactionId: 'TXN-0005', createdAt: '2026-04-22T12:10:00', riceType: 'Coco Pandan Rice', quantityKg: 1, totalAmount: 100, paymentMethod: 'Coin' },
    { _id: '6', transactionId: 'TXN-0006', createdAt: '2026-04-22T13:20:00', riceType: 'Sinandomeng', quantityKg: 2, totalAmount: 108, paymentMethod: 'Coin' },
    { _id: '7', transactionId: 'TXN-0007', createdAt: '2026-04-22T14:45:00', riceType: 'Premium Rice', quantityKg: 1, totalAmount: 85, paymentMethod: 'QR' },
    { _id: '8', transactionId: 'TXN-0008', createdAt: '2026-04-22T15:30:00', riceType: 'Jasmine Rice', quantityKg: 3, totalAmount: 180, paymentMethod: 'Bill' },
    { _id: '9', transactionId: 'TXN-0009', createdAt: '2026-04-22T16:15:00', riceType: 'Dinorado Rice', quantityKg: 2, totalAmount: 130, paymentMethod: 'Coin' },
    { _id: '10', transactionId: 'TXN-0010', createdAt: '2026-04-22T17:00:00', riceType: 'Coco Pandan Rice', quantityKg: 2, totalAmount: 240, paymentMethod: 'Bill' },
  ];

  useEffect(() => {
    fetchTransactions();

    if (socket) {
      socket.on('new_transaction', () => {
        fetchTransactions();
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
      // For demo, use sample data
      // Replace with actual API call when backend is ready
      // const response = await axios.get(`${API_URL}/admin/transactions`, { params });
      // setTransactions(response.data.data || []);
      
      // Using sample data for now
      setTimeout(() => {
        setTransactions(sampleTransactions);
        setPagination({
          page: 1,
          total: sampleTransactions.length,
          pages: 1,
          limit: 10
        });
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showNotification('error', 'Failed to load transactions');
      setLoading(false);
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
      currency: 'PHP',
      minimumFractionDigits: 0
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

  const getPaymentBadgeClass = (method) => {
    switch(method) {
      case 'Coin': return 'badge-coin';
      case 'Bill': return 'badge-bill';
      case 'QR': return 'badge-qr';
      default: return 'badge-default';
    }
  };

  return (
    <div className="transactions-page">
      {/* Notification */}
      {notification && (
        <div className={`toast-notification ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="page-header-simple">
        <div>
          <h1>Transaction History</h1>
          <p>View all vending machine transactions</p>
        </div>
        <button 
          className="filter-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Filters Section */}
      {showFilters && (
        <div className="filters-section">
          <div className="filter-row">
            <div className="filter-input">
              <label>Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
              />
            </div>
            <div className="filter-input">
              <label>End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
              />
            </div>
            <div className="filter-input">
              <label>Rice Type</label>
              <select
                value={filters.riceType}
                onChange={(e) => handleFilterChange('riceType', e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="Sinandomeng">Sinandomeng</option>
                <option value="Dinorado">Dinorado</option>
                <option value="Jasmine">Jasmine</option>
                <option value="Premium">Premium</option>
                <option value="Coco Pandan Rice">Coco Pandan Rice</option>
                <option value="Sticky Rice">Sticky Rice</option>
              </select>
            </div>
            <div className="filter-input">
              <label>Search</label>
              <input
                type="text"
                placeholder="Transaction ID..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>
          </div>
          <div className="filter-buttons">
            <button className="btn-apply" onClick={handleSearch}>Apply Filters</button>
            <button className="btn-clear" onClick={() => {
              setFilters({ startDate: '', endDate: '', riceType: 'all', search: '' });
              setPagination({ ...pagination, page: 1 });
              fetchTransactions();
            }}>Clear</button>
          </div>
        </div>
      )}

      {/* Transactions Table */}
      <div className="table-wrapper">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <h3>No Transactions Found</h3>
            <p>No transactions match your criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Product Type</th>
                  <th>Quantity</th>
                  <th>Amount Paid</th>
                  <th>Payment Method</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction._id}>
                    <td className="tx-id">{transaction.transactionId}</td>
                    <td>{formatDate(transaction.createdAt)}</td>
                    <td>{transaction.riceType}</td>
                    <td>{transaction.quantityKg} kg</td>
                    <td className="amount">{formatCurrency(transaction.totalAmount)}</td>
                    <td>
                      <span className={`payment-badge ${getPaymentBadgeClass(transaction.paymentMethod)}`}>
                        {transaction.paymentMethod}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="pagination-simple">
          <button 
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            disabled={pagination.page === 1}
          >
            Previous
          </button>
          <span>Page {pagination.page} of {pagination.pages}</span>
          <button 
            onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
            disabled={pagination.page === pagination.pages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminTransactions;