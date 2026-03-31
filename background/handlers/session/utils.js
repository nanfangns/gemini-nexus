
// background/handlers/session/utils.js

/**
 * Parses ALL tool commands from LLM response text.
 * Supports multiple formats: code blocks, raw JSON, and inline JSON objects.
 * Returns an array of all valid tools found.
 */
export function parseToolCommands(responseText) {
    // Normalize whitespace for easier processing
    const text = responseText.trim();
    if (!text) return [];

    const tools = [];
    const seen = new Set(); // Deduplicate by tool name + args

    // Helper to add tool with deduplication
    const addTool = (tool) => {
        if (!tool) return;
        const key = tool.name + '::' + JSON.stringify(tool.args);
        if (!seen.has(key)) {
            seen.add(key);
            tools.push(tool);
        }
    };

    // --- Strategy 1: Code block parsing (highest priority) ---
    const codeBlockMatches = text.matchAll(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi);
    for (const match of codeBlockMatches) {
        addTool(tryParseTool(match[1]));
    }

    // --- Strategy 2: Inline JSON parsing (deduplicated) ---
    const jsonCandidates = extractJsonCandidates(text);
    for (const candidate of jsonCandidates) {
        addTool(tryParseTool(candidate));
    }

    return tools;
}

/**
 * Parses the FIRST tool command from LLM response text.
 * Convenience wrapper for single-tool responses.
 */
export function parseToolCommand(responseText) {
    const tools = parseToolCommands(responseText);
    return tools.length > 0 ? tools[0] : null;
}

/**
 * Extracts potential JSON object strings from text.
 * Handles nested braces correctly and avoids partial/invalid JSON.
 */
function extractJsonCandidates(text) {
    const candidates = [];

    // Strategy: Find "tool": occurrences and trace back to the opening brace
    const toolKeyPattern = /"tool"\s*:/g;
    let match;

    while ((match = toolKeyPattern.exec(text)) !== null) {
        const toolIdx = match.index;

        // Find the nearest opening brace before "tool": (accounting for whitespace/newlines)
        let braceIdx = toolIdx - 1;
        while (braceIdx >= 0 && /\s/.test(text[braceIdx])) {
            braceIdx--;
        }

        if (braceIdx < 0 || text[braceIdx] !== '{') continue;

        // Now find the matching closing brace
        let depth = 0;
        let endIdx = -1;
        for (let i = braceIdx; i < text.length; i++) {
            if (text[i] === '{') depth++;
            else if (text[i] === '}') {
                depth--;
                if (depth === 0) {
                    endIdx = i;
                    break;
                }
            }
        }

        if (endIdx === -1) continue;

        const candidate = text.substring(braceIdx, endIdx + 1);

        // Only add if we haven't already found this exact candidate
        if (!candidates.includes(candidate)) {
            candidates.push(candidate);
        }
    }

    return candidates;
}

/**
 * Attempts to parse a string as a tool command.
 * Returns null if parsing fails or structure is invalid.
 */
function tryParseTool(str) {
    try {
        const cmd = JSON.parse(str);

        // Validate: must have 'tool' (string) and 'args' (object)
        if (typeof cmd.tool !== 'string' || !cmd.tool.trim()) return null;
        if (!cmd.args || typeof cmd.args !== 'object') return null;

        return {
            name: cmd.tool.trim(),
            args: cmd.args
        };
    } catch (e) {
        return null;
    }
}

export async function getActiveTabContent(specificTabId = null) {
    try {
        let tab;
        if (specificTabId) {
            try {
                tab = await chrome.tabs.get(specificTabId);
            } catch (e) {
                // Specific tab not found
                return null;
            }
        } else {
            const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
            tab = tabs[0];
        }

        if (!tab || !tab.id) return null;

        // Check for restricted URLs
        if (tab.url && (
            tab.url.startsWith('chrome://') || 
            tab.url.startsWith('edge://') || 
            tab.url.startsWith('chrome-extension://') || 
            tab.url.startsWith('about:') ||
            tab.url.startsWith('view-source:') ||
            tab.url.startsWith('https://chrome.google.com/webstore') ||
            tab.url.startsWith('https://chromewebstore.google.com')
        )) {
            return null;
        }

        // Strategy 1: Try sending message to existing content script
        try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: "GET_PAGE_CONTENT" });
            return response ? response.content : null;
        } catch (e) {
            // Strategy 2: Fallback to Scripting Injection
            console.log("Content script unavailable, attempting fallback injection...");
            try {
                const results = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => document.body ? document.body.innerText : ""
                });
                return results?.[0]?.result || null;
            } catch (injErr) {
                console.error("Fallback injection failed:", injErr);
                return null;
            }
        }
    } catch (e) {
        console.error("Failed to get page context:", e);
        return null;
    }
}
