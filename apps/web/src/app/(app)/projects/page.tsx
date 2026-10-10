"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban, Archive, Trash2, MoreVertical, ArrowUpRight, Search, FolderCode, Terminal, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton, EmptyState, ErrorState } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { Project } from "@/lib/types";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "archived">("all");
  const { toast } = useToast();

  async function load() {
    setError(null);
    try {
      const data = await api.get<Project[]>("/projects");
      setProjects(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to load projects.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleArchiveToggle(project: Project) {
    try {
      const nextStatus = project.status === "active" ? "archived" : "active";
      await api.patch(`/projects/${project.id}`, { status: nextStatus });
      toast({ title: nextStatus === "archived" ? "Project archived" : "Project restored", variant: "success" });
      load();
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof ApiRequestError ? err.detail : undefined,
        variant: "error",
      });
    }
    setMenuOpenFor(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/projects/${deleteTarget.id}`);
      toast({ title: "Project deleted", variant: "success" });
      load();
    } catch (err) {
      toast({
        title: "Failed to delete project",
        description: err instanceof ApiRequestError ? err.detail : undefined,
        variant: "error",
      });
    }
  }

  const filteredProjects = projects?.filter((project) =>
    (filter === "all" || project.status === filter) &&
    `${project.name} ${project.description || ""}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-5 sm:p-8 lg:p-10">
      <div className="animate-enter flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow mb-3 flex items-center gap-2"><Terminal className="h-3.5 w-3.5" /> YOUR DEVELOPMENT SPACE</div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your projects<span className="text-primary">.</span></h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Every codebase, connected. Bring your repositories, knowledge, and AI conversations into one place.</p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link href="/projects/new">
            <Plus className="h-4 w-4" /> New project
          </Link>
        </Button>
      </div>

      <div className="animate-enter stagger-1 flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter projects">
          {(["all", "active", "archived"] as const).map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition-colors ${filter === value ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              {value === "all" ? "All projects" : value}
              {value === "all" && projects !== null ? <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px]">{projects.length}</span> : null}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input type="search" aria-label="Search projects" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a project…" className="h-9 w-full rounded-lg border border-border bg-background/60 pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/10" />
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && projects === null && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      )}

      {!error && projects !== null && projects.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="Great ideas start with a project"
          description="Create your first project, connect a repository, and give your AI the context to help you build."
          action={
            <Button asChild size="sm">
              <Link href="/projects/new">Create your first project</Link>
            </Button>
          }
        />
      )}

      {!error && projects !== null && projects.length > 0 && filteredProjects?.length === 0 ? (
        <EmptyState icon={<Search className="h-8 w-8" />} title="No matching projects" description="Try a different search or project status." action={<Button variant="outline" size="sm" onClick={() => { setQuery(""); setFilter("all"); }}>Clear filters</Button>} />
      ) : null}

      {!error && filteredProjects !== undefined && filteredProjects.length > 0 && (
        <div className="animate-enter stagger-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="group relative rounded-2xl transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_12px_40px_-20px_hsl(var(--primary)/0.2)] motion-reduce:transform-none">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-primary/15 bg-primary/5 text-primary transition-colors group-hover:bg-primary/10"><FolderCode className="h-5 w-5" /></div>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenFor(menuOpenFor === project.id ? null : project.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label="Project actions"
                      aria-expanded={menuOpenFor === project.id}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenFor === project.id && (
                      <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border border-border bg-card py-1 shadow-xl">
                        <button
                          onClick={() => handleArchiveToggle(project)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          {project.status === "active" ? "Archive" : "Restore"}
                        </button>
                        <button
                          onClick={() => {
                            setDeleteTarget(project);
                            setMenuOpenFor(null);
                          }}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-destructive hover:bg-muted"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <Link href={`/projects/${project.id}`} className="mt-5 flex min-w-0 items-center justify-between gap-3">
                  <h2 className="truncate text-lg font-semibold tracking-tight transition-colors hover:text-primary">{project.name}</h2>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-[transform,color] duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none" />
                </Link>
                <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                  {project.description || "Your next idea starts here. Connect your code and start exploring."}
                </p>
                <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-4">
                  <Badge variant={project.status === "active" ? "success" : "secondary"}>
                    {project.status}
                  </Badge>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock3 className="h-3 w-3" /> {formatRelativeTime(project.updated_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.name}"?`}
        description="This permanently deletes the project and all of its repositories, documents, conversations, and agent runs. This cannot be undone."
        confirmLabel="Delete project"
        destructive
      />
    </div>
  );
}
