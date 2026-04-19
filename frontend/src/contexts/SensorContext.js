import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSocket } from './SocketContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const SensorContext = createContext();

export const useSensor = () => useContext(SensorContext);

export const SensorProvider = ({ children }) => {
  const { socket } = useSocket();
  const [sensorData, setSensorData] = useState(null);
  const [sensorHistory, setSensorHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReadings: 0,
    averageTemperature: 0,
    averageBattery: 0,
    lowStockCount: 0
  });

  // Fetch current sensor data
  useEffect(() => {
    fetchCurrentData();
    fetchHistory();
    fetchStats();
  }, []);

  // Listen for real-time socket updates
  useEffect(() => {
    if (!socket) return;

    socket.on('sensor_update', (data) => {
      console.log('📊 Real-time sensor update:', data);
      setSensorData(data);
      
      // Check for critical alerts
      if (data.batteryPercentage < 20) {
        addAlert({
          type: 'LOW_BATTERY',
          message: `Battery at ${data.batteryPercentage}% - Please recharge!`,
          timestamp: new Date()
        });
      }
      
      if (data.container1Stock === 'LOW') {
        addAlert({
          type: 'LOW_STOCK',
          message: `Sinandomeng rice is low (${data.container1Level.toFixed(1)}kg remaining)`,
          timestamp: new Date()
        });
      }
      
      if (data.container2Stock === 'LOW') {
        addAlert({
          type: 'LOW_STOCK',
          message: `Dinorado rice is low (${data.container2Level.toFixed(1)}kg remaining)`,
          timestamp: new Date()
        });
      }
    });

    socket.on('alerts', (newAlerts) => {
      newAlerts.forEach(alert => addAlert(alert));
    });

    return () => {
      socket.off('sensor_update');
      socket.off('alerts');
    };
  }, [socket]);

  const addAlert = (alert) => {
    setAlerts(prev => [{
      id: Date.now(),
      ...alert,
      read: false,
      timestamp: new Date()
    }, ...prev].slice(0, 50));
  };

  const fetchCurrentData = async () => {
    try {
      const response = await axios.get(`${API_URL}/sensors/current`);
      setSensorData(response.data.data);
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/sensors/history?days=7`);
      setSensorHistory(response.data.data);
    } catch (error) {
      console.error('Error fetching sensor history:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/sensors/stats`);
      setStats(response.data.data);
    } catch (error) {
      console.error('Error fetching sensor stats:', error);
    }
  };

  const markAlertAsRead = (alertId) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, read: true } : alert
    ));
  };

  const clearAlerts = () => {
    setAlerts([]);
  };

  const value = {
    sensorData,
    sensorHistory,
    alerts,
    stats,
    loading,
    markAlertAsRead,
    clearAlerts,
    refreshData: fetchCurrentData
  };

  return (
    <SensorContext.Provider value={value}>
      {children}
    </SensorContext.Provider>
  );
};