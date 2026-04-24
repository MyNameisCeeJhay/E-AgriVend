import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './Dashboard.css';

const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api'
  : 'https://e-agrivend.onrender.com/api';

const AdminDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todaySales: 0,
    weekSales: 0,
    monthSales: 0,
    pendingReturns: 0,
    unreadMessages: 0,
    totalTransactions: 0
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchDashboardData();

    if (socket) {
      socket.on('new_transaction', (data) => {
        setNotification({
          type: 'new',
          message: `New transaction: ${data.riceType} - ${data.quantity}kg for ₱${data.amount}`
        });
        fetchDashboardData();
        
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      });

      socket.on('low_stock_alert', (data) => {
        setNotification({
          type: 'warning',
          message: `Low stock alert: ${data.riceType} has only ${data.remainingKg}kg remaining`
        });
        
        if (Notification.permission === 'granted') {
          new Notification('Low Stock Alert', {
            body: `${data.riceType} has only ${data.remainingKg}kg remaining`,
            icon: '/logo192.png'
          });
        }
      });

      socket.on('low_battery_alert', (data) => {
        setNotification({
          type: 'warning',
          message: `Low battery alert: Machine battery at ${data.batteryLevel}%`
        });
      });

      socket.on('security_alert', (data) => {
        setNotification({
          type: 'error',
          message: `Security alert: ${data.message}`
        });
      });

      return () => {
        socket.off('new_transaction');
        socket.off('low_stock_alert');
        socket.off('low_battery_alert');
        socket.off('security_alert');
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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, transactionsRes] = await Promise.all([
        axios.get(`${API_URL}/admin/dashboard/stats`),
        axios.get(`${API_URL}/admin/transactions/recent?limit=5`)
      ]);
      
      setStats(dashboardRes.data.data);
      setRecentTransactions(transactionsRes.data.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
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

  return (
    <div className="admin-page-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Admin Dashboard</h1>
          <p className="page-description">
            Welcome back, {user?.firstName} {user?.lastName}
          </p>
        </div>
      </div>

      {/* Sales Analytics Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Today's Sales</div>
            <div className="stat-value success">{formatCurrency(stats.todaySales)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">This Week</div>
            <div className="stat-value">{formatCurrency(stats.weekSales)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">This Month</div>
            <div className="stat-value">{formatCurrency(stats.monthSales)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Pending Returns</div>
            <div className="stat-value warning">{stats.pendingReturns}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-content">
            <div className="stat-label">Total Transactions</div>
            <div className="stat-value">{stats.totalTransactions}</div>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="table-card">
        <div className="card-header">
          <h2 className="card-title">Recent Transactions</h2>
        </div>
        {loading ? (
          <div className="loading-state">Loading transactions...</div>
        ) : recentTransactions.length === 0 ? (
          <div className="empty-state">
            <h3>No Recent Transactions</h3>
            <p>No transactions have been recorded yet.</p>
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
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((transaction) => (
                  <tr key={transaction._id}>
                    <td>
                      <span className="transaction-id">{transaction.transactionId || transaction._id.slice(-6)}</span>
                    </td>
                    <td>{formatDate(transaction.createdAt)}</td>
                    <td>{transaction.riceType}</td>
                    <td>{transaction.quantityKg} kg</td>
                    <td className="amount-cell">{formatCurrency(transaction.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
<div className="quick-actions">
  <button className="btn-primary" onClick={() => window.location.href = '/admin/transactions'}>
    View All Transactions
  </button>
  <button className="btn-secondary" onClick={() => window.location.href = '/admin/reports'}>
    Generate Reports
  </button>
  
</div>
    </div>
  );
};

export default AdminDashboard;