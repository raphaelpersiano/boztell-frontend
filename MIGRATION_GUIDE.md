# Migration Guide: Mock Data → Supabase Realtime

## 📋 Checklist Migrasi

### 1. ✅ Setup Supabase
- [x] Install `@supabase/supabase-js`
- [x] Create `.env.local` dengan Supabase credentials
- [x] Setup Supabase client (`src/lib/supabase.ts`)

### 2. ✅ Update Types
- [x] Align types dengan database schema (`src/types/index.ts`, `src/types/database.ts`)
- [x] Add extended fields (lead, last_message, unread_count)

### 3. ✅ Create Custom Hooks
- [x] `useRooms` - Real-time room list dengan auto-sort
- [x] `useMessages` - Real-time messages dalam room
- [x] `useMessageStatus` - Track message status
- [x] `useLead` - Lead information
- [x] `useRoomAccess` - Role-based access control

### 4. ✅ Update API Layer
- [x] Add message endpoints (send, react, mark as read)
- [x] Add room endpoints (create, update, assign agent)
- [x] Add lead endpoints (create, update, search)

### 5. ✅ Create New Components
- [x] `LeadManagementPopup` - Create/edit leads dan room title

### 6. ⏳ Update Existing Components (Manual Steps Required)

#### ChatSidebar.tsx
**Current**: Uses props `rooms: ChatRoom[]`  
**New**: Uses `useRooms(userId, userRole)` hook

**Changes needed**:
```typescript
// Before
interface ChatSidebarProps {
  rooms: ChatRoom[];
  selectedRoomId?: string;
  onRoomSelect: (roomId: string) => void;
  userRole: 'admin' | 'supervisor' | 'agent';
}

// After
interface ChatSidebarProps {
  selectedRoomId?: string;
  onRoomSelect: (roomId: string) => void;
  userId: string;  // ← Add this
  userRole: 'admin' | 'supervisor' | 'agent';
}

// In component
const { rooms, loading, error } = useRooms(userId, userRole);
```

**Reference**: See `SUPABASE_REALTIME_INTEGRATION.md` section "ChatSidebar"

#### ChatWindow.tsx
**Current**: Uses props `room: ChatRoom`, `messages: Message[]`  
**New**: Uses `useMessages(roomId)` and `useLead(leadId)` hooks

**Changes needed**:
```typescript
// Before
interface ChatWindowProps {
  room: ChatRoom;
  messages: Message[];
  onSendMessage: (content: string) => void;
}

// After  
interface ChatWindowProps {
  roomId: string;
  userId: string;
  onClose?: () => void;
}

// In component
const { messages, loading } = useMessages(roomId);
const { lead } = useLead(room?.leads_id);
const [showLeadPopup, setShowLeadPopup] = useState(false);

// Send message via API
const handleSend = async (text: string) => {
  await ApiService.sendMessage({
    room_id: roomId,
    content_text: text,
    user_id: userId,
  });
  // Message will auto-appear via realtime subscription
};
```

#### src/app/chat/page.tsx
**Current**: Uses mock data  
**New**: Minimal props, hooks handle data

**Changes needed**:
```typescript
'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { LeadManagementPopup } from '@/components/chat/LeadManagementPopup';

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showLeadPopup, setShowLeadPopup] = useState(false);

  if (!user) {
    return <div>Please login</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <ChatSidebar
        selectedRoomId={selectedRoomId}
        onRoomSelect={setSelectedRoomId}
        userId={user.id}
        userRole={user.role as 'admin' | 'supervisor' | 'agent'}
      />
      
      {selectedRoomId ? (
        <div className="flex-1 flex flex-col">
          <ChatWindow
            roomId={selectedRoomId}
            userId={user.id}
            onShowLeadPopup={() => setShowLeadPopup(true)}
          />
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              No chat selected
            </h2>
            <p className="text-gray-500">
              Choose a conversation to start messaging
            </p>
          </div>
        </div>
      )}

      {showLeadPopup && selectedRoomId && (
        <LeadManagementPopup
          roomId={selectedRoomId}
          isOpen={showLeadPopup}
          onClose={() => setShowLeadPopup(false)}
          onSave={() => {
            // Auto-refresh handled by realtime hooks
            setShowLeadPopup(false);
          }}
        />
      )}
    </div>
  );
}
```

## 🔧 Backend Requirements (Express.js)

Pastikan Express backend sudah handle:

### 1. WhatsApp Webhooks
```javascript
// POST /api/webhooks/whatsapp
// Receives messages from WhatsApp
// Inserts to Supabase messages table
```

