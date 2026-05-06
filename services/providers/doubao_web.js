import { DOUBAO_WEB_DEFAULTS, getDoubaoAuth, clearDoubaoAuth, uploadDoubaoImagesFromPage, preHandleDoubaoImage } from '../doubao_auth.js';

const DOUBAO_BOT_ID = DOUBAO_WEB_DEFAULTS.botId;
const DOUBAO_PC_VERSION = DOUBAO_WEB_DEFAULTS.pcVersion;
const DOUBAO_VERSION_CODE = DOUBAO_WEB_DEFAULTS.versionCode;
const DOUBAO_AID = DOUBAO_WEB_DEFAULTS.aid;
const DOUBAO_ATTACHMENT_BLOCK = 10052;

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function resolveDoubaoMode(model) {
    if (model === 'doubao-think') {
        return { useDeepThink: '1', needDeepThink: 1 };
    }
    if (model === 'doubao-expert') {
        return { useDeepThink: '3', needDeepThink: 0 };
    }
    return { useDeepThink: '0', needDeepThink: 0 };
}

function buildCompletionUrl(auth) {
    const url = new URL('https://www.doubao.com/chat/completion');
    url.searchParams.set('aid', auth.aid || DOUBAO_AID);
    url.searchParams.set('device_id', auth.deviceId);
    url.searchParams.set('device_platform', 'web');
    url.searchParams.set('fp', auth.fp);
    url.searchParams.set('language', 'zh');
    url.searchParams.set('pc_version', auth.pcVersion || DOUBAO_PC_VERSION);
    url.searchParams.set('pkg_type', 'release_version');
    url.searchParams.set('real_aid', auth.aid || DOUBAO_AID);
    url.searchParams.set('region', '');
    url.searchParams.set('samantha_web', '1');
    url.searchParams.set('sys_region', '');
    url.searchParams.set('tea_uuid', auth.teaUuid);
    url.searchParams.set('use-olympus-account', '1');
    url.searchParams.set('version_code', auth.versionCode || DOUBAO_VERSION_CODE);
    url.searchParams.set('web_id', auth.webId);
    url.searchParams.set('web_tab_id', generateUUID());
    return url.toString();
}

async function buildPayload(prompt, conversationId, sectionId, replyMessageId, fp, files, model) {
    const localConversationId = conversationId || `local_${Date.now()}`;
    const localMessageId = generateUUID();
    const contentBlocks = [];
    let preGenerateId = '';
    const mode = resolveDoubaoMode(model);

    if (files && files.length > 0) {
        const uploadPlans = files.map((file) => ({
            file,
            identifier: generateUUID(),
            localMessageId
        }));
        const attachments = await uploadDoubaoImagesFromPage(uploadPlans);

        for (const attachment of attachments) {
            const preHandleResult = await preHandleDoubaoImage(attachment, localMessageId, preGenerateId);
            if (preHandleResult?.pre_generate_id) {
                preGenerateId = preHandleResult.pre_generate_id;
            }
        }

        contentBlocks.push({
            block_type: DOUBAO_ATTACHMENT_BLOCK,
            content: {
                attachment_block: {
                    attachments
                },
                pc_event_block: ''
            },
            block_id: generateUUID(),
            parent_id: '',
            meta_info: [],
            append_fields: []
        });
    }

    contentBlocks.push({
        block_type: 10000,
        content: {
            text_block: {
                text: prompt,
                icon_url: '',
                icon_url_dark: '',
                summary: ''
            },
            pc_event_block: ''
        },
        block_id: generateUUID(),
        parent_id: '',
        meta_info: [],
        append_fields: []
    });

    return {
        client_meta: {
            local_conversation_id: localConversationId,
            conversation_id: conversationId || '',
            bot_id: DOUBAO_BOT_ID,
            last_section_id: sectionId || '',
            last_message_index: null
        },
        messages: [
            {
                local_message_id: localMessageId,
                content_block: contentBlocks,
                message_status: 0
            }
        ],
        option: {
            send_message_scene: '',
            create_time_ms: Date.now(),
            collect_id: '',
            is_audio: false,
            answer_with_suggest: false,
            tts_switch: false,
            need_deep_think: mode.needDeepThink,
            click_clear_context: false,
            from_suggest: false,
            is_regen: false,
            is_replace: false,
            disable_sse_cache: false,
            select_text_action: '',
            resend_for_regen: false,
            scene_type: 0,
            unique_key: generateUUID(),
            start_seq: 0,
            need_create_conversation: !conversationId,
            conversation_init_option: {
                need_ack_conversation: true
            },
            regen_query_id: [],
            edit_query_id: [],
            regen_instruction: '',
            no_replace_for_regen: false,
            message_from: 0,
            shared_app_name: '',
            shared_app_id: '',
            sse_recv_event_options: {
                support_chunk_delta: true
            },
            is_ai_playground: false,
            recovery_option: {
                is_recovery: false,
                req_create_time_sec: Math.floor(Date.now() / 1000),
                append_sse_event_scene: 0
            },
            pre_generate_id: preGenerateId || undefined
        },
        ext: {
            use_deep_think: mode.useDeepThink,
            fp,
            conversation_init_option: '{"need_ack_conversation":true}',
            commerce_credit_config_enable: '0',
            sub_conv_firstmet_type: '1'
        }
    };
}

