
// background/handlers/session/prompt_handler.js
import {
    appendAiMessage,
    appendAiMessageIfDisplayable,
    appendRawMessages,
    appendUserMessage,
    replaceSessionSnapshot,
    updateSessionMetadata,
} from '../../managers/history_manager.js';
import { PromptBuilder } from './prompt/builder.js';
import { ToolExecutor } from './prompt/tool_executor.js';
import {
    createOfficialFunctionResponseMessage,
    createOfficialFunctionResponseParts,
    createOfficialModelMessage,
    hasNativeFunctionCalls,
    parseToolCommand,
    splitToolCallFromText,
} from './utils.js';

// Helper to prevent rapid-fire requests that trigger rate limits
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const REQUEST_CANCELLED_TEXT = 'Request cancelled.';

async function getStoredProvider() {
    const stored = await chrome.storage.local.get(['geminiProvider', 'geminiUseOfficialApi']);
    return stored.geminiProvider || (stored.geminiUseOfficialApi === true ? 'official' : 'web');
}

async function sendRuntimeMessage(message) {
    try {
        await chrome.runtime.sendMessage(message);
    } catch (_) {}
}

function createIntermediateAiResult(result) {
    const split = splitToolCallFromText(result?.text || '');

    return {
        ...result,
        text: split.hasToolCall ? split.displayText : result?.text || '',
        thoughts: result?.thoughts || null,
        thoughtsDurationSeconds: result?.thoughtsDurationSeconds,
        sources: result?.sources || null,
        images: result?.images,
        thoughtSignature: result?.thoughtSignature,
        context: result?.context,
    };
}

function createCopySuppressedIntermediateAiResult(result) {
    const intermediate = createIntermediateAiResult(result);
    return {
        ...intermediate,
        suppressCopy: true,
    };
}

function detectPromptLanguage(text) {
    const value = typeof text === 'string' ? text : '';
    const zhMatches = value.match(/[\u3400-\u9fff]/g) || [];
    if (zhMatches.length >= 2) return 'zh';
    return 'default';
}

function buildLanguageContinuationInstruction(language) {
    if (language === 'zh') {
        return '此时请使用与用户相同的语言回答，并保持与用户原始请求一致的新语言。';
    }
    return 'Continue in the same language as the original user request.';
}

function buildToolContinuationPrompt(toolName, output, language) {
    const languageInstruction = buildLanguageContinuationInstruction(language);
    if (language === 'zh') {
        return `工具 ${toolName} 已执行完毕：\n\`\`\`\n${output}\n\`\`\`\n\n${languageInstruction}\n\n请继续下一步操作并确认是否已完成。`;
    }

    return `[Tool Output from ${toolName}]:\n\`\`\`\n${output}\n\`\`\`\n\n${languageInstruction}\n\n(Proceed with the next step or confirm completion)`;
}

function getToolResultsFiles(toolResults) {
    return toolResults.flatMap((result) => (Array.isArray(result.files) ? result.files : []));
}

function getPrimaryToolResult(toolResults) {
    return Array.isArray(toolResults) && toolResults.length > 0 ? toolResults[0] : null;
}

function getToolResultOutputForDisplay(toolResult) {
    return typeof toolResult?.output === 'string'
        ? toolResult.output
        : String(toolResult?.output ?? '');
}

function buildTextToolResult(toolResult, outputForModel) {
    if (!toolResult) return null;
    return {
        ...toolResult,
        outputForModel,
        officialResponseParts: null,
        officialResponseBatchId: null,
        results: [toolResult],
    };
}

function buildNativeToolResult(toolResults, responseBatchId) {
    const primary = getPrimaryToolResult(toolResults);
    if (!primary) return null;

    return {
        ...primary,
        outputForModel: getToolResultOutputForDisplay(primary),
        officialResponseParts: createOfficialFunctionResponseParts(toolResults),
        officialResponseBatchId: responseBatchId,
        results: toolResults,
    };
}

function createFunctionResponseBatchId(sessionId, loopCount) {
    return ['official-tools', sessionId || 'no-session', Date.now(), loopCount].join('|');
}

export class PromptHandler {
    constructor(sessionManager, controlManager, mcpManager) {
        this.sessionManager = sessionManager;
        this.controlManager = controlManager;
        this.builder = new PromptBuilder(controlManager, mcpManager);
        this.toolExecutor = new ToolExecutor(controlManager, mcpManager);
        this.activeRun = null;
    }

