# Media Message Rendering - Complete Support

## Overview

Frontend sekarang mendukung **semua jenis pesan WhatsApp Business API** dengan rendering yang lengkap dan user-friendly.

---

## Supported Message Types

### ✅ 1. Text Messages
- Simple text display
- Preserves line breaks (whitespace-pre-wrap)
- Word wrapping for long text

### ✅ 2. Image Messages
- Clickable image preview (opens in new tab)
- Lazy loading for performance
- Caption support below image
- Responsive max-width

**Example:**
```typescript
{
  content_type: 'image',
  gcs_url: 'https://storage.googleapis.com/bucket/photo.jpg',
  content_text: 'Product photo',  // Optional caption
  mime_type: 'image/jpeg'
}
```

### ✅ 3. Video Messages
- HTML5 video player with controls
- Fallback card with Play icon if video fails
- Caption support below video
- Preload metadata

**Example:**
```typescript
{
  content_type: 'video',
  gcs_url: 'https://storage.googleapis.com/bucket/video.mp4',
  mime_type: 'video/mp4',
  content_text: 'Tutorial video'
}
```

### ✅ 4. Audio/Voice Messages
- HTML5 audio player with controls
- Fallback card with Volume icon
- Responsive width

**Example:**
```typescript
{
  content_type: 'voice',  // or 'audio'
  gcs_url: 'https://storage.googleapis.com/bucket/voice.ogg',
  mime_type: 'audio/ogg'
}
```

### ✅ 5. Document Messages
- File card with FileText icon
- Filename display
- File size (formatted in KB)
- Download button linking to GCS

**Example:**
```typescript
{
  content_type: 'document',
  gcs_url: 'https://storage.googleapis.com/bucket/invoice.pdf',
  original_filename: 'Invoice_2025.pdf',
  file_size: 245678,  // bytes
  mime_type: 'application/pdf'
}
```

### ✅ 6. Sticker Messages
- 32x32 pixel image display
- Fallback with Smile icon if load fails
- Compact rendering

**Example:**
```typescript
{
  content_type: 'sticker',
  gcs_url: 'https://storage.googleapis.com/bucket/sticker.webp',
  mime_type: 'image/webp'
}
```

### ✅ 7. Location Messages
- MapPin icon (red color)
- Name display (if available, default: "Shared Location")
- Address display (if available)
- **Coordinates display** (always shown with 6 decimal precision)
- "📍 Open in Google Maps" clickable link
- Simple card layout without map image

**Example:**
```typescript
{
  content_type: 'location',
  metadata: {
    location: {
      latitude: -6.2549338,
      longitude: 106.7976435,
      name: 'Optional name',      // Optional
      address: 'Optional address'  // Optional
    }
  },
  content_text: 'Location: -6.2549338, 106.7976435'  // Optional
}
```

**Note:** Location messages work with **only latitude/longitude** - name and address are optional.

### ✅ 8. Contacts Messages
- Contact2 icon
- Iterate through contacts array
- Display name and phone for each contact
- Multiple contacts supported

**Example:**
```typescript
{
  content_type: 'contacts',
  metadata: {
    contacts: [
      {
        name: { formatted_name: 'John Doe' },
        phones: [{ phone: '+6281234567890' }]
      },
      {
        name: { formatted_name: 'Jane Smith' },
        phones: [{ phone: '+6289876543210' }]
      }
    ]
  }
}
```

### ✅ 9. Reaction Messages

### ✅ 9. Generic Media Messages
- **Auto-detection** dari `mime_type` atau `media_type`
- Jika `image/*` → Render sebagai image
- Jika `video/*` → Render sebagai video player
- Jika `audio/*` → Render sebagai audio player
- Jika lainnya → Render sebagai document dengan download button
- Caption support

**Example:**
```typescript
{
  content_type: 'media',  // Generic type
  mime_type: 'image/jpeg',  // Detection dari sini
  gcs_url: 'https://storage.googleapis.com/bucket/photo.jpg',
  content_text: 'Photo caption',
  file_size: 245678
}
```

### ✅ 10. Reaction Messages
- Large emoji display (2xl size)
- "Reacted to a message" label
- Border separator from main content