function isAuthError(message) {
    return /login|auth|401|403|cookie|doubao authentication|登录已过期|login invalid/i.test(message || '');
}

function parseEventData(raw) {
    try {
        return JSON.parse(raw);
    } catch (error) {
        return null;
    }
}

function appendDelta(accumulatedText, delta) {
    if (!delta || typeof delta !== 'string') return '';
    if (accumulatedText && delta.startsWith(accumulatedText)) {
        return delta.slice(accumulatedText.length);
    }
    return delta;
}

function extractTextFromEvent(eventName, eventData, accumulatedText, state = {}) {
    const chunks = [];
    if (!eventName || !eventData || typeof eventData !== 'object') {
        return chunks;
    }

    switch (eventName) {
        case 'CHUNK_DELTA':
            state.hasRealDelta = true;
            if (typeof eventData.text === 'string' && eventData.text) {
                chunks.push(appendDelta(accumulatedText, eventData.text));
            }
            break;
        case 'STREAM_CHUNK':
            if (state.hasRealDelta) break;
            if (Array.isArray(eventData.patch_op)) {
                for (const patch of eventData.patch_op) {
                    const content = patch?.patch_value?.tts_content;
                    if (typeof content === 'string' && content) {
                        chunks.push(content);
                    }
                }
            }
            break;
        case 'STREAM_MSG_NOTIFY':
            if (state.hasRealDelta) break;
            if (Array.isArray(eventData.content?.content_block)) {
                for (const block of eventData.content.content_block) {
                    const text = block?.content?.text_block?.text;
                    if (typeof text === 'string' && text) {
                        chunks.push(appendDelta(accumulatedText, text));
                    }
                }
            }
            break;
    }

    return chunks.filter(Boolean);
}

function extractTextFromSamanthaLine(line) {
    const chunks = [];
    if (!line) return chunks;

    try {
        const raw = JSON.parse(line);
        if (raw?.code != null && raw.code !== 0) {
            return chunks;
        }
        if (raw?.event_type === 2003) {
            return chunks;
        }
        if (raw?.event_type !== 2001 || !raw?.event_data) {
            return chunks;
        }

        const eventData = typeof raw.event_data === 'string'
            ? parseEventData(raw.event_data)
            : raw.event_data;
        if (!eventData || eventData.is_finish) {
            return chunks;
        }

        const message = eventData.message;
        const contentType = message?.content_type;
        if (!message || ![2001, 2008].includes(contentType) || !message.content) {
            return chunks;
        }

        const content = typeof message.content === 'string'
            ? parseEventData(message.content)
            : message.content;
        if (typeof content?.text === 'string' && content.text) {
            chunks.push(content.text);
        }
    } catch (error) {
        // Ignore non-Samantha lines.
    }

    return chunks;
}

function stripControlTags(text) {
    return (text || '')
        .replace(/<\/?think>/gi, '')
        .replace(/<tool_call\b[^>]*>/gi, '')
        .replace(/<\/tool_call>/gi, '');
}

