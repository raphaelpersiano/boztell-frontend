# Frontend API Integration - UPDATED TO MATCH BACKEND

**Date**: October 20, 2025  
**Status**: ✅ COMPLETE - Aligned with MESSAGES_API_DOCUMENTATION.md

---

## 🔧 CRITICAL CHANGES MADE

### 1. API Endpoint Paths Fixed

**BEFORE (WRONG)**:
```typescript
POST /api/messages/send
POST /api/messages/send-media
POST /api/rooms/${roomId}/read
```

**AFTER (CORRECT - matches backend)**:
```typescript
POST /messages/send
POST /messages/send-template
POST /messages/send-contacts
POST /messages/send-location
POST /messages/send-reaction
POST /messages/send-media-combined
GET  /messages/templates
GET  /messages/verify/{messageId}
```

---

### 2. Send Message Payload Fixed

**BEFORE (WRONG)**:
```typescript
// ❌ Frontend was sending
{
  room_id: "room-123",
  content_text: "Hello",
  user_id: "uuid"
}
```

**AFTER (CORRECT - matches backend)**:
```typescript
// ✅ Now sending
{
  to: "6287879565390",    // Phone number
  text: "Hello",          // Message text
  type: "text",           // Message type
  user_id: "uuid",        // Optional: agent ID
  replyTo: "wamid.xxx"    // Optional: reply to message
}
```

---

### 3. New API Methods Added

Based on MESSAGES_API_DOCUMENTATION.md, added these new methods to `src/lib/api.ts`:

#### ✅ `sendMessage()`
```typescript
ApiService.sendMessage({
  to: "6287879565390",
  text: "Hello from agent!",
  user_id: "agent-uuid",
  replyTo: "wamid.xxx" // optional
})
```

#### ✅ `sendTemplate()`
```typescript
ApiService.sendTemplate({
  to: "6287879565390",
  templateName: "hello_world",
  languageCode: "en_US",
  parameters: ["John", "Premium"],
  user_id: "agent-uuid"
})
```

#### ✅ `sendContacts()`
```typescript
ApiService.sendContacts({
  to: "6287879565390",
  contacts: [{
    name: { first_name: "John", last_name: "Doe" },
    phones: [{ phone: "+1234567890", type: "MOBILE" }],
    emails: [{ email: "john@example.com", type: "WORK" }]
  }],
  user_id: "agent-uuid"
})
```

#### ✅ `sendLocation()`
```typescript
ApiService.sendLocation({
  to: "6287879565390",
  location: {
    latitude: -6.200000,
    longitude: 106.816666,
    name: "Jakarta",
    address: "Jakarta, Indonesia"
  },
  user_id: "agent-uuid"
})
```

#### ✅ `sendReaction()`
```typescript
ApiService.sendReaction({
  to: "6287879565390",
  message_id: "wamid.xxx",
  emoji: "👍",
  user_id: "agent-uuid"
})
```

#### ✅ `sendMediaCombined()`
```typescript
const file = document.querySelector('input[type="file"]').files[0];

ApiService.sendMediaCombined({
  media: file,
  to: "6287879565390",
  caption: "Check this image!",
  user_id: "agent-uuid"
})
```

Supported media types:
- **Image**: `image/jpeg`, `image/png`, `image/webp`
- **Video**: `video/mp4`, `video/3gpp`
- **Audio**: `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/amr`, `audio/ogg`
- **Document**: `application/pdf`, `application/msword`, etc.

#### ✅ `getTemplates()`
```typescript
const templates = await ApiService.getTemplates();
// Returns list of approved WhatsApp templates
```

#### ✅ `verifyMessage()`
```typescript
const result = await ApiService.verifyMessage("message-uuid");
// Verify if message was saved in database
```

---

### 4. ChatWindowWithRealtime Component Updated

**Key Changes**:

1. **Phone Number Resolution**:
   - Added `customerPhone` optional prop
   - Auto-fetches phone from room or lead if not provided
   - Validates phone number before sending

2. **Send Message Logic**:
```typescript
// ✅ NEW - uses correct backend API format
const handleSendMessage = async () => {
  const phoneToSend = roomPhone || customerPhone;
  
  if (!phoneToSend) {
    alert('Cannot send message: Customer phone number not available');
    return;
  }

  await ApiService.sendMessage({
    to: phoneToSend,      // Phone number
    text: messageText,    // Message text
    user_id: userId,      // Agent ID
  });
};
```

3. **Better Error Handling**:
```typescript
// Detects backend connectivity issues
if (error.message?.includes('connect')) {
  alert('Backend API is not running. Please start Express.js server at localhost:8080');
}
```

