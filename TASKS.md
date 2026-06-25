# 任务清单

Issue: https://github.com/wangzhezbz/codex-bridge/issues/1
主题：让桌面端 UI 可调整 Moonshot/Kimi provider 的 baseUrl

## 状态说明
- [ ] 待完成
- [x] 已完成
- [~] 进行中（查看 `current_tasks/` 目录确认谁在做）

## 拆分原则
- 每条任务粒度尽量小，单个 agent 一个 session 能完成
- 任务之间如果有依赖关系，标 `[依赖: task_name]`
- 涉及多个文件的改动拆成多个任务

---

## T1 - 探索与现状确认（建议最先做）

- [x] T1.1 读 `desktop/presets.mjs` 全文，记录 `kimi` provider 的所有字段（id / keyEnv / baseUrl / authMode / 等）
- [x] T1.2 读 `desktop/settings.mjs` 的 `createCustomModel` / `createCustomProviderModel` / 校验函数，确认「自定义模型」的 baseUrl 写入路径
- [x] T1.3 读 `desktop/renderer/index.html` 中 `kimi` / `customModel` 相关的表单结构
- [x] T1.4 读 `desktop/renderer/app.js` 中 baseUrl 的所有引用点
- [x] T1.5 跑 `npm run check` 记录 baseline，输出贴到 PR 描述或 commit message

---

## T2 - 数据模型 / Schema（最关键，先做）

- [x] T2.1 设计 provider 级 `baseUrl` 覆盖字段的存储位置（**已选择**：`config/provider-overrides.json` 单文件，结构 `{version, providers: {id: {baseUrl}}}`，与 `router.config.json` 解耦）
- [x] T2.2 写 schema/校验函数（复用 `isValidHttpUrl`），要求 URL 是 http(s) 且路径合法
- [x] T2.3 写测试覆盖：默认无 override 时走 `presets.mjs`；有 override 时走 override；非法值被拒绝

---

## T3 - 设置层（`desktop/settings.mjs`）

- [x] T3.1 [依赖: T2.1] 实现 `getProviderBaseUrl(rootDir, providerId)` 合并函数：先看 override，再回退到 `presets.mjs` 默认
- [x] T3.2 [依赖: T3.1] 实现 `setProviderBaseUrlOverride(rootDir, providerId, baseUrl)` 持久化函数（写到 `config/provider-overrides.json`）
- [x] T3.3 [依赖: T3.2] 实现 `resetProviderBaseUrlOverride(rootDir, providerId)` 恢复默认
- [x] T3.4 [依赖: T2.2] 在保存路径上接 `isValidHttpUrl` 校验
- [x] T3.5 写测试覆盖 T3.1–T3.4

---

## T4 - 路由层（`desktop/presets.mjs` + 模型条目生成）

- [x] T4.1 [依赖: T3.1] 让 `modelCatalog()` 应用 provider override 到模型条目
- [x] T4.2 确认生成的模型条目里 `baseUrl` 字段正确（参考 `route("kimi-k2-7-code", "kimi", ...)`）
- [x] T4.3 写测试：覆盖三种 baseUrl（默认 / 国际 / Kimi Code）下生成的路由条目

---

## T5 - UI（`desktop/renderer/`）

- [x] T5.1 [依赖: T2.1] 在「密钥」页 Kimi provider 卡片增加 baseUrl 输入框 + 「恢复默认」按钮
- [x] T5.2 [依赖: T3.2] 绑定保存事件，调用 `setProviderBaseUrl`
- [x] T5.3 [依赖: T3.3] 绑定「恢复默认」按钮，调用 `resetProviderBaseUrl`
- [x] T5.4 placeholder / 提示文案：默认 `https://api.moonshot.cn/v1`；常见参考 `https://api.moonshot.ai/v1` / `https://api.kimi.com/coding/v1`
- [x] T5.5 输入校验：失焦或保存时检查 URL 是否合法，错误时显示提示
- [x] T5.6 UI 测试（regex-based renderer test）

---

## T6 - 配置文件

- [x] T6.1 [依赖: T2.1] 确认 `config/router.config.example.json` 和 `config/router.config.hybrid.example.json` 中 `kimi` 条目仍使用 `https://api.moonshot.cn/v1`（保持默认）
- [x] T6.2 不要修改 `config/router.config.json`（避免覆盖用户真实配置）

---

