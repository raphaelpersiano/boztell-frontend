# Backend Fix Required: `/rooms` Endpoint

## 🚨 **Issue**

Frontend getting **HTTP 500 Internal Server Error** when agent tries to fetch rooms.

**Error:**
```
GET http://localhost:8080/rooms?user_id=<agent-uuid>
Response: 500 Internal Server Error
```

---

## 🔍 **Root Cause**

Backend endpoint `/rooms` mungkin:
1. ❌ Tidak support `user_id` query parameter untuk filter rooms by agent
2. ❌ Error di SQL query saat join dengan `room_participants` table
3. ❌ Missing error handling

---

## ✅ **Expected Behavior**

### **For Admin/Supervisor:**
```http
GET /rooms
```
**Should return:** ALL rooms in database

### **For Agent:**
```http
GET /rooms?user_id=<agent-uuid>
```
**Should return:** Only rooms where agent is assigned (in `room_participants` table)

---

## 🛠️ **Backend Fix Required**

### **Option 1: Support `user_id` Query Parameter**

```javascript
// Backend: /routes/rooms.js

router.get('/rooms', async (req, res) => {
  try {
    const { user_id } = req.query;
    
    let query = supabase
      .from('rooms')
      .select(`
        *,
        leads:leads_id (
          id,
          name,
          phone,
          leads_status,
          contact_status
        ),
        room_participants!inner (
          user_id,
          users:user_id (
            id,
            name,
            role
          )
        )
      `)
      .order('updated_at', { ascending: false });
    
    // If user_id provided (agent), filter by assigned rooms
    if (user_id) {
      query = query.eq('room_participants.user_id', user_id);
    }
    
    const { data: rooms, error } = await query;
    
    if (error) {
      console.error('❌ Error fetching rooms:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch rooms',
        error: error.message
      });
    }
    
    // Transform data
    const transformedRooms = rooms.map(room => ({
      room_id: room.id,
      room_phone: room.phone,
      room_title: room.title,
      room_created_at: room.created_at,
      room_updated_at: room.updated_at,
      leads_info: room.leads,
      participants: room.room_participants.map(rp => rp.users),
      last_message: room.last_message,
      last_message_at: room.last_message_at,
      unread_count: room.unread_count || 0
    }));
    
    return res.json({
      success: true,
      data: {
        rooms: transformedRooms,
        total_count: transformedRooms.length
      }
    });
    
  } catch (error) {
    console.error('💥 Exception in /rooms:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
```

---

### **Option 2: Separate Endpoint for Agent Rooms**

```javascript
// GET /rooms/user/:userId - Get rooms for specific agent
router.get('/rooms/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select(`
        *,
        leads:leads_id (*),
        room_participants!inner (
          user_id,
          users:user_id (*)
        )
      `)
      .eq('room_participants.user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) throw error;
    
    return res.json({
      success: true,
      data: { rooms: transformRooms(rooms) }
    });
    
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
```

**Frontend update if using Option 2:**
```typescript
// src/hooks/useRealtimeRooms.ts
let url = `${baseUrl}/rooms`;

if (userRole === 'agent' && userId) {
  url = `${baseUrl}/rooms/user/${userId}`; // Use dedicated endpoint
}
```

---

## 🔍 **Debugging Steps**

### **1. Check Backend Logs**

```bash
cd boztell-backend
npm start
```

Watch for error logs when frontend calls `/rooms?user_id=xxx`

---

### **2. Test Endpoint Manually**

**Test 1: Get All Rooms (Admin/Supervisor)**
```bash
curl http://localhost:8080/rooms
```

**Expected:**
```json
{
  "success": true,
  "data": {
    "rooms": [...]
  }
}
```

**Test 2: Get Agent Rooms**
```bash
curl "http://localhost:8080/rooms?user_id=<agent-uuid>"
```

**Expected:**
```json
{
  "success": true,
  "data": {
    "rooms": [
      // Only rooms where agent is in room_participants
    ]
  }
}
```

---

### **3. Check Database**

```sql
-- Check if agent is assigned to rooms
SELECT 
  r.id as room_id,
  r.phone,
  r.title,
  rp.user_id,
  u.name as agent_name
FROM rooms r
JOIN room_participants rp ON r.id = rp.room_id
JOIN users u ON rp.user_id = u.id
WHERE rp.user_id = '<agent-uuid>';
```

**Expected:** Should return rooms assigned to this agent

---

## 📋 **Checklist untuk Backend Developer**

- [ ] Add `user_id` query parameter support to `/rooms` endpoint
- [ ] Filter rooms by `room_participants.user_id` when parameter provided
- [ ] Add proper error handling with descriptive messages
- [ ] Test with Postman/curl:
  - [ ] `/rooms` returns all rooms
  - [ ] `/rooms?user_id=xxx` returns only agent's rooms
- [ ] Verify SQL join with `room_participants` table works correctly
- [ ] Add logging for debugging:
  ```javascript
  console.log('📚 Fetching rooms for user:', user_id || 'ALL');
  console.log('📊 Query result:', rooms.length, 'rooms found');
  ```

---

## 🎯 **Expected Frontend Behavior After Fix**

### **Admin/Supervisor:**
- ✅ See ALL rooms in database
- ✅ Can switch between All / Unassigned / Assigned tabs

### **Agent:**
- ✅ See only rooms assigned to them (in `room_participants`)
- ✅ Empty list if no rooms assigned
- ✅ No error 500

---

## 🚀 **Quick Workaround (Temporary)**

Jika backend belum fix, gunakan endpoint alternatif yang sudah ada:

```typescript
// src/hooks/useRealtimeRooms.ts

// TEMPORARY WORKAROUND
const fetchRooms = async () => {
  try {
    let url = `${baseUrl}/rooms`;
    
    // Try different endpoint structure
    if (userRole === 'agent' && userId) {
      // Try these alternatives:
      // url = `${baseUrl}/rooms?filter=assigned&user_id=${userId}`;
      // url = `${baseUrl}/agent/rooms/${userId}`;
      // url = `${baseUrl}/users/${userId}/rooms`;
    }
    
    const response = await fetch(url);
    // ... rest of code
  } catch (error) {
    console.error('Error:', error);
  }
};
```

---

**Inform backend team to fix this issue!** 🔧
