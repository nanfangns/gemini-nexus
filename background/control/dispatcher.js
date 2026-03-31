
// background/control/dispatcher.js

/**
 * Maps string tool names to executable actions.
 * Decouples logic from the main ControlManager.
 */
export class ToolDispatcher {
    constructor(actions, snapshotManager) {
        this.actions = actions;
        this.snapshotManager = snapshotManager;
    }

    async dispatch(name, args) {
        // Normalize tool name (handle common aliases and case variations)
        const normalizedName = this._normalizeToolName(name);

        try {
            switch (normalizedName) {
                // Navigation
                case 'navigate_page': return await this.actions.navigatePage(args);
                case 'new_page': return await this.actions.newPage(args);
                case 'close_page': return await this.actions.closePage(args);
                case 'list_pages': return await this.actions.listPages();
                case 'select_page': return await this.actions.selectPage(args);

                // Interaction
                case 'click': return await this.actions.clickElement(args);
                case 'click_element': return await this.actions.clickElement(args);
                case 'drag_element': return await this.actions.dragElement(args);
                case 'hover': return await this.actions.hoverElement(args);
                case 'hover_element': return await this.actions.hoverElement(args);
                case 'fill': return await this.actions.fillElement(args);
                case 'fill_element': return await this.actions.fillElement(args);
                case 'fill_form': return await this.actions.fillForm(args);
                case 'press_key': return await this.actions.pressKey(args);
                case 'handle_dialog': return await this.actions.input.handleDialog(args);
                case 'attach_file': return await this.actions.attachFile(args);

                // Observation & Logic
                case 'take_screenshot': return await this.actions.takeScreenshot(args);
                case 'screenshot': return await this.actions.takeScreenshot(args);
                case 'take_snapshot': return await this.snapshotManager.takeSnapshot(args);
                case 'snapshot': return await this.snapshotManager.takeSnapshot(args);
                case 'get_snapshot': return await this.snapshotManager.takeSnapshot(args);
                case 'wait_for': return await this.actions.waitFor(args);
                case 'evaluate_script': return await this.actions.evaluateScript(args);
                case 'run_javascript':
                case 'run_script':
                case 'js': return await this.actions.evaluateScript(args);

                // Emulation
                case 'emulate': return await this.actions.emulate(args);
                case 'resize_page': return await this.actions.resizePage(args);

                // Performance
                case 'performance_start_trace':
                case 'start_trace':
                    return await this.actions.startTrace(args);
                case 'performance_stop_trace':
                case 'stop_trace':
                    return await this.actions.stopTrace(args);
                case 'performance_analyze_insight':
                    return await this.actions.analyzeInsight(args);

                // Observability / Network
                case 'get_logs': return await this.actions.observation.getLogs();
                case 'console_logs': return await this.actions.observation.getLogs();
                case 'get_network_activity': return await this.actions.observation.getNetworkActivity();
                case 'list_network_requests': return await this.actions.observation.listNetworkRequests(args);
                case 'get_network_request': return await this.actions.observation.getNetworkRequest(args);

                default:
                    return `Error: Unknown tool '${name}'. Available tools: navigate_page, new_page, close_page, list_pages, select_page, click, hover, fill, fill_form, press_key, take_snapshot, take_screenshot, wait_for, evaluate_script, get_logs, resize_page, handle_dialog, attach_file`;
            }
        } catch (err) {
            // Wrap all errors with tool context
            const msg = err.message || String(err);
            return `Error in ${name}: ${msg}`;
        }
    }

    /**
     * Normalizes tool name by handling aliases and common variations.
     */
    _normalizeToolName(name) {
        if (!name || typeof name !== 'string') return name;
        return name.trim().toLowerCase().replace(/\s+/g, '_');
    }
}
