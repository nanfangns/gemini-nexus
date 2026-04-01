
// services/grok_auth.js

/**
 * Grok uses cookie-based authentication (unlike Gemini which uses tokens extracted from HTML).
 * We need to get cookies from an active grok.com session via the Chrome Extension API.
 */

/**
 * Fetches Grok authentication cookies from the user's active session.
 * This requires the user to have grok.com open in a browser tab.
 */
export async function fetchGrokCookies() {
    try {
        // First, try to get cookies directly from chrome
        const cookies = await new Promise((resolve, reject) => {
            chrome.cookies.getAll({
                domain: '.grok.com'
            }, (cookieList) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(cookieList);
                }
            });
        });

        if (!cookies || cookies.length === 0) {
            throw new Error("No Grok cookies found. Please open grok.com and log in first.");
        }

        // Build cookie string for HTTP requests
        const cookieString = cookies
            .map(c => `${c.name}=${c.value}`)
            .join('; ');

        // Extract key cookies for validation
        const hasSession = cookies.some(c => c.name === 'sso' || c.name === 'x_userid');
        if (!hasSession) {
            throw new Error("Grok session cookie not found. Please ensure you're logged in to grok.com.");
        }

        console.log('[Grok Auth] Successfully retrieved cookies:', cookies.map(c => c.name).join(', '));

        return {
            cookies: cookieString,
            cookieList: cookies,
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('[Grok Auth] Failed to fetch cookies:', error.message);
        throw error;
    }
}

/**
 * Validates that Grok cookies are still fresh (not expired).
 */
export function validateGrokCookies(authData) {
    if (!authData || !authData.cookies) {
        return false;
    }

    // Check if cookies are older than 30 minutes (refresh periodically)
    const maxAge = 30 * 60 * 1000; // 30 minutes
    return Date.now() - authData.timestamp < maxAge;
}
