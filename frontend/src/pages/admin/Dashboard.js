const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './Dashboard.css';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
    unreadMessages: 0,
    totalTransactions: 0,
    totalRevenue: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [notification, setNotification] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    fetchDashboardData();

    if (socket) {
      socket.on('new_transaction', (data) => {
        setNotification({
          type: 'new',
          message: `New transaction: ${data.riceType || data.productName} - ${data.quantity || data.quantityKg}kg for ₱${data.amount || data.amountPaid}`
        });
        fetchDashboardData();
        
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      });

      socket.on('low_stock_alert', (data) => {
        setNotification({
          type: 'warning',
          message: `Low stock alert: ${data.riceType || data.storageName} has only ${data.remainingKg || data.remaining}kg remaining`
        });
        
        if (Notification.permission === 'granted') {
          new Notification('Low Stock Alert', {
            body: `${data.riceType || data.storageName} has only ${data.remainingKg || data.remaining}kg remaining`,
            icon: '/logo192.png'
          });
        }
      });

      socket.on('low_battery_alert', (data) => {
        setNotification({
          type: 'warning',
          message: `Low battery alert: Machine battery at ${data.batteryLevel || data.percentage}%`
        });
      });

      socket.on('security_alert', (data) => {
        setNotification({
          type: 'error',
          message: `Security alert: ${data.message}`
        });
      });

      socket.on('new_return_notification', (data) => {
        setNotification({
          type: 'success',
          message: `New return request from ${data.user?.name || 'customer'}`
        });
      });

      return () => {
        socket.off('new_transaction');
        socket.off('low_stock_alert');
        socket.off('low_battery_alert');
        socket.off('security_alert');
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

  // ===== Extract product name from any possible shape =====
  const getProductName = (t) => {
    if (!t) return 'N/A';

    const direct =
      t.riceType ||
      t.productName ||
      t.product ||
      t.grainType ||
      t.grainName ||
      t.itemName ||
      t.name ||
      t.variety ||
      t.productType ||
      t.description;
    if (typeof direct === 'string' && direct.trim() && !/^[a-f0-9]{24}$/i.test(direct)) return direct;

    if (t.product && typeof t.product === 'object') {
      const n = t.product.name || t.product.productName || t.product.riceType || t.product.title;
      if (n) return n;
    }
    if (t.riceType && typeof t.riceType === 'object') {
      const n = t.riceType.name || t.riceType.productName || t.riceType.title;
      if (n) return n;
    }
    if (t.productId && typeof t.productId === 'object') {
      const n = t.productId.name || t.productId.productName || t.productId.riceType || t.productId.title;
      if (n) return n;
    }
    if (t.inventory && typeof t.inventory === 'object') {
      const n = t.inventory.riceType || t.inventory.productName || t.inventory.name;
      if (n) return n;
    }
    if (t.storage && typeof t.storage === 'object') {
      const n = t.storage.riceType || t.storage.productName || t.storage.name;
      if (n) return n;
    }

    const keys = Object.keys(t);
    for (const k of keys) {
      if (/product|rice|grain|item|variety|name/i.test(k) &&
          typeof t[k] === 'string' &&
          t[k].trim() &&
          t[k].length < 60 &&
          !/^[a-f0-9]{24}$/i.test(t[k])) {
        return t[k];
      }
    }

    return 'N/A';
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch stats + full transaction list (with products)
      const [dashboardRes, transactionsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/dashboard/stats`),
        // ✅ USE THE SAME ENDPOINT AS THE TRANSACTIONS PAGE — it returns full data
        axios.get(`${API_URL}/transactions/all`, { params: { limit: 5 } })
      ]);
      
      setStats(dashboardRes.data.data);
      
      // Normalize the response (Transactions page uses response.data.data)
      let transactions = transactionsRes.data.data || transactionsRes.data || [];
      if (!Array.isArray(transactions)) transactions = [];

      // Only take the 5 most recent
      transactions = transactions.slice(0, 5);

      if (transactions.length > 0) {
        console.log('✅ Dashboard transactions loaded:', transactions.length);
        console.log('Sample transaction keys:', Object.keys(transactions[0]));
        console.log('Sample product name:', getProductName(transactions[0]));
      }

      const processedTransactions = transactions.map(t => ({
        ...t,
        productDisplayName: getProductName(t)
      }));

      setRecentTransactions(processedTransactions);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Fallback — try the /admin/transactions/recent endpoint
      try {
        const fallbackRes = await axios.get(`${API_URL}/admin/transactions/recent?limit=5`);
        const fallbackData = fallbackRes.data.data || fallbackRes.data || [];
        if (Array.isArray(fallbackData)) {
          const processed = fallbackData.map(t => ({
            ...t,
            productDisplayName: getProductName(t)
          }));
          setRecentTransactions(processed);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const formatDateFull = () => {
    return currentTime.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="admin-page-container">
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      <div className="page-header">
  <div className="welcome-section">
    <span className="welcome-badge">Admin Dashboard</span>
    <h1 className="page-title">
      {getGreeting()}, <span>{user?.firstName || 'Admin'}</span>
    </h1>
    <p className="page-description">
      Here's what's happening with your vending machine business today
    </p>
    <span className="welcome-date">{formatDateFull()}</span>
  </div>

  {/* ✅ Text-only brand block (no box) */}
  <div className="brand-block">
    <h2 className="brand-name">AGRIVEND</h2>
    <p className="brand-tagline">Solar Powered Grain Vending Machine</p>
  </div>
</div>

      <div className="stats-grid">
        <div className="stat-card green">
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">Today's Sales</div>
              <div className="stat-value green">{formatCurrency(stats.todaySales)}</div>
            </div>
            <div className="stat-right">
              <span className="stat-change positive">Active</span>
            </div>
          </div>
        </div>

        <div className="stat-card blue">
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">Weekly Sales</div>
              <div className="stat-value blue">{formatCurrency(stats.weekSales)}</div>
            </div>
            <div className="stat-right">
              <span className="stat-change positive">This week</span>
            </div>
          </div>
        </div>

        <div className="stat-card purple">
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">Monthly Sales</div>
              <div className="stat-value purple">{formatCurrency(stats.monthSales)}</div>
            </div>
            <div className="stat-right">
              <span className="stat-change positive">This month</span>
            </div>
          </div>
        </div>

        <div className="stat-card yellow">
          <div className="stat-content">
            <div className="stat-left">
              <div className="stat-label">Total Transactions</div>
              <div className="stat-value yellow">{stats.totalTransactions}</div>
            </div>
            <div className="stat-right">
              <span className="stat-change positive">Completed</span>
            </div>
          </div>
        </div>
      </div>

      <div className="table-card">
        <div className="card-header">
          <div className="card-title">
            Recent Transactions
            {recentTransactions.length > 0 && (
              <span className="card-title-badge">{recentTransactions.length} new</span>
            )}
          </div>
          <div className="card-actions">
            <button 
              className="btn-link"
              onClick={() => window.location.href = '/admin/transactions'}
            >
              View All
            </button>
          </div>
        </div>
        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            Loading transactions...
          </div>
        ) : recentTransactions.length === 0 ? (
          <div className="empty-state">
            <h3>No Recent Transactions</h3>
            <p>Transactions will appear here once customers make purchases.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Date & Time</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Total Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr key={transaction._id || transaction.id}>
                    <td>
                      <span className="transaction-id">
                        {transaction.transactionId || transaction._id?.slice(-8) || 'N/A'}
                      </span>
                    </td>
                    <td>{formatDate(transaction.createdAt)}</td>
                    <td>{transaction.productDisplayName || getProductName(transaction) || 'N/A'}</td>
                    <td>{transaction.quantityKg || transaction.quantity || 0} kg</td>
                    <td className="amount-cell">
                      {formatCurrency(transaction.totalAmount || transaction.amountPaid || 0)}
                    </td>
                    <td>
                      <span className={`status-badge ${(transaction.status || 'COMPLETED').toLowerCase()}`}>
                        {transaction.status || 'COMPLETED'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="quick-actions">
        <div 
          className="quick-action-card"
          onClick={() => window.location.href = '/admin/transactions'}
          style={{ cursor: 'pointer' }}
        >
          <div className="quick-action-title">All Transactions</div>
          <div className="quick-action-desc">View complete transaction history</div>
        </div>

        <div 
          className="quick-action-card"
          onClick={() => window.location.href = '/admin/machine'}
          style={{ cursor: 'pointer' }}
        >
          <div className="quick-action-title">Machine Monitoring</div>
          <div className="quick-action-desc">Monitor vending machine status</div>
        </div>

        <div 
          className="quick-action-card"
          onClick={() => window.location.href = '/admin/reports'}
          style={{ cursor: 'pointer' }}
        >
          <div className="quick-action-title">Sales Reports</div>
          <div className="quick-action-desc">View detailed sales analytics</div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;