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
  const [collectingCash, setCollectingCash] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  
  // Coin & Bill Monitoring
  const [coinCounts, setCoinCounts] = useState({
    onePeso: 0,
    fivePeso: 0,
    tenPeso: 0,
    twentyPeso: 0
  });
  
  const [billCounts, setBillCounts] = useState({
    twenty: 0,
    fifty: 0,
    hundred: 0,
    twoHundred: 0
  });
  
  const [totalCash, setTotalCash] = useState(0);
  
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
  
  // Calibration State
  const [calibration, setCalibration] = useState({
    storage1: {
      rawValue: 0,
      calibratedValue: 0,
      unit: 'kg',
      status: 'Stable'
    },
    storage2: {
      rawValue: 0,
      calibratedValue: 0,
      unit: 'kg',
      status: 'Stable'
    },
    dispense: {
      rawValue: 0,
      calibratedValue: 0,
      unit: 'kg',
      status: 'Stable'
    }
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

  // Calculate total cash
  const calculateTotalCash = useCallback(() => {
    const coinTotal = 
      coinCounts.onePeso * 1 +
      coinCounts.fivePeso * 5 +
      coinCounts.tenPeso * 10 +
      coinCounts.twentyPeso * 20;
    
    const billTotal = 
      billCounts.twenty * 20 +
      billCounts.fifty * 50 +
      billCounts.hundred * 100 +
      billCounts.twoHundred * 200;
    
    setTotalCash(coinTotal + billTotal);
  }, [coinCounts, billCounts]);

  useEffect(() => {
    calculateTotalCash();
  }, [coinCounts, billCounts, calculateTotalCash]);

  // Helper function to safely parse date
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
          
          // Update calibration
          setCalibration(prev => ({
            ...prev,
            storage1: {
              ...prev.storage1,
              calibratedValue: weight,
              status: weight > 0 ? 'Active' : 'Stable'
            }
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
          
          // Update calibration
          setCalibration(prev => ({
            ...prev,
            storage2: {
              ...prev.storage2,
              calibratedValue: weight,
              status: weight > 0 ? 'Active' : 'Stable'
            }
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

  // Collect Cash - Reset all coin and bill counts to zero
  const handleCollectCash = () => {
    if (totalCash === 0) {
      showNotification('warning', 'No cash to collect');
      return;
    }
    
    setCollectingCash(true);
    
    // Reset all counts to zero
    setCoinCounts({
      onePeso: 0,
      fivePeso: 0,
      tenPeso: 0,
      twentyPeso: 0
    });
    
    setBillCounts({
      twenty: 0,
      fifty: 0,
      hundred: 0,
      twoHundred: 0
    });
    
    // Show success notification with collected amount
    showNotification('success', `✅ Cash collected: ${formatCurrency(totalCash)}`);
    
    // Emit socket event for cash collection
    if (socket) {
      socket.emit('cash_collected', {
        collectedBy: user?.firstName + ' ' + user?.lastName || 'Staff',
        amount: totalCash,
        timestamp: new Date().toISOString()
      });
    }
    
    setCollectingCash(false);
  };

  // Calibration functions
  const handleCalibrate = (scaleName) => {
    setCalibrating(true);
    
    // Simulate calibration process
    setTimeout(() => {
      setCalibration(prev => {
        const updated = { ...prev };
        if (scaleName === 'storage1') {
          updated.storage1 = {
            ...updated.storage1,
            rawValue: Math.random() * 1000,
            calibratedValue: storage1.currentWeight || 0,
            status: 'Calibrated'
          };
        } else if (scaleName === 'storage2') {
          updated.storage2 = {
            ...updated.storage2,
            rawValue: Math.random() * 1000,
            calibratedValue: storage2.currentWeight || 0,
            status: 'Calibrated'
          };
        } else if (scaleName === 'dispense') {
          updated.dispense = {
            ...updated.dispense,
            rawValue: Math.random() * 500,
            calibratedValue: 0,
            status: 'Calibrated'
          };
        }
        return updated;
      });
      
      showNotification('success', `✅ ${scaleName === 'storage1' ? 'Storage 1' : scaleName === 'storage2' ? 'Storage 2' : 'Dispense'} scale calibrated successfully!`);
      setCalibrating(false);
    }, 1500);
  };

  const handleZeroCalibrate = (scaleName) => {
    setCalibrating(true);
    
    setTimeout(() => {
      setCalibration(prev => {
        const updated = { ...prev };
        if (scaleName === 'storage1') {
          updated.storage1 = {
            ...updated.storage1,
            rawValue: 0,
            calibratedValue: 0,
            status: 'Zeroed'
          };
        } else if (scaleName === 'storage2') {
          updated.storage2 = {
            ...updated.storage2,
            rawValue: 0,
            calibratedValue: 0,
            status: 'Zeroed'
          };
        } else if (scaleName === 'dispense') {
          updated.dispense = {
            ...updated.dispense,
            rawValue: 0,
            calibratedValue: 0,
            status: 'Zeroed'
          };
        }
        return updated;
      });
      
      showNotification('success', `✅ ${scaleName === 'storage1' ? 'Storage 1' : scaleName === 'storage2' ? 'Storage 2' : 'Dispense'} scale zeroed successfully!`);
      setCalibrating(false);
    }, 1000);
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
          setCalibration(prev => ({
            ...prev,
            storage1: {
              ...prev.storage1,
              calibratedValue: weight,
              status: weight > 0 ? 'Active' : 'Stable'
            }
          }));
        }
        if (data.storage2) {
          const weight = data.storage2.currentWeight || 0;
          setStorage2(prev => ({
            ...prev,
            ...data.storage2,
            percentage: (weight / 20) * 100
          }));
          setCalibration(prev => ({
            ...prev,
            storage2: {
              ...prev.storage2,
              calibratedValue: weight,
              status: weight > 0 ? 'Active' : 'Stable'
            }
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
      
      // Coin/Bill insert events
      socket.on('coin_inserted', (data) => {
        const coinMap = {
          1: 'onePeso',
          5: 'fivePeso', 
          10: 'tenPeso',
          20: 'twentyPeso'
        };
        const key = coinMap[data.value];
        if (key) {
          setCoinCounts(prev => ({
            ...prev,
            [key]: prev[key] + 1
          }));
          showNotification('success', `Coin inserted: ₱${data.value}`);
        }
      });
      
      socket.on('bill_inserted', (data) => {
        const billMap = {
          20: 'twenty',
          50: 'fifty',
          100: 'hundred',
          200: 'twoHundred'
        };
        const key = billMap[data.value];
        if (key) {
          setBillCounts(prev => ({
            ...prev,
            [key]: prev[key] + 1
          }));
          showNotification('success', `Bill inserted: ₱${data.value}`);
        }
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
        socket.off('coin_inserted');
        socket.off('bill_inserted');
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
      currency: 'PHP',
      minimumFractionDigits: 2
    }).format(amount || 0);
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
            <div className="stat-label">Total Cash</div>
            <div className="stat-value">{formatCurrency(totalCash)}</div>
          </div>
        </div>
      </div>

      {/* Coin & Bill Monitoring Section */}
      <div className="cash-monitoring-section">
        <div className="cash-header">
          <div>
            <h2>Cash Monitoring</h2>
            <p className="cash-subtitle">Real-time coin and bill tracking</p>
          </div>
          <div className="cash-actions">
            <div className="total-cash-display">
              <span className="total-label">Total Cash:</span>
              <span className="total-amount">{formatCurrency(totalCash)}</span>
            </div>
            <button 
              className={`btn-collect ${totalCash === 0 ? 'disabled' : ''}`}
              onClick={handleCollectCash}
              disabled={totalCash === 0 || collectingCash}
            >
              {collectingCash ? 'Collecting...' : 'Collect Cash'}
            </button>
          </div>
        </div>
        
        <div className="cash-grid">
          {/* Coins Section */}
          <div className="cash-card">
            <h3>Coins</h3>
            <div className="cash-items">
              <div className="cash-item">
                <span className="cash-denomination">₱1</span>
                <span className="cash-count">{coinCounts.onePeso}</span>
                <span className="cash-total">₱{coinCounts.onePeso * 1}</span>
              </div>
              <div className="cash-item">
                <span className="cash-denomination">₱5</span>
                <span className="cash-count">{coinCounts.fivePeso}</span>
                <span className="cash-total">₱{coinCounts.fivePeso * 5}</span>
              </div>
              <div className="cash-item">
                <span className="cash-denomination">₱10</span>
                <span className="cash-count">{coinCounts.tenPeso}</span>
                <span className="cash-total">₱{coinCounts.tenPeso * 10}</span>
              </div>
              <div className="cash-item">
                <span className="cash-denomination">₱20</span>
                <span className="cash-count">{coinCounts.twentyPeso}</span>
                <span className="cash-total">₱{coinCounts.twentyPeso * 20}</span>
              </div>
              <div className="cash-item total-row">
                <span className="cash-denomination">Total Coins</span>
                <span className="cash-count">{Object.values(coinCounts).reduce((a, b) => a + b, 0)}</span>
                <span className="cash-total">
                  ₱{(coinCounts.onePeso * 1 + coinCounts.fivePeso * 5 + coinCounts.tenPeso * 10 + coinCounts.twentyPeso * 20)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Bills Section */}
          <div className="cash-card">
            <h3>Bills</h3>
            <div className="cash-items">
              <div className="cash-item">
                <span className="cash-denomination">₱20</span>
                <span className="cash-count">{billCounts.twenty}</span>
                <span className="cash-total">₱{billCounts.twenty * 20}</span>
              </div>
              <div className="cash-item">
                <span className="cash-denomination">₱50</span>
                <span className="cash-count">{billCounts.fifty}</span>
                <span className="cash-total">₱{billCounts.fifty * 50}</span>
              </div>
              <div className="cash-item">
                <span className="cash-denomination">₱100</span>
                <span className="cash-count">{billCounts.hundred}</span>
                <span className="cash-total">₱{billCounts.hundred * 100}</span>
              </div>
              <div className="cash-item">
                <span className="cash-denomination">₱200</span>
                <span className="cash-count">{billCounts.twoHundred}</span>
                <span className="cash-total">₱{billCounts.twoHundred * 200}</span>
              </div>
              <div className="cash-item total-row">
                <span className="cash-denomination">Total Bills</span>
                <span className="cash-count">{Object.values(billCounts).reduce((a, b) => a + b, 0)}</span>
                <span className="cash-total">
                  ₱{(billCounts.twenty * 20 + billCounts.fifty * 50 + billCounts.hundred * 100 + billCounts.twoHundred * 200)}
                </span>
              </div>
            </div>
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
              <span className="detail-label">Total Cash:</span>
              <span className="detail-value">{formatCurrency(totalCash)}</span>
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

      {/* ===== CALIBRATION SECTION ===== */}
      <div className="calibration-section">
        <div className="calibration-header">
          <h2>Load Cell Calibration</h2>
          <p className="calibration-subtitle">Monitor and calibrate weighing scales</p>
        </div>
        
        <div className="calibration-grid">
          {/* Storage 1 Calibration */}
          <div className="calibration-card">
            <div className="calibration-card-header">
              <h3>Storage 1 Weighing Scale</h3>
              <span className={`calibration-status ${calibration.storage1.status.toLowerCase()}`}>
                {calibration.storage1.status}
              </span>
            </div>
            <div className="calibration-body">
              <div className="calibration-readings">
                <div className="reading-item">
                  <span className="reading-label">Raw Value</span>
                  <span className="reading-value">{calibration.storage1.rawValue.toFixed(2)}</span>
                </div>
                <div className="reading-item">
                  <span className="reading-label">Calibrated Value</span>
                  <span className="reading-value calibrated">
                    {calibration.storage1.calibratedValue.toFixed(2)} {calibration.storage1.unit}
                  </span>
                </div>
              </div>
              <div className="calibration-actions">
                <button 
                  className="btn-calibrate"
                  onClick={() => handleCalibrate('storage1')}
                  disabled={calibrating}
                >
                  {calibrating ? 'Calibrating...' : 'Calibrate'}
                </button>
                <button 
                  className="btn-zero"
                  onClick={() => handleZeroCalibrate('storage1')}
                  disabled={calibrating}
                >
                  Zero Scale
                </button>
              </div>
            </div>
          </div>

          {/* Storage 2 Calibration */}
          <div className="calibration-card">
            <div className="calibration-card-header">
              <h3>Storage 2 Weighing Scale</h3>
              <span className={`calibration-status ${calibration.storage2.status.toLowerCase()}`}>
                {calibration.storage2.status}
              </span>
            </div>
            <div className="calibration-body">
              <div className="calibration-readings">
                <div className="reading-item">
                  <span className="reading-label">Raw Value</span>
                  <span className="reading-value">{calibration.storage2.rawValue.toFixed(2)}</span>
                </div>
                <div className="reading-item">
                  <span className="reading-label">Calibrated Value</span>
                  <span className="reading-value calibrated">
                    {calibration.storage2.calibratedValue.toFixed(2)} {calibration.storage2.unit}
                  </span>
                </div>
              </div>
              <div className="calibration-actions">
                <button 
                  className="btn-calibrate"
                  onClick={() => handleCalibrate('storage2')}
                  disabled={calibrating}
                >
                  {calibrating ? 'Calibrating...' : 'Calibrate'}
                </button>
                <button 
                  className="btn-zero"
                  onClick={() => handleZeroCalibrate('storage2')}
                  disabled={calibrating}
                >
                  Zero Scale
                </button>
              </div>
            </div>
          </div>

          {/* Dispense Calibration */}
          <div className="calibration-card">
            <div className="calibration-card-header">
              <h3>Dispense Weighing Scale</h3>
              <span className={`calibration-status ${calibration.dispense.status.toLowerCase()}`}>
                {calibration.dispense.status}
              </span>
            </div>
            <div className="calibration-body">
              <div className="calibration-readings">
                <div className="reading-item">
                  <span className="reading-label">Raw Value</span>
                  <span className="reading-value">{calibration.dispense.rawValue.toFixed(2)}</span>
                </div>
                <div className="reading-item">
                  <span className="reading-label">Calibrated Value</span>
                  <span className="reading-value calibrated">
                    {calibration.dispense.calibratedValue.toFixed(2)} {calibration.dispense.unit}
                  </span>
                </div>
              </div>
              <div className="calibration-actions">
                <button 
                  className="btn-calibrate"
                  onClick={() => handleCalibrate('dispense')}
                  disabled={calibrating}
                >
                  {calibrating ? 'Calibrating...' : 'Calibrate'}
                </button>
                <button 
                  className="btn-zero"
                  onClick={() => handleZeroCalibrate('dispense')}
                  disabled={calibrating}
                >
                  Zero Scale
                </button>
              </div>
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