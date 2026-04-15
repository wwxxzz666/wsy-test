"use client";

import type { SubagentSlot } from "@/lib/hooks/use-subagent-health";

const STATUS_COLORS: Record<string, { dot: string; text: string; border: string; bg: string }> = {
  ACTIVE: {
    dot: "bg-emerald-500",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
  },
  IDLE: {
    dot: "bg-amber-500",
    text: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
  },
  STALE: {
    dot: "bg-orange-500",
    text: "text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
  },
  DEAD: {
    dot: "bg-red-500",
    text: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
  },
};

function formatAge(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function FilledSlot({
  slot,
  alwaysOn,
}: {
  slot: SubagentSlot;
  alwaysOn?: boolean;
}) {
  const colors = STATUS_COLORS[slot.status] || STATUS_COLORS.DEAD;

  return (
    <div
      className={`relative rounded-md border px-2.5 py-2 font-mono transition-colors ${colors.border} ${colors.bg} ${
        alwaysOn ? "ring-1 ring-emerald-500/10" : ""
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Status dot with ping animation for ACTIVE */}
        <span className="relative flex h-2 w-2 shrink-0">
          {slot.status === "ACTIVE" && (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full ${colors.dot} opacity-40`}
            />
          )}
          <span className={`relative h-2 w-2 rounded-full ${colors.dot}`} />
        </span>
        {/* Label */}
        <span className="text-[11px] font-medium truncate text-foreground/80">
          {slot.label}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/50">
        {/* Context percentage */}
        <span className="tabular-nums">
          <span className={colors.text}>{slot.contextPct}%</span>
          <span className="ml-0.5">ctx</span>
        </span>
        {/* Age */}
        <span className="tabular-nums">{formatAge(slot.ageMinutes)}</span>
      </div>

      {/* Repo if present */}
      {slot.repo && (
        <div className="mt-1 text-[9px] text-muted-foreground/35 truncate">
          {slot.repo}
          {slot.issue && <span className="ml-1 text-muted-foreground/25">{slot.issue}</span>}
        </div>
      )}

      {/* Context bar */}
      <div className="mt-1.5 h-[2px] w-full rounded-full bg-foreground/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors.dot}`}
          style={{ width: `${Math.min(slot.contextPct, 100)}%`, opacity: 0.4 }}
        />
      </div>
    </div>
  );
}

function EmptySlot() {
  return (
    <div className="rounded-md border border-dashed border-foreground/10 px-2.5 py-2 font-mono">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-foreground/10" />
        <span className="text-[11px] text-muted-foreground/25 italic">
          empty
        </span>
      </div>
      <div className="mt-1.5 text-[10px] text-muted-foreground/15">--</div>
    </div>
  );
}

interface SlotGridProps {
  alwaysOn: SubagentSlot[];
  implSlots: (SubagentSlot | null)[];
}

export function SlotGrid({ alwaysOn, implSlots }: SlotGridProps) {
  return (
    <div className="space-y-3">
      {/* Always-on section */}
      <div>
        <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest mb-1.5">
          Always-On
        </div>
        <div className="grid grid-cols-3 gap-2">
          {alwaysOn.map((slot) => (
            <FilledSlot key={slot.label} slot={slot} alwaysOn />
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="h-[1px] bg-foreground/5" />

      {/* Impl/followup section */}
      <div>
        <div className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest mb-1.5">
          Impl / Follow-Up
        </div>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {implSlots.map((slot, i) =>
            slot ? (
              <FilledSlot key={slot.label || `slot-${i}`} slot={slot} />
            ) : (
              <EmptySlot key={`empty-${i}`} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
