
// services/providers/grok_web.js

/**
 * Sends a message using the Grok.com web interface.
 * Uses cookie-based authentication (extracted from active grok.com session).
 *
 * API Details:
 * - Endpoint: POST https://grok.com/rest/app-chat/conversations/{conversationId}/responses
 * - Auth: Cookie-based (sso, x-signature, x-userid, cf_clearance)
 * - Mode: auto (grok-4), fast (quick), expert (deep thinking)
 * - Response: SSE stream with token-by-token output
 */

import { fetchGrokCookies, validateGrokCookies } from '../grok_auth.js';

export class GrokWebProvider {
    constructor() {
        this.authData = null;
    }

    /**
     * Ensure we have valid auth cookies.
     */
    async ensureAuth() {
        if (!this.authData || !validateGrokCookies(this.authData)) {
            this.authData = await fetchGrokCookies();
        }
        return this.authData;
    }

    /**
     * Build browser fingerprint headers for Grok requests.
     */
    buildHeaders() {
        const headers = {
            'Content-Type': 'application/json',
            'Origin': 'https://grok.com',
            'Referer': 'https://grok.com/',
            'User-Agent': navigator.userAgent,
        };

        // Add required grok headers
        const cookieMap = {};
        if (this.authData?.cookieList) {
            for (const cookie of this.authData.cookieList) {
                cookieMap[cookie.name] = cookie.value;
            }
        }

        // Add x-statsig-id if available (for tracking)
        if (cookieMap['x-statsig-id']) {
            headers['x-statsig-id'] = cookieMap['x-statsig-id'];
        }

        // Generate x-xai-request-id (UUID4)
        headers['x-xai-request-id'] = this.generateUUID();

        return headers;
    }

    /**
     * Generate a UUID4.
     */
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Send a message to Grok and stream the response.
     * @param {string} prompt - User message
     * @param {string} conversationId - Conversation ID (empty for new chat)
     * @param {string} parentResponseId - Previous AI response ID for context
     * @param {string} mode - 'auto' | 'fast' | 'expert'
     * @param {AbortSignal} signal - Abort signal
     * @param {Function} onUpdate - Callback for streaming updates
     */
    async sendMessage(prompt, conversationId, parentResponseId, mode = 'auto', signal, onUpdate) {
        await this.ensureAuth();

        const endpoint = conversationId
            ? `https://grok.com/rest/app-chat/conversations/${conversationId}/responses`
            : `https://grok.com/rest/app-chat/conversations/responses`;

        const payload = {
            message: prompt,
            parentResponseId: parentResponseId || null,
            modeId: mode,
            enableImageGeneration: true,
            enableImageStreaming: true,
            imageGenerationCount: 2,
            deviceEnvInfo: {
                deviceType: 'DESKTOP',
                platform: 'WEB',
                browser: 'Chrome'
            },
            toolOverrides: {}
        };

        console.log('[Grok Web] Sending message to:', endpoint);
        console.log('[Grok Web] Mode:', mode);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                ...this.buildHeaders(),
                'Cookie': this.authData.cookies
            },
            body: JSON.stringify(payload),
            signal
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('[Grok Web] Error response:', text);

            if (response.status === 401 || response.status === 403) {
                // Auth failed - clear cached auth to force re-fetch
                this.authData = null;
                throw new Error("Grok authentication failed. Please ensure you're logged in at grok.com");
            }

            throw new Error(`Grok API Error (${response.status}): ${text.substring(0, 200)}`);
        }

        // Parse SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";
        let fullText = "";
        let responseId = "";
        let conversationIdFromResponse = conversationId;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process line by line (SSE format: each line starts with "data: ")
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                // SSE format: "data: " prefix
                let jsonStr = trimmed;
                if (trimmed.startsWith('data: ')) {
                    jsonStr = trimmed.substring(6);
                }

                if (!jsonStr || jsonStr === '[DONE]') continue;

                try {
                    const data = JSON.parse(jsonStr);

                    // Extract conversation ID from response
                    if (data.result?.conversationId) {
                        conversationIdFromResponse = data.result.conversationId;
                    }

                    // Extract response ID
                    if (data.result?.responseId) {
                        responseId = data.result.responseId;
                    }

                    // Handle token streaming
                    if (data.result?.token !== undefined) {
                        const token = data.result.token;
                        const isSoftStop = data.result.isSoftStop === true;
                        const isThinking = data.result.isThinking === true;

                        // Skip empty tokens except for soft stop
                        if (token || isSoftStop) {
                            if (!isThinking && token) {
                                fullText += token;
                                onUpdate?.(fullText, null);
                            }
                        }

                        // Check for end of stream
                        if (isSoftStop) {
                            console.log('[Grok Web] Stream completed');
                            break;
                        }
                    }

                    // Handle full model response (final metadata)
                    if (data.result?.modelResponse) {
                        const modelResponse = data.result.modelResponse;
                        if (modelResponse.text) {
                            fullText = modelResponse.text;
                        }
                        if (modelResponse.conversationId) {
                            conversationIdFromResponse = modelResponse.conversationId;
                        }
                    }

                } catch (e) {
                    // Ignore parse errors for incomplete JSON
                    if (!e.message.includes('Unexpected end')) {
                        console.debug('[Grok Web] Parse error:', e.message);
                    }
                }
            }
        }

        console.log('[Grok Web] Response complete, length:', fullText.length);

        return {
            text: fullText,
            conversationId: conversationIdFromResponse,
            responseId: responseId,
            status: "success"
        };
    }

    /**
     * Reset auth cache (force re-fetch on next request).
     */
    resetAuth() {
        this.authData = null;
    }
}

// Export singleton instance
export const grokWebProvider = new GrokWebProvider();
