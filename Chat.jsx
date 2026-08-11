/**
 * learn/Chat.jsx
 * 
 * Extract of ONLY the WebSocket logic from `frontend/src/pages/support/Chat.jsx`
 */

import { useEffect, useRef, useState } from 'react'
import { useSocket } from '../frontend/src/context/SocketContext'

export default function ChatWebSocketSnippet({ activeConv, user }) {
  const { socket } = useSocket()
  
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [typingUser, setTypingUser] = useState(null)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const typingTimer = useRef(null)

  // ── 1. Listen for WebSocket events ─────────────────────────────────────────
  useEffect(() => {
    if (!socket) return

    // Incoming new message event
    const handleNewMessage = ({ message }) => {
      const msgConvId = message.conversationId?.toString?.() || message.conversationId
      if (msgConvId === activeConv?._id?.toString()) {
        setMessages(prev => {
          const exists = prev.some(m => m._id === message._id)
          return exists ? prev : [...prev, message]
        })
      }
      // Update sidebar preview
      setConversations(prev => prev.map(c =>
        c._id?.toString() === msgConvId
          ? { ...c, lastMessage: message.text, lastMessageAt: message.createdAt }
          : c
      ))
    }

    // Sidebar update event
    const handleConvUpdated = ({ conversationId, lastMessage, lastMessageAt }) => {
      setConversations(prev => prev.map(c =>
        c._id?.toString() === conversationId?.toString()
          ? { ...c, lastMessage, lastMessageAt }
          : c
      ))
    }

    // Typing indicator events
    const handleTyping = ({ conversationId, userName }) => {
      if (conversationId === activeConv?._id?.toString()) setTypingUser(userName)
    }
    const handleStopTyping = () => setTypingUser(null)

    // Subscribe to socket events
    socket.on('new_message',          handleNewMessage)
    socket.on('conversation_updated', handleConvUpdated)
    socket.on('user_typing',          handleTyping)
    socket.on('user_stop_typing',     handleStopTyping)

    // Unsubscribe cleanup
    return () => {
      socket.off('new_message',          handleNewMessage)
      socket.off('conversation_updated', handleConvUpdated)
      socket.off('user_typing',          handleTyping)
      socket.off('user_stop_typing',     handleStopTyping)
    }
  }, [socket, activeConv?._id])

  // ── 2. Join socket room when active conversation changes ──────────────────
  useEffect(() => {
    if (!socket || !activeConv?._id) return
    socket.emit('join_room', { conversationId: activeConv._id })
    setTypingUser(null)
  }, [socket, activeConv?._id])

  // ── 3. Send message via Socket (with REST fallback) ──────────────────────
  const handleSend = async () => {
    if (!input.trim() || !activeConv?._id || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    // Optimistic UI update (temporary message bubble)
    const tempMsg = {
      _id: 'temp-' + Date.now(),
      conversationId: activeConv._id,
      senderId: { _id: user._id, name: user.name, role: user.role },
      text,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      if (socket?.connected) {
        // Emit via WebSocket
        socket.emit('send_message', { conversationId: activeConv._id, text })
        // Remove temporary message (real message will arrive back via 'new_message' socket event)
        setMessages(prev => prev.filter(m => m._id !== tempMsg._id))
      } else {
        // Fallback to HTTP POST if socket is disconnected
        const res = await fetch('/api/messages', { method: 'POST', body: JSON.stringify({ conversationId: activeConv._id, text }) })
        const data = await res.json()
        setMessages(prev => prev.map(m => m._id === tempMsg._id ? data.message : m))
      }
    } catch (err) {
      console.error('Send error:', err)
      setMessages(prev => prev.filter(m => m._id !== tempMsg._id))
    } finally {
      setSending(false)
    }
  }

  // ── 4. Debounced typing indicator emission ──────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value)
    if (socket && activeConv?._id) {
      socket.emit('typing', { conversationId: activeConv._id })
      clearTimeout(typingTimer.current)
      typingTimer.current = setTimeout(() => {
        socket.emit('stop_typing', { conversationId: activeConv._id })
      }, 1500) // Stop typing auto-triggers after 1.5 seconds of inactivity
    }
  }

  return null // Snippet extract
}
