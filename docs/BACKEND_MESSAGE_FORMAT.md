# Backend Message Format - Socket.IO Event Emission

## ⚠️ CRITICAL REQUIREMENT

**Backend MUST emit complete message object with ALL fields when emitting `new_message` event.**

Empty payload `{}` will cause frontend validation to reject the message.

---

## Required Event: `new_message`

### Event Name
```javascript
io.emit('new_message', messageObject);
```

### Complete Message Object Structure

```typescript
{
  // ✅ REQUIRED - Database Primary Key
  id: "uuid-string",                    // MUST be present (from database RETURNING *)
  room_id: "uuid-string",               // MUST be present
  
  // ✅ REQUIRED - Message Content
  content_type: "text" | "image" | "video" | "audio" | "voice" | "document" | "sticker" | "location" | "contacts" | "reaction",
  content_text: "message text" | null,  // Caption or text content
  
  // Media Fields (for non-text messages)
  media_type: "image/jpeg" | "video/mp4" | "audio/ogg" | null,
  media_id: "whatsapp-media-id" | null,
  gcs_filename: "filename-in-gcs.jpg" | null,
  gcs_url: "https://storage.googleapis.com/..." | null,
  file_size: 1234567 | null,            // bytes
  mime_type: "image/jpeg" | null,
  original_filename: "photo.jpg" | null,
  
  // WhatsApp Fields
  wa_message_id: "wamid.xxx" | null,
  status: "sent" | "delivered" | "read" | "failed" | null,
  status_timestamp: "2025-01-15T10:30:00Z" | null,
  
  // Metadata (IMPORTANT for special message types)
  metadata: {
    // For location messages
    location?: {
      latitude: -6.2088,
      longitude: 106.8456,
      name: "Monas",
      address: "Jakarta Pusat"
    },
    // For contacts messages
    contacts?: [
      {
        name: { formatted_name: "John Doe" },
        phones: [{ phone: "+6281234567890" }]
      }
    ],
    // Other metadata as needed
  } | null,
  
  // Reply/Reaction Features
  reply_to_wa_message_id: "wamid.xxx" | null,         // If replying to another message
  reaction_emoji: "👍" | null,                         // If this is a reaction
  reaction_to_wa_message_id: "wamid.xxx" | null,      // Which message was reacted to
  
  // User Identification
  user_id: "uuid-string" | null,        // null = from customer, filled = from agent
  
  // Timestamps
  created_at: "2025-01-15T10:30:00Z",
  updated_at: "2025-01-15T10:30:00Z",
  
  // ✅ EXTENDED FIELDS (if available from database JOIN)
  user?: {
    id: "uuid",
    name: "Agent Name",
    email: "agent@example.com",
    role: "agent"
  },
  replied_message?: {
    // Full message object of the message being replied to
    id: "uuid",
    content_type: "text",
    content_text: "Original message",
    user_id: "uuid" | null,
    created_at: "2025-01-15T10:25:00Z"
  }
}
```

---

## Backend Implementation Example

### ❌ WRONG - Empty Payload
```javascript
// This causes frontend validation to fail
io.emit('new_message', {});  // ❌ NEVER DO THIS
```

### ✅ CORRECT - Complete Object

