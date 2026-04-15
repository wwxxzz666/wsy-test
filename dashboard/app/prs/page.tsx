"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { PRFilters } from "@/components/prs/pr-filters";
import { PRStatsBar } from "@/components/prs/pr-stats-bar";
import { PRDataTable } from "@/components/prs/pr-data-table";
import { PRDetailDialog } from "@/components/prs/pr-detail-dialog";
import { usePRs, usePRDetail } from "@/lib/hooks/use-prs";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { PRFilterState, PullRequest } from "@/lib/types";
export default function PRsPage() {
  const [filters, setFilters] = useState<PRFilterState>({
    status: "all",
    repo: "all",
    dateRange: "all",
    minQuality: 0,
    search: "",
  });
  const [page, setPage] = useState(1);
  const [selectedPRId, setSelectedPRId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = usePRs(filters, page);
  const { data: prDetail } = usePRDetail(
    dialogOpen ? selectedPRId : null
  );

  const repos = [
    ...new Set((data?.data || []).map((pr: PullRequest) => pr.repo)),
  ];
  const openCount = (data?.data || []).filter(
    (pr: PullRequest) => pr.status === "open"
  ).length;
  const mergedCount = (data?.data || []).filter(
    (pr: PullRequest) => pr.status === "merged"
  ).length;
  const closedCount = (data?.data || []).filter(
    (pr: PullRequest) => pr.status === "closed"
  ).length;

  const handleRowClick = (pr: PullRequest) => {
    setSelectedPRId(pr.id);
    setDialogOpen(true);
  };

  const totalPages = Math.ceil((data?.total || 0) / (data?.pageSize || 20));

  return (
    <div className="flex flex-col">
      <Header title="Pull Requests" />
      <div className="flex-1 space-y-8 p-6 lg:p-8">
        <PRFilters
          filters={filters}
          onFilterChange={(f) => {
            setFilters(f);
            setPage(1);
          }}
          repos={repos}
        />

        <PRStatsBar
          total={data?.total || 0}
          open={openCount}
          merged={mergedCount}
          closed={closedCount}
          avgReviewTime={0}
        />

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <PRDataTable
                data={data?.data || []}
                onRowClick={handleRowClick}
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
              Page {page} of {totalPages}
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

        <PRDetailDialog
          pr={prDetail || null}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
        />
      </div>
    </div>
  );
}
