# 🆕 New Room Event - Customer Baru Ngechat

## 📋 **Overview**

Saat **customer baru pertama kali** ngechat ke WhatsApp Business number, backend harus:

1. ✅ Check apakah room sudah ada (by phone number)
2. ✅ Jika belum ada, create room baru di database
3. ✅ **Emit Socket.IO event `new_room`** ke SEMUA users (admin/supervisor/agent)
4. ✅ Frontend filter berdasarkan role:
   - **Admin/Supervisor:** Show room baru di list (biar bisa assign agents)
   - **Agent:** SKIP dulu, tunggu `agent_assigned` event

---

## 🎯 **Best Practice: Hybrid Approach**

### **Backend: Emit Global**
```javascript
// Emit ke SEMUA users (no filtering)
io.emit('new_room', {
  id: room.id,
  phone: room.phone,
  title: room.title,
  created_at: room.created_at,
  updated_at: room.updated_at,
});
```

**Why?**
- ✅ Admin/Supervisor perlu lihat SEMUA new rooms untuk assign agents
- ✅ Simpler backend logic (no role checking)
- ✅ Scalable (single broadcast)

---

### **Frontend: Filter by Role**
```typescript
socket.on('new_room', (newRoom) => {
  // ✅ Agent: SKIP (tunggu assignment)
  if (userRole === 'agent') {
    console.log('Agent mode: Room tidak otomatis ditambah');
    return; // SKIP
  }
  
  // ✅ Admin/Supervisor: Add to list
  setRooms(prev => [newRoom, ...prev]);
});
```

**Why?**
- ✅ Agents hanya lihat rooms yang di-assign (via REST API filter `?user_id=xxx`)
- ✅ Agents dapat room via `agent_assigned` event
- ✅ No unauthorized access to unassigned rooms

---

## 🔧 **Backend Implementation**

### **Location: `backend/utils/ensureRoom.js` atau `backend/routes/webhook.js`**