```javascript
// In your WhatsApp webhook handler
async function handleIncomingMessage(webhookData) {
  const { messages, contacts } = webhookData.entry[0].changes[0].value;
  const incomingMessage = messages[0];
  
  // 1. Download media if present
  let gcsUrl = null;
  let gcsFilename = null;
  if (incomingMessage.type !== 'text') {
    const mediaId = incomingMessage[incomingMessage.type]?.id;
    if (mediaId) {
      const mediaData = await downloadWhatsAppMedia(mediaId);
      const uploadResult = await uploadToGCS(mediaData);
      gcsUrl = uploadResult.url;
      gcsFilename = uploadResult.filename;
    }
  }
  
  // 2. Prepare metadata for special message types
  let metadata = null;
  if (incomingMessage.type === 'location') {
    metadata = {
      location: {
        latitude: incomingMessage.location.latitude,
        longitude: incomingMessage.location.longitude,
        name: incomingMessage.location.name,
        address: incomingMessage.location.address
      }
    };
  } else if (incomingMessage.type === 'contacts') {
    metadata = {
      contacts: incomingMessage.contacts
    };
  }
  
  // 3. Insert into database with RETURNING *
  const result = await pool.query(`
    INSERT INTO messages (
      room_id, 
      content_type, 
      content_text, 
      media_type,
      media_id,
      gcs_filename,
      gcs_url,
      file_size,
      mime_type,
      original_filename,
      wa_message_id, 
      status,
      metadata,
      reply_to_wa_message_id,
      user_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *  -- ✅ CRITICAL: Get all fields including 'id'
  `, [
    roomId,
    incomingMessage.type,
    incomingMessage.text?.body || incomingMessage[incomingMessage.type]?.caption,
    incomingMessage[incomingMessage.type]?.mime_type,
    incomingMessage[incomingMessage.type]?.id,
    gcsFilename,
    gcsUrl,
    incomingMessage[incomingMessage.type]?.file_size,
    incomingMessage[incomingMessage.type]?.mime_type,
    incomingMessage[incomingMessage.type]?.filename,
    incomingMessage.id,
    'sent',
    metadata,
    incomingMessage.context?.id, // reply_to
    null // from customer
  ]);
  
  const savedMessage = result.rows[0];
  
  // 4. Optional: Fetch replied message if exists
  if (savedMessage.reply_to_wa_message_id) {
    const repliedResult = await pool.query(
      'SELECT * FROM messages WHERE wa_message_id = $1 LIMIT 1',
      [savedMessage.reply_to_wa_message_id]
    );
    if (repliedResult.rows.length > 0) {
      savedMessage.replied_message = repliedResult.rows[0];
    }
  }
  
  // 5. Emit to Socket.IO with COMPLETE object
  console.log('📡 Emitting new_message event:', {
    id: savedMessage.id,
    room_id: savedMessage.room_id,
    content_type: savedMessage.content_type
  });
  
  io.emit('new_message', savedMessage);  // ✅ COMPLETE OBJECT
  
  // Also emit room-specific event
  io.to(roomId).emit('room:new_message', savedMessage);
}
```

---

## Message Type Examples

### Text Message
```json
{
  "id": "msg-uuid-123",
  "room_id": "room-uuid-456",
  "content_type": "text",
  "content_text": "Hello, I need help!",
  "media_type": null,
  "gcs_url": null,
  "metadata": null,
  "wa_message_id": "wamid.xxx",
  "user_id": null,
  "created_at": "2025-01-15T10:30:00Z"
}
```

### Image with Caption
```json
{
  "id": "msg-uuid-789",
  "room_id": "room-uuid-456",
  "content_type": "image",
  "content_text": "Here's the product photo",
  "media_type": "image/jpeg",
  "gcs_url": "https://storage.googleapis.com/bucket/image.jpg",
  "gcs_filename": "1705315800-image.jpg",
  "file_size": 245678,
  "mime_type": "image/jpeg",
  "original_filename": "product.jpg",
  "wa_message_id": "wamid.yyy",
  "user_id": null,
  "created_at": "2025-01-15T10:31:00Z"
}
```

### Location Message
```json
{
  "id": "msg-uuid-abc",
  "room_id": "room-uuid-456",
  "content_type": "location",
  "content_text": null,
  "metadata": {
    "location": {
      "latitude": -6.2088,
      "longitude": 106.8456,
      "name": "Monas",
      "address": "Jl. Medan Merdeka, Jakarta Pusat"
    }
  },
  "wa_message_id": "wamid.zzz",
  "user_id": null,
  "created_at": "2025-01-15T10:32:00Z"
}
```

### Reply Message
```json
{
  "id": "msg-uuid-def",
  "room_id": "room-uuid-456",
  "content_type": "text",
  "content_text": "Yes, I can help with that!",
  "reply_to_wa_message_id": "wamid.xxx",
  "replied_message": {
    "id": "msg-uuid-123",
    "content_type": "text",
    "content_text": "Hello, I need help!",
    "user_id": null,
    "created_at": "2025-01-15T10:30:00Z"
  },
  "wa_message_id": "wamid.aaa",
  "user_id": "agent-uuid-111",
  "created_at": "2025-01-15T10:33:00Z"
}
```

### Reaction Message
```json
{
  "id": "msg-uuid-ghi",
  "room_id": "room-uuid-456",
  "content_type": "reaction",
  "reaction_emoji": "👍",
  "reaction_to_wa_message_id": "wamid.xxx",
  "wa_message_id": "wamid.bbb",
  "user_id": null,
  "created_at": "2025-01-15T10:34:00Z"
}
```

---

## Frontend Validation Checks

Frontend will **REJECT** messages that:
1. ❌ Don't have `id` field
2. ❌ Don't have `room_id` field
3. ❌ Have empty payload `{}`

Frontend will log errors like:
```
❌ Received message without id: { }
❌ Received message without room_id: { id: '...' }
```

---

## Testing Checklist

### Step 1: Check Database Query
```sql
-- Ensure your INSERT query returns all fields
INSERT INTO messages (...) VALUES (...)
RETURNING *;  -- ✅ Must include this
```

### Step 2: Check Backend Logs
```javascript
console.log('📡 Emitting new_message event:', savedMessage);
// Should show: { id: 'uuid', room_id: 'uuid', content_type: 'text', ... }
// NOT: {}
```

### Step 3: Test with Socket.IO Event Monitor
Open `test-socket-events.html` in browser:
1. Connect to Socket.IO server
2. Join room
3. Send WhatsApp message from customer
4. Check "All Events" section - should see:
```json
{
  "event": "new_message",
  "data": {
    "id": "msg-uuid-123",  // ✅ Present
    "room_id": "room-uuid",  // ✅ Present
    "content_type": "text",
    "content_text": "Test message"
  }
}
```

### Step 4: Test All Message Types
- [ ] Text message
- [ ] Image with caption
- [ ] Video
- [ ] Audio/Voice
- [ ] Document (PDF, DOCX, etc.)
- [ ] Sticker
- [ ] Location
- [ ] Contacts
- [ ] Reply to message
- [ ] Reaction to message

---

## Common Backend Mistakes

### 1. Empty Emit
```javascript
// ❌ WRONG
io.emit('new_message', {});
```

### 2. Missing RETURNING Clause
```javascript
// ❌ WRONG - id will be undefined
const result = await pool.query(`
  INSERT INTO messages (...) VALUES (...)
`);
const savedMessage = { ...values }; // Missing id from database
io.emit('new_message', savedMessage);
```

### 3. Not Handling Media Downloads
```javascript
// ❌ WRONG - gcs_url will be null
if (incomingMessage.type === 'image') {
  // Missing: download from WhatsApp + upload to GCS
  const savedMessage = await saveMessage({
    content_type: 'image',
    gcs_url: null  // ❌ Should have downloaded media
  });
}
```

### 4. Missing Metadata for Special Types
```javascript
// ❌ WRONG - location data lost
if (incomingMessage.type === 'location') {
  const savedMessage = await saveMessage({
    content_type: 'location',
    metadata: null  // ❌ Should include location coordinates
  });
}
```

---

## Quick Fix Prompt for Backend Developer

**If you see `❌ Received message without id: {}` in frontend logs:**

```
Backend checklist:
1. Add RETURNING * to your INSERT query
2. Verify savedMessage object has 'id' field before emitting
3. Check io.emit() receives complete object, not empty {}
4. Test with console.log before emit: console.log('Emitting:', savedMessage)
5. For media messages, ensure gcs_url is populated after download/upload
6. For location/contacts, ensure metadata field is populated
```

---

## Related Documentation

- `NEW_ROOM_EVENT.md` - new_room, agent_assigned, agent_unassigned events
- `REALTIME_FIXED.md` - Complete real-time integration guide
- `DEBUG_REALTIME_COMPLETE.md` - Troubleshooting guide
- WhatsApp Business API: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components
