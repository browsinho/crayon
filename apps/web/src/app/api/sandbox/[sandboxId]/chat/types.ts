import { z } from "zod";

// ==================== REQUEST ====================

export const ChatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })
    )
    .max(50)
    .default([]),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// ==================== SSE EVENTS ====================

export type SSEEventType =
  | "thinking"
  | "tool_call"
  | "tool_result"
  | "message"
  | "compile_start"
  | "compile_done"
  | "done"
  | "error";

export interface SSEEvent {
  event: SSEEventType;
  data: Record<string, unknown>;
}

// Specific event data types
export interface ThinkingEventData {
  timestamp: number;
}

export interface ToolCallEventData {
  toolName: string;
  toolInput: Record<string, unknown>;
}

export interface ToolResultEventData {
  toolName: string;
  success: boolean;
  output: string;
  durationMs: number;
}

export interface MessageEventData {
  content: string;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface CompileStartEventData {
  // No additional data
}

export interface CompileDoneEventData {
  success: boolean;
  errors: Array<{
    file: string;
    line: number;
    column: number;
    message: string;
  }>;
  warnings: Array<{
    file: string;
    line: number;
    message: string;
  }>;
  durationMs: number;
}

export interface DoneEventData {
  filesModified: string[];
  tokensUsed: {
    input: number;
    output: number;
  };
  toolCallsCount: number;
}

export interface ErrorEventData {
  message: string;
  code:
    | "VALIDATION_ERROR"
    | "AUTH_ERROR"
    | "SANDBOX_NOT_FOUND"
    | "AGENT_ERROR"
    | "RATE_LIMIT";
}
