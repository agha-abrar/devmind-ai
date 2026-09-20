"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/badge";
import { api, ApiRequestError } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { AgentRun, AgentRunStatus } from "@/lib/types";
import type { ComponentType } from "react";

const STATUS_ICON: Record<AgentRunStatus, ComponentType<{ className?: string }>> = {
  pending: Clock,
  running: Clock,
  completed: CheckCircle2,
  failed: XCircle,
};

const STATUS_VARIANT: Record<AgentRunStatus, "secondary" | "warning" | "success" | "destructive"> = {
  pending: "secondary",
  running: "warning",
  completed: "success",
  failed: "destructive",
};

export default function AgentRunsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [runs, setRuns] = useState<AgentRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await api.get<AgentRun[]>(`/projects/${projectId}/agent-runs`);
      setRuns(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to load agent runs.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Agent Runs</h1>
        <p className="text-sm text-muted-foreground">Execution traces for every question asked in this project.</p>
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && runs === null && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {!error && runs !== null && runs.length === 0 && (
        <EmptyState icon={<Activity className="h-8 w-8" />} title="No agent runs yet" description="Ask a question in the AI Workspace to see execution traces here." />
      )}

      {!error && runs !== null && runs.length > 0 && (
        <div className="space-y-2">
          {runs.map((run) => {
            const StatusIcon = STATUS_ICON[run.status];
            return (
              <Link key={run.id} href={`/projects/${projectId}/agent-runs/${run.id}`}>
                <Card className="transition-colors hover:border-primary/50">
                  <CardContent className="flex items-center justify-between p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <StatusIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{run.user_question}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(run.created_at)}
                          {run.duration_ms ? ` · ${(run.duration_ms / 1000).toFixed(1)}s` : ""}
                          {run.estimated_cost_usd > 0 ? ` · $${run.estimated_cost_usd.toFixed(4)}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {run.review_status && <Badge variant="outline">{run.review_status.replace(/_/g, " ")}</Badge>}
                      <Badge variant={STATUS_VARIANT[run.status]}>{run.status}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
