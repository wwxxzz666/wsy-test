/**
 * Cost models for different LLM providers.
 * Prices are in USD per token.
 */
export interface CostModel {
  name: string;
  provider: string;
  inputCostPerToken: number;
  outputCostPerToken: number;
}

function parseEnvNumber(
  value: string | undefined,
  fallback: number
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const ENV_DEFAULT_MODEL =
  process.env.NEXT_PUBLIC_CLAWOSS_MODEL_PRIMARY ||
  process.env.CLAWOSS_MODEL_PRIMARY;
const DEFAULT_MODEL =
  (ENV_DEFAULT_MODEL && ENV_DEFAULT_MODEL.trim()) ||
  "openrouter/openai/gpt-4.1-mini";
const DEFAULT_PROVIDER = DEFAULT_MODEL.includes("/")
  ? DEFAULT_MODEL.split("/")[0]
  : "custom";
const DEFAULT_INPUT_PER_MTOK = parseEnvNumber(
  process.env.NEXT_PUBLIC_CLAWOSS_MODEL_INPUT_COST_PER_MTOK ||
    process.env.CLAWOSS_MODEL_INPUT_COST_PER_MTOK,
  0.6
);
const DEFAULT_OUTPUT_PER_MTOK = parseEnvNumber(
  process.env.NEXT_PUBLIC_CLAWOSS_MODEL_OUTPUT_COST_PER_MTOK ||
    process.env.CLAWOSS_MODEL_OUTPUT_COST_PER_MTOK,
  3.0
);
const DEFAULT_MODEL_NAME =
  process.env.NEXT_PUBLIC_CLAWOSS_MODEL_NAME ||
  process.env.CLAWOSS_MODEL_NAME ||
  DEFAULT_MODEL;

const STATIC_COST_MODELS: Record<string, CostModel> = {
  "kimi-coding/k2p5": {
    name: "Kimi K2.5 (Kimi Code)",
    provider: "kimi-code",
    inputCostPerToken: 0.6 / 1_000_000,
    outputCostPerToken: 3.0 / 1_000_000,
  },
  "z-ai/glm-5": {
    name: "GLM-5",
    provider: "openrouter",
    inputCostPerToken: 0.72 / 1_000_000,
    outputCostPerToken: 2.3 / 1_000_000,
  },
  "moonshotai/kimi-k2.5": {
    name: "Kimi K2.5 (OpenRouter)",
    provider: "openrouter",
    inputCostPerToken: 0.45 / 1_000_000,
    outputCostPerToken: 2.2 / 1_000_000,
  },
  "minimax/MiniMax-M2.7": {
    name: "MiniMax M2.7",
    provider: "minimax",
    inputCostPerToken: 0.3 / 1_000_000,
    outputCostPerToken: 1.2 / 1_000_000,
  },
  "minimax/MiniMax-M1-80k": {
    name: "MiniMax M2.5 (legacy)",
    provider: "openrouter",
    inputCostPerToken: 0.25 / 1_000_000,
    outputCostPerToken: 1.2 / 1_000_000,
  },
  "minimax/MiniMax-M1": {
    name: "MiniMax M1",
    provider: "openrouter",
    inputCostPerToken: 0.25 / 1_000_000,
    outputCostPerToken: 1.2 / 1_000_000,
  },
  "anthropic/claude-sonnet-4-20250514": {
    name: "Claude Sonnet 4",
    provider: "openrouter",
    inputCostPerToken: 3.0 / 1_000_000,
    outputCostPerToken: 15.0 / 1_000_000,
  },
  "openai/gpt-4o": {
    name: "GPT-4o",
    provider: "openrouter",
    inputCostPerToken: 2.5 / 1_000_000,
    outputCostPerToken: 10.0 / 1_000_000,
  },
};

const ENV_DEFAULT_COST_MODEL: CostModel = {
  name: DEFAULT_MODEL_NAME,
  provider: DEFAULT_PROVIDER,
  inputCostPerToken: DEFAULT_INPUT_PER_MTOK / 1_000_000,
  outputCostPerToken: DEFAULT_OUTPUT_PER_MTOK / 1_000_000,
};

export const COST_MODELS: Record<string, CostModel> = {
  ...STATIC_COST_MODELS,
  [DEFAULT_MODEL]: ENV_DEFAULT_COST_MODEL,
};

export { DEFAULT_MODEL };
export const DEFAULT_COST_MODEL = COST_MODELS[DEFAULT_MODEL];

export function getCostModel(model?: string | null): CostModel {
  return (model && COST_MODELS[model]) || DEFAULT_COST_MODEL;
}

export function getModelDisplayName(model?: string | null): string {
  if (!model) return DEFAULT_MODEL;
  return COST_MODELS[model]?.name || model;
}

/**
 * Compute the cost for a given token usage.
 * Falls back to the configured default model pricing if model is unknown.
 */
export function computeTokenCost(
  inputTokens: number,
  outputTokens: number,
  model?: string
): number {
  const costModel = getCostModel(model);
  return (
    inputTokens * costModel.inputCostPerToken +
    outputTokens * costModel.outputCostPerToken
  );
}
