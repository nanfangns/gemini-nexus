
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
                <div class="cd-option" data-value="doubao_web" role="option" aria-selected="false" tabindex="0"><span class="cd-option-name">Doubao Web (Free)</span></div>
            </div>
            <select id="provider-select" style="display:none" aria-label="Select provider">
                <option value="web">Gemini Web Client (Free)</option>
                <option value="official">Google Gemini API</option>
                <option value="openai">OpenAI Compatible API</option>
                <option value="anthropic">Anthropic Messages API (Native)</option>
                <option value="xai">xAI Grok API</option>
                <option value="doubao_web">Doubao Web (Free)</option>
            </select>
        </div>
    </div>

    <div id="api-key-container" style="display: none; flex-direction: column; gap: 12px; margin-bottom: 12px; padding: 12px; background: rgba(0,0,0,0.03); border-radius: 8px;">
        <!-- Official API Fields -->
        <div id="official-fields" style="display: none; flex-direction: column; gap: 12px;">
            <div>
                <label data-i18n="apiKey" style="font-weight: 500; display: block; margin-bottom: 2px;">API Key</label>
                <div class="api-key-wrapper">
                    <input type="password" id="api-key-input" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="apiKeyPlaceholder" placeholder="Paste your Gemini API Key">
                    <button type="button" class="api-key-toggle" aria-label="Show API Key">
                        <svg class="eye-open" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <svg class="eye-closed" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                </div>
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
                <div class="api-key-wrapper">
                    <input type="password" id="openai-api-key" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" data-i18n-placeholder="apiKeyPlaceholder" placeholder="sk-...">
                    <button type="button" class="api-key-toggle" aria-label="Show API Key">
                        <svg class="eye-open" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <svg class="eye-closed" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                </div>
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
                <div class="api-key-wrapper">
                    <input type="password" id="anthropic-api-key" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="sk-ant-...">
                    <button type="button" class="api-key-toggle" aria-label="Show API Key">
                        <svg class="eye-open" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <svg class="eye-closed" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                </div>
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
                <div class="api-key-wrapper">
                    <input type="password" id="xai-api-key" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="xai-...">
                    <button type="button" class="api-key-toggle" aria-label="Show API Key">
                        <svg class="eye-open" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        <svg class="eye-closed" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                    </button>
                </div>
                <span style="font-size: 11px; color: var(--text-tertiary); margin-top: 2px; display: block;">Get your key from <a href="https://console.x.ai" target="_blank" style="color: var(--accent);">console.x.ai</a></span>
            </div>
            <div>
                <label style="font-weight: 500; display: block; margin-bottom: 2px;">Model (Comma separated)</label>
                <input type="text" id="xai-model" class="shortcut-input" style="width: 100%; text-align: left; box-sizing: border-box;" placeholder="grok-3, grok-3-mini">
            </div>
        </div>
    </div>
</div>`;
