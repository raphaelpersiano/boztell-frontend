# 🔍 Debug Real-time Messages - COMPLETE GUIDE

## ❌ **Problem**
Customer kirim pesan → masuk database ✅  
Frontend tidak muncul pesan real-time ❌  
Harus refresh / pindah room baru muncul ❌

---

## 🧪 **Step-by-Step Debugging**

### **Step 1: Verify Socket.IO Connection**

**Open browser console (F12)** saat buka aplikasi:

**✅ Expected logs:**
```
🔌 Initializing Socket.IO connection... { url: 'http://localhost:8080' }
✅ Socket connected: abc123xyz
```

**❌ If you see:**
```
❌ Socket connection error: ...
```

**Solution:**
1. Check backend is running: `cd boztell-backend && npm start`
2. Verify Socket.IO initialized in backend (see `SOCKET_IO_BACKEND_SETUP.md`)
3. Check CORS settings in backend

---

### **Step 2: Verify Room Join**

**Open a chat room**, check console:

**✅ Expected logs:**
```
📨 Joining room for real-time updates: 123e4567-e89b-12d3-a456-426614174000
```

**❌ If missing:**
- Check `useRealtimeMessages` hook is called
- Verify `roomId` is not null/undefined

---

### **Step 3: Use Socket.IO Event Tester** 🔧

**Open test page:**
```
file:///C:/Project/boztell-frontend/test-socket-events.html
```

**Test procedure:**
1. Click **"Connect"** → Should show `✅ Connected: <socket-id>`
2. Enter room UUID (from your chat URL)
3. Click **"Join Room"** → Watch for any events
4. Send WhatsApp message from customer
5. **Watch Event Log** → Should see `🔔 Event: new_message`

**✅ If you see `new_message` event:**
→ Backend is emitting correctly! Problem is in frontend listener.

**❌ If you DON'T see `new_message` event:**
→ **BACKEND NOT EMITTING!** Backend webhook tidak emit Socket.IO event!

---

### **Step 4: Check Backend Emit Logic**

**Backend MUST emit event saat save message:**

```javascript
// backend/routes/webhook.js atau backend/webhooks/whatsapp.js

router.post('/whatsapp', async (req, res) => {
  try {
    // ... process webhook dari Meta
    
    // Save message to database
    const message = await saveMessageToDB(messageData);
    
    // ✅✅✅ CRITICAL: Emit Socket.IO event
    const io = req.app.get('io');
    
    if (!io) {
      console.error('❌❌❌ Socket.IO NOT INITIALIZED! Real-time will NOT work!');
    } else {
      console.log('📡 Emitting new_message event:', {
        id: message.id,
        room_id: message.room_id,
        content: message.content_text?.substring(0, 50),
      });
      
      // Emit globally (ALL clients will receive)
      io.emit('new_message', {
        id: message.id,
        room_id: message.room_id,
        user_id: message.user_id || null,
        content_type: message.content_type,
        content_text: message.content_text,
        media_type: message.media_type,
        media_id: message.media_id,
        gcs_filename: message.gcs_filename,
        gcs_url: message.gcs_url,
        file_size: message.file_size,
        mime_type: message.mime_type,
        original_filename: message.original_filename,
        wa_message_id: message.wa_message_id,
        status: message.status || 'sent',
        status_timestamp: message.status_timestamp,
        metadata: message.metadata,
        reply_to_wa_message_id: message.reply_to_wa_message_id,
        reaction_emoji: message.reaction_emoji,
        reaction_to_wa_message_id: message.reaction_to_wa_message_id,
        created_at: message.created_at,
        updated_at: message.updated_at,
      });
      
      // ALSO emit to specific room
      io.to(`room_${message.room_id}`).emit('new_message', message);
      
      console.log('✅ new_message event emitted successfully');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Expected backend console logs when customer sends message:**
```
📡 Emitting new_message event: { id: '...', room_id: '...', content: '...' }
✅ new_message event emitted successfully
```

**❌ If you DON'T see these logs:**
→ Backend webhook **TIDAK EMIT EVENT!** Tambahkan code di atas!

---

### **Step 5: Check Frontend Receives Event**

**With enhanced logging (already added), you'll see:**

**✅ Expected logs when customer sends message:**
```
🔔 Socket.IO Event Received: {
  event: "new_message",
  data: [{
    id: "msg-uuid-123",
    room_id: "room-uuid-456",
    content_text: "Hello from customer",
    ...
  }],
  timestamp: "2025-10-23T10:30:45.123Z"
}

📩 New message received via Socket.IO: {
  messageId: "msg-uuid-123",
  roomId: "room-uuid-456",
  currentRoom: "room-uuid-456",
  contentPreview: "Hello from customer",
  fullMessage: { ... }
}

