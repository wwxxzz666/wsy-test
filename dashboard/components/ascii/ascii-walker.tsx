"use client";

import { useEffect, useState, useRef } from "react";

/**
 * A 2-line-tall ASCII creature that walks, idles, and jumps.
 * Bigger, more visible, with a trail of artifacts behind it.
 */

const WALK_FRAMES = [
  ["  o ", " /|\\", " / \\"],
  ["  o ", " /|\\", "  |>"],
  ["  o ", " /|\\", " < \\"],
  ["  o ", " /|\\", "  | "],
];

const IDLE_FRAMES = [
  ["  o ", " /|\\", "  | "],
  [" \\o ", "  |\\", "  | "],
  ["  o/", " /| ", "  | "],
  ["  o ", " /|\\", "  | "],
];

const JUMP_FRAMES = [
  ["\\o/", " | ", "   "],
  ["\\o/", " | ", "   "],
  [" o ", "/|\\", "/ \\"],
];

interface AsciiWalkerProps {
  width?: number;
  className?: string;
  speed?: number;
}

export function AsciiWalker({
  width = 80,
  className = "",
  speed = 180,
}: AsciiWalkerProps) {
  const [pos, setPos] = useState(0);
  const [frame, setFrame] = useState(0);
  const [mode, setMode] = useState<"walk" | "idle" | "jump">("walk");
  const modeTicks = useRef(0);
  const trail = useRef<{ pos: number; age: number }[]>([]);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((f) => f + 1);
      modeTicks.current++;

      // Age trail
      trail.current = trail.current
        .map((t) => ({ ...t, age: t.age + 1 }))
        .filter((t) => t.age < 12);

      if (mode === "walk") {
        setPos((p) => {
          const next = (p + 1) % (width - 4);
          trail.current.push({ pos: next, age: 0 });
          return next;
        });
        if (Math.random() < 0.04) {
          setMode("idle");
          modeTicks.current = 0;
        } else if (Math.random() < 0.015) {
          setMode("jump");
          modeTicks.current = 0;
        }
      } else if (mode === "idle") {
        if (modeTicks.current > 12) {
          setMode("walk");
          modeTicks.current = 0;
        }
      } else if (mode === "jump") {
        if (modeTicks.current > JUMP_FRAMES.length + 1) {
          setMode("walk");
          modeTicks.current = 0;
        }
      }
    }, speed);
    return () => clearInterval(id);
  }, [mode, width, speed]);

  const frames =
    mode === "walk" ? WALK_FRAMES : mode === "idle" ? IDLE_FRAMES : JUMP_FRAMES;
  const currentFrames = frames[frame % frames.length];

  // Trail characters by age
  const trailChar = (age: number) => {
    if (age < 3) return ".";
    if (age < 6) return "\u00B7";
    if (age < 9) return " ";
    return " ";
  };

  // Build 3-line output
  const output = currentFrames.map((frameLine, row) => {
    const line = Array.from({ length: width }, (_, i) => {
      // Character body
      const bodyStart = pos;
      const bodyEnd = pos + frameLine.length;
      if (i >= bodyStart && i < bodyEnd) {
        return frameLine[i - bodyStart];
      }
      // Trail (only on bottom row)
      if (row === 2) {
        const t = trail.current.find((t) => t.pos === i);
        if (t) return trailChar(t.age);
      }
      return " ";
    }).join("");
    return line;
  });

  return (
    <pre
      className={`font-mono text-[10px] leading-[1.15] text-muted-foreground/40 select-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {output.join("\n")}
    </pre>
  );
}
