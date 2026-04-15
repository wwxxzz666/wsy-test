"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Timestamp } from "@/components/ui/timestamp";
import { CopyButton } from "@/components/ui/copy-button";
import type { PullRequest } from "@/lib/types";
import { PRBuildLogs } from "./pr-build-logs";

interface PRDetailDialogProps {
  pr: PullRequest | null;
  open: boolean;
  onClose: () => void;
}

export function PRDetailDialog({ pr, open, onClose }: PRDetailDialogProps) {
  if (!pr) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg flex items-center gap-2">
            <CopyButton value={`${pr.repo}#${pr.number}`}>
              <span>#{pr.number}</span>
            </CopyButton>{" "}
            {pr.title}
            <a
              href={`https://github.com/${pr.repo}/pull/${pr.number}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gh-link ml-auto text-xs font-normal text-muted-foreground"
              title="Open on GitHub"
            >
              <span className="font-mono">View on GitHub</span>
              <span className="text-[10px]">&rarr;</span>
            </a>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 mb-3">
          <Badge className={pr.status === "merged" ? "badge-glow-green" : pr.status === "closed" ? "badge-glow-red" : ""}>{pr.status}</Badge>
          <CopyButton value={pr.repo}>
            <span className="text-sm text-muted-foreground font-mono">{pr.repo}</span>
          </CopyButton>
          <Timestamp
            date={pr.createdAt}
            className="text-[11px] text-muted-foreground/60 font-mono"
          />
          {pr.qualityScore != null && (
            <span className={`quality-ring ml-auto ${pr.qualityScore >= 80 ? "q-high" : pr.qualityScore >= 60 ? "q-mid" : "q-low"}`}>
              {pr.qualityScore.toFixed(0)}
            </span>
          )}
        </div>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="build-logs">Build Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-md bg-muted/30">
                <p className="text-[10px] text-muted-foreground/60 font-mono uppercase">Files</p>
                <p className="font-bold text-lg tracking-tight">{pr.filesChanged}</p>
              </div>
              <div className="p-3 rounded-md bg-emerald-500/5">
                <p className="text-[10px] text-emerald-400/60 font-mono uppercase">Additions</p>
                <p className="font-bold text-lg tracking-tight text-emerald-400">+{pr.additions}</p>
              </div>
              <div className="p-3 rounded-md bg-red-500/5">
                <p className="text-[10px] text-red-400/60 font-mono uppercase">Deletions</p>
                <p className="font-bold text-lg tracking-tight text-red-400">-{pr.deletions}</p>
              </div>
            </div>

            {pr.qualityBreakdown && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3">Quality Breakdown</h3>
                  <div className="space-y-2">
                    {[
                      { label: "Scope Check", weight: "10%", value: pr.qualityBreakdown.scopeCheck },
                      { label: "Code Quality", weight: "20%", value: pr.qualityBreakdown.codeQuality },
                      { label: "Test Coverage", weight: "20%", value: pr.qualityBreakdown.testCoverage },
                      { label: "Security", weight: "10%", value: pr.qualityBreakdown.security },
                      { label: "Anti-Slop", weight: "15%", value: pr.qualityBreakdown.antiSlop },
                      { label: "Git Hygiene", weight: "10%", value: pr.qualityBreakdown.gitHygiene },
                      { label: "PR Template", weight: "15%", value: pr.qualityBreakdown.prTemplate },
                    ].map((gate) => (
                      <div key={gate.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">
                            {gate.label} <span className="text-muted-foreground/40">({gate.weight})</span>
                          </span>
                          <span className={`font-mono font-bold ${
                            gate.value != null
                              ? gate.value >= 80 ? "text-emerald-400" : gate.value >= 60 ? "text-amber-400" : "text-red-400"
                              : "text-muted-foreground/40"
                          }`}>
                            {gate.value != null ? gate.value.toFixed(0) : "--"}
                          </span>
                        </div>
                        {gate.value != null && (
                          <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                gate.value >= 80 ? "bg-emerald-500" : gate.value >= 60 ? "bg-amber-500" : "bg-red-500"
                              }`}
                              style={{ width: `${gate.value}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-3 mt-3 font-semibold">
                      <span>Overall Score</span>
                      <span className={`font-mono text-lg ${
                        pr.qualityBreakdown.overallScore >= 80 ? "text-emerald-400" : pr.qualityBreakdown.overallScore >= 60 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {pr.qualityBreakdown.overallScore.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}

            {pr.reviews && pr.reviews.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-3">Reviews</h3>
                  <div className="space-y-2">
                    {pr.reviews.map((review) => (
                      <div
                        key={review.id}
                        className="flex items-start gap-2 text-sm"
                      >
                        <Badge variant="outline" className="text-xs">
                          {review.state}
                        </Badge>
                        <div>
                          <span className="font-medium">@{review.reviewer}</span>
                          {review.body && (
                            <p className="text-muted-foreground mt-0.5">
                              {review.body}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {pr.body && (
              <>
                <Separator />
                <div>
                  <h3 className="text-sm font-semibold mb-2">Description</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {pr.body}
                  </p>
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="build-logs" className="mt-4">
            <PRBuildLogs repo={pr.repo} issueNumber={pr.number} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
