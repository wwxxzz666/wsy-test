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
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/utils";

interface SessionStatesTableProps {
  sessions: {
    key: string;
    state: string;
    duration: number;
    lastActivity: string;
  }[];
}

export function SessionStatesTable({ sessions }: SessionStatesTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Session States</CardTitle>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No active sessions
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Session</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">State</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Duration</TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">Last Activity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.key}>
                  <TableCell className="font-mono text-xs">
                    {session.key}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{session.state}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{formatDuration(session.duration)}</TableCell>
                  <TableCell className="text-muted-foreground/60 font-mono text-xs">
                    {session.lastActivity}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
