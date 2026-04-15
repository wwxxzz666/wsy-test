"use client";

import { useState, useCallback } from "react";

interface CopyButtonProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function CopyButton({ value, children, className = "", title }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    },
    [value]
  );

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors ${
        copied ? "copy-flash" : ""
      } ${className}`}
      title={title || `Click to copy: ${value}`}
    >
      {children}
      <span
        className={`text-[8px] font-mono transition-opacity ${
          copied ? "opacity-100 text-emerald-400" : "opacity-0"
        }`}
      >
        {copied ? "copied" : ""}
      </span>
    </button>
  );
}