function updateContextFromRawText(rawText, context) {
    if (!rawText) return;

    const conversationMatch = rawText.match(/"conversation_id"\s*:\s*"([^"]+)"/);
    const sectionMatch = rawText.match(/"section_id"\s*:\s*"([^"]+)"/);
    const messageMatch = rawText.match(/"message_id"\s*:\s*"([^"]+)"/);
    const replyMatch = rawText.match(/"reply_id"\s*:\s*"([^"]+)"/);

    if (conversationMatch?.[1]) {
        context.doubaoConversationId = conversationMatch[1];
    }
    if (sectionMatch?.[1]) {
        context.doubaoSectionId = sectionMatch[1];
    }
    if (messageMatch?.[1]) {
        context.doubaoReplyMessageId = messageMatch[1];
    } else if (replyMatch?.[1]) {
        context.doubaoReplyMessageId = replyMatch[1];
    }
}

function splitForPartialTag(text, mode) {
    if (!text) return { safe: '', carry: '' };
    const candidates = mode === 'thinking'
        ? ['</think>']
        : ['<think>', '<tool_call', '</tool_call>'];

    const lastLt = text.lastIndexOf('<');
    if (lastLt === -1) {
        return { safe: text, carry: '' };
    }

    const tail = text.slice(lastLt);
    if (candidates.some((candidate) => candidate.startsWith(tail))) {
        return {
            safe: text.slice(0, lastLt),
            carry: tail
        };
    }

    return { safe: text, carry: '' };
}

function createDoubaoChunkParser(onText, onThought) {
    let mode = 'text';
    let carry = '';

    const emit = (kind, value) => {
        if (!value) return;
        const cleaned = stripControlTags(value);
        if (!cleaned) return;
        if (kind === 'thinking') {
            onThought(cleaned);
        } else {
            onText(cleaned);
        }
    };

    const consume = (input) => {
        let working = carry + (input || '');
        carry = '';

        while (working) {
            if (mode === 'thinking') {
                const endIdx = working.indexOf('</think>');
                if (endIdx === -1) {
                    const split = splitForPartialTag(working, mode);
                    emit('thinking', split.safe);
                    carry = split.carry;
                    break;
                }
                emit('thinking', working.slice(0, endIdx));
                working = working.slice(endIdx + '</think>'.length);
                mode = 'text';
                continue;
            }

            const thinkIdx = working.indexOf('<think>');
            const toolIdx = working.search(/<tool_call\b/i);
            const closeToolIdx = working.indexOf('</tool_call>');

            const candidates = [
                { type: 'think', idx: thinkIdx, len: '<think>'.length },
                { type: 'tool', idx: toolIdx, len: null },
                { type: 'tool_close', idx: closeToolIdx, len: '</tool_call>'.length }
            ].filter((item) => item.idx >= 0).sort((a, b) => a.idx - b.idx);

            if (candidates.length === 0) {
                const split = splitForPartialTag(working, mode);
                emit('text', split.safe);
                carry = split.carry;
                break;
            }

            const first = candidates[0];
            emit('text', working.slice(0, first.idx));

            if (first.type === 'think') {
                working = working.slice(first.idx + first.len);
                mode = 'thinking';
                continue;
            }

            if (first.type === 'tool') {
                const openEnd = working.indexOf('>', first.idx);
                if (openEnd === -1) {
                    carry = working.slice(first.idx);
                    break;
                }
                working = working.slice(openEnd + 1);
                continue;
            }

            if (first.type === 'tool_close') {
                working = working.slice(first.idx + first.len);
                continue;
            }
        }
    };

    const flush = () => {
        if (!carry) return;
        emit(mode === 'thinking' ? 'thinking' : 'text', carry);
        carry = '';
    };

    return { consume, flush };
}

