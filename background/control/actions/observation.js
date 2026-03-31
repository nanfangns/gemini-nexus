
// background/control/actions/observation.js
import { BaseActionHandler } from './base.js';
import { VisualActions } from './observation/visual.js';
import { ScriptActions } from './observation/script.js';
import { NetworkActions } from './observation/network.js';

export class ObservationActions extends BaseActionHandler {
    constructor(connection, snapshotManager, waitHelper) {
        super(connection, snapshotManager, waitHelper);
        
        this.visual = new VisualActions(connection, snapshotManager, waitHelper);
        this.script = new ScriptActions(connection, snapshotManager, waitHelper);
        this.network = new NetworkActions(connection, snapshotManager, waitHelper);
    }
    
    // --- Delegates ---

    async takeScreenshot(args) { 
        return this.visual.takeScreenshot(args); 
    }

    async evaluateScript(args) { 
        return this.script.evaluateScript(args); 
    }

    async waitFor(args) { 
        return this.script.waitFor(args); 
    }

    async getLogs(args) { 
        return this.network.getLogs(args); 
    }

    async getNetworkActivity(args) { 
        return this.network.getNetworkActivity(args); 
    }

    async listNetworkRequests(args) { 
        return this.network.listNetworkRequests(args); 
    }

    async getNetworkRequest(args) { 
        return this.network.getNetworkRequest(args); 
    }
}
