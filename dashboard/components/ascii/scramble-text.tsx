"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Text that scrambles through random glyphs before resolving to the target.
 * Each character resolves independently with a staggered cascade.
 * Re-triggers on text change. Pure CSS-art flex.
 */

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;':\",./<>?~`".split("");

interface ScrambleTextProps {
  text: string;
  className?: string;
  speed?: number;
  /** Delay per character in ms before it starts resolving */
  stagger?: number;
  /** How many scramble frames before resolving */
  scrambleFrames?: number;
  /** Trigger re-scramble on this key changing */
  triggerKey?: string | number;
}

export function ScrambleText({
  text,
  className = "",
  speed = 30,
  stagger = 20,
  scrambleFrames = 8,
  triggerKey,
}: ScrambleTextProps) {
  const [display, setDisplay] = useState(text);
  const [mounted, setMounted] = useState(false);
  const frameRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scramble = useCallback(() => {
    frameRef.current = 0;
    const totalFrames = text.length * (stagger / speed) + scrambleFrames;

    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      frameRef.current++;
      const frame = frameRef.current;

      const chars = text.split("").map((target, i) => {
        if (target === " ") return " ";
        const charStart = (i * stagger) / speed;
        const elapsed = frame - charStart;
        if (elapsed >= scrambleFrames) return target;
        if (elapsed <= 0) return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        // Increasingly likely to show the real char as we approach resolution
        const resolveChance = elapsed / scrambleFrames;
        return Math.random() < resolveChance * 0.5
          ? target
          : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      });

      setDisplay(chars.join(""));

      if (frame > totalFrames + 2) {
        setDisplay(text);
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, speed);
  }, [text, speed, stagger, scrambleFrames]);

  // Mark mounted after hydration completes
  useEffect(() => {
    setMounted(true);
  }, []);

  // Only start scrambling after mount (avoids hydration mismatch)
  useEffect(() => {
    if (!mounted) return;
    scramble();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mounted, scramble, triggerKey]);

  return <span className={className} suppressHydrationWarning>{display}</span>;
}
