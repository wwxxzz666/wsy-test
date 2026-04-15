"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Terminal emulator that types out agent commands and shows output.
 * Signature visual element -- the "heartbeat" of the dashboard.
 */

const SEQUENCES = [
  {
    cmd: "gh issue list --state=open --label=help-wanted --limit=3",
    out: [
      "  #938  extend active learning with multiple annotators    cleanlab/cleanlab",
      "  #3268 [Bug]: -d flag on Job Spawn produces error        atuinsh/atuin",
      "  #183  plan-phase stream file has no employee suffix      kenhaesler/claude-agent",
    ],
  },
  {
    cmd: "git diff --stat HEAD~1",
    out: [
      "  src/parser.ts     | 47 +++++++++++++++++--------",
      "  src/validator.ts  | 12 +++---",
      "  tests/parser.test | 31 ++++++++++++++++++",
      "  3 files changed, 67 insertions(+), 23 deletions(-)",
    ],
  },
  {
    cmd: "claw quality score --pr=22710",
    out: [
      "  scope:9  code:8  tests:8  security:9  anti-slop:7",
      "  git:9  template:8  overall: 84 [PASS]",
    ],
  },
  {
    cmd: "npm test -- --coverage --silent",
    out: [
      "  PASS  src/__tests__/pipeline.test.ts",
      "  PASS  src/__tests__/quality.test.ts",
      "  Tests: 14 passed  Coverage: 87.3%  Time: 2.4s",
    ],
  },
];

interface TerminalLoopProps {
  className?: string;
  typeSpeed?: number;
}

export function TerminalLoop({
  className = "",
  typeSpeed = 40,
}: TerminalLoopProps) {
  const [lines, setLines] = useState<string[]>(["$ "]);
  const [showCursor, setShowCursor] = useState(true);
  const seqIdx = useRef(Math.floor(Math.random() * SEQUENCES.length));
  const phase = useRef<"typing" | "output" | "pause" | "clearing">("typing");
  const charIdx = useRef(0);
  const outputLine = useRef(0);
  const pauseCount = useRef(0);

  useEffect(() => {
    const cursorId = setInterval(() => setShowCursor((c) => !c), 530);
    return () => clearInterval(cursorId);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const seq = SEQUENCES[seqIdx.current];

      if (phase.current === "typing") {
        if (charIdx.current <= seq.cmd.length) {
          const typed = seq.cmd.slice(0, charIdx.current);
          setLines([`$ ${typed}`]);
          charIdx.current++;
        } else {
          phase.current = "output";
          outputLine.current = 0;
          charIdx.current = 0;
        }
      } else if (phase.current === "output") {
        if (outputLine.current < seq.out.length) {
          charIdx.current++;
          if (charIdx.current > 3) {
            setLines((prev) => [...prev, seq.out[outputLine.current]]);
            outputLine.current++;
            charIdx.current = 0;
          }
        } else {
          phase.current = "pause";
          pauseCount.current = 0;
        }
      } else if (phase.current === "pause") {
        pauseCount.current++;
        if (pauseCount.current > 30) {
          phase.current = "clearing";
          charIdx.current = 0;
        }
      } else if (phase.current === "clearing") {
        charIdx.current++;
        if (charIdx.current > 5) {
          seqIdx.current = (seqIdx.current + 1) % SEQUENCES.length;
          phase.current = "typing";
          charIdx.current = 0;
          outputLine.current = 0;
          setLines(["$ "]);
        }
      }
    }, typeSpeed);

    return () => clearInterval(id);
  }, [typeSpeed]);

  return (
    <div className={`terminal-card scanlines ${className}`}>
      <div className="flex items-center justify-between mb-2 px-3 pt-2.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/10" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/10" />
            <span className="h-1.5 w-1.5 rounded-full bg-foreground/10" />
          </div>
          <span className="text-[9px] text-muted-foreground/30 font-mono uppercase tracking-widest">agent tty</span>
        </div>
        <span className="text-[8px] text-emerald-500/30 font-mono">LIVE</span>
      </div>
      <pre
        className="font-mono text-[11px] leading-[1.6] text-foreground/60 select-none pointer-events-none whitespace-pre-wrap min-h-[72px] px-3 pb-2.5"
        aria-hidden="true"
      >
        {lines.join("\n")}
        <span className={showCursor ? "text-emerald-400/80" : "text-transparent"}>{"█"}</span>
      </pre>
    </div>
  );
}
