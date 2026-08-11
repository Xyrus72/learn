/**
 * learn/index.js
 * 
 * Extract of ONLY the WebSocket initialization logic from `backend/index.js`
 */

const http       = require('http')
const { Server } = require('socket.io')

// 1. Create HTTP server from Express app
const app    = express()
const server = http.createServer(app)

// 2. Attach Socket.IO to HTTP server with CORS config
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    },
    credentials: true, // Allows cookies (sessions) to be passed with WebSockets
  },
})

// 3. Share Express session middleware with Socket.IO
// This gives socket handlers access to `socket.request.session` (who is logged in)
io.use((socket, next) => {
  sessionMiddleware(socket.request, socket.request.res || {}, next)
})

// 4. Import and initialize socket event handlers
const initSocket = require('./socket')
initSocket(io)

// 5. Listen on PORT using server (not app.listen!)
server.listen(5000, () => console.log('Server running with WebSockets!'))
