# SaLuDo REST API Documentation

## Overview
This REST API provides comprehensive candidate management functionality for the SaLuDo recruitment platform. The API is built with Express.js and TypeScript, following RESTful conventions with a modular architecture.

## Architecture
The API is organized into modular routers for better maintainability:

- **`candidates-core.ts`** - Core candidate CRUD operations
- **`skills.ts`** - Skills management
- **`experience.ts`** - Work experience management  
- **`education.ts`** - Education history management
- **`certifications.ts`** - Professional certifications
- **`strengths-weaknesses.ts`** - Personal attributes management
- **`middleware/`** - Shared validation and error handling

## Base URL
```
http://localhost:3000/api
```

## Authentication
Currently, the API does not implement authentication. This should be added for production use.

## Response Format
All API responses follow this consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": {...},
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## API Endpoints

### Candidates

#### Get All Candidates
- **GET** `/api/candidates`
- **Description**: Retrieve all candidates
- **Response**: Array of candidate objects

**Example Response:**
```json
{
  "success": true,
  "data": [
    {
      "candidateId": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": ["john@example.com"],
      "birthdate": "1990-01-01T00:00:00.000Z",
      "roleApplied": "Software Engineer",
      "status": "APPLIED"
    }
  ],
  "count": 1
}
```

