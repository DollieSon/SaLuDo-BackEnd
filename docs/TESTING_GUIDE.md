# SaLuDo REST API Setup & Testing Guide

## Quick Start

### 1. Start the Server
```bash
cd "Saludo Back-End/SaLuDo-BackEnd"
npm run dev
```

### 2. Test Basic Endpoints

#### Test Server Health
```bash
curl http://localhost:3000/
# Expected: "Hello from Render!"

curl http://localhost:3000/api/data
# Expected: {"message": "Here is your data."}
```

#### Test Candidates API

**Create a new candidate:**
```bash
curl -X POST http://localhost:3000/api/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": ["alice@example.com"],
    "birthdate": "1992-05-15",
    "roleApplied": "Software Engineer"
  }'
```

**Get all candidates:**
```bash
curl http://localhost:3000/api/candidates
```

**Get candidate by ID (replace CANDIDATE_ID):**
```bash
curl http://localhost:3000/api/candidates/CANDIDATE_ID
```

**Add a skill to candidate:**
```bash
curl -X POST http://localhost:3000/api/candidates/CANDIDATE_ID/skills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "JavaScript",
    "level": 8,
    "category": "Programming Language"
  }'
```

**Get candidate skills:**
```bash
curl http://localhost:3000/api/candidates/CANDIDATE_ID/skills
```

**Add work experience:**
```bash
curl -X POST http://localhost:3000/api/candidates/CANDIDATE_ID/experience \
  -H "Content-Type: application/json" \
  -d '{
    "company": "Tech Corp",
    "position": "Developer",
    "startDate": "2021-01-01",
    "endDate": "2023-12-31",
    "description": "Worked on web applications"
  }'
```

**Add education:**
```bash
curl -X POST http://localhost:3000/api/candidates/CANDIDATE_ID/education \
  -H "Content-Type: application/json" \
  -d '{
    "institution": "University of Tech",
    "degree": "Computer Science",
    "startDate": "2018-09-01",
    "endDate": "2022-06-30"
  }'
```

**Get complete profile:**
```bash
curl http://localhost:3000/api/candidates/CANDIDATE_ID/full
```

### 3. Using Thunder Client / Postman

Import this collection for easy testing:

**Base URL:** `http://localhost:3000`

**Headers for all requests:**
```
Content-Type: application/json
```

### 4. Testing with Frontend

Update your frontend API calls to use the new endpoints:

```typescript
// Old way
const response = await fetch('/api/users');

// New way  
const response = await fetch('/api/candidates');
```

## Available Endpoints

### Core Candidates
- `GET /api/candidates` - Get all candidates
- `POST /api/candidates` - Create candidate  
- `GET /api/candidates/:id` - Get candidate by ID
- `PUT /api/candidates/:id` - Update candidate
- `DELETE /api/candidates/:id` - Delete candidate
- `GET /api/candidates/:id/full` - Get complete profile

### Skills Management
- `GET /api/candidates/:id/skills` - Get skills
- `POST /api/candidates/:id/skills` - Add skill
- `PUT /api/candidates/:id/skills/:skillId` - Update skill
- `DELETE /api/candidates/:id/skills/:skillId` - Remove skill

### Experience Management  
- `GET /api/candidates/:id/experience` - Get experience
- `POST /api/candidates/:id/experience` - Add experience
- `PUT /api/candidates/:id/experience/:expId` - Update experience
- `DELETE /api/candidates/:id/experience/:expId` - Remove experience

### Education Management
- `GET /api/candidates/:id/education` - Get education
- `POST /api/candidates/:id/education` - Add education
- `PUT /api/candidates/:id/education/:eduId` - Update education
- `DELETE /api/candidates/:id/education/:eduId` - Remove education

### Certifications Management
- `GET /api/candidates/:id/certifications` - Get certifications
- `POST /api/candidates/:id/certifications` - Add certification
- `PUT /api/candidates/:id/certifications/:certId` - Update certification
- `DELETE /api/candidates/:id/certifications/:certId` - Remove certification

### Strengths & Weaknesses
- `GET /api/candidates/:id/strengths-weaknesses` - Get all
- `POST /api/candidates/:id/strengths-weaknesses` - Add strength/weakness
- `PUT /api/candidates/:id/strengths-weaknesses/:swId` - Update 
- `DELETE /api/candidates/:id/strengths-weaknesses/:swId?type=strength` - Remove

## Response Format

All responses follow this format:

```json
{
  "success": true,
  "data": {...},
  "message": "Optional message"
}
```

Error responses:
```json
{
  "success": false, 
  "message": "Error description",
  "error": "Detailed error"
}
```

## Troubleshooting

### Common Issues:

1. **"Cannot connect to database"**
   - Check MongoDB connection in `mongo_db.ts`
   - Ensure MongoDB is running

2. **"Candidate not found"**
   - Verify the candidate ID exists
   - Check if candidate was soft-deleted

3. **"Missing required fields"**
   - Check the request body has all required fields
   - Refer to API documentation for required fields

4. **500 Internal Server Error**
   - Check server logs in terminal
   - Verify all services are properly initialized

### Debug Mode:
Set `NODE_ENV=development` to see detailed error messages.

## Next Steps

1. Test all endpoints with your data
2. Update your frontend to use the new API structure
3. Add authentication/authorization as needed
4. Implement pagination for large datasets
5. Add API rate limiting for production
