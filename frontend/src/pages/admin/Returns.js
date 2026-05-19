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
  const [receiptLoading, setReceiptLoading] = useState(false);
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
      
      // Log the filename for debugging
      console.log('Attempting to load receipt:', receiptFilename);
      
      // Try to open a new window for the receipt
      let receiptWindow = null;
      try {
        receiptWindow = window.open('', '_blank');
        if (!receiptWindow) {
          throw new Error('Popup blocked');
        }
        
        // Show loading message
        receiptWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Loading Receipt...</title>
              <style>
                body {
                  margin: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  height: 100vh;
                  font-family: Arial, sans-serif;
                  background: #f5f5f5;
                }
                .loader {
                  text-align: center;
                }
                .spinner {
                  border: 4px solid #f3f3f3;
                  border-top: 4px solid #3498db;
                  border-radius: 50%;
                  width: 40px;
                  height: 40px;
                  animation: spin 1s linear infinite;
                  margin: 0 auto 20px;
                }
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              </style>
            </head>
            <body>
              <div class="loader">
                <div class="spinner"></div>
                <p>Loading receipt image...</p>
                <p style="font-size: 12px; color: #666;">Filename: ${receiptFilename}</p>
              </div>
            </body>
          </html>
        `);
        receiptWindow.document.close();
      } catch (popupError) {
        console.error('Popup error:', popupError);
        showNotification('warning', 'Please allow popups to view receipts. Click the View Receipt button again.');
        setReceiptLoading(false);
        return;
      }
      
      // Try direct URL approach first (most reliable)
      const directUrl = `${API_URL}/uploads/returns/${encodeURIComponent(receiptFilename)}`;
      console.log('Trying direct URL:', directUrl);
      
      // Try to fetch the image with authentication
      let imageUrl = null;
      let blob = null;
      
      // List of endpoints to try in order
      const endpoints = [
        `${API_URL}/refund/receipt-image/${encodeURIComponent(receiptFilename)}`,
        `${API_URL}/refund/receipt/${encodeURIComponent(receiptFilename)}`,
        `${API_URL}/uploads/returns/${encodeURIComponent(receiptFilename)}`,
        `${API_URL}/receipts/${encodeURIComponent(receiptFilename)}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          console.log('Trying endpoint:', endpoint);
          const response = await axios.get(endpoint, {
            headers: { 'Authorization': `Bearer ${authToken}` },
            responseType: 'blob',
            timeout: 10000
          });
          
          if (response.status === 200 && response.data && response.data.size > 0) {
            blob = response.data;
            imageUrl = URL.createObjectURL(blob);
            console.log('Successfully loaded from:', endpoint);
            break;
          }
        } catch (error) {
          console.log(`Endpoint failed: ${endpoint}`, error.message);
        }
      }
      
      if (!imageUrl || !blob) {
        // Check if window is still open
        if (receiptWindow && !receiptWindow.closed) {
          receiptWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Receipt Error</title>
                <style>
                  body {
                    margin: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    font-family: Arial, sans-serif;
                    background: #f5f5f5;
                  }
                  .error-container {
                    text-align: center;
                    background: white;
                    padding: 40px;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    max-width: 500px;
                    margin: 20px;
                  }
                  .error-icon {
                    font-size: 64px;
                    margin-bottom: 20px;
                  }
                  h3 {
                    color: #dc3545;
                    margin-bottom: 10px;
                  }
                  p {
                    color: #666;
                    margin-bottom: 10px;
                  }
                  .filename {
                    background: #f8f9fa;
                    padding: 10px;
                    border-radius: 6px;
                    font-family: monospace;
                    font-size: 12px;
                    word-break: break-all;
                    margin: 15px 0;
                  }
                  button {
                    padding: 10px 24px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    margin-top: 10px;
                  }
                  button:hover {
                    background: #5a6268;
                  }
                </style>
              </head>
              <body>
                <div class="error-container">
                  <div class="error-icon">❌</div>
                  <h3>Failed to Load Receipt</h3>
                  <p>The receipt file could not be found or loaded.</p>
                  <div class="filename">
                    <strong>Filename:</strong> ${receiptFilename}
                  </div>
                  <p><small>Please check if the file exists on the server.</small></p>
                  <button onclick="window.close()">Close Window</button>
                </div>
              </body>
            </html>
          `);
          receiptWindow.document.close();
        }
        throw new Error('Could not load receipt from any endpoint');
      }
      
      // Check if window is still open
      if (!receiptWindow || receiptWindow.closed) {
        receiptWindow = window.open('', '_blank');
        if (!receiptWindow) {
          throw new Error('Cannot open new window');
        }
      }
      
      // Display the image in the window
      receiptWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Receipt - ${receiptFilename}</title>
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              body {
                background: #f5f5f5;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                padding: 20px;
              }
              .container {
                max-width: 90%;
                margin: 0 auto;
                text-align: center;
                background: white;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                padding: 20px;
              }
              h2 {
                color: #333;
                margin-bottom: 20px;
                font-size: 24px;
              }
              .receipt-info {
                background: #f8f9fa;
                padding: 12px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-size: 14px;
                color: #666;
              }
              .receipt-info strong {
                color: #333;
              }
              .image-container {
                margin: 20px 0;
                text-align: center;
                min-height: 200px;
                display: flex;
                justify-content: center;
                align-items: center;
              }
              img {
                max-width: 100%;
                max-height: 70vh;
                object-fit: contain;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
              }
              .button-group {
                margin-top: 20px;
                display: flex;
                gap: 12px;
                justify-content: center;
                flex-wrap: wrap;
              }
              button {
                padding: 10px 24px;
                border: none;
                border-radius: 8px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.3s ease;
              }
              .btn-download {
                background: #2d6a4f;
                color: white;
              }
              .btn-download:hover {
                background: #1b4d3e;
                transform: translateY(-1px);
              }
              .btn-close {
                background: #6c757d;
                color: white;
              }
              .btn-close:hover {
                background: #5a6268;
                transform: translateY(-1px);
              }
              .error-message {
                text-align: center;
                color: #dc3545;
                padding: 40px;
              }
              @media (max-width: 768px) {
                .container {
                  padding: 12px;
                }
                h2 {
                  font-size: 18px;
                }
                button {
                  padding: 8px 16px;
                  font-size: 12px;
                }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>📄 Receipt Attachment</h2>
              <div class="receipt-info">
                <strong>Filename:</strong> ${receiptFilename}
              </div>
              <div class="image-container">
                <img src="${imageUrl}" alt="Receipt Image" onerror="this.parentElement.innerHTML='<div class=\\'error-message\\'>❌ Failed to display receipt image. The file may be corrupted.</div>'" />
              </div>
              <div class="button-group">
                <button class="btn-download" onclick="downloadImage()">📥 Download Receipt</button>
                <button class="btn-close" onclick="window.close()">✖ Close Window</button>
              </div>
            </div>
            <script>
              function downloadImage() {
                const link = document.createElement('a');
                link.href = "${imageUrl}";
                link.download = "${receiptFilename}";
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }
              
              // Clean up when window closes
              window.addEventListener('beforeunload', function() {
                URL.revokeObjectURL("${imageUrl}");
              });
            </script>
          </body>
        </html>
      `);
      receiptWindow.document.close();
      
      showNotification('success', 'Receipt loaded successfully');
      
    } catch (error) {
      console.error('Error viewing receipt:', error);
      showNotification('error', 'Failed to load receipt. The file may be missing or corrupted.');
    } finally {
      setReceiptLoading(false);
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
              {(selectedRefund?.receiptFilename || selectedRefund?.receiptImage) && (
                <div className="details-section">
                  <h3>Receipt Attachment</h3>
                  <button 
                    className="btn-view-receipt"
                    onClick={() => viewReceipt(selectedRefund.receiptFilename || selectedRefund.receiptImage)}
                    disabled={receiptLoading}
                  >
                    {receiptLoading ? '⏳ Loading Receipt...' : '📄 View Receipt'}
                  </button>
                  <small className="receipt-hint">
                    Note: If receipt doesn't load, please check that the file exists on the server
                  </small>
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