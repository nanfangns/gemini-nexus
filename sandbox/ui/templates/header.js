
export const HeaderTemplate = `
    <!-- HEADER -->
    <div class="header">
        <div class="header-left">
            <button id="history-toggle" class="icon-btn" data-i18n-title="toggleHistory" title="Chat History" aria-label="Chat History">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
            </button>

            <div class="model-select-wrapper" id="model-select-wrapper">
                <button id="model-select-trigger" class="model-select-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="Select model">
                    <span class="model-select-label" id="model-select-label">Fast</span>
                    <svg class="model-select-arrow" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </button>
                <div class="model-select-dropdown" id="model-select-dropdown" role="listbox">
                    <div class="model-select-option active" data-value="gemini-3-flash" role="option" aria-selected="true">
                        <span class="model-option-name">Fast</span>
                        <span class="model-option-desc">gemini-3-flash</span>
                    </div>
                    <div class="model-select-option" data-value="gemini-3-flash-thinking" role="option" aria-selected="false">
                        <span class="model-option-name">Thinking</span>
                        <span class="model-option-desc">gemini-3-flash-thinking</span>
                    </div>
                    <div class="model-select-option" data-value="gemini-3-pro" role="option" aria-selected="false">
                        <span class="model-option-name">3 Pro</span>
                        <span class="model-option-desc">gemini-3-pro</span>
                    </div>
                </div>
                <!-- Hidden native select for accessibility / form submission -->
                <select id="model-select" style="display:none" aria-label="Select model">
                    <option value="gemini-3-flash">Fast</option>
                    <option value="gemini-3-flash-thinking">Thinking</option>
                    <option value="gemini-3-pro">3 Pro</option>
                </select>
            </div>
        </div>

        <div class="header-right">
            <button id="tab-switcher-btn" class="icon-btn" style="display: none;" data-i18n-title="selectTabTooltip" title="Select a tab to control" aria-label="Select tab">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M2 6h20v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z"/>
                    <path d="M2 6l2.5-3.5A2 2 0 0 1 6.1 1h11.8a2 2 0 0 1 1.6 1.5L22 6"/>
                </svg>
            </button>
            <button id="new-chat-header-btn" class="icon-btn" data-i18n-title="newChatTooltip" title="New Chat" aria-label="New chat">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
        </div>
    </div>

    <!-- Corner Button -->
    <button id="open-full-page-btn" class="corner-btn" data-i18n-title="openFullPageTooltip" title="Open in Full Page" aria-label="Open in full page">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
    </button>
`;
