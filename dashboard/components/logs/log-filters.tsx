"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LogFilterState } from "@/lib/types";

interface LogFiltersProps {
  filters: LogFilterState;
  onFilterChange: (filters: LogFilterState) => void;
}

const LEVELS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "info", label: "Info" },
  { value: "warn", label: "Warning" },
  { value: "error", label: "Error" },
  { value: "debug", label: "Debug" },
];

export function LogFilters({ filters, onFilterChange }: LogFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Select
          value={filters.source}
          onValueChange={(v) => v && onFilterChange({ ...filters, source: v })}
        >
          <SelectTrigger className="w-[150px] mono-select">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="agent">Agent</SelectItem>
            <SelectItem value="github">GitHub</SelectItem>
            <SelectItem value="model">Model</SelectItem>
            <SelectItem value="heartbeat">Heartbeat</SelectItem>
            <SelectItem value="queue">Queue</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.dateRange}
          onValueChange={(v) =>
            v && onFilterChange({
              ...filters,
              dateRange: v as LogFilterState["dateRange"],
            })
          }
        >
          <SelectTrigger className="w-[130px] mono-select">
            <SelectValue placeholder="Date" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
          </SelectContent>
        </Select>

        <Input
          placeholder="Search logs..."
          value={filters.search}
          onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
          className="w-[200px] mono-select"
        />
      </div>

      <div className="flex items-center gap-0.5">
        {LEVELS.map((level) => (
          <Button
            key={level.value}
            variant="ghost"
            size="sm"
            className={`text-[10px] h-6 px-2.5 font-mono ${
              filters.level === level.value ? "tab-active" : "text-muted-foreground"
            }`}
            onClick={() =>
              onFilterChange({
                ...filters,
                level: level.value as LogFilterState["level"],
              })
            }
          >
            {level.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
