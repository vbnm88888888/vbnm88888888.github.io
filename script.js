const STORAGE_KEY_API_KEY = 'deepseek_api_key';
const STORAGE_KEY_API_URL = 'deepseek_api_url';
const STORAGE_KEY_MODEL = 'deepseek_model';
const STORAGE_KEY_USE_PROXY = 'deepseek_use_proxy';
const STORAGE_KEY_PROXY_URL = 'deepseek_proxy_url';
const STORAGE_KEY_CHARACTERS = 'deepseek_characters';
const STORAGE_KEY_ACTIVE_CHARACTER = 'deepseek_active_character';

let characters = [];
let activeCharacterId = null;
let isStreaming = false;

const defaultCharacters = [
    {
        id: 'default',
        name: '🌸 Pink AI',
        avatar: '💖',
        description: '一个温柔可爱的AI助手',
        systemPrompt: '你是一个温柔可爱的AI助手，说话甜美，喜欢用表情符号，像一个贴心的朋友。',
        messages: []
    },
    {
        id: 'maid',
        name: '💕 女仆酱',
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
    initCharacters();
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

function initCharacters() {
    const savedCharacters = localStorage.getItem(STORAGE_KEY_CHARACTERS);
    const savedActiveId = localStorage.getItem(STORAGE_KEY_ACTIVE_CHARACTER);

    if (savedCharacters) {
        characters = JSON.parse(savedCharacters);
    } else {
        characters = [...defaultCharacters];
        saveCharacters();
    }

    if (savedActiveId && characters.find(c => c.id === savedActiveId)) {
        activeCharacterId = savedActiveId;
    } else {
        activeCharacterId = characters[0].id;
    }

    renderCharacterSelector();
    loadActiveCharacter();
}

function saveCharacters() {
    localStorage.setItem(STORAGE_KEY_CHARACTERS, JSON.stringify(characters));
}

function saveActiveCharacter() {
    localStorage.setItem(STORAGE_KEY_ACTIVE_CHARACTER, activeCharacterId);
}

function getActiveCharacter() {
    return characters.find(c => c.id === activeCharacterId);
}

function renderCharacterSelector() {
    const selector = document.getElementById('characterSelect');
    selector.innerHTML = '';

    characters.forEach(char => {
        const option = document.createElement('option');
        option.value = char.id;
        option.textContent = `${char.avatar} ${char.name}`;
        if (char.id === activeCharacterId) {
            option.selected = true;
        }
        selector.appendChild(option);
    });

    updateCharacterDisplay();
}

function updateCharacterDisplay() {
    const char = getActiveCharacter();
    if (!char) return;

    document.querySelector('.current-character-name').textContent = `${char.avatar} ${char.name}`;
    document.querySelector('.current-character-desc').textContent = char.description;
}

function loadActiveCharacter() {
    const char = getActiveCharacter();
    if (!char) return;

    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = '';

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

function addWelcomeMessage(char) {
    const chatMessages = document.getElementById('chatMessages');
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
        <div class="avatar bot-avatar">
            <span style="font-size: 1.5rem;">${char.avatar}</span>
        </div>
        <div class="message-content">
            <div class="message-text">
                🌸 嗨~ 我是 ${char.name}！<br>
                ✨ ${char.description}，快来和我聊天吧~
            </div>
            <div class="message-info">${char.avatar} ${char.name}</div>
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

    document.getElementById('characterSelect').addEventListener('change', handleCharacterChange);
    document.getElementById('manageCharactersBtn').addEventListener('click', openCharacterManager);
    document.getElementById('closeCharacterManager').addEventListener('click', closeCharacterManager);
    document.getElementById('addCharacterBtn').addEventListener('click', openAddCharacter);
    document.getElementById('saveNewCharacter').addEventListener('click', saveNewCharacter);
    document.getElementById('cancelNewCharacter').addEventListener('click', closeAddCharacter);

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

function handleCharacterChange(e) {
    activeCharacterId = e.target.value;
    saveActiveCharacter();
    loadActiveCharacter();
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
        const item = document.createElement('div');
        item.className = 'character-item' + (char.id === activeCharacterId ? ' active' : '');
        item.innerHTML = `
            <div class="character-avatar">${char.avatar}</div>
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
    const saveBtn = document.getElementById('saveNewCharacter');

    if (editId) {
        const char = characters.find(c => c.id === editId);
        title.textContent = '编辑角色';
        idInput.value = char.id;
        idInput.disabled = true;
        nameInput.value = char.name;
        avatarInput.value = char.avatar;
        descInput.value = char.description;
        promptInput.value = char.systemPrompt;
        saveBtn.onclick = () => updateCharacter(editId);
    } else {
        title.textContent = '添加角色';
        idInput.value = '';
        idInput.disabled = false;
        nameInput.value = '';
        avatarInput.value = '💖';
        descInput.value = '';
        promptInput.value = '你是一个智能助手，使用自然、友好的语言回答用户问题。';
        saveBtn.onclick = saveNewCharacter;
    }

    modal.classList.remove('hidden');
}

function closeAddCharacter() {
    document.getElementById('addCharacterModal').classList.add('hidden');
}

function saveNewCharacter() {
    const id = document.getElementById('newCharacterId').value.trim();
    const name = document.getElementById('newCharacterName').value.trim();
    const avatar = document.getElementById('newCharacterAvatar').value.trim();
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

    characters.push({
        id,
        name,
        avatar: avatar || '💖',
        description: desc || '暂无描述',
        systemPrompt: prompt || '你是一个智能助手。',
        messages: []
    });

    saveCharacters();
    renderCharacterSelector();
    closeAddCharacter();
    closeCharacterManager();
    showToast('角色添加成功！', 'success');
}

function updateCharacter(editId) {
    const name = document.getElementById('newCharacterName').value.trim();
    const avatar = document.getElementById('newCharacterAvatar').value.trim();
    const desc = document.getElementById('newCharacterDesc').value.trim();
    const prompt = document.getElementById('newCharacterPrompt').value.trim();

    if (!name) {
        showToast('请输入角色名称');
        return;
    }

    const charIndex = characters.findIndex(c => c.id === editId);
    if (charIndex !== -1) {
        characters[charIndex] = {
            ...characters[charIndex],
            name,
            avatar: avatar || '💖',
            description: desc || '暂无描述',
            systemPrompt: prompt || '你是一个智能助手。'
        };

        saveCharacters();
        renderCharacterSelector();
        if (editId === activeCharacterId) {
            loadActiveCharacter();
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
        
        if (activeCharacterId === id) {
            activeCharacterId = characters[0]?.id || null;
            saveActiveCharacter();
        }

        saveCharacters();
        renderCharacterSelector();
        renderCharacterList();
        
        if (activeCharacterId) {
            loadActiveCharacter();
        }
        
        showToast('角色已删除', 'success');
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

    const char = getActiveCharacter();
    char.messages.push({ role: 'user', content: message });
    saveCharacters();
    addUserMessage(message);

    isStreaming = true;
    showTypingIndicator();

    try {
        await callDeepSeekAPI(message, apiKey, char);
    } catch (error) {
        console.error('API Error:', error);
        showToast(error.message || 'API 请求失败');
        addErrorMessage(error.message || 'API 请求失败');
    } finally {
        isStreaming = false;
        hideTypingIndicator();
        handleInput();
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
            <span style="font-size: 1.2rem;">${char?.avatar || '💖'}</span>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(content)}</div>
            </div>
            <div class="message-info">${char?.avatar || '💖'} ${char?.name || 'AI'}</div>
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
            <span style="font-size: 1.2rem;">${char?.avatar || '💖'}</span>
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
                <span style="font-size: 1.2rem;">${char?.avatar || '💖'}</span>
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    <div class="message-text">${escapeHtml(content)}</div>
                </div>
                <div class="message-info">${char?.avatar || '💖'} ${char?.name || 'AI'}</div>
            </div>
        `;
        chatMessages.appendChild(messageDiv);
    }
    scrollToBottom();
}

function showTypingIndicator() {
    document.getElementById('typingIndicator').classList.remove('hidden');
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