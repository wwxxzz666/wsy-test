import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const heartbeats = sqliteTable("heartbeats", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["alive", "degraded", "offline"] }).notNull(),
  currentTask: text("current_task"),
  uptimeSeconds: integer("uptime_seconds"),
  metadata: text("metadata", { mode: "json" }),
});

export const pullRequests = sqliteTable("pull_requests", {
  id: text("id").primaryKey(),
  githubId: integer("github_id").notNull(),
  repo: text("repo").notNull(),
  number: integer("number").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  status: text("status", { enum: ["open", "merged", "closed"] }).notNull(),
  qualityScore: real("quality_score"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  mergedAt: integer("merged_at", { mode: "timestamp" }),
  closedAt: integer("closed_at", { mode: "timestamp" }),
  additions: integer("additions").default(0),
  deletions: integer("deletions").default(0),
  filesChanged: integer("files_changed").default(0),
  reviewCount: integer("review_count").default(0),
  htmlUrl: text("html_url"),
  prType: text("pr_type", {
    enum: ["bug_fix", "docs", "typo", "dep_update", "test", "dead_code", "feature", "refactor", "other"],
  }),
  mergeProbability: integer("merge_probability"),
  metadata: text("metadata", { mode: "json" }),
});

export const prReviews = sqliteTable("pr_reviews", {
  id: text("id").primaryKey(),
  prId: text("pr_id")
    .notNull()
    .references(() => pullRequests.id),
  reviewer: text("reviewer").notNull(),
  state: text("state", {
    enum: ["approved", "changes_requested", "commented"],
  }).notNull(),
  body: text("body"),
  submittedAt: integer("submitted_at", { mode: "timestamp" }).notNull(),
});

export const qualityScores = sqliteTable("quality_scores", {
  id: text("id").primaryKey(),
  prId: text("pr_id")
    .notNull()
    .references(() => pullRequests.id),
  overallScore: real("overall_score").notNull(),
  scopeCheck: real("scope_check"),
  codeQuality: real("code_quality"),
  testCoverage: real("test_coverage"),
  security: real("security"),
  antiSlop: real("anti_slop"),
  gitHygiene: real("git_hygiene"),
  prTemplate: real("pr_template"),
  scoredAt: integer("scored_at", { mode: "timestamp" }).notNull(),
});

export const metricsTokens = sqliteTable("metrics_tokens", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  channel: text("channel"),
  provider: text("provider"),
  model: text("model"),
  inputTokens: integer("input_tokens").default(0),
  outputTokens: integer("output_tokens").default(0),
  costUsd: real("cost_usd").default(0),
  runDurationMs: integer("run_duration_ms"),
  contextTokens: integer("context_tokens"),
});

export const agentLogs = sqliteTable("agent_logs", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  level: text("level", {
    enum: ["debug", "info", "warn", "error"],
  }).notNull(),
  source: text("source"),
  message: text("message").notNull(),
  metadata: text("metadata", { mode: "json" }),
});

export const commandAudit = sqliteTable("command_audit", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  action: text("action").notNull(),
  sessionKey: text("session_key"),
  senderId: text("sender_id"),
  source: text("source"),
  details: text("details", { mode: "json" }),
});

export const conversationMessages = sqliteTable("conversation_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  role: text("role", {
    enum: ["user", "assistant", "tool_call", "tool_result", "system", "thinking"],
  }).notNull(),
  content: text("content").notNull(),
  toolName: text("tool_name"),
  toolCallId: text("tool_call_id"),
  durationMs: integer("duration_ms"),
  tokenCount: integer("token_count"),
  metadata: text("metadata", { mode: "json" }),
});

export const agentState = sqliteTable("agent_state", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  currentSkill: text("current_skill"),
  currentRepo: text("current_repo"),
  currentIssue: text("current_issue"),
  workQueue: text("work_queue", { mode: "json" }),
  pipelineState: text("pipeline_state", { mode: "json" }),
  activeRepos: text("active_repos", { mode: "json" }),
  metadata: text("metadata", { mode: "json" }),
});

export const subagentRuns = sqliteTable("subagent_runs", {
  id: text("id").primaryKey(),
  sessionId: text("session_id"),
  repo: text("repo").notNull(),
  issueOrPr: text("issue_or_pr"),
  type: text("type", { enum: ["implementation", "followup"] }).notNull(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp" }),
  durationMs: integer("duration_ms"),
  outcome: text("outcome", {
    enum: ["success", "failure", "abandoned", "in_progress"],
  }).notNull(),
  failureReason: text("failure_reason"),
  prNumber: integer("pr_number"),
  metadata: text("metadata", { mode: "json" }),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const autonomySnapshots = sqliteTable("autonomy_snapshots", {
  id: text("id").primaryKey(),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  score: integer("score").notNull(),
  totalPrs: integer("total_prs"),
  mergedPrs: integer("merged_prs"),
  duplicateCount: integer("duplicate_count"),
  oversizedCount: integer("oversized_count"),
  wastedCount: integer("wasted_count"),
  promptGaps: integer("prompt_gaps"),
  metadata: text("metadata", { mode: "json" }),
});
