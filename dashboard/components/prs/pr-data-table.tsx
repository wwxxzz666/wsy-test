"use client";

import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Timestamp } from "@/components/ui/timestamp";
import { CopyButton } from "@/components/ui/copy-button";
import type { PullRequest } from "@/lib/types";

interface PRDataTableProps {
  data: PullRequest[];
  onRowClick: (pr: PullRequest) => void;
}

const statusColors: Record<string, string> = {
  open: "text-foreground/70 border-foreground/15",
  merged: "text-emerald-400 border-emerald-500/25",
  closed: "text-red-400 border-red-500/25",
};

type SortKey = "number" | "title" | "repo" | "status" | "quality" | "created";
type SortDir = "asc" | "desc";

function QualityCell({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return <span className="text-muted-foreground/40 font-mono text-xs">--</span>;
  }
  const cls = score >= 80 ? "q-high" : score >= 60 ? "q-mid" : "q-low";
  return <span className={`quality-ring ${cls}`}>{score.toFixed(0)}</span>;
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span className={`sort-indicator ${active ? "active" : ""}`}>
      {active ? (dir === "asc" ? "^" : "v") : "^"}
    </span>
  );
}

function githubUrl(repo: string, number: number): string {
  return `https://github.com/${repo}/pull/${number}`;
}

export function PRDataTable({ data, onRowClick }: PRDataTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "quality" || key === "created" ? "desc" : "asc");
    }
  };

  const sorted = useMemo(() => {
    const items = [...data];
    const dir = sortDir === "asc" ? 1 : -1;
    items.sort((a, b) => {
      switch (sortKey) {
        case "number":
          return (a.number - b.number) * dir;
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "repo":
          return a.repo.localeCompare(b.repo) * dir;
        case "status":
          return a.status.localeCompare(b.status) * dir;
        case "quality": {
          const aq = a.qualityScore ?? -1;
          const bq = b.qualityScore ?? -1;
          return (aq - bq) * dir;
        }
        case "created": {
          const ad = new Date(a.createdAt).getTime();
          const bd = new Date(b.createdAt).getTime();
          return (ad - bd) * dir;
        }
        default:
          return 0;
      }
    });
    return items;
  }, [data, sortKey, sortDir]);

  const columns: { key: SortKey; label: string }[] = [
    { key: "title", label: "Title" },
    { key: "repo", label: "Repository" },
    { key: "status", label: "Status" },
    { key: "quality", label: "Quality" },
    { key: "created", label: "Created" },
  ];

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className="font-mono text-[10px] uppercase tracking-wider sortable-header"
              onClick={() => handleSort(col.key)}
            >
              {col.label}
              <SortIndicator active={sortKey === col.key} dir={sortDir} />
            </TableHead>
          ))}
          <TableHead className="font-mono text-[10px] uppercase tracking-wider w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
              <p>No pull requests found</p>
              <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Adjust filters or wait for new PRs</p>
            </TableCell>
          </TableRow>
        ) : (
          sorted.map((pr) => (
            <TableRow
              key={pr.id}
              className="cursor-pointer table-row-hover group"
              onClick={() => onRowClick(pr)}
            >
              <TableCell className="max-w-[300px]">
                <p className="font-medium truncate group-hover:text-foreground transition-colors">
                  <CopyButton value={`#${pr.number}`} className="inline">
                    <span className="text-muted-foreground/60">#{pr.number}</span>
                  </CopyButton>{" "}
                  {pr.title}
                </p>
              </TableCell>
              <TableCell>
                <CopyButton value={pr.repo}>
                  <span className="text-[11px] text-muted-foreground font-mono">{pr.repo}</span>
                </CopyButton>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={`text-[10px] font-mono ${statusColors[pr.status] || ""}`}
                >
                  {pr.status}
                </Badge>
              </TableCell>
              <TableCell>
                <QualityCell score={pr.qualityScore} />
              </TableCell>
              <TableCell>
                <Timestamp
                  date={pr.createdAt}
                  className="text-[11px] text-muted-foreground/60 font-mono"
                />
              </TableCell>
              <TableCell>
                <a
                  href={githubUrl(pr.repo, pr.number)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gh-link"
                  onClick={(e) => e.stopPropagation()}
                  title={`Open ${pr.repo}#${pr.number} on GitHub`}
                >
                  <span className="gh-link-icon text-[10px] font-mono">GH</span>
                </a>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
