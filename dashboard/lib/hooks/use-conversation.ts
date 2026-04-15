import useSWR from "swr";
import type { ConversationMessage, ConversationSession } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/**
 * Polls for conversation messages every refreshInterval ms.
 * Uses SWR's built-in caching and deduplication.
 * Always fetches the latest `limit` messages — simple and reliable.
 */
export function useConversation(
  sessionId?: string,
  limit: number = 200,
  refreshInterval: number = 5000
) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (sessionId) params.set("session", sessionId);

  const { data, error, isLoading, mutate } = useSWR<{
    messages: ConversationMessage[];
    count: number;
  }>(`/api/conversation?${params}`, fetcher, {
    refreshInterval,
    revalidateOnFocus: false,
    dedupingInterval: 2000,
  });

  return { data, error, isLoading, mutate };
}

export function useConversationSessions() {
  const { data, error, isLoading, mutate } = useSWR<{
    sessions: ConversationSession[];
  }>("/api/conversation?sessions=true", fetcher, { refreshInterval: 5000 });

  return { data, error, isLoading, mutate };
}
