
// content/toolbar/dispatch.js

(function() {
    class ToolbarDispatcher {
        constructor(controller) {
            this.controller = controller;
        }

        // Accessors to controller components
        get ui() { return this.controller.ui; }
        get actions() { return this.controller.actions; }
        get inputManager() { return this.controller.inputManager; }
        get imageDetector() { return this.controller.imageDetector; }

        dispatch(actionType, data) {
            // Always read fresh from chrome.storage.local to avoid stale dropdown state
            // caused by failed storage.onChanged syncs between sidebar and floating toolbar
            chrome.storage.local.get(['geminiModel', 'geminiProvider'], (res) => {
                const freshModel = res.geminiModel || this.ui.getSelectedModel();
                this._dispatchWithModel(actionType, data, freshModel);
            });
        }

        _dispatchWithModel(actionType, data, currentModel) {
            switch(actionType) {
                case 'copy_selection':
                    if (this.controller.currentSelection) {
                        navigator.clipboard.writeText(this.controller.currentSelection)
                            .then(() => this.ui.showCopySelectionFeedback(true))
                            .catch((err) => {
                                console.error("Failed to copy text:", err);
                                this.ui.showCopySelectionFeedback(false);
                            });
                    }
                    break;

                case 'image_analyze':
                case 'image_chat':
                case 'image_describe':
                    {
                        const img = this.imageDetector.getCurrentImage();
                        if (!img) return;

                        const imgUrl = img.src;
                        const rect = img.getBoundingClientRect();

                        this.ui.hideImageButton();
                        this.controller.lastSessionId = null;
                        this.actions.handleImagePrompt(imgUrl, rect, 'analyze', currentModel);
                    }
                    break;

                case 'image_extract':
                    {
                        const img = this.imageDetector.getCurrentImage();
                        if (!img) return;

                        const imgUrl = img.src;
                        const rect = img.getBoundingClientRect();

                        this.ui.hideImageButton();
                        this.controller.lastSessionId = null;
                        this.actions.handleImagePrompt(imgUrl, rect, 'ocr', currentModel);
                    }
                    break;

                case 'image_remove_bg':
                case 'image_remove_text':
                case 'image_remove_watermark':
                case 'image_upscale':
                case 'image_expand':
                    {
                        const img = this.imageDetector.getCurrentImage();
                        if (!img) return;

                        const imgUrl = img.src;
                        const rect = img.getBoundingClientRect();

                        this.ui.hideImageButton();
                        this.controller.lastSessionId = null;

                        let mode = 'remove_text';
                        if (actionType === 'image_upscale') mode = 'upscale';
                        if (actionType === 'image_remove_bg') mode = 'remove_bg';
                        if (actionType === 'image_remove_watermark') mode = 'remove_watermark';
                        if (actionType === 'image_expand') mode = 'expand';

                        this.actions.handleImagePrompt(imgUrl, rect, mode, currentModel);
                    }
                    break;

                case 'ask':
                    if (this.controller.currentSelection) {
                        this.controller.hide(); // Hides small toolbar
                        const isZh = navigator.language.startsWith('zh');
                        this.ui.showAskWindow(this.controller.lastRect, this.controller.currentSelection, isZh ? "询问" : "Ask Gemini", this.controller.lastMousePoint);
                        this.controller.visible = true; // Mark window as visible
                    }
                    break;

                case 'translate':
                case 'explain':
                case 'summarize':
                    if (!this.controller.currentSelection) return;
                    this.controller.lastSessionId = null;
                    this.actions.handleQuickAction(actionType, this.controller.currentSelection, this.controller.lastRect, currentModel, this.controller.lastMousePoint);
                    break;

                case 'grammar':
                    if (!this.controller.currentSelection) return;
                    this.ui.setGrammarMode(true, this.inputManager.source, this.inputManager.range);
                    this.controller.lastSessionId = null;
                    this.actions.handleQuickAction(actionType, this.controller.currentSelection, this.controller.lastRect, currentModel, this.controller.lastMousePoint);
                    break;

                case 'insert_result':
                    this._handleInsert(data, false);
                    break;

                case 'replace_result':
                    this._handleInsert(data, true);
                    break;

                case 'submit_ask':
                    const question = data;
                    const context = this.controller.currentSelection;
                    if (question) {
                        this.actions.handleSubmitAsk(question, context, this.controller.lastSessionId, currentModel);
                    }
                    break;

                case 'retry_ask':
                    this.actions.handleRetry();
                    break;

                case 'continue_ask':
                    this.actions.handleContinue();
                    break;

                default:
                    console.warn('[ToolbarDispatcher] Unknown action:', actionType);
            }
        }

        _handleInsert(data, replace) {
            if (!data || !data.text) return;

            const input = this.inputManager.getInput();
            if (!input) return;

            if (replace) {
                const start = input.selectionStart ?? input.value.length;
                const end = input.selectionEnd ?? input.value.length;
                input.setRangeText(data.text, start, end, 'end');
            } else {
                const pos = input.selectionStart ?? input.value.length;
                input.setRangeText(data.text, pos, pos, 'end');
            }

            input.focus();
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    window.GeminiToolbarDispatcher = ToolbarDispatcher;
})();
