
// sandbox/ui/settings/sections/connection.js
import { CustomDropdown } from '../../dropdown.js';

export class ConnectionSection {
    constructor() {
        this.elements = {};
        this.dropdowns = {};
        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            providerWrapper: get('provider-select-wrapper'),
            providerTrigger: get('provider-select-trigger'),
            providerDropdown: get('provider-select-dropdown'),
            providerSelect: get('provider-select'),
            thinkingWrapper: get('thinking-level-wrapper'),
            thinkingTrigger: get('thinking-level-trigger'),
            thinkingDropdown: get('thinking-level-dropdown'),
            thinkingSelect: get('thinking-level-select'),
            apiKeyContainer: get('api-key-container'),
            apiKeyInput: get('api-key-input'),
            officialFields: get('official-fields'),
            openaiFields: get('openai-fields'),
            anthropicFields: get('anthropic-fields'),
            xaiFields: get('xai-fields'),
            openaiBaseUrl: get('openai-base-url'),
            openaiApiKey: get('openai-api-key'),
            openaiModel: get('openai-model'),
            anthropicBaseUrl: get('anthropic-base-url'),
            anthropicApiKey: get('anthropic-api-key'),
            anthropicModel: get('anthropic-model'),
            xaiApiKey: get('xai-api-key'),
            xaiModel: get('xai-model'),
        };
    }

    bindEvents() {
        const { providerWrapper, providerTrigger, providerDropdown, providerSelect,
                thinkingWrapper, thinkingTrigger, thinkingDropdown, thinkingSelect } = this.elements;

        // Provider dropdown
        if (providerWrapper && providerTrigger && providerDropdown && providerSelect) {
            this.dropdowns.provider = new CustomDropdown({
                wrapper: providerWrapper,
                trigger: providerTrigger,
                dropdown: providerDropdown,
                nativeSelect: providerSelect,
                options: [
                    { val: 'web', txt: 'Gemini Web Client (Free)' },
                    { val: 'official', txt: 'Google Gemini API' },
                    { val: 'openai', txt: 'OpenAI Compatible API' },
                    { val: 'anthropic', txt: 'Anthropic Messages API (Native)' },
                    { val: 'xai', txt: 'xAI Grok API' },
                    { val: 'grok_web', txt: 'Grok Web (Free, Login Required)' }
                ],
                onSelect: (value) => this.updateVisibility(value)
            });
        }

        // Thinking level dropdown
        if (thinkingWrapper && thinkingTrigger && thinkingDropdown && thinkingSelect) {
            this.dropdowns.thinking = new CustomDropdown({
                wrapper: thinkingWrapper,
                trigger: thinkingTrigger,
                dropdown: thinkingDropdown,
                nativeSelect: thinkingSelect,
                options: [
                    { val: 'minimal', txt: 'Minimal (Flash Only)' },
                    { val: 'low', txt: 'Low (Faster)' },
                    { val: 'medium', txt: 'Medium (Balanced)' },
                    { val: 'high', txt: 'High (Deep Reasoning)' }
                ],
                onSelect: () => {} // Just data sync, no UI side effect
            });
        }
    }

    setData(data) {
        const { apiKeyInput, thinkingSelect,
                openaiBaseUrl, openaiApiKey, openaiModel,
                anthropicBaseUrl, anthropicApiKey, anthropicModel,
                xaiApiKey, xaiModel } = this.elements;

        // Provider
        const provider = data.provider || 'web';
        if (this.dropdowns.provider) this.dropdowns.provider.setValue(provider);
        this.updateVisibility(provider);

        // Official
        if (apiKeyInput) apiKeyInput.value = data.apiKey || "";
        const thinking = data.thinkingLevel || "low";
        if (this.dropdowns.thinking) this.dropdowns.thinking.setValue(thinking);

        // OpenAI
        if (openaiBaseUrl) openaiBaseUrl.value = data.openaiBaseUrl || "";
        if (openaiApiKey) openaiApiKey.value = data.openaiApiKey || "";
        if (openaiModel) openaiModel.value = data.openaiModel || "";

        // Anthropic
        if (anthropicBaseUrl) anthropicBaseUrl.value = data.anthropicBaseUrl || "";
        if (anthropicApiKey) anthropicApiKey.value = data.anthropicApiKey || "";
        if (anthropicModel) anthropicModel.value = data.anthropicModel || "";

        // xAI
        if (xaiApiKey) xaiApiKey.value = data.xaiApiKey || "";
        if (xaiModel) xaiModel.value = data.xaiModel || "";
    }

    getData() {
        const { providerSelect, apiKeyInput, thinkingSelect,
                openaiBaseUrl, openaiApiKey, openaiModel,
                anthropicBaseUrl, anthropicApiKey, anthropicModel,
                xaiApiKey, xaiModel } = this.elements;

        return {
            provider: providerSelect ? providerSelect.value : 'web',
            apiKey: apiKeyInput ? apiKeyInput.value.trim() : "",
            thinkingLevel: thinkingSelect ? thinkingSelect.value : "low",
            openaiBaseUrl: openaiBaseUrl ? openaiBaseUrl.value.trim() : "",
            openaiApiKey: openaiApiKey ? openaiApiKey.value.trim() : "",
            openaiModel: openaiModel ? openaiModel.value.trim() : "",
            anthropicBaseUrl: anthropicBaseUrl ? anthropicBaseUrl.value.trim() : "",
            anthropicApiKey: anthropicApiKey ? anthropicApiKey.value.trim() : "",
            anthropicModel: anthropicModel ? anthropicModel.value.trim() : "",
            xaiApiKey: xaiApiKey ? xaiApiKey.value.trim() : "",
            xaiModel: xaiModel ? xaiModel.value.trim() : ""
        };
    }

    updateVisibility(provider) {
        const { apiKeyContainer, officialFields, openaiFields, anthropicFields, xaiFields } = this.elements;
        if (!apiKeyContainer) return;

        // grok_web uses cookie auth from browser, no API key needed
        if (provider === 'web' || provider === 'grok_web') {
            apiKeyContainer.style.display = 'none';
        } else {
            apiKeyContainer.style.display = 'flex';
            if (officialFields) officialFields.style.display = provider === 'official' ? 'flex' : 'none';
            if (openaiFields) openaiFields.style.display = provider === 'openai' ? 'flex' : 'none';
            if (anthropicFields) anthropicFields.style.display = provider === 'anthropic' ? 'flex' : 'none';
            if (xaiFields) xaiFields.style.display = provider === 'xai' ? 'flex' : 'none';
        }
    }
}
