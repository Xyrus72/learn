/**
 * learn/SocketContext.jsx
 * 
 * Extract of the frontend Socket.IO React Context Provider from `frontend/src/context/SocketContext.jsx`
 * Provides a singleton WebSocket connection to the entire React application.
 */

import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'

const SocketContext = createContext(null)

export const SocketProvider = ({ children, isAuthenticated, isLoading }) => {
  const socketRef = useRef(null)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    // Wait until auth check is finished
    if (isLoading) return

    if (isAuthenticated) {
      // Connect to WebSocket server — cookie session sent via `withCredentials: true`
      const s = io('http://localhost:5000', {
        withCredentials: true,
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      s.on('connect', () => {
        console.log('[socket] connected successfully:', s.id)
      })

      s.on('connect_error', (err) => {
        console.warn('[socket] connection error:', err.message)
      })

      s.on('disconnect', (reason) => {
        console.log('[socket] disconnected:', reason)
      })

      socketRef.current = s
      setSocket(s)

      // Cleanup on unmount or logout
      return () => {
        s.disconnect()
        socketRef.current = null
        setSocket(null)
      }
    } else {
      // Disconnect if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect()
        socketRef.current = null
        setSocket(null)
      }
    }
  }, [isAuthenticated, isLoading])

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  )
}

// Custom hook to consume socket in any component
export const useSocket = () => {
  const ctx = useContext(SocketContext)
  if (!ctx) throw new Error('useSocket must be used within SocketProvider')
  return ctx
}
