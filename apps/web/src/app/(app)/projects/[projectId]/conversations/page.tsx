"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MessagesSquare, Trash2, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { Conversation } from "@/lib/types";

export default function ConversationsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Conversation | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await api.get<Conversation[]>(`/projects/${projectId}/conversations`);
      setConversations(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to load conversations.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/projects/${projectId}/conversations/${deleteTarget.id}`);
      toast({ title: "Conversation deleted", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Conversations</h1>
          <p className="text-sm text-muted-foreground">All conversations in this project.</p>
        </div>
        <Button asChild>
          <Link href={`/projects/${projectId}/chat`}>
            <Plus className="h-4 w-4" /> New conversation
          </Link>
        </Button>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && conversations === null && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {!error && conversations !== null && conversations.length === 0 && (
        <EmptyState
          icon={<MessagesSquare className="h-8 w-8" />}
          title="No conversations yet"
          description="Start a conversation in the AI Workspace to ask about your codebase."
          action={
            <Button asChild size="sm">
              <Link href={`/projects/${projectId}/chat`}>Open AI Workspace</Link>
            </Button>
          }
        />
      )}

      {!error && conversations !== null && conversations.length > 0 && (
        <div className="space-y-2">
          {conversations.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between p-4">
                <Link href={`/projects/${projectId}/chat?conversation=${c.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">Updated {formatRelativeTime(c.updated_at)}</p>
                </Link>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.title}"?`}
        description="This permanently deletes the conversation and its messages."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
