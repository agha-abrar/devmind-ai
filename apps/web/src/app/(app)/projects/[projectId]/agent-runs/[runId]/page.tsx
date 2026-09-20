"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, XCircle, Clock, Bot, Search, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, ErrorState, Skeleton } from "@/components/ui/badge";
import { api, ApiRequestError } from "@/lib/api";
import type { AgentRunDetail, AgentStepStatus } from "@/lib/types";
import type { ComponentType } from "react";

const AGENT_LABELS: Record<string, string> = {
  supervisor: "Supervisor",
  code_retrieval: "Code Retrieval Agent",
  documentation: "Documentation Agent",
  debugging: "Debugging Agent",
  architecture: "Architecture Agent",
  implementation_planning: "Implementation Planning Agent",
  reviewer: "Reviewer Agent",
};

const STEP_STATUS_ICON: Record<AgentStepStatus, ComponentType<{ className?: string }>> = {
  pending: Clock,
  running: Clock,
  completed: CheckCircle2,
  failed: XCircle,
  skipped: Clock,
};

export default function AgentRunDetailPage() {
  const { projectId, runId } = useParams<{ projectId: string; runId: string }>();
  const [run, setRun] = useState<AgentRunDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await api.get<AgentRunDetail>(`/projects/${projectId}/agent-runs/${runId}`);
      setRun(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to load agent run.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, runId]);

  if (error) {
    return (
      <div className="p-8">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Agent Run</p>
        <h1 className="mt-1 text-xl font-semibold">{run.user_question}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={run.status === "completed" ? "success" : run.status === "failed" ? "destructive" : "warning"}>
            {run.status}
          </Badge>
          {run.review_status && <Badge variant="outline">{run.review_status.replace(/_/g, " ")}</Badge>}
          {run.retry_count > 0 && <Badge variant="secondary">{run.retry_count} retrieval retr{run.retry_count === 1 ? "y" : "ies"}</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Duration</p>
            <p className="mt-1 text-lg font-semibold">{run.duration_ms ? `${(run.duration_ms / 1000).toFixed(2)}s` : "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Tokens (in / out)</p>
            <p className="mt-1 text-lg font-semibold">
              {run.total_input_tokens} / {run.total_output_tokens}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Coins className="h-3 w-3" /> Estimated cost
            </p>
            <p className="mt-1 text-lg font-semibold">
              {run.estimated_cost_usd > 0 ? `$${run.estimated_cost_usd.toFixed(4)}` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {run.error_message && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {run.error_message}
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Execution trace</h2>
        <div className="space-y-3">
          {run.steps.map((step, i) => {
            const StatusIcon = STEP_STATUS_ICON[step.status];
            return (
              <div key={step.id} className="relative flex gap-4 pl-2">
                {i < run.steps.length - 1 && (
                  <div className="absolute left-[19px] top-8 h-full w-px bg-border" aria-hidden="true" />
                )}
                <div
                  className={
                    "z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border " +
                    (step.status === "completed"
                      ? "border-success/30 bg-success/10 text-success"
                      : step.status === "failed"
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-border bg-muted text-muted-foreground")
                  }
                >
                  <Bot className="h-4 w-4" />
                </div>
                <Card className="flex-1">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{AGENT_LABELS[step.agent_name] || step.agent_name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <StatusIcon className="h-3.5 w-3.5" />
                        {step.status}
                        {step.duration_ms !== null && <span>· {(step.duration_ms / 1000).toFixed(2)}s</span>}
                      </div>
                    </div>
                    {step.summary && <p className="mt-1.5 text-sm text-muted-foreground">{step.summary}</p>}
                    {step.error_message && (
                      <p className="mt-1.5 text-sm text-destructive">{step.error_message}</p>
                    )}
                    {step.tool_calls && step.tool_calls.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {step.tool_calls.map((tc, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Search className="h-3 w-3" />
                            <code className="rounded bg-muted px-1 py-0.5">{tc.tool}</code>
                            <span>&quot;{tc.query}&quot;</span>
                            <span>· {tc.results} results</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(step.input_tokens > 0 || step.output_tokens > 0) && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {step.input_tokens} in / {step.output_tokens} out tokens
                        {step.retrieved_count > 0 ? ` · ${step.retrieved_count} chunks retrieved` : ""}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
