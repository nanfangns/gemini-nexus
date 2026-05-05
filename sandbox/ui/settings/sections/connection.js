
// sandbox/ui/settings/sections/connection.js
import { CustomDropdown } from '../../dropdown.js';

function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export class ConnectionSection {
    constructor() {
        this.elements = {};
        this.dropdowns = {};
        this._activeProtocol = null;  // 'openai' | 'anthropic' | null

        // profiles[protocol] = [{ id, name, baseUrl, apiKey, model }, ...]
        this.profiles = { openai: [], anthropic: [] };
        // which profile is active (by id)
        this.activeProfileIds = { openai: null, anthropic: null };

        this.queryElements();
        this.bindEvents();
    }

    queryElements() {
        const get = (id) => document.getElementById(id);
        this.elements = {
            providerWrapper: get('provider-select-wrapper'),
            providerTrigger: get('provider-select-trigger'),
            providerDropdown: get('provider-select-dropdown'),
            providerSelect: get('provider-select'),
            thinkingWrapper: get('thinking-level-wrapper'),
            thinkingTrigger: get('thinking-level-trigger'),
            thinkingDropdown: get('thinking-level-dropdown'),
            thinkingSelect: get('thinking-level-select'),
            apiKeyContainer: get('api-key-container'),
            apiKeyInput: get('api-key-input'),
            officialFields: get('official-fields'),
            openaiFields: get('openai-fields'),
            anthropicFields: get('anthropic-fields'),
            xaiFields: get('xai-fields'),
            openaiBaseUrl: get('openai-base-url'),
            openaiApiKey: get('openai-api-key'),
            openaiModel: get('openai-model'),
            openaiProfileSelect: get('openai-profile-select'),
            openaiProfileAdd: get('openai-profile-add'),
            openaiProfileDel: get('openai-profile-del'),
            anthropicBaseUrl: get('anthropic-base-url'),
            anthropicApiKey: get('anthropic-api-key'),
            anthropicModel: get('anthropic-model'),
            anthropicProfileSelect: get('anthropic-profile-select'),
            anthropicProfileAdd: get('anthropic-profile-add'),
            anthropicProfileDel: get('anthropic-profile-del'),
            xaiApiKey: get('xai-api-key'),
            xaiModel: get('xai-model'),
        };
    }

    bindEvents() {
        const { providerWrapper, providerTrigger, providerDropdown, providerSelect,
                thinkingWrapper, thinkingTrigger, thinkingDropdown, thinkingSelect } = this.elements;

        this._bindKeyToggles();
        this._bindFetchModels();
        this._bindProfileSelectors();

        if (providerWrapper && providerTrigger && providerDropdown && providerSelect) {
            this.dropdowns.provider = new CustomDropdown({
                wrapper: providerWrapper,
                trigger: providerTrigger,
                dropdown: providerDropdown,
                nativeSelect: providerSelect,
                options: [
                    { val: 'web', txt: 'Gemini Web Client (Free)' },
                    { val: 'official', txt: 'Google Gemini API' },
                    { val: 'openai', txt: 'OpenAI Compatible API' },
                    { val: 'anthropic', txt: 'Anthropic Messages API (Native)' },
                    { val: 'xai', txt: 'xAI Grok API' },
                    { val: 'doubao_web', txt: 'Doubao Web (Free)' }
                ],
                onSelect: (value) => this.updateVisibility(value)
            });
        }

        if (thinkingWrapper && thinkingTrigger && thinkingDropdown && thinkingSelect) {
            this.dropdowns.thinking = new CustomDropdown({
                wrapper: thinkingWrapper,
                trigger: thinkingTrigger,
                dropdown: thinkingDropdown,
                nativeSelect: thinkingSelect,
                options: [
                    { val: 'minimal', txt: 'Minimal (Flash Only)' },
                    { val: 'low', txt: 'Low (Faster)' },
                    { val: 'medium', txt: 'Medium (Balanced)' },
                    { val: 'high', txt: 'High (Deep Reasoning)' }
                ],
                onSelect: () => {}
            });
        }
    }

    // ── profile data helpers ──────────────────────────────────────────────

    _getActiveProfile(protocol) {
        const id = this.activeProfileIds[protocol];
        return this.profiles[protocol].find(p => p.id === id) || null;
    }

    _syncFieldsToProfile(protocol) {
        const p = this._getActiveProfile(protocol);
        if (!p) return;
        const els = this.elements;
        if (protocol === 'openai') {
            p.baseUrl = els.openaiBaseUrl ? els.openaiBaseUrl.value.trim() : '';
            p.apiKey  = els.openaiApiKey  ? els.openaiApiKey.value.trim()  : '';
            p.model   = els.openaiModel   ? els.openaiModel.value.trim()   : '';
        } else {
            p.baseUrl = els.anthropicBaseUrl ? els.anthropicBaseUrl.value.trim() : '';
            p.apiKey  = els.anthropicApiKey  ? els.anthropicApiKey.value.trim()  : '';
            p.model   = els.anthropicModel   ? els.anthropicModel.value.trim()   : '';
        }
    }

    _loadProfileToFields(protocol) {
        const p = this._getActiveProfile(protocol);
        if (!p) return;
        const els = this.elements;
        if (protocol === 'openai') {
            if (els.openaiBaseUrl) els.openaiBaseUrl.value = p.baseUrl || '';
            if (els.openaiApiKey)  els.openaiApiKey.value  = p.apiKey  || '';
            if (els.openaiModel)   els.openaiModel.value   = p.model   || '';
        } else {
            if (els.anthropicBaseUrl) els.anthropicBaseUrl.value = p.baseUrl || '';
            if (els.anthropicApiKey)  els.anthropicApiKey.value  = p.apiKey  || '';
            if (els.anthropicModel)   els.anthropicModel.value   = p.model   || '';
        }
    }

    // ── profile selector rendering ────────────────────────────────────────

    _renderProfileSelector(protocol) {
        const selectEl = this.elements[`${protocol}ProfileSelect`];
        const delBtn   = this.elements[`${protocol}ProfileDel`];
        if (!selectEl) return;

        selectEl.innerHTML = '';
        this.profiles[protocol].forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            selectEl.appendChild(opt);
        });

        selectEl.value = this.activeProfileIds[protocol] || '';

        if (delBtn) {
            delBtn.disabled = this.profiles[protocol].length <= 1;
            delBtn.style.opacity = this.profiles[protocol].length <= 1 ? '0.35' : '';
        }
    }

    // ── profile actions ───────────────────────────────────────────────────

    _addProfile(protocol) {
        this._syncFieldsToProfile(protocol);
        const list = this.profiles[protocol];
        const idx  = list.length + 1;
        const p    = { id: _uid(), name: `${idx}`, baseUrl: '', apiKey: '', model: '' };
        list.push(p);
        this.activeProfileIds[protocol] = p.id;

        this._renderProfileSelector(protocol);
        this._loadProfileToFields(protocol);
    }

    _deleteProfile(protocol) {
        const list = this.profiles[protocol];
        if (list.length <= 1) return;

        const target = this._getActiveProfile(protocol);
        if (!target) return;
        if (!confirm(`Delete "${target.name}"?`)) return;

        this._syncFieldsToProfile(protocol);
        const idx = list.findIndex(p => p.id === target.id);
        list.splice(idx, 1);

        // switch to neighbour, or first
        const next = list[Math.min(idx, list.length - 1)];
        this.activeProfileIds[protocol] = next.id;

        this._renderProfileSelector(protocol);
        this._loadProfileToFields(protocol);
    }

    _switchProfile(protocol, profileId) {
        if (protocol !== this._activeProtocol) return;
        this._syncFieldsToProfile(protocol);
        this.activeProfileIds[protocol] = profileId;
        this._loadProfileToFields(protocol);
    }

    _bindProfileSelectors() {
        ['openai', 'anthropic'].forEach(protocol => {
            const selectEl = this.elements[`${protocol}ProfileSelect`];
            const addBtn   = this.elements[`${protocol}ProfileAdd`];
            const delBtn   = this.elements[`${protocol}ProfileDel`];

            if (selectEl) selectEl.addEventListener('change', () => this._switchProfile(protocol, selectEl.value));
            if (addBtn)   addBtn.addEventListener('click',   () => this._addProfile(protocol));
            if (delBtn)   delBtn.addEventListener('click',   () => this._deleteProfile(protocol));
        });
    }

    // ── data in / out ─────────────────────────────────────────────────────

    setData(data) {
        const { apiKeyInput, thinkingSelect,
                openaiBaseUrl, openaiApiKey, openaiModel,
                anthropicBaseUrl, anthropicApiKey, anthropicModel,
                xaiApiKey, xaiModel } = this.elements;

        // Migrate old flat values into profiles if profiles are empty
        this._ensureProfiles(data);

        // Provider
        const provider = data.provider || 'web';
        if (this.dropdowns.provider) this.dropdowns.provider.setValue(provider);
        this.updateVisibility(provider);

        // Official
        if (apiKeyInput) apiKeyInput.value = data.apiKey || "";
        const thinking = data.thinkingLevel || "low";
        if (this.dropdowns.thinking) this.dropdowns.thinking.setValue(thinking);

        // Load active profile values into DOM
        this._loadProfileToFields('openai');
        this._loadProfileToFields('anthropic');

        // xAI (single)
        if (xaiApiKey) xaiApiKey.value = data.xaiApiKey || "";
        if (xaiModel)  xaiModel.value  = data.xaiModel  || "";
    }

    getData() {
        // Flush current profile fields before reading
        if (this._activeProtocol) this._syncFieldsToProfile(this._activeProtocol);

        const { providerSelect, apiKeyInput, thinkingSelect,
                openaiBaseUrl, openaiApiKey, openaiModel,
                anthropicBaseUrl, anthropicApiKey, anthropicModel,
                xaiApiKey, xaiModel } = this.elements;

        return {
            provider: providerSelect ? providerSelect.value : 'web',
            apiKey: apiKeyInput ? apiKeyInput.value.trim() : "",
            thinkingLevel: thinkingSelect ? thinkingSelect.value : "low",
            // flatten active profile into legacy fields
            openaiBaseUrl: openaiBaseUrl ? openaiBaseUrl.value.trim() : "",
            openaiApiKey: openaiApiKey ? openaiApiKey.value.trim() : "",
            openaiModel: openaiModel ? openaiModel.value.trim() : "",
            anthropicBaseUrl: anthropicBaseUrl ? anthropicBaseUrl.value.trim() : "",
            anthropicApiKey: anthropicApiKey ? anthropicApiKey.value.trim() : "",
            anthropicModel: anthropicModel ? anthropicModel.value.trim() : "",
            xaiApiKey: xaiApiKey ? xaiApiKey.value.trim() : "",
            xaiModel: xaiModel ? xaiModel.value.trim() : "",
            // full profile data
            providerProfiles: this._serializeProfiles(),
            activeProfileIds: { ...this.activeProfileIds }
        };
    }

    updateVisibility(provider) {
        const { apiKeyContainer, officialFields, openaiFields, anthropicFields, xaiFields } = this.elements;
        if (!apiKeyContainer) return;

        // Flush old protocol before switching
        if (this._activeProtocol && this._activeProtocol !== provider) {
            this._syncFieldsToProfile(this._activeProtocol);
        }

        if (provider === 'web' || provider === 'doubao_web') {
            apiKeyContainer.style.display = 'none';
        } else {
            apiKeyContainer.style.display = 'flex';
            if (officialFields) officialFields.style.display = provider === 'official' ? 'flex' : 'none';
            if (openaiFields)   openaiFields.style.display   = provider === 'openai'   ? 'flex' : 'none';
            if (anthropicFields) anthropicFields.style.display = provider === 'anthropic' ? 'flex' : 'none';
            if (xaiFields)      xaiFields.style.display      = provider === 'xai'      ? 'flex' : 'none';
        }

        // Render profile selector for new protocol
        this._activeProtocol = (provider === 'openai' || provider === 'anthropic') ? provider : null;
        if (this._activeProtocol) {
            this._renderProfileSelector(this._activeProtocol);
            this._loadProfileToFields(this._activeProtocol);
        }
    }

    // ── profile persistence helpers ───────────────────────────────────────

    _ensureProfiles(data) {
        // If no profiles saved yet, seed from legacy flat fields
        if (this.profiles.openai.length === 0) {
            this.profiles.openai.push({
                id: _uid(),
                name: '1',
                baseUrl: data.openaiBaseUrl || '',
                apiKey: data.openaiApiKey || '',
                model: data.openaiModel || ''
            });
            this.activeProfileIds.openai = this.profiles.openai[0].id;
        }
        if (this.profiles.anthropic.length === 0) {
            this.profiles.anthropic.push({
                id: _uid(),
                name: '1',
                baseUrl: data.anthropicBaseUrl || '',
                apiKey: data.anthropicApiKey || '',
                model: data.anthropicModel || ''
            });
            this.activeProfileIds.anthropic = this.profiles.anthropic[0].id;
        }

        // If saved profiles exist, use them
        if (Array.isArray(data.providerProfiles)) {
            const savedOpenai    = data.providerProfiles.filter(p => p.protocol === 'openai');
            const savedAnthropic = data.providerProfiles.filter(p => p.protocol === 'anthropic');
            if (savedOpenai.length > 0)    this.profiles.openai    = savedOpenai;
            if (savedAnthropic.length > 0) this.profiles.anthropic = savedAnthropic;
        }
        if (data.activeProfileIds) {
            if (data.activeProfileIds.openai)    this.activeProfileIds.openai    = data.activeProfileIds.openai;
            if (data.activeProfileIds.anthropic) this.activeProfileIds.anthropic = data.activeProfileIds.anthropic;
        }
    }

    _serializeProfiles() {
        const out = [];
        ['openai', 'anthropic'].forEach(protocol => {
            this.profiles[protocol].forEach(p => {
                out.push({ ...p, protocol });
            });
        });
        return out;
    }

    // ── fetch models (unchanged logic, just reads from DOM) ──────────────

    _bindFetchModels() {
        document.querySelectorAll('.fetch-models-btn').forEach(btn => {
            btn.addEventListener('click', () => this._fetchModels(btn));
        });
    }

    async _fetchModels(btn) {
        const provider = btn.dataset.provider;
        const { openaiBaseUrl, openaiApiKey, openaiModel,
                anthropicBaseUrl, anthropicApiKey, anthropicModel,
                xaiApiKey, xaiModel } = this.elements;

        let baseUrl, apiKey, modelInput, headers;

        if (provider === 'openai') {
            baseUrl = openaiBaseUrl ? openaiBaseUrl.value.trim() : '';
            apiKey = openaiApiKey ? openaiApiKey.value.trim() : '';
            modelInput = openaiModel;
            if (!baseUrl) return alert('Please enter the Base URL first.');
            if (!apiKey) return alert('Please enter the API Key first.');
            headers = { 'Authorization': `Bearer ${apiKey}` };
        } else if (provider === 'anthropic') {
            baseUrl = anthropicBaseUrl ? anthropicBaseUrl.value.trim() : '';
            apiKey = anthropicApiKey ? anthropicApiKey.value.trim() : '';
            modelInput = anthropicModel;
            if (!baseUrl) return alert('Please enter the Base URL first.');
            if (!apiKey) return alert('Please enter the API Key first.');
            headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
        } else if (provider === 'xai') {
            baseUrl = 'https://api.x.ai/v1';
            apiKey = xaiApiKey ? xaiApiKey.value.trim() : '';
            modelInput = xaiModel;
            if (!apiKey) return alert('Please enter the API Key first.');
            headers = { 'Authorization': `Bearer ${apiKey}` };
        }

        const url = `${baseUrl.replace(/\/+$/, '')}/models`;
        btn.classList.add('loading');
        btn.disabled = true;

        try {
            const res = await fetch(url, { headers });
            if (!res.ok) {
                const errBody = await res.text();
                throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
            }
            const json = await res.json();
            const models = (json.data || []).map(m => m.id).filter(Boolean).sort();
            if (models.length === 0) throw new Error('No models returned by the API.');
            if (modelInput) modelInput.value = models.join(', ');

            btn.classList.remove('loading');
            btn.classList.add('success');
            setTimeout(() => btn.classList.remove('success'), 1800);
        } catch (err) {
            btn.classList.remove('loading');
            alert(`Failed to fetch models: ${err.message}`);
        } finally {
            btn.disabled = false;
        }
    }

    // ── key visibility toggles (unchanged) ────────────────────────────────

    _bindKeyToggles() {
        const apiInputs = [
            this.elements.apiKeyInput,
            this.elements.openaiApiKey,
            this.elements.anthropicApiKey,
            this.elements.xaiApiKey
        ];
        apiInputs.forEach(input => {
            if (!input) return;
            const wrapper = input.closest('.api-key-wrapper');
            const toggle = wrapper ? wrapper.querySelector('.api-key-toggle') : null;
            if (!toggle) return;
            toggle.addEventListener('click', () => {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                toggle.classList.toggle('visible', isPassword);
            });
        });
    }
}
