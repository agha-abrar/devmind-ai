export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  role: "owner" | "admin" | "member";
  created_at: string;
}

export interface ProjectStats {
  repositories: number;
  documents: number;
  indexed_files: number;
  knowledge_chunks: number;
  conversations: number;
  agent_runs: number;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: "active" | "archived";
  created_at: string;
  updated_at: string;
}

export interface ProjectDetail extends Project {
  stats: ProjectStats;
}

export type RepositoryStatus = "pending" | "indexing" | "indexed" | "failed";

export interface Repository {
  id: string;
  project_id: string;
  provider: string;
  owner: string;
  name: string;
  full_name: string;
  default_branch: string;
  last_indexed_commit_sha: string | null;
  status: RepositoryStatus;
  error_message: string | null;
  indexed_file_count: number;
  created_at: string;
  updated_at: string;
}

export type DocumentStatus = "uploaded" | "processing" | "indexed" | "failed";

export interface KnowledgeDocument {
  id: string;
  project_id: string;
  original_filename: string;
  file_type: string;
  size_bytes: number;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Citation {
  marker: number;
  display_label: string;
  source_type: "code_file" | "document";
  file_path: string | null;
  document_name: string | null;
  repository_full_name: string | null;
  start_line: number | null;
  end_line: number | null;
  snippet: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
  citations: Citation[];
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export type AgentRunStatus = "pending" | "running" | "completed" | "failed";
export type ReviewStatus = "supported" | "needs_more_evidence" | "unsupported";
export type AgentStepStatus = "pending" | "running" | "completed" | "failed" | "skipped";
export type AgentName =
  | "supervisor"
  | "code_retrieval"
  | "documentation"
  | "debugging"
  | "architecture"
  | "implementation_planning"
  | "reviewer";

export interface AgentStep {
  id: string;
  sequence_index: number;
  agent_name: AgentName;
  status: AgentStepStatus;
  duration_ms: number | null;
  tool_calls: Array<{ tool: string; query: string; results: number }> | null;
  retrieved_count: number;
  input_tokens: number;
  output_tokens: number;
  summary: string | null;
  error_message: string | null;
}

export interface AgentRun {
  id: string;
  project_id: string;
  conversation_id: string;
  message_id: string | null;
  user_question: string;
  status: AgentRunStatus;
  review_status: ReviewStatus | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  total_input_tokens: number;
  total_output_tokens: number;
  estimated_cost_usd: number;
  error_message: string | null;
  created_at: string;
}

export interface AgentRunDetail extends AgentRun {
  steps: AgentStep[];
}

export interface ApiError {
  detail: string | Array<{ msg: string; loc: string[] }>;
  error_type?: string;
}
