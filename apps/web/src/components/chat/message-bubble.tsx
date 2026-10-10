"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Terminal, User, Copy, Check, Code2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/types";

/** Turns bare "[1]" citation markers into markdown links our renderer can intercept. */
export function linkifyCitations(content: string): string {
  return content.replace(/\[(\d+)\]/g, "[[$1]](citation:$1)");
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="relative my-4 overflow-hidden rounded-xl border border-border">
      <div className="flex items-center justify-between border-b border-border bg-background/70 px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
        <span className="flex items-center gap-2"><Code2 className="h-3 w-3 text-primary/70" />{language || "text"}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 hover:text-foreground">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={oneDark}
        customStyle={{ margin: 0, fontSize: "0.75rem", background: "#101519", padding: "1rem", lineHeight: 1.75 }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export function MessageBubble({
  role,
  content,
  citations,
  onCitationClick,
  isStreaming,
}: {
  role: "user" | "assistant" | "system";
  content: string;
  citations: Citation[];
  onCitationClick: (citation: Citation) => void;
  isStreaming?: boolean;
}) {
  const isUser = role === "user";

  return (
    <div className={cn("animate-enter flex min-w-0 gap-3", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
          isUser ? "border-border bg-muted text-muted-foreground" : "border-primary/25 bg-primary/10 text-primary"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          "min-w-0 max-w-[calc(100%-44px)] text-sm leading-relaxed",
          isUser ? "rounded-xl rounded-tr-sm border border-border bg-card px-4 py-3 text-foreground" : "flex-1 pt-1"
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <div className="markdown-body break-words">
            <div className="mb-3 flex items-center gap-2"><span className="text-xs font-semibold tracking-tight">DevMind</span><span className="rounded border border-primary/20 bg-primary/[0.06] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-wide text-primary">AI</span>{isStreaming && <span className="font-mono text-[9px] text-muted-foreground">working...</span>}</div>
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  if (href?.startsWith("citation:")) {
                    const marker = parseInt(href.replace("citation:", ""), 10);
                    const citation = citations.find((c) => c.marker === marker);
                    if (!citation) return <>{children}</>;
                    return (
                      <button
                        onClick={() => onCitationClick(citation)}
                        className="mx-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary/15 px-1 text-xs font-medium text-primary align-super hover:bg-primary/25"
                        title={citation.display_label}
                      >
                        {marker}
                      </button>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noreferrer" className="text-primary underline">
                      {children}
                    </a>
                  );
                },
                code({ className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match && !String(children).includes("\n");
                  if (isInline) {
                    return (
                      <code className="rounded border border-border/70 bg-card px-1.5 py-0.5 font-mono text-xs text-primary/90" {...props}>
                        {children}
                      </code>
                    );
                  }
                  return (
                    <CodeBlock language={match?.[1] || ""} code={String(children).replace(/\n$/, "")} />
                  );
                },
              }}
            >
              {linkifyCitations(content)}
            </ReactMarkdown>
            {isStreaming && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-primary/70" />}
          </div>
        )}
      </div>
    </div>
  );
}
