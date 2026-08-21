const STORAGE_KEY_API_KEY = 'deepseek_api_key';
const STORAGE_KEY_API_URL = 'deepseek_api_url';
const STORAGE_KEY_MODEL = 'deepseek_model';
const STORAGE_KEY_USE_PROXY = 'deepseek_use_proxy';
const STORAGE_KEY_PROXY_URL = 'deepseek_proxy_url';
const STORAGE_KEY_CHARACTERS = 'deepseek_characters';
const STORAGE_KEY_GROUPS = 'deepseek_groups';
const STORAGE_KEY_ACTIVE_CONTEXT = 'deepseek_active_context';
const STORAGE_KEY_CONTEXT_TYPE = 'deepseek_context_type';
const STORAGE_KEY_CHAT_BACKGROUND = 'deepseek_chat_background';

let characters = [];
let groups = [];
let activeContextId = null;
let activeContextType = 'character';
let isStreaming = false;
let currentEditingCharacterId = null;
let currentAvatarDataUrl = null;
let currentEditingGroupId = null;
let pendingImages = [];  // [{dataUrl, size, name}]

// 支持多模态（视觉理解）的模型列表
const VISION_MODELS = [
    'deepseek-v4-flash-vision-exp',
    'deepseek-v4-flash-vision',
    'deepseek-v4-vision-pro'
];

function isVisionModel(modelId) {
    return VISION_MODELS.includes(modelId) ||
        (modelId && (modelId.includes('vision') || modelId.includes('Vision')));
}

const defaultCharacters = [
    {
        id: 'default',
        name: '🌿 Green AI',
        avatar: '🌱',
        description: '一个清新自然的AI助手',
        systemPrompt: '你是一个清新自然的AI助手，说话温柔亲切，像大自然一样让人感到舒适放松。',
        messages: []
    },
    {
        id: 'maid',
        name: '🌸 女仆酱',
        avatar: '🎀',
        description: '可爱的女仆角色',
        systemPrompt: '你是一个可爱的女仆，说话温柔可爱，使用日语风格的语气，喜欢用"~"结尾。称呼用户为"主人"。',
        messages: []
    },
    {
        id: 'tsundere',
        name: '💢 傲娇少女',
        avatar: '😤',
        description: '傲娇属性的少女',
        systemPrompt: '你是一个傲娇的少女，表面上不关心用户，但实际上很在意。说话带刺但内心温柔，喜欢用"才不是呢！"这样的台词。',
        messages: []
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initSettings();
    initData();
    initBackground();
    initEventListeners();
    autoResizeTextarea();
});

function initSettings() {
    const savedApiKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    const savedApiUrl = localStorage.getItem(STORAGE_KEY_API_URL);
    const savedModel = localStorage.getItem(STORAGE_KEY_MODEL);
    const savedUseProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY);
    const savedProxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL);

    if (savedApiKey) {
        document.getElementById('apiKey').value = savedApiKey;
        document.getElementById('sendBtn').disabled = false;
    }

    if (savedApiUrl) {
        document.getElementById('apiUrl').value = savedApiUrl;
    }

    if (savedModel) {
        document.getElementById('modelSelect').value = savedModel;
    }

    if (savedUseProxy === 'true') {
        document.getElementById('useProxy').checked = true;
        toggleProxySettings(true);
    }

    if (savedProxyUrl) {
        document.getElementById('proxyUrl').value = savedProxyUrl;
    }
}

function initData() {
    const savedCharacters = localStorage.getItem(STORAGE_KEY_CHARACTERS);
    const savedGroups = localStorage.getItem(STORAGE_KEY_GROUPS);
    const savedContextId = localStorage.getItem(STORAGE_KEY_ACTIVE_CONTEXT);
    const savedContextType = localStorage.getItem(STORAGE_KEY_CONTEXT_TYPE);

    if (savedCharacters) {
        try {
            characters = JSON.parse(savedCharacters);
        } catch (e) {
            console.error('Failed to parse characters:', e);
            characters = [...defaultCharacters];
        }
    } else {
        characters = [...defaultCharacters];
        saveCharacters();
    }

    if (savedGroups) {
        try {
            groups = JSON.parse(savedGroups);
        } catch (e) {
            console.error('Failed to parse groups:', e);
            groups = [];
        }
    } else {
        groups = [];
        saveGroups();
    }

    activeContextType = savedContextType || 'character';
    
    if (activeContextType === 'group') {
        if (savedContextId && groups.find(g => g.id === savedContextId)) {
            activeContextId = savedContextId;
        } else {
            activeContextId = groups[0]?.id || null;
            if (!activeContextId) {
                activeContextType = 'character';
                activeContextId = characters[0]?.id || null;
            }
        }
    } else {
        if (savedContextId && characters.find(c => c.id === savedContextId)) {
            activeContextId = savedContextId;
        } else {
            activeContextId = characters[0]?.id || null;
        }
    }

    renderContextSelector();
    loadActiveContext();
}

function saveCharacters() {
    try {
        localStorage.setItem(STORAGE_KEY_CHARACTERS, JSON.stringify(characters));
    } catch (e) {
        console.error('Failed to save characters:', e);
        showToast('存储空间不足，部分数据可能未保存', 'error');
    }
}

function saveGroups() {
    try {
        localStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups));
    } catch (e) {
        console.error('Failed to save groups:', e);
        showToast('存储空间不足，部分数据可能未保存', 'error');
    }
}

function saveActiveContext() {
    localStorage.setItem(STORAGE_KEY_ACTIVE_CONTEXT, activeContextId);
    localStorage.setItem(STORAGE_KEY_CONTEXT_TYPE, activeContextType);
}

function getActiveCharacter() {
    return characters.find(c => c.id === activeContextId);
}

function getActiveGroup() {
    return groups.find(g => g.id === activeContextId);
}

function getActiveContext() {
    if (activeContextType === 'group') {
        return getActiveGroup();
    }
    return getActiveCharacter();
}

function renderContextSelector() {
    const selector = document.getElementById('contextSelect');
    selector.innerHTML = '';

    const groupOption = document.createElement('optgroup');
    groupOption.label = '💬 群组';
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = `group_${group.id}`;
        option.textContent = `💬 ${group.name}`;
        if (activeContextType === 'group' && activeContextId === group.id) {
            option.selected = true;
        }
        groupOption.appendChild(option);
    });
    selector.appendChild(groupOption);

    const charOption = document.createElement('optgroup');
    charOption.label = '👤 角色';
    characters.forEach(char => {
        const option = document.createElement('option');
        option.value = `char_${char.id}`;
        option.textContent = `${getAvatarDisplay(char.avatar)} ${char.name}`;
        if (activeContextType === 'character' && activeContextId === char.id) {
            option.selected = true;
        }
        charOption.appendChild(option);
    });
    selector.appendChild(charOption);

    updateContextDisplay();
}

function getAvatarDisplay(avatar) {
    if (avatar.startsWith('data:')) {
        return '👤';
    }
    return avatar;
}

function updateContextDisplay() {
}

