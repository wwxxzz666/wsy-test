"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LogEntry } from "@/lib/types";

interface LogStreamProps {
  entries: LogEntry[];
  onEntryClick: (entry: LogEntry) => void;
}

const levelBadgeClass: Record<string, string> = {
  debug: "log-badge log-badge-debug",
  info: "log-badge log-badge-info",
  warn: "log-badge log-badge-warn",
  error: "log-badge log-badge-error",
};

const levelColors: Record<string, string> = {
  debug: "text-muted-foreground",
  info: "text-foreground/70",
  warn: "text-amber-400",
  error: "text-red-400",
};

export function LogStream({ entries, onEntryClick }: LogStreamProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[140px] font-mono text-[10px] uppercase tracking-wider">Timestamp</TableHead>
          <TableHead className="w-[80px] font-mono text-[10px] uppercase tracking-wider">Level</TableHead>
          <TableHead className="w-[100px] font-mono text-[10px] uppercase tracking-wider">Source</TableHead>
          <TableHead className="font-mono text-[10px] uppercase tracking-wider">Message</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
              <p>No log entries found</p>
              <p className="text-[11px] text-muted-foreground/50 font-mono mt-1">Adjust filters or check time range</p>
            </TableCell>
          </TableRow>
        ) : (
          entries.map((entry) => {
            const ts =
              typeof entry.timestamp === "string"
                ? new Date(entry.timestamp)
                : entry.timestamp;
            return (
              <TableRow
                key={entry.id}
                className="cursor-pointer font-mono text-xs table-row-hover group"
                onClick={() => onEntryClick(entry)}
              >
                <TableCell className="text-muted-foreground/60">
                  {ts instanceof Date && !isNaN(ts.getTime())
                    ? ts.toLocaleTimeString()
                    : String(entry.timestamp)}
                </TableCell>
                <TableCell>
                  <span className={levelBadgeClass[entry.level] || "log-badge log-badge-debug"}>
                    {entry.level.toUpperCase()}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground/60">
                  {entry.source || "-"}
                </TableCell>
                <TableCell className={`max-w-[400px] truncate group-hover:text-foreground transition-colors ${levelColors[entry.level] || ""}`}>
                  {entry.message}
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
