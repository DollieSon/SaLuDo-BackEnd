// Skills API route handlers
class SkillsAPI {
    constructor(apiClient) {
        this.api = apiClient;
        this.basePath = '/api/skills';
    }

    // Get all skills
    async getAll() {
        LoadingState.show('Fetching skills...');
        try {
            const response = await this.api.get(this.basePath);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get skill master data
    async getMasterData() {
        LoadingState.show('Fetching skill master data...');
        try {
            const response = await this.api.get(`${this.basePath}/master`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get skills by candidate
    async getByCandidate(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching candidate skills...');
        try {
            const response = await this.api.get(`${this.basePath}/candidate/${candidateId}`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Add skill to candidate
    async addToCandidate(candidateId, skillData) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        const { skillName, level } = skillData;
        if (!skillName || level === undefined) {
            Helpers.showToast('Please enter skill name and level', 'warning');
            return;
        }

        if (level < 0 || level > 10) {
            Helpers.showToast('Skill level must be between 0 and 10', 'warning');
            return;
        }

        LoadingState.show('Adding skill to candidate...');
        try {
            const response = await this.api.post(`${this.basePath}/${candidateId}`, {
                skillName,
                level: parseFloat(level)
            });
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Skill added to candidate successfully!', 'success');
                this.clearAddSkillForm();
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update skill level for candidate
    async updateSkillLevel(candidateId, skillId, updateData) {
        if (!candidateId || !skillId) {
            Helpers.showToast('Please enter candidate ID and skill ID', 'warning');
            return;
        }

        LoadingState.show('Updating skill level...');
        try {
            const response = await this.api.put(`${this.basePath}/candidate/${candidateId}/${skillId}`, updateData);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Skill level updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Remove skill from candidate
    async removeFromCandidate(candidateId, skillId) {
        if (!candidateId || !skillId) {
            Helpers.showToast('Please enter candidate ID and skill ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to remove this skill?')) {
            return;
        }

        LoadingState.show('Removing skill from candidate...');
        try {
            const response = await this.api.delete(`${this.basePath}/candidate/${candidateId}/${skillId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Skill removed successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Helper method to clear the add skill form
    clearAddSkillForm() {
        const candidateIdInput = document.getElementById('skillCandidateId');
        const skillNameInput = document.getElementById('skillName');
        const skillLevelInput = document.getElementById('skillLevel');

        if (candidateIdInput) candidateIdInput.value = '';
        if (skillNameInput) skillNameInput.value = '';
        if (skillLevelInput) skillLevelInput.value = '';
    }

    // Helper method to get add skill form data
    getAddSkillFormData() {
        const candidateIdInput = document.getElementById('skillCandidateId');
        const skillNameInput = document.getElementById('skillName');
        const skillLevelInput = document.getElementById('skillLevel');

        return {
            candidateId: candidateIdInput?.value || '',
            skillName: skillNameInput?.value || '',
            level: skillLevelInput?.value || ''
        };
    }
}

// Initialize skills API handler
window.skillsAPI = new SkillsAPI(window.apiClient);

// Event handlers for skill routes
document.addEventListener('DOMContentLoaded', function() {
    // Attach event listeners to skill test buttons
    const skillButtons = document.querySelectorAll('[data-route="skills"]');
    
    skillButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getAll':
                    await window.skillsAPI.getAll();
                    break;
                    
                case 'getMaster':
                    await window.skillsAPI.getMasterData();
                    break;
                    
                case 'getByCandidate':
                    const candidateId = document.getElementById('skillsByCandidateId')?.value;
                    await window.skillsAPI.getByCandidate(candidateId);
                    break;
                    
                case 'addToCandidate':
                    const formData = window.skillsAPI.getAddSkillFormData();
                    await window.skillsAPI.addToCandidate(formData.candidateId, {
                        skillName: formData.skillName,
                        level: formData.level
                    });
                    break;
                    
                case 'updateLevel':
                    const updateCandidateId = document.getElementById('updateSkillCandidateId')?.value;
                    const updateSkillId = document.getElementById('updateSkillId')?.value;
                    const newLevel = document.getElementById('updateSkillLevel')?.value;
                    await window.skillsAPI.updateSkillLevel(updateCandidateId, updateSkillId, { level: parseFloat(newLevel) });
                    break;
                    
                case 'removeFromCandidate':
                    const deleteCandidateId = document.getElementById('deleteSkillCandidateId')?.value;
                    const deleteSkillId = document.getElementById('deleteSkillId')?.value;
                    await window.skillsAPI.removeFromCandidate(deleteCandidateId, deleteSkillId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Skills API handlers loaded');
