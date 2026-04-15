"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Conway's Game of Life rendered as ASCII characters.
 * Alive cells cycle through a glyph evolution based on their age.
 * Runs as a background layer inside cards and dead zones.
 */

const GLYPHS = [" ", ".", ":", "+", "*", "#", "@", "%", "&", "#", "*", "+", ":", "."];

interface LifeFieldProps {
  cols?: number;
  rows?: number;
  className?: string;
  speed?: number;
  density?: number;
  palette?: "orange" | "purple" | "green" | "cyan" | "gradient";
}

const paletteColors: Record<string, string> = {
  orange: "text-amber-500/30",
  purple: "text-foreground/20",
  green: "text-emerald-500/30",
  cyan: "text-emerald-500/25",
  gradient: "ascii-gradient opacity-[0.35]",
};

function createGrid(rows: number, cols: number, density: number): number[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => (Math.random() < density ? 1 : 0))
  );
}

function step(grid: number[][]): number[][] {
  const rows = grid.length;
  const cols = grid[0].length;
  const next = grid.map((r) => [...r]);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let neighbors = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dy === 0 && dx === 0) continue;
          const ny = (y + dy + rows) % rows;
          const nx = (x + dx + cols) % cols;
          neighbors += grid[ny][nx] > 0 ? 1 : 0;
        }
      }
      if (grid[y][x] > 0) {
        next[y][x] = neighbors === 2 || neighbors === 3 ? Math.min(grid[y][x] + 1, GLYPHS.length - 1) : 0;
      } else {
        next[y][x] = neighbors === 3 ? 1 : 0;
      }
    }
  }
  return next;
}

export function LifeField({
  cols = 80,
  rows = 12,
  className = "",
  speed = 300,
  density = 0.18,
  palette = "purple",
}: LifeFieldProps) {
  const [mounted, setMounted] = useState(false);
  // Start with empty grid to avoid hydration mismatch from Math.random()
  const [grid, setGrid] = useState<number[][]>(() =>
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0))
  );
  const genRef = useRef(0);

  useEffect(() => { setMounted(true); }, []);

  // Initialize random grid only after mount
  useEffect(() => {
    if (!mounted) return;
    setGrid(createGrid(rows, cols, density));
  }, [mounted, rows, cols, density]);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setGrid((g) => {
        const next = step(g);
        genRef.current++;
        const alive = next.flat().filter((c) => c > 0).length;
        if (alive === 0 || genRef.current % 60 === 0) {
          return createGrid(rows, cols, density);
        }
        return next;
      });
    }, speed);
    return () => clearInterval(interval);
  }, [mounted, rows, cols, speed, density]);

  const render = useCallback(() => {
    return grid
      .map((row) =>
        row.map((cell) => GLYPHS[cell % GLYPHS.length]).join("")
      )
      .join("\n");
  }, [grid]);

  return (
    <pre
      className={`font-mono text-[10px] leading-[1.25] select-none pointer-events-none overflow-hidden ${paletteColors[palette]} ${className}`}
      aria-hidden="true"
    >
      {render()}
    </pre>
  );
}
