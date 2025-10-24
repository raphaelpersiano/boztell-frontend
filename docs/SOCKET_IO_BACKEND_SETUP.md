# Socket.IO Backend Setup Guide

## 🚨 **WebSocket Connection Error**

Frontend menampilkan error:
```
WebSocket connection error
Cannot connect to Socket.IO server at http://localhost:8080
```

---

## 🔍 **Possible Causes**

1. ❌ Backend Socket.IO server tidak running
2. ❌ Backend tidak initialize Socket.IO
3. ❌ CORS tidak dikonfigurasi dengan benar
4. ❌ Port 8080 tidak listening untuk WebSocket

---

## ✅ **Backend Setup Required**

### **Step 1: Install Socket.IO**

```bash
cd boztell-backend
npm install socket.io
npm install cors
```

---

### **Step 2: Initialize Socket.IO Server**

```javascript
// backend/server.js atau backend/index.js

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// ✅ Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',  // Frontend dev
      'http://localhost:3001',
      'https://your-production-domain.com'
    ],
    methods: ['GET', 'POST'],
    credentials: false
  },
  transports: ['websocket', 'polling']
});

// ✅ Enable CORS for Express routes
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: false
}));

app.use(express.json());

// ✅ Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('✅ Client connected:', socket.id);
  
  // Handle join room
  socket.on('join_room', (roomId) => {
    socket.join(`room_${roomId}`);
    console.log(`📨 Socket ${socket.id} joined room_${roomId}`);
  });
  
  // Handle leave room
  socket.on('leave_room', (roomId) => {
    socket.leave(`room_${roomId}`);
    console.log(`📤 Socket ${socket.id} left room_${roomId}`);
  });
  
  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log('❌ Client disconnected:', socket.id, reason);
  });
});

// ✅ Make io available globally
app.set('io', io);

// Your routes
app.use('/rooms', require('./routes/rooms'));
app.use('/messages', require('./routes/messages'));
app.use('/webhook', require('./routes/webhook'));

// ✅ IMPORTANT: Use server.listen, NOT app.listen!
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.IO ready for connections`);
});

module.exports = { app, io };
```

---

### **Step 3: Emit Events in Your Routes**

**Example: Emit new_message when webhook receives message**

```javascript
// backend/routes/webhook.js

router.post('/whatsapp', async (req, res) => {
  try {
    // ... process webhook
    
    // Save message to database
    const message = await saveMessageToDB(data);
    
    // ✅ Emit to Socket.IO clients
    const io = req.app.get('io');
    
    // Emit to specific room
    io.to(`room_${message.room_id}`).emit('new_message', {
      id: message.id,
      room_id: message.room_id,
      user_id: message.user_id,
      content_type: message.content_type,
      content_text: message.content_text,
      created_at: message.created_at,
      status: message.status,
      // ... other fields
    });
    
    // Also emit to update room list
    io.emit('new_message', message);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

### **Step 4: Emit new_room Event**

```javascript
// backend/utils/ensureRoom.js

async function ensureRoom(phone) {
  // Check if room exists
  let room = await getRoomByPhone(phone);
  
  if (!room) {
    // Create new room
    room = await createRoom({ phone, title: phone });
    
    // ✅ Emit new_room event to all connected clients
    const io = global.io || req.app.get('io');
    io.emit('new_room', {
      id: room.id,
      phone: room.phone,
      title: room.title,
      leads_id: room.leads_id,
      created_at: room.created_at,
      updated_at: room.updated_at
    });
    
    console.log('🆕 New room created and broadcasted:', room.id);
  }
  
  return room;
}
```

---

## 🧪 **Testing Socket.IO Setup**

### **Test 1: Check if Socket.IO is Running**

```bash
curl http://localhost:8080/socket.io/
```

**Expected response:**
```json
{"code":0,"message":"Transport unknown"}
```

If you get 404, Socket.IO is NOT initialized!

---

### **Test 2: Check WebSocket Connection**

Open browser console on frontend:
```javascript
// Should see:
🔌 Initializing Socket.IO connection... { url: 'http://localhost:8080' }
✅ Socket connected: <socket-id>
```

If you see errors:
```
❌ Socket connection error: ...
```

Check backend logs for CORS errors or connection issues.

---

### **Test 3: Test Event Broadcasting**

**Backend (in any route):**
```javascript
const io = req.app.get('io');
io.emit('test_event', { message: 'Hello from backend!' });
```

**Frontend (in browser console):**
```javascript
// Listen for test event
socket.on('test_event', (data) => {
  console.log('Received test event:', data);
});
```

---

## 🔧 **Common Issues & Solutions**

### **Issue 1: "WebSocket connection failed"**

**Cause:** Backend not running or Socket.IO not initialized

**Solution:**
1. Start backend: `cd boztell-backend && npm start`
2. Check backend logs for Socket.IO initialization message
3. Verify `server.listen()` is used, not `app.listen()`

---

### **Issue 2: CORS Error**

**Error in browser:**
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solution:**
```javascript
// backend/server.js
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',  // Frontend URL
    methods: ['GET', 'POST']
  }
});
```

---

### **Issue 3: Events Not Received**

**Cause:** Room not joined or wrong event name

**Solution:**
```javascript
// Backend: emit to specific room
io.to(`room_${roomId}`).emit('new_message', data);

// Frontend: join room first
socket.emit('join_room', roomId);
socket.on('new_message', (data) => {
  console.log('Message received:', data);
});
```

---

## 📋 **Backend Checklist**

- [ ] Install `socket.io` and `cors` packages
- [ ] Create HTTP server with `http.createServer(app)`
- [ ] Initialize Socket.IO with CORS config
- [ ] Use `server.listen()` instead of `app.listen()`
- [ ] Handle `connection` event
- [ ] Handle `join_room` and `leave_room` events
- [ ] Emit `new_room` when room created
- [ ] Emit `new_message` when message received
- [ ] Emit `message_status_update` for read receipts
- [ ] Make `io` available to routes via `app.set('io', io)`
- [ ] Test with `curl http://localhost:8080/socket.io/`

---

## 🎯 **Expected Behavior After Fix**

### **Backend Logs:**
```
🚀 Server running on port 8080
🔌 Socket.IO ready for connections
✅ Client connected: Abc123XyZ
📨 Socket Abc123XyZ joined room_uuid-123
```

### **Frontend Logs:**
```
🔌 Initializing Socket.IO connection... { url: 'http://localhost:8080' }
✅ Socket connected: Abc123XyZ
📨 Joining room: uuid-123
```

### **UI:**
- ✅ Green dot showing "Connected"
- ✅ No WebSocket errors in console
- ✅ Real-time messages work
- ✅ New rooms appear instantly

---

**Without Socket.IO setup, app will still work but real-time features will be disabled!**

Backend must implement Socket.IO for full functionality. 🚀
