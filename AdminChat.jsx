/**
 * learn/AdminChat.jsx
 * 
 * Extract of ONLY the WebSocket logic from `frontend/src/pages/admin/AdminChat.jsx`
 */

import { useEffect, useRef, useState } from 'react'
import { useSocket } from '../frontend/src/context/SocketContext'

export default function AdminChatWebSocketSnippet({ activeConv, user }) {
  const { socket } = useSocket()
  
  const [messages, setMessages] = useState([])
  const [conversations, setConversations] = useState([])
  const [typingUser, setTypingUser] = useState(null)
  const [totalUnread, setTotalUnread] = useState(0)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const typingTimerRef = useRef(null)

  // ── 1. Real-time Socket.IO Event Listeners ─────────────────────────────
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = ({ message }) => {
      const msgConvId = message.conversationId?.toString?.() || message.conversationId
      if (msgConvId === activeConv?._id?.toString()) {
        setMessages(prev => {
          const exists = prev.some(m => m._id === message._id)
          return exists ? prev : [...prev, message]
        })
      }
      // Update sidebar preview & unread counters
      setConversations(prev => prev.map(c =>
        c._id?.toString() === msgConvId
          ? { ...c, lastMessage: message.text, lastMessageAt: message.createdAt, unreadCount: activeConv?._id?.toString() === msgConvId ? 0 : (c.unreadCount || 0) + 1 }
          : c
      ))
      setTotalUnread(prev => activeConv?._id?.toString() === msgConvId ? prev : prev + 1)
    }

    const handleConvUpdated = ({ conversationId, lastMessage, lastMessageAt }) => {
      setConversations(prev => prev.map(c =>
        c._id?.toString() === conversationId?.toString()
          ? { ...c, lastMessage, lastMessageAt }
          : c
      ))
    }

    const handleTyping = ({ conversationId, userName }) => {
      if (conversationId === activeConv?._id?.toString()) setTypingUser(userName)
    }
    const handleStopTyping = () => setTypingUser(null)

    socket.on('new_message',         handleNewMessage)
    socket.on('conversation_updated', handleConvUpdated)
    socket.on('user_typing',          handleTyping)
    socket.on('user_stop_typing',     handleStopTyping)

    return () => {
      socket.off('new_message',          handleNewMessage)
      socket.off('conversation_updated', handleConvUpdated)
      socket.off('user_typing',          handleTyping)
      socket.off('user_stop_typing',     handleStopTyping)
    }
  }, [socket, activeConv?._id])

  // ── 2. Join selected conversation room ─────────────────────────────────
  useEffect(() => {
    if (!socket || !activeConv?._id) return
    socket.emit('join_room', { conversationId: activeConv._id })
    setTypingUser(null)
  }, [socket, activeConv?._id])

  // ── 3. Send message via Socket ─────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !activeConv?._id || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)

    // Optimistic insert
    const tempMsg = {
      _id: 'temp-' + Date.now(),
      conversationId: activeConv._id,
      senderId: { _id: user._id, name: user.name, role: 'admin', avatar: user.avatar },
      text,
      createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempMsg])

    try {
      if (socket?.connected) {
        socket.emit('send_message', { conversationId: activeConv._id, text })
        setMessages(prev => prev.filter(m => m._id !== tempMsg._id))
      } else {
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

  // ── 4. Typing indicator ────────────────────────────────────────────────
  const handleInputChange = (e) => {
    setInput(e.target.value)
    if (socket && activeConv?._id) {
      socket.emit('typing', { conversationId: activeConv._id })
      clearTimeout(typingTimerRef.current)
      typingTimerRef.current = setTimeout(() => {
        socket.emit('stop_typing', { conversationId: activeConv._id })
      }, 1500)
    }
  }

  return null
}
