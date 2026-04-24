import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SOCKET_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:5000'
  : 'https://e-agrivend.onrender.com';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [sensorData, setSensorData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    withCredentials: true
  });

    newSocket.on('sensor_update', (data) => {
      setSensorData(data);
    });

    newSocket.on('alerts', (newAlerts) => {
      setAlerts((prev) => [...prev, ...newAlerts]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider value={{ socket, sensorData, alerts, setAlerts }}>
      {children}
    </SocketContext.Provider>
  );
};