# Supabase Realtime Integration - Documentation

## 📋 Overview

Dokumentasi ini menjelaskan integrasi Supabase Realtime untuk modul chat Boztell CRM dengan UX seamless seperti WhatsApp mobile.

## 🎯 Target

- ✅ Real-time message updates
- ✅ Auto-sort rooms berdasarkan last message (newest first)
- ✅ Real-time status updates (sent → delivered → read)
- ✅ Role-based access control
- ✅ Unread message counter
- ✅ Lead management integration

## 📦 Installation

```bash
npm install @supabase/supabase-js
```

## 🔧 Setup Environment

Buat file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
NEXT_PUBLIC_API_URL=http://localhost:4000
```

## 📁 File Structure

```
src/
├── types/
│   ├── index.ts          # Updated types aligned with database
│   └── database.ts       # Supabase database types
├── lib/
│   ├── supabase.ts      # Supabase client singleton
│   └── api.ts           # API service (updated with chat endpoints)
├── hooks/
│   └── useSupabaseRealtime.ts  # Custom realtime hooks
└── components/
    └── chat/
        ├── ChatSidebar.tsx     # Realtime room list
        ├── ChatWindow.tsx      # Realtime messages
        └── LeadManagementPopup.tsx  # Create/Edit leads
```

## 🗃️ Database Schema

### 1. rooms
- `id` (text, PK): Room ID
- `title` (text): Room title/label
- `phone` (varchar): Customer phone number
- `leads_id` (uuid, FK): Link to leads table
- `created_at`, `updated_at`: Timestamps

### 2. room_participants
- `room_id` (text, FK): Room reference
- `user_id` (uuid, FK): User/Agent reference  
- `joined_at`: Join timestamp

**Purpose**: Role-based access - agents only see assigned rooms

### 3. messages
- `id` (text, PK): Message ID
- `room_id` (text, FK): Room reference
- `user_id` (uuid, FK, nullable): Sender (null = customer, filled = agent)
- `content_text` (text): Message text
- `content_type` (text): Message type
- `media_type`, `media_id`, `gcs_url`: Media handling
- `status` (text): sent | delivered | read | failed
- `wa_message_id` (text): WhatsApp message ID
- `reply_to_wa_message_id` (text): For reply feature
- `reaction_emoji`, `reaction_to_wa_message_id`: For reactions
- `created_at`, `updated_at`: Timestamps

### 4. message_status_history
- `id` (int, PK): History ID
- `message_id` (text, FK): Message reference
- `status` (text): Status value
- `timestamp`: When status changed
- `metadata` (jsonb): Additional data

**Purpose**: Track message status progression

### 5. leads
- `id` (uuid, PK): Lead ID
- `name`, `phone`: Customer info
- `outstanding` (bigint): Loan amount
- `loan_type`: Type of loan
- `leads_status`, `contact_status`: Status tracking
- `created_at`, `updated_at`: Timestamps

## 🎣 Custom Hooks

### useRooms(userId, userRole)

Fetches and subscribes to room updates with realtime changes.

```typescript
const { rooms, loading, error, refetch } = useRooms(userId, userRole);
```

**Features**:
- Auto-filters based on role (agents: only assigned rooms, admin/supervisor: all)
- Auto-sorts by last message timestamp (WhatsApp-like)
- Calculates unread count
- Subscribes to: rooms, messages (for last message updates)

**Returns**:
- `rooms[]`: Array of Room objects with extended fields (lead, last_message, unread_count)
- `loading`: boolean
- `error`: Error | null
- `refetch()`: Function to manually refresh

### useMessages(roomId)

Fetches and subscribes to messages in a specific room.

```typescript
const { messages, loading, error, refetch } = useMessages(roomId);
```

**Features**:
- Real-time INSERT, UPDATE, DELETE
- Ordered by created_at ascending
- Auto-updates on new messages

### useMessageStatus(messageId)

Tracks message status history.

```typescript
const { statusHistory, currentStatus, loading } = useMessageStatus(messageId);
```

**Features**:
- Returns all status history
- Provides current status
- Real-time status updates

### useLead(leadId)

Fetches lead information with realtime updates.

```typescript
const { lead, loading, error } = useLead(leadId);
```

### useRoomAccess(roomId, userId, userRole)

Checks if user has access to a room.

```typescript
const { hasAccess, loading } = useRoomAccess(roomId, userId, userRole);
```

**Logic**:
- Admin/Supervisor: Always true
- Agent: Checks room_participants table

## 🔌 API Endpoints (Express Backend)

### Messages

```typescript
// Send text message
ApiService.sendMessage({
  room_id: string,
  content_text: string,
  user_id?: string,
  reply_to_wa_message_id?: string
})

