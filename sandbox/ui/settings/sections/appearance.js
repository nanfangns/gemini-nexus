
// sandbox/ui/settings/sections/appearance.js

export class AppearanceSection {
    constructor(callbacks) {
        this.callbacks = callbacks || {};
        this.elements = {};
        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            themeSelect: get('theme-select'),
            languageSelect: get('language-select')
        };
    }

    bindEvents() {
        const { themeSelect, languageSelect } = this.elements;

        if (themeSelect) {
            themeSelect.addEventListener('change', (e) => this.fire('onThemeChange', e.target.value));
        }
        if (languageSelect) {
            languageSelect.addEventListener('change', (e) => this.fire('onLanguageChange', e.target.value));
        }

        // System Theme Listener
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
             if (themeSelect && themeSelect.value === 'system') {
                 this.applyVisualTheme('system');
             }
        });
    }

    setTheme(theme) {
        if (this.elements.themeSelect) this.elements.themeSelect.value = theme;
        this.applyVisualTheme(theme);
    }

    setLanguage(lang) {
        if (this.elements.languageSelect) this.elements.languageSelect.value = lang;
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
