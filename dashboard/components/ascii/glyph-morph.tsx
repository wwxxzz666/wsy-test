"use client";

import { useEffect, useState } from "react";

/**
 * Multi-row field of morphing characters that resolve from scramble to pattern
 * in a cascading wave, hold, then dissolve and re-resolve to a new pattern.
 * Like watching encrypted data being decoded in real time.
 */

const SCRAMBLE = "!@#$%^&*<>{}[]|/\\~`+-=_.,:;?01234567890abcdef".split("");
const PATTERNS = [
  "╔═══════════════════════════════════════════════════════════════════════════════╗",
  "║ . : * # @ % & @ # * : . . : * # @ % & @ # * : . . : * # @ % & @ # * : .  ║",
  "╚═══════════════════════════════════════════════════════════════════════════════╝",
  "┌─────────────────────────────────────────────────────────────────────────────┐",
  "│ ░▒▓█▓▒░ ░▒▓█▓▒░ ░▒▓█▓▒░ ░▒▓█▓▒░ ░▒▓█▓▒░ ░▒▓█▓▒░ ░▒▓█▓▒░ ░▒▓█▓▒░ ░▒▓ │",
  "└─────────────────────────────────────────────────────────────────────────────┘",
];

interface GlyphMorphProps {
  width?: number;
  rows?: number;
  className?: string;
  speed?: number;
}

export function GlyphMorph({
  width = 80,
  rows = 3,
  className = "",
  speed = 60,
}: GlyphMorphProps) {
  const [tick, setTick] = useState(0);
  const [patternIdx, setPatternIdx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => setTick((t) => t + 1), speed);
    return () => clearInterval(id);
  }, [speed, mounted]);

  // Cycle patterns every ~200 ticks
  useEffect(() => {
    if (tick > 0 && tick % 200 === 0) {
      setPatternIdx((p) => (p + 1) % (PATTERNS.length / 3));
    }
  }, [tick]);

  // During SSR, render empty lines to avoid hydration mismatch from Math.random()
  if (!mounted) {
    const emptyLines = Array.from({ length: Math.min(rows, 3) }, () => " ".repeat(width));
    return (
      <div className={`relative overflow-hidden ${className}`}>
        <pre
          className="font-mono text-[10px] text-muted-foreground/[0.35] select-none text-center leading-[1.3]"
          aria-hidden="true"
        >
          {emptyLines.join("\n")}
        </pre>
        <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
        <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
      </div>
    );
  }

  const baseRow = patternIdx * 3;
  const lines = Array.from({ length: Math.min(rows, 3) }, (_, row) => {
    const targetLine = PATTERNS[(baseRow + row) % PATTERNS.length];
    const padded = targetLine.padEnd(width).slice(0, width);

    return Array.from({ length: width }, (_, col) => {
      // Wave of resolution sweeping left to right
      const resolveThreshold = (tick * 0.8) - (col * 0.3) - (row * 10);
      const holdEnd = resolveThreshold - 120;

      if (resolveThreshold > 30) {
        // Resolved
        if (holdEnd > 30) {
          // Starting to dissolve — scramble again
          const dissolveProgress = (holdEnd - 30) / 40;
          if (dissolveProgress > 1 || Math.random() < dissolveProgress * 0.1) {
            return SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
          }
        }
        return padded[col];
      } else if (resolveThreshold > 0) {
        // Resolving — mix of scramble and target
        return Math.random() < resolveThreshold / 30
          ? padded[col]
          : SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
      }
      // Still scrambling
      return SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)];
    }).join("");
  });

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <pre
        className="font-mono text-[10px] text-muted-foreground/[0.35] select-none text-center leading-[1.3]"
        aria-hidden="true"
      >
        {lines.join("\n")}
      </pre>
      <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
      <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
    </div>
  );
}
