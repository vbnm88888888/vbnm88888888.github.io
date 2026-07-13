# DeepSeek AI Chat - GitHub Pages 部署教程

## 项目概述

本项目是一个基于 DeepSeek API 的智能聊天应用，可部署到 GitHub Pages，支持在安卓端访问使用。

**主要功能：**
- 🤖 实时与 DeepSeek AI 对话
- 🌊 流式响应输出（打字机效果）
- 📱 完美适配移动端和桌面端
- 🔑 安全的 API Key 本地存储
- ⚙️ 支持切换 DeepSeek V4 Flash/Pro 模型
- 🎨 现代化深色主题设计

---

## 一、准备工作

### 1.1 获取 DeepSeek API Key

1. 访问 [DeepSeek Platform](https://platform.deepseek.com/api_keys)
2. 注册/登录账号
3. 点击 "Create API Key" 创建新的 API Key
4. **复制并妥善保存你的 API Key**（sk-开头）

### 1.2 注册 GitHub 账号

如果你还没有 GitHub 账号：
1. 访问 [github.com](https://github.com)
2. 点击 "Sign up" 注册账号
3. 完成邮箱验证

### 1.3 安装 Git

**Windows 用户：**
1. 下载 [Git for Windows](https://git-scm.com/download/win)
2. 运行安装程序，使用默认选项即可
3. 安装完成后，打开 PowerShell 验证：
   ```powershell
   git --version
   ```

**Mac 用户：**
```bash
xcode-select --install
git --version
```

**Linux 用户：**
```bash
sudo apt update && sudo apt install git
```

---

## 二、创建 GitHub 仓库

### 方法一：使用 GitHub 网页

1. 登录 GitHub
2. 点击右上角 "+" → "New repository"
3. 填写仓库信息：
   - **Repository name**: `<你的用户名>.github.io`
   - **Description**: DeepSeek AI Chat
   - **Visibility**: Public
4. 点击 "Create repository"

### 方法二：使用 GitHub CLI

```powershell
# 安装 GitHub CLI
winget install GitHub.cli

# 登录 GitHub
gh auth login

# 创建仓库
gh repo create <你的用户名>.github.io --public --description "DeepSeek AI Chat"
```

---

## 三、本地配置与部署

### 3.1 本地预览（推荐）

在推送代码前，先在本地验证效果：

**方法一：使用 Python**
```powershell
python -m http.server 8000
```

**方法二：使用 npx serve**
```powershell
npx serve .
```

**方法三：使用 VS Code Live Server**
1. 安装 "Live Server" 扩展
2. 右键点击 `index.html` → "Open with Live Server"

访问 `http://localhost:8000` 查看效果。

### 3.2 克隆仓库

```powershell
git clone https://github.com/<你的用户名>/<你的用户名>.github.io.git
cd <你的用户名>.github.io
```

### 3.3 添加项目文件

将以下文件复制到仓库目录：
- `index.html` - 主页面
- `styles.css` - 样式文件
- `script.js` - 脚本文件
- `README.md` - 项目说明

### 3.4 提交代码

```powershell
git add .
git commit -m "Initial commit: DeepSeek AI Chat"
git push origin main
```

### 3.5 启用 GitHub Pages

1. 进入仓库页面 → Settings → Pages
2. 在 "Source" 部分：
   - **Branch**: 选择 `main`
   - **Folder**: 选择 `/ (root)`
3. 点击 "Save"

**等待部署完成**（约 1-5 分钟），访问 `https://<你的用户名>.github.io`

---

## 四、使用方法

### 4.1 配置 API Key

1. 打开网站后，点击右上角设置按钮 ⚙️
2. 输入你的 DeepSeek API Key
3. 确认 API Base URL 为 `https://api.deepseek.com/v1`
4. 点击 "保存设置"

### 4.2 开始对话

1. 在输入框中输入你的问题
2. 选择模型（DeepSeek V4 Flash 或 V4 Pro）
3. 点击发送按钮或按 Enter 发送
4. 等待 AI 响应（支持流式输出）

### 4.3 模型选择

| 模型 | 特点 | 适用场景 |
|------|------|----------|
| DeepSeek V4 Flash | 快速响应，成本低 | 日常对话、简单问答 |
| DeepSeek V4 Pro | 高质量，推理能力强 | 复杂任务、代码生成 |
| DeepSeek Chat | 旧版模型（即将停用） | 兼容性测试 |
| DeepSeek Reasoner | 旧版推理模型（即将停用） | 兼容性测试 |

---

## 五、CORS 问题与代理方案

### 5.1 问题说明

由于浏览器的 CORS（跨域资源共享）策略限制，直接从前端调用 DeepSeek API 可能会失败，错误信息类似：

```
Access-Control-Allow-Origin header is not present
```

这是因为 DeepSeek API 服务器没有返回允许跨域访问的响应头。

### 5.2 解决方案

**方案一：使用 CORS 代理（推荐）**

部署一个简单的代理服务器来转发请求，添加正确的 CORS 响应头。

#### 5.2.1 Cloudflare Workers 代理（免费）

1. 访问 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 Workers & Pages → Create application → Create Worker
3. 删除默认代码，粘贴以下代码：

```javascript
export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const deepseekKey = request.headers.get('X-Deepseek-Key');
        const deepseekBaseUrl = request.headers.get('X-Deepseek-Base-Url') || 'https://api.deepseek.com/v1';
        
        const targetUrl = `${deepseekBaseUrl}${url.pathname}`;
        
        const modifiedRequest = new Request(targetUrl, {
            method: request.method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekKey}`,
                ...Object.fromEntries(
                    Array.from(request.headers.entries()).filter(
                        ([key]) => !key.startsWith('x-deepseek-')
                    )
                )
            },
            body: request.body,
            redirect: 'follow'
        });

        const response = await fetch(modifiedRequest);
        
        const modifiedResponse = new Response(response.body, {
            status: response.status,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*',
                'Content-Type': response.headers.get('Content-Type') || 'application/json'
            }
        });

        return modifiedResponse;
    }
};
```

4. 点击 "Deploy" 部署
5. 复制 Worker URL（如 `https://your-worker.username.workers.dev`）
6. 在应用设置中启用 "使用 CORS 代理"，并填入代理地址

