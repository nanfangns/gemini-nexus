let cachedAuthData = null;
const DOUBAO_AUTH_STORAGE_KEY = 'doubaoAuthCache';
const DOUBAO_CHAT_URL = 'https://www.doubao.com/chat/';
const DOUBAO_BOOTSTRAP_TIMEOUT_MS = 20000;

export const DOUBAO_WEB_DEFAULTS = Object.freeze({
    aid: '497858',
    pcVersion: '3.17.0',
    versionCode: '20800',
    botId: '7338286299411103781'
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getCookieValue(cookieList, name) {
    const item = (cookieList || []).find((cookie) => cookie.name === name);
    return item ? item.value : '';
}

function normalizeCookieHeader(cookieList) {
    return (cookieList || []).map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

function appendCookie(cookieHeader, name, value) {
    if (!name || !value) return cookieHeader || '';
    const parts = (cookieHeader || '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !part.startsWith(`${name}=`));
    parts.push(`${name}=${value}`);
    return parts.join('; ');
}

function safeJsonParse(raw, fallback = {}) {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw);
    } catch (error) {
        return fallback;
    }
}

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function dataUrlToBlob(dataUrl) {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream';
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
    }
    return new Blob([array], { type: mime });
}

function hasCompleteAuth(auth) {
    return !!(
        auth &&
        auth.cookieHeader &&
        auth.fp &&
        auth.deviceId &&
        auth.webId &&
        auth.teaUuid &&
        auth.aid &&
        auth.pcVersion &&
        auth.versionCode
    );
}

async function persistDoubaoAuth(auth) {
    await chrome.storage.local.set({ [DOUBAO_AUTH_STORAGE_KEY]: auth });
}

async function restoreDoubaoAuth() {
    const stored = await chrome.storage.local.get([DOUBAO_AUTH_STORAGE_KEY]);
    return stored[DOUBAO_AUTH_STORAGE_KEY] || null;
}

function parseBootstrapConfig(html) {
    const fallback = {
        aid: DOUBAO_WEB_DEFAULTS.aid,
        pcVersion: DOUBAO_WEB_DEFAULTS.pcVersion,
        versionCode: DOUBAO_WEB_DEFAULTS.versionCode
    };

    if (!html) return fallback;

    const marker = 'window._ROUTER_DATA = ';
    const markerIndex = html.indexOf(marker);
    if (markerIndex === -1) return fallback;

    const scriptEndIndex = html.indexOf('</script>', markerIndex);
    if (scriptEndIndex === -1) return fallback;

    const rawJson = html
        .slice(markerIndex + marker.length, scriptEndIndex)
        .trim()
        .replace(/;$/, '');

    const routerData = safeJsonParse(rawJson, null);
    const chatLayout = routerData?.loaderData?.chat_layout?.chat_layout || {};
    const aid = String(chatLayout.aid || fallback.aid);
    const pcVersion = String(chatLayout.pc_version || fallback.pcVersion);

    return {
        aid,
        pcVersion,
        versionCode: fallback.versionCode
    };
}

async function fetchDoubaoBootstrapConfig(cookieHeader) {
    const response = await fetch(DOUBAO_CHAT_URL, {
        method: 'GET',
        credentials: 'include',
        headers: {
            cookie: cookieHeader,
            referer: DOUBAO_CHAT_URL,
            'user-agent': navigator.userAgent || 'Mozilla/5.0'
        }
    });

    if (!response.ok) {
        throw new Error(`Doubao bootstrap config fetch failed (${response.status})`);
    }

    const html = await response.text();
    return parseBootstrapConfig(html);
}

async function requestDoubaoDeviceIdFromMcs(aid) {
    const response = await fetch('https://mcs.doubao.com/webid', {
        method: 'POST',
        credentials: 'include',
        headers: {
            'content-type': 'application/json; charset=UTF-8',
            referer: 'https://www.doubao.com/',
            'user-agent': navigator.userAgent || 'Mozilla/5.0'
        },
        body: JSON.stringify({
            app_id: Number(aid),
            url: DOUBAO_CHAT_URL,
            user_agent: navigator.userAgent || 'Mozilla/5.0',
            referer: '',
            user_unique_id: ''
        })
    });

    if (!response.ok) {
        throw new Error(`Doubao mcs webid request failed (${response.status})`);
    }

    const json = await response.json();
    const deviceId = String(json?.web_id || '');
    if (!deviceId || deviceId === '0') {
        throw new Error('Doubao device bootstrap returned no device_id.');
    }
    return deviceId;
}

function buildCommonQuery(config, auth = {}) {
    const url = new URL(DOUBAO_CHAT_URL);
    url.search = '';
    url.searchParams.set('version_code', String(config.versionCode || DOUBAO_WEB_DEFAULTS.versionCode));
    url.searchParams.set('language', 'zh');
    url.searchParams.set('device_platform', 'web');
    url.searchParams.set('aid', String(config.aid || DOUBAO_WEB_DEFAULTS.aid));
    url.searchParams.set('real_aid', String(config.aid || DOUBAO_WEB_DEFAULTS.aid));
    url.searchParams.set('pkg_type', 'release_version');
    url.searchParams.set('device_id', auth.deviceId || '');
    url.searchParams.set('pc_version', String(config.pcVersion || DOUBAO_WEB_DEFAULTS.pcVersion));
    if (auth.webId) url.searchParams.set('web_id', auth.webId);
    if (auth.teaUuid) url.searchParams.set('tea_uuid', auth.teaUuid);
    url.searchParams.set('region', '');
    url.searchParams.set('sys_region', '');
    url.searchParams.set('samantha_web', '1');
    url.searchParams.set('use-olympus-account', '1');
    url.searchParams.set('web_tab_id', generateUUID());
    return url.searchParams;
}

async function requestDoubaoWebId(config, cookieHeader) {
    const url = new URL('https://www.doubao.com/alice/user/get_web_anon_id');
    buildCommonQuery(config).forEach((value, key) => url.searchParams.set(key, value));

    const response = await fetch(url.toString(), {
        method: 'POST',
        credentials: 'include',
        headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            cookie: cookieHeader,
            referer: DOUBAO_CHAT_URL,
            'user-agent': navigator.userAgent || 'Mozilla/5.0',
            'agw-js-conv': 'str'
        },
        body: '{}'
    });

    if (!response.ok) {
        throw new Error(`Doubao web anon id bootstrap failed (${response.status})`);
    }

    const json = await response.json();
    if (json?.code !== 0 || !json?.web_id) {
        throw new Error('Doubao web anon id bootstrap returned no web_id.');
    }

    return String(json.web_id);
}

