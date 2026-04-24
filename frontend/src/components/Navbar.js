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

  const isCustomer = user?.role === 'customer';
  const isAdmin = user?.role === 'admin';

  // Handle sidebar toggle - calls the function from Layout
  const handleToggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  useEffect(() => {
    if (!user || !isCustomer) return;
    
    const loadNotifications = async () => {
      try {
        const cleared = localStorage.getItem(`notifications_cleared_${user._id}`);
        const stored = localStorage.getItem(`notifications_${user._id}`);
        
        if (stored) {
          setNotifications(JSON.parse(stored));
        } else if (!cleared) {
          const welcomeNotif = [{
            id: Date.now(),
            type: 'welcome',
            title: 'Welcome to AgriVend!',
            message: 'Thank you for being a valued customer.',
            link: '/customer/dashboard',
            time: new Date().toISOString(),
            read: false
          }];
          setNotifications(welcomeNotif);
          localStorage.setItem(`notifications_${user._id}`, JSON.stringify(welcomeNotif));
        }

        await fetchNotificationsFromServer();
        
      } catch (error) {
        console.error('Error loading notifications:', error);
      }
    };

    loadNotifications();
  }, [user, isCustomer]);

  const fetchNotificationsFromServer = async () => {
    if (!user || !isCustomer) return;

    try {
      const ratingsRes = await axios.get(`${API_URL}/ratings/machine/my-ratings`).catch(() => ({ data: { data: [] } }));
      const returnsRes = await axios.get(`${API_URL}/returns/my-returns`).catch(() => ({ data: { data: [] } }));

      const ratings = ratingsRes.data.data || [];
      const returns = returnsRes.data.data || [];

      const serverNotifications = [];

      ratings.forEach(rating => {
        if (rating.adminReply && !rating.replySeenByCustomer) {
          serverNotifications.push({
            id: `rating_${rating._id}`,
            type: 'rating_reply',
            title: 'Reply to Your Rating',
            message: rating.adminReply.length > 50 
              ? rating.adminReply.substring(0, 50) + '...' 
              : rating.adminReply,
            link: '/customer/ratings',
            time: rating.repliedAt || rating.updatedAt,
            read: false
          });
        }
      });

      returns.forEach(returnReq => {
        if (returnReq.status !== 'PENDING' && !returnReq.seenByCustomer) {
          const statusMessage = returnReq.status === 'APPROVED' ? 'approved' : 'rejected';
          serverNotifications.push({
            id: `return_${returnReq._id}`,
            type: 'return_update',
            title: 'Return Update',
            message: `Your return request has been ${statusMessage}`,
            link: '/customer/returns',
            time: returnReq.processedAt || returnReq.updatedAt,
            read: false
          });
        }
      });

      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.id));
        const newNotifs = serverNotifications.filter(n => !existingIds.has(n.id));
        return [...newNotifs, ...prev].slice(0, 30);
      });

    } catch (error) {
      console.error('Error fetching server notifications:', error);
    }
  };

  useEffect(() => {
    if (!socket || !user || !isCustomer) return;

    socket.on('rating_reply_notification', (data) => {
      if (data.userId === user._id) {
        addNotification({
          type: 'rating_reply',
          title: 'Reply to Your Rating',
          message: data.message || 'Admin replied to your feedback',
          link: '/customer/ratings'
        });
      }
    });

    socket.on('return_status_update', (data) => {
      if (data.userId === user._id) {
        const statusMessage = data.status === 'APPROVED' ? 'approved' : 'rejected';
        addNotification({
          type: 'return_update',
          title: 'Return Update',
          message: `Your return request has been ${statusMessage}`,
          link: '/customer/returns'
        });
      }
    });

    return () => {
      socket.off('rating_reply_notification');
      socket.off('return_status_update');
    };
  }, [socket, user, isCustomer]);

  useEffect(() => {
    const unread = notifications.filter(n => !n.read).length;
    setUnreadCount(unread);
  }, [notifications]);

  useEffect(() => {
    if (user && isCustomer && notifications.length > 0) {
      localStorage.setItem(`notifications_${user._id}`, JSON.stringify(notifications));
    }
  }, [notifications, user, isCustomer]);

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      time: new Date().toISOString(),
      read: false,
      ...notification
    };

    setNotifications(prev => {
      const isDuplicate = prev.some(n => 
        n.type === notification.type && 
        n.message === notification.message &&
        Date.now() - new Date(n.time).getTime() < 5000
      );
      if (isDuplicate) return prev;
      return [newNotification, ...prev].slice(0, 30);
    });

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/logo192.png'
      });
    }
  };

  const markAsRead = async (notification) => {
    setNotifications(prev => 
      prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
    );

    try {
      if (notification.type === 'rating_reply' && notification.id.toString().startsWith('rating_')) {
        const ratingId = notification.id.toString().replace('rating_', '');
        await axios.put(`${API_URL}/ratings/machine/${ratingId}/mark-seen`);
      } else if (notification.type === 'return_update' && notification.id.toString().startsWith('return_')) {
        const returnId = notification.id.toString().replace('return_', '');
        await axios.put(`${API_URL}/returns/${returnId}/mark-seen`);
      }
    } catch (error) {
      console.error('Error marking as seen:', error);
    }
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
    if (user && isCustomer) {
      localStorage.setItem(`notifications_cleared_${user._id}`, 'true');
      localStorage.removeItem(`notifications_${user._id}`);
    }
    setShowNotifications(false);
  };

  const handleNotificationClick = (notification) => {
    markAsRead(notification);
    setShowNotifications(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour ago`;
    if (diffDays < 7) return `${diffDays} day ago`;
    return then.toLocaleDateString();
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isCustomer && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isCustomer]);

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
          
          <Link to={isCustomer ? "/customer/dashboard" : "/admin/dashboard"} className="navbar-logo">
            <span className="logo-text">AgriVend</span>
            {isAdmin && <span className="logo-badge">Admin</span>}
          </Link>
        </div>

        <div className="navbar-actions">
          {isCustomer && (
            <div className="notification-wrapper" ref={dropdownRef}>
              <button 
                className={`notification-btn ${unreadCount > 0 ? 'has-notifications' : ''}`}
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
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="notification-content">
                            <div className="notification-title">{notification.title}</div>
                            <div className="notification-message">{notification.message}</div>
                            <div className="notification-time">
                              {getTimeAgo(notification.time)}
                            </div>
                          </div>
                          {!notification.read && <span className="unread-dot" />}
                        </div>
                      ))
                    )}
                  </div>

                  {notifications.length > 0 && (
                    <div className="notifications-footer">
                      <button onClick={markAllAsRead} className="mark-read-btn">
                        Mark all read
                      </button>
                      <button onClick={clearAll} className="clear-btn">
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
                {isAdmin ? 'Administrator' : 'Customer'}
              </span>
            </div>
            <button onClick={logout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;