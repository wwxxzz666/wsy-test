"use client";

import { useEffect, useState, useRef, useCallback } from "react";

/**
 * Langton's Ant: a cellular automaton that produces complex emergent patterns.
 * The ant walks on a grid, flipping cells between states and turning.
 * After ~10000 steps it produces a beautiful "highway" pattern.
 * We render cells as ASCII chars based on visit count.
 *
 * White -> turn right, flip to black, move forward
 * Black -> turn left, flip to white, move forward
 */

const VISIT_CHARS = [" ", ".", ":", "+", "*", "#", "@", "%"];
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W

interface LangtonsAntProps {
  cols?: number;
  rows?: number;
  className?: string;
  speed?: number;
  stepsPerFrame?: number;
}

export function LangtonsAnt({
  cols = 60,
  rows = 20,
  className = "",
  speed = 50,
  stepsPerFrame = 8,
}: LangtonsAntProps) {
  const gridRef = useRef<number[][]>(
    Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0))
  );
  const antRef = useRef({ x: Math.floor(cols / 2), y: Math.floor(rows / 2), dir: 0 });
  const stepCount = useRef(0);
  const [display, setDisplay] = useState("");

  const doSteps = useCallback(() => {
    const grid = gridRef.current;
    const ant = antRef.current;

    for (let s = 0; s < stepsPerFrame; s++) {
      // Current cell state
      const cellVal = grid[ant.y][ant.x];
      const isWhite = cellVal === 0;

      // Turn
      if (isWhite) {
        ant.dir = (ant.dir + 1) % 4; // Turn right
      } else {
        ant.dir = (ant.dir + 3) % 4; // Turn left
      }

      // Flip cell
      grid[ant.y][ant.x] = isWhite ? 1 : 0;

      // Move forward
      ant.x = (ant.x + DIRS[ant.dir][0] + cols) % cols;
      ant.y = (ant.y + DIRS[ant.dir][1] + rows) % rows;

      // Track visits for richer glyphs
      if (grid[ant.y][ant.x] > 0) {
        grid[ant.y][ant.x] = Math.min(grid[ant.y][ant.x] + 1, VISIT_CHARS.length - 1);
      }

      stepCount.current++;
    }

    // Render
    const text = grid.map((row, y) =>
      row.map((cell, x) => {
        // Show ant position
        if (x === ant.x && y === ant.y) {
          return ["^", ">", "v", "<"][ant.dir];
        }
        return VISIT_CHARS[Math.min(cell, VISIT_CHARS.length - 1)];
      }).join("")
    ).join("\n");

    setDisplay(text);

    // Reset after many steps to keep it fresh
    if (stepCount.current > 15000) {
      gridRef.current = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => 0)
      );
      antRef.current = {
        x: Math.floor(cols / 2) + Math.floor(Math.random() * 10 - 5),
        y: Math.floor(rows / 2) + Math.floor(Math.random() * 6 - 3),
        dir: Math.floor(Math.random() * 4),
      };
      stepCount.current = 0;
    }
  }, [cols, rows, stepsPerFrame]);

  useEffect(() => {
    const id = setInterval(doSteps, speed);
    return () => clearInterval(id);
  }, [doSteps, speed]);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <pre
        className="font-mono text-[8px] leading-[1.15] text-muted-foreground/[0.08] select-none pointer-events-none"
        aria-hidden="true"
      >
        {display}
      </pre>
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-background/60 pointer-events-none" />
    </div>
  );
}
