import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Context
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Components
import PrivateRoute from './components/PrivateRoute';
import AdminRoute from './components/AdminRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Terms from './pages/Terms';
import RefundRequest from './pages/RefundRequest';
import RefundSuccess from './pages/RefundSuccess';

// Admin Pages Only
import AdminDashboard from './pages/admin/Dashboard';
import AdminMachine from './pages/admin/Machine';
import AdminTransactions from './pages/admin/Transactions';
import AdminReturns from './pages/admin/Returns';
import AdminReports from './pages/admin/Reports';


const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <SocketProvider>
            <Routes>
              {/* Public Routes - No authentication required */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/terms" element={<Terms />} />
              
              {/* Refund Portal Routes - Accessed via QR code (No login required) */}
              <Route path="/refund" element={<RefundRequest />} />
              <Route path="/refund/success" element={<RefundSuccess />} />
              
              {/* Admin Routes Only - Protected */}
              <Route path="/admin" element={
                <AdminRoute>
                  <Layout />
                </AdminRoute>
              }>
                <Route index element={<Navigate to="/admin/dashboard" />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="machine" element={<AdminMachine />} />
                <Route path="transactions" element={<AdminTransactions />} />
                <Route path="returns" element={<AdminReturns />} />
                <Route path="reports" element={<AdminReports />} />
              </Route>
              
              {/* Redirect any other routes to login */}
              <Route path="/" element={<Navigate to="/login" />} />
              <Route path="/customer/*" element={<Navigate to="/login" />} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          </SocketProvider>
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}

export default App;