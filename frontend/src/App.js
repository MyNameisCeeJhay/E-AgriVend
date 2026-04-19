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

// Admin Pages Only
import AdminDashboard from './pages/admin/Dashboard';
import AdminSensors from './pages/admin/Sensors';
import AdminTransactions from './pages/admin/Transactions';
import AdminReturns from './pages/admin/Returns';
import AdminReports from './pages/admin/Reports';
import AdminUsers from './pages/admin/Users';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <SocketProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/terms" element={<Terms />} />
              
              {/* Admin Routes Only */}
              <Route path="/admin" element={
                <AdminRoute>
                  <Layout />
                </AdminRoute>
              }>
                <Route index element={<Navigate to="/admin/dashboard" />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="sensors" element={<AdminSensors />} />
                <Route path="transactions" element={<AdminTransactions />} />
                <Route path="returns" element={<AdminReturns />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="users" element={<AdminUsers />} />
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