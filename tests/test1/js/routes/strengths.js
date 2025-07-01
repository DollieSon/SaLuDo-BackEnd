// Strengths & Weaknesses API route handlers
class StrengthsAPI {
    constructor(apiClient) {
        this.api = apiClient;
        this.basePath = '/api/strengths-weaknesses';
    }

    // Get strengths and weaknesses by candidate
    async getByCandidate(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching candidate strengths and weaknesses...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Add strength to candidate
    async addStrength(candidateId, strengthData) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Adding strength to candidate...');
        try {
            const response = await this.api.post(`${this.basePath}/${candidateId}/strengths`, strengthData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Strength added to candidate successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Add weakness to candidate
    async addWeakness(candidateId, weaknessData) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Adding weakness to candidate...');
        try {
            const response = await this.api.post(`${this.basePath}/${candidateId}/weaknesses`, weaknessData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Weakness added to candidate successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update strength
    async updateStrength(candidateId, strengthId, updateData) {
        if (!candidateId || !strengthId) {
            Helpers.showToast('Please enter candidate ID and strength ID', 'warning');
            return;
        }

        LoadingState.show('Updating strength...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/strengths/${strengthId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Strength updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update weakness
    async updateWeakness(candidateId, weaknessId, updateData) {
        if (!candidateId || !weaknessId) {
            Helpers.showToast('Please enter candidate ID and weakness ID', 'warning');
            return;
        }

        LoadingState.show('Updating weakness...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/weaknesses/${weaknessId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Weakness updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Remove strength from candidate
    async removeStrength(candidateId, strengthId) {
        if (!candidateId || !strengthId) {
            Helpers.showToast('Please enter candidate ID and strength ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this strength?')) {
            return;
        }

        LoadingState.show('Removing strength from candidate...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}/strengths/${strengthId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Strength removed successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Remove weakness from candidate
    async removeWeakness(candidateId, weaknessId) {
        if (!candidateId || !weaknessId) {
            Helpers.showToast('Please enter candidate ID and weakness ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this weakness?')) {
            return;
        }

        LoadingState.show('Removing weakness from candidate...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}/weaknesses/${weaknessId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Weakness removed successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Generic update method for strengths/weaknesses
    async updateItem(candidateId, itemId, updateData) {
        if (!candidateId || !itemId) {
            Helpers.showToast('Please enter candidate ID and item ID', 'warning');
            return;
        }

        LoadingState.show('Updating item...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/${itemId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Item updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Generic remove method for strengths/weaknesses
    async removeItem(candidateId, itemId) {
        if (!candidateId || !itemId) {
            Helpers.showToast('Please enter candidate ID and item ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this item?')) {
            return;
        }

        LoadingState.show('Removing item...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}/${itemId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Item removed successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }
}

// Initialize strengths API handler
window.strengthsAPI = new StrengthsAPI(window.apiClient);

// Event handlers for strengths routes
document.addEventListener('DOMContentLoaded', function() {
    const strengthsButtons = document.querySelectorAll('[data-route="strengths"]');
    
    strengthsButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getByCandidate':
                    const candidateId = document.getElementById('strengthsCandidateId')?.value;
                    await window.strengthsAPI.getByCandidate(candidateId);
                    break;
                    
                case 'addStrength':
                    const strengthData = {
                        candidateId: document.getElementById('addStrengthCandidateId')?.value,
                        name: document.getElementById('strengthName')?.value,
                        description: document.getElementById('strengthDescription')?.value,
                        score: document.getElementById('strengthScore')?.value
                    };
                    await window.strengthsAPI.addStrength(strengthData.candidateId, {
                        name: strengthData.name,
                        description: strengthData.description,
                        score: strengthData.score ? parseFloat(strengthData.score) : null
                    });
                    break;
                    
                case 'addWeakness':
                    const weaknessData = {
                        candidateId: document.getElementById('addWeaknessCandidateId')?.value,
                        name: document.getElementById('weaknessName')?.value,
                        description: document.getElementById('weaknessDescription')?.value,
                        score: document.getElementById('weaknessScore')?.value
                    };
                    await window.strengthsAPI.addWeakness(weaknessData.candidateId, {
                        name: weaknessData.name,
                        description: weaknessData.description,
                        impactScore: weaknessData.score ? parseFloat(weaknessData.score) : null
                    });
                    break;
                    
                case 'update':
                    const updateCandidateId = document.getElementById('updateStrengthCandidateId')?.value;
                    const updateItemId = document.getElementById('updateStrengthId')?.value;
                    const updateData = {
                        name: document.getElementById('updateStrengthName')?.value,
                        description: document.getElementById('updateStrengthDescription')?.value
                    };
                    await window.strengthsAPI.updateItem(updateCandidateId, updateItemId, updateData);
                    break;
                    
                case 'delete':
                    const deleteCandidateId = document.getElementById('deleteStrengthCandidateId')?.value;
                    const deleteItemId = document.getElementById('deleteStrengthId')?.value;
                    await window.strengthsAPI.removeItem(deleteCandidateId, deleteItemId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Strengths & Weaknesses API handlers loaded');