✅ Message belongs to current room, adding to state
✅ Adding new message to state
```

**❌ If you see:**
```
🔔 Socket.IO Event Received: { event: "new_message", ... }
```
But NO `📩 New message received via Socket.IO:` log:

→ Event listener `socket.on('new_message', ...)` tidak terpasang!

**❌ If you see:**
```
📩 New message received via Socket.IO: ...
ℹ️ Message for different room, ignoring
```

→ `message.room_id` tidak sama dengan `currentRoom`! Check data structure!

---

## 🔧 **Common Issues & Solutions**

### **Issue 1: Backend tidak emit event**

**Symptoms:**
- Message masuk database ✅
- Frontend tidak dapat real-time update ❌
- No logs `📡 Emitting new_message event` di backend
- Socket.IO Event Tester tidak menangkap event

**Solution:**
Add to webhook handler (copy code from Step 4 above)

---

### **Issue 2: Socket.IO tidak ter-initialize di backend**

**Symptoms:**
- Backend log: `❌ Socket.IO not initialized!`
- Frontend: `❌ Socket connection error`

**Solution:**
Check `backend/server.js`:
```javascript
const io = new Server(server, { cors: { ... } });
app.set('io', io);  // ✅ Make io available
server.listen(8080); // ✅ Use server.listen, NOT app.listen!
```

---

### **Issue 3: room_id mismatch**

**Symptoms:**
- Backend emit event ✅
- Frontend log: `ℹ️ Message for different room, ignoring`

**Root cause:**
Backend emit `message.room_id` !== Frontend `currentRoom`

**Solution:**
1. Check console log `fullMessage` field
2. Compare `message.room_id` with URL room ID
3. Ensure database saves correct `room_id`

Example fix:
```javascript
// Backend: Ensure room_id is saved correctly
const message = {
  room_id: room.id, // Must be UUID, not room.phone!
  // ...
};
```

---

### **Issue 4: Event listener not registered**

**Symptoms:**
- `🔔 Socket.IO Event Received` shows event ✅
- But NO `📩 New message received` log ❌

**Root cause:**
`socket.on('new_message', handleNewMessage)` tidak dipanggil

**Solution:**
Check `useRealtimeMessages` hook:
- Is it being called with valid `socket`, `roomId`, `isConnected`?
- Check React DevTools → Components → ChatWindow → hooks

---

## 📊 **Complete Flow Verification**

**1. Customer sends message via WhatsApp**
```
WhatsApp → Meta API → Backend Webhook (POST /webhook/whatsapp)
```

**2. Backend processes webhook**
```javascript
// backend/routes/webhook.js
POST /webhook/whatsapp
→ Parse Meta webhook payload
→ Save to database (INSERT INTO messages)
→ io.emit('new_message', messageData) ✅ CRITICAL!
→ Response 200 OK to Meta
```

**3. Socket.IO broadcasts event**
```
Backend Socket.IO Server
→ io.emit() → All connected clients
→ io.to('room_X').emit() → Clients in specific room
```

**4. Frontend receives event**
```typescript
// useSocket.ts
socket.onAny() → Logs 🔔 Socket.IO Event Received

// useRealtimeMessages.ts
socket.on('new_message', handleNewMessage)
→ Check if message.room_id === currentRoomId
→ setMessages(prev => [...prev, message])
→ React re-renders
```

**5. UI shows message instantly**
```
ChatWindow re-renders with new message ✅
No refresh needed ✅
```

---

## 🎯 **Quick Debug Checklist**

Run through these in order:

1. **Open browser console (F12)**
2. **Check:** `✅ Socket connected: <id>` present?
3. **Open chat room**
4. **Check:** `📨 Joining room for real-time updates: <uuid>` present?
5. **Open:** `test-socket-events.html` in another tab
6. **Click:** Connect → Enter same room UUID → Join Room
7. **Send test message from customer WhatsApp**
8. **Check Event Tester:** See `🔔 Event: new_message`?
   - **YES** → Frontend issue (check Step 5)
   - **NO** → Backend issue (check Step 4)
9. **Check browser console:** See all logs from Step 5?
   - **YES** → Message should appear!
   - **NO** → Note which log is missing and troubleshoot that step

---

## 🚀 **Expected Behavior After Fix**

1. Customer sends "Hello" via WhatsApp
2. **Instantly** (< 1 second) message appears in frontend chat
3. No need to refresh or switch rooms
4. Multiple agents see update simultaneously
5. Room list updates with latest message preview
6. Typing indicator works
7. Read receipts update

---

## 📁 **Files Modified for Enhanced Debugging**

1. **`src/hooks/useSocket.ts`**
   - Added `socket.onAny()` to log ALL events
   
2. **`src/hooks/useRealtimeMessages.ts`**
   - Enhanced logging with `fullMessage`
   - Added room join confirmation listener
   
3. **`test-socket-events.html`**
   - Standalone Socket.IO event monitor
   - Can test without frontend app

---

**Next Steps:**
1. Run through Quick Debug Checklist above
2. Identify which step fails
3. Apply solution for that specific issue
4. Report findings with logs for further help
