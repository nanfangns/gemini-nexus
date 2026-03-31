
// sandbox/ui/settings/sections/connection.js

export class ConnectionSection {
    constructor() {
        this.elements = {};
        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            providerSelect: get('provider-select'),
            apiKeyContainer: get('api-key-container'),

            // Official Fields
            officialFields: get('official-fields'),
            apiKeyInput: get('api-key-input'),
            thinkingLevelSelect: get('thinking-level-select'),

            // OpenAI Fields
            openaiFields: get('openai-fields'),
            openaiBaseUrl: get('openai-base-url'),
            openaiApiKey: get('openai-api-key'),
            openaiModel: get('openai-model'),

            // Anthropic Fields
            anthropicFields: get('anthropic-fields'),
            anthropicBaseUrl: get('anthropic-base-url'),
            anthropicApiKey: get('anthropic-api-key'),
            anthropicModel: get('anthropic-model'),
        };
    }

    bindEvents() {
        const { providerSelect } = this.elements;
        if (providerSelect) {
            providerSelect.addEventListener('change', (e) => {
                this.updateVisibility(e.target.value);
            });
        }
    }

    setData(data) {
        const {
            providerSelect, apiKeyInput, thinkingLevelSelect,
            openaiBaseUrl, openaiApiKey, openaiModel,
            anthropicBaseUrl, anthropicApiKey, anthropicModel
        } = this.elements;

        // Provider
        if (providerSelect) {
            providerSelect.value = data.provider || 'web';
            this.updateVisibility(data.provider || 'web');
        }

        // Official
        if (apiKeyInput) apiKeyInput.value = data.apiKey || "";
        if (thinkingLevelSelect) thinkingLevelSelect.value = data.thinkingLevel || "low";

        // OpenAI
        if (openaiBaseUrl) openaiBaseUrl.value = data.openaiBaseUrl || "";
        if (openaiApiKey) openaiApiKey.value = data.openaiApiKey || "";
        if (openaiModel) openaiModel.value = data.openaiModel || "";

        // Anthropic
        if (anthropicBaseUrl) anthropicBaseUrl.value = data.anthropicBaseUrl || "";
        if (anthropicApiKey) anthropicApiKey.value = data.anthropicApiKey || "";
        if (anthropicModel) anthropicModel.value = data.anthropicModel || "";
    }

    getData() {
        const {
            providerSelect, apiKeyInput, thinkingLevelSelect,
            openaiBaseUrl, openaiApiKey, openaiModel,
            anthropicBaseUrl, anthropicApiKey, anthropicModel
        } = this.elements;

        return {
            provider: providerSelect ? providerSelect.value : 'web',
            // Official
            apiKey: apiKeyInput ? apiKeyInput.value.trim() : "",
            thinkingLevel: thinkingLevelSelect ? thinkingLevelSelect.value : "low",
            // OpenAI
            openaiBaseUrl: openaiBaseUrl ? openaiBaseUrl.value.trim() : "",
            openaiApiKey: openaiApiKey ? openaiApiKey.value.trim() : "",
            openaiModel: openaiModel ? openaiModel.value.trim() : "",
            // Anthropic
            anthropicBaseUrl: anthropicBaseUrl ? anthropicBaseUrl.value.trim() : "",
            anthropicApiKey: anthropicApiKey ? anthropicApiKey.value.trim() : "",
            anthropicModel: anthropicModel ? anthropicModel.value.trim() : ""
        };
    }

    updateVisibility(provider) {
        const { apiKeyContainer, officialFields, openaiFields, anthropicFields } = this.elements;
        if (!apiKeyContainer) return;

        if (provider === 'web') {
            apiKeyContainer.style.display = 'none';
        } else {
            apiKeyContainer.style.display = 'flex';
            if (provider === 'official') {
                if (officialFields) officialFields.style.display = 'flex';
                if (openaiFields) openaiFields.style.display = 'none';
                if (anthropicFields) anthropicFields.style.display = 'none';
            } else if (provider === 'openai') {
                if (officialFields) officialFields.style.display = 'none';
                if (openaiFields) openaiFields.style.display = 'flex';
                if (anthropicFields) anthropicFields.style.display = 'none';
            } else if (provider === 'anthropic') {
                if (officialFields) officialFields.style.display = 'none';
                if (openaiFields) openaiFields.style.display = 'none';
                if (anthropicFields) anthropicFields.style.display = 'flex';
            }
        }
    }
}
