"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  BookOpen,
  Bot,
  Activity,
  MessagesSquare,
  Settings,
  Brain,
  LogOut,
} from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  requiresProject?: boolean;
}

export function Sidebar({ projectId }: { projectId?: string }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const navItems: NavItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/projects", icon: FolderKanban },
    {
      label: "Knowledge",
      href: projectId ? `/projects/${projectId}/knowledge` : "/projects",
      icon: BookOpen,
      requiresProject: true,
    },
    {
      label: "AI Workspace",
      href: projectId ? `/projects/${projectId}/chat` : "/projects",
      icon: Bot,
      requiresProject: true,
    },
    {
      label: "Agent Runs",
      href: projectId ? `/projects/${projectId}/agent-runs` : "/projects",
      icon: Activity,
      requiresProject: true,
    },
    {
      label: "Conversations",
      href: projectId ? `/projects/${projectId}/conversations` : "/projects",
      icon: MessagesSquare,
      requiresProject: true,
    },
    { label: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-5 py-5 font-semibold">
        <Brain className="h-5 w-5 text-primary" />
        DevMind AI
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href.split("?")[0]) && item.href !== "/projects");
          const disabled = item.requiresProject && !projectId;
          return (
            <Link
              key={item.label}
              href={item.href}
              aria-disabled={disabled}
              title={disabled ? "Select a project first" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                disabled && "opacity-50"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center justify-between rounded-md px-2 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{user?.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            aria-label="Log out"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
