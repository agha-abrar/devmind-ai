"use client";

import { useState } from "react";
import { Plus, MessageSquare, Pencil, Trash2, Check, X, Hash, Terminal } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Conversation } from "@/lib/types";

export function ConversationList({
  conversations, activeId, onSelect, onCreate, onRename, onDelete,
}: {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  function saveTitle(id: string) {
    if (editValue.trim()) onRename(id, editValue.trim());
    setEditingId(null);
  }

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border">
      <div className="px-4 pb-4 pt-5">
        <p className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><Hash className="h-3 w-3" />Conversations<span className="rounded bg-muted px-1.5 py-0.5 text-[9px]">{conversations.length}</span></p>
        <button onClick={onCreate} className="flex w-full items-center justify-between rounded-lg border border-primary/20 bg-primary/[0.06] px-3 py-2.5 text-xs font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/10"><span>New conversation</span><Plus className="h-3.5 w-3.5" /></button>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2">
        {conversations.length === 0 && (
          <div className="px-3 py-7 text-center"><MessageSquare className="mx-auto mb-3 h-5 w-5 text-muted-foreground/40" /><p className="text-xs text-muted-foreground">A fresh start.</p><p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">Your conversations will live here.<br />Let&apos;s get something started.</p></div>
        )}
        {conversations.map((conversation) => (
          <div key={conversation.id} className={cn("group mb-1 flex items-center gap-1 rounded-lg border px-2.5 py-3 transition-colors", activeId === conversation.id ? "border-primary/20 bg-primary/[0.07]" : "border-transparent hover:bg-muted/60")}>
            {editingId === conversation.id ? (
              <div className="flex min-w-0 flex-1 items-center gap-1">
                <input autoFocus aria-label="Conversation title" value={editValue} onChange={(e) => setEditValue(e.target.value)} className="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2 text-xs outline-none focus:border-primary" onKeyDown={(e) => { if (e.key === "Enter") saveTitle(conversation.id); if (e.key === "Escape") setEditingId(null); }} />
                <button aria-label="Save conversation title" onClick={() => saveTitle(conversation.id)} className="rounded p-1 hover:bg-muted"><Check className="h-3.5 w-3.5 text-primary" /></button>
                <button aria-label="Cancel renaming" onClick={() => setEditingId(null)} className="rounded p-1 hover:bg-muted"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            ) : (
              <>
                <button onClick={() => onSelect(conversation.id)} aria-current={activeId === conversation.id ? "page" : undefined} className="flex min-w-0 flex-1 items-start gap-2.5 text-left">
                  <MessageSquare className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", activeId === conversation.id ? "text-primary" : "text-muted-foreground")} />
                  <span className="min-w-0"><span className={cn("block truncate text-xs", activeId === conversation.id ? "text-foreground" : "text-muted-foreground")}>{conversation.title}</span><span className="mt-1.5 block font-mono text-[9px] text-muted-foreground">{formatRelativeTime(conversation.updated_at)}</span></span>
                </button>
                <div className="flex shrink-0 flex-col opacity-70 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 lg:opacity-0">
                  <button onClick={() => { setEditingId(conversation.id); setEditValue(conversation.title); }} aria-label="Rename conversation" className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => onDelete(conversation.id)} aria-label="Delete conversation" className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="m-3 rounded-lg border border-border/80 bg-background/40 p-3"><Terminal className="mb-2 h-3.5 w-3.5 text-primary/70" /><p className="text-[11px] leading-relaxed text-muted-foreground">One conversation. Your entire codebase in context.</p></div>
    </div>
  );
}
