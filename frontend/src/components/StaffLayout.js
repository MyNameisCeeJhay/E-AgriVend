import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import StaffNavbar from './StaffNavbar';
import StaffSidebar from './StaffSidebar';
import './Layout.css';

const StaffLayout = () => {
  // ✅ Sidebar starts CLOSED — user opens via hamburger
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // ✅ Force close on resize so it never pops open
      setSidebarOpen(false);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSidebar = () => setSidebarOpen(prev => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="layout">
      <StaffNavbar
        onToggleSidebar={toggleSidebar}
        sidebarOpen={sidebarOpen}
      />
      <StaffSidebar
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isMobile={isMobile}
      />
      <main className={`main-content ${sidebarOpen && !isMobile ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="main-container">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default StaffLayout;