// Send media message
ApiService.sendMediaMessage(formData)

// Send reaction
ApiService.sendReaction({
  room_id: string,
  reaction_emoji: string,
  reaction_to_wa_message_id: string,
  user_id: string
})

// Mark as read
ApiService.markMessageAsRead(messageId)
ApiService.markRoomAsRead(roomId)
```

### Rooms

```typescript
// Update room
ApiService.updateRoom(roomId, {
  title?: string,
  leads_id?: string
})

// Create room
ApiService.createRoom({
  phone: string,
  title?: string,
  leads_id?: string
})

// Assign/unassign agent
ApiService.assignAgentToRoom(roomId, userId)
ApiService.removeAgentFromRoom(roomId, userId)
```

### Leads

```typescript
// Create lead
ApiService.createLead({
  name: string,
  phone: string,
  outstanding?: number,
  loan_type?: string,
  leads_status?: string,
  contact_status?: string
})

// Update lead
ApiService.updateLead(leadId, data)

// Get lead
ApiService.getLead(leadId)

// Search by phone
ApiService.searchLeadsByPhone(phone)
```

## 🎨 Component Integration

### ChatSidebar

**Props**:
```typescript
{
  selectedRoomId?: string;
  onRoomSelect: (roomId: string) => void;
  userId: string;
  userRole: 'admin' | 'supervisor' | 'agent';
}
```

**Features**:
- Real-time room list dengan auto-sort
- Unread counter per room
- Message status indicators (✓ ✓✓)
- Search functionality
- Filter tabs (All/Unassigned/Assigned) for admin/supervisor
- Lead connection status badge

**Usage**:
```tsx
<ChatSidebar
  selectedRoomId={selectedRoomId}
  onRoomSelect={setSelectedRoomId}
  userId={currentUser.id}
  userRole={currentUser.role}
/>
```

### ChatWindow

**Props**:
```typescript
{
  roomId: string;
  userId: string;
  onClose?: () => void;
}
```

**Features**:
- Real-time message updates
- Message status display
- Reply functionality
- Reaction support
- Media messages (images, videos, documents, audio)
- Auto-scroll to bottom on new message
- Typing indicators (future)

### LeadManagementPopup

**Props**:
```typescript
{
  roomId: string;
  leadId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (leadData) => void;
}
```

**Features**:
- Create new lead
- Edit existing lead
- Update room title
- Link lead to room
- Sliding popup (can be hidden)

## 🔒 Role-Based Access

### Admin
- ✅ See all rooms
- ✅ Manage all leads
- ✅ Assign/unassign agents
- ✅ Send messages to any room

### Supervisor
- ✅ See all rooms
- ✅ Manage all leads
- ✅ Assign/unassign agents
- ✅ Send messages to any room

### Agent
- ✅ See only assigned rooms (via room_participants)
- ✅ Send messages to assigned rooms only
- ✅ View lead info for assigned rooms
- ❌ Cannot assign/unassign themselves

## 🚀 Usage Example

### Chat Page Implementation

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { LeadManagementPopup } from '@/components/chat/LeadManagementPopup';

export default function ChatPage() {
  const { user } = useAuth();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [showLeadPopup, setShowLeadPopup] = useState(false);

  if (!user) return <div>Please login</div>;

  return (
    <div className="flex h-screen">
      <ChatSidebar
        selectedRoomId={selectedRoomId}
        onRoomSelect={setSelectedRoomId}
        userId={user.id}
        userRole={user.role}
      />
      
      {selectedRoomId ? (
        <ChatWindow
          roomId={selectedRoomId}
          userId={user.id}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p>Select a chat to start messaging</p>
        </div>
      )}

      {showLeadPopup && (
        <LeadManagementPopup
          roomId={selectedRoomId}
          isOpen={showLeadPopup}
          onClose={() => setShowLeadPopup(false)}
          onSave={(data) => {
            // Handle save
            console.log('Lead saved:', data);
          }}
        />
      )}
    </div>
  );
}
```

