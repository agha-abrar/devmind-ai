"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, ArrowRight, FolderCode, Terminal, GitBranch, FileText, MessagesSquare, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api, ApiRequestError } from "@/lib/api";
import type { Project, Workspace } from "@/lib/types";

export default function NewProjectPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    api.get<Workspace[]>("/workspaces")
      .then((data) => {
        setWorkspaces(data);
        if (data.length > 0) setWorkspaceId(data[0].id);
      })
      .catch((err) => setError(err instanceof ApiRequestError ? err.detail : "Failed to load workspaces."));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const project = await api.post<Project>("/projects", {
        workspace_id: workspaceId,
        name,
        description: description || null,
      });
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to create project.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-5 sm:p-8 lg:py-12">
      <Link href="/projects" className="animate-enter mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" /> Back to projects</Link>
      <div className="animate-enter stagger-1 mb-8">
        <div className="eyebrow mb-3 flex items-center gap-2"><Terminal className="h-3.5 w-3.5" /> INITIALIZE SOMETHING GREAT</div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">A home for your next idea<span className="text-primary">.</span></h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Create a project to bring your code, documentation, and AI conversations together.</p>
      </div>

      <div className="animate-enter stagger-2 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <form onSubmit={handleSubmit} className="surface-panel min-w-0 space-y-6 rounded-2xl p-4 sm:p-8">
        <div className="flex items-center gap-3 border-b border-border pb-5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary"><FolderCode className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold">Project details</h2><p className="mt-1 text-xs text-muted-foreground">Start simple. You can change these later.</p></div></div>

        {workspaces.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="workspace">Workspace</Label>
            <select
              id="workspace"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
            >
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name">Project name</Label>
          <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payments Service" className="h-11" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you building? A little context goes a long way."
          />
        </div>

        {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
          <Button type="submit" disabled={isSubmitting || !workspaceId}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create project
            {!isSubmitting ? <ArrowRight className="h-4 w-4" /> : null}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
      <aside className="min-w-0 space-y-5">
        <div className="surface-panel overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5 font-mono text-[11px] text-muted-foreground"><span className="flex gap-1.5" aria-hidden="true"><span className="h-2 w-2 rounded-full bg-rose-400/60" /><span className="h-2 w-2 rounded-full bg-amber-400/60" /><span className="h-2 w-2 rounded-full bg-primary/60" /></span><span className="ml-2">project.config</span></div>
          <div className="p-4 font-mono text-xs leading-7 sm:p-6">
            <p className="text-muted-foreground">{"// Your workspace, organized."}</p>
            <div className="my-4 flex items-center gap-2 text-primary"><FolderCode className="h-4 w-4 shrink-0" /><span className="truncate font-medium">{name.trim() || "your-next-project"}/</span></div>
            <div className="ml-2 space-y-3 border-l border-border pl-5 text-muted-foreground">
              <div className="flex items-center gap-2.5"><GitBranch className="h-3.5 w-3.5 text-primary/70" /><span>repositories/</span></div>
              <div className="flex items-center gap-2.5"><FileText className="h-3.5 w-3.5 text-sky-400/70" /><span>knowledge/</span></div>
              <div className="flex items-center gap-2.5"><MessagesSquare className="h-3.5 w-3.5 text-violet-400/70" /><span>conversations/</span></div>
            </div>
            <p className="mt-5 break-words text-muted-foreground">{description.trim() ? `// ${description.trim()}` : "// A clear place to think and build."}</p>
          </div>
          <div className="flex items-center gap-2 border-t border-border bg-primary/[0.03] px-5 py-3 font-mono text-[10px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> Project structure preview</div>
        </div>
        <div className="flex items-start gap-3 px-2 text-muted-foreground"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><p className="text-xs leading-6">Once created, connect a GitHub repository or upload your docs. Your AI workspace uses that context to find answers in your code.</p></div>
      </aside>
      </div>
    </div>
  );
}