#### Create New Candidate
- **POST** `/api/candidates`
- **Content-Type**: `multipart/form-data` (for file upload) or `application/json`
- **Description**: Create a new candidate profile

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "birthdate": "1990-01-01",
  "roleApplied": "Software Engineer"
}
```

**File Upload:**
- Field name: `resume`
- Supported formats: PDF, DOC, DOCX

#### Get Candidate by ID
- **GET** `/api/candidates/:id`
- **Description**: Retrieve a specific candidate by ID

#### Update Candidate
- **PUT** `/api/candidates/:id`
- **Description**: Update candidate information

**Request Body:**
```json
{
  "name": "Updated Name",
  "status": "INTERVIEWED"
}
```

#### Delete Candidate
- **DELETE** `/api/candidates/:id`
- **Description**: Soft delete a candidate

#### Get Complete Candidate Profile
- **GET** `/api/candidates/:id/full`
- **Description**: Get candidate with all associated data (skills, experience, education, etc.)

### Skills Management

#### Get Candidate Skills
- **GET** `/api/candidates/:candidateId/skills`
- **Description**: Retrieve all skills for a candidate

#### Add Skill
- **POST** `/api/candidates/:candidateId/skills`
- **Description**: Add a new skill to candidate

**Request Body:**
```json
{
  "name": "JavaScript",
  "level": 8,
  "category": "Programming Language"
}
```

#### Update Skill
- **PUT** `/api/candidates/:candidateId/skills/:skillId`
- **Description**: Update an existing skill

#### Remove Skill
- **DELETE** `/api/candidates/:candidateId/skills/:skillId`
- **Description**: Remove a skill from candidate

### Experience Management

#### Get Work Experience
- **GET** `/api/candidates/:candidateId/experience`
- **Description**: Retrieve all work experience for a candidate

#### Add Experience
- **POST** `/api/candidates/:candidateId/experience`
- **Description**: Add work experience

**Request Body:**
```json
{
  "company": "Tech Corp",
  "position": "Software Engineer",
  "startDate": "2020-01-01",
  "endDate": "2023-12-31",
  "description": "Developed web applications"
}
```

#### Update Experience
- **PUT** `/api/candidates/:candidateId/experience/:expId`
- **Description**: Update work experience

#### Remove Experience
- **DELETE** `/api/candidates/:candidateId/experience/:expId`
- **Description**: Remove work experience

### Education Management

#### Get Education History
- **GET** `/api/candidates/:candidateId/education`
- **Description**: Retrieve education history

#### Add Education
- **POST** `/api/candidates/:candidateId/education`
- **Description**: Add education record

**Request Body:**
```json
{
  "institution": "University of Technology",
  "degree": "Bachelor of Computer Science",
  "startDate": "2016-09-01",
  "endDate": "2020-06-30",
  "description": "Computer Science with focus on software engineering"
}
```

#### Update Education
- **PUT** `/api/candidates/:candidateId/education/:eduId`
- **Description**: Update education record

#### Remove Education
- **DELETE** `/api/candidates/:candidateId/education/:eduId`
- **Description**: Remove education record

### Certifications Management

#### Get Certifications
- **GET** `/api/candidates/:candidateId/certifications`
- **Description**: Retrieve all certifications

#### Add Certification
- **POST** `/api/candidates/:candidateId/certifications`
- **Description**: Add a certification

**Request Body:**
```json
{
  "name": "AWS Solutions Architect",
  "issuedBy": "Amazon Web Services",
  "dateIssued": "2023-06-15",
  "expiryDate": "2026-06-15",
  "credentialId": "AWS-SA-123456"
}
```

#### Update Certification
- **PUT** `/api/candidates/:candidateId/certifications/:certId`
- **Description**: Update certification

#### Remove Certification
- **DELETE** `/api/candidates/:candidateId/certifications/:certId`
- **Description**: Remove certification

### Strengths & Weaknesses Management

#### Get Strengths & Weaknesses
- **GET** `/api/candidates/:candidateId/strengths-weaknesses`
- **Description**: Retrieve candidate's strengths and weaknesses

#### Add Strength/Weakness
- **POST** `/api/candidates/:candidateId/strengths-weaknesses`
- **Description**: Add a strength or weakness

**Request Body:**
```json
{
  "type": "strength",
  "description": "Excellent problem-solving skills",
  "category": "Technical"
}
```

#### Update Strength/Weakness
- **PUT** `/api/candidates/:candidateId/strengths-weaknesses/:id`
- **Description**: Update a strength or weakness

#### Remove Strength/Weakness
- **DELETE** `/api/candidates/:candidateId/strengths-weaknesses/:id?type=strength`
- **Description**: Remove a strength or weakness
- **Query Parameters**:
  - `type`: Required. Either "strength" or "weakness"

## Status Codes

- **200**: Success
- **201**: Created
- **400**: Bad Request (validation errors)
- **404**: Not Found
- **500**: Internal Server Error

## Data Models

### Candidate Status
```typescript
enum CandidateStatus {
  APPLIED = "APPLIED",
  SCREENING = "SCREENING", 
  INTERVIEWED = "INTERVIEWED",
  OFFERED = "OFFERED",
  HIRED = "HIRED",
  REJECTED = "REJECTED"
}
```

### Skill Levels
Skill levels are represented as numbers from 1-10:
- 1-3: Beginner
- 4-6: Intermediate  
- 7-8: Advanced
- 9-10: Expert

## Error Handling

The API includes comprehensive error handling:

1. **Validation Errors**: Missing required fields
2. **Not Found Errors**: When candidate/resource doesn't exist
3. **Server Errors**: Database connection issues, etc.

## Rate Limiting

Currently not implemented. Consider adding rate limiting for production use.

## Examples

### Creating a Complete Candidate Profile

1. **Create Candidate:**
```bash
curl -X POST http://localhost:3000/api/candidates \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Alice Johnson",
    "email": "alice@example.com",
    "birthdate": "1992-05-15",
    "roleApplied": "Full Stack Developer"
  }'
```

2. **Add Skills:**
```bash
curl -X POST http://localhost:3000/api/candidates/CANDIDATE_ID/skills \
  -H "Content-Type: application/json" \
  -d '{
    "name": "React",
    "level": 8,
    "category": "Frontend Framework"
  }'
```

3. **Add Experience:**
```bash
curl -X POST http://localhost:3000/api/candidates/CANDIDATE_ID/experience \
  -H "Content-Type: application/json" \
  -d '{
    "company": "StartupXYZ",
    "position": "Frontend Developer", 
    "startDate": "2021-01-15",
    "endDate": "2023-12-30",
    "description": "Built responsive web applications using React and TypeScript"
  }'
```

## Notes

- All dates should be in ISO 8601 format
- File uploads are converted to base64 strings for storage
- The API uses MongoDB ObjectIds for unique identifiers
- Soft deletes are implemented for data integrity

## Future Enhancements

1. Authentication & Authorization
2. Rate limiting
3. API versioning
4. Pagination for large datasets
5. Advanced search and filtering
6. File storage optimization (GridFS)
7. Real-time notifications
8. API caching