async function parseCompletionStream(response, conversationId, sectionId, replyMessageId, onUpdate) {
    if (!response.body) {
        throw new Error('Doubao returned an empty response body.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullText = '';
    let fullThoughts = '';
    const context = {
        doubaoConversationId: conversationId || '',
        doubaoSectionId: sectionId || '',
        doubaoReplyMessageId: replyMessageId || '',
        doubaoBotId: DOUBAO_BOT_ID
    };
    const streamState = { hasRealDelta: false };

    const updateStream = () => {
        if (onUpdate) onUpdate(fullText, fullThoughts || null);
    };

    const parser = createDoubaoChunkParser(
        (textChunk) => {
            fullText += textChunk;
            updateStream();
        },
        (thoughtChunk) => {
            fullThoughts += thoughtChunk;
            updateStream();
        }
    );

    const emitChunks = (chunks) => {
        for (const chunk of chunks) {
            if (!chunk) continue;
            parser.consume(chunk);
        }
    };

    const processSseEvent = (rawEvent) => {
        if (!rawEvent.trim()) return false;

        let eventName = '';
        let dataStr = '';
        const lines = rawEvent.split(/\r?\n/);
        for (const line of lines) {
            if (line.startsWith('event:')) {
                eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
                dataStr += (dataStr ? '\n' : '') + line.slice(5).trim();
            }
        }

        if (!dataStr) {
            return false;
        }

        const data = parseEventData(dataStr);
        if (!data) {
            return false;
        }
        updateContextFromRawText(dataStr, context);

        if (eventName === 'SSE_ACK') {
            const ack = data.ack_client_meta || {};
            context.doubaoConversationId = ack.conversation_id || context.doubaoConversationId;
            context.doubaoSectionId = ack.section_id || context.doubaoSectionId;
        } else {
            const meta = data.meta || data.message?.meta || {};
            context.doubaoConversationId = meta.conversation_id || context.doubaoConversationId;
            context.doubaoSectionId = meta.section_id || context.doubaoSectionId;
            context.doubaoReplyMessageId = meta.message_id || context.doubaoReplyMessageId;
        }

        if (eventName === 'STREAM_ERROR') {
            const errorMessage = data.error_msg || data.message || 'Doubao stream error';
            throw new Error(errorMessage);
        }

        emitChunks(extractTextFromEvent(eventName, data, fullText, streamState));
        return true;
    };

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let delimiterIndex;
        while ((delimiterIndex = buffer.search(/\r?\n\r?\n/)) !== -1) {
            const rawEvent = buffer.slice(0, delimiterIndex);
            const separatorLength = buffer.slice(delimiterIndex, delimiterIndex + 4).startsWith('\r\n\r\n') ? 4 : 2;
            buffer = buffer.slice(delimiterIndex + separatorLength);
            processSseEvent(rawEvent);
        }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
        const raw = buffer.trim();
        if (!processSseEvent(raw)) {
            const lines = raw.split(/\r?\n/);
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                const singleLineSseMatch = trimmed.match(/id:\s*\d+\s+event:\s*(\S+)\s+data:\s*(.+)/);
                if (singleLineSseMatch) {
                    const [, eventName, dataStr] = singleLineSseMatch;
                    updateContextFromRawText(dataStr, context);
                    const data = parseEventData(dataStr);
                    if (data) {
                        emitChunks(extractTextFromEvent(eventName, data, fullText, streamState));
                    }
                    continue;
                }

                updateContextFromRawText(trimmed, context);
                if (!streamState.hasRealDelta) {
                    emitChunks(extractTextFromSamanthaLine(trimmed));
                }
            }
        }
    }

    parser.flush();

    if (!fullText) {
        throw new Error('Doubao returned no parsed assistant text.');
    }

    return {
        text: fullText,
        thoughts: fullThoughts || null,
        images: [],
        context
    };
}

export class DoubaoWebProvider {
    async sendMessage(prompt, conversationId, sectionId, replyMessageId, files, signal, onUpdate, model = 'doubao-default') {
        const auth = await getDoubaoAuth({ requirePage: !!(files && files.length) });
        const payload = await buildPayload(prompt, conversationId, sectionId, replyMessageId, auth.fp, files, model);
        const endpoint = buildCompletionUrl(auth);

        const response = await fetch(endpoint, {
            method: 'POST',
            signal,
            credentials: 'include',
            headers: {
                accept: 'text/event-stream',
                'content-type': 'application/json',
                cookie: auth.cookieHeader,
                referer: 'https://www.doubao.com/chat/',
                'user-agent': navigator.userAgent || 'Mozilla/5.0',
                'agw-js-conv': 'str, str',
                'last-event-id': 'undefined'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            if (response.status === 401 || response.status === 403 || isAuthError(errorText)) {
                await clearDoubaoAuth();
            }
            throw new Error(errorText || `Doubao request failed (${response.status})`);
        }

        return await parseCompletionStream(response, conversationId, sectionId, replyMessageId, onUpdate);
    }

    async resetAuth() {
        await clearDoubaoAuth();
    }
}

export const doubaoWebProvider = new DoubaoWebProvider();