async function requestDoubaoLaunch(config, auth, cookieHeader) {
    const url = new URL('https://www.doubao.com/alice/user/launch');
    buildCommonQuery(config, auth).forEach((value, key) => url.searchParams.set(key, value));

    const response = await fetch(url.toString(), {
        method: 'POST',
        credentials: 'include',
        headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/json',
            cookie: cookieHeader,
            referer: DOUBAO_CHAT_URL,
            'user-agent': navigator.userAgent || 'Mozilla/5.0',
            'agw-js-conv': 'str'
        },
        body: '{}'
    });

    if (!response.ok) {
        throw new Error(`Doubao launch bootstrap failed (${response.status})`);
    }

    const json = await response.json();
    if (json?.code !== 0) {
        throw new Error(json?.msg || 'Doubao launch bootstrap failed.');
    }

    return json?.data?.config || {};
}

async function requestDoubaoAuthWithoutPage() {
    const cookieList = await new Promise((resolve) => {
        chrome.cookies.getAll({ domain: '.doubao.com' }, (cookies) => resolve(cookies || []));
    });

    const initialCookieHeader = normalizeCookieHeader(cookieList);
    const fp = getCookieValue(cookieList, 's_v_web_id');
    if (!initialCookieHeader || !fp) {
        throw new Error('Doubao authentication failed. Please log in to doubao.com first.');
    }

    const bootstrapConfig = await fetchDoubaoBootstrapConfig(initialCookieHeader);
    const deviceId = await requestDoubaoDeviceIdFromMcs(bootstrapConfig.aid);
    const webId = await requestDoubaoWebId(bootstrapConfig, initialCookieHeader);
    const launchConfig = await requestDoubaoLaunch(
        bootstrapConfig,
        { webId, teaUuid: webId, deviceId: '' },
        initialCookieHeader
    );

    const ttwid = String(launchConfig?.ttwid || '');
    const launchWebId = String(launchConfig?.web_id || webId || '');
    const finalCookieHeader = appendCookie(
        ttwid ? initialCookieHeader : initialCookieHeader,
        'ttwid',
        ttwid
    );

    cachedAuthData = {
        cookieList,
        cookieHeader: finalCookieHeader,
        fp,
        deviceId,
        webId: launchWebId,
        teaUuid: launchWebId,
        ttwid,
        aid: bootstrapConfig.aid,
        pcVersion: bootstrapConfig.pcVersion,
        versionCode: bootstrapConfig.versionCode,
        launchConfig,
        timestamp: Date.now(),
        pageLess: true,
        tabId: null,
        bootstrapWindowId: null,
        managedByExtension: false
    };

    if (!hasCompleteAuth(cachedAuthData)) {
        throw new Error('Doubao authentication bootstrap returned incomplete credentials.');
    }

    if (ttwid) {
        try {
            await chrome.cookies.set({
                url: 'https://www.doubao.com/',
                name: 'ttwid',
                value: ttwid,
                domain: '.doubao.com',
                path: '/',
                secure: true,
                sameSite: 'no_restriction',
                expirationDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
            });
        } catch (error) {
            // Non-fatal: completion may still work if the browser already has ttwid.
        }
    }

    await persistDoubaoAuth(cachedAuthData);
    return cachedAuthData;
}

