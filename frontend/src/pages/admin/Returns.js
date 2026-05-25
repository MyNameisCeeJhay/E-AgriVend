const API_URL = 'https://e-agrivend.onrender.com/api';
//const API_URL = 'http://localhost:5000/api';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './Returns.css';

const AdminReturns = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
  const [emailSending, setEmailSending] = useState(false);
  const [lastEmailStatus, setLastEmailStatus] = useState(null);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [filter, setFilter] = useState('all');
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    pages: 1
  });
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const abortControllerRef = useRef(null);

  useEffect(() => {
    fetchRefunds();
    fetchStats();

    if (socket) {
      socket.on('new_return_notification', (data) => {
        setNotification({
          type: 'new',
          message: `New refund request from ${data.fullName || data.email || 'Customer'} for Transaction: ${data.transactionId}`,
          data
        });
        fetchRefunds();
        fetchStats();
      });

      return () => {
        socket.off('new_return_notification');
      };
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [socket]);

  useEffect(() => {
    fetchRefunds();
  }, [filter, pagination.page]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    if (lastEmailStatus) {
      const timer = setTimeout(() => setLastEmailStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastEmailStatus]);

  const fetchRefunds = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      setLoading(true);
      setError(null);
      
      const authToken = localStorage.getItem('token');
      
      if (!authToken) {
        setError('Please log in as admin to view refund requests');
        setLoading(false);
        return;
      }
      
      // Use the correct endpoint - /api/returns/admin/all
      const response = await axios.get(`${API_URL}/returns/admin/all`, {
        params: {
          status: filter !== 'all' ? filter : undefined,
          page: pagination.page,
          limit: 15
        },
        headers: { 
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        signal: abortControllerRef.current.signal
      });
      
      const refundsData = response.data?.data || [];
      console.log('📋 Refunds data:', refundsData.map(r => ({ 
        id: r.returnId, 
        name: r.fullName, 
        email: r.email,
        status: r.status
      })));
      setRefunds(Array.isArray(refundsData) ? refundsData : []);
      setPagination(response.data?.pagination || { page: 1, total: 0, pages: 1 });
    } catch (error) {
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
      
      console.error('Error fetching refunds:', error);
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        setError('Request timeout. Please try again.');
      } else if (error.response?.status === 401) {
        setError('Unauthorized. Please log in as admin.');
      } else if (error.response?.status === 403) {
        setError('Access denied. Admin privileges required.');
      } else {
        setError(error.response?.data?.error || 'Failed to load refund requests');
      }
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const authToken = localStorage.getItem('token');
      
      // Use the correct endpoint - /api/returns/admin/stats
      const response = await axios.get(`${API_URL}/returns/admin/stats`, {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 15000
      });
      const statsData = response.data?.data || {};
      setStats({
        pending: statsData.pending || 0,
        approved: statsData.approved || 0,
        rejected: statsData.rejected || 0,
        total: statsData.total || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  const handleApprove = async (returnId) => {
    const confirmApprove = window.confirm('Are you sure you want to approve this refund request? The customer will receive an email notification.');
    if (!confirmApprove) return;

    setProcessing(true);
    setEmailSending(true);
    
    try {
      const authToken = localStorage.getItem('token');
      
      // Use the correct endpoint - /api/returns/admin/:returnId/process
      const response = await axios.put(`${API_URL}/returns/admin/${returnId}/process`, {
        status: 'APPROVED',
        adminNotes: 'Refund approved by administrator.',
        processedBy: user?._id,
        processedByName: user?.firstName + ' ' + user?.lastName
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 30000
      });
      
      setSelectedRefund(null);
      await fetchRefunds();
      await fetchStats();
      
      showNotification('success', 'Refund approved successfully! Email notification sent to the customer.');
      
    } catch (error) {
      console.error('Error approving refund:', error);
      if (error.code === 'ECONNABORTED') {
        showNotification('warning', 'Request timed out. Please refresh the page to check if the refund was processed.');
        setTimeout(() => {
          fetchRefunds();
          fetchStats();
        }, 3000);
      } else {
        showNotification('error', error.response?.data?.error || 'Failed to approve refund');
      }
    } finally {
      setProcessing(false);
      setEmailSending(false);
    }
  };

  const handleReject = async (returnId) => {
    const confirmReject = window.confirm('Are you sure you want to reject this refund request? The customer will receive an email notification.');
    if (!confirmReject) return;

    setProcessing(true);
    setEmailSending(true);
    
    try {
      const authToken = localStorage.getItem('token');
      
      // Use the correct endpoint - /api/returns/admin/:returnId/process
      const response = await axios.put(`${API_URL}/returns/admin/${returnId}/process`, {
        status: 'REJECTED',
        adminNotes: 'Refund rejected by administrator.',
        processedBy: user?._id,
        processedByName: user?.firstName + ' ' + user?.lastName
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 30000
      });
      
      setSelectedRefund(null);
      await fetchRefunds();
      await fetchStats();
      
      showNotification('success', 'Refund rejected successfully! Email notification sent to the customer.');
      
    } catch (error) {
      console.error('Error rejecting refund:', error);
      if (error.code === 'ECONNABORTED') {
        showNotification('warning', 'Request timed out. Please refresh the page to check if the refund was processed.');
        setTimeout(() => {
          fetchRefunds();
          fetchStats();
        }, 3000);
      } else {
        showNotification('error', error.response?.data?.error || 'Failed to reject refund');
      }
    } finally {
      setProcessing(false);
      setEmailSending(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return '₱0.00';
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
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
      case 'PENDING': return 'PENDING';
      case 'APPROVED': return 'APPROVED';
      case 'REJECTED': return 'REJECTED';
      default: return status || 'PENDING';
    }
  };

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleFilterChange = (e) => {
    const newFilter = e.target.value;
    setFilter(newFilter);
    setPagination({ ...pagination, page: 1 });
  };

  const getTransactionId = (refund) => {
    return refund?.transactionNumber || refund?.transactionId || 'N/A';
  };

  const getProductName = (refund) => {
    return refund?.riceType || refund?.grainType || 'N/A';
  };

  const getQuantity = (refund) => {
    return refund?.quantityKg || refund?.selectedQuantity || 0;
  };

  const getAmount = (refund) => {
    return refund?.amountPaid || refund?.amountInserted || 0;
  };

  const getReason = (refund) => {
    return refund?.returnReason || refund?.refundReason || 'N/A';
  };

  const getDescription = (refund) => {
    return refund?.description || '';
  };

  const viewReceipt = async (receiptFilename) => {
    if (!receiptFilename) {
      showNotification('error', 'No receipt file attached');
      return;
    }
    
    setReceiptLoading(true);
    
    try {
      const authToken = localStorage.getItem('token');
      
      if (!authToken) {
        showNotification('error', 'Please log in to view receipt');
        setReceiptLoading(false);
        return;
      }
      
      const imageUrl = `${API_URL}/refund/receipt-image/${encodeURIComponent(receiptFilename)}`;
      
      const response = await fetch(imageUrl, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      window.open(objectUrl, '_blank');
      showNotification('success', 'Receipt loaded successfully');
      
    } catch (error) {
      console.error('Error viewing receipt:', error);
      showNotification('error', `Failed to load receipt: ${error.message}`);
    } finally {
      setReceiptLoading(false);
    }
  };

  if (loading && refunds.length === 0) {
    return (
      <div className="returns-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading refund requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="returns-container">
        <div className="error-state">
          <h3>⚠️ Error Loading Refunds</h3>
          <p>{error}</p>
          <button className="btn-retry" onClick={() => fetchRefunds()}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="returns-container">
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {lastEmailStatus && (
        <div className={`email-status-toast ${lastEmailStatus.type}`}>
          <span className="email-status-message">{lastEmailStatus.message}</span>
          <button className="email-status-close" onClick={() => setLastEmailStatus(null)}>×</button>
        </div>
      )}

      <div className="returns-header">
        <div className="returns-header-left">
          <h1>Refund Requests</h1>
          <p>Manage customer refund requests from the refund portal</p>
        </div>
        <div className="returns-header-right">
          <button className="btn-secondary" onClick={toggleFilters}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      <div className="returns-stats">
        <div className="stat-card">
          <div className="stat-label">TOTAL REFUNDS</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">PENDING</div>
          <div className="stat-value warning">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">APPROVED</div>
          <div className="stat-value success">{stats.approved}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">REJECTED</div>
          <div className="stat-value danger">{stats.rejected}</div>
        </div>
      </div>

      {showFilters && (
        <div className="filters-card">
          <div className="filter-controls">
            <select 
              value={filter} 
              onChange={handleFilterChange}
              className="filter-select"
            >
              <option value="all">All Refunds</option>
              <option value="PENDING">Pending Only ({stats.pending})</option>
              <option value="APPROVED">Approved ({stats.approved})</option>
              <option value="REJECTED">Rejected ({stats.rejected})</option>
            </select>
          </div>
        </div>
      )}

      {refunds.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No Refund Requests</h3>
          <p>There are no refund requests to display.</p>
        </div>
      ) : (
        <div className="returns-table">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>DATE</th>
                  <th>CUSTOMER</th>
                  <th>PRODUCT</th>
                  <th>QUANTITY</th>
                  <th>AMOUNT</th>
                  <th>REASON</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund, index) => (
                  <tr key={refund._id || refund.returnId || index}>
                    <td className="id-cell">{index + 1 + (pagination.page - 1) * 15}</td>
                    <td className="date-cell">{formatDate(refund?.createdAt)}</td>
                    <td className="customer-cell">
                      <div><strong>{refund?.fullName || 'N/A'}</strong></div>
                      <div className="customer-email">{refund?.email || 'N/A'}</div>
                    </td>
                    <td className="product-cell">{getProductName(refund)}</td>
                    <td className="quantity-cell">{getQuantity(refund)} kg</td>
                    <td className="amount-cell">{formatCurrency(getAmount(refund))}</td>
                    <td className="reason-cell">
                      <div className="reason-text" title={getReason(refund)}>
                        {getReason(refund).length > 35 
                          ? getReason(refund).substring(0, 35) + '...' 
                          : getReason(refund)}
                      </div>
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${getStatusClass(refund?.status)}`}>
                        {getStatusText(refund?.status)}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button 
                        className="btn-view"
                        onClick={() => setSelectedRefund(refund)}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pagination.pages > 1 && (
        <div className="returns-pagination">
          <button
            onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
            disabled={pagination.page === 1}
            className="pagination-btn"
          >
            Previous
          </button>
          <span className="page-info">
            Page {pagination.page} of {pagination.pages}
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

      {selectedRefund && (
        <div className="modal-overlay" onClick={() => setSelectedRefund(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Refund Request Details</h2>
              <button className="modal-close" onClick={() => setSelectedRefund(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="details-section">
                <h3>👤 Customer Information</h3>
                <div className="details-grid">
                  <div className="detail-row">
                    <span className="detail-label">Full Name:</span>
                    <span className="detail-value">{selectedRefund?.fullName || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Email:</span>
                    <span className="detail-value">{selectedRefund?.email || 'N/A'}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>📋 Transaction Information</h3>
                <div className="details-grid">
                  <div className="detail-row">
                    <span className="detail-label">Transaction ID:</span>
                    <span className="detail-value">{getTransactionId(selectedRefund)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Submitted:</span>
                    <span className="detail-value">{formatDate(selectedRefund?.createdAt)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Product:</span>
                    <span className="detail-value">{getProductName(selectedRefund)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Quantity:</span>
                    <span className="detail-value">{getQuantity(selectedRefund)} kg</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Amount:</span>
                    <span className="detail-value amount">{formatCurrency(getAmount(selectedRefund))}</span>
                  </div>
                </div>
              </div>

              <div className="details-section">
                <h3>❓ Refund Reason</h3>
                <div className="info-box">
                  <p><strong>{getReason(selectedRefund)}</strong></p>
                </div>
              </div>

              <div className="details-section">
                <h3>📝 Customer Description</h3>
                <div className="info-box">
                  <p>{getDescription(selectedRefund) || 'No description provided.'}</p>
                </div>
              </div>

              {(selectedRefund?.receiptFilename || selectedRefund?.receiptImage) && (
                <div className="details-section">
                  <h3>📎 Receipt Attachment</h3>
                  <button 
                    className="btn-view-receipt"
                    onClick={() => viewReceipt(selectedRefund.receiptFilename || selectedRefund.receiptImage)}
                    disabled={receiptLoading}
                  >
                    {receiptLoading ? '⏳ Loading Receipt...' : '📄 View Receipt'}
                  </button>
                </div>
              )}

              {selectedRefund?.status !== 'PENDING' && selectedRefund?.adminNotes && (
                <div className="details-section">
                  <h3>📌 Admin Notes</h3>
                  <div className="info-box">
                    <p>{selectedRefund.adminNotes}</p>
                    {selectedRefund.processedAt && (
                      <small>Processed on: {formatDate(selectedRefund.processedAt)}</small>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              {selectedRefund?.status === 'PENDING' ? (
                <>
                  <button 
                    className="btn-reject-modal"
                    onClick={() => handleReject(selectedRefund?.returnId)}
                    disabled={processing || emailSending}
                  >
                    {processing || emailSending ? 'Processing...' : 'Reject Refund'}
                  </button>
                  <button 
                    className="btn-approve-modal"
                    onClick={() => handleApprove(selectedRefund?.returnId)}
                    disabled={processing || emailSending}
                  >
                    {processing || emailSending ? 'Processing...' : 'Approve Refund'}
                  </button>
                </>
              ) : (
                <button className="btn-close" onClick={() => setSelectedRefund(null)}>
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturns;