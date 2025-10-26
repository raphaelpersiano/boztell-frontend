# Template Message Flow - Two Entry Points

## Overview
Implementasi dua cara untuk mengirim template message dengan behavior yang berbeda:
1. **New Chat (Sidebar)**: Untuk customer baru - phone number harus diisi manual
2. **Send Template (ChatWindow)**: Untuk room yang sudah ada - phone number auto-filled

## Use Cases

### Use Case 1: New Customer (From Sidebar)
**Scenario**: Agent ingin memulai conversation dengan customer yang belum pernah chat

**Flow**:
1. User klik icon "New Chat" di ChatSidebar
2. NewChatModal terbuka dengan phone field **kosong**
3. User harus input nomor telpon manual
4. User pilih template dan kirim
5. Room baru terbuat

**Why empty phone?**
- Prevent accidental resend ke nomor lama
- Force user untuk conscious input nomor baru
- Reduce risk of sending to wrong customer

### Use Case 2: Existing Room - Regular Message (From ChatWindow)
**Scenario**: Room sudah ada, masih dalam 24-hour window, ingin kirim template

**Flow**:
1. User klik icon "Send Template" (MessageSquare) di ChatWindow header
2. NewChatModal terbuka dengan phone field **pre-filled** dari room tersebut
3. Skip phone input step, langsung ke template selection
4. User pilih template dan kirim
5. Template terkirim ke room yang sama

