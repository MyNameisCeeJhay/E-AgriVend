const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
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
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState(null);
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

  useEffect(() => {
    fetchRefunds();
    fetchStats();

    if (socket) {
      socket.on('new_return_notification', (data) => {
        setNotification({
          type: 'new',
          message: `New refund request for Transaction: ${data.transactionId}`,
          data
        });
        fetchRefunds();
        fetchStats();
        
        if (Notification.permission === 'granted') {
          new Notification('New Refund Request', {
            body: `Transaction: ${data.transactionId}\nAmount: ₱${data.amountPaid}`,
            icon: '/logo192.png'
          });
        }
      });

      return () => {
        socket.off('new_return_notification');
      };
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
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

  const fetchRefunds = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      console.log('Fetching refunds with filter:', filter);
      
      const response = await axios.get(`${API_URL}/refund/admin/all`, {
        params: {
          status: filter !== 'all' ? filter : undefined,
          page: pagination.page,
          limit: 15
        },
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('API Response:', response.data);
      
      // Safely set refunds array
      const refundsData = response.data?.data || [];
      setRefunds(refundsData);
      setPagination(response.data?.pagination || { page: 1, total: 0, pages: 1 });
    } catch (error) {
      console.error('Error fetching refunds:', error);
      setError(error.response?.data?.error || 'Failed to load refund requests');
      setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/refund/admin/stats/summary`, {
        headers: { Authorization: `Bearer ${token}` }
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

  const handleApprove = async (refundId) => {
    const confirmApprove = window.confirm('Are you sure you want to approve this refund request?');
    if (!confirmApprove) return;

    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/refund/admin/${refundId}/process`, {
        status: 'APPROVED',
        adminNotes: adminNotes || 'Refund approved by administrator.',
        processedBy: user?._id,
        processedByName: user?.firstName + ' ' + user?.lastName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedRefund(null);
      setAdminNotes('');
      fetchRefunds();
      fetchStats();
      
      showNotification('success', 'Refund approved successfully');
    } catch (error) {
      console.error('Error approving refund:', error);
      showNotification('error', error.response?.data?.error || 'Failed to approve refund');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (refundId) => {
    if (!adminNotes.trim()) {
      showNotification('error', 'Please provide a reason for rejection');
      return;
    }

    const confirmReject = window.confirm('Are you sure you want to reject this refund request?');
    if (!confirmReject) return;

    setProcessing(true);
    try {
      const token = localStorage.getItem('token');
      await axios.put(`${API_URL}/refund/admin/${refundId}/process`, {
        status: 'REJECTED',
        adminNotes: adminNotes,
        processedBy: user?._id,
        processedByName: user?.firstName + ' ' + user?.lastName
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSelectedRefund(null);
      setAdminNotes('');
      fetchRefunds();
      fetchStats();
      
      showNotification('success', 'Refund rejected successfully');
    } catch (error) {
      console.error('Error rejecting refund:', error);
      showNotification('error', error.response?.data?.error || 'Failed to reject refund');
    } finally {
      setProcessing(false);
    }
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
        minute: '2-digit'
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

  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  const handleFilterChange = (e) => {
    const newFilter = e.target.value;
    setFilter(newFilter);
    setPagination({ ...pagination, page: 1 });
  };

  // Safe accessor functions
  const getTransactionId = (refund) => {
    return refund?.transactionId || refund?.transactionNumber || 'N/A';
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

  const getReceiptPath = (refund) => {
    return refund?.receiptPath || refund?.receiptImage;
  };

  // Don't render if loading
  if (loading && refunds.length === 0) {
    return (
      <div className="returns-container">
        <div className="loading-state">Loading refund requests...</div>
      </div>
    );
  }

  // Don't render if error
  if (error) {
    return (
      <div className="returns-container">
        <div className="error-state">
          <h3>Error Loading Refunds</h3>
          <p>{error}</p>
          <button onClick={() => fetchRefunds()}>Try Again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="returns-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Page Header */}
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

      {/* Stats Cards */}
      <div className="returns-stats">
        <div className="stat-card">
          <div className="stat-label">Total Refunds</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending</div>
          <div className="stat-value warning">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approved</div>
          <div className="stat-value success">{stats.approved}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Rejected</div>
          <div className="stat-value danger">{stats.rejected}</div>
        </div>
      </div>

      {/* Filters Section */}
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

      {/* Refunds Table - Safely check if refunds array exists and has items */}
      {!refunds || refunds.length === 0 ? (
        <div className="empty-state">
          <h3>No Refund Requests</h3>
          <p>There are no refund requests to display.</p>
        </div>
      ) : (
        <div className="returns-table">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Transaction ID</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {refunds.map((refund) => (
                  <tr key={refund._id || refund.returnId} className={refund?.status === 'PENDING' ? 'pending-row' : ''}>
                    <td className="return-id-cell">
                      <span className="return-id">{refund?.returnId || 'N/A'}</span>
                    </td>
                    <td className="transaction-id-cell">
                      <span className="transaction-id">{getTransactionId(refund)}</span>
                    </td>
                    <td className="date-cell">{formatDate(refund?.createdAt)}</td>
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
                      <div className="status-container">
                        <span className={`status-badge ${getStatusClass(refund?.status)}`}>
                          {refund?.status || 'PENDING'}
                        </span>
                      </div>
                    </td>
                    <td className="actions-cell">
                      {refund?.status === 'PENDING' && (
                        <div className="action-buttons">
                          <button 
                            className="btn-approve"
                            onClick={() => setSelectedRefund(refund)}
                            disabled={processing}
                          >
                            Approve
                          </button>
                          <button 
                            className="btn-reject"
                            onClick={() => setSelectedRefund(refund)}
                            disabled={processing}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {refund?.status !== 'PENDING' && (
                        <button 
                          className="btn-view"
                          onClick={() => setSelectedRefund(refund)}
                        >
                          View
                        </button>
                      )}
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

      {/* Process Refund Modal */}
      {selectedRefund && (
        <div className="modal-overlay" onClick={() => setSelectedRefund(null)}>
          <div className="modal-container large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedRefund?.status === 'PENDING' ? 'Process Refund Request' : 'Refund Request Details'}</h2>
              <button className="modal-close" onClick={() => setSelectedRefund(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="refund-details">
                <h3>Transaction Information</h3>
                <div className="details-grid">
                  <div className="detail-row">
                    <span className="detail-label">Return ID:</span>
                    <span className="detail-value highlight">{selectedRefund?.returnId || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Transaction ID:</span>
                    <span className="detail-value highlight">{getTransactionId(selectedRefund)}</span>
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
                    <span className="detail-label">Amount Paid:</span>
                    <span className="detail-value amount">{formatCurrency(getAmount(selectedRefund))}</span>
                  </div>
                </div>

                <div className="customer-info">
                  <h3>Customer Information</h3>
                  <div className="details-grid">
                    <div className="detail-row">
                      <span className="detail-label">Name:</span>
                      <span className="detail-value">{selectedRefund?.fullName || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{selectedRefund?.email || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                <div className="reason-box">
                  <h4>Refund Reason</h4>
                  <p>{getReason(selectedRefund)}</p>
                </div>

                <div className="description-box">
                  <h4>Customer Description</h4>
                  <p>{getDescription(selectedRefund) || 'No description provided.'}</p>
                </div>

                {getReceiptPath(selectedRefund) && (
                  <div className="receipt-box">
                    <h4>Receipt Attachment</h4>
                    <button 
                      className="btn-download"
                      onClick={() => window.open(`${API_URL}${getReceiptPath(selectedRefund)}`, '_blank')}
                    >
                      View Receipt
                    </button>
                  </div>
                )}

                {selectedRefund?.status !== 'PENDING' && selectedRefund?.adminNotes && (
                  <div className="admin-notes-display">
                    <h4>Admin Notes</h4>
                    <p>{selectedRefund.adminNotes}</p>
                    {selectedRefund.processedAt && (
                      <small>Processed on: {formatDate(selectedRefund.processedAt)}</small>
                    )}
                  </div>
                )}
              </div>

              {selectedRefund?.status === 'PENDING' && (
                <div className="admin-notes-box">
                  <label className="form-label">Admin Notes (Required for rejection)</label>
                  <textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    rows="4"
                    className="form-textarea"
                    placeholder="Add notes about this refund request..."
                  />
                  <small className="form-help-text">Please provide a reason if rejecting the refund</small>
                </div>
              )}
            </div>
            
            {selectedRefund?.status === 'PENDING' && (
              <div className="modal-footer">
                <button 
                  className="btn-cancel" 
                  onClick={() => {
                    setSelectedRefund(null);
                    setAdminNotes('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn-reject-modal"
                  onClick={() => handleReject(selectedRefund?.returnId || selectedRefund?._id)}
                  disabled={processing || !adminNotes.trim()}
                >
                  {processing ? 'Processing...' : 'Reject Refund'}
                </button>
                <button 
                  className="btn-approve-modal"
                  onClick={() => handleApprove(selectedRefund?.returnId || selectedRefund?._id)}
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Approve Refund'}
                </button>
              </div>
            )}
            
            {selectedRefund?.status !== 'PENDING' && (
              <div className="modal-footer single">
                <button 
                  className="btn-close" 
                  onClick={() => setSelectedRefund(null)}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturns;