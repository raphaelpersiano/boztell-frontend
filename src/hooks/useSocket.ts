'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8080';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    console.log('🔌 Initializing Socket.IO connection...', {
      url: SOCKET_URL,
      env: process.env.NEXT_PUBLIC_SOCKET_URL,
    });

    // Initialize socket connection
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      timeout: 10000,
      // Add CORS options
      withCredentials: false,
      autoConnect: true,
    });

    socketRef.current = socket;

    // 🔍 DEBUG: Listen to ALL events for troubleshooting
    socket.onAny((eventName, ...args) => {
      console.log('🔔 Socket.IO Event Received:', {
        event: eventName,
        data: args,
        timestamp: new Date().toISOString(),
      });
    });

    // Connection events
    socket.on('connect', () => {
      console.log('✅ Socket connected:', socket.id);
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setIsConnected(false);
      
      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect manually
        socket.connect();
      }
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket connection error:', {
        message: err.message,
        name: err.name,
        stack: err.stack,
      });
      
      setIsConnected(false);
      setError(
        `Cannot connect to Socket.IO server at ${SOCKET_URL}\n\n` +
        `Error: ${err.message}\n\n` +
        `Troubleshooting:\n` +
        `1. Check if backend is running: npm start (in boztell-backend)\n` +
        `2. Verify Socket.IO server is initialized in backend\n` +
        `3. Check backend CORS settings allow frontend origin\n` +
        `4. Verify NEXT_PUBLIC_SOCKET_URL in .env.local\n\n` +
        `Note: App will work without Socket.IO, but real-time features will be disabled.`
      );
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      setIsConnected(true);
      setError(null);
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 Reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_error', (err) => {
      console.error('❌ Reconnection error:', err.message);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Reconnection failed after all attempts');
      setError('Failed to reconnect to Socket.IO server. Real-time features disabled.');
    });

    // Cleanup on unmount
    return () => {
      console.log('🔌 Disconnecting Socket.IO...');
      socket.disconnect();
    };
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
  };
}

