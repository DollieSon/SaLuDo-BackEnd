// Main application initialization and coordination
class SaLuDoAPITester {
    constructor() {
        this.version = '1.0.0';
        this.apiClient = window.apiClient;
        this.isInitialized = false;
        this.serverStatus = 'unknown';
        
        // Bind methods
        this.init = this.init.bind(this);
        this.checkServerStatus = this.checkServerStatus.bind(this);
        this.updateServerStatus = this.updateServerStatus.bind(this);
    }

    async init() {
        if (this.isInitialized) {
            console.log('Application already initialized');
            return;
        }

        console.log(`🚀 Initializing SaLuDo API Tester v${this.version}`);

        try {
            // Initialize core components
            await this.initializeComponents();
            
            // Set up event listeners
            this.attachGlobalEventListeners();
            
            // Load user preferences
            this.loadUserPreferences();
            
            // Initial server status check
            await this.checkServerStatus();
            
            // Set up periodic server status checks
            this.startServerStatusMonitoring();
            
            this.isInitialized = true;
            console.log('✅ Application initialized successfully');
            
            // Show welcome message
            this.showWelcomeMessage();
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            Helpers.showToast('Failed to initialize application', 'error', 5000);
        }
    }

    async initializeComponents() {
        // Components are initialized by their respective modules
        // This method can be used for any additional setup
        
        // Wait for essential components to be ready
        const maxWait = 5000; // 5 seconds
        const startTime = Date.now();
        
        while (!window.tabManager || !window.themeManager) {
            if (Date.now() - startTime > maxWait) {
                throw new Error('Essential components failed to initialize within timeout');
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    attachGlobalEventListeners() {
        // Base URL change handler
        const baseUrlInput = document.getElementById('baseUrl');
        if (baseUrlInput) {
            baseUrlInput.addEventListener('change', (e) => {
                const newUrl = e.target.value.trim();
                if (newUrl && Helpers.isValidUrl(newUrl)) {
                    this.apiClient.setBaseURL(newUrl);
                    this.saveUserPreferences();
                    this.checkServerStatus();
                    Helpers.showToast(`API base URL updated to: ${newUrl}`, 'success', 3000);
                } else {
                    Helpers.showToast('Please enter a valid URL', 'warning');
                    e.target.value = this.apiClient.baseURL;
                }
            });
        }

        // Test connection button
        const testConnectionBtn = document.getElementById('testConnection');
        if (testConnectionBtn) {
            testConnectionBtn.addEventListener('click', () => {
                this.checkServerStatus();
            });
        }

        // Clear response button
        const clearResponseBtn = document.getElementById('clearResponse');
        if (clearResponseBtn) {
            clearResponseBtn.addEventListener('click', () => {
                ResponseDisplay.clearResponse();
                Helpers.showToast('Response cleared', 'info', 1500);
            });
        }

        // Copy response button
        const copyResponseBtn = document.getElementById('copyResponse');
        if (copyResponseBtn) {
            copyResponseBtn.addEventListener('click', () => {
                ResponseDisplay.copyResponse();
            });
        }

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeyboardShortcuts(e);
        });

        // Handle application errors
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
            Helpers.showToast('An unexpected error occurred', 'error', 4000);
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            Helpers.showToast('An unexpected error occurred', 'error', 4000);
        });

