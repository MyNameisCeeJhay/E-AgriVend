import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './Returns.css';

const API_URL = window.location.hostname !== 'localhost'
  ? 'https://e-agrivend.onrender.com/api'
  : (process.env.REACT_APP_API_URL || 'http://localhost:5000/api');

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

  useEffect(() => {
    fetchRefunds();
    fetchStats();

    if (socket) {
      socket.on('new_refund_notification', (data) => {
        setNotification({
          type: 'new',
          message: `New refund request for Transaction: ${data.transactionId}`,
          data
        });
        fetchRefunds();
        fetchStats();
        
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
        
        if (Notification.permission === 'granted') {
          new Notification('New Refund Request', {
            body: `Transaction: ${data.transactionId}\nAmount: ₱${data.amountInserted}`,
            icon: '/logo192.png'
          });
        }
      });

      return () => {
        socket.off('new_refund_notification');
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
      const response = await axios.get(`${API_URL}/refund/admin/all`, {
        params: {
          status: filter !== 'all' ? filter : undefined,
          page: pagination.page,
          limit: 15
        }
      });
      setRefunds(response.data.data || []);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching refunds:', error);
      showNotification('error', 'Failed to load refund requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/refund/admin/stats/summary`);
      setStats({
        pending: response.data.data.pending,
        approved: response.data.data.approved,
        rejected: response.data.data.rejected,
        total: response.data.data.total
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const handleApprove = async (refundId) => {
    const confirmApprove = window.confirm('Are you sure you want to approve this refund request?');
    if (!confirmApprove) return;

    setProcessing(true);
    try {
      await axios.put(`${API_URL}/refund/admin/${refundId}/process`, {
        status: 'APPROVED',
        adminNotes: adminNotes || 'Refund approved by administrator.',
        processedBy: user?._id,
        processedByName: user?.firstName + ' ' + user?.lastName
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
      await axios.put(`${API_URL}/refund/admin/${refundId}/process`, {
        status: 'REJECTED',
        adminNotes: adminNotes,
        processedBy: user?._id,
        processedByName: user?.firstName + ' ' + user?.lastName
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
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
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

  // Toggle filters function
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Handle filter change
  const handleFilterChange = (e) => {
    const newFilter = e.target.value;
    setFilter(newFilter);
    setPagination({ ...pagination, page: 1 });
  };

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

      {/* Filters Section - Only shows when showFilters is true */}
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

      {/* Refunds Table */}
      {loading ? (
        <div className="loading-state">Loading refund requests...</div>
      ) : refunds.length === 0 ? (
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
                  <tr key={refund._id} className={refund.status === 'PENDING' ? 'pending-row' : ''}>
                    <td className="transaction-id-cell">
                      <span className="transaction-id">{refund.transactionNumber}</span>
                    </td>
                    <td className="date-cell">{formatDate(refund.createdAt)}</td>
                    <td className="product-cell">{refund.grainType}</td>
                    <td className="quantity-cell">{refund.selectedQuantity} kg</td>
                    <td className="amount-cell">{formatCurrency(refund.amountInserted)}</td>
                    <td className="reason-cell">
                      <div className="reason-text" title={refund.refundReason}>
                        {refund.refundReason.length > 35 
                          ? refund.refundReason.substring(0, 35) + '...' 
                          : refund.refundReason}
                      </div>
                    </td>
                    <td className="status-cell">
                      <div className="status-container">
                        <span className={`status-badge ${getStatusClass(refund.status)}`}>
                          {refund.status}
                        </span>
                      </div>
                    </td>
                    <td className="actions-cell">
                      {refund.status === 'PENDING' && (
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
                      {refund.status !== 'PENDING' && (
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
              <h2>{selectedRefund.status === 'PENDING' ? 'Process Refund Request' : 'Refund Request Details'}</h2>
              <button className="modal-close" onClick={() => setSelectedRefund(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="refund-details">
                <h3>Transaction Information</h3>
                <div className="details-grid">
                  <div className="detail-row">
                    <span className="detail-label">Transaction ID:</span>
                    <span className="detail-value highlight">{selectedRefund.transactionNumber}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Transaction Date:</span>
                    <span className="detail-value">{selectedRefund.transactionDate} at {selectedRefund.transactionTime}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Product:</span>
                    <span className="detail-value">{selectedRefund.grainType}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Quantity:</span>
                    <span className="detail-value">{selectedRefund.selectedQuantity} kg</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Amount Paid:</span>
                    <span className="detail-value amount">{formatCurrency(selectedRefund.amountInserted)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Submitted:</span>
                    <span className="detail-value">{formatDate(selectedRefund.createdAt)}</span>
                  </div>
                </div>

                <div className="customer-info">
                  <h3>Customer Information</h3>
                  <div className="details-grid">
                    <div className="detail-row">
                      <span className="detail-label">Name:</span>
                      <span className="detail-value">{selectedRefund.fullName}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Email:</span>
                      <span className="detail-value">{selectedRefund.email}</span>
                    </div>
                  </div>
                </div>

                <div className="reason-box">
                  <h4>Refund Reason</h4>
                  <p>{selectedRefund.refundReason}</p>
                </div>

                <div className="description-box">
                  <h4>Customer Description</h4>
                  <p>{selectedRefund.description}</p>
                </div>

                {selectedRefund.receiptImage && (
                  <div className="receipt-box">
                    <h4>Receipt Attachment</h4>
                    <button 
                      className="btn-download"
                      onClick={() => window.open(`${API_URL}${selectedRefund.receiptImage}`, '_blank')}
                    >
                      View Receipt
                    </button>
                  </div>
                )}

                {selectedRefund.status !== 'PENDING' && selectedRefund.adminNotes && (
                  <div className="admin-notes-display">
                    <h4>Admin Notes</h4>
                    <p>{selectedRefund.adminNotes}</p>
                    {selectedRefund.processedAt && (
                      <small>Processed on: {formatDate(selectedRefund.processedAt)}</small>
                    )}
                  </div>
                )}
              </div>

              {selectedRefund.status === 'PENDING' && (
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
            
            {selectedRefund.status === 'PENDING' && (
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
                  onClick={() => handleReject(selectedRefund._id)}
                  disabled={processing || !adminNotes.trim()}
                >
                  {processing ? 'Processing...' : 'Reject Refund'}
                </button>
                <button 
                  className="btn-approve-modal"
                  onClick={() => handleApprove(selectedRefund._id)}
                  disabled={processing}
                >
                  {processing ? 'Processing...' : 'Approve Refund'}
                </button>
              </div>
            )}
            
            {selectedRefund.status !== 'PENDING' && (
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