async function queryDoubaoTab() {
    const tabs = await new Promise((resolve) => {
        chrome.tabs.query({ url: '*://www.doubao.com/chat/*' }, (results) => resolve(results || []));
    });

    if (!tabs.length) {
        const fallbackTabs = await new Promise((resolve) => {
            chrome.tabs.query({ url: '*://doubao.com/chat/*' }, (results) => resolve(results || []));
        });
        if (fallbackTabs.length) {
            return fallbackTabs[0];
        }
    }

    if (!tabs.length) {
        const generalTabs = await new Promise((resolve) => {
            chrome.tabs.query({ url: '*://www.doubao.com/*' }, (results) => resolve(results || []));
        });
        if (generalTabs.length) {
            return generalTabs[0];
        }
    }

    if (!tabs.length) {
        const bootstrapWindow = await chrome.windows.create({
            url: DOUBAO_CHAT_URL,
            type: 'popup',
            focused: false,
            state: 'minimized',
            width: 1280,
            height: 800
        });

        const bootstrapTab = bootstrapWindow?.tabs?.[0];
        if (!bootstrapTab?.id) {
            throw new Error('Doubao authentication failed. Unable to bootstrap doubao chat page.');
        }

        return {
            ...bootstrapTab,
            bootstrapWindowId: bootstrapWindow.id,
            managedByExtension: true
        };
    }

    return tabs[0];
}

async function waitForTabComplete(tabId, timeoutMs = DOUBAO_BOOTSTRAP_TIMEOUT_MS) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        try {
            const tab = await chrome.tabs.get(tabId);
            if (tab?.status === 'complete' && /^https:\/\/www\.doubao\.com\//.test(tab.url || '')) {
                return tab;
            }
        } catch (error) {
            throw new Error('Doubao bootstrap tab was closed before initialization completed.');
        }
        await delay(500);
    }
    throw new Error('Timed out waiting for Doubao bootstrap tab to finish loading.');
}

