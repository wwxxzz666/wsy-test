/**
 * PR type classification based on title/body heuristics.
 * Used to measure which PR types convert best (docs vs bug_fix vs typo etc).
 */
export type PRType =
  | "bug_fix"
  | "docs"
  | "typo"
  | "dep_update"
  | "test"
  | "dead_code"
  | "feature"
  | "refactor"
  | "other";

const PR_TYPE_RULES: { type: PRType; patterns: RegExp[] }[] = [
  {
    type: "typo",
    patterns: [
      /\btypo\b/i,
      /\btypographical\b/i,
      /\bspelling\b/i,
      /\bmisspell/i,
      /\bgrammar\b/i,
      /\bgrammati/i,
      /fix\w*\s+(a\s+)?typo/i,
      /correct\w*\s+spelling/i,
    ],
  },
  {
    type: "docs",
    patterns: [
      /\bdocs?\b/i,
      /\bdocument/i,
      /\breadme\b/i,
      /\bchangelog\b/i,
      /update\w*\s+readme/i,
      /\bcontribut/i,
      /\bjsdoc\b/i,
      /\bdocstring/i,
      /\bcomment\b/i,
      /add\w*\s+(a\s+)?doc/i,
      /improve\w*\s+doc/i,
      /fix\w*\s+doc/i,
    ],
  },
  {
    type: "dep_update",
    patterns: [
      /\bbump\b/i,
      /\bdependenc/i,
      /\bdep\s*update/i,
      /\bupgrade\b.*\bpackage/i,
      /\bpackage\.json\b/i,
      /\brequirements\.txt\b/i,
      /\bgo\.mod\b/i,
      /\bcargo\.toml\b/i,
      /\bpyproject\.toml\b/i,
      /\bpnpm-lock\b/i,
      /\byarn\.lock\b/i,
      /\bpackage-lock\b/i,
      /\bupdate\b.*\bversion/i,
      /\bpin\b.*\bdep/i,
    ],
  },
  {
    type: "test",
    patterns: [
      /\btest\b/i,
      /\btesting\b/i,
      /\bunit\s*test/i,
      /\bintegration\s*test/i,
      /\be2e\b/i,
      /\bcoverage\b/i,
      /add\w*\s+test/i,
      /fix\w*\s+test/i,
      /\bspec\b/i,
      /\bfixture/i,
    ],
  },
  {
    type: "dead_code",
    patterns: [
      /\bdead\s*code\b/i,
      /\bunused\b/i,
      /\bremove\b.*\bunused/i,
      /\bclean\s*up\b/i,
      /\bcleanup\b/i,
      /\bdelete\b.*\b(old|obsolete|deprecated)\b/i,
      /\bremove\b.*\b(old|obsolete|deprecated)\b/i,
      /\bdeprecated\b/i,
    ],
  },
  {
    type: "refactor",
    patterns: [
      /\brefactor/i,
      /\brestructur/i,
      /\breorganiz/i,
      /\bsimplif/i,
      /\bextract\b/i,
      /\bmodulariz/i,
    ],
  },
  {
    type: "bug_fix",
    patterns: [
      /\bfix\b/i,
      /\bbug\b/i,
      /\bpatch\b/i,
      /\bresolve\b/i,
      /\bhotfix\b/i,
      /\bcorrect\b/i,
      /\brepair\b/i,
      /\bhandle\b.*\b(error|exception|edge\s*case)/i,
      /\bcrash\b/i,
      /\bregression\b/i,
      /\bissue\b/i,
    ],
  },
  {
    type: "feature",
    patterns: [
      /\badd\b/i,
      /\bfeat/i,
      /\bimplement/i,
      /\bintroduc/i,
      /\bnew\b/i,
      /\bsupport\b/i,
      /\benable\b/i,
    ],
  },
];

/**
 * Classify a PR based on its title and optional body text.
 * Rules are ordered by specificity -- typo/docs/dep_update first
 * so they don't get swallowed by the broader "fix" or "add" patterns.
 */
export function classifyPRType(title: string, body?: string | null): PRType {
  const text = body ? `${title} ${body.slice(0, 500)}` : title;

  for (const rule of PR_TYPE_RULES) {
    if (rule.patterns.some((p) => p.test(text))) {
      return rule.type;
    }
  }

  return "other";
}

/**
 * Display config for each PR type
 */
export const PR_TYPE_CONFIG: Record<PRType, { label: string; color: string; bg: string }> = {
  bug_fix: { label: "BUG FIX", color: "text-orange-400", bg: "bg-orange-500/10" },
  docs: { label: "DOCS", color: "text-blue-400", bg: "bg-blue-500/10" },
  typo: { label: "TYPO", color: "text-purple-400", bg: "bg-purple-500/10" },
  dep_update: { label: "DEPS", color: "text-teal-400", bg: "bg-teal-500/10" },
  test: { label: "TEST", color: "text-cyan-400", bg: "bg-cyan-500/10" },
  dead_code: { label: "CLEANUP", color: "text-gray-400", bg: "bg-gray-500/10" },
  feature: { label: "FEATURE", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  refactor: { label: "REFACTOR", color: "text-amber-400", bg: "bg-amber-500/10" },
  other: { label: "OTHER", color: "text-muted-foreground", bg: "bg-muted/30" },
};