function loadActiveContext() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

    if (activeContextType === 'group') {
        const group = getActiveGroup();
        if (!group) return;

        if (group.messages.length === 0) {
            addGroupWelcomeMessage(group);
        } else {
            group.messages.forEach(msg => {
                if (msg.role === 'user') {
                    addUserMessage(msg.content, false);
                } else if (msg.role === 'assistant') {
                    addGroupBotMessage(msg.content, msg.characterId, false);
                }
            });
        }
    } else {
        const char = getActiveCharacter();
        if (!char) return;

        if (char.messages.length === 0) {
            addWelcomeMessage(char);
        } else {
            char.messages.forEach(msg => {
                if (msg.role === 'user') {
                    addUserMessage(msg.content, false);
                } else if (msg.role === 'assistant') {
                    addBotMessage(msg.content, false);
                }
            });
        }
    }
}

function addWelcomeMessage(char) {
    const chatMessages = document.getElementById('chatMessages');
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
        <div class="avatar bot-avatar">
            ${char.avatar.startsWith('data:') ? `<img src="${char.avatar}" alt="avatar">` : `<span style="font-size: 1.5rem;">${char.avatar}</span>`}
        </div>
        <div class="message-content">
            <div class="message-text">
                🌿 嗨~ 我是 ${char.name}！<br>
                ✨ ${char.description}，快来和我聊天吧~
            </div>
            <div class="message-info">${getAvatarDisplay(char.avatar)} ${char.name}</div>
        </div>
    `;
    chatMessages.appendChild(welcomeDiv);
}

function addGroupWelcomeMessage(group) {
    const chatMessages = document.getElementById('chatMessages');
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    
    const memberAvatars = group.members.map(m => {
        const char = characters.find(c => c.id === m);
        return char?.avatar ? (char.avatar.startsWith('data:') ? '👤' : char.avatar) : '👤';
    }).join(' ');

    welcomeDiv.innerHTML = `
        <div class="avatar bot-avatar" style="background: linear-gradient(135deg, #f59e0b, #fbbf24);">
            <span style="font-size: 1.5rem;">💬</span>
        </div>
        <div class="message-content">
            <div class="message-text">
                💬 欢迎来到 ${group.name} 群聊！<br>
                ✨ 群成员：${memberAvatars}<br>
                💡 发送消息后，所有群成员都会轮流回复哦~
            </div>
            <div class="message-info">💬 ${group.name}</div>
        </div>
    `;
    chatMessages.appendChild(welcomeDiv);
}

function initEventListeners() {
    document.getElementById('settingsBtn').addEventListener('click', openSettings);
    document.getElementById('closeSettings').addEventListener('click', closeSettings);
    document.getElementById('saveSettings').addEventListener('click', saveSettings);
    document.getElementById('userInput').addEventListener('input', handleInput);
    document.getElementById('userInput').addEventListener('keydown', handleKeydown);
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    document.getElementById('modelSelect').addEventListener('change', handleModelChange);
    document.getElementById('useProxy').addEventListener('change', (e) => {
        toggleProxySettings(e.target.checked);
    });

    document.getElementById('contextSelect').addEventListener('change', handleContextChange);
    document.getElementById('manageCharactersBtn').addEventListener('click', openCharacterManager);
    document.getElementById('closeCharacterManager').addEventListener('click', closeCharacterManager);
    document.getElementById('addCharacterBtn').addEventListener('click', () => openAddCharacter());
    document.getElementById('saveNewCharacter').addEventListener('click', handleSaveCharacter);
    document.getElementById('cancelNewCharacter').addEventListener('click', closeAddCharacter);

    document.getElementById('manageGroupsBtn').addEventListener('click', openGroupManager);
    document.getElementById('closeGroupManager').addEventListener('click', closeGroupManager);
    document.getElementById('addGroupBtn').addEventListener('click', () => openAddGroup());
    document.getElementById('saveNewGroup').addEventListener('click', handleSaveGroup);
    document.getElementById('cancelNewGroup').addEventListener('click', closeAddGroup);

    document.getElementById('proactiveChatBtn').addEventListener('click', triggerProactiveChat);

    document.getElementById('avatarUploadBtn').addEventListener('click', () => {
        document.getElementById('avatarFileInput').click();
    });
    document.getElementById('avatarFileInput').addEventListener('change', handleAvatarUpload);

    document.getElementById('backgroundBtn').addEventListener('click', handleBackgroundButtonClick);
    document.getElementById('backgroundFileInput').addEventListener('change', handleBackgroundUpload);

    // 图片上传按钮
    document.getElementById('imageUploadBtn').addEventListener('click', () => {
        document.getElementById('imageFileInput').click();
    });
    document.getElementById('imageFileInput').addEventListener('change', handleImageFileUpload);

    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeSettings();
        }
    });

    document.getElementById('characterManagerModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeCharacterManager();
        }
    });

    document.getElementById('addCharacterModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeAddCharacter();
        }
    });

    document.getElementById('groupManagerModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeGroupManager();
        }
    });

    document.getElementById('addGroupModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeAddGroup();
        }
    });
}

function toggleProxySettings(enabled) {
    const proxyUrlInput = document.getElementById('proxyUrl');
    if (enabled) {
        proxyUrlInput.disabled = false;
        proxyUrlInput.parentElement.style.opacity = '1';
    } else {
        proxyUrlInput.disabled = true;
        proxyUrlInput.parentElement.style.opacity = '0.5';
    }
}

function autoResizeTextarea() {
    const textarea = document.getElementById('userInput');
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    });
}

function handleInput() {
    const input = document.getElementById('userInput').value.trim();
    const sendBtn = document.getElementById('sendBtn');
    const hasApiKey = localStorage.getItem(STORAGE_KEY_API_KEY);

    sendBtn.disabled = (!input && pendingImages.length === 0) || !hasApiKey || isStreaming;
}

function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

function handleModelChange() {
    const model = document.getElementById('modelSelect').value;
    localStorage.setItem(STORAGE_KEY_MODEL, model);
}

function handleContextChange(e) {
    if (isStreaming) {
        showToast('正在回复中，请稍候再切换角色');
        e.target.value = activeContextType === 'group' ? `group_${activeContextId}` : `char_${activeContextId}`;
        return;
    }
    const value = e.target.value;
    if (value.startsWith('group_')) {
        activeContextType = 'group';
        activeContextId = value.replace('group_', '');
    } else {
        activeContextType = 'character';
        activeContextId = value.replace('char_', '');
    }
    saveActiveContext();
    loadActiveContext();
}

function openSettings() {
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
}

function saveSettings() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiUrl = document.getElementById('apiUrl').value.trim();
    const useProxy = document.getElementById('useProxy').checked;
    const proxyUrl = document.getElementById('proxyUrl').value.trim();

    if (!apiKey) {
        showToast('请输入 API Key');
        return;
    }

    if (!apiUrl) {
        showToast('请输入 API 地址');
        return;
    }

    if (useProxy && !proxyUrl) {
        showToast('请输入代理地址');
        return;
    }

    localStorage.setItem(STORAGE_KEY_API_KEY, apiKey);
    localStorage.setItem(STORAGE_KEY_API_URL, apiUrl);
    localStorage.setItem(STORAGE_KEY_USE_PROXY, useProxy);
    localStorage.setItem(STORAGE_KEY_PROXY_URL, proxyUrl);

    document.getElementById('sendBtn').disabled = false;
    closeSettings();
    showToast('设置已保存', 'success');
}

function openCharacterManager() {
    renderCharacterList();
    document.getElementById('characterManagerModal').classList.remove('hidden');
}

function closeCharacterManager() {
    document.getElementById('characterManagerModal').classList.add('hidden');
}

function renderCharacterList() {
    const list = document.getElementById('characterList');
    list.innerHTML = '';

    characters.forEach(char => {
        const isActive = activeContextType === 'character' && activeContextId === char.id;
        const item = document.createElement('div');
        item.className = 'character-item' + (isActive ? ' active' : '');
        item.innerHTML = `
            <div class="character-avatar">${char.avatar.startsWith('data:') ? `<img src="${char.avatar}" alt="avatar">` : char.avatar}</div>
            <div class="character-info">
                <div class="character-name">${char.name}</div>
                <div class="character-desc">${char.description}</div>
            </div>
            <div class="character-actions">
                <button class="edit-char-btn" onclick="editCharacter('${char.id}')">✏️</button>
                <button class="delete-char-btn" onclick="deleteCharacter('${char.id}')" ${char.id === 'default' ? 'disabled' : ''}>🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function openAddCharacter(editId = null) {
    const modal = document.getElementById('addCharacterModal');
    const title = document.getElementById('addCharacterTitle');
    const idInput = document.getElementById('newCharacterId');
    const nameInput = document.getElementById('newCharacterName');
    const avatarInput = document.getElementById('newCharacterAvatar');
    const descInput = document.getElementById('newCharacterDesc');
    const promptInput = document.getElementById('newCharacterPrompt');
    const avatarPreview = document.getElementById('avatarPreview');

    currentEditingCharacterId = editId;
    currentAvatarDataUrl = null;

    if (editId) {
        const char = characters.find(c => c.id === editId);
        title.textContent = '编辑角色';
        idInput.value = char.id;
        idInput.disabled = true;
        nameInput.value = char.name;
        avatarInput.value = char.avatar;
        descInput.value = char.description;
        promptInput.value = char.systemPrompt;

        if (char.avatar.startsWith('data:')) {
            currentAvatarDataUrl = char.avatar;
            avatarPreview.innerHTML = `<img src="${char.avatar}" alt="avatar">`;
            avatarPreview.classList.add('has-image');
        } else {
            avatarPreview.textContent = char.avatar;
            avatarPreview.classList.remove('has-image');
        }
    } else {
        title.textContent = '添加角色';
        idInput.value = '';
        idInput.disabled = false;
        nameInput.value = '';
        avatarInput.value = '🌿';
        descInput.value = '';
        promptInput.value = '你是一个智能助手，使用自然、友好的语言回答用户问题。';

        avatarPreview.textContent = '🌿';
        avatarPreview.classList.remove('has-image');
    }

    modal.classList.remove('hidden');
}

function closeAddCharacter() {
    document.getElementById('addCharacterModal').classList.add('hidden');
    currentEditingCharacterId = null;
    currentAvatarDataUrl = null;
}

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件');
        return;
    }

    if (file.size > 2 * 1024 * 1024) {
        showToast('图片大小不能超过2MB');
        return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
        const dataUrl = event.target.result;
        currentAvatarDataUrl = dataUrl;

        const avatarPreview = document.getElementById('avatarPreview');
        avatarPreview.innerHTML = `<img src="${dataUrl}" alt="avatar">`;
        avatarPreview.classList.add('has-image');

        document.getElementById('newCharacterAvatar').value = '';
    };
    reader.readAsDataURL(file);
}

