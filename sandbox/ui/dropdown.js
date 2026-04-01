
// sandbox/ui/dropdown.js

/**
 * Reusable Custom Dropdown
 * Replaces ugly native <select> with a styled div-based dropdown.
 * Syncs with hidden native <select> for accessibility / form data.
 */
export class CustomDropdown {
    constructor(config) {
        this.wrapper = config.wrapper;
        this.trigger = config.trigger;
        this.dropdown = config.dropdown;
        this.nativeSelect = config.nativeSelect;
        this.options = config.options || []; // [{ val, txt, desc? }]
        this.onSelect = config.onSelect || (() => {});
        this.onChange = config.onChange || (() => {}); // Called when value actually changes (for model saves)
        this._isOpen = false;
        this._currentValue = this.nativeSelect?.value || this.options[0]?.val;

        this._init();
    }

    _init() {
        if (!this.wrapper || !this.trigger || !this.dropdown) return;

        // Open/close on trigger click
        this._triggerHandler = (e) => {
            e.stopPropagation();
            this.toggle();
        };
        this.trigger.addEventListener('click', this._triggerHandler);

        // Option click
        this._dropdownClickHandler = (e) => {
            const option = e.target.closest('.cd-option');
            if (!option) return;
            this.selectByValue(option.dataset.value);
        };
        this.dropdown.addEventListener('click', this._dropdownClickHandler);

        // Close on outside click
        this._outsideClickHandler = (e) => {
            if (!this.wrapper.contains(e.target)) this.close();
        };
        document.addEventListener('click', this._outsideClickHandler);

        // Keyboard on trigger
        this._triggerKeyHandler = (e) => {
            if (e.key === 'Escape') { this.close(); return; }
            if (!this._isOpen) {
                if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
                    e.preventDefault();
                    this.open();
                }
            }
        };
        this.trigger.addEventListener('keydown', this._triggerKeyHandler);

        // Keyboard on dropdown
        this._dropdownKeyHandler = (e) => {
            const opts = this._getOptionEls();
            const focused = this.dropdown.querySelector('.cd-option:focus');
            const idx = focused ? opts.indexOf(focused) : -1;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = opts[idx + 1] || opts[0];
                next?.focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = opts[idx - 1] || opts[opts.length - 1];
                prev?.focus();
            } else if (['Enter', ' '].includes(e.key)) {
                e.preventDefault();
                if (document.activeElement) {
                    const val = document.activeElement.dataset?.value;
                    if (val) this.selectByValue(val);
                }
            } else if (e.key === 'Escape') {
                this.close();
                this.trigger.focus();
            }
        };
        this.dropdown.addEventListener('keydown', this._dropdownKeyHandler);
    }

    _getOptionEls() {
        return [...this.dropdown.querySelectorAll('.cd-option')];
    }

    _render() {
        const currentVal = this.nativeSelect?.value || this.options[0]?.val;
        this.dropdown.innerHTML = '';
        this.options.forEach(opt => {
            const div = document.createElement('div');
            div.className = `cd-option${opt.val === currentVal ? ' active' : ''}`;
            div.dataset.value = opt.val;
            div.setAttribute('role', 'option');
            div.setAttribute('aria-selected', opt.val === currentVal);
            div.tabIndex = 0;
            const name = document.createElement('span');
            name.className = 'cd-option-name';
            name.textContent = opt.txt;
            div.appendChild(name);
            if (opt.desc) {
                const desc = document.createElement('span');
                desc.className = 'cd-option-desc';
                desc.textContent = opt.desc;
                div.appendChild(desc);
            }
            this.dropdown.appendChild(div);
        });
        // Update trigger label
        this._updateLabel(currentVal);
    }

    _updateLabel(value) {
        const opt = this.options.find(o => o.val === value) || this.options[0];
        if (!opt) return;
        const labelEl = this.trigger.querySelector('.cd-trigger-label');
        if (labelEl) labelEl.textContent = opt.txt;
    }

    open() {
        this.dropdown.classList.add('open');
        this.trigger.setAttribute('aria-expanded', 'true');
        this._isOpen = true;
        // Focus first option
        const first = this.dropdown.querySelector('.cd-option');
        if (first) first.focus();
    }

    close() {
        this.dropdown.classList.remove('open');
        this.trigger.setAttribute('aria-expanded', 'false');
        this._isOpen = false;
    }

    toggle() {
        if (this._isOpen) this.close();
        else this.open();
    }

    selectByValue(value) {
        // Update active state
        this.dropdown.querySelectorAll('.cd-option').forEach(opt => {
            const isActive = opt.dataset.value === value;
            opt.classList.toggle('active', isActive);
            opt.setAttribute('aria-selected', isActive);
        });

        // Update trigger label
        this._updateLabel(value);

        // Sync native select
        if (this.nativeSelect) {
            this.nativeSelect.value = value;
            this.nativeSelect.dispatchEvent(new Event('change'));
        }

        // Fire onChange only if value actually changed (avoids spurious saves on restore)
        if (value !== this._currentValue) {
            this._currentValue = value;
            this.onChange(value);
        }

        this.onSelect(value);
        this.close();
    }

    /**
     * Rebuild dropdown with new options array
     */
    setOptions(options) {
        this.options = options;
        this._render();
    }

    /**
     * Set current value without triggering callback
     */
    setValue(value) {
        this._updateLabel(value);
        if (this.nativeSelect) this.nativeSelect.value = value;
        this.dropdown.querySelectorAll('.cd-option').forEach(opt => {
            const isActive = opt.dataset.value === value;
            opt.classList.toggle('active', isActive);
            opt.setAttribute('aria-selected', isActive);
        });
    }

    getValue() {
        return this.nativeSelect?.value ?? this.options[0]?.val;
    }

    destroy() {
        this.trigger?.removeEventListener('click', this._triggerHandler);
        this.dropdown?.removeEventListener('click', this._dropdownClickHandler);
        document.removeEventListener('click', this._outsideClickHandler);
        this.trigger?.removeEventListener('keydown', this._triggerKeyHandler);
        this.dropdown?.removeEventListener('keydown', this._dropdownKeyHandler);
    }
}
