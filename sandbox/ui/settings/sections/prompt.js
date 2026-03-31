
// sandbox/ui/settings/sections/prompt.js
import { PROMPT_PRESETS } from '../../templates/settings/prompt.js';

export class PromptSection {
    constructor() {
        this.elements = {};
        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            promptInput: get('custom-prompt-input'),
            presetSelect: get('prompt-preset-select')
        };
    }

    bindEvents() {
        const { presetSelect } = this.elements;
        if (presetSelect) {
            presetSelect.addEventListener('change', (e) => {
                const value = e.target.value;
                if (value === 'custom') {
                    if (this.elements.promptInput) this.elements.promptInput.value = '';
                    return;
                }
                const preset = PROMPT_PRESETS[value];
                if (preset && this.elements.promptInput) {
                    this.elements.promptInput.value = preset;
                }
            });
        }
    }

    getData() {
        return {
            customPrompt: this.elements.promptInput ? this.elements.promptInput.value : ''
        };
    }

    setData(data) {
        if (this.elements.promptInput && data && data.customPrompt !== undefined) {
            this.elements.promptInput.value = data.customPrompt || '';
        }
    }
}
