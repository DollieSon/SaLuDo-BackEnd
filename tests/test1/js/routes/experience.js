// Experience API route handlers
class ExperienceAPI {
    constructor(apiClient) {
        this.api = apiClient;
        this.basePath = '/api/candidates';
    }

    // Get experience by candidate
    async getByCandidate(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching candidate experience...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}/experience`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Add experience to candidate
    async addToCandidate(candidateId, experienceData) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        // Validation
        if (!experienceData.company || !experienceData.position || !experienceData.startDate) {
            Helpers.showToast('Please fill in required fields (company, position, start date)', 'warning');
            return;
        }

        LoadingState.show('Adding experience to candidate...');
        try {
            const response = await this.api.post(`${this.basePath}/${candidateId}/experience`, experienceData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                this.clearExperienceForm();
                Helpers.showToast('Experience added to candidate successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update candidate experience
    async updateCandidateExperience(candidateId, experienceId, updateData) {
        if (!candidateId || !experienceId) {
            Helpers.showToast('Please enter candidate ID and experience ID', 'warning');
            return;
        }

        LoadingState.show('Updating candidate experience...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/experience/${experienceId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Experience updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Remove experience from candidate
    async removeFromCandidate(candidateId, experienceId) {
        if (!candidateId || !experienceId) {
            Helpers.showToast('Please enter candidate ID and experience ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this experience record?')) {
            return;
        }

        LoadingState.show('Removing experience from candidate...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}/experience/${experienceId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Experience removed successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Helper methods
    clearExperienceForm() {
        const companyInput = document.getElementById('experienceCompany');
        const positionInput = document.getElementById('experiencePosition');
        const descriptionInput = document.getElementById('experienceDescription');
        const startDateInput = document.getElementById('experienceStartDate');
        const endDateInput = document.getElementById('experienceEndDate');
        const currentJobInput = document.getElementById('experienceCurrentJob');

        if (companyInput) companyInput.value = '';
        if (positionInput) positionInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        if (currentJobInput) currentJobInput.checked = false;
    }

    getExperienceFormData() {
        const companyInput = document.getElementById('experienceCompany');
        const positionInput = document.getElementById('experiencePosition');
        const descriptionInput = document.getElementById('experienceDescription');
        const startDateInput = document.getElementById('experienceStartDate');
        const endDateInput = document.getElementById('experienceEndDate');
        const currentJobInput = document.getElementById('experienceCurrentJob');

        return {
            company: companyInput?.value || '',
            position: positionInput?.value || '',
            description: descriptionInput?.value || '',
            startDate: startDateInput?.value || '',
            endDate: endDateInput?.value || '',
            isCurrentJob: currentJobInput?.checked || false
        };
    }
}

// Initialize experience API handler
window.experienceAPI = new ExperienceAPI(window.apiClient);

// Event handlers for experience routes
document.addEventListener('DOMContentLoaded', function() {
    const experienceButtons = document.querySelectorAll('[data-route="experience"]');
    
    experienceButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getByCandidate':
                    const candidateId = document.getElementById('experienceCandidateId')?.value;
                    await window.experienceAPI.getByCandidate(candidateId);
                    break;
                    
                case 'addToCandidate':
                    const addCandidateId = document.getElementById('experienceAddCandidateId')?.value;
                    const formData = window.experienceAPI.getExperienceFormData();
                    await window.experienceAPI.addToCandidate(addCandidateId, formData);
                    break;
                    
                case 'updateExperience':
                    const updateCandidateId = document.getElementById('experienceUpdateCandidateId')?.value;
                    const experienceId = document.getElementById('experienceUpdateId')?.value;
                    const updateData = window.experienceAPI.getExperienceFormData();
                    await window.experienceAPI.updateCandidateExperience(updateCandidateId, experienceId, updateData);
                    break;
                    
                case 'removeExperience':
                    const removeCandidateId = document.getElementById('experienceRemoveCandidateId')?.value;
                    const removeExperienceId = document.getElementById('experienceRemoveId')?.value;
                    await window.experienceAPI.removeFromCandidate(removeCandidateId, removeExperienceId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Experience API handlers loaded');

        // Validation
        if (!experienceData.company || !experienceData.position || !experienceData.startDate) {
            Helpers.showToast('Please fill in required fields (company, position, start date)', 'warning');
            return;
        }

        LoadingState.show('Adding experience to candidate...');
        try {
            const response = await this.api.post(`${this.basePath}/${candidateId}/experience`, experienceData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                this.clearExperienceForm();
                Helpers.showToast('Experience added to candidate successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update candidate experience
    async updateCandidateExperience(candidateId, experienceId, updateData) {
        if (!candidateId || !experienceId) {
            Helpers.showToast('Please enter candidate ID and experience ID', 'warning');
            return;
        }

        LoadingState.show('Updating candidate experience...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/experience/${experienceId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Experience updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Remove experience from candidate
    async removeFromCandidate(candidateId, experienceId) {
        if (!candidateId || !experienceId) {
            Helpers.showToast('Please enter candidate ID and experience ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this experience record?')) {
            return;
        }

        LoadingState.show('Removing experience from candidate...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}/experience/${experienceId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Experience removed successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Helper methods
    clearExperienceForm() {
        const companyInput = document.getElementById('experienceCompany');
        const positionInput = document.getElementById('experiencePosition');
        const descriptionInput = document.getElementById('experienceDescription');
        const startDateInput = document.getElementById('experienceStartDate');
        const endDateInput = document.getElementById('experienceEndDate');
        const currentJobInput = document.getElementById('experienceCurrentJob');

        if (companyInput) companyInput.value = '';
        if (positionInput) positionInput.value = '';
        if (descriptionInput) descriptionInput.value = '';
        if (startDateInput) startDateInput.value = '';
        if (endDateInput) endDateInput.value = '';
        if (currentJobInput) currentJobInput.checked = false;
    }

    getExperienceFormData() {
        const companyInput = document.getElementById('experienceCompany');
        const positionInput = document.getElementById('experiencePosition');
        const descriptionInput = document.getElementById('experienceDescription');
        const startDateInput = document.getElementById('experienceStartDate');
        const endDateInput = document.getElementById('experienceEndDate');
        const currentJobInput = document.getElementById('experienceCurrentJob');

        return {
            company: companyInput?.value || '',
            position: positionInput?.value || '',
            description: descriptionInput?.value || '',
            startDate: startDateInput?.value || '',
            endDate: endDateInput?.value || '',
            isCurrentJob: currentJobInput?.checked || false
        };
    }
}

// Initialize experience API handler
window.experienceAPI = new ExperienceAPI(window.apiClient);

// Event handlers for experience routes
document.addEventListener('DOMContentLoaded', function() {
    const experienceButtons = document.querySelectorAll('[data-route="experience"]');
    
    experienceButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getByCandidate':
                    const candidateId = document.getElementById('experienceCandidateId')?.value;
                    await window.experienceAPI.getByCandidate(candidateId);
                    break;
                    
                case 'addToCandidate':
                    const addCandidateId = document.getElementById('experienceAddCandidateId')?.value;
                    const formData = window.experienceAPI.getExperienceFormData();
                    await window.experienceAPI.addToCandidate(addCandidateId, formData);
                    break;
                    
                case 'updateExperience':
                    const updateCandidateId = document.getElementById('experienceUpdateCandidateId')?.value;
                    const experienceId = document.getElementById('experienceUpdateId')?.value;
                    const updateData = window.experienceAPI.getExperienceFormData();
                    await window.experienceAPI.updateCandidateExperience(updateCandidateId, experienceId, updateData);
                    break;
                    
                case 'removeExperience':
                    const removeCandidateId = document.getElementById('experienceRemoveCandidateId')?.value;
                    const removeExperienceId = document.getElementById('experienceRemoveId')?.value;
                    await window.experienceAPI.removeFromCandidate(removeCandidateId, removeExperienceId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Experience API handlers loaded');

        LoadingState.show('Adding experience to candidate...');
        try {
            const response = await this.api.post(`${this.basePath}/${candidateId}`, experienceData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Experience added to candidate successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update candidate experience
    async updateCandidateExperience(candidateId, experienceId, updateData) {
        if (!candidateId || !experienceId) {
            Helpers.showToast('Please enter candidate ID and experience ID', 'warning');
            return;
        }

        LoadingState.show('Updating candidate experience...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/${experienceId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Experience updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Remove experience from candidate
    async removeFromCandidate(candidateId, experienceId) {
        if (!candidateId || !experienceId) {
            Helpers.showToast('Please enter candidate ID and experience ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this experience record?')) {
            return;
        }

        LoadingState.show('Removing experience from candidate...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}/${experienceId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Experience removed successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }
}

// Initialize experience API handler
window.experienceAPI = new ExperienceAPI(window.apiClient);

// Event handlers for experience routes
document.addEventListener('DOMContentLoaded', function() {
    const experienceButtons = document.querySelectorAll('[data-route="experience"]');
    
    experienceButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getByCandidate':
                    const candidateId = document.getElementById('experienceCandidateId')?.value;
                    await window.experienceAPI.getByCandidate(candidateId);
                    break;
                    
                case 'add':
                    const addData = {
                        candidateId: document.getElementById('addExperienceCandidateId')?.value,
                        jobTitle: document.getElementById('experienceJobTitle')?.value,
                        company: document.getElementById('experienceCompany')?.value,
                        startDate: document.getElementById('experienceStartDate')?.value,
                        endDate: document.getElementById('experienceEndDate')?.value,
                        description: document.getElementById('experienceDescription')?.value,
                        location: document.getElementById('experienceLocation')?.value
                    };
                    await window.experienceAPI.addToCandidate(addData.candidateId, {
                        position: addData.jobTitle,
                        company: addData.company,
                        startDate: addData.startDate,
                        endDate: addData.endDate,
                        description: addData.description,
                        location: addData.location
                    });
                    break;
                    
                case 'update':
                    const updateCandidateId = document.getElementById('updateExperienceCandidateId')?.value;
                    const updateExperienceId = document.getElementById('updateExperienceId')?.value;
                    const updateData = {
                        position: document.getElementById('updateExperienceJobTitle')?.value,
                        company: document.getElementById('updateExperienceCompany')?.value
                    };
                    await window.experienceAPI.updateCandidateExperience(updateCandidateId, updateExperienceId, updateData);
                    break;
                    
                case 'delete':
                    const deleteCandidateId = document.getElementById('deleteExperienceCandidateId')?.value;
                    const deleteExperienceId = document.getElementById('deleteExperienceId')?.value;
                    await window.experienceAPI.removeFromCandidate(deleteCandidateId, deleteExperienceId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Experience API handlers loaded');
