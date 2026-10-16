import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const StaffSidebar = ({ isOpen, onClose, isMobile }) => {
  const { user } = useAuth();

  const staffNavItems = [
    { name: 'Machine Monitor', path: '/staff/dashboard', description: 'Monitor machine' },
    { name: 'Transactions', path: '/staff/transactions', description: 'View purchases' },
  ];

  // ✅ Always close the sidebar when a link is clicked — desktop & mobile
  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
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
          {staffNavItems.map((item) => (
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
              <div className="user-name">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="user-role">
                {user?.role === 'admin' ? 'Administrator'
                  : user?.role === 'staff' ? 'Staff'
                  : 'Customer'}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default StaffSidebar;