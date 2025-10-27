# Voice Note Backend Requirements

## Issue
Frontend is sending voice note recordings to `/messages/send-media-combined` endpoint, but backend returns HTTP 500 Internal Server Error.

## Error Details
```
POST https://boztell-backend-1070141203471.us-central1.run.app/messages/send-media-combined
Status: 500 (Internal Server Error)
Body: {"error":"Internal Server Error"}
```

## Frontend Implementation (✅ Complete)

### Recording Format
- Frontend records audio using `MediaRecorder API`
- Attempts to use: `audio/ogg;codecs=opus` (WhatsApp supported)
- Falls back to: `audio/webm;codecs=opus` if ogg not supported by browser

### Upload Format
- Currently sends: `audio/webm` (browser recorded format)
- File name: `voice-{timestamp}.webm`
- Content-Type: `audio/webm`
- FormData fields:
  ```
  media: File object (audio/webm blob)
  to: string (phone number, e.g. "6287879565390")
  user_id: string (UUID of agent)
  room_id: string (UUID of room/conversation)
  ```

## WhatsApp Cloud API Supported Audio Formats

WhatsApp Business API **ONLY** accepts these audio formats:

✅ `audio/aac`
✅ `audio/mp4`
✅ `audio/mpeg`
✅ `audio/amr`
✅ `audio/ogg` (with opus codec)

❌ `audio/webm` - **NOT SUPPORTED by WhatsApp**

## Backend Requirements

The backend `/messages/send-media-combined` endpoint must:

### 1. Accept audio/webm from Frontend
```javascript
// Accept the uploaded file
const file = req.file; // From multer or similar
const { to, user_id, room_id } = req.body;

console.log('Received voice note:', {
  originalname: file.originalname,
  mimetype: file.mimetype, // Will be "audio/webm"
  size: file.size,
  to,
  user_id,
  room_id
});
```

### 2. Convert audio/webm to WhatsApp-Compatible Format

**Option A: Use FFmpeg (Recommended)**
```javascript
const ffmpeg = require('fluent-ffmpeg');

// Convert webm to ogg (opus codec maintained)
await new Promise((resolve, reject) => {
  ffmpeg(file.path)
    .toFormat('ogg')
    .audioCodec('libopus')
    .on('end', resolve)
    .on('error', reject)
    .save(outputPath);
});
```

**Option B: Use Cloud Function for Conversion**
```javascript
// If on Google Cloud, use Cloud Functions to convert
// Input: audio/webm from Cloud Storage
// Output: audio/ogg in Cloud Storage
```

### 3. Upload Converted File to Google Cloud Storage
```javascript
const bucket = storage.bucket('your-bucket-name');
const gcsFileName = `voice-notes/${Date.now()}.ogg`;
const file = bucket.file(gcsFileName);

await file.save(convertedBuffer, {
  metadata: {
    contentType: 'audio/ogg',
  },
});

const gcsUrl = `https://storage.googleapis.com/${bucket.name}/${gcsFileName}`;
```

### 4. Send to WhatsApp Cloud API
```javascript
const response = await axios.post(
  `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`,
  {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: phoneNumber,
    type: 'audio',
    audio: {
      link: gcsUrl  // Must be publicly accessible URL with audio/ogg
    }
  },
  {
    headers: {
      'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    }
  }
);
```

### 5. Save to Database
```javascript
await supabase.from('messages').insert({
  room_id: roomId,        // From request body
  content_type: 'voice',
  media_type: 'audio/ogg',  // Converted format
  gcs_url: gcsUrl,
  gcs_filename: gcsFileName,
  file_size: convertedFileSize,
  mime_type: 'audio/ogg',
  original_filename: originalFile.name,
  wa_message_id: response.data.messages[0].id,
  user_id: userId,        // From request body - Agent who sent
  status: 'sent',
});
```

### 6. Emit Socket.IO Event
```javascript
io.to(roomId).emit('new_message', {
  id: messageId,
  room_id: roomId,
  content_type: 'voice',
  media_type: 'audio/ogg',
  gcs_url: gcsUrl,
  // ... other fields
});
```

## Error Handling

The backend should return proper error messages:

```javascript
try {
  // Process file...
} catch (error) {
  console.error('Voice note processing error:', error);
  
  if (error.message.includes('unsupported format')) {
    return res.status(400).json({
      error: 'Unsupported audio format',
      message: 'Only audio/webm, audio/ogg, audio/mp3 are accepted',
      received: req.file.mimetype
    });
  }
  
  if (error.message.includes('conversion failed')) {
    return res.status(500).json({
      error: 'Audio conversion failed',
      message: 'Failed to convert audio to WhatsApp-compatible format'
    });
  }
  
  if (error.message.includes('GCS upload')) {
    return res.status(500).json({
      error: 'Storage upload failed',
      message: 'Failed to upload audio to Google Cloud Storage'
    });
  }
  
  // Generic error
  return res.status(500).json({
    error: 'Internal Server Error',
    message: error.message
  });
}
```

## Dependencies Needed

### For Audio Conversion
```json
{
  "fluent-ffmpeg": "^2.1.2",
  "ffmpeg-static": "^5.2.0"
}
```

### For Cloud Storage
```json
{
  "@google-cloud/storage": "^7.7.0"
}
```

## Environment Variables
```env
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_BUCKET_NAME=your-bucket-name
WHATSAPP_TOKEN=your-whatsapp-api-token
PHONE_NUMBER_ID=your-phone-number-id
```

## Testing Checklist

Backend team should test:

- [ ] Receive audio/webm file from frontend
- [ ] Convert webm to ogg successfully
- [ ] Upload converted file to GCS
- [ ] File is publicly accessible from GCS URL
- [ ] Send audio message to WhatsApp successfully
- [ ] Message appears in WhatsApp app
- [ ] Audio plays correctly in WhatsApp
- [ ] Database record created with correct fields
- [ ] Socket.IO event emitted to frontend
- [ ] Frontend receives and displays voice note

## Current Status

❌ **Production Backend (Cloud Run)**: Returning 500 error when receiving audio/webm
- Needs audio conversion implementation
- Needs proper error handling
- Needs GCS permissions verification

✅ **Frontend**: Correctly recording and uploading audio files
- Records in browser-supported format (webm/ogg)
- Sends as multipart/form-data to backend
- Displays voice notes with audio player

## Priority
🔴 **HIGH** - Voice notes are a critical feature for WhatsApp communication

## Contact
- Frontend implementation: Complete (see ChatWindow.tsx)
- Backend team: Needs to implement conversion pipeline
- DevOps: Verify GCS permissions on production

---

Last Updated: October 26, 2025