        // Handle visibility changes (for pausing/resuming monitoring)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseServerStatusMonitoring();
            } else {
                this.resumeServerStatusMonitoring();
            }
        });
    }

    handleGlobalKeyboardShortcuts(e) {
        // Ctrl+/ to show help
        if (e.ctrlKey && e.key === '/') {
            e.preventDefault();
            this.showKeyboardShortcuts();
        }

        // Ctrl+R to clear response
        if (e.ctrlKey && e.key === 'r') {
            e.preventDefault();
            ResponseDisplay.clearResponse();
        }

        // Ctrl+D to download response
        if (e.ctrlKey && e.key === 'd') {
            e.preventDefault();
            this.downloadResponse();
        }

        // Escape to close modals or clear focus
        if (e.key === 'Escape') {
            document.activeElement?.blur();
        }
    }

    async checkServerStatus() {
        console.log('🔍 Checking server status...');
        LoadingState.setButtonLoading(document.getElementById('testConnection'), true);
        
        try {
            const result = await this.apiClient.testConnection();
            this.updateServerStatus(result.success ? 'online' : 'offline', result);
            
            if (result.success) {
                Helpers.showToast(`Server is online (${result.responseTime}ms)`, 'success', 2000);
            } else {
                Helpers.showToast('Server is offline or unreachable', 'error', 3000);
            }
            
        } catch (error) {
            console.error('Server status check failed:', error);
            this.updateServerStatus('offline', { error: error.message });
            Helpers.showToast('Failed to check server status', 'error', 3000);
        } finally {
            LoadingState.setButtonLoading(document.getElementById('testConnection'), false);
        }
    }

    updateServerStatus(status, details = {}) {
        this.serverStatus = status;
        
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (statusIndicator) {
            statusIndicator.className = `status-indicator ${status}`;
        }
        
        if (statusText) {
            const statusMessages = {
                online: `Online (${details.responseTime || '?'}ms)`,
                offline: 'Offline',
                unknown: 'Checking...'
            };
            statusText.textContent = statusMessages[status] || 'Unknown';
        }

        // Store last check time
        this.lastStatusCheck = new Date();
    }

    startServerStatusMonitoring() {
        // Check server status every 30 seconds
        this.statusCheckInterval = setInterval(() => {
            if (!document.hidden) {
                this.checkServerStatus();
            }
        }, 30000);
    }

    pauseServerStatusMonitoring() {
        if (this.statusCheckInterval) {
            clearInterval(this.statusCheckInterval);
            this.statusCheckInterval = null;
        }
    }

    resumeServerStatusMonitoring() {
        if (!this.statusCheckInterval) {
            this.startServerStatusMonitoring();
        }
    }

    loadUserPreferences() {
        // Load saved base URL
        const savedBaseUrl = Helpers.getStorageItem('saludo-api-base-url');
        if (savedBaseUrl) {
            const baseUrlInput = document.getElementById('baseUrl');
            if (baseUrlInput) {
                baseUrlInput.value = savedBaseUrl;
                this.apiClient.setBaseURL(savedBaseUrl);
            }
        }
    }

    saveUserPreferences() {
        // Save current base URL
        Helpers.setStorageItem('saludo-api-base-url', this.apiClient.baseURL);
    }

    showWelcomeMessage() {
        if (Helpers.getStorageItem('saludo-api-tester-first-visit') !== false) {
            setTimeout(() => {
                Helpers.showToast(
                    'Welcome to SaLuDo API Tester! Press Ctrl+/ for keyboard shortcuts.', 
                    'info', 
                    5000
                );
                Helpers.setStorageItem('saludo-api-tester-first-visit', false);
            }, 1000);
        }
    }

    showKeyboardShortcuts() {
        const shortcuts = [
            'Ctrl+1-8: Switch between tabs',
            'Ctrl+Shift+T: Toggle theme',
            'Ctrl+/: Show this help',
            'Ctrl+R: Clear response',
            'Ctrl+D: Download response',
            'Escape: Clear focus'
        ];

        const message = 'Keyboard Shortcuts:\\n\\n' + shortcuts.join('\\n');
        alert(message); // Using alert for simplicity, can be replaced with a custom modal
    }

    downloadResponse() {
        const responseBody = document.getElementById('responseBody');
        if (responseBody && responseBody.textContent.trim()) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `api-response-${timestamp}.json`;
            Helpers.downloadAsFile(responseBody.textContent, filename, 'application/json');
            Helpers.showToast('Response downloaded!', 'success', 2000);
        } else {
            Helpers.showToast('No response data to download', 'warning');
        }
    }

    // Public API for external use
    getServerStatus() {
        return {
            status: this.serverStatus,
            lastCheck: this.lastStatusCheck,
            baseURL: this.apiClient.baseURL
        };
    }

    setBaseURL(url) {
        if (Helpers.isValidUrl(url)) {
            this.apiClient.setBaseURL(url);
            const baseUrlInput = document.getElementById('baseUrl');
            if (baseUrlInput) {
                baseUrlInput.value = url;
            }
            this.saveUserPreferences();
            this.checkServerStatus();
            return true;
        }
        return false;
    }

    getVersion() {
        return this.version;
    }

    // Cleanup method
    destroy() {
        this.pauseServerStatusMonitoring();
        this.isInitialized = false;
        console.log('🔄 Application destroyed');
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async function() {
    window.app = new SaLuDoAPITester();
    await window.app.init();
});

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (window.app) {
        window.app.destroy();
    }
});

// Export for external use
window.SaLuDoAPITester = SaLuDoAPITester;

console.log('📦 Main application module loaded');
