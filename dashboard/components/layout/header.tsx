"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { ConnectionStatusIndicator } from "./connection-status-indicator";

interface HeaderProps {
  title: string;
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b px-4 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <h1 className="text-xs font-semibold tracking-[0.15em] uppercase text-foreground/70">{title}</h1>
      <div className="ml-auto flex items-center gap-3">
        <Tooltip>
          <TooltipTrigger>
            <Badge
              variant="outline"
              className="text-[9px] h-4 px-1.5 text-muted-foreground/40 border-muted-foreground/15 cursor-default font-mono"
            >
              pii:off
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div className="text-xs space-y-1 max-w-[220px]">
              <p className="font-medium">PII Sanitizer Plugin</p>
              <p>
                Disabled by default. Enable it if your selected model provider
                requires stricter PII handling.
              </p>
            </div>
          </TooltipContent>
        </Tooltip>
        <ConnectionStatusIndicator />
        <ThemeToggle />
      </div>
    </header>
  );
}
