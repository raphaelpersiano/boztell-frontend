# Send Media & Attachments - User Guide

## Overview

Fitur attachment di typing bar memungkinkan agent mengirim berbagai jenis file ke customer melalui WhatsApp Business API.

---

## UI Location

**Position:** Di sebelah kiri textarea (typing bar)

**Icon:** 📎 Paperclip button

---

## Supported Media Types

### 1. 📷 Photo
- **Accepted formats:** JPEG, PNG, WebP
- **Max size:** 16MB
- **API endpoint:** `POST /messages/send-media-combined`
- **Features:** 
  - Auto-preview sebelum send (native file picker)
  - Caption support (gunakan typing bar sebagai caption)

### 2. 🎥 Video
- **Accepted formats:** MP4, 3GPP
- **Max size:** 16MB
- **Features:**
  - Caption support
  - Auto-upload ke GCS

### 3. 📄 Document
- **Accepted formats:** 
  - PDF
  - Word (DOC, DOCX)
  - Excel (XLS, XLSX)
- **Max size:** 16MB
- **Features:**
  - Caption support
  - Preserves original filename

### 4. 🎵 Audio
- **Accepted formats:** AAC, MP4, MPEG, AMR, OGG
- **Max size:** 16MB
- **Note:** Untuk voice note, gunakan fitur recording terpisah

### 5. 👤 Contact
- **Input:** Popup prompt
  - Name (required)
  - Phone with country code (e.g., +6281234567890)
- **API endpoint:** `POST /messages/send-contacts`
- **Format:** WhatsApp contact card

### 6. 📍 Location
- **Source:** Browser geolocation (GPS)
- **API endpoint:** `POST /messages/send-location`
- **Features:**
  - Auto-detect current location
  - Sends lat/long + "My Location" label
  - Requires location permission

---

## How to Use

### Send Photo/Video/Document/Audio

1. Click **📎 Paperclip** button
2. Select media type dari menu:
   - 📷 Photo
   - 🎥 Video
   - 📄 Document
   - 🎵 Audio
3. File picker akan terbuka
4. Pilih file (max 16MB)
5. **Optional:** Ketik caption di typing bar sebelum pilih file
6. File auto-upload dan terkirim

### Send Contact

1. Click **📎 Paperclip** → **👤 Contact**
2. Enter contact name (popup prompt)
3. Enter phone number dengan country code
   - Contoh: `+6281234567890`
4. Contact card terkirim ke customer

### Send Location

1. Click **📎 Paperclip** → **📍 Location**
2. Browser akan minta permission lokasi (allow)
3. Current location auto-detected dan terkirim
4. Customer akan menerima map dengan pin

---

## API Endpoints Used

### Media Upload (Combined)
```typescript
POST /messages/send-media-combined
Content-Type: multipart/form-data

FormData:
- media: File
- to: string (phone number)
- caption?: string
- user_id?: string
```

### Send Contact
```typescript
POST /messages/send-contacts
Content-Type: application/json

{
  to: string,
  contacts: [{
    name: { first_name: string, last_name?: string },
    phones?: [{ phone: string, type?: string }]
  }],
  user_id?: string
}
```

### Send Location
```typescript
POST /messages/send-location
Content-Type: application/json

{
  to: string,
  location: {
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  },
  user_id?: string
}
```

---

## Error Handling

### File Too Large
- Error: "File too large. Maximum size is 16MB."
- Solution: Compress file atau pilih file lebih kecil

### No Customer Phone
- Error: "Cannot send media: Customer phone number not available"
- Cause: Room tidak memiliki phone number
- Solution: Pastikan room memiliki customer phone

### Geolocation Denied
- Error: "Failed to get location: User denied Geolocation"
- Solution: Enable location permission di browser settings

### Backend Not Running
- Error: "Cannot connect to server"
- Solution: Start backend API server pada localhost:8080

---

## UI/UX Features

### Attachment Menu
- **Position:** Bottom-left of typing bar (popup upward)
- **Backdrop:** Click outside to close
- **Icons:** Color-coded per media type
  - Purple: Photo
  - Red: Video
  - Blue: Document
  - Green: Audio
  - Orange: Contact
  - Red: Location

### Optimistic UI (Instant Feedback)
- **Media messages appear immediately** when sent (before backend confirmation)
- Local file preview using `URL.createObjectURL()`
- Blue checkmark appears when backend confirms delivery
- Message removed if send fails (with error alert)
- Same behavior as text messages (WhatsApp-like UX)

### Audio Bubble Design
- **Circular play button** with blue/white background
- HTML5 audio player with custom styling
- File size indicator (KB)
- WhatsApp-inspired rounded bubble
- Color-inverted controls for sent messages (blue bubble)

### Loading States
- Button disabled saat `sending = true`
- Send button disabled jika `!isConnected`
- Visual feedback: Button turns gray when disabled

### Caption Support
- Ketik text di typing bar sebelum pilih file
- Text akan dikirim sebagai caption
- Caption auto-clear setelah media terkirim

---

## Known Limitations

1. **Voice Recording:** Belum ada UI untuk record voice note (coming soon)
2. **Contact Form:** Masih pakai `prompt()` - akan diganti modal form
3. **Location Name:** Hardcoded "My Location" - belum ada custom name input
4. **File Preview:** No preview before send (relies on OS file picker)
5. **Progress Indicator:** No upload progress bar (instant send saja)

---

## Future Enhancements

- [ ] Voice note recorder dengan waveform
- [ ] Contact form modal dengan multiple fields
- [ ] Location picker dengan map preview
- [ ] Upload progress indicator
- [ ] Image preview & crop before send
- [ ] Multiple file upload (batch send)
- [ ] Drag & drop file upload
- [ ] Emoji picker for quick reactions

---

## Testing

### Test Each Media Type

1. **Photo:** Send JPG, PNG, WebP (< 16MB)
2. **Video:** Send MP4 (< 16MB)
3. **Document:** Send PDF, DOCX, XLSX
4. **Audio:** Send MP3, OGG
5. **Contact:** Send contact with valid phone
6. **Location:** Allow geolocation → verify map appears

### Verify in Chat
- Media appears correctly in message bubble
- Caption displays below media
- Customer receives notification
- File downloads work (for documents)

---

## Related Files

- `src/components/chat/ChatWindow.tsx` - Main UI implementation
- `src/lib/api.ts` - API service methods
- `docs/MEDIA_MESSAGES.md` - Message rendering documentation
- `docs/BACKEND_MESSAGE_FORMAT.md` - Backend requirements

---

## Quick Reference

**Endpoint Summary:**
- Media: `POST /messages/send-media-combined` (multipart)
- Contact: `POST /messages/send-contacts` (JSON)
- Location: `POST /messages/send-location` (JSON)

**File Size Limit:** 16MB (WhatsApp restriction)

**Supported MIME Types:**
- Images: `image/jpeg`, `image/png`, `image/webp`
- Videos: `video/mp4`, `video/3gpp`
- Documents: `application/pdf`, `application/msword`, etc.
- Audio: `audio/aac`, `audio/mp4`, `audio/mpeg`, `audio/ogg`
