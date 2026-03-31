
// background/control/collectors.js

export class NetworkCollector {
    constructor() {
        this.requests = new Map();
        this.maxItems = 300; 
    }

    onEvent(method, params) {
        if (method === 'Network.requestWillBeSent') {
            const { requestId, request, type, timestamp } = params;
            if (request.url.startsWith('data:')) return;

            this.requests.set(requestId, {
                id: requestId,
                url: request.url,
                method: request.method,
                type: type,
                status: 'pending',
                startTime: timestamp,
                completed: false
            });
            this._prune();
        } else if (method === 'Network.responseReceived') {
            const { requestId, response } = params;
            if (this.requests.has(requestId)) {
                const req = this.requests.get(requestId);
                req.status = response.status;
                req.mimeType = response.mimeType;
            }
        } else if (method === 'Network.loadingFinished') {
            const { requestId } = params;
            if (this.requests.has(requestId)) {
                const req = this.requests.get(requestId);
                req.status = req.status === 'pending' ? 200 : req.status;
                req.completed = true;
            }
        } else if (method === 'Network.loadingFailed') {
            const { requestId, errorText } = params;
            if (this.requests.has(requestId)) {
                const req = this.requests.get(requestId);
                req.status = `failed (${errorText})`;
                req.completed = true;
            }
        }
    }

    // Called when Main Frame navigates
    onNavigation() {
        this.requests.clear();
        console.log("[NetworkCollector] Cleared requests due to navigation");
    }

    _prune() {
        if (this.requests.size > this.maxItems) {
            const firstKey = this.requests.keys().next().value;
            this.requests.delete(firstKey);
        }
    }

    getFormatted() {
        const output = [];
        const recent = Array.from(this.requests.values()).slice(-20);
        for (const req of recent) {
            output.push(`[${req.method}] ${req.url} (${req.status})`);
        }
        return output.join('\n');
    }

    getList(resourceTypes, limit = 50) {
        let items = Array.from(this.requests.values());
        if (resourceTypes && Array.isArray(resourceTypes) && resourceTypes.length > 0) {
            // Safely convert to lowercase, filtering out any undefined/null values
            const allowed = resourceTypes
                .filter(t => t != null)
                .map(t => t.toString().toLowerCase());
            items = items.filter(r => r.type && allowed.includes(r.type.toString().toLowerCase()));
        }
        return items.slice(-limit).reverse();
    }

    getRequest(requestId) {
        return this.requests.get(requestId);
    }
}

export class LogCollector {
    constructor() {
        this.logs = [];
        this.maxItems = 50;
    }

    onEvent(method, params) {
        if (method === 'Log.entryAdded') {
            const { entry } = params;
            this._add({
                type: entry.level,
                text: entry.text,
                source: entry.source
            });
        } else if (method === 'Runtime.consoleAPICalled') {
            const { type, args } = params;
            const text = args.map(a => a.value || a.description || '[Object]').join(' ');
            this._add({
                type: type,
                text: text,
                source: 'console'
            });
        } else if (method === 'Runtime.exceptionThrown') {
            const { exceptionDetails } = params;
            this._add({
                type: 'error',
                text: exceptionDetails.text,
                source: 'runtime'
            });
        }
    }

    onNavigation() {
        this.logs = [];
        this._add({ type: 'info', text: 'Navigation occurred - logs cleared', source: 'system' });
    }

    _add(logEntry) {
        this.logs.push(logEntry);
        if (this.logs.length > this.maxItems) {
            this.logs.shift();
        }
    }

    getFormatted() {
        return this.logs.map(l => `[${l.type.toUpperCase()}] ${l.source}: ${l.text}`).join('\n');
    }
}

export class DialogCollector {
    constructor() {
        this.activeDialog = null;
    }

    onEvent(method, params) {
        if (method === 'Page.javascriptDialogOpening') {
            this.activeDialog = {
                type: params.type,
                message: params.message
            };
        } else if (method === 'Page.javascriptDialogClosed') {
            this.activeDialog = null;
        }
    }

    onNavigation() {
        this.activeDialog = null;
    }

    getFormatted() {
        if (!this.activeDialog) return null;
        return `[Blocking Dialog Active] Type: ${this.activeDialog.type}, Message: "${this.activeDialog.message}"`;
    }
}

export class CollectorManager {
    constructor() {
        this.network = new NetworkCollector();
        this.logs = new LogCollector();
        this.dialogs = new DialogCollector();
    }

    handleEvent(method, params) {
        if (method === 'Page.frameNavigated') {
            // Check if Main Frame (parentId is undefined for main frame)
            if (!params.frame.parentId) {
                this.network.onNavigation();
                this.logs.onNavigation();
                this.dialogs.onNavigation();
            }
        }

        if (method.startsWith('Network.')) {
            this.network.onEvent(method, params);
        }
        if (method.startsWith('Log.') || method.startsWith('Runtime.') || method.startsWith('Audits.')) {
            this.logs.onEvent(method, params);
        }
        if (method.startsWith('Page.javascriptDialog')) {
            this.dialogs.onEvent(method, params);
        }
    }

    clear() {
        this.network = new NetworkCollector();
        this.logs = new LogCollector();
        this.dialogs = new DialogCollector();
    }
}
