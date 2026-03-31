<div align="center">
  <img src="logo.png" width="128" height="128" alt="Gemini Nexus Logo">
  <h1>Gemini Nexus</h1>
  <p>一个由 Google Gemini 提供支持的 AI 助手 Chrome 浏览器扩展</p>

  [![][license-badge]][license]
  [![][build-badge]][build]

  [license]: https://github.com/nanfangns/gemini-nexus/blob/master/LICENSE
  [build]: https://github.com/nanfangns/gemini-nexus/actions
  [license-badge]: https://img.shields.io/badge/license-MIT-blue.svg
  [build-badge]: https://img.shields.io/github/actions/workflow/status/nanfangns/gemini-nexus/ci.yml
</div>

---

## 关于

Gemini Nexus 将 Google Gemini 模型直接集成到浏览器中，让 AI 能够**直接控制网页**——自动点击按钮、填写表单、导航页面。通过自然语言描述任务，AI 会自动规划步骤并执行浏览器操作。

**核心亮点：**
- 🤖 AI 驱动的浏览器自动化
- 🎯 批量操作支持，一次性完成多项任务
- 🔄 智能重试与状态同步，确保执行稳定
- 🛡️ 安全的沙箱环境，保护隐私

## 功能

| 功能 | 说明 |
|------|------|
| 💬 **侧边栏聊天** | 与 Gemini 对话，支持多账号切换 |
| 🛠️ **悬浮工具栏** | 选中文本后快速调用 AI（翻译、总结等） |
| 🖼️ **图像分析** | 截图并让 AI 解析内容 |
| ⚡ **快捷键** | 默认 `Alt+S` 快速开启 |
| 🖱️ **浏览器控制** | AI 指令直接操作网页 |
| 🔒 **隐私安全** | 沙箱环境运行，数据本地处理 |

## 浏览器控制

通过自然语言描述任务，AI 自动生成工具调用并执行：

```json
{
  "tool": "click",
  "args": {
    "elements": [
      { "uid": "1_10" },
      { "uid": "1_20" },
      { "uid": "1_30" }
    ]
  }
}
```

**支持的操作：**

| 操作 | 工具 | 说明 |
|------|------|------|
| 点击 | `click` | 单个或批量点击元素 |
| 填表 | `fill` / `fill_form` | 填写输入框/批量填充表单 |
| 导航 | `navigate_page` | 打开 URL、前进、后退、刷新 |
| 交互 | `hover` / `drag_element` / `press_key` | 悬停、拖拽、按键 |
| 等待 | `wait_for` | 等待页面内容出现 |
| 脚本 | `evaluate_script` | 执行自定义 JavaScript |
| 截图 | `take_screenshot` / `take_snapshot` | 获取页面状态 |
| 标签页 | `new_page` / `close_page` / `select_page` | 管理多标签页 |

## 安装

1.  **克隆项目**
    ```bash
    git clone https://github.com/nanfangns/gemini-nexus.git
    cd gemini-nexus
    ```

2.  **安装依赖**
    ```bash
    npm install
    ```

3.  **构建**
    ```bash
    npm run build
    ```

4.  **加载到 Chrome**
    - 打开 `chrome://extensions/`
    - 开启右上角的 **开发者模式**
    - 点击 **加载已解压的扩展程序**
    - 选择 `dist` 文件夹

## 项目架构

```
gemini-nexus/
├── sidepanel/          # 侧边栏聊天界面
├── sandbox/            # 安全 iframe 环境（Markdown 渲染）
├── content/            # 内容脚本（悬浮工具栏、页面交互）
├── background/         # Service Worker
│   ├── control/       # 浏览器控制核心
│   │   ├── actions/  # 操作实现（click, fill, navigate...）
│   │   ├── snapshot/ # 页面快照、辅助功能树
│   │   └── wait_helper/ # 等待和导航检测
│   ├── handlers/      # 消息处理
│   │   └── session/  # 会话管理、提示词构建
│   └── managers/      # 管理器（会话、认证、日志）
└── dist/              # 构建输出目录
```

## 技术栈

- **Vite + React + TypeScript**
- **Google Gemini API**
- **Chrome Extension Manifest V3**
- **Chrome DevTools Protocol (CDP)**

## 贡献

欢迎提交 Issue 和 Pull Request！

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

本项目基于 MIT 许可证开源，详见 [LICENSE](LICENSE) 文件。

---

由 [nanfangns](https://github.com/nanfangns) 开发并维护。
