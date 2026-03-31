
// background/control/actions/base.js
import { WaitForHelper } from '../wait_helper.js';

export class BaseActionHandler {
    constructor(connection, snapshotManager, waitHelper) {
        this.connection = connection;
        this.snapshotManager = snapshotManager;
        // Use injected waitHelper or create new one (fallback)
        this.waitHelper = waitHelper || new WaitForHelper(connection);
    }

    // Helper: Send command via connection
    cmd(method, params) {
        return this.connection.sendCommand(method, params);
    }

    /**
     * @deprecated Use this.waitHelper.waitForStableDOM() directly
     */
    async waitForStableDOM(timeout = 3000, stabilityDuration = 500) {
        return this.waitHelper.waitForStableDOM(timeout, stabilityDuration);
    }

    async getObjectIdFromUid(uid) {
        // This will throw "Stale Element Reference" if versions mismatch,
        // catching errors early before sending commands to browser.
        const backendNodeId = this.snapshotManager.getBackendNodeId(uid);
        
        if (!backendNodeId) {
             throw new Error(`Node with uid ${uid} has no backend ID. It might be a virtual node.`);
        }

        // Helper to resolve to RemoteObject
        const resolveNode = async (backendId) => {
            try {
                const { object } = await this.cmd("DOM.resolveNode", { backendNodeId: backendId });
                return object ? object.objectId : null;
            } catch (e) {
                // DOM.resolveNode fails if node is detached from document
                return null;
            }
        };

        const objectId = await resolveNode(backendNodeId);

        if (!objectId) {
             throw new Error(`Element ${uid} is detached from the DOM. Please take a new snapshot.`);
        }

        // Trigger highlight for visual feedback on interaction
        this.highlightObjectId(objectId).catch(() => {});

        return objectId;
    }

    /**
     * Checks if the element is visually visible (layout size > 0 and style visible).
     */
    async checkVisibility(objectId) {
        try {
            const { result } = await this.cmd("Runtime.callFunctionOn", {
                objectId: objectId,
                functionDeclaration: `function() {
                    if (!this.isConnected) return false;
                    const style = window.getComputedStyle(this);
                    if (style.display === 'none' || style.visibility === 'hidden') return false;
                    const rect = this.getBoundingClientRect();
                    return rect.width > 0 && rect.height > 0;
                }`,
                returnByValue: true
            });
            return result.value === true;
        } catch (e) {
            return false;
        }
    }

    async highlight(uid) {
        try {
            const backendNodeId = this.snapshotManager.getBackendNodeId(uid);
            if (backendNodeId) {
                this._doHighlight({ backendNodeId });
            }
        } catch(e) {
            // Ignore highlight errors for stale nodes
        }
    }

    async highlightObjectId(objectId) {
        this._doHighlight({ objectId });
    }

    async _doHighlight(params) {
        try {
            await this.cmd("Overlay.enable");
            await this.cmd("Overlay.highlightNode", {
                ...params,
                highlightConfig: {
                    showInfo: true,
                    showRulers: false,
                    showExtensionLines: false,
                    contentColor: { r: 11, g: 87, b: 208, a: 0.3 }, // Gemini Blue fill
                    paddingColor: { r: 11, g: 87, b: 208, a: 0.1 },
                    borderColor: { r: 11, g: 87, b: 208, a: 0.8 }  // Border
                }
            });

            // Auto-hide after 1.5 seconds
            setTimeout(() => {
                this.cmd("Overlay.hideHighlight").catch(() => {});
            }, 1500);

        } catch (e) {
            // Ignore highlight errors
        }
    }
}
