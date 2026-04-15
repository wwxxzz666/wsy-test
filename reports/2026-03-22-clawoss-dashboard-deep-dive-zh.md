# ClawOSS Dashboard、运行历史与 Token 调度深度研究报告

**日期**：2026-03-22  
**定位**：这是对 ClawOSS 的长篇研究版报告，补充并扩展一页摘要版 [2026-03-22-clawoss-token-scheduling-research-zh.md](/Users/kevinlin/Downloads/clawOSS/reports/2026-03-22-clawoss-token-scheduling-research-zh.md)。本文的重点不是“系统是否在线”，而是：ClawOSS 试图解决什么问题、它如何用 agent 架构与 dashboard 把问题工程化、历史数据实际说明了什么、以及哪些指标是有效控制信号，哪些还是半成品或失真代理。

## 一、研究范围与证据层级

本报告综合了四层证据。第一层是生产侧 dashboard 与公开 API，我实际枚举了代码中 `7` 个页面和 `32` 个 GET 路由、`9` 个 POST 路由，并抓取了其中与指标、状态、日志、PR 组合相关的公开端点。第二层是仓库内控制面与状态机，包括 [config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json)、[workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md)、[workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md) 以及 `workspace/memory/` 下的 checkpoint、failure、cycle summary。第三层是本机历史 Claude JSONL 运行日志，我区分了主 orchestrator 会话与 workspace subagent 会话。第四层是外部解释源，包括 [DeepWiki 的 ClawOSS 页面](https://deepwiki.com/billion-token-one-task/ClawOSS) 与公开 GitHub 讨论，如 [Issue #1: Stop spamming open source projects with AI slop](https://github.com/billion-token-one-task/ClawOSS/issues/1)。

四层证据中，**生产 dashboard API** 用于回答“当前或累计历史是什么”，**仓库代码与 heartbeat 文档** 用于回答“系统打算怎样工作”，**本机 JSONL** 用于回答“真实 token 结构和上下文调度方式是什么”，**DeepWiki 与旧文档** 只作为历史参照，因为它们在若干关键事实上已经落后于当前代码。例如，DeepWiki 仍把 ClawOSS 描述为 `5` 个并发实现槽位、`10` 分钟 heartbeat、`70%` 上下文阈值；但当前代码和运行文档显示的是 `maxConcurrent: 14`、`5` 分钟 heartbeat、以及 heartbeat 主循环在 `>35%` 就主动压缩上下文。[config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json) [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md)

## 二、ClawOSS 根本上想优化什么

ClawOSS 并不只是“自动写 PR”的系统。它真正想解决的是一个约束优化问题：在有限的上下文窗口、有限的 token 预算、有限的 maintainer 注意力和有限的 repo 信任下，如何把自治 agent 的输出从“提交了很多 PR”转成“持续获得 merged PR”。这个目标在运行提示和 dashboard 中都非常明确。`/api/conversation` 暴露的 heartbeat 指令直接写着：“`GOAL: MERGED PRs. Not submitted PRs — MERGED.`”；overview/directives/logs 也都反复把“merge-ready PRs”“dead repos”“rework needed”“focus on responsive repos”作为主要控制信号。[Conversation API](https://clawoss-dashboard.vercel.app/api/conversation) [Directives API](https://clawoss-dashboard.vercel.app/api/metrics/directives) [Logs API](https://clawoss-dashboard.vercel.app/api/logs)

如果借用你提供的工作论文语汇，这个系统并不是在单纯扩大 token 总量，而是在做认知卡诺效率 η 的工程化：把 token 从“读取、重复、漂移、碰壁、被忽略”尽量转成“真正推进 merge 的有效功”。换句话说，ClawOSS 的研究价值不在于它把单会话做到了多长，而在于它把“token 预算、repo 选择、PR 尺寸、review 速度、follow-up 和 context rot”都纳入了一个调度系统。

## 三、Agent 结构：从单会话执行转向外置状态 + 分层代理

当前仓库的活跃控制面已经不是 README，而是 [config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json)、[workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md) 与 [workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md)。这三者共同定义了一个持久 orchestrator 和一组短命 subagent 组成的调度系统。

| 组件 | 当前职责 | 关键证据 |
|---|---|---|
| 主 orchestrator | 执行 heartbeat、读取/写入 memory、处理结果文件、做发现/筛选/派工/复盘，不直接写补丁 | [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md) |
| always-on agents | 常驻发现与 PR 监控角色；当前活文档里是 `scout`、`pr-monitor`、`pr-monitor-deep`、`pr-analyst` 四类 | [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md) |
| impl/follow-up slots | 新实现和跟进任务的短命 worker，使用 fresh context 和独立工作区 | [workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md) |
| memory files | 外置长期状态、队列、策略、信任、黑名单、spawn 状态 | [workspace/memory](/Users/kevinlin/Downloads/clawOSS/workspace/memory) |
| result/staging files | 子代理与主代理之间的低 token 成本通信层 | [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md) |

这套设计背后的核心思想是“主会话不要被具体仓库细节污染”。主 orchestrator 只保留调度所需的最小上下文，真正的 repo-specific 实现都下放给 fresh-context 子会话；子会话写出结果文件，主会话消费 YAML/frontmatter 摘要并立刻删除已处理结果，避免旧产物反复堆积。`HEARTBEAT.md` 甚至明确给出上下文清理理由：“`43 unprocessed files = 43k tokens of bloat`”。这正是把任务分解性理论工程化的典型做法：不是试图在一个上下文里保住所有细节，而是把状态外置，把执行切碎，把协调压缩。

从本机 JSONL 看，这种结构是真实在运行的，而不是纸面设计。主 orchestrator 样本有 `2` 个主要会话，总历时约 `156` 小时，中位持续时间约 `77.9` 小时；workspace subagent 样本有 `16` 个会话，总历时约 `144.4` 分钟，中位只 `7.7` 分钟。主会话是 durable 控制面，子会话是 expendable workers，这个角色分化非常鲜明。

## 四、Memory 系统、队列模型与信任机制

ClawOSS 把“文件就是状态机”贯彻得很彻底。下列文件不是文档注释，而是真正的工作内存与控制面：

| 文件 | 作用 |
|---|---|
| [workspace/memory/work-queue.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/work-queue.md) | issue 队列与状态迁移 |
| [workspace/memory/impl-spawn-state.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/impl-spawn-state.md) | 当前 impl 子代理槽位 |
| [workspace/memory/pr-followup-state.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/pr-followup-state.md) | 跟进 PR 的活动状态 |
| [workspace/memory/trust-repos.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/trust-repos.md) | 已验证响应型 repo 与历史经验 |
| [workspace/memory/repo-blocklist.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/repo-blocklist.md) | hostile / dead / should-avoid repo |
| [workspace/memory/pr-strategy.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/pr-strategy.md) | PR 策略与优先级记忆 |
| [workspace/memory/heartbeat-checkpoint.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/heartbeat-checkpoint.md) | 周期级 checkpoint |
| [workspace/memory/failure-log.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/failure-log.md) | 失败分类与比例 |

这个队列模型的一个关键特征，是它把 repo-level 学习显式写进调度器。信任不是隐含在模型权重里，而是落在 `trust-repos.md`、`repo-blocklist.md`、dashboard 的 repo-health/action-items/directives 里。公开 dashboard 当前就把“`55` 个 0 merge 或 blocklisted 的 repo”“`47` 个出现 3+ PR 的 repo”“`184` 个需要 follow-up 的 open PR”推回给 agent，形成了一个二级反馈回路。[Alerts API](https://clawoss-dashboard.vercel.app/api/metrics/alerts) [Action Items API](https://clawoss-dashboard.vercel.app/api/metrics/action-items) [Directives API](https://clawoss-dashboard.vercel.app/api/metrics/directives)

换言之，ClawOSS 不是 naive 地从 issue 池里均匀采样任务，而是在尝试构建一个 portfolio manager：一边做发现，一边维护 trust ledger，一边减少 dead-end targeting，一边把跟进与 rework 视作和“新 PR 提交”同等重要的资产管理动作。

## 五、我实际爬过的 Dashboard 内容

从 [dashboard/app/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/page.tsx) 可以看出，overview 并不是一个薄壳页面，而是试图充当“单一控制面”。它汇聚了 agent status、metric cards、activity timeline、follow-up tracker、repo health、PR type/size breakdown、autonomy panel、post-merge health、merge probability、velocity、response time、alerts、action items、correlations、subagent health、portfolio health、throughput、directives、discovery pipeline、agent state 等模块。其余 6 个页面分别面向 live feed、PR 明细、repo 组合、健康/成本、质量、日志。

| 页面 | 主要内容 | 代表代码 |
|---|---|---|
| `/` | 总览控制面，汇总所有关键指标与建议 | [dashboard/app/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/page.tsx) |
| `/live` | 会话流、工具日志、错误、成本拆分、gateway 状态 | [dashboard/app/live/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/live/page.tsx) |
| `/prs` | PR 列表、过滤、详情 | [dashboard/app/prs/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/prs/page.tsx) |
| `/repos` | repo health 与推荐动作 | [dashboard/app/repos/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/repos/page.tsx) |
| `/health` | token/cost 图表、session 状态 | [dashboard/app/health/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/health/page.tsx) |
| `/quality` | 质量得分、趋势、拒绝理由、分布 | [dashboard/app/quality/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/quality/page.tsx) |
| `/logs` | 指令、错误与系统日志流 | [dashboard/app/logs/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/logs/page.tsx) |

在 API 层，代码里有 `32` 个 GET 路由与 `9` 个 POST 路由；我重点抓取了 metrics、connection-status、state、conversation、logs、github/prs 等公开端点。这里最重要的不是“有多少路由”，而是它们已经构成了三类功能：

| 类别 | 代表端点 | 用途 |
|---|---|---|
| 生产统计 | `/api/metrics/overview`、`/tokens`、`/cost`、`/velocity`、`/repos`、`/quality` | 回答累计表现与历史序列 |
| 调度建议 | `/api/metrics/alerts`、`/action-items`、`/directives`、`/repo-health`、`/correlations` | 从历史数据反推“下一步该怎么做” |
| 实时控制/状态 | `/api/connection-status`、`/state`、`/conversation`、`/logs`、`/metrics/subagent-health` | 看当前控制面、活跃会话、事件流 |

也正因为如此，dashboard 不只是“观测层”，而是在逐渐演变成 prompt/control plane 的第二层。`/api/metrics/action-items` 的代码注释甚至直接写着：“`single pane of glass for prompt improvement decisions`”。[dashboard/app/api/metrics/action-items/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/action-items/route.ts)

## 六、历史数据：ClawOSS 过去几天到底跑成了什么样

### 6.1 总漏斗与成本

截至 `2026-03-22` 抓取时，dashboard overview 给出的全局累计值如下：

| 指标 | 数值 |
|---|---:|
| 总 PR | 410 |
| 已合并 | 40 |
| 仍 open | 184 |
| 已关闭未合并 | 186 |
| 已获 review 的 PR | 120 |
| 总 merge rate | 9.8% |
| 总成本 | $129.355722 |
| cost per merge | $3.2339 |
| tokens per merge | 4,457,451 |
| avg hours to review | 1.4 |

来源： [Overview API](https://clawoss-dashboard.vercel.app/api/metrics/overview)

这个漏斗本身已经说明问题：ClawOSS 并不缺“出手次数”，真正的困难在中段和尾段。410 个 PR 中只有 120 个进入 review，意味着 290 个 PR 完全没有进入 maintainer 注意力范围。换句话说，系统的主要浪费不是“模型写不出 patch”，而是“进入不到人类反馈回路”。

### 6.2 历史节奏：提交爆发集中在 3 月 15 日到 18 日

velocity 与 token/cost 图显示，主要活动高度集中在 `2026-03-15` 到 `2026-03-18` 这 4 天：

| 日期 | submitted | merged | closed | token 总量 | 每次提交 token | 每次提交成本 | 每个 merge 成本 |
|---|---:|---:|---:|---:|---:|---:|---:|
| 2026-03-15 | 33 | 2 | 4 | 9,624,502 | 291,652 | $0.186 | $3.065 |
| 2026-03-16 | 92 | 7 | 59 | 37,263,587 | 405,039 | $0.286 | $3.763 |
| 2026-03-17 | 175 | 17 | 73 | 83,776,828 | 478,725 | $0.350 | $3.606 |
| 2026-03-18 | 99 | 8 | 42 | 47,633,135 | 481,143 | $0.359 | $4.447 |

来源： [Velocity API](https://clawoss-dashboard.vercel.app/api/metrics/velocity) [Tokens API](https://clawoss-dashboard.vercel.app/api/metrics/tokens) [Cost API](https://clawoss-dashboard.vercel.app/api/metrics/cost)

这里最值得注意的不是“量越来越大”，而是**边际效率没有同步改善**。提交量从 `33` 提高到 `175` 时，每次提交的 token 成本也从约 `29` 万涨到 `47-48` 万，但 merge rate 并没有出现同量级提升。到 `2026-03-18`，每个 merge 成本甚至上升到 `$4.447`。这很像论文里说的“总 token 增加不等于有效能力线性增长”；如果 admission control 和 follow-up 没跟上，更多 token 只是在更快地产生 open 与 closed。

### 6.3 Repo 组合：PR 高度集中，merge 也高度集中

dashboard 当前覆盖 `122` 个 repo，但 PR 与 merge 都高度集中在少数 repo 上：

| 集中度 | 占总 PR | 占总 merge |
|---|---:|---:|
| Top 5 repo | 27.6% | 70.0% |
| Top 10 repo | 40.2% | 70.0% |
| Top 20 repo | 55.6% | 75.0% |

Top 10 repo 分布如下：

| Repo | 总 PR | merged | open | closed |
|---|---:|---:|---:|---:|
| `manaflow-ai/cmux` | 42 | 5 | 35 | 2 |
| `DioCrafts/OxiCloud` | 22 | 21 | 1 | 0 |
| `huggingface/transformers` | 18 | 1 | 3 | 14 |
| `mastra-ai/mastra` | 17 | 0 | 0 | 17 |
| `BerriAI/litellm` | 14 | 1 | 9 | 4 |
| `unslothai/unsloth` | 13 | 0 | 0 | 13 |
| `vercel/ai` | 13 | 0 | 13 | 0 |
| `mistralai/mistral-vibe` | 10 | 0 | 10 | 0 |
| `chroma-core/chroma` | 8 | 0 | 5 | 3 |
| `ollama/ollama` | 8 | 0 | 7 | 1 |

来源： [Repos API](https://clawoss-dashboard.vercel.app/api/metrics/repos)

这组数据暴露出两个相反但同时成立的事实。第一，**信任与 repo fit 确实重要**。例如 `DioCrafts/OxiCloud` 的 `22` 个 PR 里有 `21` 个已 merge，说明一旦进入高 fit + 高响应 + 小 diff 的甜区，系统可以非常高效。第二，**同一 repo 上的过度集中会迅速变成 reputational risk**。例如 `cmux` 有 `42` 个 PR、`transformers` 有 `18` 个、`mastra` 有 `17` 个；这也是为什么 alerts/action-items 会直接把“47 个 repo 有 3+ PR”定义为潜在 spam 风险，而不是产能亮点。[Alerts API](https://clawoss-dashboard.vercel.app/api/metrics/alerts) [Action Items API](https://clawoss-dashboard.vercel.app/api/metrics/action-items)

### 6.4 Review 速度不是主问题，review 覆盖率才是主问题

response-times 这组数据非常关键，因为它推翻了一个常见直觉：问题不在于 maintainer 回得太慢，而在于大量 PR 根本没人看。

| 指标 | 数值 |
|---|---:|
| 已获 review 的 PR | 120 |
| `<1h` 首次 review | 104 |
| `1-4h` | 4 |
| `4-12h` | 11 |
| `12-24h` | 1 |
| `>24h` | 0 |

来源： [Response Times API](https://clawoss-dashboard.vercel.app/api/metrics/response-times)

也就是说，一旦 PR 进入 review 回路，它通常很快就能得到反馈；真正的问题是有 `71%` 的 PR 从未进入 review。`/api/metrics/action-items` 也把这一点列为 P0：“`290/410 PRs unreviewed (71%)`”。因此，ClawOSS 的瓶颈首先是 targeting 与 repo selection，而不是 reviewer latency。

### 6.5 Diff 尺寸与 PR 类型：不是越小越好，而是存在清晰甜区

`/api/metrics/pr-sizes` 与 `/api/metrics/correlations` 给出了很明确的形状：

| Diff 尺寸 | PR 数 | 已合并 | merge rate |
|---|---:|---:|---:|
| 1-10 行 | 193 | 17 | 8.8% |
| 11-25 行 | 65 | 7 | 10.8% |
| 26-50 行 | 58 | 8 | 13.8% |
| 51-100 行 | 37 | 8 | 21.6% |
| 101-200 行 | 22 | 0 | 0% |
| 201-500 行 | 23 | 0 | 0% |
| 500+ 行 | 12 | 0 | 0% |

来源： [PR Sizes API](https://clawoss-dashboard.vercel.app/api/metrics/pr-sizes) [Correlations API](https://clawoss-dashboard.vercel.app/api/metrics/correlations)

这个结果很重要。它说明 ClawOSS 并不是“越 tiny 的 PR 越容易 merge”。`1-10` 行的极小 PR 反而低于整体平均；真正的甜区在 `26-100` 行，尤其是 `51-100` 行，merge rate 达到 `21.6%`，比整体平均高 `122%`。这意味着当前系统里存在两类浪费：一类是过大的 PR 完全撞墙，另一类是过小的 PR 容易显得琐碎、低价值、像刷量。

PR 类型也类似：

| 类型 | PR 数 | 已合并 | merge rate |
|---|---:|---:|---:|
| docs | 37 | 7 | 18.9% |
| bug_fix | 289 | 30 | 10.4% |
| test | 41 | 3 | 7.3% |
| dep_update | 18 | 0 | 0% |
| feature | 6 | 0 | 0% |
| refactor | 4 | 0 | 0% |

来源： [PR Types API](https://clawoss-dashboard.vercel.app/api/metrics/pr-types)

docs 的表现最好，bug_fix 是可规模化主力，feature/dep_update/refactor 基本全灭。这说明系统如果继续以“广撒网式 generic code contribution”扩张，只会把低 η 进一步放大；相反，它应该更聚焦在 `26-100` 行的 bug fix / docs / narrowly scoped test 这种“低协调摩擦、高 maintainer 可判定性”的改动上。

### 6.6 质量分数高，但 merge rate 低：这是“好 patch 不等于好 portfolio”

quality 面板给出的表面印象其实很好：`avgScore = 81.5`，`firstPassRate = 97.5`。但同一面板又给出 `rejectionRate = 82.3`。这并不是简单矛盾，而是提示我们：这里的 quality 更像是“补丁局部质量”或“内部质量门”通过情况，不等于“repo 选择、时机、价值密度、maintainer 接受度”的组合质量。一个 patch 代码上很干净，不代表它对那个 repo、那个 issue、那个时点、那个 maintainer 来说是值得 merge 的。

这也是为什么 dashboard 后来新增了 repo-health、portfolio-health、correlations、action-items 等更“组合层”的面板：它在承认光有 patch-level quality 不够，必须把 portfolio management 纳入控制目标。

## 七、Dashboard 作为“二级控制面”：哪些指标已经形成反馈闭环

ClawOSS dashboard 当前最有价值的部分，不是展示图表，而是其中几条已经会反向驱动 agent 策略的“闭环信号”：

| 闭环信号 | 当前表现 | 说明 |
|---|---|---|
| directives | 连续发出 “MERGE NOW / TOO MANY DEAD REPOS / REWORK NEEDED” | dashboard 已经在给 agent 下操作层指令 |
| action-items | P0/P1/P2 任务列表直接指向 targeting、dedup、rework、follow-up | dashboard 已经在做策略建议器 |
| correlations | size/type/day-of-week 关联分析 | dashboard 已开始寻找“什么更容易 merge” |
| repo-health | 给出 target_actively / one_more_try / build_trust_first / avoid | dashboard 已开始做 portfolio scoring |

来源： [Directives API](https://clawoss-dashboard.vercel.app/api/metrics/directives) [Action Items API](https://clawoss-dashboard.vercel.app/api/metrics/action-items) [Correlations API](https://clawoss-dashboard.vercel.app/api/metrics/correlations) [Repo Health API](https://clawoss-dashboard.vercel.app/api/metrics/repo-health)

也正因为如此，ClawOSS 最有意思的研究点已经从“agent 会不会做事”转向“agent 如何被运营化”。它正在把 prompt engineering 演化成 policy tuning：调整 repo admission、PR size、rework policy、dedup guard、follow-up 触发条件，而不是单纯重写实现 prompt。

## 八、Token 使用、缓存结构与 context rot 管理

如果只看 dashboard，会以为 ClawOSS 的效率问题主要是 repo 漏斗；但本机 JSONL 历史再往下一层，揭示了它是如何在 token 维度上维持长时程运行的。

### 8.1 真实 token 结构：主会话靠巨量 cache read 存活

本机历史中，`/Users/kevinlin/.claude/projects/-Users-kevinlin-clawOSS/` 下与 ClawOSS 直接相关的 2 个主 orchestrator 会话，累计只有 `46,998` 输入 token，却伴随 `793,418` 输出 token、`45,237,821` cache creation token 和 `2,350,373,723` cache read token，`cache_read / cache_create ≈ 51.96`。workspace 下 16 个 subagent 会话则是 `86,393` 输入、`234,320` 输出、`3,774,873` cache creation、`60,277,325` cache read，`cache_read / cache_create ≈ 15.97`。

这说明 ClawOSS 的实际扩展性并不来自“把所有历史反复塞回模型”，而是来自三层结构：

1. 主 orchestrator 持续复用长期缓存与外置状态。
2. 子代理拿 fresh context 处理局部任务，避免把 repo 细节污染主会话。
3. 结果通过文件与摘要回写，而不是把整段执行对话回灌给主会话。

这和工作论文的“token 量级只是能源，真正关键是 η 与可分解性”高度契合。ClawOSS 不是靠单线推理撑到长时程，而是靠**分解 + 缓存 + 外置状态**把任务变成长期可运行系统。

### 8.2 Context rot 管理不是附属功能，而是主循环中心

当前代码里的关键参数非常明确：

| 参数 | 当前值 |
|---|---:|
| contextWindow | 204,800 |
| heartbeat 间隔 | 5 分钟 |
| maxConcurrent | 14 |
| maxHistoryShare | 0.35 |
| keepRecentTokens | 15,000 |
| recentTurnsPreserve | 3 |
| memoryFlush.softThresholdTokens | 30,000 |

来源： [config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json)

与此同时，live heartbeat 文档明确要求在周期开始、中间、处理结果后都检查上下文；一旦超过 `35%` 就压缩，而不是等到窗口快满再压缩。[workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md) 这和旧 README、旧 skill、DeepWiki 中还能看到的 `70%/80%/150k` 规则明显不同，说明 **当前系统已经把 context rot 视为一等风险**，并通过更保守的阈值前移了 compaction 触发点。

除此之外，ClawOSS 还用了几种非常具体的 anti-rot 手法：

| 手法 | 作用 |
|---|---|
| lazy-load memory files | 主会话只在需要时读取文件，避免全量载入 |
| fresh-context subagent | 把仓库级细节隔离在短命 worker |
| ANNOUNCE_SKIP | 子代理少说话，避免无效 token 消耗 |
| result/staging files | 用结构化摘要替代长对话 handoff |
| 处理后删除 result files | 防止已消费结果继续占上下文 |
| context flush files | 压缩前把关键状态写回 memory |

本地日志中的关键词统计也支持这个判断：最近相关会话里 `compact` 命中约 `385` 次、`ANNOUNCE_SKIP` 命中约 `108` 次、`stall/killed/stopped/stale` 命中超过 `1,200` 次。这些都说明 ClawOSS 真正面对的是“长期运行中的状态漂移、子任务停滞、结果堆积与上下文老化”，而不是一次性 prompt 成败。

## 九、哪些 dashboard 指标是强信号，哪些还是半成品或失真代理

这部分很关键，因为如果把所有面板都当真，分析会失焦。我的判断是：

### 9.1 强信号

- [Overview API](https://clawoss-dashboard.vercel.app/api/metrics/overview)：可作为累计漏斗与成本的主入口。
- [Velocity API](https://clawoss-dashboard.vercel.app/api/metrics/velocity)：能可靠反映 `2026-03-13` 到 `2026-03-21` 的提交/合并/关闭节奏。
- [Tokens API](https://clawoss-dashboard.vercel.app/api/metrics/tokens) 与 [Cost API](https://clawoss-dashboard.vercel.app/api/metrics/cost)：可用来估算 token 与成本历史。
- [Repos API](https://clawoss-dashboard.vercel.app/api/metrics/repos)、[Repo Health API](https://clawoss-dashboard.vercel.app/api/metrics/repo-health)、[PR Sizes API](https://clawoss-dashboard.vercel.app/api/metrics/pr-sizes)、[PR Types API](https://clawoss-dashboard.vercel.app/api/metrics/pr-types)、[Correlations API](https://clawoss-dashboard.vercel.app/api/metrics/correlations)：对“什么样的 repo/PR 更值钱”很有价值。

### 9.2 半成品或失真代理

- [Merge Probability API](https://clawoss-dashboard.vercel.app/api/metrics/merge-probability)：代码里权重与评估框架已经存在，但线上 `coveragePct = 0`、`scored = 0/410`，说明这套模型尚未真正接线上数据流。
- [Followups API](https://clawoss-dashboard.vercel.app/api/metrics/followups)：当前返回全零，但 action-items、alerts、directives 都把 follow-up 视为核心问题，说明不是 follow-up 不重要，而是 `subagent_runs` 这条链路没有形成有效历史。
- [Subagent Health API](https://clawoss-dashboard.vercel.app/api/metrics/subagent-health)：只认 `3` 个 always-on 和 `10` 个总槽位，且 `lastUpdated = null`；它已经和当前活文档中的 `4 always-on + 10 impl/follow-up = 14` 脱节。[dashboard/app/api/metrics/subagent-health/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/subagent-health/route.ts)
- [State API](https://clawoss-dashboard.vercel.app/api/state)：时间戳仍停在 `2026-03-15T18:43:41Z`，对当前生产态几乎没有解释力。
- [Connection Status API](https://clawoss-dashboard.vercel.app/api/connection-status)：能反映 heartbeat 管线与 metrics 管线分裂，但不能单独拿来判断系统“正常”。

### 9.3 自相矛盾但有研究价值的指标

- `portfolioScore = 17.7` 但 `status = healthy`。[Portfolio Health API](https://clawoss-dashboard.vercel.app/api/metrics/portfolio-health)
- `connection.state = connected`，却同时 `heartbeatStatus = offline`、`metrics = false`。[Connection Status API](https://clawoss-dashboard.vercel.app/api/connection-status)
- quality 很高，但 merge rate 很低、rejection 很高。[Quality API](https://clawoss-dashboard.vercel.app/api/metrics/quality)

这些矛盾并不只是 bug，它们恰好说明 ClawOSS 目前处在一个过渡阶段：dashboard 已经具备战略分析能力，但其底层遥测并没有完全统一，部分面板仍在“理想设计”和“真实生产”之间摇摆。

## 十、失败模式：系统当前最主要的损失函数

综合 dashboard、memory、JSONL 与公开 issue，当前主要失败模式不是单一的“离线”，而是以下几类：

### 10.1 Targeting 失败

`71%` 的 PR 没有拿到任何 review。这是最大的结构性损失。action-items 也把它列为 P0，说明系统当前最重要的不是写得更快，而是挑对 repo、挑对 issue、挑对 maintainer ecology。[Action Items API](https://clawoss-dashboard.vercel.app/api/metrics/action-items)

### 10.2 组合污染与重复打点

`47` 个 repo 已有 `3+` PR，`101` 个 duplicate 被 autonomy 记为惩罚项。公开 issue #1 对“AI slop” 的指责，本质上也是这个组合污染的外部社会反馈。[Autonomy API](https://clawoss-dashboard.vercel.app/api/metrics/autonomy) [GitHub Issue #1](https://github.com/billion-token-one-task/ClawOSS/issues/1)

### 10.3 Rework / follow-up 链路没有真正闭环

dashboard 强调 “rework needed” 与 “follow up”，但 followups 指标仍是全零，open PR 却有 `184` 个。这说明系统已经意识到跟进重要，但尚未把它沉淀成强可观测、强因果的流水线。

### 10.4 遥测分裂

真实 token 账本分散在 `metrics_tokens`、hook 侧估算、JSONL `usage.*` 与 live feed 的字符估算中；`context_tokens` 被写入但基本没有 downstream 消费；subagent health、followups、merge probability 这些更接近“策略面”的指标还没有稳定数据供给。这会直接削弱 dashboard 作为 control plane 的效用。

### 10.5 文档与运行态漂移

README、DeepWiki、旧脚本、live HEARTBEAT、dashboard API 对并发槽位、always-on agent 数量、context 阈值、cron 依赖等事实并不总一致。这个问题不一定立即造成停机，但会让人类操作者和自动策略器对“真实系统”形成不同心智模型。

## 十一、把工作论文映射到 ClawOSS：它已经证明了什么，还没证明什么

如果把你给的工作论文作为总框架，ClawOSS 已经证明了三件很重要的事。

第一，**单任务大规模 token 调度不等于单会话无限延长**。ClawOSS 的有效结构是 orchestrator + subagent + file-backed state + cache reuse，而不是长链条独白。

第二，**η 比 token 总量更关键**。dashboard 全部最强的信号都在说明“repo targeting、PR 尺寸、重复打点、follow-up、信任积累”才是决定 merge 的关键变量。只加 token，不提 η，只会更快地产生 0-review PR。

第三，**可验证性和反馈回路是生死线**。ClawOSS 最像论文的地方，不是 token 规模，而是它把 verify/review/rework/merge-ready 作为主目标函数，而不是把“生成了多少补丁”当产出。

但它还没有证明论文里更高量级的结论。当前 ClawOSS 更像一个 **10^8 级 token 预算下的自治工程系统原型**，而不是 10^11-10^12 级“认知基础设施”。它最强的部分是 scheduling primitives，最弱的部分是 causal telemetry 与 policy correctness。

## 十二、优先级最高的改进方向

1. 把 repo admission control 提升到主循环第 0 步，先筛 repo，再筛 issue，再决定是否开新 PR。目标不是更多 repo，而是更高 review-entry rate。
2. 强制 `max 1 open PR per repo`，并把“同 repo 连续失败/连续被无视”接成自动冷却机制。
3. 把 PR size policy 显式编译进实现 skill：默认目标 `26-100` 行，超过 `100` 行必须拆分或降 scope。
4. 把 follow-up/rework 从“意识到重要”升级为有真实历史账本的流水线；否则 open PR 只会越积越多。
5. 统一 token 遥测，停止在 overview/live feed 中混用真实账本与字符估算，并让 `context_tokens` 成为真正的控制信号。
6. 修复 merge-probability、subagent-health、followups 这些“想做策略但未接线”的面板，让 dashboard 真正从 observability 升级成 orchestrator companion。
7. 明确区分“活文档”和“历史文档”，至少在 README/DeepWiki/脚本输出中避免继续传播旧的并发、heartbeat、compaction 参数。

## 参考

- 核心框架：
  [单任务-万亿级Token调度架构框架-工作论文.md](/Users/kevinlin/Downloads/单任务-万亿级Token调度架构框架-工作论文.md)

- 仓库控制面与状态：
  [config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json)
  [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md)
  [workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md)
  [workspace/memory/heartbeat-checkpoint.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/heartbeat-checkpoint.md)
  [workspace/memory/failure-log.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/failure-log.md)
  [dashboard/app/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/page.tsx)
  [dashboard/app/live/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/live/page.tsx)
  [dashboard/app/api/metrics/action-items/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/action-items/route.ts)
  [dashboard/app/api/metrics/repo-health/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/repo-health/route.ts)
  [dashboard/app/api/metrics/merge-probability/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/merge-probability/route.ts)
  [dashboard/app/api/metrics/subagent-health/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/subagent-health/route.ts)

- 在线 dashboard 与公开证据：
  [Dashboard](https://clawoss-dashboard.vercel.app/)
  [Overview API](https://clawoss-dashboard.vercel.app/api/metrics/overview)
  [Velocity API](https://clawoss-dashboard.vercel.app/api/metrics/velocity)
  [Tokens API](https://clawoss-dashboard.vercel.app/api/metrics/tokens)
  [Cost API](https://clawoss-dashboard.vercel.app/api/metrics/cost)
  [Repos API](https://clawoss-dashboard.vercel.app/api/metrics/repos)
  [Repo Health API](https://clawoss-dashboard.vercel.app/api/metrics/repo-health)
  [PR Sizes API](https://clawoss-dashboard.vercel.app/api/metrics/pr-sizes)
  [PR Types API](https://clawoss-dashboard.vercel.app/api/metrics/pr-types)
  [Response Times API](https://clawoss-dashboard.vercel.app/api/metrics/response-times)
  [Quality API](https://clawoss-dashboard.vercel.app/api/metrics/quality)
  [Correlations API](https://clawoss-dashboard.vercel.app/api/metrics/correlations)
  [Action Items API](https://clawoss-dashboard.vercel.app/api/metrics/action-items)
  [Alerts API](https://clawoss-dashboard.vercel.app/api/metrics/alerts)
  [Autonomy API](https://clawoss-dashboard.vercel.app/api/metrics/autonomy)
  [Directives API](https://clawoss-dashboard.vercel.app/api/metrics/directives)
  [Portfolio Health API](https://clawoss-dashboard.vercel.app/api/metrics/portfolio-health)
  [Followups API](https://clawoss-dashboard.vercel.app/api/metrics/followups)
  [Subagent Health API](https://clawoss-dashboard.vercel.app/api/metrics/subagent-health)
  [Connection Status API](https://clawoss-dashboard.vercel.app/api/connection-status)
  [Conversation API](https://clawoss-dashboard.vercel.app/api/conversation)
  [State API](https://clawoss-dashboard.vercel.app/api/state)
  [Logs API](https://clawoss-dashboard.vercel.app/api/logs)

- 外部参照：
  [DeepWiki: ClawOSS](https://deepwiki.com/billion-token-one-task/ClawOSS)
  [GitHub Issue #1](https://github.com/billion-token-one-task/ClawOSS/issues/1)
