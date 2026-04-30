import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import axios from 'axios';
import './Navbar.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Navbar = ({ sidebarOpen, onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isCustomer = user?.role === 'customer';

  const handleToggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    // Small delay to show loading state
    setTimeout(() => {
      logout();
    }, 500);
  };

  const getUserRoleDisplay = () => {
    if (user?.role === 'admin') return 'Admin';
    if (user?.role === 'staff') return 'Staff';
    return 'Customer';
  };

  const getRoleBadgeClass = () => {
    if (user?.role === 'admin') return 'role-badge admin';
    if (user?.role === 'staff') return 'role-badge staff';
    return 'role-badge customer';
  };

  const getDashboardPath = () => {
    if (user?.role === 'admin') return '/admin/dashboard';
    if (user?.role === 'staff') return '/staff/dashboard';
    return '/customer/dashboard';
  };

  useEffect(() => {
    if (!user || !isCustomer) return;
  }, [user, isCustomer]);

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-left">
          <button 
            className="menu-toggle"
            onClick={handleToggleSidebar}
            aria-label="Toggle menu"
          >
            <span className="menu-icon">☰</span>
          </button>
          
          <Link to={getDashboardPath()} className="navbar-logo">
            <span className="logo-text">AgriVend</span>
            <span className={getRoleBadgeClass()}>{getUserRoleDisplay()}</span>
          </Link>
        </div>

        <div className="navbar-actions">
          {isCustomer && (
            <div className="notification-wrapper" ref={dropdownRef}>
              <button 
                className="notification-btn"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <span className="notification-icon">🔔</span>
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </button>

              {showNotifications && (
                <div className="notifications-dropdown">
                  <div className="notifications-header">
                    <h3>Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="notification-count">{unreadCount} new</span>
                    )}
                  </div>

                  <div className="notifications-list">
                    {notifications.length === 0 ? (
                      <div className="no-notifications">
                        <p>No notifications</p>
                      </div>
                    ) : (
                      notifications.map((notification) => (
                        <div
                          key={notification.id}
                          className={`notification-item ${!notification.read ? 'unread' : ''}`}
                          onClick={() => {
                            setShowNotifications(false);
                          }}
                        >
                          <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                            <div className="notification-time">
                              {/* Time formatting */}
                            </div>
                          </div>
                          {!notification.read && <span className="unread-dot" />}
                        </div>
                      ))
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="notifications-footer">
                      <button className="mark-read-btn">
                        Mark all read
                      </button>
                      <button className="clear-btn">
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="user-menu">
            <div className="user-avatar-small">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </div>
            <div className="user-info-small">
              <span className="user-name-small">
                {user?.firstName} {user?.lastName}
              </span>
              <span className="user-role-small">
                {getUserRoleDisplay()}
              </span>
            </div>
            <button 
              onClick={handleLogout} 
              className={`logout-btn ${isLoggingOut ? 'loading' : ''}`}
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <span className="spinner"></span>
                  Logging out...
                </>
              ) : (
                'Logout'
              )}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;