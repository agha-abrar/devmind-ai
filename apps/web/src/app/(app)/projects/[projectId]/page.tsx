"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { GitBranch, BookOpen, Bot, Activity, MessagesSquare, Pencil, Trash2, Loader2 } from "lucide-react";
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
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const quickLinks = [
    { label: "Repositories", href: `/projects/${projectId}/repositories`, icon: GitBranch, value: project.stats.repositories },
    { label: "Knowledge", href: `/projects/${projectId}/knowledge`, icon: BookOpen, value: project.stats.documents },
    { label: "AI Workspace", href: `/projects/${projectId}/chat`, icon: Bot, value: project.stats.knowledge_chunks },
    { label: "Conversations", href: `/projects/${projectId}/conversations`, icon: MessagesSquare, value: project.stats.conversations },
    { label: "Agent Runs", href: `/projects/${projectId}/agent-runs`, icon: Activity, value: project.stats.agent_runs },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Badge variant={project.status === "active" ? "success" : "secondary"}>{project.status}</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-muted-foreground">{project.description || "No description yet."}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {quickLinks.map((link) => (
          <Link key={link.label} href={link.href}>
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="p-5">
                <link.icon className="h-4 w-4 text-muted-foreground" />
                <p className="mt-2 text-2xl font-semibold">{link.value}</p>
                <p className="text-xs text-muted-foreground">{link.label}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
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
