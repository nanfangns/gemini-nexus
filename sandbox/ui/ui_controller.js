
// sandbox/ui/ui_controller.js
import { ChatController } from './chat.js';
import { SidebarController } from './sidebar.js';
import { SettingsController } from './settings.js';
import { ViewerController } from './viewer.js';
import { TabSelectorController } from './tab_selector.js';

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
        const label = document.getElementById('model-select-label');
        const nativeSelect = document.getElementById('model-select');

        if (!wrapper || !trigger || !dropdown || !label) return;

        // Store reference for external use
        this._modelDropdown = { trigger, dropdown, label, nativeSelect };

        // Open/close on trigger click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains('open');
            if (isOpen) this._closeDropdown();
            else this._openDropdown();
        });

        // Option click
        dropdown.addEventListener('click', (e) => {
            const option = e.target.closest('.model-select-option');
            if (!option) return;
            const value = option.dataset.value;
            this._selectOption(value);
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) this._closeDropdown();
        });

        // Keyboard: Escape closes, arrows navigate
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { this._closeDropdown(); return; }
            if (!dropdown.classList.contains('open')) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    this._openDropdown();
                }
            }
        });

        dropdown.addEventListener('keydown', (e) => {
            const options = [...dropdown.querySelectorAll('.model-select-option')];
            const current = dropdown.querySelector('.model-select-option:focus');
            const idx = current ? options.indexOf(current) : -1;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = options[idx + 1] || options[0];
                next.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = options[idx - 1] || options[options.length - 1];
                prev.focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (document.activeElement) document.activeElement.click();
            } else if (e.key === 'Escape') {
                this._closeDropdown();
                trigger.focus();
            }
        });
    }

    _openDropdown() {
        const { trigger, dropdown } = this._modelDropdown;
        dropdown.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
        // Focus first option
        const first = dropdown.querySelector('.model-select-option');
        if (first) first.focus();
    }

    _closeDropdown() {
        const { trigger, dropdown } = this._modelDropdown;
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
    }

    _selectOption(value) {
        const { dropdown, label, nativeSelect } = this._modelDropdown;

        // Update active state
        dropdown.querySelectorAll('.model-select-option').forEach(opt => {
            const isActive = opt.dataset.value === value;
            opt.classList.toggle('active', isActive);
            opt.setAttribute('aria-selected', isActive);
        });

        // Update label
        const activeOpt = dropdown.querySelector(`.model-select-option[data-value="${value}"]`);
        if (activeOpt) {
            label.textContent = activeOpt.querySelector('.model-option-name').textContent;
        }

        // Sync native select
        if (nativeSelect) {
            nativeSelect.value = value;
            nativeSelect.dispatchEvent(new Event('change'));
        }

        this._closeDropdown();
    }

    updateModelList(settings) {
        const { label, nativeSelect } = this._modelDropdown || {};
        if (!nativeSelect) {
            // Fallback to native select if custom dropdown not init'd
            if (!this.modelSelect) return;
            this._updateNativeModelList(settings);
            return;
        }

        // Determine provider
        const provider = settings.provider || (settings.useOfficialApi ? 'official' : 'web');

        const dropdown = document.getElementById('model-select-dropdown');
        const trigger = document.getElementById('model-select-trigger');
        const triggerLabel = label || document.getElementById('model-select-label');
        if (!dropdown || !trigger || !triggerLabel) return;

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
        } else {
            options = [
                { val: 'gemini-3-flash', txt: 'Fast', desc: 'gemini-3-flash' },
                { val: 'gemini-3-flash-thinking', txt: 'Thinking', desc: 'gemini-3-flash-thinking' },
                { val: 'gemini-3-pro', txt: '3 Pro', desc: 'gemini-3-pro' }
            ];
        }

        // Sync native select
        nativeSelect.innerHTML = '';
        options.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.val;
            opt.textContent = o.txt;
            nativeSelect.appendChild(opt);
        });

        // Rebuild dropdown
        dropdown.innerHTML = '';
        const currentValue = nativeSelect.value;
        options.forEach(o => {
            const div = document.createElement('div');
            div.className = `model-select-option${o.val === currentValue ? ' active' : ''}`;
            div.dataset.value = o.val;
            div.setAttribute('role', 'option');
            div.setAttribute('aria-selected', o.val === currentValue);
            div.tabIndex = 0;
            div.innerHTML = `<span class="model-option-name">${o.txt}</span><span class="model-option-desc">${o.desc}</span>`;
            dropdown.appendChild(div);
        });

        // Update label
        const current = options.find(o => o.val === currentValue) || options[0];
        if (current) triggerLabel.textContent = current.txt;

        // Close dropdown if open
        dropdown.classList.remove('open');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    }

    _updateNativeModelList(settings) {
        // Legacy fallback
        if (!this.modelSelect) return;
        const provider = settings.provider || (settings.useOfficialApi ? 'official' : 'web');
        this.modelSelect.innerHTML = '';
        let opts = [];
        if (provider === 'official') {
            opts = [{ val: 'gemini-3-flash-preview', txt: 'Gemini 3 Flash' }, { val: 'gemini-3-pro-preview', txt: 'Gemini 3 Pro' }];
        } else if (provider === 'openai') {
            const models = (settings.openaiModel || '').split(',').map(m => m.trim()).filter(Boolean);
            opts = models.length ? models.map(m => ({ val: m, txt: m })) : [{ val: 'openai_custom', txt: 'Custom Model' }];
        } else if (provider === 'anthropic') {
            const models = (settings.anthropicModel || '').split(',').map(m => m.trim()).filter(Boolean);
            opts = models.length ? models.map(m => ({ val: m, txt: m })) : [{ val: 'anthropic_custom', txt: 'Custom Model' }];
        } else {
            opts = [{ val: 'gemini-3-flash', txt: 'Fast' }, { val: 'gemini-3-flash-thinking', txt: 'Thinking' }, { val: 'gemini-3-pro', txt: '3 Pro' }];
        }
        opts.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o.val;
            opt.textContent = o.txt;
            this.modelSelect.appendChild(opt);
        });
        this._resizeModelSelect();
    }
}