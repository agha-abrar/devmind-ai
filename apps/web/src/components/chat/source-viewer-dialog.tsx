"use client";

import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { FileText, Code2 } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import type { Citation } from "@/lib/types";

function languageFromPath(path: string | null): string {
  if (!path) return "text";
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    java: "java",
    go: "go",
    rs: "rust",
    cs: "csharp",
    cpp: "cpp",
    c: "c",
    rb: "ruby",
    php: "php",
    md: "markdown",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    sql: "sql",
  };
  return map[ext || ""] || "text";
}

export function SourceViewerDialog({ citation, onClose }: { citation: Citation | null; onClose: () => void }) {
  if (!citation) return null;

  const lines = citation.snippet.split("\n");
  const startLine = citation.start_line ?? 1;

  return (
    <Dialog
      open={!!citation}
      onClose={onClose}
      title={citation.display_label}
      description={
        citation.source_type === "code_file"
          ? "Source code evidence used for this citation"
          : "Document passage used for this citation"
      }
      className="max-w-3xl rounded-2xl"
    >
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2.5 font-mono text-xs text-muted-foreground">
        {citation.source_type === "code_file" ? <Code2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        {citation.repository_full_name && <span className="truncate">{citation.repository_full_name}</span>}
        <span className="ml-auto shrink-0 text-[10px] text-primary">{citation.start_line ? `L${citation.start_line}${citation.end_line ? `–${citation.end_line}` : ""}` : "Source evidence"}</span>
      </div>
      <div className="max-h-[60vh] overflow-auto rounded-xl border border-border scrollbar-thin">
        <SyntaxHighlighter
          language={languageFromPath(citation.file_path)}
          style={oneDark}
          showLineNumbers
          startingLineNumber={startLine}
          wrapLongLines
          customStyle={{ margin: 0, fontSize: "0.75rem", lineHeight: 1.8, background: "#101519" }}
          lineNumberStyle={{ opacity: 0.4, minWidth: "2.5em" }}
        >
          {lines.join("\n")}
        </SyntaxHighlighter>
      </div>
    </Dialog>
  );
}
