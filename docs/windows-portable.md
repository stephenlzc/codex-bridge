# CodexBridge Windows Portable / Windows 便携版

## 中文

给客户交付时，不要让客户从源码运行，也不要让客户执行 `npm install`。

正确交付方式是使用已经打包好的 Windows 便携版：

1. 在开发机或 GitHub Actions 运行 `npm run package:win`。
2. 运行 `npm run package:win:smoke` 验证打包产物。
3. 把 `release/.../CodexBridge-win32-x64` 整个文件夹压缩发给客户。
4. 客户解压到一个可写目录，例如桌面或 `D:\CodexBridge`。
5. 客户双击 `CodexBridge.exe`。

便携版会把配置、密钥和日志写到同级目录：

```text
CodexBridgeData
```

客户机器不需要安装 Node.js、npm 或 Electron。

源码里的 `Start-CodexBridge.cmd` 只适合开发者调试源码环境。如果客户使用它，就又会回到 npm / Electron 下载和安装问题。

### 应用内操作

1. 在“概览”选择计费模式。大多数用户选择“GPT 走订阅”的混合模式。
2. 在“模型”页从内置模型池里选择最多 5 个模型。Codex 模型栏最多显示 5 个，所以这里会强制限制数量。
3. 如需接入新服务，在“模型”页添加自定义 OpenAI-compatible 模型。
4. 在“密钥”页填写对应 Provider 的 API Key。每个 Provider 旁边有“获取 API Key”和“文档”按钮。
5. 点“保存当前密钥”、“保存模型选择”、“生成模型目录”、“写入 Codex 配置”。
6. 点“启动 Router”，然后打开或重启 Codex。

GPT 订阅模型不需要在 CodexBridge 里填写 API Key。DeepSeek、Kimi、Qwen、OpenRouter 等 API 模型需要填写各自 Provider 的 API Key。

## English

Do not ask customers to run from source, and do not ask them to run `npm install`.

The customer-facing delivery should be the packaged Windows portable build:

1. Run `npm run package:win` on a developer machine or in GitHub Actions.
2. Run `npm run package:win:smoke` to verify the packaged app.
3. Zip and distribute the whole `release/.../CodexBridge-win32-x64` folder.
4. Ask the customer to extract it to a writable folder, such as Desktop or `D:\CodexBridge`.
5. Ask the customer to run `CodexBridge.exe`.

The portable build stores config, API keys, and logs in the sibling folder:

```text
CodexBridgeData
```

Customers do not need Node.js, npm, or Electron installed.

`Start-CodexBridge.cmd` is only a developer fallback for running from source. It is not the customer delivery path.

### In-app workflow

1. Choose the billing mode on the Dashboard. Most users should use Hybrid mode.
2. Select up to five models on the Models page. Codex can show at most five models, so CodexBridge enforces that limit.
3. Add custom OpenAI-compatible models on the Models page when needed.
4. Enter API keys on the Keys page. Each provider has a "Get API Key" button and a docs link.
5. Click Save keys, Save model selection, Generate model catalog, and Apply Codex config.
6. Start the Router, then open or restart Codex.

GPT subscription models do not need an API key in CodexBridge. API providers such as DeepSeek, Kimi, Qwen, and OpenRouter need their own provider keys.
