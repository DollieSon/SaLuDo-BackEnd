// Transcripts API route handlers
class TranscriptsAPI {
    constructor(apiClient) {
        this.api = apiClient;
        this.basePath = '/api/transcripts';
    }

    // Get transcripts by candidate
    async getByCandidate(candidateId) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        LoadingState.show('Fetching candidate transcripts...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Upload transcript file
    async uploadTranscript(candidateId, transcriptFile, metadata = {}) {
        if (!candidateId) {
            Helpers.showToast('Please enter a candidate ID', 'warning');
            return;
        }

        if (!transcriptFile) {
            Helpers.showToast('Please select a transcript file', 'warning');
            return;
        }

        // Validate file type
        const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'text/plain', 'application/pdf'];
        if (!Helpers.isValidFileType(transcriptFile, allowedTypes)) {
            Helpers.showToast('Please upload an audio file (MP3, WAV) or text file (TXT, PDF)', 'warning');
            return;
        }

        // Validate file size (50MB max)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (transcriptFile.size > maxSize) {
            Helpers.showToast('Transcript file size must not exceed 50MB', 'warning');
            return;
        }

        LoadingState.show('Uploading transcript...');
        try {
            const formData = new FormData();
            formData.append('transcript', transcriptFile);
            
            // Add metadata
            Object.keys(metadata).forEach(key => {
                if (metadata[key]) {
                    formData.append(key, metadata[key]);
                }
            });

            const response = await this.api.post(`${this.basePath}/${candidateId}/upload`, formData, { isFormData: true });
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Transcript uploaded successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get transcript content
    async getTranscriptContent(candidateId, transcriptId) {
        if (!candidateId || !transcriptId) {
            Helpers.showToast('Please enter candidate ID and transcript ID', 'warning');
            return;
        }

        LoadingState.show('Fetching transcript content...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}/${transcriptId}/content`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Update transcript metadata
    async updateTranscriptMetadata(candidateId, transcriptId, metadata) {
        if (!candidateId || !transcriptId) {
            Helpers.showToast('Please enter candidate ID and transcript ID', 'warning');
            return;
        }

        LoadingState.show('Updating transcript metadata...');
        try {
            const response = await this.api.put(`${this.basePath}/${candidateId}/${transcriptId}`, metadata);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Transcript metadata updated successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Delete transcript
    async deleteTranscript(candidateId, transcriptId) {
        if (!candidateId || !transcriptId) {
            Helpers.showToast('Please enter candidate ID and transcript ID', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to delete this transcript?')) {
            return;
        }

        LoadingState.show('Deleting transcript...');
        try {
            const response = await this.api.delete(`${this.basePath}/${candidateId}/${transcriptId}`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Transcript deleted successfully!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Process transcript (trigger AI transcription)
    async processTranscript(candidateId, transcriptId) {
        if (!candidateId || !transcriptId) {
            Helpers.showToast('Please enter candidate ID and transcript ID', 'warning');
            return;
        }

        LoadingState.show('Processing transcript...');
        try {
            const response = await this.api.post(`${this.basePath}/${candidateId}/${transcriptId}/process`);
            ResponseDisplay.updateResponseUI(response);
            
            if (response.success) {
                Helpers.showToast('Transcript processing started!', 'success');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Get transcription status
    async getTranscriptionStatus(candidateId, transcriptId) {
        if (!candidateId || !transcriptId) {
            Helpers.showToast('Please enter candidate ID and transcript ID', 'warning');
            return;
        }

        LoadingState.show('Checking transcription status...');
        try {
            const response = await this.api.get(`${this.basePath}/${candidateId}/${transcriptId}/status`);
            ResponseDisplay.updateResponseUI(response);
            return response;
        } finally {
            LoadingState.hide();
        }
    }

    // Download transcript
    async downloadTranscript(candidateId, transcriptId) {
        if (!candidateId || !transcriptId) {
            Helpers.showToast('Please enter candidate ID and transcript ID', 'warning');
            return;
        }

        LoadingState.show('Downloading transcript...');
        try {
            const response = await this.api.downloadFile(
                `${this.basePath}/${candidateId}/${transcriptId}/download`,
                `transcript_${transcriptId}.txt`
            );
            
            if (response.success) {
                Helpers.showToast('Transcript downloaded successfully!', 'success');
            } else {
                Helpers.showToast('Failed to download transcript', 'error');
            }
            
            return response;
        } finally {
            LoadingState.hide();
        }
    }
}

// Initialize transcripts API handler
window.transcriptsAPI = new TranscriptsAPI(window.apiClient);

// Event handlers for transcript routes
document.addEventListener('DOMContentLoaded', function() {
    const transcriptButtons = document.querySelectorAll('[data-route="transcripts"]');
    
    transcriptButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const action = this.dataset.action;
            
            switch (action) {
                case 'getByCandidate':
                    const candidateId = document.getElementById('transcriptCandidateId')?.value;
                    await window.transcriptsAPI.getByCandidate(candidateId);
                    break;
                    
                case 'upload':
                    const uploadData = {
                        candidateId: document.getElementById('uploadTranscriptCandidateId')?.value,
                        file: document.getElementById('transcriptFile')?.files?.[0],
                        type: document.getElementById('transcriptType')?.value,
                        notes: document.getElementById('transcriptNotes')?.value
                    };
                    if (uploadData.file) {
                        await window.transcriptsAPI.uploadTranscript(uploadData.candidateId, uploadData.file, {
                            interviewType: uploadData.type,
                            notes: uploadData.notes
                        });
                    } else {
                        Helpers.showToast('Please select a transcript file', 'warning');
                    }
                    break;
                    
                case 'process':
                    const processCandidateId = document.getElementById('processTranscriptCandidateId')?.value;
                    const processTranscriptId = document.getElementById('processTranscriptId')?.value;
                    await window.transcriptsAPI.processTranscript(processCandidateId, processTranscriptId);
                    break;
                    
                case 'getAnalysis':
                    const analysisCandidateId = document.getElementById('analysisTranscriptCandidateId')?.value;
                    const analysisTranscriptId = document.getElementById('analysisTranscriptId')?.value;
                    await window.transcriptsAPI.getAnalysis(analysisCandidateId, analysisTranscriptId);
                    break;
                    
                case 'delete':
                    const deleteCandidateId = document.getElementById('deleteTranscriptCandidateId')?.value;
                    const deleteTranscriptId = document.getElementById('deleteTranscriptId')?.value;
                    await window.transcriptsAPI.deleteTranscript(deleteCandidateId, deleteTranscriptId);
                    break;
                    
                case 'download':
                    const downloadCandidateId = document.getElementById('downloadTranscriptCandidateId')?.value;
                    const downloadTranscriptId = document.getElementById('downloadTranscriptId')?.value;
                    await window.transcriptsAPI.downloadTranscript(downloadCandidateId, downloadTranscriptId);
                    break;
                    
                default:
                    Helpers.showToast(`Action "${action}" not implemented yet`, 'info');
            }
        });
    });
});

console.log('✅ Transcripts API handlers loaded');
