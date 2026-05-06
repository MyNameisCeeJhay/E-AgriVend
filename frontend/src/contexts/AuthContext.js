const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';


const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const navigate = useNavigate();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      console.log('🟢 Internet connection restored');
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      console.log('🔴 Internet connection lost');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Configure axios defaults
  axios.defaults.baseURL = API_URL;
  axios.defaults.headers.common['Content-Type'] = 'application/json';
  axios.defaults.timeout = 10000;
  
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  // Fetch user data if token exists
  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      if (isOffline) {
        setLoading(false);
        setError('You are offline. Please check your internet connection.');
        return;
      }

      try {
        console.log('🔍 Fetching user with token...');
        const response = await axios.get('/auth/me');
        console.log('✅ User fetched:', response.data);
        
        const userData = response.data.user || response.data;
        
        setUser(userData);
        setError(null);
      } catch (error) {
        console.error('❌ Error fetching user:', error.response?.data || error.message);
        
        if (error.code === 'ERR_NETWORK') {
          setError('Cannot connect to server. Please check if the backend is running.');
        } else if (error.code === 'ECONNABORTED') {
          setError('Connection timeout. Please try again.');
        } else {
          localStorage.removeItem('token');
          setToken(null);
          delete axios.defaults.headers.common['Authorization'];
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token, isOffline]);

  const login = async (email, password) => {
    setError(null);
    
    if (isOffline) {
      setError('You are offline. Please check your internet connection.');
      return { success: false, error: 'No internet connection' };
    }
    
    try {
      console.log('🔑 Attempting login for:', email);
      
      const response = await axios.post('/auth/login', { 
        email, 
        password 
      });
      
      console.log('✅ Login response:', response.data);
      
      const { token, user } = response.data;
      
      // Save token to localStorage
      localStorage.setItem('token', token);
      
      // Update axios default header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Update state
      setToken(token);
      setUser(user);
      setError(null);
      
      // Redirect based on role
      if (user.role === 'admin') {
        navigate('/admin/dashboard');
      } else if (user.role === 'staff') {
        navigate('/staff/dashboard');
      } else {
        navigate('/customer/dashboard');
      }
      
      return { success: true, user };
    } catch (error) {
      console.error('❌ Login error:', error);
      
      let errorMessage = 'Login failed';
      
      if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Cannot connect to server. Please make sure the backend is running.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please try again.';
      } else if (error.response) {
        errorMessage = error.response.data?.error || error.response.data?.message || 'Invalid credentials';
      } else if (error.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const register = async (userData) => {
    setError(null);
    
    if (isOffline) {
      setError('You are offline. Please check your internet connection.');
      return { success: false, error: 'No internet connection' };
    }
    
    try {
      console.log('📝 Attempting registration...');
      const response = await axios.post('/auth/register', userData);
      console.log('✅ Registration successful:', response.data);
      return { success: true };
    } catch (error) {
      console.error('❌ Registration error:', error);
      
      let errorMessage = 'Registration failed';
      
      if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Cannot connect to server. Please make sure the backend is running.';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Connection timeout. Please try again.';
      } else if (error.response) {
        errorMessage = error.response.data?.error || error.response.data?.message || 'Registration failed';
      }
      
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = () => {
    console.log('🔓 Logging out...');
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    navigate('/login');
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    isOffline
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
