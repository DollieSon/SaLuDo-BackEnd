// Certifications API route handlers
class CertificationsAPI {
    constructor(apiClient) {
        this.api = apiClient;
        this.basePath = '/api/certifications';
    }

    // Get certifications by candidate
    async getByCandidate(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching candidate certifications...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Add certification to candidate
    async addToCandidate(candidateId, certificationData) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Adding certification to candidate...');
        try {
            const response = await this.api.post(`${this.basePath}/${candidateId}`, certificationData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Certification added to candidate successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update candidate certification
    async updateCandidateCertification(candidateId, certificationId, updateData) {
        if (!candidateId || !certificationId) {
            Helpers.showToast('Please enter candidate ID and certification ID', 'warning');
            return;
        }

        LoadingState.show('Updating candidate certification...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/${certificationId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Certification updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Remove certification from candidate
    async removeFromCandidate(candidateId, certificationId) {
        if (!candidateId || !certificationId) {
            Helpers.showToast('Please enter candidate ID and certification ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this certification?')) {
            return;
        }

        LoadingState.show('Removing certification from candidate...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}/${certificationId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Certification removed successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }
}

// Initialize certifications API handler
window.certificationsAPI = new CertificationsAPI(window.apiClient);

// Event handlers for certification routes
document.addEventListener('DOMContentLoaded', function() {
    const certificationButtons = document.querySelectorAll('[data-route="certifications"]');
    
    certificationButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getByCandidate':
                    const candidateId = document.getElementById('certificationCandidateId')?.value;
                    await window.certificationsAPI.getByCandidate(candidateId);
                    break;
                    
                case 'add':
                    const addData = {
                        candidateId: document.getElementById('addCertificationCandidateId')?.value,
                        name: document.getElementById('certificationName')?.value,
                        issuer: document.getElementById('certificationIssuer')?.value,
                        issueDate: document.getElementById('certificationIssueDate')?.value,
                        expiryDate: document.getElementById('certificationExpiryDate')?.value,
                        credentialId: document.getElementById('certificationCredentialId')?.value,
                        url: document.getElementById('certificationUrl')?.value
                    };
                    await window.certificationsAPI.addToCandidate(addData.candidateId, {
                        name: addData.name,
                        issuingOrganization: addData.issuer,
                        issueDate: addData.issueDate,
                        expiryDate: addData.expiryDate,
                        credentialId: addData.credentialId,
                        credentialUrl: addData.url
                    });
                    break;
                    
                case 'update':
                    const updateCandidateId = document.getElementById('updateCertificationCandidateId')?.value;
                    const updateCertificationId = document.getElementById('updateCertificationId')?.value;
                    const updateData = {
                        name: document.getElementById('updateCertificationName')?.value,
                        issuingOrganization: document.getElementById('updateCertificationIssuer')?.value
                    };
                    await window.certificationsAPI.updateCandidateCertification(updateCandidateId, updateCertificationId, updateData);
                    break;
                    
                case 'delete':
                    const deleteCandidateId = document.getElementById('deleteCertificationCandidateId')?.value;
                    const deleteCertificationId = document.getElementById('deleteCertificationId')?.value;
                    await window.certificationsAPI.removeFromCandidate(deleteCandidateId, deleteCertificationId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Certifications API handlers loaded');
