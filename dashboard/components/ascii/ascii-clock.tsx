"use client";

import { useEffect, useState } from "react";

/**
 * A tiny clock drawn with box-drawing characters that actually ticks.
 * Shows HH:MM:SS in a framed box that updates every second.
 */

export function AsciiClock({ className = "" }: { className?: string }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <pre
      className={`font-mono text-[9px] leading-[1.3] text-muted-foreground/30 select-none ${className}`}
      aria-hidden="true"
    >
      {`┌──────────┐\n│ ${time} │\n└──────────┘`}
    </pre>
  );
}
