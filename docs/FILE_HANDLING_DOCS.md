# File Handling Implementation Documentation

## Overview
The SaLuDo backend now includes comprehensive file handling for candidate resumes with the following features:

- **Required resume upload** during candidate creation
- **File validation** (type, size, content)
- **GridFS storage** for scalable file management
- **Resume metadata** tracking and management
- **File download, update, and deletion** operations
- **Ready for AI resume parsing** integration

## Architecture

### 1. Data Models

#### ResumeMetadata Interface
```typescript
interface ResumeMetadata {
    fileId: string;          // GridFS file ID
    filename: string;        // Original filename
    contentType: string;     // MIME type
    size: number;           // File size in bytes
    uploadedAt: Date;       // Upload timestamp
    parsedAt?: Date;        // When AI parsing completed
    parseStatus?: 'pending' | 'completed' | 'failed';
}
```

#### Updated Candidate Model
- `resumeMetadata?: ResumeMetadata` - Stores file metadata instead of file content
- `hasResume()` method updated to check for fileId
- All data interfaces updated to use ResumeMetadata

### 2. File Storage

#### GridFS Configuration
- **Bucket name**: `resumes`
- **Collections**: `resumes.files` and `resumes.chunks`
- **Metadata**: Includes candidateId, contentType, uploadedBy
- **Automatic chunking** for large files

#### File Validation Rules
- **Required formats**: PDF, DOC, DOCX
- **Maximum size**: 10MB
- **MIME type validation**: Strict content-type checking
- **File presence**: Resume is mandatory for candidate creation

### 3. API Endpoints

#### Core Candidate Operations
```
POST /api/candidates
- Requires multipart/form-data with resume file
- Validates file type and size
- Creates candidate with resume metadata
- Stores file in GridFS
```

#### Resume Management
```
GET /api/candidates/:id/resume
- Downloads resume file
- Sets appropriate headers for file type
- Streams file content

PUT /api/candidates/:id/resume
- Updates existing resume
- Deletes old file from GridFS
- Uploads new file with validation

DELETE /api/candidates/:id/resume
- Removes file from GridFS
- Clears resume metadata

GET /api/candidates/:id/resume/metadata
- Returns resume metadata without file content
- Includes upload status and parsing information

POST /api/candidates/:id/resume/parse
- Placeholder for AI resume parsing
- Updates parse status
- Ready for future AI integration
```

### 4. Service Layer

#### CandidateService Methods
```typescript
// File operations
addCandidate(name, email, birthdate, roleApplied, resumeFile)
getResumeFile(candidateId): { stream, metadata }
updateResumeFile(candidateId, resumeFile)
deleteResumeFile(candidateId)
hasResume(candidateId): boolean
getResumeMetadata(candidateId): ResumeMetadata
```

#### File Upload Process
1. **Validation** - Check file type, size, presence
2. **GridFS Upload** - Stream to MongoDB GridFS
3. **Metadata Creation** - Store file information
4. **Database Update** - Link metadata to candidate
5. **Cleanup** - Handle upload errors gracefully

### 5. Frontend Integration

#### HTML API Tester Updates
- **File input** for resume upload
- **Drag-and-drop** support (planned)
- **Resume management** section with all operations
- **File validation** feedback
- **Download functionality** with proper file handling

#### FormData Support
- **multipart/form-data** encoding
- **File stream** handling
- **Progress tracking** (planned)
- **Error handling** for file operations

## Usage Examples

### 1. Creating Candidate with Resume
```javascript
const formData = new FormData();
formData.append('name', 'John Doe');
formData.append('email', 'john@example.com');
formData.append('birthdate', '1990-01-01');
formData.append('roleApplied', 'Software Engineer');
formData.append('resume', fileInput.files[0]);

const response = await fetch('/api/candidates', {
    method: 'POST',
    body: formData
});
```

### 2. Downloading Resume
```javascript
const response = await fetch(`/api/candidates/${candidateId}/resume`);
const blob = await response.blob();
const url = URL.createObjectURL(blob);
// Create download link or display file
```

### 3. Getting Resume Metadata
```javascript
const response = await fetch(`/api/candidates/${candidateId}/resume/metadata`);
const metadata = await response.json();
console.log('File info:', metadata.data);
```

## Security Considerations

### 1. File Validation
- **MIME type verification** prevents malicious uploads
- **File size limits** prevent storage abuse
- **Extension checking** as additional validation layer

### 2. Access Control
- **Candidate-specific** file access
- **Authentication required** for file operations (planned)
- **Authorization checks** for file downloads

### 3. Error Handling
- **Graceful upload failures** with cleanup
- **File corruption** detection
- **Storage quota** management
- **Virus scanning** integration (planned)

## Future Enhancements

### 1. AI Resume Parsing
- **Text extraction** from PDF/DOC files
- **Automatic skill detection** using SkillMaster database
- **Experience parsing** to populate experience data
- **Education extraction** to education records
- **Bulk skill addition** from parsed content

### 2. Advanced Features
- **Resume versioning** - Keep history of uploads
- **Thumbnail generation** for quick preview
- **Full-text search** across resume content
- **Batch processing** for multiple uploads
- **CDN integration** for faster downloads

### 3. Monitoring and Analytics
- **Upload success rates** tracking
- **File size distribution** analysis
- **Parse success metrics** for AI integration
- **Storage usage** monitoring

## Testing

### Automated Tests
- **File upload validation** tests
- **GridFS storage** verification
- **Metadata consistency** checks
- **Error handling** scenarios
- **File operations** integration tests

### Test Script
Run `node test-file-handling.js` to execute comprehensive file handling tests including:
- Candidate creation with resume
- File validation (type, size)
- Resume download and metadata
- File update and deletion
- Error handling scenarios

## Performance Considerations

### 1. File Storage
- **GridFS chunking** for large files
- **Streaming operations** to reduce memory usage
- **Asynchronous processing** for uploads
- **Connection pooling** for database operations

### 2. Scalability
- **Horizontal scaling** with MongoDB sharding
- **File system abstraction** for cloud storage migration
- **Caching strategies** for frequently accessed files
- **Load balancing** for file operations

This implementation provides a robust foundation for file handling that integrates seamlessly with the existing normalized skills system and provides a clear path for future AI-powered resume parsing capabilities.
