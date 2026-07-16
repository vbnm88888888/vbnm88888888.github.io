const STORAGE_KEY_API_KEY = 'deepseek_api_key';
const STORAGE_KEY_API_URL = 'deepseek_api_url';
const STORAGE_KEY_MODEL = 'deepseek_model';
const STORAGE_KEY_USE_PROXY = 'deepseek_use_proxy';
const STORAGE_KEY_PROXY_URL = 'deepseek_proxy_url';
const STORAGE_KEY_CHARACTERS = 'deepseek_characters';
const STORAGE_KEY_GROUPS = 'deepseek_groups';
const STORAGE_KEY_ACTIVE_CONTEXT = 'deepseek_active_context';
const STORAGE_KEY_CONTEXT_TYPE = 'deepseek_context_type';

let characters = [];
let groups = [];
let activeContextId = null;
let activeContextType = 'character';
let isStreaming = false;
let currentEditingCharacterId = null;
let currentAvatarDataUrl = null;
let currentEditingGroupId = null;

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
    const nameEl = document.querySelector('.current-character-name');
    const descEl = document.querySelector('.current-character-desc');
    const chatTypeBadge = document.getElementById('chatTypeBadge');

    if (activeContextType === 'group') {
        const group = getActiveGroup();
        if (group) {
            nameEl.textContent = `💬 ${group.name}`;
            descEl.textContent = `群成员：${group.members.map(m => characters.find(c => c.id === m)?.name || m).join(', ')}`;
            chatTypeBadge.textContent = '群聊';
            chatTypeBadge.style.backgroundColor = '#f59e0b';
        }
    } else {
        const char = getActiveCharacter();
        if (char) {
            nameEl.textContent = `${getAvatarDisplay(char.avatar)} ${char.name}`;
            descEl.textContent = char.description;
            chatTypeBadge.textContent = '私聊';
            chatTypeBadge.style.backgroundColor = '#10b981';
        }
    }
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

    sendBtn.disabled = !input || !hasApiKey || isStreaming;
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

    if (!message || isStreaming) return;

    const apiKey = localStorage.getItem(STORAGE_KEY_API_KEY);
    if (!apiKey) {
        showToast('请先在设置中输入 API Key');
        openSettings();
        return;
    }

    input.value = '';
    input.style.height = 'auto';
    document.getElementById('sendBtn').disabled = true;

    isStreaming = true;

    if (activeContextType === 'group') {
        await sendGroupMessage(message, apiKey);
    } else {
        await sendCharacterMessage(message, apiKey);
    }

    isStreaming = false;
    handleInput();
}

async function sendCharacterMessage(message, apiKey) {
    const char = getActiveCharacter();
    char.messages.push({ role: 'user', content: message });
    saveCharacters();
    addUserMessage(message);

    showTypingIndicator();

    try {
        await callDeepSeekAPI(message, apiKey, char);
    } catch (error) {
        console.error('API Error:', error);
        showToast(error.message || 'API 请求失败');
        addErrorMessage(error.message || 'API 请求失败');
    } finally {
        hideTypingIndicator();
    }
}

