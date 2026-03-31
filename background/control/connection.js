import { CollectorManager } from './collectors.js';

/**
 * Manages the connection to the Chrome Debugger API.
 */
export class BrowserConnection {
    constructor() {
        this.currentTabId = null;
        this.targetTabId = null; // Tracks the intended tab ID even if debugger is not attached
        this.attached = false;
        this.onDetachCallbacks = [];
        this.eventListeners = new Set();

        // Tracing State
        this.traceEvents = [];
        this.traceCompletePromise = null;
        this.traceCompleteResolver = null;

        // Initialize State Collectors
        this.collectors = new CollectorManager();

        // Global listener for CDP events
        chrome.debugger.onEvent.addListener(this._handleEvent.bind(this));

        // Monitor external detachments (e.g. user closed tab or clicked "Cancel" on infobar)
        chrome.debugger.onDetach.addListener(this._onDebuggerDetached.bind(this));
    }

    _handleEvent(source, method, params) {
        if (this.attached && this.currentTabId === source.tabId) {
            // 0. Handle Tracing Events (Special Case)
            if (method === 'Tracing.dataCollected') {
                this.traceEvents.push(...params.value);
            } else if (method === 'Tracing.tracingComplete') {
                if (this.traceCompleteResolver) {
                    this.traceCompleteResolver(this.traceEvents);
                    this.traceCompleteResolver = null;
                }
            }

            // 1. Pass to collectors for persistence
            this.collectors.handleEvent(method, params);

            // 2. Pass to active listeners (e.g. WaitHelper)
            this.eventListeners.forEach(callback => callback(method, params));
        }
    }

    _onDebuggerDetached(source, reason) {
        // If the browser detached our current session, clean up state immediately
        if (this.currentTabId === source.tabId) {
            this._cleanupState();
        }
    }

    _cleanupState() {
        this.attached = false;
        this.currentTabId = null;
        this.traceEvents = [];
        this.onDetachCallbacks.forEach(cb => cb());
    }

    addListener(callback) {
        this.eventListeners.add(callback);
    }

    removeListener(callback) {
        this.eventListeners.delete(callback);
    }

    onDetach(callback) {
        this.onDetachCallbacks.push(callback);
    }

    async attach(tabId) {
        this.targetTabId = tabId; // Always store the intended tab

        // If already attached to the same tab, just ensure domains are enabled
        if (this.attached && this.currentTabId === tabId) {
            await this._enableDomains().catch(e => console.warn("[BrowserConnection] Domain re-enable failed:", e));
            return;
        }

        // If attached to a different tab, detach first
        if (this.attached && this.currentTabId !== tabId) {
            await this.detach();
        }

        return new Promise((resolve) => {
            chrome.debugger.attach({ tabId }, "1.3", async (err) => {
                if (err) {
                    const msg = err.message || String(err);
                    // Suppress common expected errors for restricted targets to avoid log noise
                    const isExpectedError = msg.includes("restricted URL") ||
                                           msg.includes("Cannot access") ||
                                           msg.includes("Attach to webui") ||
                                           msg.includes("Target closed") ||
                                           msg.includes("No target with given id");

                    if (!isExpectedError) {
                        console.warn("[BrowserConnection] Attach failed:", msg);
                    }

                    // Ensure state reflects failure
                    this.attached = false;
                    this.currentTabId = null;
                    resolve();
                } else {
                    this.attached = true;
                    this.currentTabId = tabId;

                    // Initialize collectors on new attachment
                    this.collectors.clear();
                    // Clear trace buffer
                    this.traceEvents = [];

                    // Enable domains for collection
                    try {
                        await this._enableDomains();
                    } catch (e) {
                        console.warn("[BrowserConnection] Failed to enable domains:", e);
                    }

                    resolve();
                }
            });
        });
    }

    async _enableDomains() {
        // Core domains for browser control
        await this.sendCommand("Network.enable");
        await this.sendCommand("Log.enable");
        await this.sendCommand("Runtime.enable");
        await this.sendCommand("Page.enable");
        await this.sendCommand("DOM.enable");

        // Input domain - required for mouse/keyboard events
        await this.sendCommand("Input.enable");

        // Additional domains
        await this.sendCommand("Audits.enable");

        // Overlay domain - for highlights
        await this.sendCommand("Overlay.enable");

        // Enable auto-attach for OOPIFs (Out-Of-Process Iframes)
        // This allows perceiving content in cross-origin frames like Stripe, Google Login, etc.
        // flatten: true is essential for chrome.debugger handling
        await this.sendCommand("Target.setAutoAttach", {
            autoAttach: true,
            waitForDebuggerOnStart: false,
            flatten: true
        });
    }

    async detach() {
        if (!this.attached || !this.currentTabId) return;
        const tabId = this.currentTabId;
        return new Promise((resolve) => {
            chrome.debugger.detach({ tabId }, () => {
                // IMPORTANT: Consume lastError to prevent "Unchecked runtime.lastError"
                // if the tab was already closed or detached externally.
                if (chrome.runtime.lastError) {
                    // console.debug("[BrowserConnection] Detach ignored:", chrome.runtime.lastError.message);
                }

                this._cleanupState();
                resolve();
            });
        });
    }

    sendCommand(method, params = {}) {
        if (!this.currentTabId) {
            return Promise.reject(new Error("No active debugger session"));
        }
        return new Promise((resolve, reject) => {
            chrome.debugger.sendCommand({ tabId: this.currentTabId }, method, params, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(result);
                }
            });
        });
    }

    async startTracing(categories) {
        this.traceEvents = [];
        await this.sendCommand('Tracing.start', { categories });
    }

    async stopTracing() {
        this.traceCompletePromise = new Promise(resolve => {
            this.traceCompleteResolver = resolve;
        });
        await this.sendCommand('Tracing.end');
        return this.traceCompletePromise;
    }
}