// ========== 聊天背景功能 ==========
function initBackground() {
    const savedBg = localStorage.getItem(STORAGE_KEY_CHAT_BACKGROUND);
    if (savedBg) {
        applyBackground(savedBg);
    }
}

function handleBackgroundButtonClick() {
    const hasBg = localStorage.getItem(STORAGE_KEY_CHAT_BACKGROUND);
    if (hasBg) {
        if (confirm('已设置聊天背景图片。\n点击"确定"清除背景，点击"取消"选择新的背景图片。')) {
            clearBackground();
        } else {
            document.getElementById('backgroundFileInput').click();
        }
    } else {
        document.getElementById('backgroundFileInput').click();
    }
}

function handleBackgroundUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showToast('请选择图片文件');
        e.target.value = '';
        return;
    }

    if (file.size > 8 * 1024 * 1024) {
        showToast('图片大小不能超过8MB');
        e.target.value = '';
        return;
    }

    // 通过 canvas 压缩图片，避免 localStorage 空间不足
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            const maxWidth = 1920;
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((maxWidth / width) * height);
                width = maxWidth;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

            try {
                localStorage.setItem(STORAGE_KEY_CHAT_BACKGROUND, dataUrl);
                applyBackground(dataUrl);
                showToast('背景设置成功！', 'success');
            } catch (err) {
                console.error('Failed to save background:', err);
                showToast('存储空间不足，无法保存背景图片，请先清除旧背景或减少角色数据');
            }
        };
        img.onerror = () => {
            showToast('图片加载失败，请尝试其他图片');
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // 重置 input，允许再次选择同一文件
    e.target.value = '';
}

// ========== 消息图片上传（多模态）==========
function handleImageFileUpload(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // 当前模型不是视觉模型时提示用户
    const model = document.getElementById('modelSelect').value;
    if (!isVisionModel(model)) {
        showToast('当前模型不支持识图，请切换到「DeepSeek V4 Flash Vision (多模态)」');
        e.target.value = '';
        return;
    }

    let remaining = files.length;
    const hasError = false;
    files.forEach(file => {
        if (!file.type.startsWith('image/')) {
            showToast(`${file.name} 不是图片文件`);
            remaining--;
            if (remaining === 0) refreshImagePreview();
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast(`${file.name} 超过10MB`);
            remaining--;
            if (remaining === 0) refreshImagePreview();
            return;
        }
        // 最多 4 张图
        if (pendingImages.length >= 4) {
            if (!hasError) {
                showToast('一次最多发送4张图片');
            }
            remaining--;
            if (remaining === 0) refreshImagePreview();
            return;
        }

        compressImageForMessage(file).then(dataUrl => {
            pendingImages.push({ dataUrl, name: file.name, size: dataUrl.length });
            remaining--;
            if (remaining === 0) refreshImagePreview();
            handleInput(); // 刷新发送按钮可用状态
        }).catch(err => {
            console.error('图片压缩失败:', err);
            showToast(`${file.name} 处理失败`);
            remaining--;
            if (remaining === 0) refreshImagePreview();
        });
    });

    e.target.value = '';
}

function compressImageForMessage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => {
            const img = new Image();
            img.onload = () => {
                // 官方建议最长边 ≤ 1280，384 tokens 上限，省流量也省token
                const maxSide = 1280;
                let w = img.width, h = img.height;
                const ratio = Math.min(1, maxSide / Math.max(w, h));
                w = Math.round(w * ratio);
                h = Math.round(h * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = w;
                canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                // 保持原 format（PNG 需要保留透明）
                let type = 'image/jpeg';
                let quality = 0.85;
                if (file.type === 'image/png') {
                    type = 'image/png';
                    quality = undefined;
                } else if (file.type === 'image/webp') {
                    type = 'image/webp';
                    quality = 0.9;
                }
                try {
                    resolve(canvas.toDataURL(type, quality));
                } catch (err) {
                    reject(err);
                }
            };
            img.onerror = () => reject(new Error('image load error'));
            img.src = ev.target.result;
        };
        reader.onerror = () => reject(new Error('file read error'));
        reader.readAsDataURL(file);
    });
}

