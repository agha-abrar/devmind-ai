"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, FolderKanban, Archive, Trash2, MoreVertical } from "lucide-react";
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Group repositories, documents, and conversations by project.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4" /> New project
          </Link>
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && projects === null && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {!error && projects !== null && projects.length === 0 && (
        <EmptyState
          icon={<FolderKanban className="h-8 w-8" />}
          title="No projects yet"
          description="Create a project to connect a repository or upload documentation."
          action={
            <Button asChild size="sm">
              <Link href="/projects/new">Create your first project</Link>
            </Button>
          }
        />
      )}

      {!error && projects !== null && projects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="relative">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <Link href={`/projects/${project.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{project.name}</p>
                  </Link>
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenFor(menuOpenFor === project.id ? null : project.id)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                      aria-label="Project actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {menuOpenFor === project.id && (
                      <div className="absolute right-0 z-10 mt-1 w-40 rounded-md border border-border bg-card py-1 shadow-lg">
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
                <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                  {project.description || "No description"}
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <Badge variant={project.status === "active" ? "success" : "secondary"}>
                    {project.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Updated {formatRelativeTime(project.updated_at)}
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
