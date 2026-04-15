export interface AgentStatus {
  isOnline: boolean;
  lastHeartbeat: Date;
  currentTask: string | null;
  uptimeSeconds: number;
  heartbeatStreak: number;
}

export interface TaskInfo {
  repo: string;
  issue: number;
  title: string;
  branch: string;
  status: "analyzing" | "coding" | "testing" | "reviewing" | "submitting";
  progress: number;
}

export interface ActivityItem {
  id: string;
  type:
    | "pr_created"
    | "pr_merged"
    | "pr_closed"
    | "review_received"
    | "heartbeat"
    | "error"
    | "task_started";
  description: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
}

export interface PullRequest {
  id: string;
  githubId: number;
  repo: string;
  number: number;
  title: string;
  body: string | null;
  status: "open" | "merged" | "closed";
  qualityScore: number | null;
  createdAt: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
  additions: number;
  deletions: number;
  filesChanged: number;
  reviewCount: number;
  prType?: string | null;
  mergeProbability?: number | null;
  reviews?: PRReview[];
  qualityBreakdown?: QualityBreakdown | null;
}

export interface PRReview {
  id: string;
  reviewer: string;
  state: "approved" | "changes_requested" | "commented";
  body: string | null;
  submittedAt: Date;
}

export interface QualityBreakdown {
  overallScore: number;
  scopeCheck: number | null;
  codeQuality: number | null;
  testCoverage: number | null;
  security: number | null;
  antiSlop: number | null;
  gitHygiene: number | null;
  prTemplate: number | null;
}

export interface PullRequestSummary {
  id: string;
  number: number;
  title: string;
  repo: string;
  status: "open" | "merged" | "closed";
  qualityScore: number | null;
  mergeProbability?: number | null;
  createdAt: Date;
}

export interface PRFilterState {
  status: "all" | "open" | "merged" | "closed";
  repo: string;
  dateRange: "week" | "month" | "3months" | "all";
  minQuality: number;
  search: string;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: "debug" | "info" | "warn" | "error";
  source: string;
  message: string;
  metadata: Record<string, unknown>;
}

export interface LogFilterState {
  level: "all" | "debug" | "info" | "warn" | "error";
  source: string;
  dateRange: "today" | "yesterday" | "week" | "custom";
  search: string;
}

export interface CommandAuditEntry {
  id: string;
  timestamp: Date;
  action: string;
  sessionKey: string;
  senderId: string;
  source: string;
  details: Record<string, unknown>;
}

export interface DashboardSettings {
  targetRepos: string[];
  agentPaused: boolean;
  heartbeatIntervalMinutes: number;
  qualityThreshold: number;
  autoMerge: boolean;
  requiredReviews: number;
  notifications: {
    slackWebhookUrl: string;
    onError: boolean;
    onPRMerged: boolean;
    onPRRejected: boolean;
    onAgentOffline: boolean;
  };
  dailyBudgetUsd: number;
}

export interface ConversationMessage {
  id: string;
  sessionId: string;
  timestamp: Date;
  role: "user" | "assistant" | "tool_call" | "tool_result" | "system" | "thinking";
  content: string;
  toolName: string | null;
  toolCallId: string | null;
  durationMs: number | null;
  tokenCount: number | null;
  metadata: Record<string, unknown>;
}

export interface ConversationSession {
  sessionId: string;
  firstMessage: Date;
  lastMessage: Date;
  messageCount: number;
  isActive: boolean;
  repo: string | null;
  issue: string | null;
  label: string | null;
  isSubagent: boolean;
}

export interface WorkQueueItem {
  priority: "HIGH" | "MEDIUM" | "LOW";
  repo: string;
  issue: string;
  title: string;
  solvabilityScore: number;
  discovered: string;
}

export interface AgentState {
  id: string;
  timestamp: Date;
  currentSkill: string | null;
  currentRepo: string | null;
  currentIssue: string | null;
  workQueue: WorkQueueItem[];
  pipelineState: {
    activePRs: { repo: string; number: number; title: string; status: string }[];
    statsToday: {
      submitted: number;
      merged: number;
      rejected: number;
      abandoned: number;
    };
  };
  activeRepos: string[];
  metadata: Record<string, unknown>;
}

export interface DashboardOverview {
  agentStatus: AgentStatus;
  stats: {
    totalPRs: number;
    mergedPRs: number;
    openPRs: number;
    closedPRs: number;
    reviewedPRs: number;
    mergeRate: number;
    tokensUsedToday: number;
    inputTokensToday: number;
    outputTokensToday: number;
    costToday: number;
    totalCostAllTime: number;
    costPerMerge: number;
    tokensPerMerge: number;
    avgHoursToReview: number | null;
    activeModel: string;
  };
  funnel: {
    submitted: number;
    reviewed: number;
    merged: number;
    rejected: number;
    open: number;
  };
  followUps: {
    total: number;
    active: number;
    ledToMerge: number;
  };
  recentActivity: ActivityItem[];
  currentTask: TaskInfo | null;
  recentPRs: PullRequestSummary[];
  dailyBudget: {
    dailyPRs: number;
    perRepo: Record<string, number>;
  };
  runtime: {
    model: string;
    tokenBudget: {
      enabled: boolean;
      totalTokens: number;
      usedTokens: number;
      remainingTokens: number;
      paused: boolean;
    };
  };
}

export interface TokenUsageData {
  date: string;
  inputTokens: number;
  outputTokens: number;
}

export interface CostData {
  date: string;
  dailyCost: number;
  cumulativeCost: number;
}

export interface HealthData {
  heartbeat: {
    lastBeat: Date;
    intervalMinutes: number;
    streak: number;
  };
  uptime: {
    percentage: number;
    since: Date;
    totalDowntimeMinutes: number;
  };
  errorRate: {
    perHour: number;
    trend: "increasing" | "stable" | "decreasing";
    lastError: Date | null;
  };
  sessions: {
    key: string;
    state: string;
    duration: number;
    lastActivity: string;
  }[];
}

export interface QualityData {
  overview: {
    avgScore: number;
    avgScoreChange: number;
    firstPassRate: number;
    firstPassChange: number;
    reviewScore: number;
    rejectionRate: number;
    rejectionChange: number;
  };
  trend: { date: string; score: number }[];
  byRepo: { repo: string; avgScore: number; prCount: number }[];
  rejectionReasons: { reason: string; count: number; percentage: number }[];
  distribution: { range: string; count: number }[];
  feedback: {
    prNumber: number;
    prTitle: string;
    reviewer: string;
    comment: string;
    sentiment: "positive" | "negative" | "neutral";
    date: Date;
  }[];
}