## 📊 Real-time Behavior

### New Message Flow

1. **Customer sends message via WhatsApp** → Express backend receives webhook
2. **Backend inserts to `messages` table** → Supabase emits realtime event
3. **Frontend receives INSERT event** → Updates messages array in ChatWindow
4. **Backend updates `rooms.updated_at`** → Triggers room resort in ChatSidebar
5. **Room moves to top** → WhatsApp-like behavior ✅

### Message Status Flow

1. **Agent sends message** → Status: `sent`
2. **WhatsApp confirms delivery** → Insert to `message_status_history`, update `messages.status` = `delivered`
3. **Customer reads message** → Insert to `message_status_history`, update `messages.status` = `read`
4. **Frontend shows checkmarks** → ✓ (sent), ✓✓ (delivered), ✓✓ blue (read)

### Unread Counter Logic

```typescript
// Count messages from customer that are not 'read'
SELECT COUNT(*) FROM messages
WHERE room_id = $1 
AND user_id IS NULL  -- from customer
AND status != 'read'
```

## ⚠️ Important Notes

1. **Supabase Realtime must be enabled** on all tables:
   - rooms
   - messages
   - message_status_history
   - leads
   - room_participants

2. **Row Level Security (RLS)**: Ensure proper RLS policies for data security

3. **Backend webhook handling**: Express backend must handle WhatsApp webhooks and update Supabase

4. **Rate limiting**: Consider eventsPerSecond in realtime config

5. **Cleanup subscriptions**: Hooks automatically cleanup on unmount

## 🐛 Troubleshooting

### Messages not updating in realtime
- Check if Supabase Realtime is enabled
- Verify channel subscription in browser console
- Check network tab for realtime websocket connection

### Rooms not sorting correctly
- Ensure `rooms.updated_at` is updated when new message arrives
- Check if `last_message` is being fetched correctly

### Permission errors
- Verify RLS policies in Supabase
- Check user role and room_participants entries

### Performance issues
- Implement pagination for messages
- Add indexes on frequently queried fields
- Consider caching strategy for room list

## 📚 Next Steps

1. ✅ Implement ChatWindow dengan realtime messages
2. ✅ Buat LeadManagementPopup component
3. ⏳ Add media upload support
4. ⏳ Implement typing indicators
5. ⏳ Add message search functionality
6. ⏳ Implement read receipts bulk update
7. ⏳ Add notification system
8. ⏳ Performance optimization dengan pagination

## 📝 Code Samples

Lihat file-file berikut untuk implementasi lengkap:
- `src/lib/supabase.ts` - Supabase client
- `src/hooks/useSupabaseRealtime.ts` - Custom hooks
- `src/lib/api.ts` - API endpoints
- `src/types/index.ts` & `src/types/database.ts` - Type definitions
- `src/components/chat/ChatSidebar.tsx` - Sidebar implementation
- `src/components/chat/ChatWindow.tsx` - Chat window implementation

---

**Version**: 1.0.0  
**Last Updated**: October 20, 2025  
**Author**: GitHub Copilot
