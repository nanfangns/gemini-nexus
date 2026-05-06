
// background/managers/session/request_dispatcher.js
import { sendOfficialMessage } from '../../../services/providers/official.js';
import { sendWebMessage } from '../../../services/providers/web.js';
import { sendOpenAIMessage } from '../../../services/providers/openai_compatible.js';
import { sendAnthropicMessage } from '../../../services/providers/anthropic.js';
import { sendXaiMessage } from '../../../services/providers/xai.js';
import { doubaoWebProvider } from '../../../services/providers/doubao_web.js';
import { getHistory } from './history_store.js';

export class RequestDispatcher {
    constructor(authManager) {
        this.auth = authManager;
    }

    async dispatch(request, settings, files, onUpdate, signal) {
        if (settings.provider === 'official') {
            return await this._handleOfficialRequest(request, settings, files, onUpdate, signal);
        } else if (settings.provider === 'openai') {
            return await this._handleOpenAIRequest(request, settings, files, onUpdate, signal);
        } else if (settings.provider === 'anthropic') {
            return await this._handleAnthropicRequest(request, settings, files, onUpdate, signal);
        } else if (settings.provider === 'xai') {
            return await this._handleXaiRequest(request, settings, files, onUpdate, signal);
        } else if (settings.provider === 'doubao_web') {
            return await this._handleDoubaoWebRequest(request, settings, files, onUpdate, signal);
        } else {
            return await this._handleWebRequest(request, files, onUpdate, signal);
        }
    }

    async _handleOfficialRequest(request, settings, files, onUpdate, signal) {
        if (!settings.apiKey) throw new Error("API Key is missing. Please check settings.");
        
        // Fetch History
        let history = await getHistory(request.sessionId);

        const response = await sendOfficialMessage(
            request.text, 
            request.systemInstruction, 
            history, 
            settings.apiKey,
            request.model, 
            settings.thinkingLevel, 
            files, 
            signal,
            onUpdate
        );

        return {
            action: "GEMINI_REPLY",
            text: response.text,
            thoughts: response.thoughts,
            images: response.images,
            status: "success",
            context: null, // Official API is stateless
            thoughtSignature: response.thoughtSignature
        };
    }

    async _handleOpenAIRequest(request, settings, files, onUpdate, signal) {
        const configuredModels = (settings.openaiModel || '')
            .split(',')
            .map(model => model.trim())
            .filter(Boolean);

        // Always prefer a model that actually belongs to the OpenAI-compatible config.
        let targetModel = settings.model;
        if (!targetModel || targetModel === 'openai_custom' || !configuredModels.includes(targetModel)) {
            targetModel = configuredModels[0] || '';
        }

        const config = {
            baseUrl: settings.openaiBaseUrl,
            apiKey: settings.openaiApiKey,
            model: targetModel
        };

        let history = await getHistory(request.sessionId);

        const response = await sendOpenAIMessage(
            request.text,
            request.systemInstruction,
            history,
            config,
            files,
            signal,
            onUpdate
        );

        return {
            action: "GEMINI_REPLY",
            text: response.text,
            thoughts: response.thoughts,
            images: response.images,
            status: "success",
            context: null
        };
    }

    async _handleAnthropicRequest(request, settings, files, onUpdate, signal) {
        // Always use model from storage (authoritative source) instead of request payload
        let targetModel = settings.model;
        if (!targetModel || targetModel === 'anthropic_custom') {
            const configuredModels = settings.anthropicModel ? settings.anthropicModel.split(',') : [];
            targetModel = configuredModels.length > 0 ? configuredModels[0].trim() : "claude-3-5-sonnet-20241022";
        }

        const config = {
            baseUrl: settings.anthropicBaseUrl,
            apiKey: settings.anthropicApiKey,
            model: targetModel
        };

        let history = await getHistory(request.sessionId);

        const response = await sendAnthropicMessage(
            request.text,
            request.systemInstruction,
            history,
            config,
            files,
            signal,
            onUpdate
        );

        return {
            action: "GEMINI_REPLY",
            text: response.text,
            thoughts: response.thoughts,
            images: response.images,
            status: "success",
            context: null
        };
    }

