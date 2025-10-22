# Bug Fix - Lead Connection Issue

**Date**: October 20, 2025  
**Status**: ✅ FIXED

---

## 🐛 BUG DESCRIPTION

**Issue**: Banner "No lead connected to this conversation" muncul padahal di table `rooms` field `leads_id` sudah terisi (tidak NULL).

**Expected Behavior**: 
- Kalau `room.leads_id` ada nilai → Lead information ditampilkan
- Banner "No lead connected" tidak muncul

**Actual Behavior**:
- `room.leads_id` sudah ada nilai (UUID)
- Lead data tidak ter-load
- Banner "No lead connected" tetap muncul
- Lead information tidak ditampilkan

---

## 🔍 ROOT CAUSE ANALYSIS

### Code Investigation:

**File**: `src/components/chat/ChatWindowWithRealtime.tsx`

**Problematic Code** (Line 58):
```typescript
// ❌ WRONG - Passing room_id to useLead hook
const { lead, loading: leadLoading } = useLead(messages[0]?.room_id || null);
```

**What's Wrong**:
1. `useLead()` hook expects **`leads_id`** (UUID of lead)
2. Code was passing **`room_id`** instead
3. Hook tried to query: `SELECT * FROM leads WHERE id = <room_id>`
4. Query failed because `room_id` is not a valid `leads.id`
5. Lead remained `null` → Banner showed "No lead connected"

### Hook Definition:

**File**: `src/hooks/useSupabaseRealtime.ts` (Line 287)

```typescript
export function useLead(leadId: string | null) {
  // ...
  const { data, error: fetchError } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)  // ← Expects leads.id, NOT rooms.id
    .single();
  // ...
}
```

**Parameter**: `leadId` → Must be `leads.id` (UUID from `rooms.leads_id` field)

---

## ✅ SOLUTION

### 1. Add State for `leads_id`

```typescript
const [roomLeadsId, setRoomLeadsId] = useState<string | null>(null);
```

### 2. Fetch Room Data to Get `leads_id`

```typescript
useEffect(() => {
  const fetchRoomData = async () => {
    const { data } = await supabase
      .from('rooms')
      .select('phone, leads_id')  // ← Fetch leads_id
      .eq('id', roomId)
      .single();
    
    // Set leads_id for useLead hook
    if (roomData?.leads_id) {
      setRoomLeadsId(roomData.leads_id);  // ← Store leads_id
    }
    
    // ... phone number logic
  };
  
  fetchRoomData();
}, [roomId]);
```

### 3. Pass Correct Parameter to `useLead()`

```typescript
// ✅ CORRECT - Pass leads_id
const { lead, loading: leadLoading } = useLead(roomLeadsId);
```

---

## 🔧 CHANGES MADE

### File: `src/components/chat/ChatWindowWithRealtime.tsx`

#### Change 1: Add State Variable
```diff
  const [roomPhone, setRoomPhone] = useState<string | null>(customerPhone || null);
+ const [roomLeadsId, setRoomLeadsId] = useState<string | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
```

#### Change 2: Update Hook Call
```diff
  const { messages, loading: messagesLoading } = useMessages(roomId);
- const { lead, loading: leadLoading } = useLead(messages[0]?.room_id || null);
+ const { lead, loading: leadLoading } = useLead(roomLeadsId);
```

#### Change 3: Fetch and Store `leads_id`
```diff
- // Fetch room data to get phone number if not provided
  useEffect(() => {
-   const fetchRoomPhone = async () => {
+   const fetchRoomData = async () => {
      try {
        const { data } = await supabase
          .from('rooms')
          .select('phone, leads_id')
          .eq('id', roomId)
          .single();
        
        const roomData = data as { phone: string | null; leads_id: string | null } | null;
        
+       // Set leads_id for useLead hook
+       if (roomData?.leads_id) {
+         setRoomLeadsId(roomData.leads_id);
+       }
        
        if (roomData?.phone) {
          setRoomPhone(roomData.phone);
        }
        // ...
      }
    };
    
-   if (!customerPhone && roomId) {
+   if (roomId) {
-     fetchRoomPhone();
+     fetchRoomData();
    }
- }, [roomId, customerPhone]);
+ }, [roomId]);
```

---

## 📊 DATA FLOW

### Before (❌ Wrong):
```
Room ID → useMessages(roomId) → messages[0].room_id → useLead(room_id)
                                                           ↓
                                                    SELECT * FROM leads
                                                    WHERE id = <room_id>
                                                           ↓
                                                    No match found!
                                                           ↓
                                                       lead = null
```

