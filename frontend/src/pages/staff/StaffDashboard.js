const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './StaffDashboard.css';

const StaffDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  
  // Storage 1 - Pedigree (Left) - Price should be 135
const [storage1, setStorage1] = useState({
  id: 1,
  name: 'Pedigree',
  productId: null,
  pricePerKg: 135,
  currentWeight: 0,
  maxCapacity: 20,
  percentage: 0,
  status: 'Normal',
  isLow: false
});

// Storage 2 - AOZI (Right) - Price should be 165
const [storage2, setStorage2] = useState({
  id: 2,
  name: 'AOZI',
  productId: null,
  pricePerKg: 165,
  currentWeight: 0,
  maxCapacity: 20,
  percentage: 0,
  status: 'Normal',
  isLow: false
});
  
  // Battery Monitoring
  const [battery, setBattery] = useState({
    percentage: 100,
    voltage: 12.6,
    status: 'Charged',
    isCharging: true,
    health: 'Good'
  });
  
  // Machine Status
  const [machineStatus, setMachineStatus] = useState({
    isOnline: true,
    lastUpdate: new Date(),
    doorStatus: 'Closed',
    securityStatus: 'Safe'
  });

  const isMounted = useRef(true);
  const intervalRef = useRef(null);

  // Fetch machine data from backend (includes product names and prices)
  const fetchMachineData = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      const token = localStorage.getItem('token');
      
      // Fetch complete machine data including product settings
      const response = await axios.get(`${API_URL}/machine/data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!isMounted.current) return;
      
      if (response.data.success) {
        const data = response.data.data;
        
        // Update Storage 1 (Pedigree) - includes name and price from admin
        if (data.storage1) {
          const weight = data.storage1.currentWeight || 0;
          const percentage = (weight / 20) * 100;
          setStorage1(prev => ({
            ...prev,
            name: data.storage1.name || prev.name,
            pricePerKg: data.storage1.pricePerKg || prev.pricePerKg,
            currentWeight: weight,
            percentage: percentage,
            status: weight <= 0.1 ? 'Empty' : weight < 5 ? 'Low' : 'Normal',
            isLow: weight < 10
          }));
        }
        
        // Update Storage 2 (AOZI) - includes name and price from admin
        if (data.storage2) {
          const weight = data.storage2.currentWeight || 0;
          const percentage = (weight / 20) * 100;
          setStorage2(prev => ({
            ...prev,
            name: data.storage2.name || prev.name,
            pricePerKg: data.storage2.pricePerKg || prev.pricePerKg,
            currentWeight: weight,
            percentage: percentage,
            status: weight <= 0.1 ? 'Empty' : weight < 5 ? 'Low' : 'Normal',
            isLow: weight < 10
          }));
        }
        
        // Update Battery
        if (data.battery) {
          setBattery(prev => ({
            ...prev,
            percentage: data.battery.percentage || 100,
            voltage: data.battery.voltage || 12.6,
            status: data.battery.status || 'Good',
            isCharging: data.battery.isCharging !== undefined ? data.battery.isCharging : true,
            health: data.battery.health || 'Good'
          }));
        }
        
        // Update Machine Status
        if (data.machineStatus) {
          setMachineStatus(prev => ({
            ...prev,
            isOnline: data.machineStatus.isOnline !== undefined ? data.machineStatus.isOnline : true,
            doorStatus: data.machineStatus.doorStatus || 'Closed',
            securityStatus: data.machineStatus.securityStatus || 'Safe',
            lastUpdate: new Date()
          }));
        }
        
        console.log('✅ Machine data loaded with product settings');
      }
    } catch (error) {
      console.error('Error fetching machine data:', error);
      // Fallback to ESP32 endpoint if machine/data fails
      try {
        const espResponse = await axios.get(`${API_URL}/esp32/latest`);
        if (espResponse.data.success && isMounted.current) {
          const data = espResponse.data;
          
          // Update storage weights from ESP32 data
          const storage1Weight = data.storage1?.currentWeight || 0;
          const storage1Percentage = (storage1Weight / 20) * 100;
          setStorage1(prev => ({
            ...prev,
            currentWeight: storage1Weight,
            percentage: storage1Percentage,
            status: storage1Weight <= 0.1 ? 'Empty' : storage1Weight < 5 ? 'Low' : 'Normal',
            isLow: storage1Weight < 10
          }));
          
          const storage2Weight = data.storage2?.currentWeight || 0;
          const storage2Percentage = (storage2Weight / 20) * 100;
          setStorage2(prev => ({
            ...prev,
            currentWeight: storage2Weight,
            percentage: storage2Percentage,
            status: storage2Weight <= 0.1 ? 'Empty' : storage2Weight < 5 ? 'Low' : 'Normal',
            isLow: storage2Weight < 10
          }));
          
          setBattery(prev => ({
            ...prev,
            percentage: data.batteryPercentage || 100
          }));
          
          setMachineStatus(prev => ({
            ...prev,
            isOnline: true,
            doorStatus: data.doorStatus || 'Closed',
            securityStatus: data.doorStatus === 'Open' ? 'Alert - Door Open' : 'Safe',
            lastUpdate: new Date()
          }));
        }
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  // Fetch product settings specifically (for initial load)
  const fetchProductSettings = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/machine/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success && isMounted.current) {
        const products = response.data.data;
        setStorage1(prev => ({
          ...prev,
          name: products.storage1?.name || prev.name,
          pricePerKg: products.storage1?.pricePerKg || prev.pricePerKg
        }));
        setStorage2(prev => ({
          ...prev,
          name: products.storage2?.name || prev.name,
          pricePerKg: products.storage2?.pricePerKg || prev.pricePerKg
        }));
      }
    } catch (error) {
      console.error('Error fetching product settings:', error);
    }
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Socket listeners for real-time updates
  useEffect(() => {
    isMounted.current = true;
    
    // Initial data fetch
    fetchMachineData();
    fetchProductSettings();
    
    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      if (isMounted.current) {
        fetchMachineData();
      }
    }, 30000);
    
    if (socket) {
      // Listen for machine data updates (weights, battery, door status)
      socket.on('machine_data_updated', (data) => {
        if (!isMounted.current) return;
        
        if (data.storage1) {
          const weight = data.storage1.currentWeight !== undefined ? data.storage1.currentWeight : storage1.currentWeight;
          const percentage = (weight / 20) * 100;
          setStorage1(prev => ({
            ...prev,
            ...data.storage1,
            currentWeight: weight,
            percentage: percentage,
            status: weight <= 0.1 ? 'Empty' : weight < 5 ? 'Low' : 'Normal',
            isLow: weight < 10
          }));
        }
        
        if (data.storage2) {
          const weight = data.storage2.currentWeight !== undefined ? data.storage2.currentWeight : storage2.currentWeight;
          const percentage = (weight / 20) * 100;
          setStorage2(prev => ({
            ...prev,
            ...data.storage2,
            currentWeight: weight,
            percentage: percentage,
            status: weight <= 0.1 ? 'Empty' : weight < 5 ? 'Low' : 'Normal',
            isLow: weight < 10
          }));
        }
        
        if (data.battery) {
          setBattery(prev => ({ 
            ...prev, 
            ...data.battery
          }));
        }
        
        if (data.machineStatus) {
          setMachineStatus(prev => ({ 
            ...prev, 
            ...data.machineStatus,
            lastUpdate: new Date()
          }));
        }
        
        showNotification('info', 'Machine data updated');
      });
      
      // Listen specifically for product updates (when admin changes name/price)
      socket.on('product_settings_updated', (data) => {
        if (!isMounted.current) return;
        
        console.log('Product settings updated:', data);
        
        if (data.storageId === 1 || data.storage1) {
          const productData = data.storage1 || data;
          setStorage1(prev => ({
            ...prev,
            name: productData.name || prev.name,
            pricePerKg: productData.pricePerKg !== undefined ? productData.pricePerKg : prev.pricePerKg
          }));
          showNotification('info', `Product updated: ${productData.name} - ₱${productData.pricePerKg}/kg`);
        }
        
        if (data.storageId === 2 || data.storage2) {
          const productData = data.storage2 || data;
          setStorage2(prev => ({
            ...prev,
            name: productData.name || prev.name,
            pricePerKg: productData.pricePerKg !== undefined ? productData.pricePerKg : prev.pricePerKg
          }));
          showNotification('info', `Product updated: ${productData.name} - ₱${productData.pricePerKg}/kg`);
        }
        
        // Refresh full data to ensure consistency
        fetchMachineData();
      });
      
      // Listen for low stock alerts
      socket.on('low_stock_alert', (data) => {
        if (!isMounted.current) return;
        showNotification('warning', `Low stock alert: ${data.storageName} has only ${data.remainingKg}kg remaining`);
        if (data.storageId === 1) {
          setStorage1(prev => ({ ...prev, isLow: true, status: 'Low' }));
        } else if (data.storageId === 2) {
          setStorage2(prev => ({ ...prev, isLow: true, status: 'Low' }));
        }
      });
      
      // Listen for low battery alerts
      socket.on('low_battery_alert', (data) => {
        if (!isMounted.current) return;
        showNotification('warning', `Low battery alert: Battery at ${data.percentage}%`);
        setBattery(prev => ({ ...prev, status: 'Critical' }));
      });
    }
    
    return () => {
      isMounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (socket) {
        socket.off('machine_data_updated');
        socket.off('product_settings_updated');
        socket.off('low_stock_alert');
        socket.off('low_battery_alert');
      }
    };
  }, [socket, fetchMachineData, fetchProductSettings]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  const getBatteryColor = () => {
    if (battery.percentage >= 70) return '#10b981';
    if (battery.percentage >= 30) return '#f59e0b';
    return '#ef4444';
  };

  const getBatteryStatusText = () => {
    if (battery.percentage >= 70) return 'Good';
    if (battery.percentage >= 30) return 'Warning';
    return 'Critical';
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'Critical': return '#ef4444';
      case 'Low': return '#f59e0b';
      case 'Empty': return '#ef4444';
      case 'Normal': return '#10b981';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="staff-machine-container">
        <div className="loading-state">Loading machine data...</div>
      </div>
    );
  }

  return (
    <div className="staff-machine-container">
      {/* Notification */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Header */}
      <div className="machine-header">
        <div>
          <h1>Machine Monitoring</h1>
          <p>Monitor storage levels, battery status, and product information</p>
        </div>
        <div className={`machine-status ${machineStatus.isOnline ? 'online' : 'offline'}`}>
          <span className="status-dot"></span>
          {machineStatus.isOnline ? 'Online' : 'Offline'}
        </div>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Stock</div>
            <div className="stat-value">{(storage1.currentWeight + storage2.currentWeight).toFixed(1)} kg</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Battery</div>
            <div className="stat-value">{battery.percentage}%</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Door Status</div>
            <div className="stat-value">{machineStatus.doorStatus}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Security Status</div>
            <div className="stat-value">{machineStatus.securityStatus}</div>
          </div>
        </div>
      </div>

      {/* Storage 1 & 2 Grid */}
      <div className="storage-grid">
        {/* Storage 1 */}
        <div className="storage-card">
          <div className="storage-header">
            <h2>Storage 1</h2>
          </div>
          
          <div className="product-info">
            <div className="product-name">{storage1.name}</div>
            <div className="product-price">{formatCurrency(storage1.pricePerKg)} / kg</div>
          </div>
          
          <div className="weight-display">
            <div className="weight-value">{storage1.currentWeight.toFixed(1)} kg</div>
            <div className="weight-max">/ {storage1.maxCapacity} kg</div>
          </div>
          
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${storage1.percentage}%`,
                backgroundColor: getStatusColor(storage1.status)
              }}
            ></div>
          </div>
          
          <div className="storage-details">
            <div className="detail-item">
              <span className="detail-label">Status:</span>
              <span className={`detail-value status-${storage1.status.toLowerCase()}`}>
                {storage1.status}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Fill Level:</span>
              <span className="detail-value">{storage1.percentage.toFixed(1)}%</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Load Cell:</span>
              <span className="detail-value">{storage1.currentWeight.toFixed(1)} / 20 kg</span>
            </div>
          </div>
        </div>

        {/* Storage 2 */}
        <div className="storage-card">
          <div className="storage-header">
            <h2>Storage 2</h2>
          </div>
          
          <div className="product-info">
            <div className="product-name">{storage2.name}</div>
            <div className="product-price">{formatCurrency(storage2.pricePerKg)} / kg</div>
          </div>
          
          <div className="weight-display">
            <div className="weight-value">{storage2.currentWeight.toFixed(1)} kg</div>
            <div className="weight-max">/ {storage2.maxCapacity} kg</div>
          </div>
          
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${storage2.percentage}%`,
                backgroundColor: getStatusColor(storage2.status)
              }}
            ></div>
          </div>
          
          <div className="storage-details">
            <div className="detail-item">
              <span className="detail-label">Status:</span>
              <span className={`detail-value status-${storage2.status.toLowerCase()}`}>
                {storage2.status}
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Fill Level:</span>
              <span className="detail-value">{storage2.percentage.toFixed(1)}%</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Load Cell:</span>
              <span className="detail-value">{storage2.currentWeight.toFixed(1)} / 20 kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Battery Monitoring Section */}
      <div className="battery-section">
        <div className="battery-card">
          <div className="battery-header">
            <h2>Battery Monitoring</h2>
            <div className={`battery-status ${battery.percentage >= 70 ? 'good' : battery.percentage >= 30 ? 'warning' : 'critical'}`}>
              {getBatteryStatusText()}
            </div>
          </div>
          
          <div className="battery-content">
            <div className="battery-level">
              <div className="battery-icon">
                <div 
                  className="battery-fill" 
                  style={{ width: `${battery.percentage}%`, backgroundColor: getBatteryColor() }}
                ></div>
              </div>
              <div className="battery-percentage">{battery.percentage}%</div>
            </div>
            
            <div className="battery-details">
              <div className="battery-detail">
                <span className="detail-label">Voltage:</span>
                <span className="detail-value">{battery.voltage}V</span>
              </div>
              <div className="battery-detail">
                <span className="detail-label">Charging:</span>
                <span className="detail-value">{battery.isCharging ? 'Yes (Solar)' : 'No'}</span>
              </div>
              <div className="battery-detail">
                <span className="detail-label">Health:</span>
                <span className="detail-value">{battery.health}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="machine-info-card">
          <h2>Machine Information</h2>
          <div className="machine-details">
            <div className="machine-detail">
              <span className="detail-label">Last Update:</span>
              <span className="detail-value">{machineStatus.lastUpdate.toLocaleString()}</span>
            </div>
            <div className="machine-detail">
              <span className="detail-label">Total Capacity:</span>
              <span className="detail-value">40 kg (20kg + 20kg)</span>
            </div>
            <div className="machine-detail">
              <span className="detail-label">Remaining Stock:</span>
              <span className="detail-value">{(storage1.currentWeight + storage2.currentWeight).toFixed(1)} kg</span>
            </div>
            <div className="machine-detail">
              <span className="detail-label">Security Status:</span>
              <span className={`detail-value ${machineStatus.securityStatus === 'Safe' ? 'safe' : 'alert'}`}>
                {machineStatus.securityStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;