    async _handleXaiRequest(request, settings, files, onUpdate, signal) {
        // Always use model from storage (authoritative source) instead of request payload
        let targetModel = settings.model;
        if (!targetModel || targetModel === 'xai_custom') {
            const configuredModels = settings.xaiModel ? settings.xaiModel.split(',') : [];
            targetModel = configuredModels.length > 0 ? configuredModels[0].trim() : "grok-3-mini";
        }

        const config = {
            apiKey: settings.xaiApiKey,
            model: targetModel
        };

        let history = await getHistory(request.sessionId);

        const response = await sendXaiMessage(
            request.text,
            request.systemInstruction,
            history,
            config,
            files,
            signal,
            onUpdate
        );

        return {
            action: "GEMINI_REPLY",
            text: response.text,
            thoughts: response.thoughts,
            images: response.images,
            status: "success",
            context: null
        };
    }

    async _handleDoubaoWebRequest(request, settings, files, onUpdate, signal) {
        let fullText = request.text;
        if (request.systemInstruction) {
            fullText = request.systemInstruction + "\n\n" + fullText;
        }

        let targetModel = settings.model || request.model || 'doubao-default';
        if (!['doubao-default', 'doubao-think', 'doubao-expert'].includes(targetModel)) {
            targetModel = 'doubao-default';
        }

        let attemptCount = 0;
        const maxAttempts = 2;

        while (attemptCount < maxAttempts) {
            attemptCount++;

            try {
                const response = await doubaoWebProvider.sendMessage(
                    fullText,
                    request.doubaoConversationId || '',
                    request.doubaoSectionId || '',
                    request.doubaoReplyMessageId || '',
                    files,
                    signal,
                    onUpdate,
                    targetModel
                );

                return {
                    action: "GEMINI_REPLY",
                    text: response.text,
                    thoughts: response.thoughts,
                    images: [],
                    status: "success",
                    context: response.context
                };
            } catch (err) {
                const isLoginError = err.message && (
                    err.message.includes("Doubao authentication failed") ||
                    err.message.includes("log in") ||
                    err.message.includes("401") ||
                    err.message.includes("403")
                );

                if (isLoginError && attemptCount < maxAttempts) {
                    await doubaoWebProvider.resetAuth();
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }

                throw err;
            }
        }
    }

    async _handleWebRequest(request, files, onUpdate, signal) {
        // Ensure auth is possibly ready, though SessionManager usually handles initialization.
        
        let attemptCount = 0;
        const maxAttempts = Math.max(3, this.auth.accountIndices.length > 1 ? 3 : 2);

        // Concatenate System Instruction for Web Client
        let fullText = request.text;
        if (request.systemInstruction) {
            fullText = request.systemInstruction + "\n\nQuestion: " + fullText;
        }

        while (attemptCount < maxAttempts) {
            attemptCount++;
            
            try {
                this.auth.checkModelChange(request.model);
                const context = await this.auth.getOrFetchContext();
                
                const response = await sendWebMessage(
                    fullText, 
                    context, 
                    request.model, 
                    files, 
                    signal,
                    onUpdate
                );

                // Success! Update auth state
                await this.auth.updateContext(response.newContext, request.model);

                return {
                    action: "GEMINI_REPLY",
                    text: response.text,
                    thoughts: response.thoughts,
                    images: response.images,
                    status: "success",
                    context: response.newContext 
                };

            } catch (err) {
                const isLoginError = err.message && (
                    err.message.includes("未登录") || 
                    err.message.includes("Not logged in") || 
                    err.message.includes("Sign in") || 
                    err.message.includes("401") || 
                    err.message.includes("403")
                );
                
                const isNetworkGlitch = err.message && (
                    err.message.includes("No valid response found") ||
                    err.message.includes("Network Error") ||
                    err.message.includes("Failed to fetch") ||
                    err.message.includes("Check network") ||
                    err.message.includes("429")
                );
                
                if ((isLoginError || isNetworkGlitch) && attemptCount < maxAttempts) {
                    const type = isLoginError ? "Auth" : "Network";
                    console.warn(`[Gemini Nexus] ${type} error (${err.message}), retrying... (Attempt ${attemptCount}/${maxAttempts})`);
                    
                    if (isLoginError || isNetworkGlitch) {
                         if (this.auth.accountIndices.length > 1) {
                             await this.auth.rotateAccount();
                         }
                         this.auth.forceContextRefresh();
                    }
                    
                    const baseDelay = Math.pow(2, attemptCount) * 1000;
                    const jitter = Math.random() * 1000;
                    await new Promise(r => setTimeout(r, baseDelay + jitter));
                    continue; 
                }
                
                throw err;
            }
        }
    }
}
