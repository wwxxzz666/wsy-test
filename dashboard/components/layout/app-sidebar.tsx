"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  GitPullRequest,
  Activity,
  BarChart3,
  ScrollText,
  Radio,
  GitFork,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { ConnectionStatusIndicator } from "./connection-status-indicator";
import { AsciiWalker } from "@/components/ascii/ascii-walker";

const navItems = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Live Feed", href: "/live", icon: Radio },
  { title: "Pull Requests", href: "/prs", icon: GitPullRequest },
  { title: "Repo Health", href: "/repos", icon: GitFork },
  { title: "Health", href: "/health", icon: Activity },
  { title: "Quality", href: "/quality", icon: BarChart3 },
  { title: "Logs", href: "/logs", icon: ScrollText },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-[-0.03em] ascii-gradient" style={{ fontFamily: "var(--font-space-grotesk)" }}>ClawOSS</span>
          <Badge variant="outline" className="text-[8px] h-3.5 px-1 text-muted-foreground/30 border-muted-foreground/10 font-mono">
            v7
          </Badge>
        </div>
        <div className="mt-2">
          <ConnectionStatusIndicator />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-muted-foreground/50">
            Dashboard
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={pathname === item.href}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="text-[12px]">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4 space-y-2">
        <div className="overflow-hidden rounded-sm">
          <AsciiWalker width={28} speed={200} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-emerald-500/40" />
            <p className="text-[9px] text-muted-foreground/30 font-mono tracking-wide">
              monitoring v7
            </p>
          </div>
          <p className="text-[8px] text-muted-foreground/15 font-mono">
            autonomous oss contributor
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