**Example:**
```typescript
{
  content_type: 'reaction',
  reaction_emoji: '👍',
  reaction_to_wa_message_id: 'wamid.xxx'
}
```

### ✅ 11. Reply Messages (Quoted)
- Shows quoted message preview
- Reply icon
- "You" or "Customer" label
- Truncated preview text
- Media type emoji (📷 Image, 🎥 Video, etc.)
- Blue left border to highlight quote

**Example:**
```typescript
{
  content_type: 'text',
  content_text: 'Yes, I can help!',
  reply_to_wa_message_id: 'wamid.xxx',
  replied_message: {
    id: 'msg-uuid',
    content_type: 'text',
    content_text: 'Do you have this in stock?',
    user_id: null,
    created_at: '2025-01-15T10:30:00Z'
  }
}
```

### ✅ 11. Reply Messages (Quoted)
- Shows quoted message preview
- Reply icon
- "You" or "Customer" label
- Truncated preview text
- Media type emoji (📷 Image, 🎥 Video, etc.)
- Blue left border to highlight quote

**Example:**
```typescript
{
  content_type: 'text',
  content_text: 'Yes, I can help!',
  reply_to_wa_message_id: 'wamid.xxx',
  replied_message: {
    id: 'msg-uuid',
    content_type: 'text',
    content_text: 'Do you have this in stock?',
    user_id: null,
    created_at: '2025-01-15T10:30:00Z'
  }
}
```

### ✅ 12. Unsupported Types (Fallback)
- Info icon
- Message indicating unsupported type
- Shows the content_type name

---

## UI Features

### Message Bubble Styling
- **From Customer:** White background
- **From Agent (confirmed):** Blue-600 background, white text
- **From Agent (unconfirmed):** Blue-400 background, white text
- Max width: 70% of container
- Rounded corners, padding

### Responsive Design
- Images/videos: max-w-full with responsive scaling
- Mobile-friendly controls
- Touch-friendly clickable elements

### Performance Optimizations
- Lazy loading for images
- Video preload metadata only (not full video)
- Efficient rendering with conditional components

---

## Code Location

**File:** `src/components/chat/ChatWindow.tsx`

**Function:** `renderMessage(message: Message)`

**Lines:** ~260-500 (rendering logic)

---

## Backend Requirements

To support all these message types, backend must:

1. **Download media from WhatsApp** when webhook arrives
2. **Upload to Google Cloud Storage** and save `gcs_url`
3. **Populate metadata** for location/contacts
4. **Save replied_message** when `reply_to_wa_message_id` exists
5. **Emit complete message object** via Socket.IO

See: `BACKEND_MESSAGE_FORMAT.md` for detailed backend implementation guide.

---

## Testing Checklist

Send these message types from WhatsApp to test:

- [ ] Plain text message
- [ ] Image with caption
- [ ] Image without caption
- [ ] Video
- [ ] Voice note
- [ ] Audio file
- [ ] PDF document
- [ ] Word document
- [ ] Excel file
- [ ] Sticker
- [ ] Location (share current location)
- [ ] Contact card (single)
- [ ] Contact card (multiple)
- [ ] Reply to previous message
- [ ] React to message with emoji

Expected result: All types render correctly with appropriate UI.

---

## Known Limitations

1. **Sticker animated:** Only shows first frame (static image)
2. **Poll messages:** Not yet supported by WhatsApp Business API
3. **Live location:** Shows last known position only
4. **Group messages:** Not supported in current flow (1-on-1 only)

---

## Future Enhancements

- [ ] Image gallery/carousel for multiple images
- [ ] Video thumbnail generation
- [ ] Audio waveform visualization
- [ ] PDF preview (first page thumbnail)
- [ ] Interactive map for locations (embedded Google Maps)
- [ ] Click-to-call for contact phone numbers
- [ ] Reaction picker UI (to react from frontend)
- [ ] Reply UI (to quote message from frontend)

---

## Related Components

- `src/types/index.ts` - Message interface with all fields
- `src/hooks/useRealtimeMessages.ts` - Message validation and reception
- `BACKEND_MESSAGE_FORMAT.md` - Backend emit requirements
- `REALTIME_FIXED.md` - Complete real-time guide
