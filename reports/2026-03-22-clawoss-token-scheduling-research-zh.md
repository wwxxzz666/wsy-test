# ClawOSS 单任务 Token 调度研究报告

本文以工作论文 [单任务-万亿级Token调度架构框架-工作论文.md](/Users/kevinlin/Downloads/单任务-万亿级Token调度架构框架-工作论文.md) 为分析框架，把 ClawOSS 视为一个“高 token 预算、强外部状态、强分工”的单任务自治系统。样本包括：`2026-03-15` 至 `2026-03-20` 的 2 个主 orchestrator Claude JSONL 会话、`2026-03-17` 的 16 个 workspace subagent 会话、仓库内配置与记忆文件，以及 `2026-03-22` 公开 dashboard/API 的在线数据；两条与项目无关的新近本机会话已剔除。结论是：ClawOSS 已经验证了“靠架构而非单窗口扩容”来逼近大规模认知调度的方向，但它离“万亿级 token 可持续调度”仍是原型而非定型系统。

第一，ClawOSS 最强的能力并不是把更多 token 塞进单个上下文，而是把 token 预算转成层级化复用。主会话样本仅有 `46,998` 输入 token，却伴随 `793,418` 输出、`45,237,821` cache creation 和 `2,350,373,723` cache read；subagent 样本为 `86,393` 输入、`234,320` 输出、`3,774,873` cache creation、`60,277,325` cache read。换言之，系统真实依赖的是“提示缓存 + 文件化状态 + 新鲜上下文子代理”的乘法结构，而不是单次长上下文硬扛。若按 dashboard 公布的线上汇总，`2026-03-15` 至 `2026-03-18` 共消耗 `168,974,338` 输入 token、`9,323,714` 输出 token、总成本 `$129.36`；对应 `410` 个 PR、`40` 个合并、`tokensPerMerge = 4,457,451`、`costPerMerge = $3.23`。这说明 ClawOSS 已进入论文所说的“10^8 级 token 预算驱动的持续工程系统”雏形，但 η 仍明显受限于流程耗散。

第二，系统缓解上下文窗口极限与 context rot 的手段是明确而且有效的。真实控制面不是 README，而是 [config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json)、[workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md) 与 [workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md)：包括 `204,800` token 上下文窗口、`>35%` 即触发压缩、只保留最近 `3` 轮、用 staging/result 文件承接子代理产出、处理完即删除结果文件、`ANNOUNCE_SKIP` 抑制无效播报、以及 memory lazy-loading。一个直接证据是 [workspace/memory/heartbeat-checkpoint.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/heartbeat-checkpoint.md) 已记录“`Context at 74%`”并把压缩作为下一步动作。按论文语言，这对应的是把“状态体积 V”从上下文窗口中外置，靠可分解性定理把任务拆入 fresh-context worker，从而避免线性链式推理在长时程下必然发生的状态腐蚀。

第三，ClawOSS 当前最大的瓶颈不是 token 总量，而是认知卡诺效率 η。系统确实建立了验证-修复闭环，这一点与论文对“可验证性优先”的判断高度一致；但有效功没有稳定转成 merge。公开 dashboard 当前显示 `mergeRate = 9.8%`、`openPRs = 184`、`closedPRs = 186`，并发出 “`47` 个仓库已有 `3+` PR”、“`184` 个 open PR 已超过 `7` 天”、“autonomy score = `0`” 等告警；仓库内 [workspace/memory/failure-log.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/failure-log.md) 则显示 `stale_closed = 55%`、`out_of_scope = 16%`、`duplicate_fix = 11%`。这说明主要耗散不在“模型不会写补丁”，而在“目标选择、重复攻击、跟进老化、仓库信任错配、以及对子任务价值的前置筛选不足”。如果沿论文公式理解，ClawOSS 的上限首先受 η 限制，而不是受名义 token 预算限制。

第四，站点本身也暴露了重要的失效模式。其一，观测面互相打架：`/api/connection-status` 报告 `connection.state = connected`、`heartbeats = true`，但同时给出 `heartbeatStatus = offline`、`metrics = false`；`/api/metrics/portfolio-health` 给出 `portfolioScore = 17.7` 却仍返回 `status = healthy`；`/api/metrics/throughput` 显示 `slotsUsed = 0`、`idleCycles = 957`，与更早对话流中“15 个槽位已满”的运行状态并不一致。其二，遥测链路并不统一：真实账本在 `metrics_tokens` 与 JSONL `usage.*`，但 hook 侧仍存在按字符数估 token 的启发式估算，且 `context_tokens` 已写入却未形成下游控制信号。其三，控制面漂移明显：运行中的 5 分钟 heartbeat、14 并发槽位、4 常驻代理等事实，与旧 README/脚本/健康检查之间并不总一致。其四，恢复路径偏破坏式，重启与 stale 清理会覆盖状态、抹平证据，使根因分析变难。

因此，ClawOSS 对“单任务大规模 token 调度”的真正启发不是“窗口越大越强”，而是“三件套”：外置状态、分层代理、持续验证。它已经证明 10^8 级 token 预算可以支撑长期 OSS 自治漏斗，但距离论文意义上的 10^11 至 10^12 级“认知基础设施”还差三步：把 token 计量统一为会话级真账本，把状态机从 Markdown 协议升级为可回放的 typed run ledger，把 repo 选择/去重/跟进从经验规则升级为更硬的 admission control。否则，系统会先被 context rot、重复 PR 和观测失真拖垮，而不是先撞上模型能力上限。

## 参考

- 仓库与本地运行证据：
  [config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json)
  [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md)
  [workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md)
  [workspace/memory/heartbeat-checkpoint.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/heartbeat-checkpoint.md)
  [workspace/memory/failure-log.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/failure-log.md)
  [dashboard/lib/schema.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/lib/schema.ts)
  [dashboard/app/api/metrics/overview/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/overview/route.ts)
  [workspace/hooks/dashboard-reporter/handler.ts](/Users/kevinlin/Downloads/clawOSS/workspace/hooks/dashboard-reporter/handler.ts)
  [scripts/dashboard-sync.sh](/Users/kevinlin/Downloads/clawOSS/scripts/dashboard-sync.sh)

- 在线 dashboard 证据：
  [Dashboard Overview](https://clawoss-dashboard.vercel.app/)
  [API: overview](https://clawoss-dashboard.vercel.app/api/metrics/overview)
  [API: tokens](https://clawoss-dashboard.vercel.app/api/metrics/tokens)
  [API: cost](https://clawoss-dashboard.vercel.app/api/metrics/cost)
  [API: alerts](https://clawoss-dashboard.vercel.app/api/metrics/alerts)
  [API: portfolio-health](https://clawoss-dashboard.vercel.app/api/metrics/portfolio-health)
  [API: throughput](https://clawoss-dashboard.vercel.app/api/metrics/throughput)
  [API: connection-status](https://clawoss-dashboard.vercel.app/api/connection-status)
  [API: subagent-health](https://clawoss-dashboard.vercel.app/api/metrics/subagent-health)
  [API: conversation](https://clawoss-dashboard.vercel.app/api/conversation)
