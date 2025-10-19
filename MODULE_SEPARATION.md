# Module Separation Guide - Leads vs Chat

## 🎯 Prinsip: No Redundancy, Clear Separation

### 📊 **Modul LEADS** (`/leads`)
**Purpose**: Full CRUD management & overview semua leads di database

**Features**:
- ✅ List **SEMUA** leads dalam bentuk table
- ✅ Filter & Search leads
- ✅ Create new lead (form lengkap)
- ✅ Edit lead (full form edit)
- ✅ Delete lead
- ✅ Assign lead ke agent
- ✅ Statistics & Analytics
- ✅ Bulk operations
- ✅ Export data
- ✅ Lead lifecycle management

**Use Case**:
- Admin/Supervisor melihat overview semua leads
- Manage lead status & assignment
- Analisa performance & conversion rate
- Data entry & management

**Components**:
- `LeadsTable.tsx` - Main table dengan filtering
- `LeadDetailModal.tsx` (future) - Full detail modal
- `LeadFormModal.tsx` (future) - Create/Edit form

**Data Source**:
```typescript
// Fetch dari Supabase
const { data: leads } = await supabase
  .from('leads')
  .select('*')
  .order('updated_at', { ascending: false });
```

---

### 💬 **Modul CHAT** (`/chat`)
**Purpose**: Real-time messaging dengan customer + quick lead info panel

**Features**:
- ✅ Real-time chat room list (sorted by last message)
- ✅ Real-time messages (WhatsApp-like)
- ✅ **Quick lead info panel** (hideable sidebar/popup)
  - View lead details
  - Quick edit essential fields
  - Link/unlink lead to room
  - Update room title
- ✅ Send messages (text, media)
- ✅ Message status tracking
- ✅ Room assignment

**Lead Info Panel dalam Chat** (LeadManagementPopup):
- **TIDAK** untuk full CRUD leads
- **HANYA** untuk:
  - View lead info saat chat
  - Quick edit field penting (nama, phone, status)
  - Link existing lead ke room
  - Create lead baru jika room belum punya lead
  - Update room title/label

**Use Case**:
- Agent chatting dengan customer
- Agent perlu lihat lead info tanpa pindah page
- Agent perlu update status lead setelah chat
- Quick action tanpa interrupt chat flow

**Components**:
- `ChatSidebar.tsx` - Room list dengan realtime
- `ChatWindow.tsx` / `ChatWindowWithRealtime.tsx` - Chat interface
- `LeadManagementPopup.tsx` - **Quick lead info panel** (minimal, focused)

**Data Source**:
```typescript
// Via realtime hooks
const { rooms } = useRooms(userId, userRole);
const { messages } = useMessages(roomId);
const { lead } = useLead(leadId); // Only when room has leads_id
```

---

## 🔄 Data Flow & Relationship

```
┌─────────────────────────────────────────────────────────────┐
│                    SUPABASE DATABASE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐       │
│  │  leads  │◄────────│  rooms  │────────►│messages │       │
│  │  table  │ leads_id│  table  │ room_id │  table  │       │
│  └─────────┘         └─────────┘         └─────────┘       │
│       ▲                    ▲                                │
│       │                    │                                │
└───────┼────────────────────┼────────────────────────────────┘
        │                    │
        │                    │
┌───────┼────────────────────┼────────────────────────────────┐
│   FRONTEND                 │                                │
├───────┼────────────────────┼────────────────────────────────┤
│       │                    │                                │
│  ┌────▼────────┐    ┌──────▼──────┐                        │
│  │ LEADS PAGE  │    │  CHAT PAGE  │                        │
│  ├─────────────┤    ├─────────────┤                        │
│  │             │    │             │                        │
│  │ • Full CRUD │    │ • Messaging │                        │
│  │ • Analytics │    │ • Realtime  │                        │
│  │ • Reports   │    │ • Quick     │                        │
│  │ • Bulk Ops  │    │   Lead Info │◄───── Minimal, Focused │
│  │             │    │   (Popup)   │       Not Full CRUD    │
│  └─────────────┘    └─────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Field Mapping: Old vs New

### Database Schema (Supabase)
```typescript
interface Lead {
  id: string;                    // UUID
  name: string | null;           // Customer name
  phone: string | null;          // Phone number
  outstanding: number | null;    // Outstanding amount
  loan_type: string | null;      // Type of loan
  leads_status: string | null;   // cold, warm, hot, paid, etc.
  contact_status: string | null; // Contact status
  utm_id: string | null;         // UTM tracking
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
}
```

### Old Field Names (DEPRECATED) → New Field Names
```typescript
// ❌ OLD (Indonesian, camelCase) → ✅ NEW (snake_case, aligned with DB)
namaLengkap     → name
nomorTelpon     → phone
nominalPinjaman → outstanding
jenisUtang      → loan_type
status          → leads_status
assignedTo      → (handled via room_participants table)
createdAt       → created_at
updatedAt       → updated_at
```

---

## 🚫 What NOT to Do

### ❌ WRONG: Redundant Lead Management in Chat
```typescript
// ❌ DON'T: Full lead form in chat module
<ChatPage>
  <LeadFullForm /> ← WRONG! This belongs in /leads
</ChatPage>
```

### ❌ WRONG: Chat Features in Leads Module
```typescript
// ❌ DON'T: Real-time messaging in leads page
<LeadsPage>
  <MessageList /> ← WRONG! This belongs in /chat
</LeadsPage>
```

### ✅ CORRECT: Proper Separation
```typescript
// ✅ Chat module: Quick lead info only
<ChatPage>
  <ChatWindow>
    <LeadManagementPopup> ← Minimal, hideable
      - View lead info
      - Quick edit
      - Link/unlink
    </LeadManagementPopup>
  </ChatWindow>
</ChatPage>

// ✅ Leads module: Full management
<LeadsPage>
  <LeadsTable>
    - Full CRUD
    - Analytics
    - Reports
  </LeadsTable>
</LeadsPage>
```

---

## 🎨 UI/UX Guidelines

### Leads Module
- **Layout**: Full page table
- **Navigation**: Main sidebar menu item
- **Actions**: Toolbar buttons (Create, Import, Export)
- **Details**: Modal or side panel with complete form
- **Focus**: Data management & analysis

### Chat Module - Lead Info Panel
- **Layout**: Sliding popup/panel (hide-able)
- **Trigger**: Info button in ChatWindow header
- **Size**: Max 400px width (doesn't cover chat)
- **Content**: Essential info only
- **Focus**: Quick reference & minimal editing
- **Animation**: Slide from right, can be dismissed

---

## 🔧 Implementation Checklist

### ✅ Done
- [x] Database types aligned with Supabase schema
- [x] LeadsTable updated to use new field names
- [x] LeadManagementPopup created (for chat module)
- [x] Clear separation documented

### 📋 TODO (Future)
- [ ] Create full LeadFormModal for /leads page
- [ ] Add lead assignment UI in /leads (via room_participants)
- [ ] Add analytics dashboard in /leads
- [ ] Add export functionality in /leads
- [ ] Optimize LeadManagementPopup UI (make it more compact)

---

## 💡 Key Principles

1. **Single Source of Truth**: Database schema (snake_case)
2. **Separation of Concerns**: 
   - `/leads` = Full management
   - `/chat` = Quick reference
3. **No Redundancy**: Each feature lives in ONE place
4. **Context-Aware**: UI fits the context (chat vs management)
5. **Progressive Disclosure**: Chat shows minimal, leads shows all

---

## 🎯 Summary

| Aspect | Leads Module | Chat Module |
|--------|-------------|-------------|
| **Purpose** | Full lead management | Quick lead info while chatting |
| **CRUD** | ✅ Full Create/Read/Update/Delete | ⚠️ View + Quick Edit only |
| **UI** | Table, forms, analytics | Hideable popup/panel |
| **Scope** | All leads in database | Only lead linked to current room |
| **Data** | Direct Supabase queries | Via realtime hooks |
| **Use Case** | Admin/Supervisor management | Agent quick reference |
| **Navigation** | Main menu item `/leads` | Info button in chat header |

**Golden Rule**: If it's about **managing** leads → `/leads`. If it's about **chatting** → `/chat` (with minimal lead info).
