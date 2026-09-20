"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderKanban, FileText, Layers, Boxes, MessagesSquare, Activity, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, ApiRequestError } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { Conversation, Project, ProjectDetail } from "@/lib/types";

interface DashboardData {
  projects: Project[];
  totals: {
    projects: number;
    documents: number;
    indexedFiles: number;
    chunks: number;
    conversations: number;
    agentRuns: number;
  };
  recentConversations: Array<Conversation & { projectName: string }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const projects = await api.get<Project[]>("/projects");
      const recentProjects = [...projects]
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 6);

      const details = await Promise.all(
        recentProjects.map((p) => api.get<ProjectDetail>(`/projects/${p.id}`))
      );

      const totals = details.reduce(
        (acc, d) => ({
          projects: projects.length,
          documents: acc.documents + d.stats.documents,
          indexedFiles: acc.indexedFiles + d.stats.indexed_files,
          chunks: acc.chunks + d.stats.knowledge_chunks,
          conversations: acc.conversations + d.stats.conversations,
          agentRuns: acc.agentRuns + d.stats.agent_runs,
        }),
        { projects: projects.length, documents: 0, indexedFiles: 0, chunks: 0, conversations: 0, agentRuns: 0 }
      );

      const conversationLists = await Promise.all(
        recentProjects.slice(0, 3).map(async (p) => {
          const conversations = await api.get<Conversation[]>(`/projects/${p.id}/conversations`);
          return conversations.map((c) => ({ ...c, projectName: p.name }));
        })
      );

      const recentConversations = conversationLists
        .flat()
        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
        .slice(0, 5);

      setData({ projects: recentProjects, totals, recentConversations });
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : "Failed to load dashboard.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <ErrorState message={error} onRetry={load} />
      </div>
    );
  }

  if (!data) return null;

  const metricCards = [
    { label: "Projects", value: data.totals.projects, icon: FolderKanban },
    { label: "Documents", value: data.totals.documents, icon: FileText },
    { label: "Indexed files", value: data.totals.indexedFiles, icon: Boxes },
    { label: "Knowledge chunks", value: data.totals.chunks, icon: Layers },
    { label: "Conversations", value: data.totals.conversations, icon: MessagesSquare },
    { label: "Agent executions", value: data.totals.agentRuns, icon: Activity },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">An overview of your recent activity.</p>
        </div>
        <Button asChild>
          <Link href="/projects/new">
            <Plus className="h-4 w-4" /> New project
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {metricCards.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="p-4">
              <metric.icon className="h-4 w-4 text-muted-foreground" />
              <p className="mt-2 text-2xl font-semibold">{metric.value}</p>
              <p className="text-xs text-muted-foreground">{metric.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create your first project to connect a repository or upload documentation."
                action={
                  <Button asChild size="sm">
                    <Link href="/projects/new">Create project</Link>
                  </Button>
                }
              />
            ) : (
              data.projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-muted"
                >
                  <div>
                    <p className="text-sm font-medium">{project.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Updated {formatRelativeTime(project.updated_at)}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent conversations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.recentConversations.length === 0 ? (
              <EmptyState title="No conversations yet" description="Ask a question in a project's AI Workspace to get started." />
            ) : (
              data.recentConversations.map((conversation) => (
                <Link
                  key={conversation.id}
                  href={`/projects/${conversation.project_id}/chat?conversation=${conversation.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-2.5 hover:bg-muted"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{conversation.title}</p>
                    <p className="text-xs text-muted-foreground">{conversation.projectName}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(conversation.updated_at)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
