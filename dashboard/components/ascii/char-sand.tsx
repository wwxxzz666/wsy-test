"use client";

import { useEffect, useState, useCallback } from "react";

/**
 * Characters fall and pile up like sand with physics.
 * Bigger, more visible, with colored characters.
 * When the pile fills, it dramatically collapses row by row.
 */

const CHARS_BY_WEIGHT = [
  { char: ".", weight: 0.3 },
  { char: ",", weight: 0.3 },
  { char: ":", weight: 0.4 },
  { char: ";", weight: 0.4 },
  { char: "*", weight: 0.5 },
  { char: "+", weight: 0.5 },
  { char: "#", weight: 0.7 },
  { char: "@", weight: 0.8 },
  { char: "%", weight: 0.9 },
  { char: "&", weight: 1.0 },
];

interface CharSandProps {
  cols?: number;
  rows?: number;
  className?: string;
  speed?: number;
  spawnRate?: number;
}

export function CharSand({
  cols = 60,
  rows = 10,
  className = "",
  speed = 80,
  spawnRate = 0.12,
}: CharSandProps) {
  const [grid, setGrid] = useState<string[][]>(() =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => " "))
  );
  const [dissolving, setDissolving] = useState(false);
  const [dissolveRow, setDissolveRow] = useState(0);

  const tick = useCallback(() => {
    if (dissolving) {
      setGrid((prev) => {
        const next = prev.map((r) => [...r]);
        // Dissolve from bottom up
        const targetRow = rows - 1 - dissolveRow;
        if (targetRow >= 0) {
          for (let x = 0; x < cols; x++) {
            if (Math.random() < 0.4) next[targetRow][x] = " ";
          }
        }
        return next;
      });
      setDissolveRow((d) => {
        if (d >= rows) {
          setDissolving(false);
          setDissolveRow(0);
          setGrid(Array.from({ length: rows }, () => Array.from({ length: cols }, () => " ")));
          return 0;
        }
        return d + 1;
      });
      return;
    }

    setGrid((prev) => {
      const next = prev.map((r) => [...r]);

      // Gravity: move particles down
      for (let y = rows - 2; y >= 0; y--) {
        for (let x = 0; x < cols; x++) {
          if (next[y][x] !== " " && next[y + 1][x] === " ") {
            next[y + 1][x] = next[y][x];
            next[y][x] = " ";
          } else if (next[y][x] !== " " && next[y + 1][x] !== " ") {
            // Slide sideways
            const dir = Math.random() < 0.5 ? -1 : 1;
            const nx1 = x + dir;
            const nx2 = x - dir;
            if (nx1 >= 0 && nx1 < cols && next[y + 1][nx1] === " " && next[y][nx1] === " ") {
              next[y + 1][nx1] = next[y][x];
              next[y][x] = " ";
            } else if (nx2 >= 0 && nx2 < cols && next[y + 1][nx2] === " " && next[y][nx2] === " ") {
              next[y + 1][nx2] = next[y][x];
              next[y][x] = " ";
            }
          }
        }
      }

      // Spawn new particles at top
      for (let x = 0; x < cols; x++) {
        if (Math.random() < spawnRate && next[0][x] === " ") {
          const c = CHARS_BY_WEIGHT[Math.floor(Math.random() * CHARS_BY_WEIGHT.length)];
          next[0][x] = c.char;
        }
      }

      // Check if pile is too high
      const topRowFill = next[1].filter((c) => c !== " ").length;
      if (topRowFill > cols * 0.5) {
        setDissolving(true);
        setDissolveRow(0);
      }

      return next;
    });
  }, [cols, rows, spawnRate, dissolving]);

  useEffect(() => {
    const id = setInterval(tick, speed);
    return () => clearInterval(id);
  }, [tick, speed]);

  const text = grid.map((row) => row.join("")).join("\n");

  return (
    <pre
      className={`font-mono text-[10px] leading-[1.2] text-foreground/25 select-none pointer-events-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {text}
    </pre>
  );
}
