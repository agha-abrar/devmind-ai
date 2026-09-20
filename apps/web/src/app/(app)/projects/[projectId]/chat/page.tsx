"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
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
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamingContent]);

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
    if (!question || isStreaming) return;

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
    } finally {
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
    <div className="flex h-screen">
      <ConversationList
        conversations={conversations}
        activeId={conversationId}
        onSelect={(id) => router.push(`/projects/${projectId}/chat?conversation=${id}`)}
        onCreate={handleCreateConversation}
        onRename={handleRename}
        onDelete={handleDelete}
      />

      <div className="flex flex-1 flex-col">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin p-6">
          {!conversationId && messages.length === 0 && (
            <div className="flex h-full items-center justify-center text-center text-muted-foreground">
              <div>
                <p className="font-medium text-foreground">Ask a question about your codebase</p>
                <p className="mt-1 text-sm">e.g. &quot;Where is authentication implemented?&quot;</p>
              </div>
            </div>
          )}
          {isLoadingConversation && <p className="text-sm text-muted-foreground">Loading conversation...</p>}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role}
              content={message.content}
              citations={message.citations}
              onCitationClick={handleCitationClick}
            />
          ))}
          {isStreaming && (
            <MessageBubble
              role="assistant"
              content={streamingContent || "Thinking..."}
              citations={activeCitations}
              onCitationClick={handleCitationClick}
              isStreaming
            />
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about your codebase or documentation..."
              rows={2}
              disabled={isStreaming}
              className="flex-1"
            />
            <Button onClick={handleSend} disabled={isStreaming || !input.trim()}>
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <SourcesPanel
        citations={activeCitations}
        agentRunId={activeAgentRunId}
        projectId={projectId}
        isRunning={isStreaming}
        onCitationClick={handleCitationClick}
      />

      <SourceViewerDialog citation={selectedCitation} onClose={() => setSelectedCitation(null)} />
    </div>
  );
}
