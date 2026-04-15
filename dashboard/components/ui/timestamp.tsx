"use client";

import { formatRelativeTime, formatDate } from "@/lib/utils";

interface TimestampProps {
  date: Date | string;
  className?: string;
}

export function Timestamp({ date, className = "" }: TimestampProps) {
  const d = typeof date === "string" ? new Date(date) : date;
  const abs = d instanceof Date && !isNaN(d.getTime()) ? formatDate(d) : "";

  return (
    <span className={`ts-tooltip ${className}`} data-abs-time={abs}>
      {formatRelativeTime(date)}
    </span>
  );
}
