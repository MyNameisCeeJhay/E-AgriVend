const API_URL = 'https://e-agrivend.onrender.com/api';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import './Machine.css';

const AdminMachine = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  
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
    status: 'Good',
    isCharging: true,
    health: 'Good'
  });
  
  // Machine Status
  const [machineStatus, setMachineStatus] = useState({
    isOnline: true,
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

  const isMounted = useRef(true);
  const intervalRef = useRef(null);

  // Helper function to safely parse date (kept for internal use)
  const parseDate = (dateValue) => {
    if (!dateValue) return new Date();
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return new Date();
      return date;
    } catch (error) {
      return new Date();
    }
  };

  // Fetch machine data from backend
  const fetchMachineData = useCallback(async () => {
    if (!isMounted.current) return;
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await axios.get(`${API_URL}/machine/data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!isMounted.current) return;
      
      if (response.data.success) {
        const data = response.data.data;
        
        // Update Storage 1 (Pedigree)
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
        
        // Update Storage 2 (Aozi)
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
            securityStatus: data.machineStatus.securityStatus || 'Safe'
          }));
        }
        
        console.log('✅ Machine data loaded');
      }
    } catch (error) {
      console.error('Error fetching machine data:', error);
      // Set demo data if API fails
      if (isMounted.current) {
        setStorage1(prev => ({ ...prev, currentWeight: 15.5, percentage: 77.5, status: 'Normal' }));
        setStorage2(prev => ({ ...prev, currentWeight: 8.2, percentage: 41, status: 'Low' }));
        setBattery(prev => ({ ...prev, percentage: 78, voltage: 12.4 }));
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 5000);
  };

  // Auto load on component mount and auto-refresh
  useEffect(() => {
    isMounted.current = true;
    
    // Initial fetch
    fetchMachineData();
    
    // Auto-refresh every 30 seconds
    intervalRef.current = setInterval(() => {
      if (isMounted.current) {
        fetchMachineData();
      }
    }, 30000);
    
    // Socket listeners for real-time updates
    if (socket) {
      socket.on('machine_data_updated', (data) => {
        if (!isMounted.current) return;
        
        if (data.storage1) {
          const weight = data.storage1.currentWeight || 0;
          setStorage1(prev => ({
            ...prev,
            ...data.storage1,
            percentage: (weight / 20) * 100
          }));
        }
        if (data.storage2) {
          const weight = data.storage2.currentWeight || 0;
          setStorage2(prev => ({
            ...prev,
            ...data.storage2,
            percentage: (weight / 20) * 100
          }));
        }
        if (data.battery) setBattery(prev => ({ ...prev, ...data.battery }));
        if (data.machineStatus) {
          setMachineStatus(prev => ({ 
            ...prev, 
            ...data.machineStatus
          }));
        }
        showNotification('info', 'Machine data updated');
      });
      
      socket.on('low_stock_alert', (data) => {
        showNotification('warning', `Low stock alert: ${data.storageName} has only ${data.remainingKg}kg remaining`);
      });
      
      socket.on('low_battery_alert', (data) => {
        showNotification('warning', `Low battery alert: Battery at ${data.percentage}%`);
      });
    }
    
    return () => {
      isMounted.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (socket) {
        socket.off('machine_data_updated');
        socket.off('low_stock_alert');
        socket.off('low_battery_alert');
      }
    };
  }, [socket, fetchMachineData]);

  const handleEditProduct = (storage) => {
    setEditingStorage(storage);
    setEditFormData({
      name: storage.name,
      pricePerKg: storage.pricePerKg
    });
    setShowEditModal(true);
  };

  const handleSaveProduct = async () => {
    setEditLoading(true);
    try {
      const token = localStorage.getItem('token');
      const storageId = editingStorage.id;
      
      const response = await axios.put(`${API_URL}/machine/product/${storageId}`, {
        name: editFormData.name,
        pricePerKg: parseFloat(editFormData.pricePerKg)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
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
        
        // Refresh data after update
        fetchMachineData();
      } else {
        showNotification('error', response.data?.error || 'Failed to save product');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      showNotification('error', error.response?.data?.error || 'Failed to save product');
    } finally {
      setEditLoading(false);
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
      case 'Empty': return '#ef4444';
      case 'Normal': return '#10b981';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="machine-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading machine data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="machine-container">
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)}>×</button>
        </div>
      )}

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
                  disabled={editLoading}
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
                  disabled={editLoading}
                />
              </div>
              
              <div className="info-text">
                <small>Formula: Amount Inserted ÷ Price per kg = Quantity to dispense</small>
                <small>Example: ₱100 ÷ {formatCurrency(parseFloat(editFormData.pricePerKg) || 0)} = {(100 / (parseFloat(editFormData.pricePerKg) || 1)).toFixed(3)} kg</small>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button 
                className="btn-save" 
                onClick={handleSaveProduct}
                disabled={editLoading}
              >
                {editLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMachine;