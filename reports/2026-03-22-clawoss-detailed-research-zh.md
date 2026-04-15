# ClawOSS 详细研究报告：Dashboard、Token 调度与自治 OSS 贡献控制面

本报告是对 [2026-03-22-clawoss-token-scheduling-research-zh.md](/Users/kevinlin/Downloads/clawOSS/reports/2026-03-22-clawoss-token-scheduling-research-zh.md) 的扩展版。它不再把分析重心放在“系统当前是否在线”，而是把 ClawOSS 视为一个长期运行的自治 OSS 贡献系统，研究三个层面：其一，系统究竟想优化什么；其二，dashboard 如何把这种目标函数编码成运营与策略指标；其三，底层 session log、memory 文件与 dashboard 历史序列是否彼此一致。样本包括：仓库内控制面文档与代码、`~/.claude/projects/` 下与 ClawOSS 相关的历史 JSONL 会话、`workspace/memory/` 中的运行快照，以及 `2026-03-22` 公共 dashboard/API 的在线数据。

## 一、核心结论

ClawOSS 真正要解决的问题，不是“能不能自动写补丁”，而是“如何把一个会消耗大量 token 的自治系统，约束成一个能持续产出 merged PR 的贡献漏斗”。这一点在主控制文档里写得非常直白：[workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md#L3) 把使命定义为“`MERGED contributions`”，并明确“`Optimize for merge rate, not submission count`”；[config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json#L57) 的 heartbeat prompt 也反复强调“`GOAL: MERGED PRs. Not submitted PRs — MERGED.`”。

从这个角度看，dashboard 不是一个被动监控台，而是一个二级控制平面。它持续度量 repo 选择、PR 形状、review 速度、重复提交、死仓库命中率、rework 空间、post-merge 健康度，以及自治策略的 prompt gap。当前公开快照显示：系统累计 `410` 个 PR，其中 `40` merged、`184` open、`186` closed、`120` reviewed，整体 `mergeRate = 9.8%`，`avgHoursToReview = 1.4`，`totalCostAllTime = $129.355722`，`costPerMerge = $3.23389305`，`tokensPerMerge = 4,457,451`。[overview](https://clawoss-dashboard.vercel.app/api/metrics/overview) 这些数字说明 ClawOSS 已经不是 demo，而是一个带真实产出和真实损耗的自治生产系统。

但更重要的是，系统的瓶颈已经从“生成能力”转向“组合管理能力”。dashboard 明确给出的行动项不是“写出更好代码”，而是“修 repo targeting”、“去重”、“停止打死仓库”、“把 closed PR 变成 rework 管线”、“提升 follow-up 纪律”。[action-items](https://clawoss-dashboard.vercel.app/api/metrics/action-items) 甚至直接指出 `290/410` PR 没有得到任何 review、`47` 个 repo 有 `3+` PR、`52` 个 repo 有 `2+` PR 但 `0` merge、`186` 个 PR 已被关闭、`184` 个 PR 仍在等待处理。换句话说，ClawOSS 当前最缺的不是补丁生成，而是 admission control、去重、关系管理和后续跟进。

## 二、ClawOSS 在解决什么问题

如果用你给的工作论文 [单任务-万亿级Token调度架构框架-工作论文.md](/Users/kevinlin/Downloads/单任务-万亿级Token调度架构框架-工作论文.md) 的语言来说，ClawOSS 不是“更大的单窗口”，而是一个把 token 预算转成长期认知工作的原型。它解决的问题可以表述为：

1. 如何让一个高 token 预算的系统，在数小时到数天的运行中不被 context rot 拖垮。
2. 如何把复杂目标分解成 fresh-context worker，而不是把所有状态都压在同一条对话线上。
3. 如何把“提交 PR”这个表面目标，改写成“得到 review、争取 merge、形成 repo 信任积累”这个更真实的目标。

ClawOSS 的设计答案是：主会话只做 orchestrator，不亲自编码；所有编码与 follow-up 由新鲜上下文 subagent 执行；状态被外置到文件；dashboard 再把 portfolio 结果回灌成指令。这一点在 [workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md#L12) 和 [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md#L54) 中非常完整：`1 orchestrator + 4 always-on + 10 impl/followup`，always-on 包括 `scout`、`pr-monitor-scan`、`pr-monitor-deep`、`pr-analyst`，真正做实现的是十个 implementation/follow-up 槽位。主会话负责发现、评分、派工、去重、消费结果、更新账本、压缩上下文和自唤醒。

这也是为什么它更像一个“自治贡献操作系统”，而不是一个普通 coding agent：它优化的是 merge yield 和 repo trust，而不是单次 patch 完成率。

## 三、Agent 结构与上下文调度机制

ClawOSS 的上下文控制是它最成熟的一部分。当前配置把模型上下文窗口设为 `204,800` token，`maxTokens = 131,072`，并把 compaction 配成 `safeguard` 模式，保留 `15,000` recent tokens、保留最近 `3` 轮、把 `maxHistoryShare` 限制在 `0.35`，并且在 compaction 前强制把当前状态冲刷到 memory 文件中。[config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json#L4) [config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json#L73)

更关键的是，live HEARTBEAT 规则比旧文档更激进。主循环在 step `0a2` 要求：一旦 `session_status` 超过 `35%`，立即 compact，而不是等到 70% 或 80%。[workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md#L38) 同一文件还要求 cycle 中途也做 context check，并在处理完 subagent result 后再次检查；如果超过 `35%`，必须先 compact 再继续。[workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md#L42) [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md#L170) 运行快照也印证了这种压力：[workspace/memory/heartbeat-checkpoint.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/heartbeat-checkpoint.md) 明确记录过 `Context at 74%`，同时队列有 `75` 项，说明 context 压力在真实运行中非常高。

ClawOSS 缓解 context rot 的办法可以概括为四层：

| 机制 | 证据 | 作用 |
|---|---|---|
| 文件化状态 | [workspace/memory/](/Users/kevinlin/Downloads/clawOSS/workspace/memory) | 把长期状态从聊天上下文剥离出去 |
| lazy loading | [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md#L10) | 只读当前步骤需要的 memory 文件 |
| fresh-context subagents | [workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md#L21) | 把实现工作隔离成新会话，避免 orchestrator 污染 |
| result 文件 + 立即删除 | [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md#L177) | 让主会话只消费摘要，不保留冗余轨迹 |

`ANNOUNCE_SKIP` 也是一个很关键的细节：subagent 不是把完整运行轨迹再发回主会话，而是把结构化结果写到 `memory/subagent-result-*.md`，主会话读 YAML frontmatter 后更新账本即可。[workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md#L26) [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md#L155) 这对应工作论文里“可分解性 + 外部存储”的路线：状态压缩损失不可避免，但可以通过分层、摘要和验证闭环把损失降到可控范围。

## 四、Dashboard 不是监控台，而是策略控制面

从代码看，dashboard 的公开页面只有 7 个：`/`、`/live`、`/prs`、`/repos`、`/health`、`/quality`、`/logs`。[dashboard/components/layout/app-sidebar.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/components/layout/app-sidebar.tsx#L30) 但 overview 页面实际上组合了远多于 7 个 metric surface：live agent status、alerts、subagent health、throughput、portfolio health、repo health、merge intelligence、autonomy、PR 类型/尺寸、response times、directives、action items、post-merge、correlations、follow-ups、recent PRs、agent state 等。[dashboard/app/page.tsx](/Users/kevinlin/Downloads/clawOSS/dashboard/app/page.tsx#L156)

代码里共暴露了 23 个 metrics/read 路由，包括 `overview`、`autonomy`、`action-items`、`correlations`、`pr-sizes`、`pr-types`、`quality`、`repos`、`repo-health`、`response-times`、`throughput`、`velocity`、`post-merge`、`stale-prs`、`alerts`、`followups`、`subagent-health` 等。它们对应的是“什么样的工作值得继续做”的多个切面，而不仅是“机器有没有在跑”。

最值得注意的是，这些路由实际上在定义一套自治优化目标：

1. `repos` 和 `repo-health` 在对 repo 进行 portfolio ranking。
2. `correlations`、`pr-sizes`、`pr-types` 在学习“何种 PR 形状更容易 merge”。
3. `autonomy` 在做 prompt-gap 归因：重复、过大 diff、wasted cycle、quick reject、dead repo targeting。
4. `action-items` 把这些缺陷翻译成下一轮策略动作。
5. `post-merge` 试图把 merge 之后的回归风险也纳入闭环。

因此，这个 dashboard 的真正角色更接近“运行中的策略引擎 + 复盘仪表板”，而不是 uptime page。

## 五、Dashboard 历史数据：这不是“离线系统”，而是“代价真实但回报分化的系统”

### 1. 产出与成本时间序列

公开 token 历史集中在 `2026-03-15` 到 `2026-03-18` 四天：

| 日期 | 输入 token | 输出 token | 每日成本 | 提交 PR | 合并 PR |
|---|---:|---:|---:|---:|---:|
| 2026-03-15 | 9,475,068 | 149,434 | $6.13 | 33 | 2 |
| 2026-03-16 | 35,603,026 | 1,660,561 | $26.34 | 92 | 7 |
| 2026-03-17 | 79,179,916 | 4,596,912 | $61.30 | 175 | 17 |
| 2026-03-18 | 44,716,328 | 2,916,807 | $35.58 | 99 | 8 |

来源：[tokens](https://clawoss-dashboard.vercel.app/api/metrics/tokens) [cost](https://clawoss-dashboard.vercel.app/api/metrics/cost) [velocity](https://clawoss-dashboard.vercel.app/api/metrics/velocity?range=30d)

四天合计 `168,974,338` 输入 token、`9,323,714` 输出 token，输入/输出比约 `18.1x`。如果按 daily submission 粗算，单个新 PR 的 token 消耗从 `291,651` 上升到 `481,143`，说明随着系统进入后期，单位 PR 的搜索、协调和上下文成本在抬升。这既可以理解为“更深入的 repo 理解”，也可以理解为“随着组合复杂度上升，单位产出的协调耗散变大”。

同时，velocity 曲线很有信息量：`3/15 -> 3/18` 是明显的 submission burst，`33 -> 92 -> 175 -> 99`；`3/19 -> 3/21` 则几乎没有新提交，但仍有 residual merge 和 close。这表明 ClawOSS 的实际运行节奏已经接近“前期集中开仓，后期等待 review/merge/close 清算”，而不是稳定匀速的流水线。

### 2. Review 响应不是主瓶颈，review 覆盖才是

overview 给出的 `avgHoursToReview = 1.4h` 很容易让人误以为 maintainer 响应慢。但 `response-times` 的分布恰恰相反：`120` 个 reviewed PR 中，有 `104` 个在 `<1h` 内拿到首评，`4` 个在 `1-4h`，`11` 个在 `4-12h`，只有 `1` 个落在 `12-24h`。[response-times](https://clawoss-dashboard.vercel.app/api/metrics/response-times?range=30d) 也就是说，一旦 repo 决定看你，通常看得很快。

真正的问题是 review coverage 只有 `29.3%`。`action-items` 直接指出 `290/410` PR 没有收到任何 review。换言之，ClawOSS 的瓶颈不是“review 太慢”，而是“绝大多数 PR 根本没有进入 maintainer 的注意力范围”。这使得 repo targeting 成为比补丁质量更根本的问题。

### 3. 什么样的 PR 更容易 merge

`pr-sizes` 和 `correlations` 提供了非常清晰的策略信号：

- sweet spot 是 `25-100` 行，`97` 个 PR 落在该区间，merge rate `16.5%`，明显高于区间外的 `7.7%`。
- 单看 bucket，`51-100` 行最好，merge rate `21.6%`；`26-50` 行次之，`13.8%`。
- 超过 `100` 行后 merge rate 直接塌到 `0%`。

[pr-sizes](https://clawoss-dashboard.vercel.app/api/metrics/pr-sizes?range=30d) [correlations](https://clawoss-dashboard.vercel.app/api/metrics/correlations)

按 PR type 看：

- `docs`: `18.9%`
- `bug_fix`: `10.4%`
- `test`: `7.3%`
- `feature` / `dep_update` / `refactor` / `typo`: 当前快照基本 `0%`

[pr-types](https://clawoss-dashboard.vercel.app/api/metrics/pr-types?range=30d)

这和仓库内策略文档是高度一致的。[workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md#L91) 早就把 typo/docs/test/bug fix 排成贡献类型优先级，并明确把 feature/refactor/dep update 排除在外。也就是说，dashboard 并不是事后瞎分析，它是在验证 repo policy 与真实 merge 数据是否一致。

## 六、Repo 组合：强重尾、强集中、强路径依赖

repo 分布呈现极强的重尾。当前 `122` 个 repo 中：

- Top 3 repo 吃掉全部 PR 的 `20.0%`
- Top 10 repo 吃掉 `40.2%`
- 只有 `15` 个 repo 曾经产生过任何 merge
- `107` 个 repo 仍然是零 merge
- `37` 个 repo 已有 `3+` PR 且仍然 `0` merge

这些是从 [repos](https://clawoss-dashboard.vercel.app/api/metrics/repos?range=90d) 和 [repo-health](https://clawoss-dashboard.vercel.app/api/metrics/repo-health?range=90d) 汇总出来的。

最能说明问题的 repo 有三类：

1. **高容量高回报**：`DioCrafts/OxiCloud`，`22` total / `21` merged / `1` open。它说明“回到 winner repo 持续耕作”是非常有效的。
2. **高容量中回报但高 backlog**：`manaflow-ai/cmux`，`42` total / `5` merged / `35` open。它显示同一个 repo 也可能既是高价值池，又是 backlog 黑洞。
3. **高容量低回报**：`BerriAI/litellm`，`14` total / `1` merged / `9` open；`huggingface/transformers`，`18` total / `1` merged / `14` closed / `3` open。它们提示“热门 repo ≠ 高 merge repo”。

还要注意 dashboard 内部其实存在两套 repo 评分模型：

- `/api/metrics/repos` 给出的是 `target/watch/avoid`，其 health score 主要按 resolved merge rate、review responsiveness、review coverage、open backlog 和 subagent success 组合。[dashboard/app/api/metrics/repos/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/repos/route.ts#L98)
- `/api/metrics/repo-health` 给出的是 `target_actively / one_more_try / build_trust_first / avoid`，其 health score 则按 `40% merge rate + 30% review rate + 20% 首评速度 + 10% quality + niche bonus` 计算，另外再派生 `mergePrediction`。[dashboard/app/api/metrics/repo-health/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/repo-health/route.ts#L187) [dashboard/app/api/metrics/repo-health/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/repo-health/route.ts#L220)

这会导致同一个 repo 在两个面板里出现不同表情。例如 `manaflow-ai/cmux` 在 `repos` 视图里是高 health 的 `target`，但在 `repo-health` 视图里 healthScore 并不高，只是因为 responsive 且有历史 merge，所以仍被标成 `target_actively`。这说明 dashboard 自身也在实验不同的 portfolio heuristic，尚未完全收敛为单一真相。

## 七、原始 session log：主会话昂贵，worker 会话便宜，系统真正的成本骨架在控制面

本地 `.claude` 历史日志提供了 dashboard 之外的另一个真相：ClawOSS 并不是靠一条超长上下文硬抗，而是靠少数极长 orchestrator 会话加大量短促 worker 会话来运行。

在过滤掉两条明显无关的会话后，主 orchestrator 相关会话里真正昂贵的是两条长会话：

- [2769459a-7c71-4810-aa20-785d43088666.jsonl](/Users/kevinlin/.claude/projects/-Users-kevinlin-clawOSS/2769459a-7c71-4810-aa20-785d43088666.jsonl)
- [824e58bb-d6ae-4abf-89e2-e3449c83b802.jsonl](/Users/kevinlin/.claude/projects/-Users-kevinlin-clawOSS/824e58bb-d6ae-4abf-89e2-e3449c83b802.jsonl)

子代理分析显示：在过滤后的主会话集合中，这两条长会话只占输入 token 的 `69.8%`，却吞掉了 `98.2%` 输出、`98.9%` cache creation、`99.85%` cache read。主会话总体是 `4,357` assistant turns、`3,091` tool uses、`67,290` input tokens、`807,753` output tokens、`45,723,553` cache creation、`2,353,810,544` cache read。它的真正成本结构不是“更多输入”，而是“超重 cache read + 长时程控制逻辑”。

workspace 侧则是完全不同的形态：`13` 个实际 subagent 会话总共只有 `115.0` 分钟，median `8.8` 分钟，`721` assistant turns、`461` tool uses、`85,991` input tokens、`167,920` output tokens、`2,367,076` cache creation、`35,499,314` cache read；外加 `4` 个用于展开 spawn template 的轻量会话。换句话说，worker 很便宜，orchestrator 很贵。

这说明 ClawOSS 的 token 经济学和普通聊天系统完全不同：

1. 真正昂贵的是主控制面反复读取状态、派工、消费结果、保持长时程意图一致性。
2. 真正便宜的是单个具体任务的执行与验证。
3. 系统一旦出现 targeting 或 dedup 失误，浪费的不是单个 patch 的几千 token，而是会反向污染昂贵的 orchestrator 周期。

日志关键字也支持这一点：`compact`、`403/content filter`、`quota/usage limit`、`ANNOUNCE_SKIP`、`already_fixed_upstream`、`stale_reset` 都是高频模式，说明 ClawOSS 的长期运行挑战主要是 compaction、过滤器、配额、重复劳动和陈旧状态管理，而不是基础编码本身。

## 八、失败模式：最大损失来自策略泄漏，不是模型失灵

如果把 dashboard、memory 文件和原始日志拼起来，ClawOSS 的主要失效模式可以分为五类：

### 1. Targeting failure

这是最大的失败源。dashboard action items 把它列为 P0：`71%` PR 无 review，说明系统经常把 token 花在不会接收外部贡献的 repo 上。[action-items](https://clawoss-dashboard.vercel.app/api/metrics/action-items)

### 2. Duplicate / oversaturation

`autonomy` 面板把 duplicate 作为 critical prompt gap；当前重复问题包括 `101` duplicate PR、`47` 个 repo 有 `3+` PR、`24` 个 repo 有 `3+` PR 且 `0` merge。[autonomy](https://clawoss-dashboard.vercel.app/api/metrics/autonomy) 这意味着 reputation burn 已经成为系统级成本，而不只是单次小事故。

### 3. Follow-up 缺失

最反常的信号之一是：dashboard 一边在 overview 和 directives 里反复强调 rework/follow-up，一边 `/api/metrics/followups` 仍然是 `0/0/0`。[followups](https://clawoss-dashboard.vercel.app/api/metrics/followups?range=30d) 这说明 follow-up 行为可能存在，但没有形成稳定、结构化、可计量的账本。于是系统知道“应该跟进”，却不具备可靠的“跟进闭环度量”。

### 4. Telemetry split-brain

token 账本的 truth source 其实分裂成两条：

- hook 侧在 `after_tool_call` 阶段按参数 JSON 长度估 token，`input ~= chars/4`，`output ~= chars/8`。[workspace/hooks/dashboard-reporter/handler.ts](/Users/kevinlin/Downloads/clawOSS/workspace/hooks/dashboard-reporter/handler.ts#L236)
- `dashboard-sync.sh` 则从 JSONL `usage.input` / `usage.output` 里抽真值，再 POST 到 metrics ingest。[scripts/dashboard-sync.sh](/Users/kevinlin/Downloads/clawOSS/scripts/dashboard-sync.sh#L138)

overview 当天没有 metrics 时还会回退到启发式估算，这意味着某些页面呈现的是精确账本，某些呈现的是估算值。再加上 retention 只保留 conversation/heartbeat `7` 天、logs `14` 天、metrics `30` 天，[dashboard/lib/db.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/lib/db.ts) dashboard 本身并不是完整长期档案，必须和 JSONL + memory 文件联合使用。

### 5. 观测面自相矛盾

`connection-status` 会说 `connected`，但同时 `heartbeatStatus = offline`、`metrics = false`。[connection-status](https://clawoss-dashboard.vercel.app/api/connection-status) `portfolio-health` 会给出 `portfolioScore = 17.7`，却仍返回 `status = healthy`。[portfolio-health](https://clawoss-dashboard.vercel.app/api/metrics/portfolio-health) `subagent-health` 结构上几乎是空的。[subagent-health](https://clawoss-dashboard.vercel.app/api/metrics/subagent-health) 这说明 dashboard 里有些面板已经是成熟信号，有些仍是 scaffold。

## 九、与工作论文的对应：ClawOSS 是“认知卡诺效率”问题，不是“窗口大小”问题

把这套系统映射到工作论文，有四个最清楚的对应点。

第一，ClawOSS 已经证明“单任务大 token 调度”最关键的不是更大窗口，而是更高 η。当前问题不是 token 不够，而是太多 token 没变成 maintainer 愿意 merge 的工作。`4,457,451` tokens per merge 已经足以说明系统的有效功比例仍偏低。

第二，ClawOSS 的 strongest move 是可分解性，而不是单线长推理。外置状态、fresh-context subagent、ANNOUNCE_SKIP、result files、lazy loading，这些都在用架构换 context headroom。

第三，ClawOSS 已经把“验证-修复循环”写入制度。implementation workflow 要 reproduce-first，follow-up 要读评论、改分支、重新 push、再回应 reviewer。[workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md#L131) [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md#L145) 这与论文里“没有验证-修复闭环的大规模链式推理必然失效”的判断高度一致。

第四，ClawOSS 当前最接近论文里的“质量退化 ε”的，不是模型推理错误，而是：陈旧账本、重复 PR、错打 repo、follow-up 丢账、指标定义漂移、恢复路径抹平证据。这些都属于状态压缩与控制面漂移，而不是单次回答质量问题。

## 十、最值得做的改进

从现有证据看，最有杠杆的改进不在“换更强模型”，而在以下五项：

1. **硬 admission control**：同 repo 最多 `1` 个 open PR；`2` 次 closed-without-merge 触发冷却；repo blocklist 在 spawn 前而不是在事后生效。
2. **把 follow-up 变成一等公民**：follow-up / rework 要有真实 ledger、success rate、round count、conversion-to-merge 指标，而不是继续挂在“待实现”状态。
3. **统一 token truth**：所有页面统一区分 exact 和 estimated，避免 live surface 把估算值伪装成真值。
4. **合并 repo scoring model**：`repos` 与 `repo-health` 两套评分逻辑应收敛，至少在 UI 上明确说明二者差异，否则会误导 orchestrator 的策略学习。
5. **更偏向已验证 sweet spot**：响应快 repo、25-100 行 diff、docs/bug_fix、小而清晰的改动，已经被 dashboard 明确验证为高收益策略，应当成为默认容量分配方向。

## 参考

- 仓库控制面与运行文档：
  [config/openclaw.json](/Users/kevinlin/Downloads/clawOSS/config/openclaw.json)
  [workspace/HEARTBEAT.md](/Users/kevinlin/Downloads/clawOSS/workspace/HEARTBEAT.md)
  [workspace/AGENTS.md](/Users/kevinlin/Downloads/clawOSS/workspace/AGENTS.md)
  [workspace/memory/heartbeat-checkpoint.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/heartbeat-checkpoint.md)
  [workspace/memory/failure-log.md](/Users/kevinlin/Downloads/clawOSS/workspace/memory/failure-log.md)
  [workspace/hooks/dashboard-reporter/handler.ts](/Users/kevinlin/Downloads/clawOSS/workspace/hooks/dashboard-reporter/handler.ts)
  [scripts/dashboard-sync.sh](/Users/kevinlin/Downloads/clawOSS/scripts/dashboard-sync.sh)
  [dashboard/app/api/metrics/repos/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/repos/route.ts)
  [dashboard/app/api/metrics/repo-health/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/repo-health/route.ts)
  [dashboard/app/api/metrics/autonomy/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/autonomy/route.ts)
  [dashboard/app/api/metrics/correlations/route.ts](/Users/kevinlin/Downloads/clawOSS/dashboard/app/api/metrics/correlations/route.ts)

- 原始历史日志：
  [2769459a-7c71-4810-aa20-785d43088666.jsonl](/Users/kevinlin/.claude/projects/-Users-kevinlin-clawOSS/2769459a-7c71-4810-aa20-785d43088666.jsonl)
  [824e58bb-d6ae-4abf-89e2-e3449c83b802.jsonl](/Users/kevinlin/.claude/projects/-Users-kevinlin-clawOSS/824e58bb-d6ae-4abf-89e2-e3449c83b802.jsonl)

- 在线 dashboard 与公开数据：
  [Dashboard](https://clawoss-dashboard.vercel.app/)
  [overview](https://clawoss-dashboard.vercel.app/api/metrics/overview)
  [tokens](https://clawoss-dashboard.vercel.app/api/metrics/tokens)
  [cost](https://clawoss-dashboard.vercel.app/api/metrics/cost)
  [velocity](https://clawoss-dashboard.vercel.app/api/metrics/velocity?range=30d)
  [repos](https://clawoss-dashboard.vercel.app/api/metrics/repos?range=90d)
  [repo-health](https://clawoss-dashboard.vercel.app/api/metrics/repo-health?range=90d)
  [quality](https://clawoss-dashboard.vercel.app/api/metrics/quality?range=90d)
  [pr-sizes](https://clawoss-dashboard.vercel.app/api/metrics/pr-sizes?range=30d)
  [pr-types](https://clawoss-dashboard.vercel.app/api/metrics/pr-types?range=30d)
  [response-times](https://clawoss-dashboard.vercel.app/api/metrics/response-times?range=30d)
  [autonomy](https://clawoss-dashboard.vercel.app/api/metrics/autonomy)
  [action-items](https://clawoss-dashboard.vercel.app/api/metrics/action-items)
  [alerts](https://clawoss-dashboard.vercel.app/api/metrics/alerts)
  [post-merge](https://clawoss-dashboard.vercel.app/api/metrics/post-merge)
  [followups](https://clawoss-dashboard.vercel.app/api/metrics/followups?range=30d)
  [portfolio-health](https://clawoss-dashboard.vercel.app/api/metrics/portfolio-health)
  [subagent-health](https://clawoss-dashboard.vercel.app/api/metrics/subagent-health)
  [connection-status](https://clawoss-dashboard.vercel.app/api/connection-status)
  [conversation](https://clawoss-dashboard.vercel.app/api/conversation)
  [state](https://clawoss-dashboard.vercel.app/api/state)
