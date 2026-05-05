
// sandbox/ui/settings.js
import { saveShortcutsToStorage, saveThemeToStorage, requestThemeFromStorage, saveLanguageToStorage, requestLanguageFromStorage, saveTextSelectionToStorage, requestTextSelectionFromStorage, saveSidebarBehaviorToStorage, saveImageToolsToStorage, requestImageToolsFromStorage, saveAccountIndicesToStorage, requestAccountIndicesFromStorage, saveConnectionSettingsToStorage, requestConnectionSettingsFromStorage, saveCustomPromptToStorage, requestCustomPromptFromStorage, sendToBackground } from '../../lib/messaging.js';
import { setLanguagePreference, getLanguagePreference } from '../core/i18n.js';
import { SettingsView } from './settings/view.js';
import { DEFAULT_SHORTCUTS } from '../../lib/constants.js';

export class SettingsController {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        
        // State
        this.defaultShortcuts = { ...DEFAULT_SHORTCUTS };
        this.shortcuts = { ...this.defaultShortcuts };
        
        this.textSelectionEnabled = true;
        this.imageToolsEnabled = true;
        this.accountIndices = "0";
        this.promptState = {
            customPrompt: "",
            promptPreset: "custom",
            activePrompt: "",
            customPresets: [],
            customPromptName: "",
            linkedPresetId: null
        };

        // Connection State
        this.connectionData = {
            provider: 'web',
            useOfficialApi: false, // Legacy support
            apiKey: "",
            thinkingLevel: "low",
            openaiBaseUrl: "",
            openaiApiKey: "",
            openaiModel: "",
            anthropicBaseUrl: "",
            anthropicApiKey: "",
            anthropicModel: "",
            xaiApiKey: "",
            xaiModel: "",
            providerProfiles: [],
            activeProfileIds: { openai: null, anthropic: null }
        };

        // Initialize View
        this.view = new SettingsView({
            onOpen: () => this.handleOpen(),
            onSave: (data) => this.saveSettings(data),
            onReset: () => this.resetSettings(),
            onPromptStateChange: (promptState) => this.savePromptState(promptState),
            
            onThemeChange: (theme) => this.setTheme(theme),
            onLanguageChange: (lang) => this.setLanguage(lang),
            
            onTextSelectionChange: (val) => { this.textSelectionEnabled = (val === 'on' || val === true); saveTextSelectionToStorage(this.textSelectionEnabled); },
            onImageToolsChange: (val) => { this.imageToolsEnabled = (val === 'on' || val === true); saveImageToolsToStorage(this.imageToolsEnabled); },
            onSidebarBehaviorChange: (val) => saveSidebarBehaviorToStorage(val),
            onDownloadLogs: () => this.downloadLogs()
        });
        
        // External Trigger Binding
        const trigger = document.getElementById('settings-btn');
        if(trigger) {
            trigger.addEventListener('click', () => {
                this.open();
                if (this.callbacks.onOpen) this.callbacks.onOpen();
            });
        }
        