### After (✅ Correct):
```
Room ID → fetchRoomData() → room.leads_id → setRoomLeadsId(leads_id)
                                                      ↓
                                              useLead(leads_id)
                                                      ↓
                                              SELECT * FROM leads
                                              WHERE id = <leads_id>
                                                      ↓
                                              Lead data found!
                                                      ↓
                                              lead = {id, name, phone, ...}
```

---

## 🎯 TESTING SCENARIOS

### Test Case 1: Room WITH Lead
**Setup**:
- `rooms.leads_id` = `"uuid-123-456"` (not NULL)
- `leads.id` = `"uuid-123-456"` exists in leads table

**Expected Result**:
- ✅ Lead data loads successfully
- ✅ Customer name displays in header
- ✅ Lead phone number available
- ✅ Banner "No lead connected" does NOT show
- ✅ Can edit lead info via popup

**Actual Result After Fix**: ✅ PASS

---

### Test Case 2: Room WITHOUT Lead
**Setup**:
- `rooms.leads_id` = `NULL`

**Expected Result**:
- ✅ Lead data is `null`
- ✅ Banner "No lead connected to this conversation" shows
- ✅ Button "Connect Lead" available
- ✅ Can create new lead or search existing

**Actual Result After Fix**: ✅ PASS

---

### Test Case 3: Room with Invalid `leads_id`
**Setup**:
- `rooms.leads_id` = `"invalid-uuid"` (doesn't exist in leads table)

**Expected Result**:
- ✅ useLead hook handles error gracefully
- ✅ `lead` remains `null`
- ✅ Banner shows "No lead connected"
- ✅ Console shows error log

**Actual Result After Fix**: ✅ PASS

---

## 🎉 VERIFICATION

### Before Fix:
```sql
-- Room has leads_id
SELECT id, leads_id FROM rooms WHERE id = 'room-123';
-- Result: leads_id = 'lead-456'

-- But useLead was querying with wrong ID
SELECT * FROM leads WHERE id = 'room-123';  -- ❌ No match!
-- Result: NULL
```

### After Fix:
```sql
-- Room has leads_id
SELECT id, leads_id FROM rooms WHERE id = 'room-123';
-- Result: leads_id = 'lead-456'

-- Now useLead queries with correct ID
SELECT * FROM leads WHERE id = 'lead-456';  -- ✅ Match found!
-- Result: {id: 'lead-456', name: 'John Doe', phone: '628...', ...}
```

---

## 📝 LESSONS LEARNED

### 1. **Always Trace Data Flow**
- Hook expects specific data type (leads_id)
- Passed different data type (room_id)
- Type system didn't catch it (both are strings)

### 2. **Read Hook Signatures Carefully**
```typescript
// Hook signature tells us what it expects
export function useLead(leadId: string | null)
//                       ^^^^^^ - parameter name is a hint!
```

### 3. **Database Schema Matters**
- `rooms.leads_id` is a foreign key to `leads.id`
- Must use correct ID for joins/queries
- Room ID ≠ Lead ID

### 4. **Test Edge Cases**
- Room with lead (main case)
- Room without lead
- Room with invalid leads_id
- Lead data changes (realtime update)

---

## 🚀 RELATED IMPROVEMENTS

### Future Enhancements:

1. **Add Loading State in UI**
```typescript
{leadLoading && <p>Loading lead information...</p>}
```

2. **Add Error State Display**
```typescript
{leadError && <p>Error loading lead: {leadError.message}</p>}
```

3. **Add Lead Refresh Button**
```typescript
<Button onClick={refetchLead}>Refresh Lead Data</Button>
```

4. **Optimize: Fetch Lead with Room in One Query**
```typescript
// Instead of two queries:
// 1. SELECT * FROM rooms WHERE id = ?
// 2. SELECT * FROM leads WHERE id = ?

// Use join in single query:
SELECT rooms.*, leads.* 
FROM rooms 
LEFT JOIN leads ON rooms.leads_id = leads.id 
WHERE rooms.id = ?
```

---

## ✅ SUMMARY

**Bug**: Banner "No lead connected" muncul meskipun `room.leads_id` ada  
**Root Cause**: Passing `room_id` instead of `leads_id` to `useLead()` hook  
**Fix**: Fetch `room.leads_id` from Supabase dan pass ke `useLead()`  
**Files Changed**: 1 (`ChatWindowWithRealtime.tsx`)  
**Lines Changed**: ~15 lines  
**Test Status**: ✅ All scenarios pass  

**Ready for production!** 🎊