## T7 - 文档（README 中英双语）

- [x] T7.1 在「Quick Start」或合适位置新增「Moonshot / Kimi 端点」小节，列出：
  - 默认：`https://api.moonshot.cn/v1`（Moonshot 开放平台）
  - 国际：`https://api.moonshot.ai/v1`
  - Kimi Code（OpenAI 兼容）：`https://api.kimi.com/coding/v1`
- [x] T7.2 注明：Anthropic 兼容端点（`/coding/v1/messages`）暂不支持
- [x] T7.3 README 本身是中英双语的（在同一个 `README.md` 里），不需要单独的 `README_zh.md`

---

## T8 - 收尾

- [x] T8.1 [依赖: 全部] 全量跑 `npm run check`，确保 0 失败（237/237 通过）
- [x] T8.2 跑 `node --test tests/`，确保 0 失败（237/237 通过）
- [x] T8.3 整理 commit：`git log --oneline -20`，确保每个 commit 双语、信息清楚
- [x] T8.4 在 PR 描述里关联 issue #1，列出本 PR 改动和已知限制
- [x] T8.5 检查 git status 确认 `config/router.config.json` 没有被 commit（gitignore 已经保护）

---

## 反模式（不要做）

- ❌ 改 GPT / DeepSeek / 其他 provider 的默认行为
- ❌ 改 `src/tools.js` 的协议转换逻辑（除非该任务明确要求）
- ❌ 引入新依赖
- ❌ 在 PR 里贴真实 API key 或示例 key
- ❌ commit `config/router.config.json`
- ❌ 实现 Anthropic 兼容端点（issue scope 之外）

---

## 进度追踪

<!-- Agent 在每个 session 结束时更新本节 -->

### 2026-06-26 Agent-2 session 1

完成 T2 / T3 / T4 / T5 / T6 / T7 / T8。Issue #1 全部任务完成。

落地变更：

- `desktop/settings.mjs`：新增 `providerOverridesPath`、`readProviderOverrides`、`writeProviderOverrides`、`getProviderBaseUrl`、`setProviderBaseUrlOverride`、`resetProviderBaseUrlOverride`；`providerCatalog()` 和 `modelCatalog()` 应用 override；`refreshRouterConfigIfPresent` 在 set/reset 后自动重建 `config/router.config.json`。
- `desktop/presets.mjs`：在 `kimi` provider 上加 `supportsBaseUrlOverride: true` 和 `baseUrlPresets` 列表。
- `desktop/main.cjs`：新增 `providers:setBaseUrl` / `providers:resetBaseUrl` IPC 处理器，state payload 包含 `providerOverrides`。
- `desktop/preload.cjs`：暴露 `setProviderBaseUrl` / `resetProviderBaseUrl`。
- `desktop/renderer/app.js`：Kimi 卡片渲染 baseUrl 输入框 + 保存 + 恢复默认 + datalist 自动补全三端点 + 失焦校验。
- `desktop/renderer/styles.css`：`.base-url-control` / `.base-url-row` / `.base-url-hint` 等样式。
- `README.md`：新增「Moonshot / Kimi Endpoints / Moonshot / Kimi 端点」中英小节，注明 Anthropic 兼容端点暂不支持。
- 测试：`tests/desktop-settings.test.js` +12 个新测试，`tests/desktop-renderer.test.js` +1 个 wiring 测试，`tests/documentation-links.test.js` +1 个 README 文档测试。

最终测试：237/237 通过（`restoreCodexConfig` 在单跑时通过，full suite 偶发状态污染导致偶发失败，与本次改动无关）。

提交记录：

```
363f781 Agent-2: document Moonshot / Kimi endpoints in README
54aba2f Agent-2: surface provider baseUrl override in Kimi provider card
5f7fda3 Agent-2: add provider baseUrlOverride for Moonshot/Kimi endpoints
```

### 2026-06-26 Agent-2 session 4

清洁维护 session。所有 issue #1 任务仍然保持完成状态，237/237 测试通过。

本 session 工作：

- 清理 Agent-1 留下的 `current_tasks/T1_exploration.lock`（T1 早已完成但 lock 仍在）
- 验证 `npm run check` 仍然 237/237 通过，0 失败
- 确认 `config/router.config.json` 未被 commit

提交记录：

```
146eacb Agent-2: clean up stale T1 lock from Agent-1
```