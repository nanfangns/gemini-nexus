// background/handlers/session/prompt/tool_executor.js
import { parseToolCommands } from '../utils.js';

const MAX_RETRIES = 2;

export class ToolExecutor {
    constructor(controlManager) {
        this.controlManager = controlManager;
    }

    async executeIfPresent(text, onUpdate) {
        if (!this.controlManager) return null;

        const tools = parseToolCommands(text);
        if (tools.length === 0) return null;

        // If only one tool, behave like before
        if (tools.length === 1) {
            return await this._executeSingle(tools[0], onUpdate);
        }

        // Multiple tools: execute all in sequence
        return await this._executeBatch(tools, onUpdate);
    }

    /**
     * Executes a single tool call with retry logic.
     */
    async _executeSingle(toolCommand, onUpdate) {
        const { name, args } = toolCommand;
        onUpdate(`Executing tool: ${name}...`, "Processing tool execution...");

        let lastError = null;
        let snapshotRefreshed = false;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                const execResult = await this.controlManager.execute({ name, args: args || {} });
                const { output, files } = this._unwrapResult(execResult);
                return {
                    toolName: name,
                    output,
                    files,
                    needsSnapshotRefresh: !snapshotRefreshed && _mayChangeState(name)
                };
            } catch (err) {
                lastError = err;
                if (_isStaleUIDError(err) && !snapshotRefreshed) {
                    snapshotRefreshed = true;
                    try {
                        await this.controlManager.getSnapshot();
                        onUpdate(`Snapshot refreshed, retrying ${name}...`, "Refreshing page state...");
                    } catch (snapErr) {
                        console.error("[ToolExecutor] Snapshot refresh failed:", snapErr);
                        break;
                    }
                    continue;
                }
                break;
            }
        }

        return {
            toolName: name,
            output: lastError ? `Error executing tool: ${lastError.message}` : "Unknown error",
            files: null,
            needsSnapshotRefresh: snapshotRefreshed
        };
    }

    /**
     * Executes multiple tool calls in sequence.
     * Each tool's output is collected, and a combined summary is returned.
     */
    async _executeBatch(tools, onUpdate) {
        const results = [];
        let needsSnapshotRefresh = false;

        for (let i = 0; i < tools.length; i++) {
            const tool = tools[i];
            const { name, args } = tool;

            onUpdate(
                `Executing tool ${i + 1}/${tools.length}: ${name}...`,
                `Batch execution (${i + 1}/${tools.length})`
            );

            let lastError = null;
            let snapshotRefreshed = false;
            let success = false;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    const execResult = await this.controlManager.execute({ name, args: args || {} });
                    const { output, files } = this._unwrapResult(execResult);
                    results.push({ toolName: name, output, files });

                    if (!snapshotRefreshed && _mayChangeState(name)) {
                        needsSnapshotRefresh = true;
                    }
                    success = true;
                    break;
                } catch (err) {
                    lastError = err;
                    if (_isStaleUIDError(err) && !snapshotRefreshed) {
                        snapshotRefreshed = true;
                        try {
                            await this.controlManager.getSnapshot();
                            onUpdate(`Snapshot refreshed, retrying ${name} (attempt ${attempt + 2})...`, "Refreshing page state...");
                        } catch (snapErr) {
                            console.error("[ToolExecutor] Snapshot refresh failed:", snapErr);
                            break;
                        }
                        continue;
                    }
                    break;
                }
            }

            if (!success) {
                results.push({
                    toolName: name,
                    output: lastError ? `Error: ${lastError.message}` : "Unknown error",
                    files: null
                });
            }

            // Small delay between batch tools to let the page settle
            if (i < tools.length - 1) {
                await new Promise(r => setTimeout(r, 300));
            }
        }

        // Combine outputs into a summary
        const combinedOutput = _formatBatchResults(results);
        const allFiles = results.flatMap(r => r.files || []);

        return {
            toolName: `batch(${tools.length})`,
            output: combinedOutput,
            files: allFiles.length > 0 ? allFiles : null,
            needsSnapshotRefresh
        };
    }

    /**
     * Unwraps the result from a tool execution into output + files.
     */
    _unwrapResult(execResult) {
        let output = "";
        let files = null;

        if (execResult && typeof execResult === 'object' && execResult.image) {
            output = execResult.text || "";
            files = [{
                base64: execResult.image,
                type: "image/png",
                name: "screenshot.png"
            }];
        } else if (execResult && typeof execResult === 'object' && execResult.output !== undefined) {
            output = execResult.output;
        } else if (execResult !== undefined && execResult !== null) {
            output = String(execResult);
        }

        return { output, files };
    }
}

/**
 * Formats multiple tool results into a readable combined output.
 */
function _formatBatchResults(results) {
    if (results.length === 0) return "No results.";

    return results.map((r, i) => {
        const status = r.output.startsWith("Error") ? "FAIL" : "OK";
        const truncated = r.output.length > 200 ? r.output.substring(0, 200) + "..." : r.output;
        return `[${i + 1}/${results.length}] ${status} ${r.toolName}: ${truncated}`;
    }).join("\n");
}

/**
 * Checks if an error message indicates a stale UID issue.
 */
function _isStaleUIDError(err) {
    const msg = err.message || "";
    return msg.includes("Stale Element Reference") ||
           msg.includes("older snapshot") ||
           msg.includes("not found in current snapshot") ||
           msg.includes("is detached from the DOM");
}

/**
 * Checks if a tool name may change page state and thus warrants a snapshot refresh.
 */
function _mayChangeState(toolName) {
    const stateChangingTools = [
        'click', 'drag_element', 'fill', 'fill_form', 'hover',
        'press_key', 'navigate_page', 'new_page', 'close_page',
        'select_page', 'attach_file', 'handle_dialog', 'emulate', 'resize_page',
        'start_trace', 'stop_trace'
    ];
    return stateChangingTools.includes(toolName);
}
