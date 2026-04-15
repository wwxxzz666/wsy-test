"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CommandAuditEntry } from "@/lib/types";

interface AuditTrailProps {
  entries: CommandAuditEntry[];
}

export function AuditTrail({ entries }: AuditTrailProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Audit Trail</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No audit entries</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const ts =
                  typeof entry.timestamp === "string"
                    ? new Date(entry.timestamp)
                    : entry.timestamp;
                return (
                  <TableRow key={entry.id} className="text-xs">
                    <TableCell>
                      {ts instanceof Date && !isNaN(ts.getTime())
                        ? ts.toLocaleTimeString()
                        : String(entry.timestamp)}
                    </TableCell>
                    <TableCell className="font-medium">{entry.action}</TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {entry.sessionKey}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.source}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
