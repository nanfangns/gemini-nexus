
export const AboutSettingsTemplate = `
<div class="setting-group about-section">
    <div class="about-header">
        <div class="about-logo">
            <svg width="40" height="40" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="128" height="128" rx="24" fill="url(#grad)"/>
                <path d="M64 20L80 44H48L64 20Z" fill="white" opacity="0.9"/>
                <circle cx="64" cy="76" r="20" fill="white" opacity="0.85"/>
                <path d="M64 56L72 68H56L64 56Z" fill="url(#grad2)"/>
                <circle cx="64" cy="76" r="8" fill="url(#grad2)"/>
                <circle cx="80" cy="36" r="5" fill="white" opacity="0.6"/>
                <circle cx="48" cy="36" r="5" fill="white" opacity="0.6"/>
                <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#4285F4"/>
                        <stop offset="1" stop-color="#7B1FA2"/>
                    </linearGradient>
                    <linearGradient id="grad2" x1="56" y1="56" x2="72" y2="76" gradientUnits="userSpaceOnUse">
                        <stop stop-color="#4285F4"/>
                        <stop offset="1" stop-color="#7B1FA2"/>
                    </linearGradient>
                </defs>
            </svg>
        </div>
        <div class="about-title-block">
            <div class="about-title-row">
                <h3 class="about-name">AI Browser Automation</h3>
                <span id="app-current-version" class="about-version">v4.2.3</span>
                <span id="app-update-status" class="about-update"></span>
            </div>
            <p class="about-desc">AI-powered browser automation</p>
        </div>
    </div>

    <div class="about-features">
        <div class="about-feature">
            <span class="about-feature-icon">🤖</span>
            <div>
                <div class="about-feature-name">Browser Control</div>
                <div class="about-feature-desc">AI-controlled automation</div>
            </div>
        </div>
        <div class="about-feature">
            <span class="about-feature-icon">⚡</span>
            <div>
                <div class="about-feature-name">Batch Operations</div>
                <div class="about-feature-desc">Multi-step parallel execution</div>
            </div>
        </div>
        <div class="about-feature">
            <span class="about-feature-icon">🖼️</span>
            <div>
                <div class="about-feature-name">Image Analysis</div>
                <div class="about-feature-desc">Vision + OCR capabilities</div>
            </div>
        </div>
        <div class="about-feature">
            <span class="about-feature-icon">🔒</span>
            <div>
                <div class="about-feature-name">Sandbox Security</div>
                <div class="about-feature-desc">Local data processing</div>
            </div>
        </div>
    </div>

    <div class="about-links">
        <a href="https://github.com/nanfangns/gemini-nexus" target="_blank" class="about-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            <span>GitHub</span>
            <span id="star-count" class="about-star-badge"></span>
        </a>
        <a href="https://github.com/nanfangns/gemini-nexus/releases" target="_blank" class="about-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Releases</span>
        </a>
    </div>

    <div class="about-credit">
        Based on <a href="https://github.com/yeahhe365/gemini-nexus" target="_blank" class="about-credit-link">yeahhe365/gemini-nexus</a> · MIT License
    </div>
</div>

<div class="setting-group">
    <h4 data-i18n="debugLogs">Debug Logs</h4>
    <div class="shortcut-row">
        <label data-i18n="debugLogs">Debug Logs</label>
        <button id="download-logs" class="btn-secondary" style="padding: 6px 12px; font-size: 12px;" data-i18n="downloadLogs">Download Logs</button>
    </div>
</div>`;
