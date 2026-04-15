import { Octokit } from "@octokit/rest";
import { db, ensureDb } from "./db";
import { pullRequests, prReviews, qualityScores } from "./schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { computeQualityScore } from "./quality";
import { classifyPRType } from "./pr-type";

function getOctokit() {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

export async function syncPRsFromGitHub(): Promise<{
  synced: number;
  repos: string[];
}> {
  await ensureDb();
  const octokit = getOctokit();
  const agentUsername = process.env.CLAW_AGENT_USERNAME || "BillionClaw";

  // Dynamic discovery: search for ALL PRs by the agent across GitHub
  // Use raw fetch to avoid Octokit query encoding issues
  const searchUrl = `https://api.github.com/search/issues?q=author:${agentUsername}+is:pr+sort:updated-desc&per_page=100`;
  const searchRes = await fetch(searchUrl, {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  const searchResults = { data: await searchRes.json() };

  // Also check target repos from settings for any PRs the search might miss
  const settingsRow = await db.query.settings.findFirst({
    where: eq(
      (await import("./schema")).settings.key,
      "dashboard_settings"
    ),
  });
  const settings = settingsRow?.value as { targetRepos?: string[] } | null;
  const targetRepos = settings?.targetRepos || [];

  // Collect all PRs: from search + from target repos
  type PRInfo = { owner: string; repo: string; repoFullName: string; number: number };
  const prMap = new Map<string, PRInfo>();

  // Add PRs from search results
  console.log(`[github-sync] Search returned ${searchResults.data?.items?.length || 0} items (total: ${searchResults.data?.total_count || 0})`);
  for (const item of searchResults.data.items || []) {
    if (!item.pull_request) continue;
    // Extract owner/repo from repository_url: "https://api.github.com/repos/owner/repo"
    const match = item.repository_url?.match(/repos\/([^/]+)\/([^/]+)$/);
    if (!match) continue;
    const [, owner, repo] = match;
    const repoFullName = `${owner}/${repo}`;
    const key = `${repoFullName}#${item.number}`;
    prMap.set(key, { owner, repo, repoFullName, number: item.number });
  }

  // Also scan target repos for any PRs search might have missed
  for (const repoFullName of targetRepos) {
    const [owner, repo] = repoFullName.split("/");
    if (!owner || !repo) continue;
    try {
      const { data: prs } = await octokit.pulls.list({
        owner, repo, state: "all", sort: "updated", direction: "desc", per_page: 30,
      });
      for (const pr of prs) {
        if (pr.user?.login === agentUsername) {
          const key = `${repoFullName}#${pr.number}`;
          if (!prMap.has(key)) {
            prMap.set(key, { owner, repo, repoFullName, number: pr.number });
          }
        }
      }
    } catch {
      // Skip repos that error
    }
  }

  // Fast sync: use search results directly (no per-PR API calls)
  // This avoids the Vercel 10s serverless timeout
  let synced = 0;
  const syncedRepos: string[] = [];

  // Also fetch closed/merged PRs in a second search
  const closedUrl = `https://api.github.com/search/issues?q=author:${agentUsername}+is:pr+is:closed+sort:updated-desc&per_page=100`;
  const closedRes = await fetch(closedUrl, {
    headers: { Authorization: `token ${process.env.GITHUB_TOKEN}`, Accept: "application/vnd.github.v3+json" },
  });
  const closedData = await closedRes.json();

  // Merge both search results
  const allItems = [...(searchResults.data?.items || []), ...(closedData?.items || [])];
  const seen = new Set<string>();

  for (const item of allItems) {
    if (!item.pull_request) continue;
    const match = item.repository_url?.match(/repos\/([^/]+)\/([^/]+)$/);
    if (!match) continue;
    const [, owner, repo] = match;
    const repoFullName = `${owner}/${repo}`;
    const prId = `${repoFullName}#${item.number}`;

    if (seen.has(prId)) continue;
    seen.add(prId);

    // Determine status from pull_request.merged_at
    const isMerged = item.pull_request?.merged_at != null;
    const status = isMerged ? "merged" : item.state === "closed" ? "closed" : "open";
    const prType = classifyPRType(item.title, item.body || "");

    try {
      await db
        .insert(pullRequests)
        .values({
          id: prId,
          githubId: item.id,
          repo: repoFullName,
          number: item.number,
          title: item.title,
          body: item.body || null,
          status,
          createdAt: new Date(item.created_at),
          mergedAt: isMerged ? new Date(item.pull_request.merged_at) : null,
          closedAt: item.closed_at ? new Date(item.closed_at) : null,
          htmlUrl: item.html_url,
          prType,
        })
        .onConflictDoUpdate({
          target: pullRequests.id,
          set: {
            status,
            title: item.title,
            body: item.body || null,
            mergedAt: isMerged ? new Date(item.pull_request.merged_at) : null,
            closedAt: item.closed_at ? new Date(item.closed_at) : null,
            htmlUrl: item.html_url,
            prType,
          },
        });

      synced++;
      if (!syncedRepos.includes(repoFullName)) {
        syncedRepos.push(repoFullName);
      }
    } catch (err) {
      console.error(`[github-sync] Error upserting ${prId}:`, String(err).slice(0, 200));
    }
  }

  console.log(`[github-sync] Complete: ${synced} PRs synced from ${seen.size} unique, ${syncedRepos.length} repos`);
  return { synced, repos: syncedRepos };
}
