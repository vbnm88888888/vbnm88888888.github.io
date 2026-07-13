const STORAGE_KEY_API_KEY = 'deepseek_api_key';
const STORAGE_KEY_API_URL = 'deepseek_api_url';
const STORAGE_KEY_MODEL = 'deepseek_model';
const STORAGE_KEY_USE_PROXY = 'deepseek_use_proxy';
const STORAGE_KEY_PROXY_URL = 'deepseek_proxy_url';

let messages = [];
let isStreaming = false;

document.addEventListener('DOMContentLoaded', () => {
    initSettings();
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

    document.getElementById('settingsModal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            closeSettings();
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

    addUserMessage(message);

    isStreaming = true;
    showTypingIndicator();

    try {
        await callDeepSeekAPI(message, apiKey);
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

function addUserMessage(content) {
    messages.push({ role: 'user', content });

    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="avatar user-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
            </svg>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(content)}</div>
            </div>
            <div class="message-info">你</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addBotMessage(content) {
    messages.push({ role: 'assistant', content });

    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                <path d="M12 17h.01"></path>
            </svg>
        </div>
        <div class="message-content">
            <div class="message-bubble">
                <div class="message-text">${escapeHtml(content)}</div>
            </div>
            <div class="message-info">DeepSeek ${document.getElementById('modelSelect').value}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

function addErrorMessage(content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    messageDiv.innerHTML = `
        <div class="avatar bot-avatar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
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
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                    <path d="M12 17h.01"></path>
                </svg>
            </div>
            <div class="message-content">
                <div class="message-bubble">
                    <div class="message-text">${escapeHtml(content)}</div>
                </div>
                <div class="message-info">DeepSeek ${document.getElementById('modelSelect').value}</div>
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
        toast.style.backgroundColor = '#22c55e';
    } else {
        toast.style.backgroundColor = '#ef4444';
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

async function callDeepSeekAPI(userMessage, apiKey) {
    const apiUrl = localStorage.getItem(STORAGE_KEY_API_URL) || 'https://api.deepseek.com/v1';
    const useProxy = localStorage.getItem(STORAGE_KEY_USE_PROXY) === 'true';
    const proxyUrl = localStorage.getItem(STORAGE_KEY_PROXY_URL) || '';
    const model = document.getElementById('modelSelect').value;

    const requestMessages = [
        { role: 'system', content: '你是一个智能助手，使用自然、友好的语言回答用户问题。' },
        ...messages,
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
                    addBotMessage(fullResponse);
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
        addBotMessage(fullResponse);
    }
}