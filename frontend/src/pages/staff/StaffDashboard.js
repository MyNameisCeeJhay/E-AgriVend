const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './StaffDashboard.css';

const StaffDashboard = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  
  // Storage 1 - Sinandomeng should be 52
  const [storage1, setStorage1] = useState({
    id: 1,
    name: 'Storage 1 - Sinandomeng',
    productId: null,
    pricePerKg: 52,
    currentWeight: 0,
    maxCapacity: 20,
    percentage: 0,
    status: 'Normal',
    isLow: false
  });

  // Storage 2 - Dinorado should be 65
  const [storage2, setStorage2] = useState({
    id: 2,
    name: 'Storage 2 - Dinorado',
    productId: null,
    pricePerKg: 65,
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
  
  // Edit Product Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStorage, setEditingStorage] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    pricePerKg: ''
  });

  const fetchMachineData = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get(`${API_URL}/esp32/latest`);
      
      console.log('API Response:', response.data);
      
      if (response.data.success) {
        const data = response.data;
        
        // Update Storage 1 (Sinandomeng)
        const storage1Weight = data.storage1?.currentWeight || 0;
        const storage1Percentage = (storage1Weight / 20) * 100;
        setStorage1(prev => ({
          ...prev,
          currentWeight: storage1Weight,
          percentage: storage1Percentage,
          status: storage1Weight <= 0.1 ? 'Empty' : storage1Weight <= 5 ? 'Low' : 'Normal',
          isLow: storage1Weight <= 10,
          pricePerKg: 52
        }));
        
        // Update Storage 2 (Dinorado)
        const storage2Weight = data.storage2?.currentWeight || 0;
        const storage2Percentage = (storage2Weight / 20) * 100;
        setStorage2(prev => ({
          ...prev,
          currentWeight: storage2Weight,
          percentage: storage2Percentage,
          status: storage2Weight <= 0.1 ? 'Empty' : storage2Weight <= 5 ? 'Low' : 'Normal',
          isLow: storage2Weight <= 10,
          pricePerKg: 65
        }));
        
        // Update Battery
        setBattery(prev => ({
          ...prev,
          percentage: data.batteryPercentage || 100
        }));
        
        // Update Machine Status
        setMachineStatus(prev => ({
          ...prev,
          isOnline: true,
          doorStatus: data.doorStatus || 'Closed',
          securityStatus: data.doorStatus === 'Open' ? 'Alert - Door Open' : 'Safe',
          lastUpdate: new Date()
        }));
        
        console.log('✅ Storage1 weight:', storage1Weight);
        console.log('✅ Storage2 weight:', storage2Weight);
      }
    } catch (error) {
      console.error('Error fetching machine data:', error);
      showNotification('error', 'Failed to load machine data');
    } finally {
      setLoading(false);
    }
  };

  // Also fetch product names and prices from database
  const fetchProductSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/machine/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
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
  };

  // Socket listeners for real-time updates
  useEffect(() => {
    fetchMachineData();
    fetchProductSettings();
    
    const interval = setInterval(() => {
      fetchMachineData();
    }, 30000);
    
    if (socket) {
      socket.on('machine_data_updated', (data) => {
        if (data.storage1?.currentWeight !== undefined) {
          const storage1CurrentWeight = data.storage1.currentWeight;
          const storage1Percentage = (storage1CurrentWeight / 20) * 100;
          setStorage1(prev => ({
            ...prev,
            currentWeight: storage1CurrentWeight,
            percentage: storage1Percentage,
            status: storage1CurrentWeight <= 5 ? 'Critical' : storage1CurrentWeight <= 10 ? 'Low' : 'Normal',
            isLow: storage1CurrentWeight <= 10
          }));
        }
        
        if (data.storage2?.currentWeight !== undefined) {
          const storage2CurrentWeight = data.storage2.currentWeight;
          const storage2Percentage = (storage2CurrentWeight / 20) * 100;
          setStorage2(prev => ({
            ...prev,
            currentWeight: storage2CurrentWeight,
            percentage: storage2Percentage,
            status: storage2CurrentWeight <= 5 ? 'Critical' : storage2CurrentWeight <= 10 ? 'Low' : 'Normal',
            isLow: storage2CurrentWeight <= 10
          }));
        }
        
        if (data.battery?.percentage !== undefined) {
          setBattery(prev => ({
            ...prev,
            percentage: data.battery.percentage,
            status: data.battery.percentage >= 70 ? 'Good' : data.battery.percentage >= 30 ? 'Warning' : 'Critical'
          }));
        }
        
        if (data.machineStatus?.doorStatus !== undefined) {
          setMachineStatus(prev => ({
            ...prev,
            doorStatus: data.machineStatus.doorStatus,
            securityStatus: data.machineStatus.doorStatus === 'Open' ? 'Alert - Door Open' : 'Safe'
          }));
        }
        
        showNotification('info', 'Machine data updated');
      });
      
      socket.on('low_stock_alert', (data) => {
        showNotification('warning', `Low stock alert: ${data.storageName} has only ${data.remainingKg}kg remaining`);
        if (data.storageId === 1) {
          setStorage1(prev => ({ ...prev, isLow: true, status: 'Low' }));
        } else {
          setStorage2(prev => ({ ...prev, isLow: true, status: 'Low' }));
        }
      });
      
      socket.on('low_battery_alert', (data) => {
        showNotification('warning', `Low battery alert: Battery at ${data.percentage}%`);
        setBattery(prev => ({ ...prev, status: 'Critical' }));
      });
    }
    
    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('machine_data_updated');
        socket.off('low_stock_alert');
        socket.off('low_battery_alert');
      }
    };
  }, [socket]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const handleEditProduct = (storage) => {
    setEditingStorage(storage);
    setEditFormData({
      name: storage.name,
      pricePerKg: storage.pricePerKg
    });
    setShowEditModal(true);
  };

  const handleSaveProduct = async () => {
    try {
      const token = localStorage.getItem('token');
      const storageId = editingStorage.id;
      
      await axios.put(`${API_URL}/machine/product/${storageId}`, {
        name: editFormData.name,
        pricePerKg: parseFloat(editFormData.pricePerKg)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (editingStorage.id === 1) {
        setStorage1(prev => ({
          ...prev,
          name: editFormData.name,
          pricePerKg: parseFloat(editFormData.pricePerKg)
        }));
      } else {
        setStorage2(prev => ({
          ...prev,
          name: editFormData.name,
          pricePerKg: parseFloat(editFormData.pricePerKg)
        }));
      }
      
      showNotification('success', 'Product updated successfully');
      setShowEditModal(false);
      setEditingStorage(null);
      
    } catch (error) {
      console.error('Error saving product:', error);
      showNotification('error', 'Failed to save product');
    }
  };

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
      case 'Low Stock': return '#f59e0b';
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
          <p>Monitor storage levels, battery status, and manage products</p>
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
            <button className="btn-edit" onClick={() => handleEditProduct(storage1)}>
              Edit Product
            </button>
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
            <button className="btn-edit" onClick={() => handleEditProduct(storage2)}>
              Edit Product
            </button>
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

      {/* Edit Product Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Product</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Product Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter product name"
                />
              </div>
              
              <div className="form-group">
                <label>Price per Kilogram (₱)</label>
                <input
                  type="number"
                  value={editFormData.pricePerKg}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, pricePerKg: e.target.value }))}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
              
              <div className="info-text">
                <small>Formula: Amount Inserted ÷ Price per kg = Quantity to dispense</small>
                <small>Example: ₱100 ÷ {formatCurrency(parseFloat(editFormData.pricePerKg) || 0)} = {(100 / (parseFloat(editFormData.pricePerKg) || 1)).toFixed(3)} kg</small>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="btn-save" onClick={handleSaveProduct}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;