/**
 * Utility functions for improved network resilience
 */

/**
 * Performs a fetch request with retry logic
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in ms between retries (will be exponentially increased)
 * @returns {Promise<Response>} - The fetch response
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 3, baseDelay = 1000) {
    let lastError;

    for (let i = 0; i <= maxRetries; i++) {
        try {
            const response = await fetch(url, {
                ...options,
                signal: AbortSignal.timeout(15000) // 15 second timeout
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return response;
        } catch (error) {
            lastError = error;

            if (i === maxRetries) {
                break; // Last attempt, rethrow the error
            }

            // Calculate exponential backoff delay
            const delay = baseDelay * Math.pow(2, i) + Math.random() * 1000;
            console.warn(`Request failed (attempt ${i + 1}/${maxRetries + 1}), retrying in ${delay}ms:`, error.message);

            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Safe version of fetchWithRetry that returns null instead of throwing on failure
 * @param {string} url - The URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in ms between retries
 * @returns {Promise<Response|null>} - The fetch response or null if all retries failed
 */
export async function safeFetchWithRetry(url, options = {}, maxRetries = 3, baseDelay = 1000) {
    try {
        return await fetchWithRetry(url, options, maxRetries, baseDelay);
    } catch (error) {
        console.warn(`Safe fetch failed after all retries:`, error.message);
        return null;
    }
}

/**
 * Checks if the network is available by making a simple request
 * @returns {Promise<boolean>} - True if network is available, false otherwise
 */
export async function isNetworkAvailable() {
    try {
        // Try to ping a reliable service to check network availability
        const response = await fetch('https://httpbin.org/get', {
            method: 'GET',
            mode: 'cors',
            signal: AbortSignal.timeout(5000)
        });
        return response.ok;
    } catch (error) {
        console.warn('Network connectivity check failed:', error.message);
        return false;
    }
}

/**
 * Adds network event listeners to monitor online/offline status
 * @param {Function} onlineCallback - Callback function when network comes online
 * @param {Function} offlineCallback - Callback function when network goes offline
 */
export function addNetworkListeners(onlineCallback, offlineCallback) {
    window.addEventListener('online', () => {
        console.log('Network is back online');
        if (onlineCallback && typeof onlineCallback === 'function') {
            onlineCallback();
        }
    });

    window.addEventListener('offline', () => {
        console.log('Network is offline');
        if (offlineCallback && typeof offlineCallback === 'function') {
            offlineCallback();
        }
    });
}

/**
 * Graceful degradation helper that attempts to use a fallback when primary resource fails
 * @param {Array<Function>} resourceLoaders - Array of functions that load resources (return promises)
 * @returns {Promise<any>} - Result of the first successful resource loader
 */
export async function withFallback(resourceLoaders) {
    let lastError;

    for (const loader of resourceLoaders) {
        try {
            const result = await loader();
            return result;
        } catch (error) {
            lastError = error;
            console.warn('Resource loader failed, trying next fallback:', error.message);
        }
    }

    throw new Error(`All resource loaders failed: ${lastError?.message || 'Unknown error'}`);
}