**Why pre-filled?**
- User jelas ingin kirim ke nomor ini (they're in the room)
- Faster workflow - skip phone input
- No risk of wrong number (already selected)

### Use Case 3: Expired Room - Template Message (From ChatWindow)
**Scenario**: 24-hour window sudah expired, regular messages blocked

**Flow**:
1. User lihat warning "24-hour window expired"
2. All input disabled (text, media, voice, etc.)
3. User klik icon "Send Template" di ChatWindow header
4. NewChatModal terbuka dengan phone pre-filled
5. User pilih template dan kirim
6. Template terkirim, room menjadi "active" lagi

**Why important?**
- Only way to restart conversation after 24h
- Comply with WhatsApp Business API policy
- Re-open messaging window

## Implementation Details

### 1. NewChatModal Component

#### Props
```typescript
interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (roomId: string) => void;
  userId: string;
  prefilledPhone?: string; // 🔑 NEW: Optional pre-filled phone
}
```

#### State Management
```typescript
// Reset atau pre-fill phone when modal opens
useEffect(() => {
  if (isOpen) {
    if (prefilledPhone) {
      // Pre-fill phone for existing room (from ChatWindow)
      setPhoneNumber(prefilledPhone);
      setStep('template'); // Skip phone input, go directly to template
    } else {
      // Reset phone for new chat (from ChatSidebar)
      setPhoneNumber('');
      setStep('phone'); // Start from phone input
    }
    fetchTemplates();
  }
}, [isOpen, prefilledPhone]);
```

#### Reset on Close
```typescript
const handleClose = () => {
  // Always reset when closing to ensure clean state
  handleReset();
  onClose();
};
```

#### Footer Behavior
```typescript
// Back button behavior depends on source
<Button onClick={prefilledPhone ? handleClose : handleBack}>
  {prefilledPhone ? 'Cancel' : 'Back'}
</Button>
```

**Logic**:
- If `prefilledPhone` exists: "Cancel" button (can't go back, no phone step)
- If no `prefilledPhone`: "Back" button (can return to phone input)

### 2. ChatWindow Component

#### New Button
```typescript
{onShowTemplateModal && (
  <Button 
    variant="ghost" 
    size="sm" 
    onClick={onShowTemplateModal}
    title="Send Template Message"
    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
  >
    <MessageSquare className="h-5 w-5" />
  </Button>
)}
```

**Position**: Di header, sebelum QuickRoomAssignment button

**Visibility**: Always visible (even when 24h expired - this is the solution!)

**Style**: Blue color untuk distinguish from other buttons

### 3. Parent Component (chat/page.tsx)

#### State Management
```typescript
const [showNewChatModal, setShowNewChatModal] = useState(false);
const [showTemplateModal, setShowTemplateModal] = useState(false);
```

Two separate modals untuk avoid state confusion.

#### Modal Instances
```typescript
{/* New Chat Modal - From Sidebar (empty phone) */}
<NewChatModal
  isOpen={showNewChatModal}
  onClose={() => setShowNewChatModal(false)}
  onSuccess={handleNewChatSuccess}
  userId={user?.id || ''}
/>

{/* Template Modal - From ChatWindow (pre-filled phone) */}
<NewChatModal
  isOpen={showTemplateModal}
  onClose={() => setShowTemplateModal(false)}
  onSuccess={handleNewChatSuccess}
  userId={user?.id || ''}
  prefilledPhone={selectedRoom?.room_phone || undefined}
/>
```

**Key Difference**: `prefilledPhone` prop only passed to second instance

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     CHAT SIDEBAR                            │
│  ┌──────────────────────────────────────────┐              │
│  │ 🆕 New Chat Button                        │              │
│  └──────────────────────────────────────────┘              │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────┐              │
│  │ NewChatModal                              │              │
│  │ - Phone: EMPTY (must input)              │              │
│  │ - Step: 'phone'                           │              │
│  │ - User enters new number                  │              │
│  │ - Select template                         │              │
│  │ - Send → New room created                 │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    CHAT WINDOW                              │
│  ┌──────────────────────────────────────────┐              │
│  │ 💬 Send Template Button (MessageSquare)  │              │
│  └──────────────────────────────────────────┘              │
│                     │                                        │
│                     ▼                                        │
│  ┌──────────────────────────────────────────┐              │
│  │ NewChatModal                              │              │
│  │ - Phone: PRE-FILLED (from room)          │              │
│  │ - Step: 'template'                        │              │
│  │ - Skip phone input                        │              │
│  │ - Select template                         │              │
│  │ - Send → Message to same room             │              │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

## User Experience Benefits

### 1. Safety First
- **New Chat**: Reset phone prevents accidental sends to wrong customer
- **Existing Room**: Pre-fill is safe because user explicitly selected that room

### 2. Efficiency
- **New Chat**: Intentional input ensures accuracy
- **Existing Room**: Skip phone step saves time

### 3. Clarity
- **Visual distinction**: Two different buttons, clear intent
- **Consistent behavior**: Users learn two patterns quickly

### 4. 24-Hour Compliance
- **Expired rooms**: Template button remains as only option
- **Clear guidance**: Warning banner explains why regular messages blocked
- **Easy recovery**: One click to send template and reopen window

## Testing Scenarios

### Test 1: New Chat from Sidebar
1. ✅ Click "New Chat" in sidebar
2. ✅ Modal opens with empty phone field
3. ✅ Enter phone number
4. ✅ Proceed to template selection
5. ✅ Send template
6. ✅ New room appears in list
7. ✅ Open modal again - phone should be empty again

### Test 2: Template from Active Room
1. ✅ Select existing room (< 24h)
2. ✅ Click "Send Template" button in header
3. ✅ Modal opens with phone pre-filled
4. ✅ Directly on template selection step
5. ✅ Send template
6. ✅ Template appears in chat

### Test 3: Template from Expired Room
1. ✅ Select room with last_message_at > 24h ago
2. ✅ See warning banner and disabled inputs
3. ✅ Click "Send Template" button (still enabled)
4. ✅ Modal opens with phone pre-filled
5. ✅ Send template successfully
6. ✅ Regular messaging unlocked (if customer replies)

### Test 4: Back Button Behavior
**From Sidebar (no prefilledPhone)**:
1. ✅ Open modal from sidebar
2. ✅ Enter phone and click "Next"
3. ✅ Click "Back" → returns to phone input
4. ✅ Phone number preserved

**From ChatWindow (with prefilledPhone)**:
1. ✅ Open modal from chat window
2. ✅ Directly on template step
3. ✅ Click "Cancel" → closes modal
4. ✅ No back button to phone step (it was skipped)

### Test 5: Modal State Isolation
1. ✅ Open "New Chat" from sidebar → phone empty
2. ✅ Close without sending
3. ✅ Open "Send Template" from room → phone filled
4. ✅ Close without sending
5. ✅ Open "New Chat" again → phone still empty (no cross-contamination)

## Error Prevention

### Accidental Resend Prevention
**Problem**: User previously sent template to Customer A, then wants to send to Customer B, but forgets to change phone number.

**Solution**: 
- Sidebar "New Chat" always resets phone
- Force user to consciously input new number
- Visual confirmation before sending

### Wrong Room Prevention
**Problem**: User wants to send template to specific room but might copy wrong number.

**Solution**:
- ChatWindow button automatically uses correct room phone
- No manual input = no typo risk
- User already in context of that room

## Future Enhancements

### 1. Recent Phone Suggestions
For sidebar "New Chat", show dropdown of recent phone numbers (last 5) for quick selection, but still require explicit selection (not auto-fill).

### 2. Template Favorites
Mark frequently used templates as favorites for faster selection.

### 3. Template Preview
Show full template preview before sending, including all parameters filled in.

### 4. Scheduled Templates
Schedule template to be sent at specific time (for expired rooms waiting for customer timezone).

### 5. Template Analytics
Track which templates have highest response rates to optimize selection.

## Related Files
- `src/components/chat/NewChatModal.tsx` - Modal component with conditional behavior
- `src/components/chat/ChatWindow.tsx` - Template button in header
- `src/components/chat/ChatSidebar.tsx` - New chat button
- `src/app/chat/page.tsx` - Two modal instances with different props
- `docs/24_HOUR_WINDOW_RESTRICTION.md` - Related 24h policy documentation
