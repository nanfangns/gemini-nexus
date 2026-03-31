
export const ConnectionSettingsTemplate = `
<div class="setting-group">
    <h4 data-i18n="connection">Connection</h4>
    
    <div style="margin-bottom: 12px;">
        <label data-i18n="connectionProvider" style="font-weight: 500; display: block; margin-bottom: 6px;">Model Provider</label>
        <select id="provider-select" class="shortcut-input" style="width: 100%; text-align: left; padding: 8px 12px;">
            <option value="web" data-i18n="providerWeb">Gemini Web Client (Free)</option>
            <option value="official" data-i18n="providerOfficial">Google Gemini API</option>
            <option value="openai" data-i18n="providerOpenAI">OpenAI Compatible API</option>
            <option value="anthropic" data-i18n="providerAnthropic">Anthropic Messages API (Native)</option>
        </select>
    </div>
    
    <div id="api-key-container" style="display: none; flex-direction: column; gap: 12px; margin-bottom: 12px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px;">
        <!-- Official API Fields -->
        <div id="official-fields" style="display: none; flex-direction: column; gap: 12px;">
            <div>
                <label data-i18n="apiKey" style="font-weight: 500; display: block; margin-bottom: 2px;">API Key</label>
                <input type="password" id="api-key-input" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="apiKeyPlaceholder" placeholder="Paste your Gemini API Key">
            </div>
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 2px;">Thinking Level (Gemini 3)</label>
                <select id="thinking-level-select" class="shortcut-input" style="width: 100%; text-align: left; padding: 6px 12px;">
                    <option value="minimal">Minimal (Flash Only)</option>
                    <option value="low">Low (Faster)</option>
                    <option value="medium">Medium (Balanced)</option>
                    <option value="high">High (Deep Reasoning)</option>
                </select>
            </div>
        </div>

        <!-- OpenAI Fields -->
        <div id="openai-fields" style="display: none; flex-direction: column; gap: 12px;">
            <div>
                <label data-i18n="baseUrl" style="font-weight: 500; display: block; margin-bottom: 2px;">Base URL</label>
                <input type="text" id="openai-base-url" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="baseUrlPlaceholder" placeholder="https://api.openai.com/v1">
            </div>
            <div>
                <label data-i18n="apiKey" style="font-weight: 500; display: block; margin-bottom: 2px;">API Key</label>
                <input type="password" id="openai-api-key" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="apiKeyPlaceholder" placeholder="sk-...">
            </div>
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 2px;">Model IDs (Comma separated)</label>
                <input type="text" id="openai-model" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="e.g. gpt-4o, claude-3-5-sonnet">
            </div>
        </div>

        <!-- Anthropic Fields -->
        <div id="anthropic-fields" style="display: none; flex-direction: column; gap: 12px;">
            <div>
                <label data-i18n="baseUrl" style="font-weight: 500; display: block; margin-bottom: 2px;">Base URL</label>
                <input type="text" id="anthropic-base-url" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="https://api.anthropic.com/v1">
            </div>
            <div>
                <label data-i18n="apiKey" style="font-weight: 500; display: block; margin-bottom: 2px;">API Key</label>
                <input type="password" id="anthropic-api-key" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="sk-ant-...">
            </div>
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 2px;">Model IDs (Comma separated)</label>
                <input type="text" id="anthropic-model" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="e.g. claude-3-5-sonnet-20241022, claude-3-opus-20240229">
            </div>
        </div>
    </div>
</div>`;