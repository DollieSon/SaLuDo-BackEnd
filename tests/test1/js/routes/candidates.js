// Candidates API route handlers
class CandidatesAPI {
    constructor(apiClient) {
        this.api = apiClient;
        this.basePath = '/api/candidates';
    }

    // Get all candidates
    async getAll() {
        LoadingState.show('Fetching candidates...');
        try {
            const response = await this.api.get(this.basePath);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get candidate by ID
    async getById(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching candidate...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Create new candidate
    async create(candidateData, resumeFile) {
        const { name, email, birthdate, roleApplied } = candidateData;

        // Validation
        if (!name || !email || !birthdate) {
            Helpers.showToast('Please fill in all required fields (name, email, birthdate)', 'warning');
            return;
        }

        if (!Helpers.isValidEmail(email)) {
            Helpers.showToast('Please enter a valid email address', 'warning');
            return;
        }

        if (!resumeFile) {
            Helpers.showToast('Please select a resume file', 'warning');
            return;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!Helpers.isValidFileType(resumeFile, allowedTypes)) {
            Helpers.showToast('Please upload a PDF or Word document', 'warning');
            return;
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (resumeFile.size > maxSize) {
            Helpers.showToast('Resume file size must not exceed 10MB', 'warning');
            return;
        }

        LoadingState.show('Creating candidate...');
        try {
            // Create FormData
            const formData = new FormData();
            formData.append('resume', resumeFile);
            formData.append('name', name);
            formData.append('email', email);
            formData.append('birthdate', birthdate);
            if (roleApplied) {
                formData.append('roleApplied', roleApplied);
            }

            const response = await this.api.post(this.basePath, formData, { isFormData: true });
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                this.clearCreateForm();
                Helpers.showToast('Candidate created successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update candidate
    async update(candidateId, updateData) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Updating candidate...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Candidate updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Delete candidate
    async delete(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to delete this candidate?')) {
            return;
        }

        LoadingState.show('Deleting candidate...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Candidate deleted successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Apply candidate to job
    async applyToJob(candidateId, jobId) {
        if (!candidateId || !jobId) {
            Helpers.showToast('Please enter both candidate ID and job ID', 'warning');
            return;
        }

        LoadingState.show('Applying candidate to job...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/apply-job/${jobId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Candidate applied to job successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Remove candidate from job
    async removeFromJob(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Removing candidate from job...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/remove-job`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Candidate removed from job successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get candidates by job
    async getByJob(jobId) {
        if (!jobId) {
            Helpers.showToast('Please enter a job ID', 'warning');
            return;
        }

        LoadingState.show('Fetching candidates by job...');
        try {
            const response = await this.api.get(`${this.basePath}/by-job/${jobId}`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get candidates without job
    async getWithoutJob() {
        LoadingState.show('Fetching candidates without job...');
        try {
            const response = await this.api.get(`${this.basePath}/without-job`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get candidates by status
    async getByStatus(status) {
        if (!status) {
            Helpers.showToast('Please select a status', 'warning');
            return;
        }

        LoadingState.show('Fetching candidates by status...');
        try {
            const response = await this.api.get(this.basePath, { status });
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Search candidates
    async search(query) {
        if (!query) {
            Helpers.showToast('Please enter a search query', 'warning');
            return;
        }

        LoadingState.show('Searching candidates...');
        try {
            const response = await this.api.get(`${this.basePath}/search`, { q: query });
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get candidate summary
    async getSummary(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching candidate summary...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}/summary`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get candidate personal info
    async getPersonalInfo(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching personal information...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}/personal-info`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get candidate resume data
    async getResumeData(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching resume data...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}/resume`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get candidate interview data
    async getInterviewData(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching interview data...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}/interview`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update candidate resume
    async updateResume(candidateId, resumeFile) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        if (!resumeFile) {
            Helpers.showToast('Please select a resume file', 'warning');
            return;
        }

        // Validate file type
        const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!Helpers.isValidFileType(resumeFile, allowedTypes)) {
            Helpers.showToast('Please upload a PDF or Word document', 'warning');
            return;
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (resumeFile.size > maxSize) {
            Helpers.showToast('Resume file size must not exceed 10MB', 'warning');
            return;
        }

        LoadingState.show('Updating resume...');
        try {
            const formData = new FormData();
            formData.append('resume', resumeFile);

            const response = await this.api.put(`${this.basePath}/${candidateId}/resume`, formData, { isFormData: true });
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Resume updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Download candidate resume
    async downloadResume(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Downloading resume...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}/resume/download`, {}, { responseType: 'blob' });
            
            if (response.success && response.data) {
                // Create download link
                const url = window.URL.createObjectURL(response.data);
                const link = document.createElement('a');
                link.href = url;
                link.download = `candidate-${candidateId}-resume.pdf`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                
                Helpers.showToast('Resume downloaded successfully!', 'success');
            }
            
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Helper method to clear the create form
    clearCreateForm() {
        const nameInput = document.getElementById('candidateName');
        const emailInput = document.getElementById('candidateEmail');
        const birthdateInput = document.getElementById('candidateBirthdate');
        const roleInput = document.getElementById('candidateRole');
        const resumeInput = document.getElementById('candidateResume');

        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (birthdateInput) birthdateInput.value = '';
        if (roleInput) roleInput.value = '';
        if (resumeInput) resumeInput.value = '';
    }

    // Helper method to get form data
    getCreateFormData() {
        const nameInput = document.getElementById('candidateName');
        const emailInput = document.getElementById('candidateEmail');
        const birthdateInput = document.getElementById('candidateBirthdate');
        const roleInput = document.getElementById('candidateRole');
        const resumeInput = document.getElementById('candidateResume');

        return {
            name: nameInput?.value || '',
            email: emailInput?.value || '',
            birthdate: birthdateInput?.value || '',
            roleApplied: roleInput?.value || null,
            resumeFile: resumeInput?.files?.[0] || null
        };
    }
}

// Initialize candidates API handler
window.candidatesAPI = new CandidatesAPI(window.apiClient);

// Event handlers for candidate routes
document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to candidate test buttons
    const candidateButtons = document.querySelectorAll('[data-route="candidates"]');
    
    candidateButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getAll':
                    await window.candidatesAPI.getAll();
                    break;
                    
                case 'getById':
                    const candidateId = document.getElementById('candidateId')?.value;
                    await window.candidatesAPI.getById(candidateId);
                    break;
                    
                case 'create':
                    const formData = window.candidatesAPI.getCreateFormData();
                    await window.candidatesAPI.create(formData, formData.resumeFile);
                    break;
                    
                case 'applyJob':
                    const applyJobCandidateId = document.getElementById('applyJobCandidateId')?.value;
                    const applyJobId = document.getElementById('applyJobId')?.value;
                    await window.candidatesAPI.applyToJob(applyJobCandidateId, applyJobId);
                    break;
                    
                case 'getByJob':
                    const candidatesByJobId = document.getElementById('candidatesByJobId')?.value;
                    await window.candidatesAPI.getByJob(candidatesByJobId);
                    break;
                    
                case 'getWithoutJob':
                    await window.candidatesAPI.getWithoutJob();
                    break;
                    
                case 'update':
                    const updateCandidateId = document.getElementById('updateCandidateId')?.value;
                    const updateData = {
                        name: document.getElementById('updateCandidateName')?.value,
                        email: document.getElementById('updateCandidateEmail')?.value,
                        birthdate: document.getElementById('updateCandidateBirthdate')?.value,
                        roleApplied: document.getElementById('updateCandidateRole')?.value
                    };
                    await window.candidatesAPI.update(updateCandidateId, updateData);
                    break;
                    
                case 'delete':
                    const deleteCandidateId = document.getElementById('deleteCandidateId')?.value;
                    await window.candidatesAPI.delete(deleteCandidateId);
                    break;
                    
                case 'removeFromJob':
                    const removeJobCandidateId = document.getElementById('removeJobCandidateId')?.value;
                    await window.candidatesAPI.removeFromJob(removeJobCandidateId);
                    break;
                    
                case 'getByStatus':
                    const status = document.getElementById('candidateStatus')?.value;
                    await window.candidatesAPI.getByStatus(status);
                    break;
                    
                case 'search':
                    const searchQuery = document.getElementById('candidateSearchQuery')?.value;
                    await window.candidatesAPI.search(searchQuery);
                    break;
                    
                case 'getSummary':
                    const summaryCandidateId = document.getElementById('summaryCandidateId')?.value;
                    await window.candidatesAPI.getSummary(summaryCandidateId);
                    break;
                    
                case 'getPersonalInfo':
                    const personalInfoCandidateId = document.getElementById('personalInfoCandidateId')?.value;
                    await window.candidatesAPI.getPersonalInfo(personalInfoCandidateId);
                    break;
                    
                case 'getResume':
                    const resumeCandidateId = document.getElementById('resumeCandidateId')?.value;
                    await window.candidatesAPI.getResumeData(resumeCandidateId);
                    break;
                    
                case 'updateResume':
                    const updateResumeCandidateId = document.getElementById('updateResumeCandidateId')?.value;
                    const newResumeFile = document.getElementById('newResumeFile')?.files?.[0];
                    if (newResumeFile) {
                        await window.candidatesAPI.updateResume(updateResumeCandidateId, newResumeFile);
                    } else {
                        Helpers.showToast('Please select a resume file', 'warning');
                    }
                    break;
                    
                case 'downloadResume':
                    const downloadResumeCandidateId = document.getElementById('downloadResumeCandidateId')?.value;
                    await window.candidatesAPI.downloadResume(downloadResumeCandidateId);
                    break;
                    
                case 'getInterviewData':
                    const interviewCandidateId = document.getElementById('interviewCandidateId')?.value;
                    await window.candidatesAPI.getInterviewData(interviewCandidateId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Candidates API handlers loaded');