async function readDoubaoIdsFromPage(tabId) {
    const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
            const safeParseLocal = (raw, fallback = {}) => {
                if (!raw) return fallback;
                try {
                    return JSON.parse(raw);
                } catch (error) {
                    return fallback;
                }
            };
            const chatLayout = window._ROUTER_DATA?.loaderData?.chat_layout?.chat_layout || {};
            const aid = String(chatLayout.aid || 497858);
            const pcVersion = String(chatLayout.pc_version || '3.17.0');
            const samantha = safeParseLocal(localStorage.getItem('samantha_web_web_id'));
            const tea = safeParseLocal(localStorage.getItem(`__tea_cache_tokens_${aid}`));
            const webId = tea.web_id || samantha.web_id || '';
            return {
                deviceId: samantha.web_id || webId,
                webId,
                teaUuid: webId,
                aid,
                pcVersion,
                versionCode: '20800'
            };
        }
    });

    return results?.[0]?.result || {
        deviceId: '',
        webId: '',
        teaUuid: '',
        aid: DOUBAO_WEB_DEFAULTS.aid,
        pcVersion: DOUBAO_WEB_DEFAULTS.pcVersion,
        versionCode: DOUBAO_WEB_DEFAULTS.versionCode
    };
}

async function waitForDoubaoIds(tabId, timeoutMs = DOUBAO_BOOTSTRAP_TIMEOUT_MS) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        const ids = await readDoubaoIdsFromPage(tabId);
        if (ids?.deviceId && ids?.webId && ids?.teaUuid) {
            return ids;
        }
        await delay(500);
    }
    return await readDoubaoIdsFromPage(tabId);
}

async function isTabAlive(tabId) {
    if (!tabId) return false;
    try {
        await chrome.tabs.get(tabId);
        return true;
    } catch (error) {
        return false;
    }
}

export async function requestDoubaoAuthFromPage() {
    const tab = await queryDoubaoTab();
    const tabId = tab.id;
    await waitForTabComplete(tabId);

    const cookieList = await new Promise((resolve) => {
        chrome.cookies.getAll({ domain: '.doubao.com' }, (cookies) => resolve(cookies || []));
    });

    const ids = await waitForDoubaoIds(tabId);
    const fp = getCookieValue(cookieList, 's_v_web_id');
    const cookieHeader = normalizeCookieHeader(cookieList);

    cachedAuthData = {
        cookieList,
        cookieHeader,
        fp,
        deviceId: ids.deviceId || '',
        webId: ids.webId || '',
        teaUuid: ids.teaUuid || '',
        aid: ids.aid || DOUBAO_WEB_DEFAULTS.aid,
        pcVersion: ids.pcVersion || DOUBAO_WEB_DEFAULTS.pcVersion,
        versionCode: ids.versionCode || DOUBAO_WEB_DEFAULTS.versionCode,
        timestamp: Date.now(),
        tabId,
        bootstrapWindowId: tab.bootstrapWindowId || null,
        managedByExtension: !!tab.managedByExtension,
        pageLess: false
    };

    if (!hasCompleteAuth(cachedAuthData)) {
        throw new Error('Doubao authentication failed. Please ensure Doubao is open and fully logged in.');
    }

    await persistDoubaoAuth(cachedAuthData);
    return cachedAuthData;
}

