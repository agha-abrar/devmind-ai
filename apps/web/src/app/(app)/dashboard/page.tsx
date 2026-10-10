"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, FileText, Layers, Boxes, MessagesSquare, Activity, Plus, ArrowUpRight, ArrowRight, Terminal, Code2, Sparkles, ChevronRight, Workflow } from "lucide-react";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiRequestError } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { Conversation, Project, ProjectDetail } from "@/lib/types";

interface DashboardData {
  projects: Project[];
  totals: { projects: number; documents: number; indexedFiles: number; chunks: number; conversations: number; agentRuns: number };
  recentConversations: Array<Conversation & { projectName: string }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true); setError(null);
    try {
      const projects = await api.get<Project[]>("/projects");
      const recentProjects = [...projects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 6);
      const [details, conversationLists] = await Promise.all([
        Promise.all(projects.map((p) => api.get<ProjectDetail>(`/projects/${p.id}`))),
        Promise.all(recentProjects.slice(0, 3).map(async (p) => {
          const conversations = await api.get<Conversation[]>(`/projects/${p.id}/conversations`);
          return conversations.map((c) => ({ ...c, projectName: p.name }));
        })),
      ]);
      const totals = details.reduce((acc, d) => ({ projects: projects.length, documents: acc.documents + d.stats.documents, indexedFiles: acc.indexedFiles + d.stats.indexed_files, chunks: acc.chunks + d.stats.knowledge_chunks, conversations: acc.conversations + d.stats.conversations, agentRuns: acc.agentRuns + d.stats.agent_runs }), { projects: projects.length, documents: 0, indexedFiles: 0, chunks: 0, conversations: 0, agentRuns: 0 });
      const recentConversations = conversationLists.flat().sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()).slice(0, 4);
      setData({ projects: recentProjects, totals, recentConversations });
    } catch (err) { setError(err instanceof ApiRequestError ? err.detail : "Failed to load dashboard."); }
    finally { setIsLoading(false); }
  }
  useEffect(() => { load(); }, []);
  if (isLoading) return <div className="mx-auto max-w-[1440px] space-y-6 p-5 md:p-8"><Skeleton className="h-64 rounded-2xl" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}</div><Skeleton className="h-64 rounded-2xl" /></div>;
  if (error) return <div className="p-6"><ErrorState message={error} onRetry={load} /></div>;
  if (!data) return null;

  const firstProject = data.projects.find((p) => p.status === "active") || data.projects[0];
  const workspaceHref = firstProject ? `/projects/${firstProject.id}/chat` : "/projects/new";
  const metricCards = [
    { label: "Projects", value: data.totals.projects, icon: FolderKanban, color: "text-primary" },
    { label: "Indexed files", value: data.totals.indexedFiles, icon: Boxes, color: "text-sky-300" },
    { label: "Documents", value: data.totals.documents, icon: FileText, color: "text-indigo-300" },
    { label: "Knowledge chunks", value: data.totals.chunks, icon: Layers, color: "text-amber-300" },
    { label: "Conversations", value: data.totals.conversations, icon: MessagesSquare, color: "text-violet-300" },
    { label: "Agent runs", value: data.totals.agentRuns, icon: Activity, color: "text-primary" },
  ];
  const steps = [
    { number: "01", title: "Connect your code", text: "Bring a repository into your workspace.", href: firstProject ? `/projects/${firstProject.id}/repositories` : "/projects/new" },
    { number: "02", title: "Build the context", text: "Add the docs behind the decisions.", href: firstProject ? `/projects/${firstProject.id}/knowledge` : "/projects/new" },
    { number: "03", title: "Ask the bigger questions", text: "Get answers grounded in your code.", href: workspaceHref },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-7 p-5 md:p-8 lg:p-10">
      <div className="animate-enter flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><p className="eyebrow">Your developer workspace</p></div><span className="font-mono text-[10px] text-muted-foreground">~/devmind/overview</span></div>
      <section className="animate-enter relative grid gap-8 overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.055] via-card/40 to-card/20 p-6 sm:p-8 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
        <div className="relative z-10 py-2"><p className="mb-3 text-sm text-muted-foreground">Welcome back, <span className="text-foreground">{user?.full_name?.split(" ")[0] || "developer"}</span></p><h1 className="max-w-lg text-3xl font-semibold leading-[1.15] tracking-[-0.045em] sm:text-[42px]">Less digging.<br /><span className="text-primary">More building.</span></h1><p className="mt-4 max-w-md text-[13px] leading-7 text-muted-foreground">Your repositories, documentation, and AI agents.<br className="hidden sm:block" /> One workspace to connect the dots in your code.</p><div className="mt-6 flex flex-wrap items-center gap-3"><Button asChild><Link href={workspaceHref}><Sparkles className="h-4 w-4" />Open AI workspace<ArrowUpRight className="h-3.5 w-3.5" /></Link></Button><Button variant="ghost" asChild><Link href="/projects/new"><Plus className="h-4 w-4" />New project</Link></Button></div></div>
        <div className="relative min-w-0 self-center"><div className="absolute -inset-8 rounded-full bg-primary/[0.04] blur-3xl" aria-hidden="true" /><div className="animate-float relative overflow-hidden rounded-xl border border-white/[0.09] bg-[#0a0f17]/90 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-4 py-3"><div className="flex gap-1.5" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-[#ff6b6b]/70" /><span className="h-2 w-2 rounded-full bg-[#e9bb57]/70" /><span className="h-2 w-2 rounded-full bg-primary/70" /></div><span className="font-mono text-[10px] text-muted-foreground">workspace.config.ts</span><Code2 className="h-3.5 w-3.5 text-muted-foreground" /></div>
          <div className="overflow-x-auto whitespace-pre py-5 pr-5 font-mono text-[10px] leading-[2.2] sm:text-xs">
            <p><span className="code-line-number">1</span><span className="text-violet-300">const</span> workspace <span className="text-muted-foreground">=</span> {"{"}</p>
            <p><span className="code-line-number">2</span>{"  "}name: <span className="text-primary">&quot;your-next-big-idea&quot;</span>,</p>
            <p><span className="code-line-number">3</span>{"  "}projects: <span className="text-amber-300">{data.totals.projects}</span>,</p>
            <p><span className="code-line-number">4</span>{"  "}indexedFiles: <span className="text-amber-300">{data.totals.indexedFiles}</span>,</p>
            <p><span className="code-line-number">5</span>{"  "}context: <span className="text-primary">&quot;code + documentation&quot;</span>,</p>
            <p><span className="code-line-number">6</span>{"  "}poweredBy: <span className="text-sky-300">multiAgentIntelligence</span></p>
            <p><span className="code-line-number">7</span>{"};"}<span className="ml-2 code-cursor" aria-hidden="true" /></p>
          </div><div className="flex items-center gap-2 border-t border-white/[0.06] px-4 py-2.5 font-mono text-[10px] text-muted-foreground"><Terminal className="h-3 w-3 text-primary" />Good code starts with good context.</div>
        </div></div>
      </section>
      <section aria-label="Workspace statistics" className="animate-enter stagger-1 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{metricCards.map((metric) => <div key={metric.label} className="surface-panel p-4"><div className="flex items-center justify-between"><metric.icon className={`h-4 w-4 ${metric.color}`} /><span className="h-1 w-1 rounded-full bg-white/20" /></div><p className="mt-4 font-mono text-[25px] font-medium tracking-tight">{metric.value.toLocaleString()}</p><p className="mt-1 text-[10px] text-muted-foreground">{metric.label}</p></div>)}</section>
      <div className="animate-enter stagger-2 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="min-w-0"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-medium"><FolderKanban className="h-4 w-4 text-muted-foreground" />Recent projects<span className="ml-1 rounded border border-border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{data.projects.length}</span></h2><Link href="/projects" className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-primary">View all<ArrowRight className="h-3 w-3" /></Link></div>
          {data.projects.length === 0 ? <EmptyState icon={<FolderKanban className="h-6 w-6 text-primary" />} title="Every great build starts here" description="Create a project and give your code a place to come together." action={<Button asChild size="sm"><Link href="/projects/new">Create project</Link></Button>} /> : <div className="grid gap-3 sm:grid-cols-2">{data.projects.slice(0, 4).map((project, i) => <Link href={`/projects/${project.id}`} key={project.id} className="surface-panel interactive-card group min-w-0 p-5"><div className="flex items-center justify-between"><div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${i % 2 ? "border-indigo-400/15 bg-indigo-400/5 text-indigo-300" : "border-primary/15 bg-primary/5 text-primary"}`}><Code2 className="h-4 w-4" /></div><ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" /></div><h3 className="mt-4 truncate text-sm font-medium">{project.name}</h3><p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">{project.description || "Your next idea starts with context."}</p><div className="mt-5 flex items-center justify-between border-t border-white/[0.05] pt-3 font-mono text-[9px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className={`h-1 w-1 rounded-full ${project.status === "active" ? "bg-primary" : "bg-muted-foreground"}`} />{project.status}</span><span>{formatRelativeTime(project.updated_at)}</span></div></Link>)}</div>}
        </section>
        <section className="min-w-0"><div className="mb-4 flex h-5 items-center gap-2"><MessagesSquare className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-medium">Pick up where you left off</h2></div><div className="surface-panel min-h-[225px] p-2">{data.recentConversations.length === 0 ? <div className="flex min-h-[210px] flex-col items-center justify-center px-5 text-center"><span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/10 bg-primary/5"><MessagesSquare className="h-5 w-5 text-primary" /></span><p className="text-sm font-medium">A conversation away from clarity</p><p className="mt-2 text-xs leading-6 text-muted-foreground">Ask your first question about your code.</p><Link href={workspaceHref} className="mt-4 flex items-center gap-1.5 text-xs text-primary">Start a conversation<ArrowRight className="h-3 w-3" /></Link></div> : data.recentConversations.map((conversation) => <Link key={conversation.id} href={`/projects/${conversation.project_id}/chat?conversation=${conversation.id}`} className="group flex items-start gap-3 rounded-lg p-3.5 transition-colors hover:bg-white/[0.035]"><MessagesSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" /><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{conversation.title}</p><p className="mt-1.5 flex items-center gap-2 font-mono text-[9px] text-muted-foreground"><span className="truncate">{conversation.projectName}</span><span>·</span><span className="shrink-0">{formatRelativeTime(conversation.updated_at)}</span></p></div><ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /></Link>)}</div></section>
      </div>
      <section className="animate-enter stagger-3 border-t border-white/[0.06] pt-6"><div className="mb-5 flex items-center gap-2"><Workflow className="h-4 w-4 text-muted-foreground" /><h2 className="text-sm font-medium">From code to clarity</h2><span className="ml-auto hidden font-mono text-[9px] text-muted-foreground sm:inline">YOUR WORKFLOW, CONNECTED</span></div><div className="grid gap-3 md:grid-cols-3">{steps.map((step) => <Link key={step.number} href={step.href} className="group flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-white/[0.025]"><span className="mt-0.5 font-mono text-[10px] text-primary/70">{step.number}</span><div><p className="flex items-center gap-2 text-xs font-medium">{step.title}<ArrowUpRight className="h-3 w-3 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" /></p><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{step.text}</p></div></Link>)}</div></section>
    </div>
  );
}
