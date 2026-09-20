import { API_BASE_URL, getAccessToken } from "./api";

export interface ChatStreamEvent {
  type: "agent_run_started" | "token" | "done" | "error";
  agent_run_id?: string;
  content?: string;
  message_id?: string;
  review_status?: string;
  citations?: Array<{
    marker: number;
    display_label: string;
    source_type: string;
    file_path: string | null;
    document_name: string | null;
    start_line: number | null;
    end_line: number | null;
  }>;
  message?: string;
}

/**
 * Streams the chat endpoint via fetch + ReadableStream (native EventSource
 * doesn't support POST bodies or custom headers, which we need for auth).
 */
export async function streamChat(
  projectId: string,
  conversationId: string,
  message: string,
  onEvent: (event: ChatStreamEvent) => void,
  signal?: AbortSignal
): Promise<void> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ conversation_id: conversationId, message }),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    let detail = "Failed to start chat stream.";
    try {
      detail = JSON.parse(text).detail || detail;
    } catch {
      // ignore parse failure, use default detail
    }
    onEvent({ type: "error", message: detail });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() || "";

    for (const frame of frames) {
      const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
      if (!dataLine) continue;
      const jsonText = dataLine.slice("data:".length).trim();
      if (!jsonText) continue;
      try {
        const parsed = JSON.parse(jsonText) as ChatStreamEvent;
        onEvent(parsed);
      } catch {
        // ignore malformed frame
      }
    }
  }
}
