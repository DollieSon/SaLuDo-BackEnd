// Tab component functionality
class TabManager {
    constructor() {
        this.activeTab = 'candidates';
        this.tabs = ['candidates', 'jobs', 'skills', 'education', 'experience', 'certifications', 'strengths', 'transcripts'];
        this.init();
    }

    init() {
        this.attachEventListeners();
        this.showTab(this.activeTab);
        this.loadTabFromURL();
    }

    attachEventListeners() {
        // Tab button click handlers
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = button.dataset.tab;
                this.showTab(tabName);
                this.updateURL(tabName);
            });
        });

        // Keyboard navigation for tabs
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key >= '1' && e.key <= '8') {
                e.preventDefault();
                const tabIndex = parseInt(e.key) - 1;
                if (this.tabs[tabIndex]) {
                    this.showTab(this.tabs[tabIndex]);
                    this.updateURL(this.tabs[tabIndex]);
                }
            }
        });
    }

    showTab(tabName) {
        if (!this.tabs.includes(tabName)) {
            console.warn(`Tab "${tabName}" not found`);
            return;
        }

        // Hide all tab panes
        const tabPanes = document.querySelectorAll('.tab-pane');
        tabPanes.forEach(pane => {
            pane.classList.remove('active');
        });

        // Remove active class from all tab buttons
        const tabButtons = document.querySelectorAll('.tab-btn');
        tabButtons.forEach(button => {
            button.classList.remove('active');
        });

        // Show selected tab pane
        const targetPane = document.getElementById(`${tabName}-tab`);
        if (targetPane) {
            targetPane.classList.add('active');
        }

        // Add active class to selected tab button
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }

        this.activeTab = tabName;

        // Trigger tab change event
        this.onTabChange(tabName);
    }

    onTabChange(tabName) {
        // Clear response when switching tabs
        ResponseDisplay.clearResponse();

        // Update page title
        document.title = `SaLuDo API Tester - ${this.capitalizeFirst(tabName)}`;

        // Analytics or tracking can be added here
        console.log(`📋 Switched to ${tabName} tab`);

        // Scroll to top of content
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    updateURL(tabName) {
        const url = new URL(window.location);
        url.searchParams.set('tab', tabName);
        window.history.pushState({ tab: tabName }, '', url);
    }

    loadTabFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const tabFromURL = urlParams.get('tab');
        
        if (tabFromURL && this.tabs.includes(tabFromURL)) {
            this.showTab(tabFromURL);
        }
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Public methods for external use
    switchToTab(tabName) {
        this.showTab(tabName);
        this.updateURL(tabName);
    }

    getCurrentTab() {
        return this.activeTab;
    }

    getAllTabs() {
        return [...this.tabs];
    }

    addTab(tabName, tabLabel, beforeTab = null) {
        if (this.tabs.includes(tabName)) {
            console.warn(`Tab "${tabName}" already exists`);
            return false;
        }

        // Add to tabs array
        if (beforeTab && this.tabs.includes(beforeTab)) {
            const index = this.tabs.indexOf(beforeTab);
            this.tabs.splice(index, 0, tabName);
        } else {
            this.tabs.push(tabName);
        }

        // Create tab button
        const tabNav = document.querySelector('.tab-nav');
        const newButton = document.createElement('button');
        newButton.className = 'tab-btn';
        newButton.dataset.tab = tabName;
        newButton.textContent = tabLabel;
        
        if (beforeTab) {
            const beforeButton = document.querySelector(`[data-tab="${beforeTab}"]`);
            tabNav.insertBefore(newButton, beforeButton);
        } else {
            tabNav.appendChild(newButton);
        }

        // Create tab pane
        const tabContent = document.querySelector('.tab-content');
        const newPane = document.createElement('div');
        newPane.id = `${tabName}-tab`;
        newPane.className = 'tab-pane';
        newPane.innerHTML = `
            <div class="route-section">
                <h3>${tabLabel}</h3>
                <p class="placeholder-text">Content for ${tabLabel} will be added here...</p>
            </div>
        `;
        tabContent.appendChild(newPane);

        // Attach event listener
        newButton.addEventListener('click', () => {
            this.showTab(tabName);
            this.updateURL(tabName);
        });

        return true;
    }

    removeTab(tabName) {
        if (!this.tabs.includes(tabName)) {
            console.warn(`Tab "${tabName}" not found`);
            return false;
        }

        if (this.tabs.length <= 1) {
            console.warn('Cannot remove the last tab');
            return false;
        }

        // Remove from tabs array
        this.tabs = this.tabs.filter(tab => tab !== tabName);

        // Remove tab button
        const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.remove();
        }

        // Remove tab pane
        const tabPane = document.getElementById(`${tabName}-tab`);
        if (tabPane) {
            tabPane.remove();
        }

        // If this was the active tab, switch to the first available tab
        if (this.activeTab === tabName) {
            this.showTab(this.tabs[0]);
            this.updateURL(this.tabs[0]);
        }

        return true;
    }
}

// Handle browser back/forward navigation
window.addEventListener('popstate', (event) => {
    if (event.state && event.state.tab) {
        window.tabManager.showTab(event.state.tab);
    } else {
        window.tabManager.loadTabFromURL();
    }
});

// Initialize tab manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.tabManager = new TabManager();
    console.log('✅ Tab manager initialized');
});

// Export for external use
window.TabManager = TabManager;
