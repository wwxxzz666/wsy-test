"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PRFilterState } from "@/lib/types";

interface PRFiltersProps {
  filters: PRFilterState;
  onFilterChange: (filters: PRFilterState) => void;
  repos: string[];
}

export function PRFilters({ filters, onFilterChange, repos }: PRFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <Select
        value={filters.status}
        onValueChange={(v) =>
          v && onFilterChange({ ...filters, status: v as PRFilterState["status"] })
        }
      >
        <SelectTrigger className="w-[140px] mono-select">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="merged">Merged</SelectItem>
          <SelectItem value="closed">Closed</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.repo}
        onValueChange={(v) => v && onFilterChange({ ...filters, repo: v })}
      >
        <SelectTrigger className="w-[200px] mono-select">
          <SelectValue placeholder="Repository" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Repos</SelectItem>
          {repos.map((repo) => (
            <SelectItem key={repo} value={repo}>
              {repo}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        placeholder="Search PRs..."
        value={filters.search}
        onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
        className="w-[200px] mono-select"
      />
    </div>
  );
}