async function sendGroupMessage(message, apiKey) {
    const group = getActiveGroup();
    group.messages.push({ role: 'user', content: message });
    saveGroups();
    addUserMessage(message);

    for (const memberId of group.members) {
        const member = characters.find(c => c.id === memberId);
        if (!member) continue;

        showTypingIndicator(member);

        try {
            await callGroupDeepSeekAPI(message, apiKey, member, group);
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

    if (activeContextType === 'group') {
        await triggerProactiveGroupChat(apiKey);
    } else {
        await triggerProactiveCharacterChat(apiKey);
    }

    isStreaming = false;
    document.getElementById('proactiveChatBtn').disabled = false;
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

function addUserMessage(content, save = true) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="avatar user-avatar">
            <span style="font-size: 1.2rem;">🌟</span>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(content)}</div>
            </div>
            <div class="message-info">你 🌟</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
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
                <div class="message-text">${escapeHtml(content)}</div>
            </div>
            <div class="message-info">${getAvatarDisplay(char?.avatar || '🌿')} ${char?.name || 'AI'}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addGroupBotMessage(content, characterId, save = true) {
    const character = characters.find(c => c.id === characterId);
    const group = getActiveGroup();
    
    if (save && group) {
        group.messages.push({ role: 'assistant', content, characterId });
        saveGroups();
    }

    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            ${character?.avatar?.startsWith('data:') ? `<img src="${character.avatar}" alt="avatar">` : `<span style="font-size: 1.2rem;">${character?.avatar || '👤'}</span>`}
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(content)}</div>
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

function updateStreamingMessage(content) {
    const chatMessages = document.getElementById('chatMessages');
    const lastMessage = chatMessages.querySelector('.message.bot:last-child');
    const char = getActiveCharacter();

    if (lastMessage) {
        const textElement = lastMessage.querySelector('.message-text');
        if (textElement) {
            textElement.innerHTML = escapeHtml(content);
        }
    } else {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot';
        messageDiv.innerHTML = `
            <div class="avatar bot-avatar">
                ${char?.avatar?.startsWith('data:') ? `<img src="${char.avatar}" alt="avatar">` : `<span style="font-size: 1.2rem;">${char?.avatar || '🌿'}</span>`}
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    <div class="message-text">${escapeHtml(content)}</div>
                </div>
                <div class="message-info">${getAvatarDisplay(char?.avatar || '🌿')} ${char?.name || 'AI'}</div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
    }
    scrollToBottom();
}

function updateGroupStreamingMessage(content, characterId) {
    const chatMessages = document.getElementById('chatMessages');
    const character = characters.find(c => c.id === characterId);
    
    const lastMessage = chatMessages.querySelector('.message.bot:last-child');
    
    if (lastMessage) {
        const infoElement = lastMessage.querySelector('.message-info');
        if (infoElement && infoElement.textContent.includes(character?.name || 'AI')) {
            const textElement = lastMessage.querySelector('.message-text');
            if (textElement) {
                textElement.innerHTML = escapeHtml(content);
            }
            scrollToBottom();
            return;
        }
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            ${character?.avatar?.startsWith('data:') ? `<img src="${character.avatar}" alt="avatar">` : `<span style="font-size: 1.2rem;">${character?.avatar || '👤'}</span>`}
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(content)}</div>
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

async function callDeepSeekAPI(userMessage, apiKey, character) {
    const apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'https://api.deepseek.com/v1';
    const useProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY) === 'true';
    const proxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL) || '';
    const model = document.getElementById('modelSelect').value;

    const requestMessages = [
        { role: 'system', content: character.systemPrompt },
        ...character.messages,
        { role: 'user', content: userMessage }
    ];

    const payload = {
        model: model,
        messages: requestMessages,
        stream: true,
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

    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';

    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                    if (fullResponse) {
                        updateStreamingMessage(fullResponse);
                        character.messages.push({ role: 'assistant', content: fullResponse });
                        saveCharacters();
                    }
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    
                    if (content) {
                        fullResponse += content;
                        updateStreamingMessage(fullResponse);
                    }
                } catch (e) {
                    console.warn('Failed to parse chunk:', e);
                }
            }
        }
    }

    if (fullResponse) {
        const chatMessages = document.getElementById('chatMessages');
        const existingMessage = chatMessages.querySelector('.message.bot:last-child');
        if (!existingMessage || !existingMessage.querySelector('.message-text').textContent) {
            addBotMessage(fullResponse);
        } else {
            character.messages.push({ role: 'assistant', content: fullResponse });
            saveCharacters();
        }
    }
}

async function callGroupDeepSeekAPI(userMessage, apiKey, character, group) {
    const apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'https://api.deepseek.com/v1';
    const useProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY) === 'true';
    const proxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL) || '';
    const model = document.getElementById('modelSelect').value;

    const groupMessages = group.messages.map(msg => ({
        role: msg.role,
        content: msg.role === 'assistant' 
            ? `[${characters.find(c => c.id === msg.characterId)?.name || 'AI'}]: ${msg.content}`
            : msg.content
    }));

    const requestMessages = [
        { role: 'system', content: `你正在参与一个名为"${group.name}"的群聊。${character.systemPrompt} 在群聊中，你需要以${character.name}的身份回复用户的消息。` },
        ...groupMessages,
        { role: 'user', content: userMessage }
    ];

    const payload = {
        model: model,
        messages: requestMessages,
        stream: true,
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

    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';

    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                    if (fullResponse) {
                        updateGroupStreamingMessage(fullResponse, character.id);
                        group.messages.push({ role: 'assistant', content: fullResponse, characterId: character.id });
                        saveGroups();
                    }
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    
                    if (content) {
                        fullResponse += content;
                        updateGroupStreamingMessage(fullResponse, character.id);
                    }
                } catch (e) {
                    console.warn('Failed to parse chunk:', e);
                }
            }
        }
    }

    if (fullResponse) {
        group.messages.push({ role: 'assistant', content: fullResponse, characterId: character.id });
        saveGroups();
    }
}

async function callProactiveAPI(apiKey, character) {
    const apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'https://api.deepseek.com/v1';
    const useProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY) === 'true';
    const proxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL) || '';
    const model = document.getElementById('modelSelect').value;

    const requestMessages = [
        { role: 'system', content: `${character.systemPrompt}\n\n现在，根据你的性格和之前的对话上下文，主动发起一个话题或问候用户。不要等待用户提问，直接以你的角色身份开口说话。保持对话自然流畅，就像朋友之间聊天一样。` },
        ...character.messages.slice(-10).map(msg => ({
            role: msg.role,
            content: msg.content
        })),
        { role: 'user', content: '请主动发起对话，根据你的性格和当前情境，主动跟我聊一个话题。' }
    ];

    const payload = {
        model: model,
        messages: requestMessages,
        stream: true,
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

    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';

    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                    if (fullResponse) {
                        const chatMessages = document.getElementById('chatMessages');
                        const existingMessage = chatMessages.querySelector('.message.bot:last-child');
                        if (!existingMessage || !existingMessage.querySelector('.message-text').textContent) {
                            addBotMessage(fullResponse);
                        } else {
                            character.messages.push({ role: 'assistant', content: fullResponse });
                            saveCharacters();
                        }
                    }
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    
                    if (content) {
                        fullResponse += content;
                        updateStreamingMessage(fullResponse);
                    }
                } catch (e) {
                    console.warn('Failed to parse chunk:', e);
                }
            }
        }
    }

    if (fullResponse) {
        character.messages.push({ role: 'assistant', content: fullResponse });
        saveCharacters();
    }
}

async function callProactiveGroupAPI(apiKey, character, group) {
    const apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'https://api.deepseek.com/v1';
    const useProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY) === 'true';
    const proxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL) || '';
    const model = document.getElementById('modelSelect').value;

    const groupMessages = group.messages.map(msg => ({
        role: msg.role,
        content: msg.role === 'assistant' 
            ? `[${characters.find(c => c.id === msg.characterId)?.name || 'AI'}]: ${msg.content}`
            : msg.content
    }));

    const requestMessages = [
        { role: 'system', content: `你正在参与一个名为"${group.name}"的群聊。${character.systemPrompt}\n\n现在，根据你的性格和之前的群聊上下文，主动发起一个话题或问候群成员。不要等待用户提问，直接以${character.name}的身份开口说话。保持对话自然流畅。` },
        ...groupMessages,
        { role: 'user', content: `请${character.name}主动发起对话，根据你的性格和当前情境，主动跟群里的人聊一个话题。` }
    ];

    const payload = {
        model: model,
        messages: requestMessages,
        stream: true,
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

    const response = await fetch(fetchUrl, fetchOptions);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let fullResponse = '';

    while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                
                if (data === '[DONE]') {
                    if (fullResponse) {
                        updateGroupStreamingMessage(fullResponse, character.id);
                        group.messages.push({ role: 'assistant', content: fullResponse, characterId: character.id });
                        saveGroups();
                    }
                    return;
                }

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;
                    
                    if (content) {
                        fullResponse += content;
                        updateGroupStreamingMessage(fullResponse, character.id);
                    }
                } catch (e) {
                    console.warn('Failed to parse chunk:', e);
                }
            }
        }
    }

    if (fullResponse) {
        group.messages.push({ role: 'assistant', content: fullResponse, characterId: character.id });
        saveGroups();
    }
}