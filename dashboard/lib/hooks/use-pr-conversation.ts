import useSWR from "swr";
import type { ConversationMessage } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Fetch conversation messages associated with a specific repo and issue.
 * Used to show sub-agent build logs for a PR.
 */
export function usePRConversation(
  repo: string | null,
  issue: string | null,
  limit: number = 200
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (repo) params.set("repo", repo);
  if (issue) params.set("issue", issue);

  const shouldFetch = !!(repo || issue);

  const { data, error, isLoading } = useSWR<{
    messages: ConversationMessage[];
    count: number;
  }>(shouldFetch ? `/api/conversation?${params}` : null, fetcher);

  return { data, error, isLoading };
}
