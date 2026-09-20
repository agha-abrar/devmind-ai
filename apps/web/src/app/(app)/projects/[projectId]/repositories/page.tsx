"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { GitBranch, Plus, RefreshCw, Trash2, Loader2, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/badge";
import { Dialog, ConfirmDialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { Repository, RepositoryStatus } from "@/lib/types";

const STATUS_VARIANT: Record<RepositoryStatus, "secondary" | "warning" | "success" | "destructive"> = {
  pending: "secondary",
  indexing: "warning",
  indexed: "success",
  failed: "destructive",
};

export default function RepositoriesPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();

  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Repository | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await api.get<Repository[]>(`/projects/${projectId}/repositories`);
      setRepos(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to load repositories.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const hasInFlight = repos?.some((r) => r.status === "pending" || r.status === "indexing");
    if (hasInFlight && !pollRef.current) {
      pollRef.current = setInterval(load, 4000);
    } else if (!hasInFlight && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repos]);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      await api.post(`/projects/${projectId}/repositories`, {
        repo_url: repoUrl,
        access_token: accessToken || undefined,
      });
      toast({ title: "Repository connected", description: "Indexing has started in the background.", variant: "success" });
      setConnectOpen(false);
      setRepoUrl("");
      setAccessToken("");
      load();
    } catch (err) {
      setFormError(err instanceof ApiRequestError ? err.detail : "Failed to connect repository.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResync(repo: Repository) {
    try {
      await api.post(`/projects/${projectId}/repositories/${repo.id}/resync`);
      toast({ title: "Re-sync started", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Re-sync failed", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/projects/${projectId}/repositories/${deleteTarget.id}`);
      toast({ title: "Repository removed", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Failed to remove repository", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Repositories</h1>
          <p className="text-sm text-muted-foreground">Connect GitHub repositories to index their source code.</p>
        </div>
        <Button onClick={() => setConnectOpen(true)}>
          <Plus className="h-4 w-4" /> Connect repository
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && repos === null && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      )}

      {!error && repos !== null && repos.length === 0 && (
        <EmptyState
          icon={<GitBranch className="h-8 w-8" />}
          title="No repositories connected"
          description="Connect a public or private GitHub repository to start indexing its source code."
          action={
            <Button size="sm" onClick={() => setConnectOpen(true)}>
              Connect repository
            </Button>
          }
        />
      )}

      {!error && repos !== null && repos.length > 0 && (
        <div className="space-y-3">
          {repos.map((repo) => (
            <Card key={repo.id}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`https://github.com/${repo.full_name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 font-medium hover:underline"
                    >
                      {repo.full_name} <ExternalLink className="h-3 w-3" />
                    </a>
                    <Badge variant={STATUS_VARIANT[repo.status]}>{repo.status}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {repo.status === "failed" && repo.error_message
                      ? repo.error_message
                      : `Branch ${repo.default_branch} · ${repo.indexed_file_count} files indexed · updated ${formatRelativeTime(repo.updated_at)}`}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" title="Re-sync" onClick={() => handleResync(repo)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" title="Remove" onClick={() => setDeleteTarget(repo)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        title="Connect a GitHub repository"
        description="Public repos work without a token. Private repos need a token with repo read access."
      >
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="repo-url">Repository URL</Label>
            <Input
              id="repo-url"
              required
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="access-token">Access token (optional, for private repos)</Label>
            <Input
              id="access-token"
              type="password"
              placeholder="ghp_..."
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Never stored — used only for this ingestion job.</p>
          </div>
          {formError && <p className="rounded-md bg-destructive/10 p-2 text-sm text-destructive">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setConnectOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Connect
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Remove ${deleteTarget?.full_name}?`}
        description="This removes all indexed files and chunks for this repository."
        confirmLabel="Remove"
        destructive
      />
    </div>
  );
}
