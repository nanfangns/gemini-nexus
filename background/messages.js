
// background/messages.js
import { SessionMessageHandler } from './handlers/session.js';
import { UIMessageHandler } from './handlers/ui.js';

/**
 * Sets up the global runtime message listener.
 * @param {GeminiSessionManager} sessionManager
 * @param {ImageHandler} imageHandler
 * @param {BrowserControlManager} controlManager
 * @param {LogManager} logManager
 */
export function setupMessageListener(sessionManager, imageHandler, controlManager, logManager) {

    const sessionHandler = new SessionMessageHandler(sessionManager, imageHandler, controlManager);
    const uiHandler = new UIMessageHandler(imageHandler, controlManager);

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

        // --- LOGGING SYSTEM ---
        if (request.action === 'LOG_ENTRY') {
            logManager.add(request.entry);
            return false;
        }

        if (request.action === 'GET_LOGS') {
            sendResponse({ logs: logManager.getLogs() });
            return true;
        }

        // --- FETCH MODELS (called from settings to list available models) ---
        if (request.action === 'FETCH_MODELS') {
            const { url, headers } = request;
            fetch(url, { headers })
                .then(res => {
                    if (!res.ok) return res.text().then(t => { throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`); });
                    return res.json();
                })
                .then(json => {
                    const models = (json.data || []).map(m => m.id).filter(Boolean).sort();
                    sendResponse({ models, error: null });
                })
                .catch(err => {
                    sendResponse({ models: [], error: err.message });
                });
            return true; // async response
        }

        // Delegate to Session Handler (Prompt, Context, Quick Ask, Browser Control)
        if (sessionHandler.handle(request, sender, sendResponse)) {
            return true;
        }

        // Delegate to UI Handler (Image, Capture, Sidepanel)
        if (uiHandler.handle(request, sender, sendResponse)) {
            return true;
        }

        return false;
    });
}