#### 5.2.2 Vercel Edge Functions 代理（免费）

1. 创建 `api/deepseek.js` 文件：

```javascript
export const config = {
    runtime: 'edge'
};

export default async function handler(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': '*'
            }
        });
    }

    const deepseekKey = request.headers.get('X-Deepseek-Key');
    const deepseekBaseUrl = request.headers.get('X-Deepseek-Base-Url') || 'https://api.deepseek.com/v1';
    
    const url = new URL(request.url);
    const targetUrl = `${deepseekBaseUrl}${url.pathname}`;

    const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekKey}`
        },
        body: request.body
    });

    return new Response(response.body, {
        status: response.status,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': response.headers.get('Content-Type') || 'application/json'
        }
    });
}
```

2. 部署到 Vercel
3. 代理地址为 `https://your-vercel-app.vercel.app/api/deepseek`

**方案二：本地开发环境测试**

在本地开发时，可以使用浏览器扩展或修改浏览器设置来绕过 CORS 限制：
- Chrome: 安装 "CORS Unblock" 扩展
- Firefox: 安装 "CORS Everywhere" 扩展

**方案三：使用后端服务器**

部署一个 Node.js/Python 后端服务器来处理 API 请求，前端只与自己的服务器通信。

---

## 六、DeepSeek API 详解

### 6.1 API 基础信息

| 项目 | 值 |
|------|-----|
| API 地址 | `https://api.deepseek.com/v1` |
| 端点 | `POST /chat/completions` |
| 认证方式 | `Bearer <API_KEY>` |
| 支持模型 | `deepseek-v4-flash`, `deepseek-v4-pro` |

### 6.2 请求参数

```json
{
    "model": "deepseek-v4-flash",
    "messages": [
        {"role": "system", "content": "你是一个智能助手"},
        {"role": "user", "content": "你好"}
    ],
    "stream": true,
    "temperature": 0.7,
    "max_tokens": 4096
}
```

**参数说明：**
- `model`: 模型名称
- `messages`: 对话历史消息数组
- `stream`: 是否启用流式响应（推荐 true）
- `temperature`: 控制随机性（0-2），值越高越随机
- `max_tokens`: 最大生成 token 数

### 6.3 响应格式

**流式响应：**
```
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"你"}}]}
data: {"id":"chatcmpl-xxx","object":"chat.completion.chunk","choices":[{"delta":{"content":"好"}}]}
data: [DONE]
```

**非流式响应：**
```json
{
    "id": "chatcmpl-xxx",
    "choices": [{
        "message": {
            "role": "assistant",
            "content": "你好！我是 DeepSeek AI"
        }
    }],
    "usage": {
        "prompt_tokens": 10,
        "completion_tokens": 15,
        "total_tokens": 25
    }
}
```

### 6.4 速率限制

| 套餐 | 请求限制 |
|------|----------|
| 免费版 | 100 请求/分钟 |
| Pro 版 | 1000 请求/分钟 |
| 企业版 | 自定义 |

