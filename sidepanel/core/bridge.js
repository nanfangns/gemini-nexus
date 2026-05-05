
// sidepanel/core/bridge.js
import { downloadFile, downloadText } from '../utils/download.js';

export class MessageBridge {
    constructor(frameManager, stateManager) {
        this.frame = frameManager;
        this.state = stateManager;
    }

    init() {
        window.addEventListener('message', this.handleWindowMessage.bind(this));
        chrome.runtime.onMessage.addListener(this.handleRuntimeMessage.bind(this));
    }

    handleWindowMessage(event) {
        // Security check: Only accept messages from our direct iframe
        if (!this.frame.isWindow(event.source)) return;

        const { action, payload } = event.data;

        // 1. Handshake
        if (action === 'UI_READY') {
            this.state.markUiReady();
            return;
        }

        // 2. Window Management
        if (action === 'OPEN_FULL_PAGE') {
            const url = chrome.runtime.getURL('sidepanel/index.html');
            chrome.tabs.create({ url });
            return;
        }

        // 3. Background Forwarding
        if (action === 'FORWARD_TO_BACKGROUND') {
            chrome.runtime.sendMessage(payload)
                .then(response => {
                    // Only forward responses for actions that need a reply in the sandbox
                    const needsReply = ['GET_LOGS', 'CHECK_PAGE_CONTEXT', 'FETCH_MODELS'].includes(payload.action);
                    if (response && needsReply) {
                        this.frame.postMessage({
                            action: 'BACKGROUND_MESSAGE',
                            payload: response
                        });
                    }
                })
                .catch(err => console.warn("Error forwarding to background:", err));
            return;
        }

        // 4. Downloads
        if (action === 'DOWNLOAD_IMAGE') {
            downloadFile(payload.url, payload.filename);
            return;
        }
        if (action === 'DOWNLOAD_LOGS') {
            downloadText(payload.text, payload.filename || 'gemini-nexus-logs.txt');
            return;
        }

        // 5. Data Getters (Immediate Response)
        if (action === 'GET_THEME') {
            this.frame.postMessage({ action: 'RESTORE_THEME', payload: this.state.getCached('geminiTheme') });
            return;
        }
        if (action === 'GET_LANGUAGE') {
            this.frame.postMessage({ action: 'RESTORE_LANGUAGE', payload: this.state.getCached('geminiLanguage') });
            return;
        }
        if (action === 'GET_TEXT_SELECTION') {
            // Some keys might not be in initial bulk fetch if added later, but usually are.
            // Fallback to async storage if needed, but state.data usually has it.
            chrome.storage.local.get(['geminiTextSelectionEnabled'], (res) => {
                const val = res.geminiTextSelectionEnabled !== false;
                this.frame.postMessage({ action: 'RESTORE_TEXT_SELECTION', payload: val });
            });
            return;
        }
        if (action === 'GET_IMAGE_TOOLS') {
            chrome.storage.local.get(['geminiImageToolsEnabled'], (res) => {
                const val = res.geminiImageToolsEnabled !== false;
                this.frame.postMessage({ action: 'RESTORE_IMAGE_TOOLS', payload: val });
            });
            return;
        }
        if (action === 'GET_ACCOUNT_INDICES') {
            chrome.storage.local.get(['geminiAccountIndices'], (res) => {
                this.frame.postMessage({ action: 'RESTORE_ACCOUNT_INDICES', payload: res.geminiAccountIndices || "0" });
            });
            return;
        }
        if (action === 'GET_CONNECTION_SETTINGS') {
            chrome.storage.local.get([
                'geminiProvider',
                'geminiUseOfficialApi',
                'geminiApiKey',
                'geminiThinkingLevel',
                'geminiOpenaiBaseUrl',
                'geminiOpenaiApiKey',
                'geminiOpenaiModel',
                'geminiAnthropicBaseUrl',
                'geminiAnthropicApiKey',
                'geminiAnthropicModel',
                'geminiXaiApiKey',
                'geminiXaiModel',
                'geminiModel',
                'geminiProviderProfiles',
                'geminiActiveProfileIds'
            ], (res) => {
                this.frame.postMessage({
                    action: 'RESTORE_CONNECTION_SETTINGS',
                    payload: {
                        provider: res.geminiProvider || (res.geminiUseOfficialApi ? 'official' : 'web'),
                        useOfficialApi: res.geminiUseOfficialApi === true,
                        apiKey: res.geminiApiKey || "",
                        thinkingLevel: res.geminiThinkingLevel || "low",
                        openaiBaseUrl: res.geminiOpenaiBaseUrl || "",
                        openaiApiKey: res.geminiOpenaiApiKey || "",
                        openaiModel: res.geminiOpenaiModel || "",
                        anthropicBaseUrl: res.geminiAnthropicBaseUrl || "",
                        anthropicApiKey: res.geminiAnthropicApiKey || "",
                        anthropicModel: res.geminiAnthropicModel || "",
                        xaiApiKey: res.geminiXaiApiKey || "",
                        xaiModel: res.geminiXaiModel || "",
                        savedModel: res.geminiModel || null,
                        providerProfiles: res.geminiProviderProfiles || [],
                        activeProfileIds: res.geminiActiveProfileIds || { openai: null, anthropic: null }
                    }
                });
            });
            return;
        }
        if (action === 'GET_CUSTOM_PROMPT') {
            chrome.storage.local.get([
                'geminiCustomPrompt',
                'geminiCustomPromptState',
                'geminiCustomPromptPreset',
                'geminiCustomPromptCustom'
            ], (res) => {
                const promptState = res.geminiCustomPromptState && typeof res.geminiCustomPromptState === 'object'
                    ? res.geminiCustomPromptState
                    : {
                        customPrompt: typeof res.geminiCustomPromptCustom === 'string' ? res.geminiCustomPromptCustom : "",
                        promptPreset: typeof res.geminiCustomPromptPreset === 'string' ? res.geminiCustomPromptPreset : 'custom',
                        activePrompt: typeof res.geminiCustomPrompt === 'string' ? res.geminiCustomPrompt : "",
                        customPresets: [],
                        customPromptName: "",
                        linkedPresetId: null
                    };

                if ((!promptState.activePrompt || typeof promptState.activePrompt !== 'string') && typeof res.geminiCustomPrompt === 'string') {
                    promptState.activePrompt = res.geminiCustomPrompt;
                }

                this.frame.postMessage({
                    action: 'RESTORE_CUSTOM_PROMPT',
                    payload: promptState
                });
            });
            return;
        }

        // 6. Data Setters (Sync to Storage & Cache)
        if (action === 'SAVE_SESSIONS') this.state.save('geminiSessions', payload);
        if (action === 'SAVE_SHORTCUTS') this.state.save('geminiShortcuts', payload);
        if (action === 'SAVE_MODEL') this.state.save('geminiModel', payload);
        if (action === 'SAVE_THEME') this.state.save('geminiTheme', payload);
        if (action === 'SAVE_LANGUAGE') this.state.save('geminiLanguage', payload);
        if (action === 'SAVE_TEXT_SELECTION') this.state.save('geminiTextSelectionEnabled', payload);
        if (action === 'SAVE_IMAGE_TOOLS') this.state.save('geminiImageToolsEnabled', payload);
        if (action === 'SAVE_SIDEBAR_BEHAVIOR') this.state.save('geminiSidebarBehavior', payload);
        if (action === 'SAVE_ACCOUNT_INDICES') this.state.save('geminiAccountIndices', payload);
        if (action === 'SAVE_CONNECTION_SETTINGS') {
            this.state.save('geminiProvider', payload.provider);
            // Official
            this.state.save('geminiUseOfficialApi', payload.provider === 'official'); // Maintain legacy bool for now
            this.state.save('geminiApiKey', payload.apiKey);
            this.state.save('geminiThinkingLevel', payload.thinkingLevel);
            // OpenAI (flatten active profile)
            this.state.save('geminiOpenaiBaseUrl', payload.openaiBaseUrl);
            this.state.save('geminiOpenaiApiKey', payload.openaiApiKey);
            this.state.save('geminiOpenaiModel', payload.openaiModel);
            // Anthropic (flatten active profile)
            this.state.save('geminiAnthropicBaseUrl', payload.anthropicBaseUrl);
            this.state.save('geminiAnthropicApiKey', payload.anthropicApiKey);
            this.state.save('geminiAnthropicModel', payload.anthropicModel);
            // xAI
            this.state.save('geminiXaiApiKey', payload.xaiApiKey);
            this.state.save('geminiXaiModel', payload.xaiModel);
            // Profiles (full state)
            this.state.save('geminiProviderProfiles', payload.providerProfiles || []);
            this.state.save('geminiActiveProfileIds', payload.activeProfileIds || { openai: null, anthropic: null });
        }
        if (action === 'SAVE_CUSTOM_PROMPT') {
            const promptState = payload && typeof payload === 'object'
                ? payload
                : {
                    customPrompt: typeof payload === 'string' ? payload : "",
                    promptPreset: 'custom',
                    activePrompt: typeof payload === 'string' ? payload : ""
                };

            const customPrompt = typeof promptState.customPrompt === 'string'
                ? promptState.customPrompt
                : "";
            const promptPreset = typeof promptState.promptPreset === 'string'
                ? promptState.promptPreset
                : 'custom';
            const activePrompt = typeof promptState.activePrompt === 'string'
                ? promptState.activePrompt
                : (promptPreset === 'custom' ? customPrompt : "");
            const normalizedPromptState = {
                customPrompt,
                promptPreset,
                activePrompt,
                customPresets: Array.isArray(promptState.customPresets) ? promptState.customPresets : [],
                customPromptName: typeof promptState.customPromptName === 'string' ? promptState.customPromptName : "",
                linkedPresetId: typeof promptState.linkedPresetId === 'string' ? promptState.linkedPresetId : null
            };

            this.state.save('geminiCustomPrompt', activePrompt);
            this.state.save('geminiCustomPromptState', normalizedPromptState);
            this.state.save('geminiCustomPromptPreset', promptPreset);
            this.state.save('geminiCustomPromptCustom', customPrompt);
        }
    }

    handleRuntimeMessage(message) {
        if (message.action === 'SESSIONS_UPDATED') {
            this.state.updateSessions(message.sessions);
            this.frame.postMessage({
                action: 'RESTORE_SESSIONS',
                payload: message.sessions
            });
            return;
        }

        // Forward all other background messages to sandbox (e.g. GEMINI_STREAM_UPDATE)
        this.frame.postMessage({
            action: 'BACKGROUND_MESSAGE',
            payload: message
        });
    }
}
