"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type RoleFilter = "all" | "assistant" | "user" | "tool_call" | "tool_result" | "system" | "thinking";

interface MessageFiltersProps {
  activeFilter: RoleFilter;
  onFilterChange: (filter: RoleFilter) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const FILTERS: { value: RoleFilter; label: string; color: string }[] = [
  { value: "all", label: "All", color: "text-foreground" },
  { value: "assistant", label: "Agent", color: "text-emerald-400" },
  { value: "tool_call", label: "Tools", color: "text-amber-400" },
  { value: "tool_result", label: "Results", color: "text-foreground/50" },
  { value: "system", label: "System", color: "text-foreground/40" },
  { value: "thinking", label: "Think", color: "text-amber-400/70" },
];

export function MessageFilters({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
}: MessageFiltersProps) {
  return (
    <div className="flex items-center gap-0.5 px-4 py-1.5 border-b border-border/40 overflow-x-auto">
      <div className="flex items-center gap-0.5">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant="ghost"
            size="sm"
            className={`text-[10px] h-6 px-2 ${activeFilter === f.value ? "tab-active" : f.color}`}
            onClick={() => onFilterChange(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>
      <div className="ml-auto">
        <Input
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-6 text-xs w-40 border-border/40"
        />
      </div>
    </div>
  );
}