### 6.5 错误处理

常见错误码：
- `401 Unauthorized`: API Key 无效或缺失
- `429 Too Many Requests`: 请求超限
- `500 Internal Server Error`: 服务器错误

---

## 七、安卓端访问指南

### 7.1 使用浏览器访问

**方法一：直接输入 URL**
1. 打开安卓手机浏览器（推荐 Chrome）
2. 输入网址：`https://<你的用户名>.github.io`
3. 页面自动适配手机屏幕

**方法二：扫码访问**
1. 在电脑上打开网站
2. 使用手机浏览器扫码功能扫描页面二维码

### 7.2 添加到桌面

**Chrome 浏览器：**
1. 在手机上打开网站
2. 点击三点菜单 → "添加到主屏幕"
3. 输入名称，点击 "添加"

**Firefox 浏览器：**
1. 打开网站后，点击菜单 → "页面" → "添加到主屏幕"

### 7.3 安卓 WebView 应用封装（进阶）

#### 7.3.1 创建 Android Studio 项目

1. 打开 Android Studio
2. 创建新项目 → "Empty Views Activity"
3. 设置应用名称和包名

#### 7.3.2 修改布局文件

编辑 `res/layout/activity_main.xml`：

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent" />

</LinearLayout>
```

#### 7.3.3 修改 MainActivity.java

```java
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webview);
        
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setCacheMode(WebSettings.LOAD_DEFAULT);
        webSettings.setUserAgentString("Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36");
        
        webView.setWebViewClient(new WebViewClient());
        webView.loadUrl("https://<你的用户名>.github.io");
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
```

#### 7.3.4 添加网络权限

编辑 `AndroidManifest.xml`：

```xml
<manifest ...>
    <uses-permission android:name="android.permission.INTERNET" />
    
    <application 
        android:usesCleartextTraffic="true"
        ...>
        <activity ...>
            ...
        </activity>
    </application>
</manifest>
```

#### 7.3.5 构建 APK

1. 点击 "Build" → "Build Bundle(s) / APK(s)" → "Build APK(s)"
2. APK 文件位于 `app/build/outputs/apk/debug/`

---

## 八、自定义域名（可选）

### 8.1 添加 CNAME 文件

在项目根目录创建 `CNAME` 文件：

```
example.com
```

### 8.2 配置 DNS

| 类型 | 主机记录 | 值 | TTL |
|------|----------|-----|-----|
| A | @ | 185.199.108.153 | 300 |
| A | @ | 185.199.109.153 | 300 |
| A | @ | 185.199.110.153 | 300 |
| A | @ | 185.199.111.153 | 300 |
| CNAME | www | `<用户名>.github.io` | 300 |

### 8.3 GitHub 配置

1. 仓库 → Settings → Pages
2. 在 "Custom domain" 输入域名
3. 点击 "Save"
4. 勾选 "Enforce HTTPS"

---

## 九、安全注意事项

⚠️ **重要：API Key 安全**

1. API Key 仅存储在浏览器本地存储（localStorage）
2. 不会上传到 GitHub 或任何服务器
3. 不要在公共场合或他人设备上保存 API Key
4. 定期轮换 API Key（在 DeepSeek Platform 设置）

---

## 十、常见问题

### Q1: 页面显示 404

**解决方案：**
- 确认仓库名正确：`<用户名>.github.io`
- 确认分支为 `main`
- 等待几分钟，部署可能有延迟

### Q2: API 请求失败

**解决方案：**
- 检查 API Key 是否正确
- 检查网络连接
- 确认 API Key 有足够的额度
- 检查是否超过速率限制

### Q3: 安卓 WebView 无法加载

**解决方案：**
- 确认添加了 `INTERNET` 权限
- 确认启用了 JavaScript
- 使用 HTTPS URL（Android 9+ 阻止 HTTP）

### Q4: 流式响应不显示

**解决方案：**
- 确认浏览器支持 ReadableStream API
- 检查网络是否稳定

---

## 十一、项目结构

```
.github.io/
├── index.html          # 主页面
├── styles.css          # 样式文件
├── script.js           # 脚本文件
└── README.md           # 项目说明
```

---

## 十一、技术栈

- HTML5
- CSS3（响应式设计）
- JavaScript（ES6+）
- DeepSeek API
- GitHub Pages

---

## 参考链接

- [DeepSeek Platform](https://platform.deepseek.com/)
- [DeepSeek API 文档](https://api-docs.deepseek.com/)
- [GitHub Pages 文档](https://pages.github.com/)
- [Android WebView 文档](https://developer.android.com/reference/android/webkit/WebView)