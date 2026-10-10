"use client";

import Link from "next/link";
import { FileText, Code2, ArrowUpRight, Loader2, Activity, Layers, Braces, Search, CheckCheck } from "lucide-react";
import type { Citation } from "@/lib/types";

export function SourcesPanel({
  citations, agentRunId, projectId, isRunning, onCitationClick,
}: {
  citations: Citation[];
  agentRunId: string | null;
  projectId: string;
  isRunning: boolean;
  onCitationClick: (citation: Citation) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col border-l border-border">
      <div className="border-b border-border/70 px-4 py-5"><h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><Layers className="h-3 w-3" />Context &amp; sources</h2></div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4">
        {isRunning && <div role="status" className="mb-4 rounded-xl border border-primary/20 bg-primary/[0.05] p-3"><p className="flex items-center gap-2 text-xs font-medium text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" />Connecting the dots</p><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">Your agents are finding evidence and reviewing their findings.</p></div>}
        {!isRunning && citations.length === 0 && (
          <div className="py-5">
            <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-border"><div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-background/70"><Braces className="h-5 w-5 text-primary/70" /></div><span className="absolute -right-0.5 top-2 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card"><Search className="h-2.5 w-2.5 text-muted-foreground" /></span></div>
            <h3 className="text-center text-xs font-medium">An answer you can trace.</h3><p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">Referenced files and documentation appear here as you explore.</p>
            <div className="mt-7 space-y-2.5" aria-hidden="true">{["w-3/4", "w-1/2", "w-2/3"].map((width) => <div key={width} className="rounded-lg border border-border/50 bg-background/20 px-3 py-3"><div className="flex items-center gap-2"><FileText className="h-3 w-3 text-muted-foreground/20" /><span className={`h-1.5 rounded-full bg-muted ${width}`} /></div><div className="ml-5 mt-2.5 h-1 w-1/2 rounded-full bg-muted/60" /></div>)}</div>
          </div>
        )}
        {citations.length > 0 && <div className="space-y-2"><p className="mb-3 font-mono text-[10px] text-muted-foreground">{citations.length} referenced {citations.length === 1 ? "source" : "sources"}</p>{citations.map((citation) => <button key={citation.marker} onClick={() => onCitationClick(citation)} className="group flex w-full items-start gap-2.5 rounded-lg border border-border bg-background/30 p-3 text-left transition duration-200 hover:border-primary/40 hover:bg-primary/[0.04]"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary/10 font-mono text-[10px] text-primary">{citation.marker}</span><span className="min-w-0 flex-1"><span className="block truncate font-mono text-[11px] font-medium">{citation.display_label}</span><span className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">{citation.source_type === "code_file" ? <Code2 className="h-3 w-3" /> : <FileText className="h-3 w-3" />}{citation.source_type === "code_file" ? "Source code" : "Document"}</span></span><ArrowUpRight className="h-3 w-3 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" /></button>)}</div>}
      </div>
      <div className="border-t border-border p-4">{agentRunId ? <Link href={`/projects/${projectId}/agent-runs/${agentRunId}`} className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"><span className="flex items-center gap-2"><Activity className="h-3.5 w-3.5" />View agent run trace</span><ArrowUpRight className="h-3.5 w-3.5" /></Link> : <p className="flex items-center justify-center gap-2 font-mono text-[10px] text-muted-foreground"><CheckCheck className="h-3.5 w-3.5" />Grounded in your code</p>}</div>
    </div>
  );
}
