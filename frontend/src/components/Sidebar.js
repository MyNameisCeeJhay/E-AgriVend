import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const Sidebar = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Customer Navigation Items
  const customerNavItems = [
    { name: 'Dashboard', path: '/customer/dashboard', description: 'Overview' },
    { name: 'Transactions', path: '/customer/transactions', description: 'Purchase history' },
    { name: 'Ratings', path: '/customer/ratings', description: 'Your reviews' },
    { name: 'Returns', path: '/customer/returns', description: 'Return requests' },
    { name: 'Profile', path: '/customer/profile', description: 'Account settings' },
  ];

  // Admin Navigation Items
  const adminNavItems = [
    { name: 'Dashboard', path: '/admin/dashboard', description: 'Analytics' },
    { name: 'Sensors', path: '/admin/sensors', description: 'Machine status' },
    { name: 'Transactions', path: '/admin/transactions', description: 'All purchases' },
    { name: 'Returns', path: '/admin/returns', description: 'Return requests' },
    { name: 'Reports', path: '/admin/reports', description: 'Sales reports' },
    { name: 'Users', path: '/admin/users', description: 'Administrators' },
  ];

  const navItems = isAdmin ? adminNavItems : customerNavItems;

  const handleLinkClick = () => {
    if (window.innerWidth <= 768) {
      onClose();
    }
  };

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <h2>AgriVend</h2>
            <p>{isAdmin ? 'Administrator' : 'Customer Portal'}</p>
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
            <div className="user-avatar">
              {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.firstName} {user?.lastName}</div>
              <div className="user-role">{isAdmin ? 'Administrator' : 'Customer'}</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;