
// background/control/actions/observation/script.js
import { BaseActionHandler } from '../base.js';

export class ScriptActions extends BaseActionHandler {

    /**
     * Evaluates a script in the browser context.
     * Supports passing arguments (including DOM elements via UIDs).
     */
    async evaluateScript({ script, args = [] }) {
        try {
            const callArguments = [];

            // 1. Resolve arguments: UIDs to ObjectIds
            if (args && Array.isArray(args)) {
                for (const arg of args) {
                    if (typeof arg === 'object' && arg !== null && arg.uid) {
                        // Argument is a DOM reference
                        try {
                            const objectId = await this.getObjectIdFromUid(arg.uid);
                            callArguments.push({ objectId });
                        } catch (e) {
                            return `Error: Could not resolve argument with uid ${arg.uid}: ${e.message}`;
                        }
                    } else {
                        // Regular JSON argument
                        callArguments.push({ value: arg });
                    }
                }
            }

            // 2. Script Wrapping logic
            let functionDeclaration = script.trim();
            
            // Heuristic to detect if it's already a function definition
            const isFunction = /^(async\s+)?function\b/.test(functionDeclaration) || 
                               /^\(?[\w\s,]*\)?\s*=>/.test(functionDeclaration);

            if (!isFunction) {
                // If it looks like a code block with an explicit return, wrap as statements
                if (/\breturn\b/.test(functionDeclaration)) {
                    functionDeclaration = `async function() { ${functionDeclaration} }`;
                } else {
                    // Otherwise treat as an expression
                    functionDeclaration = `async function() { return (${functionDeclaration}); }`;
                }
            }

            // 3. Execution via CDP
            const res = await this.cmd("Runtime.callFunctionOn", {
                functionDeclaration: functionDeclaration,
                arguments: callArguments,
                executionContextId: undefined, // Default context
                returnByValue: true, // Return JSON result
                awaitPromise: true,  // Support async
                userGesture: true
            });

            // 4. Result Handling
            if (res.exceptionDetails) {
                const exc = res.exceptionDetails;
                return `Script Exception: ${exc.text} ${exc.exception ? exc.exception.description : ''}`;
            }

            if (res.result) {
                if (res.result.type === 'undefined') return "undefined";
                
                // Return structured JSON for objects, string for primitives
                const val = res.result.value;
                if (typeof val === 'object' && val !== null) {
                    return JSON.stringify(val, null, 2);
                }
                return String(val);
            }
            
            return "undefined";
        } catch (e) {
            return `Error evaluating script: ${e.message}`;
        }
    }

    async waitFor({ text, timeout = 5000 }) {
        try {
            // Poll for text presence in the DOM
            const res = await this.cmd("Runtime.evaluate", {
                expression: `
                    (async () => {
                        const start = Date.now();
                        const target = "${String(text).replace(/"/g, '\\"')}";
                        while (Date.now() - start < ${timeout}) {
                            if (document.body && document.body.innerText.includes(target)) {
                                return true;
                            }
                            await new Promise(r => setTimeout(r, 200));
                        }
                        return false;
                    })()
                `,
                awaitPromise: true,
                returnByValue: true
            });
            
            if (res.result && res.result.value === true) {
                return `Found text "${text}".`;
            } else {
                return `Timeout waiting for text "${text}" after ${timeout}ms.`;
            }
        } catch (e) {
            return `Error waiting for text: ${e.message}`;
        }
    }
}
