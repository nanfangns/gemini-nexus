
// sandbox/controllers/prompt.js
import { appendMessage } from '../render/message.js';
import { sendToBackground, saveSessionsToStorage } from '../../lib/messaging.js';
import { t } from '../core/i18n.js';

function normalizeFiles(files) {
    if (!Array.isArray(files) || files.length === 0) return [];
    return files
        .filter((f) => f && typeof f === 'object' && typeof f.base64 === 'string')
        .map((f, index) => {
            const type = f.type || 'image/png';
            const ext = type.split('/')[1] || 'bin';
            return {
                base64: f.base64,
                type,
                name: f.name || `attachment-${index + 1}.${ext}`,
            };
        });
}

export class PromptController {
    constructor(sessionManager, uiController, imageManager, appController) {
        this.sessionManager = sessionManager;
        this.ui = uiController;
        this.imageManager = imageManager;
        this.app = appController;
        this.cancellationTimestamp = 0;
    }

    buildRequestPayload(text, files, sessionId, extra = {}) {
        const selectedModel = this.app.getSelectedModel();
        const conn = this.getConnectionData();

        // Multi-server MCP: collect all enabled servers
        let mcpServers = [];
        if (conn && Array.isArray(conn.mcpServers) && conn.mcpServers.length > 0) {
            mcpServers = conn.mcpServers.filter(
                (s) => s && s.enabled !== false && s.url && s.url.trim()
            );
        } else if (conn && (conn.mcpServerUrl || conn.mcpTransport)) {
            // Legacy single-server fallback
            mcpServers = [
                {
                    id: '_legacy_',
                    name: '',
                    transport: conn.mcpTransport || 'sse',
                    url: conn.mcpServerUrl || '',
                    enabled: true,
                    toolMode: 'all',
                    enabledTools: [],
                },
            ];
        }

        const enableMcpTools = conn.mcpEnabled === true && mcpServers.length > 0;
        const firstServer = mcpServers[0] || null;

        const payload = {
            action: 'SEND_PROMPT',
            text,
            files,
            model: selectedModel,
            includePageContext: this.app.pageContextActive,
            enableBrowserControl: this.app.browserControlActive,
            enableMcpTools,
            mcpServers,
            mcpTransport: firstServer ? firstServer.transport || 'sse' : 'sse',
            mcpServerUrl: firstServer ? firstServer.url || '' : '',
            mcpServerId: firstServer ? firstServer.id : null,
            sessionId,
            ...extra,
        };

        // Inject Doubao context if available
        const session = this.sessionManager.getCurrentSession();
        if (session && session.context) {
            sendToBackground({
                action: 'SET_CONTEXT',
                context: session.context,
                model: selectedModel,
            });

            if (session.context.doubaoConversationId) {
                payload.doubaoConversationId = session.context.doubaoConversationId;
            }
            if (session.context.doubaoSectionId) {
                payload.doubaoSectionId = session.context.doubaoSectionId;
            }
            if (session.context.doubaoReplyMessageId) {
                payload.doubaoReplyMessageId = session.context.doubaoReplyMessageId;
            }
            if (session.context.doubaoRoute) {
                payload.doubaoRoute = session.context.doubaoRoute;
            }
        }

        return payload;
    }

    getConnectionData() {
        return this.ui && this.ui.settings && this.ui.settings.connectionData
            ? this.ui.settings.connectionData
            : {};
    }

    setGeneratingState(isGenerating, sessionId = null) {
        this.app.isGenerating = isGenerating;
        this.app.generatingSessionId = isGenerating ? sessionId : null;
        this.ui.setLoading(isGenerating);
        this.app.sessionFlow.refreshHistoryUI();
    }

    async send() {
        if (this.app.isGenerating) return;

        const text = this.ui.inputFn.value.trim();
        const files = this.imageManager.getFiles();

        if (!text && files.length === 0) return;

        if (!this.sessionManager.currentSessionId) {
            this.sessionManager.createSession();
        }

        const currentId = this.sessionManager.currentSessionId;
        const session = this.sessionManager.getCurrentSession();

        // Update Title if needed
        if (session.messages.length === 0) {
            const titleUpdate = this.sessionManager.updateTitle(currentId, text || t('imageSent'));
            if(titleUpdate) this.app.sessionFlow.refreshHistoryUI();
        }

        // Render User Message
        const displayAttachments = files.map(f => f.base64);

        appendMessage(
            this.ui.historyDiv,
            text,
            'user',
            displayAttachments.length > 0 ? displayAttachments : null
        );

        this.sessionManager.addMessage(currentId, 'user', text, displayAttachments.length > 0 ? displayAttachments : null);

        saveSessionsToStorage(this.sessionManager.sessions);
        this.app.sessionFlow.refreshHistoryUI();

        this.ui.resetInput();
        this.imageManager.clearFile();

        this.setGeneratingState(true, currentId);

        sendToBackground(this.buildRequestPayload(text, files, currentId));
    }

    cancel() {
        if (!this.app.isGenerating) return;

        this.cancellationTimestamp = Date.now();

        sendToBackground({ action: 'CANCEL_PROMPT' });
        this.app.messageHandler.resetStream();

        this.app.isGenerating = false;
        this.app.generatingSessionId = null;
        this.ui.setLoading(false);
        this.ui.updateStatus(t('cancelled'));
    }

    isCancellationRecent() {
        return (Date.now() - this.cancellationTimestamp) < 2000; // 2s window
    }
}
