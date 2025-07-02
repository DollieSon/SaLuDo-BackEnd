// Theme management functionality
class ThemeManager {
    constructor() {
        this.currentTheme = 'light';
        this.storageKey = 'saludo-api-tester-theme';
        this.init();
    }

    init() {
        this.loadSavedTheme();
        this.attachEventListeners();
        this.detectSystemTheme();
    }

    attachEventListeners() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                if (!this.hasUserPreference()) {
                    this.setTheme(e.matches ? 'dark' : 'light');
                }
            });
        }

        // Keyboard shortcut for theme toggle (Ctrl+Shift+T)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    loadSavedTheme() {
        const savedTheme = Helpers.getStorageItem(this.storageKey);
        if (savedTheme && ['light', 'dark'].includes(savedTheme)) {
            this.setTheme(savedTheme);
        } else {
            this.detectSystemTheme();
        }
    }

    detectSystemTheme() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            this.setTheme('dark');
        } else {
            this.setTheme('light');
        }
    }

    hasUserPreference() {
        return Helpers.getStorageItem(this.storageKey) !== null;
    }

    setTheme(theme) {
        if (!['light', 'dark'].includes(theme)) {
            console.warn(`Invalid theme: ${theme}`);
            return;
        }

        this.currentTheme = theme;
        
        // Apply theme to document
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme toggle button
        this.updateThemeToggleButton();
        
        // Save to localStorage
        Helpers.setStorageItem(this.storageKey, theme);
        
        // Trigger theme change event
        this.onThemeChange(theme);
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    updateThemeToggleButton() {
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.textContent = this.currentTheme === 'light' ? '🌙' : '☀️';
            themeToggle.setAttribute('aria-label', 
                `Switch to ${this.currentTheme === 'light' ? 'dark' : 'light'} theme`
            );
        }
    }

    onThemeChange(theme) {
        console.log(`🎨 Theme changed to: ${theme}`);
        
        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(theme);
        
        // Show brief notification
        const message = `Switched to ${theme} theme`;
        const toastType = theme === 'dark' ? 'info' : 'success';
        
        // Don't show toast on initial load
        if (this.hasUserPreference()) {
            setTimeout(() => {
                Helpers.showToast(message, toastType, 1500);
            }, 100);
        }
    }

    updateMetaThemeColor(theme) {
        let themeColorMeta = document.querySelector('meta[name="theme-color"]');
        
        if (!themeColorMeta) {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.name = 'theme-color';
            document.head.appendChild(themeColorMeta);
        }
        
        const colors = {
            light: '#ffffff',
            dark: '#1f2937'
        };
        
        themeColorMeta.content = colors[theme];
    }

    getCurrentTheme() {
        return this.currentTheme;
    }

    // Method to get theme-specific colors for dynamic styling
    getThemeColors() {
        const lightColors = {
            primary: '#3b82f6',
            secondary: '#6b7280',
            success: '#10b981',
            warning: '#f59e0b',
            danger: '#ef4444',
            info: '#06b6d4',
            bgPrimary: '#ffffff',
            bgSecondary: '#f8fafc',
            textPrimary: '#1f2937',
            textSecondary: '#6b7280',
            borderColor: '#e5e7eb'
        };

        const darkColors = {
            primary: '#60a5fa',
            secondary: '#9ca3af',
            success: '#34d399',
            warning: '#fbbf24',
            danger: '#f87171',
            info: '#38bdf8',
            bgPrimary: '#1f2937',
            bgSecondary: '#111827',
            textPrimary: '#f9fafb',
            textSecondary: '#d1d5db',
            borderColor: '#374151'
        };

        return this.currentTheme === 'light' ? lightColors : darkColors;
    }

    // Method to create theme-aware CSS variables
    applyCustomProperties() {
        const colors = this.getThemeColors();
        const root = document.documentElement;
        
        Object.keys(colors).forEach(key => {
            const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
            root.style.setProperty(cssVar, colors[key]);
        });
    }

    // Method to reset theme to system preference
    resetToSystemTheme() {
        Helpers.removeStorageItem(this.storageKey);
        this.detectSystemTheme();
        Helpers.showToast('Theme reset to system preference', 'info', 2000);
    }

    // Method to check if user prefers reduced motion
    prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // Method to check if user prefers high contrast
    prefersHighContrast() {
        return window.matchMedia && window.matchMedia('(prefers-contrast: high)').matches;
    }
}

// Initialize theme manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.themeManager = new ThemeManager();
    console.log('✅ Theme manager initialized');
});

// Export for external use
window.ThemeManager = ThemeManager;
