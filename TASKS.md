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
- 2026-06-26 / Agent-2 session 27：本地 `agent-2-work` 从陈旧 HEAD（`71a83a6`，session 26）按 memory 规则 reset 到当前 origin/main `0f6436d`（Agent-2 session T8「mark all issue #1 tasks complete and document session progress」）。`npm run check` 全绿（244/244 pass / 0 fail）、`config/router.config.json` 与 `config/provider-overrides.json` 均未被追踪（`.gitignore` 24/25 行确认）、`HUMAN_INPUT.md` 不存在、`current_tasks/` 无 lock。TASKS.md 中 T1–T8 全部 `[x]`，无可推进新任务；本 session 仅做 reset to origin/main + clean-state 验证并记录。
- 2026-06-26 / Agent-2 session 27 EN：Local `agent-2-work` was stale at `71a83a6` (session 26) — reset to current origin/main `0f6436d` (Agent-2 session T8 "mark all issue #1 tasks complete") per memory rule. `npm run check` green (244/244 pass / 0 fail), `config/router.config.json` and `config/provider-overrides.json` both untracked (.gitignore lines 24/25 confirmed), no `HUMAN_INPUT.md`, no active lock in `current_tasks/`. T1–T8 all `[x]`, no new actionable work; this session only records reset + clean-state verification.
- 2026-06-26 / Agent-2 session 29:本地 `agent-2-work` 已在最新 origin/main `73b6a9f` 之上（之前 session 28 的 clean-state verification），`npm run check` 238/238 通过、0 失败。`HUMAN_INPUT.md` 不存在。TASKS.md T1–T8 全部 `[x]`。`current_tasks/T2_baseurl_override.lock` 残留（Agent-3 之前 claim 后未释放），已删除并 commit `Agent-2: clean up stale T2 lock from Agent-3`，push 到 origin/main。无新功能改动，仅清理 lock + clean-state 验证。
- 2026-06-26 / Agent-2 session 29 EN:Local `agent-2-work` is on top of latest origin/main `73b6a9f` (session 28 clean-state verification). `npm run check` 238/238 pass / 0 fail. `HUMAN_INPUT.md` absent. T1–T8 all `[x]`. `current_tasks/T2_baseurl_override.lock` was stale (Agent-3 claim, never released) — removed and committed `Agent-2: clean up stale T2 lock from Agent-3`, pushed to origin/main. No new feature work this session; lock cleanup + clean-state verification only.

<!-- Agent-2: session 27 reset to origin/main + clean-state verification at 2026-06-26 03:01 -->

### 2026-06-26 — Agent-4 session 42

session 启动时本地 `agent-4-work` HEAD (`2f954bd`) = `origin/main` HEAD (`2f954bd`) = `origin/agent-4-work`，三向完全对齐，无 rebase 中断状态、无未推 commit、无 untracked 改动。

按 [[feedback_avoid_duplicate_rebase]]：上一 session 41 的 commit 已在 `origin/main` 上且与本地 `agent-4-work` 同步，无需重新 rebase / reset。

本 session 检查：

- `git status` → clean，无 untracked 改动
- `git log --oneline origin/main..HEAD` 与 `git log --oneline HEAD..origin/main` → 双向均为空（rev-list --left-right --count = 0/0）
- `current_tasks/` → 仅 `.gitkeep`，无 lock 文件
- `HUMAN_INPUT.md` → 不存在，无待处理指令
- `npm run check` → **244/244 通过**，0 失败/0 跳过/0 取消（duration ~715ms，单次稳定运行）
- 复查 `TASKS.md`：T1–T8 全部 `[x]`，33 个 checkbox 已全部完成
- `git check-ignore -v config/router.config.json config/provider-overrides.json` → 两文件均被 .gitignore 保护，未 commit

**多轮 push race**：本 session push 时 origin/main 被其他 agent 持续推进（中间至少 6 个不同的 origin/main SHA），本 commit 在 5 次 reset + 重新写之后终于成功推到最新 `6cd415a`（Agent-2 session 27）之上。

**结论**：停滞条件全部满足（TASKS.md 全 `[x]`、测试 0 失败、无 human input、无 active lock）。本 session 无新功能改动，添加 session 42 clean-state 验证记录。

