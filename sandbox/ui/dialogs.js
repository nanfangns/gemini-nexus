
// sandbox/ui/dialogs.js
// Toast notifications, custom confirm, and custom prompt dialogs
import { t } from '../core/i18n.js';

/* ── SVG icons ────────────────────────────────────────────── */
const ICONS = {
    success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info:    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
};

/* ── Toast ────────────────────────────────────────────────── */
let container = null;

function ensureContainer() {
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
}

/**
 * Show a toast notification.
 * @param {string} message - Text to display (or i18n key).
 * @param {'success'|'error'|'info'} [type='info']
 * @param {number} [duration=3000] - Auto-dismiss in ms (0 = manual only)
 */
export function showToast(message, type = 'info', duration = 3000) {
    ensureContainer();

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('data-type', type);

    const icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = ICONS[type] || ICONS.info;

    const msg = document.createElement('span');
    msg.className = 'toast-msg';
    msg.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', () => removeToast(toast));

    toast.appendChild(icon);
    toast.appendChild(msg);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    if (duration > 0) {
        setTimeout(() => removeToast(toast), duration);
    }

    return toast;
}

function removeToast(toast) {
    if (!toast.parentNode) return;
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 200);
}

/* ── Confirm Dialog ───────────────────────────────────────── */
/**
 * Show a styled confirm dialog (replaces native confirm()).
 * @param {string} message - Question text.
 * @param {object} [opts]
 * @param {string} [opts.confirmText] - Override confirm button label.
 * @param {string} [opts.cancelText]  - Override cancel button label.
 * @param {boolean} [opts.danger=false] - Use red confirm button.
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, opts = {}) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const box = document.createElement('div');
        box.className = 'dialog-box';

        const title = document.createElement('h4');
        title.className = 'dialog-title';
        title.textContent = opts.title || t('confirmTitle');

        const msgEl = document.createElement('p');
        msgEl.className = 'dialog-message';
        msgEl.textContent = message;

        const btns = document.createElement('div');
        btns.className = 'dialog-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.textContent = opts.cancelText || t('cancel');

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'dialog-btn ' + (opts.danger ? 'dialog-btn-danger' : 'dialog-btn-confirm');
        confirmBtn.textContent = opts.confirmText || t('confirm');

        const close = (result) => {
            overlay.style.animation = 'dialog-fade-in 0.15s ease reverse';
            setTimeout(() => overlay.remove(), 150);
            resolve(result);
        };

        cancelBtn.addEventListener('click', () => close(false));
        confirmBtn.addEventListener('click', () => close(true));
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
        document.addEventListener('keydown', function onKey(e) {
            if (e.key === 'Escape') { close(false); document.removeEventListener('keydown', onKey); }
            if (e.key === 'Enter')  { close(true);  document.removeEventListener('keydown', onKey); }
        });

        btns.appendChild(cancelBtn);
        btns.appendChild(confirmBtn);
        box.appendChild(title);
        box.appendChild(msgEl);
        box.appendChild(btns);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Focus confirm button by default
        confirmBtn.focus();
    });
}

/* ── Prompt Dialog ────────────────────────────────────────── */
/**
 * Show a styled prompt dialog (replaces native prompt()).
 * @param {string} message - Label text.
 * @param {object} [opts]
 * @param {string} [opts.defaultValue=''] - Pre-filled input value.
 * @param {string} [opts.placeholder='']  - Input placeholder.
 * @param {string} [opts.confirmText]     - Override confirm button label.
 * @returns {Promise<string|null>} null = cancelled
 */
export function showPrompt(message, opts = {}) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.className = 'dialog-overlay';

        const box = document.createElement('div');
        box.className = 'dialog-box';

        const title = document.createElement('h4');
        title.className = 'dialog-title';
        title.textContent = opts.title || message;

        const input = document.createElement('input');
        input.className = 'dialog-input';
        input.type = 'text';
        input.value = opts.defaultValue || '';
        input.placeholder = opts.placeholder || '';

        const btns = document.createElement('div');
        btns.className = 'dialog-buttons';

        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'dialog-btn dialog-btn-cancel';
        cancelBtn.textContent = opts.cancelText || t('cancel');

        const confirmBtn = document.createElement('button');
        confirmBtn.className = 'dialog-btn dialog-btn-confirm';
        confirmBtn.textContent = opts.confirmText || t('confirm');

        const close = (result) => {
            overlay.style.animation = 'dialog-fade-in 0.15s ease reverse';
            setTimeout(() => overlay.remove(), 150);
            resolve(result);
        };

        cancelBtn.addEventListener('click', () => close(null));
        confirmBtn.addEventListener('click', () => close(input.value || null));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter')  { e.preventDefault(); close(input.value || null); }
            if (e.key === 'Escape') { close(null); }
        });
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });

        btns.appendChild(cancelBtn);
        btns.appendChild(confirmBtn);
        box.appendChild(title);
        box.appendChild(input);
        box.appendChild(btns);
        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Focus & select input
        setTimeout(() => { input.focus(); input.select(); }, 50);
    });
}

/* ── Shortcut: alert replacement via toast ────────────────── */
/**
 * Drop-in replacement for native alert(). Shows a toast.
 * For critical errors that must block, pass { blocking: true }.
 * @param {string} message
 */
export function alert(message) {
    showToast(message, 'error', 3500);
}
