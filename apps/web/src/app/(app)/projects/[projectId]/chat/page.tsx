"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, ArrowUpRight, Bug, Code2, Command, FileCode2, GitBranch, History, Loader2, PanelRight, Plus, Sparkles, Square, Terminal, X } from "lucide-react";
import { ConversationList } from "@/components/chat/conversation-list";
import { MessageBubble } from "@/components/chat/message-bubble";
import { SourcesPanel } from "@/components/chat/sources-panel";
import { SourceViewerDialog } from "@/components/chat/source-viewer-dialog";
import { Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { streamChat } from "@/lib/sse";
import type { Citation, Conversation, ConversationDetail, Message } from "@/lib/types";

const starters = [
  { icon: Code2, title: "Understand the code", description: "Get the story behind the implementation", prompt: "Walk me through the main entry points of this codebase and how they connect." },
  { icon: Bug, title: "Find the root cause", description: "Trace a problem back to its source", prompt: "Help me investigate potential bugs in the authentication flow. Cite the relevant files." },
  { icon: GitBranch, title: "Explore the architecture", description: "See how the pieces fit together", prompt: "Explain this project's architecture and the flow of data between its main components." },
  { icon: FileCode2, title: "Plan your next change", description: "Know what to touch before you build", prompt: "Help me plan a new feature. Start by explaining the project's conventions and where new functionality belongs." },
];

export default function ChatPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const conversationId = searchParams.get("conversation");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeAgentRunId, setActiveAgentRunId] = useState<string | null>(null);
  const [activeCitations, setActiveCitations] = useState<Citation[]>([]);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isLoadingConversation, setIsLoadingConversation] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<"history" | "sources" | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.get<Conversation[]>(`/projects/${projectId}/conversations`);
      setConversations(data);
      return data;
    } catch {
      return [];
    }
  }, [projectId]);

  const loadConversation = useCallback(
    async (id: string) => {
      setIsLoadingConversation(true);
      try {
        const detail = await api.get<ConversationDetail>(`/projects/${projectId}/conversations/${id}`);
        setMessages(detail.messages);
        const lastAssistant = [...detail.messages].reverse().find((m) => m.role === "assistant");
        setActiveCitations(lastAssistant?.citations || []);
      } catch (err) {
        toast({ title: "Failed to load conversation", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
      } finally {
        setIsLoadingConversation(false);
      }
    },
    [projectId, toast]
  );

  useEffect(() => {
    loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    if (conversationId) {
      loadConversation(conversationId);
      setActiveAgentRunId(null);
    } else {
      setMessages([]);
      setActiveCitations([]);
    }
  }, [conversationId, loadConversation]);

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const empty = messages.length === 0 && !streamingContent;
    const pausedMotion = document.documentElement.dataset.motion === "paused";
    scrollRef.current?.scrollTo({ top: empty ? 0 : scrollRef.current.scrollHeight, behavior: empty || isStreaming || reducedMotion || pausedMotion ? "auto" : "smooth" });
  }, [messages, streamingContent, isStreaming]);

  useEffect(() => {
    if (!mobilePanel) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobilePanel(null);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [mobilePanel]);

  async function handleCreateConversation() {
    try {
      const conversation = await api.post<Conversation>(`/projects/${projectId}/conversations`, {});
      await loadConversations();
      router.push(`/projects/${projectId}/chat?conversation=${conversation.id}`);
    } catch (err) {
      toast({ title: "Failed to create conversation", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    }
  }

  async function handleRename(id: string, title: string) {
    try {
      await api.patch(`/projects/${projectId}/conversations/${id}`, { title });
      loadConversations();
    } catch (err) {
      toast({ title: "Rename failed", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/projects/${projectId}/conversations/${id}`);
      toast({ title: "Conversation deleted", variant: "success" });
      if (id === conversationId) router.push(`/projects/${projectId}/chat`);
      loadConversations();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    }
  }

  async function handleSend() {
    const question = input.trim();
    if (!question || isStreaming || isLoadingConversation) return;

    let targetConversationId = conversationId;
    if (!targetConversationId) {
      try {
        const conversation = await api.post<Conversation>(`/projects/${projectId}/conversations`, {
          title: question.slice(0, 80),
        });
        targetConversationId = conversation.id;
        router.push(`/projects/${projectId}/chat?conversation=${conversation.id}`);
        await loadConversations();
      } catch (err) {
        toast({ title: "Failed to start conversation", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
        return;
      }
    }

    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, role: "user", content: question, created_at: new Date().toISOString(), citations: [] },
    ]);
    setIsStreaming(true);
    setStreamingContent("");
    setActiveCitations([]);
    setActiveAgentRunId(null);

    const controller = new AbortController();
    abortRef.current = controller;

    let accumulated = "";
    try {
      await streamChat(
        projectId,
        targetConversationId,
        question,
        (event) => {
          if (event.type === "agent_run_started" && event.agent_run_id) {
            setActiveAgentRunId(event.agent_run_id);
          } else if (event.type === "token" && event.content) {
            accumulated += event.content;
            setStreamingContent(accumulated);
          } else if (event.type === "done") {
            setActiveCitations(
              (event.citations || []).map((c) => ({
                marker: c.marker,
                display_label: c.display_label,
                source_type: c.source_type as Citation["source_type"],
                file_path: c.file_path,
                document_name: c.document_name,
                repository_full_name: null,
                start_line: c.start_line,
                end_line: c.end_line,
                snippet: "",
              }))
            );
          } else if (event.type === "error" && event.message) {
            toast({ title: "Chat error", description: event.message, variant: "error" });
          }
        },
        controller.signal
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        toast({ title: "Unable to complete response", description: err instanceof Error ? err.message : undefined, variant: "error" });
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      if (targetConversationId) {
        await loadConversation(targetConversationId);
      }
      setStreamingContent("");
      loadConversations();
    }
  }

  function handleCitationClick(citation: Citation) {
    if (citation.snippet) {
      setSelectedCitation(citation);
    } else {
      toast({ title: "Open the agent run trace to view full source detail", variant: "default" });
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-card/70 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary"><Terminal className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold">AI Workspace</h1>
            <p className="truncate font-mono text-[10px] text-muted-foreground">your code, in conversation</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="mr-3 hidden items-center gap-2 font-mono text-[10px] text-muted-foreground sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Cited answers</span>
          <button onClick={() => setMobilePanel(mobilePanel === "history" ? null : "history")} aria-label="Toggle conversation history" aria-expanded={mobilePanel === "history"} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"><History className="h-4 w-4" /></button>
          <button onClick={() => setMobilePanel(mobilePanel === "sources" ? null : "sources")} aria-label="Toggle sources" aria-expanded={mobilePanel === "sources"} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground 2xl:hidden"><PanelRight className="h-4 w-4" /></button>
          <Button variant="outline" size="sm" onClick={handleCreateConversation} disabled={isStreaming} aria-label="New conversation" className="gap-1.5"><Plus className="h-3.5 w-3.5" /><span className="hidden sm:inline">New chat</span></Button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {mobilePanel && <button aria-label="Close side panel" onClick={() => setMobilePanel(null)} className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm 2xl:hidden" />}
        <aside className={`${mobilePanel === "history" ? "absolute inset-y-0 left-0 z-30 block shadow-2xl" : "hidden"} w-60 shrink-0 bg-card lg:static lg:z-auto lg:block lg:bg-card/60`} aria-label="Conversation history">
          {mobilePanel === "history" && <button onClick={() => setMobilePanel(null)} aria-label="Close history" className="absolute right-3 top-3 rounded p-1.5 text-muted-foreground hover:bg-muted lg:hidden"><X className="h-4 w-4" /></button>}
          <ConversationList
            conversations={conversations}
            activeId={conversationId}
            onSelect={(id) => { router.push(`/projects/${projectId}/chat?conversation=${id}`); setMobilePanel(null); }}
            onCreate={() => { handleCreateConversation(); setMobilePanel(null); }}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-10 shrink-0 items-center border-b border-border/70 bg-background/40 px-4">
            <span className="flex h-full max-w-full items-center gap-2 border-b border-primary px-2 font-mono text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3 text-primary" /><span className="truncate">{conversations.find((c) => c.id === conversationId)?.title || "new-conversation"}</span><span className="ml-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" /></span>
          </div>
          <div ref={scrollRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-7">
            {messages.length === 0 && !isLoadingConversation && !isStreaming && (
              <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-4 sm:py-7">
                <div className="animate-enter">
                  <div className="relative mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary shadow-[0_0_40px_-10px_hsl(var(--primary)/0.3)]"><Terminal className="h-7 w-7" /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-[3px] border-background bg-primary" /></div>
                  <p className="eyebrow mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Built for your next breakthrough</p>
                  <h2 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">Less searching.<br /><span className="text-muted-foreground">More understanding.</span></h2>
                  <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">Explore your code, untangle a bug, or plan what comes next. Your AI team connects the dots, with sources you can inspect.</p>
                </div>
                <div className="mt-8 grid gap-2.5 sm:grid-cols-2">
                  {starters.map(({ icon: Icon, title, description, prompt }, index) => (
                    <button key={title} onClick={() => { setInput(prompt); inputRef.current?.focus(); }} className={`animate-enter stagger-${index + 1} group rounded-xl border border-border bg-card/70 p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/[0.04] motion-reduce:hover:translate-y-0`}>
                      <div className="mb-3 flex items-center justify-between"><Icon className="h-4 w-4 text-primary/80" /><ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground/40 transition duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none" /></div>
                      <p className="text-xs font-medium">{title}</p><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mx-auto max-w-3xl space-y-7">
              {isLoadingConversation && <p role="status" className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading conversation...</p>}
              {messages.map((message) => <MessageBubble key={message.id} role={message.role} content={message.content} citations={message.citations} onCitationClick={handleCitationClick} />)}
              {isStreaming && <MessageBubble role="assistant" content={streamingContent || "Exploring your codebase..."} citations={activeCitations} onCitationClick={handleCitationClick} isStreaming />}
            </div>
          </div>

          <div className="shrink-0 px-4 pb-4 pt-2 sm:px-7 sm:pb-5">
            <div className="mx-auto max-w-3xl">
              <div className="overflow-hidden rounded-2xl border border-border bg-card/90 shadow-lg transition duration-300 focus-within:border-primary/50 focus-within:shadow-[0_0_24px_-12px_hsl(var(--primary)/0.25)]">
                <Textarea
                  ref={inputRef}
                  aria-label="Ask about your codebase"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); } }}
                  placeholder="Ask a question. Follow a thought. Build something."
                  rows={2}
                  disabled={isStreaming}
                  className="min-h-[76px] rounded-none border-0 bg-transparent px-4 pb-1 pt-4 shadow-none focus-visible:ring-0"
                />
                <div className="flex items-center justify-between px-3 pb-3">
                  <span className="flex items-center gap-1.5 rounded-md border border-border bg-background/50 px-2 py-1 font-mono text-[10px] text-muted-foreground"><Command className="h-3 w-3 text-primary" />Project context</span>
                  <div className="flex items-center gap-3">
                    <span className="hidden font-mono text-[10px] text-muted-foreground sm:inline">shift + enter for a new line</span>
                    {isStreaming ? <Button size="icon" variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Stop response" className="h-8 w-8 rounded-lg"><Square className="h-3.5 w-3.5 fill-current" /></Button> : <Button size="icon" onClick={handleSend} disabled={!input.trim() || isLoadingConversation} aria-label="Send message" className="h-8 w-8 rounded-lg"><ArrowUp className="h-4 w-4" /></Button>}
                  </div>
                </div>
              </div>
              <p className="mt-2.5 text-center text-[10px] text-muted-foreground">Answers grounded in your connected code and documentation.</p>
            </div>
          </div>
        </div>

        <aside className={`${mobilePanel === "sources" ? "absolute inset-y-0 right-0 z-30 block shadow-2xl" : "hidden"} w-64 shrink-0 bg-card 2xl:static 2xl:z-auto 2xl:block 2xl:bg-card/60`} aria-label="Sources and activity">
          {mobilePanel === "sources" && <button onClick={() => setMobilePanel(null)} aria-label="Close sources" className="absolute right-3 top-3 rounded p-1.5 text-muted-foreground hover:bg-muted 2xl:hidden"><X className="h-4 w-4" /></button>}
          <SourcesPanel citations={activeCitations} agentRunId={activeAgentRunId} projectId={projectId} isRunning={isStreaming} onCitationClick={handleCitationClick} />
        </aside>
      </div>
      <SourceViewerDialog citation={selectedCitation} onClose={() => setSelectedCitation(null)} />
    </div>
  );
}
