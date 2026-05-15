// background/handlers/session/prompt/tool_executor.js
import { parseToolCommand } from '../utils.js';
import { ToolDispatcher } from '../../../control/dispatcher.js';

export class ToolExecutor {
    constructor(controlManager, mcpManager) {
        this.controlManager = controlManager;
        this.mcpManager = mcpManager || null;
    }

    async executeIfPresent(text, request, onUpdate) {
        const toolCommand = parseToolCommand(text);
        if (!toolCommand) return null;

        return this.executeCommand(toolCommand, request, text || '');
    }

    async executeFunctionCalls(functionCalls, request) {
        const calls = Array.isArray(functionCalls) ? functionCalls : [];
        const validCalls = calls.filter(
            (call) => call && typeof call.name === 'string' && call.name.trim()
        );
        const results = [];

        for (const [index, call] of validCalls.entries()) {
            results.push(
                await this.executeCommand(
                    {
                        name: call.name,
                        args: call.args || {},
                        id: call.id || null,
                    },
                    request,
                    this.formatFunctionCallText(call),
                    {
                        callIndex: index + 1,
                        callCount: validCalls.length,
                    }
                )
            );
        }

        return results;
    }

    formatFunctionCallText(call) {
        if (!call) return '';
        return `function_call: ${call.name}(${JSON.stringify(call.args || {})})`;
    }

    async executeCommand(toolCommand, request, toolCallText = '', callMeta = {}) {
        const toolName = toolCommand.name;
        const callIndex = Number.isFinite(callMeta.callIndex) ? callMeta.callIndex : null;
        const callCount = Number.isFinite(callMeta.callCount) ? callMeta.callCount : null;
        const statusKey = this.createToolStatusKey(request, toolName, callIndex, callCount);
        this.sendToolStatus(request, {
            statusKey,
            toolName,
            status: 'running',
            toolCallText,
            callIndex,
            callCount,
        });

        let output = '';
        let files = null;
        let source = 'unknown';
        let status = 'completed';

        try {
            if (ToolDispatcher.isLocalTool(toolName) && request.enableBrowserControl === true) {
                if (!this.controlManager) {
                    throw new Error('Browser control is unavailable.');
                }

                source = 'browser_control';
                const execResult = await this.controlManager.execute({
                    name: toolName,
                    args: toolCommand.args || {},
                });

                if (execResult && typeof execResult === 'object' && execResult.image) {
                    output = execResult.text || '';
                    files = [
                        {
                            base64: execResult.image,
                            type: 'image/png',
                            name: 'screenshot.png',
                        },
                    ];
                } else {
                    output = execResult;
                }
            } else {
                // Check if MCP is available
                const mcpEnabled = request.enableMcpTools === true && this.mcpManager;

                if (!mcpEnabled) {
                    throw new Error(
                        `Unknown tool '${toolName}'. (External MCP tools are disabled)`
                    );
                }

                source = 'mcp_remote';
                const remote = await this.mcpManager.callTool(toolName, toolCommand.args || {});
                output = typeof remote === 'string' ? remote : JSON.stringify(remote, null, 2);
            }
        } catch (err) {
            output = `Error executing tool: ${err.message}`;
            status = 'failed';

            // Attempt snapshot refresh on stale UID errors
            if (source === 'browser_control' && this._isStaleUIDError(err)) {
                try {
                    await this.controlManager.getSnapshot();
                } catch (_) {}
            }
        }

        this.sendToolStatus(request, {
            statusKey,
            toolName,
            status,
            toolCallText,
            callIndex,
            callCount,
        });

        return {
            toolName,
            output,
            files,
            source,
            status,
            needsSnapshotRefresh: source === 'browser_control' && ToolDispatcher.isLocalTool(toolName),
            id: toolCommand.id || null,
            args: toolCommand.args || {},
            callIndex,
            callCount,
        };
    }

    createToolStatusKey(request, toolName, callIndex, callCount) {
        const session = request.sessionId || 'no-session';
        const index = callIndex != null ? callIndex : 0;
        const count = callCount != null ? callCount : 1;
        return `${session}::${toolName}::${index}/${count}`;
    }

    sendToolStatus(request, payload) {
        try {
            chrome.runtime.sendMessage({
                action: 'TOOL_STATUS',
                sessionId: request.sessionId || null,
                ...payload,
            }).catch(() => {});
        } catch (_) {}
    }

    _isStaleUIDError(err) {
        const msg = err.message || '';
        return (
            msg.includes('Stale Element Reference') ||
            msg.includes('older snapshot') ||
            msg.includes('not found in current snapshot') ||
            msg.includes('is detached from the DOM')
        );
    }
}