---

## 📋 IMPLEMENTATION CHECKLIST

### API Service (src/lib/api.ts)
- [x] Change endpoint paths from `/api/*` to `/*`
- [x] Update `sendMessage()` to use `{to, text, type, user_id}`
- [x] Add `sendTemplate()` method
- [x] Add `sendContacts()` method
- [x] Add `sendLocation()` method
- [x] Add `sendReaction()` method
- [x] Add `sendMediaCombined()` method (replaces sendMediaMessage)
- [x] Add `getTemplates()` method
- [x] Add `verifyMessage()` method
- [x] Update `markRoomAsRead()` with graceful fallback (not in backend docs)

### Components
- [x] Update `ChatWindowWithRealtime.tsx` to use new API format
- [x] Add phone number resolution logic
- [x] Add proper error handling for backend connectivity
- [x] Import supabase client for room/lead queries

---

## 🎯 USAGE EXAMPLES

### Send Simple Text Message
```typescript
await ApiService.sendMessage({
  to: "6287879565390",
  text: "Hello customer!",
  user_id: "d19273b4-e459-4808-ae5a-cf7ec97ef143"
});
```

### Send Template Message
```typescript
await ApiService.sendTemplate({
  to: "6287879565390",
  templateName: "welcome_message",
  languageCode: "en_US",
  parameters: ["John Doe", "Premium Package"],
  user_id: "agent-uuid"
});
```

### Send Image with Caption
```typescript
const file = fileInput.files[0];

await ApiService.sendMediaCombined({
  media: file,
  to: "6287879565390",
  caption: "Your invoice is ready!",
  user_id: "agent-uuid"
});
```

### React to Customer Message
```typescript
await ApiService.sendReaction({
  to: "6287879565390",
  message_id: "wamid.HBgNNjI4Nzg3OTU2NTM5MBUCABEYEjQ4RDVBNExxxxx",
  emoji: "👍",
  user_id: "agent-uuid"
});
```

---

## 🔍 FIELD MAPPING REFERENCE

### Message Direction Indicator

```typescript
// Backend uses user_id to determine message direction:
user_id: null       // ← Message FROM customer
user_id: "uuid"     // ← Message FROM agent (you)
```

### WhatsApp Message IDs

```typescript
// Backend tracks multiple IDs:
wa_message_id                // WhatsApp's original message ID
reply_to_wa_message_id       // For replies
reaction_to_wa_message_id    // For reactions
```

### Caption Handling (Media)

- **Image & Video**: Caption appears in WhatsApp
- **Audio**: Caption ignored (not supported by WhatsApp)
- **Document**: Caption sent as separate text message automatically

---

## ⚠️ IMPORTANT NOTES

### 1. Phone Number Format
```typescript
// ✅ CORRECT
to: "6287879565390"     // No + prefix, international format

// ❌ WRONG
to: "+62 878 7956 5390" // No + or spaces
to: "0878 7956 5390"    // No leading 0
```

### 2. Backend Server Required
```bash
# Backend must be running at:
http://localhost:8080

# Check .env.local:
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 3. Supabase Realtime
Frontend still uses **Supabase direct queries** for:
- ✅ Viewing rooms
- ✅ Viewing messages
- ✅ Realtime updates
- ✅ Lead data

But uses **Backend API** for:
- 📤 Sending messages (WhatsApp Business API integration)
- 📤 Uploading media (Google Cloud Storage)
- 📤 Template messages (WhatsApp approved templates)

---

## 🚀 TESTING CHECKLIST

- [ ] Start backend server: `npm run dev` (in backend repo)
- [ ] Verify backend at: http://localhost:8080
- [ ] Test send text message from chat UI
- [ ] Test error message when backend offline
- [ ] Test phone number resolution from room/lead
- [ ] Verify message appears in Supabase after sending
- [ ] Test media upload (image, video, document)
- [ ] Test template messages (if templates configured)

---

## 📚 RELATED DOCUMENTATION

1. **MESSAGES_API_DOCUMENTATION.md** - Complete backend API reference
2. **INTEGRATION_COMPLETE.md** - Supabase Realtime integration status
3. **DATABASE_SCHEMA_ALIGNMENT.md** - Database schema verification
4. **.env.local** - Environment variables configuration

---

## ✅ STATUS SUMMARY

**Frontend API Integration**: ✅ COMPLETE  
**Backend API Alignment**: ✅ 100% MATCHED  
**Component Updates**: ✅ COMPLETE  
**Error Handling**: ✅ GRACEFUL  
**Phone Resolution**: ✅ AUTOMATIC  

**READY FOR TESTING** 🎉