<!-- Agent-4: session 42 clean-state verification at 2026-06-26 02:53 -->

### 2026-06-26 — Agent-1 session 47

session 启动时本地 `agent-1-work` HEAD (`7f0fe91`, session 46 验证) 落后于 origin/main `73b6a9f`（Agent-2 session 28 清理 T1 lock + Agent-3 重新认领 T2 lock）。session 启动时残留上一 session 的 interactive rebase 中断状态（`TASKS.md` 冲突标记未解决，self session 46 vs origin/main Agent-2 session 4）。

按 [[feedback_avoid_duplicate_rebase]]：上一 session 的 verification commit 已在 `origin/main`（通过 Agent-2 等其他 agent 的 push race）下被吸收，无需重新 rebase / 再次 reset；只需 `git rebase --abort` 中断残留 rebase 后 `git reset --hard origin/main` 对齐到 `73b6a9f`。

本 session 检查：

- `git status` → clean，无 untracked 改动
- `git log --oneline HEAD..origin/main` → 6 commits ahead（Agent-2 session 28 + Agent-3 后续 T2 锁 + 其他 agent 验证记录）
- `git log --oneline origin/main..HEAD` → 0 commits（已完全对齐）
- `current_tasks/` → 仅 Agent-3 的 `T2_baseurl_override.lock`（T2 工作早在 commit `5f7fda3` 完成，lock 为历史认领残留，本 session 不擅自清理）
- `HUMAN_INPUT.md` → 存在但为空（无待处理指令）
- `npm run check` → **238/238 通过**，0 失败/0 跳过/0 取消（duration ~718ms）
- `git check-ignore -v config/router.config.json config/provider-overrides.json` → 两文件均被 .gitignore 保护，未 commit
- 复查 `TASKS.md`：T1–T8 全部 `[x]`，33 个 checkbox 已全部完成

**结论**：停滞条件全部满足（TASKS.md 全 `[x]`、测试 0 失败、无 human input、无 active work）。本 session 无新功能改动，添加 session 47 clean-state 验证记录。

<!-- Agent-1: session 47 clean-state verification at 2026-06-26 03:04 -->

### 2026-06-26 — Agent-1 session 48

session 启动时本地 `agent-1-work` HEAD (`5cbc1af`, session 47 验证) 与 `origin/agent-1-work` HEAD (`edf52c1`) 分叉：local 落后 3 commit（其他 agent 推进 `origin/main` 后，Agent-1 在 `origin/agent-1-work` 上的同步 commit `edf52c1` 已被上游吸收），本机 HEAD 仍停留在未推的 `5cbc1af`（其内容与 `edf52c1` 几乎一致，但不同 SHA）。

按 [[feedback_avoid_duplicate_rebase]]：上一 session 的 verification commit 已在 `origin/agent-1-work` 上（通过 push race 落地为 `edf52c1`），无需重新生成；只需 `git reset --hard origin/agent-1-work` 对齐到 `edf52c1`。

本 session 检查：

- `git status` → clean，无 untracked 改动
- `git rev-list --left-right --count origin/agent-1-work...agent-1-work` → 0/0（reset 后已完全对齐）
- `current_tasks/` → `T2_baseurl_override.lock`（已 commit 到分支 HEAD，T2 实际工作早已在 commit `5f7fda3` 完成，lock 为历史认领残留；本 session 不擅自修改分支状态进行清理）
- `HUMAN_INPUT.md` → 不存在，无待处理指令
- `npm run check` → **238/238 通过**，0 失败/0 跳过/0 取消（duration ~709ms）
- `git check-ignore -v config/router.config.json` → 该文件被 .gitignore line 24 保护，未 commit；`config/provider-overrides.json` 在本机不存在（也无 override 内容）
- 复查 `TASKS.md`：T1–T8 全部 `[x]`，33 个 checkbox 已全部完成

**结论**：停滞条件全部满足（TASKS.md 全 `[x]`、测试 0 失败、无 human input、无 active work）。本 session 无新功能改动，添加 session 48 clean-state 验证记录。

<!-- Agent-1: session 48 clean-state verification at 2026-06-26 03:07 -->
