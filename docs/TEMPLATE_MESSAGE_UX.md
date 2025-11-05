# Template Message UX - Instant Feedback

## Problem
Setelah mengirim template message, user tidak melihat instant feedback seperti ketika mengirim regular message:
- Template message tidak langsung muncul di chat window
- Room tidak naik ke atas di sidebar
- Experience berbeda dengan regular message (yang ada optimistic UI)

## Root Cause Analysis

### Regular Message Flow (Fast UX ✅)
```
User clicks Send
  ↓
Optimistic UI: Message langsung muncul (gray)
  ↓
API call: POST /messages/send
  ↓
Backend saves to DB + emit socket 'new_message' event
  ↓
Frontend receives socket event
  ↓
Message confirmed (blue checkmark)
  ↓
Room auto-sorted to top via socket event handler
```

### Template Message Flow (Slow UX ❌ - Before Fix)
```
User clicks Send Template
  ↓
Modal shows loading...
  ↓
API call: POST /messages/send-template
  ↓
Backend saves to DB (+ emit socket event?)
  ↓
Modal closes
  ↓
User waits... (no feedback)
  ↓
Eventually socket event arrives (if backend emits it)
  ↓
Room updates
```

**Problem**: No optimistic UI, modal blocks view, unclear if template sent

## Solution Implemented

### 1. Immediate Refetch After Template Send
```typescript
const handleNewChatSuccess = (roomId: string) => {
  setShowNewChatModal(false);
  setShowTemplateModal(false);
  
  // ✅ Trigger immediate refetch
  refetchRooms();
  
  // ✅ Auto-select room with small delay for refetch to complete
  if (roomId) {
    setTimeout(() => {
      setSelectedRoomId(roomId);
    }, 100);
  }
};
```

**Why this works**:
- `refetchRooms()` immediately fetches latest room list from backend
- Backend has already saved template message to DB
- Refetch will show updated `last_message` and `last_message_at`
- Room auto-sorts to top based on `last_message_at` timestamp

### 2. Backend Socket Event Handling

Backend MUST emit socket events after template send:

```javascript
// In POST /messages/send-template route
async function sendTemplate(req, res) {
  // ... save template message to DB ...
  
  // ✅ CRITICAL: Emit socket event for real-time UI update
  io.emit('new_message', {
    id: message.id,
    room_id: message.room_id,
    user_id: message.user_id,
    content_type: 'text',
    content_text: '[Template] ' + templateName,
    created_at: message.created_at,
  });
  
  // ✅ Also emit to specific room
  io.to(`room_${message.room_id}`).emit('new_message', {
    id: message.id,
    room_id: message.room_id,
    user_id: message.user_id,
    content_type: 'text',
    content_text: messageText,
    created_at: message.created_at,
  });
  
  res.json({ success: true, database_saved: { ... } });
}
```

### 3. Frontend Socket Event Listener

Already implemented in `useRealtimeRooms.ts`:

```typescript
socket.on('new_message', (message) => {
  console.log('📩 New message in room:', message.room_id);
  
  setRooms(prev => {
    // Update room preview
    const updated = prev.map(room => {
      if (room.room_id === message.room_id) {
        return {
          ...room,
          last_message: message.content_text || '[Media]',
          last_message_at: message.created_at,
          unread_count: message.user_id === null 
            ? (room.unread_count || 0) + 1 
            : room.unread_count,
        };
      }
      return room;
    });
    
    // ✅ Auto-sort by latest message (WhatsApp-like)
    return updated.sort((a, b) => {
      const dateA = new Date(a.last_message_at || a.room_updated_at).getTime();
      const dateB = new Date(b.last_message_at || b.room_updated_at).getTime();
      return dateB - dateA;
    });
  });
});
```

## Updated Template Message Flow (Fast UX ✅)

```
User clicks Send Template
  ↓
Modal shows loading (with spinner)
  ↓
API call: POST /messages/send-template
  ↓
✅ Backend saves to DB
  ↓
✅ Backend emits socket 'new_message' event
  ↓
✅ Response returns with room_id
  ↓
✅ Frontend calls refetchRooms() (immediate sync)
  ↓
✅ Modal closes
  ↓
✅ Room auto-selected (if room_id available)
  ↓
PARALLEL:
├─ Refetch completes → Room appears with updated data
└─ Socket event arrives → Room confirmed and re-sorted

Result: Room instantly appears at top with template message preview
```

## User Experience Goals

