
// services/providers/grok_web.js

/**
 * Grok Web provider.
 * Strategy: drive the already logged-in grok.com page DOM instead of replaying private HTTP APIs.
 */

import { requestGrokCookiesFromContentScript, getGrokAuth, hasGrokAuth, clearGrokAuth } from '../grok_auth.js';

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export class GrokWebProvider {
    constructor() {
        this.authData = null;
        this._pending = null;
    }

    async ensureAuth() {
        const cached = await getGrokAuth();
        if (cached && hasGrokAuth()) {
            this.authData = cached;
            return cached;
        }
        try {
            this.authData = await requestGrokCookiesFromContentScript();
            return this.authData;
        } catch (e) {
            throw new Error("Grok authentication failed. Please open grok.com and log in first.");
        }
    }

    async sendMessage(prompt, conversationId, parentResponseId, mode = 'auto', signal, onUpdate) {
        await this.ensureAuth();

        const requestId = generateUUID();
        console.log('[Grok Web DOM] requestId:', requestId, '| conversationId:', conversationId || '(new)', '| mode:', mode);

        return new Promise((resolve, reject) => {
            if (signal?.aborted) {
                reject(new Error('Request aborted'));
                return;
            }

            let aborted = false;
            this._pending = { requestId, onUpdate, resolve, reject, done: false };

            const cleanup = () => {
                aborted = true;
                this._pending = null;
            };

            if (signal) {
                signal.addEventListener('abort', () => {
                    if (!aborted && !this._pending?.done) {
                        cleanup();
                        reject(new Error('Request aborted'));
                    }
                }, { once: true });
            }

            chrome.tabs.query({ url: '*://grok.com/*' }, (tabs) => {
                if (aborted) return;
                if (!tabs || tabs.length === 0) {
                    cleanup();
                    reject(new Error('No grok.com tab found'));
                    return;
                }

                const activeTab = tabs.find((tab) => tab.active) || tabs[0];
                const tabId = activeTab.id;

                chrome.scripting.executeScript(
                    {
                        target: { tabId },
                        world: 'MAIN',
                        func: function(rid, promptText) {
                            var TIMEOUT = 90000;

                            function post(type, extra) {
                                var payload = Object.assign({ type: type, requestId: rid }, extra || {});
                                console.log('[Grok DOM] post', type, payload);
                                if (typeof window.grokBridgeSendMessage === 'function') {
                                    try {
                                        window.grokBridgeSendMessage(payload);
                                        return;
                                    } catch (e) {
                                        console.warn('[Grok DOM] bridge send failed:', e && e.message ? e.message : e);
                                    }
                                }
                                window.postMessage({
                                    source: 'GEMINI_NEXUS_GROK_PAGE',
                                    payload: payload
                                }, '*');
                            }

                            function cleanupHook() {
                                if (window.__grokBusyCleanup) {
                                    try { window.__grokBusyCleanup(); } catch (e) {}
                                    window.__grokBusyCleanup = null;
                                }
                                window.__grokBusy = false;
                            }

                            if (window.__grokBusy) {
                                post('GROK_API_ERROR', { error: 'busy' });
                                return;
                            }
                            window.__grokBusy = true;

                            var timer = setTimeout(function() {
                                cleanupHook();
                                post('GROK_API_ERROR', { error: 'timeout after ' + TIMEOUT + 'ms' });
                            }, TIMEOUT);

                            function fail(message) {
                                clearTimeout(timer);
                                cleanupHook();
                                post('GROK_API_ERROR', { error: message });
                            }

                            function done(fullText) {
                                clearTimeout(timer);
                                var conversationId = '';
                                var responseId = '';
                                try {
                                    var url = new URL(window.location.href);
                                    var match = String(url.pathname || '').match(/\/c\/([^/?#]+)/);
                                    if (match) conversationId = match[1];
                                    responseId = url.searchParams.get('rid') || '';
                                } catch (e) {}
                                cleanupHook();
                                post('GROK_API_DONE', {
                                    text: fullText || '',
                                    conversationId: conversationId,
                                    responseId: responseId
                                });
                            }

                            function getInput() {
                                return document.querySelector('.query-bar .ProseMirror[contenteditable="true"]') ||
                                    document.querySelector('.tiptap.ProseMirror[contenteditable="true"]') ||
                                    document.querySelector('.ProseMirror[contenteditable="true"]') ||
                                    document.querySelector('[contenteditable="true"].ProseMirror');
                            }

                            function getSubmitButton() {
                                var root = document.querySelector('.query-bar') || document;
                                return root.querySelector('button[aria-label="提交"]') ||
                                    root.querySelector('button[type="submit"][aria-label="提交"]') ||
                                    root.querySelector('button[type="submit"]');
                            }

                            function getAssistantContents() {
                                return Array.from(document.querySelectorAll('.response-content-markdown.markdown')).filter(function(el) {
                                    return !!el.closest('div.items-start');
                                });
                            }

                            function getLatestAssistantContent() {
                                var list = getAssistantContents();
                                return list.length ? list[list.length - 1] : null;
                            }

                            var input = getInput();
                            if (!input) {
                                fail('Grok input not found');
                                return;
                            }

                            var baselineAssistantCount = getAssistantContents().length;
                            var targetContent = null;
                            var currentFullText = '';
                            var stableTimer = null;
                            var observer = null;
                            var attachPollTimer = null;

                            function getStopButton() {
                                var root = document.querySelector('.query-bar') || document;
                                return root.querySelector('button[aria-label="停止"]') ||
                                    root.querySelector('button[aria-label="Stop"]');
                            }

                            function isButtonReady(btn) {
                                if (!btn) return false;
                                if (btn.disabled) return false;
                                if (!btn.offsetParent && btn.getBoundingClientRect().width === 0 && btn.getBoundingClientRect().height === 0) return false;
                                return true;
                            }

                            function scheduleCompletionCheck() {
                                if (stableTimer) clearTimeout(stableTimer);
                                stableTimer = setTimeout(function() {
                                    var submitBtn = getSubmitButton();
                                    var stopBtn = getStopButton();
                                    var ready = isButtonReady(submitBtn);
                                    var stopVisible = isButtonReady(stopBtn);
                                    if (currentFullText && (ready || !stopVisible)) {
                                        console.log('[Grok DOM] completion: fullText len=' + currentFullText.length + ' btnReady=' + ready + ' stopVisible=' + stopVisible);
                                        done(currentFullText);
                                        return;
                                    }
                                    console.log('[Grok DOM] poll: fullText len=' + currentFullText.length + ' btnReady=' + ready + ' stopVisible=' + stopVisible + ' btnDisabled=' + (submitBtn && submitBtn.disabled));
                                    scheduleCompletionCheck();
                                }, 800);
                            }

                            function emitIfChanged(nextText) {
                                nextText = nextText || '';
                                if (nextText === currentFullText) {
                                    scheduleCompletionCheck();
                                    return;
                                }

                                var delta = nextText.startsWith(currentFullText)
                                    ? nextText.slice(currentFullText.length)
                                    : nextText;
                                currentFullText = nextText;

                                if (!delta.trim()) {
                                    scheduleCompletionCheck();
                                    return;
                                }

                                post('GROK_API_TOKEN', { token: delta, fullText: currentFullText });
                                scheduleCompletionCheck();
                            }

                            function startObservingTarget(target) {
                                if (!target) return false;
                                targetContent = target;
                                currentFullText = '';

                                observer = new MutationObserver(function() {
                                    emitIfChanged((targetContent.innerText || '').trim());
                                });
                                observer.observe(targetContent, {
                                    childList: true,
                                    subtree: true,
                                    characterData: true
                                });

                                emitIfChanged((targetContent.innerText || '').trim());
                                return true;
                            }

                            function waitForAssistantTarget() {
                                var contents = getAssistantContents();
                                var candidate = contents.length > baselineAssistantCount
                                    ? contents[contents.length - 1]
                                    : getLatestAssistantContent();

                                if (candidate && (contents.length > baselineAssistantCount || (candidate.innerText || '').trim())) {
                                    startObservingTarget(candidate);
                                    return;
                                }

                                attachPollTimer = setTimeout(waitForAssistantTarget, 200);
                            }

                            window.__grokBusyCleanup = function() {
                                clearTimeout(timer);
                                if (stableTimer) clearTimeout(stableTimer);
                                if (attachPollTimer) clearTimeout(attachPollTimer);
                                if (observer) observer.disconnect();
                            };

                            try {
                                input.focus();

                                var selection = window.getSelection && window.getSelection();
                                if (selection) {
                                    selection.removeAllRanges();
                                    var range = document.createRange();
                                    range.selectNodeContents(input);
                                    selection.addRange(range);
                                }
                                document.execCommand('delete');
                                document.execCommand('insertText', false, promptText);
                                input.dispatchEvent(new InputEvent('input', {
                                    bubbles: true,
                                    cancelable: true,
                                    data: promptText,
                                    inputType: 'insertText'
                                }));

                                setTimeout(function() {
                                    var submitBtn = getSubmitButton();
                                    if (!submitBtn) {
                                        fail('Grok submit button not found');
                                        return;
                                    }
                                    if (submitBtn.disabled) {
                                        setTimeout(function() {
                                            var retryBtn = getSubmitButton();
                                            if (!retryBtn || retryBtn.disabled) {
                                                fail('Grok submit button is disabled');
                                                return;
                                            }
                                            retryBtn.click();
                                            waitForAssistantTarget();
                                            scheduleCompletionCheck();
                                        }, 300);
                                        return;
                                    }
                                    submitBtn.click();
                                    waitForAssistantTarget();
                                    scheduleCompletionCheck();
                                }, 50);
                            } catch (e) {
                                fail(e && e.message ? e.message : 'Failed to drive Grok DOM');
                            }
                        },
                        args: [requestId, prompt]
                    },
                    () => {
                        if (chrome.runtime.lastError) {
                            console.error('[Grok Web DOM] Inject error:', chrome.runtime.lastError.message);
                            if (!aborted && this._pending) {
                                cleanup();
                                reject(new Error('inject: ' + chrome.runtime.lastError.message));
                            }
                        } else {
                            console.log('[Grok Web DOM] Script injected, waiting for DOM stream...');
                        }
                    }
                );
            });
        });
    }

    handleMessage(message) {
        if (!this._pending) return;
        if (message.requestId !== this._pending.requestId) return;
        const req = this._pending;

        if (message.type === 'GROK_API_TOKEN') {
            req.onUpdate?.(message.fullText, null);
        } else if (message.type === 'GROK_API_DONE') {
            req.done = true;
            req.resolve({
                text: message.text || '',
                conversationId: message.conversationId || '',
                responseId: message.responseId || '',
                status: 'success'
            });
            this._pending = null;
        } else if (message.type === 'GROK_API_ERROR') {
            req.done = true;
            const errMsg = message.error || message.body || (message.status ? `API ${message.status}` : 'Unknown error');
            req.reject(new Error(errMsg));
            this._pending = null;
        }
    }

    resetAuth() {
        this.authData = null;
        clearGrokAuth();
    }
}

export const grokWebProvider = new GrokWebProvider();
