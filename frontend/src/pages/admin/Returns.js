const API_URL = 'https://e-agrivend.onrender.com/api';

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
  const abortControllerRef = useRef(null);

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
      
      const response = await axios.get(`${API_URL}/refund/admin/all`, {
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
      
      const response = await axios.get(`${API_URL}/refund/admin/stats/summary`, {
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

  const handleApprove = async (refundId) => {
    const confirmApprove = window.confirm('Are you sure you want to approve this refund request?');
    if (!confirmApprove) return;

    setProcessing(true);
    try {
      const authToken = localStorage.getItem('token');
      await axios.put(`${API_URL}/refund/admin/${refundId}/process`, {
        status: 'APPROVED',
        adminNotes: 'Refund approved by administrator.',
        processedBy: user?._id,
        processedByName: user?.firstName + ' ' + user?.lastName
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 15000
      });
      
      setSelectedRefund(null);
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
    const confirmReject = window.confirm('Are you sure you want to reject this refund request?');
    if (!confirmReject) return;

    setProcessing(true);
    try {
      const authToken = localStorage.getItem('token');
      await axios.put(`${API_URL}/refund/admin/${refundId}/process`, {
        status: 'REJECTED',
        adminNotes: 'Refund rejected by administrator.',
        processedBy: user?._id,
        processedByName: user?.firstName + ' ' + user?.lastName
      }, {
        headers: { Authorization: `Bearer ${authToken}` },
        timeout: 15000
      });
      
      setSelectedRefund(null);
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
    return refund?.grainType || refund?.riceType || 'N/A';
  };

  const getQuantity = (refund) => {
    return refund?.selectedQuantity || refund?.quantityKg || 0;
  };

  const getAmount = (refund) => {
    return refund?.amountInserted || refund?.amountPaid || 0;
  };

  const getReason = (refund) => {
    return refund?.refundReason || refund?.returnReason || 'N/A';
  };

  const getDescription = (refund) => {
    return refund?.description || '';
  };

  const viewReceipt = async (filename) => {
  if (!filename) {
    showNotification('error', 'No receipt file attached');
    return;
  }
  
  try {
    const authToken = localStorage.getItem('token');
    
    if (!authToken) {
      showNotification('error', 'Please log in to view receipt');
      return;
    }
    
    // Open a new window with loading message
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write('<div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: Arial;">Loading receipt...</div>');
    
    // Fetch the receipt image with authentication
    const response = await fetch(`${API_URL}/refund/receipt-image/${filename}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);
    
    // Display the image in the new window
    receiptWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${filename}</title>
          <style>
            body {
              margin: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #f5f5f5;
              font-family: Arial, sans-serif;
            }
            .container {
              max-width: 90%;
              max-height: 90vh;
              text-align: center;
            }
            img {
              max-width: 100%;
              max-height: 85vh;
              object-fit: contain;
              box-shadow: 0 4px 20px rgba(0,0,0,0.2);
              border-radius: 8px;
            }
            .button-group {
              margin-top: 20px;
            }
            button {
              padding: 10px 20px;
              margin: 0 10px;
              border: none;
              border-radius: 5px;
              cursor: pointer;
              font-size: 14px;
            }
            .btn-download {
              background: #2d6a4f;
              color: white;
            }
            .btn-close {
              background: #6c757d;
              color: white;
            }
            .error-message {
              text-align: center;
              color: red;
              font-family: Arial, sans-serif;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="${imageUrl}" alt="Receipt Image" onerror="this.style.display='none'; document.getElementById('errorMsg').style.display='block';" />
            <div id="errorMsg" style="display:none; color:red; margin-top:20px;">
              Failed to load receipt image.
            </div>
            <div class="button-group">
              <button class="btn-download" onclick="downloadImage()">📥 Download Receipt</button>
              <button class="btn-close" onclick="window.close()">✖ Close</button>
            </div>
          </div>
          <script>
            function downloadImage() {
              const link = document.createElement('a');
              link.href = "${imageUrl}";
              link.download = "${filename}";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          </script>
        </body>
      </html>
    `);
    receiptWindow.document.close();
    
  } catch (error) {
    console.error('Error viewing receipt:', error);
    showNotification('error', 'Failed to load receipt. Please try again.');
  }
};

  // Loading state
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

  // Error state
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
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Header with Show Filters Button */}
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

      {/* Refunds Table */}
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

      {/* Modal */}
      {selectedRefund && (
        <div className="modal-overlay" onClick={() => setSelectedRefund(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Refund Request Details</h2>
              <button className="modal-close" onClick={() => setSelectedRefund(null)}>×</button>
            </div>
            
            <div className="modal-body">
              {/* Transaction Information */}
              <div className="details-section">
                <h3>Transaction Information</h3>
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

              {/* Customer Information */}
              <div className="details-section">
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

              {/* Refund Reason */}
              <div className="details-section">
                <h3>Refund Reason</h3>
                <div className="info-box">
                  <p>{getReason(selectedRefund)}</p>
                </div>
              </div>

              {/* Customer Description */}
              <div className="details-section">
                <h3>Customer Description</h3>
                <div className="info-box">
                  <p>{getDescription(selectedRefund) || 'No description provided.'}</p>
                </div>
              </div>

              {/* Receipt Attachment */}
              {selectedRefund?.receiptFilename && (
                <div className="details-section">
                  <h3>Receipt Attachment</h3>
                  <button 
                    className="btn-view-receipt"
                    onClick={() => viewReceipt(selectedRefund.receiptFilename)}
                  >
                    📄 View Receipt
                  </button>
                </div>
              )}

              {/* Admin Notes - Only show if exists and not pending */}
              {selectedRefund?.status !== 'PENDING' && selectedRefund?.adminNotes && (
                <div className="details-section">
                  <h3>Admin Notes</h3>
                  <div className="info-box">
                    <p>{selectedRefund.adminNotes}</p>
                    {selectedRefund.processedAt && (
                      <small>Processed on: {formatDate(selectedRefund.processedAt)}</small>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer with Approve/Reject for PENDING, Close for others */}
            <div className="modal-footer">
              {selectedRefund?.status === 'PENDING' ? (
                <>
                  <button 
                    className="btn-reject-modal"
                    onClick={() => handleReject(selectedRefund?._id)}
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Reject Refund'}
                  </button>
                  <button 
                    className="btn-approve-modal"
                    onClick={() => handleApprove(selectedRefund?._id)}
                    disabled={processing}
                  >
                    {processing ? 'Processing...' : 'Approve Refund'}
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