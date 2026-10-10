"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FolderKanban, BookOpen, Bot, Activity, MessagesSquare, Settings, Code2, LogOut, ChevronsUpDown, ChevronRight, Terminal, GitBranch } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface NavItem { label: string; href: string; icon: ComponentType<{ className?: string }>; project?: boolean }

export function Sidebar({ projectId }: { projectId?: string }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const navItems: NavItem[] = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "Projects", href: "/projects", icon: FolderKanban },
    { label: "AI Workspace", href: projectId ? `/projects/${projectId}/chat` : "/projects", icon: Bot, project: true },
    { label: "Knowledge", href: projectId ? `/projects/${projectId}/knowledge` : "/projects", icon: BookOpen, project: true },
    { label: "Agent runs", href: projectId ? `/projects/${projectId}/agent-runs` : "/projects", icon: Activity, project: true },
    { label: "Conversations", href: projectId ? `/projects/${projectId}/conversations` : "/projects", icon: MessagesSquare, project: true },
  ];

  return (
    <aside className="flex h-full w-16 shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#0c1018]/95 md:w-60">
      <Link href="/dashboard" aria-label="DevMind AI home" className="flex h-16 shrink-0 items-center justify-center gap-2.5 border-b border-white/[0.06] md:justify-start md:px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary"><Code2 className="h-5 w-5" /></span>
        <span className="hidden text-[17px] font-semibold tracking-tight md:inline">devmind<span className="ml-1.5 font-mono text-xs font-normal text-primary">ai</span></span>
      </Link>
      <div className="hidden px-4 pb-5 pt-5 md:block">
        <Link href="/projects" className="flex items-center gap-3 rounded-lg border border-border bg-white/[0.02] px-3 py-2.5 transition-colors hover:bg-white/[0.05]">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-400/10 text-xs font-semibold text-indigo-300">{user?.full_name?.charAt(0).toUpperCase() || "D"}</span>
          <div className="flex-1"><p className="text-xs font-medium">Personal workspace</p><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">Your development space</p></div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
      </div>
      <div className="eyebrow hidden px-6 pb-3 md:block">Workspace</div>
      <nav aria-label="Main navigation" className="space-y-1 px-2 pt-4 md:px-3 md:pt-0">
        {navItems.map((item) => {
          const isActive = item.project ? !!projectId && pathname.startsWith(item.href) : item.href === "/projects" ? pathname === "/projects" || pathname === "/projects/new" || pathname === `/projects/${projectId}` : pathname === item.href;
          return (
            <Link key={item.label} href={item.href} aria-label={item.label} aria-current={isActive ? "page" : undefined} title={item.project && !projectId ? `${item.label} — choose a project to begin` : item.label}
              className={cn("group relative flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors duration-200 md:justify-start", isActive ? "bg-primary/[0.09] text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground")}>
              {isActive && <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-primary" />}
              <item.icon className="h-[17px] w-[17px] shrink-0" /><span className="hidden md:inline">{item.label}</span>
              {isActive && <ChevronRight className="ml-auto hidden h-3.5 w-3.5 opacity-60 md:block" />}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto px-3 pb-3 pt-8">
        <div className="mb-5 hidden rounded-xl border border-primary/10 bg-gradient-to-br from-primary/[0.055] to-transparent p-4 md:block">
          <Terminal className="mb-3 h-4 w-4 text-primary" /><p className="text-xs font-medium">Less searching. More building.</p><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Give your AI the context of your codebase.</p>
          <Link href="/projects" className="mt-3 flex items-center gap-1 text-[11px] font-medium text-primary">Explore projects <ChevronRight className="h-3 w-3" /></Link>
        </div>
        <Link href="/settings" aria-label="Settings" title="Settings" className={cn("flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-[13px] transition-colors hover:bg-muted md:justify-start", pathname === "/settings" ? "text-primary" : "text-muted-foreground")}><Settings className="h-4 w-4" /><span className="hidden md:inline">Settings</span></Link>
      </div>
      <div className="flex items-center gap-2.5 border-t border-white/[0.06] px-3 py-4 md:px-4">
        <span className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-semibold text-primary md:flex">{user?.full_name?.charAt(0).toUpperCase()}</span>
        <div className="hidden min-w-0 flex-1 md:block"><p className="truncate text-xs font-medium">{user?.full_name}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{user?.email}</p></div>
        <button onClick={logout} aria-label="Log out" title="Log out" className="mx-auto rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:mx-0"><LogOut className="h-4 w-4" /></button>
      </div>
      <div className="hidden h-6 shrink-0 items-center gap-1.5 border-t border-white/[0.06] px-4 font-mono text-[9px] text-muted-foreground md:flex"><GitBranch className="h-3 w-3" /> devmind / workspace</div>
    </aside>
  );
}
