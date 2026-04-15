# ClawOSS 操作手册（提交给面试官）

## 1. 文档目的

本手册用于说明如何标准化部署并运行 ClawOSS，实现以下目标：

1. 通过环境变量配置任意主流大模型（不写死模型）。
2. 设置 token 总预算并在超限时自动暂停。
3. Dashboard 可观测系统运行状态与预算状态。
4. 全流程通用化，不依赖写死流程。

---

## 2. 环境要求

- OS: Ubuntu 22.04+
- Git, curl, jq, gh, python3
- Node.js 22+
- OpenClaw CLI（`openclaw --version` 可用）

安装示例：

```bash
apt-get update
apt-get install -y git curl jq gh python3 python3-pip ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs
npm i -g openclaw
```

---

## 3. 项目部署

建议目录（AutoDL）：

```bash
cd /root/autodl-tmp
git clone https://github.com/wwxxzz666/wsy-test.git
cd wsy-test
cp .env.example .env
```

---

## 4. 环境变量配置（核心）

在 `.env` 中至少配置：

```bash
GITHUB_TOKEN=你的GitHubPAT
CLAW_API_KEY=你的dashboard写入key
DASHBOARD_URL=你的dashboard地址

CLAWOSS_LLM_BASE_URL=https://api.siliconflow.cn/v1
CLAWOSS_LLM_API_KEY=你的LLM_API_KEY
CLAWOSS_MODEL_NAME=Pro/zai-org/GLM-5
CLAWOSS_MODEL_PRIMARY=siliconflow/Pro/zai-org/GLM-5
CLAWOSS_TOKEN_BUDGET_TOTAL=5000000

CLAWOSS_WORKSPACE=/root/autodl-tmp/wsy-test/workspace
```

说明：

- 更换模型只需改 `CLAWOSS_*` 变量，无需改代码。
- `CLAWOSS_TOKEN_BUDGET_TOTAL` 为总预算，达到后触发暂停保护。

---

## 5. 启动流程

```bash
cd /root/autodl-tmp/wsy-test
bash scripts/setup.sh
bash scripts/restart.sh
bash scripts/start.sh
```

若 AutoDL 环境存在配对权限阻塞，可用本机回环模式运行（仅本机）：

```bash
openclaw plugins disable device-pair
nohup openclaw gateway run --auth none --bind loopback --port 18789 >/tmp/openclaw-gateway.log 2>&1 &
```

---

## 6. 运行验证（验收命令）

```bash
openclaw status
openclaw system event --text "status check" --mode now --json
ps -ef | grep -E "openclaw-gateway|dashboard-sync" | grep -v grep
tail -n 40 /tmp/dashboard-sync.log
```

判定标准：

- `openclaw status` 可看到 active sessions。
- `system event` 返回 `{"ok": true}`。
- 进程存在 `openclaw-gateway` 与 `dashboard-sync`。
- 日志出现：
  - `model=...`
  - `token-budget: used=... remaining=...`
  - `heartbeat: status=... budget_used=...`

---

## 7. 证据导出

```bash
bash scripts/export-acceptance-evidence.sh
ls -lh reports/acceptance/
```

输出：

- `reports/acceptance/acceptance-evidence-*.md`
- `reports/acceptance/acceptance-evidence-*.json`

用于提交运行证明和验收材料。

---

## 8. PR 产出与账号证明

确认 GitHub 账号登录：

```bash
gh auth status
```

查询 PR 产出：

```bash
gh search prs --author wwxxzz666 --limit 20 --json repository,title,state,url
```

---

## 9. 风险与生产建议

1. 若采用 `--auth none`（演示用途），需保证仅 `loopback`，禁止公网暴露。
2. 生产建议开启 token/password auth。
3. 演示后应立即轮换 GitHub PAT 与 LLM API Key。

---

## 10. 结论

本项目已支持：

- 模型配置环境变量化（可替换主流模型）
- token 预算保护
- dashboard 实时可观测
- 自动化与标准化部署运行流程