```javascript
/**
 * Ensure room exists for customer phone number
 * If not exists, create and emit new_room event
 */
async function ensureRoom(phone, io) {
  try {
    // Check if room already exists
    const existingRoom = await db.query(
      'SELECT * FROM rooms WHERE phone = $1 LIMIT 1',
      [phone]
    );
    
    if (existingRoom.rows.length > 0) {
      console.log('📨 Room already exists:', existingRoom.rows[0].id);
      return existingRoom.rows[0];
    }
    
    // Room doesn't exist, create new one
    console.log('🆕 Creating new room for:', phone);
    
    const newRoom = await db.query(
      `INSERT INTO rooms (phone, title, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       RETURNING *`,
      [phone, phone] // title = phone by default
    );
    
    const room = newRoom.rows[0];
    
    console.log('✅ New room created:', room.id);
    
    // ✅✅✅ CRITICAL: Emit new_room event via Socket.IO
    if (io) {
      console.log('📡 Emitting new_room event via Socket.IO:', {
        roomId: room.id,
        phone: room.phone,
      });
      
      // Emit globally to ALL connected clients
      io.emit('new_room', {
        id: room.id,
        phone: room.phone,
        title: room.title || room.phone,
        leads_id: room.leads_id || null,
        created_at: room.created_at,
        updated_at: room.updated_at,
      });
      
      console.log('✅ new_room event emitted successfully');
    } else {
      console.error('❌❌❌ Socket.IO not available! new_room event NOT emitted!');
    }
    
    return room;
    
  } catch (error) {
    console.error('❌ Error ensuring room:', error);
    throw error;
  }
}

module.exports = { ensureRoom };
```

---

### **Usage in Webhook Handler**

```javascript
// backend/routes/webhook.js

router.post('/whatsapp', async (req, res) => {
  try {
    const webhookData = req.body;
    
    // Extract customer phone from webhook
    const customerPhone = webhookData.entry[0].changes[0].value.messages[0].from;
    
    // Get Socket.IO instance
    const io = req.app.get('io');
    
    // ✅ Ensure room exists (will emit new_room if creating new)
    const room = await ensureRoom(customerPhone, io);
    
    console.log('📨 Using room:', room.id);
    
    // ... process message, save to database
    
    const message = await saveMessageToDB({
      room_id: room.id,
      content_text: messageText,
      // ... other fields
    });
    
    // Emit new_message event
    io.emit('new_message', {
      id: message.id,
      room_id: room.id,
      content_text: message.content_text,
      created_at: message.created_at,
      // ... other fields
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

### **Agent Assignment Handler**

```javascript
// backend/routes/rooms.js

// Assign agent to room
router.post('/:roomId/assign', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { agent_id } = req.body;
    
    // Insert into room_participants
    await db.query(
      `INSERT INTO room_participants (room_id, user_id, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT DO NOTHING`,
      [roomId, agent_id]
    );
    
    // Get agent info
    const agent = await db.query(
      'SELECT id, name FROM users WHERE id = $1',
      [agent_id]
    );
    
    // ✅ IMPORTANT: Get room data to send with event
    const room = await db.query(
      'SELECT * FROM rooms WHERE id = $1',
      [roomId]
    );
    
    // Emit agent_assigned event
    const io = req.app.get('io');
    io.emit('agent_assigned', {
      room_id: roomId,
      agent_id: agent_id,
      agent_name: agent.rows[0].name,
      assigned_at: new Date().toISOString(),
      // ✅ Include room data so agent can add to their list
      room: {
        id: room.rows[0].id,
        phone: room.rows[0].phone,
        title: room.rows[0].title,
        created_at: room.rows[0].created_at,
        updated_at: room.rows[0].updated_at,
      }
    });
    
    console.log('✅ agent_assigned event emitted');
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Assign error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Unassign agent from room
router.post('/:roomId/unassign', async (req, res) => {
  try {
    const { roomId } = req.params;
    const { agent_id } = req.body;
    
    // Delete from room_participants
    await db.query(
      'DELETE FROM room_participants WHERE room_id = $1 AND user_id = $2',
      [roomId, agent_id]
    );
    
    // Emit agent_unassigned event
    const io = req.app.get('io');
    io.emit('agent_unassigned', {
      room_id: roomId,
      agent_id: agent_id,
    });
    
    console.log('✅ agent_unassigned event emitted');
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('❌ Unassign error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📊 **Complete Flow Diagram**

### **Flow 1: Customer Baru Ngechat**

```
Customer (NEW) sends "Halo" via WhatsApp
    ↓
Meta API Webhook → Backend
    ↓
ensureRoom(phone) - Check room exists?
    ├─→ EXISTS: Use existing room
    └─→ NOT EXISTS: Create new room
        ↓
        INSERT INTO rooms (phone, title, ...)
        ↓
        io.emit('new_room', {...}) [GLOBAL BROADCAST]
        ↓
Frontend receives event
    ├─→ Admin/Supervisor: Add room to TOP of list ✅
    └─→ Agent: SKIP (ignore event) ⏭️
```

### **Flow 2: Supervisor Assign Agent**

```
Supervisor clicks "Assign Agent" button
    ↓
Frontend: POST /rooms/:roomId/assign
    ↓
Backend: INSERT INTO room_participants
    ↓
Backend: io.emit('agent_assigned', {
  room_id: '...',
  agent_id: '...',
  agent_name: '...',
  room: { id, phone, title, ... }  // ✅ Include room data
})
    ↓
Frontend receives event
    ├─→ Assigned Agent: Add room to their list ✅
    │   └─→ Show notification: "🎯 New Assignment"
    └─→ Other users: Update participants list
```

### **Flow 3: Supervisor Unassign Agent**

```
Supervisor clicks "Unassign Agent" button
    ↓
Frontend: POST /rooms/:roomId/unassign
    ↓
Backend: DELETE FROM room_participants
    ↓
Backend: io.emit('agent_unassigned', {
  room_id: '...',
  agent_id: '...'
})
    ↓
Frontend receives event
    ├─→ Unassigned Agent: Remove room from their list ✅
    │   └─→ Show notification: "🚫 Unassigned"
    └─→ Other users: Update participants list
```

---

## 🧪 **Testing**

### **Test 1: Customer Baru (Belum Pernah Chat)**

**Steps:**
1. Pastikan customer phone number **BELUM** ada di table `rooms`
2. Customer kirim message pertama kali ke WA Business number
3. Check backend logs:
   ```
   🆕 Creating new room for: +6281234567890
   ✅ New room created: uuid-123-456-789
   📡 Emitting new_room event via Socket.IO: { roomId: '...', phone: '...' }
   ✅ new_room event emitted successfully
   ```

4. Check frontend console (browser F12):
   ```
   🔔 Socket.IO Event Received: { event: "new_room", ... }
   🆕 NEW ROOM CREATED - Customer baru ngechat! { roomId: '...', phone: '...', ... }
   ✅ Adding new room to TOP of list (WhatsApp-style)
   ```

5. Check frontend UI:
   - ✅ Room muncul **di paling atas** list
   - ✅ Show customer phone number
   - ✅ Unread count = 0 (atau 1 jika ada message)
   - ✅ Browser notification muncul: "💬 New Chat from ..."

---

### **Test 2: Customer Existing (Sudah Pernah Chat)**

**Steps:**
1. Customer phone number **SUDAH ADA** di table `rooms`
2. Customer kirim message lagi
3. Check backend logs:
   ```
   📨 Room already exists: uuid-123-456-789
   ```
   (NO `new_room` event emitted - expected behavior!)

4. Frontend:
   - ✅ Room sudah ada di list
   - ✅ Room move ke top (because of `new_message` event sorting)
   - ✅ Last message updated
   - ✅ Unread count increment

---

## ✅ **Frontend Ready (Already Implemented)**

Frontend **SUDAH SIAP** menerima `new_room` event:

**File: `src/hooks/useRealtimeRooms.ts`**

```typescript
socket.on('new_room', (newRoom) => {
  console.log('🆕 NEW ROOM CREATED - Customer baru ngechat!', newRoom);
  
  const roomData: Room = {
    room_id: newRoom.id,
    room_phone: newRoom.phone,
    room_title: newRoom.title,
    // ... other fields
  };
  
  setRooms(prev => {
    // Check if already exists
    const exists = prev.some(r => r.room_id === newRoom.id);
    if (exists) return prev;
    
    // Add to TOP of list (WhatsApp-style)
    return [roomData, ...prev];
  });
  
  // Show notification
  new Notification('💬 New Chat', {
    body: `New chat from ${newRoom.title || newRoom.phone}`,
  });
  
  // Play sound
  const audio = new Audio('/sounds/new-chat.mp3');
  audio.play();
});
```

---

## 🎯 **Expected Behavior**

### **Scenario: Customer Pertama Kali Chat**

| Time | Action | Backend | Frontend |
|------|--------|---------|----------|
| 0s | Customer send "Halo" via WhatsApp | Webhook received | - |
| 0.1s | Check room exists | SELECT query → NOT FOUND | - |
| 0.2s | Create room | INSERT INTO rooms | - |
| 0.3s | Emit new_room event | `io.emit('new_room', ...)` | - |
| 0.4s | Save message | INSERT INTO messages | - |
| 0.5s | Emit new_message event | `io.emit('new_message', ...)` | - |
| 0.6s | - | - | Receive `new_room` event |
| 0.7s | - | - | Add room to TOP of list |
| 0.8s | - | - | Receive `new_message` event |
| 0.9s | - | - | Update room preview |
| 1.0s | - | - | **Room visible di UI** ✨ |

**Total: ~1 second dari customer send sampai muncul di frontend!**

---

## 🐛 **Troubleshooting**

### **Issue: Room tidak muncul otomatis**

**Check 1: Backend emit event?**
```bash
# Backend logs should show:
📡 Emitting new_room event via Socket.IO
✅ new_room event emitted successfully
```

**If missing:**
- Check `ensureRoom()` function receives `io` parameter
- Check `io` is not null/undefined
- Add emit code (see Implementation section above)

---

**Check 2: Frontend receive event?**
```bash
# Browser console should show:
🔔 Socket.IO Event Received: { event: "new_room", ... }
🆕 NEW ROOM CREATED - Customer baru ngechat!
```

**If missing:**
- Check Socket.IO connected (`✅ Socket connected`)
- Check `socket.on('new_room', ...)` listener registered
- Use Event Tester: `test-socket-events.html`

---

**Check 3: Room added to state?**
```bash
# Browser console should show:
✅ Adding new room to TOP of list (WhatsApp-style)
```

**If missing:**
- Check React state update logic
- Check deduplication (maybe room already exists)
- Check React DevTools → Components → useRealtimeRooms

---

### **Issue: Room muncul tapi BUKAN di paling atas**

**Cause:** Sorting issue

**Check:**
```typescript
// Should add to top with spread operator:
return [roomData, ...prev];  // ✅ Correct (new room first)

// NOT:
return [...prev, roomData];  // ❌ Wrong (new room last)
```

**Already fixed!** Frontend code sudah benar.

---

## 📋 **Backend Checklist**

- [ ] `ensureRoom()` function exists
- [ ] Function checks if room exists by phone
- [ ] Function creates room if not exists
- [ ] Function receives `io` parameter (Socket.IO instance)
- [ ] Emit `io.emit('new_room', {...})` after INSERT
- [ ] Event data includes: `id`, `phone`, `title`, `created_at`, `updated_at`
- [ ] Webhook handler calls `ensureRoom(phone, io)` 
- [ ] Test dengan customer baru kirim message
- [ ] Check logs show "📡 Emitting new_room event"
- [ ] Frontend shows room di paling atas

---

## 🚀 **Expected Final Result**

**Customer baru ngechat:**
1. ✅ Room otomatis create di database
2. ✅ Room muncul **INSTANT** di frontend (< 1 detik)
3. ✅ Room muncul **di paling atas** list (seperti WhatsApp asli)
4. ✅ Show notification: "💬 New Chat from +62812..."
5. ✅ Play sound notification
6. ✅ Agent bisa langsung klik dan reply
7. ✅ Semua agents (yang online) lihat room baru bersamaan

**Seperti WhatsApp sungguhan!** 💬✨

---

**Next Steps:**
1. Implement `ensureRoom()` function di backend (copy code dari atas)
2. Test dengan customer baru kirim message
3. Verify logs di backend dan frontend
4. Confirm room muncul di paling atas

**Frontend SUDAH SIAP!** Tinggal backend emit event `new_room` saja! 🚀
