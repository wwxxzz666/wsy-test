import { format } from "date-fns";

export function groupByDay<T extends { timestamp: Date }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = format(item.timestamp, "yyyy-MM-dd");
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  }
  return groups;
}

export function groupByWeek<T extends { timestamp: Date }>(
  items: T[]
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const d = item.timestamp;
    const dayOfWeek = d.getDay();
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - dayOfWeek);
    const key = format(startOfWeek, "yyyy-MM-dd");
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  }
  return groups;
}

export function calculateMergeRate(
  merged: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round((merged / total) * 1000) / 10;
}

export function calculateCostPerPR(
  totalCostUsd: number,
  prCount: number
): number {
  if (prCount === 0) return 0;
  return Math.round((totalCostUsd / prCount) * 100) / 100;
}
