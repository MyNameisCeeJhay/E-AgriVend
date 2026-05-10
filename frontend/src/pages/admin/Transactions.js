import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './Transactions.css';

const API_URL = 'https://e-agrivend.onrender.com/api';

const AdminTransactions = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalTransactions: 0,
    totalQuantity: 0,
    manualTransactions: 0,
    machineTransactions: 0,
    manualRevenue: 0,
    machineRevenue: 0
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
    search: '',
    transactionType: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [notification, setNotification] = useState(null);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  
  const [allProductNames, setAllProductNames] = useState([
    'Sinandomeng Rice',
    'Dinorado Rice', 
    'Jasmine Rice',
    'Premium Rice',
    'Brown Rice',
    'Glutinous Rice',
    'Organic Rice'
  ]);

  // Helper functions
  const isMachineTransaction = useCallback((transaction) => {
    if (!transaction) return false;
    if (transaction.source === 'machine') return true;
    if (transaction.transactionType === 'machine') return true;
    if (transaction.recordedBy === null && !transaction.user) return true;
    if (transaction.isMachineTransaction === true) return true;
    return false;
  }, []);

  const isManualTransaction = useCallback((transaction) => {
    if (!transaction) return false;
    if (transaction.recordedBy && transaction.recordedBy !== null) return true;
    if (transaction.user && transaction.user !== null) return true;
    return false;
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        console.error('No token found');
        setLoading(false);
        return;
      }
      
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        productName: filters.productName === 'all' ? undefined : filters.productName,
        search: filters.search || undefined
      };
      
      Object.keys(params).forEach(key => params[key] === undefined && delete params[key]);
      
      const response = await axios.get(`${API_URL}/transactions/all`, {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        let data = response.data.data || [];
        
        if (filters.transactionType === 'manual') {
          data = data.filter(t => isManualTransaction(t));
        } else if (filters.transactionType === 'machine') {
          data = data.filter(t => isMachineTransaction(t));
        }
        
        const sortedData = [...data].sort((a, b) => {
          let aVal = a[sortBy];
          let bVal = b[sortBy];
          if (sortBy === 'createdAt') {
            aVal = new Date(aVal);
            bVal = new Date(bVal);
          }
          if (sortBy === 'productName') {
            aVal = a.productName || a.riceType || '';
            bVal = b.productName || b.riceType || '';
          }
          if (sortBy === 'recordedBy') {
            aVal = a.recordedBy?.firstName || a.user?.firstName || (isMachineTransaction(a) ? 'Machine' : 'System');
            bVal = b.recordedBy?.firstName || b.user?.firstName || (isMachineTransaction(b) ? 'Machine' : 'System');
          }
          return sortOrder === 'desc' ? (aVal > bVal ? -1 : 1) : (aVal < bVal ? -1 : 1);
        });
        
        setTransactions(sortedData);
        setPagination(prev => ({
          ...prev,
          total: data.length,
          pages: Math.ceil(data.length / prev.limit)
        }));
        
        const manualTransactions = data.filter(t => isManualTransaction(t));
        const machineTransactions = data.filter(t => isMachineTransaction(t));
        
        setSummary({
          totalTransactions: data.length,
          totalQuantity: data.reduce((s, t) => s + (t.quantityKg || 0), 0),
          manualTransactions: manualTransactions.length,
          machineTransactions: machineTransactions.length,
          manualRevenue: manualTransactions.reduce((s, t) => s + (t.amountPaid || 0), 0),
          machineRevenue: machineTransactions.reduce((s, t) => s + (t.amountPaid || 0), 0)
        });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showNotification('error', error.response?.data?.error || 'Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters, sortBy, sortOrder, isManualTransaction, isMachineTransaction]);

  const fetchSummary = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/transactions/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setSummary(prev => ({ ...prev, ...response.data.data }));
      }
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  }, []);

  const fetchUniqueProductNames = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await axios.get(`${API_URL}/transactions/products/list`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && response.data.data) {
        const apiProducts = response.data.data;
        const mergedProducts = [...allProductNames];
        apiProducts.forEach(product => {
          if (!mergedProducts.includes(product)) {
            mergedProducts.push(product);
          }
        });
        setAllProductNames(mergedProducts);
      }
    } catch (error) {
      console.error('Error fetching product names:', error);
    }
  }, [allProductNames]);

  useEffect(() => {
    fetchTransactions();
    fetchSummary();
    fetchUniqueProductNames();
  }, [fetchTransactions, fetchSummary, fetchUniqueProductNames]);

  useEffect(() => {
    if (socket) {
      const handleNewTransaction = () => {
        fetchTransactions();
        fetchSummary();
        fetchUniqueProductNames();
        showNotification('success', 'New transaction added');
      };
      
      socket.on('new_transaction', handleNewTransaction);
      return () => {
        socket.off('new_transaction', handleNewTransaction);
      };
    }
  }, [socket, fetchTransactions, fetchSummary, fetchUniqueProductNames]);

  useEffect(() => {
    if (pagination.page === 1) {
      fetchTransactions();
    } else {
      setPagination(prev => ({ ...prev, page: 1 }));
    }
  }, [filters, fetchTransactions]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    fetchTransactions();
  };

  const clearFilters = () => {
    setFilters({ 
      startDate: '', 
      endDate: '', 
      productName: 'all', 
      search: '',
      transactionType: 'all'
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const getTransactionType = (transaction) => {
    if (isMachineTransaction(transaction)) {
      return { type: 'machine', label: 'Machine', badgeClass: 'badge-machine' };
    }
    if (isManualTransaction(transaction)) {
      const name = `${transaction.recordedBy?.firstName || ''} ${transaction.recordedBy?.lastName || ''}`.trim();
      return { type: 'manual', label: name || 'Staff', badgeClass: 'badge-manual' };
    }
    return { type: 'system', label: 'System', badgeClass: 'badge-system' };
  };

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <span className="sort-icon">↕</span>;
    return sortOrder === 'desc' ? <span className="sort-icon">↓</span> : <span className="sort-icon">↑</span>;
  };

  const getDisplayProductName = (transaction) => {
    return transaction.productName || transaction.riceType || 'Unknown';
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="transactions-container">
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Loading transactions...</p>
        </div>
      </div>
    );
  }

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
          <p>View all vending machine transactions - Manual & Machine Records</p>
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
        <div className="summary-card total-card">
          <div className="card-content">
            <div className="card-label">Total Transactions</div>
            <div className="card-value">{summary.totalTransactions}</div>
            <div className="card-trend">
              {summary.manualTransactions} Manual | {summary.machineTransactions} Machine
            </div>
          </div>
        </div>
        <div className="summary-card manual-card">
          <div className="card-content">
            <div className="card-label">Manual Transactions</div>
            <div className="card-value">{summary.manualTransactions}</div>
            <div className="card-trend">{formatCurrency(summary.manualRevenue)}</div>
            <div className="card-sub">Recorded by Staff</div>
          </div>
        </div>
        <div className="summary-card machine-card">
          <div className="card-content">
            <div className="card-label">Machine Transactions</div>
            <div className="card-value">{summary.machineTransactions}</div>
            <div className="card-trend">{formatCurrency(summary.machineRevenue)}</div>
            <div className="card-sub">Auto-recorded by Vending Machine</div>
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
              <label>Transaction Type</label>
              <select
                value={filters.transactionType}
                onChange={(e) => handleFilterChange('transactionType', e.target.value)}
                className="filter-select"
              >
                <option value="all">All Transactions</option>
                <option value="manual">Manual (Staff Recorded)</option>
                <option value="machine">Machine (Vending Machine)</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Product Name</label>
              <select
                value={filters.productName}
                onChange={(e) => handleFilterChange('productName', e.target.value)}
                className="filter-select"
              >
                <option value="all">All Products</option>
                {allProductNames.map(name => (
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
              <button className="btn-clear" onClick={clearFilters}>
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="transactions-table-container">
        {transactions.length === 0 ? (
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
                    <th onClick={() => handleSort('recordedBy')}>
                      Recorded By <SortIcon column="recordedBy" />
                    </th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const txType = getTransactionType(transaction);
                    const displayName = txType.type === 'manual' ? txType.label : (txType.type === 'machine' ? 'Machine' : 'System');
                    return (
                      <tr key={transaction._id} className={`transaction-row ${txType.type}`}>
                        <td className="tx-id">{transaction.transactionId || 'N/A'}</td>
                        <td className="date-cell">{formatDate(transaction.createdAt)}</td>
                        <td className="product-cell">{getDisplayProductName(transaction)}</td>
                        <td className="quantity-cell">{transaction.quantityKg} kg</td>
                        <td className="amount-cell">{formatCurrency(transaction.amountPaid)}</td>
                        <td className="payment-cell">{transaction.paymentMethod || 'CASH'}</td>
                        <td className="recorded-by-cell">
                          <span className="staff-name">{displayName}</span>
                        </td>
                        <td className="type-cell">
                          <div className={`type-badge ${txType.type}`}>
                            {txType.type === 'manual' ? 'Manual' : 'Machine'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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