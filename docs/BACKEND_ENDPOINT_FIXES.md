# Backend Endpoint Issues & Required Fixes

## 🚨 Current Issue: "Endpoint not found" when creating leads

### Affected Endpoint:
```
POST /leads
```

### Error Message:
```
Failed to create lead: Endpoint not found
```

---

## 📋 Required Backend Implementation

### 1. **POST /leads** - Create New Lead

**URL:** `POST {{baseUrl}}/leads`

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Ahmad Rizky",
  "phone": "6281234567890",
  "outstanding": 500000000,
  "loan_type": "KPR (Kredit Pemilikan Rumah)",
  "leads_status": "cold",
  "contact_status": "uncontacted",
  "utm_id": "utm-001"
}
```

**Required Fields:**
- `name` (string) - Customer full name
- `phone` (string) - Phone number with country code
- `loan_type` (string) - Type of loan

**Optional Fields:**
- `outstanding` (number) - Outstanding amount, default: 0
- `leads_status` (string) - Status: cold/warm/hot/paid/service/repayment/advocate, default: "cold"
- `contact_status` (string) - Contact status, default: ""
- `utm_id` (string) - UTM tracking ID

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "lead-uuid-123",
    "utm_id": "utm-001",
    "name": "Ahmad Rizky",
    "phone": "6281234567890",
    "outstanding": 500000000,
    "loan_type": "KPR (Kredit Pemilikan Rumah)",
    "leads_status": "cold",
    "contact_status": "uncontacted",
    "created_at": "2025-10-26T10:00:00Z",
    "updated_at": "2025-10-26T10:00:00Z"
  },
  "message": "Lead created successfully"
}
```

**Error Response (400):**
```json
{
  "success": false,
  "error": "Validation error: name is required",
  "message": "Validation error: name is required"
}
```

**Error Response (500):**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Failed to create lead"
}
```

---

## 🔧 Backend Implementation Example (Node.js/Express)

```javascript
// routes/leads.js
const express = require('express');
const router = express.Router();

/**
 * POST /leads - Create new lead
 */
router.post('/leads', async (req, res) => {
  try {
    const {
      name,
      phone,
      outstanding = 0,
      loan_type,
      leads_status = 'cold',
      contact_status = '',
      utm_id = null
    } = req.body;

    // Validation
    if (!name || !phone || !loan_type) {
      return res.status(400).json({
        success: false,
        error: 'Validation error: name, phone, and loan_type are required',
        message: 'Validation error: name, phone, and loan_type are required'
      });
    }

    // Validate phone format (must start with country code)
    if (!phone.match(/^(\+?62|62)/)) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must start with country code (62)',
        message: 'Phone number must start with country code (62)'
      });
    }

    // Create lead in database
    const newLead = await db.leads.create({
      id: generateUUID(), // or use auto-increment
      utm_id,
      name,
      phone,
      outstanding,
      loan_type,
      leads_status,
      contact_status,
      created_at: new Date(),
      updated_at: new Date()
    });

    // ✅ MUST return JSON with this exact format
    return res.status(201).json({
      success: true,
      data: newLead,
      message: 'Lead created successfully'
    });

  } catch (error) {
    console.error('Error creating lead:', error);
    
    // ✅ Error response must also be JSON
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      message: 'Failed to create lead'
    });
  }
});

module.exports = router;
```

---

## 📌 Critical Requirements for ALL Endpoints

### 1. **Always Return JSON**
```javascript
// ❌ WRONG
res.send("Lead created")
res.end()

// ✅ CORRECT
res.json({ success: true, data: {...} })
```

### 2. **Include `success` Field**
```javascript
// Success response
{
  "success": true,
  "data": {...}
}

// Error response
{
  "success": false,
  "error": "Error message"
}
```

### 3. **Set Correct Content-Type**
```javascript
// Express does this automatically with res.json()
res.setHeader('Content-Type', 'application/json');
res.json({...});
```

### 4. **Use Proper HTTP Status Codes**
- `201` - Created (for POST create)
- `200` - OK (for GET, PUT, PATCH)
- `204` - No Content (for DELETE)
- `400` - Bad Request (validation errors)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error (server errors)

---

## 🧪 Testing the Endpoint

### Using cURL:
```bash
curl -X POST http://localhost:8080/leads \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "phone": "6281234567890",
    "loan_type": "KPR",
    "outstanding": 100000000,
    "leads_status": "cold"
  }'
```

### Expected Success Response:
```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "Test User",
    "phone": "6281234567890",
    "loan_type": "KPR",
    "outstanding": 100000000,
    "leads_status": "cold",
    "contact_status": "",
    "created_at": "2025-10-26T...",
    "updated_at": "2025-10-26T..."
  },
  "message": "Lead created successfully"
}
```

---

## 🔗 Related Endpoints to Check

Make sure these endpoints also follow the same format:

1. **PUT /leads/:id** - Update existing lead
2. **PATCH /leads/:id/status** - Update lead status
3. **PATCH /rooms/:id** - Update room (link lead to room)
4. **POST /rooms/:roomId/assign** - Assign user to room

All must return:
```json
{
  "success": true/false,
  "data": {...},
  "message": "..."
}
```

---

## 📞 Contact

If you need clarification on any endpoint format, please check:
- `docs/MESSAGES_API_DOCUMENTATION.md`
- `docs/LEADS_KANBAN_API.md`
- Frontend code: `src/lib/api.ts`

---

## ✅ Checklist for Backend Team

- [ ] Endpoint `POST /leads` exists and accessible
- [ ] Returns JSON with `success: true` on success
- [ ] Returns proper error JSON with `success: false` on error
- [ ] Validates required fields (name, phone, loan_type)
- [ ] Uses status code 201 for successful creation
- [ ] Includes all fields in response data
- [ ] Tested with frontend integration
