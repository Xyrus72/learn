/**
 * learn/socket.js
 * 
 * Detailed beginner-friendly breakdown of how real-time chat works with Socket.IO & MongoDB.
 */

// ── 1. IMPORT MONGOOSE MODELS ───────────────────────────────────────────────
// Conversation: Represents the chat room / thread (who is in the chat, last message preview, etc.)
const Conversation = require('../backend/models/Conversation')

// Message: Represents an individual chat bubble sent inside a conversation (text, sender, timestamp)
const Message      = require('../backend/models/Message')

// User: Represents a registered user in our system (name, email, role, avatar, etc.)
const User         = require('../backend/models/User')


// Export a function that receives the Socket.IO main instance (`io`) from our HTTP server
module.exports = function initSocket(io) {

  // ── 2. SOCKET AUTHENTICATION MIDDLEWARE ───────────────────────────────────
  // `io.use()` runs EVERY TIME a user tries to connect via WebSockets (BEFORE the connection is allowed)
  io.use((socket, next) => {

    // Step A: Extract the user's session from the connection request (stored in browser cookies)
    const session = socket.request.session

    // Step B: Check if session exists and has a logged-in user ID
    if (session && session.userId) {
      
      // Step C: Look up the user in MongoDB by their ID
      User.findById(session.userId)
        // Select only the public profile fields we need for chat
        .select('_id name companyName role avatar logoUrl isVerified')
        .then(user => {
          // If user doesn't exist in database, reject connection
          if (!user) return next(new Error('User not found'))

          // Step D: Attach the user's data object directly to this socket connection!
          // Now `socket.user` will be available in all future socket events for this client.
          socket.user = user

          // Call next() with no errors to ALLOW the connection
          next()
        })
        .catch(next) // Handle database errors
    } else {
      // If no valid session/cookie exists, REJECT the connection request
      next(new Error('Not authenticated'))
    }
  })


  // ── 3. REAL-TIME CONNECTION EVENT ────────────────────────────────────────
  // `io.on('connection')` fires when a user successfully connects to WebSockets
  io.on('connection', (socket) => {

    // Get the connected user's ID as a string
    const userId = socket.user._id.toString()
    
    // Log to server console that user connected
    console.log(`[socket] connected: ${socket.user.name} (${socket.user.role})`)


    // ── Auto-join Conversation Rooms ────────────────────────────────────────
    // Find all conversations in MongoDB where this user is listed in `participants`
    Conversation.find({ participants: socket.user._id })
      .select('_id') // Fetch only the conversation IDs
      .then(convs => {
        // Loop through each conversation ID and join its Socket.IO room
        // Joining a room means this socket will receive messages broadcasted to that room!
        convs.forEach(c => socket.join(c._id.toString()))
      })
      .catch(err => console.error('[socket] auto-join error:', err))


    // ── Join Personal User Room ─────────────────────────────────────────────
    // Join a private room unique to this user (e.g. "user_64a1b2c3...")
    // Useful for sending sidebar updates or notifications directly to this user across all their tabs!
    socket.join(`user_${userId}`)


    // ── 4. EVENT: join_room ─────────────────────────────────────────────────
    // Triggered when frontend asks to join a specific conversation room explicitly
    socket.on('join_room', async ({ conversationId }) => {
      try {
        // Find conversation in database
        const conv = await Conversation.findById(conversationId)
        if (!conv) return // If conversation doesn't exist, stop

        // Security Check: Verify if the connected user is actually a participant in this conversation
        const isMember = conv.participants.some(p => p.toString() === userId)
        if (!isMember) return // If user isn't a participant, reject joining

        // Put user's socket connection into this specific room
        socket.join(conversationId)
      } catch (err) {
        console.error('[socket] join_room error:', err)
      }
    })


    // ── 5. EVENT: leave_room ────────────────────────────────────────────────
    // Triggered when frontend user closes or navigates away from a chat
    socket.on('leave_room', ({ conversationId }) => {
      // Remove this socket connection from the room
      socket.leave(conversationId)
    })


    // ── 6. EVENT: send_message ──────────────────────────────────────────────
    // Triggered when a user types a message and clicks "Send"
    socket.on('send_message', async ({ conversationId, text }) => {
      try {
        // Validation: Ignore empty requests or empty text
        if (!conversationId || !text?.trim()) return

        // Step A: Security Check - Make sure conversation exists and user is a participant
        const conv = await Conversation.findById(conversationId)
        if (!conv) return
        const isMember = conv.participants.some(p => p.toString() === userId)
        if (!isMember) return // Security: prevent sending messages into chats you don't belong to

        // Step B: Create and save the new Message document in MongoDB
        const message = await Message.create({
          conversationId,       // Which chat this message belongs to
          senderId: socket.user._id, // Who sent this message (current user)
          text: text.trim(),     // Cleaned message text
        })

        // Step C: Update the Conversation document's preview summary
        conv.lastMessage = text.trim() // Save snippet of latest message for sidebar
        conv.lastMessageAt = new Date() // Update timestamp of latest activity
        await conv.save()              // Save changes to database

        // Step D: Attach sender's profile info (name, avatar, role) to the message object
        const populated = await message.populate('senderId', 'name companyName role avatar logoUrl')

        // Step E: Real-time Broadcast #1 -> Send new message to EVERYONE inside the conversation room
        // Everyone in `conversationId` room sees the new chat bubble appear instantly!
        io.to(conversationId).emit('new_message', { message: populated })

        // Step F: Real-time Broadcast #2 -> Notify all participants' personal rooms (`user_xxx`)
        // Updates their sidebar preview & timestamp even if they are currently viewing a different page
        conv.participants.forEach(participantId => {
          io.to(`user_${participantId.toString()}`).emit('conversation_updated', {
            conversationId,
            lastMessage:   text.trim(),
            lastMessageAt: conv.lastMessageAt,
          })
        })
      } catch (err) {
        console.error('[socket] send_message error:', err)
      }
    })


    // ── 7. EVENT: typing & stop_typing ─────────────────────────────────────
    // Triggered when user starts typing in the message input box
    socket.on('typing', ({ conversationId }) => {
      // `socket.to(...)` sends event to everyone in the room EXCEPT the sender (the person typing)
      socket.to(conversationId).emit('user_typing', {
        userId,
        userName: socket.user.companyName || socket.user.name,
        conversationId,
      })
    })

    // Triggered when user stops typing or clears input box
    socket.on('stop_typing', ({ conversationId }) => {
      // Notify everyone else in the room to hide the "is typing..." animation
      socket.to(conversationId).emit('user_stop_typing', { userId, conversationId })
    })


    // ── 8. EVENT: disconnect ────────────────────────────────────────────────
    // Triggered automatically when browser tab is closed, refreshed, or internet loses connection
    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.user.name}`)
    })

  })
}


Conversation → Access conversation data
Message      → Access message data
User         → Access user data

initSocket(io) → Set up all Socket.IO logic
io.use()       → Check if user is authenticated
session        → Get logged-in user's session
userId         → Identify the user
User.findById  → Find user in database
socket.user    → Attach user to socket

connection     → User connected
socket         → Current user's connection

socket.join() → Join a conversation room
socket.leave() → Leave a conversation room

join_room     → User wants to join a chat
leave_room    → User wants to leave a chat

send_message  → User sends a message
Message.create → Save message to MongoDB
conv.save()    → Update conversation info

io.to(room)   → Target a specific room
emit()        → Send an event
new_message   → Tell room about new message

user_123      → Personal room for user 123
conversation_updated → Update sidebar

typing        → User is typing
stop_typing   → User stopped typing

socket.to(room) → Send to everyone else in room
io.to(room)     → Send to everyone in room

disconnect    → User disconnected
