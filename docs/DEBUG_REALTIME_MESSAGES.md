# 🔍 Debug Real-time Messages Not Appearing

## ❌ **Problem**
Customer kirim pesan → masuk database ✅  
Frontend tidak muncul pesan real-time ❌  
Harus refresh / pindah room baru muncul ❌

---

## 🧪 **Testing Checklist**

### **Test 1: Check Socket.IO Connection**

Open browser console (F12) dan cari log ini:

```
✅ Socket connected: <socket-id>
📨 Joining room for real-time updates: <room-id>
```

**If you see:**
```
❌ Socket connection error: ...
```

➡️ **Backend Socket.IO server belum running!** Lihat `docs/SOCKET_IO_BACKEND_SETUP.md`

---

### **Test 2: Check Backend Emit Event**

**Backend HARUS emit `new_message` event saat customer kirim pesan!**

Cek di backend webhook handler:

```javascript
// backend/routes/webhook.js

router.post('/whatsapp', async (req, res) => {
  try {
    // ... process webhook, save to database
    
    const message = await saveMessageToDB(messageData);
    
    // ✅ CRITICAL: Emit Socket.IO event
    const io = req.app.get('io');
    
    if (!io) {
      console.error('❌ Socket.IO not initialized! Events will not work!');
    } else {
      console.log('📡 Emitting new_message event:', {
        messageId: message.id,
        roomId: message.room_id,
        text: message.content_text
      });
      
      // Emit to all clients (GLOBAL broadcast)
      io.emit('new_message', {
        id: message.id,
        room_id: message.room_id,
        user_id: message.user_id,
        content_type: message.content_type,
        content_text: message.content_text,
        wa_message_id: message.wa_message_id,
        status: message.status,
        created_at: message.created_at,
        updated_at: message.updated_at,
        // ... all message fields
      });
      
      // ALSO emit to specific room (for clients in that room)
      io.to(`room_${message.room_id}`).emit('new_message', message);
      
      console.log('✅ new_message event emitted');
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Expected backend logs when customer sends message:**
```
📡 Emitting new_message event: { messageId: '...', roomId: '...', text: '...' }
✅ new_message event emitted
```

**If you DON'T see these logs:**
➡️ Backend tidak emit event! Tambahkan `io.emit('new_message', ...)` di webhook handler!

---

### **Test 3: Check Frontend Receives Event**

**Open browser console saat customer kirim pesan:**

**Expected logs:**
```
📩 New message received via Socket.IO: {
  messageId: "msg-uuid-123",
  roomId: "room-uuid-456",
  currentRoom: "room-uuid-456",
  contentPreview: "Hello from customer"
}
✅ Message belongs to current room, adding to state
✅ Adding new message to state
```

**If you see:**
```
📩 New message received via Socket.IO: { ... }
ℹ️ Message for different room, ignoring
```
➡️ Frontend joined room yang berbeda, atau `roomId` tidak match!

**If you DON'T see any log:**
➡️ Frontend tidak menerima event! Check backend emit atau Socket.IO connection!

---

## 🔧 **Common Issues & Solutions**

### **Issue 1: Backend tidak emit event**

**Symptoms:**
- Message masuk database ✅
- Frontend tidak dapat real-time update ❌
- No logs `📡 Emitting new_message event` di backend

**Solution:**
Add to webhook handler:
```javascript
const io = req.app.get('io');
io.emit('new_message', messageData);
```

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

### **Issue 3: Frontend tidak join room**

**Symptoms:**
- Backend emit event ✅
- Frontend log: `ℹ️ Message for different room, ignoring`

**Solution:**
Check browser console for:
```
📨 Joining room for real-time updates: <room-id>
```

If missing, check `useRealtimeMessages` is called with correct `roomId`.

---

### **Issue 4: Duplicate messages**

**Symptoms:**
- Message muncul 2x atau 3x di chat

**Cause:**
- Multiple Socket.IO listeners aktif
- Event listener tidak di-cleanup saat unmount

**Solution:**
Already handled in `useRealtimeMessages.ts`:
```typescript
// Deduplication logic
const exists = prev.some(m => 
  m.id === message.id || 
  (m.wa_message_id && m.wa_message_id === message.wa_message_id)
);
if (exists) return prev;
```

And cleanup:
```typescript
return () => {
  socket.off('new_message', handleNewMessage);
};
```

---

## 📊 **Complete Flow Verification**

**1. Customer sends message via WhatsApp**
```
WhatsApp → Meta API → Backend Webhook
```

**2. Backend processes webhook**
```javascript
// backend/routes/webhook.js
POST /webhook/whatsapp
→ Save to database
→ io.emit('new_message', messageData) ✅
```

**3. Socket.IO broadcasts event**
```
Backend Socket.IO Server → All connected clients
```

**4. Frontend receives event**
```typescript
// useRealtimeMessages.ts
socket.on('new_message', handleNewMessage)
→ Check if message.room_id === currentRoomId
→ Add to messages state
→ UI updates automatically
```

**5. UI shows message instantly**
```
React re-renders ChatWindow with new message ✅
```

---

## 🎯 **Quick Debug Steps**

1. **Open browser console (F12)**
2. **Send test message from customer**
3. **Check logs in order:**

```
✅ Socket connected: abc123
📨 Joining room for real-time updates: room-uuid-456
📩 New message received via Socket.IO: { ... }
✅ Message belongs to current room, adding to state
✅ Adding new message to state
```

**If ANY step missing, check that specific component!**

---

## 🚀 **Expected Behavior After Fix**

1. Customer sends "Hello" via WhatsApp
2. **Instantly** (< 1 second) message appears in frontend chat
3. No need to refresh or switch rooms
4. Multiple agents see update simultaneously
5. Room list updates with latest message preview

---

**Next Steps:**
1. Test dengan kirim pesan dari customer WhatsApp
2. Periksa browser console untuk logs di atas
3. Periksa backend logs untuk emit events
4. Report mana step yang gagal untuk troubleshooting lebih lanjut
