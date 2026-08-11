# 📁 FlexTag WebSocket Learning Code Folder (`/learn`)

This folder contains isolated extracts of **only the WebSocket & Socket.IO code** from each main file in the project. Use these clean snippets to learn how real-time chat works step-by-step!

---

## 📂 File Directory & Contents

| File in `/learn` | Corresponds To Original File | What this snippet shows |
| :--- | :--- | :--- |
| 📄 [index.js](file:///d:/flextag/learn/index.js) | [backend/index.js](file:///d:/flextag/backend/index.js#L75-L96) | How to attach Socket.IO to an Express HTTP server & share session cookies. |
| 📄 [socket.js](file:///d:/flextag/learn/socket.js) | [backend/socket.js](file:///d:/flextag/backend/socket.js) | Complete backend event handlers (`connection`, `join_room`, `send_message`, `typing`, `disconnect`). |
| 📄 [SocketContext.jsx](file:///d:/flextag/learn/SocketContext.jsx) | [frontend/src/context/SocketContext.jsx](file:///d:/flextag/frontend/src/context/SocketContext.jsx) | Frontend React Context provider for creating a single persistent Socket connection. |
| 📄 [Chat.jsx](file:///d:/flextag/learn/Chat.jsx) | [frontend/src/pages/support/Chat.jsx](file:///d:/flextag/frontend/src/pages/support/Chat.jsx) | Extracted socket listeners, message emits, optimistic UI updates, and typing indicator for user chat. |
| 📄 [AdminChat.jsx](file:///d:/flextag/learn/AdminChat.jsx) | [frontend/src/pages/admin/AdminChat.jsx](file:///d:/flextag/frontend/src/pages/admin/AdminChat.jsx) | Extracted socket listeners and room management for the admin support dashboard. |
