
// sandbox/ui/settings/sections/appearance.js
import { CustomDropdown } from '../../dropdown.js';
import { t } from '../../../core/i18n.js';

export class AppearanceSection {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.elements = {};
        this.dropdowns = {};
        this.queryElements();
        this.bindEvents();
        this.refreshLabels();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            themeWrapper: get('theme-select-wrapper'),
            themeTrigger: get('theme-select-trigger'),
            themeDropdown: get('theme-select-dropdown'),
            themeSelect: get('theme-select'),
            languageWrapper: get('language-select-wrapper'),
            languageTrigger: get('language-select-trigger'),
            languageDropdown: get('language-select-dropdown'),
            languageSelect: get('language-select')
        };
    }

    bindEvents() {
        const { themeWrapper, themeTrigger, themeDropdown, themeSelect,
                languageWrapper, languageTrigger, languageDropdown, languageSelect } = this.elements;

        // Theme dropdown
        if (themeWrapper && themeTrigger && themeDropdown && themeSelect) {
            this.dropdowns.theme = new CustomDropdown({
                wrapper: themeWrapper,
                trigger: themeTrigger,
                dropdown: themeDropdown,
                nativeSelect: themeSelect,
                options: this.getThemeOptions(),
                onSelect: (value) => this.fire('onThemeChange', value)
            });
        }

        // Language dropdown
        if (languageWrapper && languageTrigger && languageDropdown && languageSelect) {
            this.dropdowns.language = new CustomDropdown({
                wrapper: languageWrapper,
                trigger: languageTrigger,
                dropdown: languageDropdown,
                nativeSelect: languageSelect,
                options: this.getLanguageOptions(),
                onSelect: (value) => this.fire('onLanguageChange', value)
            });
        }

        this._languageChangeHandler = () => this.refreshLabels();
        document.addEventListener('gemini-language-changed', this._languageChangeHandler);

        // System Theme Listener
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
             const themeSelect = this.elements.themeSelect;
             if (themeSelect && themeSelect.value === 'system') {
                 this.applyVisualTheme('system');
             }
        });
    }

    getThemeOptions() {
        return [
            { val: 'system', txt: t('systemDefault') },
            { val: 'light', txt: t('light') },
            { val: 'dark', txt: t('dark') }
        ];
    }

    getLanguageOptions() {
        return [
            { val: 'system', txt: t('systemDefault') },
            { val: 'en', txt: 'English' },
            { val: 'zh', txt: '中文' }
        ];
    }

    refreshLabels() {
        const themeValue = this.elements.themeSelect?.value || 'system';
        const languageValue = this.elements.languageSelect?.value || 'system';

        if (this.dropdowns.theme) {
            this.dropdowns.theme.setOptions(this.getThemeOptions());
            this.dropdowns.theme.setValue(themeValue);
        }

        if (this.dropdowns.language) {
            this.dropdowns.language.setOptions(this.getLanguageOptions());
            this.dropdowns.language.setValue(languageValue);
        }
    }

    setTheme(theme) {
        const dd = this.dropdowns.theme;
        if (dd) dd.setValue(theme);
        this.applyVisualTheme(theme);
    }

    setLanguage(lang) {
        const dd = this.dropdowns.language;
        if (dd) dd.setValue(lang);
    }

    applyVisualTheme(theme) {
        let applied = theme;
        if (theme === 'system') {
             applied = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', applied);
    }

    fire(event, data) {
        if (this.callbacks[event]) this.callbacks[event](data);
    }
}