    cancel() {
        this.cancelActiveRun();
    }

    createCancellationReply(request) {
        return {
            action: 'GEMINI_REPLY',
            sessionId: request?.sessionId || null,
            text: REQUEST_CANCELLED_TEXT,
            status: 'cancelled',
        };
    }

    cancelActiveRun({ notify = false } = {}) {
        const run = this.activeRun;
        if (!run || run.cancelled) return false;

        run.cancelled = true;
        if (notify) {
            sendRuntimeMessage(this.createCancellationReply(run.request));
        }
        return true;
    }

    isRunCancelled(run) {
        return !run || run.cancelled || this.activeRun !== run;
    }

    handle(request, sendResponse) {
        this.cancelActiveRun({ notify: true });

        const run = {
            request,
            cancelled: false,
        };
        this.activeRun = run;

        (async () => {
            const onUpdate = (partialText, partialThoughts) => {
                sendRuntimeMessage({
                    action: 'GEMINI_STREAM_UPDATE',
                    sessionId: request.sessionId || null,
                    text: partialText,
                    thoughts: partialThoughts,
                });
            };

            try {
                if (request.sessionSnapshot) {
                    const provider = await getStoredProvider();
                    if (provider === 'web') {
                        throw new Error('History editing is not supported for Gemini Web Client.');
                    }
                    await replaceSessionSnapshot(request.sessionSnapshot);
                }

                // AUTO-LOCK: If browser control enabled and no tab locked, lock to active tab
                if (request.enableBrowserControl && this.controlManager) {
                    this.controlManager.setOwnerSidePanelTabId?.(request.sidePanelTabId || null);
                    const currentLock = this.controlManager.getTargetTabId();
                    if (!currentLock) {
                        const tabs = await chrome.tabs.query({
                            active: true,
                            lastFocusedWindow: true,
                        });
                        if (tabs.length > 0) {
                            const tab = tabs[0];
                            this.controlManager.setTargetTab(tab.id);

                            // Notify UI to update the Tab Switcher icon
                            sendRuntimeMessage({
                                action: 'TAB_LOCKED',
                                tabId: request.sidePanelTabId || null,
                                tab: {
                                    id: tab.id,
                                    title: tab.title,
                                    favIconUrl: tab.favIconUrl,
                                    url: tab.url,
                                    active: tab.active,
                                },
                            });
                        }
                    }
                }

                // 1. Build Initial Prompt (with Preamble/Context separated)
                const buildResult = await this.builder.build(request);
                const systemInstruction = buildResult.systemInstruction;
                let currentPromptText = buildResult.userPrompt;
                let currentHistoryText = request.text;
                const pageContextMeta = buildResult.pageContextMeta;
                const pageContextChanged = buildResult.pageContextChanged;
                const continuationLanguage = detectPromptLanguage(request.text);

                let currentFiles = request.files;

                if (request.includePageContext && request.sessionId && pageContextMeta) {
                    if (pageContextChanged) {
                        await this.sessionManager.resetContext({ rotateAccount: false });
                        delete request.doubaoConversationId;
                        delete request.doubaoSectionId;
                        delete request.doubaoReplyMessageId;
                        delete request.doubaoRoute;
                    }

                    const sessionPatch = { pageContextMeta };
                    if (pageContextChanged) {
                        sessionPatch.context = null;
                    }
                    await updateSessionMetadata(request.sessionId, sessionPatch);
                }

                let loopCount = 0;
                // 0 means unlimited (Infinity). Default to 0 if undefined.
                const reqLoops = request.maxLoops !== undefined ? request.maxLoops : 0;
                const MAX_LOOPS = reqLoops === 0 ? Infinity : reqLoops;

                let keepLooping = true;

                // --- AUTOMATED FEEDBACK LOOP ---
                while (keepLooping && loopCount < MAX_LOOPS) {
                    if (this.isRunCancelled(run)) break;

                    // 2. Send to model
                    const result = await this.sessionManager.handleSendPrompt(
                        {
                            ...request,
                            text: currentPromptText,
                            historyPromptText: currentHistoryText,
                            systemInstruction: systemInstruction,
                            files: currentFiles,
                        },
                        onUpdate
                    );

                    if (this.isRunCancelled(run)) break;

                    if (!result || result.status !== 'success') {
                        // If error, notify UI and break loop
                        if (result) sendRuntimeMessage(result);
                        break;
                    }

                    // 3. Process Tool Execution (if any)
                    let toolResult = null;
                    const toolsEnabled = request.enableBrowserControl || request.enableMcpTools;
                    const pendingNativeCalls = toolsEnabled && hasNativeFunctionCalls(result);
                    const pendingToolCommand =
                        toolsEnabled && !pendingNativeCalls
                            ? parseToolCommand(result.text || '')
                            : null;
                    if (pendingToolCommand && request.sessionId) {
                        await appendAiMessageIfDisplayable(
                            request.sessionId,
                            createCopySuppressedIntermediateAiResult(result)
                        );
                    }

                    if (toolsEnabled) {
                        if (pendingNativeCalls) {
                            const batchId = createFunctionResponseBatchId(
                                request.sessionId,
                                loopCount + 1
                            );
                            const toolResults = await this.toolExecutor.executeFunctionCalls(
                                result.functionCalls,
                                request
                            );
                            toolResult = buildNativeToolResult(toolResults, batchId);
                        } else {
                            const textToolResult = await this.toolExecutor.executeIfPresent(
                                result.text,
                                request,
                                onUpdate
                            );
                            toolResult = buildTextToolResult(
                                textToolResult,
                                textToolResult?.output || ''
                            );
                        }
                    }

                    if (this.isRunCancelled(run)) break;

                    // 4. Decide Next Step
                    if (toolResult) {
                        // Tool executed, feed back to model (Loop continues)
                        loopCount++;
                        const allToolFiles = getToolResultsFiles(
                            toolResult.results || [toolResult]
                        );
                        currentFiles = allToolFiles;

                        let outputForModel = toolResult.outputForModel;

                        // --- AUTO-SNAPSHOT INJECTION ---
                        const skipSnapshotTools = [
                            'take_snapshot',
                            'take_screenshot',
                            'get_logs',
                            'list_network_requests',
                            'get_network_request',
                            'performance_start_trace',
                            'performance_stop_trace',
                            'list_pages',
                        ];

                        if (
                            toolResult.source === 'browser_control' &&
                            request.enableBrowserControl &&
                            this.controlManager &&
                            !skipSnapshotTools.includes(toolResult.toolName)
                        ) {
                            try {
                                const targetTabId = this.controlManager.getTargetTabId();
                                let urlInfo = '';
                                if (targetTabId) {
                                    try {
                                        const tab = await chrome.tabs.get(targetTabId);
                                        urlInfo = `[Current URL]: ${tab.url}\n`;
                                    } catch (e) {}
                                }

                                const snapshot = await this.controlManager.getSnapshot();
                                if (
                                    snapshot &&
                                    typeof snapshot === 'string' &&
                                    !snapshot.startsWith('Error')
                                ) {
                                    outputForModel += `\n\n${urlInfo}[Updated Page Accessibility Tree]:\n\`\`\`text\n${snapshot}\n\`\`\`\n`;
                                }
                            } catch (e) {
                                console.warn('Auto-snapshot injection failed:', e);
                            }
                        }

                        const isOfficialFunctionResponse =
                            Array.isArray(toolResult.officialResponseParts) &&
                            toolResult.officialResponseParts.length > 0;

                        if (isOfficialFunctionResponse && toolResult.source === 'browser_control') {
                            toolResult.officialResponseParts = createOfficialFunctionResponseParts(
                                (toolResult.results || [toolResult]).map((item) => {
                                    if (
                                        item?.source !== 'browser_control' ||
                                        item.toolName !== toolResult.toolName
                                    ) {
                                        return item;
                                    }
                                    return {
                                        ...item,
                                        output: outputForModel,
                                    };
                                })
                            );
                        }

                        // Format continuation prompt for the model
                        currentPromptText = isOfficialFunctionResponse
                            ? ''
                            : buildToolContinuationPrompt(
                                  toolResult.toolName,
                                  outputForModel,
                                  continuationLanguage
                              );

                        // Save "User" message (Tool Output) to history
                        if (request.sessionId) {
                            const toolResults = toolResult.results || [toolResult];
                            const toolOutputMessages = [];
                            const toolCallSplit = splitToolCallFromText(result.text || '');
                            const textToolCallText =
                                toolCallSplit.toolCallText || result.text || '';

                            for (const [index, item] of toolResults.entries()) {
                                const itemFiles = Array.isArray(item.files) ? item.files : [];
                                const historyImages = itemFiles.length
                                    ? itemFiles.map((f) => f.base64)
                                    : null;
                                const itemToolCallText = pendingNativeCalls
                                    ? JSON.stringify(
                                          { tool: item.toolName, args: item.args || {} },
                                          null,
                                          2
                                      )
                                    : textToolCallText;
                                const step = loopCount;
                                const callIndex = Number.isFinite(item.callIndex)
                                    ? item.callIndex
                                    : index + 1;
                                const callCount = Number.isFinite(item.callCount)
                                    ? item.callCount
                                    : toolResults.length;
                                const userMsg = `[Tool Output: ${item.toolName}]\n${item.output}\n\n[Proceeding to step ${step}]`;

                                // Notify UI of individual tool output
                                sendRuntimeMessage({
                                    action: 'TOOL_OUTPUT_MESSAGE',
                                    sessionId: request.sessionId,
                                    toolName: item.toolName,
                                    text: item.output,
                                    images: historyImages,
                                    toolCallText: itemToolCallText,
                                    status: item.status || 'completed',
                                    step,
                                    callIndex,
                                    callCount,
                                });

                                toolOutputMessages.push({
                                    role: 'user',
                                    text: userMsg,
                                    image: historyImages,
                                    kind: 'tool-output',
                                    toolName: item.toolName,
                                    toolStatus: item.status || 'completed',
                                    toolCallText: itemToolCallText,
                                    toolStep: step,
                                    toolCallIndex: callIndex,
                                    toolCallCount: callCount,
                                    officialFunctionResponseBatchId:
                                        toolResult.officialResponseBatchId || null,
                                });
                            }

                            if (isOfficialFunctionResponse) {
                                const officialMessages = [];
                                const officialModelMessage = createOfficialModelMessage(result);
                                const officialResponseMessage =
                                    createOfficialFunctionResponseMessage(toolResults);
                                if (officialModelMessage)
                                    officialMessages.push(officialModelMessage);
                                if (officialResponseMessage) {
                                    officialResponseMessage.officialFunctionResponseBatchId =
                                        toolResult.officialResponseBatchId;
                                    officialMessages.push(officialResponseMessage);
                                }
                                await appendRawMessages(request.sessionId, [
                                    ...officialMessages,
                                    ...toolOutputMessages,
                                ]);
                                currentHistoryText = '';
                            } else {
                                const primaryMessage = toolOutputMessages[0];
                                if (primaryMessage) {
                                    await appendUserMessage(
                                        request.sessionId,
                                        primaryMessage.text,
                                        primaryMessage.image,
                                        {
                                            kind: 'tool-output',
                                            toolName: primaryMessage.toolName,
                                            toolStatus: primaryMessage.toolStatus,
                                            toolCallText: primaryMessage.toolCallText,
                                            toolStep: primaryMessage.toolStep,
                                            toolCallIndex: primaryMessage.toolCallIndex,
                                            toolCallCount: primaryMessage.toolCallCount,
                                        }
                                    );
                                    currentHistoryText = primaryMessage.text;
                                }
                            }
                        }

                        if (isOfficialFunctionResponse) {
                            currentFiles = [];
                            request.officialUserParts = toolResult.officialResponseParts;
                            request.officialFunctionResponseBatchId =
                                toolResult.officialResponseBatchId;
                        } else {
                            request.officialUserParts = null;
                            request.officialFunctionResponseBatchId = null;
                        }

                        // === RATE LIMIT MITIGATION ===
                        await delay(2000 + Math.random() * 2000);

                        if (this.isRunCancelled(run)) break;
                    } else {
                        // No tool execution, final answer reached.
                        if (request.sessionId) {
                            await appendAiMessage(request.sessionId, result);
                        }

                        sendRuntimeMessage(result);
                        keepLooping = false;
                    }
                }
            } catch (e) {
                console.error('Prompt loop error:', e);
                if (!this.isRunCancelled(run)) {
                    sendRuntimeMessage({
                        action: 'GEMINI_REPLY',
                        sessionId: request.sessionId || null,
                        text: 'Error: ' + e.message,
                        status: 'error',
                    });
                }
            } finally {
                if (this.activeRun === run) {
                    this.activeRun = null;
                }
                sendResponse({ status: 'completed' });
            }
        })();
        return true;
    }
}
