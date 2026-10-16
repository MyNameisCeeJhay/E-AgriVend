import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Left: only the hamburger button — no logo, no badge */}
        <div className="navbar-left">
          <button
            className={`menu-toggle ${sidebarOpen ? 'active' : ''}`}
            onClick={handleToggleSidebar}
            aria-label="Toggle menu"
            type="button"
          >
            <span className="menu-icon">☰</span>
          </button>
        </div>

        {/* Right: user info + logout */}
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