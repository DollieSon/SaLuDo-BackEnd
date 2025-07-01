// Jobs API route handlers
class JobsAPI {
    constructor(apiClient) {
        this.api = apiClient;
        this.basePath = '/api/jobs';
    }

    // Get all jobs
    async getAll() {
        LoadingState.show('Fetching jobs...');
        try {
            const response = await this.api.get(this.basePath);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get job by ID
    async getById(jobId) {
        if (!jobId) {
            Helpers.showToast('Please enter a job ID', 'warning');
            return;
        }

        LoadingState.show('Fetching job...');
        try {
            const response = await this.api.get(`${this.basePath}/${jobId}`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Create new job
    async create(jobData) {
        const { jobName, jobDescription, skills, requiredLevels, evidence } = jobData;

        // Validation - only name and description are required
        if (!jobName || !jobDescription) {
            Helpers.showToast('Please fill in job name and description', 'warning');
            return;
        }

        let jobSkills = [];

        // Handle skills if provided
        if (skills && skills.trim()) {
            if (!requiredLevels || !requiredLevels.trim()) {
                Helpers.showToast('If skills are provided, required levels must also be provided', 'warning');
                return;
            }

            // Parse skills, levels, and evidence
            const skillIds = skills.split(',').map(s => s.trim()).filter(s => s);
            const levels = requiredLevels.split(',').map(l => parseFloat(l.trim())).filter(l => !isNaN(l));
            const evidenceArray = evidence ? evidence.split(',').map(e => e.trim()).filter(e => e) : [];

            if (skillIds.length !== levels.length) {
                Helpers.showToast('Number of skills must match number of required levels', 'warning');
                return;
            }

            // Validate levels (0-10)
            const invalidLevels = levels.filter(level => level < 0 || level > 10);
            if (invalidLevels.length > 0) {
                Helpers.showToast('Required levels must be between 0 and 10', 'warning');
                return;
            }

            // Build job skills array
            jobSkills = skillIds.map((skillId, index) => ({
                skillId,
                requiredLevel: levels[index],
                evidence: evidenceArray[index] || undefined // Add evidence if provided
            }));
        }

        LoadingState.show('Creating job...');
        try {
            const payload = {
                jobName,
                jobDescription,
                skills: jobSkills // Will be empty array if no skills provided
            };

            console.log('📝 Sending job creation payload:', payload);
            console.log('📝 Job Name:', jobName);
            console.log('📝 Job Description:', jobDescription);
            
            const response = await this.api.post(this.basePath, payload);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                this.clearCreateForm();
                Helpers.showToast('Job created successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update job
    async update(jobId, updateData) {
        if (!jobId) {
            Helpers.showToast('Please enter a job ID', 'warning');
            return;
        }

        LoadingState.show('Updating job...');
        try {
            const response = await this.api.put(`${this.basePath}/${jobId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Job updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Delete job
    async delete(jobId) {
        if (!jobId) {
            Helpers.showToast('Please enter a job ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to delete this job?')) {
            return;
        }

        LoadingState.show('Deleting job...');
        try {
            const response = await this.api.delete(`${this.basePath}/${jobId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Job deleted successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Search jobs
    async search(query) {
        if (!query) {
            Helpers.showToast('Please enter a search query', 'warning');
            return;
        }

        LoadingState.show('Searching jobs...');
        try {
            const response = await this.api.get(`${this.basePath}/search`, { q: query });
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get job summary
    async getSummary(jobId) {
        if (!jobId) {
            Helpers.showToast('Please enter a job ID', 'warning');
            return;
        }

        LoadingState.show('Fetching job summary...');
        try {
            const response = await this.api.get(`${this.basePath}/${jobId}/summary`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get job skills
    async getSkills(jobId) {
        if (!jobId) {
            Helpers.showToast('Please enter a job ID', 'warning');
            return;
        }

        LoadingState.show('Fetching job skills...');
        try {
            const response = await this.api.get(`${this.basePath}/${jobId}/skills`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Add skill to job
    async addSkill(jobId, skillData) {
        if (!jobId) {
            Helpers.showToast('Please enter a job ID', 'warning');
            return;
        }

        const { skillId, requiredLevel, evidence } = skillData;
        if (!skillId || requiredLevel === undefined) {
            Helpers.showToast('Please enter skill ID and required level', 'warning');
            return;
        }

        if (requiredLevel < 0 || requiredLevel > 10) {
            Helpers.showToast('Required level must be between 0 and 10', 'warning');
            return;
        }

        LoadingState.show('Adding skill to job...');
        try {
            const payload = {
                skillId,
                requiredLevel: parseFloat(requiredLevel)
            };
            
            // Add evidence if provided
            if (evidence && evidence.trim()) {
                payload.evidence = evidence.trim();
            }
            
            console.log('🔍 Adding skill to job - Payload:', payload);
            console.log('🔍 Job ID:', jobId);
            console.log('🔍 Endpoint:', `${this.basePath}/${jobId}/skills`);
            
            const response = await this.api.post(`${this.basePath}/${jobId}/skills`, payload);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Skill added to job successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update job skill
    async updateSkill(jobId, skillId, requiredLevel) {
        if (!jobId || !skillId) {
            Helpers.showToast('Please enter job ID and skill ID', 'warning');
            return;
        }

        if (requiredLevel < 0 || requiredLevel > 10) {
            Helpers.showToast('Required level must be between 0 and 10', 'warning');
            return;
        }

        LoadingState.show('Updating job skill...');
        try {
            const response = await this.api.put(`${this.basePath}/${jobId}/skills/${skillId}`, {
                requiredLevel: parseFloat(requiredLevel)
            });
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Job skill updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Remove skill from job
    async removeSkill(jobId, skillId) {
        if (!jobId || !skillId) {
            Helpers.showToast('Please enter job ID and skill ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this skill from the job?')) {
            return;
        }

        LoadingState.show('Removing skill from job...');
        try {
            const response = await this.api.delete(`${this.basePath}/${jobId}/skills/${skillId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Skill removed from job successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get jobs with pagination
    async getWithPagination(page = 1, limit = 10) {
        LoadingState.show('Fetching jobs...');
        try {
            const response = await this.api.get(this.basePath, { page, limit });
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get jobs by skill
    async getBySkill(skillId) {
        if (!skillId) {
            Helpers.showToast('Please enter a skill ID', 'warning');
            return;
        }

        LoadingState.show('Fetching jobs by skill...');
        try {
            const response = await this.api.get(`${this.basePath}/by-skill/${skillId}`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get available jobs (active)
    async getAvailable() {
        LoadingState.show('Fetching available jobs...');
        try {
            const response = await this.api.get(`${this.basePath}/available`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Helper method to clear the create form
    clearCreateForm() {
        const nameInput = document.getElementById('jobName');
        const descriptionInput = document.getElementById('jobDescription');
        const skillsInput = document.getElementById('jobSkills');
        const levelsInput = document.getElementById('jobLevels');

        if (nameInput) nameInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (skillsInput) skillsInput.value = '';
        if (levelsInput) levelsInput.value = '';
    }

    // Helper method to get form data
    getCreateFormData() {
        const nameInput = document.getElementById('jobName');
        const descriptionInput = document.getElementById('jobDescription');
        const skillsInput = document.getElementById('jobSkills');
        const levelsInput = document.getElementById('jobLevels');
        const evidenceInput = document.getElementById('jobEvidence');

        console.log('📝 Form elements found:');
        console.log('   - jobName input:', nameInput);
        console.log('   - jobDescription input:', descriptionInput);
        console.log('   - jobSkills input:', skillsInput);
        
        const formData = {
            jobName: nameInput?.value || '',
            jobDescription: descriptionInput?.value || '',
            skills: skillsInput?.value || '',
            requiredLevels: levelsInput?.value || '',
            evidence: evidenceInput?.value || ''
        };
        
        console.log('📝 Form data collected:', formData);
        return formData;
    }
}

// Initialize jobs API handler
window.jobsAPI = new JobsAPI(window.apiClient);

// Event handlers for job routes
document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to job test buttons
    const jobButtons = document.querySelectorAll('[data-route="jobs"]');
    
    jobButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getAll':
                    await window.jobsAPI.getAll();
                    break;
                    
                case 'getById':
                    const jobId = document.getElementById('jobId')?.value;
                    await window.jobsAPI.getById(jobId);
                    break;
                    
                case 'create':
                    const formData = window.jobsAPI.getCreateFormData();
                    await window.jobsAPI.create(formData);
                    break;
                    
                case 'update':
                    const updateJobId = document.getElementById('updateJobId')?.value;
                    const updateData = {
                        jobName: document.getElementById('updateJobName')?.value,
                        jobDescription: document.getElementById('updateJobDescription')?.value
                    };
                    await window.jobsAPI.update(updateJobId, updateData);
                    break;
                    
                case 'delete':
                    const deleteJobId = document.getElementById('deleteJobId')?.value;
                    await window.jobsAPI.delete(deleteJobId);
                    break;
                    
                case 'search':
                    const searchQuery = document.getElementById('jobSearchQuery')?.value;
                    await window.jobsAPI.search(searchQuery);
                    break;
                    
                case 'addSkill':
                    const addSkillJobId = document.getElementById('addSkillJobId')?.value;
                    const addSkillId = document.getElementById('addSkillId')?.value;
                    const addSkillLevel = parseFloat(document.getElementById('addSkillLevel')?.value);
                    const addSkillEvidence = document.getElementById('addSkillEvidence')?.value;
                    
                    if (!addSkillJobId || !addSkillId || isNaN(addSkillLevel)) {
                        Helpers.showToast('Please fill in Job ID, Skill ID, and Required Level', 'warning');
                        return;
                    }
                    
                    const skillData = {
                        skillId: addSkillId,
                        requiredLevel: addSkillLevel,
                        evidence: addSkillEvidence || undefined
                    };
                    await window.jobsAPI.addSkill(addSkillJobId, skillData);
                    break;
                    
                case 'removeSkill':
                    const removeSkillJobId = document.getElementById('removeSkillJobId')?.value;
                    const removeSkillId = document.getElementById('removeSkillId')?.value;
                    await window.jobsAPI.removeSkill(removeSkillJobId, removeSkillId);
                    break;
                    
                case 'getSkills':
                    const getJobSkillsId = document.getElementById('getJobSkillsId')?.value;
                    await window.jobsAPI.getSkills(getJobSkillsId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Jobs API handlers loaded');
