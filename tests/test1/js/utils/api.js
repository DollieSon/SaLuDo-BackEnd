// API utility class for making HTTP requests
class APIClient {
    constructor(baseURL = 'http://localhost:3000') {
        this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    // Set base URL
    setBaseURL(url) {
        this.baseURL = url.replace(/\/$/, '');
    }

    // Set default headers
    setDefaultHeaders(headers) {
        this.defaultHeaders = { ...this.defaultHeaders, ...headers };
    }

    // Create request options
    createRequestOptions(method, data = null, headers = {}, isFormData = false) {
        const options = {
            method: method.toUpperCase(),
            headers: { ...this.defaultHeaders, ...headers }
        };

        if (data) {
            if (isFormData) {
                // For FormData, don't set Content-Type header (browser will set it with boundary)
                delete options.headers['Content-Type'];
                options.body = data;
            } else if (data instanceof FormData) {
                delete options.headers['Content-Type'];
                options.body = data;
            } else {
                options.body = JSON.stringify(data);
            }
        }

        return options;
    }

    // Build URL with query parameters
    buildURL(endpoint, params = {}) {
        const url = new URL(`${this.baseURL}${endpoint}`);
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });
        return url.toString();
    }

    // Make HTTP request
    async request(method, endpoint, data = null, options = {}) {
        const startTime = performance.now();
        const { params = {}, headers = {}, isFormData = false } = options;
        
        try {
            const url = this.buildURL(endpoint, params);
            const requestOptions = this.createRequestOptions(method, data, headers, isFormData);
            
            console.log(`🚀 ${method.toUpperCase()} ${url}`, {
                data: data,
                headers: requestOptions.headers
            });

            const response = await fetch(url, requestOptions);
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);
            
            let responseData;
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }

            const result = {
                success: response.ok,
                status: response.status,
                statusText: response.statusText,
                data: responseData,
                responseTime: responseTime,
                headers: Object.fromEntries(response.headers.entries())
            };

            console.log(`✅ Response (${responseTime}ms):`, result);
            return result;

        } catch (error) {
            const endTime = performance.now();
            const responseTime = Math.round(endTime - startTime);
            
            const result = {
                success: false,
                status: 0,
                statusText: 'Network Error',
                data: { error: error.message },
                responseTime: responseTime,
                headers: {}
            };

            console.error('❌ Request failed:', error);
            return result;
        }
    }

    // HTTP method shortcuts
    async get(endpoint, params = {}, headers = {}) {
        return this.request('GET', endpoint, null, { params, headers });
    }

    async post(endpoint, data = null, options = {}) {
        return this.request('POST', endpoint, data, options);
    }

    async put(endpoint, data = null, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }

    async patch(endpoint, data = null, options = {}) {
        return this.request('PATCH', endpoint, data, options);
    }

    async delete(endpoint, params = {}, headers = {}) {
        return this.request('DELETE', endpoint, null, { params, headers });
    }

    // Upload file
    async uploadFile(endpoint, file, additionalData = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        // Add additional form data
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });

        return this.request('POST', endpoint, formData, { isFormData: true });
    }

    // Upload multiple files
    async uploadFiles(endpoint, files, additionalData = {}) {
        const formData = new FormData();
        
        files.forEach((file, index) => {
            formData.append(`files[${index}]`, file);
        });
        
        // Add additional form data
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });

        return this.request('POST', endpoint, formData, { isFormData: true });
    }

    // Test connection to API
    async testConnection() {
        try {
            const response = await this.get('/health');
            return {
                success: true,
                status: response.status,
                responseTime: response.responseTime,
                message: 'API is reachable'
            };
        } catch (error) {
            return {
                success: false,
                status: 0,
                responseTime: 0,
                message: `Connection failed: ${error.message}`
            };
        }
    }

    // Batch requests
    async batchRequests(requests) {
        const results = await Promise.allSettled(
            requests.map(req => this.request(req.method, req.endpoint, req.data, req.options))
        );

        return results.map((result, index) => ({
            request: requests[index],
            success: result.status === 'fulfilled',
            response: result.status === 'fulfilled' ? result.value : { error: result.reason }
        }));
    }

    // Download file
    async downloadFile(endpoint, filename) {
        try {
            const response = await fetch(`${this.baseURL}${endpoint}`, {
                headers: this.defaultHeaders
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            return { success: true, message: 'File downloaded successfully' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Response display utility
class ResponseDisplay {
    static updateResponseUI(response) {
        const statusCodeEl = document.getElementById('statusCode');
        const responseTimeEl = document.getElementById('responseTime');
        const responseBodyEl = document.getElementById('responseBody');

        if (!statusCodeEl || !responseTimeEl || !responseBodyEl) {
            console.warn('Response UI elements not found');
            return;
        }

        // Update status code
        statusCodeEl.textContent = `${response.status} ${response.statusText}`;
        statusCodeEl.className = 'status-code';
        
        if (response.status >= 200 && response.status < 300) {
            statusCodeEl.classList.add('success');
        } else if (response.status >= 400) {
            statusCodeEl.classList.add('error');
        } else {
            statusCodeEl.classList.add('info');
        }

        // Update response time
        responseTimeEl.textContent = `${response.responseTime}ms`;

        // Update response body
        responseBodyEl.textContent = Helpers.formatJSON(response.data);

        // Show toast notification
        if (response.success) {
            Helpers.showToast(`Request completed in ${response.responseTime}ms`, 'success', 2000);
        } else {
            Helpers.showToast(`Request failed: ${response.statusText}`, 'error', 4000);
        }
    }

    static clearResponse() {
        const statusCodeEl = document.getElementById('statusCode');
        const responseTimeEl = document.getElementById('responseTime');
        const responseBodyEl = document.getElementById('responseBody');

        if (statusCodeEl) {
            statusCodeEl.textContent = 'Ready';
            statusCodeEl.className = 'status-code info';
        }
        
        if (responseTimeEl) {
            responseTimeEl.textContent = '';
        }
        
        if (responseBodyEl) {
            responseBodyEl.textContent = 'Click any test button to see the API response...';
        }
    }

    static copyResponse() {
        const responseBodyEl = document.getElementById('responseBody');
        if (responseBodyEl && responseBodyEl.textContent) {
            Helpers.copyToClipboard(responseBodyEl.textContent);
        }
    }
}

// Loading state utility
class LoadingState {
    static show(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const text = overlay?.querySelector('.loading-text');
        
        if (overlay) {
            overlay.classList.add('show');
        }
        
        if (text) {
            text.textContent = message;
        }
    }

    static hide() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }

    static setButtonLoading(button, loading = true) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
            button.dataset.originalText = button.textContent;
            button.textContent = 'Loading...';
        } else {
            button.classList.remove('loading');
            button.disabled = false;
            if (button.dataset.originalText) {
                button.textContent = button.dataset.originalText;
            }
        }
    }
}

// Create global API client instance
window.apiClient = new APIClient();
window.ResponseDisplay = ResponseDisplay;
window.LoadingState = LoadingState;
