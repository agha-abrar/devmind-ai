"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { GitBranch, BookOpen, Bot, Activity, MessagesSquare, Pencil, Trash2, Loader2, ArrowRight, ArrowUpRight, Terminal, FolderCode, Code2, Check, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton, ErrorState } from "@/components/ui/badge";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import type { ProjectDetail } from "@/lib/types";

export default function ProjectOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function load() {
    setError(null);
    try {
      const data = await api.get<ProjectDetail>(`/projects/${projectId}`);
      setProject(data);
      setName(data.name);
      setDescription(data.description || "");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to load project.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await api.patch(`/projects/${projectId}`, { name, description });
      toast({ title: "Project updated", variant: "success" });
      setEditOpen(false);
      load();
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/projects/${projectId}`);
      toast({ title: "Project deleted", variant: "success" });
      router.push("/projects");
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    }
  }

  if (error) {
    return (
      <div className="p-8">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-64 max-w-full" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const quickLinks = [
    { label: "Repositories", href: `/projects/${projectId}/repositories`, icon: GitBranch, value: project.stats.repositories },
    { label: "Knowledge", href: `/projects/${projectId}/knowledge`, icon: BookOpen, value: project.stats.documents },
    { label: "Indexed chunks", href: `/projects/${projectId}/chat`, icon: Code2, value: project.stats.knowledge_chunks },
    { label: "Conversations", href: `/projects/${projectId}/conversations`, icon: MessagesSquare, value: project.stats.conversations },
    { label: "Agent Runs", href: `/projects/${projectId}/agent-runs`, icon: Activity, value: project.stats.agent_runs },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-5 sm:p-8 lg:p-10">
      <div className="animate-enter flex items-center gap-2 font-mono text-[11px] text-muted-foreground"><Link href="/projects" className="shrink-0 transition-colors hover:text-primary">projects</Link><ChevronRight className="h-3 w-3 shrink-0" /><span className="truncate text-foreground">{project.name}</span><span className="ml-auto hidden shrink-0 text-muted-foreground sm:block">/ overview</span></div>
      <div className="animate-enter stagger-1 flex flex-col items-start justify-between gap-5 sm:flex-row">
        <div className="min-w-0 max-w-full">
          <div className="eyebrow mb-3 flex items-center gap-2"><FolderCode className="h-3.5 w-3.5" /> PROJECT OVERVIEW</div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 max-w-full break-words text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h1>
            <Badge variant={project.status === "active" ? "success" : "secondary"}>{project.status}</Badge>
          </div>
          <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-muted-foreground">{project.description || "Your code, context, and conversations. Everything you need to build with clarity."}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDeleteOpen(true)} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="animate-enter stagger-2 grid gap-3 min-[380px]:grid-cols-2 lg:grid-cols-5">
        {quickLinks.map((link) => (
          <Link key={link.label} href={link.href}>
            <Card className="group h-full rounded-xl transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-primary/40 motion-reduce:transform-none">
              <CardContent className="p-5">
                <div className="flex items-center justify-between"><link.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" /><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40" /></div>
                <p className="mb-1 mt-5 break-words font-mono text-3xl tracking-tight">{link.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{link.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="animate-enter stagger-3 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <section className="surface-panel relative min-w-0 overflow-hidden rounded-2xl border border-primary/20 p-4 sm:p-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-primary/[0.06] blur-3xl" />
          <div className="relative">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Bot className="h-6 w-6" /></div>
            <p className="eyebrow mb-2 mt-7">YOUR CODE HAS ANSWERS</p>
            <h2 className="max-w-sm text-2xl font-semibold leading-tight tracking-tight">A little context.<br />A whole new perspective.</h2>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">Explore architecture, trace a bug, or plan your next feature. Your AI workspace connects the dots across your codebase.</p>
            <Button asChild className="mt-6 h-auto min-h-9 max-w-full whitespace-normal px-3 text-xs sm:px-4 sm:text-sm"><Link href={`/projects/${projectId}/chat`}>Open AI Workspace <ArrowRight className="h-4 w-4 shrink-0" /></Link></Button>
          </div>
        </section>
        <section className="surface-panel min-w-0 overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2 border-b border-border px-5 py-4 font-mono text-[11px] text-muted-foreground"><Terminal className="h-4 w-4 text-primary" /> project / getting-started<span className="ml-auto flex gap-1.5" aria-hidden="true"><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" /><span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" /><span className="h-1.5 w-1.5 rounded-full bg-primary/60" /></span></div>
          <div className="space-y-2 p-4">
            {[
              { title: "Connect your code", detail: "Bring in a GitHub repository.", href: `/projects/${projectId}/repositories`, icon: GitBranch, complete: project.stats.repositories > 0 },
              { title: "Add the bigger picture", detail: "Upload docs, specs, and decisions.", href: `/projects/${projectId}/knowledge`, icon: BookOpen, complete: project.stats.documents > 0 },
              { title: "Start a conversation", detail: "Ask a question. Follow the sources.", href: `/projects/${projectId}/chat`, icon: MessagesSquare, complete: project.stats.conversations > 0 },
            ].map((step, index) => (
              <Link key={step.title} href={step.href} className="group flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-muted/50">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border font-mono text-xs ${step.complete ? "border-primary/20 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>{step.complete ? <Check className="h-4 w-4" /> : `0${index + 1}`}</span>
                <div className="min-w-0 flex-1"><h3 className="text-sm font-medium">{step.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{step.detail}</p></div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
              </Link>
            ))}
          </div>
          <p className="border-t border-border px-5 py-3 font-mono text-[10px] text-muted-foreground"><span className="mr-2 text-primary">~</span> More context makes better answers.</p>
        </section>
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit project">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea id="edit-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`Delete "${project.name}"?`}
        description="This permanently deletes the project and everything in it. This cannot be undone."
        confirmLabel="Delete project"
        destructive
      />
    </div>
  );
}
