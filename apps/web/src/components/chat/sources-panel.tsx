"use client";

import Link from "next/link";
import { FileText, Code2, ExternalLink, Loader2, Activity } from "lucide-react";
import type { Citation } from "@/lib/types";

export function SourcesPanel({
  citations,
  agentRunId,
  projectId,
  isRunning,
  onCitationClick,
}: {
  citations: Citation[];
  agentRunId: string | null;
  projectId: string;
  isRunning: boolean;
  onCitationClick: (citation: Citation) => void;
}) {
  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l border-border">
      <div className="border-b border-border p-3">
        <h2 className="text-sm font-semibold">Sources &amp; Activity</h2>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
        {isRunning && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Agents are retrieving evidence and reasoning...
          </div>
        )}

        {!isRunning && citations.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Sources used to ground the last response will appear here.
          </p>
        )}

        {citations.length > 0 && (
          <div className="space-y-2">
            {citations.map((citation) => (
              <button
                key={citation.marker}
                onClick={() => onCitationClick(citation)}
                className="flex w-full items-start gap-2 rounded-md border border-border p-2.5 text-left hover:border-primary/50 hover:bg-muted"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-medium text-primary">
                  {citation.marker}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{citation.display_label}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    {citation.source_type === "code_file" ? (
                      <Code2 className="h-3 w-3" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    {citation.source_type === "code_file" ? "Source code" : "Document"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {agentRunId && (
        <div className="border-t border-border p-3">
          <Link
            href={`/projects/${projectId}/agent-runs/${agentRunId}`}
            className="flex items-center justify-center gap-2 rounded-md border border-border py-2 text-sm font-medium hover:bg-muted"
          >
            <Activity className="h-4 w-4" />
            View agent run trace
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      )}
    </div>
  );
}
