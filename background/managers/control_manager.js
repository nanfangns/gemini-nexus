
// background/managers/control_manager.js
import { BrowserConnection } from '../control/connection.js';
import { SnapshotManager } from '../control/snapshot.js';
import { BrowserActions } from '../control/actions.js';
import { ToolDispatcher } from '../control/dispatcher.js';

/**
 * Main Controller handling Chrome DevTools MCP functionalities.
 * Orchestrates connection, snapshots, and action execution.
 */
export class BrowserControlManager {
    constructor() {
        this.connection = new BrowserConnection();
        this.snapshotManager = new SnapshotManager(this.connection);
        this.actions = new BrowserActions(this.connection, this.snapshotManager);
        this.dispatcher = new ToolDispatcher(this.actions, this.snapshotManager);
        this.lockedTabId = null;

        // Track the last snapshot result for caching
        this._lastSnapshot = null;
        this._lastSnapshotTime = 0;
        this._snapshotCacheTTL = 2000; // 2 seconds

        // Listen for updates to the locked tab (URL/Favicon changes)
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            if (tabId === this.lockedTabId) {
                // If the update contains relevant info, broadcast it
                if (changeInfo.favIconUrl || changeInfo.title || changeInfo.url) {
                    this._broadcastLockState(tab);
                }
            }
        });

        // Listen for closure of the locked tab
        chrome.tabs.onRemoved.addListener((tabId) => {
            if (tabId === this.lockedTabId) {
                this.setTargetTab(null);
            }
        });
    }

    setTargetTab(tabId) {
        this.lockedTabId = tabId;
        console.log(`[ControlManager] Target tab locked to: ${tabId}`);

        // Clear snapshot cache when tab changes
        this._lastSnapshot = null;
        this._lastSnapshotTime = 0;

        if (tabId) {
            // Fetch tab info to broadcast state immediately
            chrome.tabs.get(tabId).then(tab => {
                this._broadcastLockState(tab);
            }).catch(() => {
                // Tab might have closed or invalid ID
                this.lockedTabId = null;
                this._broadcastLockState(null);
            });
        } else {
            this._broadcastLockState(null);
        }
    }

    _broadcastLockState(tab) {
        chrome.runtime.sendMessage({
            action: "TAB_LOCKED",
            tab: tab ? {
                id: tab.id,
                title: tab.title,
                favIconUrl: tab.favIconUrl,
                url: tab.url,
                active: tab.active
            } : null
        }).catch(() => {});
    }

    getTargetTabId() {
        return this.lockedTabId;
    }

    // --- Control Lifecycle ---

    async enableControl() {
        // If already connected, do nothing (or verify tab)
        if (this.connection.attached && this.lockedTabId === this.connection.currentTabId) {
            return true;
        }

        // Auto-lock to active tab if not currently locked
        if (!this.lockedTabId) {
            const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (tab) {
                this.setTargetTab(tab.id);
            }
        }

        // Force attachment which shows the "Started debugging" bar
        return await this.ensureConnection();
    }

    async disableControl() {
        // Clear lock
        this.setTargetTab(null);
        // Detach debugger which hides the bar
        if (this.connection.attached) {
            await this.connection.detach();
        }
    }

    // --- Internal Helpers ---

    async ensureConnection() {
        let tabId = this.lockedTabId;

        if (tabId) {
            // Verify if locked tab still exists
            try {
                await chrome.tabs.get(tabId);
            } catch (e) {
                console.warn("[ControlManager] Locked tab not found, clearing lock.", e);
                this.lockedTabId = null;
                tabId = null;
            }
        }

        if (!tabId) {
            const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            if (!tab) return false;
            tabId = tab.id;
        }

        // Perform quick check on URL before attaching
        let tabObj;
        try {
            tabObj = await chrome.tabs.get(tabId);
        } catch(e) { return false; }

        // Robust check for restricted URLs to avoid "Debugger attach failed" warnings
        // Check both url and pendingUrl (for mid-navigation states)
        const urlRaw = tabObj.url || tabObj.pendingUrl || "";

        // If no URL is returned (e.g. system page without permissions), skip
        if (!urlRaw) return false;

        const url = (urlRaw || '').toString().toLowerCase();
        const isRestricted = url.startsWith('chrome://') ||
                             url.startsWith('edge://') ||
                             url.startsWith('about:') ||
                             url.startsWith('chrome-extension://') ||
                             url.startsWith('https://chromewebstore.google.com') ||
                             url.startsWith('https://chrome.google.com/webstore') ||
                             url.startsWith('view-source:');

        if (isRestricted) {
            // Fail silently for restricted pages to avoid log noise
            return false;
        }

        await this.connection.attach(tabId);

        // Return true only if we successfully attached
        return this.connection.attached;
    }

    async getSnapshot() {
        const now = Date.now();

        // Use cached snapshot if fresh enough (within TTL and from same tab)
        if (this._lastSnapshot &&
            this._lastSnapshotTime > 0 &&
            now - this._lastSnapshotTime < this._snapshotCacheTTL &&
            this.connection.attached) {
            return this._lastSnapshot;
        }

        if (!this.connection.attached) {
             const success = await this.ensureConnection();
             if (!success || !this.connection.attached) return null;
        }

        try {
            const snapshot = await this.snapshotManager.takeSnapshot();
            // Cache the result
            this._lastSnapshot = snapshot;
            this._lastSnapshotTime = now;
            return snapshot;
        } catch (e) {
            console.warn("[ControlManager] Snapshot failed:", e);
            return null;
        }
    }

    // --- Execution Entry Point ---

    async execute(toolCall) {
        const { name, args } = toolCall;

        try {
            const success = await this.ensureConnection();

            // Check attached status as well to be safe
            if (!success || !this.connection.attached) {
                // Some tools don't need debugger (navigation, page listing, etc.)
                const noDebuggerTools = ['navigate_page', 'new_page', 'close_page', 'list_pages', 'select_page'];
                if (!noDebuggerTools.includes(name)) {
                    return "Error: No active tab found, restricted URL, or debugger disconnected.";
                }
                // For navigation tools, proceed without debugger
            }

            console.log(`[MCP] Executing tool: ${name}`, args);

            // Clear snapshot cache before state-changing operations
            const stateChangingTools = [
                'click', 'drag_element', 'fill', 'fill_form', 'hover',
                'press_key', 'navigate_page', 'new_page', 'close_page',
                'select_page', 'attach_file', 'handle_dialog'
            ];
            if (stateChangingTools.includes(name)) {
                this._lastSnapshot = null;
                this._lastSnapshotTime = 0;
            }

            // Delegate to dispatcher
            const result = await this.dispatcher.dispatch(name, args);

            // Handle structured result
            let finalOutput = "";

            if (result && typeof result === 'object') {
                // 1. Process State Updates (_meta)
                if (result._meta && result._meta.switchTabId) {
                    this.setTargetTab(result._meta.switchTabId);
                }

                // 2. Unwrap Output
                if ('output' in result) {
                    finalOutput = result.output;
                } else if (result.text && result.image) {
                    // Screenshot format: { text, image }
                    finalOutput = result;
                } else {
                    // Some other object, stringify it
                    finalOutput = JSON.stringify(result);
                }
            } else {
                finalOutput = result;
            }

            return finalOutput;

        } catch (e) {
            console.error(`[MCP] Tool execution error:`, e);
            return `Error executing ${name}: ${e.message}`;
        }
    }
}
