"use client";

import { useEffect, useState } from "react";

/**
 * A rotating ASCII DNA double helix.
 * Two strands spiral around each other with base pair connections.
 * The helix rotates continuously, creating a mesmerizing 3D-like effect.
 */

const BASES_LEFT = "ATCGATCG".split("");
const BASES_RIGHT = "TAGCTAGC".split("");
const CONNECTORS = ["---", "===", "-=-", "=-="];

interface DnaHelixProps {
  height?: number;
  className?: string;
  speed?: number;
}

export function DnaHelix({
  height = 14,
  className = "",
  speed = 120,
}: DnaHelixProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), speed);
    return () => clearInterval(id);
  }, [speed]);

  const width = 28;
  const center = Math.floor(width / 2);

  const lines = Array.from({ length: height }, (_, row) => {
    const phase = (tick * 0.1) + (row * 0.5);
    const sin = Math.sin(phase);
    const cos = Math.cos(phase);

    // Two strands at different depths
    const offset1 = Math.round(sin * 8);
    const offset2 = Math.round(-sin * 8);

    const pos1 = center + offset1;
    const pos2 = center + offset2;

    const line = Array.from({ length: width }, () => " ");

    // Determine which strand is "in front" based on cos
    const base1 = BASES_LEFT[row % BASES_LEFT.length];
    const base2 = BASES_RIGHT[row % BASES_RIGHT.length];

    // Draw connector between strands when they're close
    const dist = Math.abs(pos1 - pos2);
    if (dist <= 6 && dist > 1) {
      const start = Math.min(pos1, pos2);
      const end = Math.max(pos1, pos2);
      const connector = CONNECTORS[row % CONNECTORS.length];
      for (let x = start + 1; x < end && x < width; x++) {
        if (x >= 0) {
          line[x] = connector[(x - start - 1) % connector.length];
        }
      }
    }

    // Draw strands (front strand drawn last to be on top)
    if (cos > 0) {
      // strand2 is behind
      if (pos2 >= 0 && pos2 < width) line[pos2] = base2;
      if (pos1 >= 0 && pos1 < width) line[pos1] = base1;
    } else {
      // strand1 is behind
      if (pos1 >= 0 && pos1 < width) line[pos1] = base1;
      if (pos2 >= 0 && pos2 < width) line[pos2] = base2;
    }

    return line.join("");
  });

  return (
    <pre
      className={`font-mono text-[10px] leading-[1.2] text-emerald-400/30 select-none pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {lines.join("\n")}
    </pre>
  );
}