export async function uploadDoubaoImage(file) {
    const auth = await requestDoubaoAuthFromPage();
    const extension = (file.name && file.name.includes('.')) ? file.name.slice(file.name.lastIndexOf('.')) : '.png';
    const fileSize = Math.ceil((file.base64.length * 3) / 4);

    const applyUrl = new URL('https://www.doubao.com/top/v1');
    applyUrl.searchParams.set('Action', 'ApplyImageUpload');
    applyUrl.searchParams.set('Version', '2018-08-01');
    applyUrl.searchParams.set('ServiceId', 'a9rns2rl98');
    applyUrl.searchParams.set('NeedFallback', 'true');
    applyUrl.searchParams.set('FileSize', String(fileSize));
    applyUrl.searchParams.set('FileExtension', extension);
    applyUrl.searchParams.set('s', Math.random().toString(36).slice(2));

    const applyResponse = await fetch(applyUrl.toString(), {
        method: 'GET',
        credentials: 'include',
        headers: {
            cookie: auth.cookieHeader,
            'user-agent': navigator.userAgent || 'Mozilla/5.0',
            referer: DOUBAO_CHAT_URL
        }
    });

    if (!applyResponse.ok) {
        throw new Error(`Doubao image upload apply failed (${applyResponse.status})`);
    }

    const applyJson = await applyResponse.json();
    const uploadAddress = applyJson?.Result?.UploadAddress;
    const storeInfo = uploadAddress?.StoreInfos?.[0];
    const uploadHost = uploadAddress?.UploadHosts?.[0];
    const sessionKey = uploadAddress?.SessionKey;

    if (!storeInfo || !uploadHost || !sessionKey) {
        throw new Error('Doubao image upload apply returned incomplete data.');
    }

    const blob = dataUrlToBlob(file.base64);
    const uploadUrl = `https://${uploadHost}/upload/v1/${storeInfo.StoreUri}`;
    const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
            authorization: storeInfo.Auth,
            'content-type': 'application/octet-stream',
            'content-disposition': `attachment; filename="${file.name || 'image.png'}"`,
            'x-storage-u': auth.webId,
            referer: 'https://www.doubao.com/'
        },
        body: blob
    });

    if (!uploadResponse.ok) {
        throw new Error(`Doubao image upload failed (${uploadResponse.status})`);
    }

    const commitUrl = new URL('https://www.doubao.com/top/v1');
    commitUrl.searchParams.set('Action', 'CommitImageUpload');
    commitUrl.searchParams.set('Version', '2018-08-01');
    commitUrl.searchParams.set('ServiceId', 'a9rns2rl98');

    const commitResponse = await fetch(commitUrl.toString(), {
        method: 'POST',
        credentials: 'include',
        headers: {
            'content-type': 'application/json',
            cookie: auth.cookieHeader,
            'user-agent': navigator.userAgent || 'Mozilla/5.0',
            referer: DOUBAO_CHAT_URL
        },
        body: JSON.stringify({ SessionKey: sessionKey })
    });

    if (!commitResponse.ok) {
        throw new Error(`Doubao image upload commit failed (${commitResponse.status})`);
    }

    const commitJson = await commitResponse.json();
    const pluginResult = commitJson?.Result?.PluginResult?.[0];
    const uri = pluginResult?.ImageUri || commitJson?.Result?.Results?.[0]?.Uri || '';

    if (!uri) {
        throw new Error('Doubao image upload commit returned no image uri.');
    }

    return {
        type: 1,
        identifier: generateUUID(),
        image: {
            name: file.name || 'image.png',
            uri,
            image_ori: {
                url: '',
                width: pluginResult?.ImageWidth || 0,
                height: pluginResult?.ImageHeight || 0,
                format: '',
                url_formats: {}
            }
        },
        parse_state: 0,
        review_state: 1,
        upload_status: 1,
        progress: 100,
        src: ''
    };
}

