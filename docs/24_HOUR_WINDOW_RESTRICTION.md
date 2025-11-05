# 24-Hour Messaging Window Restriction

## Overview
Implementasi pembatasan pengiriman pesan sesuai dengan WhatsApp Business API policy yang membatasi pengiriman pesan ke customer hanya dalam window 24 jam sejak pesan terakhir dari customer.

## WhatsApp Business Policy
WhatsApp Business API memiliki aturan:
- **24-Hour Window**: Bisnis dapat mengirim message jenis apapun dalam 24 jam setelah customer mengirim pesan terakhir
- **After 24 Hours**: Bisnis hanya bisa mengirim **Template Messages** yang sudah diapprove oleh WhatsApp

## Implementation

### 1. ChatWindow Component Updates

#### Props Added
```typescript
interface ChatWindowProps {
  // ... existing props
  lastMessageAt?: string; // ISO timestamp dari last_message_at room
}
```

#### 24-Hour Check Logic
```typescript
const is24HourWindowExpired = React.useMemo(() => {
  if (!lastMessageAt) return false;
  
  const lastMessageTime = new Date(lastMessageAt).getTime();
  const now = Date.now();
  const hoursDiff = (now - lastMessageTime) / (1000 * 60 * 60);
  
  return hoursDiff > 24;
}, [lastMessageAt]);
```

#### Blocked Actions
Ketika `is24HourWindowExpired === true`, semua action berikut di-block:
- ✅ Text messages (`handleSendMessage`)
- ✅ Media files (`handleFileSelect` - image, video, document, audio)
- ✅ Voice notes (`startVoiceRecording`)
- ✅ Location sharing (`handleSendLocation`)
- ✅ Contact sharing (`handleSendContact`)

#### UI Changes When Expired
1. **Warning Banner** ditampilkan di atas input area:
   ```tsx
   {is24HourWindowExpired && (
     <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
       <Info className="h-5 w-5 text-amber-600" />
       <p>24-hour messaging window expired</p>
       <p className="text-xs">
         You can only send approved template messages. 
         Regular messages, media, and voice notes are disabled.
       </p>
     </div>
   )}
   ```

2. **Input Elements Disabled**:
   - Textarea: `disabled={... || is24HourWindowExpired}`
   - Placeholder berubah: "24-hour window expired - use template message"
   - Send button disabled
   - Mic button disabled
   - Attachment button disabled

3. **Alert Messages** ketika user coba kirim:
   - "Cannot send message: 24-hour messaging window has expired. Please use a template message."
   - "Cannot send media: 24-hour messaging window has expired. Please use a template message."
   - "Cannot send voice note: 24-hour messaging window has expired. Please use a template message."

### 2. Parent Component Updates (chat/page.tsx)

Pass `lastMessageAt` dari room data ke ChatWindow:
```typescript
<ChatWindow
  roomId={selectedRoomId}
  userId={user?.id || ''}
  customerPhone={selectedRoom?.room_phone || undefined}
  roomTitle={selectedRoom?.room_title || undefined}
  lastMessageAt={selectedRoom?.last_message_at || undefined}
  onShowLeadPopup={() => setShowLeadPopup(true)}
/>
```

## Data Flow

```
Backend Database (rooms table)
  └─ last_message_at (timestamp)
       ↓
useRealtimeRooms hook
  └─ rooms array with room.last_message_at
       ↓
chat/page.tsx
  └─ selectedRoom.last_message_at
       ↓
ChatWindow component
  └─ is24HourWindowExpired calculation
       ↓
UI: Warning + Disabled inputs
Action handlers: Early return with alert
```

## Testing Scenarios

### Scenario 1: Fresh Conversation (< 24 hours)
- **Condition**: `last_message_at` adalah 2 jam yang lalu
- **Expected**: Semua input enabled, user bisa kirim message jenis apapun
- **UI**: Normal, no warning banner

### Scenario 2: Expired Window (> 24 hours)
- **Condition**: `last_message_at` adalah 25 jam yang lalu
- **Expected**: 
  - Warning banner muncul
  - Input disabled dengan placeholder khusus
  - All send buttons disabled
  - Attachment menu button disabled
  - Alert muncul jika user coba force send
- **UI**: Amber warning banner + grayed out inputs

### Scenario 3: No Last Message
- **Condition**: `lastMessageAt` undefined/null (new room)
- **Expected**: Treated as **not expired** (default allow)
- **Reason**: New rooms should allow first message from agent

### Scenario 4: Just Expired (exactly 24h or 24.1h)
- **Condition**: `hoursDiff > 24` (e.g., 24.1 hours)
- **Expected**: Window considered expired
- **UI**: Restrictions applied

## Future Enhancements

### 1. Template Message Support
- [ ] Add "Send Template" button that remains enabled
- [ ] Template selector UI
- [ ] Integration dengan WhatsApp Template API
- [ ] Preview template sebelum send

### 2. Visual Countdown
- [ ] Tampilkan countdown timer: "23h 45m remaining"
- [ ] Color-coded warning:
  - Green: > 20 hours remaining
  - Yellow: 12-20 hours remaining
  - Orange: 1-12 hours remaining
  - Red: < 1 hour remaining
  - Gray: Expired

### 3. Backend Integration
- [ ] Backend validation untuk enforce policy
- [ ] Reject non-template messages jika expired
- [ ] Return proper error response
- [ ] Audit log untuk compliance

### 4. Smart Notifications
- [ ] Notify agents when window about to expire (1 hour warning)
- [ ] Suggest proactive template messages
- [ ] Dashboard widget showing rooms approaching expiration

## Technical Notes

### Performance
- `is24HourWindowExpired` uses `React.useMemo()` untuk avoid recalculation setiap render
- Dependency: `[lastMessageAt]` - hanya recalculate ketika timestamp berubah

### Edge Cases Handled
1. **No lastMessageAt**: Default to `false` (allow messages)
2. **Invalid date**: Will result in `NaN`, safely handled by `> 24` check
3. **Future date**: Would result in negative hours, safely handled by `> 24` check

### Type Safety
- `lastMessageAt` adalah optional prop (`lastMessageAt?: string`)
- Safe to undefined/null checks before calculation

## Compliance
Fitur ini membantu memastikan compliance dengan WhatsApp Business API Terms of Service untuk menghindari:
- Account suspension
- API rate limiting
- Quality rating reduction

## Related Files
- `src/components/chat/ChatWindow.tsx` - Main implementation
- `src/app/chat/page.tsx` - Props passing
- `src/hooks/useRealtimeRooms.ts` - Room data source
- Database: `rooms.last_message_at` field
