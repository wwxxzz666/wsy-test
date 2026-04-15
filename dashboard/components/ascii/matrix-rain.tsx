"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Vertical streams of characters falling like rain.
 * Each column has independent speed and character cycling.
 * The lead character is brighter, trailing chars fade out.
 */

const CHARS = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン".split("");
const LATIN = "abcdefghijklmnopqrstuvwxyz0123456789".split("");

interface MatrixRainProps {
  cols?: number;
  rows?: number;
  className?: string;
  speed?: number;
  density?: number;
  useKatakana?: boolean;
}

interface Drop {
  col: number;
  row: number;
  speed: number;
  length: number;
  chars: string[];
}

export function MatrixRain({
  cols = 40,
  rows = 12,
  className = "",
  speed = 80,
  density = 0.08,
  useKatakana = false,
}: MatrixRainProps) {
  const charset = useKatakana ? CHARS : LATIN;
  const dropsRef = useRef<Drop[]>([]);
  const [display, setDisplay] = useState("");

  const spawnDrop = useCallback((col: number): Drop => {
    const length = 3 + Math.floor(Math.random() * 6);
    return {
      col,
      row: -length,
      speed: 0.3 + Math.random() * 0.7,
      length,
      chars: Array.from({ length }, () =>
        charset[Math.floor(Math.random() * charset.length)]
      ),
    };
  }, [charset]);

  const tick = useCallback(() => {
    const drops = dropsRef.current;

    // Spawn new drops
    for (let c = 0; c < cols; c++) {
      if (Math.random() < density * 0.1) {
        // Don't spawn if there's already a drop in this column nearby
        const existing = drops.find(
          (d) => d.col === c && d.row < rows * 0.5
        );
        if (!existing) {
          drops.push(spawnDrop(c));
        }
      }
    }

    // Move drops
    for (const drop of drops) {
      drop.row += drop.speed;
      // Randomly mutate one char per tick
      if (Math.random() < 0.15) {
        const idx = Math.floor(Math.random() * drop.chars.length);
        drop.chars[idx] = charset[Math.floor(Math.random() * charset.length)];
      }
    }

    // Remove drops that have fully passed
    dropsRef.current = drops.filter((d) => d.row - d.length < rows);

    // Render grid
    const grid: string[][] = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => " ")
    );

    for (const drop of dropsRef.current) {
      for (let i = 0; i < drop.length; i++) {
        const y = Math.floor(drop.row) - i;
        if (y >= 0 && y < rows) {
          grid[y][drop.col] = drop.chars[i];
        }
      }
    }

    setDisplay(grid.map((row) => row.join("")).join("\n"));
  }, [cols, rows, density, charset, spawnDrop]);

  useEffect(() => {
    const id = setInterval(tick, speed);
    return () => clearInterval(id);
  }, [tick, speed]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <pre
        className="font-mono text-[9px] leading-[1.2] text-emerald-400/[0.30] select-none pointer-events-none"
        aria-hidden="true"
      >
        {display}
      </pre>
      <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-background pointer-events-none" />
    </div>
  );
}
