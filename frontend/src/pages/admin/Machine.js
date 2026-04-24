import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import './Machine.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminMachine = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState(null);
  
  // Storage 1 & 2 Data
  const [storage1, setStorage1] = useState({
    id: 1,
    name: 'Storage 1 - Sinandomeng',
    productId: null,
    pricePerKg: 54,
    currentWeight: 0,
    maxCapacity: 20,
    percentage: 0,
    status: 'Normal',
    isLow: false
  });
  
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
  
  // Refill Modal
  const [showRefillModal, setShowRefillModal] = useState(false);
  const [refillingStorage, setRefillingStorage] = useState(null);
  const [refillAmount, setRefillAmount] = useState(0);

  // Fetch machine data from database using machine routes
  const fetchMachineData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/machine/data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        const data = response.data.data;
        
        setStorage1(prev => ({
          ...prev,
          name: data.storage1.name,
          productId: data.storage1.productId,
          pricePerKg: data.storage1.pricePerKg,
          currentWeight: data.storage1.currentWeight,
          percentage: data.storage1.percentage,
          status: data.storage1.status,
          isLow: data.storage1.isLow
        }));
        
        setStorage2(prev => ({
          ...prev,
          name: data.storage2.name,
          productId: data.storage2.productId,
          pricePerKg: data.storage2.pricePerKg,
          currentWeight: data.storage2.currentWeight,
          percentage: data.storage2.percentage,
          status: data.storage2.status,
          isLow: data.storage2.isLow
        }));
        
        setBattery(prev => ({
          ...prev,
          percentage: data.battery.percentage,
          voltage: data.battery.voltage,
          status: data.battery.status,
          isCharging: data.battery.isCharging,
          health: data.battery.health
        }));
        
        setMachineStatus(prev => ({
          ...prev,
          isOnline: data.machineStatus.isOnline,
          doorStatus: data.machineStatus.doorStatus,
          securityStatus: data.machineStatus.securityStatus,
          lastUpdate: new Date(data.machineStatus.lastUpdate)
        }));
      }
    } catch (error) {
      console.error('Error fetching machine data:', error);
      showNotification('error', 'Failed to load machine data');
    } finally {
      setLoading(false);
    }
  };

  // Socket listeners for real-time updates
  useEffect(() => {
    fetchMachineData();
    
    if (socket) {
      socket.on('machine_data_updated', (data) => {
        setStorage1(prev => ({ ...prev, ...data.storage1 }));
        setStorage2(prev => ({ ...prev, ...data.storage2 }));
        setBattery(prev => ({ ...prev, ...data.battery }));
        setMachineStatus(prev => ({ ...prev, ...data.machineStatus }));
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

  const handleRefill = (storage) => {
    setRefillingStorage(storage);
    setRefillAmount(storage.currentWeight);
    setShowRefillModal(true);
  };

  const confirmRefill = async () => {
    try {
      const token = localStorage.getItem('token');
      
      await axios.post(`${API_URL}/machine/refill`, {
        storageId: refillingStorage.id,
        amount: refillAmount
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (refillingStorage.id === 1) {
        setStorage1(prev => ({
          ...prev,
          currentWeight: refillAmount,
          percentage: (refillAmount / prev.maxCapacity) * 100,
          status: refillAmount < 5 ? 'Critical' : refillAmount < 10 ? 'Low' : 'Normal',
          isLow: refillAmount < 10
        }));
      } else {
        setStorage2(prev => ({
          ...prev,
          currentWeight: refillAmount,
          percentage: (refillAmount / prev.maxCapacity) * 100,
          status: refillAmount < 5 ? 'Critical' : refillAmount < 10 ? 'Low' : 'Normal',
          isLow: refillAmount < 10
        }));
      }
      
      showNotification('success', `Refilled ${refillingStorage.name} to ${refillAmount}kg`);
      setShowRefillModal(false);
      setRefillingStorage(null);
      
    } catch (error) {
      console.error('Error refilling:', error);
      showNotification('error', 'Failed to refill storage');
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
      <div className="machine-container">
        <div className="loading-state">Loading machine data...</div>
      </div>
    );
  }

  return (
    <div className="machine-container">
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
          
          <div className="storage-actions">
            <button className="btn-refill" onClick={() => handleRefill(storage1)}>
              Refill Storage
            </button>
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
          
          <div className="storage-actions">
            <button className="btn-refill" onClick={() => handleRefill(storage2)}>
              Refill Storage
            </button>
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

      {/* Refill Modal */}
      {showRefillModal && refillingStorage && (
        <div className="modal-overlay" onClick={() => setShowRefillModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Refill {refillingStorage.name}</h2>
              <button className="modal-close" onClick={() => setShowRefillModal(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Current Weight: {refillingStorage.currentWeight.toFixed(1)} kg</label>
                <label>Max Capacity: {refillingStorage.maxCapacity} kg</label>
                <label>Remaining Space: {(refillingStorage.maxCapacity - refillingStorage.currentWeight).toFixed(1)} kg</label>
              </div>
              
              <div className="form-group">
                <label>New Total Weight After Refill (kg)</label>
                <input
                  type="number"
                  value={refillAmount}
                  onChange={(e) => setRefillAmount(parseFloat(e.target.value))}
                  placeholder="Enter total weight after refill"
                  step="0.5"
                  min="0"
                  max={refillingStorage.maxCapacity}
                />
              </div>
              
              <div className="info-text">
                <small>This will update the load cell reading to the new weight. The amount added will be: {(refillAmount - refillingStorage.currentWeight).toFixed(1)} kg</small>
              </div>
            </div>
            
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowRefillModal(false)}>Cancel</button>
              <button className="btn-save" onClick={confirmRefill}>Confirm Refill</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMachine;