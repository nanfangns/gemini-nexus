
// background/control/actions/observation/network.js
import { BaseActionHandler } from '../base.js';

export class NetworkActions extends BaseActionHandler {

    async getLogs() {
        const logs = this.connection.collectors.logs.getFormatted();
        const dialogStatus = this.connection.collectors.dialogs.getFormatted();
        
        let output = "";
        
        if (dialogStatus) {
            output += `!!! ALERT: ${dialogStatus} !!!\n(You must use 'handle_dialog' to clear this before proceeding)\n\n`;
        }
        
        output += (logs || "No logs captured.");
        return output;
    }

    async getNetworkActivity() {
        const net = this.connection.collectors.network.getFormatted();
        return net || "No network activity captured.";
    }

    async listNetworkRequests({ resourceTypes, limit = 20 }) {
        const collector = this.connection.collectors.network;
        const requests = collector.getList(resourceTypes, limit);
        
        if (requests.length === 0) return "No matching network requests found.";

        return requests.map(r => 
            `ID: ${r.id} | ${r.method} ${r.url} | Status: ${r.status} | Type: ${r.type}`
        ).join('\n');
    }

    async getNetworkRequest({ requestId }) {
        const req = this.connection.collectors.network.getRequest(requestId);
        if (!req) return `Error: Request ID ${requestId} not found. Use list_network_requests first.`;

        let body = "Not available (Request might be incomplete or garbage collected)";
        
        // Try to fetch body from CDP if request completed
        if (req.completed) {
            try {
                const res = await this.cmd("Network.getResponseBody", { requestId });
                body = res.body;
                
                if (res.base64Encoded) {
                     // Attempt to decode if it looks like text
                     if (req.mimeType && (req.mimeType.includes('json') || req.mimeType.includes('text') || req.mimeType.includes('xml'))) {
                         try {
                            body = atob(res.body);
                         } catch (e) {
                            body = "<Base64 Encoded Binary>";
                         }
                     } else {
                         body = "<Base64 Encoded Binary>";
                     }
                }
            } catch (e) {
                // Ignore, body might be gone or not available
                body = `Body fetch failed: ${e.message}`;
            }
        }

        return JSON.stringify({
            url: req.url,
            method: req.method,
            type: req.type,
            status: req.status,
            requestHeaders: req.requestHeaders,
            responseHeaders: req.responseHeaders,
            postData: req.postData,
            responseBody: body
        }, null, 2);
    }
}
