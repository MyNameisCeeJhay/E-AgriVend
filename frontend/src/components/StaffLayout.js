import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import StaffNavbar from './StaffNavbar';
import StaffSidebar from './StaffSidebar';
import './Layout.css';

const StaffLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      
      if (!mobile) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="layout">
      <StaffNavbar onToggleSidebar={toggleSidebar} />
      <StaffSidebar isOpen={sidebarOpen} onClose={closeSidebar} isMobile={isMobile} />
      <main className="main-content">
        <div className="main-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default StaffLayout;