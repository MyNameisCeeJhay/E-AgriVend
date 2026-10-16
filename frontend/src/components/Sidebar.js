import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose, isMobile }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff';

  const adminNavItems = [
    { name: 'Dashboard', path: '/admin/dashboard', description: 'Analytics' },
    { name: 'Machine', path: '/admin/machine', description: 'Monitor machine' },
    { name: 'Transactions', path: '/admin/transactions', description: 'All purchases' },
    { name: 'Staff', path: '/admin/staff', description: 'Manage staff accounts' },
    { name: 'Reports', path: '/admin/reports', description: 'Sales reports' },
  ];

  const staffNavItems = [
    { name: 'Dashboard', path: '/staff/dashboard', description: 'Overview' },
    { name: 'Transactions', path: '/staff/transactions', description: 'View purchases' },
  ];

  const customerNavItems = [
    { name: 'Dashboard', path: '/customer/dashboard', description: 'Overview' },
    { name: 'Transactions', path: '/customer/transactions', description: 'Purchase history' },
    { name: 'Ratings', path: '/customer/ratings', description: 'Your reviews' },
    { name: 'Returns', path: '/customer/returns', description: 'Return requests' },
    { name: 'Profile', path: '/customer/profile', description: 'Account settings' },
  ];

  let navItems = [];
  if (isAdmin) navItems = adminNavItems;
  else if (isStaff) navItems = staffNavItems;
  else navItems = customerNavItems;

  // ✅ Always close the sidebar when a link is clicked — desktop & mobile
  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  const getPortalLabel = () => {
    if (isAdmin) return 'Administrator';
    if (isStaff) return 'Staff Portal';
    return 'Customer Portal';
  };

  const getUserRole = () => {
    if (isAdmin) return 'Administrator';
    if (isStaff) return 'Staff';
    return 'Customer';
  };

  const getInitials = () => {
    const first = user?.firstName?.charAt(0) || '';
    const last = user?.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || 'U';
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <h2>AGRIVEND</h2>
            <p>Solar Powered Grain Vending Machine</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'active' : ''}`
              }
              onClick={handleLinkClick}
            >
              <div className="link-content">
                <span className="link-name">{item.name}</span>
                <span className="link-description">{item.description}</span>
              </div>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{getInitials()}</div>
            <div className="user-details">
              <div className="user-name">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="user-role">{getUserRole()}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;