
// background/control/snapshot.js
import { SnapshotFormatter } from './snapshot/formatter.js';

/**
 * Handles Accessibility Tree generation and UID mapping.
 * Converts complex DOM structures into an LLM-friendly, token-efficient text tree.
 */
export class SnapshotManager {
    constructor(connection) {
        this.connection = connection;
        this.snapshotMap = new Map(); // Maps uid -> backendNodeId
        this.uidToAxNode = new Map(); // Maps uid -> AXNode (raw)
        this.snapshotIdCount = 0;
        
        // Listen to connection detach to clear state
        this.connection.onDetach(() => this.clear());
    }

    clear() {
        this.snapshotMap.clear();
        this.uidToAxNode.clear();
    }

    getBackendNodeId(uid) {
        // 1. Strict Version Check
        // UIDs are formatted as "{snapshotId}_{nodeIndex}"
        if (uid && uid.includes('_')) {
            const parts = uid.split('_');
            const snapshotVersion = parseInt(parts[0], 10);
            
            if (!isNaN(snapshotVersion) && snapshotVersion !== this.snapshotIdCount) {
                throw new Error(`Stale Element Reference: UID '${uid}' belongs to an older snapshot (v${snapshotVersion}). The current page state is v${this.snapshotIdCount}. You MUST call 'take_snapshot' to get fresh UIDs.`);
            }
        }

        const id = this.snapshotMap.get(uid);
        if (!id) {
            // If ID matches current version but not found in map, it's likely invalid or ephemeral
            throw new Error(`Element '${uid}' not found in current snapshot. Please verify the UID or take a new snapshot.`);
        }
        return id;
    }

    getAXNode(uid) {
        return this.uidToAxNode.get(uid);
    }
    
    _getVal(prop) {
        return prop && prop.value;
    }

    /**
     * Traverses descendants of a node using the raw AX tree structure.
     */
    findDescendant(rootUid, predicate) {
        // Implementation relies on internal map not exposed in this simplified version
        // Ideally we map uid -> nodeId (CDP ID) for traversal.
        // For now, this is used by Select element handling.
        // Simplified fallback: Iterate all known nodes in current map
        
        for (const [uid, node] of this.uidToAxNode.entries()) {
            // Crude check: is the uid lexically "larger" and shares prefix? 
            // Better approach: SnapshotFormatter provides structure. 
            // Since we cleared reLocate, we assume direct mapping logic is handled in takeSnapshot.
            
            if (uid !== rootUid && predicate(node, uid)) {
                 return uid;
            }
        }
        return null;
    }

    async takeSnapshot(args = {}) {
        // Ensure domains are enabled
        await this.connection.sendCommand("DOM.enable");
        await this.connection.sendCommand("Accessibility.enable");
        
        // Get the full accessibility tree from CDP
        const { nodes } = await this.connection.sendCommand("Accessibility.getFullAXTree");
        
        // Increment Snapshot ID (Version Control)
        this.snapshotIdCount++;
        
        // Clear maps
        this.clear();

        const formatter = new SnapshotFormatter({
            verbose: args.verbose === true,
            snapshotPrefix: this.snapshotIdCount,
            onNode: (node, uid) => {
                if (node.backendDOMNodeId) {
                    this.snapshotMap.set(uid, node.backendDOMNodeId);
                }
                this.uidToAxNode.set(uid, node);
            }
        });

        return formatter.format(nodes);
    }
}
