# New Chat Feature - Template Message Integration

## Overview
The New Chat feature allows agents to initiate WhatsApp conversations with customers by sending template messages to phone numbers. This enables proactive engagement with leads before they contact the business.

## Implementation Details

### Components Created

#### NewChatModal (`src/components/chat/NewChatModal.tsx`)
A two-step modal wizard for creating new chat rooms via WhatsApp templates:

**Step 1: Phone Number Input**
- Input field for phone number (Indonesian format: 62xxxxx)
- Automatic validation and formatting
- Button to proceed to template selection

**Step 2: Template Selection**
- Fetches available WhatsApp templates from backend
- Displays templates in a selectable list with:
  - Template name
  - Category (marketing, utility, authentication)
  - Language code
  - Template status
- Dynamic parameter input fields for template variables ({{1}}, {{2}}, etc.)
- Live preview of the final message with parameters filled in
- Send button to execute the template message

### Integration Points

#### Chat Page (`src/app/chat/page.tsx`)
- Added `showNewChatModal` state
- Added `handleNewChatSuccess` callback to handle room creation
- Renders NewChatModal component
- Automatically refreshes room list via Supabase realtime

#### ChatSidebar (`src/components/chat/ChatSidebar.tsx`)
- Added optional `onNewChat` prop
- Added "New Chat" button with MessageSquarePlus icon
- Button positioned in header toolbar

### API Integration

#### Endpoint Used
```typescript
POST /messages/send-template
```

#### Request Payload
```typescript
{
  to: string;              // Phone number (62xxxxx format)
  templateName: string;    // Template identifier
  languageCode: string;    // Template language (e.g., "id")
  parameters: string[];    // Array of parameter values
  user_id: string;        // Current user ID
}
```

#### Response
```typescript
{
  success: true;
  to: string;
  templateName: string;
  languageCode: string;
  parameters: string[];
  message_id: string;
  whatsapp_message_id: string;
  database_saved: {
    message_id: string;
    whatsapp_message_id: string;
    room_id: string;        // ✅ Room ID returned by backend!
  };
  result: {...};
}
```

**Important**: Backend returns `room_id` in `database_saved.room_id`. This is used to auto-select the newly created room after sending the template.

#### Template Fetching
```typescript
GET /messages/templates
```

Returns array of templates with structure:
```typescript
{
  name: string;
  language: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: Array<{
    type: string;
    format?: string;
    text?: string;
    example?: { body_text?: Array<string[]> };
  }>;
}
```

## User Flow

1. **Open New Chat**
   - User clicks "New Chat" button (MessageSquarePlus icon) in ChatSidebar header
   - NewChatModal opens in Step 1 (phone input)

2. **Enter Phone Number**
   - User enters phone number (auto-formatted to 62xxxxx)
   - Clicks "Next" to proceed to template selection

3. **Select Template**
   - Modal fetches available templates from backend
   - User selects a template from the list
   - System extracts parameter placeholders from template body

4. **Fill Parameters** (if template has variables)
   - Dynamic input fields appear for each parameter
   - User fills in the parameter values
   - Live preview updates to show final message

5. **Send Template**
   - User clicks "Send Template" button
   - System sends template message via API
   - **Backend returns room_id in response**
   - Modal closes on success
   - Room list refreshes automatically via Supabase Realtime
   - **New room is auto-selected using room_id from response** ✅

## Technical Features

### Phone Number Formatting
- Automatically adds '62' prefix for Indonesian numbers
- Removes '0' prefix if user enters local format
- Validates format before allowing submission

### Parameter Extraction
- Parses template body text for {{1}}, {{2}}, etc. placeholders
- Dynamically creates input fields based on count
- Supports multiple parameters per template

### Template Preview
- Real-time preview of message with parameters
- Shows exact text that will be sent to customer
- Helps user verify before sending

### Error Handling
- Displays API errors in user-friendly format
- Validates required fields before submission
- Shows loading states during API calls

### Realtime Integration
- Room list updates automatically after template sent
- No manual refresh needed (removed `window.location.reload()`)
- Leverages existing Supabase realtime subscription
- **Room auto-selected using room_id from API response**

## Styling

### Modal Design
- Full-screen overlay with backdrop
- Centered modal card (max-w-2xl)
- Two-column layout in Step 2:
  - Left: Template selection and parameters
  - Right: Live preview
- Smooth transitions between steps
- Consistent with existing UI design system

### Components Used
- Button component for actions
- Input component for text fields
- Badge component for template status
- Tailwind CSS for styling

## Future Enhancements

### Potential Improvements
1. **Template Search**: Add search/filter for templates
2. **Template Categories**: Filter by category (marketing, utility, etc.)
3. **Recent Templates**: Show frequently used templates
4. **Template Favorites**: Allow users to favorite templates
5. **Parameter Validation**: Add validation rules for specific parameters
6. **Media Templates**: Support templates with images/videos
7. **Template Preview Images**: Show template header/footer images
8. **Bulk Send**: Send to multiple phone numbers at once
9. **Schedule Send**: Schedule template messages for later
10. **Template Analytics**: Track template performance

### Backend Requirements
- ✅ `/messages/send-template` returns room_id in `database_saved.room_id` 
- ✅ Webhook updates room status after template sent
- Template approval status sync
- Rate limiting for template sends

## Testing Checklist

- [ ] Modal opens when "New Chat" button clicked
- [ ] Phone number validation works correctly
- [ ] Template list loads from API
- [ ] Parameter extraction from template body
- [ ] Parameter input fields render dynamically
- [ ] Preview updates in real-time
- [x] Template message sends successfully
- [x] Room list refreshes after send
- [x] New room auto-selected (room_id from response)
- [x] Error messages display correctly
- [x] Modal closes after success
- [x] Loading states show during API calls
- [x] No page reload needed (realtime subscription works)

## Dependencies

### External
- WhatsApp Business API (for template messages)
- Backend API at localhost:8080

### Internal
- ApiService (`src/lib/api.ts`)
- Button component (`src/components/ui/Button.tsx`)
- Input component (`src/components/ui/Input.tsx`)
- Badge component (`src/components/ui/Badge.tsx`)
- AuthContext for user_id

## Files Modified

1. **Created**: `src/components/chat/NewChatModal.tsx` (400+ lines)
2. **Modified**: `src/app/chat/page.tsx` (added modal state and handler)
3. **Modified**: `src/components/chat/ChatSidebar.tsx` (added New Chat button)

## Related Documentation

- [MESSAGES_API_DOCUMENTATION.md](./MESSAGES_API_DOCUMENTATION.md) - Backend API documentation
- [SUPABASE_REALTIME_INTEGRATION.md](./SUPABASE_REALTIME_INTEGRATION.md) - Realtime setup
- [OPTIMISTIC_UI_MESSAGES.md](./OPTIMISTIC_UI_MESSAGES.md) - Message sending patterns