function refreshImagePreview() {
    const container = document.getElementById('imagePreviewContainer');
    if (!pendingImages.length) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }
    container.classList.remove('hidden');
    container.innerHTML = pendingImages.map((img, idx) => `
        <div class="image-preview-item" data-idx="${idx}">
            <img src="${img.dataUrl}" alt="${escapeHtml(img.name)}">
            <button class="image-preview-remove" onclick="removePendingImage(${idx})" title="移除">×</button>
        </div>
    `).join('');
}

function removePendingImage(idx) {
    pendingImages.splice(idx, 1);
    refreshImagePreview();
    handleInput();
}

function applyBackground(dataUrl) {
    const body = document.body;

    if (dataUrl) {
        body.style.backgroundImage = `url("${dataUrl}")`;
        body.style.backgroundSize = 'cover';
        body.style.backgroundPosition = 'center';
        body.style.backgroundRepeat = 'no-repeat';
        body.style.backgroundAttachment = 'fixed';
        body.classList.add('has-custom-bg');
    } else {
        body.style.backgroundImage = '';
        body.style.backgroundSize = '';
        body.style.backgroundPosition = '';
        body.style.backgroundRepeat = '';
        body.style.backgroundAttachment = '';
        body.classList.remove('has-custom-bg');
    }
}

function clearBackground() {
    localStorage.removeItem(STORAGE_KEY_CHAT_BACKGROUND);
    applyBackground(null);
    showToast('背景已清除', 'success');
}

function handleSaveCharacter() {
    if (currentEditingCharacterId) {
        updateCharacter(currentEditingCharacterId);
    } else {
        saveNewCharacter();
    }
}

function saveNewCharacter() {
    const id = document.getElementById('newCharacterId').value.trim();
    const name = document.getElementById('newCharacterName').value.trim();
    const avatarInput = document.getElementById('newCharacterAvatar').value.trim();
    const desc = document.getElementById('newCharacterDesc').value.trim();
    const prompt = document.getElementById('newCharacterPrompt').value.trim();

    if (!id) {
        showToast('请输入角色ID');
        return;
    }

    if (!name) {
        showToast('请输入角色名称');
        return;
    }

    if (characters.find(c => c.id === id)) {
        showToast('角色ID已存在');
        return;
    }

    const avatar = currentAvatarDataUrl || avatarInput || '🌿';

    characters.push({
        id,
        name,
        avatar,
        description: desc || '暂无描述',
        systemPrompt: prompt || '你是一个智能助手。',
        messages: []
    });

    saveCharacters();
    renderContextSelector();
    closeAddCharacter();
    closeCharacterManager();
    showToast('角色添加成功！', 'success');
}

function updateCharacter(editId) {
    const name = document.getElementById('newCharacterName').value.trim();
    const avatarInput = document.getElementById('newCharacterAvatar').value.trim();
    const desc = document.getElementById('newCharacterDesc').value.trim();
    const prompt = document.getElementById('newCharacterPrompt').value.trim();

    if (!name) {
        showToast('请输入角色名称');
        return;
    }

    const avatar = currentAvatarDataUrl || avatarInput || '🌿';

    const charIndex = characters.findIndex(c => c.id === editId);
    if (charIndex !== -1) {
        characters[charIndex] = {
            ...characters[charIndex],
            name,
            avatar,
            description: desc || '暂无描述',
            systemPrompt: prompt || '你是一个智能助手。'
        };

        saveCharacters();
        renderContextSelector();
        if (editId === activeContextId && activeContextType === 'character') {
            loadActiveContext();
        }
        closeAddCharacter();
        closeCharacterManager();
        showToast('角色更新成功！', 'success');
    }
}

function editCharacter(id) {
    openAddCharacter(id);
}

function deleteCharacter(id) {
    if (confirm('确定要删除这个角色吗？删除后对话记录也会丢失哦~')) {
        characters = characters.filter(c => c.id !== id);
        
        if (activeContextType === 'character' && activeContextId === id) {
            activeContextId = characters[0]?.id || null;
            saveActiveContext();
        }

        groups = groups.map(group => ({
            ...group,
            members: group.members.filter(m => m !== id)
        })).filter(group => group.members.length > 0);

        saveCharacters();
        saveGroups();
        renderContextSelector();
        renderCharacterList();
        
        if (activeContextId) {
            loadActiveContext();
        }
        
        showToast('角色已删除', 'success');
    }
}

function openGroupManager() {
    renderGroupList();
    document.getElementById('groupManagerModal').classList.remove('hidden');
}

function closeGroupManager() {
    document.getElementById('groupManagerModal').classList.add('hidden');
}

