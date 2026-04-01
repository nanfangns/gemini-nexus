
export const ConnectionSettingsTemplate = `
<div class="setting-group">
    <h4 data-i18n="connection">Connection</h4>

    <!-- Provider Dropdown -->
    <div style="margin-bottom: 12px;">
        <label data-i18n="connectionProvider" style="font-weight: 500; display: block; margin-bottom: 6px;">Model Provider</label>
        <div class="cd-wrapper cd-wrapper-full" id="provider-select-wrapper">
            <button class="cd-trigger cd-trigger-full" id="provider-select-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="Select provider">
                <span class="cd-trigger-label">Gemini Web Client (Free)</span>
                <svg class="cd-arrow" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </button>
            <div class="cd-dropdown cd-dropdown-full" id="provider-select-dropdown" role="listbox">
                <div class="cd-option active" data-value="web" role="option" aria-selected="true" tabindex="0"><span class="cd-option-name">Gemini Web Client (Free)</span></div>
                <div class="cd-option" data-value="official" role="option" aria-selected="false" tabindex="0"><span class="cd-option-name">Google Gemini API</span></div>
                <div class="cd-option" data-value="openai" role="option" aria-selected="false" tabindex="0"><span class="cd-option-name">OpenAI Compatible API</span></div>
                <div class="cd-option" data-value="anthropic" role="option" aria-selected="false" tabindex="0"><span class="cd-option-name">Anthropic Messages API (Native)</span></div>
                <div class="cd-option" data-value="xai" role="option" aria-selected="false" tabindex="0"><span class="cd-option-name">xAI Grok API</span></div>
                <div class="cd-option" data-value="grok_web" role="option" aria-selected="false" tabindex="0"><span class="cd-option-name">Grok Web (Free, Login Required)</span></div>
            </div>
            <select id="provider-select" style="display:none" aria-label="Select provider">
                <option value="web">Gemini Web Client (Free)</option>
                <option value="official">Google Gemini API</option>
                <option value="openai">OpenAI Compatible API</option>
                <option value="anthropic">Anthropic Messages API (Native)</option>
                <option value="xai">xAI Grok API</option>
                <option value="grok_web">Grok Web (Free, Login Required)</option>
            </select>
        </div>
    </div>

    <div id="api-key-container" style="display: none; flex-direction: column; gap: 12px; margin-bottom: 12px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px;">
        <!-- Official API Fields -->
        <div id="official-fields" style="display: none; flex-direction: column; gap: 12px;">
            <div>
                <label data-i18n="apiKey" style="font-weight: 500; display: block; margin-bottom: 2px;">API Key</label>
                <input type="password" id="api-key-input" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="apiKeyPlaceholder" placeholder="Paste your Gemini API Key">
            </div>
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 6px;">Thinking Level</label>
                <div class="cd-wrapper cd-wrapper-full" id="thinking-level-wrapper">
                    <button class="cd-trigger cd-trigger-full" id="thinking-level-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="Select thinking level">
                        <span class="cd-trigger-label">Low (Faster)</span>
                        <svg class="cd-arrow" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>
                    <div class="cd-dropdown cd-dropdown-full" id="thinking-level-dropdown" role="listbox">
                        <div class="cd-option" data-value="minimal" role="option" aria-selected="false" tabindex="0"><span class="cd-option-name">Minimal (Flash Only)</span></div>
                        <div class="cd-option active" data-value="low" role="option" aria-selected="true" tabindex="0"><span class="cd-option-name">Low (Faster)</span></div>
                        <div class="cd-option" data-value="medium" role="option" aria-selected="false" tabindex="0"><span class="cd-option-name">Medium (Balanced)</span></div>
                        <div class="cd-option" data-value="high" role="option" aria-selected="false" tabindex="0"><span class="cd-option-name">High (Deep Reasoning)</span></div>
                    </div>
                    <select id="thinking-level-select" style="display:none" aria-label="Select thinking level">
                        <option value="minimal">Minimal (Flash Only)</option>
                        <option value="low">Low (Faster)</option>
                        <option value="medium">Medium (Balanced)</option>
                        <option value="high">High (Deep Reasoning)</option>
                    </select>
                </div>
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

        <!-- xAI Fields -->
        <div id="xai-fields" style="display: none; flex-direction: column; gap: 12px;">
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 2px;">API Key</label>
                <input type="password" id="xai-api-key" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="xai-...">
                <span style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px; display: block;">Get your key from <a href="https://console.x.ai" target="_blank" style="color: var(--accent);">console.x.ai</a></span>
            </div>
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 2px;">Model (Comma separated)</label>
                <input type="text" id="xai-model" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="grok-3, grok-3-mini">
            </div>
        </div>
    </div>
</div>`;
