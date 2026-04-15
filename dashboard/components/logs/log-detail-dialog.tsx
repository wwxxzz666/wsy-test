"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { LogEntry } from "@/lib/types";

interface LogDetailDialogProps {
  entry: LogEntry | null;
  open: boolean;
  onClose: () => void;
}

export function LogDetailDialog({ entry, open, onClose }: LogDetailDialogProps) {
  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Log Entry Detail</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge>{entry.level.toUpperCase()}</Badge>
            <span className="text-sm text-muted-foreground">
              {entry.source || "unknown"}
            </span>
          </div>
          <p className="text-sm">{entry.message}</p>
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-xs font-semibold mb-2">Metadata</h4>
                <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                  {JSON.stringify(entry.metadata, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
