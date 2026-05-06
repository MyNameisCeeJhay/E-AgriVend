import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import axios from 'axios';
import './Sensors.css';

const API_URL = 'https://e-agrivend.onrender.com/api';

const AdminSensors = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [sensors, setSensors] = useState({
    sinandomeng: { stock: 0, capacity: 50, price: 54.00, status: 'ok' },
    dinorado: { stock: 0, capacity: 50, price: 60.00, status: 'ok' },
    jasmine: { stock: 0, capacity: 50, price: 65.00, status: 'ok' },
    premium: { stock: 0, capacity: 50, price: 70.00, status: 'ok' }
  });
  const [battery, setBattery] = useState({ level: 78, status: 'ok', charging: false });
  const [security, setSecurity] = useState({ status: 'normal', lastEvent: null });
  const [loading, setLoading] = useState(true);
  const [editingPrice, setEditingPrice] = useState(null);
  const [newPrice, setNewPrice] = useState('');
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchSensorData();

    if (socket) {
      socket.on('stock_update', (data) => {
        updateStock(data.riceType, data.remainingKg);
        if (data.remainingKg <= 5) {
          showNotification('warning', `Low stock alert: ${data.riceType} has only ${data.remainingKg}kg remaining`);
        }
      });

      socket.on('price_updated', (data) => {
        showNotification('success', `Price for ${data.riceType} updated to ₱${data.newPrice}/kg`);
        fetchSensorData();
      });

      socket.on('battery_update', (data) => {
        setBattery({
          level: data.level,
          status: data.level <= 15 ? 'critical' : data.level <= 30 ? 'low' : 'ok',
          charging: data.charging
        });
        if (data.level <= 15) {
          showNotification('error', `Critical battery level: ${data.level}% - Please recharge immediately`);
        } else if (data.level <= 30) {
          showNotification('warning', `Low battery: ${data.level}% - Please recharge soon`);
        }
      });

      socket.on('security_event', (data) => {
        setSecurity({ status: 'alert', lastEvent: data });
        showNotification('error', `Security alert: ${data.message}`);
        
        if (Notification.permission === 'granted') {
          new Notification('Security Alert', {
            body: data.message,
            icon: '/logo192.png'
          });
        }
      });

      return () => {
        socket.off('stock_update');
        socket.off('price_updated');
        socket.off('battery_update');
        socket.off('security_event');
      };
    }

    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [socket]);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchSensorData = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/sensors/status`);
      const data = response.data.data;
      
      if (data.stock) {
        setSensors(data.stock);
      }
      if (data.battery) {
        setBattery(data.battery);
      }
      if (data.security) {
        setSecurity(data.security);
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
      showNotification('error', 'Failed to fetch sensor data');
    } finally {
      setLoading(false);
    }
  };

  const updateStock = (riceType, stock) => {
    setSensors(prev => ({
      ...prev,
      [riceType.toLowerCase()]: {
        ...prev[riceType.toLowerCase()],
        stock: stock,
        status: stock <= 5 ? 'critical' : stock <= 15 ? 'low' : 'ok'
      }
    }));
  };

  const handleUpdatePrice = async (riceType) => {
    if (!newPrice || parseFloat(newPrice) <= 0) {
      showNotification('error', 'Please enter a valid price');
      return;
    }

    try {
      await axios.put(`${API_URL}/admin/sensors/price`, {
        riceType,
        price: parseFloat(newPrice)
      });
      
      setSensors(prev => ({
        ...prev,
        [riceType.toLowerCase()]: {
          ...prev[riceType.toLowerCase()],
          price: parseFloat(newPrice)
        }
      }));
      
      setEditingPrice(null);
      setNewPrice('');
      showNotification('success', `Price for ${riceType} updated successfully`);
    } catch (error) {
      console.error('Error updating price:', error);
      showNotification('error', 'Failed to update price');
    }
  };

  const showNotification = (type, message) => {
    setNotification({ type, message });
  };

  const getStockStatusClass = (status) => {
    switch(status) {
      case 'critical': return 'status-critical';
      case 'low': return 'status-low';
      default: return 'status-ok';
    }
  };

  const getStockStatusText = (stock, capacity) => {
    const percentage = (stock / capacity) * 100;
    if (percentage <= 10) return 'Critical - Reorder Now';
    if (percentage <= 30) return 'Low - Soon to Restock';
    return 'Normal Stock';
  };

  const getBatteryStatusClass = () => {
    if (battery.level <= 15) return 'status-critical';
    if (battery.level <= 30) return 'status-low';
    return 'status-ok';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount);
  };

  return (
    <div className="admin-page-container">
      {/* Notification Toast */}
      {notification && (
        <div className={`notification-toast ${notification.type}`}>
          <span className="notification-message">{notification.message}</span>
          <button className="notification-close" onClick={() => setNotification(null)}>×</button>
        </div>
      )}

      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Sensor Monitoring</h1>
          <p className="page-description">
            Real-time machine status, stock levels, and alerts
          </p>
        </div>
      </div>

      {/* Battery Status */}
      <div className="status-card battery-status">
        <div className="status-header">
          <h2>Battery Status</h2>
          <span className={`status-badge ${getBatteryStatusClass()}`}>
            {battery.level <= 15 ? 'Critical' : battery.level <= 30 ? 'Low' : 'Normal'}
          </span>
        </div>
        <div className="battery-level">
          <div className="battery-bar">
            <div 
              className={`battery-fill ${getBatteryStatusClass()}`}
              style={{ width: `${battery.level}%` }}
            />
          </div>
          <span className="battery-percentage">{battery.level}%</span>
        </div>
        {battery.charging && (
          <div className="charging-status">Currently Charging</div>
        )}
        {battery.level <= 15 && (
          <div className="alert-message critical">
            Critical battery level! Please recharge the machine immediately.
          </div>
        )}
        {battery.level <= 30 && battery.level > 15 && (
          <div className="alert-message warning">
            Low battery. Please recharge soon.
          </div>
        )}
      </div>

      {/* Stock Levels */}
      <div className="stock-grid">
        {Object.entries(sensors).map(([type, data]) => (
          <div key={type} className="stock-card">
            <div className="stock-header">
              <h3>{type.charAt(0).toUpperCase() + type.slice(1)}</h3>
              <span className={`stock-badge ${getStockStatusClass(data.status)}`}>
                {data.status === 'critical' ? 'Critical' : data.status === 'low' ? 'Low' : 'OK'}
              </span>
            </div>
            
            <div className="stock-level">
              <div className="stock-bar">
                <div 
                  className={`stock-fill ${getStockStatusClass(data.status)}`}
                  style={{ width: `${(data.stock / data.capacity) * 100}%` }}
                />
              </div>
              <div className="stock-numbers">
                <span className="stock-current">{data.stock} kg</span>
                <span className="stock-capacity">/ {data.capacity} kg</span>
              </div>
            </div>
            
            <div className="stock-status-text">
              {getStockStatusText(data.stock, data.capacity)}
            </div>
            
            <div className="price-section">
              <div className="current-price">
                Current Price: {formatCurrency(data.price)}/kg
              </div>
              {editingPrice === type ? (
                <div className="price-edit">
                  <input
                    type="number"
                    step="0.5"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="price-input"
                    placeholder="New price"
                  />
                  <button 
                    className="btn-save"
                    onClick={() => handleUpdatePrice(type)}
                  >
                    Save
                  </button>
                  <button 
                    className="btn-cancel"
                    onClick={() => {
                      setEditingPrice(null);
                      setNewPrice('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  className="btn-edit-price"
                  onClick={() => {
                    setEditingPrice(type);
                    setNewPrice(data.price.toString());
                  }}
                >
                  Change Price
                </button>
              )}
            </div>
            
            {data.stock <= 5 && (
              <div className="alert-message critical">
                Critical low stock! Please restock immediately.
              </div>
            )}
            {data.stock <= 15 && data.stock > 5 && (
              <div className="alert-message warning">
                Low stock alert. Prepare for restocking.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Security Status */}
      <div className="status-card security-status">
        <div className="status-header">
          <h2>Security Status</h2>
          <span className={`status-badge ${security.status === 'alert' ? 'status-critical' : 'status-ok'}`}>
            {security.status === 'alert' ? 'Alert' : 'Normal'}
          </span>
        </div>
        {security.lastEvent && (
          <div className="security-event">
            <div className="event-message">{security.lastEvent.message}</div>
            <div className="event-time">
              {new Date(security.lastEvent.timestamp).toLocaleString()}
            </div>
          </div>
        )}
        {security.status === 'normal' && (
          <div className="normal-status">All systems secure</div>
        )}
      </div>
    </div>
  );
};

export default AdminSensors;