function renderGroupList() {
    const list = document.getElementById('groupList');
    list.innerHTML = '';

    groups.forEach(group => {
        const isActive = activeContextType === 'group' && activeContextId === group.id;
        const item = document.createElement('div');
        item.className = 'character-item' + (isActive ? ' active' : '');
        
        const memberNames = group.members.map(m => {
            const char = characters.find(c => c.id === m);
            return char ? `${char.avatar ? (char.avatar.startsWith('data:') ? '👤' : char.avatar) : '👤'} ${char?.name || m}` : m;
        }).join(', ');

        item.innerHTML = `
            <div class="character-avatar" style="background: linear-gradient(135deg, #f59e0b, #fbbf24);">💬</div>
            <div class="character-info">
                <div class="character-name">${group.name}</div>
                <div class="character-desc">成员: ${memberNames}</div>
            </div>
            <div class="character-actions">
                <button class="edit-char-btn" onclick="editGroup('${group.id}')">✏️</button>
                <button class="delete-char-btn" onclick="deleteGroup('${group.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(item);
    });
}

function openAddGroup(editId = null) {
    const modal = document.getElementById('addGroupModal');
    const title = document.getElementById('addGroupTitle');
    const idInput = document.getElementById('newGroupId');
    const nameInput = document.getElementById('newGroupName');
    const membersContainer = document.getElementById('groupMembersContainer');

    currentEditingGroupId = editId;

    membersContainer.innerHTML = '';

    if (editId) {
        const group = groups.find(g => g.id === editId);
        title.textContent = '编辑群组';
        idInput.value = group.id;
        idInput.disabled = true;
        nameInput.value = group.name;

        characters.forEach(char => {
            const isSelected = group.members.includes(char.id);
            membersContainer.innerHTML += `
                <label class="checkbox-label">
                    <input type="checkbox" value="${char.id}" ${isSelected ? 'checked' : ''}>
                    ${char.avatar.startsWith('data:') ? '👤' : char.avatar} ${char.name}
                </label>
            `;
        });
    } else {
        title.textContent = '创建群组';
        idInput.value = '';
        idInput.disabled = false;
        nameInput.value = '';

        characters.forEach(char => {
            membersContainer.innerHTML += `
                <label class="checkbox-label">
                    <input type="checkbox" value="${char.id}">
                    ${char.avatar.startsWith('data:') ? '👤' : char.avatar} ${char.name}
                </label>
            `;
        });
    }

    modal.classList.remove('hidden');
}

function closeAddGroup() {
    document.getElementById('addGroupModal').classList.add('hidden');
    currentEditingGroupId = null;
}

function handleSaveGroup() {
    if (currentEditingGroupId) {
        updateGroup(currentEditingGroupId);
    } else {
        saveNewGroup();
    }
}

function saveNewGroup() {
    const id = document.getElementById('newGroupId').value.trim();
    const name = document.getElementById('newGroupName').value.trim();
    const checkboxes = document.querySelectorAll('#groupMembersContainer input[type="checkbox"]');
    const members = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

    if (!id) {
        showToast('请输入群组ID');
        return;
    }

    if (!name) {
        showToast('请输入群组名称');
        return;
    }

    if (members.length < 2) {
        showToast('群组至少需要2个成员');
        return;
    }

    if (groups.find(g => g.id === id)) {
        showToast('群组ID已存在');
        return;
    }

    groups.push({
        id,
        name,
        members,
        messages: []
    });

    saveGroups();
    renderContextSelector();
    closeAddGroup();
    closeGroupManager();
    showToast('群组创建成功！', 'success');
}

function updateGroup(editId) {
    const name = document.getElementById('newGroupName').value.trim();
    const checkboxes = document.querySelectorAll('#groupMembersContainer input[type="checkbox"]');
    const members = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);

    if (!name) {
        showToast('请输入群组名称');
        return;
    }

    if (members.length < 2) {
        showToast('群组至少需要2个成员');
        return;
    }

    const groupIndex = groups.findIndex(g => g.id === editId);
    if (groupIndex !== -1) {
        groups[groupIndex] = {
            ...groups[groupIndex],
            name,
            members
        };

        saveGroups();
        renderContextSelector();
        if (editId === activeContextId && activeContextType === 'group') {
            loadActiveContext();
        }
        closeAddGroup();
        closeGroupManager();
        showToast('群组更新成功！', 'success');
    }
}

function editGroup(id) {
    openAddGroup(id);
}

function deleteGroup(id) {
    if (confirm('确定要删除这个群组吗？群组内的聊天记录也会丢失哦~')) {
        groups = groups.filter(g => g.id !== id);
        
        if (activeContextType === 'group' && activeContextId === id) {
            activeContextType = 'character';
            activeContextId = characters[0]?.id || null;
            saveActiveContext();
        }

        saveGroups();
        renderContextSelector();
        renderGroupList();
        
        if (activeContextId) {
            loadActiveContext();
        }
        
        showToast('群组已删除', 'success');
    }
}

async function sendMessage() {
    const input = document.getElementById('userInput');
    const message = input.value.trim();

    if ((!message && pendingImages.length === 0) || isStreaming) return;

    const apiKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (!apiKey) {
        showToast('请先在设置中输入 API Key');
        openSettings();
        return;
    }

    // 如果有图片但模型不支持视觉，提示用户并禁止发送
    const curModel = document.getElementById('modelSelect').value;
    if (pendingImages.length > 0 && !isVisionModel(curModel)) {
        showToast('当前模型不支持识图，请先切换到 DeepSeek V4 Flash Vision (多模态)');
        return;
    }

    // 取出待发送图片（直接引用 pendingImages，发送完再清空，保证顺序）
    const sendingImages = pendingImages.map(i => i.dataUrl);

    input.value = '';
    input.style.height = 'auto';
    document.getElementById('sendBtn').disabled = true;

    isStreaming = true;

    if (activeContextType === 'group') {
        await sendGroupMessage(message, sendingImages, apiKey);
    } else {
        await sendCharacterMessage(message, sendingImages, apiKey);
    }

    // 发送完成：清空待上传图片
    pendingImages = [];
    refreshImagePreview();

    isStreaming = false;
    handleInput();
}

async function sendCharacterMessage(message, images = [], apiKey) {
    const char = getActiveCharacter();
    const savedContent = buildContentMessage(message, images);
    char.messages.push({ role: 'user', content: savedContent });
    saveCharacters();
    addUserMessage(message, images);

    showTypingIndicator();

    try {
        await callDeepSeekAPI(message, images, apiKey, char);
    } catch (error) {
        console.error('API Error:', error);
        showToast(error.message || 'API 请求失败');
        addErrorMessage(error.message || 'API 请求失败');
    } finally {
        hideTypingIndicator();
    }
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

async function sendGroupMessage(message, images = [], apiKey) {
    const group = getActiveGroup();
    const savedContent = buildContentMessage(message, images);
    group.messages.push({ role: 'user', content: savedContent });
    saveGroups();
    addUserMessage(message, images);

    const shuffledMembers = shuffleArray([...group.members]);
    
    for (let i = 0; i < shuffledMembers.length; i++) {
        const memberId = shuffledMembers[i];
        const member = characters.find(c => c.id === memberId);
        if (!member) continue;

        showTypingIndicator(member);

        try {
            await callGroupDeepSeekAPI(message, images, apiKey, member, group, i + 1, shuffledMembers);
        } catch (error) {
            console.error('API Error:', error);
            addGroupErrorMessage(error.message || 'API 请求失败', memberId);
        }

        hideTypingIndicator();
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

async function triggerProactiveChat() {
    const apiKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (!apiKey) {
        showToast('请先在设置中输入 API Key');
        openSettings();
        return;
    }

    if (isStreaming) return;
    isStreaming = true;
    document.getElementById('proactiveChatBtn').disabled = true;

    try {
        if (activeContextType === 'group') {
            await triggerProactiveGroupChat(apiKey);
        } else {
            await triggerProactiveCharacterChat(apiKey);
        }
    } catch (error) {
        console.error('Proactive chat error:', error);
        showToast(error.message || '主动对话失败');
    } finally {
        isStreaming = false;
        document.getElementById('proactiveChatBtn').disabled = false;
    }
}

async function triggerProactiveCharacterChat(apiKey) {
    const char = getActiveCharacter();
    if (!char) return;

    showTypingIndicator(char);

    try {
        await callProactiveAPI(apiKey, char);
    } catch (error) {
        console.error('API Error:', error);
        showToast(error.message || 'API 请求失败');
        addErrorMessage(error.message || 'API 请求失败');
    } finally {
        hideTypingIndicator();
    }
}

async function triggerProactiveGroupChat(apiKey) {
    const group = getActiveGroup();
    if (!group) return;

    for (const memberId of group.members) {
        const member = characters.find(c => c.id === memberId);
        if (!member) continue;

        showTypingIndicator(member);

        try {
            await callProactiveGroupAPI(apiKey, member, group);
        } catch (error) {
            console.error('API Error:', error);
            addGroupErrorMessage(error.message || 'API 请求失败', memberId);
        }

        hideTypingIndicator();
        await new Promise(resolve => setTimeout(resolve, 500));
    }
}

function addUserMessage(content, images = [], save = true) {
    // 兼容旧调用：images传了boolean（原save参数）时自动回退
    if (typeof images === 'boolean') {
        save = images;
        images = [];
    }
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';

    const displayText = escapeHtml(contentToText(content));
    const displayImages = (images && images.length) ? images : contentToImages(content);
    const imagesHtml = (displayImages && displayImages.length) ? `
        <div class="message-user-images-row">
            ${displayImages.map(img => `<img src="${img}" alt="用户图片" onclick="window.open('${img}','_blank')">`).join('')}
        </div>
    ` : '';

    messageDiv.innerHTML = `
        <div class="avatar user-avatar">
            <span style="font-size: 1.2rem;">🌟</span>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                ${imagesHtml}
                <div class="message-text">${displayText}</div>
            </div>
            <div class="message-info">你 🌟</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function buildContentMessage(text, images) {
    // 给 API 调用或消息存储用：有图时返回 content 数组，否则直接返回字符串
    const hasImages = images && images.length > 0;
    if (!hasImages) return text || '';
    const parts = [];
    if (text && text.trim()) {
        parts.push({ type: 'text', text });
    }
    for (const imgDataUrl of images) {
        // base64 前缀按格式提取
        parts.push({
            type: 'image_url',
            image_url: { url: imgDataUrl }
        });
    }
    return parts;
}

function contentToText(content) {
    // messages 中 content 可能是字符串也可能是多模态数组；统一取出纯文本用于显示和上下文
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.filter(p => p && p.type === 'text').map(p => p.text).join('\n');
    }
    return String(content || '');
}

function contentToImages(content) {
    if (Array.isArray(content)) {
        return content
            .filter(p => p && p.type === 'image_url' && p.image_url && p.image_url.url)
            .map(p => p.image_url.url);
    }
    return [];
}

function addBotMessage(content, save = true) {
    const char = getActiveCharacter();
    if (save && char) {
        char.messages.push({ role: 'assistant', content });
        saveCharacters();
    }

    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            ${char?.avatar?.startsWith('data:') ? `<img src="${char.avatar}" alt="avatar">` : `<span style="font-size: 1.2rem;">${char?.avatar || '🌿'}</span>`}
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text markdown-body">${renderMarkdown(content)}</div>
            </div>
            <div class="message-info">${getAvatarDisplay(char?.avatar || '🌿')} ${char?.name || 'AI'}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function cleanGroupReply(content, characterName) {
    let cleaned = content.trim();
    
    cleaned = cleaned.replace(/^\s*\[.+?\]\s*[:：]\s*/m, '');
    cleaned = cleaned.replace(/^\s*(?:-\s*)?(?:\d+\.\s*)?(?:\*\s*)?(?:•\s*)?\s*/, '');
    
    const otherCharacters = characters.filter(c => c.name !== characterName);
    
    for (const otherChar of otherCharacters) {
        const escapedName = otherChar.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        const patterns = [
            new RegExp(`(?:^|\\n)\\s*\\[?${escapedName}\\]?\\s*[:：]\\s*`, 'g'),
            new RegExp(`(?:^|\\n)\\s*${escapedName}\\s*说[:：]\\s*`, 'g'),
            new RegExp(`(?:^|\\n)\\s*${escapedName}\\s*[:：]\\s*`, 'g'),
            new RegExp(`(?:^|\\n)\\s*${escapedName}\\s+`, 'g')
        ];
        
        for (const pattern of patterns) {
            cleaned = cleaned.replace(pattern, '\n');
        }
    }
    
    const lines = cleaned.split('\n').filter(line => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        
        for (const otherChar of otherCharacters) {
            if (trimmed.startsWith(otherChar.name) || 
                trimmed.startsWith(`[${otherChar.name}]`) ||
                trimmed.startsWith(otherChar.name + '：') ||
                trimmed.startsWith(otherChar.name + ':') ||
                trimmed.startsWith(otherChar.name + '说')) {
                return false;
            }
        }
        return true;
    });
    
    cleaned = lines.join('\n').trim();
    
    if (!cleaned && content.trim()) {
        cleaned = content.split('\n')[0].trim();
        for (const otherChar of otherCharacters) {
            const patterns = [
                new RegExp(`^\\s*${otherChar.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:：]\\s*`),
                new RegExp(`^\\s*\\[${otherChar.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\]\\s*[:：]\\s*`)
            ];
            for (const pattern of patterns) {
                cleaned = cleaned.replace(pattern, '');
            }
        }
    }
    
    return cleaned;
}

function addGroupBotMessage(content, characterId, save = true) {
    const character = characters.find(c => c.id === characterId);
    const cleanedContent = cleanGroupReply(content, character?.name || '');
    const group = getActiveGroup();
    
    if (save && group) {
        group.messages.push({ role: 'assistant', content: cleanedContent, characterId });
        saveGroups();
    }

    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.setAttribute('data-character-id', characterId);
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            ${character?.avatar?.startsWith('data:') ? `<img src="${character.avatar}" alt="avatar">` : `<span style="font-size: 1.2rem;">${character?.avatar || '👤'}</span>`}
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text markdown-body">${renderMarkdown(cleanedContent)}</div>
            </div>
            <div class="message-info">${getAvatarDisplay(character?.avatar || '👤')} ${character?.name || 'AI'}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addErrorMessage(content) {
    const char = getActiveCharacter();
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            ${char?.avatar?.startsWith('data:') ? `<img src="${char.avatar}" alt="avatar">` : `<span style="font-size: 1.2rem;">${char?.avatar || '🌿'}</span>`}
        </div>
        <div class="message-content">
            <div class="message-bubble" style="background-color: rgba(239, 68, 68, 0.2); border-left: 3px solid #ef4444;">
                <div class="message-text" style="color: #fca5a5;">${escapeHtml(content)}</div>
            </div>
            <div class="message-info">错误</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addGroupErrorMessage(content, characterId) {
    const character = characters.find(c => c.id === characterId);
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            ${character?.avatar?.startsWith('data:') ? `<img src="${character.avatar}" alt="avatar">` : `<span style="font-size: 1.2rem;">${character?.avatar || '👤'}</span>`}
        </div>
        <div class="message-content">
            <div class="message-bubble" style="background-color: rgba(239, 68, 68, 0.2); border-left: 3px solid #ef4444;">
                <div class="message-text" style="color: #fca5a5;">${escapeHtml(content)}</div>
            </div>
            <div class="message-info">错误 - ${character?.name || 'AI'}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// ========== 流式渲染性能优化 ==========
// 缓存DOM元素引用，避免每个chunk都querySelector；用requestAnimationFrame合并一帧内的多次更新
let _streamingContent = '';
let _streamingRafId = null;
let _streamingTextEl = null;
let _streamingFinalized = false;

function resetStreamingCache() {
    if (_streamingRafId !== null) {
        cancelAnimationFrame(_streamingRafId);
        _streamingRafId = null;
    }
    _streamingTextEl = null;
    _streamingContent = '';
    _streamingFinalized = false;
}

function _getOrCreateStreamingElement() {
    if (_streamingTextEl && document.contains(_streamingTextEl)) {
        return _streamingTextEl;
    }
    const char = getActiveCharacter();
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            ${char?.avatar?.startsWith('data:') ? `<img src="${char.avatar}" alt="avatar">` : `<span style="font-size: 1.2rem;">${char?.avatar || '🌿'}</span>`}
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text"></div>
            </div>
            <div class="message-info">${getAvatarDisplay(char?.avatar || '🌿')} ${char?.name || 'AI'}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    _streamingTextEl = messageDiv.querySelector('.message-text');
    return _streamingTextEl;
}

function updateStreamingMessage(content) {
    // finalize 之后任何更新都忽略，避免纯文本覆盖 Markdown
    if (_streamingFinalized) return;
    _streamingContent = content;
    // 一帧内只渲染一次，避免高频chunk导致DOM过载
    if (_streamingRafId !== null) return;
    _streamingRafId = requestAnimationFrame(() => {
        _streamingRafId = null;
        if (_streamingFinalized) return;
        const el = _getOrCreateStreamingElement();
        // 空内容时显示思考占位
        if (!_streamingContent) {
            el.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">正在思考...</span>';
        } else {
            el.innerHTML = renderStreamingText(_streamingContent);
        }
        scrollToBottom();
    });
}

function updateGroupStreamingMessage(content, characterId) {
    const chatMessages = document.getElementById('chatMessages');
    const character = characters.find(c => c.id === characterId);

    const lastMessage = chatMessages.querySelector('.message.bot:last-child');

    if (lastMessage && lastMessage.getAttribute('data-character-id') === characterId) {
        const textElement = lastMessage.querySelector('.message-text');
        if (textElement) {
            textElement.innerHTML = renderStreamingText(content);
        }
        scrollToBottom();
        return;
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.setAttribute('data-character-id', characterId);
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            ${character?.avatar?.startsWith('data:') ? `<img src="${character.avatar}" alt="avatar">` : `<span style="font-size: 1.2rem;">${character?.avatar || '👤'}</span>`}
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${renderStreamingText(content)}</div>
            </div>
            <div class="message-info">${getAvatarDisplay(character?.avatar || '👤')} ${character?.name || 'AI'}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function showTypingIndicator(character) {
    const typingIndicator = document.getElementById('typingIndicator');
    const typingAvatar = typingIndicator.querySelector('.typing-avatar');
    
    if (character) {
        typingAvatar.innerHTML = character.avatar.startsWith('data:') 
            ? `<img src="${character.avatar}" alt="avatar">` 
            : `<span style="font-size: 1.2rem;">${character.avatar}</span>`;
    } else {
        const char = getActiveCharacter();
        typingAvatar.innerHTML = char?.avatar?.startsWith('data:') 
            ? `<img src="${char.avatar}" alt="avatar">` 
            : `<span style="font-size: 1.2rem;">${char?.avatar || '🌿'}</span>`;
    }
    
    typingIndicator.classList.remove('hidden');
}

function hideTypingIndicator() {
    document.getElementById('typingIndicator').classList.add('hidden');
}

function scrollToBottom() {
    const chatContainer = document.querySelector('.chat-container');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showToast(message, type = 'error') {
    const toast = document.getElementById('errorToast');
    const messageElement = document.getElementById('errorMessage');

    messageElement.textContent = message;
    
    if (type === 'success') {
        toast.className = 'toast success';
    } else {
        toast.className = 'toast error';
    }

    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function renderMarkdown(text) {
    try {
        if (typeof marked !== 'undefined' && marked.parse) {
            try {
                // marked v12+ API
                marked.use({ gfm: true, breaks: true });
            } catch (_) {
                // v11 及更早版本
                marked.setOptions({ gfm: true, breaks: true });
            }
            return marked.parse(text);
        }
    } catch (e) {
        console.warn('marked 解析失败，使用内置解析:', e);
    }
    // 内置轻量 Markdown 解析：处理常见语法
    return simpleMarkdownParse(text);
}

function simpleMarkdownParse(text) {
    let html = text;
    // 先转义 HTML
    const div = document.createElement('div');
    div.textContent = html;
    html = div.innerHTML;

    // 代码块 ``` ... ```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function(_, lang, code) {
        return `<pre><code>${code}</code></pre>`;
    });
    // 行内代码 `code`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // ***bold italic***
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    // **bold**
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // *italic*
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // __bold__
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    // _italic_
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
    // ~~strikethrough~~
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    // [text](url) 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    // 标题 # ## ###
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    // 有序列表 1. item
    html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    // 无序列表 - item
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    // 列表包裹
    if (html.includes('<li>')) {
        html = html.replace(/(<li>.*<\/li>\n?)+/g, function(match) {
            return '<ul>' + match + '</ul>';
        });
    }
    // 引用 >
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
    // 换行
    html = html.replace(/\n/g, '<br>');
    // 水平线
    html = html.replace(/^---$/gm, '<hr>');
    return html;
}

// 轻量级纯文本渲染：仅转义HTML并转换换行，用于流式传输过程中
function renderStreamingText(content) {
    const div = document.createElement('div');
    div.textContent = content;
    return div.innerHTML.replace(/\n/g, '<br>');
}

// 流式传输完成后，对最后一条消息进行Markdown渲染
function finalizeStreamingMessage(content) {
    // 标记为已结束：后续 RAF 回调与 updateStreamingMessage 都不生效
    _streamingFinalized = true;
    // 取消待执行的轻量渲染
    if (_streamingRafId !== null) {
        cancelAnimationFrame(_streamingRafId);
        _streamingRafId = null;
    }
    const el = _getOrCreateStreamingElement();
    el.className = 'message-text markdown-body';
    el.innerHTML = renderMarkdown(content);
    scrollToBottom();
    // 重置缓存，供下次流式使用
    _streamingTextEl = null;
    _streamingContent = '';
}

async function callDeepSeekAPI(userMessage, userImages = [], apiKey, character) {
    resetStreamingCache();
    const apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'https://api.deepseek.com/v1';
    const useProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY) === 'true';
    const proxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL) || '';
    const model = document.getElementById('modelSelect').value;
    const useVision = isVisionModel(model);

    // 只保留最近12条消息，避免上下文过长导致响应变慢
    const recentMessages = character.messages.slice(-12);

    // 构建请求消息：多模态模型用 content 数组（支持图），纯文本模型走纯字符串
    const requestMessages = [];
    requestMessages.push({ role: 'system', content: character.systemPrompt });
    for (const msg of recentMessages) {
        if (useVision && Array.isArray(msg.content)) {
            // 多模态：原样传入（但仅最后一条用户消息带图片，之前的图可能太大，保留最近1轮用户图即可）
            requestMessages.push({ role: msg.role, content: msg.content });
        } else {
            // 纯文本模型：统一取纯文本
            requestMessages.push({ role: msg.role, content: contentToText(msg.content) });
        }
    }

    const payload = {
        model: model,
        messages: requestMessages,
        stream: false,
        temperature: 0.7,
        max_tokens: 4096
    };

    let fetchUrl = `${apiUrl}/chat/completions`;
    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    };

    if (useProxy && proxyUrl) {
        fetchUrl = proxyUrl;
        fetchOptions.headers['X-Deepseek-Key'] = apiKey;
        fetchOptions.headers['X-Deepseek-Base-Url'] = apiUrl;
    } else {
        fetchOptions.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // 提前创建一个空的 bot 消息元素，让用户看到"正在回复"的占位
    updateStreamingMessage('');

    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
        finalizeStreamingMessage(content);
        const lastMsg = character.messages[character.messages.length - 1];
        if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content !== content) {
            character.messages.push({ role: 'assistant', content });
            saveCharacters();
        }
    } else {
        // 模型返回空内容（可能是被 content filter 拦截）
        const finishReason = data.choices?.[0]?.finish_reason;
        const errMsg = finishReason === 'content_filter'
            ? '回复被内容过滤拦截，请尝试换个说法'
            : '收到空回复，请重试';
        if (data.error) {
            throw new Error(data.error.message || errMsg);
        }
        // 没有错误但内容为空，作为兜底显示提示
        finalizeStreamingMessage(`*[空回复：${errMsg}]*`);
    }
}

async function callGroupDeepSeekAPI(userMessage, userImages = [], apiKey, character, group, position = 1, speakingOrder = []) {
    const apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'https://api.deepseek.com/v1';
    const useProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY) === 'true';
    const proxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL) || '';
    const model = document.getElementById('modelSelect').value;
    const useVision = isVisionModel(model);

    const recentMessages = group.messages.slice(-10);
    
    const groupMessages = [];
    for (const msg of recentMessages) {
        const text = contentToText(msg.content);
        if (msg.role === 'assistant') {
            const speakerName = characters.find(c => c.id === msg.characterId)?.name || 'AI';
            groupMessages.push({
                role: 'user',
                content: `[${speakerName}的发言] ${text}`
            });
        } else if (useVision && Array.isArray(msg.content)) {
            // 最近一条用户图保留
            groupMessages.push({ role: 'user', content: msg.content });
        } else {
            groupMessages.push({ role: 'user', content: text });
        }
    }

    const memberNames = group.members.map(mid => characters.find(c => c.id === mid)?.name).filter(Boolean).join('、');
    
    const previousSpeakers = speakingOrder.slice(0, position - 1).map(id => {
        const char = characters.find(c => c.id === id);
        return char?.name || '未知';
    }).join('、');
    
    let positionHint = '';
    if (position === 1) {
        positionHint = '你是第一个发言的成员。请直接回应用户的消息。';
    } else {
        positionHint = `你是第${position}个发言的成员。在你之前，${previousSpeakers}已经发过言了。请仔细阅读他们的发言内容，并在你的回复中回应他们的观点或继续讨论。`;
    }
    
    // 最后一条：用户发送的内容（带图片时用数组形式）
    const lastUserMsg = { role: 'user', content: buildContentMessage(userMessage, (useVision && position === 1) ? userImages : []) };

    const requestMessages = [
        { role: 'system', content: `你是${character.name}，${character.systemPrompt}

群聊规则（必须严格遵守）：
1. 你只能回复你自己的话，绝对不能替其他角色发言。
2. 你只能输出一段文字，就是你自己想说的话。
3. 不要包含任何其他角色的名字或对话内容。
4. 不要使用格式如"角色名："或"角色名说："。
5. 直接说你的内容，不需要前缀。
6. 不要重复你之前说过的话。

当前发言提示：
${positionHint}` },
        ...groupMessages,
        lastUserMsg
    ];

    const randomSeed = Date.now() + Math.floor(Math.random() * 1000000);

    const payload = {
        model: model,
        messages: requestMessages,
        stream: false,
        temperature: 0.9,
        seed: randomSeed,
        max_tokens: 4096
    };

    let fetchUrl = `${apiUrl}/chat/completions`;
    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    };

    if (useProxy && proxyUrl) {
        fetchUrl = proxyUrl;
        fetchOptions.headers['X-Deepseek-Key'] = apiKey;
        fetchOptions.headers['X-Deepseek-Base-Url'] = apiUrl;
    } else {
        fetchOptions.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
        addGroupBotMessage(content, character.id);
    }
}

