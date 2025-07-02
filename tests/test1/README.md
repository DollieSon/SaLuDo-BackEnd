# SaLuDo REST API Tester

A comprehensive, modular HTML/CSS/JavaScript application for testing the SaLuDo REST API endpoints.

## 🚀 Features

- **Complete API Coverage**: Test all candidate, job, skill, education, experience, certification, strength/weakness, and transcript endpoints
- **Modern UI**: Clean, responsive design with dark/light theme support
- **Modular Architecture**: Organized into separate modules for maintainability
- **Real-time Feedback**: Live server status monitoring and response display
- **File Upload Support**: Test file upload endpoints with drag-and-drop
- **Keyboard Shortcuts**: Efficient navigation and actions
- **Data Export**: Download API responses as JSON files
- **Local Storage**: Persistent settings and preferences

## 📁 File Structure

```
tests/test1/
├── index.html                 # Main application file
├── css/
│   ├── styles.css            # Core styles and layout
│   ├── components.css        # Reusable component styles
│   └── themes.css            # Theme-specific styling
├── js/
│   ├── utils/
│   │   ├── helpers.js        # Utility functions
│   │   └── api.js            # API client and request handling
│   ├── routes/
│   │   ├── candidates.js     # Candidate API handlers
│   │   ├── jobs.js           # Job API handlers
│   │   ├── skills.js         # Skill API handlers
│   │   ├── education.js      # Education API handlers
│   │   ├── experience.js     # Experience API handlers
│   │   ├── certifications.js # Certification API handlers
│   │   ├── strengths.js      # Strengths/Weaknesses API handlers
│   │   └── transcripts.js    # Transcript API handlers
│   ├── components/
│   │   ├── tabs.js           # Tab navigation functionality
│   │   └── theme.js          # Theme management
│   └── main.js               # Application initialization and coordination
└── README.md                 # This file
```

## 🎯 How to Use

### 1. **Setup**
- Open `index.html` in a modern web browser
- Ensure your SaLuDo API server is running
- Update the base URL if needed (default: `http://localhost:3000`)

### 2. **Test Connection**
- Click "Test Connection" to verify API availability
- Server status is displayed in the header and updates automatically

### 3. **Navigate Tabs**
- Use tab buttons or keyboard shortcuts (Ctrl+1-8) to switch between API categories
- Each tab contains relevant endpoints for that category

### 4. **Make API Calls**
- Fill in required fields for each endpoint
- Click test buttons to execute API calls
- View responses in the dedicated response section

### 5. **File Uploads**
- For endpoints requiring files (resume, transcripts), use the file input fields
- Supported formats and size limits are validated automatically

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+1-8` | Switch between tabs |
| `Ctrl+Shift+T` | Toggle dark/light theme |
| `Ctrl+/` | Show keyboard shortcuts help |
| `Ctrl+R` | Clear response area |
| `Ctrl+D` | Download current response |
| `Escape` | Clear focus/close modals |

## 🎨 Themes

The application supports both light and dark themes:
- **Auto Detection**: Automatically matches your system preference
- **Manual Toggle**: Click the theme button (🌙/☀️) in the header
- **Persistent**: Your theme preference is saved locally

## 🔧 API Endpoints Covered

### Candidates
- GET /api/candidates - Get all candidates
- GET /api/candidates/:id - Get candidate by ID
- POST /api/candidates - Create new candidate
- PUT /api/candidates/:id/apply-job/:jobId - Apply candidate to job
- PUT /api/candidates/:id/remove-job - Remove candidate from job
- GET /api/candidates/by-job/:jobId - Get candidates by job
- GET /api/candidates/without-job - Get candidates without job

### Jobs
- GET /api/jobs - Get all jobs
- GET /api/jobs/:id - Get job by ID
- POST /api/jobs - Create new job
- GET /api/jobs/search - Search jobs
- PUT /api/jobs/:id - Update job
- DELETE /api/jobs/:id - Delete job

### Skills
- GET /api/skills - Get all skills
- GET /api/skills/master - Get skill master data
- POST /api/skills/:candidateId - Add skill to candidate
- PUT /api/skills/:candidateId/:skillName - Update candidate skill
- DELETE /api/skills/:candidateId/:skillName - Remove skill from candidate

### Education, Experience, Certifications, Strengths/Weaknesses, Transcripts
- Similar CRUD operations for each category
- File upload support for transcripts
- Candidate-specific data management

## 🛠️ Technical Details

### Architecture
- **Modular Design**: Each route type has its own handler module
- **Component-Based**: Reusable UI components (tabs, theme, etc.)
- **Event-Driven**: Efficient event handling and state management
- **Progressive Enhancement**: Works without JavaScript for basic functionality

### Browser Compatibility
- Modern browsers (Chrome 60+, Firefox 55+, Safari 11+, Edge 79+)
- ES6+ features used (async/await, classes, modules)
- CSS Grid and Flexbox for layout
- Native fetch API for requests

### Performance
- Lazy loading of API responses
- Debounced user input handling
- Optimized CSS with minimal reflows
- Local storage for caching preferences

## 🐛 Troubleshooting

### Common Issues

1. **Server Connection Failed**
   - Verify API server is running on the correct port
   - Check base URL configuration
   - Ensure CORS is enabled on the API server

2. **File Upload Errors**
   - Check file size limits (10MB for resumes, 50MB for transcripts)
   - Verify file types are supported
   - Ensure proper form encoding

3. **Response Not Displaying**
   - Check browser console for JavaScript errors
   - Verify API response format is valid JSON
   - Clear browser cache and reload

### Debug Mode
Open browser developer tools and check the console for detailed request/response logs and any error messages.

## 📝 Customization

### Adding New Endpoints
1. Add HTML form elements in the appropriate tab
2. Create handler functions in the corresponding route module
3. Attach event listeners in the module's DOMContentLoaded handler

### Styling Changes
- Modify CSS custom properties in `styles.css` for theme colors
- Add new component styles in `components.css`
- Update theme-specific styles in `themes.css`

### Functionality Extensions
- Add new utility functions to `helpers.js`
- Extend the APIClient class in `api.js` for new request types
- Create new component modules following the existing pattern

## 🤝 Contributing

1. Follow the existing code structure and naming conventions
2. Add appropriate error handling and user feedback
3. Test across different browsers and screen sizes
4. Update documentation for new features

## 📄 License

This API tester is part of the SaLuDo project and follows the same licensing terms.

---

**Built with ❤️ for efficient API testing and development**
