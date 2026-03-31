
// services/providers/anthropic.js

/**
 * Sends a message using Anthropic Messages API (Native).
 */
export async function sendAnthropicMessage(prompt, systemInstruction, history, config, files, signal, onUpdate) {
    let { baseUrl, apiKey, model } = config;

    if (!apiKey) throw new Error("API Key is missing.");
    if (!model) model = "claude-3-5-sonnet-20241022";

    // Build request URL(s)
    let urlsToTry = [];
    if (!baseUrl) {
        urlsToTry = ["https://api.anthropic.com/v1/messages"];
    } else {
        baseUrl = baseUrl.trim().replace(/\/+$/, "");

        // If user already provided a full endpoint, use it as-is
        if (baseUrl.endsWith("/messages")) {
            urlsToTry = [baseUrl];
        } else {
            urlsToTry = [
                `${baseUrl}/messages`,
                `${baseUrl}/v1/messages`,
                `${baseUrl}/v3/messages`,
                baseUrl
            ];
        }
    }

    // Dedupe
    urlsToTry = Array.from(new Set(urlsToTry));

    console.debug(`[Anthropic Native] URLs to try: ${urlsToTry.join(' | ')}`);

    // Build messages array
    const messages = [];

    // Helper to format content (Text + Image for Anthropic)
    const formatContent = (text, images) => {
        const content = [];
        if (text) {
            content.push({ type: "text", text: text });
        }
        if (images && images.length > 0) {
            images.forEach(img => {
                // img is base64 string "data:image/png;base64,..."
                const parts = img.split(',');
                const mimeMatch = parts[0].match(/:(.*?);/);
                content.push({
                    type: "image",
                    source: {
                        type: "base64",
                        media_type: mimeMatch ? mimeMatch[1] : "image/png",
                        data: parts[1]
                    }
                });
            });
        }
        return content;
    };

    // History
    if (history && Array.isArray(history)) {
        history.forEach(msg => {
            const role = msg.role === 'ai' ? 'assistant' : 'user';
            const images = (msg.role === 'user' && msg.image) ? msg.image : [];
            messages.push({
                role: role,
                content: formatContent(msg.text, images)
            });
        });
    }

    // Current Prompt
    const currentImages = [];
    if (files && files.length > 0) {
        files.forEach(f => {
            currentImages.push(f.base64);
        });
    }

    messages.push({
        role: "user",
        content: formatContent(prompt, currentImages)
    });

    const payload = {
        model: model,
        max_tokens: 8192,
        messages: messages,
        stream: true
    };

    if (systemInstruction) {
        payload.system = systemInstruction;
    }

    console.debug(`[Anthropic Native] Requesting ${model}...`);

    // Try multiple URL + header variants for maximum gateway compatibility
    const headerVariants = [
        {
            label: 'x-api-key',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        },
        {
            label: 'bearer',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'Authorization': `Bearer ${apiKey}`,
                'anthropic-version': '2023-06-01'
            }
        },
        {
            label: 'x-api-key + bearer',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'x-api-key': apiKey,
                'Authorization': `Bearer ${apiKey}`,
                'anthropic-version': '2023-06-01'
            }
        },
        {
            label: 'raw-authorization',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream',
                'Authorization': apiKey,
                'anthropic-version': '2023-06-01'
            }
        }
    ];

    let response = null;
    let lastErrorText = "";
    let lastStatus = 0;
    let lastTried = "";

    outer: for (const url of urlsToTry) {
        for (const variant of headerVariants) {
            console.debug(`[Anthropic Native] Request URL: ${url} (auth: ${variant.label})`);
            lastTried = `${url} (auth: ${variant.label})`;

            response = await fetch(url, {
                method: 'POST',
                headers: variant.headers,
                body: JSON.stringify(payload),
                signal
            });

            if (response.ok) break outer;

            lastStatus = response.status;
            try {
                lastErrorText = await response.text();
            } catch (e) {
                lastErrorText = '';
            }

            // 404: usually wrong path → try next URL (no need to vary auth headers)
            if (response.status === 404) break;

            // 401/403: might be auth header mismatch → try next header variant on same URL
            if (response.status === 401 || response.status === 403) continue;

            // Other errors: stop early
            break outer;
        }
    }

    if (!response || !response.ok) {
        let errorText = lastErrorText;
        try {
            const errJson = JSON.parse(errorText);
            if (errJson.error && errJson.error.message) errorText = errJson.error.message;
        } catch (e) {}
        const status = response ? response.status : 0;
        const tried = lastTried ? ` | tried: ${lastTried}` : "";
        throw new Error(`API Error (${status}): ${errorText}${tried}`);
    }

    // Handle SSE streaming (Anthropic uses event: content_block_delta)
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    let fullText = "";
    let fullThoughts = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        let lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('event: ')) {
                // Store event type
                buffer = trimmed.substring(7).trim() + '\n' + buffer;
            }
            if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.substring(6);
                try {
                    const data = JSON.parse(dataStr);

                    if (data.type === 'content_block_delta') {
                        if (data.delta?.type === 'thinking_delta' && data.delta?.thinking) {
                            // Extended thinking (Claude 3.7+)
                            fullThoughts += data.delta.thinking;
                            onUpdate(fullText, fullThoughts);
                        } else if (data.delta?.type === 'text_delta' && data.delta?.text) {
                            fullText += data.delta.text;
                            onUpdate(fullText, fullThoughts);
                        }
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            }
        }
    }

    return {
        text: fullText,
        thoughts: fullThoughts || null,
        images: [],
        context: null
    };
}