### 2. Message Endpoints
```javascript
POST /api/messages/send
POST /api/messages/send-media
POST /api/messages/reaction
POST /api/messages/:id/read
POST /api/rooms/:id/read
```

### 3. Room Endpoints
```javascript
POST /api/rooms
PATCH /api/rooms/:id
POST /api/rooms/:id/assign
POST /api/rooms/:id/unassign
```

### 4. Lead Endpoints
```javascript
POST /api/leads
PATCH /api/leads/:id
GET /api/leads/:id
GET /api/leads/search?phone=xxx
```

## 🔒 Supabase Configuration

### 1. Enable Realtime
Di Supabase Dashboard → Database → Replication:
- ✅ Enable realtime for `rooms`
- ✅ Enable realtime for `messages`
- ✅ Enable realtime for `message_status_history`
- ✅ Enable realtime for `leads`
- ✅ Enable realtime for `room_participants`

### 2. Row Level Security (RLS)

```sql
-- Example RLS policy for rooms (adjust as needed)
CREATE POLICY "Users can view rooms they have access to"
ON rooms FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM room_participants WHERE room_id = id
  )
  OR
  EXISTS (
    SELECT 1 FROM users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'supervisor')
  )
);

-- Similar policies for other tables
```

### 3. Database Indexes (Performance)
```sql
-- For faster queries
CREATE INDEX idx_messages_room_id ON messages(room_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_rooms_updated_at ON rooms(updated_at DESC);
CREATE INDEX idx_room_participants_user ON room_participants(user_id);
CREATE INDEX idx_message_status_message ON message_status_history(message_id);
```

## 🧪 Testing

### 1. Test Realtime Subscription
```typescript
// Open browser console
supabase
  .channel('test')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, 
    (payload) => console.log('Message change:', payload)
  )
  .subscribe();

// Insert a message via Supabase dashboard
// Should see log in console
```

### 2. Test Room Auto-Sort
1. Open chat page
2. Send message to a room NOT at the top
3. Room should immediately move to top
4. Unread counter should increment

### 3. Test Message Status
1. Send a message (should show ✓)
2. Backend updates status to "delivered" (should show ✓✓)
3. Backend updates status to "read" (should show ✓✓ in blue)

### 4. Test Role-Based Access
1. Login as Agent
2. Should only see rooms in room_participants
3. Login as Admin/Supervisor
4. Should see all rooms

## 🚨 Common Issues

### Issue: Realtime not working
**Solution**: 
- Check Supabase realtime is enabled
- Verify websocket connection in Network tab
- Check browser console for errors

### Issue: Rooms not auto-sorting
**Solution**:
- Ensure backend updates `rooms.updated_at` when message arrives
- Check `fetchRooms` sorting logic

### Issue: Permission denied
**Solution**:
- Review RLS policies
- Check user authentication
- Verify anon key vs service role key usage

### Issue: Messages duplicating
**Solution**:
- Don't manually add message to state after sending
- Let realtime subscription handle it

## 📚 Documentation Files

- `SUPABASE_REALTIME_INTEGRATION.md` - Lengkap documentation
- `MIGRATION_GUIDE.md` - This file
- `.env.local.example` - Environment variables template
- Database schema: `database/modul chat.json`

## ✅ Completion Checklist

Sebelum deploy to production:

- [ ] All environment variables set
- [ ] Supabase realtime enabled on all tables
- [ ] RLS policies configured
- [ ] Database indexes created
- [ ] Backend webhooks tested
- [ ] Message sending works
- [ ] Message status updates work
- [ ] Room auto-sorting works
- [ ] Role-based access works
- [ ] Lead management works
- [ ] Media upload works (if implemented)
- [ ] Error handling implemented
- [ ] Loading states implemented
- [ ] Performance tested with large dataset

## 🎯 Next Features (Post-MVP)

1. **Typing Indicators**
   - Real-time "User is typing..." 
   - Use presence feature

2. **Message Search**
   - Full-text search across messages
   - Filter by date, sender, type

3. **Bulk Operations**
   - Mark all as read
   - Bulk assign agents
   - Bulk status updates

4. **Notifications**
   - Browser notifications for new messages
   - Desktop notifications
   - Sound alerts

5. **Analytics**
   - Response time metrics
   - Agent performance dashboard
   - Customer engagement tracking

6. **Advanced Features**
   - Voice messages
   - Video calls integration
   - Automated responses
   - Chatbot integration

---

**Good luck with the migration! 🚀**

For questions, refer to `SUPABASE_REALTIME_INTEGRATION.md` or check the code in:
- `src/hooks/useSupabaseRealtime.ts`
- `src/lib/api.ts`
- `src/components/chat/`
