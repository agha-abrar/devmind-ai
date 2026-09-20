"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import { FileText, Upload, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, Skeleton } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { api, ApiRequestError } from "@/lib/api";
import { formatBytes, formatRelativeTime } from "@/lib/utils";
import type { DocumentStatus, KnowledgeDocument } from "@/lib/types";

const STATUS_VARIANT: Record<DocumentStatus, "secondary" | "warning" | "success" | "destructive"> = {
  uploaded: "secondary",
  processing: "warning",
  indexed: "success",
  failed: "destructive",
};

export default function KnowledgePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [documents, setDocuments] = useState<KnowledgeDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeDocument | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await api.get<KnowledgeDocument[]>(`/projects/${projectId}/documents`);
      setDocuments(data);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to load documents.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    const hasInFlight = documents?.some((d) => d.status === "uploaded" || d.status === "processing");
    if (hasInFlight && !pollRef.current) {
      pollRef.current = setInterval(load, 3000);
    } else if (!hasInFlight && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        await api.postForm(`/projects/${projectId}/documents`, form);
      }
      toast({ title: "Upload started", description: "Processing will finish shortly.", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/projects/${projectId}/documents/${deleteTarget.id}`);
      toast({ title: "Document deleted", variant: "success" });
      load();
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof ApiRequestError ? err.detail : undefined, variant: "error" });
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Knowledge</h1>
          <p className="text-sm text-muted-foreground">Upload documentation (PDF, DOCX, Markdown, TXT) to index.</p>
        </div>
        <Button onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
          {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload document
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.md,.txt"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && <ErrorState message={error} onRetry={load} />}

      {!error && documents === null && (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {!error && documents !== null && documents.length === 0 && (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No documents yet"
          description="Upload a README, spec, or design doc to give agents documentation context."
          action={
            <Button size="sm" onClick={() => fileInputRef.current?.click()}>
              Upload document
            </Button>
          }
        />
      )}

      {!error && documents !== null && documents.length > 0 && (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{doc.original_filename}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.status === "failed" && doc.error_message
                        ? doc.error_message
                        : `${formatBytes(doc.size_bytes)} · uploaded ${formatRelativeTime(doc.created_at)}`}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={STATUS_VARIANT[doc.status]}>{doc.status}</Badge>
                  <Button variant="ghost" size="icon" title="Delete" onClick={() => setDeleteTarget(doc)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Delete "${deleteTarget?.original_filename}"?`}
        description="This removes the document and all of its indexed knowledge chunks."
        confirmLabel="Delete"
        destructive
      />
    </div>
  );
}