### ✅ Achieved
1. **Speed**: Template message experience matches regular message
2. **Feedback**: User sees room update immediately after send
3. **Consistency**: Same sorting behavior (room to top)
4. **Reliability**: Works even if socket event delayed (refetch backup)

### 🎯 Optional Enhancement (Future)
Add optimistic UI for template messages (like regular messages):
```typescript
// Before API call
const optimisticMessage = {
  id: `temp-${Date.now()}`,
  content_text: '[Sending template...]',
  status: 'sending',
};
// Add to messages immediately
// Replace with real message when API responds
```

## Testing Scenarios

### Test 1: New Room Template
1. ✅ Click "New Chat" from sidebar
2. ✅ Enter phone number and select template
3. ✅ Click "Send Template"
4. ✅ Modal closes immediately
5. ✅ New room appears at TOP of list within 1 second
6. ✅ Room auto-selected
7. ✅ Template message visible in chat window

### Test 2: Existing Room Template (< 24h)
1. ✅ Open existing room
2. ✅ Click "Send Template" button in header
3. ✅ Select template and send
4. ✅ Modal closes immediately
5. ✅ Room stays selected
6. ✅ Room moves to TOP of sidebar list
7. ✅ Template message appears in chat

### Test 3: Expired Room Template (> 24h)
1. ✅ Open room with 24h window expired
2. ✅ See warning banner and disabled inputs
3. ✅ Click "Send Template" button (only available action)
4. ✅ Modal opens with phone pre-filled
5. ✅ Send template
6. ✅ Modal closes
7. ✅ Room moves to TOP
8. ✅ Template message appears
9. ✅ 24h window reopened (if customer replies)

### Test 4: Slow Network
1. ✅ Simulate slow 3G connection
2. ✅ Send template
3. ✅ Modal shows loading state (not frozen)
4. ✅ Room appears when API responds (even if 2-3 seconds)
5. ✅ No duplicate rooms

## Performance Optimization

### Refetch Debouncing
If multiple templates sent quickly:
```typescript
// Prevent multiple refetches in short time
const debouncedRefetch = useCallback(
  debounce(() => refetchRooms(), 500),
  []
);
```

### Socket Event Deduplication
Already handled in `useRealtimeRooms`:
```typescript
// Check if room already exists before adding
const exists = prev.some(r => r.room_id === newRoom.id);
if (exists) {
  console.log('⚠️ Room already exists, skipping');
  return prev;
}
```

## Backend Requirements Checklist

For template message to work seamlessly:

- [ ] ✅ POST /messages/send-template saves to `messages` table
- [ ] ✅ Updates `rooms.last_message` and `rooms.last_message_at`
- [ ] ✅ Returns `room_id` in response
- [ ] ✅ Emits `io.emit('new_message', {...})` after save
- [ ] ✅ Emits `io.to(room_${room_id}).emit('new_message', {...})` to specific room
- [ ] ✅ If new room: Also emits `io.emit('new_room', {...})`

## Troubleshooting

### Room doesn't appear after template send
**Possible causes**:
1. Backend not emitting socket event → Check backend logs
2. Socket connection disconnected → Check `isConnected` state
3. Refetch failed → Check network tab for /rooms API call
4. Room_id not returned → Check API response format

**Solution**:
- Check console logs for `📤 Sending template message...`
- Verify `✅ Template sent successfully` appears
- Check if `refetchRooms()` is called
- Verify socket connection status

### Room appears but not at top
**Possible causes**:
1. `last_message_at` not updated in backend
2. Sorting logic not triggered

**Solution**:
- Verify backend updates `rooms.last_message_at` field
- Check socket event has `created_at` timestamp
- Ensure `new_message` event triggers room sort

### Template message not visible in chat
**Possible causes**:
1. Message not saved to database
2. Room not auto-selected
3. Message fetch not triggered

**Solution**:
- Verify `selectedRoomId` is set correctly
- Check if `useRealtimeMessages` hook is fetching messages
- Ensure room_id matches between API response and selection

## Related Files
- `src/components/chat/NewChatModal.tsx` - Template send logic with logging
- `src/app/chat/page.tsx` - Refetch trigger on success
- `src/hooks/useRealtimeRooms.ts` - Socket event listeners and room sorting
- `src/hooks/useRealtimeMessages.ts` - Message fetching and display
- Backend: `POST /messages/send-template` route (must emit socket events)

## Success Metrics

The implementation is successful when:
- ✅ Template message UX feels identical to regular message UX
- ✅ Room appears at top immediately (< 1 second)
- ✅ No manual refresh needed
- ✅ Works reliably even with slow network
- ✅ Clear loading states and error handling