        // Listen for log data
        window.addEventListener('message', (e) => {
            if (e.data.action === 'BACKGROUND_MESSAGE' && e.data.payload && e.data.payload.logs) {
                this.saveLogFile(e.data.payload.logs);
            }
        });
    }

    open() {
        this.view.open();
    }

    close() {
        this.view.close();
    }

    handleOpen() {
        // Sync state to view
        this.view.setShortcuts(this.shortcuts);
        this.view.setLanguageValue(getLanguagePreference());
        this.view.setToggles(this.textSelectionEnabled, this.imageToolsEnabled);
        this.view.setAccountIndices(this.accountIndices);
        this.view.setConnectionSettings(this.connectionData);
        this.view.setCustomPrompt(this.promptState);
        
        // Refresh from storage
        requestTextSelectionFromStorage();
        requestImageToolsFromStorage();
        requestAccountIndicesFromStorage();
        requestConnectionSettingsFromStorage();
        requestCustomPromptFromStorage();

        this.fetchGithubData();
    }

    saveSettings(data) {
        // Shortcuts
        this.shortcuts = data.shortcuts;
        saveShortcutsToStorage(this.shortcuts);
        
        // General Toggles
        this.textSelectionEnabled = data.textSelection;
        saveTextSelectionToStorage(this.textSelectionEnabled);
        
        this.imageToolsEnabled = data.imageTools;
        saveImageToolsToStorage(this.imageToolsEnabled);
        
        // Accounts
        let val = data.accountIndices.trim();
        if (!val) val = "0";
        this.accountIndices = val;
        const cleaned = val.replace(/[^0-9,]/g, '');
        saveAccountIndicesToStorage(cleaned);
        
        // Connection
        this.connectionData = {
            provider: data.connection.provider,
            apiKey: data.connection.apiKey,
            thinkingLevel: data.connection.thinkingLevel,
            openaiBaseUrl: data.connection.openaiBaseUrl,
            openaiApiKey: data.connection.openaiApiKey,
            openaiModel: data.connection.openaiModel,
            anthropicBaseUrl: data.connection.anthropicBaseUrl,
            anthropicApiKey: data.connection.anthropicApiKey,
            anthropicModel: data.connection.anthropicModel,
            xaiApiKey: data.connection.xaiApiKey,
            xaiModel: data.connection.xaiModel,
            providerProfiles: data.connection.providerProfiles || [],
            activeProfileIds: data.connection.activeProfileIds || { openai: null, anthropic: null }
        };
        
        saveConnectionSettingsToStorage(this.connectionData);

        // Custom Prompt
        this.savePromptState({
            customPrompt: data.customPrompt,
            promptPreset: data.promptPreset,
            activePrompt: data.activePrompt,
            customPresets: data.customPresets,
            customPromptName: data.customPromptName,
            linkedPresetId: data.linkedPresetId
        });

        // Notify app of critical setting changes
        if (this.callbacks.onSettingsChanged) {
            this.callbacks.onSettingsChanged(this.connectionData);
        }
    }

    resetSettings() {
        this.view.setShortcuts(this.defaultShortcuts);
        this.view.setAccountIndices("0");
    }
    
    downloadLogs() {
        sendToBackground({ action: 'GET_LOGS' });
    }
    
    saveLogFile(logs) {
        if (!logs || logs.length === 0) {
            alert("No logs to download.");
            return;
        }
        
        const text = logs.map(l => {
            const time = new Date(l.timestamp).toISOString();
            const dataStr = l.data ? ` | Data: ${JSON.stringify(l.data)}` : '';
            return `[${time}] [${l.level}] [${l.context}] ${l.message}${dataStr}`;
        }).join('\n');
        
        // Send to parent to handle download (Sandbox restriction workaround)
        window.parent.postMessage({
            action: 'DOWNLOAD_LOGS',
            payload: {
                text: text,
                filename: `gemini-nexus-logs-${Date.now()}.txt`
            }
        }, '*');
    }

    // --- State Updates (From View or Storage) ---

    setTheme(theme) {
        this.view.applyVisualTheme(theme);
        saveThemeToStorage(theme);
    }
    
    updateTheme(theme) {
        this.view.setThemeValue(theme);
    }
    
    setLanguage(newLang) {
        setLanguagePreference(newLang);
        saveLanguageToStorage(newLang);
        document.dispatchEvent(new CustomEvent('gemini-language-changed'));
    }
    
    updateLanguage(lang) {
        setLanguagePreference(lang);
        this.view.setLanguageValue(lang);
        document.dispatchEvent(new CustomEvent('gemini-language-changed'));
    }

    updateShortcuts(payload) {
        if (payload) {
            this.shortcuts = { ...this.defaultShortcuts, ...payload };
            this.view.setShortcuts(this.shortcuts);
        }
    }
    
    updateTextSelection(enabled) {
        this.textSelectionEnabled = enabled;
        this.view.setToggles(this.textSelectionEnabled, this.imageToolsEnabled);
    }

    updateImageTools(enabled) {
        this.imageToolsEnabled = enabled;
        this.view.setToggles(this.textSelectionEnabled, this.imageToolsEnabled);
    }
    
    updateConnectionSettings(settings) {
        this.connectionData = { ...this.connectionData, ...settings };
        
        // Legacy compat: If provider missing but useOfficialApi is true, set to official
        if (!this.connectionData.provider) {
            if (settings.useOfficialApi) this.connectionData.provider = 'official';
            else this.connectionData.provider = 'web';
        }
        
        this.view.setConnectionSettings(this.connectionData);
    }
    
    updateSidebarBehavior(behavior) {
        this.view.setSidebarBehavior(behavior);
    }

    updateAccountIndices(indicesString) {
        this.accountIndices = indicesString || "0";
        this.view.setAccountIndices(this.accountIndices);
    }

    updateCustomPrompt(prompt) {
        this.promptState = this.normalizePromptState(prompt);
        this.view.setCustomPrompt(this.promptState);
    }

    savePromptState(promptState) {
        this.promptState = this.normalizePromptState(promptState);
        saveCustomPromptToStorage(this.promptState);
    }

    normalizePromptState(prompt) {
        if (typeof prompt === 'string') {
            return {
                customPrompt: prompt,
                promptPreset: 'custom',
                activePrompt: prompt,
                customPresets: [],
                customPromptName: "",
                linkedPresetId: null
            };
        }

        return {
            customPrompt: prompt && typeof prompt.customPrompt === 'string' ? prompt.customPrompt : "",
            promptPreset: prompt && typeof prompt.promptPreset === 'string' ? prompt.promptPreset : 'custom',
            activePrompt: prompt && typeof prompt.activePrompt === 'string'
                ? prompt.activePrompt
                : (prompt && typeof prompt.customPrompt === 'string' ? prompt.customPrompt : ""),
            customPresets: Array.isArray(prompt?.customPresets) ? prompt.customPresets : [],
            customPromptName: prompt && typeof prompt.customPromptName === 'string' ? prompt.customPromptName : "",
            linkedPresetId: prompt && typeof prompt.linkedPresetId === 'string' ? prompt.linkedPresetId : null
        };
    }

    async fetchGithubData() {
        if (this.view.hasFetchedStars()) return;

        try {
            const [starRes, releaseRes] = await Promise.all([
                fetch('https://api.github.com/repos/nanfangns/gemini-nexus'),
                fetch('https://api.github.com/repos/nanfangns/gemini-nexus/releases/latest')
            ]);

            if (starRes.ok) {
                const data = await starRes.json();
                this.view.displayStars(data.stargazers_count);
            }

            if (releaseRes.ok) {
                const data = await releaseRes.json();
                const latestVersion = data.tag_name; // e.g. "v4.2.0"
                const currentVersion = this.view.getCurrentVersion() || "v0.0.0";
                
                const isNewer = this.compareVersions(latestVersion, currentVersion) > 0;
                this.view.displayUpdateStatus(latestVersion, currentVersion, isNewer);
            }
        } catch (e) {
            console.warn("GitHub fetch failed", e);
            this.view.displayStars(null);
        }
    }

    compareVersions(v1, v2) {
        // Remove 'v' prefix
        const clean1 = v1.replace(/^v/, '');
        const clean2 = v2.replace(/^v/, '');
        
        const parts1 = clean1.split('.').map(Number);
        const parts2 = clean2.split('.').map(Number);
        
        for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
            const num1 = parts1[i] || 0;
            const num2 = parts2[i] || 0;
            if (num1 > num2) return 1;
            if (num1 < num2) return -1;
        }
        return 0;
    }
}