async function callProactiveAPI(apiKey, character) {
    resetStreamingCache();
    const apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'https://api.deepseek.com/v1';
    const useProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY) === 'true';
    const proxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL) || '';
    const model = document.getElementById('modelSelect').value;
    const useVision = isVisionModel(model);

    // 主动对话不需要图片输入，但对 vision 模型可保留最近 1 轮的图片以防上下文；纯文本模型强制字符串
    const historyMsgs = character.messages.slice(-10).map(msg => {
        if (useVision) return { role: msg.role, content: msg.content };
        return { role: msg.role, content: contentToText(msg.content) };
    });

    const requestMessages = [
        { role: 'system', content: `${character.systemPrompt}\n\n现在，根据你的性格和之前的对话上下文，主动发起一个话题或问候用户。不要等待用户提问，直接以你的角色身份开口说话。保持对话自然流畅，就像朋友之间聊天一样。` },
        ...historyMsgs,
        { role: 'user', content: '请主动发起对话，根据你的性格和当前情境，主动跟我聊一个话题。' }
    ];

    const payload = {
        model: model,
        messages: requestMessages,
        stream: false,
        temperature: 0.8,
        max_tokens: 4096
    };

    let fetchUrl = `${apiUrl}/chat/completions`;
    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    };

    if (useProxy && proxyUrl) {
        fetchUrl = proxyUrl;
        fetchOptions.headers['X-Deepseek-Key'] = apiKey;
        fetchOptions.headers['X-Deepseek-Base-Url'] = apiUrl;
    } else {
        fetchOptions.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // 提前创建空 bot 消息元素作为"正在回复"占位
    // （showTypingIndicator 已经在调用方显示了等待动画，这里不重复占位）

    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
        finalizeStreamingMessage(content);
        const lastMsg = character.messages[character.messages.length - 1];
        if (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content !== content) {
            character.messages.push({ role: 'assistant', content });
            saveCharacters();
        }
    } else {
        // 模型返回空内容（可能是被 content filter 拦截）
        const finishReason = data.choices?.[0]?.finish_reason;
        const errMsg = finishReason === 'content_filter'
            ? '回复被内容过滤拦截，请尝试换个说法'
            : '收到空回复，请重试';
        if (data.error) {
            throw new Error(data.error.message || errMsg);
        }
        // 没有错误但内容为空，作为兜底显示提示
        finalizeStreamingMessage(`*[空回复：${errMsg}]*`);
    }
}

