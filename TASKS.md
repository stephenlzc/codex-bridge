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

- [ ] T1.1 读 `desktop/presets.mjs` 全文，记录 `kimi` provider 的所有字段（id / keyEnv / baseUrl / authMode / 等）
- [ ] T1.2 读 `desktop/settings.mjs` 的 `createCustomModel` / `createCustomProviderModel` / 校验函数，确认「自定义模型」的 baseUrl 写入路径
- [ ] T1.3 读 `desktop/renderer/index.html` 中 `kimi` / `customModel` 相关的表单结构
- [ ] T1.4 读 `desktop/renderer/app.js` 中 baseUrl 的所有引用点
- [ ] T1.5 跑 `npm run check` 记录 baseline，输出贴到 PR 描述或 commit message

---

## T2 - 数据模型 / Schema（最关键，先做）

- [ ] T2.1 设计 provider 级 `baseUrl` 覆盖字段的存储位置（建议：每个 provider 条目下新增可空字段 `baseUrlOverride`，null 表示用 `presets.mjs` 的默认）
- [ ] T2.2 写 schema/校验函数（参考 `isValidHttpUrl`），要求 URL 是 https 且路径合法
- [ ] T2.3 写测试覆盖：默认无 override 时走 `presets.mjs`；有 override 时走 override；非法值被拒绝

---

## T3 - 设置层（`desktop/settings.mjs`）

- [ ] T3.1 [依赖: T2.1] 实现 `getProviderBaseUrl(providerId)` 合并函数：先看 override，再回退到 `presets.mjs` 默认
- [ ] T3.2 [依赖: T3.1] 实现 `setProviderBaseUrl(providerId, url)` 持久化函数（写到 `config/router.config.json` 的 provider override 区域，不要污染模型条目）
- [ ] T3.3 [依赖: T3.2] 实现 `resetProviderBaseUrl(providerId)` 恢复默认
- [ ] T3.4 [依赖: T2.2] 在保存路径上接 `isValidHttpUrl` 校验
- [ ] T3.5 写测试覆盖 T3.1–T3.4

---

## T4 - 路由层（`desktop/presets.mjs` + 模型条目生成）

- [ ] T4.1 [依赖: T3.1] 让 `route()` 函数（`presets.mjs:285`）使用 `getProviderBaseUrl(providerId)` 而不是直接读 `provider.baseUrl`
- [ ] T4.2 确认生成的模型条目里 `baseUrl` 字段正确（参考 `route("kimi-k2-7-code", "kimi", ...)`）
- [ ] T4.3 写测试：覆盖三种 baseUrl（默认 / 国际 / Kimi Code）下生成的路由条目

---

## T5 - UI（`desktop/renderer/`）

- [ ] T5.1 [依赖: T2.1] 在「API Key」或「服务商」页增加 Kimi provider 的 baseUrl 输入框 + 「恢复默认」按钮
- [ ] T5.2 [依赖: T3.2] 绑定保存事件，调用 `setProviderBaseUrl`
- [ ] T5.3 [依赖: T3.3] 绑定「恢复默认」按钮，调用 `resetProviderBaseUrl`
- [ ] T5.4 placeholder / 提示文案：默认 `https://api.moonshot.cn/v1`；常见参考 `https://api.moonshot.ai/v1` / `https://api.kimi.com/coding/v1`
- [ ] T5.5 输入校验：失焦或保存时检查 URL 是否合法，错误时显示提示
- [ ] T5.6 UI 测试（如果项目有 UI 测试）/ 手动截图记录到 PR

---

## T6 - 配置文件

- [ ] T6.1 [依赖: T2.1] 确认 `config/router.config.example.json` 和 `config/router.config.hybrid.example.json` 中 `kimi` 条目仍使用 `https://api.moonshot.cn/v1`（保持默认）
- [ ] T6.2 不要修改 `config/router.config.json`（避免覆盖用户真实配置）

---

## T7 - 文档（README 中英双语）

- [ ] T7.1 在「Quick Start」或合适位置新增「Moonshot / Kimi 端点」小节，列出：
  - 默认：`https://api.moonshot.cn/v1`（Moonshot 开放平台）
  - 国际：`https://api.moonshot.ai/v1`
  - Kimi Code（OpenAI 兼容）：`https://api.kimi.com/coding/v1`
- [ ] T7.2 注明：Anthropic 兼容端点（`/coding/v1/messages`）暂不支持
- [ ] T7.3 同步翻译 `README_zh.md`

---

## T8 - 收尾

- [ ] T8.1 [依赖: 全部] 全量跑 `npm run check`，确保 0 失败
- [ ] T8.2 跑 `node --test tests/`，确保 0 失败
- [ ] T8.3 整理 commit：`git log --oneline -20`，确保每个 commit 双语、信息清楚
- [ ] T8.4 在 PR 描述里关联 issue #1，列出本 PR 改动和已知限制
- [ ] T8.5 检查 git status 确认 `config/router.config.json` 没有被 commit

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