export async function uploadDoubaoImagesFromPage(files) {
    const auth = await getDoubaoAuth({ requirePage: true });
    if (!auth?.tabId) {
        throw new Error('Doubao image upload requires a bootstrap Doubao chat page.');
    }

    const results = await chrome.scripting.executeScript({
        target: { tabId: auth.tabId },
        world: 'MAIN',
        args: [files],
        func: async (inputFiles) => {
            const dataUrlToBlobLocal = (dataUrl) => {
                const [header, base64] = dataUrl.split(',');
                const mime = header.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream';
                const binary = atob(base64);
                const array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    array[i] = binary.charCodeAt(i);
                }
                return new Blob([array], { type: mime });
            };

            const buildId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });

            const uploadOne = async (inputFile) => {
                const file = inputFile?.file || inputFile;
                const identifier = inputFile?.identifier || buildId();
                const extension = (file.name && file.name.includes('.')) ? file.name.slice(file.name.lastIndexOf('.')) : '.png';
                const base64Payload = file.base64.split(',')[1] || '';
                const fileSize = Math.ceil((base64Payload.length * 3) / 4);

                const applyUrl = new URL('https://www.doubao.com/top/v1');
                applyUrl.searchParams.set('Action', 'ApplyImageUpload');
                applyUrl.searchParams.set('Version', '2018-08-01');
                applyUrl.searchParams.set('ServiceId', 'a9rns2rl98');
                applyUrl.searchParams.set('NeedFallback', 'true');
                applyUrl.searchParams.set('FileSize', String(fileSize));
                applyUrl.searchParams.set('FileExtension', extension);
                applyUrl.searchParams.set('s', Math.random().toString(36).slice(2));

                const applyResp = await fetch(applyUrl.toString(), {
                    method: 'GET',
                    credentials: 'include'
                });
                if (!applyResp.ok) {
                    throw new Error(`ApplyImageUpload failed (${applyResp.status})`);
                }

                const applyJson = await applyResp.json();
                const uploadAddress = applyJson?.Result?.UploadAddress;
                const storeInfo = uploadAddress?.StoreInfos?.[0];
                const uploadHost = uploadAddress?.UploadHosts?.[0];
                const sessionKey = uploadAddress?.SessionKey;
                if (!storeInfo || !uploadHost || !sessionKey) {
                    throw new Error('ApplyImageUpload returned incomplete data');
                }

                const tea = safeJsonParse(localStorage.getItem('__tea_cache_tokens_497858'));
                const webId = tea.web_id || '';
                const blob = dataUrlToBlobLocal(file.base64);
                const uploadResp = await fetch(`https://${uploadHost}/upload/v1/${storeInfo.StoreUri}`, {
                    method: 'POST',
                    headers: {
                        authorization: storeInfo.Auth,
                        'content-type': 'application/octet-stream',
                        'content-disposition': `attachment; filename="${file.name || 'image.png'}"`,
                        'x-storage-u': webId,
                        referer: 'https://www.doubao.com/'
                    },
                    body: blob
                });
                if (!uploadResp.ok) {
                    throw new Error(`TOS upload failed (${uploadResp.status})`);
                }

                const commitUrl = new URL('https://www.doubao.com/top/v1');
                commitUrl.searchParams.set('Action', 'CommitImageUpload');
                commitUrl.searchParams.set('Version', '2018-08-01');
                commitUrl.searchParams.set('ServiceId', 'a9rns2rl98');

                const commitResp = await fetch(commitUrl.toString(), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ SessionKey: sessionKey })
                });
                if (!commitResp.ok) {
                    throw new Error(`CommitImageUpload failed (${commitResp.status})`);
                }

                const commitJson = await commitResp.json();
                const pluginResult = commitJson?.Result?.PluginResult?.[0];
                const uri = pluginResult?.ImageUri || commitJson?.Result?.Results?.[0]?.Uri || '';
                if (!uri) {
                    throw new Error('CommitImageUpload returned no image uri');
                }

                return {
                    type: 1,
                    identifier,
                    image: {
                        name: file.name || 'image.png',
                        uri,
                        image_ori: {
                            url: '',
                            width: pluginResult?.ImageWidth || 0,
                            height: pluginResult?.ImageHeight || 0,
                            format: '',
                            url_formats: {}
                        }
                    },
                    parse_state: 0,
                    review_state: 1,
                    upload_status: 1,
                    progress: 100,
                    src: ''
                };
            };

            const attachments = [];
            for (const file of inputFiles || []) {
                attachments.push(await uploadOne(file));
            }
            return attachments;
        }
    });

    return results?.[0]?.result || [];
}

