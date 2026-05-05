import { PROMPT_PRESETS } from '../../templates/settings/prompt.js';
import { CustomDropdown } from '../../dropdown.js';
import { t } from '../../../core/i18n.js';
import { showToast, showConfirm } from '../../dialogs.js';

const DEFAULT_PROMPT_PRESET = 'custom';
const BUILTIN_PRESET_KEYS = ['brutal', 'untrammelled'];

export class PromptSection {
    constructor(callbacks = {}) {
        this.callbacks = callbacks;
        this.elements = {};
        this.dropdown = null;
        this.selectedPreset = DEFAULT_PROMPT_PRESET;
        this.customText = '';
        this.customName = '';
        this.customPresets = [];
        this.linkedPresetId = null;
        this.queryElements();
        this.bindEvents();
        this.refreshDropdownOptions();
        this.syncButtonState();
    }

    fire(event, payload) {
        if (this.callbacks[event]) {
            this.callbacks[event](payload);
        }
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            promptInput: get('custom-prompt-input'),
            presetWrapper: get('prompt-preset-wrapper'),
            presetTrigger: get('prompt-preset-trigger'),
            presetDropdown: get('prompt-preset-dropdown'),
            presetSelect: get('prompt-preset-select'),
            presetNameInput: get('custom-preset-name-input'),
            savePresetButton: get('save-custom-preset'),
            deletePresetButton: get('delete-custom-preset')
        };
    }

    bindEvents() {
        const {
            promptInput,
            presetWrapper,
            presetTrigger,
            presetDropdown,
            presetSelect,
            presetNameInput,
            savePresetButton,
            deletePresetButton
        } = this.elements;

        if (presetWrapper && presetTrigger && presetDropdown && presetSelect) {
            this.dropdown = new CustomDropdown({
                wrapper: presetWrapper,
                trigger: presetTrigger,
                dropdown: presetDropdown,
                nativeSelect: presetSelect,
                options: this.buildDropdownOptions(),
                onSelect: (value) => this.handlePresetSelect(value)
            });
        }

        if (promptInput) {
            promptInput.addEventListener('input', () => this.handlePromptInput());
        }

        if (presetNameInput) {
            presetNameInput.addEventListener('input', () => this.handlePresetNameInput());
        }

        if (savePresetButton) {
            savePresetButton.addEventListener('click', () => this.handleSavePreset());
        }

        if (deletePresetButton) {
            deletePresetButton.addEventListener('click', () => this.handleDeletePreset());
        }

        this._languageChangeHandler = () => this.handleLanguageChange();
        document.addEventListener('gemini-language-changed', this._languageChangeHandler);
    }

    handleLanguageChange() {
        this.refreshDropdownOptions();

        if (this.selectedPreset !== DEFAULT_PROMPT_PRESET && !this.isUserPresetKey(this.selectedPreset)) {
            if (this.elements.presetNameInput) {
                this.elements.presetNameInput.value = this.getPresetName(this.selectedPreset);
            }
        }
    }

    sanitizeCustomPresets(items) {
        if (!Array.isArray(items)) return [];

        const seen = new Set();
        return items
            .filter(item => item && typeof item === 'object')
            .map(item => ({
                id: typeof item.id === 'string' && item.id ? item.id : this.generatePresetId(),
                name: typeof item.name === 'string' ? item.name : '',
                prompt: typeof item.prompt === 'string' ? item.prompt : ''
            }))
            .filter(item => {
                if (!item.name) return false;
                if (seen.has(item.id)) return false;
                seen.add(item.id);
                return true;
            });
    }

    generatePresetId() {
        return `preset_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    makeUserPresetKey(id) {
        return `user:${id}`;
    }

    isUserPresetKey(value) {
        return typeof value === 'string' && value.startsWith('user:');
    }

    getUserPresetId(value) {
        return this.isUserPresetKey(value) ? value.slice(5) : null;
    }

    getUserPresetByKey(value) {
        const id = this.getUserPresetId(value);
        if (!id) return null;
        return this.customPresets.find(preset => preset.id === id) || null;
    }

    getBuiltinPresetPrompt(value) {
        return PROMPT_PRESETS[value] || '';
    }

    getBuiltinPresetName(value) {
        if (value === 'brutal') return t('promptPresetBrutal');
        if (value === 'untrammelled') return t('promptPresetUntrammelled');
        return value;
    }

    getPresetPrompt(value) {
        if (value === DEFAULT_PROMPT_PRESET) {
            return this.customText;
        }
        if (this.isUserPresetKey(value)) {
            return this.getUserPresetByKey(value)?.prompt || '';
        }
        return this.getBuiltinPresetPrompt(value);
    }

    getPresetName(value) {
        if (value === DEFAULT_PROMPT_PRESET) {
            return this.customName;
        }
        if (this.isUserPresetKey(value)) {
            return this.getUserPresetByKey(value)?.name || '';
        }
        return this.getBuiltinPresetName(value);
    }

    isValidPreset(value, customPresets = this.customPresets) {
        if (value === DEFAULT_PROMPT_PRESET) return true;
        if (BUILTIN_PRESET_KEYS.includes(value)) return true;
        if (this.isUserPresetKey(value)) {
            const id = value.slice(5);
            return customPresets.some(preset => preset.id === id);
        }
        return false;
    }

    buildDropdownOptions() {
        const options = [
            { val: DEFAULT_PROMPT_PRESET, txt: t('promptDraft') },
            ...BUILTIN_PRESET_KEYS.map(key => ({
                val: key,
                txt: this.getBuiltinPresetName(key),
                desc: t('promptPresetBuiltinTag')
            })),
            ...this.customPresets.map(preset => ({
                val: this.makeUserPresetKey(preset.id),
                txt: preset.name,
                desc: t('promptPresetUserTag')
            }))
        ];

        return options;
    }

    refreshDropdownOptions() {
        if (!this.dropdown) return;
        this.dropdown.setOptions(this.buildDropdownOptions());
        this.dropdown.setValue(this.selectedPreset);
    }

    syncButtonState() {
        const { deletePresetButton } = this.elements;
        if (!deletePresetButton) return;

        const enabled = this.isUserPresetKey(this.selectedPreset);
        deletePresetButton.disabled = !enabled;
        deletePresetButton.style.opacity = enabled ? '1' : '0.5';
        deletePresetButton.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    switchToDraft({ promptText, presetName, linkedPresetId }) {
        this.selectedPreset = DEFAULT_PROMPT_PRESET;
        this.customText = promptText;
        this.customName = presetName || '';
        this.linkedPresetId = linkedPresetId || null;

        if (this.elements.promptInput) {
            this.elements.promptInput.value = this.customText;
        }
        if (this.elements.presetNameInput) {
            this.elements.presetNameInput.value = this.customName;
        }
        if (this.dropdown) {
            this.dropdown.setValue(DEFAULT_PROMPT_PRESET);
        }
        this.syncButtonState();
    }

    handlePresetSelect(value) {
        if (this.selectedPreset === DEFAULT_PROMPT_PRESET) {
            this.customText = this.elements.promptInput ? this.elements.promptInput.value : this.customText;
            this.customName = this.elements.presetNameInput ? this.elements.presetNameInput.value : this.customName;
        }

        this.selectedPreset = value;

        if (value === DEFAULT_PROMPT_PRESET) {
            if (this.elements.promptInput) this.elements.promptInput.value = this.customText;
            if (this.elements.presetNameInput) this.elements.presetNameInput.value = this.customName;
            this.syncButtonState();
            return;
        }

        const prompt = this.getPresetPrompt(value);
        const name = this.getPresetName(value);

        if (this.elements.promptInput) this.elements.promptInput.value = prompt;
        if (this.elements.presetNameInput) this.elements.presetNameInput.value = name;

        this.linkedPresetId = this.isUserPresetKey(value) ? this.getUserPresetId(value) : null;
        this.syncButtonState();
    }

    handlePromptInput() {
        const { promptInput, presetNameInput } = this.elements;
        if (!promptInput) return;

        if (this.selectedPreset === DEFAULT_PROMPT_PRESET) {
            this.customText = promptInput.value;
            return;
        }

        const originalPrompt = this.getPresetPrompt(this.selectedPreset);
        if (promptInput.value !== originalPrompt) {
            const linkedPresetId = this.isUserPresetKey(this.selectedPreset) ? this.getUserPresetId(this.selectedPreset) : null;
            const presetName = presetNameInput ? presetNameInput.value : this.getPresetName(this.selectedPreset);
            this.switchToDraft({
                promptText: promptInput.value,
                presetName,
                linkedPresetId
            });
        }
    }

    handlePresetNameInput() {
        const { promptInput, presetNameInput } = this.elements;
        if (!presetNameInput) return;

        if (this.selectedPreset === DEFAULT_PROMPT_PRESET) {
            this.customName = presetNameInput.value;
            return;
        }

        const originalName = this.getPresetName(this.selectedPreset);
        if (presetNameInput.value !== originalName) {
            const linkedPresetId = this.isUserPresetKey(this.selectedPreset) ? this.getUserPresetId(this.selectedPreset) : null;
            this.switchToDraft({
                promptText: promptInput ? promptInput.value : '',
                presetName: presetNameInput.value,
                linkedPresetId
            });
        }
    }

    async handleSavePreset() {
        const { promptInput, presetNameInput } = this.elements;
        if (!promptInput || !presetNameInput) return;

        const name = presetNameInput.value.trim();
        if (!name) {
            showToast(t('promptPresetNameRequired'), 'error');
            return;
        }

        const prompt = promptInput.value;

        let targetPreset = null;
        const selectedCustomPreset = this.isUserPresetKey(this.selectedPreset)
            ? this.getUserPresetByKey(this.selectedPreset)
            : null;
        const linkedPreset = this.linkedPresetId
            ? this.customPresets.find(preset => preset.id === this.linkedPresetId) || null
            : null;
        const sameNamePreset = this.customPresets.find(preset => preset.name === name) || null;

        if (selectedCustomPreset) {
            targetPreset = selectedCustomPreset;
        } else if (linkedPreset && linkedPreset.name === name) {
            targetPreset = linkedPreset;
        }

        if (sameNamePreset && (!targetPreset || sameNamePreset.id !== targetPreset.id)) {
            if (!await showConfirm(t('promptSavePresetOverwriteConfirm'))) {
                return;
            }
            targetPreset = sameNamePreset;
        }

        const savedPreset = targetPreset
            ? { ...targetPreset, name, prompt }
            : { id: this.generatePresetId(), name, prompt };

        const existingIndex = this.customPresets.findIndex(preset => preset.id === savedPreset.id);
        if (existingIndex >= 0) {
            this.customPresets.splice(existingIndex, 1, savedPreset);
        } else {
            this.customPresets.push(savedPreset);
        }

        this.customName = savedPreset.name;
        this.customText = savedPreset.prompt;
        this.linkedPresetId = savedPreset.id;
        this.selectedPreset = this.makeUserPresetKey(savedPreset.id);

        this.refreshDropdownOptions();
        if (this.elements.promptInput) this.elements.promptInput.value = savedPreset.prompt;
        if (this.elements.presetNameInput) this.elements.presetNameInput.value = savedPreset.name;
        if (this.dropdown) this.dropdown.setValue(this.selectedPreset);
        this.syncButtonState();
        this.fire('onStateChange', this.getData());
    }

    async handleDeletePreset() {
        if (!this.isUserPresetKey(this.selectedPreset)) {
            if (this.selectedPreset === DEFAULT_PROMPT_PRESET) {
                showToast(t('promptDeleteSelectCustom'), 'info');
            } else {
                showToast(t('promptPresetBuiltinDeleteBlocked'), 'error');
            }
            return;
        }

        const preset = this.getUserPresetByKey(this.selectedPreset);
        if (!preset) {
            showToast(t('promptDeleteSelectCustom'), 'info');
            return;
        }

        if (!await showConfirm(t('promptDeletePresetConfirm'), { danger: true })) {
            return;
        }

        const promptText = this.elements.promptInput ? this.elements.promptInput.value : preset.prompt;
        const presetName = this.elements.presetNameInput ? this.elements.presetNameInput.value : preset.name;

        this.customPresets = this.customPresets.filter(item => item.id !== preset.id);
        this.linkedPresetId = null;
        this.switchToDraft({
            promptText,
            presetName,
            linkedPresetId: null
        });
        this.refreshDropdownOptions();
        this.fire('onStateChange', this.getData());
    }

    normalizeData(data) {
        if (typeof data === 'string') {
            return {
                customPrompt: data,
                promptPreset: DEFAULT_PROMPT_PRESET,
                activePrompt: data,
                customPresets: [],
                customPromptName: '',
                linkedPresetId: null
            };
        }

        const customPresets = this.sanitizeCustomPresets(data && data.customPresets);
        let promptPreset = data && typeof data.promptPreset === 'string'
            ? data.promptPreset
            : DEFAULT_PROMPT_PRESET;
        let customPrompt = data && typeof data.customPrompt === 'string'
            ? data.customPrompt
            : '';
        const activePrompt = data && typeof data.activePrompt === 'string'
            ? data.activePrompt
            : '';
        const customPromptName = data && typeof data.customPromptName === 'string'
            ? data.customPromptName
            : '';
        const linkedPresetId = data && typeof data.linkedPresetId === 'string'
            ? data.linkedPresetId
            : null;

        if (!this.isValidPreset(promptPreset, customPresets)) {
            promptPreset = DEFAULT_PROMPT_PRESET;
        }

        if (!customPrompt && promptPreset === DEFAULT_PROMPT_PRESET) {
            customPrompt = activePrompt;
        }

        return {
            customPrompt,
            promptPreset,
            activePrompt,
            customPresets,
            customPromptName,
            linkedPresetId
        };
    }

    getData() {
        const activePrompt = this.elements.promptInput ? this.elements.promptInput.value : '';

        if (this.selectedPreset === DEFAULT_PROMPT_PRESET) {
            this.customText = activePrompt;
            this.customName = this.elements.presetNameInput ? this.elements.presetNameInput.value : this.customName;
        }

        return {
            customPrompt: this.customText,
            promptPreset: this.selectedPreset,
            activePrompt,
            customPresets: this.customPresets,
            customPromptName: this.customName,
            linkedPresetId: this.linkedPresetId
        };
    }

    setData(data) {
        const normalized = this.normalizeData(data);
        this.customPresets = normalized.customPresets;
        this.selectedPreset = normalized.promptPreset;
        this.customText = normalized.customPrompt;
        this.customName = normalized.customPromptName;
        this.linkedPresetId = normalized.linkedPresetId;

        if (this.selectedPreset === DEFAULT_PROMPT_PRESET && !this.customText) {
            this.customText = normalized.activePrompt || '';
        }

        this.refreshDropdownOptions();

        if (this.elements.promptInput) {
            this.elements.promptInput.value = this.selectedPreset === DEFAULT_PROMPT_PRESET
                ? this.customText
                : this.getPresetPrompt(this.selectedPreset);
        }

        if (this.elements.presetNameInput) {
            this.elements.presetNameInput.value = this.selectedPreset === DEFAULT_PROMPT_PRESET
                ? this.customName
                : this.getPresetName(this.selectedPreset);
        }

        if (this.dropdown) {
            this.dropdown.setValue(this.selectedPreset);
        }
        this.syncButtonState();
    }
}
