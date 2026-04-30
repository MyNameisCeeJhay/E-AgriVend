import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

const StaffSidebar = ({ isOpen, onClose, isMobile }) => {
  const { user } = useAuth();

  // Staff only has access to Machine Monitor and Transactions
  const staffNavItems = [
    { name: 'Machine Monitor', path: '/staff/dashboard', description: 'Monitor machine' },
    { name: 'Transactions', path: '/staff/transactions', description: 'View purchases' },
  ];

  const handleLinkClick = () => {
    if (isMobile && onClose) {
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
            <p>Staff Portal</p>
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
              <div className="user-name">{user?.firstName} {user?.lastName}</div>
              <div className="user-role">Staff</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default StaffSidebar;