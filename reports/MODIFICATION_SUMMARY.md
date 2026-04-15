# ClawOSS 修复修改说明（2026-04-15）

## 目标与结论

本次修复围绕以下 4 个目标完成：

1. 模型配置从环境变量读取，可切换任意主流模型，不再依赖写死的 m2.7/kimi。
2. 增加 token 总预算上限，达到预算后自动暂停服务，防止超额消耗。
3. Dashboard 可正确反映运行状态（连接状态、活跃模型、预算状态）。
4. 不通过写死流程实现目标，改为通用、可配置的运行逻辑。

---

## 1) 环境变量驱动模型配置

### 修改内容

- 将模型提供商、模型名、上下文窗口、输出上限、成本参数等改为环境变量注入。
- `setup`/`restart` 流程中动态生成 OpenClaw 使用的 provider/model 配置，移除对固定模型的硬依赖。
- API Key 支持统一入口 + 常见变量兜底。

### 关键文件

- `.env.example`
- `config/openclaw.json`
- `scripts/setup.sh`
- `scripts/restart.sh`
- `scripts/start.sh`

### 主要环境变量

- `CLAWOSS_MODEL_PRIMARY`
- `CLAWOSS_MODEL_FALLBACKS`
- `CLAWOSS_LLM_BASE_URL`
- `CLAWOSS_LLM_API_KEY`
- `CLAWOSS_MODEL_NAME`
- `CLAWOSS_MODEL_CONTEXT_WINDOW`
- `CLAWOSS_MODEL_MAX_TOKENS`
- `CLAWOSS_MODEL_REASONING`
- `CLAWOSS_MODEL_INPUT_COST_PER_MTOK`
- `CLAWOSS_MODEL_OUTPUT_COST_PER_MTOK`
- `CLAWOSS_MODEL_CACHE_READ_COST_PER_MTOK`
- `CLAWOSS_MODEL_CACHE_WRITE_COST_PER_MTOK`

---

## 2) Token 预算硬上限

### 修改内容

- 在同步脚本中累计 token 使用量，按周期计算增量并持久化。
- 当 `CLAWOSS_TOKEN_BUDGET_TOTAL` 大于 0 且已达上限时，自动触发暂停（停止 gateway）。
- 将预算状态回写 heartbeat 元数据，供 dashboard 展示。

### 关键文件

- `scripts/dashboard-sync.sh`
- `.sync-state/token-budget-state.json`（运行时状态文件）

### 新增预算相关字段（心跳/状态）

- `budgetEnabled`
- `budgetTotal`
- `budgetUsed`
- `budgetRemaining`
- `budgetPaused`

---

## 3) Dashboard 运行状态展示修复

### 修改内容

- 后端 API 增强：
  - 从 heartbeat / 最新 metrics 中提取当前活跃模型。
  - 返回 token 预算结构化状态。
  - 连接状态判定不只看“最近更新时间”，也结合 heartbeat 状态（如 offline/degraded）。
- 前端页面与组件同步接入新字段，展示模型与预算状态。

### 关键后端文件

- `dashboard/app/api/connection-status/route.ts`
- `dashboard/app/api/metrics/overview/route.ts`
- `dashboard/app/api/ingest/metrics/route.ts`

### 关键前端文件

- `dashboard/app/page.tsx`
- `dashboard/app/live/page.tsx`
- `dashboard/components/overview/metric-cards.tsx`
- `dashboard/components/live/gateway-status.tsx`
- `dashboard/components/layout/header.tsx`
- `dashboard/lib/hooks/use-connection-status.ts`
- `dashboard/lib/types.ts`
- `dashboard/lib/cost-models.ts`

---

## 4) 去写死流程（通用化）

### 修改内容

- Hook/技能说明中的模型表述改为通用配置，不再默认绑定特定厂商模型。
- 运行链路中的模型信息从配置和状态动态传递。

### 关键文件

- `workspace/hooks/dashboard-reporter/handler.ts`
- `workspace/hooks/dashboard-reporter/post-tool.sh`
- `workspace/skills/dashboard-reporter/SKILL.md`
- `AGENTS.md`
- `CLAUDE.md`

---

## 验证结果

- `config/openclaw.json` 通过 JSON 解析校验。
- Dashboard 构建通过（`npm run dashboard:build`）。
- 已将项目导入并推送到：
  - Repo: `https://github.com/wwxxzz666/wsy-test.git`
  - Branch: `main`
  - Commit: `b259d4c`

---

## 备注

- 为避免污染仓库，未把本地运行期临时目录（如 `.architect-workspace/`、`workspace/.worktrees/`）纳入远程提交。
