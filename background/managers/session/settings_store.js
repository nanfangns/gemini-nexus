
// background/managers/session/settings_store.js

export async function getConnectionSettings() {
    // Also read geminiModel to ensure model always comes from authoritative storage
    const stored = await chrome.storage.local.get([
        'geminiProvider',
        'geminiUseOfficialApi',
        'geminiApiKey',
        'geminiThinkingLevel',
        'geminiApiKeyPointer',
        'geminiOpenaiBaseUrl',
        'geminiOpenaiApiKey',
        'geminiOpenaiModel',
        'geminiAnthropicBaseUrl',
        'geminiAnthropicApiKey',
        'geminiAnthropicModel',
        'geminiXaiApiKey',
        'geminiXaiModel',
        'geminiModel'
    ]);

    // Legacy Migration Logic
    let provider = stored.geminiProvider;
    if (!provider) {
        provider = stored.geminiUseOfficialApi === true ? 'official' : 'web';
    }

    let activeApiKey = stored.geminiApiKey || "";

    // Handle API Key Rotation (Comma separated) for Official Gemini
    if (provider === 'official' && activeApiKey.includes(',')) {
        const keys = activeApiKey.split(',').map(k => k.trim()).filter(k => k);

        if (keys.length > 0) {
            let pointer = stored.geminiApiKeyPointer || 0;

            // Reset pointer if out of bounds (e.g. keys removed)
            if (typeof pointer !== 'number' || pointer >= keys.length || pointer < 0) {
                pointer = 0;
            }

            activeApiKey = keys[pointer];

            // Advance pointer for next call
            const nextPointer = (pointer + 1) % keys.length;
            await chrome.storage.local.set({ geminiApiKeyPointer: nextPointer });

            console.log(`[Gemini Nexus] Rotating Official API Key (Index: ${pointer})`);
        }
    } else {
        // Trim single key just in case
        activeApiKey = activeApiKey.trim();
    }

    const selectedModel = provider === 'official'
        ? (stored.geminiModel || 'gemini-2.5-flash')
        : (stored.geminiModel || '');

    console.log('[DEBUG getConnectionSettings] stored:', JSON.stringify({provider: provider, model: stored.geminiModel, openaiModel: stored.geminiOpenaiModel, anthropicModel: stored.geminiAnthropicModel, xaiModel: stored.geminiXaiModel}));
    return {
        provider: provider,
        // Model: always authoritative from storage; non-official providers handle their own fallback
        model: selectedModel,
        // Official
        apiKey: activeApiKey,
        thinkingLevel: stored.geminiThinkingLevel || "low",
        // OpenAI
        openaiBaseUrl: stored.geminiOpenaiBaseUrl,
        openaiApiKey: stored.geminiOpenaiApiKey,
        openaiModel: stored.geminiOpenaiModel,
        // Anthropic
        anthropicBaseUrl: stored.geminiAnthropicBaseUrl,
        anthropicApiKey: stored.geminiAnthropicApiKey,
        anthropicModel: stored.geminiAnthropicModel,
        // xAI
        xaiApiKey: stored.geminiXaiApiKey,
        xaiModel: stored.geminiXaiModel
    };
}
