import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // Use the correct URL based on environment
    const SOCKET_URL = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : 'https://e-agrivend.onrender.com';
    
    console.log('🔌 Connecting to Socket.IO at:', SOCKET_URL);
    
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true
    });

    newSocket.on('connect', () => {
      console.log('✅ Socket.IO connected');
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};