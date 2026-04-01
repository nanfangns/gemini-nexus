
// sandbox/ui/ui_controller.js
import { ChatController } from './chat.js';
import { SidebarController } from './sidebar.js';
import { SettingsController } from './settings.js';
import { ViewerController } from './viewer.js';
import { TabSelectorController } from './tab_selector.js';
import { CustomDropdown } from './dropdown.js';

export class UIController {
    constructor(elements) {
        // Initialize Sub-Controllers
        this.chat = new ChatController(elements);
        
        this.sidebar = new SidebarController(elements, {
            onOverlayClick: () => this.settings.close()
        });
        
        // Settings and Viewer now self-manage their DOM
        this.settings = new SettingsController({
            onOpen: () => this.sidebar.close(),
            onSettingsChanged: (connectionSettings) => {
                this.updateModelList(connectionSettings);
            }
        });
        
        this.viewer = new ViewerController();
        
        this.tabSelector = new TabSelectorController();

        // Properties exposed for external use (AppController/MessageHandler)
        this.inputFn = this.chat.inputFn;
        this.historyDiv = this.chat.historyDiv;
        this.sendBtn = this.chat.sendBtn;
        this.modelSelect = elements.modelSelect;
        this.tabSwitcherBtn = document.getElementById('tab-switcher-btn');

        // Custom model dropdown
        this._initModelDropdown();

        // Initialize Layout Detection
        this.checkLayout();
        window.addEventListener('resize', () => this.checkLayout());
    }

    checkLayout() {
        // Threshold for Wide Mode (e.g. Full Page Tab or large side panel)
        const isWide = window.innerWidth > 800;
        if (isWide) {
            document.body.classList.add('layout-wide');
        } else {
            document.body.classList.remove('layout-wide');
        }
    }

    // --- Delegation Methods ---

    // Chat / Input
    updateStatus(text) { this.chat.updateStatus(text); }
    clearChatHistory() { this.chat.clear(); }
    scrollToBottom() { this.chat.scrollToBottom(); }
    resetInput() { this.chat.resetInput(); }
    setLoading(isLoading) { this.chat.setLoading(isLoading); }
    
    // Sidebar
    toggleSidebar() { this.sidebar.toggle(); }
    closeSidebar() { this.sidebar.close(); }
    renderHistoryList(sessions, currentId, callbacks) {
        this.sidebar.renderList(sessions, currentId, callbacks);
    }

    // Settings
    updateShortcuts(payload) { this.settings.updateShortcuts(payload); }
    updateTheme(theme) { this.settings.updateTheme(theme); }
    updateLanguage(lang) { this.settings.updateLanguage(lang); }
    
    // Tab Selector
    openTabSelector(tabs, onSelect, lockedTabId) {
        this.tabSelector.open(tabs, onSelect, lockedTabId);
    }
    
    toggleTabSwitcher(show) {
        if (this.tabSwitcherBtn) {
            this.tabSwitcherBtn.style.display = show ? 'flex' : 'none';
        }
    }

    // --- Custom Model Dropdown ---
    _initModelDropdown() {
        const wrapper = document.getElementById('model-select-wrapper');
        const trigger = document.getElementById('model-select-trigger');
        const dropdown = document.getElementById('model-select-dropdown');
        const nativeSelect = document.getElementById('model-select');

        if (!wrapper || !trigger || !dropdown || !nativeSelect) return;

        this.modelDropdown = new CustomDropdown({
            wrapper,
            trigger,
            dropdown,
            nativeSelect,
            options: [
                { val: 'gemini-3-flash', txt: 'Fast', desc: 'gemini-3-flash' },
                { val: 'gemini-3-flash-thinking', txt: 'Thinking', desc: 'gemini-3-flash-thinking' },
                { val: 'gemini-3-pro', txt: '3 Pro', desc: 'gemini-3-pro' }
            ],
            onSelect: () => {}, // UI sync already done via native select change event
            onChange: (model) => {
                // Direct save to storage without relying on native select change event chain
                window.parent.postMessage({ action: 'SAVE_MODEL', payload: model }, '*');
            }
        });
    }

    updateModelList(settings, savedModel) {
        const dropdown = this.modelDropdown;
        if (!dropdown) return;

        // Determine provider
        const provider = settings.provider || (settings.useOfficialApi ? 'official' : 'web');

        let options = [];
        if (provider === 'official') {
            options = [
                { val: 'gemini-3-flash-preview', txt: 'Gemini 3 Flash', desc: 'gemini-3-flash-preview' },
                { val: 'gemini-3-pro-preview', txt: 'Gemini 3 Pro', desc: 'gemini-3-pro-preview' }
            ];
        } else if (provider === 'openai') {
            const models = (settings.openaiModel || '').split(',').map(m => m.trim()).filter(Boolean);
            options = models.length
                ? models.map(m => ({ val: m, txt: m, desc: m }))
                : [{ val: 'openai_custom', txt: 'Custom Model', desc: 'custom' }];
        } else if (provider === 'anthropic') {
            const models = (settings.anthropicModel || '').split(',').map(m => m.trim()).filter(Boolean);
            options = models.length
                ? models.map(m => ({ val: m, txt: m, desc: m }))
                : [{ val: 'anthropic_custom', txt: 'Custom Model', desc: 'custom' }];
        } else if (provider === 'xai') {
            const models = (settings.xaiModel || '').split(',').map(m => m.trim()).filter(Boolean);
            options = models.length
                ? models.map(m => ({ val: m, txt: m, desc: m }))
                : [
                    { val: 'grok-3', txt: 'Grok 3', desc: 'grok-3' },
                    { val: 'grok-3-mini', txt: 'Grok 3 Mini', desc: 'grok-3-mini' }
                ];
        } else if (provider === 'grok_web') {
            // Grok Web uses mode selection, not model selection
            // auto = grok-4, fast = quick mode, expert = deep thinking
            options = [
                { val: 'auto', txt: 'Auto (Grok 4)', desc: 'auto - Uses grok-4 with low effort' },
                { val: 'fast', txt: 'Fast Mode', desc: 'fast - Quick responses' },
                { val: 'expert', txt: 'Expert Mode', desc: 'expert - Deep thinking' }
            ];
        } else {
            options = [
                { val: 'gemini-3-flash', txt: 'Fast', desc: 'gemini-3-flash' },
                { val: 'gemini-3-flash-thinking', txt: 'Thinking', desc: 'gemini-3-flash-thinking' },
                { val: 'gemini-3-pro', txt: '3 Pro', desc: 'gemini-3-pro' }
            ];
        }

        dropdown.setOptions(options);

        // Validate saved model against new options; only fall back if truly invalid
        const currentVal = dropdown.getValue();
        const validValues = options.map(o => o.val);
        if (savedModel && validValues.includes(savedModel)) {
            dropdown.setValue(savedModel);
        } else if (!validValues.includes(currentVal)) {
            dropdown.setValue(options[0]?.val);
        }
    }
}