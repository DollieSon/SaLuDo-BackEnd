// Education API route handlers
class EducationAPI {
    constructor(apiClient) {
        this.api = apiClient;
        this.basePath = '/api/education';
    }

    // Get education records by candidate
    async getByCandidate(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching education records...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Add education record
    async add(candidateId, educationData) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        const { institution, degree, field, startDate, endDate, gpa } = educationData;

        // Validation
        if (!institution || !degree || !field || !startDate) {
            Helpers.showToast('Please fill in all required fields (institution, degree, field, start date)', 'warning');
            return;
        }

        LoadingState.show('Adding education record...');
        try {
            const data = {
                institution,
                degree,
                fieldOfStudy: field,
                startDate,
                endDate: endDate || null,
                gpa: gpa ? parseFloat(gpa) : null
            };

            const response = await this.api.post(`${this.basePath}/${candidateId}`, data);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                this.clearAddForm();
                Helpers.showToast('Education record added successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update education record
    async update(candidateId, educationId, updateData) {
        if (!candidateId || !educationId) {
            Helpers.showToast('Please enter both candidate ID and education ID', 'warning');
            return;
        }

        LoadingState.show('Updating education record...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/${educationId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Education record updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Delete education record
    async delete(candidateId, educationId) {
        if (!candidateId || !educationId) {
            Helpers.showToast('Please enter both candidate ID and education ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to delete this education record?')) {
            return;
        }

        LoadingState.show('Deleting education record...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}/${educationId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Education record deleted successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Helper method to clear the add form
    clearAddForm() {
        const fields = [
            'addEducationCandidateId',
            'educationInstitution',
            'educationDegree',
            'educationField',
            'educationStartDate',
            'educationEndDate',
            'educationGPA'
        ];

        fields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) element.value = '';
        });
    }

    // Helper method to get add form data
    getAddFormData() {
        return {
            candidateId: document.getElementById('addEducationCandidateId')?.value || '',
            institution: document.getElementById('educationInstitution')?.value || '',
            degree: document.getElementById('educationDegree')?.value || '',
            field: document.getElementById('educationField')?.value || '',
            startDate: document.getElementById('educationStartDate')?.value || '',
            endDate: document.getElementById('educationEndDate')?.value || '',
            gpa: document.getElementById('educationGPA')?.value || ''
        };
    }

    // Helper method to get update form data
    getUpdateFormData() {
        return {
            candidateId: document.getElementById('updateEducationCandidateId')?.value || '',
            educationId: document.getElementById('updateEducationId')?.value || '',
            institution: document.getElementById('updateEducationInstitution')?.value || '',
            degree: document.getElementById('updateEducationDegree')?.value || ''
        };
    }
}

// Initialize education API handler
window.educationAPI = new EducationAPI(window.apiClient);

// Event handlers for education routes
document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to education test buttons
    const educationButtons = document.querySelectorAll('[data-route="education"]');
    
    educationButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getByCandidate':
                    const candidateId = document.getElementById('educationCandidateId')?.value;
                    await window.educationAPI.getByCandidate(candidateId);
                    break;
                    
                case 'add':
                    const addData = window.educationAPI.getAddFormData();
                    await window.educationAPI.add(addData.candidateId, addData);
                    break;
                    
                case 'update':
                    const updateData = window.educationAPI.getUpdateFormData();
                    await window.educationAPI.update(updateData.candidateId, updateData.educationId, {
                        institution: updateData.institution,
                        degree: updateData.degree
                    });
                    break;
                    
                case 'delete':
                    const deleteCandidateId = document.getElementById('deleteEducationCandidateId')?.value;
                    const deleteEducationId = document.getElementById('deleteEducationId')?.value;
                    await window.educationAPI.delete(deleteCandidateId, deleteEducationId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Education API handlers loaded');
