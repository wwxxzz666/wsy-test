interface QualityInput {
  additions: number;
  deletions: number;
  filesChanged: number;
  hasTests: boolean;
  commitMessages: string[];
  description: string;
  hasDescription: boolean;
}

interface QualityResult {
  overall: number;
  scopeCheck: number;
  codeQuality: number;
  testCoverage: number;
  security: number;
  antiSlop: number;
  gitHygiene: number;
  prTemplate: number;
}

export function computeQualityScore(input: QualityInput): QualityResult {
  const totalLines = input.additions + input.deletions;

  // Scope Check (10%) - appropriate size, <=500 lines, focused change
  let scopeCheck = 100;
  if (totalLines > 500) scopeCheck = Math.max(0, 100 - (totalLines - 500) / 10);
  else if (totalLines > 300) scopeCheck = 85;
  else if (totalLines < 5) scopeCheck = 40; // trivial change
  if (input.filesChanged > 20) scopeCheck = Math.min(scopeCheck, 50);

  // Code Quality (20%) - lines changed ratio, complexity, patterns
  let codeQuality = 80;
  const ratio = input.additions > 0 ? input.deletions / input.additions : 0;
  if (ratio > 0.1 && ratio < 2) codeQuality = 90; // good refactor ratio
  if (input.filesChanged > 0 && totalLines / input.filesChanged < 50)
    codeQuality = Math.min(codeQuality + 5, 100);

  // Test Coverage (20%) - test files present
  let testCoverage = input.hasTests ? 90 : 40;
  if (totalLines > 100 && !input.hasTests) testCoverage = 20;

  // Security (10%) - no secrets, no unsafe patterns
  let security = 95;
  const secretPatterns = /api[_-]?key|password|secret|token|credential/i;
  if (secretPatterns.test(input.description)) security = 60;

  // Anti-Slop (15%) - non-trivial change, genuine value
  let antiSlop = 85;
  if (totalLines < 3) antiSlop = 30; // too trivial
  if (totalLines > 0 && input.additions === 0) antiSlop = 50; // delete-only

  // Git Hygiene (10%) - conventional commits, clean history
  let gitHygiene = 80;
  const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore|ci|perf|build)\b/;
  const hasConventional = input.commitMessages.some((m) =>
    conventionalPattern.test(m)
  );
  if (hasConventional) gitHygiene = 95;

  // PR Template (15%) - description quality, motivation
  let prTemplate = 50;
  if (input.hasDescription) {
    prTemplate = 75;
    if (input.description.length > 200) prTemplate = 90;
    if (input.description.length > 500) prTemplate = 95;
    if (/## (Summary|Changes|Testing|Motivation)/i.test(input.description))
      prTemplate = 100;
  }

  // Weighted overall score
  const overall =
    scopeCheck * 0.1 +
    codeQuality * 0.2 +
    testCoverage * 0.2 +
    security * 0.1 +
    antiSlop * 0.15 +
    gitHygiene * 0.1 +
    prTemplate * 0.15;

  return {
    overall: Math.round(overall * 10) / 10,
    scopeCheck: Math.round(scopeCheck * 10) / 10,
    codeQuality: Math.round(codeQuality * 10) / 10,
    testCoverage: Math.round(testCoverage * 10) / 10,
    security: Math.round(security * 10) / 10,
    antiSlop: Math.round(antiSlop * 10) / 10,
    gitHygiene: Math.round(gitHygiene * 10) / 10,
    prTemplate: Math.round(prTemplate * 10) / 10,
  };
}
