import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

const StaffNavbar = ({ sidebarOpen, onToggleSidebar }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  const handleToggleSidebar = () => {
    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
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

export default StaffNavbar;