import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './Returns.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminReturns = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReturn, setSelectedReturn] = useState(null);
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
    fetchReturns();
    fetchStats();

    if (socket) {
      socket.on('new_return_notification', (data) => {
        setNotification({
          type: 'new',
          message: `New return request from ${data.user.name}: ${data.riceType} - ${data.quantity}kg`,
          data
        });
        fetchReturns();
        fetchStats();
        
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
        
        if (Notification.permission === 'granted') {
          new Notification('New Return Request', {
            body: `From: ${data.user.name}\nItem: ${data.riceType} - ${data.quantity}kg`,
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
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_URL}/returns/admin/all`, {
        params: {
          status: filter !== 'all' ? filter : undefined,
          page: pagination.page
        }
      });
      setReturns(response.data.data || []);
      setPagination(response.data.pagination);
    } catch (error) {
      console.error('Error fetching returns:', error);
      showNotification('error', 'Failed to load returns');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/returns/admin/stats`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const handleProcessReturn = async (returnId, status) => {
    if (!adminNotes.trim() && status === 'REJECTED') {
      showNotification('error', 'Please provide a reason when rejecting a return');
      return;
    }

    setProcessing(true);
    try {
      await axios.put(`${API_URL}/returns/admin/${returnId}/process`, {
        status,
        adminNotes
      });
      
      setSelectedReturn(null);
      setAdminNotes('');
      fetchReturns();
      fetchStats();
      
      showNotification('success', `Return ${status.toLowerCase()} successfully`);
    } catch (error) {
      console.error('Error processing return:', error);
      showNotification('error', error.response?.data?.error || 'Failed to process return');
    } finally {
      setProcessing(false);
    }
  };

  const handleDownloadReceipt = async (returnId) => {
    try {
      const response = await axios.get(`${API_URL}/returns/admin/${returnId}/receipt`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `receipt-${returnId}.jpg`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Error downloading receipt:', error);
      showNotification('error', 'Failed to download receipt');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
          <h1>Return Requests</h1>
          <p>Manage customer return requests and refunds</p>
        </div>
        <div className="returns-header-right">
          <button className="btn-secondary" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="returns-stats">
        <div className="stat-card">
          <div className="stat-label">Total Returns</div>
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

      {/* Filters */}
      {showFilters && (
        <div className="filters-card">
          <div className="filter-controls">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Returns</option>
              <option value="PENDING">Pending Only</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>
        </div>
      )}

      {/* Returns Table */}
      {loading ? (
        <div className="loading-state">Loading return requests...</div>
      ) : returns.length === 0 ? (
        <div className="empty-state">
          <h3>No Return Requests</h3>
          <p>There are no return requests to display.</p>
        </div>
      ) : (
        <div className="returns-table">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Receipt</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {returns.map((returnReq) => (
                  <tr key={returnReq._id} className={returnReq.status === 'PENDING' ? 'pending-row' : ''}>
                    <td>
                      <span className="return-id">{returnReq.returnId || returnReq._id.slice(-8)}</span>
                    </td>
                    <td className="date-cell">{formatDate(returnReq.createdAt)}</td>
                    <td>
                      <div className="customer-cell">
                        <div className="customer-name">
                          {returnReq.user?.firstName} {returnReq.user?.lastName}
                        </div>
                        <div className="customer-email">{returnReq.user?.email}</div>
                      </div>
                    </td>
                    <td>{returnReq.riceType}</td>
                    <td>{returnReq.quantityKg} kg</td>
                    <td className="amount-cell">{formatCurrency(returnReq.amountPaid)}</td>
                    <td>
                      <div className="reason-cell" title={returnReq.returnReason}>
                        {returnReq.returnReason.length > 40 
                          ? returnReq.returnReason.substring(0, 40) + '...' 
                          : returnReq.returnReason}
                      </div>
                    </td>
                    <td>
                      {returnReq.receiptFilename && (
                        <button 
                          className="receipt-btn"
                          onClick={() => handleDownloadReceipt(returnReq.returnId || returnReq._id)}
                          title="Download receipt"
                        >
                          Download
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="status-container">
                        <span className={`status-badge ${getStatusClass(returnReq.status)}`}>
                          {returnReq.status}
                        </span>
                        {returnReq.adminNotes && returnReq.status !== 'PENDING' && (
                          <span className="admin-notes-icon" title={returnReq.adminNotes}>i</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {returnReq.status === 'PENDING' ? (
                        <button 
                          className="action-btn action-btn-process"
                          onClick={() => setSelectedReturn(returnReq)}
                        >
                          Process
                        </button>
                      ) : (
                        <span className="processed-by">
                          by {returnReq.processedBy?.firstName}
                        </span>
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

      {/* Process Return Modal */}
      {selectedReturn && (
        <div className="modal-overlay" onClick={() => setSelectedReturn(null)}>
          <div className="modal-container large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Process Return Request</h2>
              <button className="modal-close" onClick={() => setSelectedReturn(null)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="return-details">
                <h3>Return Details</h3>
                <div className="details-grid">
                  <div className="detail-row">
                    <span className="detail-label">Return ID</span>
                    <span className="detail-value">{selectedReturn.returnId || selectedReturn._id.slice(-8)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Customer</span>
                    <span className="detail-value">
                      {selectedReturn.user?.firstName} {selectedReturn.user?.lastName}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Email</span>
                    <span className="detail-value">{selectedReturn.user?.email}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Phone</span>
                    <span className="detail-value">{selectedReturn.user?.phone || 'N/A'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Product</span>
                    <span className="detail-value">{selectedReturn.riceType}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Quantity</span>
                    <span className="detail-value">{selectedReturn.quantityKg} kg</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Amount</span>
                    <span className="detail-value amount">{formatCurrency(selectedReturn.amountPaid)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Date</span>
                    <span className="detail-value">{formatDate(selectedReturn.createdAt)}</span>
                  </div>
                </div>

                <div className="reason-box">
                  <h4>Return Reason</h4>
                  <p>{selectedReturn.returnReason}</p>
                </div>

                {selectedReturn.receiptFilename && (
                  <div className="receipt-box">
                    <h4>Receipt Attachment</h4>
                    <button 
                      className="btn-download"
                      onClick={() => handleDownloadReceipt(selectedReturn.returnId || selectedReturn._id)}
                    >
                      Download Receipt
                    </button>
                  </div>
                )}
              </div>

              <div className="admin-notes-box">
                <label className="form-label">Admin Notes / Reason for Rejection</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows="4"
                  className="form-textarea"
                  placeholder="Add notes about this return (required for rejection)..."
                />
                <small className="form-help-text">Provide details about your decision</small>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setSelectedReturn(null)}
              >
                Cancel
              </button>
              <button 
                className="btn-danger"
                onClick={() => handleProcessReturn(selectedReturn.returnId || selectedReturn._id, 'REJECTED')}
                disabled={processing || !adminNotes.trim()}
              >
                {processing ? 'Processing...' : 'Reject Return'}
              </button>
              <button 
                className="btn-primary"
                onClick={() => handleProcessReturn(selectedReturn.returnId || selectedReturn._id, 'APPROVED')}
                disabled={processing}
              >
                {processing ? 'Processing...' : 'Approve Return'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReturns;