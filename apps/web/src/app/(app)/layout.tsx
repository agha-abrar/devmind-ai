"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, ChevronRight, Code2, Pause, Play, Plus, Braces, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [motionPaused, setMotionPaused] = useState(false);

  useEffect(() => { if (!isLoading && !user) router.replace("/login"); }, [isLoading, user, router]);
  useEffect(() => {
    try {
      const paused = localStorage.getItem("devmind-motion") === "paused";
      setMotionPaused(paused);
      document.documentElement.dataset.motion = paused ? "paused" : "running";
    } catch { /* Storage can be disabled in private browsing. */ }
  }, []);

  function toggleMotion() {
    const paused = !motionPaused;
    setMotionPaused(paused);
    document.documentElement.dataset.motion = paused ? "paused" : "running";
    try { localStorage.setItem("devmind-motion", paused ? "paused" : "running"); } catch { /* Preference still applies for this visit. */ }
  }

  const projectMatch = pathname?.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch && projectMatch[1] !== "new" ? projectMatch[1] : undefined;
  const lastPart = pathname.split("/").filter(Boolean).pop();
  const labels: Record<string, string> = { dashboard: "Overview", projects: "Projects", new: "New project", chat: "AI Workspace", knowledge: "Knowledge", repositories: "Repositories", "agent-runs": "Agent runs", conversations: "Conversations", settings: "Settings" };
  const pageLabel = labels[lastPart || "dashboard"] || (pathname.includes("agent-runs") ? "Run details" : "Project overview");

  if (isLoading || !user) return <div className="flex h-dvh flex-col items-center justify-center gap-5"><Code2 className="h-9 w-9 text-primary" /><div className="flex items-center gap-2 font-mono text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening your workspace…</div></div>;

  return (
    <div className="flex h-dvh overflow-hidden">
      <a href="#workspace-content" className="sr-only z-50 rounded bg-primary p-3 text-primary-foreground focus:not-sr-only focus:absolute focus:left-4 focus:top-4">Skip to workspace</a>
      <Sidebar projectId={projectId} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-background/60 px-4 backdrop-blur-xl md:px-8">
          <div className="flex min-w-0 items-center gap-2.5 text-xs"><Code2 className="hidden h-4 w-4 text-muted-foreground sm:block" /><Link href="/dashboard" className="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline">Workspace</Link><ChevronRight className="hidden h-3 w-3 text-muted-foreground sm:block" /><span className="truncate font-medium">{pageLabel}</span></div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <span className="hidden items-center gap-1.5 rounded-full border border-primary/15 bg-primary/5 px-2.5 py-1 font-mono text-[9px] text-primary lg:flex"><Sparkles className="h-3 w-3" /> MULTI-AGENT WORKSPACE</span>
            <button onClick={toggleMotion} aria-label={motionPaused ? "Resume animations" : "Pause animations"} aria-pressed={motionPaused} title={motionPaused ? "Resume animations" : "Pause animations"} className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">{motionPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}</button>
            <Link href="/projects/new" aria-label="New project" className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] transition-colors hover:border-primary/40 hover:text-primary"><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">New project</span></Link>
          </div>
        </header>
        <main id="workspace-content" className="relative min-h-0 flex-1 overflow-y-auto">{children}</main>
        <footer className="flex h-6 shrink-0 items-center justify-between gap-3 border-t border-white/[0.06] bg-[#0c1018]/90 px-4 font-mono text-[9px] text-muted-foreground"><span className="flex items-center gap-1.5"><Braces className="h-3 w-3 text-primary" /> Your code. In context.</span><span className="hidden sm:inline">DevMind AI <span className="px-2 opacity-40">/</span> Code intelligence workspace</span><span>UTF-8</span></footer>
      </div>
    </div>
  );
}
