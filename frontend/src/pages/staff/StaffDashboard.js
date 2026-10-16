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
  const [calibrating, setCalibrating] = useState(false);

  // ✅ Storage max capacity is now 10kg
  const MAX_CAPACITY = 10;

  // Storage 1 - Pedigree
  const [storage1, setStorage1] = useState({
    id: 1,
    name: 'Pedigree',
    productId: null,
    pricePerKg: 135,
    currentWeight: 0,
    maxCapacity: MAX_CAPACITY,
    percentage: 0,
    status: 'Normal',
    isLow: false
  });

  // Storage 2 - AOZI
  const [storage2, setStorage2] = useState({
    id: 2,
    name: 'AOZI',
    productId: null,
    pricePerKg: 165,
    currentWeight: 0,
    maxCapacity: MAX_CAPACITY,
    percentage: 0,
    status: 'Normal',
    isLow: false
  });

  // Battery Monitoring (Voltage & Charging removed)
  const [battery, setBattery] = useState({
    percentage: 100,
    status: 'Good',
    health: 'Good'
  });

  // Machine Status (Door status removed)
  const [machineStatus, setMachineStatus] = useState({
    isOnline: true,
    lastUpdate: new Date(),
    securityStatus: 'Safe'
  });

  // ===== SOLENOID LOCK STATE =====
  const [solenoidLock, setSolenoidLock] = useState({
    isLocked: true,
    lastChanged: null,
    isToggling: false
  });

  // ===== CALIBRATION STATE =====
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

  const isMounted = useRef(true);
  const intervalRef = useRef(null);

  // ===== SOLENOID LOCK FUNCTIONS =====
  const toggleSolenoidLock = useCallback(async () => {
    setSolenoidLock(prev => ({ ...prev, isToggling: true }));

    try {
      const token = localStorage.getItem('token');
      const newLockState = !solenoidLock.isLocked;

      const response = await axios.post(`${API_URL}/machine/solenoid-lock`, {
        isLocked: newLockState
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setSolenoidLock({
          isLocked: newLockState,
          lastChanged: new Date().toISOString(),
          isToggling: false
        });

        if (socket) {
          socket.emit('solenoid_lock_toggle', {
            isLocked: newLockState,
            toggledBy: user?.firstName + ' ' + user?.lastName,
            timestamp: new Date().toISOString()
          });
        }

        showNotification('success', newLockState ? 'Machine locked' : 'Machine unlocked');
      } else {
        showNotification('error', response.data?.error || 'Failed to toggle lock');
        setSolenoidLock(prev => ({ ...prev, isToggling: false }));
      }
    } catch (error) {
      console.error('Error toggling solenoid lock:', error);

      const newLockState = !solenoidLock.isLocked;
      setSolenoidLock({
        isLocked: newLockState,
        lastChanged: new Date().toISOString(),
        isToggling: false
      });

      showNotification('success', newLockState ? 'Machine locked (local)' : 'Machine unlocked (local)');
    }
  }, [solenoidLock.isLocked, socket, user]);

  // ===== CALIBRATION FUNCTIONS =====
  const handleCalibrate = (scaleName) => {
    setCalibrating(true);

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

        if (data.storage1) {
          const weight = data.storage1.currentWeight || 0;
          const percentage = (weight / MAX_CAPACITY) * 100;   // ✅ / 10
          setStorage1(prev => ({
            ...prev,
            name: data.storage1.name || prev.name,
            pricePerKg: data.storage1.pricePerKg || prev.pricePerKg,
            currentWeight: weight,
            percentage: percentage,
            status: weight <= 0.1 ? 'Empty' : weight < 2.5 ? 'Low' : 'Normal',
            isLow: weight < 5
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
          const percentage = (weight / MAX_CAPACITY) * 100;   // ✅ / 10
          setStorage2(prev => ({
            ...prev,
            name: data.storage2.name || prev.name,
            pricePerKg: data.storage2.pricePerKg || prev.pricePerKg,
            currentWeight: weight,
            percentage: percentage,
            status: weight <= 0.1 ? 'Empty' : weight < 2.5 ? 'Low' : 'Normal',
            isLow: weight < 5
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

        // ✅ Battery - only percentage, status, health
        if (data.battery) {
          setBattery(prev => ({
            ...prev,
            percentage: data.battery.percentage || 100,
            status: data.battery.status || 'Good',
            health: data.battery.health || 'Good'
          }));
        }

        if (data.machineStatus) {
          setMachineStatus(prev => ({
            ...prev,
            isOnline: data.machineStatus.isOnline !== undefined ? data.machineStatus.isOnline : true,
            securityStatus: data.machineStatus.securityStatus || 'Safe',
            lastUpdate: new Date()
          }));
        }

        if (data.solenoidLock) {
          setSolenoidLock(prev => ({
            ...prev,
            isLocked: data.solenoidLock.isLocked !== undefined ? data.solenoidLock.isLocked : true,
            lastChanged: data.solenoidLock.lastChanged || prev.lastChanged
          }));
        }

        console.log('✅ Machine data loaded with product settings');
      }
    } catch (error) {
      console.error('Error fetching machine data:', error);
      try {
        const espResponse = await axios.get(`${API_URL}/esp32/latest`);
        if (espResponse.data.success && isMounted.current) {
          const data = espResponse.data;

          const storage1Weight = data.storage1?.currentWeight || 0;
          const storage1Percentage = (storage1Weight / MAX_CAPACITY) * 100;  // ✅ / 10
          setStorage1(prev => ({
            ...prev,
            currentWeight: storage1Weight,
            percentage: storage1Percentage,
            status: storage1Weight <= 0.1 ? 'Empty' : storage1Weight < 2.5 ? 'Low' : 'Normal',
            isLow: storage1Weight < 5
          }));

          const storage2Weight = data.storage2?.currentWeight || 0;
          const storage2Percentage = (storage2Weight / MAX_CAPACITY) * 100;  // ✅ / 10
          setStorage2(prev => ({
            ...prev,
            currentWeight: storage2Weight,
            percentage: storage2Percentage,
            status: storage2Weight <= 0.1 ? 'Empty' : storage2Weight < 2.5 ? 'Low' : 'Normal',
            isLow: storage2Weight < 5
          }));

          setBattery(prev => ({
            ...prev,
            percentage: data.batteryPercentage || 100
          }));

          setMachineStatus(prev => ({
            ...prev,
            isOnline: true,
            securityStatus: 'Safe',
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

    fetchMachineData();
    fetchProductSettings();

    intervalRef.current = setInterval(() => {
      if (isMounted.current) {
        fetchMachineData();
      }
    }, 30000);

    if (socket) {
      socket.on('machine_data_updated', (data) => {
        if (!isMounted.current) return;

        if (data.storage1) {
          const weight = data.storage1.currentWeight !== undefined ? data.storage1.currentWeight : storage1.currentWeight;
          const percentage = (weight / MAX_CAPACITY) * 100;  // ✅ / 10
          setStorage1(prev => ({
            ...prev,
            ...data.storage1,
            currentWeight: weight,
            percentage: percentage,
            status: weight <= 0.1 ? 'Empty' : weight < 2.5 ? 'Low' : 'Normal',
            isLow: weight < 5
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
          const weight = data.storage2.currentWeight !== undefined ? data.storage2.currentWeight : storage2.currentWeight;
          const percentage = (weight / MAX_CAPACITY) * 100;  // ✅ / 10
          setStorage2(prev => ({
            ...prev,
            ...data.storage2,
            currentWeight: weight,
            percentage: percentage,
            status: weight <= 0.1 ? 'Empty' : weight < 2.5 ? 'Low' : 'Normal',
            isLow: weight < 5
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

        if (data.battery) {
          // ✅ Only take percentage, status, health
          setBattery(prev => ({
            ...prev,
            percentage: data.battery.percentage !== undefined ? data.battery.percentage : prev.percentage,
            status: data.battery.status || prev.status,
            health: data.battery.health || prev.health
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

        fetchMachineData();
      });

      socket.on('low_stock_alert', (data) => {
        if (!isMounted.current) return;
        showNotification('warning', `Low stock alert: ${data.storageName} has only ${data.remainingKg}kg remaining`);
        if (data.storageId === 1) {
          setStorage1(prev => ({ ...prev, isLow: true, status: 'Low' }));
        } else if (data.storageId === 2) {
          setStorage2(prev => ({ ...prev, isLow: true, status: 'Low' }));
        }
      });

      socket.on('low_battery_alert', (data) => {
        if (!isMounted.current) return;
        showNotification('warning', `Low battery alert: Battery at ${data.percentage}%`);
        setBattery(prev => ({ ...prev, status: 'Critical' }));
      });

      socket.on('solenoid_lock_updated', (data) => {
        if (!isMounted.current) return;
        setSolenoidLock(prev => ({
          ...prev,
          isLocked: data.isLocked,
          lastChanged: data.timestamp || new Date().toISOString()
        }));
        showNotification('info', `Solenoid lock ${data.isLocked ? 'locked' : 'unlocked'}`);
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
        socket.off('solenoid_lock_updated');
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
    if (battery.percentage >= 70) return '#1a472a';
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
      case 'Normal': return '#1a472a';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="staff-machine-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading machine data...</p>
        </div>
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

      {/* ===== SOLENOID LOCK CONTROL SECTION ===== */}
      <div className="solenoid-section">
        <div className="solenoid-card">
          <div className="solenoid-header">
            <div>
              <h2>Solenoid Lock Control</h2>
              <p className="solenoid-subtitle">12V Solenoid Door Lock - Remote Control</p>
            </div>
            <div className={`solenoid-status ${solenoidLock.isLocked ? 'locked' : 'unlocked'}`}>
              {solenoidLock.isLocked ? 'LOCKED' : 'UNLOCKED'}
            </div>
          </div>
          <div className="solenoid-body">
            <div className="solenoid-info">
              <div className="solenoid-state">
                <span className="solenoid-state-label">Current State:</span>
                <span className={`solenoid-state-value ${solenoidLock.isLocked ? 'locked' : 'unlocked'}`}>
                  {solenoidLock.isLocked ? 'Locked' : 'Unlocked'}
                </span>
              </div>
              {solenoidLock.lastChanged && (
                <div className="solenoid-state">
                  <span className="solenoid-state-label">Last Changed:</span>
                  <span className="solenoid-state-value">
                    {new Date(solenoidLock.lastChanged).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
            <button
              className={`btn-solenoid ${solenoidLock.isLocked ? 'unlock' : 'lock'}`}
              onClick={toggleSolenoidLock}
              disabled={solenoidLock.isToggling}
            >
              {solenoidLock.isToggling ? (
                <>
                  <span className="spinner-small"></span>
                  Processing...
                </>
              ) : (
                solenoidLock.isLocked ? 'Unlock Machine' : 'Lock Machine'
              )}
            </button>
          </div>
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
            <div className="stat-label">Security Status</div>
            <div className="stat-value">{machineStatus.securityStatus}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Solenoid Lock</div>
            <div className="stat-value" style={{ color: solenoidLock.isLocked ? '#1a472a' : '#dc2626' }}>
              {solenoidLock.isLocked ? 'Locked' : 'Unlocked'}
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
              <span className="detail-value">{storage1.currentWeight.toFixed(1)} / {MAX_CAPACITY} kg</span>
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
              <span className="detail-value">{storage2.currentWeight.toFixed(1)} / {MAX_CAPACITY} kg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Battery Monitoring Section (Voltage & Charging removed) */}
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
                <span className="detail-label">Status:</span>
                <span className="detail-value">{getBatteryStatusText()}</span>
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
              <span className="detail-value">{MAX_CAPACITY * 2} kg ({MAX_CAPACITY}kg + {MAX_CAPACITY}kg)</span>
            </div>
            <div className="machine-detail">
              <span className="detail-label">Remaining Stock:</span>
              <span className="detail-value">{(storage1.currentWeight + storage2.currentWeight).toFixed(1)} kg</span>
            </div>
            <div className="machine-detail">
              <span className="detail-label">Solenoid Lock:</span>
              <span className={`detail-value ${solenoidLock.isLocked ? 'safe' : 'alert'}`}>
                {solenoidLock.isLocked ? 'Locked' : 'Unlocked'}
              </span>
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
    </div>
  );
};

export default StaffDashboard;