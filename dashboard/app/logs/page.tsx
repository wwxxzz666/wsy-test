"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { LogFilters } from "@/components/logs/log-filters";
import { LogStream } from "@/components/logs/log-stream";
import { LogDetailDialog } from "@/components/logs/log-detail-dialog";
import { useLogs } from "@/lib/hooks/use-logs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { LogFilterState, LogEntry } from "@/lib/types";
export default function LogsPage() {
  const [filters, setFilters] = useState<LogFilterState>({
    level: "all",
    source: "all",
    dateRange: "today",
    search: "",
  });
  const [page, setPage] = useState(1);
  const [selectedEntry, setSelectedEntry] = useState<LogEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useLogs(filters, page);

  const totalPages = Math.ceil((data?.total || 0) / 50);

  return (
    <div className="flex flex-col">
      <Header title="Logs" />
      <div className="flex-1 space-y-8 p-6 lg:p-8">
        <LogFilters
          filters={filters}
          onFilterChange={(f) => {
            setFilters(f);
            setPage(1);
          }}
        />

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-2">
                {[...Array(10)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <LogStream
                entries={data?.entries || []}
                onEntryClick={(entry) => {
                  setSelectedEntry(entry);
                  setDialogOpen(true);
                }}
              />
            )}
          </CardContent>
        </Card>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({data?.total || 0} entries)
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        )}

        <LogDetailDialog
          entry={selectedEntry}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      </div>
    </div>
  );
}
