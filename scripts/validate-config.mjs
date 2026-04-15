#!/usr/bin/env node

/**
 * ClawOSS Configuration Validator
 *
 * Validates:
 * - openclaw.json parses as valid JSON
 * - cron-jobs.json parses as valid JSON array
 * - All required workspace files exist
 * - All skills have valid SKILL.md with frontmatter
 * - Skills are under 2000 character limit
 * - All scripts are executable
 */

import { readFileSync, existsSync, accessSync, constants, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

let errors = 0;
let warnings = 0;

function pass(msg) {
  console.log(`  [PASS] ${msg}`);
}

function fail(msg) {
  console.log(`  [FAIL] ${msg}`);
  errors++;
}

function warn(msg) {
  console.log(`  [WARN] ${msg}`);
  warnings++;
}

// --- 1. Validate openclaw.json ---
console.log("\n=== Config Files ===");

try {
  const raw = readFileSync(join(ROOT, "config/openclaw.json"), "utf8");
  JSON.parse(raw);
  pass("config/openclaw.json is valid JSON");
} catch (e) {
  fail(`config/openclaw.json: ${e.message}`);
}

try {
  const raw = readFileSync(join(ROOT, "config/cron-jobs.json"), "utf8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    fail("config/cron-jobs.json is not a JSON array");
  } else {
    pass(`config/cron-jobs.json is valid (${data.length} jobs)`);
    for (const job of data) {
      if (!job.id || !job.schedule || !job.payload) {
        fail(`Cron job missing required fields: ${JSON.stringify(job)}`);
      }
    }
  }
} catch (e) {
  fail(`config/cron-jobs.json: ${e.message}`);
}

// --- 2. Validate workspace files ---
console.log("\n=== Workspace Files ===");

const requiredFiles = [
  "AGENTS.md",
  "SOUL.md",
  "USER.md",
  "IDENTITY.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
];

for (const file of requiredFiles) {
  const path = join(ROOT, "workspace", file);
  if (existsSync(path)) {
    const size = statSync(path).size;
    if (size === 0) {
      warn(`workspace/${file} exists but is empty`);
    } else {
      pass(`workspace/${file} (${size} bytes)`);
    }
  } else {
    fail(`workspace/${file} is missing`);
  }
}

// --- 3. Validate skills ---
console.log("\n=== Skills ===");

const requiredSkills = [
  "oss-discover",
  "oss-implement",
  "oss-review",
  "oss-submit",
  "oss-followup",
  "oss-triage",
  "oss-pr-review-handler",
  "repo-analyzer",
  "context-manager",
  "dashboard-reporter",
  "safety-checker",
];

const SKILL_CHAR_LIMIT = 15000;

for (const skill of requiredSkills) {
  const skillPath = join(ROOT, "workspace/skills", skill, "SKILL.md");
  if (!existsSync(skillPath)) {
    fail(`workspace/skills/${skill}/SKILL.md is missing`);
    continue;
  }

  const content = readFileSync(skillPath, "utf8");
  const chars = content.length;

  // Check frontmatter
  if (!content.startsWith("---")) {
    fail(`${skill}: missing YAML frontmatter`);
    continue;
  }

  // Check required frontmatter fields
  if (!content.includes("\nname:")) {
    fail(`${skill}: missing 'name' field in frontmatter`);
  }
  if (!content.includes("\ndescription:")) {
    fail(`${skill}: missing 'description' field in frontmatter`);
  }

  // Check size limit
  if (chars > SKILL_CHAR_LIMIT) {
    fail(`${skill}: ${chars} chars exceeds ${SKILL_CHAR_LIMIT} limit`);
  } else {
    pass(`${skill}: ${chars} chars`);
  }
}

// --- 4. Validate scripts ---
console.log("\n=== Scripts ===");

const requiredScripts = [
  "setup.sh",
  "start.sh",
  "stop.sh",
  "health-check.sh",
  "backup-workspace.sh",
  "rotate-logs.sh",
];

for (const script of requiredScripts) {
  const scriptPath = join(ROOT, "scripts", script);
  if (!existsSync(scriptPath)) {
    fail(`scripts/${script} is missing`);
    continue;
  }

  try {
    accessSync(scriptPath, constants.X_OK);
    pass(`scripts/${script} (executable)`);
  } catch {
    fail(`scripts/${script} exists but is not executable`);
  }
}

// --- 5. Validate templates ---
console.log("\n=== Templates ===");

const requiredTemplates = [
  "pr-template.md",
  "commit-conventions.md",
  "issue-response-template.md",
];

for (const tmpl of requiredTemplates) {
  const tmplPath = join(ROOT, "templates", tmpl);
  if (existsSync(tmplPath)) {
    pass(`templates/${tmpl}`);
  } else {
    fail(`templates/${tmpl} is missing`);
  }
}

// --- Summary ---
console.log("\n=== Summary ===");
console.log(`  Passed: ${requiredFiles.length + requiredSkills.length + requiredScripts.length + requiredTemplates.length + 2 - errors - warnings}`);
if (warnings > 0) console.log(`  Warnings: ${warnings}`);
if (errors > 0) {
  console.log(`  Errors: ${errors}`);
  console.log("\nValidation FAILED");
  process.exit(1);
} else {
  console.log("\nValidation PASSED");
}
