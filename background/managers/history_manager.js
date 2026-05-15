
// background/managers/history_manager.js
import { generateUUID } from '../../lib/utils.js';

async function saveSessionsAndNotify(geminiSessions) {
    await chrome.storage.local.set({ geminiSessions });

    chrome.runtime
        .sendMessage({
            action: 'SESSIONS_UPDATED',
            sessions: geminiSessions,
        })
        .catch(() => {});
}

async function moveSessionToTopAndSave(geminiSessions, sessionIndex, session) {
    geminiSessions.splice(sessionIndex, 1);
    geminiSessions.unshift(session);
    await saveSessionsAndNotify(geminiSessions);
}

function createAiHistoryMessage(result) {
    return {
        role: 'ai',
        text: result.text,
        thoughts: result.thoughts,
        thoughtsDurationSeconds: result.thoughtsDurationSeconds,
        sources: result.sources || null,
        generatedImages: result.images,
        thoughtSignature: result.thoughtSignature,
        officialContent: result.officialContent || null,
        suppressCopy: result.suppressCopy === true,
    };
}

/**
 * Saves a completed interaction to the chat history in local storage.
 */
export async function saveToHistory(text, result, filesObj = null) {
    try {
        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);

        const sessionId = generateUUID();
        const title = text.length > 30 ? text.substring(0, 30) + '...' : text;

        // Normalize image data to array of base64 strings
        let storedImages = null;
        if (filesObj) {
            if (Array.isArray(filesObj)) {
                storedImages = filesObj.map(f => f.base64);
            } else if (filesObj.base64) {
                storedImages = [filesObj.base64];
            }
        }

        const newSession = {
            id: sessionId,
            title: title || 'Quick Ask',
            timestamp: Date.now(),
            messages: [
                {
                    role: 'user',
                    text: text,
                    image: storedImages,
                },
                createAiHistoryMessage(result),
            ],
            context: result.context,
        };

        geminiSessions.unshift(newSession);
        await saveSessionsAndNotify(geminiSessions);

        return newSession;
    } catch (e) {
        console.error('Error saving history:', e);
        return null;
    }
}

/**
 * Appends an AI response to an existing session in local storage.
 */
export async function appendAiMessage(sessionId, result) {
    try {
        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionId);

        if (sessionIndex !== -1) {
            const session = geminiSessions[sessionIndex];

            session.messages.push(createAiHistoryMessage(result));
            session.context = result.context;
            session.timestamp = Date.now();

            await moveSessionToTopAndSave(geminiSessions, sessionIndex, session);

            return true;
        }
        return false;
    } catch (e) {
        console.error('Error appending history:', e);
        return false;
    }
}

/**
 * Appends a complete user+AI turn to an existing session.
 * Used by QuickAskHandler when continuing an existing session.
 */
export async function appendTurnToHistory(sessionId, text, result, filesObj = null) {
    try {
        if (!sessionId || !result || result.status !== 'success') return null;

        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionId);
        if (sessionIndex === -1) return null;

        const session = geminiSessions[sessionIndex];

        let storedImages = null;
        if (filesObj) {
            if (Array.isArray(filesObj)) {
                storedImages = filesObj.map(f => f.base64);
            } else if (filesObj.base64) {
                storedImages = [filesObj.base64];
            }
        }

        session.messages.push({
            role: 'user',
            text,
            image: storedImages,
        });
        session.messages.push(createAiHistoryMessage(result));
        session.context = result.context;
        session.timestamp = Date.now();

        await moveSessionToTopAndSave(geminiSessions, sessionIndex, session);

        return session;
    } catch (e) {
        console.error('Error appending turn history:', e);
        return null;
    }
}

/**
 * Appends an array of raw message objects directly to session history.
 * Used for official function response pairs (model + response).
 */
export async function appendRawMessages(sessionId, messages) {
    try {
        if (!sessionId || !Array.isArray(messages) || messages.length === 0) return false;

        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionId);

        if (sessionIndex === -1) return false;

        const session = geminiSessions[sessionIndex];
        messages.forEach(message => {
            if (message && typeof message === 'object') {
                session.messages.push(message);
            }
        });
        session.timestamp = Date.now();

        await moveSessionToTopAndSave(geminiSessions, sessionIndex, session);

        return true;
    } catch (e) {
        console.error('Error appending raw history messages:', e);
        return false;
    }
}

/**
 * Appends an AI message only if it has visible content (text, thoughts, images, etc.).
 * Prevents saving empty or tool-call-only intermediate results to the UI.
 */
export async function appendAiMessageIfDisplayable(sessionId, result) {
    const text = typeof result?.text === 'string' ? result.text : '';
    const thoughts = typeof result?.thoughts === 'string' ? result.thoughts : '';
    const hasText = text.trim().length > 0;
    const hasThoughts = thoughts.trim().length > 0;
    const hasThoughtSignature =
        typeof result?.thoughtSignature === 'string' && result.thoughtSignature.trim().length > 0;
    const hasImages = Array.isArray(result?.images) && result.images.length > 0;
    const hasSources = Array.isArray(result?.sources) && result.sources.length > 0;

    if (!hasText && !hasThoughts && !hasThoughtSignature && !hasImages && !hasSources) {
        return false;
    }

    return appendAiMessage(sessionId, {
        ...result,
        text,
        thoughts: hasThoughts ? thoughts : null,
    });
}

/**
 * Appends a User message (or Tool Output) to an existing session.
 * Used for the automated browser control loop.
 */
export async function appendUserMessage(sessionId, text, images = null, metadata = null) {
    try {
        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionId);

        if (sessionIndex !== -1) {
            const session = geminiSessions[sessionIndex];

            const message = {
                role: 'user',
                text: text,
                image: images,
            };
            if (metadata && typeof metadata === 'object') {
                Object.assign(message, metadata);
            }

            session.messages.push(message);
            session.timestamp = Date.now();

            await moveSessionToTopAndSave(geminiSessions, sessionIndex, session);

            return true;
        }
        return false;
    } catch (e) {
        console.error('Error appending user message:', e);
        return false;
    }
}

/**
 * Replaces the entire session with a snapshot (for history editing).
 */
export async function replaceSessionSnapshot(sessionSnapshot) {
    try {
        if (!sessionSnapshot || !sessionSnapshot.id || !Array.isArray(sessionSnapshot.messages)) {
            return false;
        }

        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionSnapshot.id);

        if (sessionIndex !== -1) {
            geminiSessions[sessionIndex] = {
                ...geminiSessions[sessionIndex],
                ...sessionSnapshot,
                timestamp: Date.now(),
            };

            await moveSessionToTopAndSave(geminiSessions, sessionIndex, geminiSessions[sessionIndex]);
            return true;
        }
        return false;
    } catch (e) {
        console.error('Error replacing session snapshot:', e);
        return false;
    }
}

export async function updateSessionMetadata(sessionId, patch) {
    try {
        const { geminiSessions = [] } = await chrome.storage.local.get(['geminiSessions']);
        const sessionIndex = geminiSessions.findIndex(s => s.id === sessionId);

        if (sessionIndex === -1) {
            return false;
        }

        geminiSessions[sessionIndex] = {
            ...geminiSessions[sessionIndex],
            ...patch
        };

        await chrome.storage.local.set({ geminiSessions });

        chrome.runtime.sendMessage({
            action: "SESSIONS_UPDATED",
            sessions: geminiSessions
        }).catch(() => {});

        return true;
    } catch (e) {
        console.error("Error updating session metadata:", e);
        return false;
    }
}
