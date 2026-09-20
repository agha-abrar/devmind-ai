"use client";

import { useState } from "react";
import { Plus, MessageSquare, Pencil, Trash2, Check, X } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { Conversation } from "@/lib/types";

export function ConversationList({
  conversations,
  activeId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
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

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-r border-border">
      <div className="flex items-center justify-between border-b border-border p-3">
        <h2 className="text-sm font-semibold">Conversations</h2>
        <button
          onClick={onCreate}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" /> New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {conversations.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No conversations yet. Start one to ask a question.</p>
        )}
        {conversations.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-2 border-b border-border/50 px-3 py-2.5",
              activeId === c.id ? "bg-primary/10" : "hover:bg-muted"
            )}
          >
            {editingId === c.id ? (
              <div className="flex flex-1 items-center gap-1">
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="h-7 flex-1 rounded border border-border bg-background px-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onRename(c.id, editValue);
                      setEditingId(null);
                    }
                    if (e.key === "Escape") setEditingId(null);
                  }}
                />
                <button onClick={() => { onRename(c.id, editValue); setEditingId(null); }}>
                  <Check className="h-3.5 w-3.5 text-success" />
                </button>
                <button onClick={() => setEditingId(null)}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <>
                <button onClick={() => onSelect(c.id)} className="flex flex-1 items-center gap-2 overflow-hidden text-left">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(c.updated_at)}</p>
                  </div>
                </button>
                <div className="hidden shrink-0 gap-1 group-hover:flex">
                  <button
                    onClick={() => {
                      setEditingId(c.id);
                      setEditValue(c.title);
                    }}
                    aria-label="Rename conversation"
                  >
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                  <button onClick={() => onDelete(c.id)} aria-label="Delete conversation">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
