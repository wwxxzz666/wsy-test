# ClawOSS 面试演示讲解文档

## 1. 演示目标

本次演示对应测试题 4 个目标：

1. 模型配置完全环境变量化，可替换为主流模型，不写死模型。
2. 提供 token 总预算，达到预算时自动暂停，防止超限。
3. Dashboard 实时反映系统运行状态与预算状态。
4. 不依赖写死流程，使用通用化、可配置的启动与运行机制。

---

## 2. 演示环境信息

- 服务器：AutoDL Ubuntu 容器
- 部署目录：`/root/autodl-tmp/wsy-test`
- 当前模型：`siliconflow/Pro/zai-org/GLM-5`
- 当前模型网关：`https://api.siliconflow.cn/v1`
- 预算：`CLAWOSS_TOKEN_BUDGET_TOTAL=5000000`

---

## 3. 演示流程（建议 5-8 分钟）

### 步骤 A：展示模型可配置（目标 1）

```bash
cd /root/autodl-tmp/wsy-test
grep -E 'CLAWOSS_LLM_BASE_URL|CLAWOSS_MODEL_PRIMARY|CLAWOSS_MODEL_NAME|CLAWOSS_TOKEN_BUDGET_TOTAL' .env
```

讲解话术：

- “模型供应商、模型名、预算都通过环境变量配置。”
- “我只改 `.env` 就能切换模型，不需要改业务代码。”

### 步骤 B：展示系统自主运行（目标 4）

```bash
openclaw status
openclaw system event --text "status check" --mode now --json
ps -ef | grep -E "openclaw-gateway|dashboard-sync" | grep -v grep
```

讲解话术：

- “`status` 可以看到会话、模型、任务状态。”
- “`system event` 返回 `ok:true`，说明网关与 agent 链路可写可执行。”
- “进程层面能看到 gateway 和 dashboard-sync 在持续运行。”

### 步骤 C：展示预算和可观测性（目标 2 + 3）

```bash
tail -n 40 /tmp/dashboard-sync.log
```

重点观察字段：

- `model=siliconflow/Pro/zai-org/GLM-5`
- `token-budget: used=... remaining=... delta=...`
- `heartbeat: status=alive/degraded ... budget_used=...`

讲解话术：

- “每个周期都会上报预算使用量与剩余额度。”
- “到达上限后会触发暂停逻辑，避免预算继续消耗。”

### 步骤 D：展示验收证据产物（交付证明）

```bash
ls -lh reports/acceptance/
sed -n '1,120p' reports/acceptance/acceptance-evidence-*.md
```

讲解话术：

- “这里是自动导出的验收证据包，包含运行状态、配置快照、指标快照。”
- “可作为复盘和面试验收材料直接提交。”

---

## 4. 四个目标如何一一对上

1. 目标 1（任意模型）：
环境变量驱动模型配置，不再依赖固定 m2.7/kimi。

2. 目标 2（预算上限）：
`CLAWOSS_TOKEN_BUDGET_TOTAL` 生效，日志中持续有 `used/remaining` 变化。

3. 目标 3（Dashboard 可视化）：
dashboard-sync 持续上报心跳、模型和预算字段，支持实时展示。

4. 目标 4（不写死流程）：
启动与配置链路已做通用化，模型/预算由环境变量注入。

---

## 5. 面试官常见追问建议回答

### Q1：你怎么证明不是写死模型？

建议回答：

- “我只改 `.env` 的 `CLAWOSS_MODEL_PRIMARY/CLAWOSS_MODEL_NAME/CLAWOSS_LLM_BASE_URL` 即可切换，不动代码。”

### Q2：预算保护怎么验证？

建议回答：

- “日志里持续输出 `token-budget`，并记录 `used/remaining`。”
- “预算达到阈值会触发暂停逻辑，防止继续超额消耗。”

### Q3：为什么有安全告警（gateway auth mode=none）？

建议回答：

- “这是 AutoDL 演示环境下为规避配对死锁的临时策略。”
- “网关仍绑定 `127.0.0.1`，不对公网暴露。”
- “生产环境可切回 token/password auth。”

---

## 6. 演示结束后的标准收尾

1. 导出最新证据包：

```bash
bash scripts/export-acceptance-evidence.sh
```

2. 展示 GitHub 账号与 PR 列表（如已产出）：

```bash
gh auth status
gh search prs --author wwxxzz666 --limit 20 --json repository,title,state,url
```

3. 安全收尾：

- 演示后立即轮换 GitHub PAT 和 LLM API Key。

