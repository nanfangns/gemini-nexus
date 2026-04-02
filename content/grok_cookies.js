
// content/grok_cookies.js
// Content script injected into grok.com to get cookies and relay Grok page events

(function() {
    const PAGE_BRIDGE_SOURCE = 'GEMINI_NEXUS_GROK_PAGE';

    function extractStatsigId() {
        // x-statsig-id is embedded in inline scripts on grok.com
        var scripts = document.querySelectorAll('script:not([src])');
        for (var i = scripts.length - 1; i >= 0; i--) {
            var txt = scripts[i].textContent || '';
            var m = txt.match(/"x-statsig-id"\s*:\s*"([^"]+)"/);
            if (m) return m[1];
        }
        // Also try __NEXT_DATA__ or other globals
        try {
            if (window.__NEXT_DATA__) {
                var str = JSON.stringify(window.__NEXT_DATA__);
                var m = str.match(/"x-statsig-id"\s*:\s*"([^"]+)"/);
                if (m) return m[1];
            }
        } catch(e) {}
        return null;
    }

    function forwardPayload(payload) {
        if (!payload || typeof payload !== 'object' || !payload.type) return;
        chrome.runtime.sendMessage(payload, () => {
            if (chrome.runtime.lastError) {
                console.warn('[Grok Cookies] Forward failed:', chrome.runtime.lastError.message, payload.type);
            }
        });
    }

    // Inject a bridge function that the page's MAIN world can call directly.
    // Keep this as a best-effort fast path, but rely on postMessage forwarding below.
    function grokBridgeSendMessage(payload) {
        forwardPayload(payload);
    }

    try {
        window.grokBridgeSendMessage = grokBridgeSendMessage;
        window.eval('if(typeof grokBridgeSendMessage !== "function"){window.grokBridgeSendMessage=' + String(grokBridgeSendMessage) + '}');
        console.log('[Grok Cookies] Bridge exposed on page window');
    } catch(e) {
        console.warn('[Grok Cookies] Bridge expose failed:', e && e.message ? e.message : e);
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== PAGE_BRIDGE_SOURCE || !data.payload) return;
        forwardPayload(data.payload);
    });

    // Listen for requests from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'GET_GROK_COOKIES') {
            // Get all cookies for grok.com
            chrome.cookies.getAll({ domain: '.grok.com' }, (cookies) => {
                if (chrome.runtime.lastError) {
                    console.error('[Grok Cookies] Error:', chrome.runtime.lastError);
                    sendResponse({ cookies: null, cookieList: [] });
                    return;
                }

                // Build cookie string
                const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

                // Extract x-statsig-id from page
                const statsigId = extractStatsigId();
                console.log('[Grok Cookies] Found', cookies.length, 'cookies, statsigId:', statsigId ? 'yes' : 'no');

                // Check for required auth cookies
                const hasSession = cookies.some(c => c.name === 'sso' || c.name === 'x_userid');
                if (!hasSession) {
                    console.warn('[Grok Cookies] Session cookie not found');
                }

                // Send back to background
                chrome.runtime.sendMessage({
                    type: 'GROK_COOKIES',
                    cookies: cookieString,
                    cookieList: cookies.map(c => ({ name: c.name, value: c.value })),
                    statsigId: statsigId
                });

                sendResponse({ success: true });
            });

            return true; // Keep channel open for async response
        }
    });

    console.log('[Grok Cookies] Content script loaded on', window.location.hostname);
})();