async function callProactiveGroupAPI(apiKey, character, group) {
    const apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'https://api.deepseek.com/v1';
    const useProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY) === 'true';
    const proxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL) || '';
    const model = document.getElementById('modelSelect').value;
    const useVision = isVisionModel(model);

    const recentMessages = group.messages.slice(-10);
    
    const groupMessages = [];
    for (const msg of recentMessages) {
        const text = contentToText(msg.content);
        if (msg.role === 'assistant') {
            const speakerName = characters.find(c => c.id === msg.characterId)?.name || 'AI';
            groupMessages.push({
                role: 'user',
                content: `[${speakerName}的发言] ${text}`
            });
        } else if (useVision && Array.isArray(msg.content)) {
            groupMessages.push({ role: 'user', content: msg.content });
        } else {
            groupMessages.push({
                role: 'user',
                content: text
            });
        }
    }

    const memberNames = group.members.map(mid => characters.find(c => c.id === mid)?.name).filter(Boolean).join('、');
    
    const requestMessages = [
        { role: 'system', content: `你是${character.name}，${character.systemPrompt}

群聊规则（必须严格遵守）：
1. 你只能回复你自己的话，绝对不能替其他角色发言。
2. 你只能输出一段文字，就是你自己想说的话。
3. 不要包含任何其他角色的名字或对话内容。
4. 不要使用格式如"角色名："或"角色名说："。
5. 直接说你的内容，不需要前缀。
6. 不要重复你之前说过的话。

现在，根据你的性格和之前的群聊上下文，主动发起一个话题或问候群成员。你可以回应其他成员之前的发言，或者提出一个新的话题让大家讨论。` },
        ...groupMessages,
        { role: 'user', content: `请${character.name}主动发起对话，可以回应其他成员的发言，或者提出一个新话题让大家讨论。` }
    ];

    const randomSeed = Date.now() + Math.floor(Math.random() * 1000000);

    const payload = {
        model: model,
        messages: requestMessages,
        stream: false,
        temperature: 0.9,
        seed: randomSeed,
        max_tokens: 4096
    };

    let fetchUrl = `${apiUrl}/chat/completions`;
    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    };

    if (useProxy && proxyUrl) {
        fetchUrl = proxyUrl;
        fetchOptions.headers['X-Deepseek-Key'] = apiKey;
        fetchOptions.headers['X-Deepseek-Base-Url'] = apiUrl;
    } else {
        fetchOptions.headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
        addGroupBotMessage(content, character.id);
    }
}