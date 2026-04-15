"use client";

import { useEffect, useState } from "react";

/**
 * Multi-row breathing wave that ripples across the full width.
 * Characters swell and shrink in a sine wave creating a 2D ocean effect.
 */

const LAYERS = [
  [" ", " ", ".", "~", "~", "~", ".", " ", " "],
  [" ", ".", "~", "=", "=", "=", "~", ".", " "],
  [".", "~", "=", "#", "#", "#", "=", "~", "."],
];

interface BreathingTextProps {
  width?: number;
  rows?: number;
  speed?: number;
  className?: string;
}

export function BreathingText({
  width = 100,
  rows = 3,
  speed = 100,
  className = "",
}: BreathingTextProps) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), speed);
    return () => clearInterval(id);
  }, [speed]);

  const lines = Array.from({ length: Math.min(rows, LAYERS.length) }, (_, row) => {
    const layer = LAYERS[row];
    return Array.from({ length: width }, (_, i) => {
      const wave = Math.sin((tick * 0.15) + (i * 0.12) + (row * 0.8));
      const idx = Math.floor(((wave + 1) / 2) * (layer.length - 1));
      return layer[idx];
    }).join("");
  });

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <pre
        className="font-mono text-[10px] text-emerald-400/[0.20] select-none text-center leading-[1.15]"
        aria-hidden="true"
      >
        {lines.join("\n")}
      </pre>
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