export async function preHandleDoubaoImage(attachment, localMessageId, preGenerateId = '') {
    const auth = await getDoubaoAuth({ requirePage: true });
    if (!auth?.tabId) {
        throw new Error('Doubao image upload requires a bootstrap Doubao chat page.');
    }

    const imageKey = attachment?.image?.uri || '';
    const identifier = attachment?.identifier || generateUUID();
    const results = await chrome.scripting.executeScript({
        target: { tabId: auth.tabId },
        world: 'MAIN',
        args: [imageKey, identifier, localMessageId, preGenerateId, {
            aid: auth.aid || DOUBAO_WEB_DEFAULTS.aid,
            pcVersion: auth.pcVersion || DOUBAO_WEB_DEFAULTS.pcVersion,
            versionCode: auth.versionCode || DOUBAO_WEB_DEFAULTS.versionCode,
            botId: DOUBAO_WEB_DEFAULTS.botId
        }],
        func: async (imageKeyArg, identifierArg, messageId, currentPreGenerateId, pageConfig) => {
            const tea = safeJsonParse(localStorage.getItem(`__tea_cache_tokens_${pageConfig?.aid || 497858}`));
            const samantha = safeJsonParse(localStorage.getItem('samantha_web_web_id'));
            const webTabId = crypto.randomUUID();
            const url = new URL('https://www.doubao.com/alice/message/pre_handle_v2_without_conv');
            url.searchParams.set('version_code', String(pageConfig?.versionCode || '20800'));
            url.searchParams.set('language', 'zh');
            url.searchParams.set('device_platform', 'web');
            url.searchParams.set('aid', String(pageConfig?.aid || '497858'));
            url.searchParams.set('real_aid', String(pageConfig?.aid || '497858'));
            url.searchParams.set('pkg_type', 'release_version');
            url.searchParams.set('device_id', samantha.web_id || tea.web_id || '');
            url.searchParams.set('pc_version', String(pageConfig?.pcVersion || '3.17.0'));
            url.searchParams.set('web_id', tea.web_id || samantha.web_id || '');
            url.searchParams.set('tea_uuid', tea.web_id || samantha.web_id || '');
            url.searchParams.set('region', '');
            url.searchParams.set('sys_region', '');
            url.searchParams.set('samantha_web', '1');
            url.searchParams.set('use-olympus-account', '1');
            url.searchParams.set('web_tab_id', webTabId);

            const body = {
                uplink_entity: {
                    entity_type: 2,
                    entity_content: {
                        image: {
                            key: imageKeyArg
                        }
                    },
                    identifier: identifierArg
                },
                bot_id: pageConfig?.botId || '7338286299411103781',
                local_message_id: messageId
            };

            if (currentPreGenerateId) {
                body.pre_generate_id = currentPreGenerateId;
            }

            const resp = await fetch(url.toString(), {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(body)
            });

            const json = await resp.json();
            return {
                ok: resp.ok,
                status: resp.status,
                json
            };
        }
    });

    const result = results?.[0]?.result;
    if (!result?.ok || result?.json?.code !== 0) {
        throw new Error('Doubao image pre-handle failed.');
    }
    return result.json?.data || null;
}

export async function getDoubaoAuth(options = {}) {
    const requirePage = options.requirePage === true;

    if (cachedAuthData && Date.now() - cachedAuthData.timestamp < 30 * 60 * 1000 && hasCompleteAuth(cachedAuthData)) {
        if (!requirePage) {
            return cachedAuthData;
        }
        if (await isTabAlive(cachedAuthData.tabId)) {
            return cachedAuthData;
        }
    }

    const restoredAuth = await restoreDoubaoAuth();
    if (restoredAuth && Date.now() - restoredAuth.timestamp < 30 * 60 * 1000 && hasCompleteAuth(restoredAuth)) {
        restoredAuth.aid = restoredAuth.aid || DOUBAO_WEB_DEFAULTS.aid;
        restoredAuth.pcVersion = restoredAuth.pcVersion || DOUBAO_WEB_DEFAULTS.pcVersion;
        restoredAuth.versionCode = restoredAuth.versionCode || DOUBAO_WEB_DEFAULTS.versionCode;
        if (!requirePage || await isTabAlive(restoredAuth.tabId)) {
            cachedAuthData = restoredAuth;
            return cachedAuthData;
        }
    }

    try {
        if (!requirePage) {
            return await requestDoubaoAuthWithoutPage();
        }
    } catch (error) {
        // Fall through to page bootstrap when direct bootstrap fails.
    }

    return await requestDoubaoAuthFromPage();
}

export function hasDoubaoAuth() {
    return hasCompleteAuth(cachedAuthData);
}

export async function clearDoubaoAuth() {
    if (cachedAuthData?.managedByExtension) {
        try {
            if (cachedAuthData.bootstrapWindowId) {
                await chrome.windows.remove(cachedAuthData.bootstrapWindowId);
            } else if (cachedAuthData.tabId) {
                await chrome.tabs.remove(cachedAuthData.tabId);
            }
        } catch (error) {
            // Ignore cleanup failures for extension-managed bootstrap windows/tabs.
        }
    }

    cachedAuthData = null;
    await chrome.storage.local.remove([DOUBAO_AUTH_STORAGE_KEY]);
}
